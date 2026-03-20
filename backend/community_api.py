"""
Community API - Community contributions, reports, moderation, profiles.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from shared_utils import DatabaseHolder, clamp_pagination, sanitize_regex
from models.api_models import User, Location
from shared_constants import COMMUNITY_BADGES

logger = logging.getLogger(__name__)

community_router = APIRouter(tags=["Community"])

_db_holder = DatabaseHolder("community")
set_community_db = _db_holder.set

_require_auth = None


def set_community_auth(auth_fn):
    global _require_auth
    _require_auth = auth_fn


# Models

class ContributionCreate(BaseModel):
    heritage_item_id: Optional[str] = None
    type: str = Field(..., max_length=50)
    title: str = Field(..., min_length=2, max_length=200)
    content: str = Field(..., min_length=10, max_length=10000)
    location: Optional[Location] = None
    category: Optional[str] = Field(None, max_length=50)
    region: Optional[str] = Field(None, max_length=50)
    image_urls: Optional[List[str]] = None


class Contribution(BaseModel):
    id: str
    user_id: str
    user_name: str
    heritage_item_id: Optional[str] = None
    type: str
    title: str
    content: str
    location: Optional[Location] = None
    category: Optional[str] = None
    region: Optional[str] = None
    image_urls: Optional[List[str]] = None
    status: str = 'pending'
    votes: int = 0
    created_at: datetime


@community_router.post("/contributions", response_model=Contribution)
async def create_contribution(
    contribution: ContributionCreate,
    current_user: User = Depends(lambda r: _require_auth(r))
):
    """Create a new community contribution"""
    new_contribution = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "heritage_item_id": contribution.heritage_item_id,
        "type": contribution.type,
        "title": contribution.title,
        "content": contribution.content,
        "location": contribution.location.dict() if contribution.location else None,
        "category": contribution.category,
        "region": contribution.region,
        "image_urls": contribution.image_urls or [],
        "status": "pending",
        "votes": 0,
        "created_at": datetime.now(timezone.utc)
    }

    try:
        await _db_holder.db.contributions.insert_one(new_contribution)
    except Exception as e:
        logger.error("Failed to create contribution: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao criar contribuição")
    return Contribution(**new_contribution)


@community_router.get("/contributions")
async def get_contributions(
    status: Optional[str] = None,
    type: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get community contributions with pagination"""
    skip, limit = clamp_pagination(skip, limit)
    query = {}
    if status:
        query["status"] = status
    if type:
        query["type"] = type
    if region:
        query["region"] = region

    total = await _db_holder.db.contributions.count_documents(query)
    contributions = await _db_holder.db.contributions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {
        "items": [Contribution(**c) for c in contributions],
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_more": skip + limit < total
    }


