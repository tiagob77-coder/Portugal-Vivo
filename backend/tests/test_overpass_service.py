"""
Unit tests for services/overpass_service.py (OverpassService).

No network access: all HTTP calls are mocked; pure helpers (EuroVelo,
long-distance trails, nearest trail, parsers) are tested without mocking.
"""
from datetime import datetime, timezone, timedelta

import pytest

from services import overpass_service as _module
from services.overpass_service import (
    OverpassService,
    EUROVELO_PT,
    LONG_DISTANCE_TRAILS,
    _haversine_km,
)

pytestmark = pytest.mark.anyio


class _FakeResponse:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _FakeClient:
    def __init__(self, response, **kwargs):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, *args, **kwargs):
        return self._response


def _patch(monkeypatch, response):
    monkeypatch.setattr(
        _module.httpx, "AsyncClient",
        lambda **kw: _FakeClient(response, **kw),
    )


def _patch_raises(monkeypatch):
    def _boom(**kw):
        raise RuntimeError("overpass down")
    monkeypatch.setattr(_module.httpx, "AsyncClient", _boom)


# ─── Pure helpers (no mocking needed) ────────────────────────────────────────

class TestHaversine:
    def test_zero(self):
        assert _haversine_km(38.7, -9.1, 38.7, -9.1) == pytest.approx(0.0, abs=1e-6)

    def test_lisboa_porto(self):
        d = _haversine_km(38.7169, -9.1399, 41.1496, -8.6109)
        assert 250 < d < 320


class TestEuroVelo:
    def test_returns_all_routes(self):
        svc = OverpassService()
        routes = svc.get_eurovelo_routes()
        assert routes is EUROVELO_PT
        assert len(routes) >= 2

    def test_routes_have_required_fields(self):
        svc = OverpassService()
        for r in svc.get_eurovelo_routes():
            assert "id" in r and "name" in r and "distance_km" in r


class TestLongDistanceTrails:
    def test_returns_all(self):
        svc = OverpassService()
        trails = svc.get_long_distance_trails()
        assert len(trails) == len(LONG_DISTANCE_TRAILS)

    def test_filter_by_region(self):
        svc = OverpassService()
        algarve = svc.get_long_distance_trails(region="Algarve")
        assert all("algarve" in t["region"].lower() for t in algarve)
        assert len(algarve) >= 1

    def test_filter_unknown_region_empty(self):
        svc = OverpassService()
        assert svc.get_long_distance_trails(region="Mordor") == []


class TestNearestLongTrail:
    def test_returns_trail_and_distance(self):
        svc = OverpassService()
        result = svc.get_nearest_long_trail(37.0, -8.9)
        assert result is not None
        assert "trail" in result and "distance_km" in result
        assert result["distance_km"] >= 0

    def test_closest_to_gerês_is_gerês(self):
        svc = OverpassService()
        result = svc.get_nearest_long_trail(41.78, -8.10)
        assert "ger" in result["trail"]["id"].lower() or result["distance_km"] < 20


# ─── _parse_trail_elements (pure) ────────────────────────────────────────────

class TestParseTrailElements:
    def test_parses_relation(self):
        svc = OverpassService()
        elements = [
            {"type": "relation", "id": 1, "tags": {"name": "Trilho X", "distance": "5km", "sac_scale": "T1", "network": "lwn"}},
            {"type": "way", "id": 10, "tags": {"name": "Caminho Y", "surface": "dirt"}},
        ]
        trails = svc._parse_trail_elements(elements)
        names = [t["name"] for t in trails]
        assert "Trilho X" in names
        assert "Caminho Y" in names

    def test_empty_elements_returns_empty(self):
        assert OverpassService()._parse_trail_elements([]) == []


class TestParseCyclingElements:
    def test_parses_eurovelo_relation(self):
        svc = OverpassService()
        elements = [
            {"type": "relation", "id": 5, "tags": {"name": "EuroVelo 1", "network": "EuroVelo", "ref": "EV1", "distance": "960km"}},
        ]
        routes = svc._parse_cycling_elements(elements)
        assert len(routes) == 1
        assert routes[0]["type"] == "eurovelo"

    def test_parses_plain_cycling_relation(self):
        svc = OverpassService()
        elements = [{"type": "relation", "id": 9, "tags": {"name": "Ciclovia Local", "network": "lcn"}}]
        routes = svc._parse_cycling_elements(elements)
        assert routes[0]["type"] == "cycling"


# ─── Cache validity ────────────────────────────────────────────────────────────

class TestCache:
    def test_invalid_when_unknown(self):
        assert OverpassService()._is_cache_valid("x") is False

    def test_valid_when_recent(self):
        svc = OverpassService()
        svc._last_fetch["k"] = datetime.now(timezone.utc)
        assert svc._is_cache_valid("k") is True

    def test_expired_is_invalid(self):
        svc = OverpassService()
        svc._last_fetch["k"] = datetime.now(timezone.utc) - timedelta(hours=10)
        assert svc._is_cache_valid("k") is False


# ─── find_hiking_trails (mocked) ──────────────────────────────────────────────

class TestFindHikingTrails:
    async def test_parses_response(self, monkeypatch):
        svc = OverpassService()
        payload = {"elements": [
            {"type": "relation", "id": 42, "tags": {"name": "PR1 Sintra", "sac_scale": "T1", "network": "lwn"}},
        ]}
        _patch(monkeypatch, _FakeResponse(200, payload))
        trails = await svc.find_hiking_trails(38.79, -9.39)
        assert len(trails) == 1
        assert trails[0]["name"] == "PR1 Sintra"

    async def test_error_returns_empty(self, monkeypatch):
        svc = OverpassService()
        _patch(monkeypatch, _FakeResponse(429, {}))
        assert await svc.find_hiking_trails(38.7, -9.1) == []

    async def test_network_error_returns_empty(self, monkeypatch):
        svc = OverpassService()
        _patch_raises(monkeypatch)
        assert await svc.find_hiking_trails(38.7, -9.1) == []

    async def test_cache_hit(self, monkeypatch):
        svc = OverpassService()
        payload = {"elements": [
            {"type": "relation", "id": 1, "tags": {"name": "T"}}
        ]}
        _patch(monkeypatch, _FakeResponse(200, payload))
        first = await svc.find_hiking_trails(38.7, -9.1)
        _patch_raises(monkeypatch)
        second = await svc.find_hiking_trails(38.7, -9.1)
        assert second == first


# ─── find_cycling_routes (mocked) ─────────────────────────────────────────────

class TestFindCyclingRoutes:
    async def test_parses_response(self, monkeypatch):
        svc = OverpassService()
        payload = {"elements": [
            {"type": "relation", "id": 99, "tags": {"name": "Ciclovia Tejo", "network": "ncn"}},
        ]}
        _patch(monkeypatch, _FakeResponse(200, payload))
        routes = await svc.find_cycling_routes(38.7, -9.1)
        assert len(routes) == 1

    async def test_network_error_returns_empty(self, monkeypatch):
        svc = OverpassService()
        _patch_raises(monkeypatch)
        assert await svc.find_cycling_routes(38.7, -9.1) == []
