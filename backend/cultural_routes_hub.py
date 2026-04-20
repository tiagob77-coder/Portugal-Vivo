"""
Cultural Routes Hub — Enrichment Service
=========================================
Enriches cultural routes at startup and on-demand by cross-referencing:
  - heritage_items  (POIs within 15 km of each route stop)
  - events          (upcoming events matching route region / festivals)
  - trails          (walking trails connecting route stops)

Results are cached in `cultural_routes_enriched` (TTL 7 days).

Public API used by cultural_routes_api.py:
  - bootstrap_enrichment(db)          → startup task (background, non-critical)
  - get_enriched(db, route_id, seed)  → enriched route (cache-first)
  - get_spotlight(db, seed)           → route of the day (deterministic)
  - get_hub_dashboard(db, seed, ...)  → full hub overview
"""
from __future__ import annotations

import asyncio
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

# ─── Constants ────────────────────────────────────────────────────────────────

_ENRICHED_COL = "cultural_routes_enriched"
_POI_RADIUS_KM = 15.0
_TRAIL_RADIUS_KM = 25.0
_MAX_STOPS_ENRICH = 6      # stops per route to avoid overloading DB
_TTL_DAYS = 7

# Mood → preferred route families (ordered by relevance)
MOOD_FAMILIES: Dict[str, List[str]] = {
    "aventureiro":  ["musicais", "festas", "integradas"],
    "gastronomo":   ["integradas", "festas"],
    "cultural":     ["musicais", "danca", "trajes", "instrumentos", "integradas"],
    "familia":      ["festas", "danca"],
    "romaria":      ["festas", "integradas"],
    "musica":       ["musicais"],
    "danca":        ["danca", "festas"],
    "historia":     ["integradas", "trajes", "instrumentos"],
    "natureza":     ["integradas", "festas"],
    "patrimonio":   ["integradas", "trajes", "instrumentos"],
}


# ─── Haversine ───────────────────────────────────────────────────────────────

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _bbox(lat: float, lng: float, radius_km: float):
    """Returns (lat_delta, lng_delta) for a bounding-box pre-filter."""
    lat_d = radius_km / 111.0
    lng_d = radius_km / max(111.0 * math.cos(math.radians(lat)), 0.1)
    return lat_d, lng_d


# ─── Cross-module fetchers ────────────────────────────────────────────────────

async def _pois_near_stop(
    db, lat: float, lng: float,
    radius_km: float = _POI_RADIUS_KM,
    limit: int = 10,
) -> List[Dict]:
    """POIs from heritage_items within radius_km of a route stop."""
    if db is None or not lat or not lng:
        return []
    try:
        lat_d, lng_d = _bbox(lat, lng, radius_km)
        candidates = await db.heritage_items.find(
            {
                "lat": {"$gte": lat - lat_d, "$lte": lat + lat_d},
                "lng": {"$gte": lng - lng_d, "$lte": lng + lng_d},
            },
            {"_id": 0, "id": 1, "name": 1, "category": 1,
             "lat": 1, "lng": 1, "region": 1, "description": 1},
        ).to_list(300)

        refined = []
        for poi in candidates:
            dist = _haversine(lat, lng, poi.get("lat", 0), poi.get("lng", 0))
            if dist <= radius_km:
                refined.append({**poi, "distance_km": round(dist, 2)})

        refined.sort(key=lambda x: x.get("distance_km", 9999))
        return refined[:limit]
    except Exception:
        return []


async def _events_for_route(db, route: Dict, limit: int = 8) -> List[Dict]:
    """Events from `events` collection relevant to this route (region + festivals)."""
    if db is None:
        return []
    try:
        region = route.get("region", "")
        festivals = route.get("festivals", [])
        best_months = set(route.get("best_months", []))
        current_month = datetime.now(timezone.utc).month

        query: Dict[str, Any] = {}
        if region:
            query["region"] = {"$regex": region[:10], "$options": "i"}

        events = await db.events.find(
            query,
            {"_id": 0, "id": 1, "name": 1, "date_start": 1, "date_end": 1,
             "category": 1, "region": 1, "description": 1, "month": 1},
        ).to_list(limit * 4)

        scored: List[tuple] = []
        for ev in events:
            score = 0
            ev_name_lower = ev.get("name", "").lower()
            for fest in festivals:
                words = fest.lower().split()[:3]
                if any(w in ev_name_lower for w in words if len(w) > 3):
                    score += 3
            ev_month = ev.get("month") or 0
            if ev_month in best_months:
                score += 2
            if ev_month == current_month:
                score += 1
            scored.append((score, ev))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [e for _, e in scored[:limit]]
    except Exception:
        return []


