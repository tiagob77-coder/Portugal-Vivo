"""Geospatial query helpers for the canonical `pois` collection."""
from typing import Optional

from shared_utils import haversine_km

_POI_LIST_PROJECTION = {
    "_id": 0,
    "slug": 1,
    "name": 1,
    "category": 1,
    "content.pt.short_description": 1,
    "media.cover_image": 1,
    "location": 1,
    "stats.rating_avg": 1,
}


async def get_nearby_pois(
    db,
    municipality_id: str,
    lat: float,
    lng: float,
    radius_km: float = 10.0,
    category: Optional[str] = None,
    limit: int = 20,
) -> list:
    """Return POIs sorted by distance from (lat, lng) using the 2dsphere index.

    Each result includes a computed `distance_km` field (Haversine, precise).
    """
    query: dict = {
        "municipality_id": municipality_id,
        "status": "active",
        "location": {
            "$near": {
                "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                "$maxDistance": int(radius_km * 1000),
            }
        },
    }
    if category:
        query["category"] = category

    docs = await db["pois"].find(query, _POI_LIST_PROJECTION).limit(limit).to_list(limit)

    for doc in docs:
        coords = doc.get("location", {}).get("coordinates", [None, None])
        if coords[0] is not None:
            doc["distance_km"] = round(haversine_km(lat, lng, coords[1], coords[0]), 2)

    return docs


async def get_pois_in_bounds(
    db,
    municipality_id: str,
    sw_lat: float,
    sw_lng: float,
    ne_lat: float,
    ne_lng: float,
) -> list:
    """Return all active POIs within a bounding box for map rendering."""
    return await db["pois"].find(
        {
            "municipality_id": municipality_id,
            "status": "active",
            "location": {
                "$geoWithin": {
                    "$box": [[sw_lng, sw_lat], [ne_lng, ne_lat]]
                }
            },
        },
        {
            "_id": 0,
            "slug": 1,
            "name": 1,
            "category": 1,
            "location": 1,
            "media.cover_image": 1,
        },
    ).to_list(500)
