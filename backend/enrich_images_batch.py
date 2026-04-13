"""
Smart batch enrichment: Search Wikimedia once per category, distribute images across POIs.
Much faster than individual searches per POI.

Run before deploy:
    cd backend
    python enrich_images_batch.py

Requires MONGO_URL and DB_NAME in .env. Idempotent — only updates POIs that have
no image_url set, so safe to re-run after new POIs are added.
"""
import asyncio
import httpx
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Covers both legacy and 44-subcategory taxonomies.
CATEGORY_SEARCH = {
    # Legacy
    "piscinas": ["praia fluvial portugal", "piscina natural rio portugal"],
    "termas": ["termas portugal", "balneário termal portugal"],
    "crencas": ["romaria portugal", "procissão tradição portugal"],
    "florestas": ["floresta portugal natureza", "mata laurissilva portugal"],
    "fauna": ["fauna portugal ibérica", "aves portugal natureza"],
    "rios": ["rio portugal paisagem vale", "rios portugal natureza"],
    "arqueologia": ["ruínas romanas portugal", "castro arqueologia portugal"],
    # 44-subcategory taxonomy
    "castelos": ["castelo medieval portugal", "fortaleza portugal"],
    "museus": ["museu portugal arte", "museum lisbon portugal"],
    "palacios_solares": ["palácio portugal barroco", "solar portugal"],
    "igrejas": ["igreja portugal manuelina", "mosteiro portugal"],
    "miradouros": ["miradouro portugal panorâmica", "viewpoint portugal landscape"],
    "cascatas_pocos": ["cascata portugal queda água", "waterfall portugal"],
    "praias_fluviais": ["praia fluvial portugal", "river beach portugal"],
    "praias_bandeira_azul": ["praia bandeira azul portugal", "atlantic beach portugal"],
    "surf": ["surf portugal nazaré", "surfing portugal waves"],
    "termas_banhos": ["termas portugal", "thermal spa portugal"],
    "ecovias_passadicos": ["passadiço portugal", "boardwalk portugal"],
    "percursos_pedestres": ["trilho portugal caminhada", "hiking trail portugal"],
    "natureza_especializada": ["parque natural portugal", "nature reserve portugal"],
    "fauna_autoctone": ["fauna ibérica portugal", "wildlife portugal"],
    "flora_autoctone": ["floresta portugal árvores", "sobreiro portugal"],
    "flora_botanica": ["jardim botânico portugal"],
    "barragens_albufeiras": ["barragem portugal alqueva", "albufeira portugal"],
    "arqueologia_geologia": ["arqueologia portugal", "ruínas romanas portugal"],
    "rotas_tematicas": ["aldeia histórica portugal", "monsanto portugal"],
    "moinhos_azenhas": ["moinho portugal pico açores"],
    "aventura_natureza": ["aventura portugal trilho"],
    "gastronomia": ["gastronomia portuguesa", "pastel nata portugal"],
    "restaurantes_gastronomia": ["bacalhau portugal", "comida portuguesa"],
    "tabernas_historicas": ["tasca portugal", "taberna lisboa"],
    "produtores_dop": ["queijo portugal serra", "vinho porto"],
    "agroturismo_enoturismo": ["adega douro portugal", "vinha alentejo"],
    "mercados_feiras": ["mercado bolhão porto", "mercado portugal"],
    "festas": ["festa popular portugal", "marchas lisboa"],
    "festas_romarias": ["romaria portugal procissão"],
    "musica_tradicional": ["fado lisboa portugal"],
    "festivais_musica": ["festival música portugal"],
    "arte_urbana": ["azulejo portugal lisboa", "street art portugal"],
    "oficios_artesanato": ["artesanato portugal", "olaria portugal"],
    "patrimonio_ferroviario": ["estação são bento porto", "comboio portugal"],
    "alojamentos_rurais": ["turismo rural portugal", "casa rural alentejo"],
    "parques_campismo": ["camping portugal natureza"],
}

USER_AGENT = "PatrimonioVivo/2.0 (heritage-app; contact@patrimoniovivo.pt)"


async def search_wikimedia_batch(query: str, count: int = 15) -> list:
    """Search Wikimedia Commons for images."""
    try:
        async with httpx.AsyncClient(
            timeout=20,
            headers={"User-Agent": USER_AGENT}
        ) as client:
            resp = await client.get(
                "https://commons.wikimedia.org/w/api.php",
                params={
                    "action": "query",
                    "generator": "search",
                    "gsrsearch": query,
                    "gsrnamespace": 6,
                    "gsrlimit": count,
                    "prop": "imageinfo",
                    "iiprop": "url|mime",
                    "iiurlwidth": 800,
                    "format": "json"
                }
            )
            if resp.status_code != 200:
                return []

            data = resp.json()
            pages = data.get("query", {}).get("pages", {})
            results = []
            for pid, page in pages.items():
                info = page.get("imageinfo", [{}])[0]
                mime = info.get("mime", "")
                if not mime.startswith("image/"):
                    continue
                thumb = info.get("thumburl", info.get("url", ""))
                if thumb:
                    results.append(thumb)
            return results
    except Exception as e:
        logger.error(f"Wikimedia error for '{query}': {e}")
        return []


async def run():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]

    total_enriched = 0
    total_failed = 0

    for category, queries in CATEGORY_SEARCH.items():
        # Find POIs without images in this category
        pois = await db.heritage_items.find(
            {
                "category": category,
                "$or": [{"image_url": {"$exists": False}}, {"image_url": None}, {"image_url": ""}]
            },
            {"_id": 0, "id": 1, "name": 1}
        ).to_list(200)

        if not pois:
            logger.info(f"  {category}: 0 POIs sem imagem - skip")
            continue

        logger.info(f"  {category}: {len(pois)} POIs sem imagem")

        # Collect images from all search queries for this category
        all_images = []
        for q in queries:
            imgs = await search_wikimedia_batch(q, 15)
            all_images.extend(imgs)
            await asyncio.sleep(1)  # Rate limiting

        # Deduplicate
        all_images = list(dict.fromkeys(all_images))
        logger.info(f"    Found {len(all_images)} unique images from Wikimedia")

        if not all_images:
            total_failed += len(pois)
            continue

        # Distribute images across POIs (round-robin)
        for i, poi in enumerate(pois):
            img_url = all_images[i % len(all_images)]
            await db.heritage_items.update_one(
                {"id": poi["id"]},
                {"$set": {
                    "image_url": img_url,
                    "image_source": "wikimedia",
                    "image_updated_at": datetime.now().isoformat()
                }}
            )
            total_enriched += 1

        logger.info(f"    Enriched {len(pois)} POIs with {len(all_images)} images")

    logger.info(f"\nDone! Enriched: {total_enriched} | Failed: {total_failed}")

    # Final status
    total = await db.heritage_items.count_documents({})
    with_img = await db.heritage_items.count_documents({
        "image_url": {"$exists": True, "$ne": None, "$ne": ""}
    })
    logger.info(f"Coverage: {with_img}/{total} ({round(with_img/total*100, 1)}%)")

    client.close()

if __name__ == "__main__":
    asyncio.run(run())
