"""Pure-function tests for the IQ Data-Enrichment module (M9): the
description-text extractor (phone/email/URL/hours/price), the enrichment
quality score (clamped), the notable-landmark classifier and seasonal-
closure inference. No network — the Wikipedia / Google Places fetchers
are async and not covered here."""
from iq_engine_base import POIProcessingData
from iq_module_m9_enrichment import DataEnrichmentModule

_M = DataEnrichmentModule()


def _data(name="Local", description="", category=None, metadata=None):
    return POIProcessingData(
        id="poi-1", name=name, description=description,
        category=category, metadata=metadata or {},
    )


# ── _extract_from_description ─────────────────────────────────────────────────

def test_extract_empty_description():
    assert _M._extract_from_description(_data(description="")) == {}


def test_extract_phone_pt_format():
    out = _M._extract_from_description(_data(description="telefone +351 912 345 678"))
    assert "phone_from_text" in out
    assert "912" in out["phone_from_text"]


def test_extract_email():
    out = _M._extract_from_description(_data(description="contacto info@exemplo.pt para reservas"))
    assert out["email_from_text"] == "info@exemplo.pt"


def test_extract_url():
    out = _M._extract_from_description(_data(description="visite https://exemplo.pt/info"))
    assert out["website_from_text"] == "https://exemplo.pt/info"


def test_extract_hours_colon_format():
    out = _M._extract_from_description(_data(description="horario 09:00 - 18:00"))
    assert out["hours_from_text"] == "09:00 - 18:00"


def test_extract_hours_h_format():
    out = _M._extract_from_description(_data(description="aberto das 9h30 - 18h"))
    assert "hours_from_text" in out


def test_extract_price_gratis():
    out = _M._extract_from_description(_data(description="entrada GRATUITO"))
    assert "price_from_text" in out


def test_extract_price_euro():
    out = _M._extract_from_description(_data(description="bilhete €5,50"))
    assert "€" in out["price_from_text"]


def test_extract_multiple_fields():
    text = "Contacte info@exemplo.pt ou +351 912 345 678, visite https://exemplo.pt"
    out = _M._extract_from_description(_data(description=text))
    assert "email_from_text" in out
    assert "phone_from_text" in out
    assert "website_from_text" in out


# ── _calculate_enrichment_score ───────────────────────────────────────────────

def test_score_empty_data_is_zero():
    assert _M._calculate_enrichment_score({}) == 0


def test_score_phone_and_website_bonus():
    # 15 (phone) + 15 (website) + 10 (combo bonus) = 40
    assert _M._calculate_enrichment_score({"phone": "x", "website": "y"}) == 40


def test_score_clamped_to_100():
    # Sum of all weights = 100; combo bonus +10; text-bonus capped +10 → 120 → clamped.
    score = _M._calculate_enrichment_score({
        "opening_hours": 1, "phone": 1, "website": 1, "email": 1,
        "admission_fee": 1, "google_rating": 1, "price_level": 1,
        "wikipedia_summary": 1,
        "hours_from_text": 1, "phone_from_text": 1,
    })
    assert score == 100


def test_score_text_field_bonus_capped_at_ten():
    base = _M._calculate_enrichment_score({"phone": "x"})
    with_text = _M._calculate_enrichment_score({
        "phone": "x",
        "a_from_text": 1, "b_from_text": 1, "c_from_text": 1, "d_from_text": 1,
    })
    assert with_text - base == 10


# ── _is_notable_landmark ──────────────────────────────────────────────────────

def test_notable_with_unesco_keyword():
    assert _M._is_notable_landmark(_data(description="Património mundial UNESCO")) is True


def test_notable_with_castelo_in_name():
    assert _M._is_notable_landmark(_data(name="Castelo de São Jorge")) is True


def test_notable_without_keywords():
    assert _M._is_notable_landmark(_data(name="Café da Esquina", description="bom café")) is False


# ── _infer_seasonal_closure ───────────────────────────────────────────────────

def test_seasonal_winter_closure_detected():
    out = _M._infer_seasonal_closure(_data(description="Encerrado no inverno"))
    assert out["months_closed"] == [12, 1, 2]
    assert out["inferred"] is True


def test_seasonal_no_match_returns_none():
    assert _M._infer_seasonal_closure(_data(description="aberto todo o ano")) is None


def test_seasonal_metadata_dict_passthrough():
    meta_val = {"months_closed": [6, 7], "note": "Manutenção"}
    out = _M._infer_seasonal_closure(_data(metadata={"seasonal_closure": meta_val}))
    assert out == meta_val
