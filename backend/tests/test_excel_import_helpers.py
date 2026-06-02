"""Pure-function tests for excel_import_api helpers — the normalisation
layer between raw Excel/CSV uploads (admin-only) and the heritage_items
collection schema.

  - _normalize_header     spaces/dashes/underscores → "_"
  - _detect_columns       header alias → column index map
  - _normalize_category   raw text → canonical slug
  - _normalize_region     raw text → 7-region slug
  - _parse_float          PT/EN decimal text → float | None
  - _calc_health_score    POI completeness 0..100

These five drive the bulk-import endpoint. A regression here corrupts
every POI created through the admin Excel upload path."""
import math

import pytest

from excel_import_api import (
    COLUMN_MAP,
    REGION_NORMALIZE,
    _calc_health_score,
    _detect_columns,
    _normalize_category,
    _normalize_header,
    _normalize_region,
    _parse_float,
)


# ── _normalize_header ────────────────────────────────────────────────────────

def test_normalize_header_lowercases():
    assert _normalize_header("NAME") == "name"


def test_normalize_header_strips_whitespace():
    assert _normalize_header("  Name  ") == "name"


def test_normalize_header_replaces_spaces_with_underscore():
    assert _normalize_header("Image URL") == "image_url"


def test_normalize_header_collapses_runs_of_separators():
    # Mix of spaces, dashes, underscores collapses to a single "_".
    assert _normalize_header("opening - hours") == "opening_hours"
    assert _normalize_header("opening__hours") == "opening_hours"
    assert _normalize_header("opening--hours") == "opening_hours"
    assert _normalize_header("opening _ - hours") == "opening_hours"


def test_normalize_header_passes_clean_input_unchanged():
    assert _normalize_header("name") == "name"


def test_normalize_header_handles_non_string_input():
    # str() coercion makes the helper tolerant to openpyxl returning ints.
    assert _normalize_header(123) == "123"  # type: ignore[arg-type]


def test_normalize_header_preserves_diacritics():
    # Diacritics are NOT stripped — only case + separators normalised.
    # Confirms callers that look up "região" still work.
    assert _normalize_header("Região") == "região"


# ── _detect_columns ──────────────────────────────────────────────────────────

def test_detect_columns_basic_pt_headers():
    headers = ["Nome", "Categoria", "Latitude", "Longitude"]
    out = _detect_columns(headers)
    assert out["name"] == 0
    assert out["category"] == 1
    assert out["lat"] == 2
    assert out["lng"] == 3


def test_detect_columns_picks_first_matching_alias():
    # "name" alias list has "nome" then "name" — if both appear, "nome"
    # is matched first and wins.
    headers = ["nome", "name"]
    out = _detect_columns(headers)
    assert out["name"] == 0


def test_detect_columns_handles_messy_headers():
    headers = ["  NOME  ", "image URL", "horário-completo"]
    out = _detect_columns(headers)
    assert out["name"] == 0
    assert out["image_url"] == 1


def test_detect_columns_returns_empty_when_no_matches():
    out = _detect_columns(["random", "garbage", "headers"])
    assert out == {}


def test_detect_columns_partial_match_subset_only():
    # If only some fields are present, the mapping covers those only.
    out = _detect_columns(["Nome", "Random"])
    assert out == {"name": 0}


def test_detect_columns_supports_english_aliases():
    # COLUMN_MAP includes "name" (EN) under "name", "type" under "category",
    # "phone" under "phone", "website" under "website". Note: English
    # "title" is NOT in the "name" alias list — only PT "título"/"titulo".
    headers = ["name", "type", "phone", "website"]
    out = _detect_columns(headers)
    assert "name" in out
    assert "category" in out
    assert "phone" in out
    assert "website" in out


def test_detect_columns_english_title_not_a_name_alias():
    # Pin: "title" (EN) is intentionally NOT mapped — COLUMN_MAP["name"]
    # accepts PT "título"/"titulo" but not the English equivalent.
    # A future "let's add English aliases" PR can update this.
    out = _detect_columns(["title", "category"])
    assert "name" not in out


# ── _normalize_category ──────────────────────────────────────────────────────

def test_category_empty_returns_outros():
    assert _normalize_category("") == "outros"
    assert _normalize_category(None) == "outros"  # type: ignore[arg-type]


def test_category_direct_match():
    assert _normalize_category("castelo") == "historia"
    assert _normalize_category("igreja") == "religioso"


def test_category_strips_trailing_s_plural():
    # "castelos" → strip trailing "s" → "castelo" → maps to "historia".
    assert _normalize_category("castelos") == "historia"


def test_category_normalises_separators():
    # Spaces/dashes/slashes → "_" before lookup.
    assert _normalize_category("centro interpretativo") == "museus"


def test_category_case_insensitive():
    assert _normalize_category("CASTELO") == "historia"


def test_category_unknown_returns_normalised_slug():
    # Unknown but non-empty → returns a sanitised slug.
    out = _normalize_category("xpto_novo")
    assert out == "xpto_novo"


def test_category_strips_special_chars_in_fallback():
    out = _normalize_category("café!@#$%")
    # Special chars get stripped; "caf" remains (é also stripped by the
    # `[^a-z0-9_]` regex). Result must still be ASCII slug-safe.
    assert all(c.isalnum() or c == "_" for c in out)


def test_category_only_special_chars_falls_back_to_outros():
    # If the sanitisation strips everything to empty, fallback is "outros".
    assert _normalize_category("!@#$") == "outros"


def test_category_prefix_match():
    # "ruinas" starts with "ruin" — but wait, dictionary has "ruinas"
    # directly. Test something that uses the prefix-match arm.
    # "muse" startswith match against "museu" key — both directions
    # are checked (clean startswith key OR key startswith clean).
    out = _normalize_category("muse")
    assert out == "museus"


