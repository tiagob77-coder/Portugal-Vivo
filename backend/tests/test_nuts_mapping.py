"""Pure-function tests for services/nuts_mapping.resolve — traverses the
NUTS III → NUTS II → NUTS I hierarchy for every POI's regional display.
A regression here mislabels the region of every POI in the system.

Covers the NUTS 2024 codes (PT19, PT1A, PT1B, PT1C, PT1D) and the legacy
NUTS 2013 aliases (PT16x, PT170, PT18x) that keep older data resolvable."""
from services.nuts_mapping import resolve


# ── Empty / missing input ────────────────────────────────────────────────────

def test_resolve_empty_string_returns_empty_dict():
    assert resolve("") == {}


def test_resolve_none_returns_empty_dict():
    assert resolve(None) == {}  # type: ignore[arg-type]


def test_resolve_unknown_code_returns_passthrough():
    out = resolve("XYZ999")
    # Unknown codes return only nuts3_code so downstream can detect.
    assert out == {"nuts3_code": "XYZ999"}


# ── NUTS 2024 — Continente ───────────────────────────────────────────────────

def test_resolve_norte_alto_minho():
    out = resolve("PT111")
    assert out["nuts3_code"] == "PT111"
    assert out["nuts3_name"] == "Alto Minho"
    assert out["nuts2_code"] == "PT11"
    assert out["nuts2_name"] == "Norte"
    assert out["nuts1_code"] == "PT1"
    assert out["nuts1_name"] == "Continente"


def test_resolve_centro_aveiro():
    out = resolve("PT191")
    assert out["nuts3_name"] == "Região de Aveiro"
    assert out["nuts2_code"] == "PT19"
    assert out["nuts2_name"] == "Centro"
    assert out["nuts1_code"] == "PT1"


def test_resolve_aml_grande_lisboa():
    out = resolve("PT1A0")
    assert out["nuts3_name"] == "Grande Lisboa"
    assert out["nuts2_code"] == "PT1A"
    assert out["nuts2_name"] == "Área Metropolitana de Lisboa"


def test_resolve_peninsula_setubal():
    out = resolve("PT1B0")
    assert out["nuts3_name"] == "Península de Setúbal"
    assert out["nuts2_code"] == "PT1B"


def test_resolve_alentejo_central():
    out = resolve("PT1C4")
    assert out["nuts3_name"] == "Alentejo Central"
    assert out["nuts2_code"] == "PT1C"
    assert out["nuts2_name"] == "Alentejo"


def test_resolve_oeste_vale_do_tejo():
    out = resolve("PT1D1")
    assert out["nuts3_name"] == "Oeste"
    assert out["nuts2_code"] == "PT1D"
    assert out["nuts2_name"] == "Oeste e Vale do Tejo"


def test_resolve_algarve():
    out = resolve("PT150")
    assert out["nuts3_name"] == "Algarve"
    assert out["nuts2_code"] == "PT15"
    assert out["nuts1_code"] == "PT1"


# ── NUTS 2024 — Ilhas ────────────────────────────────────────────────────────

def test_resolve_acores():
    out = resolve("PT200")
    assert out["nuts3_name"] == "Região Autónoma dos Açores"
    assert out["nuts2_code"] == "PT20"
    assert out["nuts1_code"] == "PT2"
    assert out["nuts1_name"] == "Região Autónoma dos Açores"


def test_resolve_madeira():
    out = resolve("PT300")
    assert out["nuts3_name"] == "Região Autónoma da Madeira"
    assert out["nuts2_code"] == "PT30"
    assert out["nuts1_code"] == "PT3"


# ── Legacy NUTS 2013 aliases ─────────────────────────────────────────────────

def test_resolve_legacy_pt16b_oeste():
    out = resolve("PT16B")
    assert out["nuts3_name"] == "Oeste"
    # Resolved via the legacy PT16 alias, which is mapped to Centro.
    assert out["nuts2_code"] == "PT16"
    assert out["nuts2_name"] == "Centro"


def test_resolve_legacy_pt170_aml():
    out = resolve("PT170")
    assert out["nuts3_name"] == "Área Metropolitana de Lisboa"
    assert out["nuts2_code"] == "PT17"


def test_resolve_legacy_pt181_alentejo_litoral():
    out = resolve("PT181")
    assert out["nuts3_name"] == "Alentejo Litoral"
    assert out["nuts2_code"] == "PT18"
    assert out["nuts2_name"] == "Alentejo"


# ── Case-insensitive input ───────────────────────────────────────────────────

def test_resolve_lowercase_input_normalised():
    out = resolve("pt111")
    assert out["nuts3_code"] == "PT111"
    assert out["nuts3_name"] == "Alto Minho"


def test_resolve_mixed_case_input_normalised():
    out = resolve("Pt1c2")
    assert out["nuts3_code"] == "PT1C2"
    assert out["nuts3_name"] == "Baixo Alentejo"


# ── Hierarchy completeness ──────────────────────────────────────────────────

def test_resolve_returns_all_six_keys_for_known_code():
    out = resolve("PT111")
    assert set(out.keys()) == {
        "nuts3_code", "nuts3_name",
        "nuts2_code", "nuts2_name",
        "nuts1_code", "nuts1_name",
    }


def test_resolve_all_25_continente_nuts3_codes_have_continente_ancestry():
    # Every PT continente NUTS III must resolve up to PT1.
    continente_codes = [
        "PT111", "PT112", "PT119", "PT11A", "PT11B", "PT11C", "PT11D", "PT11E",
        "PT150",
        "PT191", "PT192", "PT193", "PT194", "PT195", "PT196",
        "PT1A0",
        "PT1B0",
        "PT1C1", "PT1C2", "PT1C3", "PT1C4",
        "PT1D1", "PT1D2", "PT1D3",
    ]
    for code in continente_codes:
        out = resolve(code)
        assert out["nuts1_code"] == "PT1", f"{code} did not resolve to PT1"
        assert out["nuts1_name"] == "Continente", f"{code} did not resolve to Continente"
