"""
Smart Notifications API - Contextual notifications based on proximity and regional events.
Sends proximity alerts, event reminders, and personalized weekly digests.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from math import radians, cos
import logging

from shared_utils import DatabaseHolder, haversine_km
from models.api_models import User

logger = logging.getLogger(__name__)

_db_holder = DatabaseHolder("smart_notifications")
set_smart_notifications_db = _db_holder.set
_get_db = _db_holder.get

_require_auth = None


def set_smart_notifications_auth(auth_fn):
    global _require_auth
    _require_auth = auth_fn


async def _auth_dep(request: Request) -> User:
    return await _require_auth(request)

smart_notifications_router = APIRouter(
    prefix="/notifications/smart", tags=["Notificações"]
)

PORTUGAL_REGIONS = [
    "Norte", "Centro", "Lisboa", "Alentejo", "Algarve", "Açores", "Madeira"
]


# ── Pydantic models ──────────────────────────────────────────────────────────

class CheckNearbyRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    user_id: Optional[str] = None
    radius_km: float = Field(2.0, ge=0.1, le=50)


class CheckEventsRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    region: Optional[str] = None


class NotificationPreferencesBody(BaseModel):
    proximity_enabled: bool = True
    events_enabled: bool = True
    digest_enabled: bool = True
    quiet_hours_start: Optional[str] = None   # e.g. "22:00"
    quiet_hours_end: Optional[str] = None      # e.g. "08:00"
    favorite_regions: List[str] = []


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _recently_notified(db, user_id: Optional[str], poi_id: str) -> bool:
    """Check if a notification was already sent for this POI recently (24h)."""
    if not user_id:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    existing = await db.notification_log.find_one({
        "user_id": user_id,
        "poi_id": poi_id,
        "sent_at": {"$gte": cutoff},
    })
    return existing is not None


async def _log_notification(db, user_id: Optional[str], poi_id: str, ntype: str):
    """Log a sent notification for deduplication."""
    await db.notification_log.insert_one({
        "user_id": user_id,
        "poi_id": poi_id,
        "type": ntype,
        "sent_at": datetime.now(timezone.utc),
    })


def _notification_title(poi: dict, distance_km: float) -> str:
    """Generate a contextual notification title."""
    name = poi.get("name", "POI desconhecido")
    dist_m = round(distance_km * 1000)
    if dist_m < 500:
        return f"Está muito perto de {name}!"
    return f"{name} está a {distance_km:.1f} km"


def _notification_body(poi: dict) -> str:
    """Generate a contextual notification body."""
    category = poi.get("category", "")
    iq = poi.get("iq_score") or 0
    region = poi.get("region", "")
    parts = []
    if category:
        parts.append(category.replace("_", " ").title())
    if region:
        parts.append(region)
    if iq >= 50:
        parts.append(f"IQ: {iq:.0f}")
    desc = poi.get("description") or ""
    if desc:
        snippet = desc[:80] + ("..." if len(desc) > 80 else "")
        parts.append(snippet)
    return " · ".join(parts) if parts else "Descubra este local!"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@smart_notifications_router.post("/check-nearby")
async def check_nearby(req: CheckNearbyRequest):
    """Check for interesting POIs near the user and return notification suggestions."""
    db = _get_db()

    lat_delta = req.radius_km / 111.0
    lng_delta = req.radius_km / (111.0 * cos(radians(req.lat)))

    query = {
        "location.lat": {"$gte": req.lat - lat_delta, "$lte": req.lat + lat_delta},
        "location.lng": {"$gte": req.lng - lng_delta, "$lte": req.lng + lng_delta},
    }

    projection = {
        "_id": 0, "id": 1, "name": 1, "category": 1, "region": 1,
        "location": 1, "iq_score": 1, "description": 1, "rarity": 1,
    }

    candidates = await db.heritage_items.find(query, projection).limit(200).to_list(200)

    scored = []
    for poi in candidates:
        loc = poi.get("location", {})
        if not loc.get("lat") or not loc.get("lng"):
            continue
        dist = haversine_km(req.lat, req.lng, loc["lat"], loc["lng"])
        if dist > req.radius_km:
            continue

        poi_id = poi.get("id", "")

        # Skip recently notified POIs
        if await _recently_notified(db, req.user_id, poi_id):
            continue

        # Score: higher IQ and rarer POIs rank higher, closer is also better
        iq = poi.get("iq_score") or 0
        rarity_bonus = {"raro": 30, "muito_raro": 50, "lendario": 80}.get(
            poi.get("rarity", ""), 0
        )
        score = iq + rarity_bonus - (dist * 10)

        scored.append({
            "title": _notification_title(poi, dist),
            "body": _notification_body(poi),
            "poi_id": poi_id,
            "distance_km": round(dist, 2),
            "category": poi.get("category", ""),
            "_score": score,
        })

    # Sort by score descending and take top 3
    scored.sort(key=lambda x: x["_score"], reverse=True)
    results = scored[:3]

    # Log sent notifications for deduplication
    for n in results:
        await _log_notification(db, req.user_id, n["poi_id"], "proximity")
        del n["_score"]

    return {
        "notifications": results,
        "total_nearby": len(scored),
        "radius_km": req.radius_km,
    }


@smart_notifications_router.post("/check-events")
async def check_events(req: CheckEventsRequest):
    """Check for upcoming events near the user's location or in their region."""
    db = _get_db()

    now = datetime.now(timezone.utc)
    week_ahead = now + timedelta(days=7)

    query: dict = {}

    # Filter by region if provided
    if req.region:
        query["region"] = {"$regex": req.region, "$options": "i"}

    # Try to find events with date fields within next 7 days
    # Events may have date_start or month fields
    current_month = now.month
    query["$or"] = [
        {"date_start": {"$gte": now.isoformat(), "$lte": week_ahead.isoformat()}},
        {"month": current_month},
    ]

    events = await db.events.find(query, {"_id": 0}).limit(50).to_list(50)

    # If region not provided, filter events near user location
    if not req.region and events:
        # Use a wide radius (50km) for event proximity
        filtered = []
        for evt in events:
            loc = evt.get("location", {})
            if loc.get("lat") and loc.get("lng"):
                dist = haversine_km(req.lat, req.lng, loc["lat"], loc["lng"])
                if dist <= 50:
                    evt["_dist"] = dist
                    filtered.append(evt)
            else:
                # Keep events without precise location (region-based match)
                filtered.append(evt)
        events = filtered

    notifications = []
    for evt in events[:5]:
        name = evt.get("name", "Evento")
        date_text = evt.get("date_text", "")
        region = evt.get("region", "")

        body_parts = []
        if date_text:
            body_parts.append(date_text)
        if region:
            body_parts.append(region)
        if evt.get("type"):
            body_parts.append(evt["type"].title())

        notifications.append({
            "title": f"Evento próximo: {name}",
            "body": " · ".join(body_parts) if body_parts else "Consulte os detalhes.",
            "event_id": evt.get("id", ""),
            "date": date_text,
            "category": evt.get("type", "evento"),
        })

    return {
        "notifications": notifications,
        "total_events": len(events),
    }


