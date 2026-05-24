"""Pure-function tests for M8 route-scoring helpers: _score_internal_diversity
(category diversity from a route's POI list) and _get_quality_level (5-level
boundary table). The data-driven _score_* methods that depend on richer
route_data shape are not covered here."""
import pytest

from iq_engine_base import POIProcessingData
from iq_module_m8_route_scoring import RouteScoringModule

_M = RouteScoringModule()
_POI = POIProcessingData(id="x", name="x", description="")


# ── _score_internal_diversity ─────────────────────────────────────────────────

def test_diversity_no_categories_returns_base_score():
    score, details = _M._score_internal_diversity(_POI, {})
    assert score == 0.3
    assert "note" in details


def test_diversity_single_category_low():
    score, details = _M._score_internal_diversity(_POI, {"poi_categories": ["natureza"]})
    assert score == 0.3
    assert details["diversity_level"] == "baixo"


def test_diversity_two_categories_moderate():
    score, details = _M._score_internal_diversity(_POI, {
        "poi_categories": ["natureza", "cultura"],
    })
    assert score == 0.6
    assert details["diversity_level"] == "moderado"


def test_diversity_three_categories_good():
    score, details = _M._score_internal_diversity(_POI, {
        "poi_categories": ["natureza", "cultura", "gastronomia"],
    })
    assert score == 0.8
    assert details["diversity_level"] == "bom"


def test_diversity_four_or_more_excellent():
    score, details = _M._score_internal_diversity(_POI, {
        "poi_categories": ["natureza", "cultura", "gastronomia", "historia"],
    })
    assert score == 1.0
    assert details["diversity_level"] == "excelente"


def test_diversity_ratio_correct_with_duplicates():
    # 6 POIs, 2 unique categories → ratio 2/6 ≈ 0.33
    _, details = _M._score_internal_diversity(_POI, {
        "poi_categories": ["a", "a", "a", "b", "b", "b"],
    })
    assert details["diversity_ratio"] == 0.33


# ── _get_quality_level ────────────────────────────────────────────────────────

@pytest.mark.parametrize("score,level", [
    (100, "excelente"),
    (85, "excelente"),
    (84.9, "muito_bom"),
    (70, "muito_bom"),
    (69.9, "bom"),
    (55, "bom"),
    (54.9, "mediano"),
    (40, "mediano"),
    (39.9, "insuficiente"),
    (0, "insuficiente"),
])
def test_quality_level_boundaries(score, level):
    assert _M._get_quality_level(score) == level
