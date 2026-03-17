#!/usr/bin/env python3
"""
Batch Geocoder — Enrich POIs with exact coordinates.

Cascading strategy to minimize costs:
  1. Nominatim (OpenStreetMap) — FREE, 1 req/s
  2. Google Maps Geocoding API — paid fallback (~$5/1000 requests)

Identifies POIs whose coordinates are approximate (region centroids) and
replaces them with precise coordinates.

Usage:
    # Dry run — show what would change, no writes
    python scripts/batch_geocode.py --dry-run

    # Process up to 500 POIs (default), Nominatim only (free)
    python scripts/batch_geocode.py

    # Process with Google fallback for Nominatim failures
    python scripts/batch_geocode.py --google-fallback

    # Process a specific region
    python scripts/batch_geocode.py --region norte --limit 200

    # Force re-geocode even already-geocoded POIs
    python scripts/batch_geocode.py --force

    # Process all POIs (no limit)
    python scripts/batch_geocode.py --limit 0

Environment:
    MONGO_URL            MongoDB connection string  (default: mongodb://localhost:27017)
    DB_NAME              Database name              (default: patrimonio_vivo)
    GOOGLE_MAPS_API_KEY  Google Maps API key        (optional, for --google-fallback)
"""

import asyncio
import argparse
import logging
import os
import sys
from pathlib import Path

# Allow imports from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / "backend" / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient
import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("batch_geocode")

# Known region centroid coordinates (approximate) — POIs with these coords need geocoding
REGION_CENTROIDS = [
    (41.45, -8.30),   # norte
    (40.20, -8.40),   # centro
    (38.72, -9.14),   # lisboa
    (38.50, -7.90),   # alentejo
    (37.02, -7.93),   # algarve
    (37.74, -25.67),  # acores
    (32.65, -16.92),  # madeira
    # seed_data.py centroids (slightly different)
    (41.15, -8.61),   # norte (seed)
    (40.21, -8.43),   # centro (seed)
    (38.57, -7.91),   # alentejo (seed)
    (37.74, -25.66),  # acores (seed)
    (32.65, -16.91),  # madeira (seed)
]

CENTROID_TOLERANCE_DEG = 0.35

PORTUGAL_BBOX = {"lat_min": 32.0, "lat_max": 42.5, "lng_min": -31.5, "lng_max": -6.0}

REGION_NAMES = {
    "norte": "Norte de Portugal",
    "centro": "Centro de Portugal",
    "lisboa": "Lisboa, Portugal",
    "alentejo": "Alentejo, Portugal",
    "algarve": "Algarve, Portugal",
    "acores": "Açores, Portugal",
    "madeira": "Madeira, Portugal",
}


def is_approximate(lat: float, lng: float) -> bool:
    """Check if coordinates match a known region centroid (i.e. are approximate)."""
    for centroid_lat, centroid_lng in REGION_CENTROIDS:
        if abs(lat - centroid_lat) < CENTROID_TOLERANCE_DEG and abs(lng - centroid_lng) < CENTROID_TOLERANCE_DEG:
            return True
    return False


def is_in_portugal(lat: float, lng: float) -> bool:
    """Validate that coordinates fall within Portugal's bounding box."""
    return (PORTUGAL_BBOX["lat_min"] <= lat <= PORTUGAL_BBOX["lat_max"]
            and PORTUGAL_BBOX["lng_min"] <= lng <= PORTUGAL_BBOX["lng_max"])


def build_query(poi: dict) -> str:
    """Build a geocoding query string from POI data."""
    parts = []
    if poi.get("address"):
        parts.append(poi["address"])
    if poi.get("name"):
        parts.append(poi["name"])
    if poi.get("region"):
        parts.append(REGION_NAMES.get(poi["region"], "Portugal"))
    if not parts:
        parts.append("Portugal")
    return ", ".join(parts)


def build_nominatim_query(poi: dict) -> str:
    """Build a Nominatim-optimized query (address first, then name + region)."""
    parts = []
    if poi.get("address") and poi["address"] not in ("Portugal", "Todo o país"):
        parts.append(poi["address"])
    elif poi.get("name"):
        parts.append(poi["name"])
    if poi.get("region"):
        parts.append(REGION_NAMES.get(poi["region"], "Portugal"))
    if not parts:
        parts.append("Portugal")
    return ", ".join(parts)


# ---- Nominatim (FREE) ----

_nominatim_last_request = 0.0


