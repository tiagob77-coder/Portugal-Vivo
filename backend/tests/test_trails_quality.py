"""
Unit tests for trail data-quality / AllTrails enrichment helpers.

These are pure-function tests (no DB, no network) plus one ASGI test for the
read-only ``/trails/featured`` endpoint, which serves the curated AllTrails
dataset without touching MongoDB.
"""
import pytest

from trails_quality import (
    normalize_difficulty,
    normalize_route_type,
    naismith_hours,
    difficulty_color,
    difficulty_from_elevation,
    features_to_tags,
    alltrails_to_trail,
    assess_trail,
    summarize_quality,
    featured_trails,
    load_alltrails_reference,
    DIFFICULTIES,
    ROUTE_TYPES,
    DIFFICULTY_COLORS,
)
from services.overpass_service import parse_overpass_geometry, _sac_to_difficulty


# ─── normalize_difficulty (the map-filter bug) ───────────────────────────────

class TestNormalizeDifficulty:
    def test_accented_portuguese_maps_to_canonical(self):
        # The seed wrote "fácil"/"difícil"; the API filters on "facil"/"dificil".
        assert normalize_difficulty("fácil") == "facil"
        assert normalize_difficulty("Difícil") == "dificil"
        assert normalize_difficulty("Moderado") == "moderado"

    def test_english_labels(self):
        assert normalize_difficulty("easy") == "facil"
        assert normalize_difficulty("moderate") == "moderado"
        assert normalize_difficulty("hard") == "dificil"
        assert normalize_difficulty("expert") == "muito_dificil"

    def test_fallback_to_elevation_when_unknown(self):
        assert normalize_difficulty(None, 50) == "facil"
        assert normalize_difficulty("", 300) == "moderado"
        assert normalize_difficulty("???", 700) == "dificil"
        assert normalize_difficulty(None, 1500) == "muito_dificil"

    def test_default_is_moderado(self):
        assert normalize_difficulty(None) == "moderado"

    def test_output_always_canonical(self):
        for raw in ["fácil", "EASY", "Difícil", "x", None]:
            assert normalize_difficulty(raw, 250) in DIFFICULTIES


class TestRouteType:
    def test_alltrails_labels(self):
        assert normalize_route_type("Ida e volta") == "ida_volta"
        assert normalize_route_type("Circuito") == "circular"
        assert normalize_route_type("Ponto a ponto") == "linear"

    def test_enum_codes(self):
        assert normalize_route_type("O") == "ida_volta"
        assert normalize_route_type("L") == "circular"
        assert normalize_route_type("P") == "linear"

    def test_default_and_canonical(self):
        assert normalize_route_type(None) == "linear"
        for raw in ["Circuito", "O", "loop", None]:
            assert normalize_route_type(raw) in ROUTE_TYPES


class TestMisc:
    def test_naismith(self):
        # 8 km + 600 m gain → 8/4 + 600/600 = 3.0 h
        assert naismith_hours(8, 600) == 3.0

    def test_difficulty_from_elevation_thresholds(self):
        assert difficulty_from_elevation(199) == "facil"
        assert difficulty_from_elevation(200) == "moderado"
        assert difficulty_from_elevation(999) == "dificil"
        assert difficulty_from_elevation(1000) == "muito_dificil"

    def test_color_per_difficulty(self):
        for d in DIFFICULTIES:
            assert difficulty_color(d) == DIFFICULTY_COLORS[d]
        assert difficulty_color("nonsense") == DIFFICULTY_COLORS["moderado"]

    def test_features_to_tags(self):
        tags = features_to_tags(["waterfall", "views", "dogs-leash", "unknown"])
        assert tags == ["cascata", "vistas", "caes_trela"]

    def test_features_to_tags_dedup_and_empty(self):
        assert features_to_tags([]) == []
        assert features_to_tags(["views", "views"]) == ["vistas"]


# ─── AllTrails → platform Trail conversion ───────────────────────────────────

