from fastapi import APIRouter, Response, HTTPException, Body, Query, Depends, Request
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import math

from shared_constants import CATEGORIES, REGIONS
from models.api_models import User

router = APIRouter()

_db = None
_require_admin = None


def set_admin_dashboard_db(database):
    global _db
    _db = database


def set_admin_dashboard_admin(admin_fn):
    global _require_admin
    _require_admin = admin_fn


async def _admin_dep(request: Request) -> User:
    return await _require_admin(request)


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
    admin: User = Depends(_admin_dep),
):
    """Approve, reject, or delete a user-uploaded image (admin only)."""
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


# ── Doc 4 v2 — Admin IQ Score by module ──────────────────────────────────────

@router.get("/admin/iq-score", tags=["Admin"])
async def get_iq_score_by_module(
    module: Optional[str] = Query(None, description="trilhos | patrimonio | gastronomia | natureza | all"),
    tenant_id: Optional[str] = Query(None),
    period: int = Query(30, description="Dias de histórico"),
):
    """IQ Score médio por módulo/categoria — Doc4 §3.3"""
    query: dict = {}
    if tenant_id:
        query["municipality_id"] = tenant_id

    # Map module to category groups
    module_map = {
        "trilhos":     ["percursos_pedestres", "ecovias_passadicos", "aventura_natureza"],
        "patrimonio":  ["historia", "arqueologia", "castelos", "museus", "arte", "religioso"],
        "gastronomia": ["gastronomia", "vinhos", "restaurantes", "mercados"],
        "natureza":    ["natureza", "fauna_autoctone", "flora_autoctone", "parques", "reservas"],
        "praias":      ["praias", "praia", "costa", "surf"],
    }

    results = {}
    modules_to_check = [module] if (module and module != "all") else list(module_map.keys())

    for mod in modules_to_check:
        cats = module_map.get(mod, [])
        q = {**query, "category": {"$in": cats}} if cats else query
        pipeline = [
            {"$match": q},
            {"$group": {
                "_id": None,
                "avg_iq": {"$avg": "$iq_score"},
                "count": {"$sum": 1},
                "with_iq": {"$sum": {"$cond": [{"$gt": ["$iq_score", 0]}, 1, 0]}},
            }},
        ]
        agg = await _db.heritage_items.aggregate(pipeline).to_list(1)
        if agg:
            r = agg[0]
            results[mod] = {
                "avg_iq_score": round(r.get("avg_iq") or 0, 1),
                "total_pois": r.get("count", 0),
                "pois_with_iq": r.get("with_iq", 0),
                "coverage_pct": round((r.get("with_iq", 0) / max(r.get("count", 1), 1)) * 100, 1),
            }
        else:
            results[mod] = {"avg_iq_score": 0, "total_pois": 0, "pois_with_iq": 0, "coverage_pct": 0}

    return {
        "modules": results,
        "period_days": period,
        "tenant_id": tenant_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Doc 4 v2 — Heatmap data endpoint ─────────────────────────────────────────

@router.get("/admin/heatmap", tags=["Admin"])
async def get_heatmap_data(
    tenant_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    resolution: float = Query(0.05, description="Grid cell size in degrees (~5km)"),
    limit: int = Query(500, ge=10, le=2000),
):
    """
    Agrega visitas/POIs num grid geográfico para heatmap — Doc4 §3.3.
    Retorna cells com {lat, lng, intensity} para renderizar no mapa.
    """
    query: dict = {}
    if tenant_id:
        query["municipality_id"] = tenant_id
    if category:
        query["category"] = category

    pipeline = [
        {"$match": query},
        {"$match": {"location.lat": {"$exists": True}, "location.lng": {"$exists": True}}},
        {"$project": {
            "lat_cell": {"$multiply": [{"$floor": {"$divide": ["$location.lat", resolution]}}, resolution]},
            "lng_cell": {"$multiply": [{"$floor": {"$divide": ["$location.lng", resolution]}}, resolution]},
            "iq_score": {"$ifNull": ["$iq_score", 50]},
        }},
        {"$group": {
            "_id": {"lat": "$lat_cell", "lng": "$lng_cell"},
            "count": {"$sum": 1},
            "avg_iq": {"$avg": "$iq_score"},
        }},
        {"$project": {
            "_id": 0,
            "lat": "$_id.lat",
            "lng": "$_id.lng",
            "count": 1,
            "intensity": {"$divide": [{"$add": ["$count", {"$divide": ["$avg_iq", 20]}]}, 1]},
        }},
        {"$sort": {"intensity": -1}},
        {"$limit": limit},
    ]

    cells = await _db.heritage_items.aggregate(pipeline).to_list(limit)
    max_intensity = max((c.get("intensity", 1) for c in cells), default=1)

    # Normalize intensity 0..1
    for c in cells:
        c["intensity"] = round(c["intensity"] / max_intensity, 3)

    return {
        "cells": cells,
        "total": len(cells),
        "resolution_deg": resolution,
        "tenant_id": tenant_id,
        "category": category,
    }


# ── Doc 4 v2 — IPMA trail alerts ─────────────────────────────────────────────

@router.get("/admin/alerts", tags=["Admin"])
async def get_trail_alerts(
    tenant_id: Optional[str] = Query(None),
    types: Optional[str] = Query(None, description="fire,wind,rain,tide — comma separated"),
):
    """
    Alertas activos para trilhos: incêndio, vento, chuva.
    Simula dados IPMA (substituir por integração real).
    """
    now = datetime.now(timezone.utc)
    day = now.timetuple().tm_yday

    # Simulate seasonal risk levels
    fire_risk = "muito_alto" if 150 < day < 280 else ("alto" if 130 < day < 300 else "baixo")
    wind_kmh = round(15 + 20 * abs(math.sin(day * 0.07)), 1)
    rain_mm = round(max(0, 5 * math.sin(day * 0.05 + 3)), 1)

    alerts: List[dict] = []
    alert_types = set(types.split(",")) if types else {"fire", "wind", "rain"}

    if "fire" in alert_types and fire_risk in ("alto", "muito_alto"):
        alerts.append({
            "type": "fire",
            "level": fire_risk,
            "message": f"Risco de incêndio {fire_risk.replace('_', ' ')} — evite trilhos em zonas florestais",
            "affected_regions": ["Alentejo", "Algarve", "Centro"] if fire_risk == "muito_alto" else ["Alentejo"],
            "source": "IPMA_simulated",
            "expires_at": (now + timedelta(hours=24)).isoformat(),
        })
    if "wind" in alert_types and wind_kmh > 40:
        alerts.append({
            "type": "wind",
            "level": "moderado",
            "message": f"Vento forte ({wind_kmh} km/h) — precaução em miradouros e trilhos de altitude",
            "source": "IPMA_simulated",
            "expires_at": (now + timedelta(hours=12)).isoformat(),
        })
    if "rain" in alert_types and rain_mm > 10:
        alerts.append({
            "type": "rain",
            "level": "moderado",
            "message": f"Precipitação prevista ({rain_mm}mm) — trilhos de terra podem estar escorregadios",
            "source": "IPMA_simulated",
            "expires_at": (now + timedelta(hours=6)).isoformat(),
        })

    return {
        "alerts": alerts,
        "total": len(alerts),
        "tenant_id": tenant_id,
        "checked_at": now.isoformat(),
        "next_check": (now + timedelta(hours=1)).isoformat(),
    }
