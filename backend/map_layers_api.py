"""
map_layers_api.py — Configuração dinâmica de camadas do mapa
GET /map/layers     → lista de layers disponíveis com metadados
GET /map/pois       → POIs próximos por coordenada e raio
POST /map/search    → pesquisa full-text com filtro geográfico opcional
GET /map/trails     → trilhos filtrados por bounding box
GET /map/environmental → dados ambientais simulados (vento, UV, qualidade do ar)
"""
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import math
import datetime

router = APIRouter(prefix="/map", tags=["Map Layers"])

_db = None

def set_map_layers_db(database):
    global _db
    _db = database

# ─── Layer definitions ─────────────────────────────────────────────────────────

LAYER_DEFINITIONS = [
    {
        "id": "patrimonio",
        "label": "Património",
        "icon": "account_balance",
        "color": "#C49A6C",
        "categories": ["historia", "arqueologia", "arte", "arquitetura", "religioso", "aldeias"],
        "description": "Monumentos, igrejas e sítios históricos",
        "visible_zoom": 7,
    },
    {
        "id": "miradouros",
        "label": "Miradouros",
        "icon": "landscape",
        "color": "#3B82F6",
        "categories": ["miradouro", "miradouros"],
        "description": "Pontos panorâmicos e vistas",
        "visible_zoom": 8,
    },
    {
        "id": "praias",
        "label": "Praias",
        "icon": "beach_access",
        "color": "#06B6D4",
        "categories": ["praias", "praia", "costa", "surf"],
        "description": "Praias fluviais e marítimas",
        "visible_zoom": 8,
    },
    {
        "id": "museus",
        "label": "Museus",
        "icon": "museum",
        "color": "#8B5CF6",
        "categories": ["museus", "museu", "arte", "cultura"],
        "description": "Museus e centros culturais",
        "visible_zoom": 9,
    },
    {
        "id": "trilhos",
        "label": "Trilhos",
        "icon": "hiking",
        "color": "#22C55E",
        "categories": ["percursos", "percursos_pedestres", "ecovias_passadicos", "trilhos", "natureza"],
        "description": "Percursos pedestres e ciclovias",
        "visible_zoom": 8,
    },
    {
        "id": "gastronomia",
        "label": "Gastronomia",
        "icon": "restaurant",
        "color": "#EF4444",
        "categories": ["gastronomia", "vinhos", "queijos", "doces", "restaurante"],
        "description": "Produtos locais e restaurantes típicos",
        "visible_zoom": 9,
    },
    {
        "id": "eventos",
        "label": "Eventos",
        "icon": "event",
        "color": "#EC4899",
        "categories": ["festas", "eventos", "romarias", "festivais"],
        "description": "Festas e eventos culturais",
        "visible_zoom": 8,
    },
    {
        "id": "fotospots",
        "label": "Fotospots",
        "icon": "photo_camera",
        "color": "#F97316",
        "categories": ["fotospot", "fotospots", "instagramavel"],
        "description": "Locais fotogénicos",
        "visible_zoom": 10,
    },
    {
        "id": "natureza",
        "label": "Natureza",
        "icon": "forest",
        "color": "#16A34A",
        "categories": ["natureza", "fauna", "flora", "parques", "reservas"],
        "description": "Parques naturais e reservas",
        "visible_zoom": 7,
    },
    {
        "id": "imaterial",
        "label": "Imaterial",
        "icon": "theater_comedy",
        "color": "#A855F7",
        "categories": ["saberes", "musica_tradicional", "artesanato", "lendas"],
        "description": "Património imaterial e tradições",
        "visible_zoom": 9,
    },
    {
        "id": "vegetacao",
        "label": "Vegetação",
        "icon": "forest",
        "color": "#15803D",
        "categories": ["flora_autoctone", "flora_botanica", "natureza_especializada"],
        "description": "Flora autóctone e habitats naturais",
        "visible_zoom": 9,
    },
    {
        "id": "geologia",
        "label": "Geologia",
        "icon": "diamond",
        "color": "#92400E",
        "categories": ["arqueologia_geologia", "minas", "grutas"],
        "description": "Geologia, grutas e sítios arqueológicos",
        "visible_zoom": 8,
    },
    {
        "id": "hidrografia",
        "label": "Hidrografia",
        "icon": "water",
        "color": "#0EA5E9",
        "categories": ["cascatas_pocos", "barragens_albufeiras", "praias_fluviais", "rios"],
        "description": "Rios, cascatas, barragens e praias fluviais",
        "visible_zoom": 8,
    },
    {
        "id": "miradouros_360",
        "label": "Miradouros 360°",
        "icon": "panorama",
        "color": "#6366F1",
        "categories": ["miradouros", "miradouro"],
        "description": "Pontos panorâmicos com vista 360°",
        "visible_zoom": 9,
        "premium": True,
    },
    {
        "id": "mercados",
        "label": "Mercados",
        "icon": "storefront",
        "color": "#D97706",
        "categories": ["mercado_municipal", "feira", "mercados_feiras"],
        "description": "Mercados municipais e feiras tradicionais",
        "visible_zoom": 9,
        "group": "economia",
    },
    {
        "id": "artesaos",
        "label": "Artesãos",
        "icon": "handyman",
        "color": "#7C3AED",
        "categories": ["artesanato", "oficios_artesanato", "artesao"],
        "description": "Artesãos, oficinas e lojas tradicionais",
        "visible_zoom": 10,
        "group": "economia",
    },
    {
        "id": "pesca_artesanal",
        "label": "Pesca",
        "icon": "phishing",
        "color": "#0369A1",
        "categories": ["pesca", "pesca_artesanal", "zona_pesca"],
        "description": "Portos, zonas e tradições de pesca artesanal",
        "visible_zoom": 8,
        "group": "economia",
    },
    {
        "id": "produtos_regionais",
        "label": "Produtos DOP/IGP",
        "icon": "workspace_premium",
        "color": "#059669",
        "categories": ["produtores_dop", "gastronomia", "vinhos", "queijos"],
        "description": "Produtos com denominação de origem protegida",
        "visible_zoom": 9,
        "group": "economia",
    },
    {
        "id": "rotas_economicas",
        "label": "Rotas Económicas",
        "icon": "route",
        "color": "#C2410C",
        "categories": ["rota_mercados", "rota_peixe", "rota_artesanato"],
        "description": "Rotas do peixe fresco, mercados e artesanato",
        "visible_zoom": 7,
        "group": "economia",
    },
    {"id":"megalitos","label":"Megalitos","icon":"account-balance","color":"#B45309","categories":["megalito","dolmen","menir","cromeleque","mamoa"],"description":"Dólmenes, menires, cromeleques e mamoas neolíticas","visible_zoom":7,"group":"prehistoria"},
    {"id":"arte_rupestre","label":"Arte Rupestre","icon":"brush","color":"#B91C1C","categories":["rupestre","gravura_paleolitica","gravura_rupestre"],"description":"Gravuras e pinturas rupestres","visible_zoom":8,"group":"prehistoria"},
    {"id":"geossitios","label":"Geossítios","icon":"terrain","color":"#7C3AED","categories":["geositio","afloramento_granitico"],"description":"Geossítios LNEG","visible_zoom":7,"group":"prehistoria"},
    {"id":"astronomia_prehistorica","label":"Astronomia","icon":"nights-stay","color":"#0F766E","categories":["santuario","alinhamento_solar","alinhamento_lunar"],"description":"Sítios com alinhamentos astronómicos","visible_zoom":7,"group":"prehistoria","premium":True},
    # ── Biodiversidade Marinha ──────────────────────────────────────────────
    {"id":"avistamentos_marinhos","label":"Avistamentos","icon":"visibility","color":"#0EA5E9","categories":["avistamento","whale_watching","birdwatching"],"description":"Avistamentos de espécies marinhas reportados pela comunidade","visible_zoom":8,"group":"biodiversidade"},
    {"id":"habitats_marinhos","label":"Habitats","icon":"water","color":"#0D9488","categories":["lagoon","estuary","rocky_shore","seamount","reef"],"description":"Habitats costeiros e marinhos protegidos","visible_zoom":7,"group":"biodiversidade"},
    {"id":"zonas_protegidas_mar","label":"Áreas Protegidas","icon":"shield","color":"#16A34A","categories":["marine_protected_area","natura_2000","ramsar","parque_natural"],"description":"Áreas marinhas e costeiras protegidas","visible_zoom":6,"group":"biodiversidade"},
    {"id":"rotas_migracoes","label":"Migrações","icon":"flight","color":"#7C3AED","categories":["migracao_cetaceos","migracao_aves","migracao_peixes"],"description":"Rotas sazonais de migração de cetáceos, aves e peixes","visible_zoom":5,"group":"biodiversidade"},
]


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


