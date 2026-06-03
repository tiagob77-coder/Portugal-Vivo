"""Tests for apply_poi_gps_v19 pure helpers — the precision-aware decision
that protects production heritage_items from silent GPS downgrades
(GEO-004).

The earlier apply script overwrote whatever location the JSON brought when
--force was set, with no comparison of precision. That meant a precise
coord already in the DB (3043 of those) could be silently replaced by a
~100 km region centroid from the offline geocoder. These tests pin the
new ladder: existing-hole → apply; new>existing → apply; equal → force
gates; new<existing → blocked unless --allow-downgrade."""
import pytest

from apply_poi_gps_v19 import (
    APPLY,
    SKIP_DOWNGRADE_BLOCKED,
    SKIP_SAME_PRECISION,
    UNKNOWN_RANK,
    build_update_doc,
    coords_in_portugal,
    decide_update,
    precision_rank,
)


# ── precision_rank ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("label,expected", [
    ("precise", 4),
    ("municipality", 3),
    ("district", 2),
    ("region", 1),
    ("PRECISE", 4),   # case-insensitive
    ("Municipality", 3),
])
def test_precision_rank_known_labels(label, expected):
    assert precision_rank(label) == expected


@pytest.mark.parametrize("bad", [None, "", "garbage", "high", 42, [], {}])
def test_precision_rank_unknown_returns_zero(bad):
    assert precision_rank(bad) == UNKNOWN_RANK


def test_precision_rank_ladder_strictly_ascending():
    # The decision ladder relies on these being strictly ordered.
    assert (precision_rank("region") < precision_rank("district")
            < precision_rank("municipality") < precision_rank("precise"))


# ── coords_in_portugal ───────────────────────────────────────────────────────

def test_coords_in_pt_lisbon():
    assert coords_in_portugal({"lat": 38.72, "lng": -9.14}) is True


def test_coords_in_pt_madeira():
    assert coords_in_portugal({"lat": 32.65, "lng": -16.91}) is True


def test_coords_outside_pt_madrid():
    assert coords_in_portugal({"lat": 40.4, "lng": -3.7}) is False


def test_coords_not_a_dict():
    assert coords_in_portugal(None) is False
    assert coords_in_portugal([38.72, -9.14]) is False


def test_coords_non_numeric():
    assert coords_in_portugal({"lat": "38.72", "lng": "-9.14"}) is False


def test_coords_missing_keys():
    assert coords_in_portugal({"lat": 38.72}) is False


# ── decide_update ────────────────────────────────────────────────────────────

PRECISE = {"coord_precision": "precise"}
MUNICIPALITY = {"coord_precision": "municipality"}
DISTRICT = {"coord_precision": "district"}
REGION = {"coord_precision": "region"}

EXISTING_WITH_COORDS = {"location": {"lat": 38.72, "lng": -9.14}, **PRECISE}
EXISTING_EMPTY = {"location": {}, **PRECISE}   # precision is irrelevant when no coords
EXISTING_OUT_OF_PT = {"location": {"lat": 40.4, "lng": -3.7}, **PRECISE}


def test_decide_apply_when_existing_has_no_coords():
    # Filling a hole — precision doesn't matter, always apply.
    assert decide_update(EXISTING_EMPTY, REGION,
                         force=False, allow_downgrade=False) == APPLY


def test_decide_apply_when_existing_coords_outside_pt():
    # Treats out-of-envelope existing coords as a hole to be filled.
    assert decide_update(EXISTING_OUT_OF_PT, REGION,
                         force=False, allow_downgrade=False) == APPLY


def test_decide_apply_when_new_strictly_better():
    existing = {"location": {"lat": 38.72, "lng": -9.14}, **MUNICIPALITY}
    assert decide_update(existing, PRECISE,
                         force=False, allow_downgrade=False) == APPLY


def test_decide_apply_when_new_better_district_to_municipality():
    existing = {"location": {"lat": 38.72, "lng": -9.14}, **DISTRICT}
    assert decide_update(existing, MUNICIPALITY,
                         force=False, allow_downgrade=False) == APPLY


