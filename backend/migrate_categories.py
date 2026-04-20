"""
Migration script: remap existing POIs from old category IDs to new subcategory IDs.

This script reads the OLD_TO_NEW_CATEGORY mapping from shared_constants and
applies it to all heritage_items in MongoDB, updating the 'category' field.

Safe to run multiple times (idempotent).
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# Import mapping from shared constants
from shared_constants import OLD_TO_NEW_CATEGORY, SUBCATEGORY_IDS


async def migrate_categories():
    """Remap old category IDs to new subcategory IDs in heritage_items."""
    print("=" * 60)
    print("POI Category Migration: old IDs -> new subcategory IDs")
    print("=" * 60)

    total_updated = 0
    total_skipped = 0
    total_already_new = 0

    # Show current state
    total_pois = await db.heritage_items.count_documents({})
    print(f"\nTotal POIs in database: {total_pois}")

    # Count POIs per old category
    print("\n--- Current category distribution ---")
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    async for doc in db.heritage_items.aggregate(pipeline):
        cat_id = doc["_id"]
        count = doc["count"]
        status = ""
        if cat_id in OLD_TO_NEW_CATEGORY:
            status = f" -> {OLD_TO_NEW_CATEGORY[cat_id]}"
        elif cat_id in SUBCATEGORY_IDS:
            status = " (already new)"
        else:
            status = " (UNKNOWN - will skip)"
        print(f"  {cat_id}: {count}{status}")

    # Apply migration
    print("\n--- Migrating ---")
    for old_id, new_id in OLD_TO_NEW_CATEGORY.items():
        if old_id == new_id:
            # Same ID (e.g. miradouros -> miradouros), skip
            count = await db.heritage_items.count_documents({"category": old_id})
            if count > 0:
                print(f"  {old_id} -> {new_id}: {count} (same ID, no change needed)")
                total_already_new += count
            continue

        result = await db.heritage_items.update_many(
            {"category": old_id},
            {
                "$set": {
                    "category": new_id,
                    "legacy_category": old_id,
                    "migrated_at": datetime.now(timezone.utc),
                },
            },
        )

        if result.modified_count > 0:
            print(f"  {old_id} -> {new_id}: {result.modified_count} updated")
            total_updated += result.modified_count
        else:
            total_skipped += 1

    # Also check for items already using new IDs
    for sub_id in SUBCATEGORY_IDS:
        if sub_id not in OLD_TO_NEW_CATEGORY.values():
            count = await db.heritage_items.count_documents({"category": sub_id})
            if count > 0:
                total_already_new += count

    print("\n--- Results ---")
    print(f"  Updated: {total_updated}")
    print(f"  Already new IDs: {total_already_new}")
    print(f"  Old IDs with no POIs: {total_skipped}")

    # Final distribution
    print("\n--- New category distribution ---")
    async for doc in db.heritage_items.aggregate(pipeline):
        cat_id = doc["_id"]
        count = doc["count"]
        is_valid = cat_id in SUBCATEGORY_IDS
        print(f"  {cat_id}: {count} {'OK' if is_valid else 'UNKNOWN'}")

    print("\nMigration complete.")


async def rollback_migration():
    """Rollback migration using legacy_category field."""
    print("Rolling back category migration...")

    result = await db.heritage_items.find(
        {"legacy_category": {"$exists": True}},
    ).to_list(None)

    count = 0
    for item in result:
        await db.heritage_items.update_one(
            {"_id": item["_id"]},
            {
                "$set": {"category": item["legacy_category"]},
                "$unset": {"legacy_category": "", "migrated_at": ""},
            },
        )
        count += 1

    print(f"Rolled back {count} items.")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--rollback":
        asyncio.run(rollback_migration())
    else:
        asyncio.run(migrate_categories())
