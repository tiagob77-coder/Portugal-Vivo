"""
Image Optimization API for Portugal Vivo.
Generates optimized image variants (WebP + JPEG fallback) in multiple sizes,
tracks compression stats, and can apply real photos to POIs.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import logging
import asyncio
import base64

from shared_utils import DatabaseHolder
from services.image_processor import ImageProcessor, ImageProcessingError

logger = logging.getLogger(__name__)

optimization_router = APIRouter()

_db_holder = DatabaseHolder("image_optimization")

processor = ImageProcessor(default_quality=85)


# ------------------------------------------------------------------
# DB setter (called from server.py)
# ------------------------------------------------------------------

def set_optimization_db(database):
    _db_holder.set(database)


# ------------------------------------------------------------------
# Request / response models
# ------------------------------------------------------------------

class BatchOptimizeRequest(BaseModel):
    limit: int = Field(default=20, ge=1, le=200)
    offset: int = Field(default=0, ge=0)
    dry_run: bool = False


class ApplyRealRequest(BaseModel):
    item_id: str


class ApplyRealBatchRequest(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    dry_run: bool = False
    category: Optional[str] = None


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

# Reuse category keyword map from image_enrichment_api (import at call-time
# to avoid circular import issues if both are imported early).
def _get_category_keywords():
    try:
        from image_enrichment_api import CATEGORY_SEARCH_PT
        return CATEGORY_SEARCH_PT
    except ImportError:
        return {}


async def _search_real_image(name: str, category: str, region: str):
    """Search Wikimedia then Unsplash for a real photo. Returns (url, source) or (None, None)."""
    try:
        from image_enrichment_api import search_wikimedia, search_unsplash
    except ImportError:
        return None, None

    keywords_map = _get_category_keywords()

    # Strategy 1: name + region
    query1 = f"{name} {region} Portugal"
    results = await search_wikimedia(query1, 3)
    if results:
        return results[0]["url"], "wikimedia"

    results = await search_unsplash(query1, 1)
    if results:
        return results[0]["url"], "unsplash"

    # Strategy 2: name + category keywords
    keywords = keywords_map.get(category, category)
    query2 = f"{name} {keywords}"
    results = await search_wikimedia(query2, 3)
    if results:
        return results[0]["url"], "wikimedia"

    results = await search_unsplash(query2, 1)
    if results:
        return results[0]["url"], "unsplash"

    return None, None


async def _get_image_bytes_for_item(item: dict) -> Optional[bytes]:
    """Resolve the current image for a heritage item to raw bytes."""
    image_url = item.get("image_url", "")
    if not image_url:
        return None

    # AI-generated images stored as base64 in poi_images collection
    if image_url.startswith("/api/images/serve/"):
        item_id = image_url.rsplit("/", 1)[-1]
        record = await _db_holder.db.poi_images.find_one(
            {"item_id": item_id}, {"_id": 0, "image_base64": 1}
        )
        if record and record.get("image_base64"):
            return base64.b64decode(record["image_base64"])
        return None

    # External URL – download
    try:
        return await processor.download_image(image_url)
    except ImageProcessingError as e:
        logger.warning("Could not download %s: %s", image_url, e)
        return None


async def _store_variants(item_id: str, variants: dict, original_size: int):
    """Store variant bytes in optimized_images collection and return the doc."""
    variant_meta = {}
    total_optimized = 0

    for size_name, fmt_dict in variants.items():
        webp_bytes = fmt_dict["webp"]
        jpeg_bytes = fmt_dict["jpeg"]

        # Store the binary data as base64 strings in the document
        variant_meta[size_name] = {
            "webp": base64.b64encode(webp_bytes).decode("utf-8"),
            "jpeg": base64.b64encode(jpeg_bytes).decode("utf-8"),
            "webp_size": len(webp_bytes),
            "jpeg_size": len(jpeg_bytes),
        }
        total_optimized += len(webp_bytes)  # track WebP size as primary

    compression_ratio = round(1 - (total_optimized / original_size), 3) if original_size else 0

    doc = {
        "item_id": item_id,
        "variants": variant_meta,
        "original_size": original_size,
        "optimized_size": total_optimized,
        "compression_ratio": compression_ratio,
        "created_at": datetime.now(timezone.utc),
    }

    # Upsert so re-optimization replaces previous record
    await _db_holder.db.optimized_images.replace_one(
        {"item_id": item_id}, doc, upsert=True
    )
    return doc


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@optimization_router.post("/images/optimize/{item_id}")
async def optimize_single(item_id: str):
    """Optimize the image for a single POI (download → resize → WebP + JPEG)."""
    item = await _db_holder.db.heritage_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    image_bytes = await _get_image_bytes_for_item(item)
    if not image_bytes:
        raise HTTPException(status_code=404, detail="Item has no image to optimize")

    try:
        info = processor.get_image_info(image_bytes)
        variants = processor.generate_variants(image_bytes)
    except ImageProcessingError as e:
        raise HTTPException(status_code=422, detail=str(e))

    doc = await _store_variants(item_id, variants, len(image_bytes))

    return {
        "message": "Image optimized",
        "item_id": item_id,
        "original": info,
        "original_size": len(image_bytes),
        "optimized_size": doc["optimized_size"],
        "compression_ratio": doc["compression_ratio"],
        "variants": list(variants.keys()),
    }


@optimization_router.post("/images/optimize-batch")
async def optimize_batch(request: BatchOptimizeRequest):
    """Batch optimize POI images. Skips items already optimized."""
    # Find items with images that haven't been optimized yet
    already_optimized = await _db_holder.db.optimized_images.distinct("item_id")

    query = {
        "image_url": {"$exists": True, "$ne": None, "$ne": ""},
    }
    if already_optimized:
        query["id"] = {"$nin": already_optimized}

    items = await _db_holder.db.heritage_items.find(
        query, {"_id": 0, "id": 1, "name": 1, "image_url": 1}
    ).skip(request.offset).limit(request.limit).to_list(request.limit)

    if request.dry_run:
        return {
            "message": f"Dry run: {len(items)} images to optimize",
            "items": [{"id": i["id"], "name": i.get("name", "")} for i in items],
            "total": len(items),
        }

    results = {"optimized": 0, "failed": 0, "details": []}

    for item in items:
        try:
            image_bytes = await _get_image_bytes_for_item(item)
            if not image_bytes:
                results["failed"] += 1
                results["details"].append({"id": item["id"], "status": "no_image_data"})
                continue

            variants = processor.generate_variants(image_bytes)
            await _store_variants(item["id"], variants, len(image_bytes))
            results["optimized"] += 1
            results["details"].append({"id": item["id"], "status": "ok"})
        except Exception as e:
            logger.error("Optimize error for %s: %s", item["id"], e)
            results["failed"] += 1
            results["details"].append({"id": item["id"], "status": f"error: {e}"})

        # Small delay to avoid overwhelming external image servers
        await asyncio.sleep(0.3)

    return results


@optimization_router.get("/images/optimized/{item_id}/{size}")
async def serve_optimized(item_id: str, size: str, fmt: str = "webp"):
    """
    Serve an optimized image variant.
    size: thumbnail, medium, large, original
    fmt: webp (default) or jpeg
    """
    if size not in ("thumbnail", "medium", "large", "original"):
        raise HTTPException(status_code=400, detail="Invalid size. Use: thumbnail, medium, large, original")
    if fmt not in ("webp", "jpeg"):
        raise HTTPException(status_code=400, detail="Invalid format. Use: webp or jpeg")

    record = await _db_holder.db.optimized_images.find_one(
        {"item_id": item_id}, {"_id": 0, f"variants.{size}": 1}
    )
    if not record or size not in record.get("variants", {}):
        raise HTTPException(status_code=404, detail="Optimized image not found")

    variant = record["variants"][size]
    img_b64 = variant.get(fmt)
    if not img_b64:
        raise HTTPException(status_code=404, detail=f"Format {fmt} not available")

    img_bytes = base64.b64decode(img_b64)
    media = "image/webp" if fmt == "webp" else "image/jpeg"
    return Response(
        content=img_bytes,
        media_type=media,
        headers={"Cache-Control": "public, max-age=604800"},  # 7 days
    )


@optimization_router.get("/images/optimization-stats")
async def optimization_stats():
    """Return coverage stats: how many POIs optimized, total savings."""
    total_pois = await _db_holder.db.heritage_items.count_documents({})
    with_image = await _db_holder.db.heritage_items.count_documents({
        "image_url": {"$exists": True, "$ne": None, "$ne": ""}
    })
    optimized_count = await _db_holder.db.optimized_images.count_documents({})

    # Aggregate savings
    pipeline = [
        {"$group": {
            "_id": None,
            "total_original": {"$sum": "$original_size"},
            "total_optimized": {"$sum": "$optimized_size"},
            "avg_ratio": {"$avg": "$compression_ratio"},
        }}
    ]
    agg = await _db_holder.db.optimized_images.aggregate(pipeline).to_list(1)
    savings = agg[0] if agg else {"total_original": 0, "total_optimized": 0, "avg_ratio": 0}

    return {
        "total_pois": total_pois,
        "with_image": with_image,
        "optimized": optimized_count,
        "not_optimized": with_image - optimized_count,
        "coverage_pct": round(optimized_count / with_image * 100, 1) if with_image else 0,
        "total_original_bytes": savings.get("total_original", 0),
        "total_optimized_bytes": savings.get("total_optimized", 0),
        "total_saved_bytes": savings.get("total_original", 0) - savings.get("total_optimized", 0),
        "avg_compression_ratio": round(savings.get("avg_ratio", 0), 3),
    }


# ------------------------------------------------------------------
# Apply real images
# ------------------------------------------------------------------

@optimization_router.post("/images/apply-real/{item_id}")
async def apply_real_image(item_id: str):
    """Search for a real photo of this POI (Wikimedia/Unsplash), apply it, then optimize."""
    item = await _db_holder.db.heritage_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    name = item.get("name", "")
    category = item.get("category", "")
    region = item.get("region", "")

    image_url, source = await _search_real_image(name, category, region)

    if not image_url:
        # Fallback: keep existing image
        existing_bytes = await _get_image_bytes_for_item(item)
        if existing_bytes:
            try:
                variants = processor.generate_variants(existing_bytes)
                await _store_variants(item_id, variants, len(existing_bytes))
                return {
                    "message": "No real image found; optimized existing image",
                    "item_id": item_id,
                    "source": item.get("image_source", "existing"),
                    "optimized": True,
                }
            except ImageProcessingError as e:
                raise HTTPException(status_code=422, detail=str(e))
        raise HTTPException(status_code=404, detail="No real image found and no existing image to optimize")

    # Download and optimize the real image
    try:
        image_bytes = await processor.download_image(image_url)
        variants = processor.generate_variants(image_bytes)
        await _store_variants(item_id, variants, len(image_bytes))
    except ImageProcessingError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Update the heritage item with the real image URL
    await _db_holder.db.heritage_items.update_one(
        {"id": item_id},
        {"$set": {
            "image_url": image_url,
            "image_source": source,
            "image_updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    return {
        "message": "Real image applied and optimized",
        "item_id": item_id,
        "image_url": image_url,
        "source": source,
        "optimized": True,
    }


@optimization_router.post("/images/apply-real-batch")
async def apply_real_batch(request: ApplyRealBatchRequest):
    """Batch apply real images to POIs that currently use AI-generated or missing photos."""
    query = {
        "$or": [
            {"image_source": "ai_generated"},
            {"image_source": {"$exists": False}},
            {"image_url": {"$exists": False}},
            {"image_url": None},
            {"image_url": ""},
        ]
    }
    if request.category:
        query["category"] = request.category

    items = await _db_holder.db.heritage_items.find(
        query, {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "image_source": 1}
    ).limit(request.limit).to_list(request.limit)

    if request.dry_run:
        return {
            "message": f"Dry run: {len(items)} POIs eligible for real images",
            "items": [
                {"id": i["id"], "name": i.get("name", ""), "current_source": i.get("image_source")}
                for i in items
            ],
            "total": len(items),
        }

    results = {"applied": 0, "optimized_existing": 0, "failed": 0, "details": []}

    for item in items:
        try:
            name = item.get("name", "")
            category = item.get("category", "")
            region = item.get("region", "")

            image_url, source = await _search_real_image(name, category, region)

            if image_url:
                image_bytes = await processor.download_image(image_url)
                variants = processor.generate_variants(image_bytes)
                await _store_variants(item["id"], variants, len(image_bytes))

                await _db_holder.db.heritage_items.update_one(
                    {"id": item["id"]},
                    {"$set": {
                        "image_url": image_url,
                        "image_source": source,
                        "image_updated_at": datetime.now(timezone.utc).isoformat(),
                    }}
                )
                results["applied"] += 1
                results["details"].append({"id": item["id"], "name": name, "source": source})
            else:
                results["failed"] += 1
                results["details"].append({"id": item["id"], "name": name, "source": "not_found"})

            # Rate-limit external API calls
            await asyncio.sleep(0.5)

        except Exception as e:
            logger.error("Apply-real error for %s: %s", item.get("name"), e)
            results["failed"] += 1
            results["details"].append({"id": item.get("id"), "name": item.get("name"), "source": f"error: {e}"})

    return results
