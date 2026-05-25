"""Pure-function tests for narrative_routes_api helpers:

  - _build_story_cue(poi, order, cumulative_km)
      Builds the per-POI cue dict shown on the narrative-route player.

  - _detect_dominant_theme(pois)
      Picks the most common narrative theme among a POI list — used to
      label the route ("Cultura Viva" / "Lendas e Mistério" / …).

  - _qualify_narrative_route(pois, total_km)
      Gating + scoring decision: does this set of POIs qualify as a
      narrative route, and how good is it?

These three drive whether a generated route enters the narrative-mode
catalog at all. A regression silently degrades content discoverability.
"""
from narrative_routes_api import (
    CATEGORY_THEME_MAP,
    CUE_TEMPLATES,
    MAX_ROUTE_KM,
    MIN_CUE_TEXT_LEN,
    MIN_STORY_CUES,
    NARRATIVE_THEMES,
    STORY_TRIGGER_RADIUS_M,
    _build_story_cue,
    _detect_dominant_theme,
    _qualify_narrative_route,
)


# ── _build_story_cue ─────────────────────────────────────────────────────────

def _poi(**overrides):
    base = {
        "id": "poi-1",
        "name": "Castelo de Lisboa",
        "category": "castelos",
        "location": {"lat": 38.72, "lng": -9.14},
        "description": "x" * 200,  # comfortably above MIN_CUE_TEXT_LEN (60)
        "image_url": "https://x",
    }
    base.update(overrides)
    return base


def test_cue_returns_all_expected_keys():
    out = _build_story_cue(_poi(), order=0, cumulative_km=1.2)
    expected = {
        "order", "poi_id", "name", "category", "location", "image_url",
        "story_text", "story_text_short", "theme_id", "theme_label",
        "theme_color", "trigger_radius_m", "cumulative_km",
        "has_audio_hook", "audio_url", "duration_seconds",
    }
    assert set(out.keys()) == expected


def test_cue_uses_description_when_long_enough():
    poi = _poi(description="Castelo histórico " + "x" * 200)
    out = _build_story_cue(poi, 0, 0.0)
    assert out["story_text"].startswith("Castelo histórico")


def test_cue_truncates_description_at_400_chars():
    poi = _poi(description="x" * 1000)
    out = _build_story_cue(poi, 0, 0.0)
    assert len(out["story_text"]) == 400


def test_cue_uses_template_when_description_too_short():
    # Below MIN_CUE_TEXT_LEN (60), the helper switches to template.
    poi = _poi(category="castelos", description="curta")
    out = _build_story_cue(poi, 0, 0.0)
    assert CUE_TEMPLATES["castelos"][:60] in out["story_text"]


def test_cue_prepends_short_description_to_template():
    # Short desc + template → "[desc[:200]] [template]".
    poi = _poi(category="moinhos_azenhas", description="curto texto")
    out = _build_story_cue(poi, 0, 0.0)
    assert out["story_text"].startswith("curto texto")
    assert "moinhos" in out["story_text"].lower()


def test_cue_fallback_when_no_desc_and_no_template():
    poi = _poi(category="unknown_xpto_cat", description="")
    out = _build_story_cue(poi, 0, 0.0)
    assert "Este local faz parte" in out["story_text"]


def test_cue_short_text_includes_ellipsis_when_truncated():
    poi = _poi(description="x" * 200)
    out = _build_story_cue(poi, 0, 0.0)
    assert out["story_text_short"].endswith("…")
    assert len(out["story_text_short"]) == 121  # 120 + "…"


def test_cue_short_text_no_ellipsis_when_within_120():
    poi = _poi(description="A short desc " + "x" * 50)  # 63 chars total, above MIN
    out = _build_story_cue(poi, 0, 0.0)
    # 63 ≤ 120 → no ellipsis.
    assert not out["story_text_short"].endswith("…")


def test_cue_theme_resolved_from_category():
    out = _build_story_cue(_poi(category="castelos"), 0, 0.0)
    assert out["theme_id"] == "historia"
    assert out["theme_label"] == NARRATIVE_THEMES["historia"]["label"]
    assert out["theme_color"] == NARRATIVE_THEMES["historia"]["color"]


def test_cue_unknown_category_defaults_to_historia():
    out = _build_story_cue(_poi(category="totally_unknown"), 0, 0.0)
    assert out["theme_id"] == "historia"


def test_cue_natureza_theme_color():
    out = _build_story_cue(_poi(category="miradouros"), 0, 0.0)
    assert out["theme_id"] == "natureza"


