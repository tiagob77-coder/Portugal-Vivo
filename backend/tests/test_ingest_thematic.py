"""Tests for ingest_thematic_pois pure helpers — the hybrid mapping that
feeds heritage_items (geofencing backbone) and the thematic collections.

These pin: coord validation against the Portugal bbox, sheet→module
routing, deterministic/idempotent ids, GeoJSON shape for $near, and that
each thematic feeder only fires for sheets it owns."""
import pytest

from ingest_thematic_pois import (
    MODULE_BY_SHEET,
    THEMATIC_TARGETS,
    _build_heritage_doc,
    _heritage_id,
    _map_gastronomy,
    _module_for,
    _thematic_id,
    _valid_coords,
)


# ── _valid_coords ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("loc", [
    {"lat": 41.1466, "lng": -8.6048},   # Porto
    {"lat": 37.0, "lng": -7.9},         # Algarve
    {"lat": 32.65, "lng": -16.9},       # Madeira
    {"lat": "38.7", "lng": "-9.1"},     # string coords coerced
])
def test_valid_coords_accepts_portugal(loc):
    out = _valid_coords(loc)
    assert out is not None
    assert isinstance(out["lat"], float) and isinstance(out["lng"], float)


@pytest.mark.parametrize("loc", [
    None, {}, {"lat": None, "lng": None},
    {"lat": 0, "lng": 0},               # gulf of guinea
    {"lat": 48.8, "lng": 2.3},          # Paris — outside bbox
    {"lat": "x", "lng": "y"},
])
def test_valid_coords_rejects_bad(loc):
    assert _valid_coords(loc) is None


# ── _module_for ──────────────────────────────────────────────────────────────

def test_module_for_known_sheet():
    assert _module_for({"sheet": "Museus", "category": "arte"}) == "cultura"
    assert _module_for({"sheet": "Pratos Típicos", "category": "gastronomia"}) == "gastronomia"


def test_module_for_unknown_sheet_falls_back_to_category():
    assert _module_for({"sheet": "Sheet Inexistente", "category": "termas"}) == "termas"


def test_module_for_no_sheet_no_category():
    assert _module_for({}) == "outros"


def test_module_map_covers_only_known_slugs():
    # every routed module is either a thematic target or a plain slug string
    for slug in set(MODULE_BY_SHEET.values()):
        assert slug and isinstance(slug, str)


# ── deterministic / idempotent ids ───────────────────────────────────────────

def test_heritage_id_is_deterministic():
    poi = {"name_normalised": "caldo verde", "sheet": "Sopas Típicas"}
    loc = {"lat": 41.2764, "lng": -8.2831}
    assert _heritage_id(poi, loc) == _heritage_id(poi, loc)
    assert _heritage_id(poi, loc).startswith("th_")


def test_heritage_and_thematic_ids_differ():
    poi = {"name_normalised": "caldo verde", "sheet": "Sopas Típicas"}
    loc = {"lat": 41.2764, "lng": -8.2831}
    assert _heritage_id(poi, loc) != _thematic_id(poi, loc)
    assert _thematic_id(poi, loc).startswith("thv19_")


def test_ids_change_with_coords():
    poi = {"name_normalised": "x", "sheet": "s"}
    assert _heritage_id(poi, {"lat": 40.0, "lng": -8.0}) != _heritage_id(poi, {"lat": 41.0, "lng": -8.0})


# ── heritage doc shape ───────────────────────────────────────────────────────

def test_heritage_doc_has_geojson_for_near():
    poi = {"name": "Francesinha", "name_normalised": "francesinha",
           "sheet": "Pratos Típicos", "category": "gastronomia",
           "region": "norte", "location": {"lat": 41.1466, "lng": -8.6048}}
    loc = _valid_coords(poi["location"])
    doc = _build_heritage_doc(poi, loc, "gastronomia")
    assert doc["geo_location"]["type"] == "Point"
    # GeoJSON is [lng, lat] — order matters for $near
    assert doc["geo_location"]["coordinates"] == [-8.6048, 41.1466]
    assert doc["location"] == {"lat": 41.1466, "lng": -8.6048}
    assert doc["module"] == "gastronomia"
    assert doc["source"] == "thematic_v19"


# ── thematic feeders ─────────────────────────────────────────────────────────

def test_gastronomy_mapper_minimal_render_fields():
    poi = {"name": "Caldo Verde", "name_normalised": "caldo verde",
           "sheet": "Sopas Típicas", "region": "norte", "localidade": "Lousada"}
    loc = {"lat": 41.27, "lng": -8.28}
    doc = _map_gastronomy(poi, loc)
    assert doc["name"] == "Caldo Verde"
    assert doc["type"] == "prato"
    assert doc["lat"] == 41.27 and doc["lng"] == -8.28
    assert doc["_id"].startswith("thv19_")


def test_thematic_targets_sheets_are_subset_of_module_map():
    # every sheet a feeder claims must route to that same module
    for module, target in THEMATIC_TARGETS.items():
        for sheet in target["sheets"]:
            assert MODULE_BY_SHEET.get(sheet) == module, (sheet, module)
