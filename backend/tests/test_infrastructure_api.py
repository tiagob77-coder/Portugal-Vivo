"""
Integration tests for the Infrastructure API (infrastructure_api.py).

Endpoints fall back to seed data (SEED_INFRA), so these run without a live
MongoDB.
"""
import pytest

import infrastructure_api

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _force_seed(monkeypatch):
    """Force the pure seed-data path (no MongoDB) for deterministic, fast tests."""
    monkeypatch.setattr(infrastructure_api, "_db_or_none", lambda: None)


def _first_id(item):
    return str(item.get("_id", item.get("id", "")))


class TestList:
    async def test_list(self, client):
        resp = await client.get("/api/infrastructure/list")
        assert resp.status_code == 200
        data = resp.json()
        assert set(("total", "offset", "limit", "results")).issubset(data)
        assert len(data["results"]) > 0

    async def test_filter_accessible(self, client):
        resp = await client.get(
            "/api/infrastructure/list", params={"accessible": True}
        )
        assert resp.status_code == 200
        assert all(i.get("is_accessible") for i in resp.json()["results"])

    async def test_detail(self, client):
        item = (await client.get("/api/infrastructure/list")).json()["results"][0]
        resp = await client.get(f"/api/infrastructure/{_first_id(item)}")
        assert resp.status_code == 200

    async def test_detail_404(self, client):
        resp = await client.get("/api/infrastructure/nope-xyz")
        assert resp.status_code == 404


class TestTypedListings:
    @pytest.mark.parametrize(
        "path,expected_types",
        [
            ("/passadi%C3%A7os", {"passadico"}),
            ("/pontes-suspensas", {"ponte_suspensa"}),
            ("/ecovias", {"ecovia", "via_verde"}),
            ("/miradouros", {"miradouro", "torre_observacao"}),
        ],
    )
    async def test_typed_listing(self, client, path, expected_types):
        resp = await client.get(f"/api/infrastructure{path}")
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert all(i.get("type") in expected_types for i in data["results"])

    async def test_nearby(self, client):
        resp = await client.get(
            "/api/infrastructure/nearby",
            params={"lat": 40.0, "lng": -8.0, "radius_km": 300},
        )
        assert resp.status_code == 200
        results = resp.json()["results"]
        dists = [r["distance_km"] for r in results]
        assert dists == sorted(dists)

    async def test_stats_summary(self, client):
        resp = await client.get("/api/infrastructure/stats/summary")
        assert resp.status_code == 200
        assert isinstance(resp.json(), dict)
