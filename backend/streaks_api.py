"""
Streaks & Active Gamification API
Manages daily streaks, weekly challenges, and active gamification features.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
import logging

from shared_utils import DatabaseHolder
from models.api_models import User

logger = logging.getLogger(__name__)

streaks_router = APIRouter(prefix="/gamification/streaks", tags=["Gamificação"])

_db_holder = DatabaseHolder("streaks")
set_streaks_db = _db_holder.set
_get_db = _db_holder.get

_require_auth = None


def set_streaks_auth(auth_fn):
    global _require_auth
    _require_auth = auth_fn


async def _auth_dep(request: Request) -> User:
    return await _require_auth(request)


class StreakResponse(BaseModel):
    user_id: str
    current_streak: int
    longest_streak: int
    last_activity_date: Optional[str]
    streak_alive: bool
    hours_remaining: float
    weekly_visits: int
    weekly_goal: int
    weekly_progress_pct: int
    monthly_visits: int
    streak_milestones: list


STREAK_MILESTONES = [
    {"days": 3, "badge_id": "streak_3", "name": "3 Dias Seguidos", "icon": "local-fire-department", "color": "#FB923C", "xp_bonus": 15},
    {"days": 7, "badge_id": "streak_7", "name": "Semana Ativa", "icon": "local-fire-department", "color": "#EF4444", "xp_bonus": 50},
    {"days": 14, "badge_id": "streak_14", "name": "2 Semanas Imparável", "icon": "whatshot", "color": "#DC2626", "xp_bonus": 100},
    {"days": 30, "badge_id": "streak_30", "name": "Mês Dedicado", "icon": "whatshot", "color": "#B91C1C", "xp_bonus": 250},
    {"days": 60, "badge_id": "streak_60", "name": "2 Meses de Exploração", "icon": "emoji-events", "color": "#F59E0B", "xp_bonus": 500},
    {"days": 100, "badge_id": "streak_100", "name": "Centenário", "icon": "emoji-events", "color": "#D97706", "xp_bonus": 1000},
    {"days": 365, "badge_id": "streak_365", "name": "Um Ano Completo", "icon": "military-tech", "color": "#7C3AED", "xp_bonus": 5000},
]

WEEKLY_GOAL = 5  # visits per week


@streaks_router.get("/{user_id}")
async def get_streak_info(user_id: str):
    """Get user's streak information with milestones."""
    db = _get_db()

    profile = await db.gamification_profiles.find_one(
        {"user_id": user_id}, {"_id": 0}
    )

    if not profile:
        return StreakResponse(
            user_id=user_id,
            current_streak=0,
            longest_streak=0,
            last_activity_date=None,
            streak_alive=False,
            hours_remaining=0,
            weekly_visits=0,
            weekly_goal=WEEKLY_GOAL,
            weekly_progress_pct=0,
            monthly_visits=0,
            streak_milestones=[],
        )

    current_streak = profile.get("streak_days", 0)
    longest_streak = profile.get("longest_streak", current_streak)
    last_activity = profile.get("last_activity_date")

    # Calculate if streak is still alive
    streak_alive = False
    hours_remaining = 0
    if last_activity:
        if isinstance(last_activity, str):
            last_dt = datetime.fromisoformat(last_activity.replace("Z", "+00:00"))
        else:
            last_dt = last_activity.replace(tzinfo=timezone.utc) if last_activity.tzinfo is None else last_activity

        now = datetime.now(timezone.utc)
        deadline = last_dt.replace(hour=23, minute=59, second=59) + timedelta(days=1)
        if now < deadline:
            streak_alive = True
            remaining = (deadline - now).total_seconds()
            hours_remaining = round(remaining / 3600, 1)
        else:
            # Streak is broken - reset
            current_streak = 0

    # Weekly visits
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    weekly_count = await db.checkins.count_documents({
        "user_id": user_id,
        "checked_in_at": {"$gte": week_start},
    })

    # Monthly visits
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_count = await db.checkins.count_documents({
        "user_id": user_id,
        "checked_in_at": {"$gte": month_start},
    })

    # Milestones
    earned_badges = set(profile.get("earned_badges", []))
    milestones = []
    for m in STREAK_MILESTONES:
        milestones.append({
            **m,
            "earned": m["badge_id"] in earned_badges,
            "progress": min(current_streak, m["days"]),
            "progress_pct": min(100, round(100 * current_streak / m["days"])),
        })

    return {
        "user_id": user_id,
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "last_activity_date": last_activity.isoformat() if hasattr(last_activity, 'isoformat') else last_activity,
        "streak_alive": streak_alive,
        "hours_remaining": hours_remaining,
        "weekly_visits": weekly_count,
        "weekly_goal": WEEKLY_GOAL,
        "weekly_progress_pct": min(100, round(100 * weekly_count / WEEKLY_GOAL)),
        "monthly_visits": monthly_count,
        "streak_milestones": milestones,
    }


