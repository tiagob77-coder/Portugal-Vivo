"""
Apply POI GPS corrections from poi_gps_v19.json to MongoDB heritage_items.

Reads the JSON produced by `extract_poi_gps_v19.py` and updates existing
POIs whose `location` is empty, missing, or out of the Portugal bounding
box. Matches POIs by normalised name + region (and falls back to fuzzy
nearest match within a sheet/category bucket when name-only matching is
ambiguous).

Precision-aware updates (GEO-004):
  Each POI in the JSON carries `coord_precision` (precise | municipality |
  district | region) and `coord_source` (gps_col | centroid_concelho | …).
  By default an update only fires when the new precision is **at least as
  good** as the existing one — protects POIs that already have precise
  coords from being silently downgraded to a region centroid.

Run modes:
  --dry-run            Compute and report changes without writing (default).
  --apply              Persist updates.
  --force              Re-write even when the new precision matches the
                       existing one (refresh proveniência). Does NOT enable
                       downgrade — see --allow-downgrade.
  --allow-downgrade    Permit overwriting a more-precise coord with a less-
                       precise one. DANGEROUS — only when you know the
                       JSON is the new source of truth.

Usage:
    python apply_poi_gps_v19.py --dry-run
    python apply_poi_gps_v19.py --apply
    python apply_poi_gps_v19.py --apply --force
    python apply_poi_gps_v19.py --apply --allow-downgrade  # rare
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

# Precision ladder — higher means more accurate. The extractor produces these
# strings; an existing heritage_items doc without coord_precision is treated
# as `UNKNOWN_RANK` (the floor) so the JSON always wins over un-annotated
# legacy rows.
_PRECISION_RANKS = {
    "precise": 4,
    "municipality": 3,
    "district": 2,
    "region": 1,
}
UNKNOWN_RANK = 0


def precision_rank(precision: Any) -> int:
    """Map a coord_precision string to its rank. Unknown/missing → 0."""
    if not isinstance(precision, str):
        return UNKNOWN_RANK
    return _PRECISION_RANKS.get(precision.lower(), UNKNOWN_RANK)


def coords_in_portugal(loc: Any) -> bool:
    if not isinstance(loc, dict):
        return False
    lat, lng = loc.get("lat"), loc.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return False
    return LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX


# Decision values returned by decide_update.
APPLY = "apply"
SKIP_EXISTING_BETTER = "skip_existing_better"
SKIP_DOWNGRADE_BLOCKED = "skip_downgrade_blocked"
SKIP_SAME_PRECISION = "skip_same_precision"


def decide_update(
    existing_doc: dict,
    new_poi: dict,
    *,
    force: bool,
    allow_downgrade: bool,
) -> str:
    """Pure decision: does this new POI replace the existing one?

    Decision ladder:
      - Existing has no valid coords inside Portugal → ALWAYS apply
        (we're filling a hole; precision comparison is irrelevant).
      - new_rank > existing_rank → apply (upgrade).
      - new_rank == existing_rank: apply only when --force is set
        (otherwise it's a redundant write; idempotency saves the write
        anyway, but skipping early saves the round-trip).
      - new_rank < existing_rank: skip unless --allow-downgrade is set.
    """
    existing_loc = existing_doc.get("location") or {}
    if not coords_in_portugal(existing_loc):
        return APPLY
    existing_rank = precision_rank(existing_doc.get("coord_precision"))
    new_rank = precision_rank(new_poi.get("coord_precision"))
    if new_rank > existing_rank:
        return APPLY
    if new_rank == existing_rank:
        return APPLY if force else SKIP_SAME_PRECISION
    # new < existing — would be a downgrade.
    if allow_downgrade:
        return APPLY
    return SKIP_DOWNGRADE_BLOCKED


def build_update_doc(poi: dict) -> dict:
    """Build the $set payload, propagating precision/source metadata so the
    frontend can render a "localização aproximada" badge and so a future
    re-run knows what kind of coord this row carries."""
    loc = poi.get("location") or {}
    precision = (poi.get("coord_precision") or "").lower() or None
    source = poi.get("coord_source") or None
    # gps_source captures the high-level origin in one field. Precise coords
    # from the Excel keep the historical "excel_v19" tag; centroid-derived
    # coords get tagged "excel_v19_centroid" so dashboards can split them.
    gps_source = "excel_v19" if precision == "precise" else "excel_v19_centroid"
    payload = {
        "location": {"lat": float(loc["lat"]), "lng": float(loc["lng"])},
        "gps_source": gps_source,
        "gps_source_sheet": poi.get("sheet"),
        "coord_precision": precision,
        "coord_source": source,
        "coord_approximate": precision != "precise",
    }
    return {k: v for k, v in payload.items() if v is not None}


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
    """Return the best heritage_items doc for this POI, or None.

    Matching ladder (more specific first → less specific):
      1. `poi_source_id` exact hit.
      2. `name_normalised` + region + sheet (`folha_origem`).
      3. `name_normalised` + region + category.
      4. `name_normalised` + region (legacy / single-candidate cases).

    Steps 2–3 stop the same heritage_items document being updated by
    multiple Excel rows that share a name+region (e.g. "Mercado do Bolhão"
    appearing in both *Mercados e Feiras* and *Restaurantes e Gastronomia*).
    Without it, --apply --force walks the same row repeatedly and leaves
    sibling duplicates stale.
    """
    if poi.get("source_id") and poi["source_id"] in index["by_source_id"]:
        return index["by_source_id"][poi["source_id"]]

    norm = poi["name_normalised"]
    candidates = index["by_norm"].get(norm, [])
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]

    target_region = _normalise_region(poi.get("region"))
    region_matches = [
        c for c in candidates
        if not target_region or _normalise_region(c.get("region")) == target_region
    ] or candidates

    target_sheet = (poi.get("sheet") or "").strip().lower()
    if target_sheet:
        for c in region_matches:
            if (c.get("folha_origem") or "").strip().lower() == target_sheet:
                return c

    target_category = (poi.get("category") or "").strip().lower()
    if target_category:
        for c in region_matches:
            if (c.get("category") or "").strip().lower() == target_category:
                return c

    return region_matches[0]


async def apply(
    db: AsyncIOMotorDatabase,
    pois: list[dict],
    *,
    dry_run: bool,
    force: bool,
    allow_downgrade: bool = False,
) -> dict:
    index = await load_index(db)

    stats = {
        "in_excel": len(pois),
        "matched": 0,
        "unmatched": 0,
        "to_update": 0,
        "updated": 0,
        "skipped_no_change": 0,
        "skipped_same_precision": 0,
        "skipped_downgrade_blocked": 0,
        "by_category": defaultdict(lambda: {"matched": 0, "updated": 0}),
    }
    samples: list[dict] = []
    downgrade_samples: list[dict] = []

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

        decision = decide_update(existing, poi, force=force, allow_downgrade=allow_downgrade)
        if decision == SKIP_SAME_PRECISION:
            stats["skipped_same_precision"] += 1
            continue
        if decision == SKIP_DOWNGRADE_BLOCKED:
            stats["skipped_downgrade_blocked"] += 1
            if len(downgrade_samples) < 5:
                downgrade_samples.append({
                    "name": existing.get("name"),
                    "id": existing.get("id"),
                    "existing_precision": existing.get("coord_precision"),
                    "new_precision": poi.get("coord_precision"),
                })
            continue

        # decision == APPLY
        stats["to_update"] += 1
        existing_loc = existing.get("location") or {}
        if len(samples) < 8:
            samples.append({
                "name": existing.get("name"),
                "id": existing.get("id"),
                "before": existing_loc,
                "after": loc,
                "source_sheet": poi.get("sheet"),
                "new_precision": poi.get("coord_precision"),
            })

        if dry_run:
            continue

        result = await db.heritage_items.update_one(
            {"id": existing["id"]},
            {"$set": build_update_doc(poi)},
        )
        if result.modified_count:
            stats["updated"] += 1
            stats["by_category"][poi["category"]]["updated"] += 1
        else:
            stats["skipped_no_change"] += 1

    stats["by_category"] = dict(stats["by_category"])
    stats["samples"] = samples
    stats["downgrade_samples"] = downgrade_samples
    return stats


def print_report(stats: dict, *, dry_run: bool) -> None:
    log.info("\n" + "=" * 60)
    log.info("📊 RESULT" + (" (dry-run)" if dry_run else ""))
    log.info("=" * 60)
    log.info(f"  POIs in JSON:                 {stats['in_excel']}")
    log.info(f"  Matched in heritage_items:    {stats['matched']}")
    log.info(f"  Unmatched (not in DB):        {stats['unmatched']}")
    log.info(f"  Skipped — same precision:     {stats['skipped_same_precision']}")
    log.info(f"  Skipped — downgrade blocked:  {stats['skipped_downgrade_blocked']}")
    log.info(f"  To update:                    {stats['to_update']}")
    if not dry_run:
        log.info(f"  Updated:                      {stats['updated']}")
        log.info(f"  No-op writes (idempotent):    {stats['skipped_no_change']}")
    log.info("\n  By category (matched / updated):")
    for cat, c in sorted(stats["by_category"].items(), key=lambda kv: -kv[1]["matched"]):
        log.info(f"    {cat:<20} {c['matched']:>5} / {c['updated']:>5}")
    if stats.get("samples"):
        log.info("\n  Sample updates:")
        for s in stats["samples"]:
            log.info(f"    • {s['name']} [{s.get('new_precision','?')}]: {s['before']} → {s['after']}")
    if stats.get("downgrade_samples"):
        log.info("\n  ⚠️  Downgrade attempts blocked (use --allow-downgrade to permit):")
        for s in stats["downgrade_samples"]:
            log.info(f"    • {s['name']}: existing={s['existing_precision']} → new={s['new_precision']}")


async def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--json", type=Path, default=DEFAULT_JSON)
    p.add_argument("--dry-run", action="store_true", default=True)
    p.add_argument("--apply", dest="apply_changes", action="store_true",
                   help="Persist updates to MongoDB (turns off dry-run).")
    p.add_argument("--force", action="store_true",
                   help="Re-write rows whose precision matches the new value "
                        "(refresh proveniência). Does NOT enable downgrade — "
                        "use --allow-downgrade for that.")
    p.add_argument("--allow-downgrade", action="store_true",
                   help="Permit overwriting a more-precise coord with a "
                        "less-precise one. DANGEROUS — only when the JSON "
                        "is the new source of truth.")
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

    stats = await apply(
        db, pois,
        dry_run=args.dry_run,
        force=args.force,
        allow_downgrade=args.allow_downgrade,
    )
    print_report(stats, dry_run=args.dry_run)

    if args.dry_run:
        log.info("\nℹ️  Dry-run: no writes performed. Re-run with --apply to persist.")
    client.close()
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    sys.exit(asyncio.run(main()))
