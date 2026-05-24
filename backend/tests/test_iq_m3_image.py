"""Pure-function tests for the IQ Image Quality module (M3) helpers: URL
validation (incl. the M3-URL-TLD fix for long TLDs), extension extraction,
source classification, promo-signal scoring and category-relevance scoring.
No network — the async `_score_clarity` (which does HEAD requests) is not
covered here."""
import pytest

from iq_engine_base import POIProcessingData
from iq_module_m3_image import (
    ImageQualityModule,
    SourceType,
    _OWNER_HOSTS,
    _CURATED_HOSTS,
    _PROMO_SIGNALS,
)

_M = ImageQualityModule()


def _data(name="Local", category=None):
    return POIProcessingData(id="poi-1", name=name, description="x", category=category)


# ── _validate_url_format ──────────────────────────────────────────────────────

def test_valid_https_url():
    assert _M._validate_url_format("https://example.com/photo.jpg") is True


def test_invalid_url_no_scheme():
    assert _M._validate_url_format("example.com/photo.jpg") is False


def test_invalid_url_garbage():
    assert _M._validate_url_format("not a url") is False


def test_valid_localhost_url():
    assert _M._validate_url_format("http://localhost:8080/x.jpg") is True


def test_valid_ip_url():
    assert _M._validate_url_format("http://192.168.0.1/x.jpg") is True


def test_valid_long_tld_url():
    """M3-URL-TLD: modern TLDs (> 6 chars, up to 63 per RFC 1035) must validate."""
    assert _M._validate_url_format("https://studio.photography/x.jpg") is True


# ── _get_extension ────────────────────────────────────────────────────────────

def test_extension_basic():
    assert _M._get_extension("https://x.com/a.jpg") == ".jpg"


def test_extension_strips_query():
    assert _M._get_extension("https://x.com/a.jpg?v=1") == ".jpg"


def test_extension_lowercased():
    assert _M._get_extension("https://x.com/a.JPG") == ".jpg"


def test_extension_missing_returns_none():
    assert _M._get_extension("https://x.com/a") is None


# ── _classify_source ──────────────────────────────────────────────────────────

def test_classify_unknown_for_non_http():
    assert _M._classify_source("ftp://x.com/a.jpg") == SourceType.UNKNOWN


def test_classify_external_for_random_http():
    # The host is unlikely to be in either OWNER or CURATED lists.
    assert _M._classify_source("https://zzz-not-known.invalid/a.jpg") == SourceType.EXTERNAL


def test_classify_owner_for_owner_host():
    if not _OWNER_HOSTS:
        pytest.skip("no OWNER hosts configured")
    host = _OWNER_HOSTS[0]
    assert _M._classify_source(f"https://{host}/photo.jpg") == SourceType.OWNER


def test_classify_curated_for_curated_host():
    if not _CURATED_HOSTS:
        pytest.skip("no CURATED hosts configured")
    host = _CURATED_HOSTS[0]
    assert _M._classify_source(f"https://{host}/photo.jpg") == SourceType.CURATED


# ── _score_no_promo ───────────────────────────────────────────────────────────

def test_no_promo_owner_full_score():
    assert _M._score_no_promo("https://anything.example/x.jpg", SourceType.OWNER) == (30, [])


def test_no_promo_curated_full_score():
    assert _M._score_no_promo("https://x.example/x.jpg", SourceType.CURATED) == (30, [])


def test_no_promo_external_clean_full_score():
    score, found = _M._score_no_promo("https://random.example/photo.jpg", SourceType.EXTERNAL)
    assert score == 30
    assert found == []


def test_no_promo_external_one_signal_half_score():
    if not _PROMO_SIGNALS:
        pytest.skip("no promo signals configured")
    sig = _PROMO_SIGNALS[0]
    score, found = _M._score_no_promo(
        f"https://random.example/{sig}-photo.jpg", SourceType.EXTERNAL
    )
    assert score == 15
    assert sig in found


# ── _score_category_relevance ─────────────────────────────────────────────────

def test_relevance_matching_name_in_filename():
    score, details = _M._score_category_relevance(
        "https://x.com/mosteiro-jeronimos.jpg",
        _data(name="Mosteiro Jerónimos"),
    )
    assert score > 0
    assert details["name_overlap"] > 0


def test_relevance_unrelated_filename_no_overlap():
    _, details = _M._score_category_relevance(
        "https://x.com/photo123.jpg",
        _data(name="Mosteiro Jerónimos"),
    )
    assert details["name_overlap"] == 0


def test_relevance_score_within_bounds():
    score, _ = _M._score_category_relevance(
        "https://x.com/mosteiro-jeronimos-historico-patrimonio.jpg",
        _data(name="Mosteiro Jerónimos Histórico Patrimonio"),
    )
    assert 0 <= score <= 30