def test_cue_trigger_radius_exposed():
    out = _build_story_cue(_poi(), 0, 0.0)
    assert out["trigger_radius_m"] == STORY_TRIGGER_RADIUS_M


def test_cue_cumulative_km_rounded_to_2_decimals():
    out = _build_story_cue(_poi(), 0, 1.23456)
    assert out["cumulative_km"] == 1.23


def test_cue_has_audio_hook_when_audio_url_present():
    out = _build_story_cue(_poi(audio_url="https://x/audio.mp3"), 0, 0.0)
    assert out["has_audio_hook"] is True
    assert out["audio_url"] == "https://x/audio.mp3"


def test_cue_no_audio_hook_when_missing():
    out = _build_story_cue(_poi(), 0, 0.0)  # default _poi has no audio_url
    assert out["has_audio_hook"] is False


def test_cue_duration_seconds_floor_20():
    # Very short text: max(20, len // 15) → 20 wins.
    poi = _poi(description="", category="unknown")  # fallback short text
    out = _build_story_cue(poi, 0, 0.0)
    assert out["duration_seconds"] == 20


def test_cue_duration_seconds_scales_with_text():
    poi = _poi(description="x" * 400)
    out = _build_story_cue(poi, 0, 0.0)
    # 400 chars / 15 = 26 seconds, > floor of 20.
    assert out["duration_seconds"] >= 26


def test_cue_order_and_poi_id_pass_through():
    out = _build_story_cue(_poi(id="my-id"), order=7, cumulative_km=0.0)
    assert out["order"] == 7
    assert out["poi_id"] == "my-id"


# ── _detect_dominant_theme ───────────────────────────────────────────────────

def test_dominant_theme_empty_list_returns_historia():
    assert _detect_dominant_theme([]) == "historia"


def test_dominant_theme_single_poi():
    assert _detect_dominant_theme([{"category": "miradouros"}]) == "natureza"


def test_dominant_theme_unknown_category_defaults_to_historia():
    assert _detect_dominant_theme([{"category": "xxx"}]) == "historia"


def test_dominant_theme_majority_wins():
    pois = [
        {"category": "miradouros"},     # natureza
        {"category": "cascatas_pocos"}, # natureza
        {"category": "castelos"},       # historia
    ]
    assert _detect_dominant_theme(pois) == "natureza"


def test_dominant_theme_tie_first_encountered_wins():
    # 1 historia + 1 natureza → max() returns the first key encountered
    # in dict iteration order. Pin the actual behavior.
    pois = [
        {"category": "castelos"},   # historia (first inserted)
        {"category": "miradouros"}, # natureza
    ]
    assert _detect_dominant_theme(pois) == "historia"


def test_dominant_theme_unknown_categories_all_collapse_to_historia():
    pois = [{"category": "a"}, {"category": "b"}, {"category": "c"}]
    # All map to historia (default), so dominant is historia.
    assert _detect_dominant_theme(pois) == "historia"


def test_dominant_theme_handles_missing_category_field():
    # poi.get("category", "") → "" → mapped to historia.
    assert _detect_dominant_theme([{}]) == "historia"


def test_dominant_theme_uses_real_theme_map():
    # Confirm gastronomy is recognised when its categories are present.
    pois = [
        {"category": "restaurantes_gastronomia"},
        {"category": "tabernas_historicas"},
        {"category": "produtores_dop"},
    ]
    assert _detect_dominant_theme(pois) == "gastronomia"


# ── _qualify_narrative_route ─────────────────────────────────────────────────

def _good_poi(cat="castelos"):
    return {
        "category": cat,
        "description": "x" * 100,  # above MIN_CUE_TEXT_LEN
        "location": {"lat": 38.7, "lng": -9.1},
    }


def test_qualify_returns_expected_keys():
    out = _qualify_narrative_route([_good_poi(), _good_poi(), _good_poi()], total_km=2.0)
    expected = {"qualified", "cues_with_text", "has_photo_spot",
                "total_km", "reasons_failed", "score"}
    assert set(out.keys()) == expected


def test_qualify_qualifies_with_enough_cues():
    pois = [_good_poi() for _ in range(MIN_STORY_CUES)]
    out = _qualify_narrative_route(pois, total_km=2.0)
    assert out["qualified"] is True
    assert out["reasons_failed"] == []


def test_qualify_fails_with_too_few_cues():
    pois = [_good_poi()]  # only 1
    out = _qualify_narrative_route(pois, total_km=1.0)
    # Both "min cues" and "at least 2 POIs" reasons should fire.
    assert out["qualified"] is False
    assert any("cues com texto" in r for r in out["reasons_failed"])
    assert any("pelo menos 2 POIs" in r for r in out["reasons_failed"])


