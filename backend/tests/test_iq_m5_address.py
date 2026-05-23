"""Pure-function tests for the IQ Address module (M5) helpers: the basic
address heuristic, geocoded-result scoring (clamped) and the Haversine
distance helper. No network, no Mongo — every helper is a pure function of
its arguments."""
import pytest

from iq_module_m5_address import AddressNormalizationModule

_M = AddressNormalizationModule()


# ── _basic_address_validation ─────────────────────────────────────────────────

def test_basic_validation_empty_address():
    r = _M._basic_address_validation("")
    assert r["estimated_completeness"] == 0
    assert r["appears_valid"] is False
    assert r["has_postal_code"] is False
    assert r["has_city"] is False


def test_basic_validation_postal_code_only():
    r = _M._basic_address_validation("1000-100")
    assert r["has_postal_code"] is True
    assert r["estimated_completeness"] == 30
    assert r["appears_valid"] is False  # below the 60-point threshold


def test_basic_validation_street_and_city():
    r = _M._basic_address_validation("Rua de Lisboa")
    assert r["has_city"] is True
    assert r["estimated_completeness"] == 70  # street(+40) + city(+30)
    assert r["appears_valid"] is True


def test_basic_validation_full_address():
    r = _M._basic_address_validation("Rua da Felicidade, 10, 1000-100 Lisboa")
    assert r["estimated_completeness"] == 100
    assert r["appears_valid"] is True
    assert r["has_postal_code"] is True
    assert r["has_city"] is True


def test_basic_validation_city_match_is_case_insensitive():
    r = _M._basic_address_validation("LISBOA")
    assert r["has_city"] is True


def test_basic_validation_below_threshold_not_valid():
    r = _M._basic_address_validation("Avenida 5 de Outubro")  # street only
    assert r["appears_valid"] is False
    assert r["estimated_completeness"] == 40


# ── _calculate_address_score ──────────────────────────────────────────────────

def test_score_not_geocoded():
    assert _M._calculate_address_score({"geocoded": False}) == 20


def test_score_geocoded_no_components():
    assert _M._calculate_address_score({"geocoded": True}) == 50


def test_score_geocoded_with_all_components_is_clamped():
    result = {
        "geocoded": True,
        "components": {
            "street": "Rua X",
            "street_number": "10",
            "postal_code": "1000-100",
            "city": "Lisboa",
            "district": "Lisboa",
        },
        "location_type": "ROOFTOP",
    }
    # raw 50 + 10 + 10 + 15 + 10 + 5 + 10 = 110, clamped to 100
    assert _M._calculate_address_score(result) == 100


def test_score_rooftop_more_than_interpolated():
    base = {"geocoded": True, "components": {}}
    rooftop = {**base, "location_type": "ROOFTOP"}
    interp = {**base, "location_type": "RANGE_INTERPOLATED"}
    assert _M._calculate_address_score(rooftop) > _M._calculate_address_score(interp)


# ── _calculate_distance ───────────────────────────────────────────────────────

def test_distance_same_point_is_zero():
    p = {"lat": 38.7223, "lng": -9.1393}
    assert _M._calculate_distance(p, p) == pytest.approx(0.0, abs=1e-3)


def test_distance_lisboa_to_porto_about_270_km():
    lisboa = {"lat": 38.7223, "lng": -9.1393}
    porto = {"lat": 41.1496, "lng": -8.6109}
    d = _M._calculate_distance(lisboa, porto)
    assert d == pytest.approx(274000, abs=5000)  # meters


def test_distance_accepts_geojson_for_loc1():
    # GeoJSON stores [lon, lat]
    geojson = {"coordinates": [-9.1393, 38.7223]}
    plain = {"lat": 38.7223, "lng": -9.1393}
    assert _M._calculate_distance(geojson, plain) == pytest.approx(0.0, abs=1e-3)


def test_distance_returns_zero_for_non_dict_input():
    assert _M._calculate_distance("not a dict", {"lat": 38.7, "lng": -9.1}) == 0
    assert _M._calculate_distance({"lat": 38.7, "lng": -9.1}, "nope") == 0


def test_distance_returns_zero_for_unknown_format():
    assert _M._calculate_distance({"x": 1}, {"lat": 38.7, "lng": -9.1}) == 0
