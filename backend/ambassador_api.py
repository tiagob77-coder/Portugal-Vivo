"""
Ambassador API — Programa de Embaixadores Locais do Portugal Vivo.

Endpoints:
  POST /ambassadors/apply              - Candidatura a embaixador
  GET  /ambassadors                    - Lista embaixadores ativos (público)
  GET  /ambassadors/{user_id}          - Perfil de embaixador
  PATCH /ambassadors/{app_id}/review   - Admin: aprovar ou rejeitar candidatura
  GET  /ambassadors/applications       - Admin: lista candidaturas pendentes
  GET  /ambassadors/badges             - Tipos de roles disponíveis
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from shared_utils import DatabaseHolder, clamp_pagination
from models.api_models import User
from shared_constants import AMBASSADOR_ROLES

logger = logging.getLogger(__name__)

ambassador_router = APIRouter(prefix="/ambassadors", tags=["Ambassadors"])

_db_holder = DatabaseHolder("ambassador")
set_ambassador_db = _db_holder.set

_require_auth = None
_require_admin = None


def set_ambassador_auth(auth_fn, admin_fn):
    global _require_auth, _require_admin
    _require_auth = auth_fn
    _require_admin = admin_fn


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class AmbassadorApplication(BaseModel):
    role: str = Field(..., description="One of the AMBASSADOR_ROLES ids")
    region: str = Field(..., max_length=50, description="Primary region of expertise")
    bio: str = Field(..., min_length=50, max_length=1000, description="Why should you be an ambassador?")
    local_expertise: str = Field(..., min_length=20, max_length=500)
    social_links: Optional[List[str]] = Field(None, max_items=3)


class ApplicationReview(BaseModel):
    action: str = Field(..., regex="^(approve|reject)$")
    note: Optional[str] = Field(None, max_length=300)


class AmbassadorProfile(BaseModel):
    user_id: str
    user_name: str
    user_picture: Optional[str] = None
    role: str
    role_name: str
    region: str
    bio: str
    local_expertise: str
    social_links: List[str] = []
    status: str = "active"
    approved_at: Optional[datetime] = None
    contribution_count: int = 0
    trust_score: float = 0.0


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@ambassador_router.get("/roles")
async def get_ambassador_roles():
    """Return all available ambassador role types."""
    return {"roles": AMBASSADOR_ROLES}


@ambassador_router.post("/apply")
async def apply_ambassador(
    body: AmbassadorApplication,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """
    Submit an ambassador application.
    Requirements checked at application time:
    - No pending/active application for this user
    - Role must be valid
    """
    db = _db_holder.db

    # Validate role
    valid_roles = {r["id"] for r in AMBASSADOR_ROLES}
    if body.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Role inválido. Opções: {', '.join(valid_roles)}")

    # Check for existing active or pending application
    existing = await db.ambassador_applications.find_one({
        "user_id": current_user.user_id,
        "status": {"$in": ["pending", "active"]},
    })
    if existing:
        raise HTTPException(status_code=409, detail="Já tens uma candidatura ativa ou pendente")

    application = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "user_picture": current_user.picture,
        "role": body.role,
        "region": body.region,
        "bio": body.bio,
        "local_expertise": body.local_expertise,
        "social_links": body.social_links or [],
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc),
        "reviewed_at": None,
        "reviewed_by": None,
        "review_note": None,
    }
    await db.ambassador_applications.insert_one(application)
    return {
        "message": "Candidatura submetida com sucesso! Receberás uma notificação quando for avaliada.",
        "application_id": application["id"],
    }


@ambassador_router.get("")
async def list_ambassadors(
    region: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    skip: int = 0,
):
    """Public: list active ambassadors, optionally filtered by region or role."""
    db = _db_holder.db
    skip, limit = clamp_pagination(skip, limit)
    query: dict = {"status": "active"}
    if region:
        query["region"] = region
    if role:
        query["role"] = role

    docs = await db.ambassadors.find(query, {"_id": 0}).sort("approved_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.ambassadors.count_documents(query)

    # Enrich with role_name
    role_map = {r["id"]: r["name"] for r in AMBASSADOR_ROLES}
    for d in docs:
        d["role_name"] = role_map.get(d.get("role", ""), d.get("role", ""))

    return {"ambassadors": docs, "total": total}


@ambassador_router.get("/applications")
async def list_applications(
    status: str = Query("pending", regex="^(pending|approved|rejected|all)$"),
    skip: int = 0,
    limit: int = Query(20, le=100),
    current_user: User = Depends(lambda r: _require_admin(r)),
):
    """Admin: list ambassador applications."""
    db = _db_holder.db
    skip, limit = clamp_pagination(skip, limit)
    query = {} if status == "all" else {"status": status}
    docs = await db.ambassador_applications.find(query, {"_id": 0}) \
        .sort("submitted_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.ambassador_applications.count_documents(query)
    return {"applications": docs, "total": total}


@ambassador_router.patch("/applications/{application_id}/review")
async def review_application(
    application_id: str,
    body: ApplicationReview,
    current_user: User = Depends(lambda r: _require_admin(r)),
):
    """Admin: approve or reject an ambassador application."""
    db = _db_holder.db
    app_doc = await db.ambassador_applications.find_one({"id": application_id})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Candidatura não encontrada")
    if app_doc["status"] != "pending":
        raise HTTPException(status_code=409, detail="Candidatura já foi avaliada")

    now = datetime.now(timezone.utc)
    new_status = "approved" if body.action == "approve" else "rejected"

    await db.ambassador_applications.update_one(
        {"id": application_id},
        {"$set": {
            "status": new_status,
            "reviewed_at": now,
            "reviewed_by": current_user.user_id,
            "review_note": body.note,
        }}
    )

    if body.action == "approve":
        role_map = {r["id"]: r["name"] for r in AMBASSADOR_ROLES}
        ambassador_doc = {
            "id": str(uuid.uuid4()),
            "user_id": app_doc["user_id"],
            "user_name": app_doc["user_name"],
            "user_picture": app_doc.get("user_picture"),
            "role": app_doc["role"],
            "role_name": role_map.get(app_doc["role"], app_doc["role"]),
            "region": app_doc["region"],
            "bio": app_doc["bio"],
            "local_expertise": app_doc["local_expertise"],
            "social_links": app_doc.get("social_links", []),
            "status": "active",
            "approved_at": now,
            "approved_by": current_user.user_id,
            "trust_score": 5.0,
            "contribution_count": 0,
        }
        await db.ambassadors.insert_one(ambassador_doc)

        # Add ambassador badge to community profile
        await db.community_profiles.update_one(
            {"user_id": app_doc["user_id"]},
            {
                "$addToSet": {"earned_badges": "embaixador"},
                "$set": {"ambassador_role": app_doc["role"], "ambassador_region": app_doc["region"]},
                "$setOnInsert": {"user_id": app_doc["user_id"], "created_at": now},
            },
            upsert=True,
        )

    return {
        "message": f"Candidatura {'aprovada' if body.action == 'approve' else 'rejeitada'} com sucesso",
        "status": new_status,
    }


@ambassador_router.get("/{user_id}")
async def get_ambassador_profile(user_id: str):
    """Public: get ambassador profile for a specific user."""
    db = _db_holder.db
    doc = await db.ambassadors.find_one(
        {"user_id": user_id, "status": "active"}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Embaixador não encontrado")
    role_map = {r["id"]: r["name"] for r in AMBASSADOR_ROLES}
    doc["role_name"] = role_map.get(doc.get("role", ""), doc.get("role", ""))
    # Contribution count
    contributions = await db.contributions.count_documents(
        {"user_id": user_id, "status": {"$in": ["approved", "featured"]}}
    )
    doc["contribution_count"] = contributions
    return doc


@ambassador_router.delete("/{user_id}/revoke")
async def revoke_ambassador(
    user_id: str,
    reason: Optional[str] = Query(None, max_length=200),
    current_user: User = Depends(lambda r: _require_admin(r)),
):
    """Admin: revoke ambassador status."""
    db = _db_holder.db
    result = await db.ambassadors.update_one(
        {"user_id": user_id, "status": "active"},
        {"$set": {
            "status": "revoked",
            "revoked_at": datetime.now(timezone.utc),
            "revoked_by": current_user.user_id,
            "revoke_reason": reason,
        }}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Embaixador ativo não encontrado")
    return {"message": "Estatuto de embaixador revogado"}
