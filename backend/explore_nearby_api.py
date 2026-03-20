"""
Explorar Perto de Mim API - Proximity-based POI discovery for tourists.
Discover nearby points of interest with distance, direction, and walking estimates.

Includes "Explorar à Volta" mode (300-800m radius) with micro-stories,
photo spots, mini-challenges, and curiosities for deep urban exploration.
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
# EXPLORE-AROUND CONSTANTS
# ========================

# Categories that are natural photo spots
PHOTO_SPOT_CATEGORIES = {
    "miradouros", "cascatas_pocos", "praias_bandeira_azul", "praias_fluviais",
    "arte_urbana", "castelos", "palacios_solares", "fauna_autoctone",
    "barragens_albufeiras", "flora_botanica",
}

# Challenge types per category
CHALLENGE_MAP = {
    "miradouros": {"type": "foto", "icon": "photo-camera", "label": "Tira uma foto panorâmica"},
    "arte_urbana": {"type": "foto", "icon": "photo-camera", "label": "Captura este mural urbano"},
    "cascatas_pocos": {"type": "foto", "icon": "photo-camera", "label": "Fotografia com a cascata ao fundo"},
    "museus": {"type": "quiz", "icon": "quiz", "label": "Descobre 1 facto surpreendente aqui"},
    "castelos": {"type": "quiz", "icon": "history-edu", "label": "Qual o século em que foi construído?"},
    "palacios_solares": {"type": "quiz", "icon": "history-edu", "label": "Quem viveu aqui?"},
    "mercados_feiras": {"type": "degustacao", "icon": "restaurant", "label": "Prova um produto local típico"},
    "tabernas_historicas": {"type": "degustacao", "icon": "local-bar", "label": "Pede a especialidade da casa"},
    "percursos_pedestres": {"type": "exploracao", "icon": "hiking", "label": "Faz os primeiros 500m do trilho"},
    "fauna_autoctone": {"type": "observacao", "icon": "pets", "label": "Observa e identifica 1 espécie"},
    "oficios_artesanato": {"type": "aprendizagem", "icon": "handyman", "label": "Fala com o artesão sobre a técnica"},
}

# Short curiosity hooks by category (appended to micro-stories)
CURIOSITY_HOOKS = {
    "castelos": "Sabia que a maioria dos castelos medievais portugueses foi construída sobre sítios romanos?",
    "museus": "Os museus portugueses guardam mais de 3 milhões de peças — muitas ainda por catalogar.",
    "arte_urbana": "O movimento de arte urbana em Portugal começou nos anos 90 no Bairro Alto, Lisboa.",
    "miradouros": "Em Portugal existem mais de 600 miradouros catalogados — muitos sem placa oficial.",
    "cascatas_pocos": "A maioria das cascatas portuguesas tem caudal máximo entre novembro e março.",
    "mercados_feiras": "Os mercados semanais existem em Portugal desde pelo menos o século XII.",
    "percursos_pedestres": "Portugal tem mais de 8.000 km de trilhos sinalizados pelo Turismo de Portugal.",
    "fauna_autoctone": "A lontra (Lutra lutra) voltou a habitar muitos rios portugueses após décadas de ausência.",
    "praias_bandeira_azul": "Portugal lidera a Europa no número de Bandeiras Azuis por km de costa.",
}


def _build_micro_story(poi: dict) -> str:
    """Extract a compelling micro-story from POI description (max 180 chars)."""
    desc = (poi.get("description") or "").strip()
    if not desc:
        name = poi.get("name", "")
        cat = poi.get("category", "")
        return f"{name} é um ponto de interesse de categoria '{cat}' nesta zona."
    sentences = desc.replace(".", ".|").split("|")
    story = sentences[0].strip()
    if len(story) < 60 and len(sentences) > 1:
        story = (story + " " + sentences[1].strip()).strip()
    return story[:180] + ("…" if len(story) > 180 else "")


def _is_photo_spot(poi: dict) -> bool:
    return poi.get("category", "") in PHOTO_SPOT_CATEGORIES


def _get_challenge(poi: dict) -> Optional[dict]:
    cat = poi.get("category", "")
    challenge = CHALLENGE_MAP.get(cat)
    if not challenge:
        return None
    return {**challenge, "poi_id": poi.get("id"), "poi_name": poi.get("name")}


def _get_curiosity(poi: dict) -> Optional[str]:
    return CURIOSITY_HOOKS.get(poi.get("category", ""))


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


# ========================
# EXPLORAR À VOLTA (300–800m deep urban exploration mode)
# ========================

@explore_nearby_router.get("/explore-around")
async def explore_around(
    lat: float = Query(..., ge=-90, le=90, description="Latitude atual"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude atual"),
    radius_m: int = Query(500, ge=100, le=1000, description="Raio em metros (100-1000m)"),
    mode: str = Query("all", pattern="^(all|stories|photo_spots|challenges|curiosities)$"),
    limit: int = Query(15, ge=1, le=30),
):
    """
    Explorar à Volta — modo de exploração urbana profunda em raio 300-800m.

    Retorna POIs enriquecidos com:
    - micro_story: narrativa curta e envolvente (max 180 chars)
    - is_photo_spot: booleano — ideal para fotografia
    - challenge: mini-desafio associado ao local
    - curiosity: facto curioso sobre a categoria
    - offline_ready: indica se o conteúdo está no pacote offline da região

    Ideal para descoberta a pé sem destino fixo.
    """
    radius_km = radius_m / 1000.0
    candidates = await _fetch_candidates(lat, lng, radius_km, max_candidates=200)

    enriched = []
    for poi in candidates:
        micro_story = _build_micro_story(poi)
        is_photo = _is_photo_spot(poi)
        challenge = _get_challenge(poi)
        curiosity = _get_curiosity(poi)

        # Content type flags
        content_types = ["story"]
        if is_photo:
            content_types.append("photo_spot")
        if challenge:
            content_types.append("challenge")
        if curiosity:
            content_types.append("curiosity")

        # Filter by mode
        if mode == "stories":
            if not micro_story or len(micro_story) < 30:
                continue
        elif mode == "photo_spots":
            if not is_photo:
                continue
        elif mode == "challenges":
            if not challenge:
                continue
        elif mode == "curiosities":
            if not curiosity:
                continue

        enriched.append({
            **{k: v for k, v in poi.items()},
            "micro_story": micro_story,
            "is_photo_spot": is_photo,
            "challenge": challenge,
            "curiosity": curiosity,
            "content_types": content_types,
        })

    # Sort by IQ score (most interesting first)
    enriched.sort(key=lambda x: -(x.get("iq_score") or 0))
    enriched = enriched[:limit]

    # Stats
    photo_count = sum(1 for p in enriched if p["is_photo_spot"])
    challenge_count = sum(1 for p in enriched if p["challenge"])
    story_count = sum(1 for p in enriched if len(p.get("micro_story", "")) >= 30)

    return {
        "pois": enriched,
        "radius_m": radius_m,
        "mode": mode,
        "center": {"lat": lat, "lng": lng},
        "summary": {
            "total": len(enriched),
            "photo_spots": photo_count,
            "challenges": challenge_count,
            "stories": story_count,
            "curiosities": sum(1 for p in enriched if p.get("curiosity")),
        },
        "offline_preload_hint": radius_m >= 400,
    }


@explore_nearby_router.get("/micro-content/{poi_id}")
async def get_poi_micro_content(poi_id: str):
    """
    Obter o micro-conteúdo (história, desafio, curiosidade) de um POI específico.
    Usado para pré-carregar conteúdo no modo offline.
    """
    db = _get_db()
    poi = await db.heritage_items.find_one(
        {"id": poi_id},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "description": 1, "region": 1,
         "location": 1, "image_url": 1, "iq_score": 1},
    )
    if not poi:
        from fastapi import HTTPException
        raise HTTPException(404, detail="POI não encontrado")

    return {
        "poi_id": poi_id,
        "name": poi.get("name"),
        "micro_story": _build_micro_story(poi),
        "is_photo_spot": _is_photo_spot(poi),
        "challenge": _get_challenge(poi),
        "curiosity": _get_curiosity(poi),
    }


@explore_nearby_router.get("/preload-region")
async def preload_region_micro_content(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(3.0, ge=0.5, le=15.0, description="Raio de pré-carregamento em km"),
):
    """
    Pré-carregar micro-conteúdo de todos os POIs num raio para uso offline.
    Retorna lista compacta de ids + micro-conteúdo para cache local.
    Usado automaticamente ao entrar numa cidade/região.
    """
    candidates = await _fetch_candidates(lat, lng, radius_km, max_candidates=300)

    preload_list = []
    for poi in candidates:
        preload_list.append({
            "id": poi.get("id"),
            "name": poi.get("name"),
            "category": poi.get("category"),
            "location": poi.get("location"),
            "micro_story": _build_micro_story(poi),
            "is_photo_spot": _is_photo_spot(poi),
            "challenge": _get_challenge(poi),
            "curiosity": _get_curiosity(poi),
        })

    return {
        "preload_items": preload_list,
        "count": len(preload_list),
        "radius_km": radius_km,
        "center": {"lat": lat, "lng": lng},
        "cache_ttl_hours": 24,
    }