# ── _normalize_region ────────────────────────────────────────────────────────

def test_region_empty_returns_portugal():
    assert _normalize_region("") == "portugal"
    assert _normalize_region(None) == "portugal"  # type: ignore[arg-type]


@pytest.mark.parametrize("raw,expected", [
    ("Norte", "norte"),
    ("Centro", "centro"),
    ("Lisboa", "lisboa"),
    ("Alentejo", "alentejo"),
    ("Algarve", "algarve"),
    ("Madeira", "madeira"),
])
def test_region_direct_match_canonical_names(raw, expected):
    assert _normalize_region(raw) == expected


def test_region_acores_with_accent_normalises_to_plain():
    assert _normalize_region("Açores") == "acores"


def test_region_acores_already_plain_unchanged():
    assert _normalize_region("acores") == "acores"


def test_region_district_to_macro_porto_is_norte():
    assert _normalize_region("Porto") == "norte"


def test_region_district_to_macro_coimbra_is_centro():
    assert _normalize_region("Coimbra") == "centro"


def test_region_district_to_macro_evora_is_alentejo():
    assert _normalize_region("Évora") == "alentejo"


def test_region_district_to_macro_faro_is_algarve():
    assert _normalize_region("Faro") == "algarve"


def test_region_district_to_macro_funchal_is_madeira():
    assert _normalize_region("Funchal") == "madeira"


def test_region_unknown_falls_back_to_portugal():
    assert _normalize_region("XYZ City") == "portugal"


def test_region_case_insensitive_substring_match():
    # Substring match against REGION_NORMALIZE happens on the lowercased
    # input — "City of Porto, district X" should still hit "porto".
    assert _normalize_region("City of Porto, district X") == "norte"


def test_region_normalize_map_targets_are_canonical():
    # Sanity: every REGION_NORMALIZE target must be one of the 7
    # canonical macro-regions (else the helper returns invalid values
    # downstream).
    valid = {"norte", "centro", "lisboa", "alentejo", "algarve",
             "acores", "madeira", "portugal"}
    for key, val in REGION_NORMALIZE.items():
        assert val in valid, f"{key} → invalid target {val}"


# ── _parse_float ─────────────────────────────────────────────────────────────

def test_parse_float_none_returns_none():
    assert _parse_float(None) is None


def test_parse_float_nan_returns_none():
    assert _parse_float(float("nan")) is None


def test_parse_float_empty_string_returns_none():
    assert _parse_float("") is None


def test_parse_float_garbage_returns_none():
    assert _parse_float("not a number") is None


def test_parse_float_int_passthrough():
    assert _parse_float(42) == 42.0


def test_parse_float_float_passthrough():
    assert _parse_float(3.14) == 3.14


def test_parse_float_en_decimal_string():
    assert _parse_float("38.72") == 38.72


def test_parse_float_pt_decimal_with_comma():
    # Portuguese locale uses comma as decimal separator.
    assert _parse_float("38,72") == 38.72


def test_parse_float_negative_value():
    assert _parse_float("-9.14") == -9.14


def test_parse_float_strips_whitespace():
    assert _parse_float("  38.72  ") == 38.72


def test_parse_float_handles_string_zero():
    assert _parse_float("0") == 0.0


# ── _calc_health_score ──────────────────────────────────────────────────────

def test_health_empty_poi_zero():
    assert _calc_health_score({}) == 0


def test_health_only_name():
    assert _calc_health_score({"name": "X"}) == 15


def test_health_long_description_bonus():
    # >50 chars → 20 points; ≤50 → 10 points.
    short = _calc_health_score({"description": "short"})
    long = _calc_health_score({"description": "x" * 100})
    assert long > short
    assert long == 20
    assert short == 10


def test_health_category_outros_no_bonus():
    # Category "outros" doesn't count — it's the fallback meaning "unclassified".
    assert _calc_health_score({"category": "outros"}) == 0
    assert _calc_health_score({"category": "historia"}) == 10


def test_health_location_lat_only():
    assert _calc_health_score({"location": {"lat": 38.7}}) == 15


def test_health_complete_poi_caps_at_100():
    poi = {
        "name": "X",
        "description": "x" * 100,
        "category": "historia",
        "location": {"lat": 38.7, "lng": -9.1},
        "image_url": "https://x",
        "address": "addr",
        "website": "https://x",
        "phone": "+351",
        "opening_hours": "9-18",
        "tags": ["t1"],
    }
    assert _calc_health_score(poi) == 100


def test_health_never_exceeds_100():
    # Stress: every possible field filled. The min(score, 100) cap
    # must still hold (a future tier-table change can't blow past 100).
    poi = {
        "name": "X" * 100,
        "description": "x" * 1000,
        "category": "historia",
        "location": {"lat": 38.7, "lng": -9.1},
        "image_url": "https://x",
        "address": "addr",
        "website": "https://x",
        "phone": "+351",
        "opening_hours": "9-18",
        "tags": ["t1"] * 20,
    }
    assert _calc_health_score(poi) == 100


# ── COLUMN_MAP sanity ──────────────────────────────────────────────────────

def test_column_map_has_required_fields():
    # The parse_excel_to_pois fast-fail at line 239 requires "name" —
    # pin that the alias entry exists so a refactor can't break ingestion.
    assert "name" in COLUMN_MAP
    assert len(COLUMN_MAP["name"]) > 0


def test_column_map_aliases_unique_per_field():
    # Within a single field, alias entries must be unique (a duplicate
    # alias is dead weight and signals a copy-paste mistake).
    for field, aliases in COLUMN_MAP.items():
        assert len(aliases) == len(set(aliases)), f"dup in {field}: {aliases}"
