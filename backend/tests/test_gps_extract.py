"""Tests for gps_extract — the coordinate parser shared by the Excel
importer and the editorial geocoding tool. The comma-decimal case is the
regression that mattered: whole sheets (Barragens e Albufeiras) stored
'41,086875, -8,132567' and the old dot-only regex dropped every row."""
import pytest

from gps_extract import (
    clean_anchor,
    detect_anchor_column,
    detect_gps_columns,
    extract_coords,
    in_pt_envelope,
    parse_coord_text,
    parse_coord_url,
)


# ── parse_coord_text: dot-decimal ────────────────────────────────────────────

def test_dot_decimal_basic():
    assert parse_coord_text("41.276400, -8.283100") == (41.2764, -8.2831)


def test_dot_decimal_semicolon_separator():
    assert parse_coord_text("41.276400; -8.283100") == (41.2764, -8.2831)


def test_dot_decimal_extra_whitespace():
    assert parse_coord_text("  41.276400 ,  -8.283100  ") == (41.2764, -8.2831)


def test_dot_decimal_embedded_in_text():
    assert parse_coord_text("GPS: 41.276400, -8.283100 (aprox)") == (41.2764, -8.2831)


# ── parse_coord_text: comma-decimal (the regression) ─────────────────────────

def test_comma_decimal_basic():
    # 41,086875 , -8,132567  →  (41.086875, -8.132567)
    assert parse_coord_text("41,086875, -8,132567") == (41.086875, -8.132567)


def test_comma_decimal_no_space():
    assert parse_coord_text("41,086875,-8,132567") == (41.086875, -8.132567)


def test_comma_decimal_negative_lat():
    assert parse_coord_text("-12,500000, 8,250000") == (-12.5, 8.25)


def test_comma_decimal_does_not_mismatch_dot_pair():
    # A dot-decimal value must NOT be misread by the comma branch.
    assert parse_coord_text("41.146600, -8.604800") == (41.1466, -8.6048)


# ── parse_coord_text: rejections ─────────────────────────────────────────────

def test_place_name_returns_none():
    assert parse_coord_text("📍 Parque Nacional Peneda-Gerês") is None


def test_empty_returns_none():
    assert parse_coord_text("") is None
    assert parse_coord_text(None) is None


def test_single_number_returns_none():
    assert parse_coord_text("41.276400") is None


def test_out_of_world_bounds_returns_none():
    # 200,000000 → lat 200 fails world bounds.
    assert parse_coord_text("200,000000, 8,250000") is None


def test_numeric_input_coerced_to_string_then_fails_gracefully():
    # A bare float cell (just a latitude) has no pair → None.
    assert parse_coord_text(41.2764) is None


# ── parse_coord_url ──────────────────────────────────────────────────────────

def test_url_at_form():
    assert parse_coord_url("https://maps.google.com/@41.276400,-8.283100,15z") == (41.2764, -8.2831)


def test_url_q_form():
    assert parse_coord_url("https://maps.google.com/?q=41.276400,-8.283100") == (41.2764, -8.2831)


def test_url_destination_form():
    out = parse_coord_url("https://www.google.com/maps/dir/?destination=41.276400,-8.283100")
    assert out == (41.2764, -8.2831)


def test_url_place_name_returns_none():
    assert parse_coord_url("https://maps.google.com/search/Torre+de+Belem") is None


# ── extract_coords (combined) ────────────────────────────────────────────────

def test_extract_prefers_url_then_text():
    assert extract_coords("@41.276400,-8.283100") == (41.2764, -8.2831)
    assert extract_coords("41,086875, -8,132567") == (41.086875, -8.132567)
    assert extract_coords("📍 Lugar") is None


# ── in_pt_envelope ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("lat,lng,inside", [
    (41.15, -8.61, True),    # Porto
    (32.65, -16.91, True),   # Madeira
    (39.45, -31.2, True),    # Flores (Azores)
    (40.4, -3.7, False),     # Madrid
    (0.0, 0.0, False),       # Gulf of Guinea sentinel
])
def test_in_pt_envelope(lat, lng, inside):
    assert in_pt_envelope(lat, lng) is inside


# ── detect_gps_columns ───────────────────────────────────────────────────────

def test_detect_gps_single():
    headers = ["#", "Nome", "Região", "Descrição", "GPS (Maps)"]
    assert detect_gps_columns(headers) == [4]


def test_detect_gps_multiple():
    # Pratos Típicos has GPS 1 + GPS 2 + two map-link columns.
    headers = ["#", "Prato", "Localidade", "Descrição",
               "Local Emblemático 1", "GPS 1", "Local Emblemático 2", "GPS 2"]
    assert detect_gps_columns(headers) == [5, 7]


def test_detect_gps_none():
    assert detect_gps_columns(["#", "Nome", "Região"]) == []


def test_detect_gps_case_insensitive():
    assert detect_gps_columns(["gps", "Gps", "GPS"]) == [0, 1, 2]


# ── detect_anchor_column ─────────────────────────────────────────────────────

def test_anchor_prefers_morada_over_localidade():
    # Both present → "Morada" (full address) wins by preference order.
    headers = ["Nome", "Localidade", "Morada"]
    assert detect_anchor_column(headers) == 2


def test_anchor_onde_observar():
    headers = ["#", "Espécie", "Região", "Floração", "Curiosidade", "Onde Observar"]
    assert detect_anchor_column(headers) == 5


def test_anchor_habitat():
    headers = ["#", "Espécie", "Tipo", "Região", "Habitat", "Local"]
    # "morada/localidade" absent; "local emblematico" absent; ... "habitat"
    # comes before bare "local" in preference, so Habitat (idx 4) wins.
    assert detect_anchor_column(headers) == 4


def test_anchor_none_when_no_match():
    assert detect_anchor_column(["#", "Nome", "Cor"]) is None


# ── clean_anchor ─────────────────────────────────────────────────────────────

def test_clean_anchor_strips_pin_emoji():
    assert clean_anchor("📍 Parque Nacional Peneda-Gerês") == "Parque Nacional Peneda-Gerês"


def test_clean_anchor_strips_restaurant_emoji():
    assert clean_anchor("🍽 Tasca do Joel") == "Tasca do Joel"


def test_clean_anchor_strips_eye_emoji():
    assert clean_anchor("👁 Pedra Bela") == "Pedra Bela"


def test_clean_anchor_plain_text_unchanged():
    assert clean_anchor("Mata do Mezio") == "Mata do Mezio"


def test_clean_anchor_keeps_internal_parens():
    # Only leading decoration is stripped; "(Monção)" stays.
    assert clean_anchor("📍 Casa do Adro (Monção)") == "Casa do Adro (Monção)"


def test_clean_anchor_none_returns_empty():
    assert clean_anchor(None) == ""
