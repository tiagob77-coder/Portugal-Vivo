"""Pure-function tests for two date-driven helpers:

  - geo_prehistoria_api._solar_azimuth_sunrise(lat_deg, day_of_year)
      Approximate sunrise azimuth — drives the megalithic-alignment
      overlay (antas/dolmens). The output feeds /api/prehistoria/aligned
      so an off-by-degrees regression would silently mislabel real
      archaeological alignments.

  - maritime_culture_api._is_upcoming(event, window_months)
      Filters cultural-calendar events by "current month + N months",
      including the December→January wrap-around.
"""
import datetime as dt
from unittest.mock import patch

import pytest

import maritime_culture_api
from geo_prehistoria_api import _solar_azimuth_sunrise
from maritime_culture_api import _is_upcoming


# ── _solar_azimuth_sunrise ──────────────────────────────────────────────────

# Days of year for the four seasonal landmarks.
_DOY_SPRING_EQUINOX = 79     # ~21 Mar
_DOY_SUMMER_SOLSTICE = 172   # ~21 Jun
_DOY_AUTUMN_EQUINOX = 265    # ~22 Sep
_DOY_WINTER_SOLSTICE = 355   # ~21 Dec

LISBON_LAT = 38.7
EVORA_LAT = 38.5     # most megalithic monuments cluster around Alentejo
PORTO_LAT = 41.15


def test_solar_returns_float():
    out = _solar_azimuth_sunrise(LISBON_LAT, 1)
    assert isinstance(out, float)


def test_solar_rounds_to_one_decimal():
    out = _solar_azimuth_sunrise(LISBON_LAT, 100)
    # round(x, 1) → at most one digit after the decimal point.
    text = f"{out:.10f}".rstrip("0").rstrip(".")
    if "." in text:
        decimals = text.split(".", 1)[1]
        assert len(decimals) <= 1


def test_solar_within_legal_azimuth_range_0_to_180():
    # Sunrise azimuth on any latitude/day stays between 0° (north) and
    # 180° (south); the implementation clamps cos_az to [-1, 1] before
    # acos so the output is guaranteed bounded.
    for doy in range(1, 366, 30):
        for lat in (32.0, 38.7, 42.0):
            az = _solar_azimuth_sunrise(lat, doy)
            assert 0.0 <= az <= 180.0


def test_solar_spring_equinox_at_lisbon_is_near_due_east():
    # On the equinoxes sunrise is ~90° (due east) regardless of latitude.
    az = _solar_azimuth_sunrise(LISBON_LAT, _DOY_SPRING_EQUINOX)
    assert az == pytest.approx(90, abs=2)


def test_solar_autumn_equinox_at_lisbon_is_near_due_east():
    az = _solar_azimuth_sunrise(LISBON_LAT, _DOY_AUTUMN_EQUINOX)
    assert az == pytest.approx(90, abs=2)


def test_solar_summer_solstice_at_lisbon_is_north_of_east():
    # Northern hemisphere summer → sunrise NE → azimuth < 90°.
    az = _solar_azimuth_sunrise(LISBON_LAT, _DOY_SUMMER_SOLSTICE)
    assert az < 90.0


def test_solar_winter_solstice_at_lisbon_is_south_of_east():
    # Northern hemisphere winter → sunrise SE → azimuth > 90°.
    az = _solar_azimuth_sunrise(LISBON_LAT, _DOY_WINTER_SOLSTICE)
    assert az > 90.0


def test_solar_winter_solstice_at_evora_matches_seed_data():
    # SEED_PHENOMENA in geo_prehistoria_api declares the winter solstice
    # azimuth at the Alentejo dolmens cluster as ~118.5°. The helper
    # docstring calls itself "approximate" — measured drift is ~2.1°, so
    # we allow 3° tolerance to absorb the day-of-year/declination model
    # mismatch.
    az = _solar_azimuth_sunrise(EVORA_LAT, _DOY_WINTER_SOLSTICE)
    assert az == pytest.approx(118.5, abs=3)