@router.get("/layers")
async def get_map_layers():
    """Retorna definições de camadas do mapa com metadados para o frontend."""
    groups: dict = {}
    for layer in LAYER_DEFINITIONS:
        g = layer.get("group", "geral")
        groups.setdefault(g, []).append(layer["id"])
    return {
        "layers": LAYER_DEFINITIONS,
        "total": len(LAYER_DEFINITIONS),
        "groups": groups,
    }


@router.get("/pois")
async def get_nearby_pois(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius: float = Query(10.0, description="Raio em km", ge=0.5, le=100),
    layer: Optional[str] = Query(None, description="ID da camada (ex: trilhos, praias)"),
    limit: int = Query(50, ge=1, le=200),
):
    """POIs próximos de uma coordenada, com filtro opcional por camada."""
    if _db is None:
        return {"pois": [], "total": 0}

    # Bounding box para pré-filtrar no MongoDB
    lat_delta = radius / 111.0
    lng_delta = radius / (111.0 * abs(math.cos(math.radians(lat))) + 0.001)

    query: dict = {
        "location": {
            "$geoWithin": {
                "$box": [
                    [lng - lng_delta, lat - lat_delta],
                    [lng + lng_delta, lat + lat_delta],
                ]
            }
        }
    }

    # Filtro por camada
    if layer:
        layer_def = next((l for l in LAYER_DEFINITIONS if l["id"] == layer), None)
        if layer_def:
            query["category"] = {"$in": layer_def["categories"]}

    cursor = _db["heritage_items"].find(query, {
        "_id": 0, "id": 1, "name": 1, "category": 1, "region": 1,
        "location": 1, "iq_score": 1, "image_url": 1,
    }).limit(limit * 3)  # fetch more, filter by real distance

    pois = []
    async for doc in cursor:
        loc = doc.get("location", {})
        poi_lat = loc.get("lat") or loc.get("latitude")
        poi_lng = loc.get("lng") or loc.get("longitude")
        if not poi_lat or not poi_lng:
            continue
        dist = _haversine_km(lat, lng, poi_lat, poi_lng)
        if dist <= radius:
            pois.append({**doc, "distance_km": round(dist, 2)})

    pois.sort(key=lambda p: p.get("distance_km", 99))
    return {"pois": pois[:limit], "total": len(pois)}


