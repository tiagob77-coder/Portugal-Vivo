"""
Tests for SEC-004: distributed session revocation.

The in-memory cache in auth_api kept a logged-out session usable for up to
60 s on workers that didn't process the logout themselves. The fix:

  1. TTL is configurable via SESSION_CACHE_TTL_SECONDS env var (clamped to
     a sane range so a typo doesn't silently lock the cache for hours).
  2. Logout / delete-account broadcast the revocation over Redis so every
     worker drops its cached entry on the next request.
  3. Failure-open: if Redis is unreachable, the system degrades to the
     previous "local cache only" behaviour — never blocks login/logout.

These tests are pure-function (no real Redis, no real Mongo). They pin the
contract — anyone who refactors the cache layer has to keep these passing.
"""
from __future__ import annotations

import asyncio
import os
from typing import Any

import pytest


# ── _ttl_from_env ─────────────────────────────────────────────────────────
#
# These exercise the pure helper directly. We deliberately do NOT reload the
# auth_api module: server.py captured references to auth_api at import time,
# and popping it from sys.modules + re-importing would leave a second module
# object whose DatabaseHolder is empty — silently breaking any later
# requires_db test that touches auth internals.


def test_ttl_default_is_60_when_env_absent(monkeypatch):
    import auth_api

    monkeypatch.delenv("SESSION_CACHE_TTL_SECONDS", raising=False)
    assert auth_api._ttl_from_env() == 60


def test_ttl_respects_env_override(monkeypatch):
    import auth_api

    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "15")
    assert auth_api._ttl_from_env() == 15


def test_ttl_clamps_to_minimum(monkeypatch):
    # 0 or negative would functionally disable the cache; clamp to 1 s.
    import auth_api

    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "0")
    assert auth_api._ttl_from_env() == 1


def test_ttl_clamps_to_maximum(monkeypatch):
    # 1 h is plenty — guards against typos like "604800" (a week).
    import auth_api

    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "9999999")
    assert auth_api._ttl_from_env() == 3600


def test_ttl_falls_back_on_garbage(monkeypatch):
    import auth_api

    monkeypatch.setenv("SESSION_CACHE_TTL_SECONDS", "abc")
    assert auth_api._ttl_from_env() == 60


def test_revocation_ttl_is_at_least_60_seconds(monkeypatch):
    """The Redis flag MUST outlive the in-memory cache or a stale entry
    could survive past the revocation window."""
    import auth_api

    monkeypatch.setattr(auth_api, "_SESSION_CACHE_TTL", 5)
    assert auth_api._revocation_ttl_seconds() >= 60


def test_revocation_ttl_doubles_cache_ttl_when_cache_is_long(monkeypatch):
    import auth_api

    monkeypatch.setattr(auth_api, "_SESSION_CACHE_TTL", 120)
    # 2 * 120 = 240 > 60 floor
    assert auth_api._revocation_ttl_seconds() == 240


# ── cache invalidation (sync helper, unchanged contract) ───────────────────


def test_cache_invalidate_pops_entry():
    import auth_api as mod

    mod._session_cache.clear()
    mod._cache_put("tok_x", None)
    assert "tok_x" in mod._session_cache
    mod._cache_invalidate("tok_x")
    assert "tok_x" not in mod._session_cache


def test_cache_invalidate_is_noop_for_unknown_token():
    import auth_api as mod

    mod._session_cache.clear()
    # Must not raise:
    mod._cache_invalidate("never_seen")


# ── distributed revoke / is_revoked: failure-open paths ───────────────────


def test_revoke_distributed_is_noop_without_redis(monkeypatch):
    """If REDIS_URL is not set, rate_limiter._get_redis returns None and
    _revoke_distributed must silently no-op (not raise, not block logout)."""
    import auth_api as mod
    import rate_limiter

    monkeypatch.setattr(rate_limiter, "_redis", None, raising=False)
    monkeypatch.setattr(rate_limiter, "_redis_tried", True, raising=False)

    # Should complete without raising.
    asyncio.run(mod._revoke_distributed("tok_y"))


def test_is_revoked_returns_false_without_redis(monkeypatch):
    """Without Redis: behaviour matches the pre-SEC-004 world (local cache
    only). The cache hit path must NOT treat a None-Redis as 'revoked' or
    every authenticated request would do an extra Mongo lookup."""
    import auth_api as mod
    import rate_limiter

    monkeypatch.setattr(rate_limiter, "_redis", None, raising=False)
    monkeypatch.setattr(rate_limiter, "_redis_tried", True, raising=False)

    result = asyncio.run(mod._is_revoked_distributed("tok_z"))
    assert result is False


def test_revoke_distributed_handles_empty_token():
    """Defensive: an empty token must not even reach Redis."""
    import auth_api as mod

    asyncio.run(mod._revoke_distributed(""))  # no raise
    assert asyncio.run(mod._is_revoked_distributed("")) is False


# ── distributed revoke / is_revoked: happy path with a fake Redis ─────────


class _FakeRedis:
    """Minimal async-Redis interface — just `set` and `exists`."""

    def __init__(self):
        self.store: dict[str, str] = {}
        self.set_calls: list[tuple] = []

    async def set(self, key, value, ex=None):
        self.set_calls.append((key, value, ex))
        self.store[key] = value

    async def exists(self, key):
        return 1 if key in self.store else 0


def test_revoke_distributed_writes_to_redis(monkeypatch):
    import auth_api as mod
    import rate_limiter

    fake = _FakeRedis()

    async def _fake_get_redis():
        return fake

    monkeypatch.setattr(rate_limiter, "_get_redis", _fake_get_redis)

    asyncio.run(mod._revoke_distributed("tok_happy"))

    assert fake.set_calls, "expected one Redis SET call"
    key, value, ex = fake.set_calls[0]
    assert key == "auth:revoked:tok_happy"
    assert value == "1"
    assert ex == mod._revocation_ttl_seconds()


def test_is_revoked_returns_true_when_flag_present(monkeypatch):
    import auth_api as mod
    import rate_limiter

    fake = _FakeRedis()
    fake.store["auth:revoked:tok_logged_out"] = "1"

    async def _fake_get_redis():
        return fake

    monkeypatch.setattr(rate_limiter, "_get_redis", _fake_get_redis)

    assert asyncio.run(mod._is_revoked_distributed("tok_logged_out")) is True
    assert asyncio.run(mod._is_revoked_distributed("tok_still_alive")) is False


def test_redis_set_failure_is_swallowed(monkeypatch):
    """A transient Redis SET failure (network blip, OOM, …) must not break
    logout — the local cache invalidation has already happened and we'd
    rather accept up to one TTL of staleness on other workers than 500."""
    import auth_api as mod
    import rate_limiter

    class _BrokenRedis:
        async def set(self, *a, **kw):
            raise RuntimeError("redis went away")

        async def exists(self, *a, **kw):
            raise RuntimeError("redis went away")

    async def _fake_get_redis():
        return _BrokenRedis()

    monkeypatch.setattr(rate_limiter, "_get_redis", _fake_get_redis)

    # Must not raise:
    asyncio.run(mod._revoke_distributed("tok_broken"))
    # Fail-open on read too:
    assert asyncio.run(mod._is_revoked_distributed("tok_broken")) is False