async def _trails_near_route(
    db, route: Dict,
    radius_km: float = _TRAIL_RADIUS_KM,
    limit: int = 5,
) -> List[Dict]:
    """Trails from `trails` collection near the route centroid."""
    if db is None:
        return []
    try:
        stops = route.get("stops", [])
        if stops:
            lat = sum(s.get("lat", 0) for s in stops) / len(stops)
            lng = sum(s.get("lng", 0) for s in stops) / len(stops)
        else:
            lat = route.get("lat", 39.5)
            lng = route.get("lng", -8.0)

        lat_d, lng_d = _bbox(lat, lng, radius_km)

        trails = await db.trails.find(
            {
                "$or": [
                    {"start_lat": {"$gte": lat - lat_d, "$lte": lat + lat_d},
                     "start_lng": {"$gte": lng - lng_d, "$lte": lng + lng_d}},
                    {"lat": {"$gte": lat - lat_d, "$lte": lat + lat_d},
                     "lng": {"$gte": lng - lng_d, "$lte": lng + lng_d}},
                ]
            },
            {"_id": 0, "id": 1, "name": 1, "distance_km": 1,
             "difficulty": 1, "elevation_gain": 1},
        ).to_list(limit * 2)

        return trails[:limit]
    except Exception:
        return []


# ─── Core enrichment ─────────────────────────────────────────────────────────

async def _enrich_single(db, route: Dict) -> Dict:
    """
    Enriches a single route with cross-module data and writes to
    `cultural_routes_enriched`. Returns the enriched document.
    """
    route_id = str(route.get("_id", route.get("id", "")))
    stops = route.get("stops", [])

    # Aggregate POIs across all stops (deduplicate by id)
    all_pois: Dict[str, Any] = {}
    for stop in stops[:_MAX_STOPS_ENRICH]:
        pois = await _pois_near_stop(db, stop.get("lat", 0), stop.get("lng", 0))
        for poi in pois:
            key = str(poi.get("id", poi.get("name", "")))
            if key and key not in all_pois:
                all_pois[key] = {**poi, "near_stop": stop.get("name", "")}

    events = await _events_for_route(db, route)
    trails = await _trails_near_route(db, route)

    n_conn = len(all_pois) + len(events) + len(trails)
    dynamic_iq = min(100, route.get("iq_score", 50) + int(n_conn * 0.5))

    enriched: Dict[str, Any] = {
        "route_id":         route_id,
        "route_name":       route.get("name"),
        "family":           route.get("family"),
        "region":           route.get("region"),
        "pois_nearby":      list(all_pois.values()),
        "events_upcoming":  events,
        "trails_nearby":    trails,
        "connections_count": n_conn,
        "dynamic_iq_score": dynamic_iq,
        "enriched_at":      datetime.now(timezone.utc).isoformat(),
        # TTL: MongoDB will delete 0 s after this datetime = in 7 days
        "expires_at":       datetime.now(timezone.utc) + timedelta(days=_TTL_DAYS),
    }

    if db is not None:
        try:
            await db[_ENRICHED_COL].update_one(
                {"route_id": route_id},
                {"$set": enriched},
                upsert=True,
            )
        except Exception:
            pass

    return enriched


# ─── Public service API ───────────────────────────────────────────────────────

