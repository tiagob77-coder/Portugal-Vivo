"""Pure-function tests for M6 dedup helpers: _make_checksum (Stage-1 hash
match key) and _calculate_distance (Stage-3 geo proximity). The 3-stage
dedup pipeline itself touches DB state and is not covered here."""
import pytest

from iq_module_m6_dedup import DeduplicationModule, _make_checksum

_M = DeduplicationModule()


# ── _make_checksum ────────────────────────────────────────────────────────────

def test_checksum_length_is_eight():
    assert len(_make_checksum("anything")) == 8


def test_checksum_lowercases():
    assert _make_checksum("Mosteiro") == _make_checksum("MOSTEIRO")


def test_checksum_strips_whitespace():
    assert _make_checksum("  Mosteiro  ") == _make_checksum("Mosteiro")


def test_checksum_differs_for_different_names():
    assert _make_checksum("Mosteiro") != _make_checksum("Castelo")


def test_checksum_is_hex():
    cs = _make_checksum("nome")
    assert all(c in "0123456789abcdef" for c in cs)


# ── _calculate_distance ───────────────────────────────────────────────────────

def test_distance_same_point_is_zero():
    p = {"lat": 38.7223, "lng": -9.1393}
    assert _M._calculate_distance(p, p) == pytest.approx(0.0, abs=1e-3)


def test_distance_lisboa_to_porto_about_270_km():
    lisboa = {"lat": 38.7223, "lng": -9.1393}
    porto = {"lat": 41.1496, "lng": -8.6109}
    assert _M._calculate_distance(lisboa, porto) == pytest.approx(274000, abs=5000)


def test_distance_accepts_geojson_loc1():
    geojson = {"coordinates": [-9.1393, 38.7223]}
    plain = {"lat": 38.7223, "lng": -9.1393}
    assert _M._calculate_distance(geojson, plain) == pytest.approx(0.0, abs=1e-3)


def test_distance_accepts_geojson_loc2():
    """Symmetric with loc1 — m5's version only supported GeoJSON on loc1."""
    plain = {"lat": 38.7223, "lng": -9.1393}
    geojson = {"coordinates": [-9.1393, 38.7223]}
    assert _M._calculate_distance(plain, geojson) == pytest.approx(0.0, abs=1e-3)


def test_distance_returns_none_for_unknown_format():
    assert _M._calculate_distance({"x": 1}, {"lat": 38.7, "lng": -9.1}) is None
    assert _M._calculate_distance({"lat": 38.7, "lng": -9.1}, {"y": 2}) is None


def test_distance_returns_none_for_non_dict_input():
    assert _M._calculate_distance("not a dict", {"lat": 38.7, "lng": -9.1}) is None
    assert _M._calculate_distance({"lat": 38.7, "lng": -9.1}, None) is None
