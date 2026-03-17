"""
Dashboard Inline API - Dashboard visit tracking, progress, badges, statistics,
history, and leaderboard endpoints.
Extracted from server.py.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone
import uuid
import logging

from models.api_models import User
from auth_api import require_auth
from shared_utils import clamp_pagination
from shared_constants import DASHBOARD_BADGES, LEVEL_DEFINITIONS

logger = logging.getLogger(__name__)

dashboard_inline_router = APIRouter()

_db = None
_redis_lb = None


def set_dashboard_inline_db(database):
    global _db
    _db = database


def set_dashboard_redis_lb(lb):
    global _redis_lb
    _redis_lb = lb


# Badge definitions - imported from shared_constants
BADGE_DEFINITIONS = DASHBOARD_BADGES


class Visit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    poi_id: str
    poi_name: str
    category: str
    region: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    points_earned: int = 10


class UserDashboardProgress(BaseModel):
    user_id: str
    total_points: int = 0
    total_visits: int = 0
    unique_pois: int = 0
    visits_by_category: Dict[str, int] = {}
    visits_by_region: Dict[str, int] = {}
    current_streak: int = 0
    longest_streak: int = 0
    last_visit_date: Optional[str] = None
    badges_earned: List[str] = []


@dashboard_inline_router.post("/dashboard/visit")
async def record_visit(poi_id: str, current_user: User = Depends(require_auth)):
    """Record a visit to a POI and update user progress"""
    # Get POI details
    poi = await _db.heritage_items.find_one({"id": poi_id}, {"_id": 0})
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")

    # Create visit record
    visit = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "poi_id": poi_id,
        "poi_name": poi["name"],
        "category": poi.get("category", "unknown"),
        "region": poi.get("region", "unknown"),
        "timestamp": datetime.now(timezone.utc),
        "points_earned": 10
    }

    try:
        await _db.visits.insert_one(visit)
    except Exception as e:
        logger.error("Failed to insert visit: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao registar visita")

    # Get or create user progress
    progress = await _db.user_progress.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not progress:
        progress = {
            "user_id": current_user.user_id,
            "total_points": 0,
            "total_visits": 0,
            "unique_pois": 0,
            "visits_by_category": {},
            "visits_by_region": {},
            "current_streak": 0,
            "longest_streak": 0,
            "last_visit_date": None,
            "badges_earned": []
        }

    # Update progress
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Check if this is a new POI
    existing_visit = await _db.visits.find_one({
        "user_id": current_user.user_id,
        "poi_id": poi_id,
        "id": {"$ne": visit["id"]}
    })

    is_new_poi = existing_visit is None
    points_earned = 10 if is_new_poi else 5  # Less points for repeat visits

    # Update streak
    last_visit_date = progress.get("last_visit_date")
    if last_visit_date:
        last_date = datetime.strptime(last_visit_date, "%Y-%m-%d")
        today_date = datetime.strptime(today, "%Y-%m-%d")
        days_diff = (today_date - last_date).days

        if days_diff == 1:
            progress["current_streak"] += 1
        elif days_diff > 1:
            progress["current_streak"] = 1
        # Same day - keep streak as is
    else:
        progress["current_streak"] = 1

    # Update streak with safe access
    longest_streak = progress.get("longest_streak", 0)
    progress["longest_streak"] = max(longest_streak, progress.get("current_streak", 1))
    progress["last_visit_date"] = today
    progress["total_visits"] = progress.get("total_visits", 0) + 1
    progress["total_points"] = progress.get("total_points", 0) + points_earned

    if is_new_poi:
        progress["unique_pois"] = progress.get("unique_pois", 0) + 1

    # Update category counts with safe access
    category = poi.get("category", "unknown")
    visits_by_category = progress.get("visits_by_category", {})
    visits_by_category[category] = visits_by_category.get(category, 0) + 1
    progress["visits_by_category"] = visits_by_category

    # Update region counts with safe access
    region = poi.get("region", "unknown")
    visits_by_region = progress.get("visits_by_region", {})
    visits_by_region[region] = visits_by_region.get(region, 0) + 1
    progress["visits_by_region"] = visits_by_region

    # Check for new badges with safe access
    new_badges = []
    badges_earned = progress.get("badges_earned", [])
    progress["badges_earned"] = badges_earned

    for badge in BADGE_DEFINITIONS:
        if badge["id"] in badges_earned:
            continue

        earned = False
        if badge["type"] == "visits":
            earned = progress.get("unique_pois", 0) >= badge["requirement"]
        elif badge["type"].startswith("category_"):
            cat = badge["type"].replace("category_", "")
            earned = progress.get("visits_by_category", {}).get(cat, 0) >= badge["requirement"]
        elif badge["type"] == "regions":
            earned = len(progress.get("visits_by_region", {})) >= badge["requirement"]
        elif badge["type"] == "streak":
            earned = progress.get("current_streak", 0) >= badge["requirement"]

        if earned:
            badges_earned.append(badge["id"])
            progress["total_points"] += badge["points"]
            new_badges.append(badge)

    # Save progress
    try:
        await _db.user_progress.update_one(
            {"user_id": current_user.user_id},
            {"$set": progress},
            upsert=True
        )
    except Exception as e:
        logger.error("Failed to update dashboard progress: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao atualizar progresso")

    # Update Redis leaderboard in real-time
    try:
        total_badge_pts = sum(b["points"] for b in new_badges)
        await _redis_lb.update_score(current_user.user_id, points_earned + total_badge_pts, region)
    except Exception:
        pass

    return {
        "visit_id": visit["id"],
        "points_earned": points_earned,
        "total_points": progress["total_points"],
        "new_badges": new_badges,
        "current_streak": progress["current_streak"]
    }


@dashboard_inline_router.get("/dashboard/progress")
async def get_user_progress(current_user: User = Depends(require_auth)):
    """Get user's dashboard progress"""
    progress = await _db.user_progress.find_one({"user_id": current_user.user_id}, {"_id": 0})

    if not progress:
        progress = {
            "user_id": current_user.user_id,
            "total_points": 0,
            "total_visits": 0,
            "unique_pois": 0,
            "visits_by_category": {},
            "visits_by_region": {},
            "current_streak": 0,
            "longest_streak": 0,
            "last_visit_date": None,
            "badges_earned": []
        }

    # Calculate level
    level_info = {"level": 1, "name": "Curioso", "icon": "emoji-objects"}
    next_level_points = 100

    for i, level in enumerate(LEVEL_DEFINITIONS):
        if progress["total_points"] >= level["min_points"]:
            level_info = level
            if i + 1 < len(LEVEL_DEFINITIONS):
                next_level_points = LEVEL_DEFINITIONS[i + 1]["min_points"]
            else:
                next_level_points = level["min_points"]

    # Calculate progress to next level
    current_level_points = level_info["min_points"]
    points_in_level = progress["total_points"] - current_level_points
    points_needed = next_level_points - current_level_points
    level_progress = min(100, int((points_in_level / points_needed) * 100)) if points_needed > 0 else 100

    return {
        **progress,
        "level": level_info["level"],
        "level_name": level_info["name"],
        "level_icon": level_info["icon"],
        "level_progress": level_progress,
        "points_to_next_level": max(0, next_level_points - progress["total_points"])
    }


