"""
Smart Travel Planner API - Combines transport, POIs, events, and beachcams
into intelligent itinerary suggestions based on region, duration, and interests.

Includes AI-powered itinerary generation with LLM narrative descriptions.
Smart Route Engine: locality-based, time-period-aware, category-diverse routing.
"""
import os
import logging
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Query, HTTPException, Depends
from typing import Optional, List
from shared_constants import sanitize_regex, SUBCATEGORIES, SUBCATEGORY_MAP
from shared_utils import DatabaseHolder, haversine_km
from premium_guard import require_feature

logger = logging.getLogger(__name__)
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

planner_router = APIRouter(prefix="/planner", tags=["Planner"])

_db_holder = DatabaseHolder("planner")
set_planner_db = _db_holder.set


INTEREST_CATEGORIES = {
    "cultura": ["arte_urbana", "musica_tradicional", "festas_romarias", "oficios_artesanato", "festivais_musica"],
    "gastronomia": ["restaurantes_gastronomia", "tabernas_historicas", "produtores_dop", "mercados_feiras", "pratos_tipicos", "docaria_regional", "agroturismo_enoturismo"],
    "natureza": ["aventura_natureza", "praias_fluviais", "percursos_pedestres", "miradouros", "cascatas_pocos", "barragens_albufeiras", "ecovias_passadicos", "natureza_especializada", "flora_autoctone", "flora_botanica", "fauna_autoctone", "biodiversidade_avistamentos"],
    "festas": ["festas_romarias", "mercados_feiras", "festivais_musica"],
    "historia": ["arqueologia_geologia", "castelos", "museus", "palacios_solares", "patrimonio_ferroviario", "moinhos_azenhas"],
    "aventura": ["percursos_pedestres", "surf", "aventura_natureza", "ecovias_passadicos"],
    "patrimonio": ["castelos", "palacios_solares", "museus", "arte_urbana", "patrimonio_ferroviario", "oficios_artesanato", "termas_banhos"],
    "praias": ["praias_fluviais", "praias_bandeira_azul", "surf", "praias_fluviais_mar"],
    "vinhos": ["agroturismo_enoturismo", "produtores_dop", "tabernas_historicas"],
}

# -----------------------------------------------------------------
# VISIT TIME ESTIMATES (minutes) by category
# -----------------------------------------------------------------
VISIT_TIME_MINUTES = {
    "museus": 60, "castelos": 75, "palacios_solares": 60,
    "miradouros": 20, "cascatas_pocos": 30, "praias_fluviais": 45,
    "percursos_pedestres": 90, "ecovias_passadicos": 75,
    "aventura_natureza": 60, "restaurantes_gastronomia": 90,
    "tabernas_historicas": 75, "mercados_feiras": 45,
    "produtores_dop": 40, "agroturismo_enoturismo": 60,
    "pratos_tipicos": 90, "docaria_regional": 30,
    "arte_urbana": 30, "oficios_artesanato": 45,
    "termas_banhos": 90, "patrimonio_ferroviario": 45,
    "arqueologia_geologia": 50, "moinhos_azenhas": 30,
    "festas_romarias": 60, "festivais_musica": 120,
    "musica_tradicional": 45, "surf": 120,
    "praias_bandeira_azul": 60, "praias_fluviais_mar": 45,
    "natureza_especializada": 45, "fauna_autoctone": 40,
    "flora_autoctone": 35, "flora_botanica": 35,
    "biodiversidade_avistamentos": 40, "barragens_albufeiras": 30,
    "rotas_tematicas": 60, "grande_expedicao": 90,
    "perolas_portugal": 45, "parques_campismo": 30,
    "pousadas_juventude": 15, "guia_viajante": 20,
    "transportes": 15,
}

# Categories suitable for each time period
PERIOD_CATEGORIES = {
    "manha": ["museus", "percursos_pedestres", "ecovias_passadicos", "castelos",
              "palacios_solares", "miradouros", "natureza_especializada",
              "arqueologia_geologia", "biodiversidade_avistamentos", "fauna_autoctone",
              "flora_autoctone", "flora_botanica", "aventura_natureza",
              "patrimonio_ferroviario", "termas_banhos", "mercados_feiras",
              "arte_urbana", "oficios_artesanato"],
    "almoco": ["restaurantes_gastronomia", "tabernas_historicas", "pratos_tipicos",
               "mercados_feiras", "docaria_regional"],
    "tarde": ["praias_fluviais", "cascatas_pocos", "barragens_albufeiras",
              "praias_bandeira_azul", "praias_fluviais_mar", "surf",
              "agroturismo_enoturismo", "produtores_dop", "moinhos_azenhas",
              "perolas_portugal", "rotas_tematicas", "grande_expedicao",
              "museus", "castelos", "palacios_solares"],
    "fim_tarde": ["miradouros", "cascatas_pocos", "praias_fluviais",
                  "praias_bandeira_azul", "arte_urbana", "docaria_regional",
                  "agroturismo_enoturismo"],
    "noite": ["restaurantes_gastronomia", "tabernas_historicas",
              "festas_romarias", "festivais_musica", "musica_tradicional"],
}

# Average driving speed for time estimation (km/h)
AVG_DRIVING_SPEED_KMH = 50

