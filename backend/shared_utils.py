"""
Shared utilities - reusable functions for all backend modules.
"""
import math
import os
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request


class DatabaseHolder:
    """Reusable database reference holder to eliminate boilerplate across API modules."""

    def __init__(self, name: str = "module"):
        self._db = None
        self._name = name

    def set(self, database):
        self._db = database

    def get(self):
        if self._db is None:
            raise HTTPException(500, f"Database not initialized for {self._name}")
        return self._db

    @property
    def db(self):
        return self.get()


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two coordinates using Haversine formula."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def project_onto_segment(
    lat: float, lng: float,
    lat1: float, lng1: float,
    lat2: float, lng2: float,
) -> tuple:
    """Project a point onto the segment [(lat1,lng1), (lat2,lng2)].

    Returns (distance_km, t) where `t` in [0, 1] is how far along the segment
    the closest point lies — 0 at the start, 1 at the end. Useful both to
    filter a corridor and to order stops along a route.

    Uses a local equirectangular projection instead of Haversine: over the tens
    of km a corridor spans the error is well under 1%, and this runs inside a
    loop over thousands of POIs.
    """
    mid_lat_rad = math.radians((lat1 + lat2) / 2)
    kx = 111.32 * math.cos(mid_lat_rad)  # km per degree of longitude
    ky = 110.57                          # km per degree of latitude

    dx = (lng2 - lng1) * kx
    dy = (lat2 - lat1) * ky
    qx = (lng - lng1) * kx
    qy = (lat - lat1) * ky

    len_sq = dx * dx + dy * dy
    if len_sq == 0:  # degenerate segment
        return math.sqrt(qx * qx + qy * qy), 0.0

    t = max(0.0, min(1.0, (qx * dx + qy * dy) / len_sq))
    ex = qx - t * dx
    ey = qy - t * dy
    return math.sqrt(ex * ex + ey * ey), t


def corridor_offset_km(
    lat: float, lng: float,
    origin: Dict[str, float],
    destination: Dict[str, float],
) -> tuple:
    """Offset in km from the origin→destination axis, plus progress along it.

    Convenience wrapper over project_onto_segment for the common
    "trip corridor" case.
    """
    return project_onto_segment(
        lat, lng,
        origin["lat"], origin["lng"],
        destination["lat"], destination["lng"],
    )


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two coordinates."""
    return haversine_km(lat1, lon1, lat2, lon2) * 1000


def clamp_pagination(skip: int, limit: int, max_limit: int = 2000) -> tuple:
    """Clamp skip and limit to safe ranges to prevent abuse.
    Returns (safe_skip, safe_limit).
    """
    safe_skip = max(0, skip)
    safe_limit = max(1, min(limit, max_limit))
    return safe_skip, safe_limit


LITE_SOURCE = "thematic_v19"  # bulk-ingested rows (sparse: name + coords only)


def order_enriched_first(items: list, lite_source: str = LITE_SOURCE) -> list:
    """Surface curated content before bulk-ingested 'lite' rows.

    The thematic ingest (ingest_thematic_pois.py) adds sparse rows tagged
    ``source == lite_source`` alongside curated seeds in the same collection.
    This annotates each item with an ``enriched`` flag (True = curated/admin,
    not a lite row) and returns enriched items first, preserving relative order
    so pagination shows the good content up front.
    """
    enriched: list = []
    lite: list = []
    for item in items:
        is_enriched = item.get("source") != lite_source
        item["enriched"] = is_enriched
        (enriched if is_enriched else lite).append(item)
    return enriched + lite


def apply_municipality_filter(query: Dict[str, Any], user: Optional[Any]) -> Dict[str, Any]:
    """Restrict a Mongo query to a single municipality when the caller has one.

    Per CLAUDE.md: geo / list queries MUST filter by ``municipality_id`` when
    the user is authenticated into a municipality. The rule has three layers:

      1. ``user is None`` (anonymous traffic) → no filter; public discovery
         behaviour is preserved.
      2. ``user.is_admin is True`` → no filter; admins see global content.
      3. ``user.municipality_id`` set → ``query["municipality_id"] = <id>``.

    The function returns the (possibly augmented) query dict so it composes
    cleanly with existing query construction:

        query = apply_municipality_filter({"category": "praia"}, current_user)
        cursor = db.heritage_items.find(query)

    Mutating in place (instead of copying) is intentional: every existing
    caller already builds the query as a local dict and discards it after
    the find/aggregate.
    """
    if user is None:
        return query
    if getattr(user, "is_admin", False):
        return query
    municipality_id = getattr(user, "municipality_id", None)
    if not municipality_id:
        return query
    # An explicit X-Municipality-Id header (resolved by TenantMiddleware) or a
    # query-param override should win, so we never clobber an existing key.
    if "municipality_id" in query:
        return query
    query["municipality_id"] = municipality_id
    return query


# ── Client IP (rate-limit bucketing) ──────────────────────────────────────────

_TRUSTED_PROXIES = {
    ip.strip()
    for ip in os.environ.get("TRUSTED_PROXIES", "127.0.0.1,::1").split(",")
    if ip.strip()
}


def client_ip(request: Request) -> str:
    """Return the client IP that rate limiters should bucket on.

    The TCP peer (``request.client.host``) is authoritative — anyone can put
    any value in ``X-Forwarded-For``. The header is only honoured when the
    peer itself is a trusted reverse proxy (the nginx container in
    production), and even then we take the *first* entry, the original client
    per RFC 7239. Without this, a client hitting uvicorn directly could rotate
    the header and evade every rate limiter.
    """
    peer = request.client.host if request.client else ""
    if peer in _TRUSTED_PROXIES:
        forwarded = request.headers.get("x-forwarded-for", "").strip()
        if forwarded:
            return forwarded.split(",")[0].strip() or peer or "unknown"
    return peer or "unknown"
