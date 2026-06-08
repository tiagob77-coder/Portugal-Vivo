"""
Integration tests for the Costa API (costa_api.py).

The module serves curated in-memory coastal data (COASTAL_ZONES), so these
tests run without a live MongoDB.
"""
import pytest

pytestmark = pytest.mark.anyio


class TestListZones:
    async def test_list_returns_zones(self, client):
        resp = await client.get("/api/costa/")
        assert resp.status_code == 200
        data = resp.json()
        assert "zones" in data
        assert "total" in data
        assert data["total"] == len(data["zones"])
        assert data["total"] > 0

    async def test_list_zone_structure(self, client):
        resp = await client.get("/api/costa/")
        zone = resp.json()["zones"][0]
        for key in ("id", "name", "region", "condicoes", "perfis"):
            assert key in zone
        # list view strips internal detail
        assert "lenda" not in zone
        assert "biodiversidade" not in zone

    async def test_filter_by_region(self, client):
        resp = await client.get("/api/costa/", params={"region": "Algarve"})
        assert resp.status_code == 200
        data = resp.json()
        assert all(z["region"].lower() == "algarve" for z in data["zones"])
        assert data["filters"]["region"] == "Algarve"

    async def test_filter_unknown_region_empty(self, client):
        resp = await client.get("/api/costa/", params={"region": "Atlantis"})
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    async def test_order_by_name(self, client):
        resp = await client.get("/api/costa/", params={"order_by": "name"})
        names = [z["name"] for z in resp.json()["zones"]]
        assert names == sorted(names)

    async def test_sort_by_perfil(self, client):
        resp = await client.get("/api/costa/", params={"perfil": "surfer"})
        assert resp.status_code == 200
        scores = [z["perfis"]["surfer"] for z in resp.json()["zones"]]
        assert scores == sorted(scores, reverse=True)


class TestZoneDetail:
    async def test_detail_includes_conditions(self, client):
        zone_id = (await client.get("/api/costa/")).json()["zones"][0]["id"]
        resp = await client.get(f"/api/costa/{zone_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == zone_id
        assert "conditions" in data
        # detail view restores full fields
        assert "lenda" in data

    async def test_detail_404(self, client):
        resp = await client.get("/api/costa/zona-inexistente")
        assert resp.status_code == 404

    async def test_conditions_structure(self, client):
        zone_id = (await client.get("/api/costa/")).json()["zones"][0]["id"]
        resp = await client.get(f"/api/costa/{zone_id}/conditions")
        assert resp.status_code == 200
        data = resp.json()
        for key in ("ondas", "vento", "ambiental", "seguranca", "timestamp"):
            assert key in data

    async def test_conditions_404(self, client):
        resp = await client.get("/api/costa/nope/conditions")
        assert resp.status_code == 404


class TestCompareZones:
    async def test_compare_two_zones(self, client):
        zones = (await client.get("/api/costa/")).json()["zones"]
        a, b = zones[0]["id"], zones[1]["id"]
        resp = await client.get(f"/api/costa/compare/{a}/{b}")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["zones"]) == 2
        assert "comparison" in data
        assert "melhor_surfer" in data["comparison"]

    async def test_compare_unknown_zone_a(self, client):
        b = (await client.get("/api/costa/")).json()["zones"][0]["id"]
        resp = await client.get(f"/api/costa/compare/nope/{b}")
        assert resp.status_code == 404
