from fastapi import APIRouter, Response, HTTPException, Body
from datetime import datetime, timezone
from typing import Optional

from shared_constants import CATEGORIES, REGIONS

router = APIRouter()

_db = None


def set_admin_dashboard_db(database):
    global _db
    _db = database


@router.get("/gallery/{category}")
async def get_gallery(category: str, limit: int = 20):
    """Get images for a category"""
    from shared_utils import clamp_pagination
    _, limit = clamp_pagination(0, limit, max_limit=100)
    items = await _db.heritage_items.find(
        {"category": category, "image_url": {"$ne": None}},
        {"_id": 0, "id": 1, "name": 1, "image_url": 1, "region": 1}
    ).limit(limit).to_list(limit)
    return items


@router.get("/share/{item_id}")
async def get_share_data(item_id: str):
    """Return Open Graph metadata for social sharing previews"""
    item = await _db.heritage_items.find_one({"id": item_id}, {"_id": 0, "name": 1, "description": 1, "category": 1, "region": 1, "images": 1})
    if not item:
        route = await _db.routes.find_one({"id": item_id}, {"_id": 0, "name": 1, "description": 1, "stops": 1})
        if not route:
            return {"og_title": "Portugal Vivo", "og_description": "Descobre o património cultural e natural de Portugal", "og_image": None}
        return {
            "og_title": route.get("name", "Rota"),
            "og_description": route.get("description", "")[:200],
            "og_image": None,
            "og_type": "route",
            "stops_count": len(route.get("stops") or []),
        }
    return {
        "og_title": item.get("name", "POI"),
        "og_description": (item.get("description") or "")[:200],
        "og_image": (item.get("images") or [None])[0],
        "og_type": "heritage",
        "og_category": item.get("category"),
        "og_region": item.get("region"),
    }


@router.get("/stats", tags=["Stats"])
async def get_stats(response: Response):
    """Get heritage statistics (cached for 5min) - uses aggregation to avoid N+1 queries"""
    response.headers["Cache-Control"] = "public, max-age=300"

    # Run all counts in parallel using aggregation pipelines
    import asyncio
    cat_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ]
    region_pipeline = [
        {"$group": {"_id": "$region", "count": {"$sum": 1}}},
    ]

    total_items, total_routes, total_users, cat_results, region_results = await asyncio.gather(
        _db.heritage_items.count_documents({}),
        _db.routes.count_documents({}),
        _db.users.count_documents({}),
        _db.heritage_items.aggregate(cat_pipeline).to_list(200),
        _db.heritage_items.aggregate(region_pipeline).to_list(50),
    )

    # Build lookup dicts from aggregation results
    cat_counts = {r["_id"]: r["count"] for r in cat_results if r["_id"]}
    region_counts = {r["_id"]: r["count"] for r in region_results if r["_id"]}

    categories_stats = [
        {"id": cat["id"], "name": cat["name"], "count": cat_counts.get(cat["id"], 0)}
        for cat in CATEGORIES
    ]
    regions_stats = [
        {"id": reg["id"], "name": reg["name"], "count": region_counts.get(reg["id"], 0)}
        for reg in REGIONS
    ]

    return {
        "total_items": total_items,
        "total_routes": total_routes,
        "total_users": total_users,
        "categories": categories_stats,
        "regions": regions_stats
    }


# ========================
# ADMIN DASHBOARD
# ========================

