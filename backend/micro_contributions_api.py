"""
Micro Contributions API — Portugal Vivo
==========================================
Contribuições estruturadas da comunidade para enriquecer POIs.
Não é UGC livre — cada tipo tem payload fixo e fluxo de moderação.

Tipos de contribuição:
  hours_update    — horários actuais do local (revisão humana/admin)
  status_report   — POI fechado / mudou / mudou de morada (revisão human)
  photo_add       — foto nova (entra na fila de moderação de imagens)
  curiosity       — facto/história local (40–60 palavras) → micro_story draft

Fluxo:
  1. Utilizador submete via POST /contributions
  2. hours_update / status_report → micro_contributions (pending, admin revê)
  3. photo_add → micro_contributions + sinaliza na fila de imagens
  4. curiosity → cria content_draft no pipeline toolkit (status: 'draft')
              → admin pode enriquecer com IA e publicar
  5. Admin aprova / rejeita via PATCH /contributions/{id}/approve

Collections:
  micro_contributions  — todas as contribuições
  content_drafts       — drafts gerados a partir de curiosity
  heritage_items       — actualizado após aprovação (hours_update)

Rotas:
  POST   /contributions                     — submeter (auth)
  GET    /contributions/poi/{poi_id}         — listar por POI (público)
  GET    /contributions/pending              — fila admin (admin)
  PATCH  /contributions/{contrib_id}/approve — aprovar/rejeitar (admin)
"""

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ─── Router ──────────────────────────────────────────────────────────────────

contributions_router = APIRouter(prefix="/contributions", tags=["Micro Contributions"])

# ─── DB / Auth injection ─────────────────────────────────────────────────────

_db = None
_require_auth = None
_require_admin = None


def set_contributions_db(database) -> None:
    global _db
    _db = database


def set_contributions_auth(require_auth, require_admin) -> None:
    global _require_auth, _require_admin
    _require_auth = require_auth
    _require_admin = require_admin


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _count_words(text: str) -> int:
    return len(re.findall(r"\S+", text))


# ─── Modelos de payload por tipo ─────────────────────────────────────────────

class HoursPayload(BaseModel):
    weekday_hours: Dict[str, str] = Field(
        ...,
        description="Ex: {\"seg\": \"10:00-18:00\", \"dom\": \"fechado\"}"
    )
    notes: Optional[str] = Field(None, max_length=200)
    valid_from: Optional[str] = Field(None, description="Data de início YYYY-MM-DD")


class StatusPayload(BaseModel):
    status: str = Field(..., description="closed | moved | changed | reopened")
    notes: str = Field(..., min_length=10, max_length=500)
    new_address: Optional[str] = None


class PhotoPayload(BaseModel):
    image_url: str = Field(..., min_length=10, description="URL da imagem (já carregada)")
    caption: Optional[str] = Field(None, max_length=200)
    taken_at: Optional[str] = Field(None, description="Data aproximada YYYY-MM")


class CuriosityPayload(BaseModel):
    text: str = Field(..., min_length=40, max_length=500, description="40–250 palavras sobre este local")
    source: Optional[str] = Field(None, max_length=200, description="Ex: 'Avó materna', 'livro ISBN...'")


# ─── Pedido de contribuição ───────────────────────────────────────────────────

class ContributionRequest(BaseModel):
    poi_id: str
    type: str = Field(..., description="hours_update | status_report | photo_add | curiosity")
    payload: Dict[str, Any]


class ApproveRequest(BaseModel):
    approved: bool
    reviewer_notes: Optional[str] = None


# ─── Lógica de criação por tipo ──────────────────────────────────────────────

async def _handle_hours_update(
    contrib_id: str,
    poi_id: str,
    user_id: str,
    payload_raw: Dict[str, Any],
) -> Dict[str, Any]:
    payload = HoursPayload(**payload_raw)
    doc = {
        "contrib_id": contrib_id,
        "poi_id": poi_id,
        "user_id": user_id,
        "type": "hours_update",
        "payload": payload.model_dump(),
        "status": "pending",
        "reviewer_id": None,
        "reviewer_notes": None,
        "reviewed_at": None,
        "created_at": _now(),
    }
    await _db["micro_contributions"].insert_one(doc)
    return {"contrib_id": contrib_id, "type": "hours_update", "status": "pending",
            "message": "Horário submetido. Ficará visível após revisão."}


async def _handle_status_report(
    contrib_id: str,
    poi_id: str,
    user_id: str,
    payload_raw: Dict[str, Any],
) -> Dict[str, Any]:
    payload = StatusPayload(**payload_raw)
    doc = {
        "contrib_id": contrib_id,
        "poi_id": poi_id,
        "user_id": user_id,
        "type": "status_report",
        "payload": payload.model_dump(),
        "status": "pending",
        "reviewer_id": None,
        "reviewer_notes": None,
        "reviewed_at": None,
        "created_at": _now(),
    }
    await _db["micro_contributions"].insert_one(doc)
    return {"contrib_id": contrib_id, "type": "status_report", "status": "pending",
            "message": "Reporte recebido. Obrigado — será verificado em breve."}


