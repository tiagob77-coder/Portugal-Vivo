"""
Trail data-quality and AllTrails enrichment helpers.

This module is intentionally dependency-light and side-effect free so it can be
unit-tested without a database, network or the FastAPI app. It provides:

  * Canonical normalisation of difficulty / route-type values (the seed used
    accented Portuguese labels — ``fácil`` / ``difícil`` — while the API filters
    and the GPX-upload path use the unaccented enum ``facil`` / ``dificil``;
    that mismatch silently broke difficulty filtering on the map).
  * Conversion of AllTrails reference records (see ``data/alltrails_pt.json``)
    into the platform ``Trail`` shape consumed by ``trails_api`` and the map.
  * A map-quality assessment (``assess_trail``) that flags why a trail cannot
    be rendered as a polyline — the dominant defect in the current dataset is
    trails seeded with a single GPS point, which the map skips because the
    polyline layer requires ``points.length > 1``.

AllTrails does NOT expose GPS geometry or coordinates, so enriched trails carry
real stats but ``points: []`` until a GPX upload or an OSM/Overpass backfill
adds geometry. ``assess_trail`` makes that gap explicit instead of silent.
"""
from __future__ import annotations

import json
import math
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional

# ─── Canonical enums (must match trails_api / map_layers_api / GPX upload) ────

DIFFICULTIES = ("facil", "moderado", "dificil", "muito_dificil")
ROUTE_TYPES = ("linear", "circular", "ida_volta")

# Continental Portugal + Madeira + Azores bounding box. Kept in sync with the
# audit bounds historically defined in trails_api.
PT_LAT_RANGE = (32.0, 42.5)
PT_LNG_RANGE = (-31.5, -6.0)

# Map line colour per difficulty (greens → reds). Used so the trail polyline
# and markers carry a consistent, meaningful colour instead of a flat default.
DIFFICULTY_COLORS = {
    "facil": "#16A34A",
    "moderado": "#F59E0B",
    "dificil": "#EA580C",
    "muito_dificil": "#DC2626",
}

# AllTrails feature slug → Portuguese tag used across the platform UI.
_FEATURE_TAGS = {
    "beach": "praia",
    "cave": "gruta",
    "forest": "floresta",
    "lake": "lago",
    "hot-springs": "termas",
    "river": "rio",
    "views": "vistas",
    "waterfall": "cascata",
    "wild-flowers": "flores",
    "wildlife": "fauna",
    "rails-trails": "ecopista",
    "city-walk": "urbano",
    "historic-site": "patrimonio",
    "pub-crawl": "urbano",
    "event": "evento",
    "dogs": "caes",
    "dogs-leash": "caes_trela",
    "dogs-no": "sem_caes",
    "kids": "familia",
    "ada": "acessivel",
    "strollers": "carrinho",
    "paved": "pavimentado",
    "partially-paved": "semi_pavimentado",
}


def _strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
    )


def difficulty_from_elevation(elevation_gain_m: float) -> str:
    """Platform difficulty heuristic from elevation gain (see CLAUDE.md)."""
    if elevation_gain_m < 200:
        return "facil"
    if elevation_gain_m < 500:
        return "moderado"
    if elevation_gain_m < 1000:
        return "dificil"
    return "muito_dificil"


def normalize_difficulty(
    raw: Optional[str], elevation_gain_m: Optional[float] = None
) -> str:
    """Map any difficulty label to the canonical unaccented enum.

    Handles AllTrails (``Fácil`` / ``Moderado`` / ``Difícil``), English
    (``easy`` / ``moderate`` / ``hard`` / ``expert``), accented Portuguese and
    already-canonical values. Falls back to the elevation heuristic when the
    label is missing or unrecognised and a gain is available, otherwise
    ``moderado``.
    """
    if raw and str(raw).strip():
        key = _strip_accents(str(raw)).strip().lower()
        mapping = {
            "facil": "facil",
            "easy": "facil",
            "moderado": "moderado",
            "moderate": "moderado",
            "medio": "moderado",
            "dificil": "dificil",
            "hard": "dificil",
            "difficult": "dificil",
            "muito dificil": "muito_dificil",
            "muito_dificil": "muito_dificil",
            "very hard": "muito_dificil",
            "expert": "muito_dificil",
            "extreme": "muito_dificil",
        }
        if key in mapping:
            return mapping[key]
    if elevation_gain_m is not None:
        return difficulty_from_elevation(elevation_gain_m)
    return "moderado"


