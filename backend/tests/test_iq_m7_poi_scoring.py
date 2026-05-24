"""Pure-function tests for M7 POI scoring helpers: _score_popularity,
_score_freshness and _get_quality_level. No Mongo, no LLM."""
from datetime import datetime, timedelta, timezone

import pytest

from iq_engine_base import POIProcessingData
from iq_module_m7_poi_scoring import POIScoringModule

_M = POIScoringModule()


def _data(metadata=None):
    return POIProcessingData(id="x", name="x", description="", metadata=metadata or {})


# ── _score_popularity ─────────────────────────────────────────────────────────

def test_popularity_no_data_is_zero():
    assert _M._score_popularity(_data()) == 0.0


def test_popularity_five_star_rating_alone():
    # 5-star → 40 pts (the rating slice), no views, no reviews.
    assert _M._score_popularity(_data({"rating": 5})) == 40.0


def test_popularity_combines_views_rating_reviews():
    score = _M._score_popularity(_data({
        "views": 10000, "rating": 5, "review_count": 100,
    }))
    # views ≈ log10(10001)*10 ≈ 40; rating 40; reviews ≈ log10(101)*8 ≈ 16 → ~96
    assert 90 <= score <= 100


def test_popularity_capped_at_100():
    score = _M._score_popularity(_data({
        "views": 10_000_000, "rating": 5, "review_count": 10_000,
    }))
    assert score == 100.0


def test_popularity_uses_google_rating_when_no_rating():
    assert _M._score_popularity(_data({"google_rating": 5})) == 40.0


# ── _score_freshness ──────────────────────────────────────────────────────────

def test_freshness_no_date_is_neutral():
    assert _M._score_freshness(_data()) == 50.0


def test_freshness_recent_is_max():
    recent = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    assert _M._score_freshness(_data({"last_updated": recent})) == 100.0


def test_freshness_eight_months_band():
    eight_mo = (datetime.now(timezone.utc) - timedelta(days=240)).isoformat()
    assert _M._score_freshness(_data({"last_updated": eight_mo})) == 80.0


def test_freshness_eighteen_months_band():
    eighteen_mo = (datetime.now(timezone.utc) - timedelta(days=540)).isoformat()
    assert _M._score_freshness(_data({"last_updated": eighteen_mo})) == 60.0


def test_freshness_very_old_is_min():
    very_old = (datetime.now(timezone.utc) - timedelta(days=365 * 4)).isoformat()
    assert _M._score_freshness(_data({"last_updated": very_old})) == 10.0


def test_freshness_invalid_date_is_neutral():
    assert _M._score_freshness(_data({"last_updated": "not a date"})) == 50.0


def test_freshness_accepts_naive_datetime():
    # Naive datetime → assumed UTC, should work without TypeError.
    naive = datetime.utcnow() - timedelta(days=30)
    assert _M._score_freshness(_data({"last_updated": naive})) == 100.0


# ── _get_quality_level ────────────────────────────────────────────────────────

@pytest.mark.parametrize("score,level", [
    (100, "excelente"),
    (90, "excelente"),
    (89.9, "muito_bom"),
    (75, "muito_bom"),
    (74.9, "bom"),
    (60, "bom"),
    (59.9, "mediano"),
    (40, "mediano"),
    (39.9, "insuficiente"),
    (0, "insuficiente"),
])
def test_quality_level_boundaries(score, level):
    assert _M._get_quality_level(score) == level