# ─── Search request body ────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    q: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_km: float = 50
    layers: Optional[List[str]] = None
    limit: int = 20


@router.post("/search")
async def search_map(body: SearchRequest):
    """Pesquisa full-text nos heritage_items com filtro geográfico e por camada opcionais."""
    if _db is None:
        return {"results": [], "total": 0, "query": body.q, "geo_filtered": False}

    query: dict = {
        "$or": [
            {"name": {"$regex": body.q, "$options": "i"}},
            {"description": {"$regex": body.q, "$options": "i"}},
        ]
    }

    geo_filtered = False

    # Bounding box filter when coordinates are provided
    if body.lat is not None and body.lng is not None:
        geo_filtered = True
        lat_delta = body.radius_km / 111.0
        lng_delta = body.radius_km / (111.0 * abs(math.cos(math.radians(body.lat))) + 0.001)
        query["location.lat"] = {"$gte": body.lat - lat_delta, "$lte": body.lat + lat_delta}
        query["location.lng"] = {"$gte": body.lng - lng_delta, "$lte": body.lng + lng_delta}

    # Layer category filter
    if body.layers:
        allowed_categories: List[str] = []
        for layer_id in body.layers:
            layer_def = next((l for l in LAYER_DEFINITIONS if l["id"] == layer_id), None)
            if layer_def:
                allowed_categories.extend(layer_def["categories"])
        if allowed_categories:
            query["category"] = {"$in": list(set(allowed_categories))}

    cursor = _db["heritage_items"].find(query, {
        "_id": 0, "id": 1, "name": 1, "category": 1, "region": 1,
        "location": 1, "iq_score": 1, "image_url": 1, "description": 1,
    }).limit(body.limit * 3)

    results = []
    async for doc in cursor:
        if body.lat is not None and body.lng is not None:
            loc = doc.get("location", {})
            poi_lat = loc.get("lat") or loc.get("latitude")
            poi_lng = loc.get("lng") or loc.get("longitude")
            if poi_lat and poi_lng:
                dist = _haversine_km(body.lat, body.lng, poi_lat, poi_lng)
                if dist <= body.radius_km:
                    doc["distance_km"] = round(dist, 2)
                    results.append(doc)
            # Skip items without valid coordinates when geo filtering
        else:
            results.append(doc)

    if body.lat is not None and body.lng is not None:
        results.sort(key=lambda p: p.get("distance_km", 99))

    results = results[: body.limit]
    return {
        "results": results,
        "total": len(results),
        "query": body.q,
        "geo_filtered": geo_filtered,
    }


