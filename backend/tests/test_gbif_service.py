"""
Unit tests for services/gbif_service.py (GBIFService).

No network access: HTTP calls are mocked; pure helpers (notable species,
cache validity) are tested directly.
"""
from datetime import datetime, timezone, timedelta

import pytest

from services import gbif_service
from services.gbif_service import GBIFService, NOTABLE_PT_SPECIES

pytestmark = pytest.mark.anyio


class _FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _FakeClient:
    """Returns queued responses in order for successive .get() calls."""

    def __init__(self, responses, **kwargs):
        self._responses = list(responses)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, *args, **kwargs):
        if len(self._responses) > 1:
            return self._responses.pop(0)
        return self._responses[0]


def _patch(monkeypatch, *responses):
    monkeypatch.setattr(
        gbif_service.httpx,
        "AsyncClient",
        lambda **kw: _FakeClient(responses, **kw),
    )


def _patch_raises(monkeypatch):
    def _boom(**kw):
        raise RuntimeError("network down")
    monkeypatch.setattr(gbif_service.httpx, "AsyncClient", _boom)


# ─── Notable species (pure) ──────────────────────────────────────────────────

class TestNotableSpecies:
    def test_returns_all(self):
        svc = GBIFService()
        assert svc.get_notable_species() == NOTABLE_PT_SPECIES
        assert len(NOTABLE_PT_SPECIES) > 0

    def test_filter_by_region(self):
        svc = GBIFService()
        algarve = svc.get_notable_species(region="Algarve")
        assert all(
            any("algarve" in r.lower() for r in s["regions"]) for s in algarve
        )
        assert len(algarve) >= 1

    def test_filter_unknown_region_empty(self):
        svc = GBIFService()
        assert svc.get_notable_species(region="Mordor") == []


class TestCacheValidity:
    def test_invalid_when_unknown(self):
        svc = GBIFService()
        assert svc._is_cache_valid("nope") is False

    def test_valid_when_recent(self):
        svc = GBIFService()
        svc._last_fetch["k"] = datetime.now(timezone.utc)
        assert svc._is_cache_valid("k") is True

    def test_invalid_when_expired(self):
        svc = GBIFService()
        svc._last_fetch["k"] = datetime.now(timezone.utc) - timedelta(hours=5)
        assert svc._is_cache_valid("k") is False


# ─── search_species_near (mocked) ────────────────────────────────────────────

class TestSearchSpeciesNear:
    async def test_parses_and_dedups(self, monkeypatch):
        svc = GBIFService()
        payload = {
            "results": [
                {"key": 1, "species": "Lynx pardinus", "scientificName": "Lynx pardinus",
                 "kingdom": "Animalia", "decimalLatitude": 37.5, "decimalLongitude": -8.0},
                {"key": 2, "species": "Lynx pardinus", "scientificName": "Lynx pardinus"},
                {"key": 3, "species": "Otis tarda", "scientificName": "Otis tarda"},
            ]
        }
        _patch(monkeypatch, _FakeResponse(200, payload))
        results = await svc.search_species_near(37.5, -8.0)
        species = [r["species"] for r in results]
        assert species == ["Lynx pardinus", "Otis tarda"]  # deduped

    async def test_network_error_returns_empty(self, monkeypatch):
        svc = GBIFService()
        _patch_raises(monkeypatch)
        assert await svc.search_species_near(37.5, -8.0) == []

    async def test_non_200_returns_empty(self, monkeypatch):
        svc = GBIFService()
        _patch(monkeypatch, _FakeResponse(503, {}))
        assert await svc.search_species_near(37.5, -8.0) == []


# ─── get_species_count_by_area (mocked) ──────────────────────────────────────

class TestSpeciesCount:
    async def test_parses_facets(self, monkeypatch):
        svc = GBIFService()
        payload = {
            "count": 1234,
            "facets": [
                {"field": "KINGDOM", "counts": [
                    {"name": "Animalia", "count": 800},
                    {"name": "Plantae", "count": 434},
                ]},
            ],
        }
        _patch(monkeypatch, _FakeResponse(200, payload))
        result = await svc.get_species_count_by_area(37.5, -8.0)
        assert result["total_occurrences"] == 1234
        assert result["kingdoms"]["Animalia"] == 800
        assert result["kingdoms"]["Plantae"] == 434

    async def test_error_returns_default(self, monkeypatch):
        svc = GBIFService()
        _patch_raises(monkeypatch)
        result = await svc.get_species_count_by_area(37.5, -8.0)
        assert result["total_occurrences"] == 0
        assert result["kingdoms"] == {}


# ─── get_species_details (mocked) ────────────────────────────────────────────

class TestSpeciesDetails:
    async def test_parses_details_and_media(self, monkeypatch):
        svc = GBIFService()
        species_payload = {
            "key": 2435240, "scientificName": "Lynx pardinus",
            "canonicalName": "Lynx pardinus", "kingdom": "Animalia",
        }
        media_payload = {"results": [
            {"identifier": "http://img/1.jpg"},
            {"identifier": "http://img/2.jpg"},
        ]}
        _patch(monkeypatch, _FakeResponse(200, species_payload), _FakeResponse(200, media_payload))
        result = await svc.get_species_details(2435240)
        assert result["taxon_key"] == 2435240
        assert result["scientific_name"] == "Lynx pardinus"
        assert len(result["images"]) == 2

    async def test_error_returns_none(self, monkeypatch):
        svc = GBIFService()
        _patch_raises(monkeypatch)
        assert await svc.get_species_details(123) is None
