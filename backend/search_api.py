"""
Search API - Advanced search endpoints extracted from server.py.
"""
import asyncio
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from shared_constants import sanitize_regex
from shared_utils import DatabaseHolder, clamp_pagination

search_router = APIRouter()

_db_holder = DatabaseHolder("search")
set_search_db = _db_holder.set


class SearchFilters(BaseModel):
    query: str
    categories: Optional[List[str]] = None
    regions: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    min_rating: Optional[float] = None
    has_audio_guide: Optional[bool] = None
    limit: int = 20
    skip: int = 0


@search_router.post("/search")
async def advanced_search(filters: SearchFilters):
    """Advanced search across heritage items with filters.

    Uses MongoDB ``$text`` against the ``idx_heritage_text_search`` index
    (weights name=10, tags=5, description=1) and ranks by ``textScore``.
    For very short queries (< 3 chars or single non-word fragments) we
    fall back to the legacy ``$regex`` path because ``$text`` rejects
    fragments that don't tokenise cleanly.
    """
    skip, limit = clamp_pagination(filters.skip, filters.limit, max_limit=100)
    query: dict = {}

    use_text = bool(filters.query) and len(filters.query.strip()) >= 3
    if use_text:
        query["$text"] = {"$search": filters.query, "$language": "portuguese"}
    elif filters.query:
        # Short-query fallback: keep the old regex behaviour so prefix
        # searches like "Lis" or "@" still return something.
        safe_query = sanitize_regex(filters.query)
        query["$or"] = [
            {"name": {"$regex": safe_query, "$options": "i"}},
            {"description": {"$regex": safe_query, "$options": "i"}},
            {"short_description": {"$regex": safe_query, "$options": "i"}},
            {"tags": {"$regex": safe_query, "$options": "i"}},
        ]

    if filters.categories:
        query["category"] = {"$in": filters.categories}

    if filters.regions:
        query["region"] = {"$in": filters.regions}

    if filters.tags:
        query["tags"] = {"$in": filters.tags}

    projection = {"_id": 0}
    if use_text:
        projection["score"] = {"$meta": "textScore"}

    cursor = _db_holder.db.heritage_items.find(query, projection)
    if use_text:
        cursor = cursor.sort([("score", {"$meta": "textScore"})])
    items = await cursor.skip(skip).limit(limit).to_list(limit)

    total = await _db_holder.db.heritage_items.count_documents(query)

    # Batch fetch ratings for all items in a single query (fixes N+1)
    item_ids = [item["id"] for item in items]
    rating_pipeline = [
        {"$match": {"item_id": {"$in": item_ids}}},
        {"$group": {"_id": "$item_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
    ]
    rating_results = await _db_holder.db.reviews.aggregate(rating_pipeline).to_list(len(item_ids))
    ratings_map = {r["_id"]: r for r in rating_results}

    results_with_ratings = []
    for item in items:
        item_with_rating = {**item, "type": "poi"}
        rating = ratings_map.get(item["id"])
        if rating:
            item_with_rating["average_rating"] = round(rating["avg"], 1)
            item_with_rating["review_count"] = rating["count"]
        else:
            item_with_rating["average_rating"] = None
            item_with_rating["review_count"] = 0

        if filters.min_rating:
            if item_with_rating["average_rating"] and item_with_rating["average_rating"] >= filters.min_rating:
                results_with_ratings.append(item_with_rating)
        else:
            results_with_ratings.append(item_with_rating)

    return {
        "results": results_with_ratings,
        "total": total,
        "query": filters.query,
        "filters_applied": {
            "categories": filters.categories,
            "regions": filters.regions,
            "tags": filters.tags,
            "min_rating": filters.min_rating
        }
    }


@search_router.get("/search/suggestions")
async def search_suggestions(q: str, limit: int = 5):
    """Get search suggestions based on partial query"""
    if len(q) < 2:
        return {"suggestions": []}

    safe_q = sanitize_regex(q)
    name_matches = await _db_holder.db.heritage_items.find(
        {"name": {"$regex": f"^{safe_q}", "$options": "i"}},
        {"_id": 0, "id": 1, "name": 1, "category": 1}
    ).limit(limit).to_list(limit)

    route_matches = await _db_holder.db.routes.find(
        {"name": {"$regex": f"^{safe_q}", "$options": "i"}},
        {"_id": 0, "id": 1, "name": 1}
    ).limit(limit).to_list(limit)

    article_matches = await _db_holder.db.encyclopedia_articles.find(
        {"title": {"$regex": f"^{safe_q}", "$options": "i"}},
        {"_id": 0, "id": 1, "title": 1, "universe": 1}
    ).limit(limit).to_list(limit)

    tag_pipeline = [
        {"$unwind": "$tags"},
        {"$match": {"tags": {"$regex": f"^{safe_q}", "$options": "i"}}},
        {"$group": {"_id": "$tags"}},
        {"$limit": 3}
    ]
    tag_matches = await _db_holder.db.heritage_items.aggregate(tag_pipeline).to_list(3)

    suggestions = []

    for item in name_matches:
        suggestions.append({
            "type": "item",
            "id": item["id"],
            "text": item["name"],
            "category": item.get("category")
        })

    for route in route_matches:
        suggestions.append({
            "type": "route",
            "id": route["id"],
            "text": route["name"]
        })

    for article in article_matches:
        suggestions.append({
            "type": "article",
            "id": article["id"],
            "text": article["title"],
            "universe": article.get("universe")
        })

    for tag in tag_matches:
        suggestions.append({
            "type": "tag",
            "text": tag["_id"]
        })

    return {"suggestions": suggestions[:limit]}


@search_router.get("/search/popular")
async def popular_searches():
    """Get popular search terms and trending items"""
    trending = await _db_holder.db.heritage_items.find(
        {},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "image_url": 1}
    ).sort("created_at", -1).limit(5).to_list(5)

    category_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    popular_categories = await _db_holder.db.heritage_items.aggregate(category_pipeline).to_list(5)

    return {
        "trending_items": trending,
        "popular_categories": [{"id": c["_id"], "count": c["count"]} for c in popular_categories],
        "suggested_searches": [
            "praias secretas",
            "castelos medievais",
            "gastronomia tradicional",
            "trilhos natureza",
            "termas portugal"
        ]
    }


def _compute_relevance(item_name: str, query_lower: str, matched_field: str) -> int:
    """Compute a basic relevance score for a search result."""
    name_lower = item_name.lower() if item_name else ""
    if name_lower == query_lower:
        return 100
    if name_lower.startswith(query_lower):
        return 80
    if query_lower in name_lower:
        return 60
    # Matched in description/tags only
    return 40


def _truncate(text: str, max_len: int = 120) -> str:
    """Truncate text to max_len, adding ellipsis if needed."""
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[:max_len].rsplit(" ", 1)[0] + "..."


@search_router.get("/search/global")
async def global_search(q: str, limit: int = 20):
    """Unified search across all content types: POIs, routes, events, articles.

    POIs (the largest collection) use the ``$text`` index for relevance
    ranking when the query is long enough; the smaller collections stay
    on regex because their text indexes haven't been declared yet.
    """
    if len(q) < 2:
        return {"query": q, "results": [], "total": 0, "groups": {}}

    safe_q = sanitize_regex(q)
    query_lower = q.lower()

    regex_filter = {"$regex": safe_q, "$options": "i"}
    use_text_for_poi = len(q.strip()) >= 3

    # POI query: prefer $text for ranking + speed when the query tokenises.
    if use_text_for_poi:
        poi_query = {"$text": {"$search": q, "$language": "portuguese"}}
    else:
        poi_query = {"$or": [
            {"name": regex_filter},
            {"description": regex_filter},
            {"tags": regex_filter},
        ]}

    route_query = {"$or": [
        {"name": regex_filter},
        {"description": regex_filter},
    ]}

    event_query = {"$or": [
        {"name": regex_filter},
        {"description": regex_filter},
    ]}

    article_query = {"$or": [
        {"title": regex_filter},
        {"summary": regex_filter},
        {"tags": regex_filter},
    ]}

    # Run all queries in parallel
    if use_text_for_poi:
        poi_task = _db_holder.db.heritage_items.find(
            poi_query, {"_id": 0, "score": {"$meta": "textScore"}}
        ).sort([("score", {"$meta": "textScore"})]).limit(limit).to_list(limit)
    else:
        poi_task = _db_holder.db.heritage_items.find(
            poi_query, {"_id": 0}
        ).limit(limit).to_list(limit)

    route_task = _db_holder.db.routes.find(
        route_query, {"_id": 0}
    ).limit(limit).to_list(limit)

    calendar_event_task = _db_holder.db.calendar_events.find(
        event_query, {"_id": 0}
    ).limit(limit).to_list(limit)

    event_task = _db_holder.db.events.find(
        event_query, {"_id": 0}
    ).limit(limit).to_list(limit)

    article_task = _db_holder.db.encyclopedia_articles.find(
        article_query, {"_id": 0}
    ).limit(limit).to_list(limit)

    pois, routes, calendar_events, events, articles = await asyncio.gather(
        poi_task, route_task, calendar_event_task, event_task, article_task
    )

    results = []

    # Process POIs
    for item in pois:
        results.append({
            "type": "poi",
            "id": item.get("id"),
            "title": item.get("name", ""),
            "subtitle": _truncate(item.get("description", "") or item.get("short_description", "")),
            "category": item.get("category"),
            "region": item.get("region"),
            "image_url": item.get("image_url"),
            "relevance_score": _compute_relevance(item.get("name", ""), query_lower, "name"),
        })

    # Process routes
    for route in routes:
        results.append({
            "type": "route",
            "id": route.get("id"),
            "title": route.get("name", ""),
            "subtitle": _truncate(route.get("description", "")),
            "category": route.get("category"),
            "region": route.get("region"),
            "image_url": route.get("image_url"),
            "relevance_score": _compute_relevance(route.get("name", ""), query_lower, "name"),
        })

    # Process events (merge calendar_events and events, deduplicate by id)
    seen_event_ids = set()
    for event in calendar_events + events:
        eid = event.get("id")
        if eid and eid in seen_event_ids:
            continue
        if eid:
            seen_event_ids.add(eid)
        results.append({
            "type": "event",
            "id": eid,
            "title": event.get("name", ""),
            "subtitle": _truncate(event.get("description", "")),
            "category": event.get("category"),
            "region": event.get("region"),
            "image_url": event.get("image_url"),
            "relevance_score": _compute_relevance(event.get("name", ""), query_lower, "name"),
        })

    # Process articles
    for article in articles:
        results.append({
            "type": "article",
            "id": article.get("id"),
            "title": article.get("title", ""),
            "subtitle": _truncate(article.get("summary", "")),
            "category": article.get("universe"),
            "region": article.get("region"),
            "image_url": article.get("image_url"),
            "relevance_score": _compute_relevance(article.get("title", ""), query_lower, "name"),
        })

    # Sort by relevance_score descending
    results.sort(key=lambda r: r["relevance_score"], reverse=True)

    # Apply overall limit
    results = results[:limit]

    # Group counts (from full results before limit)
    groups = {}
    type_counts = {}
    for r in results:
        t = r["type"]
        type_counts[t] = type_counts.get(t, 0) + 1

    type_labels = {
        "poi": "Locais",
        "route": "Rotas",
        "event": "Eventos",
        "article": "Artigos",
    }
    for t, label in type_labels.items():
        if t in type_counts:
            groups[t] = {"count": type_counts[t], "label": label}

    return {
        "query": q,
        "results": results,
        "total": len(results),
        "groups": groups,
    }
