"""Pure-function tests for the geo_validator surfaces NOT already covered by
test_caop_pipeline.py:

  - ValidationResult.was_modified / to_dict
  - _check_declared_parish_mismatch  (parish-code mismatch annotation)
  - _in_envelope                     (PT bounding box boundaries)
  - enrich_poi                       (coordinate extraction + skipped path)

These run WITHOUT a loaded CAOP lookup (lookup.is_ready is False in the
test env), so validate() returns status="skipped" and enrich_poi performs
no spatial enrichment — but the coordinate-extraction guards (lat/lng vs
GeoJSON [lng,lat] fallback, missing-coord short-circuit) and the
ValidationResult plumbing are fully exercised."""
import pytest

from services.caop_lookup import ParishInfo
import geo_validator
from geo_validator import (
    PT_LAT_MAX,
    PT_LAT_MIN,
    PT_LNG_MAX,
    PT_LNG_MIN,
    ValidationResult,
    _check_declared_parish_mismatch,
    _in_envelope,
    enrich_poi,
    validate,
)


def _parish(code="110512", name="Alvalade") -> ParishInfo:
    return ParishInfo(
        parish_code=code,
        parish_name=name,
        municipality_code="1105",
        municipality_name="Lisboa",
        district_code="11",
        district_name="Lisboa",
        nuts3_code="PT1A0",
        nuts2_code="PT1A",
        nuts1_code="PT1",
        inside=True,
        distance_to_border_m=0.0,
    )


# ── _in_envelope ─────────────────────────────────────────────────────────────

def test_envelope_lisbon_inside():
    assert _in_envelope(38.72, -9.14) is True


def test_envelope_porto_inside():
    assert _in_envelope(41.15, -8.61) is True


def test_envelope_madeira_inside():
    assert _in_envelope(32.65, -16.91) is True


def test_envelope_azores_flores_inside():
    # Flores is the western edge of PT territory.
    assert _in_envelope(39.45, -31.2) is True


def test_envelope_madrid_outside():
    assert _in_envelope(40.4, -3.7) is False


def test_envelope_brazil_outside():
    assert _in_envelope(-15.0, -47.0) is False


@pytest.mark.parametrize("lat,lng,inside", [
    (PT_LAT_MIN, PT_LNG_MIN, True),    # corners inclusive
    (PT_LAT_MAX, PT_LNG_MAX, True),
    (PT_LAT_MIN - 0.01, -9.0, False),  # just below lat floor
    (PT_LAT_MAX + 0.01, -9.0, False),  # just above lat ceiling
    (38.0, PT_LNG_MIN - 0.01, False),  # just west of lng floor
    (38.0, PT_LNG_MAX + 0.01, False),  # just east of lng ceiling
])
def test_envelope_boundaries(lat, lng, inside):
    assert _in_envelope(lat, lng) is inside


# ── ValidationResult.was_modified ────────────────────────────────────────────

def test_was_modified_false_when_unchanged():
    r = ValidationResult(status="ok", lat=38.7, lng=-9.1,
                         original_lat=38.7, original_lng=-9.1)
    assert r.was_modified is False


def test_was_modified_true_when_lat_changed():
    r = ValidationResult(status="snapped", lat=38.71, lng=-9.1,
                         original_lat=38.7, original_lng=-9.1)
    assert r.was_modified is True


def test_was_modified_true_when_lng_changed():
    r = ValidationResult(status="snapped", lat=38.7, lng=-9.11,
                         original_lat=38.7, original_lng=-9.1)
    assert r.was_modified is True


def test_was_modified_false_when_no_originals():
    # invalid results carry no original coords → can't be "modified".
    r = ValidationResult(status="invalid", reason="x")
    assert r.was_modified is False


# ── ValidationResult.to_dict ─────────────────────────────────────────────────

def test_to_dict_shape_without_parish():
    r = ValidationResult(status="invalid", reason="(0,0) sentinel",
                         original_lat=0.0, original_lng=0.0)
    d = r.to_dict()
    assert d["status"] == "invalid"
    assert d["parish"] is None
    assert d["reason"] == "(0,0) sentinel"
    assert d["distance_to_border_m"] == 0.0


def test_to_dict_rounds_distance():
    r = ValidationResult(status="suspect", distance_to_border_m=123.456789)
    assert r.to_dict()["distance_to_border_m"] == 123.46


