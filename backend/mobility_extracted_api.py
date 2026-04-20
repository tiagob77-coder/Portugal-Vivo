"""
Mobility API - Mobility endpoints extracted from server.py.
Includes transport, tides, waves, occupancy, metro, trains, ferries.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from services.mobility_service import mobility_service
from mobility_data import (
    METRO_LINES, METRO_STATIONS, METRO_FREQUENCIES, get_metro_frequency,
    TRAIN_LINES, TRAIN_STATIONS, ALFA_PENDULAR_SCHEDULE,
    FERRY_ROUTES, get_ferry_frequency,
    DATA_FRESHNESS, LAST_UPDATED,
)

from shared_utils import DatabaseHolder

mobility_extracted_router = APIRouter()

_db_holder = DatabaseHolder("mobility")
set_mobility_extracted_db = _db_holder.set


class MobilityRequest(BaseModel):
    lat: float
    lng: float
    radius_km: float = 1.0
    include_tides: bool = True
    include_waves: bool = True


@mobility_extracted_router.post("/mobility/snapshot")
async def get_mobility_snapshot(request: MobilityRequest):
    """Get complete mobility snapshot for a location"""
    snapshot = await mobility_service.get_mobility_snapshot(
        lat=request.lat,
        lng=request.lng,
        radius_km=request.radius_km,
        include_tides=request.include_tides,
        include_waves=request.include_waves
    )
    return snapshot.dict()


@mobility_extracted_router.get("/mobility/transport")
async def get_transport_info(lat: float, lng: float, radius_m: int = 500):
    """Get public transport info near a location"""
    stops = await mobility_service.carris.get_stops(lat, lng, radius_m)

    departures = []
    for stop in stops[:5]:
        stop_deps = await mobility_service.carris.get_stop_departures(stop.external_id, limit=3)
        departures.extend([d.dict() for d in stop_deps])

    return {
        "stops": [s.dict() for s in stops],
        "next_departures": sorted(departures, key=lambda x: x.get("scheduled_time", ""))[:10]
    }


@mobility_extracted_router.get("/mobility/tides")
async def get_tide_info(lat: float, lng: float):
    """Get tide information for coastal locations - NOW USES REAL CALCULATIONS"""
    from services.tide_service import real_tide_service
    conditions = await real_tide_service.get_current_tide(lat, lng)
    if not conditions:
        return {"available": False, "message": "Sem dados de mare para esta localizacao"}

    return {
        "available": True,
        "source": conditions.get("source"),
        "api_type": conditions.get("api_type"),
        "station": conditions.get("station"),
        "current_height_m": conditions.get("current", {}).get("height_m"),
        "current_state": conditions.get("current", {}).get("state"),
        "next_high_tide": conditions.get("next_high_tide"),
        "next_low_tide": conditions.get("next_low_tide"),
        "tide_type": conditions.get("tide_type"),
        "moon_phase": conditions.get("moon_phase"),
        "timestamp": conditions.get("timestamp")
    }


@mobility_extracted_router.get("/mobility/waves")
async def get_wave_info(lat: float, lng: float):
    """Get wave conditions for surf spots"""
    conditions = await mobility_service.waves.get_wave_conditions(lat, lng)
    if not conditions:
        return {"available": False, "message": "Sem dados de ondulacao para esta localizacao"}

    return {
        "available": True,
        "station": conditions.station_name,
        "wave_height_m": conditions.wave_height_meters,
        "wave_period_s": conditions.wave_period_seconds,
        "wave_direction": conditions.wave_direction_cardinal,
        "surf_quality": conditions.surf_quality,
        "water_temp_c": conditions.water_temp_celsius
    }


@mobility_extracted_router.get("/mobility/occupancy/{item_id}")
async def get_occupancy_estimate(item_id: str):
    """Get estimated occupancy for a location"""
    item = await _db_holder.db.heritage_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    location = item.get("location")
    if not location:
        return {"available": False, "message": "Localizacao nao disponivel"}

    occupancy = await mobility_service.occupancy.estimate_occupancy(
        location_id=item_id,
        location_type=item.get("category", "attraction"),
        lat=location.get("lat", 0),
        lng=location.get("lng", 0)
    )

    occupancy_dict = occupancy.dict()
    occupancy_dict["location_name"] = item.get("name", "")

    return occupancy_dict


# ========================
# EXPANDED MOBILITY ENDPOINTS (datos de mobility_data.py)
# ========================

@mobility_extracted_router.get("/mobility/metro/lines")
async def get_metro_lines():
    """Get Metro Lisboa lines with schedule info"""
    return {
        "lines": METRO_LINES,
        "total_stations": len(METRO_STATIONS),
        "data_freshness": DATA_FRESHNESS,
        "last_updated": LAST_UPDATED,
        "official_url": "https://www.metrolisboa.pt",
    }


@mobility_extracted_router.get("/mobility/metro/stations")
async def get_metro_stations(line: Optional[str] = None):
    """Get Metro Lisboa stations, optionally filtered by line"""
    stations = METRO_STATIONS
    if line:
        stations = [s for s in stations if line in s["lines"]]
    return {
        "stations": stations,
        "total": len(stations),
        "data_freshness": DATA_FRESHNESS,
        "last_updated": LAST_UPDATED,
    }


@mobility_extracted_router.get("/mobility/metro/schedule/{line_id}")
async def get_metro_schedule(line_id: str):
    """Get Metro schedule for a specific line with real frequency bands"""
    line = next((l for l in METRO_LINES if l["id"] == line_id), None)
    if not line:
        raise HTTPException(status_code=404, detail="Linha nao encontrada")

    now = datetime.now()
    hour = now.hour
    is_weekend = now.weekday() >= 5
    day_type = "weekend" if is_weekend else "weekday"
    freq_info = get_metro_frequency(hour)
    stations = [s["name"] for s in METRO_STATIONS if line_id in s["lines"]]

    return {
        "line": line,
        "stations": stations,
        "stations_count": len(stations),
        "first_train": line["first_train"][day_type],
        "last_train": line["last_train"][day_type],
        "current_frequency": freq_info,
        "all_frequencies": {k: {"min": v["min"], "period": v["label"]} for k, v in METRO_FREQUENCIES.items()},
        "day_type": day_type,
        "status": "operational",
        "data_freshness": DATA_FRESHNESS,
        "last_updated": LAST_UPDATED,
        "official_url": "https://www.metrolisboa.pt",
        "timestamp": now.isoformat(),
    }


@mobility_extracted_router.get("/mobility/trains/lines")
async def get_train_lines(line_type: Optional[str] = None):
    """Get CP train lines (urbano / longo_curso)"""
    lines = TRAIN_LINES
    if line_type:
        lines = [l for l in lines if l["type"] == line_type]
    return {
        "lines": lines,
        "total": len(lines),
        "data_freshness": DATA_FRESHNESS,
        "last_updated": LAST_UPDATED,
        "disclaimer": "Horarios aproximados. Consulte cp.pt para informacao atualizada.",
        "official_url": "https://www.cp.pt",
    }


@mobility_extracted_router.get("/mobility/trains/stations")
async def get_train_stations(city: Optional[str] = None, line: Optional[str] = None):
    """Get train stations, filterable by city or line"""
    stations = TRAIN_STATIONS
    if city:
        stations = [s for s in stations if s["city"].lower() == city.lower()]
    if line:
        stations = [s for s in stations if line in s["lines"]]
    return {
        "stations": stations,
        "total": len(stations),
        "data_freshness": DATA_FRESHNESS,
        "last_updated": LAST_UPDATED,
    }


@mobility_extracted_router.get("/mobility/trains/schedule")
async def get_train_schedule(origin: str, destination: str, line: Optional[str] = None):
    """Get train schedule between stations with realistic data"""
    now = datetime.now()
    is_weekend = now.weekday() >= 5

    long_distance_stations = {"lisboa", "porto", "braga", "faro", "coimbra", "aveiro", "evora", "beja", "guarda"}
    origin_lower = origin.lower()
    dest_lower = destination.lower()
    is_long_distance = any(c in origin_lower for c in long_distance_stations) and any(c in dest_lower for c in long_distance_stations)

    if is_long_distance:
        relevant = [
            t for t in ALFA_PENDULAR_SCHEDULE
            if any(c in t["origin"].lower() for c in [origin_lower[:4]]) or
               any(c in t["destination"].lower() for c in [dest_lower[:4]])
        ]
        if not relevant:
            relevant = ALFA_PENDULAR_SCHEDULE[:5]
        return {
            "origin": origin,
            "destination": destination,
            "type": "longo_curso",
            "trains": relevant,
            "data_freshness": DATA_FRESHNESS,
            "last_updated": LAST_UPDATED,
            "disclaimer": "Horarios aproximados. Consulte cp.pt para horarios atualizados e reservas.",
            "official_url": "https://www.cp.pt",
            "timestamp": now.isoformat(),
        }

    matching_line = next((l for l in TRAIN_LINES if l["type"] == "urbano" and (
        line == l["id"] or
        any(t.lower() in origin_lower or t.lower() in dest_lower for t in l["terminals"])
    )), None)

    if matching_line:
        freq_key = "fds" if is_weekend else ("ponta" if (7 <= now.hour <= 9 or 17 <= now.hour <= 19) else "normal")
        freq = matching_line["frequency_min"].get(freq_key, 20)
        day_type = "weekend" if is_weekend else "weekday"
        next_deps = []
        base_min = ((now.minute // freq) + 1) * freq
        for i in range(6):
            dep_min = base_min + i * freq
            dep_hour = now.hour + (dep_min // 60)
            dep_min = dep_min % 60
            if dep_hour < 24:
                next_deps.append(f"{dep_hour:02d}:{dep_min:02d}")

        return {
            "origin": origin,
            "destination": destination,
            "type": "urbano",
            "line": matching_line,
            "next_departures": next_deps,
            "current_frequency_min": freq,
            "first_train": matching_line["first_train"][day_type],
            "last_train": matching_line["last_train"][day_type],
            "duration_min": matching_line["duration_min"],
            "price_range": matching_line["price_range"],
            "day_type": day_type,
            "data_freshness": DATA_FRESHNESS,
            "last_updated": LAST_UPDATED,
            "disclaimer": "Horarios aproximados. Consulte cp.pt para informacao atualizada.",
            "official_url": matching_line["official_url"],
            "timestamp": now.isoformat(),
        }

    return {
        "origin": origin,
        "destination": destination,
        "type": "desconhecido",
        "trains": [],
        "message": f"Linha entre {origin} e {destination} nao encontrada nos dados estaticos.",
        "data_freshness": DATA_FRESHNESS,
        "last_updated": LAST_UPDATED,
        "disclaimer": "Consulte cp.pt para horarios atualizados.",
        "official_url": "https://www.cp.pt",
        "timestamp": now.isoformat(),
    }


@mobility_extracted_router.get("/mobility/ferries")
async def get_ferry_routes():
    """Get Transtejo/Soflusa ferry routes with real schedules"""
    now = datetime.now()
    is_weekend = now.weekday() >= 5
    routes_with_freq = []
    for route in FERRY_ROUTES:
        freq = get_ferry_frequency(route, now.hour, is_weekend)
        routes_with_freq.append({
            **route,
            "current_frequency_min": freq,
            "day_type": "weekend" if is_weekend else "weekday",
        })
    return {
        "routes": routes_with_freq,
        "total": len(FERRY_ROUTES),
        "data_freshness": DATA_FRESHNESS,
        "last_updated": LAST_UPDATED,
    }


@mobility_extracted_router.get("/mobility/ferries/{route_id}/schedule")
async def get_ferry_schedule(route_id: str):
    """Get real ferry schedule with weekday/weekend variation"""
    route = next((r for r in FERRY_ROUTES if r["id"] == route_id), None)
    if not route:
        raise HTTPException(status_code=404, detail="Rota nao encontrada")

    now = datetime.now()
    is_weekend = now.weekday() >= 5
    day_type = "weekend" if is_weekend else "weekday"
    schedule = route[day_type]
    freq = get_ferry_frequency(route, now.hour, is_weekend)

    next_deps = []
    base_min = ((now.minute // freq) + 1) * freq
    for i in range(6):
        dep_min = base_min + i * freq
        dep_hour = now.hour + (dep_min // 60)
        dep_min = dep_min % 60
        if dep_hour < 24:
            next_deps.append(f"{dep_hour:02d}:{dep_min:02d}")

    return {
        "route": route,
        "day_type": day_type,
        "first_departure": schedule["first"],
        "last_departure": schedule["last"],
        "current_frequency_min": freq,
        "frequencies": schedule["frequency_min"],
        "next_departures": next_deps,
        "duration_min": route["duration_min"],
        "price": route["price"],
        "status": "operational",
        "data_freshness": DATA_FRESHNESS,
        "last_updated": LAST_UPDATED,
        "official_url": route["official_url"],
        "timestamp": now.isoformat(),
    }


@mobility_extracted_router.get("/mobility/nearby")
async def get_nearby_transport(lat: float, lng: float, radius_m: int = 1000):
    """Get all nearby transport options"""
    bus_stops = await mobility_service.carris.get_stops(lat, lng, min(radius_m, 500))

    nearby_metro = []
    for station in METRO_STATIONS:
        dist = ((station["lat"] - lat) ** 2 + (station["lng"] - lng) ** 2) ** 0.5 * 111000
        if dist <= radius_m:
            nearby_metro.append({**station, "distance_m": int(dist), "type": "metro"})

    nearby_trains = []
    for station in TRAIN_STATIONS:
        dist = ((station["lat"] - lat) ** 2 + (station["lng"] - lng) ** 2) ** 0.5 * 111000
        if dist <= radius_m:
            nearby_trains.append({**station, "distance_m": int(dist), "type": "train"})

    nearby_ferries = []
    for route in FERRY_ROUTES:
        origin = route["origin"]
        dist = ((origin["lat"] - lat) ** 2 + (origin["lng"] - lng) ** 2) ** 0.5 * 111000
        if dist <= radius_m:
            nearby_ferries.append({
                "id": route["id"], "name": route["name"], "operator": route["operator"],
                "duration_min": route["duration_min"], "distance_m": int(dist), "type": "ferry",
            })

    return {
        "location": {"lat": lat, "lng": lng},
        "radius_m": radius_m,
        "bus_stops": [{"name": s.name, "distance_m": 0, "type": "bus"} for s in bus_stops[:10]],
        "metro_stations": sorted(nearby_metro, key=lambda x: x["distance_m"])[:5],
        "train_stations": sorted(nearby_trains, key=lambda x: x["distance_m"])[:3],
        "ferry_terminals": sorted(nearby_ferries, key=lambda x: x["distance_m"])[:3],
        "data_freshness": DATA_FRESHNESS,
        "last_updated": LAST_UPDATED,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
