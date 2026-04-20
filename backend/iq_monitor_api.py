"""
IQ Engine Monitor API
Provides detailed monitoring and statistics for the IQ Engine processing pipeline.
Used by both admin panel and user-facing dashboard.

v2 additions:
  - GET /iq-monitor/reliability-stats   — A/B/C level breakdown
  - GET /iq-monitor/export/yaml/{poi_id} — single POI YAML export
  - GET /iq-monitor/export/geojson       — bbox-filtered GeoJSON export
"""
import json
from typing import Optional

import yaml
from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse, JSONResponse
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


# ──────────────────────────────────────────────────────────────────────────────
# v2 ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

@iq_monitor_router.get("/reliability-stats")
async def get_reliability_stats():
    """
    Returns breakdown of POIs by reliability level (A / B / C).
    Also includes avg iq_score per level and list of sources responsible
    for the most C-level POIs.
    """
    db = _get_db()
    c = db.heritage_items

    levels = {}
    for level in ["A", "B", "C"]:
        count = await c.count_documents({"iq_reliability_level": level})
        avg_pipeline = [
            {"$match": {"iq_reliability_level": level, "iq_score": {"$exists": True}}},
            {"$group": {"_id": None, "avg": {"$avg": "$iq_score"}}},
        ]
        avg_result = await c.aggregate(avg_pipeline).to_list(length=1)
        avg_score = round(avg_result[0]["avg"], 1) if avg_result else 0.0
        levels[level] = {"count": count, "avg_iq_score": avg_score}

    # Total with any reliability level set
    total_classified = sum(v["count"] for v in levels.values())

    # Top sources responsible for C-level POIs
    c_sources_pipeline = [
        {"$match": {"iq_reliability_level": "C"}},
        {"$group": {"_id": "$source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    c_sources = await c.aggregate(c_sources_pipeline).to_list(length=5)

    return {
        "levels": levels,
        "total_classified": total_classified,
        "c_level_top_sources": [
            {"source": s["_id"] or "unknown", "count": s["count"]}
            for s in c_sources
        ],
    }


@iq_monitor_router.get("/export/yaml/{poi_id}", response_class=PlainTextResponse)
async def export_poi_yaml(poi_id: str):
    """
    Export a single POI as YAML — includes all IQ Engine fields.
    """
    db = _get_db()
    poi = await db.heritage_items.find_one(
        {"id": poi_id},
        {"_id": 0}
    )
    if not poi:
        return PlainTextResponse(f"# POI not found: {poi_id}\n", status_code=404)

    # Convert datetime objects to ISO strings for YAML serialisation
    def _serialise(obj):
        if hasattr(obj, "isoformat"):
            return obj.isoformat()
        return str(obj)

    poi_clean = json.loads(json.dumps(poi, default=_serialise))
    yaml_str = yaml.dump(poi_clean, allow_unicode=True, default_flow_style=False, sort_keys=False)
    return PlainTextResponse(yaml_str, media_type="text/yaml")


@iq_monitor_router.get("/export/geojson")
async def export_geojson(
    min_lat: float = Query(..., description="Bounding box south latitude"),
    max_lat: float = Query(..., description="Bounding box north latitude"),
    min_lng: float = Query(..., description="Bounding box west longitude"),
    max_lng: float = Query(..., description="Bounding box east longitude"),
    min_score: Optional[float] = Query(None, ge=0, le=100, description="Minimum IQ score filter"),
    reliability: Optional[str] = Query(None, description="Filter by reliability level: A, B or C"),
    limit: int = Query(200, ge=1, le=1000),
):
    """
    Export POIs within a bounding box as GeoJSON FeatureCollection.
    Includes iq_score, reliability_level, category, name, slug.
    """
    db = _get_db()

    query: dict = {
        "location.coordinates": {
            "$geoWithin": {
                "$box": [
                    [min_lng, min_lat],
                    [max_lng, max_lat],
                ]
            }
        }
    }

    if min_score is not None:
        query["iq_score"] = {"$gte": min_score}

    if reliability:
        query["iq_reliability_level"] = reliability.upper()

    projection = {
        "_id": 0,
        "id": 1,
        "name": 1,
        "slug": 1,
        "category": 1,
        "region": 1,
        "iq_score": 1,
        "iq_reliability_level": 1,
        "location": 1,
        "micro_pitch": 1,
    }

    pois = await db.heritage_items.find(query, projection).limit(limit).to_list(length=limit)

    features = []
    for poi in pois:
        loc = poi.get("location")
        coords = None
        if isinstance(loc, dict):
            if "coordinates" in loc:
                coords = loc["coordinates"]  # [lng, lat]
            elif "lng" in loc and "lat" in loc:
                coords = [loc["lng"], loc["lat"]]

        if not coords:
            continue

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": coords},
            "properties": {
                "id": poi.get("id"),
                "name": poi.get("name"),
                "slug": poi.get("slug"),
                "category": poi.get("category"),
                "region": poi.get("region"),
                "iq_score": poi.get("iq_score"),
                "reliability_level": poi.get("iq_reliability_level"),
                "micro_pitch": poi.get("micro_pitch"),
            },
        })

    return JSONResponse({
        "type": "FeatureCollection",
        "features": features,
        "meta": {
            "count": len(features),
            "bbox": [min_lng, min_lat, max_lng, max_lat],
            "filters": {
                "min_score": min_score,
                "reliability": reliability,
            },
        },
    })
