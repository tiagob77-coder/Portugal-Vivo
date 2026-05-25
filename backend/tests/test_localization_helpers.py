"""Pure-function tests for services/localization helpers: _tone (category →
editorial tone), _fallback_content (deterministic content when LLM unavailable),
_parse_llm_json (LLM JSON parsing with fallback). These three keep the
PT/EN bilingual content generation safe when the LLM is down or returns
malformed output."""
import json

from services.localization import (
    _fallback_content,
    _parse_llm_json,
    _tone,
)


# ── _tone ────────────────────────────────────────────────────────────────────

def test_tone_museu_pt():
    assert _tone("Museu", "pt") == "reverente, informativo e preciso"


def test_tone_museu_en():
    assert _tone("Museu", "en") == "educational and evocative"


def test_tone_substring_match():
    # "Museu Nacional" contains "museu" → museu tone.
    assert _tone("Museu Nacional", "pt") == "reverente, informativo e preciso"


def test_tone_trilho_pt():
    assert _tone("Trilho", "pt") == "entusiasta e aventureiro"


def test_tone_unknown_falls_back_to_default():
    assert _tone("xpto-categoria", "pt") == "informativo e envolvente"
    assert _tone("xpto-categoria", "en") == "informative and engaging"


def test_tone_empty_category_uses_default():
    assert _tone("", "pt") == "informativo e envolvente"


def test_tone_none_category_uses_default():
    # `category or ""` guards against None.
    assert _tone(None, "pt") == "informativo e envolvente"  # type: ignore[arg-type]


def test_tone_case_insensitive():
    # category is lowercased before substring match.
    assert _tone("PRAIA", "pt") == "relaxado e sensorial"


# ── _fallback_content ────────────────────────────────────────────────────────

def _poi(**overrides):
    base = {
        "name": "Castelo de São Jorge",
        "category": "castelo",
        "region": "Lisboa",
        "description": "Castelo medieval em Lisboa.",
        "address": "R. de Santa Cruz, Lisboa",
    }
    base.update(overrides)
    return base


def test_fallback_content_pt_returns_all_six_keys():
    out = _fallback_content(_poi(), "pt")
    assert set(out.keys()) == {
        "title", "subtitle", "short_description",
        "full_description", "cultural_fact", "practical_info",
    }


def test_fallback_content_en_returns_all_six_keys():
    out = _fallback_content(_poi(), "en")
    assert set(out.keys()) == {
        "title", "subtitle", "short_description",
        "full_description", "cultural_fact", "practical_info",
    }


def test_fallback_content_title_caps_at_60_chars():
    out = _fallback_content(_poi(name="x" * 200), "pt")
    assert len(out["title"]) <= 60


def test_fallback_content_long_description_truncated_with_ellipsis():
    long = "a" * 500
    out = _fallback_content(_poi(description=long), "pt")
    # description > 200 → first 197 chars + "..." (200 total).
    assert out["short_description"].endswith("...")
    assert len(out["short_description"]) == 200


def test_fallback_content_short_description_not_truncated():
    out = _fallback_content(_poi(description="Short."), "pt")
    assert out["short_description"] == "Short."


def test_fallback_content_full_description_capped_at_500():
    out = _fallback_content(_poi(description="a" * 800), "pt")
    assert len(out["full_description"]) == 500


def test_fallback_content_supports_legacy_pt_keys():
    # POI dicts using PT-named keys (nome, tipo, regiao, descricao, morada)
    # must also work.
    poi = {
        "nome": "Sé de Évora",
        "tipo": "monumento",
        "regiao": "Alentejo",
        "descricao": "Catedral do séc. XII.",
        "morada": "Largo do Marquês de Marialva",
    }
    out = _fallback_content(poi, "pt")
    assert "Sé de Évora" in out["title"]
    assert "Alentejo" in out["subtitle"]
    assert out["practical_info"] == "Largo do Marquês de Marialva"


def test_fallback_content_pt_handles_missing_region():
    out = _fallback_content(_poi(region=""), "pt")
    # Falls back to bare category title-cased.
    assert out["subtitle"] == "Castelo"


def test_fallback_content_en_subtitle_uses_in_preposition():
    out = _fallback_content(_poi(), "en")
    assert " in " in out["subtitle"]


def test_fallback_content_missing_name_returns_unknown():
    out = _fallback_content({}, "pt")
    assert "Unknown" in out["title"]


# ── _parse_llm_json ──────────────────────────────────────────────────────────

_FULL_JSON = {
    "title": "Castelo de São Jorge — Lisboa",
    "subtitle": "Vista panorâmica de Lisboa",
    "short_description": "Castelo medieval emblemático.",
    "full_description": "Castelo construído no séc. XI...",
    "cultural_fact": "Foi residência real até 1511.",
    "practical_info": "Aberto 9h-18h. Adultos €15.",
}


def test_parse_none_returns_fallback():
    out = _parse_llm_json(None, _poi(), "pt")
    # Same shape as fallback_content.
    assert set(out.keys()) == set(_fallback_content(_poi(), "pt").keys())


def test_parse_empty_string_returns_fallback():
    out = _parse_llm_json("", _poi(), "pt")
    assert set(out.keys()) == set(_fallback_content(_poi(), "pt").keys())


def test_parse_invalid_json_returns_fallback():
    out = _parse_llm_json("not valid json {", _poi(), "pt")
    # Falls back, doesn't raise.
    assert "title" in out


def test_parse_missing_required_key_returns_fallback():
    # Missing "practical_info".
    incomplete = {k: v for k, v in _FULL_JSON.items() if k != "practical_info"}
    out = _parse_llm_json(json.dumps(incomplete), _poi(), "pt")
    # Fallback fills in all keys (including practical_info from poi.address).
    assert "practical_info" in out
    # The fallback's address should be present (not the LLM's missing value).
    assert out["practical_info"] == _poi()["address"]


def test_parse_valid_json_returns_parsed_content():
    out = _parse_llm_json(json.dumps(_FULL_JSON), _poi(), "pt")
    assert out["title"] == _FULL_JSON["title"]
    assert out["cultural_fact"] == _FULL_JSON["cultural_fact"]


def test_parse_caps_title_at_60_chars():
    data = {**_FULL_JSON, "title": "x" * 200}
    out = _parse_llm_json(json.dumps(data), _poi(), "pt")
    assert len(out["title"]) == 60


def test_parse_caps_subtitle_at_100_chars():
    data = {**_FULL_JSON, "subtitle": "x" * 300}
    out = _parse_llm_json(json.dumps(data), _poi(), "pt")
    assert len(out["subtitle"]) == 100


def test_parse_caps_short_description_at_200_chars():
    data = {**_FULL_JSON, "short_description": "x" * 500}
    out = _parse_llm_json(json.dumps(data), _poi(), "pt")
    assert len(out["short_description"]) == 200


def test_parse_caps_full_description_at_500_chars():
    # Regression guard: previously _parse_llm_json forgot to truncate
    # full_description even though _fallback_content does. Both paths must
    # honour the same 500-char limit.
    data = {**_FULL_JSON, "full_description": "x" * 1000}
    out = _parse_llm_json(json.dumps(data), _poi(), "pt")
    assert len(out["full_description"]) == 500


def test_parse_preserves_extra_keys_in_llm_response():
    # If LLM returns extra keys beyond the required set, they should pass
    # through (only the required ones are gated, not the full key set).
    data = {**_FULL_JSON, "bonus_key": "extra"}
    out = _parse_llm_json(json.dumps(data), _poi(), "pt")
    assert out.get("bonus_key") == "extra"
