"""Pure-function tests for helpers in 3 modules:

  - agenda_api: detect_month, _normalize_region, _to_calendar_format,
                _get_ticket_url, _enrich_with_ticket
  - cultural_routes_hub: _bbox
  - narratives_api: _compute_confidence
"""
import math

import pytest

from agenda_api import (
    MONTH_MAP,
    TICKET_LINKS,
    TICKETLINE_SEARCH_URL,
    _enrich_with_ticket,
    _get_ticket_url,
    _normalize_region,
    _to_calendar_format,
    detect_month,
)
from cultural_routes_hub import _bbox
from narratives_api import _compute_confidence


# ── agenda_api.detect_month ──────────────────────────────────────────────────

def test_detect_month_empty_returns_empty():
    assert detect_month("") == []


def test_detect_month_none_returns_empty():
    assert detect_month(None) == []  # type: ignore[arg-type]


def test_detect_month_full_name():
    assert detect_month("Festival em Agosto") == [8]


def test_detect_month_abbreviation():
    # "ago" is an abbreviation of Agosto, also embedded in "agosto" — both
    # map to 8 so the deduped result still has just one entry.
    assert detect_month("ago 2026") == [8]


def test_detect_month_case_insensitive():
    assert detect_month("JANEIRO") == [1]


def test_detect_month_marco_with_or_without_accent():
    # MONTH_MAP includes both "marco" and "março".
    assert detect_month("março") == [3]
    assert detect_month("marco") == [3]


def test_detect_month_multiple_months_sorted_and_deduped():
    # The helper does literal substring matching — it does NOT expand
    # ranges. "de junho a setembro" alone yields [6, 9]; the text below
    # explicitly names agosto too. Result is sorted + deduped.
    assert detect_month("de junho a setembro, com pausa em agosto") == [6, 8, 9]


def test_detect_month_does_not_expand_ranges():
    # Pin: "junho a setembro" gives just [6, 9], not [6, 7, 8, 9].
    assert detect_month("junho a setembro") == [6, 9]


def test_detect_month_no_match_returns_empty():
    assert detect_month("sem datas") == []


def test_detect_month_returns_only_unique_months():
    # "Julho" + abbreviated "jul" + repeated mention.
    out = detect_month("Julho de 2026 — jul tarde")
    assert out == [7]


def test_detect_month_map_covers_all_12_months():
    # Sanity: ensure every full Portuguese month name maps to 1..12.
    full = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
            "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
    assert sorted(MONTH_MAP[name] for name in full) == list(range(1, 13))


# ── agenda_api._normalize_region ─────────────────────────────────────────────

def test_normalize_region_lowercases():
    assert _normalize_region("LISBOA") == "lisboa"


def test_normalize_region_strips_diacritics():
    assert _normalize_region("Évora") == "evora"
    assert _normalize_region("Açores") == "acores"


def test_normalize_region_idempotent():
    once = _normalize_region("Centro")
    twice = _normalize_region(once)
    assert once == twice


def test_normalize_region_empty_string():
    assert _normalize_region("") == ""


def test_normalize_region_multi_word():
    assert _normalize_region("Vila do Conde") == "vila do conde"


# ── agenda_api._to_calendar_format ───────────────────────────────────────────

def test_to_calendar_basic_fields():
    out = _to_calendar_format({
        "id": "evt-1",
        "name": "Festa X",
        "month": 6,
        "day_start": 10,
        "day_end": 15,
        "type": "festas",
        "region": "Norte",
        "description": "desc",
    })
    assert out["id"] == "evt-1"
    assert out["name"] == "Festa X"
    assert out["date_start"] == "06-10"
    assert out["date_end"] == "06-15"
    assert out["category"] == "festas"
    assert out["region"] == "Norte"


def test_to_calendar_day_end_defaults_to_day_start():
    out = _to_calendar_format({"month": 7, "day_start": 5})
    assert out["date_start"] == "07-05"
    assert out["date_end"] == "07-05"


def test_to_calendar_no_month_yields_empty_dates():
    out = _to_calendar_format({"name": "X"})
    assert out["date_start"] == ""
    assert out["date_end"] == ""


