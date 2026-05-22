"""
Pure-function tests for the IQ Description module (M11) helpers: micro-pitch
truncation, article guessing, the needs-improvement heuristic, style /
landscape guessing and the quality score. No LLM, no Mongo — these methods
are pure transforms over a POIProcessingData.
"""
import pytest

from iq_engine_base import POIProcessingData
from iq_module_m11_description import DescriptionGenerationModule

_M = DescriptionGenerationModule()


def _data(description="", category=None, tags=None):
    return POIProcessingData(
        id="poi-1",
        name="Local",
        description=description,
        category=category,
        tags=tags or [],
    )


# ── _make_micro_pitch ─────────────────────────────────────────────────────────

def test_micro_pitch_empty_text():
    assert _M._make_micro_pitch("") == ""


def test_micro_pitch_short_text_returned_whole():
    assert _M._make_micro_pitch("Uma frase curta.") == "Uma frase curta."


def test_micro_pitch_takes_first_sentence():
    assert _M._make_micro_pitch("Primeira frase. Segunda frase.") == "Primeira frase."


def test_micro_pitch_long_sentence_truncated_within_limit():
    long = "palavra " * 40  # 320 chars, single sentence (no . ! ?)
    pitch = _M._make_micro_pitch(long)
    assert len(pitch) <= 160
    assert pitch.endswith("…")


# ── _get_article ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("name,article", [
    ("Igreja", "uma"),     # -a
    ("Cidade", "uma"),     # -ade
    ("Estação", "uma"),    # -ção
    ("Castelo", "um"),
    ("Miradouro", "um"),
])
def test_get_article(name, article):
    assert _M._get_article(name) == article


# ── _needs_improvement ────────────────────────────────────────────────────────

def test_needs_improvement_empty_description():
    assert _M._needs_improvement(_data(description="")) == (True, "Sem descrição")


def test_needs_improvement_too_short():
    assert _M._needs_improvement(_data(description="x" * 30))[0] is True


def test_needs_improvement_too_long():
    assert _M._needs_improvement(_data(description="x" * 600))[0] is True


def test_needs_improvement_generic_and_short():
    needs, _ = _M._needs_improvement(_data(description="interessante " + "x" * 60))
    assert needs is True


def test_needs_improvement_missing_category_keywords():
    needs, _ = _M._needs_improvement(_data(description="x" * 120, category="museus"))
    assert needs is True


def test_needs_improvement_good_description_passes():
    assert _M._needs_improvement(_data(description="x" * 120)) == (False, None)


# ── _guess_style ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("text,style", [
    ("barroco", "barroca"),
    ("gótico", "gótica"),
    ("românico", "românica"),
    ("manuelino", "manuelina"),
    ("sem pistas", "notável"),
])
def test_guess_style(text, style):
    assert _M._guess_style(_data(description=text)) == style


# ── _guess_landscape ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("text,landscape", [
    ("serra alta", "montanhosas"),
    ("junto ao rio", "fluviais"),
    ("praia dourada", "costeiras"),
    ("floresta densa", "florestais"),
    ("sem pistas", "deslumbrantes"),
])
def test_guess_landscape(text, landscape):
    assert _M._guess_landscape(_data(description=text)) == landscape


# ── _calculate_quality_score ──────────────────────────────────────────────────

def test_quality_score_empty_is_zero():
    assert _M._calculate_quality_score("", _data()) == 0


def test_quality_score_is_clamped_to_0_100():
    desc = (
        "Descobre a beleza histórica e a cultura autêntica deste local "
        "verdadeiramente especial e memorável. " + "x" * 120
    )
    score = _M._calculate_quality_score(desc, _data())
    assert 0 <= score <= 100


def test_quality_score_rewards_a_rich_description():
    rich = (
        "Descobre a beleza histórica e a cultura autêntica deste local "
        "especial — uma experiência memorável e imperdível para todos."
    )
    plain = "x" * 40
    assert _M._calculate_quality_score(rich, _data()) > _M._calculate_quality_score(plain, _data())


def test_quality_score_penalises_generic_phrases():
    base = "A" * 200
    generic = "A" * 180 + " vale a pena"
    assert _M._calculate_quality_score(generic, _data()) < _M._calculate_quality_score(base, _data())
