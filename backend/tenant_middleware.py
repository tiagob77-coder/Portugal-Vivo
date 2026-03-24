"""
tenant_middleware.py — Sistema Multi‑Tenant com RBAC

Roles:
  admin_global   → acesso total a todos os municípios
  municipio      → gere POIs do seu município (municipality_id)
  editor         → cria/edita POIs do seu município (sem apagar)
  viewer         → só leitura dos dados do seu município

Uso:
  from tenant_middleware import require_tenant_write, require_tenant_read, get_tenant_context

  @router.patch("/admin/pois/{poi_id}")
  async def update_poi(poi_id: str, tenant=Depends(require_tenant_write)):
      # tenant.municipality_id garante filtro automático
      ...
"""

from fastapi import Depends, HTTPException, APIRouter
from pydantic import BaseModel
from typing import Optional
from dataclasses import dataclass
from enum import Enum

from auth_api import require_auth
from models.api_models import User

# ─── Roles ────────────────────────────────────────────────────────────────────

class TenantRole(str, Enum):
    ADMIN_GLOBAL = "admin_global"
    MUNICIPIO    = "municipio"
    EDITOR       = "editor"
    VIEWER       = "viewer"

WRITE_ROLES  = {TenantRole.ADMIN_GLOBAL, TenantRole.MUNICIPIO, TenantRole.EDITOR}
DELETE_ROLES = {TenantRole.ADMIN_GLOBAL, TenantRole.MUNICIPIO}
READ_ROLES   = {TenantRole.ADMIN_GLOBAL, TenantRole.MUNICIPIO, TenantRole.EDITOR, TenantRole.VIEWER}

# ─── Contexto de Tenant ───────────────────────────────────────────────────────

@dataclass
class TenantContext:
    user_id: str
    email: str
    name: str
    role: TenantRole
    municipality_id: Optional[str]   # None apenas para admin_global
    is_admin_global: bool

    def can_access_municipality(self, target: str) -> bool:
        return self.is_admin_global or self.municipality_id == target

    def mongo_filter(self) -> dict:
        """Filtro MongoDB automático para limitar ao município do tenant."""
        if self.is_admin_global:
            return {}
        return {"municipality_id": self.municipality_id}

# ─── DB holder ────────────────────────────────────────────────────────────────

_db = None

def set_tenant_db(database):
    global _db
    _db = database

# ─── Dependency base ──────────────────────────────────────────────────────────

async def _get_tenant(user: User = Depends(require_auth)) -> TenantContext:
    if _db is None:
        raise HTTPException(status_code=500, detail="Tenant DB não configurada")

    user_doc = await _db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Utilizador não encontrado")

    raw_role = user_doc.get("tenant_role") or user_doc.get("role") or "viewer"
    if raw_role == "admin":
        raw_role = "admin_global"

    try:
        role = TenantRole(raw_role)
    except ValueError:
        role = TenantRole.VIEWER

    return TenantContext(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        role=role,
        municipality_id=user_doc.get("municipality_id"),
        is_admin_global=(role == TenantRole.ADMIN_GLOBAL),
    )

# ─── Dependencies públicas ────────────────────────────────────────────────────

async def get_tenant_context(tenant: TenantContext = Depends(_get_tenant)) -> TenantContext:
    return tenant

async def require_tenant_read(tenant: TenantContext = Depends(_get_tenant)) -> TenantContext:
    if tenant.role not in READ_ROLES:
        raise HTTPException(status_code=403, detail="Acesso de leitura negado")
    return tenant

async def require_tenant_write(tenant: TenantContext = Depends(_get_tenant)) -> TenantContext:
    if tenant.role not in WRITE_ROLES:
        raise HTTPException(status_code=403, detail="Acesso de escrita negado")
    return tenant

async def require_tenant_delete(tenant: TenantContext = Depends(_get_tenant)) -> TenantContext:
    if tenant.role not in DELETE_ROLES:
        raise HTTPException(status_code=403, detail="Apenas município ou admin pode apagar")
    return tenant

def require_poi_access(action: str = "write"):
    """
    Factory que valida acesso a um POI específico (verifica municipality_id).
    Uso: Depends(require_poi_access("write"))
    """
    role_map = {"read": READ_ROLES, "write": WRITE_ROLES, "delete": DELETE_ROLES}
    allowed = role_map.get(action, WRITE_ROLES)

    async def _check(poi_id: str, tenant: TenantContext = Depends(_get_tenant)):
        if tenant.role not in allowed:
            raise HTTPException(status_code=403, detail=f"Acesso '{action}' negado")
        if not tenant.is_admin_global and _db is not None:
            poi = await _db.heritage_items.find_one({"id": poi_id}, {"municipality_id": 1, "_id": 0})
            if poi and poi.get("municipality_id") and poi["municipality_id"] != tenant.municipality_id:
                raise HTTPException(
                    status_code=403,
                    detail=f"POI pertence a '{poi['municipality_id']}' — sem permissão"
                )
        return tenant

    return _check

# ─── Router de gestão de tenants ──────────────────────────────────────────────

