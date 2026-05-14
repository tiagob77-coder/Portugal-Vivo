"""
Enriches POI image_url fields using Wikimedia Commons API + Cloudinary Fetch.

For each POI without an image_url:
  1. Search Wikimedia Commons by POI name (returns real photos of that specific place)
  2. If no result, fall back to Unsplash Source with name + category search term
  3. Wrap the source URL in a Cloudinary Fetch transform: ar_1:1,c_fill,w_600,q_auto,f_auto

Requires env vars: MONGO_URL, DB_NAME, CLOUDINARY_CLOUD_NAME
Run: python backend/enrich_poi_images_wikimedia.py
"""
import asyncio
import os
import urllib.parse
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "")

WIKIMEDIA_SEARCH = "https://commons.wikimedia.org/w/api.php"
UNSPLASH_SOURCE = "https://source.unsplash.com/600x600/?"

BATCH_SIZE = 50
REQUEST_DELAY = 0.35  # seconds between Wikimedia requests (polite crawling)


def cloudinary_fetch(source_url: str) -> str:
    """Wrap any public image URL in a Cloudinary Fetch transform (ar 1:1, fill crop)."""
    if not CLOUD_NAME:
        return source_url
    encoded = urllib.parse.quote(source_url, safe="")
    return (
        f"https://res.cloudinary.com/{CLOUD_NAME}/image/fetch/"
        f"ar_1:1,c_fill,w_600,q_auto,f_auto/{encoded}"
    )


async def wikimedia_image_url(client: httpx.AsyncClient, poi_name: str) -> str | None:
    """
    Search Wikimedia Commons for a photo of this POI.
    Returns a direct 600px thumbnail URL, or None if nothing found.
    """
    query = urllib.parse.quote(f"{poi_name} portugal")

    # Step 1: find file title
    try:
        r = await client.get(
            WIKIMEDIA_SEARCH,
            params={
                "action": "query",
                "list": "search",
                "srsearch": f"{poi_name} portugal",
                "srnamespace": "6",
                "format": "json",
                "srlimit": "3",
                "srprop": "snippet",
            },
            timeout=8,
        )
        data = r.json()
    except Exception:
        return None

    results = data.get("query", {}).get("search", [])
    if not results:
        return None

    # Pick first result that looks like a photo (jpg/png), skip logos/maps
    file_title = None
    for res in results:
        title: str = res.get("title", "")
        lower = title.lower()
        if any(ext in lower for ext in (".jpg", ".jpeg", ".png", ".webp")):
            if not any(skip in lower for skip in ("flag", "coat", "arms", "map", "logo", "shield", "svg")):
                file_title = title
                break

    if not file_title:
        return None

    # Step 2: get image URL with iiurlwidth=600 thumbnail
    try:
        r2 = await client.get(
            WIKIMEDIA_SEARCH,
            params={
                "action": "query",
                "titles": file_title,
                "prop": "imageinfo",
                "iiprop": "url",
                "iiurlwidth": "600",
                "format": "json",
            },
            timeout=8,
        )
        pages = r2.json().get("query", {}).get("pages", {})
    except Exception:
        return None

    for page in pages.values():
        info = page.get("imageinfo", [])
        if info:
            thumb = info[0].get("thumburl") or info[0].get("url")
            if thumb:
                return thumb

    return None


def unsplash_fallback(poi_name: str, category: str) -> str:
    """Unsplash Source URL — no API key needed, 600x600 crop."""
    # Build search term: poi name keywords + category + portugal
    name_words = poi_name.lower().replace("-", " ").split()[:3]
    terms = ",".join(name_words + [category, "portugal", "photography"])
    encoded = urllib.parse.quote(terms)
    return f"{UNSPLASH_SOURCE}{encoded}"


async def enrich_batch(db, pois: list, client: httpx.AsyncClient) -> int:
    updated = 0
    for poi in pois:
        name = poi.get("name", "")
        category = poi.get("category", "")

        source_url = await wikimedia_image_url(client, name)
        await asyncio.sleep(REQUEST_DELAY)

        if not source_url:
            source_url = unsplash_fallback(name, category)

        final_url = cloudinary_fetch(source_url)

        await db.heritage_items.update_one(
            {"_id": poi["_id"]},
            {"$set": {"image_url": final_url}},
        )
        updated += 1

    return updated


async def main() -> None:
    client_db = AsyncIOMotorClient(MONGO_URL)
    db = client_db[DB_NAME]

    total_pois = await db.heritage_items.count_documents({})
    missing = await db.heritage_items.count_documents({
        "$or": [
            {"image_url": None},
            {"image_url": {"$exists": False}},
            {"image_url": ""},
        ]
    })

    print(f"Total POIs: {total_pois} | Sem imagem: {missing}")

    if missing == 0:
        print("Todos os POIs já têm image_url. Para forçar re-enriquecimento, limpa o campo primeiro.")
        return

    cursor = db.heritage_items.find({
        "$or": [
            {"image_url": None},
            {"image_url": {"$exists": False}},
            {"image_url": ""},
        ]
    }).batch_size(200)

    # Stream-iterate to avoid materialising thousands of POIs at once.
    pois = [poi async for poi in cursor]
    total_updated = 0
    headers = {"User-Agent": "PortugalVivo/1.0 (educational; contact@portugalvivo.pt)"}

    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        for i in range(0, len(pois), BATCH_SIZE):
            batch = pois[i : i + BATCH_SIZE]
            n = await enrich_batch(db, batch, client)
            total_updated += n
            print(f"  ✓ {total_updated}/{missing} enriquecidos...")

    print(f"\n✅ {total_updated} POIs atualizados com imagens reais (Wikimedia + Cloudinary Fetch 1:1)")

    samples = await db.heritage_items.find(
        {"image_url": {"$ne": None}}, {"name": 1, "image_url": 1}
    ).limit(5).to_list(5)
    print("\nExemplos:")
    for s in samples:
        print(f"  {s['name']}")
        print(f"  → {s['image_url'][:90]}...")


if __name__ == "__main__":
    asyncio.run(main())
