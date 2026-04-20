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

Note:
  The backend's `services/__init__.py` pulls heavy deps (pydantic, FastAPI
  transitives) that this seed script shouldn't need. To avoid that, we load
  `public_events_service.py` directly via importlib, bypassing the package
  __init__.
"""
import asyncio
import importlib.util
import os
import sys
from pathlib import Path
from urllib.parse import urlparse, quote_plus, urlunparse

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"

# Ensure backend/ is on sys.path so `import excel_events_data` inside the
# service module resolves against the real file in backend/.
sys.path.insert(0, str(BACKEND_DIR))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


def _load_service_module():
    """
    Load backend/services/public_events_service.py directly from file so the
    `services/__init__.py` (which imports pydantic-based modules) is never
    executed.
    """
    service_path = BACKEND_DIR / "services" / "public_events_service.py"
    if not service_path.exists():
        raise ImportError(f"Service file not found: {service_path}")

    spec = importlib.util.spec_from_file_location(
        "public_events_service_isolated", service_path
    )
    if spec is None or spec.loader is None:
        raise ImportError("Could not build importlib spec for service file")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _normalize_mongo_url(raw: str) -> str:
    """
    Strip whitespace and re-encode credentials so special chars
    (e.g. @, :, #, !, %) in the password don't break URI parsing.
    urllib.parse.urlparse decodes percent-encoded values, so
    quote_plus re-encodes them safely regardless of prior state.
    """
    url = "".join(raw.split())  # remove all whitespace / newlines
    parsed = urlparse(url)
    if parsed.username is not None:
        user = quote_plus(parsed.username)
        pwd  = quote_plus(parsed.password or "")
        host = parsed.hostname or ""
        if parsed.port:
            host = f"{host}:{parsed.port}"
        new_netloc = f"{user}:{pwd}@{host}"
        url = urlunparse(parsed._replace(netloc=new_netloc))
    return url


async def main() -> int:
    raw_url = os.environ.get("MONGO_URL", "")
    db_name = os.environ.get("DB_NAME", "").strip()

    if not raw_url or not db_name:
async def main() -> int:
    # Whitespace-robust URI handling (guards against newlines in secrets)
    mongo_url = "".join(os.environ.get("MONGO_URL", "").split())
    db_name = os.environ.get("DB_NAME", "").strip()

    if not mongo_url or not db_name:
        print("ERROR: MONGO_URL and DB_NAME must be set in the environment.",
              file=sys.stderr)
        return 2

    mongo_url = _normalize_mongo_url(raw_url)

    print(f"→ Connecting to MongoDB (db={db_name}) …")
    client = AsyncIOMotorClient(mongo_url, w="majority",
                                serverSelectionTimeoutMS=20000)
    db = client[db_name]

    try:
        svc_module = _load_service_module()
        public_events_service = svc_module.public_events_service
    except Exception as exc:  # ImportError, SyntaxError, etc.
        print(f"ERROR loading public_events_service: {exc}", file=sys.stderr)
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
