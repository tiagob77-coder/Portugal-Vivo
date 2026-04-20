"""
Gamification Progress API - Gamification progress tracking, visit recording,
route completion, and universe badge system.
Extracted from server.py.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone
import logging

from models.api_models import User
from auth_api import require_auth
from shared_constants import GAMIFICATION_BADGES, UNIVERSE_BADGES, ENCYCLOPEDIA_UNIVERSES

logger = logging.getLogger(__name__)

gamification_progress_router = APIRouter(tags=["Gamification"])

_db = None


def set_gamification_progress_db(database):
    global _db
    _db = database


class UserProgress(BaseModel):
    user_id: str
    visits: List[str] = []  # Heritage item IDs visited
    routes_completed: List[str] = []
    contributions_approved: int = 0
    badges_earned: List[str] = []
    total_points: int = 0
    level: int = 1
    created_at: datetime
    updated_at: datetime


@gamification_progress_router.get("/gamification/progress", tags=["Gamification"])
async def get_gamification_progress(current_user: User = Depends(require_auth)):
    """Get user's gamification progress"""
    progress = await _db.user_progress.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0}
    )

    if not progress:
        # Create initial progress
        progress = {
            "user_id": current_user.user_id,
            "visits": [],
            "routes_completed": [],
            "contributions_approved": 0,
            "badges_earned": [],
            "total_points": 0,
            "level": 1,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        try:
            await _db.user_progress.insert_one(progress)
        except Exception as e:
            logger.error("Failed to create user progress: %s", e)
            raise HTTPException(status_code=500, detail="Erro ao criar progresso")

    # Calculate badges
    earned_badges = []
    favorites_count = len(current_user.favorites)
    visits_count = len(progress.get("visits", []))

    for badge in GAMIFICATION_BADGES:
        badge_id = badge["id"]
        if badge_id in progress.get("badges_earned", []):
            earned_badges.append({**badge, "earned": True, "progress": 100})
            continue

        # Calculate progress for each badge type
        current_progress = 0
        badge_type = badge.get("type", "")
        threshold = badge.get("threshold", 1)
        if badge_type == "checkins":
            current_progress = visits_count
        elif badge_type == "region":
            region = badge.get("region", "")
            items_in_region = await _db.heritage_items.find(
                {"id": {"$in": progress.get("visits", [])}, "region": region}
            ).to_list(100)
            current_progress = len(items_in_region)
        elif badge_type == "category":
            category = badge.get("category", "")
            items_in_cat = await _db.heritage_items.find(
                {"id": {"$in": progress.get("visits", [])}, "category": category}
            ).to_list(100)
            current_progress = len(items_in_cat)

        progress_percent = min(100, int((current_progress / threshold) * 100)) if threshold else 0
        earned_badges.append({
            **badge,
            "earned": current_progress >= threshold,
            "progress": progress_percent,
            "current": current_progress
        })

    return {
        "user_id": current_user.user_id,
        "visits_count": visits_count,
        "favorites_count": favorites_count,
        "routes_completed": len(progress.get("routes_completed", [])),
        "contributions_approved": progress.get("contributions_approved", 0),
        "total_points": progress.get("total_points", 0),
        "level": progress.get("level", 1),
        "badges": earned_badges
    }


@gamification_progress_router.post("/gamification/visit/{item_id}")
async def record_gamification_visit(item_id: str, current_user: User = Depends(require_auth)):
    """Record a visit to a heritage item"""
    # Verify item exists
    item = await _db.heritage_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Update user progress
    try:
        await _db.user_progress.update_one(
            {"user_id": current_user.user_id},
            {
                "$addToSet": {"visits": item_id},
                "$inc": {"total_points": 10},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            },
            upsert=True
        )
    except Exception as e:
        logger.error("Failed to record gamification visit: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao registar visita")

    return {"message": "Visit recorded", "points_earned": 10}


@gamification_progress_router.post("/gamification/complete-route/{route_id}")
async def complete_route(route_id: str, current_user: User = Depends(require_auth)):
    """Mark a route as completed"""
    route = await _db.routes.find_one({"id": route_id})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    try:
        await _db.user_progress.update_one(
            {"user_id": current_user.user_id},
            {
                "$addToSet": {"routes_completed": route_id},
                "$inc": {"total_points": 50},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            },
            upsert=True
        )
    except Exception as e:
        logger.error("Failed to complete route: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao completar rota")

    return {"message": "Route completed", "points_earned": 50}


# ========================
# BADGES / GAMIFICATION (Universe badge system)
# ========================

@gamification_progress_router.get("/badges", tags=["Gamification"])
async def get_all_badges():
    """Get all available badges and their tiers"""
    return UNIVERSE_BADGES


@gamification_progress_router.get("/badges/user")
async def get_user_badges(current_user: User = Depends(require_auth)):
    """Get current user's earned badges"""
    user_badges = await _db.user_badges.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(100)

    # Calculate total points
    total_points = sum(badge.get("points_earned", 0) for badge in user_badges)

    # Get badge details
    badges_with_details = []
    for user_badge in user_badges:
        badge_def = next((b for b in UNIVERSE_BADGES if b["id"] == user_badge["badge_id"]), None)
        if badge_def:
            badges_with_details.append({
                **user_badge,
                "badge_info": badge_def
            })

    return {
        "badges": badges_with_details,
        "total_points": total_points,
        "badges_count": len(user_badges)
    }


@gamification_progress_router.get("/badges/progress")
async def get_badges_progress(current_user: User = Depends(require_auth)):
    """Get user's progress towards all badges"""
    # Get user's visited items
    user_progress = await _db.user_progress.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0}
    )

    visited_items = user_progress.get("visited_pois", []) if user_progress else []
    visited_ids = [v.get("poi_id") for v in visited_items]

    # Get items by category for universe badges
    items_by_universe = {}
    if visited_ids:
        visited_heritage = await _db.heritage_items.find(
            {"id": {"$in": visited_ids}},
            {"_id": 0, "category": 1, "region": 1}
        ).to_list(1000)

        # Map categories to universes
        for item in visited_heritage:
            category = item.get("category")
            for universe in ENCYCLOPEDIA_UNIVERSES:
                if category in universe["categories"]:
                    if universe["id"] not in items_by_universe:
                        items_by_universe[universe["id"]] = []
                    items_by_universe[universe["id"]].append(item)
                    break

    # Get regions visited
    regions_visited = set()
    if visited_ids:
        for item in visited_heritage:
            if item.get("region"):
                regions_visited.add(item["region"])

    # Get user's current badges
    user_badges = await _db.user_badges.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(100)
    user_badge_map = {b["badge_id"]: b for b in user_badges}

    # Calculate progress for each badge
    badge_progress = []
    for badge in UNIVERSE_BADGES:
        current_badge = user_badge_map.get(badge["id"])

        # Calculate visits based on badge type
        if badge["universe"]:
            visits = len(items_by_universe.get(badge["universe"], []))
        elif badge["id"] == "coleccionador":
            visits = len(visited_ids)
        elif badge["id"] == "primeiro_passo":
            visits = min(1, len(visited_ids))
        elif badge["id"] == "explorador_regioes":
            visits = len(regions_visited)
        else:
            visits = len(visited_ids)

        # Find current tier and next tier
        current_tier = None
        next_tier = None
        for tier in badge["tiers"]:
            if visits >= tier["visits"]:
                current_tier = tier
            elif next_tier is None:
                next_tier = tier

        badge_progress.append({
            "badge": badge,
            "visits": visits,
            "current_tier": current_tier,
            "next_tier": next_tier,
            "unlocked": current_badge is not None,
            "user_badge": current_badge
        })

    return {
        "progress": badge_progress,
        "total_visits": len(visited_ids),
        "regions_visited": len(regions_visited)
    }


