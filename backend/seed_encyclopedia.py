"""
Seed encyclopedia articles for each universe.
Generates articles from existing heritage_items data.
Uses the correct subcategory IDs from shared_constants.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Import the actual category mappings from shared_constants
from shared_constants import SUBCATEGORIES_BY_MAIN

# Build universe -> category IDs mapping from the real subcategory definitions
UNIVERSE_CATEGORIES = {}
for main_cat, subs in SUBCATEGORIES_BY_MAIN.items():
    UNIVERSE_CATEGORIES[main_cat] = [s["id"] for s in subs]


async def seed_encyclopedia():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]

    # Clear existing articles
    await db.encyclopedia_articles.delete_many({})
    logger.info("Cleared existing encyclopedia articles")

    total = 0
    for universe_id, categories in UNIVERSE_CATEGORIES.items():
        # Get heritage items for this universe's categories
        items = await db.heritage_items.find(
            {"category": {"$in": categories}},
            {"_id": 0, "id": 1, "name": 1, "description": 1, "category": 1, "region": 1, "image_url": 1}
        ).limit(50).to_list(50)

        articles = []
        for i, item in enumerate(items):
            article = {
                "id": f"enc_{uuid.uuid4().hex[:10]}",
                "title": item["name"],
                "slug": item["name"].lower().replace(" ", "-").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ã", "a").replace("õ", "o").replace("ç", "c")[:60],
                "universe": universe_id,
                "category": item.get("category", ""),
                "region": item.get("region", ""),
                "summary": item.get("description", "")[:200] if item.get("description") else f"Artigo sobre {item['name']} em Portugal.",
                "content": item.get("description", f"Descubra {item['name']}, um tesouro do património vivo de Portugal."),
                "image_url": item.get("image_url", ""),
                "heritage_item_id": item["id"],
                "tags": [item.get("category", ""), item.get("region", ""), "portugal", "patrimonio"],
                "views": max(10, 100 - i * 3),
                "likes": max(2, 30 - i),
                "featured": i < 3,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
            articles.append(article)

        if articles:
            await db.encyclopedia_articles.insert_many(articles)
            total += len(articles)
            logger.info(f"  {universe_id}: {len(articles)} articles created (from categories: {categories[:3]}...)")

    logger.info(f"\nTotal: {total} encyclopedia articles created")

    # Verify
    count = await db.encyclopedia_articles.count_documents({})
    featured = await db.encyclopedia_articles.count_documents({"featured": True})
    logger.info(f"Verification: {count} articles, {featured} featured")

    client.close()

if __name__ == "__main__":
    asyncio.run(seed_encyclopedia())