@router.get("/trails")
async def get_map_trails(
    bbox: Optional[str] = Query(None, description="minLng,minLat,maxLng,maxLat"),
    difficulty: Optional[str] = Query(None, description="facil|moderado|dificil|muito_dificil"),
    limit: int = Query(50, ge=1, le=200),
):
    """Trilhos filtrados por bounding box e/ou dificuldade."""
    if _db is None:
        return {"trails": [], "total": 0}

    query: dict = {}

    if difficulty:
        query["difficulty"] = difficulty

    if bbox:
        try:
            min_lng, min_lat, max_lng, max_lat = [float(v) for v in bbox.split(",")]
            # Filter trails whose points overlap with the bounding box
            query["$or"] = [
                {
                    "points": {
                        "$elemMatch": {
                            "lat": {"$gte": min_lat, "$lte": max_lat},
                            "lng": {"$gte": min_lng, "$lte": max_lng},
                        }
                    }
                }
            ]
        except (ValueError, AttributeError):
            pass  # Ignore malformed bbox — return all

    cursor = _db["trails"].find(query, {
        "_id": 0,
        "id": 1,
        "name": 1,
        "difficulty": 1,
        "distance_km": 1,
        "elevation_gain": 1,
        "color": 1,
        "region": 1,
        "points": 1,  # needed for point_count; excluded below
    }).limit(limit)

    trails = []
    async for doc in cursor:
        points = doc.pop("points", [])
        doc["point_count"] = len(points)
        trails.append(doc)

    return {"trails": trails, "total": len(trails)}