async def geocode_nominatim(client: httpx.AsyncClient, query: str) -> dict | None:
    """Call Nominatim (OpenStreetMap) API. Free, respects 1 req/s rate limit."""
    global _nominatim_last_request

    now = asyncio.get_event_loop().time()
    elapsed = now - _nominatim_last_request
    if elapsed < 1.05:
        await asyncio.sleep(1.05 - elapsed)
    _nominatim_last_request = asyncio.get_event_loop().time()

    params = {
        "q": query,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": 1,
        "accept-language": "pt",
        "countrycodes": "pt",
    }
    headers = {
        "User-Agent": "PortugalVivo/2.0 (heritage-geocoding; batch)",
        "Accept": "application/json",
    }
    try:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params=params,
            headers=headers,
        )
        if resp.status_code == 429:
            logger.warning("Nominatim rate limited, waiting 5s...")
            await asyncio.sleep(5)
            return None

        if resp.status_code != 200:
            logger.debug("Nominatim HTTP %d for %r", resp.status_code, query)
            return None

        data = resp.json()
        if not data:
            return None

        item = data[0]
        lat = float(item.get("lat", 0))
        lng = float(item.get("lon", 0))

        if not is_in_portugal(lat, lng):
            logger.debug("Nominatim result outside Portugal for %r: (%s, %s)", query, lat, lng)
            return None

        display = item.get("display_name", "")

        return {
            "lat": lat,
            "lng": lng,
            "formatted_address": display,
            "place_id": f"osm:{item.get('osm_type', '')}:{item.get('osm_id', '')}",
            "source": "nominatim",
        }
    except Exception as e:
        logger.error("Nominatim error for %r: %s", query, e)
        return None


# ---- Google Maps (PAID fallback) ----

async def geocode_google(client: httpx.AsyncClient, query: str, api_key: str) -> dict | None | str:
    """Call Google Geocoding API. Returns result dict, None, or 'QUOTA_EXCEEDED'."""
    params = {
        "address": query,
        "key": api_key,
        "language": "pt",
        "region": "pt",
    }
    try:
        resp = await client.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
        data = resp.json()
        if data.get("status") == "OK" and data.get("results"):
            result = data["results"][0]
            loc = result["geometry"]["location"]
            lat, lng = loc["lat"], loc["lng"]

            if not is_in_portugal(lat, lng):
                logger.debug("Google result outside Portugal for %r: (%s, %s)", query, lat, lng)
                return None

            return {
                "lat": lat,
                "lng": lng,
                "formatted_address": result.get("formatted_address", ""),
                "place_id": result.get("place_id", ""),
                "source": "google",
            }
        elif data.get("status") == "OVER_QUERY_LIMIT":
            logger.warning("Google API quota exceeded — stopping")
            return "QUOTA_EXCEEDED"
        else:
            logger.debug("Google: no result for %r: %s", query, data.get("status"))
            return None
    except Exception as e:
        logger.error("Google geocoding error for %r: %s", query, e)
        return None


