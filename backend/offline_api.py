"""
Offline API - Region-based offline packages for Portugal Vivo.
Allows clients to download complete region data for offline use,
check for updates via version hashes, and sync efficiently.
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
