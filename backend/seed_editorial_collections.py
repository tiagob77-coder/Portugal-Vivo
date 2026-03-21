"""
Seed: 3 Editorial Curated Collections (P2-2)

Collections:
  1. Portugal à Mesa         — gastronomia, pratos típicos, tabernas, mercados
  2. Fim de Semana Histórico — castelos, palácios, museus, aldeias históricas
  3. Portugal Vivo em Família — praias fluviais, parques, percursos fáceis, cascatas

Run:
    cd backend && python seed_editorial_collections.py
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "portugal_vivo")

EDITORIAL_AUTHOR_ID = "editorial-portugal-vivo"

COLLECTIONS = [
    {
        "slug": "portugal-a-mesa",
        "title": "Portugal à Mesa",
        "description": (
            "Uma viagem pelos sabores mais autênticos de Portugal. "
            "Das sopas tradicionais às tabernas centenárias, dos mercados de aldeia "
            "aos produtores DOP — uma coleção para quem quer comer bem e comer bem português."
        ),
        "cover_image_url": None,
        "tags": ["gastronomia", "sopas", "tabernas", "mercados", "produtores", "DOP", "tradição"],
        "region": None,  # nacional
        "author_type": "editorial",
        "is_published": True,
        # poi_ids are resolved dynamically from categories
        "_categories": ["gastronomia"],
        "_limit": 30,
    },
    {
        "slug": "fim-de-semana-historico",
        "title": "Fim de Semana Histórico",
        "description": (
            "Portugal tem mais castelos por km² do que qualquer outro país europeu. "
            "Esta coleção leva-te aos fortes, palácios, mosteiros e aldeias medievais "
            "mais marcantes — um fim de semana que parece uma viagem no tempo."
        ),
        "cover_image_url": None,
        "tags": ["história", "castelos", "palácios", "museus", "arqueologia", "medieval", "patrimônio"],
        "region": None,
        "author_type": "editorial",
        "is_published": True,
        "_categories": ["arqueologia", "arte"],
        "_limit": 30,
    },
    {
        "slug": "portugal-vivo-em-familia",
        "title": "Portugal Vivo em Família",
        "description": (
            "Cascatas de água cristalina, praias fluviais com bandeira azul, "
            "percursos pedestres acessíveis e parques naturais onde os miúdos podem "
            "descobrir Portugal ao ar livre. A coleção perfeita para um fim de semana em família."
        ),
        "cover_image_url": None,
        "tags": ["família", "crianças", "natureza", "praias fluviais", "cascatas", "percursos", "ar livre"],
        "region": None,
        "author_type": "editorial",
        "is_published": True,
        "_categories": ["piscinas", "aventura", "areas_protegidas"],
        "_limit": 30,
    },
]


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    inserted = 0
    skipped = 0

    for col_def in COLLECTIONS:
        existing = await db.curated_collections.find_one({"slug": col_def["slug"]})
        if existing:
            print(f"  SKIP  {col_def['title']} (already exists)")
            skipped += 1
            continue

        # Resolve POI IDs from heritage_items by category
        categories = col_def.pop("_categories")
        limit = col_def.pop("_limit")

        poi_docs = await db.heritage_items.find(
            {"category": {"$in": categories}},
            {"_id": 0, "id": 1}
        ).limit(limit).to_list(limit)
        poi_ids = [p["id"] for p in poi_docs]

        now = datetime.now(timezone.utc)
        doc = {
            "id": str(uuid.uuid4()),
            "author_id": EDITORIAL_AUTHOR_ID,
            "poi_ids": poi_ids,
            "created_at": now,
            "updated_at": now,
            **{k: v for k, v in col_def.items()},
        }

        await db.curated_collections.insert_one(doc)
        print(f"  OK    {col_def['title']} — {len(poi_ids)} POIs")
        inserted += 1

    # Ensure indexes
    await db.curated_collections.create_index("slug", unique=True)
    await db.curated_collections.create_index("is_published")
    await db.curated_collections.create_index("tags")
    await db.favorites.create_index([("user_id", 1), ("poi_id", 1)], unique=True)
    await db.favorites.create_index("user_id")

    print(f"\nDone: {inserted} inserted, {skipped} skipped.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
