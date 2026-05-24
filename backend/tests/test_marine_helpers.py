"""Pure-function tests for services/marine_service.py:
the cardinal-direction conversion and the surf-quality classifier."""
import pytest

from services.marine_service import _calculate_surf_quality, _degrees_to_cardinal


# ── _degrees_to_cardinal ──────────────────────────────────────────────────────

@pytest.mark.parametrize("deg,expected", [
    (0, "N"),
    (22.5, "NNE"),
    (45, "NE"),
    (67.5, "ENE"),
    (90, "E"),
    (135, "SE"),
    (180, "S"),
    (225, "SW"),
    (270, "W"),
    (315, "NW"),
    (360, "N"),         # wraps via % 16
    (720, "N"),         # extra wrap
])
def test_cardinal_at_compass_points(deg, expected):
    assert _degrees_to_cardinal(deg) == expected


def test_cardinal_negative_wraps():
    # -90° == 270° → W (Python's round + modulo handles negatives correctly)
    assert _degrees_to_cardinal(-90) == "W"


# ── _calculate_surf_quality ───────────────────────────────────────────────────

def _spot(spot_type=None):
    return {"type": spot_type} if spot_type else {}


def test_surf_flat_when_low_wave_low_period_windy():
    # height 0.2 * 0.4 + period 0.3 * 0.3 + wind 0.2 * 0.3 = 0.23 < 0.3 → flat
    assert _calculate_surf_quality(0.1, 4, 35, wave_direction=0, spot_info=_spot()) == "flat"


def test_surf_excellent_ideal_conditions():
    # height good (1m → 1.0), period good (12s → 1.0), wind light (5 → 1.0) → 1.0 → excellent
    assert _calculate_surf_quality(1.0, 12, 5, wave_direction=0, spot_info=_spot()) == "excellent"


def test_surf_big_wave_spot_uses_different_scale():
    # Big-wave spot with 3 m waves → height_score 1.0 (vs 0.5 on a normal spot)
    big = _calculate_surf_quality(3.0, 12, 5, wave_direction=0, spot_info=_spot("big_wave"))
    normal = _calculate_surf_quality(3.0, 12, 5, wave_direction=0, spot_info=_spot())
    assert big == "excellent"
    assert normal != "excellent"


def test_surf_big_wave_spot_below_threshold_penalised():
    # Big-wave spot with only 1 m waves → height_score 0.3 (not enough for the spot).
    # Even with ideal period and wind it must NOT reach "excellent".
    result = _calculate_surf_quality(1.0, 12, 5, wave_direction=0, spot_info=_spot("big_wave"))
    assert result != "excellent"


def test_surf_too_windy_degrades_score():
    calm = _calculate_surf_quality(1.0, 12, 5, wave_direction=0, spot_info=_spot())
    windy = _calculate_surf_quality(1.0, 12, 35, wave_direction=0, spot_info=_spot())
    # Wind quality drops from 1.0 to 0.2 → total drops by 0.24, knocking it below "excellent".
    assert calm == "excellent"
    assert windy != "excellent"


def test_surf_returns_known_label():
    # Sanity: whatever inputs we throw at it, the output is one of the documented labels.
    labels = {"excellent", "good", "fair", "poor", "flat"}
    for h in (0.1, 0.5, 1.0, 2.0, 3.0):
        for p in (4, 8, 12, 16):
            for w in (5, 15, 25, 35):
                assert _calculate_surf_quality(h, p, w, wave_direction=0, spot_info=_spot()) in labels
