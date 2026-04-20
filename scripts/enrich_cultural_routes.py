#!/usr/bin/env python3
"""
Portugal Vivo — Cultural Routes Enrichment Script
==================================================
Runs the Cultural Routes Hub enrichment pipeline manually or from CI/cron.

Sources crossed:
  - cultural_routes  (base route data, falls back to SEED_ROUTES)
  - heritage_items   (POIs within 15 km of each route stop)
  - events           (upcoming events matching route region + festival names)
  - trails           (walking trails near route centroid)

Target collection: cultural_routes_enriched (TTL 7 days)

Env vars:
  MONGO_URL  — Atlas SRV URI (required)
  DB_NAME    — Mongo database name (required)

Usage:
  python scripts/enrich_cultural_routes.py
  MONGO_URL=... DB_NAME=... python scripts/enrich_cultural_routes.py
"""
import asyncio
import importlib.util
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"

sys.path.insert(0, str(BACKEND_DIR))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


def _load_module(name: str, path: Path):
    if not path.exists():
        raise ImportError(f"Module not found: {path}")
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not build importlib spec for {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


async def main() -> int:
    mongo_url = "".join(os.environ.get("MONGO_URL", "").split())
    db_name = os.environ.get("DB_NAME", "").strip()

    if not mongo_url or not db_name:
        print("ERROR: MONGO_URL and DB_NAME must be set.", file=sys.stderr)
        return 2

    print(f"→ Connecting to MongoDB (db={db_name}) …")
    client = AsyncIOMotorClient(mongo_url, w="majority", serverSelectionTimeoutMS=20000)
    db = client[db_name]

    # Load hub module directly (bypasses services/__init__.py)
    try:
        hub = _load_module("cultural_routes_hub_isolated", BACKEND_DIR / "cultural_routes_hub.py")
    except Exception as exc:
        print(f"ERROR loading cultural_routes_hub: {exc}", file=sys.stderr)
        return 3

    # Verify connection
    try:
        before = await db["cultural_routes_enriched"].count_documents({})
        routes_total = await db["cultural_routes"].count_documents({})
        print(f"→ cultural_routes in DB:           {routes_total}")
        print(f"→ cultural_routes_enriched before: {before}")
    except Exception as exc:
        print(f"ERROR connecting: {exc}", file=sys.stderr)
        return 4

    print("→ Running bootstrap_enrichment() …")
    enriched_count = await hub.bootstrap_enrichment(db)

    after = await db["cultural_routes_enriched"].count_documents({})
    print(f"→ cultural_routes_enriched after:  {after}  (processed: {enriched_count})")

    # Breakdown by family
    pipeline = [
        {"$group": {"_id": "$family", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
    ]
    print("→ Breakdown by family:")
    async for row in db["cultural_routes_enriched"].aggregate(pipeline):
        fam = row.get("_id") or "(no family)"
        print(f"    {fam:30s} {row['n']}")

    # Sample connection density
    pipeline2 = [
        {"$group": {"_id": None, "avg_conn": {"$avg": "$connections_count"},
                    "max_iq": {"$max": "$dynamic_iq_score"}}},
    ]
    async for row in db["cultural_routes_enriched"].aggregate(pipeline2):
        print(f"→ Avg connections per route: {row.get('avg_conn', 0):.1f}")
        print(f"→ Max dynamic IQ score:      {row.get('max_iq', 0)}")

    client.close()
    print("✓ Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