def normalize_route_type(raw: Optional[str]) -> str:
    """Map AllTrails / enum route types to the canonical platform value.

    AllTrails: ``Ida e volta`` (out & back) → ``ida_volta``; ``Circuito``
    (loop) → ``circular``; ``Ponto a ponto`` (point to point) → ``linear``.
    Enum codes O/L/P are also accepted.
    """
    if not raw:
        return "linear"
    key = _strip_accents(str(raw)).strip().lower()
    mapping = {
        "ida e volta": "ida_volta",
        "ida_volta": "ida_volta",
        "out and back": "ida_volta",
        "out & back": "ida_volta",
        "o": "ida_volta",
        "circuito": "circular",
        "circular": "circular",
        "loop": "circular",
        "l": "circular",
        "ponto a ponto": "linear",
        "point to point": "linear",
        "linear": "linear",
        "p": "linear",
    }
    return mapping.get(key, "linear")


def naismith_hours(distance_km: float, elevation_gain_m: float) -> float:
    """Estimated walking time (Naismith's rule, see CLAUDE.md)."""
    return round(distance_km / 4.0 + (elevation_gain_m or 0) / 600.0, 1)


def difficulty_color(difficulty: str) -> str:
    return DIFFICULTY_COLORS.get(difficulty, DIFFICULTY_COLORS["moderado"])


def features_to_tags(features: Optional[List[str]]) -> List[str]:
    """Translate AllTrails feature slugs to platform tags (order preserved)."""
    tags: List[str] = []
    for feat in features or []:
        tag = _FEATURE_TAGS.get(str(feat).strip().lower())
        if tag and tag not in tags:
            tags.append(tag)
    return tags


# ─── AllTrails reference dataset ─────────────────────────────────────────────

_DATA_PATH = Path(__file__).parent / "data" / "alltrails_pt.json"
_ALLTRAILS_CACHE: Optional[List[Dict[str, Any]]] = None


def load_alltrails_reference() -> List[Dict[str, Any]]:
    """Load the curated AllTrails reference trails (cached). Empty on error."""
    global _ALLTRAILS_CACHE
    if _ALLTRAILS_CACHE is None:
        try:
            with open(_DATA_PATH, "r", encoding="utf-8") as fh:
                payload = json.load(fh)
            _ALLTRAILS_CACHE = list(payload.get("trails", []))
        except (OSError, ValueError):
            _ALLTRAILS_CACHE = []
    return _ALLTRAILS_CACHE


def alltrails_to_trail(record: Dict[str, Any]) -> Dict[str, Any]:
    """Convert an AllTrails reference record into the platform Trail shape.

    Stats (distance, elevation, difficulty, route type, rating) are real;
    ``points`` is empty because AllTrails exposes no geometry. ``source`` and
    ``external_url`` mark provenance so the UI can attribute and deep-link.
    """
    distance_km = round(float(record.get("distance_km") or 0), 1)
    elevation_gain = int(round(float(record.get("elevation_gain_m") or 0)))
    difficulty = normalize_difficulty(record.get("difficulty"), elevation_gain)
    max_elev = record.get("elevation_max_m")
    at_id = record.get("alltrails_id")

    return {
        "id": f"at-{at_id}",
        "name": record.get("name", ""),
        "description": record.get("description", ""),
        "region": record.get("region", ""),
        "park": record.get("park", ""),
        "difficulty": difficulty,
        "distance_km": distance_km,
        "elevation_gain": elevation_gain,
        "elevation_loss": 0,
        "min_elevation": 0,
        "max_elevation": int(round(float(max_elev))) if max_elev else 0,
        "estimated_hours": naismith_hours(distance_km, elevation_gain),
        "trail_type": normalize_route_type(record.get("route_type")),
        "points": [],
        "color": difficulty_color(difficulty),
        "tags": features_to_tags(record.get("features")),
        "activities": record.get("activities", []),
        "rating": record.get("rating"),
        "source": "alltrails",
        "external_id": at_id,
        "external_url": record.get("url", ""),
    }


def featured_trails() -> List[Dict[str, Any]]:
    """Curated AllTrails trails as platform Trail dicts, sorted by rating."""
    trails = [alltrails_to_trail(r) for r in load_alltrails_reference()]
    trails.sort(key=lambda t: (t.get("rating") or 0), reverse=True)
    return trails


# ─── OSM geometry matching (backfill the polylines AllTrails lacks) ──────────

_NAME_STOPWORDS = {
    "de", "da", "do", "das", "dos", "e", "a", "o", "trilho", "rota", "via",
    "percurso", "pr", "gr", "the", "of",
}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _name_tokens(name: Optional[str]) -> set:
    raw = _strip_accents(str(name or "")).lower()
    cleaned = "".join(c if c.isalnum() else " " for c in raw)
    return {
        tok for tok in cleaned.split()
        if len(tok) > 1 and tok not in _NAME_STOPWORDS
    }


