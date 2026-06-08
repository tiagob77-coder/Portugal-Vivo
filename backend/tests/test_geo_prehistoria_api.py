"""
Integration tests for the Geo-Prehistoria API (geo_prehistoria_api.py).

Endpoints fall back to seed data (SEED_SITES, SEED_ROUTES, ASTRO_EVENTS),
so these run without a live MongoDB.
"""
import pytest

import geo_prehistoria_api

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _force_seed(monkeypatch):
    """Force the pure seed-data path (no MongoDB) for deterministic, fast tests."""
    monkeypatch.setattr(geo_prehistoria_api, "_db_or_none", lambda: None)


def _first_id(item):
    return str(item.get("_id", item.get("id", "")))


class TestSites:
    async def test_list_sites(self, client):
        resp = await client.get("/api/geo-prehistoria/sites")
        assert resp.status_code == 200
        data = resp.json()
        assert set(("total", "offset", "limit", "results")).issubset(data)
        assert len(data["results"]) > 0

    async def test_site_detail(self, client):
        item = (await client.get("/api/geo-prehistoria/sites")).json()["results"][0]
        resp = await client.get(f"/api/geo-prehistoria/sites/{_first_id(item)}")
        assert resp.status_code == 200

    async def test_site_detail_404(self, client):
        resp = await client.get("/api/geo-prehistoria/sites/nope")
        assert resp.status_code == 404

    async def test_filter_astronomical(self, client):
        resp = await client.get(
            "/api/geo-prehistoria/sites", params={"astronomical": True}
        )
        assert resp.status_code == 200
        assert all(i.get("astronomical_type") for i in resp.json()["results"])


class TestNearbyAndRoutes:
    async def test_nearby(self, client):
        resp = await client.get(
            "/api/geo-prehistoria/nearby",
            params={"lat": 38.5, "lng": -8.0, "radius_km": 500},
        )
        assert resp.status_code == 200
        results = resp.json()["results"]
        dists = [r["distance_km"] for r in results]
        assert dists == sorted(dists)

    async def test_nearby_requires_coords(self, client):
        resp = await client.get("/api/geo-prehistoria/nearby")
        assert resp.status_code == 422

    async def test_routes(self, client):
        resp = await client.get("/api/geo-prehistoria/routes")
        assert resp.status_code == 200
        assert "results" in resp.json()


class TestAstro:
    async def test_astro_events(self, client):
        resp = await client.get("/api/geo-prehistoria/astro/events")
        assert resp.status_code == 200

    async def test_alignments_valid_event(self, client):
        resp = await client.get(
            "/api/geo-prehistoria/astro/alignments",
            params={"event": "solsticio_verao"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["event"] == "solsticio_verao"
        assert "sites" in data

    async def test_alignments_requires_event(self, client):
        resp = await client.get("/api/geo-prehistoria/astro/alignments")
        assert resp.status_code == 422

    async def test_alignments_invalid_event(self, client):
        resp = await client.get(
            "/api/geo-prehistoria/astro/alignments",
            params={"event": "lua_cheia"},
        )
        assert resp.status_code == 400

    async def test_stats(self, client):
        resp = await client.get("/api/geo-prehistoria/stats")
        assert resp.status_code == 200
        assert isinstance(resp.json(), dict)
