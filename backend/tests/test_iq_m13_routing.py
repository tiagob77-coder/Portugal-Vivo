"""Pure-function tests for M13-M19 routing helpers: _get_coords (lat/lng
extraction with GeoJSON support) and _solar_orientation (sun direction +
advisory + golden-hour start)."""
from types import SimpleNamespace

import pytest

from iq_engine_base import POIProcessingData
from iq_module_m13_m19_routing import (
    RouteOptimizerModule,
    _get_coords,
)


def _data(location=None):
    return POIProcessingData(id="x", name="x", description="", location=location)


# ── _get_coords (module-level) ────────────────────────────────────────────────

def test_coords_no_location_returns_none():
    assert _get_coords(_data()) is None


def test_coords_plain_lat_lng():
    assert _get_coords(_data({"lat": 38.7, "lng": -9.1})) == (38.7, -9.1)


def test_coords_geojson_returns_lat_lng_order():
    # GeoJSON is [lng, lat]; the helper must swap to (lat, lng).
    assert _get_coords(_data({"coordinates": [-9.1, 38.7]})) == (38.7, -9.1)


def test_coords_geojson_preferred_when_both_present():
    out = _get_coords(_data({
        "coordinates": [-9.0, 38.0],
        "lat": 99.0, "lng": 99.0,
    }))
    assert out == (38.0, -9.0)


def test_coords_non_dict_location_returns_none():
    assert _get_coords(_data("lisboa")) is None


def test_coords_empty_dict_returns_none():
    assert _get_coords(_data({})) is None


def test_coords_partial_dict_returns_none():
    # Has lat but no lng, and no GeoJSON coordinates.
    assert _get_coords(_data({"lat": 38.7})) is None


def test_coords_geojson_too_short_falls_back():
    # < 2 entries in coordinates → no GeoJSON match; no lat/lng either.
    assert _get_coords(_data({"coordinates": [38.7]})) is None


# ── _solar_orientation ────────────────────────────────────────────────────────

_M = RouteOptimizerModule()


def _ctx(hour=None, month=None):
    return SimpleNamespace(hour_of_day=hour, current_month=month)


@pytest.mark.parametrize("hour,expected", [
    (8, "este"),
    (12, "sul"),
    (16, "oeste-sul"),
    (20, "oeste"),
    (23, "noite"),
    (5, "noite"),
])
def test_solar_direction_by_hour(hour, expected):
    out = _M._solar_orientation(38.7, -9.1, _ctx(hour=hour, month=6))
    assert out["current_sun_direction"] == expected


def test_solar_direction_unknown_when_hour_none():
    out = _M._solar_orientation(38.7, -9.1, _ctx(hour=None, month=6))
    assert out["current_sun_direction"] == "unknown"


@pytest.mark.parametrize("month,start", [
    (7, "20:00"),
    (5, "18:00"),
    (12, "17:00"),
])
def test_solar_golden_hour_by_season(month, start):
    out = _M._solar_orientation(38.7, -9.1, _ctx(hour=10, month=month))
    assert out["golden_hour_start_local"] == start


def test_solar_hemisphere_is_north():
    out = _M._solar_orientation(38.7, -9.1, _ctx(hour=10, month=6))
    assert out["hemisphere"] == "north"


def test_solar_no_context_falls_back():
    out = _M._solar_orientation(38.7, -9.1, None)
    assert out["current_sun_direction"] == "unknown"
