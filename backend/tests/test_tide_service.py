"""
Unit tests for services/tide_service.py (StormglassTideService).

No network access: the calculated (astronomical) fallback runs when no API key
is present, and the real-API path is exercised with a mocked httpx client.
"""
import pytest

from services import tide_service
from services.tide_service import StormglassTideService, TIDE_POINTS_PT

pytestmark = pytest.mark.anyio


# ─── Mock httpx helpers ──────────────────────────────────────────────────────

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

    async def get(self, *args, **kwargs):
        return self._response


def _patch_httpx(monkeypatch, response):
    monkeypatch.setattr(
        tide_service.httpx,
        "AsyncClient",
        lambda **kw: _FakeClient(response, **kw),
    )


# ─── Pure helpers ────────────────────────────────────────────────────────────

class TestHaversineAndStations:
    def test_haversine_zero(self):
        svc = StormglassTideService()
        assert svc._haversine(38.7, -9.1, 38.7, -9.1) == pytest.approx(0.0, abs=1e-6)

    def test_haversine_known_distance(self):
        svc = StormglassTideService()
        # Lisboa -> Porto ~ 270-280 km great circle
        d = svc._haversine(38.7223, -9.1393, 41.1496, -8.6109)
        assert 250 < d < 320

    def test_nearest_station_cascais(self):
        svc = StormglassTideService()
        near = svc._find_nearest_station(38.6929, -9.4215)
        assert near["id"] == "cascais"
        assert near["distance_km"] == pytest.approx(0.0, abs=0.5)

    def test_nearest_station_algarve(self):
        svc = StormglassTideService()
        near = svc._find_nearest_station(37.02, -7.93)  # near Faro
        assert near["id"] == "faro"

    def test_all_stations_have_coords(self):
        for station in TIDE_POINTS_PT.values():
            assert "lat" in station and "lng" in station


# ─── Calculated fallback ─────────────────────────────────────────────────────

class TestCalculatedTides:
    async def test_structure(self):
        svc = StormglassTideService()
        result = await svc._get_calculated_tides(38.69, -9.42)
        assert result["source"] == "calculated"
        assert result["api_type"] == "astronomical_approximation"
        assert result["current"]["state"] in ("rising", "falling")
        assert result["tide_type"] in ("spring", "neap", "moderate")
        assert 0.0 <= result["moon_phase"] <= 1.0

    async def test_has_next_extremes(self):
        svc = StormglassTideService()
        result = await svc._get_calculated_tides(41.18, -8.70)
        assert result["next_high_tide"]["type"] == "high"
        assert result["next_low_tide"]["type"] == "low"
        assert len(result["extremes_today"]) == 4

    async def test_no_api_key_uses_calculated(self, monkeypatch):
        monkeypatch.delenv("STORMGLASS_API_KEY", raising=False)
        svc = StormglassTideService()
        assert svc.api_key is None
        result = await svc.get_tide_extremes(38.69, -9.42)
        assert result["source"] == "calculated"

    async def test_get_current_tide_calculated(self):
        svc = StormglassTideService()
        svc.api_key = None
        result = await svc.get_current_tide(38.69, -9.42)
        assert result["source"] == "calculated"


# ─── Real API path (mocked) ──────────────────────────────────────────────────

class TestRealApiPath:
    async def test_real_data_parsed(self, monkeypatch):
        svc = StormglassTideService()
        svc.api_key = "fake-key"
        payload = {
            "data": [
                {"type": "high", "time": "2026-06-08T06:00:00+00:00", "height": 3.2},
                {"type": "low", "time": "2026-06-08T12:00:00+00:00", "height": 0.7},
            ]
        }
        _patch_httpx(monkeypatch, _FakeResponse(200, payload))
        result = await svc.get_tide_extremes(38.69, -9.42)
        assert result["source"] == "stormglass"
        assert result["api_type"] == "real"
        assert len(result["extremes"]) == 2
        assert result["extremes"][0]["type"] == "high"
        assert result["extremes"][0]["height_m"] == 3.2

    async def test_quota_exhausted_falls_back(self, monkeypatch):
        svc = StormglassTideService()
        svc.api_key = "fake-key"
        _patch_httpx(monkeypatch, _FakeResponse(402, {}))
        result = await svc.get_tide_extremes(38.69, -9.42)
        assert result["source"] == "calculated"

    async def test_api_error_falls_back(self, monkeypatch):
        svc = StormglassTideService()
        svc.api_key = "fake-key"
        _patch_httpx(monkeypatch, _FakeResponse(500, {}))
        result = await svc.get_tide_extremes(38.69, -9.42)
        assert result["source"] == "calculated"

    async def test_cache_hit(self, monkeypatch):
        svc = StormglassTideService()
        svc.api_key = "fake-key"
        payload = {"data": [{"type": "high", "time": "t", "height": 2.0}]}
        _patch_httpx(monkeypatch, _FakeResponse(200, payload))
        first = await svc.get_tide_extremes(38.69, -9.42)
        # Break the network: a cache hit must avoid calling httpx again
        _patch_httpx(monkeypatch, _FakeResponse(500, {}))
        second = await svc.get_tide_extremes(38.69, -9.42)
        assert second == first
