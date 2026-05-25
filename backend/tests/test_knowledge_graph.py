"""Pure-function tests for knowledge_graph_api helpers: _node_id (stable
graph node IDs across domain collections), _normalise (canonical shape for
heterogeneous documents), _score_connection (edge weight + reason between
two normalised nodes). The async DB-bound helpers (_all_of_type, traverse)
are out of scope here."""
import pytest

from knowledge_graph_api import (
    NODE_COLORS,
    _node_id,
    _normalise,
    _score_connection,
)


# ── _node_id ─────────────────────────────────────────────────────────────────

def test_node_id_prefers_underscore_id():
    nid = _node_id({"_id": "abc", "id": "xyz"}, "heritage")
    assert nid == "heritage:abc"


def test_node_id_falls_back_to_id_when_no_underscore_id():
    assert _node_id({"id": "xyz"}, "trail") == "trail:xyz"


def test_node_id_falls_back_to_slug_when_no_ids():
    assert _node_id({"slug": "torre-belem"}, "heritage") == "heritage:torre-belem"


def test_node_id_falls_back_to_name_last():
    assert _node_id({"name": "Torre de Belém"}, "heritage") == "heritage:Torre de Belém"


def test_node_id_empty_doc_returns_namespace_only():
    assert _node_id({}, "heritage") == "heritage:"


def test_node_id_coerces_non_string_to_string():
    assert _node_id({"_id": 42}, "event") == "event:42"


# ── _normalise — name & region fallbacks ─────────────────────────────────────

def test_normalise_name_fallback_to_common_name():
    out = _normalise({"common_name": "Sardinha"}, "marine")
    assert out["name"] == "Sardinha"


def test_normalise_name_fallback_chain_order():
    # name wins over common_name → species_name → title.
    out = _normalise({
        "name": "A",
        "common_name": "B",
        "species_name": "C",
        "title": "D",
    }, "marine")
    assert out["name"] == "A"


def test_normalise_name_dash_when_all_missing():
    assert _normalise({}, "heritage")["name"] == "—"


def test_normalise_region_falls_back_to_habitat():
    out = _normalise({"habitat": "Atlântico"}, "marine")
    assert out["region"] == "Atlântico"


# ── _normalise — municipalities ──────────────────────────────────────────────

def test_normalise_municipalities_list_passthrough():
    out = _normalise({"municipalities": ["Lisboa", "Porto"]}, "heritage")
    assert out["municipalities"] == ["Lisboa", "Porto"]


def test_normalise_municipalities_singular_str_is_wrapped_in_list():
    out = _normalise({"municipality": "Lisboa"}, "heritage")
    assert out["municipalities"] == ["Lisboa"]


def test_normalise_missing_municipalities_returns_empty_list():
    out = _normalise({}, "heritage")
    assert out["municipalities"] == []


# ── _normalise — tags ────────────────────────────────────────────────────────

def test_normalise_tags_harvests_lists_from_multiple_fields():
    out = _normalise({
        "instruments": ["adufe", "viola"],
        "dances": ["fandango"],
        "categories": ["música"],
    }, "cultural_route")
    assert set(out["tags"]) == {"adufe", "viola", "fandango", "música"}


def test_normalise_tags_harvests_strings_too():
    out = _normalise({
        "category": "fauna_endemica",
        "family": "Felidae",
    }, "fauna")
    assert set(out["tags"]) == {"fauna_endemica", "Felidae"}


def test_normalise_tags_deduped():
    out = _normalise({
        "categories": ["a", "b"],
        "tags": ["b", "c"],
    }, "heritage")
    assert sorted(out["tags"]) == ["a", "b", "c"]


def test_normalise_tags_empty_string_field_is_ignored():
    # `elif isinstance(val, str) and val:` — empty strings are skipped.
    out = _normalise({"category": ""}, "heritage")
    assert out["tags"] == []


# ── _normalise — coordinates ─────────────────────────────────────────────────

def test_normalise_coords_plain_lat_lng():
    out = _normalise({"lat": 38.7, "lng": -9.1}, "heritage")
    assert out["lat"] == 38.7 and out["lng"] == -9.1


def test_normalise_coords_latitude_longitude_aliases():
    out = _normalise({"latitude": 38.7, "longitude": -9.1}, "heritage")
    assert out["lat"] == 38.7 and out["lng"] == -9.1


def test_normalise_coords_geojson_dict_is_nullified_not_extracted():
    # Documents with a nested GeoJSON Point keep lat=lng=None — the helper
    # actively rejects dict-shaped coords rather than parsing them.
    out = _normalise({"lat": {"type": "Point", "coordinates": [-9.1, 38.7]},
                      "lng": {"type": "Point", "coordinates": [-9.1, 38.7]}},
                     "heritage")
    assert out["lat"] is None and out["lng"] is None


def test_normalise_coords_coerces_string_to_float():
    out = _normalise({"lat": "38.7", "lng": "-9.1"}, "heritage")
    assert out["lat"] == 38.7 and out["lng"] == -9.1


# ── _normalise — UNESCO + color + description ────────────────────────────────

def test_normalise_unesco_true_when_flag_set():
    assert _normalise({"unesco": True}, "heritage")["unesco"] is True


def test_normalise_unesco_true_when_label_set():
    assert _normalise({"unesco_label": "Património Mundial"}, "heritage")["unesco"] is True


def test_normalise_unesco_false_by_default():
    assert _normalise({}, "heritage")["unesco"] is False


