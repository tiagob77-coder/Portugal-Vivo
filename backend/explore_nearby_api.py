"""
Explorar Perto de Mim API - Proximity-based POI discovery for tourists.
Discover nearby points of interest with distance, direction, and walking estimates.
"""
import math
from fastapi import APIRouter, Query
from typing import Optional
from math import radians, cos

from shared_utils import DatabaseHolder, haversine_km

_db_holder = DatabaseHolder("explore_nearby")
set_explore_nearby_db = _db_holder.set
_get_db = _db_holder.get

explore_nearby_router = APIRouter(prefix="/explore-nearby", tags=["Explorar"])


# ========================
# HELPERS
# ========================

def get_cardinal_direction(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> str:
    """Calculate cardinal direction from one point to another."""
    delta_lng = to_lng - from_lng
    delta_lat = to_lat - from_lat
    angle = math.degrees(math.atan2(delta_lng, delta_lat))
    directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    index = round(angle / 45) % 8
    return directions[index]


def _enrich_poi(poi: dict, lat: float, lng: float) -> dict:
    """Enrich a POI with distance, direction, and travel time estimates."""
    loc = poi.get("location", {})
    dist = haversine_km(lat, lng, loc["lat"], loc["lng"])
    poi["distance_km"] = round(dist, 2)
    poi["distance_m"] = round(dist * 1000)
    poi["direction"] = get_cardinal_direction(lat, lng, loc["lat"], loc["lng"])
    poi["walking_minutes"] = round((dist / 5.0) * 60)
    poi["driving_minutes"] = round((dist / 40.0) * 60)
    desc = poi.get("description") or ""
    poi["description"] = desc[:120] + ("..." if len(desc) > 120 else "")
    return poi


async def _fetch_candidates(lat: float, lng: float, radius_km: float,
                            categories: Optional[str] = None,
                            max_candidates: int = 500) -> list:
    """Fetch POI candidates within a bounding box, optionally filtered by category."""
    query = {"location.lat": {"$exists": True, "$ne": None}}

    if categories:
        cat_list = [c.strip() for c in categories.split(",") if c.strip()]
        if cat_list:
            query["category"] = {"$in": cat_list}

    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * cos(radians(lat)))
    query["location.lat"] = {"$gte": lat - lat_delta, "$lte": lat + lat_delta}
    query["location.lng"] = {"$gte": lng - lng_delta, "$lte": lng + lng_delta}

    projection = {
        "_id": 0, "id": 1, "name": 1, "category": 1, "region": 1,
        "location": 1, "iq_score": 1, "image_url": 1, "description": 1,
        "visit_count": 1,
    }

    db = _get_db()
    candidates = await db.heritage_items.find(query, projection).limit(max_candidates).to_list(max_candidates)

    results = []
    for poi in candidates:
        loc = poi.get("location", {})
        if not loc.get("lat") or not loc.get("lng"):
            continue
        dist = haversine_km(lat, lng, loc["lat"], loc["lng"])
        if dist <= radius_km:
            _enrich_poi(poi, lat, lng)
            results.append(poi)

    return results


# ========================
# ENDPOINTS
# ========================

