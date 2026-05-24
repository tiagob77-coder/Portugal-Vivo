"""Pure-function tests for services/caop_normalize — the four helpers
(strip_diacritics, clean_name, title_case_pt, parse_dtmnfr) used end-to-end
in CAOP ingestion + runtime parish/municipality lookup. A regression here
silently corrupts search across the whole administrative pipeline."""
import pytest

from services.caop_normalize import (
    clean_name,
    parse_dtmnfr,
    strip_diacritics,
    title_case_pt,
)


# ── strip_diacritics ─────────────────────────────────────────────────────────

def test_strip_diacritics_removes_accents():
    assert strip_diacritics("São") == "Sao"
    assert strip_diacritics("Coração") == "Coracao"
    assert strip_diacritics("Açores") == "Acores"


def test_strip_diacritics_preserves_case():
    assert strip_diacritics("ÉVORA") == "EVORA"


def test_strip_diacritics_empty_string():
    assert strip_diacritics("") == ""


def test_strip_diacritics_ascii_passthrough():
    assert strip_diacritics("hello world") == "hello world"


def test_strip_diacritics_handles_combining_marks():
    # 'á' as combining sequence (a + COMBINING ACUTE ACCENT U+0301)
    composed = "á"  # NFD form of "á"
    assert strip_diacritics(composed) == "a"


# ── clean_name ───────────────────────────────────────────────────────────────

def test_clean_name_empty_returns_empty():
    assert clean_name("") == ""


def test_clean_name_none_returns_empty():
    # The function tests `if not raw` which is True for None.
    assert clean_name(None) == ""  # type: ignore[arg-type]


def test_clean_name_lowercases_and_strips_diacritics():
    assert clean_name("Évora") == "evora"
    assert clean_name("São Pedro") == "sao pedro"


def test_clean_name_strips_uniao_das_freguesias_prefix():
    assert clean_name("União das Freguesias de Mafra") == "mafra"


def test_clean_name_strips_uniao_das_freguesias_no_accent():
    assert clean_name("uniao das freguesias de Mafra") == "mafra"


def test_clean_name_strips_freguesia_de_prefix():
    assert clean_name("Freguesia de Sintra") == "sintra"


def test_clean_name_strips_freguesia_da_prefix():
    assert clean_name("Freguesia da Lourinhã") == "lourinha"


def test_clean_name_strips_freguesia_do_prefix():
    assert clean_name("Freguesia do Bombarral") == "bombarral"


def test_clean_name_strips_freguesia_dos_prefix():
    assert clean_name("Freguesia dos Olivais") == "olivais"


def test_clean_name_strips_freguesia_das_prefix():
    assert clean_name("Freguesia das Caldas") == "caldas"


def test_clean_name_only_first_matching_prefix_is_stripped():
    # If text doesn't start with any prefix, nothing is stripped.
    assert clean_name("Mafra Freguesia de") == "mafra freguesia de"


def test_clean_name_collapses_whitespace():
    assert clean_name("  São   Pedro  ") == "sao pedro"


def test_clean_name_removes_punctuation_except_dash():
    # Inner dashes are preserved per the regex `[^a-z0-9\-\s]`.
    assert clean_name("Vila-Real, do Norte!") == "vila-real do norte"


def test_clean_name_preserves_digits():
    assert clean_name("Setúbal 2024") == "setubal 2024"


def test_clean_name_case_insensitive_prefix_match():
    # Prefix match is on lowercased input, so any case works.
    assert clean_name("FREGUESIA DE São Pedro") == "sao pedro"


# ── title_case_pt ────────────────────────────────────────────────────────────

def test_title_case_pt_empty_returns_empty():
    assert title_case_pt("") == ""


def test_title_case_pt_basic_word():
    assert title_case_pt("mafra") == "Mafra"


def test_title_case_pt_multi_word():
    assert title_case_pt("vila real") == "Vila Real"


def test_title_case_pt_keeps_connective_lowercase():
    assert title_case_pt("carregal do sal") == "Carregal do Sal"
    assert title_case_pt("santiago do cacem") == "Santiago do Cacem"


def test_title_case_pt_capitalises_first_connective():
    # Even a connective is capitalised when it's the first word.
    assert title_case_pt("de azinhaga") == "De Azinhaga"


def test_title_case_pt_handles_e_connective():
    assert title_case_pt("azinhaga e foros") == "Azinhaga e Foros"


def test_title_case_pt_handles_das_dos_da_do():
    assert title_case_pt("caldas das taipas") == "Caldas das Taipas"
    assert title_case_pt("areias dos paus") == "Areias dos Paus"
    assert title_case_pt("vila da feira") == "Vila da Feira"


def test_title_case_pt_strips_surrounding_whitespace():
    assert title_case_pt("  mafra  ") == "Mafra"


# ── parse_dtmnfr ─────────────────────────────────────────────────────────────

def test_parse_dtmnfr_none_returns_empty_tuple():
    assert parse_dtmnfr(None) == ("", "", "")


def test_parse_dtmnfr_full_6_digit_string():
    assert parse_dtmnfr("110512") == ("11", "1105", "110512")


def test_parse_dtmnfr_int_input_gets_zfilled():
    # 1234 → "001234" → ("00", "0012", "001234")
    assert parse_dtmnfr(1234) == ("00", "0012", "001234")


def test_parse_dtmnfr_short_string_gets_zfilled():
    assert parse_dtmnfr("12") == ("00", "0000", "000012")


def test_parse_dtmnfr_strips_whitespace():
    assert parse_dtmnfr("  110512  ") == ("11", "1105", "110512")


def test_parse_dtmnfr_zero_int():
    assert parse_dtmnfr(0) == ("00", "0000", "000000")
