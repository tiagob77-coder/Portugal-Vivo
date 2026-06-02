"""Pure-function tests for content_health_api scoring helpers — the
0–100 content-health score that powers the editorial dashboard's
"which POIs need attention" ranking.

Covers the synchronous, DB-free components:
  - _days_since                naive/aware datetime → age in days
  - _compute_image_score       0 / 5 / 20
  - _compute_description_freshness  0–25 by edit recency
  - _compute_narrative_depth   0–25 additive (capped)
  - _compute_iq_component      0–20 from iq_results (list/dict/scalar)
  - _tier                      score → healthy/attention/stale/critical
  - _build_flags               recommended-action labels

_compute_seasonal_freshness is async + DB-bound and out of scope here."""
from datetime import datetime, timedelta, timezone

import pytest

from content_health_api import (
    _build_flags,
    _compute_description_freshness,
    _compute_image_score,
    _compute_iq_component,
    _compute_narrative_depth,
    _days_since,
    _tier,
)


def _ago(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


# ── _days_since ──────────────────────────────────────────────────────────────

def test_days_since_none_returns_none():
    assert _days_since(None) is None


def test_days_since_aware_datetime():
    assert _days_since(_ago(10)) == 10


def test_days_since_naive_datetime_treated_as_utc():
    # Naive datetimes get a UTC tzinfo bolted on — must not raise.
    naive = datetime.utcnow() - timedelta(days=5)
    assert _days_since(naive) == 5


def test_days_since_now_is_zero():
    assert _days_since(datetime.now(timezone.utc)) == 0


# ── _compute_image_score ─────────────────────────────────────────────────────

def test_image_score_empty_is_zero():
    assert _compute_image_score({}) == 0
    assert _compute_image_score({"image_url": ""}) == 0
    assert _compute_image_score({"image_url": "   "}) == 0


def test_image_score_full_for_valid_http_url():
    assert _compute_image_score({"image_url": "https://cdn.example/img.jpg"}) == 20


def test_image_score_partial_for_short_or_non_http():
    # Non-http but non-empty → 5 (suspicious but present).
    assert _compute_image_score({"image_url": "/local/x.jpg"}) == 5


def test_image_score_short_http_falls_to_5():
    # http but ≤15 chars → fails the length gate → 5.
    assert _compute_image_score({"image_url": "http://x"}) == 5


def test_image_score_strips_whitespace_before_check():
    assert _compute_image_score({"image_url": "  https://cdn.example/x.jpg  "}) == 20


# ── _compute_description_freshness ───────────────────────────────────────────

def test_freshness_no_dates_returns_3():
    assert _compute_description_freshness({}) == 3


def test_freshness_only_created_at_returns_5():
    # created_at present but no last_edited → never edited after seed → 5.
    assert _compute_description_freshness({"created_at": _ago(10)}) == 5


def test_freshness_recently_edited_under_30_days():
    assert _compute_description_freshness({"last_edited_at": _ago(10)}) == 25


@pytest.mark.parametrize("days,expected", [
    (10, 25),    # < 30
    (60, 18),    # < 90
    (120, 12),   # < 180
    (300, 8),    # < 365
    (500, 5),    # >= 365
])
def test_freshness_tiers_by_edit_age(days, expected):
    assert _compute_description_freshness({"last_edited_at": _ago(days)}) == expected


def test_freshness_prefers_last_edited_over_created():
    item = {"last_edited_at": _ago(5), "created_at": _ago(900)}
    # last_edited (5 days) wins → 25, not the stale created_at tier.
    assert _compute_description_freshness(item) == 25


# ── _compute_narrative_depth ─────────────────────────────────────────────────

def test_narrative_empty_is_zero():
    assert _compute_narrative_depth({}) == 0


def test_narrative_micro_pitch_only():
    assert _compute_narrative_depth({"micro_pitch": "hook"}) == 8


def test_narrative_descricao_curta_only():
    assert _compute_narrative_depth({"descricao_curta": "resumo"}) == 7


def test_narrative_long_description_adds_5():
    assert _compute_narrative_depth({"description": "x" * 301}) == 5


def test_narrative_short_description_no_bonus():
    # ≤300 chars → no points from description.
    assert _compute_narrative_depth({"description": "x" * 300}) == 0


def test_narrative_local_story_adds_5():
    assert _compute_narrative_depth({"local_story": "lenda"}) == 5


def test_narrative_historia_local_alias():
    # historia_local is an accepted alias for local_story.
    assert _compute_narrative_depth({"historia_local": "lenda"}) == 5


def test_narrative_all_components_capped_at_25():
    item = {
        "micro_pitch": "a",       # 8
        "descricao_curta": "b",   # 7
        "description": "x" * 400,  # 5
        "local_story": "c",        # 5
    }  # raw 25 — exactly the cap
    assert _compute_narrative_depth(item) == 25


def test_narrative_whitespace_only_fields_ignored():
    assert _compute_narrative_depth({"micro_pitch": "   "}) == 0


# ── _compute_iq_component ────────────────────────────────────────────────────

def test_iq_no_results_returns_2():
    assert _compute_iq_component({}) == 2
    assert _compute_iq_component({"iq_results": None}) == 2


@pytest.mark.parametrize("score,expected", [
    (85, 20), (80, 20),
    (70, 15), (60, 15),
    (50, 10), (40, 10),
    (30, 5), (20, 5),
    (10, 2), (0, 2),
])
def test_iq_component_tiers_from_dict(score, expected):
    assert _compute_iq_component({"iq_results": {"score": score}}) == expected


def test_iq_component_averages_list_of_results():
    # [80, 60] → mean 70 → tier 15.
    item = {"iq_results": [{"score": 80}, {"score": 60}]}
    assert _compute_iq_component(item) == 15


def test_iq_component_empty_list_scores_low():
    # Empty list → mean of nothing → 0 → tier 2.
    assert _compute_iq_component({"iq_results": []}) == 2


def test_iq_component_list_ignores_non_dict_entries():
    item = {"iq_results": [{"score": 80}, "garbage", {"score": 80}]}
    # Only the two dicts count → mean 80 → 20.
    assert _compute_iq_component(item) == 20


def test_iq_component_unexpected_type_scores_low():
    assert _compute_iq_component({"iq_results": "not a structure"}) == 2


# ── _tier ────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("score,tier", [
    (100, "healthy"), (75, "healthy"),
    (74, "attention"), (50, "attention"),
    (49, "stale"), (25, "stale"),
    (24, "critical"), (0, "critical"),
])
def test_tier_boundaries(score, tier):
    assert _tier(score) == tier


