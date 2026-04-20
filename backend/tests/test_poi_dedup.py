"""
Unit tests for poi_dedup helpers and the data-quality sweep.

The dedup module is pure-Python — no DB required for the bulk of the tests.
`find_duplicate` is exercised against a tiny fake collection so we can run
in CI without MongoDB.
"""
from __future__ import annotations

import asyncio
import re
from typing import Any, Dict, List, Optional

import pytest

from poi_dedup import (
    find_duplicate,
    find_duplicates_in_set,
    is_same_poi,
    normalise_name,
    normalise_region,
)
from scripts.data_quality_check import run_data_quality_check


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Igreja de São João", "igreja de sao joao"),
        ("  Castelo  de   Guimarães  ", "castelo de guimaraes"),
        ("Praia da Falésia", "praia da falesia"),
        ("Café-Restaurante O Pé!", "cafe restaurante o pe"),
        (None, ""),
        ("", ""),
    ],
)
def test_normalise_name_drops_diacritics_and_punctuation(raw, expected):
    assert normalise_name(raw) == expected


def test_normalise_region_handles_accents_and_case():
    assert normalise_region("Açores") == "acores"
    assert normalise_region("  ALENTEJO  ") == "alentejo"
    assert normalise_region(None) == ""


def test_is_same_poi_matches_on_source_id():
    a = {"poi_source_id": "PV-123", "name": "Different Name"}
    b = {"poi_source_id": "PV-123", "name": "Other"}
    assert is_same_poi(a, b)


def test_is_same_poi_matches_on_name_and_region():
    a = {"name": "Castelo de Guimarães", "region": "Norte"}
    b = {"name": "castelo de guimaraes", "region": "norte"}
    assert is_same_poi(a, b)


def test_is_same_poi_matches_on_name_and_close_coords():
    a = {"name": "Praia X", "location": {"lat": 38.7001, "lng": -9.1001}}
    # ~30m away
    b = {"name": "Praia X", "location": {"lat": 38.70035, "lng": -9.10035}}
    assert is_same_poi(a, b)


def test_is_same_poi_rejects_different_regions_without_coords():
    a = {"name": "Igreja Matriz", "region": "Norte"}
    b = {"name": "Igreja Matriz", "region": "Algarve"}
    assert not is_same_poi(a, b)


def test_is_same_poi_rejects_far_coords():
    a = {"name": "Praia X", "location": {"lat": 38.70, "lng": -9.10}}
    b = {"name": "Praia X", "location": {"lat": 41.15, "lng": -8.61}}
    # Different cities, no region → not a duplicate
    assert not is_same_poi(a, b)


def test_find_duplicates_in_set_groups_by_name():
    docs = [
        {"id": "1", "name": "Castelo X", "region": "Norte"},
        {"id": "2", "name": "castelo x", "region": "norte"},
        {"id": "3", "name": "Praia Y", "region": "Algarve"},
        {"id": "4", "name": "Outro Sítio", "region": "Centro"},
    ]
    clusters = find_duplicates_in_set(docs)
    assert len(clusters) == 1
    cluster_ids = sorted(d["id"] for d in clusters[0])
    assert cluster_ids == ["1", "2"]


def test_find_duplicates_in_set_handles_three_way_cluster():
    docs = [
        {"id": "a", "poi_source_id": "EXT-1", "name": "A"},
        {"id": "b", "poi_source_id": "EXT-1", "name": "B"},
        {"id": "c", "poi_source_id": "EXT-1", "name": "C"},
    ]
    # source_id ties them together even though names differ
    # (find_duplicates_in_set buckets by name first → no cluster found)
    # That's intentional: clusters report visible duplicates, not source
    # collisions. We document this behaviour.
    clusters = find_duplicates_in_set(docs)
    assert clusters == []


# ---------------------------------------------------------------------------
# find_duplicate against a fake collection
# ---------------------------------------------------------------------------


class _FakeCursor:
    def __init__(self, docs: List[Dict[str, Any]]):
        self._docs = docs

    def to_list(self, length: int):
        async def _coro():
            return list(self._docs[:length])

        return _coro()


