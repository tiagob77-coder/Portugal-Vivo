"""
Tests for cultural-routes data quality and the /cultural-routes API.

Pure validator tests (no DB) plus ASGI tests for the read-only endpoints. A
regression guard asserts the shipped SEED_ROUTES are clean (every stop inside
Portugal, ordered, known family, no duplicate ids).
"""
import pytest

from cultural_routes_quality import (
    assess_cultural_route,
    summarize_cultural_routes,
    VALID_FAMILIES,
)
from cultural_routes_api import SEED_ROUTES


def _valid_route():
    return {
        "_id": "cr_x", "name": "Rota X", "family": "musicais",
        "lat": 38.72, "lng": -9.14,
        "stops": [
            {"name": "A", "lat": 38.72, "lng": -9.14, "order": 1},
            {"name": "B", "lat": 38.80, "lng": -9.00, "order": 2},
        ],
    }


# ─── Validator ───────────────────────────────────────────────────────────────

class TestAssess:
    def test_valid_route_has_no_issues(self):
        a = assess_cultural_route(_valid_route())
        assert a["issues"] == []
        assert a["quality_score"] == 100
        assert a["stop_count"] == 2

    def test_no_stops(self):
        r = _valid_route(); r["stops"] = []
        assert "no_stops" in assess_cultural_route(r)["issues"]

    def test_stop_out_of_bounds(self):
        r = _valid_route()
        r["stops"][1] = {"name": "London", "lat": 51.5, "lng": -0.12, "order": 2}
        assert "stop_out_of_bounds" in assess_cultural_route(r)["issues"]

    def test_missing_stop_coords(self):
        r = _valid_route()
        r["stops"][0] = {"name": "A", "order": 1}
        assert "missing_stop_coords" in assess_cultural_route(r)["issues"]

    def test_stops_unordered(self):
        r = _valid_route()
        r["stops"][0]["order"], r["stops"][1]["order"] = 2, 1
        assert "stops_unordered" in assess_cultural_route(r)["issues"]

    def test_invalid_family(self):
        r = _valid_route(); r["family"] = "nonsense"
        assert "invalid_family" in assess_cultural_route(r)["issues"]

    def test_center_out_of_bounds(self):
        r = _valid_route(); r["lat"], r["lng"] = 51.5, -0.12
        assert "center_out_of_bounds" in assess_cultural_route(r)["issues"]


class TestSummarize:
    def test_duplicate_ids_detected(self):
        a, b = _valid_route(), _valid_route()  # same _id
        s = summarize_cultural_routes([a, b])
        assert s["duplicate_ids"] == ["cr_x"]
        assert s["total"] == 2

    def test_counts_and_clean(self):
        good = _valid_route()
        bad = _valid_route(); bad["_id"] = "cr_y"; bad["family"] = "nope"
        s = summarize_cultural_routes([good, bad])
        assert s["clean"] == 1
        assert s["with_issues"] == 1
        assert s["issue_counts"]["invalid_family"] == 1


# ─── Regression guard: the shipped seed data must be clean ───────────────────

class TestSeedData:
    def test_seed_routes_are_all_clean(self):
        s = summarize_cultural_routes(SEED_ROUTES)
        assert s["total"] >= 18
        assert s["with_issues"] == 0, [a for a in (assess_cultural_route(r) for r in SEED_ROUTES) if a["issues"]]
        assert s["duplicate_ids"] == []

    def test_seed_families_are_known(self):
        for r in SEED_ROUTES:
            assert r.get("family") in VALID_FAMILIES


# ─── Endpoints ───────────────────────────────────────────────────────────────

pytestmark = pytest.mark.anyio


class TestEndpoints:
    async def test_families(self, client):
        resp = await client.get("/api/cultural-routes/families")
        assert resp.status_code == 200
        assert "families" in resp.json()

    async def test_list_routes(self, client):
        resp = await client.get("/api/cultural-routes/routes")
        assert resp.status_code == 200
        assert resp.json()["total"] > 0

    async def test_route_404(self, client):
        resp = await client.get("/api/cultural-routes/routes/does-not-exist")
        assert resp.status_code == 404

    async def test_audit(self, client):
        resp = await client.get("/api/cultural-routes/audit")
        assert resp.status_code == 200
        data = resp.json()
        assert "summary" in data and "issue_counts" in data["summary"]
        assert "total" in data["summary"]
