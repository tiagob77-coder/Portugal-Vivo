"""
Map Nearby API - Nearby POIs discovery using MongoDB $geoNear.
Extracted from server.py.
"""
import math
from fastapi import APIRouter
from typing import Optional, List

from shared_utils import DatabaseHolder
from models.api_models import NearbyPOIRequest, NearbyPOIResponse, Location

import logging
logger = logging.getLogger(__name__)

map_nearby_router = APIRouter(tags=["Map"])

_db_holder = DatabaseHolder("map_nearby")
set_map_nearby_db = _db_holder.set


def get_cardinal_direction(from_lat, from_lng, to_lat, to_lng):
    """Get cardinal direction from one point to another"""
    delta_lng = to_lng - from_lng
    delta_lat = to_lat - from_lat

    angle = math.degrees(math.atan2(delta_lng, delta_lat))

    directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    index = round(angle / 45) % 8

    return directions[index]


@map_nearby_router.post("/nearby", response_model=NearbyPOIResponse, tags=["Map"])
async def get_nearby_pois(request: NearbyPOIRequest):
    """Get POIs near a given location using MongoDB $geoNear (optimized)"""
    match_stage = {}
    if request.categories:
        match_stage["category"] = {"$in": request.categories}

    pipeline = [
        {
            "$geoNear": {
                "near": {"type": "Point", "coordinates": [request.longitude, request.latitude]},
                "distanceField": "distance_meters",
                "maxDistance": request.radius_km * 1000,
                "spherical": True,
                "query": {**match_stage, "geo_location": {"$exists": True}}
            }
        },
        {"$limit": request.limit},
        {"$project": {"_id": 0, "geo_location": 0}}
    ]

    try:
        results = await _db_holder.db.heritage_items.aggregate(pipeline).to_list(request.limit)
    except Exception as e:
        if "2dsphere" in str(e) or "geoNear" in str(e).lower():
            logger.warning("Geospatial index missing – returning empty results: %s", e)
            return NearbyPOIResponse(
                user_location=Location(lat=request.latitude, lng=request.longitude),
                pois=[], total_found=0
            )
        raise

    nearby_items = []
    for item in results:
        dist_km = round(item.pop("distance_meters", 0) / 1000, 2)
        item["distance_km"] = dist_km
        item["direction"] = get_cardinal_direction(
            request.latitude, request.longitude,
            item.get("location", {}).get("lat", 0),
            item.get("location", {}).get("lng", 0)
        )
        nearby_items.append(item)

    return NearbyPOIResponse(
        user_location=Location(lat=request.latitude, lng=request.longitude),
        pois=nearby_items,
        total_found=len(nearby_items)
    )


@map_nearby_router.get("/nearby/categories")
async def get_nearby_category_counts(
    latitude: float,
    longitude: float,
    radius_km: float = 50
):
    """Get count of POIs per category near a location using $geoNear (optimized)"""
    pipeline = [
        {
            "$geoNear": {
                "near": {"type": "Point", "coordinates": [longitude, latitude]},
                "distanceField": "distance_meters",
                "maxDistance": radius_km * 1000,
                "spherical": True,
                "query": {"geo_location": {"$exists": True}}
            }
        },
        {
            "$group": {
                "_id": {"$ifNull": ["$category", "outros"]},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}}
    ]

    results = await _db_holder.db.heritage_items.aggregate(pipeline).to_list(100)

    sorted_counts = [{"category": r["_id"], "count": r["count"]} for r in results]

    return {
        "location": {"lat": latitude, "lng": longitude},
        "radius_km": radius_km,
        "total_pois": sum(c["count"] for c in sorted_counts),
        "categories": sorted_counts
    }