def test_solar_higher_latitude_has_wider_winter_excursion():
    # The further north you go, the more "south of east" the winter
    # sunrise — Porto's azimuth should exceed Lisbon's.
    porto = _solar_azimuth_sunrise(PORTO_LAT, _DOY_WINTER_SOLSTICE)
    lisbon = _solar_azimuth_sunrise(LISBON_LAT, _DOY_WINTER_SOLSTICE)
    assert porto > lisbon


def test_solar_handles_extreme_day_of_year_without_crash():
    # day_of_year clamping is implicit via the cos formula; just confirm
    # no exception on edge inputs.
    for doy in (0, 1, 365, 366):
        out = _solar_azimuth_sunrise(LISBON_LAT, doy)
        assert 0 <= out <= 180


def test_solar_at_equator_summer_solstice_well_north():
    # At lat=0, sin(decl)/cos(0)=sin(decl); summer solstice sin(decl) is
    # at its maximum positive → azimuth far north of east.
    az = _solar_azimuth_sunrise(0.0, _DOY_SUMMER_SOLSTICE)
    assert az < 70.0


# ── _is_upcoming ────────────────────────────────────────────────────────────

def _patch_current_month(month: int):
    """Return a context manager that pins `datetime.now()` inside
    maritime_culture_api to a date in the given month."""
    fake_now = dt.datetime(2026, month, 15, 12, 0, tzinfo=dt.timezone.utc)

    class _MockDT:
        @classmethod
        def now(cls, tz=None):
            return fake_now

    return patch.object(maritime_culture_api, "datetime", _MockDT)


def test_upcoming_event_in_current_month_is_true():
    with _patch_current_month(5):
        assert _is_upcoming({"month": 5}) is True


def test_upcoming_event_within_window_default_2_months():
    with _patch_current_month(5):
        assert _is_upcoming({"month": 6}) is True  # next month
        assert _is_upcoming({"month": 7}) is True  # 2 months ahead


def test_upcoming_event_past_window_returns_false():
    with _patch_current_month(5):
        assert _is_upcoming({"month": 8}) is False  # 3 months ahead


def test_upcoming_event_wraps_december_to_january():
    # November → January should be 2 months ahead and pass.
    with _patch_current_month(11):
        assert _is_upcoming({"month": 1}) is True


def test_upcoming_event_wraps_december_to_february():
    # December → February: diff = (2-12) % 12 = 2 → within default window.
    with _patch_current_month(12):
        assert _is_upcoming({"month": 2}) is True


def test_upcoming_event_in_past_month_wraps_to_far_future():
    # In May, an "April" event is treated as next-year April: diff = 11.
    with _patch_current_month(5):
        assert _is_upcoming({"month": 4}) is False


def test_upcoming_missing_month_returns_false():
    with _patch_current_month(5):
        assert _is_upcoming({}) is False
        assert _is_upcoming({"month": 0}) is False  # 0 is falsy → guard


def test_upcoming_custom_window_extends_reach():
    # With window=6, anything within 6 months ahead counts.
    with _patch_current_month(5):
        assert _is_upcoming({"month": 11}, window_months=6) is True
        assert _is_upcoming({"month": 12}, window_months=6) is False


def test_upcoming_zero_window_only_current_month():
    with _patch_current_month(5):
        assert _is_upcoming({"month": 5}, window_months=0) is True
        assert _is_upcoming({"month": 6}, window_months=0) is False


@pytest.mark.parametrize("current,event,expected", [
    # All 12 month combinations probed at the 2-month window boundary.
    (1, 1, True), (1, 2, True), (1, 3, True), (1, 4, False),
    (6, 5, False),  # 11 months ahead via wrap → outside default window
    (6, 12, False), # 6 months ahead → outside window=2
    (12, 12, True),
    (12, 1, True),
    (12, 2, True),
    (12, 3, False),
])
def test_upcoming_matrix(current, event, expected):
    with _patch_current_month(current):
        assert _is_upcoming({"month": event}) is expected