tenant_router = APIRouter(prefix="/admin/tenants", tags=["Tenant Management"])

class TenantUserUpdate(BaseModel):
    tenant_role: Optional[TenantRole] = None
    municipality_id: Optional[str] = None

@tenant_router.get("/municipalities")
async def list_municipalities(tenant: TenantContext = Depends(require_tenant_read)):
    """Municípios com contagem de POIs e saúde média de conteúdo."""
    if _db is None:
        return {"municipalities": []}

    pipeline = [
        {"$group": {
            "_id": "$municipality_id",
            "poi_count": {"$sum": 1},
            "avg_health": {"$avg": "$content_health_score"},
        }},
        {"$match": {"_id": {"$ne": None}}},
        {"$sort": {"poi_count": -1}},
    ]
    results = []
    async for doc in _db.heritage_items.aggregate(pipeline):
        results.append({
            "municipality_id": doc["_id"],
            "poi_count": doc["poi_count"],
            "avg_health_score": round(doc.get("avg_health") or 0, 1),
        })

    if not tenant.is_admin_global:
        results = [m for m in results if m["municipality_id"] == tenant.municipality_id]

    return {"municipalities": results, "total": len(results)}

@tenant_router.get("/users")
async def list_tenant_users(tenant: TenantContext = Depends(require_tenant_read)):
    """Utilizadores com roles tenant."""
    if _db is None:
        return {"users": []}
    query: dict = {"tenant_role": {"$exists": True}}
    if not tenant.is_admin_global:
        query["municipality_id"] = tenant.municipality_id
    cursor = _db.users.find(query, {
        "_id": 0, "user_id": 1, "email": 1, "name": 1,
        "tenant_role": 1, "municipality_id": 1, "created_at": 1,
    })
    users = [u async for u in cursor]
    return {"users": users, "total": len(users)}

@tenant_router.patch("/users/{user_id}")
async def update_tenant_user(
    user_id: str,
    body: TenantUserUpdate,
    tenant: TenantContext = Depends(require_tenant_delete),
):
    """Actualiza role/município de um utilizador."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB não disponível")
    if not tenant.is_admin_global:
        target = await _db.users.find_one({"user_id": user_id}, {"municipality_id": 1})
        if target and target.get("municipality_id") != tenant.municipality_id:
            raise HTTPException(status_code=403, detail="Sem permissão para gerir este utilizador")

    update: dict = {}
    if body.tenant_role is not None:
        update["tenant_role"] = body.tenant_role.value
    if body.municipality_id is not None:
        if not tenant.is_admin_global:
            raise HTTPException(status_code=403, detail="Só o admin global pode mudar o município")
        update["municipality_id"] = body.municipality_id

    if not update:
        raise HTTPException(status_code=400, detail="Nenhum campo para actualizar")

    result = await _db.users.update_one({"user_id": user_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    return {"success": True, "updated": update}


class TenantInvite(BaseModel):
    email: str
    name: str
    tenant_role: TenantRole = TenantRole.VIEWER


@tenant_router.post("/invite")
async def invite_tenant_user(
    body: TenantInvite,
    tenant: TenantContext = Depends(require_tenant_delete),
):
    """Convida (cria) um utilizador na equipa do município."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB não disponível")

    if body.tenant_role == TenantRole.ADMIN_GLOBAL and not tenant.is_admin_global:
        raise HTTPException(status_code=403, detail="Só o admin global pode atribuir esse role")

    import uuid, datetime
    existing = await _db.users.find_one({"email": body.email}, {"_id": 0, "user_id": 1})
    if existing:
        # Update role for existing user
        await _db.users.update_one(
            {"email": body.email},
            {"$set": {
                "tenant_role": body.tenant_role.value,
                "municipality_id": tenant.municipality_id,
            }},
        )
        return {"success": True, "action": "updated", "email": body.email}

    new_user = {
        "user_id": str(uuid.uuid4()),
        "email": body.email,
        "name": body.name,
        "tenant_role": body.tenant_role.value,
        "municipality_id": tenant.municipality_id,
        "created_at": datetime.datetime.utcnow().isoformat(),
        "invited_by": tenant.user_id,
        "password_hash": None,  # Must set password on first login
    }
    await _db.users.insert_one(new_user)
    return {"success": True, "action": "created", "email": body.email}


@tenant_router.delete("/users/{user_id}")
async def remove_tenant_user(
    user_id: str,
    tenant: TenantContext = Depends(require_tenant_delete),
):
    """Remove o acesso municipal de um utilizador."""
    if _db is None:
        raise HTTPException(status_code=500, detail="DB não disponível")
    if not tenant.is_admin_global:
        target = await _db.users.find_one({"user_id": user_id}, {"municipality_id": 1})
        if target and target.get("municipality_id") != tenant.municipality_id:
            raise HTTPException(status_code=403, detail="Sem permissão")

    await _db.users.update_one(
        {"user_id": user_id},
        {"$unset": {"tenant_role": "", "municipality_id": ""}},
    )
    return {"success": True}
