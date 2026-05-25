"""Pure-function tests for mobility_data helpers: get_metro_frequency
(time-of-day → minutes between metros) and get_ferry_frequency (route +
hour + weekend → minutes between ferries). Both feed the transports tab
and the planner's leg-time estimation."""
import pytest

from mobility_data import get_ferry_frequency, get_metro_frequency


# ── get_metro_frequency ──────────────────────────────────────────────────────

@pytest.mark.parametrize("hour,expected_min,period_keyword", [
    # Each declared period boundary, picked at a hour inside the range.
    (8, 4, "ponta"),         # ponta_manha (7-9)
    (10, 6, "normal"),       # normal_manha (9-12)
    (13, 5, "almoço"),       # almoco (12-14)
    (15, 6, "normal"),       # normal_tarde (14-17)
    (18, 4, "ponta"),        # ponta_tarde (17-20)
    (22, 8, "noturno"),      # noite (20-24)
    (0, 10, "Última"),       # madrugada (0-1)
    (6, 8, "Início"),        # inicio (6-7)
])
def test_metro_frequency_by_period(hour, expected_min, period_keyword):
    out = get_metro_frequency(hour)
    assert out["frequency_min"] == expected_min
    assert period_keyword.lower() in out["period"].lower()


def test_metro_frequency_boundary_inclusive_start():
    # 7 starts ponta_manha (range is start <= hour < end).
    assert get_metro_frequency(7)["frequency_min"] == 4


def test_metro_frequency_boundary_exclusive_end():
    # 9 belongs to normal_manha (9-12), not ponta_manha (7-9).
    assert get_metro_frequency(9)["frequency_min"] == 6


def test_metro_frequency_hour_in_gap_falls_back():
    # 1-6 isn't covered by any declared period → fallback.
    out = get_metro_frequency(3)
    assert out["frequency_min"] == 10
    assert "Fora de serviço" in out["period"]


def test_metro_frequency_late_night_hour_23():
    # 23 is still inside noite (20-24).
    assert get_metro_frequency(23)["frequency_min"] == 8


def test_metro_frequency_midnight_boundary():
    # 0 starts madrugada (0-1).
    assert get_metro_frequency(0)["frequency_min"] == 10


def test_metro_frequency_returns_two_keys():
    out = get_metro_frequency(10)
    assert set(out.keys()) == {"frequency_min", "period"}


# ── get_ferry_frequency ──────────────────────────────────────────────────────

def _route(weekday=None, weekend=None):
    """Minimal fake route doc — only the bits the helper reads. Uses
    `is None` (not `or`) so empty dicts pass through unchanged."""
    return {
        "weekday": {"frequency_min": {"normal": 20} if weekday is None else weekday},
        "weekend": {"frequency_min": {"normal": 30} if weekend is None else weekend},
    }


def test_ferry_picks_weekday_when_not_weekend():
    route = _route(weekday={"normal": 15}, weekend={"normal": 30})
    assert get_ferry_frequency(route, hour=10, is_weekend=False) == 15


def test_ferry_picks_weekend_when_weekend():
    route = _route(weekday={"normal": 15}, weekend={"normal": 30})
    assert get_ferry_frequency(route, hour=10, is_weekend=True) == 30


def test_ferry_noite_preferred_at_hour_21():
    route = _route(weekday={"normal": 20, "noite": 60})
    assert get_ferry_frequency(route, hour=21, is_weekend=False) == 60


def test_ferry_noite_preferred_at_hour_22():
    route = _route(weekday={"normal": 20, "noite": 60})
    assert get_ferry_frequency(route, hour=22, is_weekend=False) == 60


def test_ferry_hour_20_below_noite_threshold():
    # Threshold is >=21, so 20 still falls through to normal.
    route = _route(weekday={"normal": 20, "noite": 60})
    assert get_ferry_frequency(route, hour=20, is_weekend=False) == 20


def test_ferry_ponta_morning_window_7_to_9():
    route = _route(weekday={"normal": 20, "ponta": 10})
    assert get_ferry_frequency(route, hour=8, is_weekend=False) == 10
    assert get_ferry_frequency(route, hour=7, is_weekend=False) == 10
    assert get_ferry_frequency(route, hour=9, is_weekend=False) == 10


def test_ferry_ponta_afternoon_window_17_to_19():
    route = _route(weekday={"normal": 20, "ponta": 10})
    assert get_ferry_frequency(route, hour=17, is_weekend=False) == 10
    assert get_ferry_frequency(route, hour=19, is_weekend=False) == 10


def test_ferry_outside_ponta_window_uses_normal():
    route = _route(weekday={"normal": 20, "ponta": 10})
    assert get_ferry_frequency(route, hour=15, is_weekend=False) == 20


def test_ferry_normal_used_when_no_ponta_or_noite_keys():
    route = _route(weekday={"normal": 25})
    assert get_ferry_frequency(route, hour=8, is_weekend=False) == 25
    assert get_ferry_frequency(route, hour=22, is_weekend=False) == 25


def test_ferry_fallback_to_30_when_normal_also_missing():
    route = _route(weekday={})
    assert get_ferry_frequency(route, hour=10, is_weekend=False) == 30


def test_ferry_noite_wins_over_ponta_when_both_match():
    # noite check runs first; at hour=21 ponta range doesn't trigger anyway,
    # but if a config ever sets ponta as 21-23 noite still wins because the
    # noite branch returns early.
    route = _route(weekday={"normal": 20, "noite": 60, "ponta": 10})
    assert get_ferry_frequency(route, hour=21, is_weekend=False) == 60
