"""
Portugal Vivo — Content Metrics API
Quality signals and engagement metrics for the "Conteúdo Vivo" system.

Tracks:
  - Content engagement: listen_time, depth_switches, "Quero saber mais" clicks
  - Sharing & saves: shares, saves, link_opens
  - Quality signals: generic_content_flags, low_quality_reports
  - Micro-story performance: swipe_through, audio_plays, story_saves
  - Profile effectiveness: how well content matched cognitive profile

v1 endpoints:
  POST /metrics/content/event          — track a single content interaction event
  POST /metrics/content/batch          — batch event tracking (mobile, low-latency)
  GET  /metrics/content/{poi_id}       — aggregated metrics for a POI's content
  GET  /metrics/content/leaderboard    — top performing POIs by engagement
  GET  /metrics/content/quality-alerts — POIs flagged for low quality content
  GET  /metrics/dashboard              — platform-wide content health dashboard
  POST /metrics/content/flag           — flag content as generic/inaccurate (user report)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth_api import get_current_user, require_auth
from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

metrics_router = APIRouter(prefix="/metrics", tags=["Content Metrics"])

_db_holder = DatabaseHolder("content_metrics")
set_content_metrics_db = _db_holder.set
_get_db = _db_holder.get

# ──────────────────────────────────────────────────────────────────────────────
# EVENT TAXONOMY
# ──────────────────────────────────────────────────────────────────────────────

VALID_EVENT_TYPES = {
    # Depth & reading
    "depth_view",           # User opened content at a given depth level
    "depth_switch",         # User switched between snackable/história/enciclopédico
    "read_complete",        # User reached ≥80% scroll of current depth
    "listen_start",         # Audio guide started
    "listen_complete",      # Audio guide completed (≥90%)
    "listen_pause",         # Audio paused (with timestamp)
    # Engagement signals
    "quero_saber_mais",     # "Quero saber mais" CTA clicked → depth upgrade
    "share",                # Content shared (WhatsApp, link, etc.)
    "save",                 # Content saved to favorites/collection
    "link_open",            # External link opened from content
    # Micro-story specific
    "story_view",           # Micro-story card appeared in feed
    "story_swipe_through",  # User swiped past without engaging
    "story_save",           # Micro-story saved
    "story_audio_play",     # Audio played on micro-story
    # Quality / negative signals
    "flag_generic",         # User flagged content as generic/boring
    "flag_inaccurate",      # User flagged content as factually incorrect
    "flag_outdated",        # User flagged content as outdated
    "skip",                 # User immediately skipped/closed content
}

# Weights for engagement score calculation (positive = +, negative = -)
EVENT_WEIGHTS: Dict[str, float] = {
    "depth_view": 1.0,
    "depth_switch": 2.0,        # Signals curiosity
    "read_complete": 5.0,
    "listen_start": 3.0,
    "listen_complete": 8.0,
    "listen_pause": 1.0,
    "quero_saber_mais": 6.0,    # Strong positive signal
    "share": 10.0,
    "save": 7.0,
    "link_open": 4.0,
    "story_view": 0.5,
    "story_swipe_through": -0.5,
    "story_save": 5.0,
    "story_audio_play": 3.0,
    "flag_generic": -8.0,       # Strong negative signal
    "flag_inaccurate": -10.0,
    "flag_outdated": -6.0,
    "skip": -2.0,
}

# Thresholds for quality alerts
ALERT_THRESHOLDS = {
    "flag_generic_rate": 0.15,      # >15% of views flagged generic → alert
    "flag_inaccurate_rate": 0.05,   # >5% flagged inaccurate → urgent alert
    "skip_rate": 0.40,              # >40% skip rate → content problem
    "engagement_score_min": 20.0,   # Score below this triggers review recommendation
    "min_views_for_alert": 10,      # Need at least 10 views before flagging
}


# ──────────────────────────────────────────────────────────────────────────────
# PYDANTIC MODELS
# ──────────────────────────────────────────────────────────────────────────────

class ContentEvent(BaseModel):
    poi_id: str
    event_type: str
    depth_level: Optional[str] = Field(None, description="'snackable'|'historia'|'enciclopedico'|'micro_story'")
    cognitive_profile: Optional[str] = None
    listen_seconds: Optional[float] = Field(None, ge=0, description="For listen events: seconds played")
    scroll_pct: Optional[float] = Field(None, ge=0, le=100, description="Scroll percentage reached")
    platform: Optional[str] = Field(None, description="'ios'|'android'|'web'")
    session_id: Optional[str] = None


class BatchEventsRequest(BaseModel):
    events: List[ContentEvent] = Field(..., max_length=50)


class FlagRequest(BaseModel):
    poi_id: str
    flag_type: str = Field(..., description="'generic'|'inaccurate'|'outdated'")
    depth_level: Optional[str] = None
    comment: Optional[str] = Field(None, max_length=500)


# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _record_event(db, user_id: str, event: ContentEvent) -> None:
    """Insert a single event into content_events collection."""
    if event.event_type not in VALID_EVENT_TYPES:
        return  # Silently ignore unknown event types
    doc = {
        "poi_id": event.poi_id,
        "user_id": user_id,
        "event_type": event.event_type,
        "depth_level": event.depth_level,
        "cognitive_profile": event.cognitive_profile,
        "listen_seconds": event.listen_seconds,
        "scroll_pct": event.scroll_pct,
        "platform": event.platform,
        "session_id": event.session_id,
        "weight": EVENT_WEIGHTS.get(event.event_type, 0.0),
        "ts": _now(),
    }
    await db.content_events.insert_one(doc)


async def _compute_poi_metrics(db, poi_id: str, days: int = 30) -> Dict[str, Any]:
    """Aggregate content metrics for a single POI over the past N days."""
    since = _now() - timedelta(days=days)
    base_match = {"poi_id": poi_id, "ts": {"$gte": since}}

    pipeline = [
        {"$match": base_match},
        {"$group": {
            "_id": "$event_type",
            "count": {"$sum": 1},
            "avg_listen": {"$avg": "$listen_seconds"},
            "avg_scroll": {"$avg": "$scroll_pct"},
        }},
    ]
    results = await db.content_events.aggregate(pipeline).to_list(length=100)
    by_type: Dict[str, Any] = {r["_id"]: r for r in results}

    total_views = by_type.get("depth_view", {}).get("count", 0)
    total_events = sum(r["count"] for r in results)

    # Compute engagement score
    engagement_score = sum(
        r["count"] * EVENT_WEIGHTS.get(r["_id"], 0)
        for r in results
    )

    # Rates
    flag_generic = by_type.get("flag_generic", {}).get("count", 0)
    flag_inaccurate = by_type.get("flag_inaccurate", {}).get("count", 0)
    skips = by_type.get("skip", {}).get("count", 0)

    flag_generic_rate = flag_generic / max(total_views, 1)
    flag_inaccurate_rate = flag_inaccurate / max(total_views, 1)
    skip_rate = skips / max(total_views, 1)

    # Depth breakdown
    depth_pipeline = [
        {"$match": {**base_match, "event_type": "depth_view"}},
        {"$group": {"_id": "$depth_level", "count": {"$sum": 1}}},
    ]
    depth_results = await db.content_events.aggregate(depth_pipeline).to_list(length=10)
    depth_distribution = {r["_id"] or "unknown": r["count"] for r in depth_results}

    # Profile breakdown
    profile_pipeline = [
        {"$match": {**base_match, "cognitive_profile": {"$ne": None}}},
        {"$group": {"_id": "$cognitive_profile", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    profile_results = await db.content_events.aggregate(profile_pipeline).to_list(length=5)
    top_profiles = [{"profile": r["_id"], "views": r["count"]} for r in profile_results]

    # Quality alerts
    alerts: List[str] = []
    if total_views >= ALERT_THRESHOLDS["min_views_for_alert"]:
        if flag_generic_rate > ALERT_THRESHOLDS["flag_generic_rate"]:
            alerts.append(f"Conteúdo marcado como genérico por {flag_generic_rate:.0%} dos utilizadores")
        if flag_inaccurate_rate > ALERT_THRESHOLDS["flag_inaccurate_rate"]:
            alerts.append(f"URGENTE: {flag_inaccurate_rate:.0%} reportam conteúdo incorreto")
        if skip_rate > ALERT_THRESHOLDS["skip_rate"]:
            alerts.append(f"Taxa de abandono elevada ({skip_rate:.0%}) — rever gancho inicial")
        if engagement_score < ALERT_THRESHOLDS["engagement_score_min"] and total_views >= 20:
            alerts.append("Score de envolvimento baixo — considerar enriquecimento de conteúdo")

    listen_complete = by_type.get("listen_complete", {}).get("count", 0)
    listen_start = by_type.get("listen_start", {}).get("count", 0)

    return {
        "poi_id": poi_id,
        "period_days": days,
        "total_views": total_views,
        "total_events": total_events,
        "engagement_score": round(engagement_score, 1),
        "depth_distribution": depth_distribution,
        "top_cognitive_profiles": top_profiles,
        "metrics": {
            "read_complete": by_type.get("read_complete", {}).get("count", 0),
            "quero_saber_mais": by_type.get("quero_saber_mais", {}).get("count", 0),
            "depth_switches": by_type.get("depth_switch", {}).get("count", 0),
            "shares": by_type.get("share", {}).get("count", 0),
            "saves": by_type.get("save", {}).get("count", 0),
            "listen_completions": listen_complete,
            "listen_completion_rate": round(listen_complete / max(listen_start, 1), 2),
            "avg_listen_seconds": round(
                by_type.get("listen_pause", {}).get("avg_listen") or
                by_type.get("listen_complete", {}).get("avg_listen") or 0, 1
            ),
            "story_saves": by_type.get("story_save", {}).get("count", 0),
            "story_audio_plays": by_type.get("story_audio_play", {}).get("count", 0),
        },
        "quality": {
            "flag_generic_count": flag_generic,
            "flag_inaccurate_count": flag_inaccurate,
            "flag_outdated_count": by_type.get("flag_outdated", {}).get("count", 0),
            "flag_generic_rate": round(flag_generic_rate, 3),
            "flag_inaccurate_rate": round(flag_inaccurate_rate, 3),
            "skip_rate": round(skip_rate, 3),
        },
        "alerts": alerts,
        "health": "good" if not alerts else ("warning" if len(alerts) < 2 else "critical"),
    }


# ──────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

@metrics_router.post("/content/event", status_code=204)
async def track_event(
    event: ContentEvent,
    current_user: dict = Depends(require_auth),
):
    """Track a single content interaction event."""
    db = _get_db()
    await _record_event(db, current_user["user_id"], event)


@metrics_router.post("/content/batch", status_code=204)
async def track_batch(
    req: BatchEventsRequest,
    current_user: dict = Depends(require_auth),
):
    """Batch event tracking — ideal for mobile offline sync."""
    db = _get_db()
    for event in req.events:
        await _record_event(db, current_user["user_id"], event)


@metrics_router.get("/content/{poi_id}")
async def get_poi_metrics(
    poi_id: str,
    days: int = Query(30, ge=1, le=365),
):
    """Aggregated content metrics for a single POI."""
    db = _get_db()
    return await _compute_poi_metrics(db, poi_id, days=days)


@metrics_router.get("/content/leaderboard")
async def get_engagement_leaderboard(
    days: int = Query(30, ge=1, le=90),
    limit: int = Query(20, ge=1, le=100),
    region: Optional[str] = Query(None),
):
    """Top POIs ranked by engagement score over the past N days."""
    db = _get_db()
    since = _now() - timedelta(days=days)

    match: Dict[str, Any] = {"ts": {"$gte": since}}

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$poi_id",
            "total_events": {"$sum": 1},
            "weighted_score": {"$sum": "$weight"},
            "views": {"$sum": {"$cond": [{"$eq": ["$event_type", "depth_view"]}, 1, 0]}},
            "shares": {"$sum": {"$cond": [{"$eq": ["$event_type", "share"]}, 1, 0]}},
            "saves": {"$sum": {"$cond": [{"$eq": ["$event_type", "save"]}, 1, 0]}},
            "flags": {"$sum": {"$cond": [{"$in": ["$event_type", ["flag_generic", "flag_inaccurate", "flag_outdated"]]}, 1, 0]}},
        }},
        {"$sort": {"weighted_score": -1}},
        {"$limit": limit * 2},  # Fetch extra to filter by region
    ]
    results = await db.content_events.aggregate(pipeline).to_list(length=limit * 2)

    # Enrich with POI metadata
    poi_ids = [r["_id"] for r in results]
    poi_query: Dict[str, Any] = {"id": {"$in": poi_ids}}
    if region:
        poi_query["region"] = region

    pois = await db.heritage_items.find(
        poi_query,
        {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "iq_score": 1}
    ).to_list(length=limit * 2)
    poi_map = {p["id"]: p for p in pois}

    ranked = []
    for r in results:
        poi = poi_map.get(r["_id"])
        if not poi and region:
            continue  # Filtered out by region
        ranked.append({
            "rank": len(ranked) + 1,
            "poi_id": r["_id"],
            "name": poi.get("name", r["_id"]) if poi else r["_id"],
            "category": poi.get("category") if poi else None,
            "region": poi.get("region") if poi else None,
            "iq_score": poi.get("iq_score") if poi else None,
            "engagement_score": round(r["weighted_score"], 1),
            "views": r["views"],
            "shares": r["shares"],
            "saves": r["saves"],
            "quality_flags": r["flags"],
        })
        if len(ranked) >= limit:
            break

    return {
        "period_days": days,
        "region_filter": region,
        "leaderboard": ranked,
    }


@metrics_router.get("/content/quality-alerts")
async def get_quality_alerts(
    days: int = Query(14, ge=1, le=90),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_auth),
):
    """POIs flagged for content quality issues (admin / content team view)."""
    if not current_user.get("is_admin") and not current_user.get("is_editor"):
        raise HTTPException(status_code=403, detail="Acesso restrito a editores")

    db = _get_db()
    since = _now() - timedelta(days=days)

    # Aggregate flag rates per POI
    pipeline = [
        {"$match": {"ts": {"$gte": since}}},
        {"$group": {
            "_id": "$poi_id",
            "views": {"$sum": {"$cond": [{"$eq": ["$event_type", "depth_view"]}, 1, 0]}},
            "flag_generic": {"$sum": {"$cond": [{"$eq": ["$event_type", "flag_generic"]}, 1, 0]}},
            "flag_inaccurate": {"$sum": {"$cond": [{"$eq": ["$event_type", "flag_inaccurate"]}, 1, 0]}},
            "flag_outdated": {"$sum": {"$cond": [{"$eq": ["$event_type", "flag_outdated"]}, 1, 0]}},
            "skips": {"$sum": {"$cond": [{"$eq": ["$event_type", "skip"]}, 1, 0]}},
        }},
        {"$match": {"views": {"$gte": ALERT_THRESHOLDS["min_views_for_alert"]}}},
    ]
    results = await db.content_events.aggregate(pipeline).to_list(length=500)

    alerts = []
    for r in results:
        views = r["views"]
        flag_g_rate = r["flag_generic"] / views
        flag_i_rate = r["flag_inaccurate"] / views
        skip_rate = r["skips"] / views

        issues = []
        severity = "low"

        if flag_i_rate > ALERT_THRESHOLDS["flag_inaccurate_rate"]:
            issues.append("conteúdo incorreto")
            severity = "critical"
        if flag_g_rate > ALERT_THRESHOLDS["flag_generic_rate"]:
            issues.append("conteúdo genérico")
            severity = "high" if severity != "critical" else severity
        if skip_rate > ALERT_THRESHOLDS["skip_rate"]:
            issues.append("taxa de abandono elevada")
            severity = "medium" if severity == "low" else severity

        if not issues:
            continue

        alerts.append({
            "poi_id": r["_id"],
            "severity": severity,
            "issues": issues,
            "views": views,
            "flag_generic_rate": round(flag_g_rate, 3),
            "flag_inaccurate_rate": round(flag_i_rate, 3),
            "skip_rate": round(skip_rate, 3),
            "total_flags": r["flag_generic"] + r["flag_inaccurate"] + r["flag_outdated"],
        })

    # Sort by severity then total_flags
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    alerts.sort(key=lambda x: (severity_order.get(x["severity"], 9), -x["total_flags"]))
    alerts = alerts[:limit]

    # Enrich with POI names
    poi_ids = [a["poi_id"] for a in alerts]
    pois = await db.heritage_items.find(
        {"id": {"$in": poi_ids}},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1}
    ).to_list(length=len(poi_ids))
    poi_map = {p["id"]: p for p in pois}

    for a in alerts:
        poi = poi_map.get(a["poi_id"], {})
        a["name"] = poi.get("name", a["poi_id"])
        a["category"] = poi.get("category")
        a["region"] = poi.get("region")

    return {
        "period_days": days,
        "total_alerts": len(alerts),
        "alerts": alerts,
    }


@metrics_router.get("/dashboard")
async def get_metrics_dashboard(
    days: int = Query(30, ge=1, le=90),
):
    """Platform-wide content health dashboard."""
    db = _get_db()
    since = _now() - timedelta(days=days)

    # Total events in period
    total_events = await db.content_events.count_documents({"ts": {"$gte": since}})

    # Event type breakdown
    type_pipeline = [
        {"$match": {"ts": {"$gte": since}}},
        {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    type_results = await db.content_events.aggregate(type_pipeline).to_list(length=50)
    by_type = {r["_id"]: r["count"] for r in type_results}

    # Depth level usage
    depth_pipeline = [
        {"$match": {"ts": {"$gte": since}, "event_type": "depth_view", "depth_level": {"$ne": None}}},
        {"$group": {"_id": "$depth_level", "count": {"$sum": 1}}},
    ]
    depth_results = await db.content_events.aggregate(depth_pipeline).to_list(length=10)
    depth_usage = {r["_id"]: r["count"] for r in depth_results}

    # Cognitive profile usage
    profile_pipeline = [
        {"$match": {"ts": {"$gte": since}, "cognitive_profile": {"$ne": None}}},
        {"$group": {"_id": "$cognitive_profile", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    profile_results = await db.content_events.aggregate(profile_pipeline).to_list(length=10)
    profile_usage = [{"profile": r["_id"], "events": r["count"]} for r in profile_results]

    # Platform breakdown
    platform_pipeline = [
        {"$match": {"ts": {"$gte": since}, "platform": {"$ne": None}}},
        {"$group": {"_id": "$platform", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    platform_results = await db.content_events.aggregate(platform_pipeline).to_list(length=5)

    # Overall quality health
    total_views = by_type.get("depth_view", 0)
    total_flags = (
        by_type.get("flag_generic", 0) +
        by_type.get("flag_inaccurate", 0) +
        by_type.get("flag_outdated", 0)
    )
    overall_flag_rate = total_flags / max(total_views, 1)
    overall_skip_rate = by_type.get("skip", 0) / max(total_views, 1)
    listen_completion_rate = (
        by_type.get("listen_complete", 0) / max(by_type.get("listen_start", 1), 1)
    )

    health_status = "good"
    if overall_flag_rate > 0.10 or overall_skip_rate > 0.35:
        health_status = "warning"
    if overall_flag_rate > 0.20 or by_type.get("flag_inaccurate", 0) / max(total_views, 1) > 0.05:
        health_status = "critical"

    return {
        "period_days": days,
        "total_events": total_events,
        "total_views": total_views,
        "health_status": health_status,
        "kpis": {
            "quero_saber_mais_clicks": by_type.get("quero_saber_mais", 0),
            "shares": by_type.get("share", 0),
            "saves": by_type.get("save", 0),
            "read_completions": by_type.get("read_complete", 0),
            "listen_completions": by_type.get("listen_complete", 0),
            "listen_completion_rate": round(listen_completion_rate, 2),
            "depth_switches": by_type.get("depth_switch", 0),
            "story_saves": by_type.get("story_save", 0),
        },
        "quality": {
            "total_flags": total_flags,
            "flag_generic": by_type.get("flag_generic", 0),
            "flag_inaccurate": by_type.get("flag_inaccurate", 0),
            "flag_outdated": by_type.get("flag_outdated", 0),
            "overall_flag_rate": round(overall_flag_rate, 3),
            "overall_skip_rate": round(overall_skip_rate, 3),
        },
        "depth_usage": depth_usage,
        "cognitive_profile_usage": profile_usage,
        "platform_breakdown": [{"platform": r["_id"], "count": r["count"]} for r in platform_results],
        "event_breakdown": {k: v for k, v in sorted(by_type.items(), key=lambda x: -x[1])},
    }


@metrics_router.post("/content/flag", status_code=204)
async def flag_content(
    req: FlagRequest,
    current_user: dict = Depends(require_auth),
):
    """
    User-submitted content quality flag.
    Maps to a content event and persists a detailed flag record.
    """
    flag_type_map = {
        "generic": "flag_generic",
        "inaccurate": "flag_inaccurate",
        "outdated": "flag_outdated",
    }
    event_type = flag_type_map.get(req.flag_type)
    if not event_type:
        raise HTTPException(status_code=400, detail="flag_type deve ser 'generic', 'inaccurate' ou 'outdated'")

    db = _get_db()

    # Record as event for aggregate metrics
    await _record_event(db, current_user["user_id"], ContentEvent(
        poi_id=req.poi_id,
        event_type=event_type,
        depth_level=req.depth_level,
    ))

    # Also store detailed flag record for editorial follow-up
    await db.content_flags.insert_one({
        "poi_id": req.poi_id,
        "user_id": current_user["user_id"],
        "flag_type": req.flag_type,
        "depth_level": req.depth_level,
        "comment": req.comment,
        "ts": _now(),
        "resolved": False,
    })