@streaks_router.post("/{user_id}/record")
async def record_daily_activity(user_id: str, current_user: User = Depends(_auth_dep)):
    """Record daily activity for streak tracking. Called automatically on check-in.

    Only the authenticated user can record their own activity.
    """
    if user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Não pode registar atividade de outro utilizador")
    db = _get_db()

    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")

    profile = await db.gamification_profiles.find_one(
        {"user_id": user_id}, {"_id": 0}
    )

    if not profile:
        # First ever activity
        await db.gamification_profiles.update_one(
            {"user_id": user_id},
            {"$set": {
                "streak_days": 1,
                "longest_streak": 1,
                "last_activity_date": now,
                "streak_started_at": now,
            }, "$setOnInsert": {
                "user_id": user_id,
                "total_checkins": 0,
                "earned_badges": [],
                "xp": 0,
                "created_at": now,
            }},
            upsert=True,
        )
        return {"streak": 1, "new_badges": [], "xp_bonus": 0}

    last_activity = profile.get("last_activity_date")
    current_streak = profile.get("streak_days", 0)
    longest_streak = profile.get("longest_streak", 0)

    if last_activity:
        if isinstance(last_activity, str):
            last_date = last_activity[:10]
        else:
            last_date = last_activity.strftime("%Y-%m-%d")

        if last_date == today:
            # Already recorded today
            return {"streak": current_streak, "new_badges": [], "xp_bonus": 0}

        # Check if yesterday
        yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        if last_date == yesterday:
            current_streak += 1
        else:
            current_streak = 1
    else:
        current_streak = 1

    longest_streak = max(longest_streak, current_streak)

    # Check for new streak badges
    new_badges = []
    earned_set = set(profile.get("earned_badges", []))
    xp_bonus = 0

    for milestone in STREAK_MILESTONES:
        if current_streak >= milestone["days"] and milestone["badge_id"] not in earned_set:
            new_badges.append(milestone)
            earned_set.add(milestone["badge_id"])
            xp_bonus += milestone["xp_bonus"]

    update = {
        "$set": {
            "streak_days": current_streak,
            "longest_streak": longest_streak,
            "last_activity_date": now,
        }
    }

    if new_badges:
        update["$set"]["earned_badges"] = list(earned_set)
    if xp_bonus > 0:
        update["$inc"] = {"xp": xp_bonus}

    await db.gamification_profiles.update_one(
        {"user_id": user_id},
        update,
    )

    return {
        "streak": current_streak,
        "longest_streak": longest_streak,
        "new_badges": [{"id": b["badge_id"], "name": b["name"], "icon": b["icon"], "color": b["color"], "xp_bonus": b["xp_bonus"]} for b in new_badges],
        "xp_bonus": xp_bonus,
    }


@streaks_router.get("/{user_id}/calendar")
async def get_activity_calendar(user_id: str, months: int = 3):
    """Get activity calendar heatmap data for the last N months."""
    db = _get_db()

    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=months * 30)

    checkins = await db.checkins.find(
        {"user_id": user_id, "checked_in_at": {"$gte": start_date}},
        {"_id": 0, "checked_in_at": 1},
    ).to_list(10000)

    # Group by date
    date_counts: dict[str, int] = {}
    for ci in checkins:
        d = ci.get("checked_in_at")
        if d:
            date_str = d.strftime("%Y-%m-%d") if hasattr(d, 'strftime') else str(d)[:10]
            date_counts[date_str] = date_counts.get(date_str, 0) + 1

    # Calculate active days
    total_active_days = len(date_counts)
    total_days = (now - start_date).days
    consistency_pct = round(100 * total_active_days / max(total_days, 1))

    return {
        "user_id": user_id,
        "period_months": months,
        "activity_dates": date_counts,
        "total_active_days": total_active_days,
        "total_days": total_days,
        "consistency_pct": consistency_pct,
    }
