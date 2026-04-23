"""
Unit tests for the Redis-backed sliding window in ``rate_limiter``.

These tests stub the Redis client entirely (no real Redis process required)
so CI stays deterministic. The fake implements only the ZSET ops the
limiter uses: ``zremrangebyscore``, ``zcard``, ``zadd``, ``zrem``,
``expire``, and a ``pipeline`` that records calls.
"""
import time

import pytest

import rate_limiter


# ── Fake Redis ────────────────────────────────────────────────────────────

class _FakePipeline:
    def __init__(self, redis):
        self.redis = redis
        self.ops: list = []

    def zremrangebyscore(self, key, lo, hi):
        self.ops.append(("zrem_range", key, lo, hi))
        return self

    def zcard(self, key):
        self.ops.append(("zcard", key))
        return self

    def zadd(self, key, mapping):
        self.ops.append(("zadd", key, mapping))
        return self

    def expire(self, key, seconds):
        self.ops.append(("expire", key, seconds))
        return self

    async def execute(self):
        results = []
        for op in self.ops:
            if op[0] == "zrem_range":
                _, key, lo, hi = op
                zset = self.redis.zsets.setdefault(key, {})
                lo_val = float("-inf") if lo == "-inf" else float(lo)
                hi_val = float("inf") if hi == "+inf" else float(hi)
                to_del = [m for m, s in zset.items() if lo_val <= s <= hi_val]
                for m in to_del:
                    zset.pop(m, None)
                results.append(len(to_del))
            elif op[0] == "zcard":
                _, key = op
                results.append(len(self.redis.zsets.get(key, {})))
            elif op[0] == "zadd":
                _, key, mapping = op
                zset = self.redis.zsets.setdefault(key, {})
                added = 0
                for member, score in mapping.items():
                    if member not in zset:
                        added += 1
                    zset[member] = score
                results.append(added)
            elif op[0] == "expire":
                _, key, seconds = op
                self.redis.expires[key] = seconds
                results.append(1)
        return results


class _FakeRedis:
    def __init__(self):
        self.zsets: dict = {}
        self.expires: dict = {}

    def pipeline(self, transaction: bool = False):
        return _FakePipeline(self)

    async def zrem(self, key, member):
        zset = self.zsets.get(key)
        if zset is not None:
            zset.pop(member, None)


def _install_fake(monkeypatch, fake):
    """Replace ``_get_redis`` with one that returns the fake; clear in-mem state."""
    async def _fake_get_redis():
        return fake

    monkeypatch.setattr(rate_limiter, "_get_redis", _fake_get_redis)
    rate_limiter._store._store.clear()


# ── Tests ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_redis_allows_below_limit(monkeypatch):
    """First N-1 calls under the limit return allowed=True with decreasing remaining."""
    fake = _FakeRedis()
    _install_fake(monkeypatch, fake)

    results = []
    for _ in range(3):
        results.append(await rate_limiter._is_allowed("k1", max_requests=5, window=60))

    assert [r[0] for r in results] == [True, True, True]
    # Remaining decreases: 4, 3, 2
    assert [r[1] for r in results] == [4, 3, 2]


@pytest.mark.asyncio
async def test_redis_blocks_above_limit(monkeypatch):
    """The (max+1)-th call must be denied and not counted in the window."""
    fake = _FakeRedis()
    _install_fake(monkeypatch, fake)

    # Burn the budget.
    for _ in range(3):
        allowed, _rem = await rate_limiter._is_allowed("k2", 3, 60)
        assert allowed is True

    denied, remaining = await rate_limiter._is_allowed("k2", 3, 60)
    assert denied is False
    assert remaining == 0
    # Denied request must NOT occupy a slot — the zset size stays at 3.
    zset_key = f"{rate_limiter._REDIS_KEY_PREFIX}:k2"
    assert len(fake.zsets[zset_key]) == 3


@pytest.mark.asyncio
async def test_redis_expires_old_entries(monkeypatch):
    """Entries older than the window are pruned and budget resets."""
    fake = _FakeRedis()
    _install_fake(monkeypatch, fake)

    # Seed the zset with three stale entries outside the 60s window.
    zset_key = f"{rate_limiter._REDIS_KEY_PREFIX}:k3"
    old = time.time() - 3600
    fake.zsets[zset_key] = {str(old + i): old + i for i in range(3)}

    allowed, remaining = await rate_limiter._is_allowed("k3", 3, 60)
    assert allowed is True
    # Remaining == max - 1 because we just added one fresh entry after prune.
    assert remaining == 2


@pytest.mark.asyncio
async def test_falls_back_to_inmem_when_redis_absent(monkeypatch):
    """With no Redis client, the in-memory limiter still enforces the cap."""

    async def _no_redis():
        return None

    monkeypatch.setattr(rate_limiter, "_get_redis", _no_redis)
    rate_limiter._store._store.clear()

    for _ in range(2):
        allowed, _rem = await rate_limiter._is_allowed("k4", 2, 60)
        assert allowed is True

    denied, _rem = await rate_limiter._is_allowed("k4", 2, 60)
    assert denied is False


@pytest.mark.asyncio
async def test_falls_back_to_inmem_when_redis_raises(monkeypatch):
    """Any Redis error mid-request must degrade to the in-memory path."""

    class _Exploding:
        def pipeline(self, transaction=False):
            raise RuntimeError("connection reset")

        async def zrem(self, *a, **kw):
            raise RuntimeError("connection reset")

    async def _fake_get_redis():
        return _Exploding()

    monkeypatch.setattr(rate_limiter, "_get_redis", _fake_get_redis)
    rate_limiter._store._store.clear()

    for _ in range(2):
        allowed, _rem = await rate_limiter._is_allowed("k5", 2, 60)
        assert allowed is True

    denied, _rem = await rate_limiter._is_allowed("k5", 2, 60)
    assert denied is False


@pytest.mark.asyncio
async def test_expire_is_refreshed_on_every_allowed_call(monkeypatch):
    """Every accepted request must re-arm the TTL so the key doesn't leak."""
    fake = _FakeRedis()
    _install_fake(monkeypatch, fake)

    await rate_limiter._is_allowed("k6", 5, 90)
    zset_key = f"{rate_limiter._REDIS_KEY_PREFIX}:k6"
    assert fake.expires[zset_key] == 91  # window + 1
