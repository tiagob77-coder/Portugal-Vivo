"""
localization_api.py — Editorial bilingual content endpoints for Portugal Vivo.

Produces structured PT-PT / EN fields (title, subtitle, short_description,
full_description, cultural_fact, practical_info) via LLM with category-aware
tone and Portuguese cultural term preservation.

Endpoints
---------
GET  /localization/{poi_id}                  — fetch stored localized content
POST /localization/generate/{poi_id}         — generate / regenerate (admin)
POST /localization/batch                     — batch generate (admin)
GET  /localization/stats                     — coverage stats
PATCH /localization/{poi_id}/{lang}          — manual content override (admin)
"""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from models.api_models import User
from services.localization import SUPPORTED_LANGS, LocalizationService
from shared_utils import DatabaseHolder

localization_router = APIRouter(prefix="/localization", tags=["Localization"])

_db_holder = DatabaseHolder("localization")
set_localization_db = _db_holder.set

_require_admin = None


def set_localization_admin(admin_fn) -> None:
    global _require_admin
    _require_admin = admin_fn


async def _admin_dep(request: Request) -> User:
    return await _require_admin(request)


def _svc() -> LocalizationService:
    return LocalizationService(_db_holder.db)


# ── Request / Response models ──────────────────────────────────────────────

class GenerateRequest(BaseModel):
    lang: str = Field("en", description="Target language: pt | en")
    poi_collection: str = Field("heritage_items", description="MongoDB collection name")
    force: bool = Field(False, description="Re-generate even if cached content exists")


class BatchGenerateRequest(BaseModel):
    poi_ids: List[str] = Field(..., min_length=1, max_length=200)
    lang: str = Field("en", description="Target language: pt | en")
    poi_collection: str = Field("heritage_items")
    force: bool = Field(False)


class ManualUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=60)
    subtitle: Optional[str] = Field(None, max_length=100)
    short_description: Optional[str] = Field(None, max_length=200)
    full_description: Optional[str] = None
    cultural_fact: Optional[str] = None
    practical_info: Optional[str] = None
    quality_score: Optional[float] = Field(None, ge=0.0, le=1.0)


# ── Endpoints ─────────────────────────────────────────────────────────────

@localization_router.get("/{poi_id}")
async def get_localized_content(
    poi_id: str,
    lang: str = Query("en", description="Language code: pt | en"),
):
    """
    Return stored localized content for a POI.
    Falls back to a 404 when no content has been generated yet.
    """
    if lang not in SUPPORTED_LANGS:
        raise HTTPException(400, f"Unsupported language '{lang}'. Supported: {', '.join(sorted(SUPPORTED_LANGS))}")

    doc = await _svc().get(poi_id, lang)
    if not doc:
        raise HTTPException(
            404,
            f"No localized content for poi_id='{poi_id}' lang='{lang}'. "
            "Use POST /localization/generate/{poi_id} to generate it.",
        )
    return doc


@localization_router.post("/generate/{poi_id}")
async def generate_localized_content(
    poi_id: str,
    body: GenerateRequest,
    _admin: User = Depends(_admin_dep),
):
    """
    Generate (or re-generate) editorial bilingual content for a single POI.
    Admin only. Uses LLM with fallback to structured static content.
    """
    if body.lang not in SUPPORTED_LANGS:
        raise HTTPException(400, f"Unsupported language '{body.lang}'. Supported: {', '.join(sorted(SUPPORTED_LANGS))}")

    result = await _svc().generate(
        poi_id=poi_id,
        lang=body.lang,
        poi_collection=body.poi_collection,
        force=body.force,
    )
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@localization_router.post("/batch")
async def batch_generate(
    body: BatchGenerateRequest,
    _admin: User = Depends(_admin_dep),
):
    """
    Batch-generate editorial content for multiple POIs.
    Admin only. Returns generation stats.
    """
    if body.lang not in SUPPORTED_LANGS:
        raise HTTPException(400, f"Unsupported language '{body.lang}'. Supported: {', '.join(sorted(SUPPORTED_LANGS))}")

    stats = await _svc().batch_generate(
        poi_ids=body.poi_ids,
        lang=body.lang,
        poi_collection=body.poi_collection,
        force=body.force,
    )
    return stats


@localization_router.get("/stats")
async def localization_stats():
    """Return coverage statistics grouped by language and generation source."""
    return await _svc().coverage_stats()


@localization_router.patch("/{poi_id}/{lang}")
async def manual_update(
    poi_id: str,
    lang: str,
    body: ManualUpdateRequest,
    _admin: User = Depends(_admin_dep),
):
    """
    Manually override one or more content fields for a POI.
    Sets source='manual' on the stored document.
    Admin only.
    """
    if lang not in SUPPORTED_LANGS:
        raise HTTPException(400, f"Unsupported language '{lang}'. Supported: {', '.join(sorted(SUPPORTED_LANGS))}")

    fields: Dict = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(400, "No fields provided to update.")

    updated = await _svc().manual_update(poi_id, lang, fields)
    if not updated:
        raise HTTPException(
            404,
            f"No localized content found for poi_id='{poi_id}' lang='{lang}'. "
            "Generate it first via POST /localization/generate/{poi_id}.",
        )
    return {"status": "updated", "poi_id": poi_id, "lang": lang}
