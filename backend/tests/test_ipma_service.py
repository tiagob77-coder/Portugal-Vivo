"""
Unit tests for services/ipma_service.py (IPMAService).

All HTTP calls are mocked — no network access required.
"""
from datetime import datetime, timezone, timedelta

import pytest

from services import ipma_service as _module
from services.ipma_service import IPMAService

pytestmark = pytest.mark.anyio


# ─── Mock helpers ─────────────────────────────────────────────────────────────

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


def _patch(monkeypatch, response):
    monkeypatch.setattr(
        _module.httpx, "AsyncClient",
        lambda **kw: _FakeClient(response, **kw),
    )


def _patch_raises(monkeypatch):
    def _boom(**kw):
        raise RuntimeError("network down")
    monkeypatch.setattr(_module.httpx, "AsyncClient", _boom)


# ─── Pure helpers ─────────────────────────────────────────────────────────────

class TestPureHelpers:
    def test_map_alert_type_known(self):
        svc = IPMAService()
        from services.ipma_service import AlertType
        assert svc._map_alert_type("Vento") == AlertType.WIND
        assert svc._map_alert_type("Precipitação") == AlertType.RAIN
        assert svc._map_alert_type("Neve") == AlertType.SNOW

    def test_map_alert_type_unknown_defaults_wind(self):
        svc = IPMAService()
        from services.ipma_service import AlertType
        assert svc._map_alert_type("Terremoto") == AlertType.WIND

    def test_map_alert_level_known(self):
        svc = IPMAService()
        from services.ipma_service import AlertLevel
        assert svc._map_alert_level("yellow") == AlertLevel.YELLOW
        assert svc._map_alert_level("ORANGE") == AlertLevel.ORANGE
        assert svc._map_alert_level("red") == AlertLevel.RED

    def test_map_alert_level_unknown_defaults_green(self):
        svc = IPMAService()
        from services.ipma_service import AlertLevel
        assert svc._map_alert_level("purple") == AlertLevel.GREEN

    def test_get_location_id(self):
        svc = IPMAService()
        lid = svc.get_location_id("lisboa")
        assert lid is None or isinstance(lid, int)

    def test_get_district_id(self):
        svc = IPMAService()
        did = svc.get_district_id("faro")
        assert did is None or isinstance(did, int)

    def test_cache_validity(self):
        svc = IPMAService()
        assert svc._is_cache_valid("x") is False
        svc._last_fetch["x"] = datetime.now(timezone.utc)
        assert svc._is_cache_valid("x") is True
        svc._last_fetch["x"] = datetime.now(timezone.utc) - timedelta(hours=2)
        assert svc._is_cache_valid("x") is False


# ─── get_weather_alerts ────────────────────────────────────────────────────────

