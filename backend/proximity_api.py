"""
Proximity & Nearby POIs API - Geofencing and discovery
"""
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field
from typing import Optional
from math import radians, cos
from shared_utils import haversine_km, DatabaseHolder, apply_municipality_filter
from auth_api import get_current_user
from models.api_models import User

proximity_router = APIRouter(prefix="/proximity", tags=["Proximity"])

_db_holder = DatabaseHolder("proximity")
set_proximity_db = _db_holder.set
_get_db = _db_holder.get


def _tenant_filter(request: Request, explicit: Optional[str]) -> Optional[str]:
    """Resolve the effective municipality filter.

    Priority: explicit query param → X-Municipality-Id header (via TenantMiddleware) → None.
    Returning None means no filter (public discovery across tenants).
    """
    if explicit:
        return explicit
    return getattr(request.state, "municipality_id", None)


@proximity_router.get("/nearby")
async def get_nearby_pois(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, ge=0.1, le=100),
    min_iq: float = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    municipality_id: Optional[str] = Query(None, description="Restrict to a specific municipality"),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get POIs near a GPS position, sorted by distance."""
    projection = {
        "_id": 0, "id": 1, "name": 1, "category": 1, "region": 1,
        "location": 1, "iq_score": 1, "image_url": 1, "description": 1,
    }

    db = _get_db()
    nearby = []
    muni = _tenant_filter(request, municipality_id)

    # Fast path: use 2dsphere $near when geo_location is indexed
    try:
        query: dict = {
            "geo_location": {
                "$near": {
                    "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                    "$maxDistance": int(radius_km * 1000),
                }
            }
        }
        if category:
            query["category"] = category
        if min_iq > 0:
            query["iq_score"] = {"$gte": min_iq}
        if muni:
            query["municipality_id"] = muni
        # Fall back to JWT-based tenant when neither header nor query param set it.
        query = apply_municipality_filter(query, current_user)

        candidates = await db.heritage_items.find(query, projection).limit(limit).to_list(limit)
        for poi in candidates:
            loc = poi.get("location", {})
            dist = haversine_km(lat, lng, loc.get("lat", 0), loc.get("lng", 0))
            poi["distance_km"] = round(dist, 2)
            poi["distance_m"] = round(dist * 1000)
            desc = poi.get("description") or ""
            poi["description"] = desc[:100] + ("..." if len(desc) > 100 else "")
            nearby.append(poi)

    except Exception:
        # Fallback: bounding box when 2dsphere index not yet available
        lat_delta = radius_km / 111.0
        lng_delta = radius_km / (111.0 * cos(radians(lat)))
        query = {
            "location.lat": {"$gte": lat - lat_delta, "$lte": lat + lat_delta},
            "location.lng": {"$gte": lng - lng_delta, "$lte": lng + lng_delta},
        }
        if category:
            query["category"] = category
        if muni:
            query["municipality_id"] = muni
        query = apply_municipality_filter(query, current_user)

        candidates = await db.heritage_items.find(query, projection).limit(500).to_list(500)
        for poi in candidates:
            loc = poi.get("location", {})
            dist = haversine_km(lat, lng, loc["lat"], loc["lng"])
            if dist <= radius_km and (poi.get("iq_score") or 0) >= min_iq:
                poi["distance_km"] = round(dist, 2)
                poi["distance_m"] = round(dist * 1000)
                desc = poi.get("description") or ""
                poi["description"] = desc[:100] + ("..." if len(desc) > 100 else "")
                nearby.append(poi)
        nearby.sort(key=lambda x: x["distance_km"])
        nearby = nearby[:limit]

    return {
        "pois": nearby,
        "total": len(nearby),
        "center": {"lat": lat, "lng": lng},
        "radius_km": radius_km,
    }


@proximity_router.get("/alerts")
async def get_proximity_alerts(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    municipality_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get special alerts for nearby rare/high-IQ POIs (within 500m)."""
    projection = {
        "_id": 0, "id": 1, "name": 1, "category": 1, "region": 1,
        "location": 1, "iq_score": 1,
    }

    db = _get_db()
    candidates = []
    muni = _tenant_filter(request, municipality_id)

    try:
        query = {
            "geo_location": {
                "$near": {
                    "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                    "$maxDistance": 500,
                }
            },
            "iq_score": {"$gte": 55},
        }
        if muni:
            query["municipality_id"] = muni
        query = apply_municipality_filter(query, current_user)
        candidates = await db.heritage_items.find(query, projection).limit(50).to_list(50)
    except Exception:
        lat_delta = 0.5 / 111.0
        lng_delta = 0.5 / (111.0 * cos(radians(lat)))
        query = {
            "location.lat": {"$gte": lat - lat_delta, "$lte": lat + lat_delta},
            "location.lng": {"$gte": lng - lng_delta, "$lte": lng + lng_delta},
            "iq_score": {"$gte": 55},
        }
        if muni:
            query["municipality_id"] = muni
        query = apply_municipality_filter(query, current_user)
        candidates = await db.heritage_items.find(query, projection).limit(50).to_list(50)

    alerts = []
    for poi in candidates:
        loc = poi.get("location", {})
        dist_m = haversine_km(lat, lng, loc.get("lat", 0), loc.get("lng", 0)) * 1000
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
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(10, ge=0.1, le=100),
    municipality_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get POI density summary for an area."""
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * cos(radians(lat)))

    match: dict = {
        "location.lat": {"$gte": lat - lat_delta, "$lte": lat + lat_delta},
        "location.lng": {"$gte": lng - lng_delta, "$lte": lng + lng_delta},
    }
    muni = _tenant_filter(request, municipality_id)
    if muni:
        match["municipality_id"] = muni
    match = apply_municipality_filter(match, current_user)

    pipeline = [
        {"$match": match},
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


# ---------------------------------------------------------------------------
# Backward-compatible POST /nearby alias (legacy map_nearby_api)
# ---------------------------------------------------------------------------

nearby_compat_router = APIRouter(tags=["Nearby-Compat"])


class NearbyRequest(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = Field(5.0, ge=0.1, le=100)
    categories: Optional[list] = None
    limit: int = Field(20, ge=1, le=100)


@nearby_compat_router.post("/nearby")
async def nearby_compat(req: NearbyRequest, request: Request):
    """Legacy POST /nearby — delegates to proximity GET /nearby."""
    return await get_nearby_pois(
        request=request,
        lat=req.latitude,
        lng=req.longitude,
        radius_km=req.radius_km,
        min_iq=0.0,
        category=req.categories[0] if req.categories else None,
        limit=req.limit,
        municipality_id=None,
    )
