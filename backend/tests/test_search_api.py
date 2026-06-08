"""
Integration tests for search_api.py.

All DB-backed endpoints return HTTP 500 when the database is not initialised
(DatabaseHolder raises HTTPException 500). Tests cover:
  - Input validation (422 for missing/invalid params)
  - Pure-logic paths that return without hitting the DB (short query guard)
  - DB-dependent paths are marked @requires_db
"""
import pytest

from conftest import requires_db

pytestmark = pytest.mark.anyio


# ─── Validation (no DB required) ─────────────────────────────────────────────

class TestValidation:
    async def test_search_post_requires_query(self, client):
        resp = await client.post("/api/search", json={})
        assert resp.status_code == 422

    async def test_suggestions_too_short(self, client):
        # q < 2 chars → returns empty immediately, no DB hit
        resp = await client.get("/api/search/suggestions", params={"q": "a"})
        assert resp.status_code == 200
        assert resp.json()["suggestions"] == []

    async def test_global_search_too_short(self, client):
        resp = await client.get("/api/search/global", params={"q": "x"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["results"] == []
        assert data["total"] == 0

    async def test_global_search_empty_query(self, client):
        resp = await client.get("/api/search/global", params={"q": ""})
        assert resp.status_code == 200
        assert resp.json()["results"] == []


# ─── DB-dependent paths ───────────────────────────────────────────────────────

class TestWithDb:
    @requires_db
    async def test_advanced_search_returns_results(self, client):
        resp = await client.post(
            "/api/search",
            json={"query": "castelo", "limit": 10, "skip": 0},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data and "total" in data
        assert data["query"] == "castelo"

    @requires_db
    async def test_advanced_search_short_query(self, client):
        # < 3 chars → regex fallback, not $text
        resp = await client.post("/api/search", json={"query": "li"})
        assert resp.status_code == 200

    @requires_db
    async def test_suggestions_returns_list(self, client):
        resp = await client.get("/api/search/suggestions", params={"q": "cas"})
        assert resp.status_code == 200
        assert "suggestions" in resp.json()

    @requires_db
    async def test_popular_searches(self, client):
        resp = await client.get("/api/search/popular")
        assert resp.status_code == 200
        data = resp.json()
        assert "suggested_searches" in data
        assert len(data["suggested_searches"]) >= 5

    @requires_db
    async def test_global_search(self, client):
        resp = await client.get("/api/search/global", params={"q": "museu"})
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data and "total" in data
        assert "groups" in data

    @requires_db
    async def test_search_category_filter(self, client):
        resp = await client.post(
            "/api/search",
            json={"query": "porto", "categories": ["museus"], "limit": 5},
        )
        assert resp.status_code == 200
        for item in resp.json()["results"]:
            assert item.get("category") == "museus"

    @requires_db
    async def test_search_filters_applied(self, client):
        resp = await client.post(
            "/api/search",
            json={"query": "Lisboa", "regions": ["Lisboa"], "limit": 10},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["filters_applied"]["regions"] == ["Lisboa"]
