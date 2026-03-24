"""
Analytics API - Engagement metrics dashboard.
Provides aggregate analytics: visits, retention, most shared routes,
most favorited POIs, and user growth over configurable periods.
"""
import asyncio
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta

from shared_utils import DatabaseHolder, clamp_pagination

import logging
logger = logging.getLogger(__name__)

analytics_router = APIRouter(tags=["Analytics"])

_db_holder = DatabaseHolder("analytics")
set_analytics_db = _db_holder.set


@analytics_router.get("/analytics/dashboard")
async def analytics_dashboard(period_days: int = 30):
    """
    Engagement analytics dashboard.

    Returns:
    - visits: total and unique visitor counts for the period
    - retention: returning-user ratio
    - top_routes: most shared/viewed routes
    - top_pois: most favorited POIs
    - user_growth: new registrations by week
    - category_engagement: visits per category
    - region_engagement: visits per region
    """
    _, period_days = clamp_pagination(0, period_days, max_limit=365)
    db = _db_holder.db
    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=period_days)
    period_iso = period_start.isoformat()

    # --- Run queries in parallel, using $facet to batch visit aggregations ---
    (
        visit_facets_result,
        top_pois_by_favorites,
        top_routes_shared,
        new_users_total,
        weekly_growth,
        total_users,
        total_pois,
        total_routes,
    ) = await asyncio.gather(
        # Single $facet pipeline for all visit analytics (1 roundtrip instead of 5)
        db.visits.aggregate([
            {"$match": {"timestamp": {"$gte": period_start}}},
            {"$facet": {
                "total": [{"$count": "count"}],
                "unique_visitors": [
                    {"$group": {"_id": "$user_id"}},
                    {"$count": "count"},
                ],
                "returning_visitors": [
                    {"$group": {"_id": "$user_id", "c": {"$sum": 1}}},
                    {"$match": {"c": {"$gt": 1}}},
                    {"$count": "count"},
                ],
                "category_engagement": [
                    {"$group": {"_id": "$category", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}},
                    {"$limit": 20},
                ],
                "region_engagement": [
                    {"$group": {"_id": "$region", "count": {"$sum": 1}}},
                    {"$sort": {"count": -1}},
                    {"$limit": 20},
                ],
            }},
        ]).to_list(1),

        # Top 10 most favorited POIs (from favorite_spots collection if available, else users)
        db.users.aggregate([
            {"$match": {"favorites": {"$exists": True, "$ne": []}}},
            {"$unwind": "$favorites"},
            {"$group": {"_id": "$favorites", "fav_count": {"$sum": 1}}},
            {"$sort": {"fav_count": -1}},
            {"$limit": 10},
        ]).to_list(10),

        # Top 10 most shared routes
        db.routes.find(
            {"share_count": {"$exists": True}},
            {"_id": 0, "id": 1, "name": 1, "share_count": 1, "view_count": 1, "category": 1}
        ).sort("share_count", -1).limit(10).to_list(10),

        # New users in period
        db.users.count_documents({"created_at": {"$gte": period_iso}}),

        # Weekly user growth (last N weeks)
        db.users.aggregate([
            {"$match": {"created_at": {"$gte": period_iso}}},
            {"$addFields": {
                "created_date": {
                    "$cond": {
                        "if": {"$eq": [{"$type": "$created_at"}, "string"]},
                        "then": {"$dateFromString": {"dateString": "$created_at", "onError": now}},
                        "else": "$created_at",
                    }
                }
            }},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-W%V", "date": "$created_date"}},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id": 1}},
        ]).to_list(52),

        # Totals
        db.users.count_documents({}),
        db.heritage_items.count_documents({}),
        db.routes.count_documents({}),
    )

    # Extract facet results
    facets = visit_facets_result[0] if visit_facets_result else {}
    total_visits = facets.get("total", [{}])[0].get("count", 0) if facets.get("total") else 0
    unique_visitors = facets.get("unique_visitors", [{}])[0].get("count", 0) if facets.get("unique_visitors") else 0
    returning_visitors = facets.get("returning_visitors", [{}])[0].get("count", 0) if facets.get("returning_visitors") else 0
    category_engagement = facets.get("category_engagement", [])
    region_engagement = facets.get("region_engagement", [])
    retention_rate = round(returning_visitors / max(unique_visitors, 1) * 100, 1)

    # Enrich top POIs with names
    top_pois = []
    if top_pois_by_favorites:
        poi_ids = [p["_id"] for p in top_pois_by_favorites]
        poi_docs = await db.heritage_items.find(
            {"id": {"$in": poi_ids}},
            {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "image_url": 1}
        ).to_list(10)
        poi_map = {p["id"]: p for p in poi_docs}
        for entry in top_pois_by_favorites:
            poi_id = entry["_id"]
            poi_info = poi_map.get(poi_id, {})
            top_pois.append({
                "poi_id": poi_id,
                "name": poi_info.get("name", "Desconhecido"),
                "category": poi_info.get("category"),
                "region": poi_info.get("region"),
                "image_url": poi_info.get("image_url"),
                "favorites_count": entry["fav_count"],
            })

    return {
        "period_days": period_days,
        "generated_at": now.isoformat(),
        "overview": {
            "total_users": total_users,
            "total_pois": total_pois,
            "total_routes": total_routes,
        },
        "visits": {
            "total": total_visits,
            "unique_visitors": unique_visitors,
            "avg_visits_per_user": round(total_visits / max(unique_visitors, 1), 1),
        },
        "retention": {
            "returning_visitors": returning_visitors,
            "retention_rate_pct": retention_rate,
        },
        "user_growth": {
            "new_users_period": new_users_total,
            "by_week": [{"week": w["_id"], "count": w["count"]} for w in weekly_growth],
        },
        "top_pois_favorited": top_pois,
        "top_routes_shared": [
            {
                "route_id": r.get("id"),
                "name": r.get("name"),
                "category": r.get("category"),
                "share_count": r.get("share_count", 0),
                "view_count": r.get("view_count", 0),
            }
            for r in top_routes_shared
        ],
        "category_engagement": [
            {"category": c["_id"], "visits": c["count"]}
            for c in category_engagement if c["_id"]
        ],
        "region_engagement": [
            {"region": r["_id"], "visits": r["count"]}
            for r in region_engagement if r["_id"]
        ],
    }


@analytics_router.get("/analytics/trends")
async def analytics_trends(metric: str = "visits", days: int = 30):
    """
    Get daily trend data for a specific metric.
    Metrics: visits, new_users, favorites
    """
    _, days = clamp_pagination(0, days, max_limit=90)
    db = _db_holder.db
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    if metric == "visits":
        pipeline = [
            {"$match": {"timestamp": {"$gte": start}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id": 1}},
        ]
        results = await db.visits.aggregate(pipeline).to_list(days)
    elif metric == "new_users":
        pipeline = [
            {"$match": {"created_at": {"$gte": start.isoformat()}}},
            {"$addFields": {
                "created_date": {
                    "$cond": {
                        "if": {"$eq": [{"$type": "$created_at"}, "string"]},
                        "then": {"$dateFromString": {"dateString": "$created_at", "onError": now}},
                        "else": "$created_at",
                    }
                }
            }},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_date"}},
                "count": {"$sum": 1},
            }},
            {"$sort": {"_id": 1}},
        ]
        results = await db.users.aggregate(pipeline).to_list(days)
    else:
        raise HTTPException(status_code=400, detail=f"Métrica desconhecida: {metric}. Use: visits, new_users")

    return {
        "metric": metric,
        "period_days": days,
        "data": [{"date": r["_id"], "value": r["count"]} for r in results],
    }
