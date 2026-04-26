"""
Shared utilities - reusable functions for all backend modules.
"""
import math
from typing import Any, Dict, Optional

from fastapi import HTTPException


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
