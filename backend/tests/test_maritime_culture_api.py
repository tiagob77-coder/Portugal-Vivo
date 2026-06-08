"""
Integration tests for the Maritime Culture API (maritime_culture_api.py).

Endpoints fall back to seed data (SEED_EVENTS), so these run without a live
MongoDB.
"""
import pytest

import maritime_culture_api

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _force_seed(monkeypatch):
    """Force the pure seed-data path (no MongoDB) for deterministic, fast tests."""
    monkeypatch.setattr(maritime_culture_api, "_db_or_none", lambda: None)


def _first_id(item):
    return str(item.get("_id", item.get("id", "")))


class TestEvents:
    async def test_list_events(self, client):
        resp = await client.get("/api/maritime-culture/events")
        assert resp.status_code == 200
        data = resp.json()
        assert set(("total", "offset", "limit", "results")).issubset(data)
        assert len(data["results"]) > 0
        assert all("is_upcoming" in e for e in data["results"])

    async def test_events_sorted_by_month(self, client):
        results = (await client.get("/api/maritime-culture/events")).json()["results"]
        months = [e.get("month", 13) for e in results]
        assert months == sorted(months)

    async def test_filter_by_month(self, client):
        resp = await client.get(
            "/api/maritime-culture/events", params={"month": 8}
        )
        assert resp.status_code == 200
        assert all(e.get("month") == 8 for e in resp.json()["results"])

    async def test_month_validation(self, client):
        resp = await client.get(
            "/api/maritime-culture/events", params={"month": 99}
        )
        assert resp.status_code == 422

    async def test_upcoming(self, client):
        resp = await client.get("/api/maritime-culture/events/upcoming")
        assert resp.status_code == 200
        assert "current_month" in resp.json()

    async def test_nearby(self, client):
        resp = await client.get(
            "/api/maritime-culture/events/nearby",
            params={"lat": 38.7, "lng": -9.1, "radius_km": 500},
        )
        assert resp.status_code == 200
        assert "results" in resp.json()

    async def test_event_detail(self, client):
        item = (await client.get("/api/maritime-culture/events")).json()["results"][0]
        resp = await client.get(f"/api/maritime-culture/events/{_first_id(item)}")
        assert resp.status_code == 200
        assert "is_upcoming" in resp.json()

    async def test_event_detail_404(self, client):
        resp = await client.get("/api/maritime-culture/events/nope")
        assert resp.status_code == 404


class TestRoutesStats:
    async def test_routes(self, client):
        resp = await client.get("/api/maritime-culture/routes")
        assert resp.status_code == 200

    async def test_stats(self, client):
        resp = await client.get("/api/maritime-culture/stats")
        assert resp.status_code == 200
        assert isinstance(resp.json(), dict)
