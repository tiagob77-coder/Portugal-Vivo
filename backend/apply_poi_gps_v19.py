"""
Apply POI GPS corrections from poi_gps_v19.json to MongoDB heritage_items.

Reads the JSON produced by `extract_poi_gps_v19.py` and updates existing
POIs whose `location` is empty, missing, or out of the Portugal bounding
box. Matches POIs by normalised name + region (and falls back to fuzzy
nearest match within a sheet/category bucket when name-only matching is
ambiguous).

Run modes:
  --dry-run    Compute and report changes without writing (default).
  --apply      Persist updates.
  --force      Overwrite even POIs whose coords are already inside Portugal.

Usage:
    python apply_poi_gps_v19.py --dry-run
    python apply_poi_gps_v19.py --apply
    python apply_poi_gps_v19.py --apply --force
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

log = logging.getLogger(__name__)

DEFAULT_JSON = Path(__file__).parent / "data" / "poi_gps_v19.json"

LAT_MIN, LAT_MAX = 32.0, 43.0
LNG_MIN, LNG_MAX = -32.0, -6.0


def coords_in_portugal(loc: Any) -> bool:
    if not isinstance(loc, dict):
        return False
    lat, lng = loc.get("lat"), loc.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return False
    return LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX


async def load_index(db: AsyncIOMotorDatabase) -> dict:
    """Build an in-memory index over heritage_items keyed by name_normalised."""
    log.info("📇 Indexing heritage_items …")
    cursor = db.heritage_items.find(
        {},
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "name_normalised": 1,
            "region": 1,
            "category": 1,
            "folha_origem": 1,
            "location": 1,
            "poi_source_id": 1,
        },
    )

    # Local copy of the dedup-normaliser so this script doesn't need MongoDB to
    # be reachable just to import shared_utils.
    from poi_dedup import normalise_name as _normalise

    by_norm: dict[str, list[dict]] = defaultdict(list)
    by_source_id: dict[str, dict] = {}
    total = 0
    async for doc in cursor:
        total += 1
        norm = doc.get("name_normalised") or _normalise(doc.get("name"))
        doc["_norm"] = norm
        by_norm[norm].append(doc)
        if doc.get("poi_source_id"):
            by_source_id[doc["poi_source_id"]] = doc
    log.info(f"   loaded {total} heritage items")
    return {"by_norm": by_norm, "by_source_id": by_source_id, "total": total}


def _normalise_region(r: Optional[str]) -> str:
    if not r:
        return ""
    return r.lower().strip()


def match_existing(poi: dict, index: dict) -> Optional[dict]:
    """Return the best heritage_items doc for this POI, or None."""
    if poi.get("source_id") and poi["source_id"] in index["by_source_id"]:
        return index["by_source_id"][poi["source_id"]]

    norm = poi["name_normalised"]
    candidates = index["by_norm"].get(norm, [])
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]
    target_region = _normalise_region(poi.get("region"))
    if target_region:
        for c in candidates:
            if _normalise_region(c.get("region")) == target_region:
                return c
    return candidates[0]


async def apply(
    db: AsyncIOMotorDatabase,
    pois: list[dict],
    *,
    dry_run: bool,
    force: bool,
) -> dict:
    index = await load_index(db)

    stats = {
        "in_excel": len(pois),
        "matched": 0,
        "unmatched": 0,
        "already_ok": 0,
        "to_update": 0,
        "updated": 0,
        "skipped_no_change": 0,
        "by_category": defaultdict(lambda: {"matched": 0, "updated": 0}),
    }
    samples: list[dict] = []

    for poi in pois:
        loc = poi.get("location")
        if not loc:
            continue
        existing = match_existing(poi, index)
        if existing is None:
            stats["unmatched"] += 1
            continue
        stats["matched"] += 1
        stats["by_category"][poi["category"]]["matched"] += 1

        existing_loc = existing.get("location") or {}
        existing_ok = coords_in_portugal(existing_loc)

        if existing_ok and not force:
            stats["already_ok"] += 1
            continue

        stats["to_update"] += 1
        if len(samples) < 8:
            samples.append({
                "name": existing.get("name"),
                "id": existing.get("id"),
                "before": existing_loc,
                "after": loc,
                "source_sheet": poi.get("sheet"),
            })

        if dry_run:
            continue

        result = await db.heritage_items.update_one(
            {"id": existing["id"]},
            {"$set": {
                "location": {"lat": float(loc["lat"]), "lng": float(loc["lng"])},
                "gps_source": "excel_v19",
                "gps_source_sheet": poi.get("sheet"),
            }},
        )
        if result.modified_count:
            stats["updated"] += 1
            stats["by_category"][poi["category"]]["updated"] += 1
        else:
            stats["skipped_no_change"] += 1

    stats["by_category"] = dict(stats["by_category"])
    stats["samples"] = samples
    return stats


def print_report(stats: dict, *, dry_run: bool) -> None:
    log.info("\n" + "=" * 60)
    log.info("📊 RESULT" + (" (dry-run)" if dry_run else ""))
    log.info("=" * 60)
    log.info(f"  POIs in JSON:              {stats['in_excel']}")
    log.info(f"  Matched in heritage_items: {stats['matched']}")
    log.info(f"  Unmatched (not in DB):     {stats['unmatched']}")
    log.info(f"  Already had valid coords:  {stats['already_ok']}")
    log.info(f"  Need updating:             {stats['to_update']}")
    if not dry_run:
        log.info(f"  Updated:                   {stats['updated']}")
        log.info(f"  No-op writes:              {stats['skipped_no_change']}")
    log.info("\n  By category (matched / updated):")
    for cat, c in sorted(stats["by_category"].items(), key=lambda kv: -kv[1]["matched"]):
        log.info(f"    {cat:<20} {c['matched']:>5} / {c['updated']:>5}")
    if stats.get("samples"):
        log.info("\n  Sample updates:")
        for s in stats["samples"]:
            log.info(f"    • {s['name']}: {s['before']} → {s['after']}")


async def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--json", type=Path, default=DEFAULT_JSON)
    p.add_argument("--dry-run", action="store_true", default=True)
    p.add_argument("--apply", dest="apply_changes", action="store_true",
                   help="Persist updates to MongoDB (turns off dry-run).")
    p.add_argument("--force", action="store_true",
                   help="Overwrite even when the existing coords look valid.")
    p.add_argument("--mongo-url", default=os.environ.get("MONGO_URL"))
    p.add_argument("--db-name", default=os.environ.get("DB_NAME"))
    args = p.parse_args()

    if args.apply_changes:
        args.dry_run = False

    if not args.json.exists():
        log.error(f"JSON not found: {args.json} — run extract_poi_gps_v19.py first.")
        return 1
    if not args.mongo_url or not args.db_name:
        log.error("MONGO_URL and DB_NAME must be set (env or flags).")
        return 1

    payload = json.loads(args.json.read_text())
    pois = payload["pois"]
    log.info(f"📥 Loaded {len(pois)} POIs with coords from {args.json.name}")

    client = AsyncIOMotorClient(args.mongo_url, serverSelectionTimeoutMS=10000)
    db = client[args.db_name]
    try:
        await db.command("ping")
    except Exception as e:
        log.error(f"Cannot reach MongoDB at {args.mongo_url}: {e}")
        return 2

    stats = await apply(db, pois, dry_run=args.dry_run, force=args.force)
    print_report(stats, dry_run=args.dry_run)

    if args.dry_run:
        log.info("\nℹ️  Dry-run: no writes performed. Re-run with --apply to persist.")
    client.close()
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    sys.exit(asyncio.run(main()))
