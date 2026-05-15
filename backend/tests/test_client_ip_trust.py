"""
Tests for ``server._client_ip_for_rate_limit``.

The auth rate limiter buckets on this value, so it must NOT honour
spoofed ``X-Forwarded-For`` headers from clients that can hit uvicorn
directly. Codex review r3247555951 / P1.
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass


def _import_server():
    """Import server with the env knobs the function depends on."""
    os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
    os.environ.setdefault("DB_NAME", "test")
    os.environ.setdefault("JWT_SECRET_KEY", "x" * 64)
    os.environ.setdefault("ENVIRONMENT", "test")
    sys.path.insert(0, ".")
    import server  # noqa: WPS433
    return server


@dataclass
class _Client:
    host: str


class _Req:
    def __init__(self, peer_host: str, headers: dict[str, str] | None = None):
        self.client = _Client(peer_host) if peer_host else None
        self.headers = headers or {}


def test_no_peer_returns_unknown():
    server = _import_server()
    req = _Req("")
    req.client = None
    assert server._client_ip_for_rate_limit(req) == "unknown"


def test_untrusted_peer_ignored_xff():
    """An untrusted peer cannot override its rate-limit bucket by adding
    a forged X-Forwarded-For header — we must use the real TCP peer."""
    server = _import_server()
    req = _Req("203.0.113.10", {"x-forwarded-for": "1.2.3.4"})
    assert server._client_ip_for_rate_limit(req) == "203.0.113.10"


def test_trusted_peer_honours_xff():
    """When the peer IS our nginx (127.0.0.1 by default), the first
    entry of X-Forwarded-For is the original client and we honour it."""
    server = _import_server()
    req = _Req("127.0.0.1", {"x-forwarded-for": "198.51.100.7, 10.0.0.1"})
    assert server._client_ip_for_rate_limit(req) == "198.51.100.7"


def test_trusted_peer_without_xff_falls_back_to_peer():
    server = _import_server()
    req = _Req("127.0.0.1", {})
    assert server._client_ip_for_rate_limit(req) == "127.0.0.1"


def test_trusted_peer_with_empty_xff_falls_back_to_peer():
    server = _import_server()
    req = _Req("127.0.0.1", {"x-forwarded-for": "   "})
    assert server._client_ip_for_rate_limit(req) == "127.0.0.1"


def test_ipv6_loopback_is_trusted():
    server = _import_server()
    req = _Req("::1", {"x-forwarded-for": "192.0.2.42"})
    assert server._client_ip_for_rate_limit(req) == "192.0.2.42"


def test_spoof_attempt_from_internet_ignored():
    """The canonical attack scenario the review flagged: an attacker
    hits uvicorn directly and rotates X-Forwarded-For each request to
    evade the limiter. Must never succeed."""
    server = _import_server()
    real_peer = "203.0.113.99"
    bucket = None
    for spoof in ("1.1.1.1", "8.8.8.8", "127.0.0.1", "::1"):
        req = _Req(real_peer, {"x-forwarded-for": spoof})
        key = server._client_ip_for_rate_limit(req)
        assert key == real_peer, (
            f"spoofed XFF {spoof!r} leaked into bucket: {key!r}"
        )
        bucket = key
    assert bucket == real_peer
