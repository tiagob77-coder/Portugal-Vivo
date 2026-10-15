"""Pure-function tests for planner_api helpers — the small functions that
back the smart-itinerary builder:

  - _get_day_theme         day → curated label
  - _get_day_tip           (region, day) → curated transport tip
  - _order_pois_by_proximity  nearest-neighbor ordering
  - _estimate_travel_minutes  distance → driving minutes (min 5)
  - _get_visit_minutes     category → visit minutes (default 45)
  - _is_gastro_category    boolean for lunch/dinner slots
  - _categories_compatible_sequence  monotony guard
  - _assign_time_period    POI → time-of-day bucket
"""
import pytest

from planner_api import (
    PERIOD_CATEGORIES,
    VISIT_TIME_MINUTES,
    _assign_time_period,
    _categories_compatible_sequence,
    _estimate_travel_minutes,
    _get_day_theme,
    _get_day_tip,
    _get_visit_minutes,
    _is_gastro_category,
    _order_pois_by_proximity,
    _select_along_corridor,
    _select_corridor_pois,
)


# ── _get_day_theme ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("day,expected", [
    (1, "Chegada e Descoberta"),
    (2, "Imersao Cultural"),
    (3, "Sabores e Tradicoes"),
    (4, "Natureza e Aventura"),
    (5, "Patrimonio Escondido"),
    (6, "Arte e Musica"),
    (7, "Dia de Descanso e Praia"),
])
def test_day_theme_known_days(day, expected):
    assert _get_day_theme(day, []) == expected


def test_day_theme_day_8_uses_fallback():
    assert _get_day_theme(8, []) == "Exploracao Dia 8"


def test_day_theme_day_0_uses_fallback():
    assert _get_day_theme(0, []) == "Exploracao Dia 0"


def test_day_theme_interests_arg_is_currently_ignored():
    # The `interests` parameter is declared but the body doesn't read it.
    # Pin the actual behavior so a future refactor that wires it up can't
    # silently change existing themes.
    assert _get_day_theme(1, ["cultura"]) == "Chegada e Descoberta"
    assert _get_day_theme(1, ["natureza", "praia"]) == "Chegada e Descoberta"


# ── _get_day_tip ─────────────────────────────────────────────────────────────

def test_day_tip_norte_day_1():
    tip = _get_day_tip(1, "Norte")
    assert "Porto" in tip and "Metro" in tip


def test_day_tip_lisboa_day_1():
    tip = _get_day_tip(1, "Lisboa")
    assert "Navegante" in tip


def test_day_tip_algarve_day_1_mentions_vamus_pass():
    tip = _get_day_tip(1, "Algarve")
    assert "Vamus Pass" in tip


def test_day_tip_unknown_region_returns_default():
    tip = _get_day_tip(1, "Açores")
    assert "Explore com calma" in tip


def test_day_tip_known_region_unknown_day_returns_default():
    # Norte covers day 1 + 2 only.
    tip = _get_day_tip(5, "Norte")
    assert "Explore com calma" in tip


# ── _order_pois_by_proximity ─────────────────────────────────────────────────

def _poi(name, lat, lng):
    return {"name": name, "location": {"lat": lat, "lng": lng}}


def test_order_empty_list_returns_empty():
    assert _order_pois_by_proximity([]) == []


def test_order_single_poi_returns_unchanged():
    pois = [_poi("A", 38.7, -9.1)]
    assert _order_pois_by_proximity(pois) == pois


def test_order_two_pois_returns_unchanged():
    a = _poi("A", 38.7, -9.1)
    b = _poi("B", 41.0, -8.5)
    # First POI is always the anchor; nearest from A is B (only option).
    assert _order_pois_by_proximity([a, b]) == [a, b]


def test_order_three_pois_uses_nearest_neighbor():
    # Lisboa anchor → nearest is Sintra (~25km), then Porto (~270km from Sintra).
    lisboa = _poi("Lisboa", 38.72, -9.14)
    sintra = _poi("Sintra", 38.80, -9.39)
    porto = _poi("Porto", 41.15, -8.61)
    ordered = _order_pois_by_proximity([lisboa, porto, sintra])
    assert [p["name"] for p in ordered] == ["Lisboa", "Sintra", "Porto"]


def test_order_returns_same_count():
    pois = [_poi(f"P{i}", 38 + i * 0.1, -9 - i * 0.1) for i in range(5)]
    assert len(_order_pois_by_proximity(pois)) == 5


def test_order_missing_location_defaults_to_origin():
    # Without lat/lng, .get(...).get(...) returns 0 → POI ends up "near" (0,0).
    a = _poi("A", 38.72, -9.14)
    b = {"name": "NoCoords"}
    c = _poi("C", 41.0, -8.5)
    # The function shouldn't crash on missing coords.
    ordered = _order_pois_by_proximity([a, b, c])
    assert len(ordered) == 3


# ── _estimate_travel_minutes ─────────────────────────────────────────────────

