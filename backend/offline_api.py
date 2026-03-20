"""
Offline API - Region-based offline packages for Portugal Vivo.
Allows clients to download complete region data for offline use,
check for updates via version hashes, and sync efficiently.

Also supports thematic packages: natural parks, historic centers, themed routes.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import Optional
from datetime import datetime, timezone
import hashlib
import logging

from shared_utils import DatabaseHolder
from premium_guard import require_feature

logger = logging.getLogger(__name__)

_db_holder = DatabaseHolder("offline")
set_offline_db = _db_holder.set
_get_db = _db_holder.get

offline_router = APIRouter(prefix="/offline", tags=["Offline"])

# Portuguese regions with metadata
REGIONS = {
    "norte": {"name": "Norte", "districts": ["braga", "braganca", "porto", "viana_do_castelo", "vila_real"]},
    "centro": {"name": "Centro", "districts": ["aveiro", "castelo_branco", "coimbra", "guarda", "leiria", "viseu"]},
    "lisboa": {"name": "Lisboa e Vale do Tejo", "districts": ["lisboa", "santarem", "setubal"]},
    "alentejo": {"name": "Alentejo", "districts": ["beja", "evora", "portalegre"]},
    "algarve": {"name": "Algarve", "districts": ["faro"]},
    "acores": {"name": "Açores", "districts": ["acores"]},
    "madeira": {"name": "Madeira", "districts": ["madeira"]},
}

# Thematic packages: natural parks, historic centers, themed routes
THEMATIC_PACKAGES = {
    "arrabida": {
        "name": "Serra da Arrábida",
        "type": "parque_natural",
        "region": "lisboa",
        "description": "Reserva natural com falésias, praias cristalinas e vilas piscatórias. Inclui POIs de natureza, praias e gastronomia local.",
        "icon": "terrain",
        "color": "#22C55E",
        "bbox": {"lat_min": 38.47, "lat_max": 38.55, "lng_min": -9.02, "lng_max": -8.78},
        "content_types": ["pois", "trails", "audio", "micro_stories"],
        "estimated_size_mb": 28.5,
        "highlights": ["Praia de Galapinhos", "Convento da Arrábida", "Portinho da Arrábida"],
        "offline_note": "Inclui mapas offline e guias de trilhos para uso sem internet.",
    },
    "geres": {
        "name": "Parque Nacional da Peneda-Gerês",
        "type": "parque_nacional",
        "region": "norte",
        "description": "Único parque nacional de Portugal. Cascatas, aldeia medievais e fauna selvagem. Essencial para trilhos offline.",
        "icon": "park",
        "color": "#16A34A",
        "bbox": {"lat_min": 41.67, "lat_max": 41.98, "lng_min": -8.22, "lng_max": -7.88},
        "content_types": ["pois", "trails", "audio", "micro_stories", "fauna"],
        "estimated_size_mb": 42.0,
        "highlights": ["Cascata do Arado", "Aldeias de Xisto", "Castro Laboreiro"],
        "offline_note": "Zona com fraca cobertura de rede — download recomendado antes de partir.",
    },
    "evora_historica": {
        "name": "Centro Histórico de Évora",
        "type": "centro_historico",
        "region": "alentejo",
        "description": "Património Mundial UNESCO. Templo Romano, Sé Catedral e Cromeleque dos Almendres. Navegação pedestre narrativa incluída.",
        "icon": "account-balance",
        "color": "#C49A6C",
        "bbox": {"lat_min": 38.565, "lat_max": 38.580, "lng_min": -7.915, "lng_max": -7.895},
        "content_types": ["pois", "narrative_nav", "audio", "micro_stories", "photo_spots"],
        "estimated_size_mb": 12.5,
        "highlights": ["Templo Romano", "Cromeleque dos Almendres", "Igreja dos Ossos"],
        "offline_note": "Inclui navegação narrativa pedestre para o Centro Histórico.",
    },
    "sintra_palacio": {
        "name": "Sintra — Palácios e Jardins",
        "type": "rota_tematica",
        "region": "lisboa",
        "description": "Rota dos palácios românticos de Sintra. Palácio Nacional, Pena, Monserrate e Quinta da Regaleira.",
        "icon": "castle",
        "color": "#8B5CF6",
        "bbox": {"lat_min": 38.76, "lat_max": 38.82, "lng_min": -9.47, "lng_max": -9.36},
        "content_types": ["pois", "narrative_nav", "audio", "photo_spots"],
        "estimated_size_mb": 18.0,
        "highlights": ["Palácio da Pena", "Quinta da Regaleira", "Palácio de Monserrate"],
        "offline_note": "Rotas narrativas entre palácios com contexto histórico.",
    },
    "douro_vinhateiro": {
        "name": "Douro Vinhateiro",
        "type": "rota_tematica",
        "region": "norte",
        "description": "Alto Douro Vinhateiro — Património Mundial. Quintas, miradores e cultura do vinho do Porto.",
        "icon": "wine-bar",
        "color": "#7C3AED",
        "bbox": {"lat_min": 41.05, "lat_max": 41.25, "lng_min": -7.85, "lng_max": -7.25},
        "content_types": ["pois", "trails", "audio", "micro_stories"],
        "estimated_size_mb": 22.0,
        "highlights": ["Peso da Régua", "Pinhão", "Mirador do Casal de Loivos"],
        "offline_note": "Inclui mapa das quintas com horários de visita.",
    },
    "sagres_suroeste": {
        "name": "Sagres e Costa Sudoeste",
        "type": "parque_natural",
        "region": "algarve",
        "description": "Parque Natural do Sudoeste Alentejano e Costa Vicentina. A costa mais selvagem de Portugal.",
        "icon": "waves",
        "color": "#06B6D4",
        "bbox": {"lat_min": 37.00, "lat_max": 37.20, "lng_min": -9.00, "lng_max": -8.65},
        "content_types": ["pois", "trails", "photo_spots", "micro_stories"],
        "estimated_size_mb": 31.0,
        "highlights": ["Cabo de São Vicente", "Praia do Beliche", "Fortaleza de Sagres"],
        "offline_note": "Zona com rede limitada. Download essencial para trilhos costeiros.",
    },
}

# Fields to exclude from offline packages to reduce size
HEAVY_FIELDS = {
    "audio_guide": 0,
    "full_history": 0,
    "admin_notes": 0,
    "import_metadata": 0,
    "enrichment_log": 0,
}


def _estimate_size_mb(poi_count: int, routes_count: int, events_count: int) -> float:
    """Rough estimate: ~1KB per POI, ~2KB per route, ~0.5KB per event."""
    size_bytes = (poi_count * 1024) + (routes_count * 2048) + (events_count * 512)
    return round(size_bytes / (1024 * 1024), 2)


def _size_breakdown(poi_count: int, routes_count: int, events_count: int,
                    audio_count: int = 0, encyclopedia_count: int = 0) -> dict:
    """Detailed size breakdown by content type."""
    return {
        "pois_mb": round(poi_count * 1024 / (1024 * 1024), 2),
        "routes_mb": round(routes_count * 2048 / (1024 * 1024), 2),
        "events_mb": round(events_count * 512 / (1024 * 1024), 2),
        "audio_mb": round(audio_count * 512 * 1024 / (1024 * 1024), 2),  # ~512KB per guide
        "encyclopedia_mb": round(encyclopedia_count * 2048 / (1024 * 1024), 2),
        "total_mb": _estimate_size_mb(poi_count, routes_count, events_count),
    }


def _download_eta_seconds(size_mb: float, connection: str = "4g") -> int:
    """Estimate download time in seconds for a given connection speed."""
    speeds = {"wifi": 25.0, "4g": 8.0, "3g": 1.5, "2g": 0.1}  # MB/s
    speed = speeds.get(connection, 8.0)
    return max(1, round(size_mb / speed))


def _compute_version_hash(last_updated: Optional[str], poi_count: int) -> str:
    """Compute a version hash based on the last update timestamp and count."""
    content = f"{last_updated or 'none'}:{poi_count}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


async def _get_region_stats(db, region: str) -> dict:
    """Get counts and last_updated for a region."""
    region_filter = {"region": {"$regex": f"^{region}$", "$options": "i"}}

    poi_count = await db.heritage.count_documents(region_filter)
    routes_count = await db.routes.count_documents(region_filter)

    now = datetime.now(timezone.utc)
    events_count = await db.events.count_documents({
        **region_filter,
        "$or": [
            {"end_date": {"$gte": now.isoformat()}},
            {"date": {"$gte": now.isoformat()}},
        ],
    })

    # Find the most recently updated item
    last_updated = None
    latest_poi = await db.heritage.find_one(
        region_filter,
        sort=[("updated_at", -1)],
        projection={"updated_at": 1},
    )
    if latest_poi and latest_poi.get("updated_at"):
        last_updated = str(latest_poi["updated_at"])

    return {
        "poi_count": poi_count,
        "routes_count": routes_count,
        "events_count": events_count,
        "last_updated": last_updated,
    }



# ========================
# ENDPOINTS
# ========================

@offline_router.get("/regions")
async def list_regions():
    """
    List all available regions for offline download.
    Returns per region: id, name, poi_count, routes_count, events_count,
    estimated_size_mb, last_updated.
    """
    db = _get_db()
    regions = []

    for region_id, region_meta in REGIONS.items():
        stats = await _get_region_stats(db, region_id)
        regions.append({
            "id": region_id,
            "name": region_meta["name"],
            "poi_count": stats["poi_count"],
            "routes_count": stats["routes_count"],
            "events_count": stats["events_count"],
            "estimated_size_mb": _estimate_size_mb(
                stats["poi_count"], stats["routes_count"], stats["events_count"]
            ),
            "last_updated": stats["last_updated"],
        })

    return {"regions": regions, "total": len(regions)}


@offline_router.get("/package/{region}", dependencies=[Depends(require_feature("offline"))])
async def download_region_package(region: str):
    """
    Download a complete offline package for a region (Premium).
    Includes heritage items (POIs), routes, upcoming events, and category metadata.
    Response is cached for 24 hours via Cache-Control header.
    """
    if region not in REGIONS:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found. Valid regions: {list(REGIONS.keys())}")

    db = _get_db()
    region_filter = {"region": {"$regex": f"^{region}$", "$options": "i"}}
    projection = {"_id": 0, **{k: v for k, v in HEAVY_FIELDS.items()}}

    # Fetch heritage items (POIs)
    heritage_cursor = db.heritage.find(region_filter, projection)
    heritage_items = []
    async for doc in heritage_cursor:
        if "id" not in doc and "_id" in doc:
            doc["id"] = str(doc["_id"])
        heritage_items.append(doc)

    # Fetch routes
    routes_cursor = db.routes.find(region_filter, {"_id": 0})
    routes = []
    async for doc in routes_cursor:
        if "id" not in doc and "_id" in doc:
            doc["id"] = str(doc["_id"])
        routes.append(doc)

    # Fetch upcoming events
    now = datetime.now(timezone.utc)
    events_filter = {
        **region_filter,
        "$or": [
            {"end_date": {"$gte": now.isoformat()}},
            {"date": {"$gte": now.isoformat()}},
        ],
    }
    events_cursor = db.events.find(events_filter, {"_id": 0})
    events = []
    async for doc in events_cursor:
        if "id" not in doc and "_id" in doc:
            doc["id"] = str(doc["_id"])
        events.append(doc)

    # Fetch category metadata
    categories_cursor = db.categories.find({}, {"_id": 0})
    categories = []
    async for doc in categories_cursor:
        categories.append(doc)

    # Build version hash
    stats = await _get_region_stats(db, region)
    version_hash = _compute_version_hash(stats["last_updated"], stats["poi_count"])

    package = {
        "region": region,
        "region_name": REGIONS[region]["name"],
        "version_hash": version_hash,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "heritage_items": heritage_items,
        "routes": routes,
        "events": events,
        "categories": categories,
        "counts": {
            "heritage_items": len(heritage_items),
            "routes": len(routes),
            "events": len(events),
            "categories": len(categories),
        },
    }

    response = JSONResponse(content=package)
    response.headers["Cache-Control"] = "public, max-age=86400"
    return response


@offline_router.get("/package/{region}/version")
async def get_region_version(region: str):
    """
    Check the latest version hash for a region.
    Client compares with locally stored version to decide if an update is needed.
    """
    if region not in REGIONS:
        raise HTTPException(status_code=404, detail=f"Region '{region}' not found.")

    db = _get_db()
    stats = await _get_region_stats(db, region)
    version_hash = _compute_version_hash(stats["last_updated"], stats["poi_count"])

    return {
        "region": region,
        "region_name": REGIONS[region]["name"],
        "version_hash": version_hash,
        "poi_count": stats["poi_count"],
        "last_updated": stats["last_updated"],
    }


@offline_router.get("/package/all/manifest")
async def get_all_regions_manifest():
    """
    Manifest of all regions with their version hashes.
    Used by clients to efficiently check which regions need updating.
    """
    db = _get_db()
    manifest = []

    for region_id, region_meta in REGIONS.items():
        stats = await _get_region_stats(db, region_id)
        version_hash = _compute_version_hash(stats["last_updated"], stats["poi_count"])
        manifest.append({
            "region": region_id,
            "region_name": region_meta["name"],
            "version_hash": version_hash,
            "poi_count": stats["poi_count"],
            "routes_count": stats["routes_count"],
            "events_count": stats["events_count"],
            "estimated_size_mb": _estimate_size_mb(
                stats["poi_count"], stats["routes_count"], stats["events_count"]
            ),
            "last_updated": stats["last_updated"],
        })

    return {
        "manifest": manifest,
        "total_regions": len(manifest),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ========================
# THEMATIC PACKAGES
# ========================

@offline_router.get("/thematic-packages")
async def list_thematic_packages():
    """
    Listar pacotes offline temáticos: parques naturais, centros históricos, rotas temáticas.
    Cada pacote inclui metadados, estimativa de tamanho e tipos de conteúdo incluídos.
    """
    packages = []
    for pkg_id, pkg in THEMATIC_PACKAGES.items():
        size = pkg.get("estimated_size_mb", 10.0)
        packages.append({
            "id": pkg_id,
            "name": pkg["name"],
            "type": pkg["type"],
            "region": pkg["region"],
            "description": pkg["description"],
            "icon": pkg["icon"],
            "color": pkg["color"],
            "highlights": pkg.get("highlights", []),
            "content_types": pkg.get("content_types", ["pois"]),
            "estimated_size_mb": size,
            "download_eta": {
                "wifi_sec": _download_eta_seconds(size, "wifi"),
                "4g_sec": _download_eta_seconds(size, "4g"),
                "3g_sec": _download_eta_seconds(size, "3g"),
            },
            "offline_note": pkg.get("offline_note", ""),
        })
    return {"packages": packages, "total": len(packages)}


@offline_router.get("/thematic-packages/{package_id}", dependencies=[Depends(require_feature("offline"))])
async def download_thematic_package(package_id: str):
    """
    Descarregar pacote temático offline (Premium).
    Retorna POIs dentro do bounding box do pacote, com micro-conteúdo incluído.
    """
    if package_id not in THEMATIC_PACKAGES:
        raise HTTPException(404, detail=f"Pacote '{package_id}' não encontrado.")

    pkg = THEMATIC_PACKAGES[package_id]
    bbox = pkg["bbox"]
    db = _get_db()

    bbox_query = {
        "location.lat": {"$gte": bbox["lat_min"], "$lte": bbox["lat_max"]},
        "location.lng": {"$gte": bbox["lng_min"], "$lte": bbox["lng_max"]},
    }
    projection = {"_id": 0, **{k: 0 for k in HEAVY_FIELDS}}

    # Fetch heritage items in bbox
    heritage_items = await db.heritage_items.find(bbox_query, projection).to_list(1000)
    for doc in heritage_items:
        if "id" not in doc and "_id" in doc:
            doc["id"] = str(doc["_id"])

    # Fetch routes in bbox (by region)
    region_filter = {"region": {"$regex": pkg["region"], "$options": "i"}}
    routes = await db.routes.find(region_filter, {"_id": 0}).limit(50).to_list(50)

    version_hash = _compute_version_hash(datetime.now(timezone.utc).isoformat(), len(heritage_items))
    size = _size_breakdown(len(heritage_items), len(routes), 0)

    response_data = {
        "package_id": package_id,
        "name": pkg["name"],
        "type": pkg["type"],
        "version_hash": version_hash,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "heritage_items": heritage_items,
        "routes": routes,
        "bbox": bbox,
        "content_types": pkg.get("content_types", []),
        "size_breakdown": size,
        "counts": {
            "heritage_items": len(heritage_items),
            "routes": len(routes),
        },
        "offline_note": pkg.get("offline_note", ""),
        "cache_ttl_hours": 168,  # 1 week
    }

    response = JSONResponse(content=response_data)
    response.headers["Cache-Control"] = "public, max-age=604800"  # 7 days
    return response


@offline_router.get("/smart-context")
async def get_smart_context(
    lat: float,
    lng: float,
):
    """
    Detetar automaticamente que pacotes offline são relevantes para a localização atual.
    Usado para sugerir downloads ao chegar a uma nova região ou parque natural.
    """
    suggestions = []

    for pkg_id, pkg in THEMATIC_PACKAGES.items():
        bbox = pkg["bbox"]
        if (bbox["lat_min"] <= lat <= bbox["lat_max"] and
                bbox["lng_min"] <= lng <= bbox["lng_max"]):
            suggestions.append({
                "package_id": pkg_id,
                "name": pkg["name"],
                "type": pkg["type"],
                "estimated_size_mb": pkg.get("estimated_size_mb", 10.0),
                "reason": f"Está próximo de {pkg['name']} — descarregue para uso offline.",
                "priority": "high",
            })

    # Also detect region
    detected_region = None
    for region_id, region_meta in REGIONS.items():
        detected_region = region_id  # placeholder; real implementation uses geocoding

    return {
        "location": {"lat": lat, "lng": lng},
        "suggested_packages": suggestions,
        "detected_region": detected_region,
        "message": (
            f"{len(suggestions)} pacote(s) temático(s) disponível(is) nesta zona."
            if suggestions else "Nenhum pacote temático disponível nesta zona."
        ),
    }
