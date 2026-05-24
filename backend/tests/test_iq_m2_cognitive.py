"""
Pure-function tests for the IQ Cognitive Inference module (M2). Targets the
keyword-agnostic helpers: best-season selection, key-phrase extraction, the
accessibility structure and the entities structure. The keyword-based
helpers (`_infer_*`, `_extract_seasons`, etc.) depend on internal keyword
dictionaries set up in __init__ and are not covered here.
"""
from iq_module_m2_cognitive import CognitiveInferenceModule

_M = CognitiveInferenceModule()


# ── _best_season_single ───────────────────────────────────────────────────────

def test_best_season_empty_list_is_none():
    assert _M._best_season_single([]) is None


def test_best_season_single_entry_returned():
    assert _M._best_season_single(["primavera"]) == "primavera"


def test_best_season_three_or_more_collapses_to_year_round():
    assert _M._best_season_single(["primavera", "verao", "outono"]) == "todo_o_ano"


def test_best_season_two_entries_picks_first():
    # When exactly two seasons match, the heuristic keeps the first.
    assert _M._best_season_single(["primavera", "outono"]) == "primavera"


def test_best_season_four_entries_year_round():
    assert _M._best_season_single(["primavera", "verao", "outono", "inverno"]) == "todo_o_ano"


# ── _extract_key_phrases ──────────────────────────────────────────────────────

def test_key_phrases_empty_text_is_empty():
    assert _M._extract_key_phrases("") == []


def test_key_phrases_short_text_is_empty():
    assert _M._extract_key_phrases("Curto.") == []   # < 20 chars total


def test_key_phrases_filters_phrases_shorter_than_twenty_chars():
    # Three sentences, only the long ones survive the > 20 filter.
    text = "Curta. Esta é uma frase suficientemente comprida para passar o filtro. Ok."
    phrases = _M._extract_key_phrases(text)
    assert all(len(p) > 20 for p in phrases)


def test_key_phrases_returns_at_most_three():
    text = (
        "Esta é a primeira frase suficientemente comprida para passar o filtro. "
        "Esta é a segunda frase suficientemente comprida para passar o filtro. "
        "Esta é a terceira frase suficientemente comprida para passar o filtro. "
        "Esta é a quarta frase suficientemente comprida para passar o filtro."
    )
    assert len(_M._extract_key_phrases(text)) <= 3


# ── _check_accessibility ──────────────────────────────────────────────────────

def test_check_accessibility_empty_text_structure():
    result = _M._check_accessibility("")
    assert result["mentioned"] is False
    assert result["keywords_found"] == []


# ── _extract_entities ─────────────────────────────────────────────────────────

def test_extract_entities_returns_three_buckets():
    result = _M._extract_entities("")
    assert set(result.keys()) == {"locations", "dates", "numbers"}
    assert all(isinstance(v, list) for v in result.values())