@smart_notifications_router.get("/digest/{user_id}")
async def get_weekly_digest(user_id: str):
    """Generate a personalized weekly digest for the user."""
    db = _get_db()

    # Load user preferences for favorite regions
    prefs = await db.notification_preferences.find_one(
        {"user_id": user_id}, {"_id": 0}
    )
    favorite_regions = (prefs or {}).get("favorite_regions", [])

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    # ── New POIs in favorite regions ─────────────────────────────────
    new_pois = []
    if favorite_regions:
        poi_query = {
            "region": {"$in": favorite_regions},
            "created_at": {"$gte": week_ago},
        }
        new_pois = await db.heritage_items.find(
            poi_query, {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "iq_score": 1}
        ).limit(10).to_list(10)

    # ── Upcoming events ──────────────────────────────────────────────
    week_ahead = now + timedelta(days=7)
    events_query: dict = {"month": now.month}
    if favorite_regions:
        events_query["region"] = {"$in": favorite_regions}

    upcoming_events = await db.events.find(
        events_query, {"_id": 0, "id": 1, "name": 1, "region": 1, "date_text": 1, "type": 1}
    ).limit(5).to_list(5)

    # ── Streak status ────────────────────────────────────────────────
    streak_doc = await db.streaks.find_one(
        {"user_id": user_id}, {"_id": 0, "current_streak": 1, "best_streak": 1}
    )
    streak = {
        "current": (streak_doc or {}).get("current_streak", 0),
        "best": (streak_doc or {}).get("best_streak", 0),
    }

    # ── New routes ───────────────────────────────────────────────────
    routes_query: dict = {"created_at": {"$gte": week_ago}}
    if favorite_regions:
        routes_query["region"] = {"$in": favorite_regions}

    new_routes = await db.routes.find(
        routes_query, {"_id": 0, "id": 1, "name": 1, "region": 1, "distance_km": 1}
    ).limit(5).to_list(5)

    return {
        "user_id": user_id,
        "generated_at": now.isoformat(),
        "period": {"from": week_ago.isoformat(), "to": now.isoformat()},
        "new_pois": new_pois,
        "upcoming_events": upcoming_events,
        "streak": streak,
        "new_routes": new_routes,
        "favorite_regions": favorite_regions,
        "summary": (
            f"{len(new_pois)} novos POIs, {len(upcoming_events)} eventos, "
            f"streak de {streak['current']} dias"
        ),
    }


@smart_notifications_router.post("/preferences")
async def set_preferences(
    body: NotificationPreferencesBody,
    current_user: User = Depends(_auth_dep),
):
    """Set notification preferences for the authenticated user."""
    db = _get_db()

    # Validate regions
    invalid = [r for r in body.favorite_regions if r not in PORTUGAL_REGIONS]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Regiões inválidas: {', '.join(invalid)}. "
                   f"Válidas: {', '.join(PORTUGAL_REGIONS)}",
        )

    doc = {
        "user_id": current_user.user_id,
        "proximity_enabled": body.proximity_enabled,
        "events_enabled": body.events_enabled,
        "digest_enabled": body.digest_enabled,
        "quiet_hours_start": body.quiet_hours_start,
        "quiet_hours_end": body.quiet_hours_end,
        "favorite_regions": body.favorite_regions,
        "updated_at": datetime.now(timezone.utc),
    }

    await db.notification_preferences.update_one(
        {"user_id": current_user.user_id},
        {"$set": doc},
        upsert=True,
    )

    return {"message": "Preferências atualizadas", "preferences": doc}


@smart_notifications_router.get("/preferences/{user_id}")
async def get_preferences(user_id: str):
    """Get notification preferences for a user."""
    db = _get_db()

    prefs = await db.notification_preferences.find_one(
        {"user_id": user_id}, {"_id": 0}
    )

    if not prefs:
        return {
            "user_id": user_id,
            "proximity_enabled": True,
            "events_enabled": True,
            "digest_enabled": True,
            "quiet_hours_start": None,
            "quiet_hours_end": None,
            "favorite_regions": [],
        }

    return prefs
