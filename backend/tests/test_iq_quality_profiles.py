"""Pure-function tests for compute_reliability_level — the A/B/C classifier
applied to every POI after M7 scoring. The function consumes (iq_score,
concordant_sources, last_validation_date) and returns ReliabilityLevel.

The code branching diverges subtly from the docstring (the B-tier path does
NOT check concordant_sources despite the docstring mentioning '1 source'); these
tests pin the actual behavior so a future refactor cannot silently change it.
"""
from datetime import datetime, timedelta, timezone

import pytest

from iq_quality_profiles import (
    ReliabilityLevel,
    compute_reliability_level,
)


def _ago(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


# ── Level A — all three gates must pass ──────────────────────────────────────

def test_a_when_score_high_sources_high_validation_recent():
    assert compute_reliability_level(85, 3, _ago(30)) == ReliabilityLevel.A


def test_a_at_score_exact_boundary_80():
    assert compute_reliability_level(80, 2, _ago(30)) == ReliabilityLevel.A


def test_a_at_sources_exact_boundary_2():
    assert compute_reliability_level(90, 2, _ago(30)) == ReliabilityLevel.A


def test_a_at_validation_boundary_12_months():
    # 360 days < 12 * 30 days = 360 — at exact boundary still A.
    assert compute_reliability_level(90, 2, _ago(360)) == ReliabilityLevel.A


# ── A demotes to B/C when any gate fails ─────────────────────────────────────

def test_score_just_below_80_demotes_to_b():
    assert compute_reliability_level(79, 3, _ago(30)) == ReliabilityLevel.B


def test_sources_below_2_demotes_to_b_even_with_high_score():
    # Score 90 + 1 source + recent → B (the B branch ignores source count).
    assert compute_reliability_level(90, 1, _ago(30)) == ReliabilityLevel.B


def test_validation_just_over_12_months_demotes_to_b():
    # 13 months ≈ 390 days → A fails (>12), B still ok (<=24).
    assert compute_reliability_level(90, 3, _ago(390)) == ReliabilityLevel.B


# ── Level B — score ≥ 60 AND months ≤ 24 (sources ignored) ───────────────────

def test_b_at_score_exact_boundary_60():
    assert compute_reliability_level(60, 0, _ago(30)) == ReliabilityLevel.B


def test_b_ignores_sources_count_per_code():
    # Docstring suggests "1 source" path but code only checks score+age.
    # Zero sources at score 70 still yields B.
    assert compute_reliability_level(70, 0, _ago(100)) == ReliabilityLevel.B


def test_b_at_validation_boundary_24_months():
    # 720 days == 24 months exactly → still B.
    assert compute_reliability_level(70, 1, _ago(720)) == ReliabilityLevel.B


# ── Level C — fallback ───────────────────────────────────────────────────────

def test_c_when_score_below_60():
    assert compute_reliability_level(59, 5, _ago(1)) == ReliabilityLevel.C


def test_c_when_validation_over_24_months():
    # 25 months → fails both A (>12) and B (>24).
    assert compute_reliability_level(95, 5, _ago(760)) == ReliabilityLevel.C


def test_c_when_no_validation_date():
    # months_since_validation defaults to 9999 → fails A and B.
    assert compute_reliability_level(95, 5, None) == ReliabilityLevel.C


def test_c_when_score_zero():
    assert compute_reliability_level(0, 10, _ago(1)) == ReliabilityLevel.C


# ── Parametrised boundary matrix ─────────────────────────────────────────────

@pytest.mark.parametrize("score,sources,days_ago,expected", [
    # A: all gates satisfied
    (80, 2, 0, ReliabilityLevel.A),
    (100, 5, 200, ReliabilityLevel.A),
    # B: score ≥ 60, age ≤ 24m
    (60, 0, 0, ReliabilityLevel.B),
    (79, 1, 715, ReliabilityLevel.B),
    # C: everything else
    (59, 99, 0, ReliabilityLevel.C),
    (100, 99, 800, ReliabilityLevel.C),
    (0, 0, 0, ReliabilityLevel.C),
])
def test_reliability_matrix(score, sources, days_ago, expected):
    assert compute_reliability_level(score, sources, _ago(days_ago)) == expected


# ── Enum sanity ──────────────────────────────────────────────────────────────

def test_reliability_levels_are_string_values():
    assert ReliabilityLevel.A.value == "A"
    assert ReliabilityLevel.B.value == "B"
    assert ReliabilityLevel.C.value == "C"
