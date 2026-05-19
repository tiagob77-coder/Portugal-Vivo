"""
Tests for LLM-001: per-user aggregate rate limit on LLM-backed endpoints
plus cookie-aware client key resolution.

The audit flagged two issues:

  1. `_client_key` only inspected the Authorization header, so web users
     who authenticate via the `session_token` cookie were bucketed by IP.
     Result: everyone behind one NAT shared the same rate-limit bucket.

  2. Per-endpoint LLM limits (5–15/min each) summed to >100 LLM
     calls/min/user when spread across the ~20 LLM endpoints — a single
     authenticated user could burn through the OpenAI budget with no
     aggregate guard.

These tests are pure-function; they don't spin up an ASGI app. They
exercise the classifier (`_is_llm_path`), the client-key extractor (with
mocked `Request`-like objects), and the prefix list.
"""
from __future__ import annotations

import os
from types import SimpleNamespace
from typing import Any, Dict


def _make_request(
    headers: Dict[str, str] | None = None,
    cookies: Dict[str, str] | None = None,
    host: str = "1.2.3.4",
) -> Any:
    """Tiny stand-in for fastapi.Request that exposes only the surface
    `_client_key` reads. Keeps tests fast and free of TestClient bootstrap.
    """
    headers = headers or {}
    cookies = cookies or {}

    class _H:
        def get(self, name, default=""):
            return headers.get(name.lower(), default)

    class _C:
        def get(self, name, default=None):
            return cookies.get(name, default)

    return SimpleNamespace(
        headers=_H(),
        cookies=_C(),
        client=SimpleNamespace(host=host),
    )


# ── _is_llm_path classifier ───────────────────────────────────────────────


def test_llm_classifier_recognises_known_prefixes():
    from rate_limiter import _is_llm_path

    assert _is_llm_path("/api/planner/ai-itinerary") is True
    assert _is_llm_path("/api/planner/ai-itinerary/123") is True  # prefix match
    assert _is_llm_path("/api/narrative/route/42/segment/3") is True
    assert _is_llm_path("/api/flora-fauna/identify") is True
    assert _is_llm_path("/api/discover/hoje") is True


def test_llm_classifier_rejects_non_llm_paths():
    from rate_limiter import _is_llm_path

    # Cheap endpoints that must NOT count against the LLM cap.
    assert _is_llm_path("/api/search") is False
    assert _is_llm_path("/api/auth/login") is False
    assert _is_llm_path("/api/heritage/123") is False
    assert _is_llm_path("/api/map/items") is False
    assert _is_llm_path("/api/proximity/nearby") is False
    assert _is_llm_path("/") is False
    assert _is_llm_path("") is False


def test_llm_classifier_does_not_match_substrings_in_middle():
    """`/api/x/planner/ai-itinerary` should NOT match. startswith semantics
    only — substring anywhere in the path would over-match."""
    from rate_limiter import _is_llm_path

    assert _is_llm_path("/v1/api/planner/ai-itinerary") is False


# ── LLM_ENDPOINT_PREFIXES shape ───────────────────────────────────────────


def test_llm_prefix_list_is_non_empty_and_unique():
    from rate_limiter import LLM_ENDPOINT_PREFIXES

    assert len(LLM_ENDPOINT_PREFIXES) > 10, (
        "If this drops below ~10, someone deleted prefixes by accident"
    )
    assert len(set(LLM_ENDPOINT_PREFIXES)) == len(LLM_ENDPOINT_PREFIXES), (
        "Duplicate prefix in LLM_ENDPOINT_PREFIXES — dedupe"
    )


def test_llm_prefix_list_only_contains_api_paths():
    from rate_limiter import LLM_ENDPOINT_PREFIXES

    for p in LLM_ENDPOINT_PREFIXES:
        assert p.startswith("/api/"), (
            f"Prefix {p!r} is not under /api/ — would silently never match"
        )


# ── env-var configuration of the aggregate cap ────────────────────────────


def test_llm_user_rate_limit_is_int_and_positive():
    from rate_limiter import LLM_USER_RATE_LIMIT, LLM_USER_RATE_WINDOW

    assert isinstance(LLM_USER_RATE_LIMIT, int)
    assert LLM_USER_RATE_LIMIT > 0
    assert isinstance(LLM_USER_RATE_WINDOW, int)
    assert LLM_USER_RATE_WINDOW > 0


# ── _client_key: Authorization header → cookie → IP fallback ──────────────


def test_client_key_prefers_authorization_header():
    from rate_limiter import _client_key

    req = _make_request(
        headers={"authorization": "Bearer aaaabbbbccccddddeeeeffff"},
        cookies={"session_token": "different-cookie-token"},
    )
    key = _client_key(req)
    assert key.startswith("user:")
    # Token prefix derived from the Authorization header, not the cookie.
    assert "aaaabbbbccccdddd" in key


def test_client_key_falls_back_to_cookie_when_header_absent():
    """Regression for the bug where web users (cookie auth) all shared
    one IP bucket."""
    from rate_limiter import _client_key

    req = _make_request(
        cookies={"session_token": "cookie-only-1234567890abcdef"},
    )
    key = _client_key(req)
    assert key.startswith("user:"), f"expected user-keyed bucket, got {key!r}"
    # 16-char prefix (matches the slice in _client_key)
    assert key == "user:cookie-only-1234"


def test_client_key_falls_back_to_ip_when_unauthenticated():
    from rate_limiter import _client_key

    req = _make_request(host="9.8.7.6")
    key = _client_key(req)
    assert key == "ip:9.8.7.6"


def test_client_key_honours_x_forwarded_for():
    from rate_limiter import _client_key

    req = _make_request(
        headers={"x-forwarded-for": "5.5.5.5, 10.0.0.1"},
        host="127.0.0.1",
    )
    key = _client_key(req)
    assert key == "ip:5.5.5.5"


def test_client_key_handles_empty_header_and_no_cookie():
    """`Authorization: Bearer ` (empty token) and no cookie → IP bucket."""
    from rate_limiter import _client_key

    req = _make_request(
        headers={"authorization": "Bearer "},
        host="1.1.1.1",
    )
    key = _client_key(req)
    assert key == "ip:1.1.1.1"


def test_different_cookie_tokens_produce_different_buckets():
    from rate_limiter import _client_key

    a = _client_key(_make_request(cookies={"session_token": "alice-token-aaaaaa"}))
    b = _client_key(_make_request(cookies={"session_token": "bob-token-bbbbbbbb"}))
    assert a != b, "two distinct users must not share a rate-limit bucket"
