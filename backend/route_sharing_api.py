"""
Route Sharing API - Generate shareable links for smart routes.
Allows users to save, share, clone, and discover popular routes.
"""
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import secrets
import uuid
import logging

from shared_utils import DatabaseHolder
from models.api_models import User

logger = logging.getLogger(__name__)

route_sharing_router = APIRouter(prefix="/routes-shared", tags=["Route Sharing"])

_db_holder = DatabaseHolder("route_sharing")
set_route_sharing_db = _db_holder.set
_get_db = _db_holder.get

_require_auth = None


def set_route_sharing_auth(auth_fn):
    global _require_auth
    _require_auth = auth_fn


async def _auth_dep(request: Request) -> User:
    return await _require_auth(request)


# Models

class POIItem(BaseModel):
    id: str
    name: str
    location: Dict[str, Any]
    category: str
    order: int


class RouteMetrics(BaseModel):
    distance: Optional[float] = None
    duration: Optional[float] = None


class RouteSaveRequest(BaseModel):
    route_name: str = Field(..., max_length=200)
    pois: List[POIItem]
    filters: Optional[Dict[str, Any]] = None
    metrics: Optional[RouteMetrics] = None


def _generate_share_code() -> str:
    """Generate an 8-character URL-safe alphanumeric share code."""
    return secrets.token_urlsafe(6)[:8]


@route_sharing_router.post("/save")
async def save_shared_route(
    body: RouteSaveRequest,
    current_user: User = Depends(_auth_dep),
):
    """Save a generated route for sharing and return a unique share code."""
    share_code = _generate_share_code()

    # Ensure uniqueness
    existing = await _db_holder.db.shared_routes.find_one({"share_code": share_code})
    while existing:
        share_code = _generate_share_code()
        existing = await _db_holder.db.shared_routes.find_one({"share_code": share_code})

    now = datetime.now(timezone.utc)

    doc = {
        "share_code": share_code,
        "route_data": {
            "route_name": body.route_name,
            "pois": [poi.model_dump() for poi in body.pois],
            "filters": body.filters or {},
            "metrics": body.metrics.model_dump() if body.metrics else {},
        },
        "created_at": now,
        "views_count": 0,
        "creator_user_id": current_user.user_id,
    }

    try:
        await _db_holder.db.shared_routes.insert_one(doc)
    except Exception as e:
        logger.error("Route sharing DB error on save: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao guardar rota partilhada")

    return {
        "share_code": share_code,
        "share_url": f"/shared/{share_code}",
        "created_at": now.isoformat(),
    }


@route_sharing_router.get("/popular")
async def get_popular_routes(limit: int = Query(10, ge=1, le=50)):
    """Get popular shared routes sorted by views count descending."""
    try:
        routes = await _db_holder.db.shared_routes.find(
            {}, {"_id": 0}
        ).sort("views_count", -1).limit(limit).to_list(limit)
    except Exception as e:
        logger.error("Route sharing DB error on popular: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao obter rotas populares")

    return {"routes": routes, "count": len(routes)}


@route_sharing_router.get("/{share_code}")
async def get_shared_route(share_code: str):
    """Retrieve a shared route by its share code and increment views."""
    route = await _db_holder.db.shared_routes.find_one(
        {"share_code": share_code}, {"_id": 0}
    )
    if not route:
        raise HTTPException(status_code=404, detail="Rota partilhada nao encontrada")

    # Increment views count
    try:
        await _db_holder.db.shared_routes.update_one(
            {"share_code": share_code},
            {"$inc": {"views_count": 1}},
        )
    except Exception as e:
        logger.error("Route sharing DB error on view increment: %s", e)

    route["views_count"] = route.get("views_count", 0) + 1

    return {
        "share_code": route["share_code"],
        "route_data": route["route_data"],
        "views_count": route["views_count"],
        "created_at": route.get("created_at"),
        "creator_user_id": route.get("creator_user_id"),
    }


@route_sharing_router.get("/{share_code}/preview")
async def get_shared_route_preview(share_code: str):
    """Lightweight preview for social sharing / link unfurling."""
    route = await _db_holder.db.shared_routes.find_one(
        {"share_code": share_code}, {"_id": 0}
    )
    if not route:
        raise HTTPException(status_code=404, detail="Rota partilhada nao encontrada")

    rd = route.get("route_data", {})
    pois = rd.get("pois", [])
    metrics = rd.get("metrics", {})
    filters = rd.get("filters", {})

    first_poi_image = None
    if pois:
        first_poi = pois[0]
        first_poi_image = first_poi.get("image") or first_poi.get("imageUrl")

    return {
        "route_name": rd.get("route_name", ""),
        "poi_count": len(pois),
        "total_distance_km": metrics.get("distance"),
        "total_duration": metrics.get("duration"),
        "first_poi_image": first_poi_image,
        "region": filters.get("region"),
    }


@route_sharing_router.post("/{share_code}/clone")
async def clone_shared_route(
    share_code: str,
    current_user: User = Depends(_auth_dep),
):
    """Clone a shared route into the authenticated user's saved routes."""
    route = await _db_holder.db.shared_routes.find_one(
        {"share_code": share_code}, {"_id": 0}
    )
    if not route:
        raise HTTPException(status_code=404, detail="Rota partilhada nao encontrada")

    saved_route_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    saved_doc = {
        "id": saved_route_id,
        "user_id": current_user.user_id,
        "route_data": route["route_data"],
        "cloned_from": share_code,
        "created_at": now,
    }

    try:
        await _db_holder.db.saved_routes.insert_one(saved_doc)
    except Exception as e:
        logger.error("Route sharing DB error on clone: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao clonar rota")

    return {
        "message": "Rota clonada com sucesso",
        "saved_route_id": saved_route_id,
    }
