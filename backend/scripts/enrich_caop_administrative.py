#!/usr/bin/env python3
"""
CAOP Administrative Enrichment Script
======================================
Batch-enriches all POIs in MongoDB with official Portuguese administrative
data (Carta Administrativa Oficial de Portugal) via GeoAPI.pt.

For each POI that has GPS coordinates but is missing concelho/freguesia/distrito,
this script calls GeoAPI.pt's reverse geocode endpoint (based on DGT/CAOP data)
and persists the administrative hierarchy into MongoDB.

Usage:
    cd backend
    python scripts/enrich_caop_administrative.py [--limit N] [--dry-run] [--only-missing]

Options:
    --limit N        Process at most N POIs (default: all)
    --dry-run        Do not write to database, only log what would be updated
    --only-missing   Only process POIs that don't have `concelho` set yet (default: True)
    --force-all      Process all POIs, even those already enriched
    --delay SECS     Delay between requests in seconds (default: 1.1 to respect rate limit)
"""
import asyncio
import argparse
import logging
import sys
import os
from datetime import datetime, timezone

# Make sure backend root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from services.geoapi_service import GeoAPIService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB", "portugal_vivo")


async def enrich_all(
    limit: int = 0,
    dry_run: bool = False,
    only_missing: bool = True,
    delay: float = 1.1,
):
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    geoapi = GeoAPIService()

    # Build query
    query: dict = {"location": {"$exists": True}}
    if only_missing:
        query["$or"] = [
            {"concelho": {"$exists": False}},
            {"concelho": ""},
            {"concelho": None},
        ]

    total_pois = await db.heritage_items.count_documents(query)
    if limit:
        total_to_process = min(limit, total_pois)
    else:
        total_to_process = total_pois

    logger.info("=== CAOP Enrichment ===")
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    logger.info(f"POIs to process: {total_to_process} (total matching: {total_pois})")
    logger.info(f"Delay between requests: {delay}s")
    logger.info("")

    cursor = db.heritage_items.find(query, {"_id": 0, "id": 1, "name": 1, "location": 1})
    if limit:
        cursor = cursor.limit(limit)

    processed = 0
    updated = 0
    skipped = 0
    errors = 0

    start_time = datetime.now(timezone.utc)

    async for poi in cursor:
        poi_id = poi.get("id", "")
        poi_name = poi.get("name", "?")
        loc = poi.get("location") or {}
        lat = loc.get("lat")
        lng = loc.get("lng")

        processed += 1
        prefix = f"[{processed}/{total_to_process}] {poi_name[:40]:<40}"

        if not lat or not lng:
            logger.warning(f"{prefix} → sem coordenadas, a saltar")
            skipped += 1
            continue

        try:
            geo = await geoapi.reverse_geocode(lat, lng)
        except Exception as e:
            logger.error(f"{prefix} → erro GeoAPI: {e}")
            errors += 1
            await asyncio.sleep(delay)
            continue

        if not geo:
            logger.warning(f"{prefix} → sem resultado GeoAPI")
            skipped += 1
            await asyncio.sleep(delay)
            continue

        update_fields: dict = {}
        if geo.concelho:
            update_fields["concelho"] = geo.concelho
        if geo.freguesia:
            update_fields["freguesia"] = geo.freguesia
        if geo.distrito:
            update_fields["distrito"] = geo.distrito
        if geo.nuts_iii:
            update_fields["nuts_iii"] = geo.nuts_iii
        if geo.codigo_postal:
            update_fields["codigo_postal"] = geo.codigo_postal
        update_fields["caop_enriched_at"] = datetime.now(timezone.utc).isoformat()

        detail = f"{geo.freguesia}, {geo.concelho} ({geo.distrito})"

        if dry_run:
            logger.info(f"{prefix} → [DRY RUN] {detail}")
        else:
            await db.heritage_items.update_one(
                {"id": poi_id},
                {"$set": update_fields}
            )
            logger.info(f"{prefix} → ✓ {detail}")
            updated += 1

        # Respect GeoAPI.pt rate limit (1 request/second)
        await asyncio.sleep(delay)

    elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
    logger.info("")
    logger.info("=== Enrichment Complete ===")
    logger.info(f"Processed : {processed}")
    logger.info(f"Updated   : {updated}")
    logger.info(f"Skipped   : {skipped}")
    logger.info(f"Errors    : {errors}")
    logger.info(f"Elapsed   : {elapsed:.0f}s")
    logger.info(f"Avg speed : {processed / elapsed:.2f} POIs/s")

    client.close()


def main():
    parser = argparse.ArgumentParser(description="CAOP Administrative Data Enrichment")
    parser.add_argument("--limit", type=int, default=0, help="Max POIs to process")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to DB")
    parser.add_argument("--force-all", action="store_true", help="Process all POIs, not just missing")
    parser.add_argument("--delay", type=float, default=1.1, help="Delay between requests (s)")
    args = parser.parse_args()

    asyncio.run(enrich_all(
        limit=args.limit,
        dry_run=args.dry_run,
        only_missing=not args.force_all,
        delay=args.delay,
    ))


if __name__ == "__main__":
    main()