async def bootstrap_enrichment(db) -> int:
    """
    Called at startup as a background task.
    Ensures indexes exist and enriches all routes (non-critical — errors are swallowed).
    """
    if db is None:
        return 0
    try:
        await db[_ENRICHED_COL].create_index("route_id", unique=True)
        await db[_ENRICHED_COL].create_index("family")
        await db[_ENRICHED_COL].create_index(
            "expires_at", expireAfterSeconds=0,
            name="ttl_expires_at",
        )
    except Exception:
        pass

    try:
        routes = await db.cultural_routes.find({}).to_list(500)
    except Exception:
        routes = []

    if not routes:
        # Seed routes (imported lazily to avoid circular import)
        try:
            from cultural_routes_api import SEED_ROUTES  # noqa: PLC0415
            routes = [dict(r) for r in SEED_ROUTES]
        except Exception:
            return 0

    count = 0
    for route in routes:
        try:
            await _enrich_single(db, route)
            count += 1
            await asyncio.sleep(0.05)  # yield between routes
        except Exception:
            pass

    return count


async def get_enriched(
    db, route_id: str, routes_seed: List[Dict]
) -> Optional[Dict]:
    """
    Returns enriched route.  Cache-first: reads cultural_routes_enriched;
    falls back to live computation if missing.
    """
    if db is not None:
        try:
            cached = await db[_ENRICHED_COL].find_one(
                {"route_id": route_id}, {"_id": 0}
            )
            if cached:
                # Serialize non-JSON datetime
                if isinstance(cached.get("expires_at"), datetime):
                    cached["expires_at"] = cached["expires_at"].isoformat()
                return cached
        except Exception:
            pass

    # Find base route
    route: Optional[Dict] = None
    if db is not None:
        try:
            route = await db.cultural_routes.find_one(
                {"$or": [{"_id": route_id}, {"id": route_id}]}
            )
        except Exception:
            pass

    if route is None:
        for r in routes_seed:
            if str(r.get("_id", r.get("id", ""))) == route_id:
                route = dict(r)
                break

    if route is None:
        return None

    result = await _enrich_single(db, route)
    if isinstance(result.get("expires_at"), datetime):
        result["expires_at"] = result["expires_at"].isoformat()
    return result


async def get_spotlight(db, routes_seed: List[Dict]) -> Optional[Dict]:
    """
    Route of the day — deterministic rotation by day-of-year across
    premium / high-iq routes.
    """
    routes: List[Dict] = []
    if db is not None:
        try:
            routes = await db.cultural_routes.find(
                {},
                {"_id": 1, "id": 1, "name": 1, "family": 1, "region": 1,
                 "iq_score": 1, "premium": 1, "description_short": 1,
                 "lat": 1, "lng": 1, "best_months": 1, "unesco": 1,
                 "stops": 1, "festivals": 1, "best_months": 1},
            ).to_list(300)
        except Exception:
            pass

    if not routes:
        routes = [dict(r) for r in routes_seed]

    if not routes:
        return None

    # Prefer premium / iq ≥ 90
    premium = [r for r in routes if r.get("iq_score", 0) >= 90 or r.get("premium")]
    pool = premium if premium else routes

    day_idx = datetime.now(timezone.utc).timetuple().tm_yday % len(pool)
    chosen = dict(pool[day_idx])
    chosen["id"] = str(chosen.pop("_id", chosen.get("id", "")))

    route_id = chosen["id"]

    # Attach enrichment summary (best-effort)
    enriched = await get_enriched(db, route_id, routes_seed)
    if enriched:
        chosen["pois_nearby_count"] = len(enriched.get("pois_nearby", []))
        chosen["events_upcoming_count"] = len(enriched.get("events_upcoming", []))
        chosen["trails_nearby_count"] = len(enriched.get("trails_nearby", []))
        chosen["dynamic_iq_score"] = enriched.get("dynamic_iq_score", chosen.get("iq_score"))

    chosen["spotlight_date"] = datetime.now(timezone.utc).date().isoformat()
    return chosen


