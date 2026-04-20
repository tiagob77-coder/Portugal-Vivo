"""
Backfill `name_normalised` on existing heritage_items.

Post-Fase3D cleanup: the poi_dedup.find_duplicate helper prefers the
indexed `name_normalised` field but falls back to a regex scan when the
field is absent. This script eliminates the fallback path by populating
the field on every existing row.

Idempotent — only touches documents missing or with an outdated value,
so it's safe to re-run after a fresh import.

Run (from backend/):
    python scripts/backfill_name_normalised.py
    python scripts/backfill_name_normalised.py --dry-run
    python scripts/backfill_name_normalised.py --batch-size 500
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from typing import Any, Dict, List

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_THIS_DIR)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from poi_dedup import normalise_name  # noqa: E402


async def backfill(db, *, batch_size: int = 1000, dry_run: bool = False) -> Dict[str, int]:
    """Populate `name_normalised` on every heritage_items row where it's
    missing or stale. Returns a summary dict.
    """
    collection = db.heritage_items

    total = await collection.count_documents({})
    # Scan every doc — we can't use a $regex-on-name filter because we
    # specifically need rows with the wrong normalisation, which we only
    # know after computing it. Iterate lazily via the cursor.
    cursor = collection.find(
        {}, {"_id": 1, "name": 1, "name_normalised": 1}
    )

    scanned = 0
    updated = 0
    skipped_no_name = 0
    pending: List[Any] = []

    from pymongo import UpdateOne

    async for doc in cursor:
        scanned += 1
        raw_name = doc.get("name")
        if not raw_name:
            skipped_no_name += 1
            continue
        expected = normalise_name(raw_name)
        current = doc.get("name_normalised")
        if current == expected:
            continue

        pending.append(
            UpdateOne({"_id": doc["_id"]}, {"$set": {"name_normalised": expected}})
        )
        if len(pending) >= batch_size:
            if not dry_run:
                result = await collection.bulk_write(pending, ordered=False)
                updated += result.modified_count
            else:
                updated += len(pending)
            pending.clear()

    if pending:
        if not dry_run:
            result = await collection.bulk_write(pending, ordered=False)
            updated += result.modified_count
        else:
            updated += len(pending)

    return {
        "total_documents": total,
        "scanned": scanned,
        "updated": updated,
        "skipped_no_name": skipped_no_name,
        "dry_run": dry_run,
    }


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Backfill name_normalised on heritage_items")
    parser.add_argument("--dry-run", action="store_true", help="Report without writing")
    parser.add_argument("--batch-size", type=int, default=1000, help="Bulk write batch size")
    args = parser.parse_args()

    from motor.motor_asyncio import AsyncIOMotorClient

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(mongo_url)
    try:
        summary = await backfill(
            client[db_name],
            batch_size=args.batch_size,
            dry_run=args.dry_run,
        )
    finally:
        client.close()

    print(
        f"Scanned: {summary['scanned']}/{summary['total_documents']} | "
        f"Updated: {summary['updated']} | "
        f"No-name: {summary['skipped_no_name']} | "
        f"Dry-run: {summary['dry_run']}"
    )


if __name__ == "__main__":
    asyncio.run(_main())
