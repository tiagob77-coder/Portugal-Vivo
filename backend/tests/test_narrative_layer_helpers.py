"""Pure-function tests for narrative_layer_api helpers: _cache_key (24-char
SHA-256 prefix used as primary key on the narrative_cache collection),
_entity_summary (LLM prompt builder fed by heterogeneous entity docs),
_fallback_narrative (deterministic shape returned when LLM unavailable).

These three are the only failure-mode surfaces we can test without a DB
and without mocking the LLM provider — the LLM branch and the cache
read/write are out of scope."""
import pytest

from narrative_layer_api import (
    NarrativeRequest,
    PERSONAS,
    _cache_key,
    _entity_summary,
    _fallback_narrative,
)


# ── _cache_key ───────────────────────────────────────────────────────────────

def _req(**overrides):
    base = {
        "entity_type": "heritage",
        "entity_id": "torre-belem",
        "persona": "default",
        "mood": "default",
        "lang": "pt",
        "season": None,
        "force": False,
    }
    base.update(overrides)
    return NarrativeRequest(**base)


def test_cache_key_length_is_24():
    assert len(_cache_key(_req())) == 24


def test_cache_key_is_hex():
    key = _cache_key(_req())
    assert all(c in "0123456789abcdef" for c in key)


def test_cache_key_stable_for_same_input():
    assert _cache_key(_req()) == _cache_key(_req())


def test_cache_key_differs_when_entity_id_changes():
    assert _cache_key(_req(entity_id="a")) != _cache_key(_req(entity_id="b"))


def test_cache_key_differs_when_persona_changes():
    assert _cache_key(_req(persona="familia")) != _cache_key(_req(persona="estudante"))


def test_cache_key_differs_when_mood_changes():
    assert _cache_key(_req(mood="aventureiro")) != _cache_key(_req(mood="festivo"))


def test_cache_key_differs_when_lang_changes():
    assert _cache_key(_req(lang="pt")) != _cache_key(_req(lang="en"))


def test_cache_key_differs_when_season_changes():
    assert _cache_key(_req(season="verao")) != _cache_key(_req(season="inverno"))


def test_cache_key_force_flag_ignored():
    # `force` is meta — it should NOT influence the key, otherwise force=true
    # would write to a different cache row from force=false and the cache
    # would never serve anyone using force=true.
    assert _cache_key(_req(force=False)) == _cache_key(_req(force=True))


def test_cache_key_none_season_equals_empty_string_season():
    # The helper does `req.season or ''`, so None and "" hash identically.
    assert _cache_key(_req(season=None)) == _cache_key(_req(season=""))


# ── _entity_summary ──────────────────────────────────────────────────────────

def test_summary_includes_name_and_type():
    out = _entity_summary({"name": "Torre de Belém"}, "heritage")
    assert "Nome: Torre de Belém" in out
    assert "Tipo: heritage" in out


def test_summary_name_fallback_to_common_name():
    out = _entity_summary({"common_name": "Sardinha"}, "marine")
    assert "Nome: Sardinha" in out


def test_summary_name_fallback_to_species_name():
    out = _entity_summary({"species_name": "Carcharhinus"}, "marine")
    assert "Nome: Carcharhinus" in out


def test_summary_name_dash_when_all_missing():
    out = _entity_summary({}, "heritage")
    assert "Nome: —" in out


def test_summary_includes_region_when_present():
    out = _entity_summary({"name": "X", "region": "Norte"}, "heritage")
    assert "Região: Norte" in out


def test_summary_skips_region_when_empty():
    out = _entity_summary({"name": "X", "region": ""}, "heritage")
    assert "Região" not in out


def test_summary_municipality_singular():
    out = _entity_summary({"name": "X", "municipality": "Lisboa"}, "heritage")
    assert "Município(s): Lisboa" in out


def test_summary_municipality_singular_wins_over_plural():
    # The `or` chain at narrative_layer_api:227-229 evaluates
    #   doc.get("municipality") or doc.get("municipalities")
    # so the singular field is returned first when both are present.
    # Note this is the OPPOSITE precedence from knowledge_graph_api's
    # _normalise (which picks plural first) — the two helpers are
    # inconsistent on the same data shape. Pinned here so a future
    # alignment is intentional rather than accidental.
    out = _entity_summary({
        "name": "X",
        "municipality": "A",
        "municipalities": ["B", "C"],
    }, "heritage")
    assert "Município(s): A" in out
    assert "B" not in out


def test_summary_description_truncated_at_300():
    out = _entity_summary({
        "name": "X",
        "description": "x" * 500,
    }, "heritage")
    # Locate the description payload and check its length.
    desc_line = next(line for line in out.split("\n") if line.startswith("Descrição: "))
    payload = desc_line[len("Descrição: "):]
    assert len(payload) == 300


def test_summary_description_fallback_order_short_then_story():
    # description_short wins over story_short wins over description.
    out = _entity_summary({
        "name": "X",
        "description_short": "SHORT",
        "story_short": "STORY",
        "description": "FULL",
    }, "heritage")
    assert "Descrição: SHORT" in out


