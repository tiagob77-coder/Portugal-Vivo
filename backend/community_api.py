"""
Community API - Community contributions management.
Extracted from server.py.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging

from shared_utils import DatabaseHolder, clamp_pagination
from models.api_models import User, Location

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
    """Vote for a contribution"""
    try:
        result = await _db_holder.db.contributions.update_one(
            {"id": contribution_id},
            {"$inc": {"votes": 1}}
        )
    except Exception as e:
        logger.error("Failed to vote on contribution: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao registar voto")
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Contribution not found")
    return {"message": "Vote recorded"}
