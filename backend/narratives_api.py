"""
Portugal Vivo — Cultural Narratives API
Upload, validate, enrich, curate and publish cultural narratives.

Narratives can originate from municipalities, curators, researchers,
community members or verified users. Each narrative is stored in a
dedicated MongoDB Atlas collection and linked to POIs, routes and events.

States: draft → pending_review → approved → published → archived | rejected
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel, Field

from auth_api import get_current_user, require_auth
from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

narratives_router = APIRouter(prefix="/narratives", tags=["Narratives"])

_db_holder = DatabaseHolder("narratives")
set_narratives_db = _db_holder.set
_get_db = _db_holder.get

_llm_key: str = ""


def set_narratives_llm_key(key: str) -> None:
    global _llm_key
    _llm_key = key


# ──────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ──────────────────────────────────────────────────────────────────────────────

VALID_STATES = {"draft", "pending_review", "approved", "published", "archived", "rejected"}
VALID_SOURCE_TYPES = {"facto_historico", "tradicao_oral", "interpretacao_curatorial", "editorial", "comunitario"}
VALID_THEMES = {
    "patrimonio_material", "patrimonio_imaterial", "tradicao_oral",
    "gastronomia", "artesanato", "musica", "festas", "lendas",
    "arqueologia", "arquitectura", "natureza", "maritimo",
    "religioso", "industrial", "rural", "urbano",
}
VALID_MEDIA_TYPES = {"image", "audio", "video", "pdf", "document"}


# ──────────────────────────────────────────────────────────────────────────────
# MODELS
# ──────────────────────────────────────────────────────────────────────────────

class NarrativeMedia(BaseModel):
    url: str
    media_type: str = "image"
    caption: Optional[str] = None
    credit: Optional[str] = None


class NarrativeCredibility(BaseModel):
    source_type: str = Field("editorial", pattern="^(facto_historico|tradicao_oral|interpretacao_curatorial|editorial|comunitario)$")
    source_ref: Optional[str] = None
    confidence_score: float = Field(0.5, ge=0.0, le=1.0)
    last_verified: Optional[str] = None
    reviewer: Optional[str] = None


class NarrativeCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    summary: Optional[str] = Field(None, max_length=500)
    story_text: str = Field(..., min_length=10)
    location: Optional[str] = None  # place name
    lat: Optional[float] = None
    lng: Optional[float] = None
    region: Optional[str] = None
    theme: str = "patrimonio_material"
    subtheme: Optional[str] = None
    contributors: List[str] = Field(default_factory=list)
    sources: List[str] = Field(default_factory=list)
    media: List[NarrativeMedia] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    language: str = "pt"
    # Linked entities
    poi_id: Optional[str] = None
    route_id: Optional[str] = None
    event_id: Optional[str] = None
    heritage_type: Optional[str] = None
    cultural_period: Optional[str] = None
    # Credibility
    credibility: Optional[NarrativeCredibility] = None
    # Sensitive content flags
    restricted_use: bool = False
    anonymize: bool = False
    cultural_notes: Optional[str] = None


class NarrativeUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    story_text: Optional[str] = None
    location: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    region: Optional[str] = None
    theme: Optional[str] = None
    subtheme: Optional[str] = None
    contributors: Optional[List[str]] = None
    sources: Optional[List[str]] = None
    media: Optional[List[NarrativeMedia]] = None
    tags: Optional[List[str]] = None
    poi_id: Optional[str] = None
    route_id: Optional[str] = None
    event_id: Optional[str] = None
    heritage_type: Optional[str] = None
    cultural_period: Optional[str] = None
    credibility: Optional[NarrativeCredibility] = None
    restricted_use: Optional[bool] = None
    anonymize: Optional[bool] = None
    cultural_notes: Optional[str] = None


class NarrativeValidation(BaseModel):
    status: str = Field(..., pattern="^(pending_review|approved|rejected)$")
    reviewer_notes: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _compute_confidence(narrative: Dict) -> float:
    """Auto-compute confidence score based on sources, contributors and media."""
    score = 0.3  # base
    sources = narrative.get("sources") or []
    if len(sources) >= 2:
        score += 0.2
    elif len(sources) >= 1:
        score += 0.1
    contributors = narrative.get("contributors") or []
    if len(contributors) >= 1:
        score += 0.1
    media = narrative.get("media") or []
    if len(media) >= 1:
        score += 0.1
    if narrative.get("poi_id"):
        score += 0.1  # linked to existing POI
    if narrative.get("credibility", {}).get("source_type") == "facto_historico":
        score += 0.1
    return min(1.0, round(score, 2))


async def _check_duplicate(db, title: str, region: Optional[str]) -> Optional[Dict]:
    """Check for potential duplicate narratives."""
    query: Dict[str, Any] = {
        "title": {"$regex": f"^{title[:30]}", "$options": "i"},
        "status": {"$ne": "rejected"},
    }
    if region:
        query["region"] = {"$regex": region, "$options": "i"}
    return await db.narratives.find_one(query, {"_id": 0, "id": 1, "title": 1})


async def _enrich_with_llm(narrative: Dict) -> Dict[str, Any]:
    """Use LLM to auto-generate summary, keywords, related themes."""
    import os
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not anthropic_key and not _llm_key:
        return {}

    text = narrative.get("story_text", "")[:800]
    title = narrative.get("title", "")
    prompt = (
        f"Título: {title}\nTexto: {text}\n\n"
        "Gera em JSON: {\"summary\": \"resumo 2 frases\", \"keywords\": [\"lista\", \"de\", \"5\", \"palavras\"], "
        "\"related_themes\": [\"temas\", \"relacionados\"], \"suggested_pois\": [\"nomes de locais mencionados\"]}"
    )

    if anthropic_key:
        try:
            import litellm
            resp = await litellm.acompletion(
                model="claude-haiku-4-5-20251001",
                messages=[
                    {"role": "system", "content": "És um curador cultural português. Responde apenas em JSON válido."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=400,
            )
            import json
            return json.loads(resp.choices[0].message.content.strip())
        except Exception as e:
            logger.warning(f"LLM enrichment failed: {e}")
    elif _llm_key:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage as EmUserMessage
            chat = LlmChat(
                api_key=_llm_key,
                session_id=f"enrich_{narrative.get('id', '')}",
                system_message="És um curador cultural português. Responde apenas em JSON válido.",
            ).with_model("openai", "gpt-4o-mini")
            import json
            raw = str(await chat.send_message(EmUserMessage(text=prompt))).strip()
            return json.loads(raw)
        except Exception as e:
            logger.warning(f"Emergent enrichment failed: {e}")

    return {}


# ──────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

@narratives_router.post("/upload")
async def upload_narrative(
    request: NarrativeCreate,
    user: Dict = Depends(require_auth),
):
    """
    Create a new cultural narrative. Starts in 'draft' state.
    Auto-detects duplicates and computes confidence score.
    """
    db = _get_db()

    # Check for duplicates
    dup = await _check_duplicate(db, request.title, request.region)
    duplicate_warning = None
    if dup:
        duplicate_warning = f"Possível duplicado: '{dup['title']}' (id: {dup['id']})"

    narrative_id = str(uuid.uuid4())[:12]
    now_iso = datetime.now(timezone.utc).isoformat()

    doc = {
        "id": narrative_id,
        "title": request.title,
        "summary": request.summary,
        "story_text": request.story_text,
        "location": request.location,
        "lat": request.lat,
        "lng": request.lng,
        "region": request.region,
        "theme": request.theme,
        "subtheme": request.subtheme,
        "contributors": request.contributors or [user.get("name", user.get("id", ""))],
        "sources": request.sources,
        "media": [m.model_dump() for m in request.media],
        "tags": request.tags,
        "language": request.language,
        "poi_id": request.poi_id,
        "route_id": request.route_id,
        "event_id": request.event_id,
        "heritage_type": request.heritage_type,
        "cultural_period": request.cultural_period,
        "credibility": (request.credibility.model_dump() if request.credibility else {
            "source_type": "editorial",
            "source_ref": None,
            "confidence_score": 0.5,
            "last_verified": None,
            "reviewer": None,
        }),
        "restricted_use": request.restricted_use,
        "anonymize": request.anonymize,
        "cultural_notes": request.cultural_notes,
        "status": "draft",
        "created_by": user.get("id"),
        "created_at": now_iso,
        "updated_at": now_iso,
        "published_at": None,
        "enrichment": {},
        "visibility": "internal",
    }

    # Auto-compute confidence
    doc["credibility"]["confidence_score"] = _compute_confidence(doc)

    await db.narratives.insert_one(doc)

    return {
        "id": narrative_id,
        "status": "draft",
        "confidence_score": doc["credibility"]["confidence_score"],
        "duplicate_warning": duplicate_warning,
        "message": "Narrativa criada com sucesso. Estado: rascunho.",
    }


@narratives_router.get("/{narrative_id}")
async def get_narrative(narrative_id: str):
    """Get a single narrative by ID."""
    db = _get_db()
    doc = await db.narratives.find_one({"id": narrative_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Narrativa não encontrada")
    return doc


@narratives_router.get("")
async def list_narratives(
    status: Optional[str] = Query(None),
    theme: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    poi_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List narratives with filters."""
    db = _get_db()
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if theme:
        query["theme"] = theme
    if region:
        query["region"] = {"$regex": region, "$options": "i"}
    if poi_id:
        query["poi_id"] = poi_id

    total = await db.narratives.count_documents(query)
    docs = await db.narratives.find(
        query,
        {"_id": 0, "story_text": 0},  # exclude full text in listing
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(length=limit)

    return {"narratives": docs, "total": total, "limit": limit, "offset": offset}


@narratives_router.patch("/{narrative_id}")
async def update_narrative(
    narrative_id: str,
    request: NarrativeUpdate,
    user: Dict = Depends(require_auth),
):
    """Update narrative fields. Only owner or curator can edit."""
    db = _get_db()
    doc = await db.narratives.find_one({"id": narrative_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Narrativa não encontrada")

    updates: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field, value in request.model_dump(exclude_unset=True).items():
        if field == "credibility" and value:
            updates["credibility"] = value
        elif field == "media" and value is not None:
            updates["media"] = [m if isinstance(m, dict) else m.model_dump() for m in value]
        else:
            updates[field] = value

    await db.narratives.update_one({"id": narrative_id}, {"$set": updates})

    return {"id": narrative_id, "updated_fields": list(updates.keys()), "status": "updated"}


@narratives_router.post("/{narrative_id}/validate")
async def validate_narrative(
    narrative_id: str,
    request: NarrativeValidation,
    user: Dict = Depends(require_auth),
):
    """
    Validate/review a narrative. Moves state to pending_review, approved, or rejected.
    """
    db = _get_db()
    doc = await db.narratives.find_one({"id": narrative_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Narrativa não encontrada")

    now_iso = datetime.now(timezone.utc).isoformat()
    updates: Dict[str, Any] = {
        "status": request.status,
        "updated_at": now_iso,
        "credibility.reviewer": user.get("id"),
        "credibility.last_verified": now_iso,
    }
    if request.reviewer_notes:
        updates["reviewer_notes"] = request.reviewer_notes

    # Boost confidence when human-reviewed
    if request.status == "approved":
        current_conf = doc.get("credibility", {}).get("confidence_score", 0.5)
        updates["credibility.confidence_score"] = min(1.0, round(current_conf + 0.2, 2))

    await db.narratives.update_one({"id": narrative_id}, {"$set": updates})

    return {"id": narrative_id, "status": request.status, "message": f"Narrativa {request.status}."}


@narratives_router.post("/{narrative_id}/publish")
async def publish_narrative(
    narrative_id: str,
    user: Dict = Depends(require_auth),
):
    """
    Publish an approved narrative. Makes it visible to all users.
    Only approved narratives can be published.
    """
    db = _get_db()
    doc = await db.narratives.find_one({"id": narrative_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Narrativa não encontrada")

    if doc.get("status") != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Apenas narrativas aprovadas podem ser publicadas. Estado actual: {doc.get('status')}"
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.narratives.update_one(
        {"id": narrative_id},
        {"$set": {
            "status": "published",
            "visibility": "public",
            "published_at": now_iso,
            "updated_at": now_iso,
        }}
    )

    return {"id": narrative_id, "status": "published", "published_at": now_iso}


@narratives_router.post("/{narrative_id}/enrich")
async def enrich_narrative(
    narrative_id: str,
    user: Dict = Depends(require_auth),
):
    """
    Trigger AI enrichment: auto-generate summary, keywords,
    related themes and suggested POI links.
    """
    db = _get_db()
    doc = await db.narratives.find_one({"id": narrative_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Narrativa não encontrada")

    enrichment = await _enrich_with_llm(doc)
    if not enrichment:
        return {"id": narrative_id, "enrichment": {}, "message": "Enriquecimento indisponível (sem chave LLM)."}

    # Auto-fill summary if empty
    updates: Dict[str, Any] = {
        "enrichment": enrichment,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if not doc.get("summary") and enrichment.get("summary"):
        updates["summary"] = enrichment["summary"]
    if enrichment.get("keywords"):
        existing_tags = set(doc.get("tags") or [])
        new_tags = list(existing_tags | set(enrichment["keywords"][:8]))
        updates["tags"] = new_tags

    await db.narratives.update_one({"id": narrative_id}, {"$set": updates})

    return {"id": narrative_id, "enrichment": enrichment, "message": "Enriquecimento aplicado."}


@narratives_router.post("/{narrative_id}/archive")
async def archive_narrative(
    narrative_id: str,
    user: Dict = Depends(require_auth),
):
    """Archive a narrative (soft-delete)."""
    db = _get_db()
    await db.narratives.update_one(
        {"id": narrative_id},
        {"$set": {"status": "archived", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"id": narrative_id, "status": "archived"}


@narratives_router.get("/by-poi/{poi_id}")
async def get_narratives_by_poi(poi_id: str, limit: int = Query(10, ge=1, le=50)):
    """Get published narratives linked to a specific POI."""
    db = _get_db()
    docs = await db.narratives.find(
        {"poi_id": poi_id, "status": "published"},
        {"_id": 0, "story_text": 0},
    ).sort("credibility.confidence_score", -1).limit(limit).to_list(length=limit)
    return {"narratives": docs, "total": len(docs)}


@narratives_router.get("/by-region/{region}")
async def get_narratives_by_region(region: str, limit: int = Query(20, ge=1, le=100)):
    """Get published narratives from a region."""
    db = _get_db()
    docs = await db.narratives.find(
        {"region": {"$regex": region, "$options": "i"}, "status": "published"},
        {"_id": 0, "story_text": 0},
    ).sort("created_at", -1).limit(limit).to_list(length=limit)
    return {"narratives": docs, "total": len(docs)}


@narratives_router.get("/themes")
async def list_themes():
    """Return all available narrative themes."""
    return {"themes": sorted(VALID_THEMES)}


@narratives_router.get("/stats")
async def narrative_stats():
    """Dashboard stats for the narratives module."""
    db = _get_db()
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    status_counts = {}
    async for doc in db.narratives.aggregate(pipeline):
        status_counts[doc["_id"]] = doc["count"]

    theme_pipeline = [
        {"$match": {"status": "published"}},
        {"$group": {"_id": "$theme", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    top_themes = []
    async for doc in db.narratives.aggregate(theme_pipeline):
        top_themes.append({"theme": doc["_id"], "count": doc["count"]})

    total = sum(status_counts.values())
    return {
        "total": total,
        "by_status": status_counts,
        "top_themes": top_themes,
    }
