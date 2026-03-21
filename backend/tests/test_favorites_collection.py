"""
Tests for the refactored Favorites API (P1-5 — dedicated collection).
Uses ASGI transport — no external server needed.
"""
import pytest


@pytest.mark.anyio
async def test_get_favorites_requires_auth(client):
    """GET /api/favorites without auth returns 401 or 403."""
    r = await client.get("/api/favorites")
    assert r.status_code in (401, 403)


@pytest.mark.anyio
async def test_get_favorite_ids_requires_auth(client):
    """GET /api/favorites/ids without auth returns 401 or 403."""
    r = await client.get("/api/favorites/ids")
    assert r.status_code in (401, 403)


@pytest.mark.anyio
async def test_add_favorite_requires_auth(client):
    """POST /api/favorites/{item_id} without auth returns 401 or 403."""
    r = await client.post("/api/favorites/some-poi-id")
    assert r.status_code in (401, 403)


@pytest.mark.anyio
async def test_remove_favorite_requires_auth(client):
    """DELETE /api/favorites/{item_id} without auth returns 401 or 403."""
    r = await client.delete("/api/favorites/some-poi-id")
    assert r.status_code in (401, 403)


@pytest.mark.anyio
async def test_favorites_endpoint_exists(client):
    """Favorites endpoints are registered and reachable (not 404/405)."""
    r = await client.get("/api/favorites")
    # 401/403 = auth required (endpoint exists); 404 = not registered
    assert r.status_code != 404, "GET /api/favorites endpoint not found"

    r2 = await client.post("/api/favorites/test-id")
    assert r2.status_code != 404, "POST /api/favorites/{id} endpoint not found"

    r3 = await client.delete("/api/favorites/test-id")
    assert r3.status_code != 404, "DELETE /api/favorites/{id} endpoint not found"
