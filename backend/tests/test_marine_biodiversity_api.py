"""
Integration tests for the Marine Biodiversity API (marine_biodiversity_api.py).

Endpoints fall back to seed data (SEED_SPECIES, SEED_HABITATS), so these run
without a live MongoDB.
"""
import pytest

import marine_biodiversity_api

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _force_seed(monkeypatch):
    """Force the pure seed-data path (no MongoDB) for deterministic, fast tests."""
    monkeypatch.setattr(marine_biodiversity_api, "_db_or_none", lambda: None)


def _first_id(item):
    return str(item.get("_id", item.get("id", "")))


class TestSpecies:
    async def test_list_species(self, client):
        resp = await client.get("/api/biodiversity/species")
        assert resp.status_code == 200
        data = resp.json()
        assert set(("total", "offset", "limit", "results")).issubset(data)
        assert len(data["results"]) > 0

    async def test_species_seasonal(self, client):
        resp = await client.get("/api/biodiversity/species/seasonal")
        assert resp.status_code == 200
        data = resp.json()
        assert "season" in data and "species" in data

    async def test_species_nearby(self, client):
        resp = await client.get(
            "/api/biodiversity/species/nearby",
            params={"lat": 38.7, "lng": -9.4, "radius_km": 500},
        )
        assert resp.status_code == 200
        assert "results" in resp.json()

    async def test_species_detail(self, client):
        item = (await client.get("/api/biodiversity/species")).json()["results"][0]
        resp = await client.get(f"/api/biodiversity/species/{_first_id(item)}")
        assert resp.status_code == 200

    async def test_species_detail_404(self, client):
        resp = await client.get("/api/biodiversity/species/nope")
        assert resp.status_code == 404


class TestSightingsHabitatsStats:
    async def test_list_sightings(self, client):
        resp = await client.get("/api/biodiversity/sightings")
        assert resp.status_code == 200

    async def test_habitats(self, client):
        resp = await client.get("/api/biodiversity/habitats")
        assert resp.status_code == 200

    async def test_habitat_detail_404(self, client):
        resp = await client.get("/api/biodiversity/habitats/nope")
        assert resp.status_code == 404

    async def test_stats(self, client):
        resp = await client.get("/api/biodiversity/stats")
        assert resp.status_code == 200
        assert isinstance(resp.json(), dict)

    async def test_create_sighting_validation(self, client):
        # Missing required lat/lng -> 422
        resp = await client.post("/api/biodiversity/sightings", json={})
        assert resp.status_code in (401, 422)
