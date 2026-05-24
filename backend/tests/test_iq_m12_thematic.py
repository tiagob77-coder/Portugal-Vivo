"""Pure-function tests for M12 thematic helper _classify_narrative_role —
the narrative-arc classifier that returns intro / climax / closure / flexible
based on counts of category-specific signal keywords."""
from iq_module_m12_thematic import (
    NARRATIVE_CLIMAX_SIGNALS,
    NARRATIVE_CLOSURE_SIGNALS,
    NARRATIVE_INTRO_SIGNALS,
    ThematicRoutingModule,
)

_M = ThematicRoutingModule()


def test_empty_text_is_flexible():
    assert _M._classify_narrative_role("", "any") == "flexible"


def test_text_with_no_signals_is_flexible():
    assert _M._classify_narrative_role("texto sem sinais nenhuns", "any") == "flexible"


def test_intro_signal_classifies_as_intro():
    text = f"contém {NARRATIVE_INTRO_SIGNALS[0]} dentro"
    assert _M._classify_narrative_role(text, "any") == "intro"


def test_climax_signal_classifies_as_climax():
    text = f"contém {NARRATIVE_CLIMAX_SIGNALS[0]} dentro"
    assert _M._classify_narrative_role(text, "any") == "climax"


def test_closure_signal_classifies_as_closure():
    text = f"contém {NARRATIVE_CLOSURE_SIGNALS[0]} dentro"
    assert _M._classify_narrative_role(text, "any") == "closure"


def test_climax_wins_tie_over_intro():
    # One intro + one climax → climax (climax is checked first on tie).
    text = f"{NARRATIVE_INTRO_SIGNALS[0]} e {NARRATIVE_CLIMAX_SIGNALS[0]}"
    assert _M._classify_narrative_role(text, "any") == "climax"


def test_closure_wins_tie_over_intro():
    # One intro + one closure → closure.
    text = f"{NARRATIVE_INTRO_SIGNALS[0]} e {NARRATIVE_CLOSURE_SIGNALS[0]}"
    assert _M._classify_narrative_role(text, "any") == "closure"


def test_higher_intro_count_wins_against_single_closure():
    # 2 intro signals vs 1 closure → max = 2 → intro wins.
    if len(NARRATIVE_INTRO_SIGNALS) < 2:
        return  # not enough intro signals to test this case
    text = (
        f"{NARRATIVE_INTRO_SIGNALS[0]} e {NARRATIVE_INTRO_SIGNALS[1]} "
        f"e {NARRATIVE_CLOSURE_SIGNALS[0]}"
    )
    assert _M._classify_narrative_role(text, "any") == "intro"