def test_decide_skip_when_same_precision_no_force():
    assert decide_update(EXISTING_WITH_COORDS, PRECISE,
                         force=False, allow_downgrade=False) == SKIP_SAME_PRECISION


def test_decide_apply_when_same_precision_with_force():
    # --force only re-writes same-precision rows; it does NOT enable downgrade.
    assert decide_update(EXISTING_WITH_COORDS, PRECISE,
                         force=True, allow_downgrade=False) == APPLY


def test_decide_blocks_downgrade_precise_to_region():
    # The critical case: precise → region centroid must NOT happen by default.
    assert decide_update(EXISTING_WITH_COORDS, REGION,
                         force=False, allow_downgrade=False) == SKIP_DOWNGRADE_BLOCKED


def test_decide_blocks_downgrade_even_with_force():
    # --force is for same-precision refresh; downgrade still blocked.
    assert decide_update(EXISTING_WITH_COORDS, REGION,
                         force=True, allow_downgrade=False) == SKIP_DOWNGRADE_BLOCKED


def test_decide_allows_downgrade_explicitly():
    # --allow-downgrade is the only flag that lets a less-precise coord win.
    assert decide_update(EXISTING_WITH_COORDS, REGION,
                         force=False, allow_downgrade=True) == APPLY


def test_decide_legacy_doc_without_precision_is_floor():
    # An existing heritage_items doc that predates GEO-004 has no
    # coord_precision field; treated as UNKNOWN_RANK (0) so anything with
    # a known precision wins. Pin so a future "default to precise" change
    # doesn't accidentally lock those rows.
    legacy = {"location": {"lat": 38.72, "lng": -9.14}}  # no coord_precision
    assert decide_update(legacy, REGION,
                         force=False, allow_downgrade=False) == APPLY


# ── build_update_doc ─────────────────────────────────────────────────────────

def _poi(precision="precise", source="gps_col", sheet="Castelos"):
    return {
        "location": {"lat": 38.72, "lng": -9.14},
        "coord_precision": precision,
        "coord_source": source,
        "sheet": sheet,
    }


def test_build_update_doc_propagates_precision_and_source():
    out = build_update_doc(_poi())
    assert out["coord_precision"] == "precise"
    assert out["coord_source"] == "gps_col"
    assert out["gps_source_sheet"] == "Castelos"


def test_build_update_doc_precise_uses_excel_v19_tag():
    # gps_source distinguishes precise excel rows from centroid-derived ones —
    # dashboards/admin can split them by this field.
    out = build_update_doc(_poi(precision="precise"))
    assert out["gps_source"] == "excel_v19"
    assert out["coord_approximate"] is False


def test_build_update_doc_centroid_uses_excel_v19_centroid_tag():
    out = build_update_doc(_poi(precision="municipality", source="centroid_concelho"))
    assert out["gps_source"] == "excel_v19_centroid"
    assert out["coord_approximate"] is True


@pytest.mark.parametrize("precision", ["region", "district", "municipality"])
def test_build_update_doc_marks_non_precise_as_approximate(precision):
    out = build_update_doc(_poi(precision=precision))
    assert out["coord_approximate"] is True


def test_build_update_doc_coerces_location_to_float():
    out = build_update_doc({
        "location": {"lat": "38.72", "lng": "-9.14"},  # str cells from openpyxl
        "coord_precision": "precise",
        "coord_source": "gps_col",
    })
    assert out["location"] == {"lat": 38.72, "lng": -9.14}
    assert isinstance(out["location"]["lat"], float)


def test_build_update_doc_drops_none_fields():
    # Don't $set None — would clobber existing values with null. The helper
    # filters them out so absent JSON fields don't overwrite DB data.
    out = build_update_doc({
        "location": {"lat": 38.72, "lng": -9.14},
        "coord_precision": None,
        "coord_source": None,
        "sheet": None,
    })
    assert "coord_precision" not in out
    assert "coord_source" not in out
    assert "gps_source_sheet" not in out
    # location + gps_source + coord_approximate are always emitted.
    assert "location" in out
    assert "gps_source" in out
    assert "coord_approximate" in out
