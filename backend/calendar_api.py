"""
Calendar API - Cultural events, festivals, and calendar endpoints.
Extracted from server.py.
"""
import unicodedata
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone

from shared_utils import DatabaseHolder, clamp_pagination

import logging
logger = logging.getLogger(__name__)

calendar_router = APIRouter(tags=["Calendar"])

_db_holder = DatabaseHolder("calendar")
set_calendar_db = _db_holder.set


def _normalize_region_filter(region: str) -> str:
    """Normalize region string for accent-insensitive comparison."""
    return unicodedata.normalize('NFD', region.lower()).encode('ascii', 'ignore').decode('ascii')


async def _get_calendar_events() -> list:
    """Fetch calendar events from both legacy collection and dynamic agenda events."""
    # Legacy seed_calendar events
    legacy = await _db_holder.db.calendar_events.find({}, {"_id": 0}).to_list(200)

    # Dynamic agenda events (from public_events_service)
    agenda = await _db_holder.db.events.find({}, {"_id": 0}).to_list(5000)

    # Merge: convert agenda events to calendar format and combine
    merged = list(legacy)
    seen_ids = {e.get("id") for e in legacy}

    for evt in agenda:
        if evt.get("id") in seen_ids:
            continue
        # Convert agenda format to calendar format
        month = evt.get("month")
        day_start = evt.get("day_start", 1)
        day_end = evt.get("day_end", day_start)
        if month:
            merged.append({
                "id": evt["id"],
                "name": evt.get("name", ""),
                "date_start": f"{month:02d}-{day_start:02d}",
                "date_end": f"{month:02d}-{day_end:02d}",
                "category": evt.get("type", "festas"),
                "region": (evt.get("region") or "").lower().replace("\u00e1", "a").replace("\u00e7", "c"),
                "description": evt.get("description", ""),
                "source": evt.get("source", "curated"),
                "has_tickets": bool(evt.get("price") or evt.get("has_tickets")),
                "ticket_url": evt.get("ticket_url"),
            })
        seen_ids.add(evt.get("id"))

    return merged


@calendar_router.get("/calendar", tags=["Calendar"])
async def get_calendar_events(
    month: Optional[int] = None,
    category: Optional[str] = None,
    region: Optional[str] = None,
):
    """Get calendar events with optional filters by month, category, and region."""
    events = await _get_calendar_events()

    if month:
        month_str = f"{month:02d}"
        events = [e for e in events if e.get("date_start", "").startswith(month_str) or e.get("date_end", "").startswith(month_str)]
    if category:
        events = [e for e in events if e.get("category", "").lower() == category.lower()]
    if region:
        region_n = _normalize_region_filter(region)
        events = [e for e in events if _normalize_region_filter(e.get("region", "")) == region_n]

    return events


@calendar_router.get("/calendar/upcoming", tags=["Calendar"])
async def get_upcoming_events(
    limit: int = 5,
    category: Optional[str] = None,
    region: Optional[str] = None,
):
    """Get upcoming events based on current date, with optional category/region filters."""
    _, limit = clamp_pagination(0, limit, max_limit=50)
    today = datetime.now(timezone.utc)
    current_month = today.month
    current_day = today.day
    current_date_str = f"{current_month:02d}-{current_day:02d}"

    all_events = await _get_calendar_events()

    if category:
        all_events = [e for e in all_events if e.get("category", "").lower() == category.lower()]
    if region:
        region_n = _normalize_region_filter(region)
        all_events = [e for e in all_events if _normalize_region_filter(e.get("region", "")) == region_n]

    upcoming = []
    for event in all_events:
        ds = event.get("date_start", "")
        de = event.get("date_end", "")
        if ds >= current_date_str or de >= current_date_str:
            upcoming.append(event)
        elif current_month >= 11 and ds.startswith("01"):
            upcoming.append(event)

    upcoming.sort(key=lambda x: x.get("date_start", ""))
    return upcoming[:limit]


@calendar_router.get("/calendar/month/{month}", tags=["Calendar"])
async def get_events_by_month(
    month: int,
    category: Optional[str] = None,
    region: Optional[str] = None,
):
    """Get events for a specific month with optional category/region filters."""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")

    month_str = f"{month:02d}"
    all_events = await _get_calendar_events()
    events = [e for e in all_events if e.get("date_start", "").startswith(month_str)]

    if category:
        events = [e for e in events if e.get("category", "").lower() == category.lower()]
    if region:
        region_n = _normalize_region_filter(region)
        events = [e for e in events if _normalize_region_filter(e.get("region", "")) == region_n]

    return events
