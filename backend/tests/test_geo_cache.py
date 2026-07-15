"""Tests for services/geo_cache.py — key building and fail-open behaviour
when Redis is not configured. No network: REDIS_URL is cleared so the module
must behave as a no-op without raising."""
import pytest

from services import geo_cache
from services.geo_cache import build_geo_key, geo_cache_get, geo_cache_set


@pytest.fixture(autouse=True)
async def _no_redis(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    await geo_cache._reset_for_tests()
    yield
    await geo_cache._reset_for_tests()


# ── build_geo_key ────────────────────────────────────────────────────────────

def test_key_has_prefix_namespace_and_parts():
    key = build_geo_key("nominatim_reverse", "38.74500", "-9.23200")
    assert key == "geocache:nominatim_reverse:38.74500:-9.23200"


def test_key_stringifies_non_string_parts():
    assert build_geo_key("nominatim_forward", "sintra", "pt", 5).endswith(
        ":sintra:pt:5"
    )


def test_key_is_deterministic_for_rounded_coords():
    a = build_geo_key("geoapi_reverse", f"{38.7450001:.4f}", f"{-9.2319999:.4f}")
    b = build_geo_key("geoapi_reverse", f"{38.7450002:.4f}", f"{-9.2320001:.4f}")
    assert a == b


# ── fail-open without Redis ──────────────────────────────────────────────────

async def test_get_returns_none_without_redis():
    assert await geo_cache_get("geocache:test:whatever") is None


async def test_set_returns_false_without_redis():
    assert await geo_cache_set("geocache:test:whatever", {"a": 1}) is False


async def test_redis_connection_attempted_only_once():
    await geo_cache_get("geocache:test:first")
    assert geo_cache._redis_tried is True
    assert geo_cache._redis is None
    # Second call short-circuits (would raise if it retried a bad URL)
    assert await geo_cache_get("geocache:test:second") is None
