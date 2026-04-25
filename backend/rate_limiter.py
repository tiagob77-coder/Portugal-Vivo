"""
Advanced Rate Limiting - Per-user and per-endpoint rate limits.

Provides tiered rate limiting beyond the global 200/min IP-based limiter:
  - Per-user limits keyed by session token
  - Per-endpoint limits for expensive operations (search, IQ processing)
  - Sliding window counters stored in Redis (falls back to in-memory)

Redis backend uses sorted-set-per-key (ZSET) with Unix timestamps as both
score and member. `is_allowed` runs in a single pipeline:
    ZREMRANGEBYSCORE key -inf cutoff   # prune
    ZCARD           key                 # read current count
    ZADD            key now now         # provisional add
    EXPIRE          key window          # keep TTL refreshed
If the post-add count would exceed the limit we undo with ZREM. The
in-memory `_SlidingWindowStore` remains available as an automatic
fallback when Redis is unreachable.
"""
import os
import time
import logging
from typing import Dict, Optional, Tuple
from collections import defaultdict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


# ── Prometheus counter (best-effort; no-op if client missing) ────────────

try:
    from prometheus_client import Counter

    _rate_limit_triggered = Counter(
        "rate_limit_triggered_total",
        "Number of times a rate limit was hit and the request was denied (429).",
        ["endpoint", "scope"],  # scope = "endpoint" | "global"
    )
except Exception:  # pragma: no cover — prom client optional
    _rate_limit_triggered = None


def _inc_trigger(endpoint: str, scope: str) -> None:
    if _rate_limit_triggered is None:
        return
    try:
        _rate_limit_triggered.labels(endpoint=endpoint, scope=scope).inc()
    except Exception:
        pass

# Endpoint-specific limits: (max_requests, window_seconds)
ENDPOINT_LIMITS: Dict[str, Tuple[int, int]] = {
    # Search
    "/api/search": (30, 60),
    "/api/search/global": (20, 60),
    "/api/search/suggestions": (60, 60),
    # IQ Engine (heavy processing)
    "/api/iq/process-poi": (10, 60),
    "/api/iq/batch-process": (3, 60),
    # LLM-powered endpoints (expensive — Emergent gpt-4o-mini calls)
    "/api/content/depth": (10, 60),
    "/api/content/micro-stories": (10, 60),
    "/api/planner/smart-itinerary": (5, 60),
    "/api/planner/ai-itinerary": (5, 60),
    "/api/ai/itinerary": (5, 60),
    "/api/ai/enrich": (5, 60),
    "/api/narrative/nearby-stories": (8, 60),
    "/api/narrative/route/": (8, 60),
    "/api/toolkit/enrich/": (5, 60),
    "/api/translations/translate/": (15, 60),
    "/api/orchestrator/context": (20, 60),
    "/api/orchestrator/smart-discover": (10, 60),
    "/api/narratives/": (10, 60),
    # Music / Cultural / Maritime narratives (LLM)
    "/api/music/narrative": (8, 60),
    "/api/maritime-culture/narrative": (8, 60),
    "/api/cultural-routes/narrative": (8, 60),
    "/api/cultural-routes/personalize": (5, 60),
    # LLM-backed identification & pairing (Emergent gpt-4o-mini)
    "/api/gastronomy/pairing/": (8, 60),
    "/api/flora-fauna/identify": (8, 60),
    "/api/marine-biodiversity/identify": (8, 60),
    "/api/narrative-layer/generate": (10, 60),
    "/api/discover/hoje": (15, 60),
    # Smart notifications (DB-heavy proximity scans)
    "/api/notifications/smart/check-nearby": (20, 60),
    "/api/notifications/smart/check-events": (20, 60),
    # Auth (brute-force protection)
    "/api/auth/login": (10, 60),
    "/api/auth/register": (5, 60),
    "/api/auth/forgot-password": (3, 60),
    # Image upload
    "/api/uploads/": (10, 60),
    "/api/cloudinary/": (10, 60),
    # GPX trail upload — expensive parsing + DB write
    "/api/trails/upload": (5, 60),
    # Map & proximity — large geo queries, protect from abuse
    "/api/map/items": (60, 60),
    "/api/proximity/nearby": (60, 60),
    "/api/proximity/alerts": (30, 60),
    "/api/proximity/heatzone": (30, 60),
    "/api/nearby": (60, 60),  # legacy compat POST alias
}

# Per-user limit (authenticated): requests per minute
USER_RATE_LIMIT = 120
USER_RATE_WINDOW = 60


class _SlidingWindowStore:
    """In-memory sliding window counter (per key)."""

    def __init__(self):
        self._store: Dict[str, list] = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window: int) -> Tuple[bool, int]:
        """Check if request is allowed. Returns (allowed, remaining)."""
        now = time.time()
        cutoff = now - window
        # Prune expired entries
        self._store[key] = [t for t in self._store[key] if t > cutoff]
        current = len(self._store[key])
        if current >= max_requests:
            return False, 0
        self._store[key].append(now)
        return True, max_requests - current - 1


