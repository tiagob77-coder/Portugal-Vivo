"""
Trilhos GPX API - Trail routes management and visualization
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Response
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
    terrain_type: Optional[str] = None
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
        "estimated_hours": round(
            gpx_data["distance_km"] / 4.0 + gpx_data["elevation_gain"] / 600.0, 1
        ),
        "difficulty": (
            "facil" if gpx_data["elevation_gain"] < 200
            else "moderado" if gpx_data["elevation_gain"] < 500
            else "dificil" if gpx_data["elevation_gain"] < 1000
            else "muito_dificil"
        ),
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


@trails_router.get("/{trail_id}/segments")
async def get_trail_segments(trail_id: str):
    """Calcula segmentos do trilho com declive, distância e classificação de superfície."""
    trail = await _db_holder.db.trails.find_one({"id": trail_id}, {"_id": 0, "points": 1, "name": 1})
    if not trail:
        raise HTTPException(status_code=404, detail="Trilho não encontrado")

    points = trail["points"]
    if len(points) < 2:
        raise HTTPException(status_code=422, detail="Trilho sem pontos suficientes para calcular segmentos")

    # Downsample to max 100 segments (101 points)
    if len(points) > 101:
        step = (len(points) - 1) / 100
        indices = [int(round(i * step)) for i in range(100)] + [len(points) - 1]
        # Remove duplicates while preserving order
        seen = set()
        unique_indices = []
        for idx in indices:
            if idx not in seen:
                seen.add(idx)
                unique_indices.append(idx)
        points = [points[i] for i in unique_indices]

    def _slope_class(abs_slope_pct: float) -> str:
        if abs_slope_pct < 2:
            return "plano"
        elif abs_slope_pct < 5:
            return "suave"
        elif abs_slope_pct < 10:
            return "moderado"
        elif abs_slope_pct < 20:
            return "inclinado"
        else:
            return "muito_inclinado"

    segments = []
    class_counts: dict = {
        "plano": 0, "suave": 0, "moderado": 0, "inclinado": 0, "muito_inclinado": 0
    }

    for i in range(1, len(points)):
        p1, p2 = points[i - 1], points[i]
        dist_km = haversine(p1["lat"], p1["lng"], p2["lat"], p2["lng"])
        dist_m = dist_km * 1000
        ele_start = p1.get("ele") or 0.0
        ele_end = p2.get("ele") or 0.0
        ele_diff = ele_end - ele_start
        slope_pct = round((ele_diff / dist_m) * 100, 1) if dist_m > 0 else 0.0
        s_class = _slope_class(abs(slope_pct))
        class_counts[s_class] += 1

        segments.append({
            "segment_index": i - 1,
            "distance_m": round(dist_m, 1),
            "elevation_start": round(ele_start, 1),
            "elevation_end": round(ele_end, 1),
            "slope_pct": slope_pct,
            "slope_class": s_class,
            "surface_type": "terra",
        })

    total = len(segments) or 1
    slope_summary = {
        f"{k}_pct": round(v / total * 100, 1)
        for k, v in class_counts.items()
    }

    return {
        "trail_id": trail_id,
        "trail_name": trail.get("name", ""),
        "total_segments": len(segments),
        "segments": segments,
        "slope_summary": slope_summary,
    }


@trails_router.get("/{trail_id}/export/gpx")
async def export_trail_gpx(trail_id: str):
    """Exporta o trilho em formato GPX 1.1."""
    trail = await _db_holder.db.trails.find_one({"id": trail_id}, {"_id": 0})
    if not trail:
        raise HTTPException(status_code=404, detail="Trilho não encontrado")

    name = trail.get("name", trail_id)
    description = trail.get("description", "")
    points = trail.get("points", [])
    created_at = trail.get("created_at", datetime.now(timezone.utc).isoformat())

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="Portugal Vivo"',
        '     xmlns="http://www.topografix.com/GPX/1/1"',
        '     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
        '     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
        "  <metadata>",
        f"    <name>{_xml_escape(name)}</name>",
        f"    <desc>{_xml_escape(description)}</desc>",
        f"    <time>{created_at}</time>",
        "  </metadata>",
        "  <trk>",
        f"    <name>{_xml_escape(name)}</name>",
        "    <trkseg>",
    ]

    for pt in points:
        lat = pt.get("lat", 0)
        lng = pt.get("lng", 0)
        ele = pt.get("ele")
        if ele is not None:
            lines.append(f'      <trkpt lat="{lat}" lon="{lng}"><ele>{ele}</ele></trkpt>')
        else:
            lines.append(f'      <trkpt lat="{lat}" lon="{lng}"/>')

    lines += [
        "    </trkseg>",
        "  </trk>",
        "</gpx>",
    ]

    gpx_xml = "\n".join(lines)
    return Response(
        content=gpx_xml,
        media_type="application/gpx+xml",
        headers={"Content-Disposition": f"attachment; filename={trail_id}.gpx"},
    )


def _xml_escape(text: str) -> str:
    """Escape special XML characters."""
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&apos;")
    )