# ── _build_flags ─────────────────────────────────────────────────────────────

def test_flags_empty_when_all_healthy():
    # Good across the board → no flags.
    flags = _build_flags({}, image=20, freshness=25, narrative=10, iq=20, seasonal=10)
    assert flags == []


def test_flags_no_image():
    flags = _build_flags({}, image=0, freshness=25, narrative=10, iq=20, seasonal=10)
    assert "sem_imagem" in flags


def test_flags_stale_description():
    flags = _build_flags({}, image=20, freshness=5, narrative=10, iq=20, seasonal=10)
    assert "descrição_desactualizada" in flags


def test_flags_no_narrative():
    flags = _build_flags({}, image=20, freshness=25, narrative=7, iq=20, seasonal=10)
    assert "sem_narrativa" in flags


def test_flags_no_iq():
    flags = _build_flags({}, image=20, freshness=25, narrative=10, iq=2, seasonal=10)
    assert "sem_iq_score" in flags


def test_flags_event_without_update():
    flags = _build_flags({}, image=20, freshness=25, narrative=10, iq=20, seasonal=3)
    assert "evento_próximo_sem_actualização" in flags


def test_flags_multiple_problems_accumulate():
    flags = _build_flags({}, image=0, freshness=3, narrative=0, iq=2, seasonal=3)
    assert set(flags) == {
        "sem_imagem", "descrição_desactualizada", "sem_narrativa",
        "sem_iq_score", "evento_próximo_sem_actualização",
    }


# ── Integration of the synchronous components ────────────────────────────────

def test_sync_components_sum_within_90():
    # image(20) + freshness(25) + narrative(25) + iq(20) = 90 max without
    # the async seasonal(10). Confirm a maxed-out item hits exactly 90.
    item = {
        "image_url": "https://cdn.example/photo.jpg",
        "last_edited_at": _ago(1),
        "micro_pitch": "a", "descricao_curta": "b",
        "description": "x" * 400, "local_story": "c",
        "iq_results": {"score": 95},
    }
    total = (
        _compute_image_score(item)
        + _compute_description_freshness(item)
        + _compute_narrative_depth(item)
        + _compute_iq_component(item)
    )
    assert total == 90


def test_sync_components_floor_for_empty_item():
    # Empty item: image 0 + freshness 3 + narrative 0 + iq 2 = 5.
    item = {}
    total = (
        _compute_image_score(item)
        + _compute_description_freshness(item)
        + _compute_narrative_depth(item)
        + _compute_iq_component(item)
    )
    assert total == 5
    assert _tier(total) == "critical"