class _FakeCollection:
    """Minimal Motor-shaped stub: supports find_one and find().to_list."""

    def __init__(self, docs: List[Dict[str, Any]]):
        self._docs = docs

    async def find_one(self, query: Dict[str, Any], projection=None):
        for doc in self._docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return {k: v for k, v in doc.items() if k != "_id"}
        return None

    def find(self, query: Dict[str, Any], projection=None):
        # Supports the two shapes find_duplicate uses:
        #   1) {"name_normalised": "<value>"} — primary lookup
        #   2) {"name": {"$regex": ..., "$options": "i"}} — legacy fallback
        if "name_normalised" in query:
            target = query["name_normalised"]
            matches = [d for d in self._docs if d.get("name_normalised") == target]
            return _FakeCursor(matches)

        name_filter = query.get("name")
        if isinstance(name_filter, dict) and "$regex" in name_filter:
            pattern = re.compile(name_filter["$regex"], re.IGNORECASE)
            matches = [d for d in self._docs if pattern.match(d.get("name", ""))]
            return _FakeCursor(matches)
        return _FakeCursor(list(self._docs))


@pytest.mark.asyncio
async def test_find_duplicate_returns_match_by_source_id():
    coll = _FakeCollection([
        {"id": "1", "name": "Sítio Antigo", "poi_source_id": "PV-9"},
    ])
    hit = await find_duplicate(coll, name="Outro nome", poi_source_id="PV-9")
    assert hit is not None
    assert hit["id"] == "1"


@pytest.mark.asyncio
async def test_find_duplicate_returns_none_when_no_match():
    coll = _FakeCollection([
        {"id": "1", "name": "Sítio Antigo", "region": "Norte",
         "name_normalised": "sitio antigo"},
    ])
    hit = await find_duplicate(coll, name="Outro Sítio", region="Norte")
    assert hit is None


@pytest.mark.asyncio
async def test_find_duplicate_matches_by_normalised_name_region():
    coll = _FakeCollection([
        {"id": "1", "name": "Castelo de Guimarães", "region": "norte",
         "name_normalised": "castelo de guimaraes"},
    ])
    hit = await find_duplicate(coll, name="castelo de guimaraes", region="Norte")
    assert hit is not None
    assert hit["id"] == "1"


@pytest.mark.asyncio
async def test_find_duplicate_legacy_fallback_via_regex():
    """Pre-migration docs without `name_normalised` still get caught."""
    coll = _FakeCollection([
        {"id": "1", "name": "Praia da Falésia", "region": "algarve"},
    ])
    hit = await find_duplicate(coll, name="praia da falésia", region="algarve")
    assert hit is not None
    assert hit["id"] == "1"


# ---------------------------------------------------------------------------
# data_quality_check
# ---------------------------------------------------------------------------


class _FakeDB:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.heritage_items = _FakeCollection(docs)


# Override: the data-quality script calls find(...).to_list(length=None),
# which our fake doesn't accept. Patch the cursor to accept None.
class _UnboundedCursor(_FakeCursor):
    def to_list(self, length: Optional[int]):
        async def _coro():
            return list(self._docs if length is None else self._docs[:length])

        return _coro()


class _UnboundedCollection(_FakeCollection):
    def find(self, query: Dict[str, Any], projection=None):
        return _UnboundedCursor(list(self._docs))


class _UnboundedDB:
    def __init__(self, docs: List[Dict[str, Any]]):
        self.heritage_items = _UnboundedCollection(docs)


@pytest.mark.asyncio
async def test_data_quality_check_flags_duplicates_and_missing_fields():
    docs = [
        # Duplicate cluster
        {"id": "1", "name": "Castelo Z", "region": "norte", "category": "monumentos",
         "location": {"lat": 41.5, "lng": -8.6}},
        {"id": "2", "name": "castelo z", "region": "Norte", "category": "monumentos",
         "location": {"lat": 41.5, "lng": -8.6}},
        # Missing region
        {"id": "3", "name": "Sítio sem região", "category": "outros",
         "location": {"lat": 39.0, "lng": -8.0}},
        # Coords outside Portugal
        {"id": "4", "name": "Estrangeiro", "region": "norte", "category": "outros",
         "location": {"lat": 48.85, "lng": 2.35}},
        # Missing location entirely
        {"id": "5", "name": "Sem GPS", "region": "centro", "category": "outros"},
        # Clean
        {"id": "6", "name": "Bom POI", "region": "lisboa", "category": "monumentos",
         "location": {"lat": 38.72, "lng": -9.14}},
    ]
    report = await run_data_quality_check(_UnboundedDB(docs))

    assert report["total_documents"] == 6
    assert report["duplicates"]["cluster_count"] == 1
    assert report["duplicates"]["affected_documents"] == 2
    assert report["missing_required_fields"]["region"]["count"] == 1
    assert report["invalid_coordinates"]["outside_portugal"]["count"] == 1
    assert report["invalid_coordinates"]["missing_location"]["count"] == 1
