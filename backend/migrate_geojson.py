"""
Migration: Add GeoJSON geo_location field to heritage_items for MongoDB $geoNear.
Converts {lat, lng} to GeoJSON Point format and creates 2dsphere index.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

async def migrate_geojson():
    client = AsyncIOMotorClient(os.environ.get('MONGO_URL'))
    db = client[os.environ.get('DB_NAME')]

    # Convert location {lat, lng} → geo_location GeoJSON Point
    cursor = db.heritage_items.find(
        {"location": {"$exists": True, "$ne": None}, "geo_location": {"$exists": False}},
        {"_id": 1, "location": 1}
    )

    count = 0
    async for item in cursor:
        loc = item.get("location")
        if loc and "lat" in loc and "lng" in loc:
            geo = {
                "type": "Point",
                "coordinates": [loc["lng"], loc["lat"]]  # GeoJSON: [lng, lat]
            }
            await db.heritage_items.update_one(
                {"_id": item["_id"]},
                {"$set": {"geo_location": geo}}
            )
            count += 1

    logger.info(f"Migrated {count} items to GeoJSON format")

    # Create 2dsphere index
    await db.heritage_items.create_index(
        [("geo_location", "2dsphere")],
        name="idx_heritage_geo_2dsphere",
        sparse=True
    )
    logger.info("Created 2dsphere index on geo_location")

    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_geojson())