@gamification_progress_router.post("/badges/check")
async def check_and_award_badges(current_user: User = Depends(require_auth)):
    """Check and award any new badges the user has earned"""
    # Get progress
    progress_response = await get_badges_progress(current_user)
    progress_list = progress_response["progress"]

    newly_awarded = []

    for prog in progress_list:
        badge = prog["badge"]
        current_tier = prog["current_tier"]
        user_badge = prog["user_badge"]

        if current_tier and not user_badge:
            # User earned a new badge
            new_badge = {
                "user_id": current_user.user_id,
                "badge_id": badge["id"],
                "level": current_tier["level"],
                "unlocked_at": datetime.now(timezone.utc),
                "visits_count": prog["visits"],
                "points_earned": current_tier["points"]
            }
            await _db.user_badges.insert_one(new_badge)
            new_badge.pop("_id", None)
            newly_awarded.append({
                **new_badge,
                "badge_info": badge
            })
        elif current_tier and user_badge:
            # Check for tier upgrade
            current_level_index = next(
                (i for i, t in enumerate(badge["tiers"]) if t["level"] == user_badge["level"]),
                -1
            )
            new_level_index = next(
                (i for i, t in enumerate(badge["tiers"]) if t["level"] == current_tier["level"]),
                -1
            )

            if new_level_index > current_level_index:
                # Upgrade badge
                points_diff = current_tier["points"] - user_badge.get("points_earned", 0)
                await _db.user_badges.update_one(
                    {"user_id": current_user.user_id, "badge_id": badge["id"]},
                    {"$set": {
                        "level": current_tier["level"],
                        "visits_count": prog["visits"],
                        "points_earned": current_tier["points"],
                        "upgraded_at": datetime.now(timezone.utc)
                    }}
                )
                newly_awarded.append({
                    "badge_id": badge["id"],
                    "level": current_tier["level"],
                    "visits_count": prog["visits"],
                    "points_earned": current_tier["points"],
                    "badge_info": badge,
                    "upgraded": True
                })

    return {
        "newly_awarded": newly_awarded,
        "total_new": len(newly_awarded)
    }
