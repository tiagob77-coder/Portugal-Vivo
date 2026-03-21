"""
Favorites API - Dedicated favorites collection (P1-5).

Storage: dedicated `favorites` collection with {user_id, poi_id, created_at}
instead of embedding an array in the users document.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from shared_utils import DatabaseHolder
from models.api_models import HeritageItem, User

import logging
logger = logging.getLogger(__name__)

favorites_router = APIRouter(tags=["Auth"])

_db_holder = DatabaseHolder("favorites")
set_favorites_db = _db_holder.set

_require_auth = None


def set_favorites_auth(auth_fn):
    global _require_auth
    _require_auth = auth_fn


class FavoriteEntry(BaseModel):
    id: str
    user_id: str
    poi_id: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Favorites endpoints (dedicated collection)
# ---------------------------------------------------------------------------

@favorites_router.get("/favorites", response_model=List[HeritageItem], tags=["Auth"])
async def get_favorites(current_user: User = Depends(lambda r: _require_auth(r))):
    """Get user's favorite POIs from the dedicated favorites collection."""
    fav_docs = await _db_holder.db.favorites.find(
        {"user_id": current_user.user_id},
        {"_id": 0, "poi_id": 1}
    ).to_list(200)
    poi_ids = [f["poi_id"] for f in fav_docs]
    if not poi_ids:
        return []
    items = await _db_holder.db.heritage_items.find(
        {"id": {"$in": poi_ids}},
        {"_id": 0}
    ).to_list(200)
    return [HeritageItem(**item) for item in items]


@favorites_router.get("/favorites/ids", tags=["Auth"])
async def get_favorite_ids(current_user: User = Depends(lambda r: _require_auth(r))):
    """Return only the list of favorited POI IDs (lightweight for UI state)."""
    fav_docs = await _db_holder.db.favorites.find(
        {"user_id": current_user.user_id},
        {"_id": 0, "poi_id": 1, "created_at": 1}
    ).to_list(200)
    return [{"poi_id": f["poi_id"], "created_at": f["created_at"]} for f in fav_docs]


@favorites_router.post("/favorites/{item_id}", tags=["Auth"])
async def add_favorite(item_id: str, current_user: User = Depends(lambda r: _require_auth(r))):
    """Add a POI to favorites (idempotent)."""
    existing = await _db_holder.db.favorites.find_one(
        {"user_id": current_user.user_id, "poi_id": item_id}
    )
    if existing:
        return {"message": "Already in favorites"}
    try:
        await _db_holder.db.favorites.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user.user_id,
            "poi_id": item_id,
            "created_at": datetime.now(timezone.utc),
        })
    except Exception as e:
        logger.error("Failed to add favorite: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao adicionar favorito")
    return {"message": "Added to favorites"}


@favorites_router.delete("/favorites/{item_id}", tags=["Auth"])
async def remove_favorite(item_id: str, current_user: User = Depends(lambda r: _require_auth(r))):
    """Remove a POI from favorites."""
    try:
        await _db_holder.db.favorites.delete_one(
            {"user_id": current_user.user_id, "poi_id": item_id}
        )
    except Exception as e:
        logger.error("Failed to remove favorite: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao remover favorito")
    return {"message": "Removed from favorites"}
