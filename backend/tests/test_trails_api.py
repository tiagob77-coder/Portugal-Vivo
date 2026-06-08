"""
Integration tests for trails_api.py.

Read endpoints use DatabaseHolder so they return 500 without a DB.
Tests focus on:
  - Input validation (422) for required/invalid params
  - Auth guard on write/protected endpoints (401/403)
  - Correct 404 on missing resources (requires DB; marked @requires_db)
  - GPX upload validation (payload checks, no DB required for some paths)
"""
import io
import pytest

from conftest import requires_db

pytestmark = pytest.mark.anyio


# ─── Input validation (no DB required) ───────────────────────────────────────

class TestValidation:
    async def test_nearby_requires_lat_lon(self, client):
        resp = await client.get("/api/trails/nearby")
        assert resp.status_code == 422

    async def test_nearby_invalid_lat(self, client):
        resp = await client.get(
            "/api/trails/nearby", params={"lat": "abc", "lon": -9.1}
        )
        assert resp.status_code == 422

    async def test_upload_requires_auth(self, client):
        import io
        resp = await client.post(
            "/api/trails/upload",
            files={"file": ("test.gpx", io.BytesIO(b"<gpx/>"), "application/gpx+xml")},
        )
        assert resp.status_code in (401, 403, 422)


# ─── Auth guards ─────────────────────────────────────────────────────────────

class TestAuthGuards:
    async def test_track_requires_auth(self, client):
        resp = await client.post(
            "/api/trails/some-trail-id/track",
            json={"lat": 38.7, "lng": -9.1, "action": "start"},
        )
        assert resp.status_code in (401, 403, 422)


# ─── With DB ─────────────────────────────────────────────────────────────────

class TestWithDb:
    @requires_db
    async def test_list_returns_pagination(self, client):
        resp = await client.get("/api/trails", params={"limit": 5, "offset": 0})
        assert resp.status_code == 200
        data = resp.json()
        assert "trails" in data and "total" in data

    @requires_db
    async def test_nearby_returns_result(self, client):
        resp = await client.get(
            "/api/trails/nearby",
            params={"lat": 38.7, "lon": -9.1, "dist_km": 50},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "trails" in data

    @requires_db
    async def test_trail_404(self, client):
        resp = await client.get("/api/trails/trail-does-not-exist-xyz")
        assert resp.status_code == 404

    @requires_db
    async def test_audit_returns_summary(self, client):
        resp = await client.get("/api/trails/audit")
        assert resp.status_code == 200
        data = resp.json()
        assert "summary" in data
        assert "total" in data["summary"]

    @requires_db
    async def test_gpx_export_404(self, client):
        resp = await client.get("/api/trails/nonexistent-trail-xyz/export/gpx")
        assert resp.status_code == 404

    @requires_db
    async def test_segments_404(self, client):
        resp = await client.get("/api/trails/nonexistent-trail-xyz/segments")
        assert resp.status_code == 404

    @requires_db
    async def test_elevation_404(self, client):
        resp = await client.get("/api/trails/elevation/nonexistent-trail-xyz")
        assert resp.status_code == 404