@router.get("/admin/dashboard", tags=["Admin"])
async def admin_dashboard():
    """Unified admin dashboard with key metrics for POIs, users, subscriptions, and activity."""
    import asyncio
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    # Run all queries in parallel
    (
        total_pois, total_routes, total_users, total_events,
        pois_with_gps, pois_with_images, active_subs,
        recent_users, recent_visits,
        cat_stats, region_stats, subcategory_stats,
    ) = await asyncio.gather(
        _db.heritage_items.count_documents({}),
        _db.routes.count_documents({}),
        _db.users.count_documents({}),
        _db.calendar_events.count_documents({}),
        _db.heritage_items.count_documents({"geo_location": {"$exists": True}}),
        _db.heritage_items.count_documents({"image_url": {"$exists": True, "$ne": None, "$ne": ""}}),
        _db.subscriptions.count_documents({"status": "active"}),
        _db.users.count_documents({"created_at": {"$gte": week_ago}}),
        _db.visits.count_documents({"visited_at": {"$gte": month_ago}}),
        _db.heritage_items.aggregate([
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]).to_list(50),
        _db.heritage_items.aggregate([
            {"$group": {"_id": "$region", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]).to_list(20),
        _db.heritage_items.aggregate([
            {"$group": {"_id": "$subcategory", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 20},
        ]).to_list(20),
    )

    # IQ stats
    iq_processed = await _db.heritage_items.count_documents({"iq_score": {"$exists": True}})
    avg_iq_result = await _db.heritage_items.aggregate([
        {"$match": {"iq_score": {"$exists": True}}},
        {"$group": {"_id": None, "avg": {"$avg": "$iq_score"}}},
    ]).to_list(1)
    avg_iq = round(avg_iq_result[0]["avg"], 1) if avg_iq_result else 0

    # Top 5 POIs by IQ
    top_pois = await _db.heritage_items.find(
        {"iq_score": {"$exists": True}},
        {"_id": 0, "name": 1, "iq_score": 1, "category": 1, "region": 1, "subcategory": 1}
    ).sort("iq_score", -1).limit(5).to_list(5)

    # Recent activity
    recent_reviews = await _db.reviews.count_documents({"created_at": {"$gte": week_ago}})

    return {
        "overview": {
            "total_pois": total_pois,
            "total_routes": total_routes,
            "total_users": total_users,
            "total_events": total_events,
            "active_subscriptions": active_subs,
        },
        "data_quality": {
            "pois_with_gps": pois_with_gps,
            "pois_without_gps": total_pois - pois_with_gps,
            "gps_coverage_pct": round(pois_with_gps / max(total_pois, 1) * 100, 1),
            "pois_with_images": pois_with_images,
            "image_coverage_pct": round(pois_with_images / max(total_pois, 1) * 100, 1),
            "iq_processed": iq_processed,
            "iq_pending": total_pois - iq_processed,
            "iq_coverage_pct": round(iq_processed / max(total_pois, 1) * 100, 1),
            "avg_iq_score": avg_iq,
        },
        "activity": {
            "new_users_7d": recent_users,
            "visits_30d": recent_visits,
            "reviews_7d": recent_reviews,
        },
        "categories": [{"id": r["_id"], "count": r["count"]} for r in cat_stats if r["_id"]],
        "regions": [{"id": r["_id"], "count": r["count"]} for r in region_stats if r["_id"]],
        "top_subcategories": [{"id": r["_id"], "count": r["count"]} for r in subcategory_stats if r["_id"]],
        "top_pois": top_pois,
    }


# ========================
# IMAGE MODERATION
# ========================

@router.get("/admin/uploads", tags=["Admin"])
async def admin_list_uploads(
    status: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
):
    """List user-uploaded images for admin moderation."""
    query = {}
    if status:
        query["moderation_status"] = status

    uploads = await _db.user_images.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    # Also check upload_records collection (from upload_api.py)
    if not uploads:
        uploads = await _db.upload_records.find(
            query, {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    total = await _db.user_images.count_documents(query) + await _db.upload_records.count_documents(query)
    return {"uploads": uploads, "total": total}


@router.post("/admin/uploads/{image_id}/moderate", tags=["Admin"])
async def moderate_upload(
    image_id: str,
    body: dict = Body(...),
):
    """Approve, reject, or delete a user-uploaded image."""
    action = body.get("action")
    if action not in ("approve", "reject", "delete"):
        raise HTTPException(status_code=400, detail="Ação inválida. Use: approve, reject, delete")

    # Try user_images first, then upload_records
    record = await _db.user_images.find_one({"public_id": image_id})
    collection = "user_images"
    key_field = "public_id"

    if not record:
        record = await _db.upload_records.find_one({"id": image_id})
        collection = "upload_records"
        key_field = "id"

    if not record:
        raise HTTPException(status_code=404, detail="Imagem não encontrada")

    if action == "delete":
        # Try to delete from Cloudinary
        try:
            import cloudinary.uploader
            public_id = record.get("public_id") or record.get("id", "")
            if public_id and not public_id.startswith("/"):
                cloudinary.uploader.destroy(public_id, invalidate=True)
        except Exception:
            pass
        await _db[collection].delete_one({key_field: image_id})
        return {"success": True, "message": "Imagem eliminada"}

    # approve or reject
    await _db[collection].update_one(
        {key_field: image_id},
        {"$set": {
            "moderation_status": "approved" if action == "approve" else "rejected",
            "moderated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"success": True, "message": f"Imagem {action}d"}
