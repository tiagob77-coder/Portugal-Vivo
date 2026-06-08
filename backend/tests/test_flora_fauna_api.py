"""
Integration tests for the Flora & Fauna API (flora_fauna_api.py).

Endpoints fall back to seed data (SEED_FLORA, SEED_FAUNA, SEED_HABITATS),
so these run without a live MongoDB.
"""
import pytest

import flora_fauna_api

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _force_seed(monkeypatch):
    """Force the pure seed-data path (no MongoDB) for deterministic, fast tests."""
    monkeypatch.setattr(flora_fauna_api, "_db_or_none", lambda: None)


class TestFlora:
    async def test_list_flora(self, client):
        resp = await client.get("/api/flora-fauna/flora")
        assert resp.status_code == 200
        data = resp.json()
        assert "flora" in data and "total" in data
        assert len(data["flora"]) > 0

    async def test_flora_seasonal(self, client):
        resp = await client.get("/api/flora-fauna/flora/seasonal")
        assert resp.status_code == 200
        data = resp.json()
        assert "month" in data and "flowering" in data

    async def test_flora_detail(self, client):
        item = (await client.get("/api/flora-fauna/flora")).json()["flora"][0]
        resp = await client.get(f"/api/flora-fauna/flora/{item['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == item["id"]

    async def test_flora_detail_404(self, client):
        resp = await client.get("/api/flora-fauna/flora/nope-id")
        assert resp.status_code == 404

    async def test_flora_filter_month_out_of_range(self, client):
        resp = await client.get("/api/flora-fauna/flora", params={"mes": 13})
        assert resp.status_code == 422


class TestFauna:
    async def test_list_fauna(self, client):
        resp = await client.get("/api/flora-fauna/fauna")
        assert resp.status_code == 200
        assert "fauna" in resp.json()

    async def test_fauna_rarity(self, client):
        resp = await client.get("/api/flora-fauna/fauna/rarity")
        assert resp.status_code == 200

    async def test_fauna_detail_404(self, client):
        resp = await client.get("/api/flora-fauna/fauna/nope-id")
        assert resp.status_code == 404


class TestHabitatsAndNearby:
    async def test_habitats(self, client):
        resp = await client.get("/api/flora-fauna/habitats")
        assert resp.status_code == 200

    async def test_nearby(self, client):
        resp = await client.get(
            "/api/flora-fauna/nearby",
            params={"lat": 38.7, "lng": -9.1, "radius_km": 200, "tipo": "all"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert data["lat"] == 38.7

    async def test_nearby_requires_coords(self, client):
        resp = await client.get("/api/flora-fauna/nearby")
        assert resp.status_code == 422

    async def test_stats(self, client):
        resp = await client.get("/api/flora-fauna/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "flora" in data and "fauna" in data and "habitats" in data
