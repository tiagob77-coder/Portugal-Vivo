"""
Premium Feature Guard — FastAPI dependency for protecting premium-only routes.

Usage:
    from premium_guard import require_premium, require_feature

    @router.get("/some-premium-endpoint")
    async def endpoint(user: User = Depends(require_premium)):
        ...

    @router.get("/audio-guide")
    async def audio(user: User = Depends(require_feature("audio_guides"))):
        ...
"""
import logging
from fastapi import Depends, HTTPException, status
from auth_api import require_auth
from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

_db_holder = DatabaseHolder("premium_guard")
set_premium_guard_db = _db_holder.set

# Feature IDs that require a premium subscription
PREMIUM_FEATURE_IDS = {
    "ai_itinerary", "audio_guides", "offline", "epochs",
    "collections", "custom_routes", "export", "early_access",
}

# Tier hierarchy: higher index = more access
TIER_HIERARCHY = {"free": 0, "premium": 1, "annual": 2}


async def _get_user_tier(user_id: str) -> str:
    """Look up the user's active subscription tier."""
    db = _db_holder.db
    if db is None:
        # Guard not initialised — allow through (dev mode)
        return "premium"
    sub = await db.subscriptions.find_one(
        {"user_id": user_id, "status": "active"},
        {"_id": 0, "tier": 1},
    )
    return sub.get("tier", "free") if sub else "free"


async def require_premium(current_user=Depends(require_auth)):
    """Dependency that rejects free-tier users."""
    tier = await _get_user_tier(current_user.user_id)
    if TIER_HIERARCHY.get(tier, 0) < TIER_HIERARCHY["premium"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta funcionalidade requer uma subscrição Premium. "
                   "Visite /premium/tiers para mais informações.",
        )
    return current_user


def require_feature(feature_id: str):
    """Factory that returns a dependency checking access to a specific feature."""

    async def _guard(current_user=Depends(require_auth)):
        if feature_id not in PREMIUM_FEATURE_IDS:
            # Feature is free for everyone
            return current_user

        tier = await _get_user_tier(current_user.user_id)
        if TIER_HIERARCHY.get(tier, 0) < TIER_HIERARCHY["premium"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"A funcionalidade '{feature_id}' requer subscrição Premium.",
            )
        return current_user

    return _guard