_store = _SlidingWindowStore()


# ── Redis-backed sliding window (distributed) ──────────────────────────────

_REDIS_KEY_PREFIX = "ratelimit"
_redis = None
_redis_tried = False


async def _get_redis():
    """Lazily connect to Redis, memoising success/failure.

    Mirrors the ``llm_cache`` fail-open pattern: one attempt per process,
    remembered for the lifetime of the process. If Redis is unreachable
    the middleware transparently falls back to the in-memory store.
    """
    global _redis, _redis_tried
    if _redis is not None:
        return _redis
    if _redis_tried:
        return None
    _redis_tried = True

    url = os.environ.get("REDIS_URL", "").strip()
    if not url:
        logger.info("REDIS_URL not set — rate limiter using in-memory store")
        return None

    try:
        import redis.asyncio as aioredis  # type: ignore

        client = aioredis.from_url(url, decode_responses=True, socket_connect_timeout=3)
        await client.ping()
        _redis = client
        logger.info("Rate limiter connected to Redis")
        return _redis
    except Exception as exc:
        logger.warning("Rate limiter: Redis unreachable (%s) — using in-memory store", exc)
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


async def _redis_is_allowed(
    client, key: str, max_requests: int, window: int
) -> Tuple[bool, int]:
    """Check a sliding window via Redis. Returns (allowed, remaining).

    Uses a ZSET where each request is a (timestamp, timestamp) pair. The
    four operations run in a single pipeline to minimise latency and keep
    the state change close to atomic.
    """
    now = time.time()
    cutoff = now - window
    redis_key = f"{_REDIS_KEY_PREFIX}:{key}"
    try:
        pipe = client.pipeline(transaction=False)
        pipe.zremrangebyscore(redis_key, "-inf", cutoff)
        pipe.zcard(redis_key)
        pipe.zadd(redis_key, {str(now): now})
        pipe.expire(redis_key, window + 1)
        _, current, _, _ = await pipe.execute()
    except Exception as exc:
        # Single-call failure: degrade silently and let the in-memory path
        # pick up the request. We don't flip ``_redis_tried`` here — this
        # might just be a transient blip.
        logger.warning("Rate limiter Redis op failed (%s): %s", redis_key, exc)
        raise
    # current is the count BEFORE our add. After the add count = current+1.
    if current >= max_requests:
        try:
            await client.zrem(redis_key, str(now))
        except Exception:
            # Harmless leftover; expire will reap it.
            pass
        return False, 0
    return True, max_requests - (current + 1)


async def _is_allowed(key: str, max_requests: int, window: int) -> Tuple[bool, int]:
    """Check rate limit using Redis if available, else in-memory.

    Fail-open: any Redis error falls back to the local sliding window so
    the request is still rate-limited (per-worker) rather than letting it
    through unbounded.
    """
    client = await _get_redis()
    if client is not None:
        try:
            return await _redis_is_allowed(client, key, max_requests, window)
        except Exception:
            pass
    return _store.is_allowed(key, max_requests, window)


def _client_key(request: Request) -> str:
    """Extract a unique client identifier (user token or IP)."""
    token = request.headers.get("authorization", "").removeprefix("Bearer ").strip()
    if token:
        # Use first 16 chars of token as key (sufficient for uniqueness)
        return f"user:{token[:16]}"
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    return f"ip:{ip}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware that enforces per-user and per-endpoint rate limits."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        client = _client_key(request)

        # 1. Check endpoint-specific limits
        for endpoint_prefix, (max_req, window) in ENDPOINT_LIMITS.items():
            if path.startswith(endpoint_prefix):
                key = f"endpoint:{client}:{endpoint_prefix}"
                allowed, remaining = await _is_allowed(key, max_req, window)
                if not allowed:
                    logger.warning("Rate limit hit: %s on %s", client, endpoint_prefix)
                    _inc_trigger(endpoint_prefix, "endpoint")
                    return Response(
                        content='{"detail":"Rate limit exceeded for this endpoint"}',
                        status_code=429,
                        media_type="application/json",
                        headers={
                            "Retry-After": str(window),
                            "X-RateLimit-Limit": str(max_req),
                            "X-RateLimit-Remaining": "0",
                        },
                    )
                break

        # 2. Check per-user global limit (only for API paths)
        if path.startswith("/api/"):
            key = f"global:{client}"
            allowed, remaining = await _is_allowed(key, USER_RATE_LIMIT, USER_RATE_WINDOW)
            if not allowed:
                logger.warning("Global user rate limit hit: %s", client)
                _inc_trigger(path, "global")
                return Response(
                    content='{"detail":"Too many requests"}',
                    status_code=429,
                    media_type="application/json",
                    headers={
                        "Retry-After": str(USER_RATE_WINDOW),
                        "X-RateLimit-Limit": str(USER_RATE_LIMIT),
                        "X-RateLimit-Remaining": "0",
                    },
                )

        response = await call_next(request)
        return response