class TestWeatherAlerts:
    async def test_parses_list_response(self, monkeypatch):
        svc = IPMAService()
        now = "2026-06-08T10:00:00Z"
        later = "2026-06-08T20:00:00Z"
        payload = [
            {
                "idAreaAviso": "LVT",
                "awarenessTypeName": "Vento",
                "awarenessLevelID": "yellow",
                "areaDesc": "Lisboa e Vale do Tejo",
                "text": "Vento forte",
                "startTime": now,
                "endTime": later,
            }
        ]
        _patch(monkeypatch, _FakeResponse(200, payload))
        alerts = await svc.get_weather_alerts()
        assert len(alerts) == 1
        from services.ipma_service import AlertType, AlertLevel
        assert alerts[0].type == AlertType.WIND
        assert alerts[0].level == AlertLevel.YELLOW
        assert alerts[0].region == "Lisboa e Vale do Tejo"

    async def test_parses_dict_response(self, monkeypatch):
        svc = IPMAService()
        now = "2026-06-08T10:00:00Z"
        later = "2026-06-08T20:00:00Z"
        payload = {"data": [
            {
                "idAreaAviso": "ALS",
                "awarenessTypeName": "Precipitação",
                "awarenessLevelID": "orange",
                "areaDesc": "Alentejo Sul",
                "text": "Chuva intensa",
                "startTime": now,
                "endTime": later,
            }
        ]}
        _patch(monkeypatch, _FakeResponse(200, payload))
        alerts = await svc.get_weather_alerts()
        assert len(alerts) == 1

    async def test_api_error_returns_empty(self, monkeypatch):
        svc = IPMAService()
        _patch(monkeypatch, _FakeResponse(503, {}))
        assert await svc.get_weather_alerts() == []

    async def test_network_error_returns_empty(self, monkeypatch):
        svc = IPMAService()
        _patch_raises(monkeypatch)
        assert await svc.get_weather_alerts() == []

    async def test_cache_hit(self, monkeypatch):
        svc = IPMAService()
        now = "2026-06-08T10:00:00Z"
        later = "2026-06-08T20:00:00Z"
        payload = [{"idAreaAviso": "x", "awarenessTypeName": "Vento",
                    "awarenessLevelID": "green", "areaDesc": "A",
                    "text": "t", "startTime": now, "endTime": later}]
        _patch(monkeypatch, _FakeResponse(200, payload))
        first = await svc.get_weather_alerts()
        # Break network — cache should be used
        _patch_raises(monkeypatch)
        second = await svc.get_weather_alerts()
        assert second == first


# ─── get_forecast ──────────────────────────────────────────────────────────────

class TestForecast:
    async def test_parses_5day_forecast(self, monkeypatch):
        svc = IPMAService()
        payload = {
            "globalIdLocal": 1110600,
            "data": [
                {
                    "forecastDate": "2026-06-08",
                    "tMin": "14.0", "tMax": "24.0",
                    "precipitaProb": "10.0",
                    "predWindDir": "N",
                    "classWindSpeed": 2,
                    "idWeatherType": 1,
                },
                {
                    "forecastDate": "2026-06-09",
                    "tMin": "15.0", "tMax": "25.0",
                    "precipitaProb": "5.0",
                    "predWindDir": "NW",
                    "classWindSpeed": 1,
                    "idWeatherType": 3,
                },
            ],
        }
        _patch(monkeypatch, _FakeResponse(200, payload))
        forecasts = await svc.get_forecast(1110600)
        assert len(forecasts) == 2
        assert forecasts[0].date == "2026-06-08"
        assert forecasts[0].temp_min == 14.0
        assert forecasts[0].location_id == 1110600

    async def test_error_returns_empty(self, monkeypatch):
        svc = IPMAService()
        _patch(monkeypatch, _FakeResponse(404, {}))
        assert await svc.get_forecast(9999) == []

    async def test_network_error_returns_empty(self, monkeypatch):
        svc = IPMAService()
        _patch_raises(monkeypatch)
        assert await svc.get_forecast(1110600) == []


# ─── get_sea_conditions ────────────────────────────────────────────────────────

class TestSeaConditions:
    async def test_returns_matching_location(self, monkeypatch):
        svc = IPMAService()
        payload = {"data": [
            {"globalIdLocal": 1010500, "local": "Cascais",
             "sstMax": 2.5, "predWaveDir": "NW", "wavePeriod": 10.0,
             "sst": 18.0, "predWindDir": "NW", "classWindSpeed": "2"},
        ]}
        _patch(monkeypatch, _FakeResponse(200, payload))
        cond = await svc.get_sea_conditions(1010500)
        assert cond is not None
        assert cond.location == "Cascais"
        assert cond.sea_temp == 18.0

    async def test_returns_none_for_unmatched_location(self, monkeypatch):
        svc = IPMAService()
        payload = {"data": [{"globalIdLocal": 9999, "local": "Outro"}]}
        _patch(monkeypatch, _FakeResponse(200, payload))
        assert await svc.get_sea_conditions(1010500) is None

    async def test_error_returns_none(self, monkeypatch):
        svc = IPMAService()
        _patch_raises(monkeypatch)
        assert await svc.get_sea_conditions(1010500) is None
