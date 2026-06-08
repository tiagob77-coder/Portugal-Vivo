"""
Integration tests for the Coastal Gastronomy API (coastal_gastronomy_api.py).

Endpoints fall back to seed data (SEED_ITEMS, SEED_COASTAL_SPECIES,
SEED_ROUTES, SEED_PAIRINGS), so these run without a live MongoDB.
"""
import pytest

import coastal_gastronomy_api

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _force_seed(monkeypatch):
    """Force the pure seed-data path (no MongoDB) for deterministic, fast tests."""
    monkeypatch.setattr(coastal_gastronomy_api, "_db_or_none", lambda: None)


def _first_id(item):
    return str(item.get("_id", item.get("id", "")))


class TestItems:
    async def test_list_items(self, client):
        resp = await client.get("/api/gastronomy/items")
        assert resp.status_code == 200
        data = resp.json()
        assert set(("total", "offset", "limit", "results")).issubset(data)
        assert len(data["results"]) > 0

    async def test_seasonal(self, client):
        resp = await client.get("/api/gastronomy/items/seasonal")
        assert resp.status_code == 200
        assert "month" in resp.json()

    async def test_nearby(self, client):
        resp = await client.get(
            "/api/gastronomy/items/nearby",
            params={"lat": 38.7, "lng": -9.1, "radius_km": 300},
        )
        assert resp.status_code == 200
        assert "results" in resp.json()

    async def test_item_detail(self, client):
        item = (await client.get("/api/gastronomy/items")).json()["results"][0]
        resp = await client.get(f"/api/gastronomy/items/{_first_id(item)}")
        assert resp.status_code == 200

    async def test_item_detail_404(self, client):
        resp = await client.get("/api/gastronomy/items/nope")
        assert resp.status_code == 404

    async def test_month_validation(self, client):
        resp = await client.get("/api/gastronomy/items", params={"month": 0})
        assert resp.status_code == 422


class TestSpeciesRoutesStats:
    async def test_species(self, client):
        resp = await client.get("/api/gastronomy/species")
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        for item in data["results"]:
            assert "in_season_now" in item
            assert "forbidden_now" in item

    async def test_routes(self, client):
        resp = await client.get("/api/gastronomy/routes")
        assert resp.status_code == 200

    async def test_stats(self, client):
        resp = await client.get("/api/gastronomy/stats")
        assert resp.status_code == 200
        assert isinstance(resp.json(), dict)
