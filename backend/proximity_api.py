"""
Proximity & Nearby POIs API - Geofencing and discovery
"""
from fastapi import APIRouter, Query
from typing import Optional
from math import radians, cos
from shared_utils import haversine_km, DatabaseHolder

proximity_router = APIRouter(prefix="/proximity", tags=["Proximity"])

_db_holder = DatabaseHolder("proximity")
set_proximity_db = _db_holder.set
_get_db = _db_holder.get


@proximity_router.get("/nearby")
async def get_nearby_pois(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, ge=0.1, le=100),
    min_iq: float = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
):
    """Get POIs near a GPS position, sorted by distance."""
    query = {"location.lat": {"$exists": True, "$ne": None}}
    if category:
        query["category"] = category

    projection = {
        "_id": 0, "id": 1, "name": 1, "category": 1, "region": 1,
        "location": 1, "iq_score": 1, "image_url": 1, "description": 1,
    }

    # Get candidates (pre-filter with bounding box)
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * cos(radians(lat)))
    query["location.lat"] = {"$gte": lat - lat_delta, "$lte": lat + lat_delta}
    query["location.lng"] = {"$gte": lng - lng_delta, "$lte": lng + lng_delta}

    db = _get_db()
    candidates = await db.heritage_items.find(query, projection).limit(500).to_list(500)

    nearby = []
    for poi in candidates:
        loc = poi.get("location", {})
        dist = haversine_km(lat, lng, loc["lat"], loc["lng"])
        if dist <= radius_km:
            iq = poi.get("iq_score") or 0
            if iq >= min_iq:
                poi["distance_km"] = round(dist, 2)
                poi["distance_m"] = round(dist * 1000)
                desc = poi.get("description") or ""
                poi["description"] = desc[:100] + ("..." if len(desc) > 100 else "")
                nearby.append(poi)

    nearby.sort(key=lambda x: x["distance_km"])
    return {
        "pois": nearby[:limit],
        "total": len(nearby),
        "center": {"lat": lat, "lng": lng},
        "radius_km": radius_km,
    }


@proximity_router.get("/alerts")
async def get_proximity_alerts(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    """Get special alerts for nearby rare/high-IQ POIs (within 500m)."""
    query = {
        "location.lat": {"$exists": True, "$ne": None},
        "iq_score": {"$gte": 55},
    }

    lat_delta = 0.5 / 111.0
    lng_delta = 0.5 / (111.0 * cos(radians(lat)))
    query["location.lat"] = {"$gte": lat - lat_delta, "$lte": lat + lat_delta}
    query["location.lng"] = {"$gte": lng - lng_delta, "$lte": lng + lng_delta}

    projection = {
        "_id": 0, "id": 1, "name": 1, "category": 1, "region": 1,
        "location": 1, "iq_score": 1,
    }

    db = _get_db()
    candidates = await db.heritage_items.find(query, projection).limit(50).to_list(50)

    alerts = []
    for poi in candidates:
        loc = poi.get("location", {})
        dist_m = haversine_km(lat, lng, loc["lat"], loc["lng"]) * 1000
        if dist_m <= 500:
            alert_type = "rare" if (poi.get("iq_score") or 0) >= 60 else "nearby"
            alerts.append({
                "poi_id": poi["id"],
                "poi_name": poi["name"],
                "category": poi["category"],
                "iq_score": poi.get("iq_score"),
                "distance_m": round(dist_m),
                "alert_type": alert_type,
                "message": f"Está a {round(dist_m)}m de {poi['name']}!" if alert_type == "nearby"
                    else f"POI raro perto! {poi['name']} (IQ: {poi.get('iq_score', 0):.0f}) a {round(dist_m)}m",
            })

    alerts.sort(key=lambda x: x["distance_m"])
    return {"alerts": alerts, "total": len(alerts)}


@proximity_router.get("/heatzone")
async def get_heatzone(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(10, ge=0.1, le=100),
):
    """Get POI density summary for an area."""
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * cos(radians(lat)))

    pipeline = [
        {"$match": {
            "location.lat": {"$gte": lat - lat_delta, "$lte": lat + lat_delta},
            "location.lng": {"$gte": lng - lng_delta, "$lte": lng + lng_delta},
        }},
        {"$group": {
            "_id": "$category",
            "count": {"$sum": 1},
            "avg_iq": {"$avg": "$iq_score"},
        }},
        {"$sort": {"count": -1}},
    ]

    db = _get_db()
    results = await db.heritage_items.aggregate(pipeline).to_list(20)
    total = sum(r["count"] for r in results)

    return {
        "center": {"lat": lat, "lng": lng},
        "radius_km": radius_km,
        "total_pois": total,
        "categories": [
            {"category": r["_id"], "count": r["count"], "avg_iq": round(r.get("avg_iq") or 0, 1)}
            for r in results
        ],
    }