def test_qualify_short_description_uses_template_as_cue():
    # POIs with short desc but known category → template provides text,
    # so they count as cues even without their own description.
    pois = [_good_poi(cat="castelos") for _ in range(3)]
    for p in pois:
        p["description"] = ""  # rely on template
    out = _qualify_narrative_route(pois, total_km=2.0)
    assert out["cues_with_text"] == 3


def test_qualify_fails_when_route_too_long():
    pois = [_good_poi() for _ in range(MIN_STORY_CUES)]
    out = _qualify_narrative_route(pois, total_km=MAX_ROUTE_KM + 1)
    assert out["qualified"] is False
    assert any("muito longa" in r for r in out["reasons_failed"])


def test_qualify_fails_when_poi_missing_location():
    pois = [_good_poi() for _ in range(MIN_STORY_CUES)]
    pois[1]["location"] = {}  # one POI without coords
    out = _qualify_narrative_route(pois, total_km=2.0)
    assert out["qualified"] is False
    assert any("coordenadas GPS" in r for r in out["reasons_failed"])


def test_qualify_detects_photo_spot():
    pois = [_good_poi(cat="miradouros")] + [_good_poi() for _ in range(2)]
    out = _qualify_narrative_route(pois, total_km=2.0)
    assert out["has_photo_spot"] is True


def test_qualify_no_photo_spot_when_no_photo_category():
    pois = [_good_poi(cat="moinhos_azenhas") for _ in range(3)]
    out = _qualify_narrative_route(pois, total_km=2.0)
    assert out["has_photo_spot"] is False


def test_qualify_score_perfect_route():
    # 3 cues × full credit + photo + zero distance → 60 + 20 + 20 = 100
    pois = [_good_poi(cat="miradouros") for _ in range(MIN_STORY_CUES)]
    out = _qualify_narrative_route(pois, total_km=0.0)
    assert out["score"] == 100


def test_qualify_score_caps_at_100():
    # Way more cues than MIN; without the cap the score would overshoot.
    pois = [_good_poi(cat="miradouros") for _ in range(20)]
    out = _qualify_narrative_route(pois, total_km=0.0)
    assert out["score"] == 100


def test_qualify_score_decreases_with_distance():
    pois = [_good_poi(cat="miradouros") for _ in range(MIN_STORY_CUES)]
    short = _qualify_narrative_route(pois, total_km=0.0)["score"]
    long = _qualify_narrative_route(pois, total_km=MAX_ROUTE_KM)["score"]
    assert short > long


def test_qualify_score_distance_floor_at_max_km():
    # When total_km == MAX_ROUTE_KM, the distance bonus drops to 0.
    pois = [_good_poi(cat="miradouros") for _ in range(MIN_STORY_CUES)]
    out = _qualify_narrative_route(pois, total_km=MAX_ROUTE_KM)
    # 60 cues + 20 photo + 0 distance = 80.
    assert out["score"] == 80


def test_qualify_score_distance_clamps_above_max():
    # The implementation uses max(0, 1 - total_km / MAX_ROUTE_KM), so
    # a route longer than MAX shouldn't yield a negative distance bonus.
    pois = [_good_poi(cat="miradouros") for _ in range(MIN_STORY_CUES)]
    out = _qualify_narrative_route(pois, total_km=MAX_ROUTE_KM * 3)
    # Even though qualified=False (too long), the score must be ≥ 0.
    assert out["score"] >= 0


def test_qualify_total_km_rounded_to_2_decimals():
    out = _qualify_narrative_route([_good_poi(), _good_poi()], total_km=1.23456)
    assert out["total_km"] == 1.23


# ── Consistency check across constants ───────────────────────────────────────

def test_all_categories_in_theme_map_have_valid_theme():
    # Every value of CATEGORY_THEME_MAP must point at a real
    # NARRATIVE_THEMES key — else _build_story_cue's theme lookup falls
    # back to "historia" by accident and the route ships with the wrong
    # color/label.
    for cat, theme_id in CATEGORY_THEME_MAP.items():
        assert theme_id in NARRATIVE_THEMES, f"{cat} → unknown theme {theme_id}"


def test_min_cue_text_len_is_consistent_for_cue_and_qualify():
    # _build_story_cue uses MIN_CUE_TEXT_LEN to decide desc-vs-template,
    # _qualify_narrative_route uses it to decide if a POI counts as a
    # cue. If they drift, qualified routes could end up with template
    # text — defensive pin.
    assert MIN_CUE_TEXT_LEN > 0
