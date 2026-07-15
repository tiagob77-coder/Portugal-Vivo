"""
geo_cache.py — Redis-backed cache for geocoding results.

Motivation
----------
Nominatim / GeoAPI.pt results were cached only in-memory per process, so
every restart (and every extra worker) re-hit the external APIs — a problem
given Nominatim's 1 req/s usage policy. Addresses for a fixed coordinate
rarely change, so a long-TTL shared Redis cache collapses those calls.

Design (mirrors llm_cache.py)
-----------------------------
- **Fail-open**: every Redis operation is wrapped — on error the caller
  proceeds as if there was no cache. Geocoding must never fail because of
  cache infrastructure. Without REDIS_URL the module is a no-op.
- **JSON values**: geocoding results are dicts / lists of dicts; the helpers
  serialise transparently so services stay simple.
- **Diagnosable keys**: `geocache:<namespace>:<key>` in the clear, e.g.
  `redis-cli --scan --pattern 'geocache:nominatim_reverse:*'`.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

logger = logging.getLogger("geo_cache")

_CACHE_KEY_PREFIX = "geocache"
DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days — addresses are near-static

# Lazily-initialised Redis client, memoised like llm_cache: try once,
# never retry on every request if Redis is down.
_redis = None
_redis_tried = False


async def _get_redis():
    global _redis, _redis_tried
    if _redis is not None:
        return _redis
    if _redis_tried:
        return None
    _redis_tried = True

    url = os.environ.get("REDIS_URL", "").strip()
    if not url:
        logger.info("REDIS_URL not set — geo cache disabled")
        return None

    try:
        import redis.asyncio as aioredis  # type: ignore

        client = aioredis.from_url(url, decode_responses=True, socket_connect_timeout=3)
        await client.ping()
        _redis = client
        logger.info("Geo cache connected to Redis")
        return _redis
    except Exception as exc:
        logger.warning("Geo cache: Redis unreachable (%s) — running without cache", exc)
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


def build_geo_key(namespace: str, *parts: Any) -> str:
    """Build a stable cache key: `geocache:<namespace>:<part1>:<part2>…`.

    Coordinates should be pre-rounded by the caller (e.g. `f"{lat:.5f}"`)
    so nearby lookups collapse onto the same entry deterministically.
    """
    suffix = ":".join(str(p) for p in parts)
    return f"{_CACHE_KEY_PREFIX}:{namespace}:{suffix}"


async def geo_cache_get(key: str) -> Optional[Any]:
    """Fetch and JSON-decode a cached entry. Returns None on miss or error."""
    r = await _get_redis()
    if r is None:
        return None
    try:
        raw = await r.get(key)
    except Exception as exc:
        logger.warning("Geo cache GET failed (%s): %s", key, exc)
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        logger.warning("Geo cache: invalid JSON at %s — ignoring entry", key)
        return None


async def geo_cache_set(
    key: str,
    value: Any,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> bool:
    """JSON-encode and store a value with TTL. Fail-open: False on any error."""
    r = await _get_redis()
    if r is None:
        return False
    try:
        raw = json.dumps(value, ensure_ascii=False, default=str)
        await r.set(key, raw, ex=max(1, int(ttl_seconds)))
        return True
    except Exception as exc:
        logger.warning("Geo cache SET failed (%s): %s", key, exc)
        return False
