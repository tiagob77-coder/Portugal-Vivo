"""
map_layers_api.py — Configuração dinâmica de camadas do mapa
GET /map/layers     → lista de layers disponíveis com metadados
GET /map/pois       → POIs próximos por coordenada e raio
"""
from fastapi import APIRouter, Query
from typing import Optional, List
import math

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
    return {
        "layers": LAYER_DEFINITIONS,
        "total": len(LAYER_DEFINITIONS),
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
