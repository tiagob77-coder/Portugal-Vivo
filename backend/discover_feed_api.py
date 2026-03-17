"""
Discover Feed API - Discovery feed, trending, and seasonal content endpoints.
Extracted from server.py.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
import logging

from models.api_models import User
from auth_api import get_current_user, require_auth
from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

router = APIRouter()

_db_holder = DatabaseHolder("discover_feed")
set_discover_feed_db = _db_holder.set

_recommendation_service = None

def set_discover_recommendation_service(svc):
    global _recommendation_service
    _recommendation_service = svc


class DiscoveryFeedRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    limit: int = Field(30, ge=1, le=100)
    traveler_profile: Optional[str] = None

PROFILE_CATEGORIES = {
    "aventureiro": ["percursos_pedestres", "percursos", "aventura_natureza", "aventura", "cascatas_pocos", "cascatas", "ecovias_passadicos", "baloicos", "natureza_especializada", "areas_protegidas"],
    "gastronomo": ["restaurantes_gastronomia", "gastronomia", "produtores_dop", "produtos", "tabernas_historicas", "tascas", "pratos_tipicos", "docaria_regional"],
    "cultural": ["castelos", "museus", "arqueologia_geologia", "arqueologia", "arte_urbana", "arte", "festas_romarias", "festas", "oficios_artesanato", "saberes", "musica_tradicional", "lendas", "religioso", "aldeias"],
    "familia": ["praias_fluviais", "piscinas", "ecovias_passadicos", "baloicos", "aventura_natureza", "aventura", "praias_bandeira_azul"],
}
FAMILIA_TAGS = {"child_friendly", "pet_friendly"}

@router.post("/discover/feed")
async def get_discovery_feed(
    request: DiscoveryFeedRequest,
    current_user: Optional[User] = Depends(get_current_user)
):
    """Get personalized discovery feed (Tab Descobrir)"""
    db = _db_holder.db
    user_id = current_user.user_id if current_user else "anonymous"

    feed = await _recommendation_service.get_discovery_feed(
        user_id=user_id,
        lat=request.lat,
        lng=request.lng,
        limit=request.limit
    )

    # Determine dominant profile
    active_profile = request.traveler_profile
    if not active_profile and current_user:
        prefs = await db.user_preferences.find_one(
            {"user_id": current_user.user_id}, {"_id": 0, "traveler_profiles": 1}
        )
        if prefs and prefs.get("traveler_profiles"):
            profiles = prefs["traveler_profiles"]
            if profiles:
                active_profile = max(profiles, key=profiles.get)

    # Boost items matching profile
    items = [item.dict() for item in feed]
    if active_profile and active_profile in PROFILE_CATEGORIES:
        boost_cats = set(PROFILE_CATEGORIES[active_profile])
        for item in items:
            cat = (item.get("content_data") or {}).get("category") or item.get("category", "")
            tags = set((item.get("content_data") or {}).get("tags") or item.get("tags") or [])
            if cat in boost_cats or (active_profile == "familia" and tags & FAMILIA_TAGS):
                item["relevance_score"] = item.get("relevance_score", 0) * 1.3
        items.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)

    return {
        "items": items,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "personalized": current_user is not None,
        "personalized_for": active_profile if active_profile in PROFILE_CATEGORIES else None
    }

@router.get("/discover/trending")
async def get_trending_items(limit: int = 10):
    """Get trending items (community-driven)"""
    from shared_utils import clamp_pagination
    db = _db_holder.db
    _, limit = clamp_pagination(0, limit, max_limit=50)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    pipeline = [
        {"$match": {"timestamp": {"$gte": week_ago}}},
        {"$group": {"_id": "$poi_id", "visit_count": {"$sum": 1}}},
        {"$sort": {"visit_count": -1}},
        {"$limit": limit}
    ]

    trending_ids = await db.visits.aggregate(pipeline).to_list(limit)

    trending_items = []
    for trend in trending_ids:
        item = await db.heritage_items.find_one({"id": trend["_id"]}, {"_id": 0})
        if item:
            trending_items.append({
                **item,
                "trending_score": trend["visit_count"],
                "reason": "Em tendência na comunidade"
            })

    return {"items": trending_items, "period": "7_days"}

@router.get("/discover/seasonal")
async def get_seasonal_content():
    """Get seasonal/temporal content"""
    from calendar_api import _get_calendar_events
    db = _db_holder.db
    now = datetime.now(timezone.utc)
    current_month = now.month

    # Get current season events
    all_events = await _get_calendar_events()
    season_events = [e for e in all_events if e["date_start"].startswith(f"{current_month:02d}")]

    # Get items related to current season
    season_categories = {
        12: ["festas", "gastronomia"],  # Natal
        1: ["festas"],  # Reis
        2: ["festas"],  # Carnaval
        3: ["religioso"],  # Páscoa
        4: ["natureza", "cascatas"],  # Primavera
        5: ["religioso", "natureza"],  # Fátima, Primavera
        6: ["festas", "piscinas"],  # Santos Populares, Verão
        7: ["piscinas", "termas"],  # Verão
        8: ["piscinas", "festas"],  # Verão
        9: ["gastronomia", "festas"],  # Vindimas
        10: ["gastronomia"],  # Outono
        11: ["gastronomia", "festas"],  # Magusto
    }

    categories = season_categories.get(current_month, ["natureza"])

    items = await db.heritage_items.find(
        {"category": {"$in": categories}},
        {"_id": 0}
    ).limit(20).to_list(20)

    return {
        "season": "winter" if current_month in [12, 1, 2] else
                 "spring" if current_month in [3, 4, 5] else
                 "summer" if current_month in [6, 7, 8] else "autumn",
        "events": season_events,
        "recommended_items": items[:10],
        "categories_in_focus": categories
    }