def test_summary_unesco_label_used_when_present():
    out = _entity_summary({"name": "X", "unesco_label": "Património Mundial"}, "heritage")
    assert "UNESCO: Património Mundial" in out


def test_summary_unesco_bool_emits_sim():
    out = _entity_summary({"name": "X", "unesco": True}, "heritage")
    assert "UNESCO: sim" in out


def test_summary_unesco_skipped_when_false_and_no_label():
    out = _entity_summary({"name": "X", "unesco": False}, "heritage")
    assert "UNESCO" not in out


def test_summary_list_fields_truncated_at_6_items():
    out = _entity_summary({
        "name": "X",
        "instruments": [f"inst{i}" for i in range(20)],
    }, "music")
    # Find the instruments line and count comma-separated values.
    inst_line = next(line for line in out.split("\n") if line.startswith("instruments:"))
    items = inst_line.split(": ", 1)[1].split(", ")
    assert len(items) == 6


def test_summary_empty_list_skipped():
    out = _entity_summary({"name": "X", "dances": []}, "music")
    assert "dances:" not in out


def test_summary_best_months_included():
    out = _entity_summary({"name": "X", "best_months": "Jun-Set"}, "fauna")
    assert "Melhores meses: Jun-Set" in out


# ── _fallback_narrative ──────────────────────────────────────────────────────

def _entity(**overrides):
    base = {"name": "Adufe", "region": "Beira Baixa",
            "description_short": "Tambor quadrado tradicional"}
    base.update(overrides)
    return base


def test_fallback_returns_all_six_keys():
    out = _fallback_narrative(_entity(), _req())
    assert set(out.keys()) == {"title", "hook", "body", "highlights", "tip", "tags"}


def test_fallback_title_includes_name_and_region():
    out = _fallback_narrative(_entity(), _req())
    assert "Adufe" in out["title"]
    assert "Beira Baixa" in out["title"]


def test_fallback_title_no_dash_when_region_missing():
    out = _fallback_narrative(_entity(region=""), _req())
    assert out["title"] == "Adufe"


def test_fallback_hook_uses_persona_label_lowercased():
    out = _fallback_narrative(_entity(), _req(persona="familia"))
    expected_label = PERSONAS["familia"]["label"].lower()
    assert expected_label in out["hook"]


def test_fallback_hook_unknown_persona_uses_default_label():
    out = _fallback_narrative(_entity(), _req(persona="xpto"))
    expected = PERSONAS["default"]["label"].lower()
    assert expected in out["hook"]


def test_fallback_hook_truncates_description_at_120():
    long = "x" * 500
    out = _fallback_narrative(_entity(description_short=long), _req())
    # The hook embeds desc[:120]; ensure the long description didn't pass through whole.
    assert "x" * 121 not in out["hook"]


def test_fallback_hook_without_description_uses_discover_phrasing():
    out = _fallback_narrative(
        _entity(description_short="", description="", story_short=""), _req(),
    )
    assert "Descobre Adufe" in out["hook"]


def test_fallback_body_includes_sons_when_instruments_present():
    out = _fallback_narrative(
        _entity(instruments=["adufe", "viola", "concertina"]), _req(),
    )
    assert "Sons:" in out["body"]
    assert "adufe" in out["body"]


def test_fallback_body_includes_sabores_when_gastronomy_present():
    out = _fallback_narrative(
        _entity(gastronomy=["queijo", "azeite"]), _req(),
    )
    assert "Sabores:" in out["body"]


def test_fallback_body_includes_festas_when_festivals_present():
    out = _fallback_narrative(
        _entity(festivals=["São João", "Festas da Cidade"]), _req(),
    )
    assert "Festas a não perder:" in out["body"]


def test_fallback_highlights_prefers_festivals_over_instruments():
    out = _fallback_narrative(
        _entity(festivals=["F1", "F2"], instruments=["I1"]),
        _req(),
    )
    # `festivals or instruments` → festivals wins.
    assert out["highlights"] == ["F1", "F2"]


def test_fallback_highlights_falls_back_to_instruments():
    out = _fallback_narrative(
        _entity(festivals=[], instruments=["I1", "I2"]),
        _req(),
    )
    assert out["highlights"] == ["I1", "I2"]


def test_fallback_highlights_capped_at_3():
    out = _fallback_narrative(
        _entity(festivals=["F1", "F2", "F3", "F4", "F5"]),
        _req(),
    )
    assert len(out["highlights"]) == 3


def test_fallback_tags_prefers_tags_over_instruments():
    out = _fallback_narrative(
        _entity(tags=["t1", "t2"], instruments=["i1"]),
        _req(),
    )
    assert out["tags"] == ["t1", "t2"]


def test_fallback_tags_capped_at_5():
    out = _fallback_narrative(
        _entity(tags=[f"t{i}" for i in range(20)]),
        _req(),
    )
    assert len(out["tags"]) == 5


def test_fallback_tip_mentions_entity_name():
    out = _fallback_narrative(_entity(), _req())
    assert "Adufe" in out["tip"]


def test_fallback_name_falls_back_to_entity_id():
    out = _fallback_narrative({}, _req(entity_id="my-id"))
    assert "my-id" in out["title"]
