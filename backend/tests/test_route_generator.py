"""
Pure-function tests for route_generator_api: coordinate extraction, the
point-to-segment geometry helper, nearest-neighbour ordering, route metrics
and duration formatting. None of these touch Mongo or the network.
"""
import pytest

from route_generator_api import (
    _calculate_route_metrics,
    _format_duration,
    _get_iq_module_data,
    _get_poi_coords,
    _optimize_route_order,
    _point_to_segment_distance,
)


def _poi(pid, lat, lng, **extra):
    return {"id": pid, "location": {"lat": lat, "lng": lng}, **extra}


# ── _format_duration ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("minutes,expected", [
    (0, "0min"),
    (30, "30min"),
    (59, "59min"),
    (60, "1h"),
    (90, "1h 30min"),
    (120, "2h"),
    (125, "2h 5min"),
])
def test_format_duration(minutes, expected):
    assert _format_duration(minutes) == expected


# ── _get_poi_coords ───────────────────────────────────────────────────────────

def test_get_poi_coords_valid():
    assert _get_poi_coords(_poi("x", 38.7, -9.1)) == (38.7, -9.1)


def test_get_poi_coords_missing_location_is_none():
    assert _get_poi_coords({"id": "x"}) is None


def test_get_poi_coords_location_not_a_dict_is_none():
    assert _get_poi_coords({"location": "lisboa"}) is None


def test_get_poi_coords_missing_lat_is_none():
    assert _get_poi_coords({"location": {"lng": -9.1}}) is None


def test_get_poi_coords_accepts_zero_coordinate():
    """A 0.0 latitude/longitude is a valid point — it must not read as missing."""
    assert _get_poi_coords({"location": {"lat": 0, "lng": 0}}) == (0.0, 0.0)


# ── _get_iq_module_data ───────────────────────────────────────────────────────

def test_get_iq_module_data_found():
    poi = {"iq_results": [
        {"module": "time_routing", "data": {"estimated_visit_minutes": 45}},
        {"module": "other", "data": {"x": 1}},
    ]}
    assert _get_iq_module_data(poi, "time_routing") == {"estimated_visit_minutes": 45}


def test_get_iq_module_data_missing_returns_empty():
    assert _get_iq_module_data({"iq_results": []}, "time_routing") == {}
    assert _get_iq_module_data({}, "time_routing") == {}


# ── _point_to_segment_distance ────────────────────────────────────────────────

def test_point_on_segment_is_near_zero():
    d = _point_to_segment_distance(38.0, -7.5, 38.0, -8.0, 38.0, -7.0)
    assert d == pytest.approx(0.0, abs=0.05)


def test_point_off_segment_is_positive():
    d = _point_to_segment_distance(38.2, -7.5, 38.0, -8.0, 38.0, -7.0)
    assert d > 1.0


def test_point_beyond_endpoint_clamps_to_endpoint():
    # P sits well past endpoint B; the distance is clamped to P-to-B.
    d = _point_to_segment_distance(38.0, -5.0, 38.0, -8.0, 38.0, -7.0)
    assert d > 100  # ~2 deg of longitude past B


def test_degenerate_segment_returns_point_to_a():
    # A == B → distance is simply P-to-A, not a division by zero.
    d = _point_to_segment_distance(38.1, -8.0, 38.0, -8.0, 38.0, -8.0)
    assert d == pytest.approx(11.1, abs=1.0)


# ── _optimize_route_order ─────────────────────────────────────────────────────

def test_optimize_short_route_unchanged():
    pois = [_poi("A", 38.7, -9.1), _poi("B", 38.8, -9.1)]
    assert _optimize_route_order(pois) == pois


def test_optimize_orders_by_nearest_neighbour():
    a = _poi("A", 38.70, -9.10)
    far = _poi("FAR", 38.95, -9.10)
    near = _poi("NEAR", 38.71, -9.10)
    ordered = _optimize_route_order([a, far, near])
    assert [p["id"] for p in ordered] == ["A", "NEAR", "FAR"]


def test_optimize_keeps_first_poi_first():
    pois = [_poi("start", 41.0, -8.6), _poi("b", 38.7, -9.1), _poi("c", 38.71, -9.1)]
    assert _optimize_route_order(pois)[0]["id"] == "start"


# ── _calculate_route_metrics ──────────────────────────────────────────────────

def test_route_metrics_basic():
    pois = [_poi("A", 38.70, -9.10), _poi("B", 38.80, -9.10)]
    m = _calculate_route_metrics(pois)
    assert m["poi_count"] == 2
    assert m["total_visit_minutes"] == 60  # 30 default * 2
    assert m["total_distance_km"] > 0
    assert m["total_duration_minutes"] == m["total_visit_minutes"] + m["total_travel_minutes"]
    assert isinstance(m["total_duration_label"], str)


def test_route_metrics_uses_iq_visit_time():
    poi = _poi("A", 38.7, -9.1)
    poi["iq_results"] = [{"module": "time_routing", "data": {"estimated_visit_minutes": 90}}]
    m = _calculate_route_metrics([poi])
    assert m["total_visit_minutes"] == 90
    assert m["poi_count"] == 1