async def _handle_photo_add(
    contrib_id: str,
    poi_id: str,
    user_id: str,
    payload_raw: Dict[str, Any],
) -> Dict[str, Any]:
    payload = PhotoPayload(**payload_raw)
    if not payload.image_url.startswith("http"):
        raise HTTPException(400, "image_url deve ser uma URL válida")

    doc = {
        "contrib_id": contrib_id,
        "poi_id": poi_id,
        "user_id": user_id,
        "type": "photo_add",
        "payload": payload.model_dump(),
        "status": "pending",
        "reviewer_id": None,
        "reviewer_notes": None,
        "reviewed_at": None,
        "created_at": _now(),
    }
    await _db["micro_contributions"].insert_one(doc)
    return {"contrib_id": contrib_id, "type": "photo_add", "status": "pending",
            "message": "Foto recebida. Ficará disponível após moderação."}


async def _handle_curiosity(
    contrib_id: str,
    poi_id: str,
    poi_name: str,
    poi_category: str,
    poi_region: str,
    user_id: str,
    payload_raw: Dict[str, Any],
) -> Dict[str, Any]:
    payload = CuriosityPayload(**payload_raw)
    word_count = _count_words(payload.text)

    # Guardar a contribuição
    doc = {
        "contrib_id": contrib_id,
        "poi_id": poi_id,
        "user_id": user_id,
        "type": "curiosity",
        "payload": payload.model_dump(),
        "word_count": word_count,
        "status": "pending",
        "reviewer_id": None,
        "reviewer_notes": None,
        "reviewed_at": None,
        "created_at": _now(),
        "draft_id": None,
    }

    # Criar automaticamente um content_draft micro_story no pipeline toolkit
    draft_id = uuid.uuid4().hex
    draft = {
        "draft_id": draft_id,
        "author_id": user_id,
        "author_name": "Contribuição da Comunidade",
        "source": "community_curiosity",
        "target_type": "poi",
        "target_id": poi_id,
        "target_depth": "micro_story",
        "field_to_update": "local_story",
        "title": f"Curiosidade: {poi_name}",
        "body_original": payload.text,
        "body_current": payload.text,
        "body_enriched": None,
        "category": poi_category,
        "region": poi_region,
        "tags": ["comunidade", "curiosidade"],
        "notes_for_editor": (
            f"Submetido pela comunidade. Fonte: {payload.source or 'não indicada'}. "
            f"{word_count} palavras."
        ),
        "status": "draft",
        "review_result": None,
        "enrichment_meta": {"contrib_id": contrib_id},
        "created_at": _now(),
        "updated_at": _now(),
        "published_at": None,
    }
    await _db["content_drafts"].insert_one(draft)
    doc["draft_id"] = draft_id
    await _db["micro_contributions"].insert_one(doc)

    return {
        "contrib_id": contrib_id,
        "draft_id": draft_id,
        "type": "curiosity",
        "status": "pending",
        "word_count": word_count,
        "message": "Obrigado! A tua história foi submetida e será revista pela equipa editorial.",
    }


# ─── Endpoints ───────────────────────────────────────────────────────────────

VALID_TYPES = {"hours_update", "status_report", "photo_add", "curiosity"}


@contributions_router.post("", status_code=201)
async def submit_contribution(
    req: ContributionRequest,
    current_user: dict = Depends(lambda: {"user_id": "anon"}),
):
    """
    Submeter uma micro-contribuição para um POI.
    Requer autenticação (injectada via server.py).
    """
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    if req.type not in VALID_TYPES:
        raise HTTPException(400, f"Tipo inválido. Permitidos: {', '.join(sorted(VALID_TYPES))}")

    # Verificar que o POI existe
    poi = await _db["heritage_items"].find_one(
        {"id": req.poi_id},
        {"id": 1, "name": 1, "category": 1, "region": 1, "_id": 0},
    )
    if not poi:
        raise HTTPException(404, f"POI {req.poi_id} não encontrado")

    user_id = current_user.get("user_id", "anon")
    contrib_id = uuid.uuid4().hex

    if req.type == "hours_update":
        return await _handle_hours_update(contrib_id, req.poi_id, user_id, req.payload)
    elif req.type == "status_report":
        return await _handle_status_report(contrib_id, req.poi_id, user_id, req.payload)
    elif req.type == "photo_add":
        return await _handle_photo_add(contrib_id, req.poi_id, user_id, req.payload)
    elif req.type == "curiosity":
        return await _handle_curiosity(
            contrib_id, req.poi_id,
            poi.get("name", req.poi_id),
            poi.get("category", ""),
            poi.get("region", ""),
            user_id, req.payload,
        )