def name_similarity(a: Optional[str], b: Optional[str]) -> float:
    """Jaccard similarity over significant name tokens (0..1)."""
    ta, tb = _name_tokens(a), _name_tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def osm_match_score(trail: Dict[str, Any], candidate: Dict[str, Any]) -> float:
    """Score how well an OSM candidate matches a platform trail (0..1).

    Blends name similarity, distance agreement and trailhead proximity over
    whichever signals are available (name is always weighted; distance and
    proximity only when both sides expose the data).
    """
    name_sim = name_similarity(trail.get("name"), candidate.get("name"))

    dist_score = None
    td = trail.get("distance_km") or 0
    cd = candidate.get("distance_km") or 0
    if td > 0 and cd > 0:
        dist_score = max(0.0, 1.0 - abs(td - cd) / max(td, cd))

    prox_score = None
    tpts = trail.get("points") or []
    cpts = candidate.get("points") or []
    if (tpts and cpts and tpts[0].get("lat") is not None
            and cpts[0].get("lat") is not None):
        d = _haversine_km(tpts[0]["lat"], tpts[0]["lng"],
                          cpts[0]["lat"], cpts[0]["lng"])
        prox_score = max(0.0, 1.0 - d / 5.0)  # 0 km → 1.0, ≥5 km → 0.0

    weights = {"name": 0.5, "dist": 0.2, "prox": 0.3}
    score = weights["name"] * name_sim
    total_w = weights["name"]
    if dist_score is not None:
        score += weights["dist"] * dist_score
        total_w += weights["dist"]
    if prox_score is not None:
        score += weights["prox"] * prox_score
        total_w += weights["prox"]
    return score / total_w if total_w else 0.0


def pick_best_osm_match(
    trail: Dict[str, Any],
    candidates: List[Dict[str, Any]],
    min_score: float = 0.45,
):
    """Best OSM candidate (with ≥2 points) above ``min_score``.

    Returns ``(candidate, score)`` or ``(None, 0.0)`` when nothing qualifies.
    """
    best = None
    best_score = 0.0
    for c in candidates:
        if len(c.get("points") or []) < 2:
            continue
        s = osm_match_score(trail, c)
        if s > best_score:
            best, best_score = c, s
    if best is not None and best_score >= min_score:
        return best, round(best_score, 3)
    return None, 0.0


# ─── Map-quality assessment ──────────────────────────────────────────────────

def _in_pt_bounds(lat: float, lng: float) -> bool:
    return (
        PT_LAT_RANGE[0] <= lat <= PT_LAT_RANGE[1]
        and PT_LNG_RANGE[0] <= lng <= PT_LNG_RANGE[1]
    )


def assess_trail(trail: Dict[str, Any]) -> Dict[str, Any]:
    """Score a trail's map-readiness and list concrete quality issues.

    ``map_renderable`` is True only when the trail has at least two in-bounds
    points, because the map polyline layer requires ``points.length > 1``.
    Score starts at 100 and is reduced per issue, clamped to ``[0, 100]``.
    """
    issues: List[str] = []
    points = trail.get("points") or []
    point_count = len(points)
    score = 100

    out_of_bounds = False
    for p in points:
        lat, lng = p.get("lat"), p.get("lng")
        if lat is None or lng is None or not _in_pt_bounds(lat, lng):
            out_of_bounds = True
            break

    if point_count == 0:
        issues.append("no_gps")
        score -= 60
    elif point_count == 1:
        issues.append("single_point")
        score -= 40
    elif point_count < 5:
        issues.append("few_points")
        score -= 15

    if out_of_bounds:
        issues.append("out_of_bounds")
        score -= 25

    if not trail.get("distance_km"):
        issues.append("missing_distance")
        score -= 10
    if not trail.get("elevation_gain"):
        issues.append("missing_elevation")
        score -= 5
    if trail.get("difficulty") not in DIFFICULTIES:
        issues.append("invalid_difficulty")
        score -= 10

    map_renderable = point_count >= 2 and not out_of_bounds

    return {
        "id": trail.get("id", ""),
        "name": trail.get("name", ""),
        "region": trail.get("region", ""),
        "difficulty": trail.get("difficulty", ""),
        "point_count": point_count,
        "map_renderable": map_renderable,
        "quality_score": max(0, min(100, score)),
        "issues": issues,
    }


def summarize_quality(trails: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate ``assess_trail`` over a list of trails into map-quality stats."""
    assessments = [assess_trail(t) for t in trails]
    total = len(assessments)
    counts = {
        "no_gps": 0,
        "single_point": 0,
        "few_points": 0,
        "out_of_bounds": 0,
        "missing_distance": 0,
        "missing_elevation": 0,
        "invalid_difficulty": 0,
    }
    renderable = 0
    score_sum = 0
    for a in assessments:
        if a["map_renderable"]:
            renderable += 1
        score_sum += a["quality_score"]
        for issue in a["issues"]:
            if issue in counts:
                counts[issue] += 1

    return {
        "total": total,
        "map_renderable": renderable,
        "not_map_renderable": total - renderable,
        "avg_quality_score": round(score_sum / total, 1) if total else 0,
        "issue_counts": counts,
    }
