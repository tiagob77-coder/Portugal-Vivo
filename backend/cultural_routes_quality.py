"""
Cultural-routes data-quality helpers.

Dependency-light and side-effect free (no DB, no app import) so it can be unit
tested in isolation, mirroring trails_quality. Validates the premium cultural
routes served by cultural_routes_api: every stop must sit inside Portugal, be
ordered, the family must be known, and the route centre must be in bounds.
"""
from __future__ import annotations

from typing import Any, Dict, List

from trails_quality import PT_LAT_RANGE, PT_LNG_RANGE

# Macro-families recognised by cultural_routes_api.ROUTE_FAMILIES.
VALID_FAMILIES = {
    "musicais", "danca", "festas", "trajes", "instrumentos", "integradas",
}


def _in_pt(lat: Any, lng: Any) -> bool:
    return (
        isinstance(lat, (int, float)) and isinstance(lng, (int, float))
        and PT_LAT_RANGE[0] <= lat <= PT_LAT_RANGE[1]
        and PT_LNG_RANGE[0] <= lng <= PT_LNG_RANGE[1]
    )


def assess_cultural_route(route: Dict[str, Any]) -> Dict[str, Any]:
    """Score a single cultural route and list concrete data-quality issues."""
    issues: List[str] = []
    rid = str(route.get("_id", route.get("id", "")))
    stops = route.get("stops") or []
    n = len(stops)
    score = 100

    if n == 0:
        issues.append("no_stops")
        score -= 50

    missing = sum(1 for s in stops if s.get("lat") is None or s.get("lng") is None)
    out_of_bounds = sum(
        1 for s in stops
        if s.get("lat") is not None and s.get("lng") is not None
        and not _in_pt(s.get("lat"), s.get("lng"))
    )
    if missing:
        issues.append("missing_stop_coords")
        score -= 20
    if out_of_bounds:
        issues.append("stop_out_of_bounds")
        score -= 25

    orders = [s.get("order") for s in stops if s.get("order") is not None]
    if orders and orders != sorted(orders):
        issues.append("stops_unordered")
        score -= 10

    family = route.get("family")
    if family is not None and family not in VALID_FAMILIES:
        issues.append("invalid_family")
        score -= 10

    clat, clng = route.get("lat"), route.get("lng")
    if clat is not None and clng is not None and not _in_pt(clat, clng):
        issues.append("center_out_of_bounds")
        score -= 15

    return {
        "id": rid,
        "name": route.get("name", ""),
        "family": family,
        "stop_count": n,
        "quality_score": max(0, min(100, score)),
        "issues": issues,
    }


def summarize_cultural_routes(routes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate ``assess_cultural_route`` over a list of routes."""
    assessments = [assess_cultural_route(r) for r in routes]
    total = len(assessments)
    ids = [a["id"] for a in assessments]
    duplicate_ids = sorted({i for i in ids if ids.count(i) > 1 and i})

    counts = {
        "no_stops": 0,
        "missing_stop_coords": 0,
        "stop_out_of_bounds": 0,
        "stops_unordered": 0,
        "invalid_family": 0,
        "center_out_of_bounds": 0,
    }
    clean = 0
    score_sum = 0
    for a in assessments:
        score_sum += a["quality_score"]
        if not a["issues"]:
            clean += 1
        for issue in a["issues"]:
            if issue in counts:
                counts[issue] += 1

    return {
        "total": total,
        "clean": clean,
        "with_issues": total - clean,
        "duplicate_ids": duplicate_ids,
        "avg_quality_score": round(score_sum / total, 1) if total else 0,
        "issue_counts": counts,
    }
