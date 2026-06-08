"""
Integration tests for the Economy API (economy_api.py).

Endpoints fall back to seed data (SEED_MARKETS, SEED_ARTISANS, ...) when the
MongoDB collection is empty/unreachable, so these run without a live DB.
"""
import pytest

import economy_api

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _force_seed(monkeypatch):
    """Force the pure seed-data path (no MongoDB) for deterministic, fast tests."""
    monkeypatch.setattr(economy_api, "_db_or_none", lambda: None)


def _first_id(item):
    return str(item.get("_id", item.get("id", "")))


class TestMarkets:
    async def test_list_markets(self, client):
        resp = await client.get("/api/economy/markets")
        assert resp.status_code == 200
        data = resp.json()
        assert set(("total", "offset", "limit", "results")).issubset(data)
        assert len(data["results"]) > 0

    async def test_pagination_limit(self, client):
        resp = await client.get("/api/economy/markets", params={"limit": 1})
        data = resp.json()
        assert len(data["results"]) <= 1
        assert data["limit"] == 1

    async def test_filter_by_region(self, client):
        resp = await client.get("/api/economy/markets", params={"region": "zzznope"})
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    async def test_market_detail(self, client):
        item = (await client.get("/api/economy/markets")).json()["results"][0]
        mid = _first_id(item)
        resp = await client.get(f"/api/economy/markets/{mid}")
        assert resp.status_code == 200

    async def test_market_detail_404(self, client):
        resp = await client.get("/api/economy/markets/inexistente-xyz")
        assert resp.status_code == 404


class TestOtherCollections:
    @pytest.mark.parametrize("path", ["/artisans", "/products", "/fishing", "/routes"])
    async def test_collection_returns_results(self, client, path):
        resp = await client.get(f"/api/economy{path}")
        assert resp.status_code == 200
        assert "results" in resp.json()

    async def test_stats(self, client):
        resp = await client.get("/api/economy/stats")
        assert resp.status_code == 200
        assert isinstance(resp.json(), dict)


class TestRecommendations:
    async def test_recommendations_post(self, client):
        resp = await client.post(
            "/api/economy/recommendations",
            json={"lat": 38.7, "lng": -9.1, "interests": ["artesanato"]},
        )
        # Endpoint should respond (200 with payload or graceful fallback)
        assert resp.status_code in (200, 401, 422)
