"""
Unit tests for backend/llm_cache.py.

These tests stub out the Redis client entirely — they exercise the cache's
public surface without requiring a real Redis process. The Redis-facing paths
(connection failures, silent fallthroughs) are covered by monkeypatching
``llm_cache._get_redis``.
"""
import pytest
import pytest_asyncio

import llm_cache


@pytest_asyncio.fixture(autouse=True)
async def _reset_llm_cache_state():
    """Drop the memoised client between tests so each case gets a clean slate."""
    await llm_cache._reset_for_tests()
    yield
    await llm_cache._reset_for_tests()


def test_build_cache_key_is_stable_and_namespaced():
    """Same inputs → same key; different inputs → different keys; namespace in the clear."""
    k1 = llm_cache.build_cache_key("music", "item_001", "cultural", "pt")
    k2 = llm_cache.build_cache_key("music", "item_001", "cultural", "pt")
    k3 = llm_cache.build_cache_key("music", "item_001", "cultural", "en")
    assert k1 == k2
    assert k1 != k3
    assert k1.startswith("llmcache:music:")


def test_build_cache_key_handles_nonstring_parts():
    """Numbers and None must coerce without TypeError."""
    key = llm_cache.build_cache_key("ns", 42, None, 3.14)
    assert key.startswith("llmcache:ns:")


class _FakeRedis:
    """Minimal in-memory stand-in for an aioredis client."""

    def __init__(self):
        self.store: dict[str, str] = {}
        self.set_calls: list[tuple[str, str, int | None]] = []

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value
        self.set_calls.append((key, value, ex))

    async def delete(self, key):
        self.store.pop(key, None)


@pytest.mark.anyio
async def test_cache_roundtrip(monkeypatch):
    """set() then get() returns the original value via the stubbed backend."""
    fake = _FakeRedis()

    async def _fake_get_redis():
        return fake

    monkeypatch.setattr(llm_cache, "_get_redis", _fake_get_redis)

    key = llm_cache.build_cache_key("test", "a", "b")
    assert await llm_cache.cache_get("test", key) is None  # miss

    ok = await llm_cache.cache_set("test", key, '{"hello":"world"}', ttl_seconds=120)
    assert ok is True
    assert fake.set_calls[-1][2] == 120  # ttl forwarded

    hit = await llm_cache.cache_get("test", key)
    assert hit == '{"hello":"world"}'


@pytest.mark.anyio
async def test_cache_fails_open_when_redis_unavailable(monkeypatch):
    """If Redis is unreachable, get/set must return None/False silently."""

    async def _no_redis():
        return None

    monkeypatch.setattr(llm_cache, "_get_redis", _no_redis)

    key = llm_cache.build_cache_key("test", "x")
    assert await llm_cache.cache_get("test", key) is None
    assert await llm_cache.cache_set("test", key, "value", ttl_seconds=60) is False


@pytest.mark.anyio
async def test_cache_get_swallows_redis_errors(monkeypatch):
    """A raising Redis backend must not propagate — LLM traffic must be unaffected."""

    class _Exploding:
        async def get(self, key):
            raise RuntimeError("connection reset")

        async def set(self, key, value, ex=None):
            raise RuntimeError("connection reset")

    async def _fake_get_redis():
        return _Exploding()

    monkeypatch.setattr(llm_cache, "_get_redis", _fake_get_redis)

    key = llm_cache.build_cache_key("test", "boom")
    assert await llm_cache.cache_get("test", key) is None
    assert await llm_cache.cache_set("test", key, "v") is False


@pytest.mark.anyio
async def test_ttl_floor_is_one_second(monkeypatch):
    """Zero or negative TTLs are clamped up to 1s to keep Redis happy."""
    fake = _FakeRedis()

    async def _fake_get_redis():
        return fake

    monkeypatch.setattr(llm_cache, "_get_redis", _fake_get_redis)

    await llm_cache.cache_set("test", "k", "v", ttl_seconds=0)
    await llm_cache.cache_set("test", "k", "v", ttl_seconds=-5)
    assert all(ex >= 1 for _, _, ex in fake.set_calls)
