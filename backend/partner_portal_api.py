"""
Partner Portal API — Portugal Vivo
=====================================
Permite que parceiros externos (câmaras municipais, museus, associações culturais)
gerem o conteúdo do seu território de forma autónoma.

Modelo:
  - Parceiro regista a sua organização com concelhos sob gestão
  - Admin aprova a organização
  - Parceiro vê os seus POIs com health score
  - Parceiro submete actualizações como drafts → pipeline toolkit existente
  - Parceiro vê métricas básicas do seu território

Acesso: utilizadores com organização aprovada (partner_orgs) ou utilizadores
municipais do RBAC multi-tenant (tenant_role municipio/editor/viewer com
municipality_id) — estes últimos recebem uma organização implícita.

Collections:
  partner_orgs  — organizações parceiras
  content_drafts — drafts submetidos (reusa pipeline toolkit)
  heritage_items — POIs filtrados por concelho

Rotas:
  POST   /partner/register                — registar organização (auth)
  GET    /partner/profile                 — perfil da minha org (auth)
  GET    /partner/pois                    — POIs do meu território (auth)
  GET    /partner/pois/{poi_id}           — detalhe + health score (auth)
  POST   /partner/pois/{poi_id}/draft     — submeter actualização (auth)
  PATCH  /partner/pois/{poi_id}/draft     — publicar / despublicar POI (auth, escrita)
  DELETE /partner/pois/{poi_id}           — arquivar POI do território (auth, municipio)
  GET    /partner/drafts                  — meus drafts pendentes (auth)
  GET    /partner/metrics                 — métricas do território (auth)
  GET    /partner/health-summary          — distribuição de saúde (auth)
  GET    /partner/orgs                    — listar orgs (admin)
  PATCH  /partner/orgs/{org_id}/approve   — aprovar org (admin)
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from territory import municipality_slug, territory_filter

logger = logging.getLogger(__name__)

# ─── Router ──────────────────────────────────────────────────────────────────

partner_router = APIRouter(prefix="/partner", tags=["Partner Portal"])

# ─── DB / Auth injection ─────────────────────────────────────────────────────

_require_auth = None
_require_admin = None


def _db():
    """Lazy resolver — call sites use ``_db()["coll"]``."""
    from dependencies import get_db
    return get_db()


def set_partner_auth(require_auth, require_admin) -> None:
    global _require_auth, _require_admin
    _require_auth = require_auth
    _require_admin = require_admin


async def _current_user(request: Request) -> Dict[str, Any]:
    """Utilizador autenticado (auth injectada por server.py via set_partner_auth)."""
    if _require_auth is None:
        raise HTTPException(503, "Autenticação não configurada")
    user = await _require_auth(request)
    return {"user_id": user.user_id, "email": getattr(user, "email", ""), "name": getattr(user, "name", "")}


async def _current_admin(request: Request) -> Dict[str, Any]:
    """Administrador autenticado."""
    if _require_admin is None:
        raise HTTPException(503, "Autenticação não configurada")
    user = await _require_admin(request)
    return {"user_id": user.user_id, "email": getattr(user, "email", ""), "name": getattr(user, "name", "")}


# ─── Helpers ─────────────────────────────────────────────────────────────────

TENANT_ROLES = {"municipio", "editor", "viewer"}
WRITE_ACCESS = {"owner", "municipio", "editor"}
DELETE_ACCESS = {"owner", "municipio"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _municipal_org(user_id: str) -> Optional[Dict[str, Any]]:
    """Organização implícita para utilizadores municipais do RBAC multi-tenant."""
    user_doc = await _db()["users"].find_one(
        {"user_id": user_id}, {"_id": 0, "tenant_role": 1, "role": 1, "municipality_id": 1}
    )
    if not user_doc:
        return None
    role = user_doc.get("tenant_role") or user_doc.get("role")
    municipality_id = user_doc.get("municipality_id")
    if role not in TENANT_ROLES or not municipality_id:
        return None
    slug = municipality_slug(municipality_id)
    sub = await _db()["municipal_subscriptions"].find_one({"municipality_id": slug}, {"_id": 0}) or {}
    profile = await _db()["municipal_profiles"].find_one({"municipality_id": slug}, {"_id": 0, "display_name": 1}) or {}
    name = profile.get("display_name") or slug.replace("-", " ").title()
    return {
        "org_id": f"mun:{slug}",
        "name": name,
        "type": "municipio",
        "concelhos": list(sub.get("concelhos") or []) or [name],
        "municipality_ids": [municipality_id, slug, *(sub.get("municipality_aliases") or [])],
        "access": role,
        "approved": True,
    }


async def _get_org_for_user(user_id: str) -> Optional[Dict[str, Any]]:
    # _db() raises a 500 itself when init_database() never ran.
    org = await _db()["partner_orgs"].find_one({"user_id": user_id, "approved": True})
    if org:
        org["access"] = "owner"
        return org
    return await _municipal_org(user_id)


async def _require_partner(current_user: dict, access: Optional[set] = None) -> Dict[str, Any]:
    """Verifica que o user tem uma org aprovada (ou é municipal) e o nível de acesso pedido."""
    org = await _get_org_for_user(current_user.get("user_id", ""))
    if not org:
        raise HTTPException(403, "Sem organização parceira aprovada. Registe-se em POST /partner/register")
    if access is not None and org.get("access") not in access:
        raise HTTPException(403, "Sem permissão para esta operação")
    return org


def _territory(org: Dict[str, Any]) -> Dict[str, Any]:
    return territory_filter(org.get("municipality_ids") or [], org.get("concelhos") or [])


def _in_territory(org: Dict[str, Any], extra: Dict[str, Any]) -> Dict[str, Any]:
    return {"$and": [extra, _territory(org)]}


# ─── Health score inline (reutiliza lógica sem importar o módulo) ─────────────

def _quick_health(item: Dict[str, Any]) -> int:
    """Score simplificado (sem seasonal) para listar rapidamente."""
    image = 20 if (item.get("image_url") or "").startswith("http") else 0
    # freshness
    last_edited = item.get("last_edited_at")
    created_at = item.get("created_at")
    ref = last_edited or created_at
    if ref is None:
        freshness = 3
    else:
        if ref.tzinfo is None:
            ref = ref.replace(tzinfo=timezone.utc)
        days = (_now() - ref).days
        freshness = 25 if days < 30 else (18 if days < 90 else (12 if days < 180 else (8 if days < 365 else 5)))
        if last_edited is None:
            freshness = 5
    # narrative
    narrative = 0
    if (item.get("micro_pitch") or "").strip():
        narrative += 8
    if (item.get("descricao_curta") or "").strip():
        narrative += 7
    if len((item.get("description") or "")) > 300:
        narrative += 5
    if (item.get("local_story") or item.get("historia_local") or "").strip():
        narrative += 5
    narrative = min(narrative, 25)
    # IQ
    iq_results = item.get("iq_results")
    iq = 0
    if isinstance(iq_results, list):
        scores = [r.get("score", 0) for r in iq_results if isinstance(r, dict)]
        iq = sum(scores) / len(scores) if scores else 0
    elif isinstance(iq_results, dict):
        iq = iq_results.get("score", 0)
    iq_comp = 20 if iq >= 80 else (15 if iq >= 60 else (10 if iq >= 40 else (5 if iq >= 20 else 2)))
    return image + freshness + narrative + iq_comp


def _tier(score: int) -> str:
    if score >= 75: return "healthy"
    if score >= 50: return "attention"
    if score >= 25: return "stale"
    return "critical"


# ─── Modelos ─────────────────────────────────────────────────────────────────

class OrgRegisterRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=120)
    type: str = Field(..., description="municipio | museu | associacao | outro")
    concelhos: List[str] = Field(..., min_items=1, description="Lista de concelhos geridos")
    contact_email: str
    contact_name: str
    website: Optional[str] = None
    notes: Optional[str] = None


class PartnerDraftRequest(BaseModel):
    field: str = Field(..., description="description | micro_pitch | descricao_curta | local_story")
    body: str = Field(..., min_length=20, max_length=8000)
    notes_for_editor: Optional[str] = None


class OrgApproveRequest(BaseModel):
    approved: bool
    reviewer_notes: Optional[str] = None


# ─── Endpoints de registo / perfil ───────────────────────────────────────────

@partner_router.post("/register", status_code=201)
async def register_org(payload: OrgRegisterRequest, current_user: dict = Depends(_current_user)):
    """Registar uma nova organização parceira (fica pendente até aprovação de admin)."""
    # _db() raises a 500 itself when init_database() never ran.

    user_id = current_user.get("user_id", "")

    # Verificar se já existe
    existing = await _db()["partner_orgs"].find_one({"user_id": user_id})
    if existing:
        raise HTTPException(409, "Já existe uma organização registada para este utilizador")

    org_id = uuid.uuid4().hex
    doc = {
        "org_id": org_id,
        "user_id": user_id,
        "name": payload.name,
        "type": payload.type,
        "concelhos": payload.concelhos,
        "contact_email": payload.contact_email,
        "contact_name": payload.contact_name,
        "website": payload.website,
        "notes": payload.notes,
        "approved": False,
        "created_at": _now(),
        "approved_at": None,
        "approved_by": None,
    }
    await _db()["partner_orgs"].insert_one(doc)
    doc.pop("_id", None)

    logger.info("[partner] Nova org registada: %s (%s)", payload.name, org_id)
    return {"org_id": org_id, "status": "pending_approval", "message": "Organização registada. Aguarda aprovação."}


@partner_router.get("/profile")
async def get_partner_profile(current_user: dict = Depends(_current_user)):
    """Perfil da organização parceira do utilizador autenticado."""
    # _db() raises a 500 itself when init_database() never ran.
    user_id = current_user.get("user_id", "")
    org = await _db()["partner_orgs"].find_one({"user_id": user_id}, {"_id": 0})
    if not org:
        raise HTTPException(404, "Sem organização registada")
    return org


# ─── Endpoints de POIs do território ─────────────────────────────────────────

@partner_router.get("/pois")
async def list_partner_pois(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    tier: Optional[str] = Query(None),
    order: Literal["asc", "desc"] = Query("asc", description="asc = mais críticos primeiro; desc = melhores primeiro"),
    current_user: dict = Depends(_current_user),
):
    """Lista de POIs do território do parceiro com health score."""
    # _db() raises a 500 itself when init_database() never ran.

    org = await _require_partner(current_user)
    concelhos = org.get("concelhos", [])

    projection = {
        "id": 1, "name": 1, "category": 1, "region": 1, "concelho": 1, "location": 1,
        "image_url": 1, "description": 1, "micro_pitch": 1, "descricao_curta": 1,
        "local_story": 1, "historia_local": 1, "is_published": 1,
        "created_at": 1, "last_edited_at": 1, "iq_results": 1,
        "_id": 0,
    }

    cursor = _db()["heritage_items"].find({**_territory(org), "deleted_at": None}, projection)
    raw = await cursor.to_list(length=2000)

    scored = []
    for item in raw:
        score = _quick_health(item)
        t = _tier(score)
        poi_id = item.get("id", "")
        scored.append({
            "poi_id": poi_id,
            "id": poi_id,
            "name": item.get("name", ""),
            "category": item.get("category", ""),
            "region": item.get("region", ""),
            "concelho": item.get("concelho", ""),
            "location": item.get("location"),
            "score": score,
            "content_health_score": score,
            "tier": t,
            "status": "draft" if item.get("is_published") is False else "published",
            "has_image": bool((item.get("image_url") or "").startswith("http")),
            "has_narrative": bool((item.get("micro_pitch") or "").strip()),
            "last_edited_at": item.get("last_edited_at"),
        })

    if tier:
        scored = [s for s in scored if s["tier"] == tier]

    scored.sort(key=lambda x: x["score"], reverse=order == "desc")  # asc: mais críticos primeiro

    skip = (page - 1) * page_size
    page_items = scored[skip: skip + page_size]
    return {
        "items": page_items,
        "pois": page_items,  # contrato usado por app/municipio/pois.tsx
        "total": len(scored),
        "page": page,
        "page_size": page_size,
        "org_name": org.get("name"),
        "concelhos": concelhos,
        "access": org.get("access"),
    }


@partner_router.get("/pois/{poi_id}")
async def get_partner_poi(poi_id: str, current_user: dict = Depends(_current_user)):
    """Detalhe de um POI do território do parceiro."""
    # _db() raises a 500 itself when init_database() never ran.

    org = await _require_partner(current_user)

    item = await _db()["heritage_items"].find_one(_in_territory(org, {"id": poi_id}), {"_id": 0})
    if not item:
        raise HTTPException(404, "POI não encontrado no vosso território")

    score = _quick_health(item)
    item["content_health_score"] = score
    item["content_health_tier"] = _tier(score)

    # Drafts pendentes para este POI
    pending_drafts = await _db()["content_drafts"].count_documents({
        "target_id": poi_id,
        "status": {"$in": ["draft", "enriching", "enriched", "reviewing", "reviewed"]},
    })
    item["pending_drafts"] = pending_drafts

    return item


# ─── Submeter update como draft ──────────────────────────────────────────────

@partner_router.post("/pois/{poi_id}/draft", status_code=201)
async def submit_partner_draft(
    poi_id: str,
    payload: PartnerDraftRequest,
    current_user: dict = Depends(_current_user),
):
    """
    Submeter uma actualização de conteúdo para um POI.
    Entra como draft no pipeline Content Toolkit (status: 'draft').
    """
    # _db() raises a 500 itself when init_database() never ran.

    org = await _require_partner(current_user, WRITE_ACCESS)

    # Verificar que o POI pertence ao território do parceiro
    poi = await _db()["heritage_items"].find_one(
        _in_territory(org, {"id": poi_id}),
        {"id": 1, "name": 1, "category": 1, "region": 1, "_id": 0},
    )
    if not poi:
        raise HTTPException(404, "POI não encontrado no vosso território")

    ALLOWED_FIELDS = {"description", "micro_pitch", "descricao_curta", "local_story"}
    if payload.field not in ALLOWED_FIELDS:
        raise HTTPException(400, f"Campo inválido. Permitidos: {', '.join(ALLOWED_FIELDS)}")

    # Mapear field → target_depth
    depth_map = {
        "description": "historia",
        "micro_pitch": "snackable",
        "descricao_curta": "snackable",
        "local_story": "micro_story",
    }

    draft_id = uuid.uuid4().hex
    doc = {
        "draft_id": draft_id,
        "author_id": current_user.get("user_id", ""),
        "author_name": org.get("name", "Parceiro"),
        "author_org_id": org.get("org_id", ""),
        "source": "partner_portal",
        "target_type": "poi",
        "target_id": poi_id,
        "target_depth": depth_map.get(payload.field, "historia"),
        "field_to_update": payload.field,
        "title": poi.get("name", poi_id),
        "body_original": payload.body,
        "body_current": payload.body,
        "body_enriched": None,
        "category": poi.get("category", ""),
        "region": poi.get("region", ""),
        "tags": [],
        "notes_for_editor": payload.notes_for_editor,
        "status": "draft",
        "review_result": None,
        "enrichment_meta": None,
        "created_at": _now(),
        "updated_at": _now(),
        "published_at": None,
    }

    await _db()["content_drafts"].insert_one(doc)
    logger.info("[partner] Draft submetido: %s para POI %s por org %s", draft_id, poi_id, org.get("org_id"))

    return {
        "draft_id": draft_id,
        "status": "draft",
        "message": "Draft submetido com sucesso. Pode ser enriquecido com IA em POST /toolkit/enrich/{draft_id}",
        "toolkit_enrich_url": f"/api/toolkit/enrich/{draft_id}",
        "toolkit_review_url": f"/api/toolkit/review/{draft_id}",
    }


class PublishStatusRequest(BaseModel):
    status: Literal["published", "draft"]


@partner_router.patch("/pois/{poi_id}/draft")
async def set_partner_poi_status(
    poi_id: str,
    payload: PublishStatusRequest,
    current_user: dict = Depends(_current_user),
):
    """Publicar ou despublicar um POI do território (despublicado sai das listagens públicas)."""
    org = await _require_partner(current_user, WRITE_ACCESS)
    result = await _db()["heritage_items"].update_one(
        _in_territory(org, {"id": poi_id, "deleted_at": None}),
        {"$set": {
            "is_published": payload.status == "published",
            "last_edited_at": _now(),
            "last_edited_by": current_user.get("user_id", ""),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "POI não encontrado no vosso território")
    logger.info("[partner] POI %s → %s por org %s", poi_id, payload.status, org.get("org_id"))
    return {"poi_id": poi_id, "status": payload.status}


@partner_router.delete("/pois/{poi_id}", status_code=204)
async def archive_partner_poi(poi_id: str, current_user: dict = Depends(_current_user)):
    """Arquivar um POI do território (soft delete: deixa de ser público, mantém histórico)."""
    org = await _require_partner(current_user, DELETE_ACCESS)
    result = await _db()["heritage_items"].update_one(
        _in_territory(org, {"id": poi_id, "deleted_at": None}),
        {"$set": {
            "is_published": False,
            "deleted_at": _now(),
            "deleted_by": current_user.get("user_id", ""),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "POI não encontrado no vosso território")
    logger.info("[partner] POI %s arquivado por org %s", poi_id, org.get("org_id"))


# ─── Listar drafts do parceiro ────────────────────────────────────────────────

@partner_router.get("/drafts")
async def list_partner_drafts(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(_current_user),
):
    """Drafts submetidos pela organização parceira."""
    # _db() raises a 500 itself when init_database() never ran.

    org = await _require_partner(current_user)
    query: Dict[str, Any] = {"author_org_id": org.get("org_id", "")}
    if status:
        query["status"] = status

    cursor = _db()["content_drafts"].find(query, {"_id": 0}).sort("created_at", -1).limit(100)
    drafts = await cursor.to_list(length=100)
    return {"drafts": drafts, "total": len(drafts)}


# ─── Métricas do território ───────────────────────────────────────────────────

@partner_router.get("/metrics")
async def get_partner_metrics(current_user: dict = Depends(_current_user)):
    """Métricas básicas do território gerido pelo parceiro."""
    # _db() raises a 500 itself when init_database() never ran.

    org = await _require_partner(current_user)
    concelhos = org.get("concelhos", [])

    total_pois = await _db()["heritage_items"].count_documents(_territory(org))
    with_image = await _db()["heritage_items"].count_documents(
        _in_territory(org, {"image_url": {"$exists": True, "$nin": ["", None]}}))
    with_narrative = await _db()["heritage_items"].count_documents(
        _in_territory(org, {"micro_pitch": {"$exists": True, "$nin": ["", None]}}))
    pending_drafts = await _db()["content_drafts"].count_documents({
        "author_org_id": org.get("org_id", ""),
        "status": {"$in": ["draft", "enriching", "enriched", "reviewing", "reviewed"]},
    })
    published_drafts = await _db()["content_drafts"].count_documents({
        "author_org_id": org.get("org_id", ""),
        "status": "published",
    })

    return {
        "org_name": org.get("name"),
        "concelhos": concelhos,
        "total_pois": total_pois,
        "pois_with_image": with_image,
        "pois_with_narrative": with_narrative,
        "image_coverage_pct": round(with_image / total_pois * 100, 1) if total_pois > 0 else 0,
        "narrative_coverage_pct": round(with_narrative / total_pois * 100, 1) if total_pois > 0 else 0,
        "drafts_pending": pending_drafts,
        "drafts_published": published_drafts,
    }


@partner_router.get("/health-summary")
async def get_partner_health_summary(current_user: dict = Depends(_current_user)):
    """Distribuição de health scores no território do parceiro."""
    # _db() raises a 500 itself when init_database() never ran.

    org = await _require_partner(current_user)

    projection = {
        "id": 1, "image_url": 1, "description": 1, "micro_pitch": 1,
        "descricao_curta": 1, "local_story": 1, "historia_local": 1,
        "created_at": 1, "last_edited_at": 1, "iq_results": 1,
        "_id": 0,
    }

    cursor = _db()["heritage_items"].find(_territory(org), projection)
    raw = await cursor.to_list(length=2000)

    tiers: Dict[str, int] = {"healthy": 0, "attention": 0, "stale": 0, "critical": 0}
    total_score = 0
    for item in raw:
        s = _quick_health(item)
        tiers[_tier(s)] += 1
        total_score += s

    n = len(raw)
    return {
        "total_pois": n,
        "avg_score": round(total_score / n, 1) if n > 0 else 0.0,
        "tiers": tiers,
    }


# ─── Endpoints de Admin ───────────────────────────────────────────────────────

@partner_router.get("/orgs")
async def list_orgs(
    approved: Optional[bool] = Query(None),
    current_user: dict = Depends(_current_admin),
):
    """Lista todas as organizações parceiras (admin)."""
    # _db() raises a 500 itself when init_database() never ran.

    query: Dict[str, Any] = {}
    if approved is not None:
        query["approved"] = approved

    cursor = _db()["partner_orgs"].find(query, {"_id": 0}).sort("created_at", -1)
    orgs = await cursor.to_list(length=200)
    return {"orgs": orgs, "total": len(orgs)}


@partner_router.patch("/orgs/{org_id}/approve")
async def approve_org(
    org_id: str,
    payload: OrgApproveRequest,
    current_user: dict = Depends(_current_admin),
):
    """Aprovar ou rejeitar uma organização parceira (admin)."""
    # _db() raises a 500 itself when init_database() never ran.

    result = await _db()["partner_orgs"].update_one(
        {"org_id": org_id},
        {"$set": {
            "approved": payload.approved,
            "approved_at": _now() if payload.approved else None,
            "approved_by": current_user.get("user_id", ""),
            "reviewer_notes": payload.reviewer_notes,
        }},
    )

    if result.matched_count == 0:
        raise HTTPException(404, f"Organização {org_id} não encontrada")

    action = "aprovada" if payload.approved else "rejeitada"
    logger.info("[partner] Org %s %s por %s", org_id, action, current_user.get("user_id"))
    return {"org_id": org_id, "approved": payload.approved, "message": f"Organização {action}"}
