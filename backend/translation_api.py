"""
Translation API - Multi-language POI translation endpoints.
"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field

from shared_utils import DatabaseHolder, clamp_pagination
from services.translation_service import TranslationService, SUPPORTED_LANGUAGES

translation_router = APIRouter()

_db_holder = DatabaseHolder("translation")
set_translation_db = _db_holder.set


def _get_service() -> TranslationService:
    return TranslationService(_db_holder.db)


# ========================
# Request/Response Models
# ========================

class TranslateRequest(BaseModel):
    languages: List[str] = Field(..., description="Target languages (en, es, fr)")


class BatchTranslateRequest(BaseModel):
    languages: List[str] = Field(..., description="Target languages (en, es, fr)")
    limit: int = Field(50, ge=1, le=500)
    offset: int = Field(0, ge=0)
    category_filter: Optional[str] = None
    region_filter: Optional[str] = None
    dry_run: bool = Field(False, description="If true, only return estimates without translating")


class ManualTranslationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    address: Optional[str] = None
    quality_score: Optional[float] = Field(None, ge=0, le=1)


# ========================
# ENDPOINTS
# ========================

@translation_router.get("/translations/{item_id}/{language}")
async def get_translation(item_id: str, language: str):
    """Get translation for a POI in a specific language."""
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported language: {language}. Supported: {', '.join(SUPPORTED_LANGUAGES)}")

    translation = await _db_holder.db.poi_translations.find_one(
        {"item_id": item_id, "language": language},
        {"_id": 0},
    )
    if not translation:
        raise HTTPException(404, f"No translation found for item {item_id} in {language}")

    if translation.get("translated_at"):
        translation["translated_at"] = str(translation["translated_at"])
    return translation


@translation_router.post("/translations/translate/{item_id}")
async def translate_poi(item_id: str, body: TranslateRequest):
    """Translate a POI to specified languages."""
    # Validate languages
    invalid = [lang for lang in body.languages if lang not in SUPPORTED_LANGUAGES]
    if invalid:
        raise HTTPException(400, f"Unsupported languages: {', '.join(invalid)}. Supported: {', '.join(SUPPORTED_LANGUAGES)}")

    service = _get_service()
    result = await service.translate_poi(item_id, body.languages)
    if "error" in result:
        raise HTTPException(404, result["error"])

    return result


@translation_router.post("/translations/batch-translate")
async def batch_translate(body: BatchTranslateRequest):
    """Batch translate multiple POIs."""
    invalid = [lang for lang in body.languages if lang not in SUPPORTED_LANGUAGES]
    if invalid:
        raise HTTPException(400, f"Unsupported languages: {', '.join(invalid)}. Supported: {', '.join(SUPPORTED_LANGUAGES)}")

    service = _get_service()
    stats = await service.batch_translate(
        languages=body.languages,
        limit=body.limit,
        offset=body.offset,
        category_filter=body.category_filter,
        region_filter=body.region_filter,
        dry_run=body.dry_run,
    )
    return stats


@translation_router.get("/translations/stats")
async def translation_stats():
    """Get translation coverage statistics per language, category, and region."""
    db = _db_holder.db

    # Total heritage items
    total_items = await db.heritage_items.count_documents({})

    # Per-language stats
    lang_stats = {}
    for lang in SUPPORTED_LANGUAGES:
        count = await db.poi_translations.count_documents({"language": lang})
        lang_stats[lang] = {
            "translated": count,
            "total": total_items,
            "coverage_pct": round((count / total_items * 100) if total_items else 0, 1),
        }

    # Per-category coverage (aggregation)
    category_pipeline = [
        {"$group": {
            "_id": {"language": "$language", "category": "$category"},
            "count": {"$sum": 1},
        }},
    ]
    # We need category from heritage_items, so join via lookup
    category_coverage_pipeline = [
        {"$lookup": {
            "from": "heritage_items",
            "localField": "item_id",
            "foreignField": "id",
            "as": "item",
        }},
        {"$unwind": "$item"},
        {"$group": {
            "_id": {"language": "$language", "category": "$item.category"},
            "count": {"$sum": 1},
        }},
    ]
    cat_results = await db.poi_translations.aggregate(category_coverage_pipeline).to_list(500)
    category_stats = {}
    for r in cat_results:
        lang = r["_id"]["language"]
        cat = r["_id"]["category"]
        if lang not in category_stats:
            category_stats[lang] = {}
        category_stats[lang][cat] = r["count"]

    # Per-region coverage
    region_coverage_pipeline = [
        {"$lookup": {
            "from": "heritage_items",
            "localField": "item_id",
            "foreignField": "id",
            "as": "item",
        }},
        {"$unwind": "$item"},
        {"$group": {
            "_id": {"language": "$language", "region": "$item.region"},
            "count": {"$sum": 1},
        }},
    ]
    region_results = await db.poi_translations.aggregate(region_coverage_pipeline).to_list(500)
    region_stats = {}
    for r in region_results:
        lang = r["_id"]["language"]
        region = r["_id"].get("region", "unknown")
        if lang not in region_stats:
            region_stats[lang] = {}
        region_stats[lang][region] = r["count"]

    # Cost tracking
    cost_pipeline = [
        {"$group": {
            "_id": "$language",
            "total_tokens": {"$sum": "$tokens_estimated"},
            "count": {"$sum": 1},
        }},
    ]
    cost_results = await db.poi_translations.aggregate(cost_pipeline).to_list(10)
    cost_stats = {}
    for r in cost_results:
        cost_stats[r["_id"]] = {
            "total_tokens_estimated": r.get("total_tokens", 0),
            "translations_count": r["count"],
        }

    return {
        "total_heritage_items": total_items,
        "per_language": lang_stats,
        "per_category": category_stats,
        "per_region": region_stats,
        "cost_tracking": cost_stats,
    }


@translation_router.get("/translations/missing/{language}")
async def get_missing_translations(language: str, skip: int = 0, limit: int = 50):
    """List POIs that are missing translations for a specific language."""
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported language: {language}. Supported: {', '.join(SUPPORTED_LANGUAGES)}")

    skip, limit = clamp_pagination(skip, limit)
    db = _db_holder.db

    # Get IDs of already translated items for this language
    translated_ids = await db.poi_translations.distinct("item_id", {"language": language})

    # Find heritage items NOT in that list
    query = {}
    if translated_ids:
        query["id"] = {"$nin": translated_ids}

    total_missing = await db.heritage_items.count_documents(query)
    items = await db.heritage_items.find(query, {
        "_id": 0, "id": 1, "name": 1, "category": 1, "region": 1,
    }).skip(skip).limit(limit).to_list(limit)

    return {
        "language": language,
        "total_missing": total_missing,
        "skip": skip,
        "limit": limit,
        "items": items,
    }


@translation_router.get("/heritage/{item_id}/localized")
async def get_localized_heritage(item_id: str, request: Request, lang: Optional[str] = None):
    """
    Get a POI with translations merged based on Accept-Language header or ?lang= param.
    Falls back to original Portuguese content if no translation exists.
    """
    db = _db_holder.db

    # Determine target language
    target_lang = lang
    if not target_lang:
        accept_lang = request.headers.get("accept-language", "")
        # Parse simple Accept-Language (e.g. "en-US,en;q=0.9,pt;q=0.8")
        for part in accept_lang.split(","):
            code = part.strip().split(";")[0].strip().split("-")[0].lower()
            if code in SUPPORTED_LANGUAGES:
                target_lang = code
                break

    # Fetch the original item
    item = await db.heritage_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")

    result = dict(item)
    result["language"] = "pt"  # Default

    # If a target language is specified and it's not Portuguese, try to merge translation
    if target_lang and target_lang in SUPPORTED_LANGUAGES:
        translation = await db.poi_translations.find_one(
            {"item_id": item_id, "language": target_lang},
            {"_id": 0},
        )
        if translation:
            if translation.get("name"):
                result["name"] = translation["name"]
            if translation.get("description"):
                result["description"] = translation["description"]
            if translation.get("tags"):
                result["tags"] = translation["tags"]
            if translation.get("address"):
                result["address"] = translation["address"]
            result["language"] = target_lang
            result["translation_source"] = translation.get("translation_source", "ai")
            result["quality_score"] = translation.get("quality_score")

    # Clean datetime fields for JSON serialization
    if result.get("created_at"):
        result["created_at"] = str(result["created_at"])
    if result.get("updated_at"):
        result["updated_at"] = str(result["updated_at"])

    return result


@translation_router.patch("/translations/{item_id}/{language}")
async def update_translation(item_id: str, language: str, body: ManualTranslationUpdate):
    """Manually update/override a translation (for quality corrections)."""
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(400, f"Unsupported language: {language}. Supported: {', '.join(SUPPORTED_LANGUAGES)}")

    db = _db_holder.db
    existing = await db.poi_translations.find_one({"item_id": item_id, "language": language})
    if not existing:
        raise HTTPException(404, f"No translation found for item {item_id} in {language}")

    update_fields = {}
    if body.name is not None:
        update_fields["name"] = body.name
    if body.description is not None:
        update_fields["description"] = body.description
    if body.tags is not None:
        update_fields["tags"] = body.tags
    if body.address is not None:
        update_fields["address"] = body.address
    if body.quality_score is not None:
        update_fields["quality_score"] = body.quality_score

    if not update_fields:
        raise HTTPException(400, "No fields to update")

    update_fields["translation_source"] = "manual"
    update_fields["translated_at"] = datetime.now(timezone.utc)

    await db.poi_translations.update_one(
        {"item_id": item_id, "language": language},
        {"$set": update_fields},
    )

    return {"message": "Translation updated", "item_id": item_id, "language": language}
