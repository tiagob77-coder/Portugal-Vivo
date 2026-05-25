"""Pure-function tests for auth_api session-cache helpers:
  - _ttl_from_env          env → int clamped to [1, 3600]
  - _revocation_ttl_seconds  Redis TTL = max(cache_ttl*2, 60)
  - _cache_get / _cache_put / _cache_invalidate  in-process session cache

The cache cuts two Mongo round-trips from every authenticated request;
a regression in the lifecycle either leaks revoked sessions (logout
stops working) or thrashes the cache (every request hits Mongo)."""
import time

import pytest

import auth_api
from auth_api import (
    _cache_get,
    _cache_invalidate,
    _cache_put,
    _revocation_ttl_seconds,
    _ttl_from_env,
)


@pytest.fixture(autouse=True)
def _clear_session_cache():
    """Each test starts with an empty in-process cache so module-global
    state from a previous test never leaks into the next."""
    auth_api._session_cache.clear()
    yield
    auth_api._session_cache.clear()


# ── _ttl_from_env ────────────────────────────────────────────────────────────

def test_ttl_default_when_env_unset(monkeypatch):
    monkeypatch.delenv("SESSION_CACHE_TTL_SECONDS", raising=False)
    assert _ttl_from_env() == 60


def test_ttl_default_when_env_empty(monkeypatch):
    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "")
    assert _ttl_from_env() == 60


def test_ttl_default_when_env_whitespace(monkeypatch):
    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "   ")
    assert _ttl_from_env() == 60


def test_ttl_default_when_env_non_numeric(monkeypatch):
    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "abc")
    assert _ttl_from_env() == 60


def test_ttl_custom_default_used():
    # The helper accepts an override default for callers that don't want 60.
    assert _ttl_from_env(default=120) == 120


def test_ttl_reads_valid_int(monkeypatch):
    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "300")
    assert _ttl_from_env() == 300


def test_ttl_clamped_to_min_1(monkeypatch):
    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "0")
    assert _ttl_from_env() == 1


def test_ttl_clamped_to_min_1_when_negative(monkeypatch):
    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "-100")
    assert _ttl_from_env() == 1


def test_ttl_clamped_to_max_3600(monkeypatch):
    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "99999")
    assert _ttl_from_env() == 3600


def test_ttl_boundary_3600_passes_through(monkeypatch):
    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "3600")
    assert _ttl_from_env() == 3600


def test_ttl_boundary_1_passes_through(monkeypatch):
    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "1")
    assert _ttl_from_env() == 1


# ── _revocation_ttl_seconds ──────────────────────────────────────────────────

def test_revocation_ttl_is_twice_cache_ttl_when_above_floor(monkeypatch):
    # 60s cache → 120s revocation flag (twice the cache to outlive any
    # in-flight entry).
    monkeypatch.setattr(auth_api, "_SESSION_CACHE_TTL", 60)
    assert _revocation_ttl_seconds() == 120


def test_revocation_ttl_floors_at_60(monkeypatch):
    # 1s cache → max(2, 60) = 60s floor.
    monkeypatch.setattr(auth_api, "_SESSION_CACHE_TTL", 1)
    assert _revocation_ttl_seconds() == 60


def test_revocation_ttl_floors_at_60_for_29s_cache(monkeypatch):
    # 29s cache → max(58, 60) = 60s floor.
    monkeypatch.setattr(auth_api, "_SESSION_CACHE_TTL", 29)
    assert _revocation_ttl_seconds() == 60


def test_revocation_ttl_scales_with_cache(monkeypatch):
    monkeypatch.setattr(auth_api, "_SESSION_CACHE_TTL", 1000)
    assert _revocation_ttl_seconds() == 2000


# ── _cache_get / _cache_put / _cache_invalidate ──────────────────────────────

def test_cache_get_missing_returns_none():
    assert _cache_get("nonexistent") is None


def test_cache_put_then_get_round_trip():
    _cache_put("token-A", user=None)
    entry = _cache_get("token-A")
    assert entry is not None
    expires_at, user = entry
    assert user is None
    # Expiry should be roughly now+TTL — at least in the future.
    assert expires_at > time.monotonic()


def test_cache_put_with_user_object():
    fake_user = object()
    _cache_put("token-X", user=fake_user)  # type: ignore[arg-type]
    _, returned = _cache_get("token-X")  # type: ignore[misc]
    assert returned is fake_user


def test_cache_invalidate_removes_entry():
    _cache_put("token-B", user=None)
    assert _cache_get("token-B") is not None
    _cache_invalidate("token-B")
    assert _cache_get("token-B") is None


def test_cache_invalidate_missing_token_is_silent():
    # Should not raise on a token that was never cached.
    _cache_invalidate("never-cached")


def test_cache_get_expired_entry_returns_none_and_evicts():
    # Inject an already-expired entry directly (bypass _cache_put which
    # would use the live TTL).
    auth_api._session_cache["expired"] = (time.monotonic() - 1, None)
    assert _cache_get("expired") is None
    # Side-effect: the expired entry is dropped from the dict.
    assert "expired" not in auth_api._session_cache


def test_cache_get_does_not_evict_live_entry():
    # Pin: live entries survive a get call.
    _cache_put("live", user=None)
    _cache_get("live")
    assert "live" in auth_api._session_cache


def test_cache_evicts_when_full(monkeypatch):
    # Cap the cache to a smaller size so the test runs in microseconds.
    monkeypatch.setattr(auth_api, "_SESSION_CACHE_MAX", 100)
    # Fill it past the cap; the next put triggers a ~10% eviction.
    for i in range(100):
        _cache_put(f"t-{i}", user=None)
    assert len(auth_api._session_cache) == 100
    # Adding one more should evict 100 // 10 = 10 oldest entries first,
    # then insert the new one → final size 91.
    _cache_put("t-extra", user=None)
    assert len(auth_api._session_cache) == 91
    assert "t-extra" in auth_api._session_cache


def test_cache_eviction_drops_oldest_first(monkeypatch):
    monkeypatch.setattr(auth_api, "_SESSION_CACHE_MAX", 10)
    # Inject entries with explicit expiry times (oldest expiry first).
    for i in range(10):
        auth_api._session_cache[f"t-{i}"] = (time.monotonic() + 100 + i, None)
    _cache_put("new", user=None)
    # The oldest one (smallest expiry) should be the first evicted.
    assert "t-0" not in auth_api._session_cache
    # Newer entries survived.
    assert "t-9" in auth_api._session_cache
    assert "new" in auth_api._session_cache
