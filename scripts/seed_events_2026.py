#!/usr/bin/env python3
"""
Portugal Vivo — Events Seed for 2026

Runs the same logic as the backend startup hook (server.py:1053) but can be
triggered manually from CI, a VPS shell, or a developer machine.

Sources merged:
  1. Curated events for year 2026 (~60)
  2. Excel-sourced events (200 from EXCEL_EVENTS_2026)
  3. dados.gov.pt (best-effort, may fail silently in restricted networks)

Target collection: events (also caches in events_cache).

Env vars:
  MONGO_URL   — Atlas SRV URI (required)
  DB_NAME     — Mongo database name (required)

Usage:
  python scripts/seed_events_2026.py
  MONGO_URL=... DB_NAME=... python scripts/seed_events_2026.py
"""
import asyncio
import os
import sys
from pathlib import Path

# Allow running from repo root: add backend/ to sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


async def main() -> int:
    # Whitespace-robust URI handling (guards against newlines in secrets)
    mongo_url = "".join(os.environ.get("MONGO_URL", "").split())
    db_name = os.environ.get("DB_NAME", "").strip()

    if not mongo_url or not db_name:
        print("ERROR: MONGO_URL and DB_NAME must be set in the environment.",
              file=sys.stderr)
        return 2

    print(f"→ Connecting to MongoDB (db={db_name}) …")
    client = AsyncIOMotorClient(mongo_url, w="majority",
                                serverSelectionTimeoutMS=20000)
    db = client[db_name]

    # Lazy import so we get a clear error if the service is missing
    try:
        from services.public_events_service import public_events_service
    except ImportError as exc:
        print(f"ERROR importing public_events_service: {exc}", file=sys.stderr)
        return 3

    public_events_service.set_db(db)

    before = await db.events.count_documents({})
    print(f"→ events collection before sync: {before}")

    print("→ Running sync_to_events_collection() …")
    synced = await public_events_service.sync_to_events_collection()

    # Ensure indexes (idempotent — matches server.py startup hook)
    await db.events.create_index("id", unique=True)
    await db.events.create_index("month")

    after = await db.events.count_documents({})
    print(f"→ events collection after sync:  {after}  (synced in call: {synced})")

    # Breakdown by source (best-effort — ignores missing field)
    pipeline = [
        {"$group": {"_id": "$source", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
    ]
    print("→ Breakdown by source:")
    async for row in db.events.aggregate(pipeline):
        src = row.get("_id") or "(no source)"
        print(f"    {src:30s} {row['n']}")

    client.close()
    print("✓ Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
