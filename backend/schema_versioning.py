"""
Schema versioning system for MongoDB.
Tracks which migrations have been applied and provides a simple framework
for running new migrations idempotently.

Usage:
    from schema_versioning import run_migrations
    await run_migrations(db)
"""
import logging
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 2  # Increment when adding new migrations


async def get_current_version(db: AsyncIOMotorDatabase) -> int:
    """Get the current schema version from the database."""
    doc = await db.schema_versions.find_one(
        {}, sort=[("version", -1)]
    )
    return doc["version"] if doc else 0


async def _record_version(db: AsyncIOMotorDatabase, version: int, description: str):
    """Record a migration as applied."""
    await db.schema_versions.insert_one({
        "version": version,
        "description": description,
        "applied_at": datetime.now(timezone.utc),
    })
    logger.info("  Schema version %d applied: %s", version, description)


# --- Migration definitions ---

async def _migrate_v1(db: AsyncIOMotorDatabase):
    """v1: Ensure geo_location GeoJSON field exists for 2dsphere queries."""
    count = 0
    cursor = db.heritage_items.find(
        {"location.lat": {"$exists": True}, "geo_location": {"$exists": False}},
        {"_id": 1, "location": 1}
    )
    async for doc in cursor:
        loc = doc.get("location", {})
        lat, lng = loc.get("lat"), loc.get("lng")
        if lat is not None and lng is not None:
            await db.heritage_items.update_one(
                {"_id": doc["_id"]},
                {"$set": {"geo_location": {
                    "type": "Point",
                    "coordinates": [lng, lat],
                }}}
            )
            count += 1
    logger.info("    v1: Added geo_location to %d heritage items", count)


async def _migrate_v2(db: AsyncIOMotorDatabase):
    """v2: Normalize created_at strings to datetime objects in users collection."""
    count = 0
    cursor = db.users.find(
        {"created_at": {"$type": "string"}},
        {"_id": 1, "created_at": 1}
    )
    async for doc in cursor:
        try:
            dt = datetime.fromisoformat(doc["created_at"].replace("Z", "+00:00"))
            await db.users.update_one(
                {"_id": doc["_id"]},
                {"$set": {"created_at": dt}}
            )
            count += 1
        except (ValueError, AttributeError):
            pass
    logger.info("    v2: Normalized %d user created_at fields to datetime", count)


# Migration registry: version -> (function, description)
MIGRATIONS = {
    1: (_migrate_v1, "Add geo_location GeoJSON to heritage_items"),
    2: (_migrate_v2, "Normalize users.created_at strings to datetime"),
}


async def run_migrations(db: AsyncIOMotorDatabase) -> int:
    """Run any pending schema migrations. Returns number of migrations applied."""
    current = await get_current_version(db)
    applied = 0

    if current >= SCHEMA_VERSION:
        logger.info("Schema is up to date (version %d)", current)
        return 0

    logger.info("Schema at version %d, target is %d", current, SCHEMA_VERSION)

    for version in range(current + 1, SCHEMA_VERSION + 1):
        if version not in MIGRATIONS:
            logger.warning("No migration function for version %d, skipping", version)
            continue

        func, description = MIGRATIONS[version]
        logger.info("Running migration v%d: %s", version, description)
        await func(db)
        await _record_version(db, version, description)
        applied += 1

    logger.info("Schema migrations complete. Applied %d migrations.", applied)
    return applied
