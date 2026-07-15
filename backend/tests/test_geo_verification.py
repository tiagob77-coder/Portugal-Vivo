"""Pure-function tests for geo_verification_api helpers: admin-name
normalization/matching, the Portugal bounding-box gate and the declared-vs-
geocoded comparison logic. No network, no Mongo."""
from geo_verification_api import (
    _compare_admin_fields,
    _in_portugal_bounds,
    _names_match,
    _normalize_admin_name,
)


# ── _normalize_admin_name ────────────────────────────────────────────────────

def test_normalize_lowercases_and_strips_accents():
    assert _normalize_admin_name("Évora") == "evora"
    assert _normalize_admin_name("Bragança") == "braganca"


def test_normalize_collapses_separators_and_spaces():
    assert _normalize_admin_name("Viana-do-Castelo") == "viana do castelo"
    assert _normalize_admin_name("  Castelo   Branco ") == "castelo branco"


def test_normalize_handles_none_and_empty():
    assert _normalize_admin_name(None) == ""
    assert _normalize_admin_name("") == ""


# ── _names_match ─────────────────────────────────────────────────────────────

def test_match_exact_ignoring_case_and_accents():
    assert _names_match("SANTARÉM", "santarem") is True


def test_match_by_containment_nuts_ii():
    # declared region vs official NUTS II name
    assert _names_match("Lisboa", "Área Metropolitana de Lisboa") is True
    assert _names_match("Açores", "Região Autónoma dos Açores") is True


def test_match_by_containment_uniao_de_freguesias():
    assert _names_match(
        "Sé", "União das freguesias de Sé, Santa Maria e Meixedo"
    ) is True


def test_no_match_for_different_names():
    assert _names_match("Porto", "Lisboa") is False


def test_no_match_when_either_side_empty():
    assert _names_match("", "Lisboa") is False
    assert _names_match("Porto", None) is False


# ── _in_portugal_bounds ──────────────────────────────────────────────────────

def test_bounds_continente():
    assert _in_portugal_bounds(38.745, -9.232) is True  # Sintra/Lisboa


def test_bounds_madeira_and_acores():
    assert _in_portugal_bounds(32.65, -16.9) is True    # Funchal
    assert _in_portugal_bounds(37.74, -25.67) is True   # Ponta Delgada


def test_bounds_rejects_outside_portugal():
    assert _in_portugal_bounds(48.85, 2.35) is False    # Paris
    assert _in_portugal_bounds(0.0, 0.0) is False       # Null Island


# ── _compare_admin_fields ────────────────────────────────────────────────────

_GEOCODED_SINTRA = {
    "freguesia": "Colares",
    "concelho": "Sintra",
    "distrito_pt": "Lisboa",
    "district": "Lisboa",
    "city": "Sintra",
    "nuts_ii": "Área Metropolitana de Lisboa",
}


def test_compare_all_fields_match():
    result = _compare_admin_fields(
        {"concelho": "Sintra", "distrito": "Lisboa", "freguesia": "Colares"},
        _GEOCODED_SINTRA,
    )
    assert result["status"] == "verified"
    assert result["match_score"] == 1.0
    assert all(c["match"] for c in result["checks"].values())


def test_compare_detects_mismatch_and_scores_partially():
    result = _compare_admin_fields(
        {"concelho": "Cascais", "distrito": "Lisboa"},
        _GEOCODED_SINTRA,
    )
    assert result["status"] == "mismatch"
    assert result["match_score"] == 0.5
    assert result["checks"]["concelho"]["match"] is False
    assert result["checks"]["distrito"]["match"] is True


def test_compare_concelho_falls_back_to_city():
    # Nominatim-only result: no "concelho" key, city carries the name
    result = _compare_admin_fields(
        {"concelho": "Sintra"},
        {"city": "Sintra", "district": "Lisboa"},
    )
    assert result["status"] == "verified"


def test_compare_region_against_nuts_ii():
    result = _compare_admin_fields({"region": "lisboa"}, _GEOCODED_SINTRA)
    assert result["status"] == "verified"


def test_compare_no_declared_data():
    result = _compare_admin_fields({}, _GEOCODED_SINTRA)
    assert result["status"] == "no_declared_data"
    assert result["match_score"] is None
    assert result["checks"] == {}


def test_compare_ignores_empty_declared_fields():
    result = _compare_admin_fields(
        {"concelho": "", "distrito": None, "freguesia": "Colares"},
        _GEOCODED_SINTRA,
    )
    assert result["status"] == "verified"
    assert list(result["checks"].keys()) == ["freguesia"]
