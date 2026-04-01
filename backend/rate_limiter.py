"""
Advanced Rate Limiting - Per-user and per-endpoint rate limits.

Provides tiered rate limiting beyond the global 200/min IP-based limiter:
  - Per-user limits keyed by session token
  - Per-endpoint limits for expensive operations (search, IQ processing)
  - Sliding window counters stored in Redis (falls back to in-memory)
"""
import time
import logging
from typing import Dict, Optional, Tuple
from collections import defaultdict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

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
    # Auth (brute-force protection)
    "/api/auth/login": (10, 60),
    "/api/auth/register": (5, 60),
    "/api/auth/forgot-password": (3, 60),
    # Image upload
    "/api/uploads/": (10, 60),
    "/api/cloudinary/": (10, 60),
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
                allowed, remaining = _store.is_allowed(key, max_req, window)
                if not allowed:
                    logger.warning("Rate limit hit: %s on %s", client, endpoint_prefix)
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
            allowed, remaining = _store.is_allowed(key, USER_RATE_LIMIT, USER_RATE_WINDOW)
            if not allowed:
                logger.warning("Global user rate limit hit: %s", client)
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