@contributions_router.get("/poi/{poi_id}")
async def get_poi_contributions(
    poi_id: str,
    type: Optional[str] = Query(None),
):
    """
    Contribuições aprovadas para um POI (vista pública).
    Útil para mostrar horários actualizados ou alertas de estado.
    """
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    query: Dict[str, Any] = {"poi_id": poi_id, "status": "approved"}
    if type:
        query["type"] = type

    cursor = _db["micro_contributions"].find(query, {"_id": 0}).sort("reviewed_at", -1).limit(50)
    items = await cursor.to_list(length=50)
    return {"poi_id": poi_id, "contributions": items, "total": len(items)}


@contributions_router.get("/pending")
async def list_pending(
    type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    current_user: dict = Depends(lambda: {"user_id": "anon"}),
):
    """Fila de contribuições pendentes de revisão (admin)."""
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    query: Dict[str, Any] = {"status": "pending"}
    if type:
        query["type"] = type

    total = await _db["micro_contributions"].count_documents(query)
    skip = (page - 1) * page_size

    cursor = (
        _db["micro_contributions"]
        .find(query, {"_id": 0})
        .sort("created_at", 1)   # mais antigas primeiro
        .skip(skip)
        .limit(page_size)
    )
    items = await cursor.to_list(length=page_size)

    # Contar por tipo para overview
    type_counts: Dict[str, int] = {}
    for t in VALID_TYPES:
        type_counts[t] = await _db["micro_contributions"].count_documents({"status": "pending", "type": t})

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "by_type": type_counts,
    }


@contributions_router.patch("/{contrib_id}/approve")
async def approve_contribution(
    contrib_id: str,
    payload: ApproveRequest,
    current_user: dict = Depends(lambda: {"user_id": "anon"}),
):
    """
    Aprovar ou rejeitar uma contribuição.
    Se aprovada e do tipo hours_update: actualiza o campo opening_hours no POI.
    """
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    contrib = await _db["micro_contributions"].find_one({"contrib_id": contrib_id})
    if not contrib:
        raise HTTPException(404, f"Contribuição {contrib_id} não encontrada")

    new_status = "approved" if payload.approved else "rejected"
    reviewer_id = current_user.get("user_id", "admin")

    await _db["micro_contributions"].update_one(
        {"contrib_id": contrib_id},
        {"$set": {
            "status": new_status,
            "reviewer_id": reviewer_id,
            "reviewer_notes": payload.reviewer_notes,
            "reviewed_at": _now(),
        }},
    )

    # Efeitos laterais ao aprovar
    if payload.approved:
        await _apply_approved_contribution(contrib, reviewer_id)

    action = "aprovada" if payload.approved else "rejeitada"
    logger.info("[contributions] %s %s por %s", contrib_id, action, reviewer_id)
    return {"contrib_id": contrib_id, "status": new_status, "message": f"Contribuição {action}"}


async def _apply_approved_contribution(contrib: Dict[str, Any], reviewer_id: str) -> None:
    """Aplica efeitos da aprovação ao POI correspondente."""
    poi_id = contrib.get("poi_id")
    ctype = contrib.get("type")
    cp = contrib.get("payload", {})

    if ctype == "hours_update":
        # Persistir horários no POI
        await _db["heritage_items"].update_one(
            {"id": poi_id},
            {"$set": {
                "opening_hours": cp.get("weekday_hours", {}),
                "opening_hours_notes": cp.get("notes"),
                "opening_hours_updated_at": _now(),
                "opening_hours_updated_by": "community",
            }},
        )
        logger.info("[contributions] Horários actualizados para POI %s", poi_id)

    elif ctype == "status_report":
        status_val = cp.get("status", "")
        update: Dict[str, Any] = {
            "community_status": status_val,
            "community_status_notes": cp.get("notes"),
            "community_status_updated_at": _now(),
        }
        if cp.get("new_address"):
            update["address"] = cp["new_address"]
        await _db["heritage_items"].update_one({"id": poi_id}, {"$set": update})
        logger.info("[contributions] Status '%s' aplicado a POI %s", status_val, poi_id)

    elif ctype == "photo_add":
        # Adicionar à galeria de imagens candidatas (array no documento do POI)
        await _db["heritage_items"].update_one(
            {"id": poi_id},
            {"$push": {"community_photos": {
                "url": cp.get("image_url"),
                "caption": cp.get("caption"),
                "approved_at": _now(),
            }}},
        )
        logger.info("[contributions] Foto adicionada a POI %s", poi_id)

    # curiosity já foi tratada na submissão (cria draft automaticamente)
