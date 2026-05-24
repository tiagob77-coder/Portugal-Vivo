"""Pure-function tests for the IQ Semantic-Validation module (M1):
_get_best_match, _get_secondary_categories (incl. the M1-SECCAT fallback
sorted-by-score fix) and _extract_keywords."""
from iq_module_m1_semantic import (
    PV_CATEGORIES,
    SECONDARY_ELIGIBLE,
    SemanticValidationModule,
)

_M = SemanticValidationModule()


# ── _get_best_match ───────────────────────────────────────────────────────────

def test_best_match_empty_scores():
    assert _M._get_best_match({}) == (None, 0.0)


def test_best_match_single():
    assert _M._get_best_match({"a": 0.7}) == ("a", 0.7)


def test_best_match_picks_highest():
    assert _M._get_best_match({"a": 0.2, "b": 0.9, "c": 0.5}) == ("b", 0.9)


# ── _get_secondary_categories ─────────────────────────────────────────────────

def test_secondary_no_primary():
    assert _M._get_secondary_categories(None, {"a": 0.8}, 0.8) == []


def test_secondary_low_primary_confidence():
    # primary_confidence < 0.4 → no secondaries.
    assert _M._get_secondary_categories("miradouros", {"a": 0.8}, 0.3) == []


def test_secondary_from_eligible_list():
    """Picks up to 2 from SECONDARY_ELIGIBLE[primary] that score >= 0.2."""
    primary = "miradouros"
    eligible_list = SECONDARY_ELIGIBLE.get(primary, [])
    assert eligible_list, "expected SECONDARY_ELIGIBLE to define 'miradouros'"
    # Score all eligible above the threshold, plus the primary itself.
    scores = {primary: 0.9, **{c: 0.5 for c in eligible_list}}
    out = _M._get_secondary_categories(primary, scores, 0.9)
    assert len(out) <= 2
    assert all(c in eligible_list for c in out)
    assert primary not in out


def test_secondary_excludes_low_scoring():
    primary = "miradouros"
    eligible_list = SECONDARY_ELIGIBLE[primary]
    # Below the 0.2 threshold → must be excluded.
    scores = {primary: 0.9, **{c: 0.1 for c in eligible_list}}
    assert _M._get_secondary_categories(primary, scores, 0.9) == []


def test_secondary_fallback_sorts_by_score():
    """M1-SECCAT: when SECONDARY_ELIGIBLE has no entry for primary, the
    fallback must pick the *top* scored other categories, not whatever
    comes first in the dict iteration."""
    primary = "xx_unknown_primary"
    # Insert in NON-sorted order; expect "high" picked first.
    scores = {primary: 0.9, "low": 0.21, "high": 0.95, "mid": 0.5}
    out = _M._get_secondary_categories(primary, scores, 0.9)
    assert out == ["high", "mid"]


# ── _extract_keywords ─────────────────────────────────────────────────────────

def test_extract_keywords_empty_category():
    assert _M._extract_keywords("qualquer texto", "") == []


def test_extract_keywords_unknown_category():
    assert _M._extract_keywords("qualquer texto", "categoria_inexistente") == []


def test_extract_keywords_finds_match():
    # Pick a real category and use one of its keywords in the text.
    category = next(iter(PV_CATEGORIES))
    keyword = PV_CATEGORIES[category][0]
    found = _M._extract_keywords(f"texto com {keyword} dentro", category)
    assert keyword in found


def test_extract_keywords_capped_at_five():
    # Build a text containing ALL keywords for a category.
    category = next(iter(PV_CATEGORIES))
    text = " ".join(PV_CATEGORIES[category])
    assert len(_M._extract_keywords(text, category)) <= 5