def test_estimate_travel_zero_distance_returns_zero():
    assert _estimate_travel_minutes(0) == 0


def test_estimate_travel_negative_distance_returns_zero():
    assert _estimate_travel_minutes(-10) == 0


def test_estimate_travel_small_distance_clamps_to_min_5():
    # 1 km / 50 km/h * 60 = 1.2 min → clamped to 5.
    assert _estimate_travel_minutes(1) == 5


def test_estimate_travel_50km_takes_one_hour():
    # Exactly at 50 km/h average speed.
    assert _estimate_travel_minutes(50) == 60


def test_estimate_travel_100km_takes_two_hours():
    assert _estimate_travel_minutes(100) == 120


def test_estimate_travel_rounds_to_nearest_minute():
    # 3 km → 3.6 min → max(5, round(3.6)) = max(5, 4) = 5
    assert _estimate_travel_minutes(3) == 5
    # 10 km → 12 min
    assert _estimate_travel_minutes(10) == 12


# ── _get_visit_minutes ───────────────────────────────────────────────────────

def test_visit_minutes_museus_is_60():
    assert _get_visit_minutes("museus") == 60


def test_visit_minutes_castelos_is_75():
    assert _get_visit_minutes("castelos") == 75


def test_visit_minutes_unknown_category_defaults_to_45():
    assert _get_visit_minutes("nonexistent_xpto") == 45


def test_visit_minutes_empty_category_defaults_to_45():
    assert _get_visit_minutes("") == 45


def test_visit_minutes_all_known_categories_return_their_values():
    for cat, mins in VISIT_TIME_MINUTES.items():
        assert _get_visit_minutes(cat) == mins


# ── _is_gastro_category ──────────────────────────────────────────────────────

@pytest.mark.parametrize("cat", [
    "restaurantes_gastronomia",
    "tabernas_historicas",
    "pratos_tipicos",
    "mercados_feiras",
    "docaria_regional",
])
def test_is_gastro_true_for_gastro_categories(cat):
    assert _is_gastro_category(cat) is True


@pytest.mark.parametrize("cat", [
    "museus", "castelos", "miradouros", "percursos_pedestres", "",
])
def test_is_gastro_false_for_non_gastro(cat):
    assert _is_gastro_category(cat) is False


# ── _categories_compatible_sequence ──────────────────────────────────────────

def test_compatible_two_museums_in_a_row_rejected():
    assert _categories_compatible_sequence("museus", "museus") is False


def test_compatible_heavy_trail_pairs_rejected():
    heavy = ["percursos_pedestres", "ecovias_passadicos", "aventura_natureza"]
    for a in heavy:
        for b in heavy:
            assert _categories_compatible_sequence(a, b) is False


def test_compatible_two_gastro_in_a_row_rejected():
    assert _categories_compatible_sequence(
        "restaurantes_gastronomia", "tabernas_historicas",
    ) is False
    assert _categories_compatible_sequence(
        "mercados_feiras", "pratos_tipicos",
    ) is False


def test_compatible_different_categories_allowed():
    assert _categories_compatible_sequence("museus", "miradouros") is True
    assert _categories_compatible_sequence("castelos", "praias_bandeira_azul") is True


def test_compatible_museum_then_trail_allowed():
    assert _categories_compatible_sequence("museus", "percursos_pedestres") is True


def test_compatible_gastro_then_museum_allowed():
    assert _categories_compatible_sequence("restaurantes_gastronomia", "museus") is True


# ── _assign_time_period ──────────────────────────────────────────────────────

def test_assign_returns_preferred_period_when_category_fits():
    poi = {"category": "museus"}
    # museus is in PERIOD_CATEGORIES["manha"] AND "tarde" — preference wins.
    assert _assign_time_period(poi, "manha") == "manha"
    assert _assign_time_period(poi, "tarde") == "tarde"


def test_assign_falls_back_to_first_matching_period():
    # surf is only in "tarde" — even if preference is "manha", surf can't
    # fit there, so fallback picks the first period it does fit.
    poi = {"category": "surf"}
    assert _assign_time_period(poi, "manha") == "tarde"


def test_assign_returns_tarde_when_no_period_matches():
    poi = {"category": "totally_unknown_category"}
    assert _assign_time_period(poi, "manha") == "tarde"


def test_assign_missing_category_returns_tarde():
    assert _assign_time_period({}, "manha") == "tarde"


def test_assign_gastronomy_to_almoco():
    poi = {"category": "restaurantes_gastronomia"}
    assert _assign_time_period(poi, "almoco") == "almoco"


def test_assign_festival_to_noite():
    poi = {"category": "festivais_musica"}
    assert _assign_time_period(poi, "noite") == "noite"


def test_assign_iterates_periods_in_dict_order():
    # PERIOD_CATEGORIES is a dict; Python 3.7+ preserves insertion order.
    # If a POI fits multiple periods and the preference doesn't match any
    # of them, the FIRST period (in declaration order) wins.
    # miradouros is in "manha" and "fim_tarde" → manha wins on fallback.
    poi = {"category": "miradouros"}
    assert _assign_time_period(poi, "almoco") == "manha"


