"""
Newsletter API - Real newsletter subscription backend.
Replaces the MOCKED frontend-only implementation.
"""
from fastapi import APIRouter
from pydantic import BaseModel, field_validator
from datetime import datetime, timezone
from typing import Optional, List
import re
import logging

from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

newsletter_router = APIRouter()

_db_holder = DatabaseHolder("newsletter")
set_newsletter_db = _db_holder.set


EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


class SubscribeRequest(BaseModel):
    email: str
    name: Optional[str] = None
    interests: Optional[List[str]] = None

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        v = v.strip().lower()
        if not EMAIL_REGEX.match(v):
            raise ValueError("Formato de email invalido")
        if len(v) > 254:
            raise ValueError("Email demasiado longo")
        return v


class UnsubscribeRequest(BaseModel):
    email: str

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        return v.strip().lower()


@newsletter_router.post("/newsletter/subscribe")
async def subscribe(request: SubscribeRequest):
    """Subscribe to the newsletter"""
    existing = await _db_holder.db.newsletter_subscribers.find_one({"email": request.email})

    if existing:
        if existing.get("active"):
            return {"message": "Este email ja esta subscrito", "already_subscribed": True}
        # Reactivate
        await _db_holder.db.newsletter_subscribers.update_one(
            {"email": request.email},
            {"$set": {
                "active": True,
                "name": request.name or existing.get("name"),
                "interests": request.interests or existing.get("interests", []),
                "resubscribed_at": datetime.now(timezone.utc)
            }}
        )
        return {"message": "Subscricao reativada com sucesso", "reactivated": True}

    await _db_holder.db.newsletter_subscribers.insert_one({
        "email": request.email,
        "name": request.name,
        "interests": request.interests or [],
        "active": True,
        "subscribed_at": datetime.now(timezone.utc),
        "source": "website"
    })

    logger.info(f"New newsletter subscriber: {request.email}")
    return {"message": "Subscricao realizada com sucesso! Obrigado.", "subscribed": True}


@newsletter_router.post("/newsletter/unsubscribe")
async def unsubscribe(request: UnsubscribeRequest):
    """Unsubscribe from the newsletter"""
    result = await _db_holder.db.newsletter_subscribers.update_one(
        {"email": request.email, "active": True},
        {"$set": {"active": False, "unsubscribed_at": datetime.now(timezone.utc)}}
    )

    if result.modified_count == 0:
        return {"message": "Email nao encontrado ou ja cancelado"}

    return {"message": "Subscricao cancelada com sucesso"}


@newsletter_router.get("/newsletter/stats")
async def newsletter_stats():
    """Get newsletter statistics"""
    total = await _db_holder.db.newsletter_subscribers.count_documents({})
    active = await _db_holder.db.newsletter_subscribers.count_documents({"active": True})
    inactive = total - active

    # Interests distribution
    pipeline = [
        {"$match": {"active": True}},
        {"$unwind": "$interests"},
        {"$group": {"_id": "$interests", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    interests = await _db_holder.db.newsletter_subscribers.aggregate(pipeline).to_list(20)

    return {
        "total_subscribers": total,
        "active": active,
        "inactive": inactive,
        "interests": [{"interest": i["_id"], "count": i["count"]} for i in interests]
    }
