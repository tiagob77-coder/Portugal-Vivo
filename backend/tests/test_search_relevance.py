"""
Smoke tests for the relevance-ranked search endpoints.

We don't assert on actual ranking (depends on whatever heritage_items
happen to be in the test DB), only that:

  · /api/search responds 200 for short and long queries
  · /api/search/global handles both fast-path ($text) and fallback
    (regex) without raising
  · the endpoint accepts filters without breaking when combined with
    the new $text path
"""
import pytest

from conftest import requires_db


@pytest.mark.anyio
@requires_db
async def test_advanced_search_long_query_uses_text_path(client):
    """3+ char queries should hit the $text path and return without error."""
    resp = await client.post("/api/search", json={"query": "lisboa", "limit": 5})
    assert resp.status_code == 200
    body = resp.json()
    assert "results" in body
    assert "total" in body


@pytest.mark.anyio
@requires_db
async def test_advanced_search_short_query_uses_regex_fallback(client):
    """Short queries (< 3 chars) must still return — they fall back to regex."""
    resp = await client.post("/api/search", json={"query": "Li", "limit": 5})
    assert resp.status_code == 200
    body = resp.json()
    assert "results" in body


@pytest.mark.anyio
@requires_db
async def test_advanced_search_with_filters_combines_with_text(client):
    """$text + category filter must compose without 400/500."""
    resp = await client.post(
        "/api/search",
        json={"query": "praia", "categories": ["natureza"], "limit": 5},
    )
    assert resp.status_code == 200


@pytest.mark.anyio
@requires_db
async def test_advanced_search_empty_query_does_not_break(client):
    """Empty query falls through to filter-only search."""
    resp = await client.post("/api/search", json={"query": "", "limit": 5})
    assert resp.status_code == 200


@pytest.mark.anyio
@requires_db
async def test_global_search_text_path(client):
    """Long query → $text on POIs, regex on smaller collections."""
    resp = await client.get("/api/search/global", params={"q": "festa", "limit": 5})
    assert resp.status_code == 200
    body = resp.json()
    assert "results" in body or "groups" in body


@pytest.mark.anyio
@requires_db
async def test_global_search_short_query_returns_empty(client):
    """Single-char queries return the empty payload, not a crash."""
    resp = await client.get("/api/search/global", params={"q": "x", "limit": 5})
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("total") == 0 or body.get("results") == []
