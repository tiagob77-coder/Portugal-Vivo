"""
Tests for Curated Collections API (P1-5)
Uses ASGI transport — no external server needed.
"""
import pytest
from conftest import requires_db


@pytest.mark.anyio
async def test_list_collections_empty(client):
    """GET /api/curated-collections returns 200 even with no data."""
    r = await client.get("/api/curated-collections")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.anyio
async def test_get_nonexistent_collection(client):
    """GET /api/curated-collections/{id} with unknown id returns 404."""
    r = await client.get("/api/curated-collections/does-not-exist")
    assert r.status_code == 404


@pytest.mark.anyio
async def test_get_collection_pois_nonexistent(client):
    """GET /api/curated-collections/{id}/pois with unknown id returns 404."""
    r = await client.get("/api/curated-collections/does-not-exist/pois")
    assert r.status_code == 404


@pytest.mark.anyio
async def test_create_collection_requires_auth(client):
    """POST /api/curated-collections without auth returns 401 or 403."""
    payload = {
        "title": "Test Collection",
        "description": "A test collection with enough characters",
        "poi_ids": [],
    }
    r = await client.post("/api/curated-collections", json=payload)
    assert r.status_code in (401, 403)


@pytest.mark.anyio
async def test_list_collections_filters(client):
    """Query params region/tag/search are accepted without error."""
    r = await client.get("/api/curated-collections?region=norte&tag=gastronomia&search=mesa&limit=5")
    assert r.status_code == 200


@pytest.mark.anyio
async def test_list_collections_pagination(client):
    """offset and limit params work."""
    r1 = await client.get("/api/curated-collections?limit=10&offset=0")
    r2 = await client.get("/api/curated-collections?limit=10&offset=100")
    assert r1.status_code == 200
    assert r2.status_code == 200


@pytest.mark.anyio
async def test_update_collection_requires_auth(client):
    """PATCH /api/curated-collections/{id} without auth returns 401 or 403."""
    r = await client.patch("/api/curated-collections/some-id", json={"title": "New"})
    assert r.status_code in (401, 403)


@pytest.mark.anyio
async def test_delete_collection_requires_auth(client):
    """DELETE /api/curated-collections/{id} without auth returns 401 or 403."""
    r = await client.delete("/api/curated-collections/some-id")
    assert r.status_code in (401, 403)


@pytest.mark.anyio
async def test_add_poi_requires_auth(client):
    """POST /api/curated-collections/{id}/pois/{poi_id} without auth returns 401 or 403."""
    r = await client.post("/api/curated-collections/col-id/pois/poi-id")
    assert r.status_code in (401, 403)


@pytest.mark.anyio
async def test_remove_poi_requires_auth(client):
    """DELETE /api/curated-collections/{id}/pois/{poi_id} without auth returns 401 or 403."""
    r = await client.delete("/api/curated-collections/col-id/pois/poi-id")
    assert r.status_code in (401, 403)