class TestAlltrailsConversion:
    def _record(self):
        return {
            "alltrails_id": 999,
            "name": "Trilho Teste",
            "region": "Norte",
            "park": "Parque Teste",
            "difficulty": "Difícil",
            "route_type": "Circuito",
            "distance_km": 10.0,
            "elevation_gain_m": 600,
            "elevation_max_m": 1200,
            "rating": 4.5,
            "features": ["waterfall", "views"],
            "activities": ["hiking"],
            "url": "https://www.alltrails.com/x",
        }

    def test_conversion_fields(self):
        t = alltrails_to_trail(self._record())
        assert t["id"] == "at-999"
        assert t["difficulty"] == "dificil"           # canonical, de-accented
        assert t["trail_type"] == "circular"
        assert t["distance_km"] == 10.0
        assert t["elevation_gain"] == 600
        assert t["max_elevation"] == 1200
        assert t["estimated_hours"] == naismith_hours(10.0, 600)
        assert t["color"] == DIFFICULTY_COLORS["dificil"]
        assert t["tags"] == ["cascata", "vistas"]
        assert t["source"] == "alltrails"
        assert t["external_url"].startswith("https://")

    def test_conversion_has_no_geometry(self):
        # AllTrails exposes no GPS track → points empty, flagged by the audit.
        t = alltrails_to_trail(self._record())
        assert t["points"] == []
        assert assess_trail(t)["map_renderable"] is False


# ─── Curated dataset integrity ───────────────────────────────────────────────

class TestDataset:
    def test_dataset_loads(self):
        ref = load_alltrails_reference()
        assert len(ref) >= 40

    def test_featured_are_valid_and_sorted(self):
        trails = featured_trails()
        assert len(trails) >= 40
        ratings = [t.get("rating") or 0 for t in trails]
        assert ratings == sorted(ratings, reverse=True)
        for t in trails:
            assert t["difficulty"] in DIFFICULTIES
            assert t["trail_type"] in ROUTE_TYPES
            assert t["color"] in DIFFICULTY_COLORS.values()
            assert t["distance_km"] > 0
            assert t["source"] == "alltrails"


# ─── Map-quality assessment ──────────────────────────────────────────────────

class TestAssessTrail:
    def test_no_gps(self):
        a = assess_trail({"id": "a", "points": [], "distance_km": 5, "elevation_gain": 100, "difficulty": "facil"})
        assert "no_gps" in a["issues"]
        assert a["map_renderable"] is False

    def test_single_point_not_renderable(self):
        # The dominant defect: one trailhead point → map skips the polyline.
        a = assess_trail({"id": "a", "points": [{"lat": 41.7, "lng": -8.2}],
                          "distance_km": 5, "elevation_gain": 100, "difficulty": "moderado"})
        assert "single_point" in a["issues"]
        assert a["map_renderable"] is False

    def test_two_points_renderable(self):
        a = assess_trail({"id": "a", "points": [{"lat": 41.7, "lng": -8.2}, {"lat": 41.71, "lng": -8.21}],
                          "distance_km": 5, "elevation_gain": 100, "difficulty": "moderado"})
        assert a["map_renderable"] is True

    def test_out_of_bounds(self):
        a = assess_trail({"id": "a", "points": [{"lat": 51.5, "lng": -0.1}, {"lat": 51.6, "lng": -0.2}],
                          "distance_km": 5, "elevation_gain": 100, "difficulty": "facil"})
        assert "out_of_bounds" in a["issues"]
        assert a["map_renderable"] is False

    def test_invalid_difficulty_flagged(self):
        a = assess_trail({"id": "a", "points": [{"lat": 41.7, "lng": -8.2}, {"lat": 41.71, "lng": -8.21}],
                          "distance_km": 5, "elevation_gain": 100, "difficulty": "fácil"})
        assert "invalid_difficulty" in a["issues"]

    def test_quality_score_bounds(self):
        a = assess_trail({"id": "a", "points": [], "difficulty": "x"})
        assert 0 <= a["quality_score"] <= 100

    def test_summarize(self):
        trails = [
            {"id": "1", "points": [], "difficulty": "facil"},
            {"id": "2", "points": [{"lat": 41.7, "lng": -8.2}], "difficulty": "moderado",
             "distance_km": 4, "elevation_gain": 200},
            {"id": "3", "points": [{"lat": 41.7, "lng": -8.2}, {"lat": 41.71, "lng": -8.21},
                                   {"lat": 41.72, "lng": -8.22}, {"lat": 41.73, "lng": -8.23},
                                   {"lat": 41.74, "lng": -8.24}],
             "difficulty": "moderado", "distance_km": 4, "elevation_gain": 200},
        ]
        s = summarize_quality(trails)
        assert s["total"] == 3
        assert s["map_renderable"] == 1
        assert s["not_map_renderable"] == 2
        assert s["issue_counts"]["no_gps"] == 1
        assert s["issue_counts"]["single_point"] == 1