# ── PERIOD_CATEGORIES sanity ─────────────────────────────────────────────────

def test_period_categories_covers_5_buckets():
    assert set(PERIOD_CATEGORIES.keys()) == {
        "manha", "almoco", "tarde", "fim_tarde", "noite",
    }


def test_period_categories_lunch_bucket_all_gastro_compatible():
    # Every category in the lunch slot should be eligible for the
    # "is_gastro" check (else the planner picks lunch POIs that
    # _categories_compatible_sequence then rejects from following each
    # other — internally inconsistent).
    for cat in PERIOD_CATEGORIES["almoco"]:
        # mercados_feiras is in both almoco and manha — it qualifies as
        # gastro for the sequence guard.
        assert _is_gastro_category(cat), f"{cat} in almoco but not gastro"


class TestCorridorSelection:
    """_select_corridor_pois / _select_along_corridor — corridor trip planning."""

    ORIGIN = {"lat": 41.0, "lng": -8.0}
    DESTINATION = {"lat": 38.0, "lng": -8.0}

    @staticmethod
    def _poi(name, lat, lng, category="museus", iq=50):
        return {
            "id": name,
            "name": name,
            "category": category,
            "iq_score": iq,
            "location": {"lat": lat, "lng": lng},
        }

    def test_keeps_only_pois_inside_the_corridor(self):
        pois = [
            self._poi("dentro", 40.0, -8.05),   # ~4 km off axis
            self._poi("fora", 40.0, -6.50),     # ~127 km off axis
        ]
        result = _select_corridor_pois(pois, self.ORIGIN, self.DESTINATION, 15)
        assert [p["name"] for p in result] == ["dentro"]

    def test_orders_from_origin_to_destination(self):
        pois = [
            self._poi("sul", 38.5, -8.0),
            self._poi("norte", 40.5, -8.0),
            self._poi("meio", 39.5, -8.0),
        ]
        result = _select_corridor_pois(pois, self.ORIGIN, self.DESTINATION, 15)
        assert [p["name"] for p in result] == ["norte", "meio", "sul"]

    def test_annotates_offset_and_progress(self):
        result = _select_corridor_pois(
            [self._poi("x", 39.5, -8.05)], self.ORIGIN, self.DESTINATION, 15
        )
        poi = result[0]
        assert 0 < poi["corridor_offset_km"] < 15
        assert 0 < poi["corridor_progress"] < 1

    def test_skips_pois_without_coordinates(self):
        pois = [{"id": "sem-gps", "name": "sem-gps", "category": "museus", "location": {}}]
        assert _select_corridor_pois(pois, self.ORIGIN, self.DESTINATION, 15) == []

    def test_widening_the_corridor_admits_more(self):
        pois = [self._poi("desvio", 40.0, -8.3)]  # ~25 km off axis
        assert _select_corridor_pois(pois, self.ORIGIN, self.DESTINATION, 15) == []
        assert len(_select_corridor_pois(pois, self.ORIGIN, self.DESTINATION, 30)) == 1

    def test_selection_spreads_along_the_route(self):
        # 30 POIs evenly spaced; asking for 6 should not bunch them together
        pois = _select_corridor_pois(
            [self._poi(f"p{i}", 41.0 - i * 0.1, -8.0, iq=i) for i in range(30)],
            self.ORIGIN, self.DESTINATION, 15,
        )
        chosen = _select_along_corridor(pois, total_needed=6, per_day=3)
        assert len(chosen) == 6
        progresses = [p["corridor_progress"] for p in chosen]
        # Monotonic, and actually reaching towards the destination
        assert progresses == sorted(progresses)
        assert progresses[-1] - progresses[0] > 0.5

    def test_selection_prefers_unused_categories_within_a_day(self):
        pois = _select_corridor_pois(
            [
                self._poi("a", 40.8, -8.0, category="castelos", iq=90),
                self._poi("b", 40.6, -8.0, category="castelos", iq=95),
                self._poi("c", 40.5, -8.0, category="museus", iq=10),
                self._poi("d", 40.2, -8.0, category="miradouros", iq=80),
            ],
            self.ORIGIN, self.DESTINATION, 15,
        )
        chosen = _select_along_corridor(pois, total_needed=3, per_day=3)
        # Despite its low score, the museum wins its slice for being a fresh category
        assert len({p["category"] for p in chosen}) > 1

    def test_returns_everything_when_fewer_than_needed(self):
        pois = _select_corridor_pois(
            [self._poi("a", 40.5, -8.0), self._poi("b", 39.5, -8.0)],
            self.ORIGIN, self.DESTINATION, 15,
        )
        assert len(_select_along_corridor(pois, total_needed=10, per_day=3)) == 2

    def test_empty_corridor_yields_no_selection(self):
        assert _select_along_corridor([], total_needed=6, per_day=3) == []
