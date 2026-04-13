"""
Geo-validator API — exposes CAOP-backed validation as REST endpoints.

Endpoints
---------
GET  /geo-validator/status
POST /geo-validator/validate          single-point validation
POST /geo-validator/batch-validate    admin: validate every POI in heritage_items
GET  /geo-validator/suspect           admin: list flagged POIs
GET  /geo-validator/audit-log         admin: recent audit entries
POST /geo-validator/lookup/reload     admin: reload CAOP into memory

Single-point validation is public so the frontend can preflight user-submitted
coordinates; the batch / audit endpoints require admin auth.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from geo_validator import log_audit, validate
from services.caop_lookup import lookup

log = logging.getLogger(__name__)

router = APIRouter(prefix="/geo-validator", tags=["Geo Validator"])

_db = None


def set_geo_validator_db(database) -> None:
    global _db
    _db = database


# ─── Optional admin dependency ────────────────────────────────────────────────

try:
    from auth_api import require_admin  # type: ignore
except Exception:  # pragma: no cover
    def require_admin():  # fallback noop
        return None


# ─── Schemas ──────────────────────────────────────────────────────────────────


class ValidateRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    declared_parish_code: Optional[str] = None
    poi_id: Optional[str] = None


class ValidateResponse(BaseModel):
    status: str
    lat: Optional[float]
    lng: Optional[float]
    original_lat: Optional[float]
    original_lng: Optional[float]
    parish: Optional[dict]
    distance_to_border_m: float
    corrections: list[str]
    reason: Optional[str]


class StatusResponse(BaseModel):
    loaded: bool
    parishes: int
    municipalities: int
    districts: int


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/status", response_model=StatusResponse)
async def status():
    stats = lookup.stats() if lookup.is_ready else {
        "parishes": 0, "municipalities": 0, "districts": 0,
    }
    return {"loaded": lookup.is_ready, **stats}


@router.post("/validate", response_model=ValidateResponse)
async def validate_point(req: ValidateRequest):
    result = validate(req.lat, req.lng, declared_parish_code=req.declared_parish_code)
    # Only log if a poi_id was supplied (one-off lat/lng checks are throwaway)
    if req.poi_id and _db is not None:
        await log_audit(_db, poi_id=req.poi_id, result=result, actor="api")
    return result.to_dict()


@router.post("/lookup/reload", dependencies=[Depends(require_admin)])
async def reload_lookup():
    if _db is None:
        raise HTTPException(status_code=500, detail="geo-validator db not wired")
    counts = await lookup.load(_db)
    return {"reloaded": True, "counts": counts}


@router.get("/suspect", dependencies=[Depends(require_admin)])
async def list_suspect(limit: int = Query(100, ge=1, le=1000)):
    if _db is None:
        raise HTTPException(status_code=500, detail="geo-validator db not wired")
    cursor = (
        _db["geo_audit_log"]
        .find({"status": {"$in": ["suspect", "invalid"]}}, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
    )
    return await cursor.to_list(length=limit)


@router.get("/audit-log", dependencies=[Depends(require_admin)])
async def audit_log(
    poi_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(200, ge=1, le=2000),
):
    if _db is None:
        raise HTTPException(status_code=500, detail="geo-validator db not wired")
    query: dict[str, Any] = {}
    if poi_id:
        query["poi_id"] = poi_id
    if status_filter:
        query["status"] = status_filter
    cursor = (
        _db["geo_audit_log"]
        .find(query, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
    )
    return await cursor.to_list(length=limit)


@router.post("/batch-validate", dependencies=[Depends(require_admin)])
async def batch_validate(
    limit: int = Query(500, ge=1, le=5000),
    apply: bool = Query(False, description="persist snapped coordinates back to heritage_items"),
):
    """
    Validate up to `limit` POIs. With `apply=true`, snapped coordinates are
    written back to `heritage_items.location` and the POI is marked
    `caop_validated=true`.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="geo-validator db not wired")
    if not lookup.is_ready:
        await lookup.ensure_loaded(_db)
    if not lookup.is_ready:
        raise HTTPException(
            status_code=503,
            detail="CAOP data not ingested — run scripts/ingest_caop.py first",
        )

    summary = {"scanned": 0, "ok": 0, "snapped": 0, "sea_snapped": 0,
               "suspect": 0, "invalid": 0, "applied": 0}
    cursor = _db["heritage_items"].find(
        {"location": {"$exists": True, "$ne": None}},
        {"id": 1, "location": 1, "freguesia_code": 1, "_id": 0},
    ).limit(limit)

    async for poi in cursor:
        loc = poi.get("location") or {}
        lat = loc.get("lat")
        lng = loc.get("lng")
        if lat is None or lng is None:
            coords = loc.get("coordinates")
            if isinstance(coords, (list, tuple)) and len(coords) >= 2:
                lng, lat = coords[0], coords[1]
        if lat is None or lng is None:
            continue
        summary["scanned"] += 1
        result = validate(lat, lng, declared_parish_code=poi.get("freguesia_code"))
        summary[result.status] = summary.get(result.status, 0) + 1
        await log_audit(_db, poi_id=poi.get("id"), result=result, actor="batch")

        if apply and result.status in ("snapped", "sea_snapped") and result.was_modified:
            update = {
                "location": {"lat": result.lat, "lng": result.lng},
                "caop_validated": True,
            }
            if result.parish:
                update["freguesia_code"] = result.parish.parish_code
                update["concelho_code"] = result.parish.municipality_code
                update["nuts3_code"] = result.parish.nuts3_code
            await _db["heritage_items"].update_one(
                {"id": poi.get("id")},
                {"$set": update},
            )
            summary["applied"] += 1
        elif apply and result.status == "ok":
            # still mark validated even when no coordinate change
            update = {"caop_validated": True}
            if result.parish:
                update["freguesia_code"] = result.parish.parish_code
                update["concelho_code"] = result.parish.municipality_code
                update["nuts3_code"] = result.parish.nuts3_code
            await _db["heritage_items"].update_one(
                {"id": poi.get("id")}, {"$set": update},
            )
    return summary


__all__ = ["router", "set_geo_validator_db"]