async def main():
    parser = argparse.ArgumentParser(description="Batch geocode POIs with approximate coordinates")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without writing")
    parser.add_argument("--limit", type=int, default=500, help="Max POIs to process (0 = unlimited)")
    parser.add_argument("--region", type=str, help="Only process a specific region")
    parser.add_argument("--force", action="store_true", help="Re-geocode even already precise POIs")
    parser.add_argument("--google-fallback", action="store_true",
                        help="Use Google Maps as fallback when Nominatim fails (costs ~$5/1000)")
    parser.add_argument("--google-only", action="store_true",
                        help="Skip Nominatim, use Google Maps only (legacy mode)")
    args = parser.parse_args()

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
    use_google = args.google_fallback or args.google_only

    if use_google and not api_key:
        logger.error("GOOGLE_MAPS_API_KEY not set but Google geocoding requested.")
        sys.exit(1)

    if args.dry_run:
        logger.info("=== DRY RUN MODE ===")

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "patrimonio_vivo")

    motor_client = AsyncIOMotorClient(mongo_url)
    db = motor_client[db_name]

    query: dict = {}
    if args.region:
        query["region"] = args.region

    if not args.force:
        query["geocoded_exact"] = {"$ne": True}

    projection = {"_id": 0, "id": 1, "name": 1, "address": 1, "region": 1, "location": 1, "geocoded_exact": 1}
    cursor = db.heritage_items.find(query, projection)
    if args.limit > 0:
        cursor = cursor.limit(args.limit)
    pois = await cursor.to_list(length=args.limit if args.limit > 0 else 10000)

    candidates = []
    for poi in pois:
        loc = poi.get("location") or {}
        lat = loc.get("lat") or loc.get("latitude")
        lng = loc.get("lng") or loc.get("longitude")

        if lat is None or lng is None:
            candidates.append(poi)
        elif args.force or is_approximate(float(lat), float(lng)):
            candidates.append(poi)

    logger.info("Found %d POIs needing geocoding (out of %d queried)", len(candidates), len(pois))

    if not candidates:
        logger.info("Nothing to do.")
        motor_client.close()
        return

    if args.dry_run:
        for poi in candidates[:30]:
            q = build_nominatim_query(poi)
            loc = poi.get("location", {})
            logger.info("  [DRY] %s | query=%r | current=(%s, %s)",
                        poi.get("name", "?"), q,
                        loc.get("lat", "?"), loc.get("lng", "?"))
        if len(candidates) > 30:
            logger.info("  ... and %d more", len(candidates) - 30)
        logger.info("Dry run complete. %d POIs would be processed.", len(candidates))

        if use_google:
            logger.info("Estimated cost with Google fallback: ~$%.2f (assuming ~20%% Nominatim failures)",
                        len(candidates) * 0.2 * 0.005)
        else:
            logger.info("Cost: $0.00 (Nominatim only, free)")

        motor_client.close()
        return

    stats = {
        "nominatim_ok": 0, "nominatim_fail": 0,
        "google_ok": 0, "google_fail": 0,
        "skipped_approximate": 0, "skipped_outside_pt": 0,
        "updated": 0, "total_processed": 0,
    }

    async with httpx.AsyncClient(timeout=15) as http:
        for i, poi in enumerate(candidates):
            stats["total_processed"] += 1
            result = None

            if not args.google_only:
                nom_query = build_nominatim_query(poi)
                result = await geocode_nominatim(http, nom_query)

                if result:
                    stats["nominatim_ok"] += 1
                else:
                    stats["nominatim_fail"] += 1
                    if poi.get("name") and poi.get("address"):
                        alt_query = f"{poi['name']}, Portugal"
                        result = await geocode_nominatim(http, alt_query)
                        if result:
                            stats["nominatim_ok"] += 1
                            stats["nominatim_fail"] -= 1

            if result is None and use_google:
                google_query = build_query(poi)
                result = await geocode_google(http, google_query, api_key)

                if result == "QUOTA_EXCEEDED":
                    logger.error("Google quota exceeded after %d POIs. Re-run later.", i)
                    break

                if result:
                    stats["google_ok"] += 1
                else:
                    stats["google_fail"] += 1

            if result is None:
                continue

            if is_approximate(result["lat"], result["lng"]):
                logger.debug("Skipping %s — geocoded to region centroid", poi.get("name"))
                stats["skipped_approximate"] += 1
                continue

            update = {
                "$set": {
                    "location": {
                        "lat": result["lat"],
                        "lng": result["lng"]
                    },
                    "geocoded_exact": True,
                    "geocoded_address": result["formatted_address"],
                    "geocoded_place_id": result["place_id"],
                    "geocoded_source": result["source"],
                }
            }

            await db.heritage_items.update_one({"id": poi["id"]}, update)
            stats["updated"] += 1

            if (i + 1) % 50 == 0:
                logger.info("Progress: %d/%d | Updated: %d | Nominatim: %d ok / %d fail | Google: %d ok / %d fail",
                            i + 1, len(candidates), stats["updated"],
                            stats["nominatim_ok"], stats["nominatim_fail"],
                            stats["google_ok"], stats["google_fail"])

    logger.info("=" * 60)
    logger.info("GEOCODING COMPLETE")
    logger.info("=" * 60)
    logger.info("  Total processed:    %d", stats["total_processed"])
    logger.info("  Updated:            %d", stats["updated"])
    logger.info("  Nominatim success:  %d", stats["nominatim_ok"])
    logger.info("  Nominatim failed:   %d", stats["nominatim_fail"])
    if use_google:
        logger.info("  Google success:     %d", stats["google_ok"])
        logger.info("  Google failed:      %d", stats["google_fail"])
        logger.info("  Est. Google cost:   $%.2f", stats["google_ok"] * 0.005)
    logger.info("  Skipped (approx):   %d", stats["skipped_approximate"])
    logger.info("=" * 60)

    motor_client.close()


if __name__ == "__main__":
    asyncio.run(main())