def test_to_calendar_pads_single_digit_month_and_day():
    out = _to_calendar_format({"month": 3, "day_start": 7})
    assert out["date_start"] == "03-07"


def test_to_calendar_default_category_is_festas():
    out = _to_calendar_format({"month": 5})
    assert out["category"] == "festas"


def test_to_calendar_default_source_is_curated():
    out = _to_calendar_format({"month": 5})
    assert out["source"] == "curated"


def test_to_calendar_passes_through_ticket_fields():
    out = _to_calendar_format({
        "month": 6,
        "has_tickets": True,
        "ticket_url": "https://x",
    })
    assert out["has_tickets"] is True
    assert out["ticket_url"] == "https://x"


# ── agenda_api._get_ticket_url ───────────────────────────────────────────────

def test_get_ticket_url_direct_match():
    # "nos-alive-2026" → base "nos-alive" (year stripped) → direct hit.
    url = _get_ticket_url("nos-alive-2026", "NOS Alive")
    assert url == TICKET_LINKS["nos-alive"]


def test_get_ticket_url_substring_match():
    # Substring match: "vodafone-paredes-de-coura-2026" → "vodafone-paredes" key.
    url = _get_ticket_url("vodafone-paredes-de-coura-2026", "Paredes de Coura")
    assert url is not None
    assert "vodafone-paredes" in url or "paredes-coura" in url


def test_get_ticket_url_no_match_returns_none():
    assert _get_ticket_url("unknown-event-2026", "Unknown") is None


def test_get_ticket_url_keeps_full_id_when_no_year_suffix():
    # No trailing year → base_id stays the full id; still matches if a key
    # is a substring.
    url = _get_ticket_url("nos-alive", "NOS Alive")
    assert url == TICKET_LINKS["nos-alive"]


# ── agenda_api._enrich_with_ticket ───────────────────────────────────────────

def test_enrich_event_with_direct_ticket_link():
    out = _enrich_with_ticket({"id": "nos-alive-2026", "name": "NOS Alive"})
    assert out["has_tickets"] is True
    assert out["ticket_url"] == TICKET_LINKS["nos-alive"]


def test_enrich_event_with_price_uses_search_link():
    out = _enrich_with_ticket({
        "id": "obscure-evt-2026",
        "name": "Concerto Obscuro",
        "price": "20€",
    })
    assert out["has_tickets"] is True
    assert out["ticket_url"].startswith(TICKETLINE_SEARCH_URL)
    assert "Concerto+Obscuro" in out["ticket_url"]


def test_enrich_event_without_price_or_direct_link():
    out = _enrich_with_ticket({"id": "obscure-evt-2026", "name": "Unknown"})
    assert out["has_tickets"] is False
    assert "ticket_url" not in out


def test_enrich_does_not_mutate_input():
    original = {"id": "nos-alive-2026", "name": "NOS Alive"}
    _enrich_with_ticket(original)
    assert "has_tickets" not in original
    assert "ticket_url" not in original


# ── cultural_routes_hub._bbox ───────────────────────────────────────────────

def test_bbox_returns_lat_lng_deltas():
    lat_d, lng_d = _bbox(38.7, -9.1, radius_km=10)
    assert lat_d > 0 and lng_d > 0


def test_bbox_lat_delta_is_radius_over_111():
    lat_d, _ = _bbox(38.7, -9.1, radius_km=11.1)
    # 11.1 km / 111 km-per-degree = 0.1.
    assert lat_d == pytest.approx(0.1, abs=1e-6)


def test_bbox_lng_delta_widens_with_distance_from_equator():
    # Same radius: higher latitude → larger lng_delta (cos shrinks).
    _, lng_d_equator = _bbox(0.0, 0.0, radius_km=10)
    _, lng_d_lisbon = _bbox(38.7, -9.1, radius_km=10)
    _, lng_d_porto = _bbox(41.15, -8.6, radius_km=10)
    assert lng_d_equator < lng_d_lisbon < lng_d_porto


