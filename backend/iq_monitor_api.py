"""
IQ Engine Monitor API
Provides detailed monitoring and statistics for the IQ Engine processing pipeline.
Used by both admin panel and user-facing dashboard.
"""
from fastapi import APIRouter
from shared_utils import DatabaseHolder

iq_monitor_router = APIRouter(prefix="/iq-monitor", tags=["IQ Monitor"])

_db_holder = DatabaseHolder("iq_monitor")
set_iq_monitor_db = _db_holder.set
_get_db = _db_holder.get


@iq_monitor_router.get("/overview")
async def get_iq_overview():
    """High-level IQ Engine stats for user-facing dashboard"""
    db = _get_db()
    c = db.heritage_items

    total = await c.count_documents({})
    iq_done = await c.count_documents({"iq_status": "completed"})
    with_coords = await c.count_documents({"location.lat": {"$exists": True}})

    # Average IQ score
    avg_pipeline = [
        {"$match": {"iq_score": {"$exists": True, "$gt": 0}}},
        {"$group": {"_id": None, "avg": {"$avg": "$iq_score"}, "max": {"$max": "$iq_score"}, "min": {"$min": "$iq_score"}}},
    ]
    avg_result = await c.aggregate(avg_pipeline).to_list(length=1)
    avg_data = avg_result[0] if avg_result else {"avg": 0, "max": 0, "min": 0}

    # Score distribution buckets
    score_dist = []
    for label, low, high, color in [
        ("Excelente", 80, 101, "#22C55E"),
        ("Bom", 60, 80, "#84CC16"),
        ("Médio", 40, 60, "#F59E0B"),
        ("Baixo", 20, 40, "#F97316"),
        ("Crítico", 0, 20, "#EF4444"),
    ]:
        cnt = await c.count_documents({"iq_score": {"$gte": low, "$lt": high}})
        score_dist.append({"label": label, "min": low, "max": high, "count": cnt, "color": color})

    # Category breakdown with avg scores
    cat_pipeline = [
        {"$match": {"iq_score": {"$exists": True, "$gt": 0}}},
        {"$group": {
            "_id": "$category",
            "count": {"$sum": 1},
            "avg_score": {"$avg": "$iq_score"},
            "max_score": {"$max": "$iq_score"},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 15},
    ]
    categories = await c.aggregate(cat_pipeline).to_list(length=15)

    # Region breakdown with avg scores
    reg_pipeline = [
        {"$match": {"iq_score": {"$exists": True, "$gt": 0}}},
        {"$group": {
            "_id": "$region",
            "count": {"$sum": 1},
            "avg_score": {"$avg": "$iq_score"},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    regions = await c.aggregate(reg_pipeline).to_list(length=10)

    return {
        "total_pois": total,
        "iq_processed": iq_done,
        "iq_pending": total - iq_done,
        "iq_progress_pct": round(100 * iq_done / total, 1) if total > 0 else 0,
        "with_coordinates": with_coords,
        "avg_iq_score": round(avg_data["avg"], 1) if avg_data.get("avg") else 0,
        "max_iq_score": round(avg_data["max"], 1) if avg_data.get("max") else 0,
        "min_iq_score": round(avg_data["min"], 1) if avg_data.get("min") else 0,
        "score_distribution": score_dist,
        "categories": [
            {"name": c["_id"] or "outros", "count": c["count"], "avg_score": round(c["avg_score"], 1), "max_score": round(c["max_score"], 1)}
            for c in categories if c["_id"]
        ],
        "regions": [
            {"name": r["_id"] or "portugal", "count": r["count"], "avg_score": round(r["avg_score"], 1)}
            for r in regions if r["_id"]
        ],
    }


@iq_monitor_router.get("/admin")
async def get_iq_admin():
    """Detailed IQ Engine stats for admin/developer panel"""
    db = _get_db()
    c = db.heritage_items

    total = await c.count_documents({})
    iq_done = await c.count_documents({"iq_status": "completed"})
    with_coords = await c.count_documents({"location.lat": {"$exists": True}})

    # Per-module stats
    module_pipeline = [
        {"$match": {"iq_results": {"$exists": True}}},
        {"$unwind": "$iq_results"},
        {"$group": {
            "_id": "$iq_results.module",
            "count": {"$sum": 1},
            "avg_score": {"$avg": "$iq_results.score"},
            "avg_confidence": {"$avg": "$iq_results.confidence"},
            "pass_count": {"$sum": {"$cond": [{"$in": ["$iq_results.status", ["pass", "completed", "success"]]}, 1, 0]}},
            "warn_count": {"$sum": {"$cond": [{"$in": ["$iq_results.status", ["warning", "requires_review", "review"]]}, 1, 0]}},
            "fail_count": {"$sum": {"$cond": [{"$in": ["$iq_results.status", ["fail", "error", "failed"]]}, 1, 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    modules = await c.aggregate(module_pipeline).to_list(length=30)

    # Source breakdown
    source_pipeline = [
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    sources = await c.aggregate(source_pipeline).to_list(length=10)

    # Recently processed (last 10)
    recent = await c.find(
        {"iq_status": "completed"},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "iq_score": 1, "iq_processed_at": 1, "iq_module_count": 1}
    ).sort("iq_processed_at", -1).limit(10).to_list(length=10)

    for r in recent:
        if r.get("iq_processed_at"):
            r["iq_processed_at"] = r["iq_processed_at"].isoformat() if hasattr(r["iq_processed_at"], 'isoformat') else str(r["iq_processed_at"])

    # Top 10 highest scored POIs
    top_pois = await c.find(
        {"iq_score": {"$exists": True, "$gt": 0}},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "iq_score": 1}
    ).sort("iq_score", -1).limit(10).to_list(length=10)

    # Bottom 10 lowest scored POIs
    bottom_pois = await c.find(
        {"iq_score": {"$exists": True, "$gt": 0}},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "iq_score": 1}
    ).sort("iq_score", 1).limit(10).to_list(length=10)

    # Import batches
    batch_pipeline = [
        {"$match": {"import_batch": {"$exists": True}}},
        {"$group": {
            "_id": "$import_batch",
            "count": {"$sum": 1},
            "iq_done": {"$sum": {"$cond": [{"$eq": ["$iq_status", "completed"]}, 1, 0]}},
        }},
        {"$sort": {"count": -1}},
    ]
    batches = await c.aggregate(batch_pipeline).to_list(length=20)

    return {
        "total_pois": total,
        "iq_processed": iq_done,
        "iq_pending": total - iq_done,
        "iq_progress_pct": round(100 * iq_done / total, 1) if total > 0 else 0,
        "with_coordinates": with_coords,
        "modules": [
            {
                "name": m["_id"],
                "processed": m["count"],
                "avg_score": round(m["avg_score"], 1) if m["avg_score"] else 0,
                "avg_confidence": round(m["avg_confidence"], 2) if m["avg_confidence"] else 0,
                "pass": m["pass_count"],
                "warn": m["warn_count"],
                "fail": m["fail_count"],
            }
            for m in modules
        ],
        "sources": [{"name": s["_id"] or "unknown", "count": s["count"]} for s in sources],
        "recent_processed": recent,
        "top_pois": top_pois,
        "bottom_pois": bottom_pois,
        "import_batches": [
            {"batch_id": b["_id"], "total": b["count"], "iq_done": b["iq_done"]}
            for b in batches if b["_id"]
        ],
    }
