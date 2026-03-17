"""
Preferences API - User preferences and onboarding endpoints.
Extracted from server.py.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone
import logging

from models.api_models import User
from auth_api import require_auth
from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

router = APIRouter()

_db_holder = DatabaseHolder("preferences")
set_preferences_db = _db_holder.set


class UserPreferencesUpdate(BaseModel):
    traveler_profiles: Optional[Dict[str, float]] = None
    favorite_themes: Optional[List[str]] = None
    favorite_regions: Optional[List[str]] = None
    preferred_pace: Optional[str] = None
    budget_level: Optional[str] = None
    has_car: Optional[bool] = None
    preferred_transport: Optional[List[str]] = None
    typical_group_size: Optional[int] = None
    traveling_with_children: Optional[bool] = None
    interests: Optional[List[str]] = None
    notifications_enabled: Optional[bool] = None
    geofence_alerts: Optional[bool] = None

@router.get("/preferences")
async def get_user_preferences(current_user: User = Depends(require_auth)):
    """Get user preferences"""
    db = _db_holder.db
    prefs = await db.user_preferences.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0}
    )

    if not prefs:
        # Create default preferences
        prefs = {
            "user_id": current_user.user_id,
            "traveler_profiles": {},
            "favorite_themes": [],
            "favorite_regions": [],
            "preferred_pace": "moderate",
            "budget_level": "medium",
            "has_car": True,
            "preferred_transport": ["car", "train"],
            "typical_group_size": 2,
            "traveling_with_children": False,
            "interests": [],
            "notifications_enabled": True,
            "geofence_alerts": True,
            "onboarding_completed": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.user_preferences.insert_one(prefs)

    return prefs

@router.put("/preferences")
async def update_user_preferences(
    updates: UserPreferencesUpdate,
    current_user: User = Depends(require_auth)
):
    """Update user preferences"""
    db = _db_holder.db
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)

    await db.user_preferences.update_one(
        {"user_id": current_user.user_id},
        {"$set": update_data},
        upsert=True
    )

    return {"message": "Preferences updated", "updated_fields": list(update_data.keys())}

@router.post("/preferences/onboarding")
async def complete_onboarding(
    traveler_profiles: Dict[str, float],
    favorite_regions: List[str],
    interests: List[str],
    current_user: User = Depends(require_auth)
):
    """Complete onboarding with initial preferences"""
    db = _db_holder.db
    await db.user_preferences.update_one(
        {"user_id": current_user.user_id},
        {
            "$set": {
                "traveler_profiles": traveler_profiles,
                "favorite_regions": favorite_regions,
                "interests": interests,
                "onboarding_completed": True,
                "updated_at": datetime.now(timezone.utc)
            }
        },
        upsert=True
    )

    return {"message": "Onboarding completed", "personalization_enabled": True}
