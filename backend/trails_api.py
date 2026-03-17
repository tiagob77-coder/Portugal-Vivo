"""
Trilhos GPX API - Trail routes management and visualization
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from shared_utils import haversine_km as _haversine_km, DatabaseHolder

trails_router = APIRouter(prefix="/trails", tags=["trails"])
_db_holder = DatabaseHolder("trails")
set_db = _db_holder.set


class TrailPoint(BaseModel):
    lat: float
    lng: float
    ele: Optional[float] = None


class Trail(BaseModel):
    id: str = ""
    name: str
    description: str = ""
    region: str = ""
    difficulty: str = "moderado"  # facil, moderado, dificil, muito_dificil
    distance_km: float = 0
    elevation_gain: float = 0
    elevation_loss: float = 0
    min_elevation: float = 0
    max_elevation: float = 0
    estimated_hours: float = 0
    trail_type: str = "linear"  # linear, circular, ida_volta
    points: List[TrailPoint] = []
    color: str = "#F59E0B"
    tags: List[str] = []
    nearby_pois: List[str] = []


def parse_gpx(gpx_content: str) -> dict:
    """Parse GPX XML content and extract trail data."""
    ns = {
        'gpx': 'http://www.topografix.com/GPX/1/1',
        'gpx10': 'http://www.topografix.com/GPX/1/0',
    }

    root = ET.fromstring(gpx_content)

    # Try GPX 1.1 first, then 1.0
    tracks = root.findall('.//gpx:trk', ns)
    if not tracks:
        tracks = root.findall('.//gpx10:trk', ns)
    if not tracks:
        tracks = root.findall('.//trk')

    points = []
    name = ""
    description = ""

    if tracks:
        track = tracks[0]
        name_el = track.find('gpx:name', ns) or track.find('gpx10:name', ns) or track.find('name')
        if name_el is not None and name_el.text:
            name = name_el.text

        desc_el = track.find('gpx:desc', ns) or track.find('gpx10:desc', ns) or track.find('desc')
        if desc_el is not None and desc_el.text:
            description = desc_el.text

        for seg in (track.findall('.//gpx:trkseg', ns) or track.findall('.//gpx10:trkseg', ns) or track.findall('.//trkseg')):
            for pt in (seg.findall('gpx:trkpt', ns) or seg.findall('gpx10:trkpt', ns) or seg.findall('trkpt')):
                lat = float(pt.get('lat', 0))
                lng = float(pt.get('lon', 0))
                ele = None
                ele_el = pt.find('gpx:ele', ns) or pt.find('gpx10:ele', ns) or pt.find('ele')
                if ele_el is not None and ele_el.text:
                    ele = float(ele_el.text)
                points.append({"lat": lat, "lng": lng, "ele": ele})

    # Calculate stats
    distance = 0
    elevation_gain = 0
    elevation_loss = 0
    elevations = [p["ele"] for p in points if p.get("ele") is not None]

    for i in range(1, len(points)):
        p1, p2 = points[i-1], points[i]
        distance += haversine(p1["lat"], p1["lng"], p2["lat"], p2["lng"])
        if p1.get("ele") is not None and p2.get("ele") is not None:
            diff = p2["ele"] - p1["ele"]
            if diff > 0:
                elevation_gain += diff
            else:
                elevation_loss += abs(diff)

    return {
        "name": name,
        "description": description,
        "points": points,
        "distance_km": round(distance, 1),
        "elevation_gain": round(elevation_gain),
        "elevation_loss": round(elevation_loss),
        "min_elevation": round(min(elevations)) if elevations else 0,
        "max_elevation": round(max(elevations)) if elevations else 0,
    }


haversine = _haversine_km


@trails_router.get("")
async def list_trails():
    """List all available trails."""
    trails = await _db_holder.db.trails.find({}, {"_id": 0, "points": 0}).to_list(100)
    return trails


@trails_router.get("/{trail_id}")
async def get_trail(trail_id: str):
    """Get a specific trail with all points."""
    trail = await _db_holder.db.trails.find_one({"id": trail_id}, {"_id": 0})
    if not trail:
        raise HTTPException(status_code=404, detail="Trilho não encontrado")
    return trail


@trails_router.get("/{trail_id}/pois")
async def get_trail_pois(trail_id: str, radius_km: float = 2.0):
    """Get POIs near a trail."""
    trail = await _db_holder.db.trails.find_one({"id": trail_id}, {"_id": 0, "points": 1})
    if not trail:
        raise HTTPException(status_code=404, detail="Trilho não encontrado")

    # Sample points along the trail (every 10th point for efficiency)
    sample_points = trail["points"][::max(1, len(trail["points"])//20)]

    # Compute bounding box across all sample points to query once
    from math import cos, radians
    lats = [sp["lat"] for sp in sample_points]
    lngs = [sp["lng"] for sp in sample_points]
    center_lat = (min(lats) + max(lats)) / 2
    lat_delta = (max(lats) - min(lats)) / 2 + radius_km / 111.0
    lng_delta = (max(lngs) - min(lngs)) / 2 + radius_km / (111.0 * cos(radians(center_lat)))

    pois = await _db_holder.db.heritage_items.find({
        "location.lat": {"$gte": min(lats) - lat_delta, "$lte": max(lats) + lat_delta},
        "location.lng": {"$gte": min(lngs) - lng_delta, "$lte": max(lngs) + lng_delta},
    }, {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "location": 1, "iq_score": 1}).to_list(5000)

    nearby_ids = set()
    nearby_pois = []

    for poi in pois:
        loc = poi.get("location", {})
        if not loc.get("lat") or poi["id"] in nearby_ids:
            continue
        # Find minimum distance to any sample point on the trail
        min_dist = min(haversine(sp["lat"], sp["lng"], loc["lat"], loc["lng"]) for sp in sample_points)
        if min_dist <= radius_km:
            nearby_ids.add(poi["id"])
            poi["distance_km"] = round(min_dist, 2)
            nearby_pois.append(poi)

    nearby_pois.sort(key=lambda x: x.get("distance_km", 99))
    return {"trail_id": trail_id, "pois": nearby_pois[:50], "total": len(nearby_pois)}


@trails_router.post("/upload")
async def upload_gpx(file: UploadFile = File(...)):
    """Upload a GPX file and create a trail."""
    content = await file.read()
    gpx_data = parse_gpx(content.decode("utf-8"))

    trail_id = str(uuid.uuid4())[:8]
    trail = {
        "id": trail_id,
        "name": gpx_data["name"] or file.filename.replace(".gpx", ""),
        "description": gpx_data["description"],
        "points": gpx_data["points"],
        "distance_km": gpx_data["distance_km"],
        "elevation_gain": gpx_data["elevation_gain"],
        "elevation_loss": gpx_data["elevation_loss"],
        "min_elevation": gpx_data["min_elevation"],
        "max_elevation": gpx_data["max_elevation"],
        "estimated_hours": round(gpx_data["distance_km"] / 4, 1),
        "difficulty": "moderado",
        "trail_type": "linear",
        "region": "",
        "color": "#F59E0B",
        "tags": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await _db_holder.db.trails.insert_one(trail)
    trail.pop("_id", None)
    return trail


@trails_router.get("/elevation/{trail_id}")
async def get_elevation_profile(trail_id: str):
    """Get elevation profile data for charting."""
    trail = await _db_holder.db.trails.find_one({"id": trail_id}, {"_id": 0, "points": 1, "name": 1})
    if not trail:
        raise HTTPException(status_code=404, detail="Trilho não encontrado")

    points = trail["points"]
    profile = []
    cumulative_dist = 0

    for i, pt in enumerate(points):
        if i > 0:
            cumulative_dist += haversine(points[i-1]["lat"], points[i-1]["lng"], pt["lat"], pt["lng"])
        profile.append({
            "distance_km": round(cumulative_dist, 2),
            "elevation": pt.get("ele", 0) or 0,
            "lat": pt["lat"],
            "lng": pt["lng"],
        })

    # Downsample if too many points (keep ~200 for chart)
    if len(profile) > 200:
        step = len(profile) // 200
        profile = profile[::step] + [profile[-1]]

    return {"trail_name": trail["name"], "profile": profile}
