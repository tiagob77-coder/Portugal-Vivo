"""
Partner API v1 — Portugal Vivo B2B
===================================
Stable, versioned, key-authenticated read API for partners (agencies, hotels,
tour operators, booking platforms). Every route requires the ``X-API-Key``
header and counts against the key's monthly quota (see api_keys_api).

The consumer app keeps using the unversioned endpoints; this contract is the
one licensed to third parties and documented in docs/api-pricing.md.

Routes (feature required → minimum plan):
  GET /v1/heritage                 heritage    → Explorador
  GET /v1/heritage/{poi_id}        heritage    → Explorador
  GET /v1/routes                   routes      → Explorador
  GET /v1/routes/{route_id}        routes      → Explorador
  GET /v1/map/items                map         → Explorador
  GET /v1/narratives/{poi_id}      narratives  → Parceiro
  GET /v1/events                   events      → Parceiro
  GET /v1/weather/{location}       weather     → Parceiro
  GET /v1/audio/{poi_id}           audio       → Pro
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from api_keys_api import ApiKeyContext, require_api_key
from dependencies import get_db
from shared_constants import sanitize_regex
from territory import PUBLISHED_POI_FILTER, resolve_poi_municipality, territory_filter

logger = logging.getLogger(__name__)

partner_api_v1_router = APIRouter(prefix="/v1", tags=["Partner API v1"])

ATTRIBUTION = "Conteúdo Portugal Vivo — portugalvivo.pt"

POI_LIST_FIELDS = {
    "_id": 0, "id": 1, "name": 1, "category": 1, "subcategory": 1, "region": 1,
    "distrito": 1, "concelho": 1, "freguesia": 1, "municipality_id": 1,
    "location": 1, "address": 1, "image_url": 1, "tags": 1,
    "micro_pitch": 1, "descricao_curta": 1, "updated_at": 1, "last_edited_at": 1,
}
POI_DETAIL_EXTRA = {"description": 1, "local_story": 1, "historia_local": 1, "accessibility": 1,
                    "opening_hours": 1, "website": 1, "related_items": 1}
ROUTE_FIELDS = {
    "_id": 0, "id": 1, "name": 1, "description": 1, "category": 1, "theme": 1, "region": 1,
    "items": 1, "duration_hours": 1, "distance_km": 1, "difficulty": 1, "image_url": 1, "tags": 1,
}
EVENT_FIELDS = {
    "_id": 0, "id": 1, "name": 1, "type": 1, "description": 1, "region": 1, "concelho": 1,
    "date_text": 1, "start_date": 1, "end_date": 1, "month": 1, "location": 1, "image_url": 1,
    "website": 1, "rarity": 1,
}


def _envelope(key: ApiKeyContext, data: Any, **meta: Any) -> Dict[str, Any]:
    body: Dict[str, Any] = {"data": data, "meta": meta}
    if not key.white_label:
        body["attribution"] = ATTRIBUTION
    return body


def _clean_poi(item: Dict[str, Any]) -> Dict[str, Any]:
    loc = item.get("location")
    if isinstance(loc, dict) and ("lat" not in loc or "lng" not in loc):
        item["location"] = None
    item["municipality"] = resolve_poi_municipality(item)
    for ts_field in ("updated_at", "last_edited_at"):
        if item.get(ts_field) is not None:
            item[ts_field] = str(item[ts_field])
    return item


def _bbox_filter(bbox: Optional[str]) -> Dict[str, Any]:
    if not bbox:
        return {}
    try:
        min_lng, min_lat, max_lng, max_lat = (float(v) for v in bbox.split(","))
    except ValueError:
        raise HTTPException(status_code=422, detail="bbox deve ser 'minLng,minLat,maxLng,maxLat'")
    if not (min_lng < max_lng and min_lat < max_lat):
        raise HTTPException(status_code=422, detail="bbox inválida (mínimos têm de ser menores que máximos)")
    return {
        "location.lat": {"$gte": min_lat, "$lte": max_lat},
        "location.lng": {"$gte": min_lng, "$lte": max_lng},
    }


def _and(*clauses: Dict[str, Any]) -> Dict[str, Any]:
    parts = [c for c in clauses if c]
    if not parts:
        return {}
    return parts[0] if len(parts) == 1 else {"$and": parts}


# ─── Heritage / POIs ──────────────────────────────────────────────────────────

@partner_api_v1_router.get("/heritage")
async def v1_list_heritage(
    category: Optional[str] = None,
    region: Optional[str] = None,
    municipality: Optional[str] = Query(None, description="Slug ou nome do concelho"),
    bbox: Optional[str] = Query(None, description="minLng,minLat,maxLng,maxLat"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    key: ApiKeyContext = Depends(require_api_key("heritage")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """POIs publicados, com filtros por categoria, região, concelho e bounding box."""
    clauses: List[Dict[str, Any]] = [PUBLISHED_POI_FILTER]
    if category:
        clauses.append({"category": category})
    if region:
        clauses.append({"region": {"$regex": f"^{sanitize_regex(region)}$", "$options": "i"}})
    if municipality:
        clauses.append(territory_filter([municipality], [municipality]))
    clauses.append(_bbox_filter(bbox))
    query = _and(*clauses)

    total = await db.heritage_items.count_documents(query)
    skip = (page - 1) * page_size
    items = await db.heritage_items.find(query, POI_LIST_FIELDS).sort("id", 1).skip(skip).limit(page_size).to_list(page_size)
    return _envelope(key, [_clean_poi(i) for i in items], page=page, page_size=page_size, total=total)


@partner_api_v1_router.get("/heritage/{poi_id}")
async def v1_get_heritage(
    poi_id: str,
    key: ApiKeyContext = Depends(require_api_key("heritage")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Detalhe de um POI publicado."""
    item = await db.heritage_items.find_one(
        _and({"id": poi_id}, PUBLISHED_POI_FILTER), {**POI_LIST_FIELDS, **POI_DETAIL_EXTRA}
    )
    if not item:
        raise HTTPException(status_code=404, detail="POI não encontrado")
    return _envelope(key, _clean_poi(item))


