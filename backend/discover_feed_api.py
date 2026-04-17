"""
Discover Feed API - Discovery feed, trending, and seasonal content endpoints.
Extracted from server.py.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
import hashlib
import logging
import math

import httpx

from models.api_models import User
from auth_api import get_current_user, require_auth
from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

router = APIRouter()

_db_holder = DatabaseHolder("discover_feed")
set_discover_feed_db = _db_holder.set

_llm_key: Optional[str] = None

def set_discover_feed_llm_key(key: str) -> None:
    global _llm_key
    _llm_key = key

_recommendation_service = None

def set_discover_recommendation_service(svc):
    global _recommendation_service
    _recommendation_service = svc


class DiscoveryFeedRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    limit: int = Field(30, ge=1, le=100)
    traveler_profile: Optional[str] = None
    category: Optional[str] = None  # stories | trails | events | nearby

CATEGORY_FILTERS = {
    "stories": ["lendas", "historia", "cultura", "arte", "religioso", "aldeias", "saberes"],
    "trails": ["percursos", "percursos_pedestres", "ecovias_passadicos", "trilhos", "natureza", "fauna"],
    "events": ["festas", "eventos", "romarias", "festivais", "musica_tradicional"],
}

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

    # Filter by category tab
    items = [item.dict() for item in feed]
    if request.category and request.category in CATEGORY_FILTERS:
        allowed = set(CATEGORY_FILTERS[request.category])
        items = [
            i for i in items
            if ((i.get("content_data") or {}).get("category") or i.get("category", "")) in allowed
        ] or items  # fallback to all if filter yields empty

    # Boost items matching profile
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
    db = _db_holder.db
    now = datetime.now(timezone.utc)
    current_month = now.month

    # Get current season events directly from events collection
    all_events = await db.events.find({"month": current_month}, {"_id": 0}).to_list(200)
    season_events = all_events

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


@router.get("/discover/surprise")
async def get_surprise_poi(
    traveler_profile: Optional[str] = None,
    region: Optional[str] = None,
):
    """Return one hidden/lesser-known POI based on profile — the 'Surpreende-me' feature."""
    import random
    db = _db_holder.db

    query: Dict = {"content_health_score": {"$lt": 60}}  # lower-profile items = hidden gems
    if region:
        query["region"] = region
    if traveler_profile and traveler_profile in PROFILE_CATEGORIES:
        query["category"] = {"$in": PROFILE_CATEGORIES[traveler_profile]}

    total = await db.heritage_items.count_documents(query)
    if total == 0:
        query = {}  # fallback: no filter
        total = await db.heritage_items.count_documents(query)

    skip = random.randint(0, max(0, total - 1))
    item = await db.heritage_items.find_one(query, {"_id": 0}, skip=skip)
    if not item:
        raise HTTPException(status_code=404, detail="Nenhum POI encontrado")

    return {
        "item": item,
        "message": "Descobriste um lugar escondido!",
        "surprise": True,
    }


# ─── Hoje em Portugal ─────────────────────────────────────────────────────────

def _haversine_hoje(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _hoje_cache_key(lat: Optional[float], lng: Optional[float], day_str: str) -> str:
    cell_lat = round((lat or 39.5) / 0.5) * 0.5
    cell_lng = round((lng or -8.0) / 0.5) * 0.5
    return hashlib.sha256(f"{cell_lat:.1f}|{cell_lng:.1f}|{day_str}".encode()).hexdigest()[:20]


async def _llm_hoje_summary(items_text: str, season: str, month_pt: str) -> str:
    """Ask LLM for a short contextual summary. Returns empty string on failure."""
    if not _llm_key:
        return ""
    prompt = (
        f"Estamos em {month_pt} ({season}). "
        f"Resume em 1-2 frases curtas e evocativas o que torna hoje especial para descobrir Portugal, "
        f"com base nestes elementos: {items_text}. "
        f"Tom: entusiasta, poético, conciso. Responde APENAS com as frases, sem formatação."
    )
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.post(
                "https://llm.lil.re.emergentmethods.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {_llm_key}", "Content-Type": "application/json"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 120,
                    "temperature": 0.8,
                },
            )
            return r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return ""


MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
             "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

SEASONS_HOJE = {
    **{m: {"id": "inverno",   "label": "Inverno",   "emoji": "❄️"} for m in [12, 1, 2]},
    **{m: {"id": "primavera", "label": "Primavera", "emoji": "🌸"} for m in [3, 4, 5]},
    **{m: {"id": "verao",     "label": "Verão",     "emoji": "☀️"} for m in [6, 7, 8]},
    **{m: {"id": "outono",    "label": "Outono",    "emoji": "🍂"} for m in [9, 10, 11]},
}

FLORA_HOJE = {
    "amendoeira":   {"months": [1,2,3],       "region": "Algarve",           "label": "Amendoeiras em flor",           "emoji": "🌸"},
    "lavanda":      {"months": [5,6,7],        "region": "Alentejo",          "label": "Lavanda em flor",               "emoji": "💜"},
    "sobreiro":     {"months": [4,5,6],        "region": "Alentejo",          "label": "Descortiçamento do sobreiro",   "emoji": "🌳"},
    "vinha_madura": {"months": [8,9,10],       "region": "Douro",             "label": "Vindima no Douro",              "emoji": "🍇"},
    "mimosa":       {"months": [1,2,3],        "region": "Minho",             "label": "Mimosas em flor",               "emoji": "🌼"},
    "heather":      {"months": [7,8,9],        "region": "Serra da Estrela",  "label": "Urze em flor",                  "emoji": "🌿"},
    "lirio_de_agua":{"months": [5,6,7],        "region": "Alentejo",          "label": "Lírios-de-água",                "emoji": "💧"},
}

FAUNA_HOJE = {
    "cegonha_branca":  {"months": [3,4,5,6,7,8],    "label": "Cegonha-branca",         "region": "Alentejo", "emoji": "🦢"},
    "golfinhos":       {"months": [4,5,6,7,8,9],    "label": "Golfinhos costeiros",    "region": "Algarve",  "emoji": "🐬"},
    "lince_iberico":   {"months": [1,2,3,10,11,12], "label": "Lince-ibérico activo",   "region": "Alentejo", "emoji": "🐆"},
    "borboletas":      {"months": [5,6,7,8],         "label": "Borboletas migratórias", "region": "Algarve",  "emoji": "🦋"},
    "aves_invernantes":{"months": [10,11,12,1,2],    "label": "Aves invernantes",       "region": "Tejo",     "emoji": "🦆"},
    "baleia_fin":      {"months": [3,4,5],            "label": "Baleia-comum",           "region": "Açores",   "emoji": "🐋"},
    "tartaruga_verde": {"months": [6,7,8,9],          "label": "Tartaruga-verde",        "region": "Algarve",  "emoji": "🐢"},
}

SURF_HOJE = {
    "inverno":   {"note": "Ondas grandes 2–4 m — Nazaré, Peniche.", "emoji": "🌊"},
    "primavera": {"note": "Ondas moderadas 1–2 m — Algarve e Cascais.", "emoji": "🏄"},
    "verao":     {"note": "Mar calmo — snorkeling, SUP, mergulho.", "emoji": "🤿"},
    "outono":    {"note": "Surf activo 1.5–3 m em todo o litoral.", "emoji": "🌊"},
}


@router.get("/discover/hoje", summary="Feed inteligente contextual — o que ver hoje em Portugal")
async def get_hoje_feed(
    lat:    Optional[float] = Query(None, description="Latitude do utilizador"),
    lng:    Optional[float] = Query(None, description="Longitude do utilizador"),
    date:   Optional[str]   = Query(None, description="Data alvo YYYY-MM-DD (omitir = hoje)"),
    region: Optional[str]   = Query(None, description="Região (override de geo)"),
):
    """
    Dado GPS + data, cruza eventos próximos (50 km) + flora em flor + fauna visível
    + marés/surf + temporada → feed ranked com sumário LLM.
    Cache por célula de região (~50 km) × dia, TTL 6h em `hoje_cache`.
    """
    db = _db_holder.db

    try:
        target_dt = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc) if date else datetime.now(timezone.utc)
    except Exception:
        target_dt = datetime.now(timezone.utc)

    month    = target_dt.month
    day_str  = target_dt.strftime("%Y-%m-%d")
    month_pt = MONTHS_PT[month - 1]
    season   = SEASONS_HOJE[month]

    cache_key = _hoje_cache_key(lat, lng, day_str)

    # Cache hit
    if db:
        try:
            cached = await db.hoje_cache.find_one({"key": cache_key})
            if cached:
                cached.pop("_id", None)
                return {**cached, "cached": True}
        except Exception:
            pass

    # Flora activa
    flora_active = [
        {"species": k, "label": v["label"], "region": v["region"], "emoji": v["emoji"]}
        for k, v in FLORA_HOJE.items() if month in v["months"]
    ]

    # Fauna activa
    fauna_active = [
        {"species": k, "label": v["label"], "region": v["region"], "emoji": v["emoji"]}
        for k, v in FAUNA_HOJE.items() if month in v["months"]
    ]

    # Surf / mar
    surf = SURF_HOJE.get(season["id"], {"note": "", "emoji": "🌊"})

    # Events nearby
    events_nearby: list[dict] = []
    if db:
        try:
            all_events = await db.events.find({"month": month}, {"_id": 0}).limit(200).to_list(200)
            if lat is not None and lng is not None:
                for e in all_events:
                    elat = e.get("lat") or e.get("latitude")
                    elng = e.get("lng") or e.get("longitude")
                    if elat and elng:
                        try:
                            dist = _haversine_hoje(lat, lng, float(elat), float(elng))
                            if dist <= 50:
                                e["distance_km"] = round(dist, 1)
                                events_nearby.append(e)
                        except Exception:
                            pass
                events_nearby.sort(key=lambda x: x.get("distance_km", 999))
            else:
                events_nearby = all_events[:8]
        except Exception:
            pass

    # Trails nearby
    trails_nearby: list[dict] = []
    if db and lat is not None and lng is not None:
        try:
            all_trails = await db.trails.find({}, {"_id": 0, "name": 1, "region": 1, "difficulty": 1, "distance_km": 1, "lat": 1, "lng": 1}).limit(200).to_list(200)
            for t in all_trails:
                tlat = t.get("lat")
                tlng = t.get("lng")
                if tlat and tlng:
                    try:
                        dist = _haversine_hoje(lat, lng, float(tlat), float(tlng))
                        if dist <= 30:
                            t["distance_km"] = round(dist, 1)
                            trails_nearby.append(t)
                    except Exception:
                        pass
            trails_nearby.sort(key=lambda x: x.get("distance_km", 999))
        except Exception:
            pass

    # LLM summary
    items_text_parts = []
    if flora_active:
        items_text_parts.append(", ".join(f["label"] for f in flora_active[:2]))
    if fauna_active:
        items_text_parts.append(", ".join(f["label"] for f in fauna_active[:2]))
    if events_nearby:
        items_text_parts.append(f"{len(events_nearby)} eventos próximos")
    items_text_parts.append(surf["note"])

    llm_summary = await _llm_hoje_summary("; ".join(items_text_parts), season["label"], month_pt)

    result = {
        "key":            cache_key,
        "date":           day_str,
        "month":          month,
        "month_pt":       month_pt,
        "season":         season,
        "flora_active":   flora_active[:4],
        "fauna_active":   fauna_active[:4],
        "surf":           surf,
        "events_nearby":  events_nearby[:6],
        "trails_nearby":  trails_nearby[:4],
        "llm_summary":    llm_summary,
        "has_location":   lat is not None and lng is not None,
        "generated_at":   datetime.now(timezone.utc).isoformat(),
    }

    # Cache 6 h
    if db:
        try:
            expires = datetime.now(timezone.utc) + timedelta(hours=6)
            await db.hoje_cache.replace_one(
                {"key": cache_key},
                {**result, "expires_at": expires},
                upsert=True,
            )
            await db.hoje_cache.create_index("expires_at", expireAfterSeconds=0)
        except Exception:
            pass

    return {**result, "cached": False}
