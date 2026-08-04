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
from search_api import name_relevance


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


class TestNameRelevance:
    """name_relevance — pure ranking, no DB needed."""

    def test_exact_match_ranks_first(self):
        assert name_relevance("Faro", "Faro") == 0

    def test_ranking_is_ordered_exact_prefix_contains_miss(self):
        assert (
            name_relevance("Faro", "Faro")
            < name_relevance("Faro Velho", "Faro")
            < name_relevance("Praia de Faro", "Faro")
            < name_relevance("Alfarrobeira", "Faro")
        )

    def test_is_case_and_whitespace_insensitive(self):
        assert name_relevance("  FARO  ", "faro") == 0
        assert name_relevance("Faro Velho", "  FARO ") == 1

    def test_substring_elsewhere_in_the_name_is_not_a_prefix(self):
        # "Faro" appears, but not at the start
        assert name_relevance("Praia de Faro", "Faro") == 2

    def test_no_match_in_name_ranks_last(self):
        # The hit came from description or tags, not the name
        assert name_relevance("Sé de Silves", "Faro") == 3

    def test_missing_name_or_query_ranks_last(self):
        assert name_relevance(None, "Faro") == 3
        assert name_relevance("", "Faro") == 3
        assert name_relevance("Faro", "") == 3
        assert name_relevance("Faro", "   ") == 3

    def test_sorting_a_page_lifts_the_real_match(self):
        page = [
            {"name": "Alfarrobeira"},
            {"name": "Praia de Faro"},
            {"name": "Faro"},
            {"name": "Faro Velho"},
        ]
        page.sort(key=lambda i: name_relevance(i.get("name"), "Faro"))
        assert [i["name"] for i in page] == [
            "Faro", "Faro Velho", "Praia de Faro", "Alfarrobeira",
        ]

    def test_sort_is_stable_within_a_band(self):
        # Two equal-ranked names keep their incoming order (textScore / IQ)
        page = [{"name": "Faro Norte"}, {"name": "Faro Sul"}]
        page.sort(key=lambda i: name_relevance(i.get("name"), "Faro"))
        assert [i["name"] for i in page] == ["Faro Norte", "Faro Sul"]