# ─── Overpass geometry parser (real polyline path) ───────────────────────────

class TestOverpassGeometry:
    def test_sac_mapping(self):
        assert _sac_to_difficulty("hiking") == "facil"
        assert _sac_to_difficulty("mountain_hiking") == "moderado"
        assert _sac_to_difficulty("alpine_hiking") == "muito_dificil"
        assert _sac_to_difficulty(None) == "moderado"

    def test_parse_way_geometry(self):
        elements = [{
            "type": "way", "id": 1, "tags": {"name": "Trilho X", "sac_scale": "mountain_hiking"},
            "geometry": [{"lat": 41.70, "lon": -8.20}, {"lat": 41.71, "lon": -8.21},
                         {"lat": 41.72, "lon": -8.22}],
        }]
        trails = parse_overpass_geometry(elements)
        assert len(trails) == 1
        t = trails[0]
        assert t["point_count"] == 3
        assert t["points"][0] == {"lat": 41.70, "lng": -8.20, "ele": None}
        assert t["difficulty"] == "moderado"
        assert t["distance_km"] > 0
        # geometry is real → renders on the map
        assert assess_trail(t)["map_renderable"] is True

    def test_parse_relation_geometry(self):
        elements = [{
            "type": "relation", "id": 9, "tags": {"name": "GR Teste", "route": "hiking"},
            "members": [
                {"type": "way", "geometry": [{"lat": 40.1, "lon": -7.5}, {"lat": 40.2, "lon": -7.6}]},
                {"type": "way", "geometry": [{"lat": 40.2, "lon": -7.6}, {"lat": 40.3, "lon": -7.7}]},
            ],
        }]
        trails = parse_overpass_geometry(elements)
        assert len(trails) == 1
        assert trails[0]["point_count"] == 4

    def test_skips_degenerate(self):
        elements = [
            {"type": "way", "id": 2, "tags": {}, "geometry": [{"lat": 41.7, "lon": -8.2}]},  # 1 pt
            {"type": "node", "id": 3, "lat": 41.7, "lon": -8.2},
        ]
        assert parse_overpass_geometry(elements) == []


# ─── /trails/featured endpoint (no DB) ───────────────────────────────────────

pytestmark = pytest.mark.anyio


class TestFeaturedEndpoint:
    async def test_featured_returns_alltrails(self, client):
        resp = await client.get("/api/trails/featured")
        assert resp.status_code == 200
        data = resp.json()
        assert data["source"] == "alltrails"
        assert data["total"] >= 40
        assert len(data["trails"]) > 0
        assert data["trails"][0]["difficulty"] in DIFFICULTIES

    async def test_featured_filter_by_difficulty(self, client):
        resp = await client.get("/api/trails/featured", params={"difficulty": "facil"})
        assert resp.status_code == 200
        for t in resp.json()["trails"]:
            assert t["difficulty"] == "facil"

    async def test_featured_filter_by_region(self, client):
        resp = await client.get("/api/trails/featured", params={"region": "Madeira"})
        assert resp.status_code == 200
        for t in resp.json()["trails"]:
            assert t["region"] == "Madeira"