@community_router.get("/contributions/approved", response_model=List[Contribution])
async def get_approved_contributions(limit: int = 50):
    """Get approved community contributions"""
    _, limit = clamp_pagination(0, limit, max_limit=200)
    contributions = await _db_holder.db.contributions.find(
        {"status": "approved"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return [Contribution(**c) for c in contributions]


@community_router.get("/contributions/my", response_model=List[Contribution])
async def get_my_contributions(current_user: User = Depends(lambda r: _require_auth(r))):
    """Get current user's contributions"""
    contributions = await _db_holder.db.contributions.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [Contribution(**c) for c in contributions]


@community_router.post("/contributions/{contribution_id}/vote")
async def vote_contribution(
    contribution_id: str,
    current_user: User = Depends(lambda r: _require_auth(r))
):
    """Vote for a contribution (idempotent per user)"""
    db = _db_holder.db
    existing = await db.contribution_votes.find_one(
        {"contribution_id": contribution_id, "user_id": current_user.user_id}
    )
    if existing:
        return {"message": "Já votaste nesta contribuição", "already_voted": True}
    await db.contribution_votes.insert_one({
        "contribution_id": contribution_id,
        "user_id": current_user.user_id,
        "created_at": datetime.now(timezone.utc),
    })
    try:
        result = await db.contributions.update_one(
            {"id": contribution_id},
            {"$inc": {"votes": 1}}
        )
    except Exception as e:
        logger.error("Failed to vote on contribution: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao registar voto")
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Contribution not found")
    return {"message": "Voto registado", "already_voted": False}


# ---------------------------------------------------------------------------
# Reports & moderation
# ---------------------------------------------------------------------------

class ReportCreate(BaseModel):
    reason: str = Field(..., max_length=200)
    details: Optional[str] = Field(None, max_length=1000)


@community_router.post("/contributions/{contribution_id}/report")
async def report_contribution(
    contribution_id: str,
    body: ReportCreate,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Report a contribution for moderation review."""
    db = _db_holder.db
    existing = await db.contribution_reports.find_one(
        {"contribution_id": contribution_id, "reporter_id": current_user.user_id}
    )
    if existing:
        raise HTTPException(status_code=409, detail="Já reportaste esta contribuição")

    report = {
        "id": str(uuid.uuid4()),
        "contribution_id": contribution_id,
        "reporter_id": current_user.user_id,
        "reporter_name": current_user.name,
        "reason": body.reason,
        "details": body.details,
        "status": "open",
        "created_at": datetime.now(timezone.utc),
    }
    await db.contribution_reports.insert_one(report)
    # Increment report counter on the contribution
    await db.contributions.update_one(
        {"id": contribution_id}, {"$inc": {"report_count": 1}}
    )
    return {"message": "Report submetido. Obrigado pela tua contribuição cívica."}


@community_router.get("/contributions/featured")
async def get_featured_contributions(
    region: Optional[str] = Query(None),
    limit: int = Query(12, le=50),
):
    """
    Featured/curated contributions — highest voted approved items.
    Optionally filtered by region.
    """
    query: Dict[str, Any] = {"status": "approved"}
    if region:
        query["region"] = region
    items = await _db_holder.db.contributions.find(query, {"_id": 0}) \
        .sort("votes", -1).limit(limit).to_list(limit)
    return {"items": [Contribution(**c) for c in items], "total": len(items)}


@community_router.patch("/contributions/{contribution_id}/moderate")
async def moderate_contribution(
    contribution_id: str,
    action: str = Query(..., regex="^(approve|reject|feature)$"),
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Admin: approve, reject or feature a contribution."""
    # Basic role check — allow ambassadors and admins
    db = _db_holder.db
    ambassador = await db.ambassadors.find_one({"user_id": current_user.user_id, "status": "active"})
    if not ambassador:
        raise HTTPException(status_code=403, detail="Permissão negada — apenas administradores e embaixadores")

    status_map = {"approve": "approved", "reject": "rejected", "feature": "featured"}
    new_status = status_map[action]
    result = await db.contributions.update_one(
        {"id": contribution_id},
        {"$set": {"status": new_status, "moderated_at": datetime.now(timezone.utc),
                  "moderated_by": current_user.user_id}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Contribuição não encontrada")
    return {"message": f"Contribuição marcada como '{new_status}'"}


# ---------------------------------------------------------------------------
# Community badges
# ---------------------------------------------------------------------------

@community_router.get("/community-badges")
async def get_community_badges():
    """Return all community badge definitions."""
    return {"badges": COMMUNITY_BADGES}


@community_router.get("/community-badges/{user_id}")
async def get_user_community_badges(user_id: str):
    """Return earned community badges for a user."""
    db = _db_holder.db
    profile = await db.community_profiles.find_one({"user_id": user_id}, {"_id": 0})
    earned = profile.get("earned_badges", []) if profile else []
    return {"user_id": user_id, "earned_badges": earned, "total": len(earned)}


# ---------------------------------------------------------------------------
# Public user profiles & follow system
# ---------------------------------------------------------------------------

class ProfileUpdate(BaseModel):
    bio: Optional[str] = Field(None, max_length=300)
    interests: Optional[List[str]] = Field(None, max_items=10)
    favorite_region: Optional[str] = Field(None, max_length=50)
    instagram: Optional[str] = Field(None, max_length=60)
    website: Optional[str] = Field(None, max_length=200)


@community_router.get("/profiles/{user_id}")
async def get_public_profile(user_id: str):
    """Return public profile for a user."""
    db = _db_holder.db
    profile = await db.community_profiles.find_one({"user_id": user_id}, {"_id": 0}) or {}
    contributions = await db.contributions.count_documents({"user_id": user_id, "status": "approved"})
    followers = await db.follows.count_documents({"following_id": user_id})
    following = await db.follows.count_documents({"follower_id": user_id})
    return {
        **profile,
        "user_id": user_id,
        "stats": {
            "contributions": contributions,
            "followers": followers,
            "following": following,
        }
    }


@community_router.put("/profiles/me")
async def update_my_profile(
    body: ProfileUpdate,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Update the authenticated user's community profile."""
    db = _db_holder.db
    update = {k: v for k, v in body.dict().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc)
    await db.community_profiles.update_one(
        {"user_id": current_user.user_id},
        {"$set": update, "$setOnInsert": {"user_id": current_user.user_id, "created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"message": "Perfil atualizado"}


@community_router.post("/profiles/{user_id}/follow")
async def follow_user(
    user_id: str,
    current_user: User = Depends(lambda r: _require_auth(r)),
):
    """Follow or unfollow a user (toggle)."""
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Não podes seguir-te a ti próprio")
    db = _db_holder.db
    existing = await db.follows.find_one(
        {"follower_id": current_user.user_id, "following_id": user_id}
    )
    if existing:
        await db.follows.delete_one({"_id": existing["_id"]})
        return {"following": False, "message": "Deixaste de seguir este utilizador"}
    await db.follows.insert_one({
        "id": str(uuid.uuid4()),
        "follower_id": current_user.user_id,
        "following_id": user_id,
        "created_at": datetime.now(timezone.utc),
    })
    return {"following": True, "message": "Estás a seguir este utilizador"}


@community_router.get("/profiles/{user_id}/followers")
async def get_followers(user_id: str, limit: int = Query(50, le=100)):
    """List followers of a user."""
    db = _db_holder.db
    docs = await db.follows.find(
        {"following_id": user_id}, {"_id": 0, "follower_id": 1, "created_at": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"followers": docs, "total": len(docs)}


@community_router.get("/profiles/{user_id}/following")
async def get_following(user_id: str, limit: int = Query(50, le=100)):
    """List users that a user is following."""
    db = _db_holder.db
    docs = await db.follows.find(
        {"follower_id": user_id}, {"_id": 0, "following_id": 1, "created_at": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"following": docs, "total": len(docs)}


@community_router.get("/feed/following")
async def get_following_feed(
    current_user: User = Depends(lambda r: _require_auth(r)),
    limit: int = Query(20, le=50),
    skip: int = 0,
):
    """Activity feed of contributions from users the current user follows."""
    db = _db_holder.db
    following_docs = await db.follows.find(
        {"follower_id": current_user.user_id}, {"_id": 0, "following_id": 1}
    ).to_list(500)
    following_ids = [d["following_id"] for d in following_docs]
    if not following_ids:
        return {"items": [], "total": 0}

    skip, limit = clamp_pagination(skip, limit)
    items = await db.contributions.find(
        {"user_id": {"$in": following_ids}, "status": "approved"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.contributions.count_documents(
        {"user_id": {"$in": following_ids}, "status": "approved"}
    )
    return {"items": [Contribution(**c) for c in items], "total": total}
