"""
Leaderboard API - Redis-powered rankings with period filters and region breakdowns.
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from services.redis_leaderboard import redis_lb
import logging

logger = logging.getLogger("leaderboard_api")

from shared_utils import DatabaseHolder

leaderboard_router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])
_db_holder = DatabaseHolder("leaderboard")
set_db = _db_holder.set


@leaderboard_router.get("/top")
async def get_top_explorers(
    period: str = "all",
    region: str = "",
    limit: int = 20,
):
    """Get top explorers from Redis sorted sets."""
    from shared_utils import clamp_pagination
    _, limit = clamp_pagination(0, limit, max_limit=100)
    valid_periods = ("all", "week", "month")
    if period not in valid_periods:
        raise HTTPException(400, f"Invalid period. Must be one of: {', '.join(valid_periods)}")
    if region:
        entries = await redis_lb.get_region_top(region, limit)
    else:
        entries = await redis_lb.get_top(period, limit)

    enriched = await redis_lb.enrich_entries(entries)
    total_players = await redis_lb.get_total_players(period)

    return {
        "leaderboard": enriched,
        "total": total_players,
        "period": period,
        "region": region,
    }


@leaderboard_router.get("/me")
async def get_my_rank(user_id: str, period: str = "all"):
    """Get current user's rank across periods."""
    all_rank = await redis_lb.get_user_rank(user_id, "all")
    week_rank = await redis_lb.get_user_rank(user_id, "week")
    month_rank = await redis_lb.get_user_rank(user_id, "month")

    return {
        "user_id": user_id,
        "all": all_rank,
        "week": week_rank,
        "month": month_rank,
    }


@leaderboard_router.get("/explorer/{user_id}")
async def get_explorer_profile(user_id: str):
    """Get detailed public explorer profile (MongoDB for rich data)."""
    profile = await _db_holder.db.gamification_profiles.find_one(
        {"user_id": user_id}, {"_id": 0}
    )
    user = await _db_holder.db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "picture": 1})
    progress = await _db_holder.db.user_progress.find_one({"user_id": user_id}, {"_id": 0, "total_points": 1, "badges_earned": 1, "level": 1})

    if not profile and not progress:
        return {
            "user_id": user_id,
            "name": "Explorador",
            "level": 1,
            "xp": 0,
            "total_checkins": 0,
            "badges": [],
            "region_stats": [],
            "recent_checkins": [],
            "rank": 0,
        }

    xp = (profile or {}).get("xp", 0)
    total_points = (progress or {}).get("total_points", 0)
    score = max(xp, total_points)
    level = max(1, score // 100 + 1)
    next_level_xp = level * 100

    region_counts = (profile or {}).get("region_counts", {})
    region_colors = {
        "norte": "#059669", "centro": "#D97706", "lisboa": "#DC2626",
        "alentejo": "#CA8A04", "algarve": "#0EA5E9", "acores": "#7C3AED",
        "madeira": "#EC4899",
    }
    region_stats = [
        {"region": r, "count": c, "color": region_colors.get(r.lower(), "#64748B")}
        for r, c in sorted(region_counts.items(), key=lambda x: -x[1])
    ]

    category_counts = (profile or {}).get("category_counts", {})
    category_stats = [
        {"category": c, "count": cnt}
        for c, cnt in sorted(category_counts.items(), key=lambda x: -x[1])
    ][:8]

    recent = (profile or {}).get("recent_checkins", [])[-10:]
    recent.reverse()

    rank_info = await redis_lb.get_user_rank(user_id, "all")

    badges_earned = (progress or {}).get("badges_earned", []) or (profile or {}).get("earned_badges", [])

    return {
        "user_id": user_id,
        "name": (user or {}).get("name", (profile or {}).get("display_name", "Explorador")),
        "picture": (user or {}).get("picture"),
        "level": level,
        "xp": score,
        "xp_to_next_level": next_level_xp - score,
        "next_level_xp": next_level_xp,
        "total_checkins": (profile or {}).get("total_checkins", 0),
        "badges": badges_earned,
        "badges_count": len(badges_earned),
        "region_stats": region_stats,
        "category_stats": category_stats,
        "recent_checkins": recent,
        "streak_days": (profile or {}).get("streak_days", 0),
        "member_since": (profile or {}).get("created_at", ""),
        "rank": rank_info["rank"],
    }


@leaderboard_router.get("/stats")
async def get_leaderboard_stats():
    """Get overall leaderboard statistics."""
    total_players = await redis_lb.get_total_players("all")
    top3 = await redis_lb.get_top("all", 3)
    top3_enriched = await redis_lb.enrich_entries(top3)

    # Aggregate stats from MongoDB
    pipeline = [
        {"$group": {
            "_id": None,
            "total_checkins": {"$sum": "$total_checkins"},
            "total_xp": {"$sum": "$xp"},
        }}
    ]
    result = await _db_holder.db.gamification_profiles.aggregate(pipeline).to_list(1)
    stats = result[0] if result else {}

    # Top regions
    region_pipeline = [
        {"$project": {"region_counts": {"$objectToArray": "$region_counts"}}},
        {"$unwind": "$region_counts"},
        {"$group": {"_id": "$region_counts.k", "total": {"$sum": "$region_counts.v"}}},
        {"$sort": {"total": -1}},
        {"$limit": 7},
    ]
    top_regions = await _db_holder.db.gamification_profiles.aggregate(region_pipeline).to_list(7)

    return {
        "total_explorers": total_players,
        "total_checkins": stats.get("total_checkins", 0),
        "total_xp": stats.get("total_xp", 0),
        "top3": top3_enriched,
        "top_regions": [{"region": r["_id"], "count": r["total"]} for r in top_regions],
    }


@leaderboard_router.post("/sync")
async def sync_leaderboard():
    """Manually trigger a full sync from MongoDB to Redis."""
    count = await redis_lb.sync_from_mongo()
    return {"synced": count, "timestamp": datetime.now(timezone.utc).isoformat()}


@leaderboard_router.get("/regions")
async def get_available_regions():
    """Return regions with player counts."""
    regions = ["norte", "centro", "lisboa", "alentejo", "algarve", "acores", "madeira"]
    result = []
    for r in regions:
        count = await redis_lb.redis.zcard(f"lb:region:{r}")
        result.append({"region": r, "players": count})
    return result
