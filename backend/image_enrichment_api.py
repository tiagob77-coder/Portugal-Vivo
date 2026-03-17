"""
Image Enrichment Service for Portugal Vivo.
Strategy: 1) Wikimedia Commons (free, no key) → 2) Unsplash (if key configured) → 3) AI generation (OpenAI).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import httpx
import os
import base64
import logging
import asyncio


logger = logging.getLogger(__name__)

from shared_utils import DatabaseHolder

image_router = APIRouter()

_db_holder = DatabaseHolder("image_enrichment")
_require_auth = None
_require_admin = None

UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Category → search keywords mapping (Portuguese heritage context)
CATEGORY_SEARCH_PT = {
    # New subcategory IDs (44-subcategory taxonomy)
    "praias_fluviais": "praia fluvial piscina natural portugal",
    "termas_banhos": "termas portugal balneário termal",
    "festas_romarias": "romaria procissão tradição portugal festa",
    "fauna_autoctone": "fauna ibérica portugal aves natureza",
    "flora_autoctone": "flora portugal árvore bosque mata",
    "flora_botanica": "jardim botânico flora portugal",
    "barragens_albufeiras": "rio portugal vale paisagem barragem",
    "arqueologia_geologia": "ruínas arqueologia castro portugal mineral",
    "rotas_tematicas": "aldeia histórica portugal pedra rota",
    "cascatas_pocos": "cascata portugal queda água poço",
    "restaurantes_gastronomia": "gastronomia portuguesa comida tradicional",
    "tabernas_historicas": "tasca taberna portugal restaurante",
    "musica_tradicional": "fado música tradicional portugal",
    "festivais_musica": "festival música concerto portugal",
    "castelos": "castelo medieval portugal fortaleza",
    "museus": "museu exposição portugal cultura",
    "arte_urbana": "azulejo arte portuguesa mural street art",
    "oficios_artesanato": "artesanato tradicional portugal ofícios",
    "aventura_natureza": "aventura trilho caminhada portugal",
    "miradouros": "miradouro panorâmica portugal paisagem",
    "ecovias_passadicos": "passadiço ecovia percurso portugal",
    "percursos_pedestres": "percurso pedestre trilho caminhada",
    "surf": "surf praia ondas portugal",
    "praias_bandeira_azul": "praia bandeira azul portugal costa",
    "palacios_solares": "palácio solar mansão portugal",
    "patrimonio_ferroviario": "comboio estação ferrovia portugal",
    "mercados_feiras": "mercado feira tradicional portugal",
    "produtores_dop": "produtor DOP queijo vinho portugal",
    "agroturismo_enoturismo": "enoturismo vinho adega portugal",
    "natureza_especializada": "parque natural reserva portugal",
    "moinhos_azenhas": "moinho azenha água portugal",
    "alojamentos_rurais": "turismo rural alojamento portugal",
    "parques_campismo": "campismo parque camping portugal",
}


def set_image_db(database):
    _db_holder.set(database)


def set_image_auth(require_auth_func, require_admin_func):
    global _require_auth, _require_admin
    _require_auth = require_auth_func
    _require_admin = require_admin_func


# ========================
# WIKIMEDIA COMMONS SEARCH (FREE, NO KEY)
# ========================

async def search_wikimedia(query: str, count: int = 5) -> List[dict]:
    """Search Wikimedia Commons for images. Free, no API key needed."""
    try:
        async with httpx.AsyncClient(
            timeout=15,
            headers={"User-Agent": "PatrimonioVivo/2.0 (heritage-app; contact@patrimoniovivo.pt)"}
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
                    "iiprop": "url|extmetadata|mime",
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

                thumb_url = info.get("thumburl", info.get("url", ""))
                if not thumb_url:
                    continue

                meta = info.get("extmetadata", {})
                artist = meta.get("Artist", {}).get("value", "Wikimedia Commons")
                # Strip HTML from artist
                import re
                artist = re.sub(r'<[^>]+>', '', artist).strip()

                results.append({
                    "url": thumb_url,
                    "full_url": info.get("url", thumb_url),
                    "photographer": artist[:100],
                    "source": "wikimedia",
                    "license": meta.get("LicenseShortName", {}).get("value", "CC"),
                    "title": page.get("title", "").replace("File:", "")
                })
            return results
    except Exception as e:
        logger.error(f"Wikimedia search error: {e}")
        return []


# ========================
# UNSPLASH SEARCH (OPTIONAL - NEEDS KEY)
# ========================

async def search_unsplash(query: str, count: int = 5) -> List[dict]:
    """Search Unsplash for images. Requires UNSPLASH_ACCESS_KEY."""
    if not UNSPLASH_ACCESS_KEY:
        return []

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "per_page": count, "orientation": "landscape"},
                headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"}
            )
            if resp.status_code != 200:
                return []

            data = resp.json()
            results = []
            for photo in data.get("results", []):
                results.append({
                    "url": photo["urls"]["regular"],
                    "photographer": photo["user"]["name"],
                    "source": "unsplash",
                    "license": "Unsplash License"
                })
            return results
    except Exception as e:
        logger.error(f"Unsplash search error: {e}")
        return []


# ========================
# AI IMAGE GENERATION (FALLBACK)
# ========================

async def generate_ai_image(poi_name: str, category: str, region: str) -> Optional[str]:
    """Generate an AI image for a POI using OpenAI. Returns base64 string."""
    if not EMERGENT_LLM_KEY:
        return None

    try:
        from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration

        prompt = (
            f"A beautiful photograph of '{poi_name}' in {region}, Portugal. "
            f"Category: {category}. Scenic, professional travel photography, "
            f"natural lighting, high quality, landscape orientation."
        )

        image_gen = OpenAIImageGeneration(api_key=EMERGENT_LLM_KEY)
        images = await image_gen.generate_images(
            prompt=prompt,
            model="gpt-image-1",
            number_of_images=1
        )

        if images and len(images) > 0:
            return base64.b64encode(images[0]).decode('utf-8')
        return None
    except Exception as e:
        logger.error(f"AI image generation error: {e}")
        return None


# ========================
# MODELS
# ========================

class ImageSearchRequest(BaseModel):
    query: str
    count: int = Field(default=5, ge=1, le=20)


class EnrichRequest(BaseModel):
    item_id: str
    source: str = Field(default="auto", description="auto, wikimedia, unsplash, or ai")


class BatchEnrichRequest(BaseModel):
    category: Optional[str] = None
    limit: int = Field(default=20, ge=1, le=100)
    dry_run: bool = False


# ========================
# ENDPOINTS
# ========================

@image_router.get("/images/search")
async def search_images(query: str, count: int = 5):
    """Search for public images (Wikimedia Commons + Unsplash if configured)"""
    wikimedia_results = await search_wikimedia(query, count)
    unsplash_results = await search_unsplash(query, count) if UNSPLASH_ACCESS_KEY else []

    all_results = wikimedia_results + unsplash_results
    return {
        "images": all_results[:count],
        "total": len(all_results),
        "sources": {
            "wikimedia": len(wikimedia_results),
            "unsplash": len(unsplash_results)
        }
    }


@image_router.post("/images/enrich")
async def enrich_poi_image(request: EnrichRequest):
    """Enrich a single POI with an image (Wikimedia → Unsplash → AI)"""
    item = await _db_holder.db.heritage_items.find_one({"id": request.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item.get("image_url") and request.source == "auto":
        return {"message": "Item ja tem imagem", "image_url": item["image_url"], "skipped": True}

    category = item.get("category", "")
    name = item.get("name", "")
    region = item.get("region", "")

    image_url = None
    source_used = None

    # Step 1: Try Wikimedia Commons (free, no key)
    if request.source in ("auto", "wikimedia"):
        keywords = CATEGORY_SEARCH_PT.get(category, category)
        search_query = f"{name} {keywords}"
        results = await search_wikimedia(search_query, 1)
        if results:
            image_url = results[0]["url"]
            source_used = "wikimedia"

    # Step 2: Try Unsplash (if configured)
    if not image_url and request.source in ("auto", "unsplash"):
        keywords = CATEGORY_SEARCH_PT.get(category, category)
        results = await search_unsplash(f"{name} {keywords}", 1)
        if results:
            image_url = results[0]["url"]
            source_used = "unsplash"

    # Step 3: Fallback to AI generation
    if not image_url and request.source in ("auto", "ai"):
        base64_img = await generate_ai_image(name, category, region)
        if base64_img:
            await _db_holder.db.poi_images.insert_one({
                "item_id": request.item_id,
                "image_base64": base64_img,
                "source": "ai_generated",
                "created_at": datetime.now(timezone.utc)
            })
            image_url = f"/api/images/serve/{request.item_id}"
            source_used = "ai_generated"

    if image_url:
        await _db_holder.db.heritage_items.update_one(
            {"id": request.item_id},
            {"$set": {
                "image_url": image_url,
                "image_source": source_used,
                "image_updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Imagem atualizada", "image_url": image_url, "source": source_used}

    return {"message": "Nao foi possivel encontrar imagem", "source": None}


@image_router.get("/images/serve/{item_id}")
async def serve_ai_image(item_id: str):
    """Serve an AI-generated image for a POI"""
    from fastapi.responses import Response as FastAPIResponse
    record = await _db_holder.db.poi_images.find_one({"item_id": item_id}, {"_id": 0, "image_base64": 1})
    if not record or not record.get("image_base64"):
        raise HTTPException(status_code=404, detail="Imagem nao encontrada")

    img_bytes = base64.b64decode(record["image_base64"])
    return FastAPIResponse(content=img_bytes, media_type="image/png",
                          headers={"Cache-Control": "public, max-age=86400"})


@image_router.post("/images/batch-enrich")
async def batch_enrich_images(request: BatchEnrichRequest):
    """Batch enrich POIs without images. Wikimedia first → AI fallback."""
    query = {"$or": [{"image_url": {"$exists": False}}, {"image_url": None}, {"image_url": ""}]}
    if request.category:
        query["category"] = request.category

    items = await _db_holder.db.heritage_items.find(
        query, {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1}
    ).limit(request.limit).to_list(request.limit)

    if request.dry_run:
        return {
            "message": f"Dry run: {len(items)} POIs sem imagem encontrados",
            "items": [{"id": i["id"], "name": i["name"], "category": i.get("category")} for i in items],
            "total": len(items)
        }

    results = {"enriched": 0, "wikimedia": 0, "unsplash": 0, "ai": 0, "failed": 0, "details": []}

    for item in items:
        try:
            category = item.get("category", "")
            name = item.get("name", "")
            keywords = CATEGORY_SEARCH_PT.get(category, category)
            search_query = f"{name} {keywords}"

            image_url = None
            source = None

            # Try Wikimedia first (free)
            wiki_results = await search_wikimedia(search_query, 1)
            if wiki_results:
                image_url = wiki_results[0]["url"]
                source = "wikimedia"

            # Try Unsplash if configured
            if not image_url and UNSPLASH_ACCESS_KEY:
                uns_results = await search_unsplash(search_query, 1)
                if uns_results:
                    image_url = uns_results[0]["url"]
                    source = "unsplash"

            # AI fallback
            if not image_url:
                base64_img = await generate_ai_image(name, category, item.get("region", ""))
                if base64_img:
                    await _db_holder.db.poi_images.insert_one({
                        "item_id": item["id"],
                        "image_base64": base64_img,
                        "source": "ai_generated",
                        "created_at": datetime.now(timezone.utc)
                    })
                    image_url = f"/api/images/serve/{item['id']}"
                    source = "ai_generated"

            if image_url:
                await _db_holder.db.heritage_items.update_one(
                    {"id": item["id"]},
                    {"$set": {
                        "image_url": image_url,
                        "image_source": source,
                        "image_updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                results["enriched"] += 1
                results[source if source != "ai_generated" else "ai"] += 1
                results["details"].append({"id": item["id"], "name": name, "source": source})
            else:
                results["failed"] += 1
                results["details"].append({"id": item["id"], "name": name, "source": "failed"})

            # Small delay to be nice to Wikimedia API
            await asyncio.sleep(0.5)

        except Exception as e:
            logger.error(f"Enrichment error for {item.get('name')}: {e}")
            results["failed"] += 1

    return results


@image_router.get("/images/status")
async def get_image_status():
    """Get overview of POI image coverage"""
    total = await _db_holder.db.heritage_items.count_documents({})
    with_image = await _db_holder.db.heritage_items.count_documents({
        "image_url": {"$exists": True, "$ne": None, "$ne": ""}
    })
    without_image = total - with_image

    # By source
    wikimedia = await _db_holder.db.heritage_items.count_documents({"image_source": "wikimedia"})
    unsplash = await _db_holder.db.heritage_items.count_documents({"image_source": "unsplash"})
    ai_gen = await _db_holder.db.heritage_items.count_documents({"image_source": "ai_generated"})
    seed = with_image - wikimedia - unsplash - ai_gen

    # By category (without images)
    pipeline = [
        {"$match": {"$or": [{"image_url": {"$exists": False}}, {"image_url": None}, {"image_url": ""}]}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    by_category = await _db_holder.db.heritage_items.aggregate(pipeline).to_list(30)

    return {
        "total_pois": total,
        "with_image": with_image,
        "without_image": without_image,
        "coverage_pct": round(with_image / total * 100, 1) if total > 0 else 0,
        "by_source": {"seed_data": seed, "wikimedia": wikimedia, "unsplash": unsplash, "ai_generated": ai_gen},
        "without_image_by_category": [{"category": r["_id"], "count": r["count"]} for r in by_category],
        "wikimedia_available": True,
        "unsplash_configured": bool(UNSPLASH_ACCESS_KEY),
        "ai_configured": bool(EMERGENT_LLM_KEY)
    }