@router.get("/environmental")
async def get_environmental_data(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """Dados ambientais simulados para sobreposição no mapa (sem API externa)."""
    now = datetime.datetime.utcnow()
    day_of_year = now.timetuple().tm_yday
    hour = now.hour

    # ── Wind simulation ─────────────────────────────────────────────────────
    # Base speed varies by season and a pseudo-random element from lat/lng
    seasonal_factor = 1.0 + 0.4 * math.sin(2 * math.pi * (day_of_year - 80) / 365)
    pseudo_random = abs(math.sin(lat * 17.3 + lng * 31.7 + day_of_year * 0.1))
    wind_speed_kmh = round(10 + 15 * seasonal_factor * pseudo_random, 1)
    # Direction: dominant westerlies in Portugal, with some variation
    direction_deg = int((270 + 60 * math.sin(lat * 0.5 + day_of_year * 0.05)) % 360)
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    direction_label = directions[int((direction_deg + 22.5) / 45) % 8]

    # ── UV Index simulation ──────────────────────────────────────────────────
    # Peaks midday in summer; Portugal latitude ~37–42°N
    solar_elevation = max(
        0.0,
        math.sin(math.radians(lat)) * math.sin(math.radians(-23.45 * math.cos(math.radians(360 / 365 * (day_of_year + 10)))))
        + math.cos(math.radians(lat)) * math.cos(math.radians(-23.45 * math.cos(math.radians(360 / 365 * (day_of_year + 10)))))
        * math.cos(math.radians(15 * (hour - 12)))
    )
    uv_index = round(min(11, 11 * solar_elevation * (0.7 + 0.3 * math.sin(2 * math.pi * (day_of_year - 80) / 365))), 1)
    if uv_index <= 2:
        uv_level = "Baixo"
    elif uv_index <= 5:
        uv_level = "Moderado"
    elif uv_index <= 7:
        uv_level = "Alto"
    elif uv_index <= 10:
        uv_level = "Muito Alto"
    else:
        uv_level = "Extremo"

    # ── Air quality simulation ───────────────────────────────────────────────
    # Higher AQI near coasts and cities (approximated by lng proximity to coast)
    aqi_base = 30 + 20 * abs(math.sin(lng * 5.3 + day_of_year * 0.07))
    aqi = int(min(150, aqi_base + 10 * pseudo_random))
    if aqi <= 50:
        aqi_level = "Boa"
    elif aqi <= 100:
        aqi_level = "Moderada"
    elif aqi <= 150:
        aqi_level = "Insalubre para grupos sensíveis"
    else:
        aqi_level = "Insalubre"

    # ── Sunrise / Sunset (simplified for Portugal) ───────────────────────────
    # Solar declination
    decl_rad = math.radians(-23.45 * math.cos(math.radians(360 / 365 * (day_of_year + 10))))
    lat_rad = math.radians(lat)
    cos_ha = -math.tan(lat_rad) * math.tan(decl_rad)
    cos_ha = max(-1.0, min(1.0, cos_ha))
    hour_angle_deg = math.degrees(math.acos(cos_ha))
    # Equation of time approximation (minutes)
    B = math.radians(360 / 365 * (day_of_year - 81))
    eot = 9.87 * math.sin(2 * B) - 7.53 * math.cos(B) - 1.5 * math.sin(B)
    # UTC offset for Portugal (WET = 0, WEST = +1 in summer)
    utc_offset = 1 if 80 <= day_of_year <= 300 else 0
    longitude_correction = (lng - 0) / 15  # degrees east of 0 meridian
    solar_noon = 12 - longitude_correction - eot / 60 + utc_offset
    sunrise_h = solar_noon - hour_angle_deg / 15
    sunset_h = solar_noon + hour_angle_deg / 15

    def _fmt_time(frac_h: float) -> str:
        total_min = int(round(frac_h * 60))
        return f"{total_min // 60:02d}:{total_min % 60:02d}"

    sunrise_str = _fmt_time(sunrise_h)
    sunset_str = _fmt_time(sunset_h)

    # ── Moon phase ───────────────────────────────────────────────────────────
    # Days since known new moon (Jan 6 2000 = JD 2451549.5)
    jd = 2451545.0 + (now - datetime.datetime(2000, 1, 1, 12, 0, 0)).total_seconds() / 86400
    moon_age = (jd - 2451549.5) % 29.53058867
    if moon_age < 1.85:
        moon_phase = "Lua Nova"
    elif moon_age < 7.38:
        moon_phase = "Quarto Crescente"
    elif moon_age < 14.77:
        moon_phase = "Lua Cheia"
    elif moon_age < 22.15:
        moon_phase = "Quarto Minguante"
    else:
        moon_phase = "Lua Nova"

    return {
        "wind": {
            "speed_kmh": wind_speed_kmh,
            "direction": direction_label,
            "direction_deg": direction_deg,
        },
        "uv": {
            "index": uv_index,
            "level": uv_level,
        },
        "air_quality": {
            "aqi": aqi,
            "level": aqi_level,
        },
        "sunrise": sunrise_str,
        "sunset": sunset_str,
        "moon_phase": moon_phase,
    }
