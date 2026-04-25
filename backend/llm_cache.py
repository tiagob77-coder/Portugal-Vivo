"""
llm_cache.py — Redis-backed cache for deterministic LLM narrative responses.

Motivation
----------
Endpoints like `/api/music/narrative`, `/api/maritime-culture/narrative`, and
`/api/cultural-routes/narrative` produce the same output for the same
(entity_id, style, language) tuple. Calling gpt-4o-mini every time costs
latency and money. A simple TTL'd Redis cache collapses those duplicate
calls to a single request per TTL window.

Design
------
- **Opt-in**: callers build a cache key explicitly via ``build_cache_key``.
  No endpoint is silently cached; this prevents accidentally caching
  personalised / user-specific output.
- **Fail-open**: every Redis operation is wrapped — on error we log at
  WARNING and the caller proceeds as if there was no cache. LLM traffic
  must never fail because of cache infrastructure.
- **Observable**: hit / miss / error counts are exposed as Prometheus
  counters so we can track cache effectiveness per namespace.
- **Serialisation-agnostic**: values are stored as UTF-8 strings. Callers
  that cache JSON should ``json.dumps`` before ``set`` and ``json.loads``
  after ``get`` — keeping the helper dumb keeps it reusable for plain
  text narratives too.
"""
from __future__ import annotations

import hashlib
import logging
import os
from typing import Optional

logger = logging.getLogger("llm_cache")

_CACHE_KEY_PREFIX = "llmcache"
_DEFAULT_TTL_SECONDS = 60 * 60 * 24  # 24h

# Lazily-initialised Redis client. Reused across requests so we don't pay
# the TCP setup cost on every cache lookup.
_redis = None
_redis_tried = False


# ── Prometheus counters (best-effort; no-ops if client missing) ────────────

try:
    from prometheus_client import Counter

    _hits = Counter(
        "llm_cache_hits_total",
        "LLM response cache hits, grouped by logical namespace.",
        ["namespace"],
    )
    _misses = Counter(
        "llm_cache_misses_total",
        "LLM response cache misses, grouped by logical namespace.",
        ["namespace"],
    )
    _errors = Counter(
        "llm_cache_errors_total",
        "Redis errors encountered during LLM cache access.",
        ["op"],
    )
    _llm_calls = Counter(
        "llm_calls_total",
        "Outbound LLM calls grouped by namespace and outcome.",
        ["namespace", "outcome"],  # outcome = "success" | "fallback" | "error"
    )
except Exception:  # pragma: no cover — prom client optional in tests
    _hits = _misses = _errors = _llm_calls = None


def _inc(counter, **labels) -> None:
    if counter is None:
        return
    try:
        counter.labels(**labels).inc()
    except Exception:
        pass


def record_llm_call(namespace: str, outcome: str) -> None:
    """Record an outbound LLM call's outcome.

    Callers should invoke this exactly once per attempted upstream request,
    AFTER the try/except — so a single user-visible response counts as one
    call regardless of how many internal retries happened.

    ``outcome`` is one of:
      - ``success``  — LLM returned a valid response
      - ``fallback`` — LLM unavailable (no key, network error) → static fallback
      - ``error``    — LLM responded but parse / validation failed
    """
    _inc(_llm_calls, namespace=namespace, outcome=outcome)


# ── Redis connection bootstrap ─────────────────────────────────────────────

async def _get_redis():
    """Return a cached ``aioredis`` client, or ``None`` if unavailable.

    We try once and memoise the outcome. If the first connection fails we
    keep ``_redis = None`` and short-circuit every subsequent call — we do
    NOT retry on every request, that would defeat the fail-open promise.
    """
    global _redis, _redis_tried
    if _redis is not None:
        return _redis
    if _redis_tried:
        return None
    _redis_tried = True

    url = os.environ.get("REDIS_URL", "").strip()
    if not url:
        logger.info("REDIS_URL not set — LLM cache disabled")
        return None

    try:
        import redis.asyncio as aioredis  # type: ignore

        client = aioredis.from_url(url, decode_responses=True, socket_connect_timeout=3)
        await client.ping()
        _redis = client
        logger.info("LLM cache connected to Redis")
        return _redis
    except Exception as exc:
        logger.warning("LLM cache: Redis unreachable (%s) — running without cache", exc)
        return None


async def _reset_for_tests() -> None:
    """Drop the memoised client so tests can swap backends between cases."""
    global _redis, _redis_tried
    if _redis is not None:
        try:
            await _redis.close()
        except Exception:
            pass
    _redis = None
    _redis_tried = False


# ── Public API ────────────────────────────────────────────────────────────

def build_cache_key(namespace: str, *parts: str) -> str:
    """Build a stable, bounded cache key.

    ``parts`` are joined with ``|`` and hashed so callers can pass
    arbitrarily long prompts without blowing the Redis key size limit.
    The namespace stays in the clear to keep keys diagnosable with
    ``redis-cli --scan --pattern 'llmcache:music:*'``.
    """
    raw = "|".join(str(p) for p in parts)
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]
    return f"{_CACHE_KEY_PREFIX}:{namespace}:{digest}"


async def cache_get(namespace: str, key: str) -> Optional[str]:
    """Fetch a cached entry. Returns ``None`` on miss or any error."""
    r = await _get_redis()
    if r is None:
        _inc(_misses, namespace=namespace)
        return None
    try:
        value = await r.get(key)
    except Exception as exc:
        logger.warning("LLM cache GET failed (%s): %s", key, exc)
        _inc(_errors, op="get")
        return None
    if value is None:
        _inc(_misses, namespace=namespace)
        return None
    _inc(_hits, namespace=namespace)
    return value


async def cache_set(
    namespace: str,
    key: str,
    value: str,
    ttl_seconds: int = _DEFAULT_TTL_SECONDS,
) -> bool:
    """Store a value with TTL. Returns ``True`` on success, ``False`` otherwise."""
    r = await _get_redis()
    if r is None:
        return False
    try:
        await r.set(key, value, ex=max(1, int(ttl_seconds)))
        return True
    except Exception as exc:
        logger.warning("LLM cache SET failed (%s): %s", key, exc)
        _inc(_errors, op="set")
        return False


async def cache_invalidate(namespace: str, key: str) -> bool:
    """Delete a single cache entry (used when upstream data changes)."""
    r = await _get_redis()
    if r is None:
        return False
    try:
        await r.delete(key)
        return True
    except Exception as exc:
        logger.warning("LLM cache DEL failed (%s): %s", key, exc)
        _inc(_errors, op="del")
        return False