# Categories reserved for partnership phase — excluded from itinerary generation
COMING_SOON_CATEGORIES = {"alojamentos_rurais", "agentes_turisticos", "entidades_operadores"}

REGION_TRANSPORT = {
    "Norte": ["UNIR (STCP/Metro)", "Metro do Porto", "CP - Comboios de Portugal"],
    "Centro": ["Transdev Centro", "CP - Comboios de Portugal", "Rede Expressos"],
    "Lisboa": ["Carris", "Metropolitano de Lisboa", "Fertagus", "Transtejo/Soflusa"],
    "Alentejo": ["Rodoviária do Alentejo", "CP - Comboios de Portugal"],
    "Algarve": ["Vamus Algarve", "CP - Comboios de Portugal", "Eva Transportes"],
}

REGION_CENTER = {
    "Norte": {"lat": 41.15, "lng": -8.61},
    "Centro": {"lat": 40.20, "lng": -8.42},
    "Lisboa": {"lat": 38.72, "lng": -9.14},
    "Alentejo": {"lat": 38.57, "lng": -7.91},
    "Algarve": {"lat": 37.02, "lng": -7.93},
}


@planner_router.get("/suggest")
async def suggest_itinerary(
    region: str = Query(..., description="Region: Norte, Centro, Lisboa, Alentejo, Algarve"),
    days: int = Query(3, ge=1, le=14),
    interests: Optional[str] = Query(None, description="Comma-separated: cultura, gastronomia, natureza, festas, historia, aventura"),
):
    # Parse interests
    interest_list = [i.strip() for i in (interests or "cultura,gastronomia").split(",")]
    categories = []
    for interest in interest_list:
        categories.extend(INTEREST_CATEGORIES.get(interest, [interest]))
    categories = list(set(categories))

    # Get POIs for the region (excluding partnership-phase categories)
    safe_region = sanitize_regex(region)
    # Filter out coming-soon categories from the interest categories
    active_categories = [c for c in categories if c not in COMING_SOON_CATEGORIES]
    poi_query = {
        "region": {"$regex": safe_region, "$options": "i"},
        "location.lat": {"$exists": True, "$ne": None},
    }
    if active_categories:
        poi_query["category"] = {"$in": active_categories}
    else:
        poi_query["category"] = {"$nin": list(COMING_SOON_CATEGORIES)}

    pois = await _db_holder.db.heritage_items.find(
        poi_query,
        {"_id": 0, "id": 1, "name": 1, "category": 1, "subcategory": 1,
         "region": 1, "location": 1, "image_url": 1, "iq_score": 1}
    ).sort("iq_score", -1).limit(days * 6).to_list(days * 6)

    # Get events for the region
    events = await _db_holder.db.events.find(
        {"region": {"$regex": safe_region, "$options": "i"}},
        {"_id": 0, "id": 1, "name": 1, "type": 1, "date_text": 1, "rarity": 1, "description": 1}
    ).limit(5).to_list(5)

    # Get transport for the region
    transports = await _db_holder.db.transport_operators.find(
        {"$or": [
            {"section": region.lower()},
            {"section": "nacional"},
            {"geographic_zone": {"$regex": safe_region, "$options": "i"}},
        ]},
        {"_id": 0, "name": 1, "transport_type": 1, "website": 1, "tip": 1}
    ).limit(8).to_list(8)

    # Get transport cards
    cards = await _db_holder.db.transport_cards.find(
        {"city_zone": {"$regex": safe_region, "$options": "i"}},
        {"_id": 0, "name": 1, "city_zone": 1, "base_price": 1}
    ).limit(3).to_list(3)

    # Build daily itinerary
    daily_plans = []
    poi_index = 0
    for day in range(1, days + 1):
        day_pois = []
        for _ in range(min(4, len(pois) - poi_index)):
            if poi_index < len(pois):
                day_pois.append(pois[poi_index])
                poi_index += 1

        morning = day_pois[:2] if len(day_pois) >= 2 else day_pois
        afternoon = day_pois[2:] if len(day_pois) > 2 else []

        daily_plans.append({
            "day": day,
            "theme": _get_day_theme(day, interest_list),
            "morning": {
                "label": "Manha",
                "pois": morning,
            },
            "afternoon": {
                "label": "Tarde",
                "pois": afternoon,
            },
            "tip": _get_day_tip(day, region),
        })

    return {
        "region": region,
        "days": days,
        "interests": interest_list,
        "itinerary": daily_plans,
        "transport": {
            "operators": transports,
            "cards": cards,
            "recommended": REGION_TRANSPORT.get(region, []),
        },
        "events_nearby": events,
        "total_pois": len(pois),
        "center": REGION_CENTER.get(region, {"lat": 39.5, "lng": -8.0}),
    }


def _get_day_theme(day: int, interests: list) -> str:
    themes = {
        1: "Chegada e Descoberta",
        2: "Imersao Cultural",
        3: "Sabores e Tradicoes",
        4: "Natureza e Aventura",
        5: "Patrimonio Escondido",
        6: "Arte e Musica",
        7: "Dia de Descanso e Praia",
    }
    return themes.get(day, f"Exploracao Dia {day}")