def test_to_dict_serialises_parish():
    r = ValidationResult(status="ok", lat=38.7, lng=-9.1, parish=_parish())
    d = r.to_dict()
    assert d["parish"]["parish_code"] == "110512"


# ── _check_declared_parish_mismatch ─────────────────────────────────────────

def test_mismatch_noop_when_no_declared_code():
    r = ValidationResult(status="ok", parish=_parish(code="110512"))
    _check_declared_parish_mismatch(r, None)
    assert r.corrections == []


def test_mismatch_noop_when_no_parish():
    r = ValidationResult(status="ok", parish=None)
    _check_declared_parish_mismatch(r, "110512")
    assert r.corrections == []


def test_mismatch_noop_when_codes_agree():
    r = ValidationResult(status="ok", parish=_parish(code="110512"))
    _check_declared_parish_mismatch(r, "110512")
    assert r.corrections == []


def test_mismatch_appends_correction_when_codes_differ():
    r = ValidationResult(status="ok", parish=_parish(code="110512"))
    _check_declared_parish_mismatch(r, "999999")
    assert len(r.corrections) == 1
    assert "parish_mismatch" in r.corrections[0]
    assert "declared=999999" in r.corrections[0]
    assert "resolved=110512" in r.corrections[0]


def test_mismatch_noop_when_declared_code_is_whitespace():
    r = ValidationResult(status="ok", parish=_parish(code="110512"))
    _check_declared_parish_mismatch(r, "   ")
    assert r.corrections == []


# ── enrich_poi ───────────────────────────────────────────────────────────────

def test_enrich_poi_no_location_returns_unchanged():
    poi = {"name": "X"}
    out = enrich_poi(poi)
    assert out == {"name": "X"}
    assert "caop_validated" not in out


def test_enrich_poi_missing_lat_lng_returns_unchanged():
    poi = {"name": "X", "location": {"foo": "bar"}}
    out = enrich_poi(poi)
    assert "caop_validated" not in out


def test_enrich_poi_extracts_geojson_coordinates():
    # GeoJSON [lng, lat] → the helper swaps to lat/lng before validate().
    # With lookup unloaded, validate() returns "skipped" so no mutation,
    # but the extraction path must not crash and must leave the POI intact.
    poi = {"name": "X", "location": {"coordinates": [-9.14, 38.72]}}
    out = enrich_poi(poi)
    # skipped status → original location preserved, no enrichment fields.
    assert "caop_validated" not in out
    assert out["location"] == {"coordinates": [-9.14, 38.72]}


def test_enrich_poi_skipped_path_preserves_plain_coords():
    poi = {"name": "X", "location": {"lat": 38.72, "lng": -9.14}}
    out = enrich_poi(poi)
    # lookup not loaded → "skipped" → location untouched, no enrich fields.
    assert out["location"] == {"lat": 38.72, "lng": -9.14}
    assert "caop_validated" not in out


def test_enrich_poi_geojson_too_short_returns_unchanged():
    poi = {"name": "X", "location": {"coordinates": [-9.14]}}
    out = enrich_poi(poi)
    assert "caop_validated" not in out


def test_enrich_poi_returns_same_dict_object():
    # The docstring says "in place" — confirm identity, not a copy.
    poi = {"name": "X", "location": {"lat": 38.72, "lng": -9.14}}
    out = enrich_poi(poi)
    assert out is poi


def test_enrich_poi_invalid_coords_zero_zero_no_enrichment():
    # (0,0) sentinel → validate returns "invalid" → no enrichment.
    poi = {"name": "X", "location": {"lat": 0, "lng": 0}}
    out = enrich_poi(poi)
    assert "caop_validated" not in out


# ── validate (skipped-path integration, lookup unloaded) ─────────────────────

def test_validate_skipped_when_lookup_unloaded():
    # Defensive re-pin (also in test_caop_pipeline) — guards the contract
    # enrich_poi relies on: a valid in-envelope point with no CAOP loaded
    # must return "skipped", never "ok"/"suspect".
    assert geo_validator.lookup.is_ready is False
    r = validate(38.72, -9.14)
    assert r.status == "skipped"
    assert r.lat == 38.72 and r.lng == -9.14


def test_validate_invalid_for_out_of_envelope_regardless_of_lookup():
    r = validate(40.4, -3.7)  # Madrid
    assert r.status == "invalid"