def test_normalise_color_from_node_colors_map():
    out = _normalise({}, "fauna")
    assert out["color"] == NODE_COLORS["fauna"]


def test_normalise_color_default_for_unknown_type():
    out = _normalise({}, "unknown_type")
    assert out["color"] == "#6B7280"


def test_normalise_description_truncated_at_160_chars():
    out = _normalise({"description": "x" * 500}, "heritage")
    assert len(out["description"]) == 160


def test_normalise_description_falls_back_to_short_or_story():
    out = _normalise({"description_short": "Short"}, "heritage")
    assert out["description"] == "Short"


# ── _score_connection — empty / no-overlap ───────────────────────────────────

def _node(**overrides):
    base = {
        "tags": [],
        "municipalities": [],
        "region": "",
        "unesco": False,
        "lat": None,
        "lng": None,
    }
    base.update(overrides)
    return base


def test_score_no_overlap_returns_zero_and_empty_reason():
    a = _node(tags=["x"], region="Norte", municipalities=["A"])
    b = _node(tags=["y"], region="Algarve", municipalities=["B"])
    assert _score_connection(a, b) == (0.0, "")


def test_score_both_empty_returns_zero():
    assert _score_connection(_node(), _node()) == (0.0, "")


# ── _score_connection — shared tags ──────────────────────────────────────────

def test_score_one_shared_tag_is_0_5():
    a = _node(tags=["adufe"])
    b = _node(tags=["adufe"])
    w, reason = _score_connection(a, b)
    assert w == 0.5
    assert "adufe" in reason


def test_score_two_shared_tags_is_0_6():
    a = _node(tags=["adufe", "viola"])
    b = _node(tags=["adufe", "viola"])
    w, _ = _score_connection(a, b)
    assert w == pytest.approx(0.6)


def test_score_tag_weight_caps_at_0_8_with_many_shared():
    # 0.4 + 5*0.1 = 0.9 → capped at 0.8.
    a = _node(tags=["t1", "t2", "t3", "t4", "t5", "t6"])
    b = _node(tags=["t1", "t2", "t3", "t4", "t5", "t6"])
    w, _ = _score_connection(a, b)
    assert w == 0.8


# ── _score_connection — shared municipality ──────────────────────────────────

def test_score_shared_municipality_is_0_5():
    a = _node(municipalities=["Lisboa"])
    b = _node(municipalities=["Lisboa"])
    w, reason = _score_connection(a, b)
    assert w == 0.5
    assert "Lisboa" in reason


# ── _score_connection — same region ──────────────────────────────────────────

def test_score_same_region_case_insensitive():
    a = _node(region="Norte")
    b = _node(region="NORTE")
    w, reason = _score_connection(a, b)
    assert w == 0.35
    assert "Norte" in reason


def test_score_different_region_does_not_match():
    a = _node(region="Norte")
    b = _node(region="Algarve")
    assert _score_connection(a, b) == (0.0, "")


# ── _score_connection — UNESCO ──────────────────────────────────────────────

def test_score_both_unesco_is_0_6():
    a = _node(unesco=True)
    b = _node(unesco=True)
    w, reason = _score_connection(a, b)
    assert w == 0.6
    assert reason == "ambos UNESCO"


def test_score_only_one_unesco_does_not_match():
    a = _node(unesco=True)
    b = _node(unesco=False)
    assert _score_connection(a, b) == (0.0, "")


# ── _score_connection — geo proximity ───────────────────────────────────────

def test_score_geo_within_15km_is_0_7():
    # Lisboa centre vs ~5 km away.
    a = _node(lat=38.7223, lng=-9.1393)
    b = _node(lat=38.76, lng=-9.13)
    w, reason = _score_connection(a, b)
    assert w == 0.7
    assert "km" in reason


def test_score_geo_15_to_50km_is_0_4():
    # Lisboa to Sintra (~25 km).
    a = _node(lat=38.7223, lng=-9.1393)
    b = _node(lat=38.7980, lng=-9.3879)
    w, _ = _score_connection(a, b)
    assert w == 0.4


def test_score_geo_over_50km_no_edge_from_geo():
    # Lisboa to Porto (~270 km).
    a = _node(lat=38.7223, lng=-9.1393)
    b = _node(lat=41.1496, lng=-8.6109)
    # No other dimensions; geo alone over 50 km → no edge.
    assert _score_connection(a, b) == (0.0, "")


def test_score_missing_coords_skips_geo():
    a = _node(lat=38.7223, lng=None)
    b = _node(lat=38.7, lng=-9.1)
    assert _score_connection(a, b) == (0.0, "")


# ── _score_connection — multi-dimension tiebreaker ──────────────────────────

def test_score_picks_highest_weight_reason():
    # Shared tag (0.5) + both UNESCO (0.6) + region (0.35) → UNESCO wins.
    a = _node(tags=["x"], region="Norte", unesco=True)
    b = _node(tags=["x"], region="Norte", unesco=True)
    w, reason = _score_connection(a, b)
    assert w == 0.6
    assert reason == "ambos UNESCO"


def test_score_geo_can_beat_unesco():
    # Both UNESCO (0.6) vs ≤15km (0.7) → geo wins.
    a = _node(unesco=True, lat=38.7223, lng=-9.1393)
    b = _node(unesco=True, lat=38.7, lng=-9.13)
    w, reason = _score_connection(a, b)
    assert w == 0.7
    assert "km" in reason