@dashboard_inline_router.get("/dashboard/badges")
async def get_badges(current_user: User = Depends(require_auth)):
    """Get all badges with user's progress"""
    progress = await _db.user_progress.find_one({"user_id": current_user.user_id}, {"_id": 0})
    earned_badges = progress["badges_earned"] if progress else []

    badges = []
    for badge in BADGE_DEFINITIONS:
        badge_info = {**badge}
        badge_info["earned"] = badge["id"] in earned_badges

        # Calculate progress
        current = 0
        if badge["type"] == "visits":
            current = progress["unique_pois"] if progress else 0
        elif badge["type"].startswith("category_"):
            cat = badge["type"].replace("category_", "")
            current = progress["visits_by_category"].get(cat, 0) if progress else 0
        elif badge["type"] == "regions":
            current = len(progress["visits_by_region"]) if progress else 0
        elif badge["type"] == "streak":
            current = progress["current_streak"] if progress else 0

        badge_info["current"] = current
        badge_info["progress"] = min(100, int((current / badge["requirement"]) * 100))
        badges.append(badge_info)

    return badges


@dashboard_inline_router.get("/dashboard/statistics")
async def get_statistics(current_user: User = Depends(require_auth)):
    """Get detailed statistics for user dashboard"""
    progress = await _db.user_progress.find_one({"user_id": current_user.user_id}, {"_id": 0})

    if not progress:
        return {
            "total_visits": 0,
            "unique_pois": 0,
            "current_streak": 0,
            "longest_streak": 0,
            "badges_unlocked": 0,
            "total_badges": len(BADGE_DEFINITIONS),
            "top_categories": [],
            "top_regions": []
        }

    # Sort categories by count
    top_categories = sorted(
        [{"category": k, "count": v} for k, v in progress["visits_by_category"].items()],
        key=lambda x: x["count"],
        reverse=True
    )[:5]

    # Sort regions by count
    top_regions = sorted(
        [{"region": k, "count": v} for k, v in progress["visits_by_region"].items()],
        key=lambda x: x["count"],
        reverse=True
    )[:5]

    return {
        "total_visits": progress["total_visits"],
        "unique_pois": progress["unique_pois"],
        "current_streak": progress["current_streak"],
        "longest_streak": progress["longest_streak"],
        "badges_unlocked": len(progress["badges_earned"]),
        "total_badges": len(BADGE_DEFINITIONS),
        "top_categories": top_categories,
        "top_regions": top_regions
    }


@dashboard_inline_router.get("/dashboard/history")
async def get_visit_history(limit: int = 20, current_user: User = Depends(require_auth)):
    """Get user's visit history"""
    _, limit = clamp_pagination(0, limit, max_limit=100)
    visits = await _db.visits.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)

    return visits


@dashboard_inline_router.get("/dashboard/leaderboard")
async def get_leaderboard(limit: int = 10):
    """Get top users leaderboard"""
    _, limit = clamp_pagination(0, limit, max_limit=100)
    users = await _db.user_progress.find(
        {},
        {"_id": 0}
    ).sort("total_points", -1).limit(limit).to_list(limit)

    # Batch fetch all user docs in one query (avoids N+1)
    user_ids = [u.get("user_id") for u in users if u.get("user_id")]
    user_docs_list = await _db.users.find(
        {"user_id": {"$in": user_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
    ).to_list(len(user_ids))
    user_docs_map = {d["user_id"]: d for d in user_docs_list}

    leaderboard = []
    for i, user in enumerate(users):
        user_doc = user_docs_map.get(user.get("user_id"))

        # Calculate level
        level = 1
        total_points = user.get("total_points", 0)
        for lvl in LEVEL_DEFINITIONS:
            if total_points >= lvl["min_points"]:
                level = lvl["level"]

        leaderboard.append({
            "rank": i + 1,
            "user_id": user.get("user_id", "unknown"),
            "name": user_doc["name"] if user_doc else "Explorador",
            "picture": user_doc.get("picture") if user_doc else None,
            "total_points": total_points,
            "unique_pois": user.get("unique_pois", 0),
            "badges_count": len(user.get("badges_earned", [])),
            "level": level
        })

    return leaderboard
