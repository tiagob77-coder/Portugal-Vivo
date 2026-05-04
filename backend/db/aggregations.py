"""Aggregation pipelines for the canonical `pois` collection."""


async def get_municipality_stats(db, municipality_id: str) -> dict:
    """Faceted dashboard stats for a municipality: counts, top-rated, most-viewed."""
    pipeline = [
        {"$match": {"municipality_id": municipality_id, "status": "active"}},
        {"$facet": {
            "by_category": [
                {"$group": {"_id": "$category", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
            ],
            "top_rated": [
                {"$sort": {"stats.rating_avg": -1}},
                {"$limit": 5},
                {"$project": {
                    "_id": 0,
                    "slug": 1,
                    "name": 1,
                    "category": 1,
                    "stats.rating_avg": 1,
                }},
            ],
            "most_viewed": [
                {"$sort": {"stats.views": -1}},
                {"$limit": 5},
                {"$project": {
                    "_id": 0,
                    "slug": 1,
                    "name": 1,
                    "stats.views": 1,
                }},
            ],
            "total": [{"$count": "n"}],
        }},
    ]
    result = await db["pois"].aggregate(pipeline).to_list(1)
    return result[0] if result else {}


async def search_pois(
    db,
    municipality_id: str,
    query: str,
    limit: int = 20,
) -> list:
    """Full-text search over Portuguese content with relevance scoring.

    Requires index idx_pois_text_search_pt (content.pt.title + full_description + metadata.tags).
    """
    pipeline = [
        {"$match": {
            "municipality_id": municipality_id,
            "status": "active",
            "$text": {"$search": query, "$language": "portuguese"},
        }},
        {"$addFields": {"score": {"$meta": "textScore"}}},
        {"$sort": {"score": -1}},
        {"$limit": limit},
        {"$project": {
            "_id": 0,
            "slug": 1,
            "name": 1,
            "category": 1,
            "content.pt.short_description": 1,
            "media.cover_image": 1,
            "score": 1,
        }},
    ]
    return await db["pois"].aggregate(pipeline).to_list(limit)