@explore_nearby_router.get("/discover")
async def discover_nearby(
    lat: float = Query(..., ge=-90, le=90, description="Latitude atual"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude atual"),
    radius_km: float = Query(5.0, ge=0.1, le=50, description="Raio de pesquisa em km"),
    categories: Optional[str] = Query(None, description="Categorias separadas por virgula"),
    limit: int = Query(20, ge=1, le=50, description="Numero maximo de resultados"),
    sort_by: str = Query("distance", pattern="^(distance|iq_score|popular)$",
                         description="Ordenar por: distance, iq_score, popular"),
):
    """
    Descobrir POIs perto da localização atual.
    Retorna POIs enriquecidos com distancia, direcao, e tempo estimado a pe/carro.
    Resultados agrupados por categoria.
    """
    results = await _fetch_candidates(lat, lng, radius_km, categories)

    # Sort
    if sort_by == "distance":
        results.sort(key=lambda x: x["distance_km"])
    elif sort_by == "iq_score":
        results.sort(key=lambda x: -(x.get("iq_score") or 0))
    elif sort_by == "popular":
        results.sort(key=lambda x: -(x.get("visit_count") or 0))

    total_found = len(results)
    results = results[:limit]

    # Group by category
    grouped = {}
    for poi in results:
        cat = poi.get("category", "Outro")
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(poi)

    # Categories breakdown
    categories_breakdown = {cat: len(pois) for cat, pois in grouped.items()}

    # Suggest larger radius if few results
    suggested_radius = None
    if total_found < 5 and radius_km < 50:
        for r in [10, 25, 50]:
            if r > radius_km:
                suggested_radius = r
                break

    return {
        "pois": results,
        "grouped_by_category": grouped,
        "summary": {
            "total_found": total_found,
            "returned": len(results),
            "categories_breakdown": categories_breakdown,
            "suggested_radius_km": suggested_radius,
        },
        "center": {"lat": lat, "lng": lng},
        "radius_km": radius_km,
        "sort_by": sort_by,
    }


@explore_nearby_router.get("/highlights")
async def get_highlights(
    lat: float = Query(..., ge=-90, le=90, description="Latitude atual"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude atual"),
    radius_km: float = Query(10.0, ge=0.1, le=50, description="Raio de pesquisa em km"),
):
    """
    Destaques rapidos para a localizacao atual.
    Retorna o POI mais proximo, melhor classificado, joia escondida,
    contagem por categoria, e rota sugerida.
    """
    results = await _fetch_candidates(lat, lng, radius_km)

    if not results:
        return {
            "closest_poi": None,
            "highest_rated": None,
            "hidden_gem": None,
            "categories_nearby": {},
            "suggested_route": [],
            "total_nearby": 0,
        }

    # Closest POI
    results.sort(key=lambda x: x["distance_km"])
    closest_poi = results[0]

    # Highest rated by IQ score
    highest_rated = max(results, key=lambda x: x.get("iq_score") or 0)

    # Hidden gem: good IQ score (>= 40) but few visits
    hidden_gem = None
    gem_candidates = [
        p for p in results
        if (p.get("iq_score") or 0) >= 40 and (p.get("visit_count") or 0) < 50
    ]
    if gem_candidates:
        gem_candidates.sort(key=lambda x: -(x.get("iq_score") or 0))
        hidden_gem = gem_candidates[0]

    # Categories count
    categories_nearby = {}
    for poi in results:
        cat = poi.get("category", "Outro")
        categories_nearby[cat] = categories_nearby.get(cat, 0) + 1

    # Suggested route: top 3-5 POIs for a quick walk (sorted by distance, diverse categories)
    suggested_route = []
    seen_categories = set()
    for poi in results:
        cat = poi.get("category", "Outro")
        if cat not in seen_categories and poi["walking_minutes"] <= 60:
            suggested_route.append(poi)
            seen_categories.add(cat)
        if len(suggested_route) >= 5:
            break
    # Fill remaining slots if we have fewer than 3
    if len(suggested_route) < 3:
        for poi in results:
            if poi not in suggested_route and poi["walking_minutes"] <= 60:
                suggested_route.append(poi)
            if len(suggested_route) >= 5:
                break

    return {
        "closest_poi": closest_poi,
        "highest_rated": highest_rated,
        "hidden_gem": hidden_gem,
        "categories_nearby": categories_nearby,
        "suggested_route": suggested_route[:5],
        "total_nearby": len(results),
    }


@explore_nearby_router.get("/radius-suggest")
async def suggest_radius(
    lat: float = Query(..., ge=-90, le=90, description="Latitude atual"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude atual"),
    min_results: int = Query(5, ge=1, le=50, description="Numero minimo de resultados desejados"),
):
    """
    Sugere o raio ideal com base na densidade de POIs.
    Testa raios crescentes ate encontrar pelo menos min_results POIs.
    """
    test_radii = [1, 2, 5, 10, 25, 50]

    for radius in test_radii:
        results = await _fetch_candidates(lat, lng, radius)
        if len(results) >= min_results:
            return {
                "suggested_radius_km": radius,
                "poi_count": len(results),
                "min_results_requested": min_results,
                "center": {"lat": lat, "lng": lng},
            }

    # Even at max radius, not enough results
    results = await _fetch_candidates(lat, lng, 50)
    return {
        "suggested_radius_km": 50,
        "poi_count": len(results),
        "min_results_requested": min_results,
        "center": {"lat": lat, "lng": lng},
        "note": f"Maximo de {len(results)} POIs encontrados num raio de 50km",
    }


@explore_nearby_router.get("/walking-route")
async def generate_walking_route(
    lat: float = Query(..., ge=-90, le=90, description="Latitude atual"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude atual"),
    max_minutes: int = Query(60, ge=10, le=240, description="Tempo maximo de caminhada em minutos"),
    categories: Optional[str] = Query(None, description="Categorias separadas por virgula"),
):
    """
    Gerar rota a pe a partir da localizacao atual.
    Usa haversine para encontrar POIs alcancaveis a pe e ordena
    por vizinho mais proximo para uma caminhada eficiente.
    """
    # Walking speed: 5 km/h -> max walking distance
    max_walking_km = (max_minutes / 60.0) * 5.0
    results = await _fetch_candidates(lat, lng, max_walking_km, categories)

    if not results:
        return {
            "route": [],
            "total_walking_minutes": 0,
            "total_distance_km": 0,
            "poi_count": 0,
            "center": {"lat": lat, "lng": lng},
        }

    # Nearest-neighbor ordering for efficient walking route
    route = []
    remaining = list(results)
    current_lat, current_lng = lat, lng
    cumulative_minutes = 0
    cumulative_km = 0.0

    while remaining:
        # Find nearest POI to current position
        nearest = min(remaining, key=lambda p: haversine_km(
            current_lat, current_lng,
            p["location"]["lat"], p["location"]["lng"]
        ))

        leg_dist = haversine_km(current_lat, current_lng,
                                nearest["location"]["lat"], nearest["location"]["lng"])
        leg_minutes = round((leg_dist / 5.0) * 60)

        # Check if adding this POI would exceed time budget
        if cumulative_minutes + leg_minutes > max_minutes:
            break

        cumulative_km += leg_dist
        cumulative_minutes += leg_minutes

        nearest["leg_distance_km"] = round(leg_dist, 2)
        nearest["leg_walking_minutes"] = leg_minutes
        nearest["cumulative_distance_km"] = round(cumulative_km, 2)
        nearest["cumulative_walking_minutes"] = cumulative_minutes
        nearest["stop_number"] = len(route) + 1

        route.append(nearest)
        remaining.remove(nearest)

        current_lat = nearest["location"]["lat"]
        current_lng = nearest["location"]["lng"]

    # Calculate return leg to start
    return_km = 0
    return_minutes = 0
    if route:
        last = route[-1]["location"]
        return_km = round(haversine_km(last["lat"], last["lng"], lat, lng), 2)
        return_minutes = round((return_km / 5.0) * 60)

    return {
        "route": route,
        "total_walking_minutes": cumulative_minutes,
        "total_distance_km": round(cumulative_km, 2),
        "return_to_start_km": return_km,
        "return_to_start_minutes": return_minutes,
        "total_with_return_minutes": cumulative_minutes + return_minutes,
        "poi_count": len(route),
        "center": {"lat": lat, "lng": lng},
        "max_minutes": max_minutes,
    }
