"""
Encyclopedia API - Encyclopedia Viva endpoints extracted from server.py.
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid

import logging
from models.api_models import EncyclopediaArticleCreate
from shared_constants import ENCYCLOPEDIA_UNIVERSES, SUBCATEGORIES_BY_MAIN, sanitize_regex
from shared_utils import DatabaseHolder, clamp_pagination

logger = logging.getLogger(__name__)

encyclopedia_router = APIRouter()

_db_holder = DatabaseHolder("encyclopedia")
set_encyclopedia_db = _db_holder.set


async def seed_encyclopedia_if_empty(database):
    """Seed encyclopedia articles from heritage_items if collection is empty."""
    count = await database.encyclopedia_articles.count_documents({})
    if count > 0:
        return

    total = 0
    for main_cat, subs in SUBCATEGORIES_BY_MAIN.items():
        cat_ids = [s["id"] for s in subs]
        items = await database.heritage_items.find(
            {"category": {"$in": cat_ids}},
            {"_id": 0, "id": 1, "name": 1, "description": 1, "category": 1, "region": 1, "image_url": 1}
        ).limit(50).to_list(50)

        articles = []
        for i, item in enumerate(items):
            slug = item["name"].lower().replace(" ", "-")
            for old, new in [("á","a"),("é","e"),("í","i"),("ó","o"),("ú","u"),("ã","a"),("õ","o"),("ç","c")]:
                slug = slug.replace(old, new)
            articles.append({
                "id": f"enc_{uuid.uuid4().hex[:10]}",
                "title": item["name"],
                "slug": slug[:60],
                "universe": main_cat,
                "category": item.get("category", ""),
                "region": item.get("region", ""),
                "summary": (item.get("description") or "")[:200] or f"Artigo sobre {item['name']} em Portugal.",
                "content": item.get("description") or f"Descubra {item['name']}, um tesouro do património vivo de Portugal.",
                "image_url": item.get("image_url", ""),
                "heritage_item_id": item["id"],
                "tags": [item.get("category", ""), item.get("region", ""), "portugal", "patrimonio"],
                "views": max(10, 100 - i * 3),
                "likes": max(2, 30 - i),
                "featured": i < 3,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            })

        if articles:
            await database.encyclopedia_articles.insert_many(articles)
            total += len(articles)

    if total > 0:
        logger.info("Seeded %d encyclopedia articles", total)


@encyclopedia_router.get("/encyclopedia/universes")
async def get_encyclopedia_universes():
    """Get all encyclopedia universes (6 thematic areas)"""
    universes_with_counts = []
    for universe in ENCYCLOPEDIA_UNIVERSES:
        article_count = await _db_holder.db.encyclopedia_articles.count_documents({"universe": universe["id"]})
        item_count = await _db_holder.db.heritage_items.count_documents({"category": {"$in": universe["categories"]}})
        universes_with_counts.append({
            **universe,
            "article_count": article_count,
            "item_count": item_count
        })
    return universes_with_counts


@encyclopedia_router.get("/encyclopedia/universe/{universe_id}")
async def get_encyclopedia_universe(universe_id: str):
    """Get a specific universe with its articles and items"""
    universe = next((u for u in ENCYCLOPEDIA_UNIVERSES if u["id"] == universe_id), None)
    if not universe:
        raise HTTPException(status_code=404, detail="Universe not found")

    articles = await _db_holder.db.encyclopedia_articles.find(
        {"universe": universe_id},
        {"_id": 0}
    ).sort("views", -1).limit(20).to_list(20)

    # Get total count for the universe
    total_items = await _db_holder.db.heritage_items.count_documents({"category": {"$in": universe["categories"]}})

    # Get featured items (first 20)
    items = await _db_holder.db.heritage_items.find(
        {"category": {"$in": universe["categories"]}},
        {"_id": 0}
    ).limit(20).to_list(20)

    return {
        **universe,
        "articles": articles,
        "featured_items": items,
        "total_articles": len(articles),
        "total_items": total_items
    }


@encyclopedia_router.get("/encyclopedia/universe/{universe_id}/items")
async def get_universe_items(
    universe_id: str,
    region: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """Get paginated items for a universe with optional region and subcategory filter"""
    skip, limit = clamp_pagination(skip, limit)
    universe = next((u for u in ENCYCLOPEDIA_UNIVERSES if u["id"] == universe_id), None)
    if not universe:
        raise HTTPException(status_code=404, detail="Universe not found")

    if category and category != 'todas' and category in universe["categories"]:
        query = {"category": category}
    else:
        query = {"category": {"$in": universe["categories"]}}
    
    if region and region != 'todas':
        query["region"] = region

    total = await _db_holder.db.heritage_items.count_documents(query)

    items = await _db_holder.db.heritage_items.find(
        query,
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_more": skip + len(items) < total
    }


@encyclopedia_router.get("/encyclopedia/articles")
async def get_encyclopedia_articles(
    universe: Optional[str] = None,
    region: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 20,
    skip: int = 0
):
    """Get encyclopedia articles with filters"""
    skip, limit = clamp_pagination(skip, limit)
    query = {}
    if universe:
        query["universe"] = universe
    if region:
        query["region"] = region
    if tag:
        query["tags"] = tag
    if search:
        safe_search = sanitize_regex(search)
        query["$or"] = [
            {"title": {"$regex": safe_search, "$options": "i"}},
            {"summary": {"$regex": safe_search, "$options": "i"}},
            {"content": {"$regex": safe_search, "$options": "i"}}
        ]

    articles = await _db_holder.db.encyclopedia_articles.find(
        query,
        {"_id": 0, "content": 0}
    ).sort("views", -1).skip(skip).limit(limit).to_list(limit)

    total = await _db_holder.db.encyclopedia_articles.count_documents(query)

    return {
        "articles": articles,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@encyclopedia_router.get("/encyclopedia/article/{article_id}")
async def get_encyclopedia_article(article_id: str):
    """Get a specific encyclopedia article with related content"""
    article = await _db_holder.db.encyclopedia_articles.find_one(
        {"$or": [{"id": article_id}, {"slug": article_id}]},
        {"_id": 0}
    )

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    await _db_holder.db.encyclopedia_articles.update_one(
        {"id": article["id"]},
        {"$inc": {"views": 1}}
    )

    related_articles = []
    if article.get("related_articles"):
        related_articles = await _db_holder.db.encyclopedia_articles.find(
            {"id": {"$in": article["related_articles"]}},
            {"_id": 0, "content": 0}
        ).to_list(10)

    related_items = []
    if article.get("related_items"):
        related_items = await _db_holder.db.heritage_items.find(
            {"id": {"$in": article["related_items"]}},
            {"_id": 0}
        ).to_list(10)

    universe = next((u for u in ENCYCLOPEDIA_UNIVERSES if u["id"] == article.get("universe")), None)

    return {
        **article,
        "related_articles_data": related_articles,
        "related_items_data": related_items,
        "universe_info": universe
    }


@encyclopedia_router.post("/encyclopedia/articles")
async def create_encyclopedia_article(article: EncyclopediaArticleCreate):
    """Create a new encyclopedia article (admin only for now)"""
    if article.universe not in [u["id"] for u in ENCYCLOPEDIA_UNIVERSES]:
        raise HTTPException(status_code=400, detail="Invalid universe")

    existing = await _db_holder.db.encyclopedia_articles.find_one({"slug": article.slug})
    if existing:
        raise HTTPException(status_code=400, detail="Article with this slug already exists")

    article_dict = article.dict()
    article_dict["id"] = str(uuid.uuid4())
    article_dict["views"] = 0
    article_dict["created_at"] = datetime.now(timezone.utc)
    article_dict["updated_at"] = datetime.now(timezone.utc)

    await _db_holder.db.encyclopedia_articles.insert_one(article_dict)

    return {"id": article_dict["id"], "slug": article_dict["slug"], "message": "Article created"}


@encyclopedia_router.get("/encyclopedia/universe/{universe_id}/subcategory-counts")
async def get_subcategory_counts(universe_id: str, region: Optional[str] = None):
    """Get item counts per subcategory within a universe (for chip counters)."""
    universe = next((u for u in ENCYCLOPEDIA_UNIVERSES if u["id"] == universe_id), None)
    if not universe:
        raise HTTPException(status_code=404, detail="Universe not found")

    match_query: dict = {"category": {"$in": universe["categories"]}}
    if region and region != "todas":
        match_query["region"] = region

    pipeline = [
        {"$match": match_query},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    results = await _db_holder.db.heritage_items.aggregate(pipeline).to_list(100)

    counts = {r["_id"]: r["count"] for r in results if r["_id"]}
    total = sum(counts.values())

    return {"universe_id": universe_id, "total": total, "counts": counts}


@encyclopedia_router.get("/encyclopedia/featured")
async def get_featured_encyclopedia_content():
    """Get featured encyclopedia content for homepage"""
    top_articles = await _db_holder.db.encyclopedia_articles.find(
        {},
        {"_id": 0, "content": 0}
    ).sort("views", -1).limit(6).to_list(6)

    recent_articles = await _db_holder.db.encyclopedia_articles.find(
        {},
        {"_id": 0, "content": 0}
    ).sort("created_at", -1).limit(6).to_list(6)

    universe_highlights = []
    for universe in ENCYCLOPEDIA_UNIVERSES:
        article = await _db_holder.db.encyclopedia_articles.find_one(
            {"universe": universe["id"]},
            {"_id": 0, "content": 0}
        )
        if article:
            universe_highlights.append({
                "universe": universe,
                "featured_article": article
            })

    return {
        "top_articles": top_articles,
        "recent_articles": recent_articles,
        "universe_highlights": universe_highlights
    }


@encyclopedia_router.get("/encyclopedia/search")
async def search_encyclopedia(q: str, limit: int = 20):
    """Search across encyclopedia articles and heritage items"""
    safe_q = sanitize_regex(q)
    articles = await _db_holder.db.encyclopedia_articles.find(
        {"$or": [
            {"title": {"$regex": safe_q, "$options": "i"}},
            {"summary": {"$regex": safe_q, "$options": "i"}},
            {"tags": {"$regex": safe_q, "$options": "i"}}
        ]},
        {"_id": 0, "content": 0}
    ).limit(limit // 2).to_list(limit // 2)

    items = await _db_holder.db.heritage_items.find(
        {"$or": [
            {"name": {"$regex": safe_q, "$options": "i"}},
            {"description": {"$regex": safe_q, "$options": "i"}}
        ]},
        {"_id": 0}
    ).limit(limit // 2).to_list(limit // 2)

    return {
        "query": q,
        "articles": articles,
        "items": items,
        "total": len(articles) + len(items)
    }
