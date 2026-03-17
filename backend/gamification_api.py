"""
Gamificação - Check-in & Badges System
Sistema de check-in por proximidade GPS com badges e progressão.
"""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from shared_constants import GAMIFICATION_BADGES
from shared_utils import haversine_meters, DatabaseHolder

gamification_router = APIRouter(prefix="/gamification", tags=["Gamificação"])

_db_holder = DatabaseHolder("gamification")
set_gamification_db = _db_holder.set
_get_db = _db_holder.get




CHECK_IN_RADIUS_METERS = 500  # 500m proximity radius


class CheckInRequest(BaseModel):
    user_lat: float
    user_lng: float
    poi_id: str
    user_id: Optional[str] = None


@gamification_router.get("/badges")
async def get_all_badges():
    """Get all available badges with descriptions"""
    return {"badges": GAMIFICATION_BADGES, "total": len(GAMIFICATION_BADGES)}


@gamification_router.get("/profile/{user_id}")
async def get_gamification_profile(user_id: str):
    """Get user's gamification profile with check-ins, badges, and stats"""
    db = _get_db()

    profile = await db.gamification_profiles.find_one(
        {"user_id": user_id}, {"_id": 0}
    )

    if not profile:
        profile = {
            "user_id": user_id,
            "total_checkins": 0,
            "earned_badges": [],
            "region_counts": {},
            "category_counts": {},
            "level": 1,
            "xp": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.gamification_profiles.insert_one({**profile})

    # Calculate level from XP
    xp = profile.get("xp", 0)
    level = 1 + xp // 100  # 100 XP per level

    # Get recent check-ins
    recent = await db.checkins.find(
        {"user_id": user_id},
        {"_id": 0, "poi_id": 1, "poi_name": 1, "poi_category": 1, "poi_region": 1, "checked_in_at": 1, "xp_earned": 1}
    ).sort("checked_in_at", -1).limit(10).to_list(length=10)

    for r in recent:
        if r.get("checked_in_at") and hasattr(r["checked_in_at"], 'isoformat'):
            r["checked_in_at"] = r["checked_in_at"].isoformat()

    # Check which badges are earned
    earned_ids = set(profile.get("earned_badges", []))
    badges_status = []
    for badge in GAMIFICATION_BADGES:
        earned = badge["id"] in earned_ids
        progress = 0

        if badge["type"] == "checkins":
            progress = min(profile.get("total_checkins", 0), badge["threshold"])
        elif badge["type"] == "region":
            progress = min(profile.get("region_counts", {}).get(badge.get("region", ""), 0), badge["threshold"])
        elif badge["type"] == "category":
            progress = min(profile.get("category_counts", {}).get(badge.get("category", ""), 0), badge["threshold"])

        badges_status.append({
            **badge,
            "earned": earned,
            "progress": progress,
            "progress_pct": min(round(100 * progress / badge["threshold"]), 100) if badge["threshold"] > 0 else 0,
        })

    return {
        "user_id": user_id,
        "total_checkins": profile.get("total_checkins", 0),
        "level": level,
        "xp": xp,
        "xp_to_next_level": 100 - (xp % 100),
        "earned_badges_count": len(earned_ids),
        "total_badges": len(GAMIFICATION_BADGES),
        "badges": badges_status,
        "recent_checkins": recent,
        "region_counts": profile.get("region_counts", {}),
        "category_counts": profile.get("category_counts", {}),
    }


@gamification_router.post("/checkin")
async def do_checkin(req: CheckInRequest):
    """Check in to a POI by proximity (within 500m)"""
    db = _get_db()

    # Get POI
    poi = await db.heritage_items.find_one(
        {"id": req.poi_id},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "location": 1, "iq_score": 1}
    )
    if not poi:
        raise HTTPException(404, "POI não encontrado")

    poi_loc = poi.get("location", {})
    if not poi_loc or not poi_loc.get("lat"):
        raise HTTPException(400, "Este POI não tem coordenadas GPS")

    # Check proximity
    distance = haversine_meters(req.user_lat, req.user_lng, poi_loc["lat"], poi_loc["lng"])
    if distance > CHECK_IN_RADIUS_METERS:
        return {
            "success": False,
            "message": f"Está a {int(distance)}m do POI. Precisa estar a menos de {CHECK_IN_RADIUS_METERS}m.",
            "distance_m": int(distance),
            "required_m": CHECK_IN_RADIUS_METERS,
        }

    user_id = req.user_id or f"anon_{uuid.uuid4().hex[:8]}"

    # Check for duplicate check-in today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    existing = await db.checkins.find_one({
        "user_id": user_id,
        "poi_id": req.poi_id,
        "checked_in_at": {"$gte": today_start}
    })
    if existing:
        return {
            "success": False,
            "message": "Já fez check-in neste local hoje!",
            "distance_m": int(distance),
        }

    # Calculate XP based on IQ score and rarity
    base_xp = 10
    iq_bonus = int((poi.get("iq_score", 0) or 0) / 10)
    xp_earned = base_xp + iq_bonus

    # Create check-in record
    checkin = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "poi_id": req.poi_id,
        "poi_name": poi["name"],
        "poi_category": poi.get("category", ""),
        "poi_region": poi.get("region", ""),
        "user_lat": req.user_lat,
        "user_lng": req.user_lng,
        "distance_m": int(distance),
        "xp_earned": xp_earned,
        "checked_in_at": datetime.now(timezone.utc),
    }
    await db.checkins.insert_one(checkin)

    # Update profile
    category = poi.get("category", "outros")
    region = poi.get("region", "portugal")

    await db.gamification_profiles.update_one(
        {"user_id": user_id},
        {
            "$inc": {
                "total_checkins": 1,
                "xp": xp_earned,
                f"region_counts.{region}": 1,
                f"category_counts.{category}": 1,
            },
            "$setOnInsert": {
                "user_id": user_id,
                "earned_badges": [],
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True
    )

    # Check for new badges
    profile = await db.gamification_profiles.find_one({"user_id": user_id}, {"_id": 0})
    new_badges = []
    earned_set = set(profile.get("earned_badges", []))

    for badge in GAMIFICATION_BADGES:
        if badge["id"] in earned_set:
            continue

        earned = False
        if badge["type"] == "checkins" and profile.get("total_checkins", 0) >= badge["threshold"]:
            earned = True
        elif badge["type"] == "region" and profile.get("region_counts", {}).get(badge.get("region", ""), 0) >= badge["threshold"]:
            earned = True
        elif badge["type"] == "category" and profile.get("category_counts", {}).get(badge.get("category", ""), 0) >= badge["threshold"]:
            earned = True

        if earned:
            new_badges.append(badge)
            earned_set.add(badge["id"])

    if new_badges:
        await db.gamification_profiles.update_one(
            {"user_id": user_id},
            {"$set": {"earned_badges": list(earned_set)}}
        )

    return {
        "success": True,
        "message": f"Check-in em {poi['name']}!",
        "poi_name": poi["name"],
        "distance_m": int(distance),
        "xp_earned": xp_earned,
        "new_badges": [{"id": b["id"], "name": b["name"], "icon": b["icon"], "color": b["color"]} for b in new_badges],
        "total_checkins": profile.get("total_checkins", 0) + 1,
    }


@gamification_router.get("/leaderboard")
async def get_leaderboard(limit: int = 10):
    """Get top users by XP"""
    from shared_utils import clamp_pagination
    _, limit = clamp_pagination(0, limit, max_limit=100)
    db = _get_db()
    top = await db.gamification_profiles.find(
        {}, {"_id": 0, "user_id": 1, "total_checkins": 1, "xp": 1, "earned_badges": 1}
    ).sort("xp", -1).limit(limit).to_list(length=limit)

    return {
        "leaderboard": [
            {
                "rank": i + 1,
                "user_id": u["user_id"],
                "total_checkins": u.get("total_checkins", 0),
                "xp": u.get("xp", 0),
                "level": 1 + u.get("xp", 0) // 100,
                "badges_count": len(u.get("earned_badges", [])),
            }
            for i, u in enumerate(top)
        ]
    }


@gamification_router.get("/nearby-checkins")
async def get_nearby_checkable_pois(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5, ge=0.1, le=50),
    limit: int = Query(20, ge=1, le=100),
):
    """Get POIs near user that can be checked in"""
    db = _get_db()

    pois = await db.heritage_items.find(
        {"location.lat": {"$exists": True}},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "location": 1, "iq_score": 1, "address": 1}
    ).limit(5000).to_list(length=5000)

    nearby = []
    for p in pois:
        loc = p.get("location", {})
        if not loc.get("lat"):
            continue
        dist = haversine_meters(lat, lng, loc["lat"], loc["lng"])
        if dist <= radius_km * 1000:
            nearby.append({
                "id": p["id"],
                "name": p["name"],
                "category": p.get("category", ""),
                "region": p.get("region", ""),
                "distance_m": int(dist),
                "iq_score": p.get("iq_score", 0),
                "location": loc,
                "can_checkin": dist <= CHECK_IN_RADIUS_METERS,
            })

    nearby.sort(key=lambda x: x["distance_m"])
    return {"pois": nearby[:limit], "total_nearby": len(nearby)}