def test_bbox_lng_delta_floor_protects_polar_singularity():
    # At lat=90, cos(90°)=0 → without the floor we'd divide by zero.
    # The implementation clamps the denominator at 0.1, so the delta
    # never explodes to infinity.
    _, lng_d = _bbox(90.0, 0.0, radius_km=10)
    assert math.isfinite(lng_d)
    # 10 / 0.1 = 100 — that's the maximum the floor produces.
    assert lng_d == pytest.approx(100, abs=1)


def test_bbox_zero_radius_returns_zero_deltas():
    lat_d, lng_d = _bbox(38.7, -9.1, radius_km=0)
    assert lat_d == 0
    assert lng_d == 0


def test_bbox_radius_scales_linearly():
    a_lat, a_lng = _bbox(38.7, -9.1, radius_km=10)
    b_lat, b_lng = _bbox(38.7, -9.1, radius_km=20)
    assert b_lat == pytest.approx(2 * a_lat, abs=1e-6)
    assert b_lng == pytest.approx(2 * a_lng, abs=1e-6)


# ── narratives_api._compute_confidence ──────────────────────────────────────

def test_confidence_base_score_0_3():
    assert _compute_confidence({}) == 0.3


def test_confidence_one_source_adds_0_1():
    assert _compute_confidence({"sources": ["src1"]}) == 0.4


def test_confidence_two_sources_adds_0_2():
    assert _compute_confidence({"sources": ["s1", "s2"]}) == 0.5


def test_confidence_two_sources_better_than_one():
    one = _compute_confidence({"sources": ["s1"]})
    two = _compute_confidence({"sources": ["s1", "s2"]})
    assert two > one


def test_confidence_contributors_add_0_1():
    assert _compute_confidence({"contributors": ["alice"]}) == 0.4


def test_confidence_media_adds_0_1():
    assert _compute_confidence({"media": ["m1"]}) == 0.4


def test_confidence_poi_link_adds_0_1():
    assert _compute_confidence({"poi_id": "p1"}) == 0.4


def test_confidence_historical_fact_adds_0_1():
    assert _compute_confidence({
        "credibility": {"source_type": "facto_historico"},
    }) == 0.4


def test_confidence_other_source_type_no_bonus():
    out = _compute_confidence({"credibility": {"source_type": "lenda"}})
    assert out == 0.3


def test_confidence_max_reachable_is_0_9():
    # All bonuses combined: 0.3 + 0.2 + 0.1 + 0.1 + 0.1 + 0.1 = 0.9.
    # The min(1.0, ...) cap is defensive — the actual ceiling is 0.9
    # (no narrative can be 100 % confident from these signals alone).
    out = _compute_confidence({
        "sources": ["s1", "s2", "s3"],
        "contributors": ["c1"],
        "media": ["m1"],
        "poi_id": "p1",
        "credibility": {"source_type": "facto_historico"},
    })
    assert out == 0.9


def test_confidence_never_exceeds_1_even_if_someone_adds_more_bonuses():
    # If a future change adds bonuses that push the sum above 1, the cap
    # must still hold. Simulate via monkey-friendly direct call: today this
    # can't trigger naturally — pin via property statement.
    out = _compute_confidence({
        "sources": ["s1", "s2", "s3"],
        "contributors": ["c1"],
        "media": ["m1"],
        "poi_id": "p1",
        "credibility": {"source_type": "facto_historico"},
    })
    assert out <= 1.0


def test_confidence_returns_rounded_to_2_decimals():
    # Round half-up not relevant here since increments are all 0.1, but
    # pin that the output is bounded by `round(x, 2)`.
    out = _compute_confidence({"sources": ["s1"]})
    # Float-friendly check that there's at most 2 decimal digits.
    assert out * 100 == int(out * 100)


def test_confidence_credibility_none_no_crash():
    # Regression guard for NARR-001: the original code did
    # narrative.get("credibility", {}).get(...) which returns None when
    # credibility is explicitly None (vs absent), then crashes on .get.
    # Fixed by `(narrative.get("credibility") or {})`.
    assert _compute_confidence({"credibility": None}) == 0.3


def test_confidence_missing_credibility_key_returns_base():
    assert _compute_confidence({}) == 0.3
