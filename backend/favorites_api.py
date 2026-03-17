"""
Favorites API - User favorites management.
Extracted from server.py.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List

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


@favorites_router.get("/favorites", response_model=List[HeritageItem], tags=["Auth"])
async def get_favorites(current_user: User = Depends(lambda r: _require_auth(r))):
    """Get user's favorite items"""
    items = await _db_holder.db.heritage_items.find(
        {"id": {"$in": current_user.favorites}},
        {"_id": 0}
    ).to_list(100)
    return [HeritageItem(**item) for item in items]


@favorites_router.post("/favorites/{item_id}")
async def add_favorite(item_id: str, current_user: User = Depends(lambda r: _require_auth(r))):
    """Add item to favorites"""
    try:
        await _db_holder.db.users.update_one(
            {"user_id": current_user.user_id},
            {"$addToSet": {"favorites": item_id}}
        )
    except Exception as e:
        logger.error("Failed to add favorite: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao adicionar favorito")
    return {"message": "Added to favorites"}


@favorites_router.delete("/favorites/{item_id}")
async def remove_favorite(item_id: str, current_user: User = Depends(lambda r: _require_auth(r))):
    """Remove item from favorites"""
    try:
        await _db_holder.db.users.update_one(
            {"user_id": current_user.user_id},
            {"$pull": {"favorites": item_id}}
        )
    except Exception as e:
        logger.error("Failed to remove favorite: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao remover favorito")
    return {"message": "Removed from favorites"}
