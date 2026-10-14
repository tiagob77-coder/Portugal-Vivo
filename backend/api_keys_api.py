"""
Partner API keys — Portugal Vivo B2B
=====================================
API keys, plans and monthly quotas for the partner API (/api/v1/*).
Plans and prices mirror docs/api-pricing.md.

Keys are shown in plaintext exactly once (on creation); only a SHA-256 hash
is stored. Every authenticated /v1 call increments a per-key monthly counter
in ``api_usage`` and is refused with 429 once the plan quota is spent.

Routes:
  GET    /v1/plans                       — plan catalogue (public)
  POST   /v1/access-requests             — request a key (public, reviewed by admin)
  GET    /v1/usage                       — plan + usage of the calling key (X-API-Key)
  POST   /admin/api-keys                 — create key, returns plaintext once (admin)
  GET    /admin/api-keys                 — list keys + current-month usage (admin)
  PATCH  /admin/api-keys/{key_id}        — change plan / status / name (admin)
  DELETE /admin/api-keys/{key_id}        — revoke key (admin)
  GET    /admin/api-keys/requests        — pending access requests (admin)

Collections: api_keys, api_usage, api_access_requests
"""
from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, FrozenSet, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr, Field
from pymongo import ReturnDocument

from auth_api import require_admin
from dependencies import get_db
from models.api_models import User

logger = logging.getLogger(__name__)

api_keys_admin_router = APIRouter(prefix="/admin/api-keys", tags=["Partner API — Admin"])
api_keys_public_router = APIRouter(prefix="/v1", tags=["Partner API v1"])

API_KEY_HEADER = "X-API-Key"
KEY_PREFIX = "pv_live_"

# ─── Plans (docs/api-pricing.md) ──────────────────────────────────────────────

BASE_FEATURES = frozenset({"heritage", "routes", "map"})
PARTNER_FEATURES = BASE_FEATURES | {"narratives", "weather", "events"}
ALL_FEATURES = PARTNER_FEATURES | {"audio"}

API_PLANS: Dict[str, Dict[str, Any]] = {
    "explorador": {
        "name": "Explorador",
        "price_eur_month": 0,
        "monthly_quota": 500,
        "features": BASE_FEATURES,
        "sla": None,
        "white_label": False,
    },
    "parceiro": {
        "name": "Parceiro",
        "price_eur_month": 49,
        "monthly_quota": 10_000,
        "features": PARTNER_FEATURES,
        "sla": "99%",
        "white_label": False,
    },
    "pro": {
        "name": "Pro",
        "price_eur_month": 149,
        "monthly_quota": 100_000,
        "features": ALL_FEATURES,
        "sla": "99,5%",
        "white_label": True,
    },
    "enterprise": {
        "name": "Enterprise",
        "price_eur_month": 500,  # mínimo — contrato anual sob consulta
        "monthly_quota": None,   # ilimitado
        "features": ALL_FEATURES,
        "sla": "personalizado",
        "white_label": True,
    },
}
ANNUAL_DISCOUNT = 0.20