@partner_api_v1_router.get("/map/items")
async def v1_map_items(
    bbox: Optional[str] = Query(None, description="minLng,minLat,maxLng,maxLat"),
    categories: Optional[str] = Query(None, description="Lista separada por vírgulas"),
    limit: int = Query(1000, ge=1, le=5000),
    key: ApiKeyContext = Depends(require_api_key("map")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Pontos leves (id, nome, categoria, coordenadas) para desenhar mapas."""
    clauses: List[Dict[str, Any]] = [
        PUBLISHED_POI_FILTER,
        {"location.lat": {"$exists": True, "$ne": None}, "location.lng": {"$exists": True, "$ne": None}},
        _bbox_filter(bbox),
    ]
    if categories:
        clauses.append({"category": {"$in": [c.strip() for c in categories.split(",") if c.strip()]}})
    projection = {"_id": 0, "id": 1, "name": 1, "category": 1, "location": 1}
    items = await db.heritage_items.find(_and(*clauses), projection).limit(limit).to_list(limit)
    points = [
        {"id": i.get("id"), "name": i.get("name"), "category": i.get("category"),
         "lat": i["location"].get("lat"), "lng": i["location"].get("lng")}
        for i in items if isinstance(i.get("location"), dict)
    ]
    return _envelope(key, points, count=len(points), limit=limit)


# ─── Routes ───────────────────────────────────────────────────────────────────

@partner_api_v1_router.get("/routes")
async def v1_list_routes(
    category: Optional[str] = None,
    region: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    key: ApiKeyContext = Depends(require_api_key("routes")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Rotas temáticas curadas."""
    query: Dict[str, Any] = {}
    if category:
        query["$or"] = [{"category": category}, {"theme": category}]
    if region:
        query["region"] = {"$regex": f"^{sanitize_regex(region)}$", "$options": "i"}
    total = await db.routes.count_documents(query)
    skip = (page - 1) * page_size
    routes = await db.routes.find(query, ROUTE_FIELDS).sort("id", 1).skip(skip).limit(page_size).to_list(page_size)
    return _envelope(key, routes, page=page, page_size=page_size, total=total)


@partner_api_v1_router.get("/routes/{route_id}")
async def v1_get_route(
    route_id: str,
    key: ApiKeyContext = Depends(require_api_key("routes")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Rota com os POIs publicados que a compõem."""
    route = await db.routes.find_one({"id": route_id}, ROUTE_FIELDS)
    if not route:
        raise HTTPException(status_code=404, detail="Rota não encontrada")
    item_ids = route.get("items") or []
    pois = await db.heritage_items.find(
        _and({"id": {"$in": item_ids}}, PUBLISHED_POI_FILTER), POI_LIST_FIELDS
    ).to_list(200)
    order = {pid: n for n, pid in enumerate(item_ids)}
    pois.sort(key=lambda p: order.get(p.get("id"), len(order)))
    route["pois"] = [_clean_poi(p) for p in pois]
    return _envelope(key, route)


# ─── Narratives & audio ───────────────────────────────────────────────────────

@partner_api_v1_router.get("/narratives/{poi_id}")
async def v1_get_narratives(
    poi_id: str,
    key: ApiKeyContext = Depends(require_api_key("narratives")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Narrativas publicadas de um POI (texto). Planos Pro/Enterprise recebem o link de áudio."""
    poi = await db.heritage_items.find_one(
        _and({"id": poi_id}, PUBLISHED_POI_FILTER),
        {"_id": 0, "id": 1, "name": 1, "description": 1, "ai_narrative": 1, "micro_pitch": 1, "local_story": 1},
    )
    if not poi:
        raise HTTPException(status_code=404, detail="POI não encontrado")
    narratives = await db.narratives.find(
        {"poi_id": poi_id, "status": "published"},
        {"_id": 0, "id": 1, "title": 1, "story_text": 1, "theme": 1, "language": 1, "credibility": 1},
    ).limit(10).to_list(10)
    data = {
        "poi_id": poi_id,
        "poi_name": poi.get("name"),
        "summary": poi.get("micro_pitch"),
        "narrative": poi.get("ai_narrative") or poi.get("description"),
        "local_story": poi.get("local_story"),
        "stories": narratives,
        "audio_available": "audio" in key.features,
    }
    if "audio" in key.features:
        data["audio_endpoint"] = f"/api/v1/audio/{poi_id}"
    return _envelope(key, data)


@partner_api_v1_router.get("/audio/{poi_id}")
async def v1_get_audio(
    poi_id: str,
    lang: str = Query("pt", pattern="^(pt|en|es|fr)$", description="Língua da narração"),
    key: ApiKeyContext = Depends(require_api_key("audio")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Áudio-guia (MP3 em base64) gerado a partir da narrativa do POI.

    Noutra língua usa a ficha traduzida; sem tradução, narra em português
    (o campo `language` da resposta diz qual foi usada).
    """
    from services.audio_guide_service import MIN_AUDIO_TEXT, audio_guide_service, localized_narration

    item = await db.heritage_items.find_one(_and({"id": poi_id}, PUBLISHED_POI_FILTER), {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="POI não encontrado")
    narration = await localized_narration(db, item, lang)
    if len(narration["text"]) < MIN_AUDIO_TEXT:
        raise HTTPException(status_code=404, detail="POI sem narrativa suficiente para áudio")
    result = await audio_guide_service.generate_audio_guide(
        text=narration["text"], poi_name=narration["name"], poi_id=poi_id,
        category=item.get("category"), language=narration["language"], use_hd=False, speed="normal",
    )
    return _envelope(key, result)


# ─── Events & weather ─────────────────────────────────────────────────────────

@partner_api_v1_router.get("/events")
async def v1_list_events(
    region: Optional[str] = None,
    municipality: Optional[str] = Query(None, description="Nome do concelho"),
    month: Optional[int] = Query(None, ge=1, le=12),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    key: ApiKeyContext = Depends(require_api_key("events")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Eventos culturais e festivais publicados."""
    query: Dict[str, Any] = {"is_published": {"$ne": False}}
    if region:
        query["region"] = {"$regex": sanitize_regex(region), "$options": "i"}
    if municipality:
        query["concelho"] = {"$regex": f"^{sanitize_regex(municipality)}$", "$options": "i"}
    if month:
        query["month"] = month
    total = await db.events.count_documents(query)
    skip = (page - 1) * page_size
    events = await db.events.find(query, EVENT_FIELDS).skip(skip).limit(page_size).to_list(page_size)
    return _envelope(key, events, page=page, page_size=page_size, total=total)


@partner_api_v1_router.get("/weather/{location}")
async def v1_weather(
    location: str,
    key: ApiKeyContext = Depends(require_api_key("weather")),
):
    """Previsão a 5 dias (IPMA) para uma capital de distrito ou ilha."""
    from services.ipma_service import ipma_service, IPMA_LOCATIONS

    location_id = ipma_service.get_location_id(location)
    if not location_id:
        raise HTTPException(
            status_code=404,
            detail=f"Localização '{location}' desconhecida. Disponíveis: {sorted(IPMA_LOCATIONS.keys())}",
        )
    forecasts = await ipma_service.get_forecast(location_id)
    return _envelope(key, {"location": location, "forecasts": [f.dict() for f in forecasts]}, source="IPMA")
