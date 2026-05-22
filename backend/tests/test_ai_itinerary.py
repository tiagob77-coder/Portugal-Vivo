"""
Pure-function tests for ai_itinerary_api: the LLM-JSON cleaner and the
structured fallback itinerary builder.

No Mongo, no network — the module's DB access is lazy (``_db_or_none``) and
the LLM call is provider-resolved by llm_client, so importing the module is
side-effect free.
"""
from ai_itinerary_api import (
    DURATION_STOPS,
    _build_fallback_itinerary,
    _clean_llm_json,
)


# ── _clean_llm_json ───────────────────────────────────────────────────────────

def test_clean_llm_json_plain_object():
    assert _clean_llm_json('{"a": 1, "b": "x"}') == {"a": 1, "b": "x"}


def test_clean_llm_json_strips_json_fence():
    raw = '```json\n{"titulo": "Roteiro", "paradas": []}\n```'
    assert _clean_llm_json(raw) == {"titulo": "Roteiro", "paradas": []}


def test_clean_llm_json_strips_bare_fence():
    assert _clean_llm_json('```\n{"ok": true}\n```') == {"ok": True}


def test_clean_llm_json_tolerates_surrounding_whitespace():
    assert _clean_llm_json('   \n {"a": 1}\n  ') == {"a": 1}


def test_clean_llm_json_returns_none_on_garbage():
    assert _clean_llm_json("isto nao e json") is None


def test_clean_llm_json_returns_none_on_empty():
    assert _clean_llm_json("") is None


def test_clean_llm_json_returns_none_on_truncated_object():
    assert _clean_llm_json('{"a": 1, "b":') is None


# ── _build_fallback_itinerary ─────────────────────────────────────────────────

def _poi(name, lat, lng, **extra):
    return {"name": name, "location": {"lat": lat, "lng": lng}, **extra}


def test_fallback_marks_source_and_theme():
    out = _build_fallback_itinerary([], "natureza", "1dia")
    assert out["fonte"] == "fallback"
    assert out["tema"] == "natureza"


def test_fallback_caps_stops_by_duration():
    pois = [_poi(f"P{i}", 38.0 + i / 100, -8.0) for i in range(10)]
    out = _build_fallback_itinerary(pois, "historia", "1h")
    assert len(out["paradas"]) == DURATION_STOPS["1h"] == 2


def test_fallback_paradas_are_ordered_from_one():
    pois = [_poi("A", 38.0, -8.0), _poi("B", 38.1, -8.1), _poi("C", 38.2, -8.2)]
    out = _build_fallback_itinerary(pois, "foto", "3h")
    assert [p["ordem"] for p in out["paradas"]] == [1, 2, 3]
    assert [p["nome"] for p in out["paradas"]] == ["A", "B", "C"]


def test_fallback_empty_pois_yields_zero_distance():
    out = _build_fallback_itinerary([], "surf", "3h")
    assert out["paradas"] == []
    assert out["distancia_total_km"] == 0.0


def test_fallback_tolerates_poi_without_name_or_location():
    out = _build_fallback_itinerary([{}], "gastronomia", "1h")
    parada = out["paradas"][0]
    assert parada["nome"] == "Local"
    assert parada["lat"] == 0.0 and parada["lng"] == 0.0


def test_fallback_sums_a_real_distance_for_spread_pois():
    pois = [_poi("Lisboa", 38.72, -9.14), _poi("Porto", 41.15, -8.61)]
    out = _build_fallback_itinerary(pois, "historia", "1dia")
    # Lisbon → Porto is ~270 km; assert the builder summed a real leg.
    assert out["distancia_total_km"] > 100