PlanName = Literal["explorador", "parceiro", "pro", "enterprise"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def current_period(now: Optional[datetime] = None) -> str:
    return (now or _now()).strftime("%Y-%m")


def hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def generate_api_key() -> str:
    return KEY_PREFIX + secrets.token_urlsafe(32)


def _plan_public(plan_id: str) -> Dict[str, Any]:
    plan = API_PLANS[plan_id]
    monthly = plan["price_eur_month"]
    return {
        "id": plan_id,
        "name": plan["name"],
        "price_eur_month": monthly,
        "price_eur_month_billed_annually": round(monthly * (1 - ANNUAL_DISCOUNT), 2),
        "monthly_quota": plan["monthly_quota"],
        "features": sorted(plan["features"]),
        "sla": plan["sla"],
        "white_label": plan["white_label"],
    }


# ─── Key authentication (used by partner_api_v1) ──────────────────────────────

@dataclass(frozen=True)
class ApiKeyContext:
    key_id: str
    plan: str
    org_name: str
    features: FrozenSet[str]
    white_label: bool
    used_this_month: int
    monthly_quota: Optional[int]


async def _load_key(request: Request, db: AsyncIOMotorDatabase) -> Dict[str, Any]:
    raw = (request.headers.get(API_KEY_HEADER) or "").strip()
    if not raw:
        raise HTTPException(
            status_code=401,
            detail=f"API key em falta. Envie o cabeçalho {API_KEY_HEADER}.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    key = await db.api_keys.find_one({"key_hash": hash_api_key(raw)}, {"_id": 0})
    if not key or key.get("status") != "active":
        raise HTTPException(
            status_code=401,
            detail="API key inválida ou revogada.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    if key.get("plan") not in API_PLANS:
        raise HTTPException(status_code=403, detail="Plano da API key desconhecido.")
    return key


def require_api_key(feature: str):
    """Dependency factory: authenticate the X-API-Key, check the plan grants
    ``feature`` and count the call against the monthly quota."""
    if feature not in ALL_FEATURES:
        raise ValueError(f"Unknown partner API feature: {feature}")

    async def _dependency(
        request: Request,
        response: Response,
        db: AsyncIOMotorDatabase = Depends(get_db),
    ) -> ApiKeyContext:
        key = await _load_key(request, db)
        plan = API_PLANS[key["plan"]]
        if feature not in plan["features"]:
            upgrade = "pro" if feature == "audio" else "parceiro"
            raise HTTPException(
                status_code=403,
                detail=f"O plano {plan['name']} não inclui '{feature}'. Disponível a partir do plano "
                       f"{API_PLANS[upgrade]['name']}.",
            )

        now = _now()
        usage = await db.api_usage.find_one_and_update(
            {"key_id": key["key_id"], "period": current_period(now)},
            {
                "$inc": {"count": 1, f"by_feature.{feature}": 1},
                "$set": {"updated_at": now},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        count = int(usage.get("count", 0))
        quota = plan["monthly_quota"]

        response.headers["X-RateLimit-Limit"] = "unlimited" if quota is None else str(quota)
        response.headers["X-RateLimit-Remaining"] = (
            "unlimited" if quota is None else str(max(0, quota - count))
        )
        if quota is not None and count > quota:
            raise HTTPException(
                status_code=429,
                detail=f"Quota mensal do plano {plan['name']} esgotada ({quota} pedidos). "
                       "Renova no início do próximo mês ou faça upgrade.",
                headers={"X-RateLimit-Limit": str(quota), "X-RateLimit-Remaining": "0"},
            )

        await db.api_keys.update_one({"key_id": key["key_id"]}, {"$set": {"last_used_at": now}})
        return ApiKeyContext(
            key_id=key["key_id"],
            plan=key["plan"],
            org_name=key.get("org_name", ""),
            features=frozenset(plan["features"]),
            white_label=bool(plan["white_label"]),
            used_this_month=count,
            monthly_quota=quota,
        )

    return _dependency


# ─── Public endpoints ─────────────────────────────────────────────────────────

class AccessRequest(BaseModel):
    org_name: str = Field(..., min_length=2, max_length=120)
    contact_name: str = Field(..., min_length=2, max_length=120)
    contact_email: EmailStr
    use_case: str = Field(..., min_length=10, max_length=2000)
    desired_plan: PlanName = "explorador"
    website: Optional[str] = Field(None, max_length=300)


@api_keys_public_router.get("/plans")
async def list_api_plans():
    """Catálogo público de planos da API para parceiros."""
    return {
        "plans": [_plan_public(p) for p in API_PLANS],
        "annual_discount": ANNUAL_DISCOUNT,
        "currency": "EUR",
        "vat_included": False,
        "auth_header": API_KEY_HEADER,
    }


@api_keys_public_router.post("/access-requests", status_code=201)
async def create_access_request(payload: AccessRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Pedido de acesso à API. Fica pendente até um administrador emitir a chave."""
    request_id = uuid.uuid4().hex
    await db.api_access_requests.insert_one({
        "request_id": request_id,
        **payload.model_dump(),
        "status": "pending",
        "created_at": _now(),
    })
    logger.info("[api-keys] Pedido de acesso %s de %s", request_id, payload.org_name)
    return {"request_id": request_id, "status": "pending"}


@api_keys_public_router.get("/usage")
async def get_my_usage(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Plano e consumo do mês corrente da API key enviada (não conta para a quota)."""
    key = await _load_key(request, db)
    period = current_period()
    usage = await db.api_usage.find_one({"key_id": key["key_id"], "period": period}, {"_id": 0}) or {}
    plan = API_PLANS[key["plan"]]
    used = int(usage.get("count", 0))
    quota = plan["monthly_quota"]
    return {
        "key_prefix": key.get("key_prefix"),
        "org_name": key.get("org_name"),
        "plan": _plan_public(key["plan"]),
        "period": period,
        "used": used,
        "remaining": None if quota is None else max(0, quota - used),
        "by_feature": usage.get("by_feature", {}),
    }


# ─── Admin endpoints ──────────────────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120, description="Nome interno da chave")
    org_name: str = Field(..., min_length=2, max_length=120)
    contact_email: Optional[EmailStr] = None
    plan: PlanName = "explorador"
    request_id: Optional[str] = Field(None, description="Pedido de acesso que esta chave satisfaz")


class ApiKeyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    plan: Optional[PlanName] = None
    status: Optional[Literal["active", "suspended"]] = None


def _public_key_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    out = {k: v for k, v in doc.items() if k not in ("_id", "key_hash")}
    return out


@api_keys_admin_router.post("", status_code=201)
async def create_api_key(
    payload: ApiKeyCreate,
    admin: User = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Emitir uma nova API key. A chave em claro só é devolvida nesta resposta."""
    raw = generate_api_key()
    doc = {
        "key_id": uuid.uuid4().hex,
        "key_hash": hash_api_key(raw),
        "key_prefix": raw[: len(KEY_PREFIX) + 6],
        "name": payload.name,
        "org_name": payload.org_name,
        "contact_email": payload.contact_email,
        "plan": payload.plan,
        "status": "active",
        "created_at": _now(),
        "created_by": admin.user_id,
        "last_used_at": None,
        "request_id": payload.request_id,
    }
    await db.api_keys.insert_one(doc)
    if payload.request_id:
        await db.api_access_requests.update_one(
            {"request_id": payload.request_id},
            {"$set": {"status": "approved", "key_id": doc["key_id"], "reviewed_at": _now()}},
        )
    logger.info("[api-keys] Chave %s criada para %s (%s)", doc["key_prefix"], payload.org_name, payload.plan)
    return {**_public_key_doc(doc), "api_key": raw,
            "warning": "Guarde esta chave agora — não volta a ser mostrada."}


@api_keys_admin_router.get("")
async def list_api_keys(
    status: Optional[str] = Query(None),
    _admin: User = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Lista de API keys com o consumo do mês corrente."""
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    keys = await db.api_keys.find(query, {"_id": 0, "key_hash": 0}).sort("created_at", -1).to_list(500)
    period = current_period()
    usage_docs = await db.api_usage.find(
        {"period": period, "key_id": {"$in": [k["key_id"] for k in keys]}}, {"_id": 0}
    ).to_list(500)
    usage = {u["key_id"]: int(u.get("count", 0)) for u in usage_docs}
    for k in keys:
        quota = API_PLANS.get(k.get("plan"), {}).get("monthly_quota")
        k["usage"] = {"period": period, "used": usage.get(k["key_id"], 0), "quota": quota}
    mrr = sum(API_PLANS[k["plan"]]["price_eur_month"] for k in keys
              if k.get("status") == "active" and k.get("plan") in API_PLANS)
    return {"keys": keys, "total": len(keys), "mrr_eur_list_price": mrr}


@api_keys_admin_router.get("/requests")
async def list_access_requests(
    status: Optional[str] = Query("pending"),
    _admin: User = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Pedidos de acesso à API (por omissão, os pendentes)."""
    query = {"status": status} if status else {}
    docs = await db.api_access_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"requests": docs, "total": len(docs)}


@api_keys_admin_router.patch("/{key_id}")
async def update_api_key(
    key_id: str,
    payload: ApiKeyUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Mudar plano, estado (active/suspended) ou nome de uma chave."""
    changes = payload.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Nada para alterar")
    existing = await db.api_keys.find_one({"key_id": key_id}, {"status": 1, "_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="API key não encontrada")
    if existing.get("status") == "revoked":
        raise HTTPException(status_code=409, detail="Chave revogada — emita uma nova")
    changes["updated_at"] = _now()
    await db.api_keys.update_one({"key_id": key_id}, {"$set": changes})
    doc = await db.api_keys.find_one({"key_id": key_id}, {"_id": 0, "key_hash": 0})
    return doc


@api_keys_admin_router.delete("/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: str,
    admin: User = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Revogar uma chave (irreversível)."""
    result = await db.api_keys.update_one(
        {"key_id": key_id},
        {"$set": {"status": "revoked", "revoked_at": _now(), "revoked_by": admin.user_id}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="API key não encontrada")