async def get_hub_dashboard(
    db,
    routes_seed: List[Dict],
    month: Optional[int] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> Dict:
    """
    Full hub overview:
      spotlight   — route of the day
      season_picks — best routes for current/requested month
      nearby_routes — closest routes if geo provided
      family_stats  — count per family
      unesco_routes — certified UNESCO routes
    """
    current_month = month or datetime.now(timezone.utc).month

    routes: List[Dict] = []
    if db is not None:
        try:
            routes = await db.cultural_routes.find({}).to_list(500)
        except Exception:
            pass
    if not routes:
        routes = [dict(r) for r in routes_seed]

    spotlight = await get_spotlight(db, routes_seed)

    # Season picks
    season_picks = []
    for r in routes:
        if current_month in r.get("best_months", []):
            season_picks.append({
                "id":    str(r.get("_id", r.get("id", ""))),
                "name":  r.get("name"),
                "family": r.get("family"),
                "region": r.get("region"),
                "iq_score": r.get("iq_score", 0),
                "unesco": r.get("unesco", False),
                "description_short": r.get("description_short"),
            })
    season_picks.sort(key=lambda x: x.get("iq_score", 0), reverse=True)

    # Family breakdown
    family_stats: Dict[str, int] = {}
    for r in routes:
        f = r.get("family", "unknown")
        family_stats[f] = family_stats.get(f, 0) + 1

    # UNESCO subset
    unesco_routes = [
        {
            "id": str(r.get("_id", r.get("id", ""))),
            "name": r.get("name"),
            "region": r.get("region"),
            "unesco_label": r.get("unesco_label"),
        }
        for r in routes if r.get("unesco")
    ]

    # Nearby routes (if geo provided)
    nearby: List[Dict] = []
    if lat and lng:
        for r in routes:
            dist = _haversine(lat, lng, r.get("lat", 0), r.get("lng", 0))
            if dist <= 150.0:
                nearby.append({
                    "id": str(r.get("_id", r.get("id", ""))),
                    "name": r.get("name"),
                    "family": r.get("family"),
                    "distance_km": round(dist, 1),
                })
        nearby.sort(key=lambda x: x.get("distance_km", 9999))
        nearby = nearby[:6]

    return {
        "spotlight":      spotlight,
        "season_picks":   season_picks[:8],
        "nearby_routes":  nearby,
        "family_stats":   family_stats,
        "unesco_routes":  unesco_routes,
        "total_routes":   len(routes),
        "current_month":  current_month,
        "generated_at":   datetime.now(timezone.utc).isoformat(),
    }


async def score_and_discover(
    db,
    routes_seed: List[Dict],
    mood: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    month: Optional[int] = None,
    limit: int = 10,
) -> List[Dict]:
    """
    Scores routes by mood + geo proximity + season + UNESCO and returns
    the top `limit` results for the /discover endpoint.
    """
    routes: List[Dict] = []
    if db is not None:
        try:
            routes = await db.cultural_routes.find({}).to_list(500)
        except Exception:
            pass
    if not routes:
        routes = [dict(r) for r in routes_seed]

    preferred_families = MOOD_FAMILIES.get(mood or "cultural", [])
    current_month = month or datetime.now(timezone.utc).month

    scored: List[tuple] = []
    for r in routes:
        score = 0.0

        # Mood bonus
        family = r.get("family", "")
        if preferred_families:
            if family == preferred_families[0]:
                score += 5
            elif family in preferred_families:
                score += 3

        # Season bonus
        if current_month in r.get("best_months", []):
            score += 4

        # UNESCO / premium bonus
        if r.get("unesco"):
            score += 3
        if r.get("premium"):
            score += 1

        # IQ score (normalized to 0-3 range)
        score += r.get("iq_score", 50) / 33.0

        # Geo proximity bonus (max +5)
        if lat and lng:
            dist = _haversine(lat, lng, r.get("lat", 0), r.get("lng", 0))
            if dist < 200:
                score += max(0, 5 - dist / 40.0)

        scored.append((score, r))

    scored.sort(key=lambda x: x[0], reverse=True)

    results = []
    for _, r in scored[:limit]:
        results.append({
            "id":    str(r.get("_id", r.get("id", ""))),
            "name":  r.get("name"),
            "family": r.get("family"),
            "region": r.get("region"),
            "iq_score": r.get("iq_score", 0),
            "dynamic_iq": r.get("iq_score", 0),  # enriched later if needed
            "unesco": r.get("unesco", False),
            "unesco_label": r.get("unesco_label"),
            "description_short": r.get("description_short"),
            "best_months": r.get("best_months", []),
            "stops_count": len(r.get("stops", [])),
            "gastronomy_count": len(r.get("gastronomy", [])),
            "lat": r.get("lat"),
            "lng": r.get("lng"),
        })

    return results
