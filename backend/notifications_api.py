"""
Notifications API - Push notifications endpoints extracted from server.py.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
import httpx
import logging

from models.api_models import User

logger = logging.getLogger(__name__)

from shared_utils import DatabaseHolder

notifications_router = APIRouter()

_db_holder = DatabaseHolder("notifications")
set_notifications_db = _db_holder.set
_require_auth = None


def set_notifications_auth(require_auth_func):
    global _require_auth
    _require_auth = require_auth_func


class PushTokenRegister(BaseModel):
    token: str
    platform: str


class NotificationPreferences(BaseModel):
    surf_alerts: bool = True
    geofence_alerts: bool = True
    event_reminders: bool = True
    min_surf_quality: str = "good"


@notifications_router.post("/notifications/register")
async def register_push_token(
    data: PushTokenRegister,
    current_user: User = Depends(lambda r: _require_auth(r))
):
    """Register a device push token for notifications"""
    await _db_holder.db.push_tokens.update_one(
        {"user_id": current_user.user_id, "token": data.token},
        {"$set": {
            "user_id": current_user.user_id,
            "token": data.token,
            "platform": data.platform,
            "updated_at": datetime.now(timezone.utc),
            "active": True
        }},
        upsert=True
    )

    return {"message": "Push token registered", "token": data.token[:20] + "..."}


@notifications_router.delete("/notifications/unregister")
async def unregister_push_token(
    token: str,
    current_user: User = Depends(lambda r: _require_auth(r))
):
    """Unregister a push token"""
    await _db_holder.db.push_tokens.update_one(
        {"user_id": current_user.user_id, "token": token},
        {"$set": {"active": False}}
    )

    return {"message": "Push token unregistered"}


@notifications_router.get("/notifications/preferences")
async def get_notification_preferences(current_user: User = Depends(lambda r: _require_auth(r))):
    """Get user's notification preferences"""
    prefs = await _db_holder.db.notification_prefs.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0}
    )

    if not prefs:
        return NotificationPreferences()

    return NotificationPreferences(**prefs)


@notifications_router.put("/notifications/preferences")
async def update_notification_preferences(
    prefs: NotificationPreferences,
    current_user: User = Depends(lambda r: _require_auth(r))
):
    """Update user's notification preferences"""
    await _db_holder.db.notification_prefs.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "user_id": current_user.user_id,
            "surf_alerts": prefs.surf_alerts,
            "geofence_alerts": prefs.geofence_alerts,
            "event_reminders": prefs.event_reminders,
            "min_surf_quality": prefs.min_surf_quality,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )

    return {"message": "Notification preferences updated"}


@notifications_router.get("/notifications/history")
async def get_notification_history(
    limit: int = 20,
    current_user: User = Depends(lambda r: _require_auth(r))
):
    """Get user's notification history"""
    from shared_utils import clamp_pagination
    _, limit = clamp_pagination(0, limit, max_limit=100)
    notifications = await _db_holder.db.notification_history.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("sent_at", -1).limit(limit).to_list(limit)

    return {"notifications": notifications}


async def send_push_notification(token: str, title: str, body: str, data: dict = None):
    """Send a push notification via Expo Push API"""
    message = {"to": token, "title": title, "body": body, "sound": "default"}
    if data:
        message["data"] = data
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://exp.host/--/api/v2/push/send",
            json=message,
            headers={"Content-Type": "application/json"},
        )


@notifications_router.post("/notifications/send-poi-do-dia")
async def trigger_poi_do_dia_notification():
    """Trigger POI do Dia push notification to all active tokens"""
    poi = await _db_holder.db.heritage_items.find_one(
        {}, {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1},
        sort=[("iq_score", -1)]
    )
    if not poi:
        return {"sent": 0}

    tokens = await _db_holder.db.push_tokens.find({"active": True}, {"_id": 0, "token": 1}).to_list(1000)
    sent = 0
    for t in tokens:
        try:
            await send_push_notification(
                t["token"],
                f"POI do Dia: {poi['name']}",
                f"Descobre este local em {poi.get('region', 'Portugal')}!",
                {"type": "poi_do_dia", "poiId": poi["id"]},
            )
            sent += 1
        except Exception:
            pass

    await _db_holder.db.notification_history.insert_one({
        "type": "poi_do_dia",
        "poi_id": poi["id"],
        "sent_count": sent,
        "sent_at": datetime.now(timezone.utc),
    })
    return {"sent": sent, "poi": poi["name"]}


@notifications_router.post("/notifications/send-safety-alert")
async def trigger_safety_alert(region: str, alert_type: str = "fire", message: str = ""):
    """Send safety alert to users in a specific region"""
    prefs = await _db_holder.db.user_preferences.find(
        {"favorite_regions": region}, {"_id": 0, "user_id": 1}
    ).to_list(500)
    user_ids = [p["user_id"] for p in prefs]

    if not user_ids:
        return {"sent": 0}

    tokens = await _db_holder.db.push_tokens.find(
        {"user_id": {"$in": user_ids}, "active": True}, {"_id": 0, "token": 1}
    ).to_list(1000)

    title = "Alerta de Seguranca" if alert_type == "fire" else "Alerta Meteorologico"
    body = message or f"Alerta ativo na regiao {region}. Consulte as recomendacoes de seguranca."

    sent = 0
    for t in tokens:
        try:
            await send_push_notification(t["token"], title, body, {"type": "safety_alert", "region": region})
            sent += 1
        except Exception:
            pass
    return {"sent": sent}


@notifications_router.get("/notifications/unread-count")
async def get_unread_count(current_user: User = Depends(lambda r: _require_auth(r))):
    """Get count of unread notifications"""
    count = await _db_holder.db.notification_history.count_documents({
        "user_id": current_user.user_id,
        "read": {"$ne": True},
    })
    return {"count": count}