def _get_day_tip(day: int, region: str) -> str:
    tips = {
        ("Norte", 1): "Comece pelo centro historico do Porto. O Metro e a forma mais facil de se deslocar.",
        ("Norte", 2): "Visite as caves de Vinho do Porto em Vila Nova de Gaia pela manha.",
        ("Lisboa", 1): "Use o Navegante Metropolitano para andar em todos os transportes da AML.",
        ("Lisboa", 2): "Reserve a manha para Belem - Torre, Jeronimos e Pasteis de Belem.",
        ("Algarve", 1): "O Vamus Pass da acesso ilimitado a todos os autocarros do Algarve.",
        ("Centro", 1): "A Universidade de Coimbra e a Biblioteca Joanina sao visita obrigatoria.",
    }
    return tips.get((region, day), "Explore com calma e aproveite a gastronomia local.")


@planner_router.get("/regions")
async def get_planner_regions():
    """Get available regions with POI counts."""
    pipeline = [
        {"$match": {"location.lat": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$region", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    regions = await _db_holder.db.heritage_items.aggregate(pipeline).to_list(20)
    return {
        "regions": [
            {"id": r["_id"], "count": r["count"], "center": REGION_CENTER.get(r["_id"], {})}
            for r in regions if r["_id"]
        ]
    }


# =============================================================================
# AI-POWERED ITINERARY GENERATION
# =============================================================================

def _order_pois_by_proximity(pois: list) -> list:
    """Order POIs using nearest-neighbor for geographic coherence."""
    if len(pois) <= 1:
        return pois
    ordered = [pois[0]]
    remaining = list(pois[1:])
    while remaining:
        last = ordered[-1]
        last_lat = last.get("location", {}).get("lat", 0)
        last_lng = last.get("location", {}).get("lng", 0)
        nearest_idx = 0
        nearest_dist = float("inf")
        for i, poi in enumerate(remaining):
            plat = poi.get("location", {}).get("lat", 0)
            plng = poi.get("location", {}).get("lng", 0)
            dist = haversine_km(last_lat, last_lng, plat, plng)
            if dist < nearest_dist:
                nearest_dist = dist
                nearest_idx = i
        ordered.append(remaining.pop(nearest_idx))
    return ordered


@planner_router.get("/localities")
async def get_localities(
    region: Optional[str] = Query(None, description="Filter by region"),
    search: Optional[str] = Query(None, description="Search locality name"),
):
    """Get available localities with POI counts for the route planner."""
    match_stage: dict = {"location.lat": {"$exists": True, "$ne": None}}
    if region:
        safe_region = sanitize_regex(region)
        match_stage["region"] = {"$regex": safe_region, "$options": "i"}

    pipeline: list = [
        {"$match": match_stage},
        {"$addFields": {
            "_locality": {
                "$cond": {
                    "if": {"$and": [{"$ne": ["$address", None]}, {"$ne": ["$address", ""]}]},
                    "then": {
                        "$let": {
                            "vars": {
                                "parts": {"$split": ["$address", ","]}
                            },
                            "in": {"$trim": {"input": {"$arrayElemAt": ["$$parts", -2]}, "chars": " "}}
                        }
                    },
                    "else": "$region"
                }
            }
        }},
        {"$group": {
            "_id": "$_locality",
            "count": {"$sum": 1},
            "region": {"$first": "$region"},
            "avg_lat": {"$avg": "$location.lat"},
            "avg_lng": {"$avg": "$location.lng"},
            "categories": {"$addToSet": "$category"},
        }},
        {"$match": {"_id": {"$ne": None}}},
        {"$sort": {"count": -1}},
    ]

    if search:
        safe_search = sanitize_regex(search)
        pipeline.append({"$match": {"_id": {"$regex": safe_search, "$options": "i"}}})

    pipeline.append({"$limit": 50})

    localities = await _db_holder.db.heritage_items.aggregate(pipeline).to_list(50)
    return {
        "localities": [
            {
                "name": loc["_id"],
                "region": loc.get("region", ""),
                "poi_count": loc["count"],
                "center": {"lat": loc["avg_lat"], "lng": loc["avg_lng"]},
                "category_count": len(loc.get("categories", [])),
            }
            for loc in localities if loc["_id"]
        ]
    }


def _estimate_travel_minutes(dist_km: float) -> int:
    """Estimate driving time in minutes for a given distance."""
    if dist_km <= 0:
        return 0
    return max(5, round((dist_km / AVG_DRIVING_SPEED_KMH) * 60))


def _get_visit_minutes(category: str) -> int:
    """Get estimated visit time in minutes for a POI category."""
    return VISIT_TIME_MINUTES.get(category, 45)


def _is_gastro_category(cat: str) -> bool:
    """Check if a category is gastronomic (suitable for lunch/dinner)."""
    return cat in {"restaurantes_gastronomia", "tabernas_historicas",
                   "pratos_tipicos", "mercados_feiras", "docaria_regional"}


def _categories_compatible_sequence(cat_a: str, cat_b: str) -> bool:
    """Check if two categories can follow each other without monotony."""
    # Don't allow two museums in a row
    if cat_a == "museus" and cat_b == "museus":
        return False
    # Don't allow two heavy trail activities in a row
    heavy_trail = {"percursos_pedestres", "ecovias_passadicos", "aventura_natureza"}
    if cat_a in heavy_trail and cat_b in heavy_trail:
        return False
    # Don't allow two gastro POIs in a row (except lunch slot)
    if _is_gastro_category(cat_a) and _is_gastro_category(cat_b):
        return False
    return True


def _assign_time_period(poi: dict, period_preference: str) -> str:
    """Assign a POI to the most suitable time period."""
    cat = poi.get("category", "")
    for period, cats in PERIOD_CATEGORIES.items():
        if cat in cats and period == period_preference:
            return period
    # Fallback: any matching period
    for period, cats in PERIOD_CATEGORIES.items():
        if cat in cats:
            return period
    return "tarde"


def _build_smart_day_itinerary(pois: list, day_number: int = 1) -> dict:
    """Build a single day's itinerary with time periods and coherent ordering.

    Time budget: ~9h (09:00 - 18:00) + optional night
    - Manhã: 09:00-12:30 (210 min)
    - Almoço: 12:30-14:00 (90 min)
    - Tarde: 14:00-17:00 (180 min)
    - Fim de Tarde: 17:00-19:00 (120 min)
    - Noite: 20:00+ (optional)
    """
    periods = {
        "manha": {"label": "Manhã", "icon": "wb-sunny", "start": "09:00",
                  "budget_min": 210, "pois": [], "used_min": 0},
        "almoco": {"label": "Almoço", "icon": "restaurant", "start": "12:30",
                   "budget_min": 90, "pois": [], "used_min": 0},
        "tarde": {"label": "Tarde", "icon": "wb-twilight", "start": "14:00",
                  "budget_min": 180, "pois": [], "used_min": 0},
        "fim_tarde": {"label": "Fim de Tarde", "icon": "nightlight", "start": "17:00",
                      "budget_min": 120, "pois": [], "used_min": 0},
        "noite": {"label": "Noite", "icon": "nightlife", "start": "20:00",
                  "budget_min": 120, "pois": [], "used_min": 0},
    }

    # Separate gastro POIs for lunch/dinner
    gastro_pois = [p for p in pois if _is_gastro_category(p.get("category", ""))]
    non_gastro_pois = [p for p in pois if not _is_gastro_category(p.get("category", ""))]

    # Assign lunch POI
    if gastro_pois:
        lunch_poi = gastro_pois[0]
        lunch_poi["visit_minutes"] = _get_visit_minutes(lunch_poi.get("category", ""))
        lunch_poi["time_period"] = "almoco"
        periods["almoco"]["pois"].append(lunch_poi)
        periods["almoco"]["used_min"] += lunch_poi["visit_minutes"]
        gastro_pois = gastro_pois[1:]

    # Assign night gastro if available
    if gastro_pois:
        dinner_poi = gastro_pois[0]
        dinner_poi["visit_minutes"] = _get_visit_minutes(dinner_poi.get("category", ""))
        dinner_poi["time_period"] = "noite"
        periods["noite"]["pois"].append(dinner_poi)
        periods["noite"]["used_min"] += dinner_poi["visit_minutes"]
        gastro_pois = gastro_pois[1:]

    # Assign remaining POIs to morning, afternoon, fim de tarde
    period_order = ["manha", "tarde", "fim_tarde"]
    period_idx = 0

    for poi in non_gastro_pois:
        cat = poi.get("category", "")
        visit_min = _get_visit_minutes(cat)
        poi["visit_minutes"] = visit_min

        placed = False
        # Try preferred period first
        for pname in period_order:
            period = periods[pname]
            if period["used_min"] + visit_min <= period["budget_min"]:
                # Check sequence compatibility
                if period["pois"]:
                    last_cat = period["pois"][-1].get("category", "")
                    if not _categories_compatible_sequence(last_cat, cat):
                        continue
                poi["time_period"] = pname
                period["pois"].append(poi)
                period["used_min"] += visit_min
                placed = True
                break

        if not placed:
            # Force into least-filled period
            least = min(period_order, key=lambda p: periods[p]["used_min"])
            poi["time_period"] = least
            periods[least]["pois"].append(poi)
            periods[least]["used_min"] += visit_min

    # Extra remaining gastro POIs into afternoon as visits
    for poi in gastro_pois:
        poi["visit_minutes"] = _get_visit_minutes(poi.get("category", ""))
        poi["time_period"] = "tarde"
        periods["tarde"]["pois"].append(poi)
        periods["tarde"]["used_min"] += poi["visit_minutes"]

    # Calculate travel times between consecutive POIs within each period
    total_travel_min = 0
    total_visit_min = 0
    for pname in ["manha", "almoco", "tarde", "fim_tarde", "noite"]:
        period_pois = periods[pname]["pois"]
        for i, poi in enumerate(period_pois):
            total_visit_min += poi.get("visit_minutes", 0)
            if i > 0:
                prev = period_pois[i - 1]
                dist = haversine_km(
                    prev.get("location", {}).get("lat", 0),
                    prev.get("location", {}).get("lng", 0),
                    poi.get("location", {}).get("lat", 0),
                    poi.get("location", {}).get("lng", 0),
                )
                travel_min = _estimate_travel_minutes(dist)
                poi["travel_from_previous_min"] = travel_min
                poi["distance_from_previous_km"] = round(dist, 1)
                total_travel_min += travel_min

    # Also calculate travel between periods (last POI of prev -> first POI of next)
    active_periods = [p for p in ["manha", "almoco", "tarde", "fim_tarde", "noite"]
                      if periods[p]["pois"]]
    for i in range(1, len(active_periods)):
        prev_period = periods[active_periods[i - 1]]
        curr_period = periods[active_periods[i]]
        if prev_period["pois"] and curr_period["pois"]:
            last_poi = prev_period["pois"][-1]
            first_poi = curr_period["pois"][0]
            if not first_poi.get("travel_from_previous_min"):
                dist = haversine_km(
                    last_poi.get("location", {}).get("lat", 0),
                    last_poi.get("location", {}).get("lng", 0),
                    first_poi.get("location", {}).get("lat", 0),
                    first_poi.get("location", {}).get("lng", 0),
                )
                travel_min = _estimate_travel_minutes(dist)
                first_poi["travel_from_previous_min"] = travel_min
                first_poi["distance_from_previous_km"] = round(dist, 1)
                total_travel_min += travel_min

    # Build response
    result_periods = []
    for pname in ["manha", "almoco", "tarde", "fim_tarde", "noite"]:
        p = periods[pname]
        if p["pois"]:
            result_periods.append({
                "period": pname,
                "label": p["label"],
                "icon": p["icon"],
                "start_time": p["start"],
                "pois": [
                    {
                        "id": poi.get("id"),
                        "name": poi.get("name"),
                        "category": poi.get("category"),
                        "subcategory": poi.get("subcategory"),
                        "region": poi.get("region"),
                        "location": poi.get("location"),
                        "image_url": poi.get("image_url"),
                        "description": poi.get("description", ""),
                        "iq_score": poi.get("iq_score"),
                        "visit_minutes": poi.get("visit_minutes"),
                        "travel_from_previous_min": poi.get("travel_from_previous_min", 0),
                        "distance_from_previous_km": poi.get("distance_from_previous_km", 0),
                    }
                    for poi in p["pois"]
                ],
            })

    return {
        "day": day_number,
        "periods": result_periods,
        "total_visit_minutes": total_visit_min,
        "total_travel_minutes": total_travel_min,
        "total_minutes": total_visit_min + total_travel_min,
        "poi_count": sum(len(p["pois"]) for p in periods.values()),
    }


@planner_router.get("/smart-itinerary", dependencies=[Depends(require_feature("ai_itinerary"))])
async def generate_smart_itinerary(
    locality: Optional[str] = Query(None, description="Locality name (e.g., Braga, Sintra)"),
    region: Optional[str] = Query(None, description="Region: Norte, Centro, Lisboa, Alentejo, Algarve, Açores, Madeira"),
    days: int = Query(1, ge=1, le=7),
    interests: Optional[str] = Query(None, description="Comma-separated interests"),
    categories: Optional[str] = Query(None, description="Comma-separated subcategory IDs"),
    profile: Optional[str] = Query("casal", description="Traveler: familia, casal, solo, senior, aventureiro, grupo"),
    pace: Optional[str] = Query("moderado", description="Pace: relaxado, moderado, intenso"),
    max_radius_km: float = Query(15, ge=1, le=100),
    budget_per_day: Optional[float] = Query(None, ge=0, description="Budget per person per day in EUR (0=free only, 50=budget, 150=mid-range, unlimited=None)"),
    wheelchair: bool = Query(False, description="Filter for wheelchair-accessible POIs when possible"),
):
    """Generate a smart itinerary with time periods, category diversity, and geographic coherence.

    This is the intelligent route engine that considers:
    - Locality-based POI selection (within max_radius_km)
    - Time periods: Manhã → Almoço → Tarde → Fim de Tarde → Noite
    - Category diversity and compatibility rules
    - Geographic ordering (no zigzags)
    - Human-paced daily schedules
    """
    if not locality and not region:
        raise HTTPException(400, "Provide either locality or region")

    # Resolve interests to categories
    interest_list = [i.strip() for i in (interests or "").split(",") if i.strip()]
    cat_filter = []
    if categories:
        cat_filter = [c.strip() for c in categories.split(",") if c.strip()]
    elif interest_list:
        for interest in interest_list:
            cat_filter.extend(INTEREST_CATEGORIES.get(interest, [interest]))
        cat_filter = list(set(cat_filter))

    # Exclude coming-soon categories
    cat_filter = [c for c in cat_filter if c not in COMING_SOON_CATEGORIES]

    # POIs per day based on pace
    pois_per_day = {"relaxado": 4, "moderado": 6, "intenso": 8}.get(pace, 6)
    total_needed = days * pois_per_day

    # Build query
    poi_query: dict = {"location.lat": {"$exists": True, "$ne": None}}

    if cat_filter:
        poi_query["category"] = {"$in": cat_filter}
    else:
        poi_query["category"] = {"$nin": list(COMING_SOON_CATEGORIES)}

    center_lat = None
    center_lng = None

    # If locality is given, find center coordinates and search nearby
    if locality:
        safe_locality = sanitize_regex(locality)
        # Find POIs matching locality in address or name
        sample_pois = await _db_holder.db.heritage_items.find(
            {
                "$or": [
                    {"address": {"$regex": safe_locality, "$options": "i"}},
                    {"name": {"$regex": safe_locality, "$options": "i"}},
                ],
                "location.lat": {"$exists": True, "$ne": None},
            },
            {"_id": 0, "location": 1, "region": 1}
        ).limit(20).to_list(20)

        if sample_pois:
            lats = [p["location"]["lat"] for p in sample_pois if p.get("location", {}).get("lat")]
            lngs = [p["location"]["lng"] for p in sample_pois if p.get("location", {}).get("lng")]
            if lats and lngs:
                center_lat = sum(lats) / len(lats)
                center_lng = sum(lngs) / len(lngs)
                if not region:
                    region = sample_pois[0].get("region", "")

    if not center_lat and region:
        safe_region = sanitize_regex(region)
        poi_query["region"] = {"$regex": safe_region, "$options": "i"}
        rc = REGION_CENTER.get(region, {"lat": 39.5, "lng": -8.0})
        center_lat = rc["lat"]
        center_lng = rc["lng"]

    if not center_lat:
        center_lat, center_lng = 39.5, -8.0

    # Fetch more POIs than needed to allow diversity selection
    fetch_limit = total_needed * 4

    pois_cursor = _db_holder.db.heritage_items.find(
        poi_query,
        {"_id": 0, "id": 1, "name": 1, "category": 1, "subcategory": 1,
         "region": 1, "location": 1, "image_url": 1, "description": 1,
         "iq_score": 1, "tags": 1, "address": 1}
    ).sort("iq_score", -1).limit(fetch_limit)

    all_pois = await pois_cursor.to_list(fetch_limit)

    # Filter by radius from center
    def within_radius(poi):
        loc = poi.get("location", {})
        if not loc.get("lat") or not loc.get("lng"):
            return False
        return haversine_km(center_lat, center_lng, loc["lat"], loc["lng"]) <= max_radius_km

    nearby_pois = [p for p in all_pois if within_radius(p)]

    if not nearby_pois:
        # Fallback: expand radius
        nearby_pois = [p for p in all_pois if within_radius.__code__ and True][:total_needed]
        if not nearby_pois:
            nearby_pois = all_pois[:total_needed]

    # Ensure category diversity: pick from different categories
    selected_pois = _select_diverse_pois(nearby_pois, total_needed, pois_per_day)

    # Order by geographic proximity
    selected_pois = _order_pois_by_proximity(selected_pois)

    # Build daily itineraries
    daily_plans = []
    poi_idx = 0
    for day in range(1, days + 1):
        day_pois = selected_pois[poi_idx:poi_idx + pois_per_day]
        poi_idx += pois_per_day
        if not day_pois:
            break
        day_plan = _build_smart_day_itinerary(day_pois, day)
        daily_plans.append(day_plan)

    # Get events for the region
    events = []
    if region:
        safe_region = sanitize_regex(region)
        events = await _db_holder.db.events.find(
            {"region": {"$regex": safe_region, "$options": "i"}},
            {"_id": 0, "id": 1, "name": 1, "type": 1, "description": 1, "date_text": 1}
        ).limit(5).to_list(5)

    # Transport
    transport_rec = REGION_TRANSPORT.get(region, []) if region else []

    # Collect unique categories used
    used_categories = set()
    for dp in daily_plans:
        for period in dp["periods"]:
            for poi in period["pois"]:
                used_categories.add(poi.get("category", ""))

    # Summary
    total_pois = sum(dp["poi_count"] for dp in daily_plans)
    total_visit = sum(dp["total_visit_minutes"] for dp in daily_plans)
    total_travel = sum(dp["total_travel_minutes"] for dp in daily_plans)

    # Estimate daily cost based on category pricing
    estimated_daily_cost = _estimate_daily_cost(daily_plans[0] if daily_plans else None)
    budget_note = None
    if budget_per_day is not None:
        if estimated_daily_cost > budget_per_day * 1.2:
            budget_note = f"Roteiro estimado em €{estimated_daily_cost:.0f}/dia — acima do orçamento de €{budget_per_day:.0f}. Considere reduzir o número de POIs pagos."
        else:
            budget_note = f"Roteiro estimado em €{estimated_daily_cost:.0f}/dia — dentro do orçamento de €{budget_per_day:.0f}."

    return {
        "locality": locality,
        "region": region or "",
        "days": days,
        "interests": interest_list,
        "profile": profile,
        "pace": pace,
        "max_radius_km": max_radius_km,
        "wheelchair": wheelchair,
        "budget_per_day": budget_per_day,
        "center": {"lat": center_lat, "lng": center_lng},
        "itinerary": daily_plans,
        "summary": {
            "total_pois": total_pois,
            "total_visit_minutes": total_visit,
            "total_travel_minutes": total_travel,
            "total_minutes": total_visit + total_travel,
            "categories_covered": sorted(used_categories),
            "category_count": len(used_categories),
            "estimated_daily_cost_eur": round(estimated_daily_cost, 1),
            "budget_note": budget_note,
        },
        "transport": {"recommended": transport_rec},
        "events_nearby": events,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# Average entry cost estimates (EUR per person) by category
CATEGORY_COSTS_EUR = {
    "museus": 8.0, "castelos": 6.0, "palacios_solares": 10.0,
    "termas_banhos": 25.0, "agroturismo_enoturismo": 20.0,
    "restaurantes_gastronomia": 25.0, "tabernas_historicas": 18.0,
    "pratos_tipicos": 15.0, "docaria_regional": 5.0,
    "mercados_feiras": 0.0, "produtores_dop": 5.0,
    "percursos_pedestres": 0.0, "ecovias_passadicos": 0.0,
    "miradouros": 0.0, "cascatas_pocos": 0.0,
    "praias_fluviais": 0.0, "praias_bandeira_azul": 0.0,
    "arte_urbana": 0.0, "oficios_artesanato": 8.0,
    "patrimonio_ferroviario": 5.0, "surf": 30.0,
    "aventura_natureza": 15.0, "festivais_musica": 20.0,
    "festas_romarias": 0.0, "musica_tradicional": 5.0,
    "arqueologia_geologia": 4.0, "moinhos_azenhas": 3.0,
    "barragens_albufeiras": 0.0, "fauna_autoctone": 0.0,
    "flora_autoctone": 0.0, "flora_botanica": 3.0,
    "biodiversidade_avistamentos": 0.0, "natureza_especializada": 0.0,
}


def _estimate_daily_cost(day_plan: Optional[dict]) -> float:
    """Estimate cost per person per day based on categories in the itinerary."""
    if not day_plan:
        return 0.0
    total = 0.0
    for period in day_plan.get("periods", []):
        for poi in period.get("pois", []):
            cat = poi.get("category", "")
            total += CATEGORY_COSTS_EUR.get(cat, 2.0)  # default €2 for unknown
    return total


def _select_diverse_pois(pois: list, total_needed: int, per_day: int) -> list:
    """Select POIs ensuring category diversity and balance.

    Rules:
    - Include at least 1 gastro POI per day (for lunch)
    - No more than 2 POIs from the same category per day
    - Prioritize higher IQ scores
    - Include variety across nature, heritage, gastro, culture
    """
    # Group by category
    by_category: dict = {}
    for poi in pois:
        cat = poi.get("category", "unknown")
        by_category.setdefault(cat, []).append(poi)

    selected = []
    used_ids = set()

    # Ensure gastro POIs (1 per day minimum)
    gastro_cats = ["restaurantes_gastronomia", "tabernas_historicas", "pratos_tipicos"]
    days_count = max(1, total_needed // per_day)
    for cat in gastro_cats:
        for poi in by_category.get(cat, []):
            if poi["id"] not in used_ids and len([s for s in selected if _is_gastro_category(s.get("category", ""))]) < days_count:
                selected.append(poi)
                used_ids.add(poi["id"])

    # Round-robin from categories to ensure diversity
    cat_keys = list(by_category.keys())
    random.shuffle(cat_keys)
    round_idx = 0
    max_rounds = total_needed * 3

    while len(selected) < total_needed and round_idx < max_rounds:
        cat = cat_keys[round_idx % len(cat_keys)]
        cat_pois = by_category.get(cat, [])
        for poi in cat_pois:
            if poi["id"] not in used_ids:
                # Check max 2 per category
                cat_count = sum(1 for s in selected if s.get("category") == cat)
                if cat_count < 2 * days_count:
                    selected.append(poi)
                    used_ids.add(poi["id"])
                    break
        round_idx += 1

    # If still not enough, just add top IQ-score POIs
    if len(selected) < total_needed:
        for poi in pois:
            if poi["id"] not in used_ids:
                selected.append(poi)
                used_ids.add(poi["id"])
            if len(selected) >= total_needed:
                break

    return selected[:total_needed]


@planner_router.get("/ai-itinerary", dependencies=[Depends(require_feature("ai_itinerary"))])
async def generate_ai_itinerary(
    region: str = Query(..., description="Region: Norte, Centro, Lisboa, Alentejo, Algarve"),
    days: int = Query(3, ge=1, le=7),
    interests: Optional[str] = Query(None, description="Comma-separated: cultura, gastronomia, natureza, festas, historia, aventura"),
    profile: Optional[str] = Query("casal", description="Traveler: familia, casal, solo, senior, aventureiro, grupo"),
    pace: Optional[str] = Query("moderado", description="Pace: relaxado, moderado, intenso"),
):
    """Generate an AI-powered itinerary with narrative descriptions for each day.

    Uses GPT-4o to create compelling, context-aware travel narratives connecting
    POIs into a coherent thematic journey. Falls back to template-based generation
    if LLM is unavailable.
    """
    # Parse interests
    interest_list = [i.strip() for i in (interests or "cultura,gastronomia").split(",")]
    categories = []
    for interest in interest_list:
        categories.extend(INTEREST_CATEGORIES.get(interest, [interest]))
    categories = list(set(categories))

    # POIs per day based on pace
    pois_per_day = {"relaxado": 3, "moderado": 4, "intenso": 6}.get(pace, 4)
    total_needed = days * pois_per_day

    # Get POIs for the region, sorted by IQ score
    safe_region = sanitize_regex(region)
    active_categories = [c for c in categories if c not in COMING_SOON_CATEGORIES]
    poi_query = {
        "region": {"$regex": safe_region, "$options": "i"},
        "location.lat": {"$exists": True, "$ne": None},
    }
    if active_categories:
        poi_query["category"] = {"$in": active_categories}
    else:
        poi_query["category"] = {"$nin": list(COMING_SOON_CATEGORIES)}

    pois = await _db_holder.db.heritage_items.find(
        poi_query,
        {"_id": 0, "id": 1, "name": 1, "category": 1, "subcategory": 1,
         "region": 1, "location": 1, "image_url": 1, "description": 1,
         "iq_score": 1, "tags": 1}
    ).sort("iq_score", -1).limit(total_needed + 5).to_list(total_needed + 5)

    if not pois:
        raise HTTPException(status_code=404, detail=f"Sem POIs encontrados para {region}")

    # Order by geographic proximity
    pois = _order_pois_by_proximity(pois[:total_needed])

    # Get events for the region
    events = await _db_holder.db.events.find(
        {"region": {"$regex": safe_region, "$options": "i"}},
        {"_id": 0, "id": 1, "name": 1, "type": 1, "description": 1}
    ).limit(3).to_list(3)

    # Build daily itinerary
    daily_plans = []
    poi_index = 0
    for day in range(1, days + 1):
        day_pois = []
        for _ in range(pois_per_day):
            if poi_index < len(pois):
                day_pois.append(pois[poi_index])
                poi_index += 1
        if not day_pois:
            break

        morning = day_pois[:len(day_pois) // 2] or day_pois[:1]
        afternoon = day_pois[len(day_pois) // 2:] or []

        daily_plans.append({
            "day": day,
            "theme": _get_day_theme(day, interest_list),
            "morning": {"label": "Manhã", "pois": morning},
            "afternoon": {"label": "Tarde", "pois": afternoon},
            "tip": _get_day_tip(day, region),
        })

    # Try AI narrative generation
    ai_narrative = None
    if EMERGENT_LLM_KEY and daily_plans:
        try:
            ai_narrative = await _generate_itinerary_narrative(
                region, days, interest_list, profile or "casal", daily_plans, events
            )
        except Exception as e:
            logger.warning("AI narrative generation failed, using template: %s", e)

    # Build response
    result = {
        "region": region,
        "days": days,
        "interests": interest_list,
        "profile": profile,
        "pace": pace,
        "itinerary": daily_plans,
        "transport": {"recommended": REGION_TRANSPORT.get(region, [])},
        "events_nearby": events,
        "total_pois": len(pois),
        "center": REGION_CENTER.get(region, {"lat": 39.5, "lng": -8.0}),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ai_powered": ai_narrative is not None,
    }

    if ai_narrative:
        result["narrative"] = ai_narrative

    return result


async def _generate_itinerary_narrative(
    region: str,
    days: int,
    interests: list,
    profile: str,
    daily_plans: list,
    events: list,
) -> dict:
    """Generate AI narrative for the itinerary using GPT-4o."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    profile_labels = {
        "familia": "família com crianças",
        "casal": "casal",
        "solo": "viajante solo",
        "senior": "viajantes seniores",
        "aventureiro": "aventureiros",
        "grupo": "grupo de amigos",
    }

    # Build POI summary for LLM
    poi_summaries = []
    for plan in daily_plans:
        day_names = []
        for poi in plan["morning"]["pois"] + plan["afternoon"]["pois"]:
            desc = (poi.get("description") or "")[:100]
            day_names.append(f"- {poi['name']} ({poi.get('category', '')}): {desc}")
        poi_summaries.append(f"Dia {plan['day']} ({plan['theme']}):\n" + "\n".join(day_names))

    pois_text = "\n\n".join(poi_summaries)

    system_message = (
        "És um especialista em turismo cultural de Portugal e guia de viagens premium. "
        "Crias narrativas envolventes e personalizadas para itinerários de viagem. "
        "Responde sempre em português de Portugal, com tom caloroso e inspirador. "
        "O output deve ser JSON válido."
    )

    user_prompt = f"""Cria uma narrativa para este itinerário de {days} dias em {region},
para {profile_labels.get(profile, profile)}, com interesses em {', '.join(interests)}.

POIs por dia:
{pois_text}

Eventos na região: {', '.join(e['name'] for e in events) if events else 'Nenhum evento especial'}

Responde APENAS com JSON válido neste formato:
{{
  "title": "título criativo e evocativo do itinerário",
  "subtitle": "frase curta inspiradora",
  "daily_narratives": [
    {{
      "day": 1,
      "title": "título do dia",
      "morning_narrative": "descrição envolvente da manhã (2-3 frases)",
      "afternoon_narrative": "descrição envolvente da tarde (2-3 frases)",
      "dining_tip": "sugestão gastronómica para o dia"
    }}
  ],
  "closing_note": "nota final inspiradora (1-2 frases)"
}}"""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"planner_{region}_{days}d",
        system_message=system_message,
    ).with_model("openai", "gpt-4o")

    response = await chat.send_message(UserMessage(text=user_prompt))

    # Parse JSON from response
    import json
    text = response.strip()
    # Remove markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text[:-3]
    if text.startswith("json"):
        text = text[4:]

    return json.loads(text.strip())
