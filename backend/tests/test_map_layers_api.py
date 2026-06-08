"""
Integration tests for map_layers_api.py.

All endpoints that depend on MongoDB return empty payloads when _db_or_none()
is None; /layers and /environmental are fully in-memory.
"""
import pytest

import map_layers_api

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _no_db(monkeypatch):
    """Remove DB so all DB-dependent endpoints take the seed/empty path."""
    monkeypatch.setattr(map_layers_api, "_db_or_none", lambda: None)


class TestLayers:
    async def test_layers_returns_definitions(self, client):
        resp = await client.get("/api/map/layers")
        assert resp.status_code == 200
        data = resp.json()
        assert "layers" in data and "total" in data and "groups" in data
        assert data["total"] > 0
        assert data["total"] == len(data["layers"])

    async def test_each_layer_has_required_fields(self, client):
        layers = (await client.get("/api/map/layers")).json()["layers"]
        for layer in layers:
            for key in ("id", "label", "icon", "color", "categories"):
                assert key in layer, f"Missing field '{key}' in layer {layer.get('id')}"

    async def test_groups_are_dict(self, client):
        groups = (await client.get("/api/map/layers")).json()["groups"]
        assert isinstance(groups, dict)
        for v in groups.values():
            assert isinstance(v, list)


class TestPoisNoDb:
    async def test_pois_requires_coords(self, client):
        resp = await client.get("/api/map/pois")
        assert resp.status_code == 422

    async def test_pois_no_db_returns_empty(self, client):
        resp = await client.get(
            "/api/map/pois", params={"lat": 38.7, "lng": -9.1}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["pois"] == []
        assert data["total"] == 0

    async def test_pois_radius_validation(self, client):
        # radius > 100 should fail
        resp = await client.get(
            "/api/map/pois", params={"lat": 38.7, "lng": -9.1, "radius": 500}
        )
        assert resp.status_code == 422


class TestSearchNoDb:
    async def test_search_no_db_returns_empty(self, client):
        resp = await client.post(
            "/api/map/search", json={"q": "castelo"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["results"] == []
        assert data["query"] == "castelo"

    async def test_search_with_coords_no_db(self, client):
        resp = await client.post(
            "/api/map/search",
            json={"q": "praia", "lat": 38.7, "lng": -9.1, "radius_km": 20},
        )
        assert resp.status_code == 200
        assert resp.json()["geo_filtered"] is False  # no DB → early return


class TestTrailsNoDb:
    async def test_trails_no_db_empty(self, client):
        resp = await client.get("/api/map/trails")
        assert resp.status_code == 200
        data = resp.json()
        assert data["trails"] == []
        assert data["total"] == 0

    async def test_trails_bbox_param(self, client):
        resp = await client.get(
            "/api/map/trails",
            params={"bbox": "-9.5,37.0,-6.5,42.0", "difficulty": "facil"},
        )
        assert resp.status_code == 200


class TestEnvironmental:
    async def test_requires_coords(self, client):
        resp = await client.get("/api/map/environmental")
        assert resp.status_code == 422

    async def test_returns_all_fields(self, client):
        resp = await client.get(
            "/api/map/environmental", params={"lat": 38.7, "lng": -9.1}
        )
        assert resp.status_code == 200
        data = resp.json()
        for key in ("wind", "uv", "air_quality", "sunrise", "sunset"):
            assert key in data

    async def test_uv_level_in_valid_range(self, client):
        resp = await client.get(
            "/api/map/environmental", params={"lat": 37.0, "lng": -8.5}
        )
        data = resp.json()
        assert data["uv"]["index"] >= 0
        assert data["uv"]["level"] in ("Baixo", "Moderado", "Alto", "Muito Alto", "Extremo")

    async def test_wind_has_direction(self, client):
        resp = await client.get(
            "/api/map/environmental", params={"lat": 41.0, "lng": -8.6}
        )
        wind = resp.json()["wind"]
        assert "speed_kmh" in wind
        assert "direction" in wind
