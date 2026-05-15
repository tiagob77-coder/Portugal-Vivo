"""
Pure-function tests for the FastAPI security_headers middleware.

Pins the header set so a regression (someone deleting a header to "fix"
a CORS quirk, or downgrading the CSP) fails at PR time. The test
constructs the middleware in isolation and exercises it directly,
avoiding any HTTP round-trip or Mongo dependency.
"""
from __future__ import annotations

from importlib import reload

import pytest


def _get_middleware_callable():
    """Return the inner middleware function used by FastAPI.

    The decorator on server.security_headers_middleware wraps the async
    function in a BaseHTTPMiddleware-style call; we exercise the raw
    coroutine directly by importing it.
    """
    import os
    os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
    os.environ.setdefault("DB_NAME", "test")
    os.environ.setdefault("JWT_SECRET_KEY", "x" * 64)
    os.environ.setdefault("ENVIRONMENT", "test")
    import server  # noqa: WPS433
    return server.security_headers_middleware


@pytest.mark.anyio
async def test_baseline_headers_set():
    middleware = _get_middleware_callable()

    class _Resp:
        def __init__(self):
            self.headers: dict[str, str] = {}

    async def _call_next(_req):
        return _Resp()

    resp = await middleware(None, _call_next)

    # Every header below MUST be present on every API response.
    required = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-site",
    }
    for header, expected in required.items():
        assert resp.headers.get(header) == expected, (
            f"{header} missing or wrong: got {resp.headers.get(header)!r}"
        )


@pytest.mark.anyio
async def test_csp_is_locked_down_for_api():
    """The API responds with JSON, never HTML. The CSP must reflect that
    so a browser refuses to render anything served from this origin even
    if a future endpoint accidentally returns text/html."""
    middleware = _get_middleware_callable()

    class _Resp:
        def __init__(self):
            self.headers: dict[str, str] = {}

    async def _call_next(_req):
        return _Resp()

    resp = await middleware(None, _call_next)
    csp = resp.headers["Content-Security-Policy"]
    assert "default-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp
    # Make sure no developer accidentally added a script/style/img source.
    for forbidden in ("script-src", "style-src", "img-src"):
        # The base policy may grow later, but if it sprouts these without
        # an explicit allow-list it almost certainly weakens the gate.
        if forbidden in csp:
            assert "'none'" in csp.split(forbidden, 1)[1].split(";", 1)[0]


@pytest.mark.anyio
async def test_permissions_policy_grants_only_geolocation_self():
    middleware = _get_middleware_callable()

    class _Resp:
        def __init__(self):
            self.headers: dict[str, str] = {}

    async def _call_next(_req):
        return _Resp()

    resp = await middleware(None, _call_next)
    perms = resp.headers["Permissions-Policy"]
    assert "camera=()" in perms
    assert "microphone=()" in perms
    assert "geolocation=(self)" in perms


@pytest.mark.anyio
async def test_hsts_added_in_production():
    """HSTS must NOT be present outside production — but in production it
    must be. We toggle the module-level flag the middleware reads."""
    import server  # noqa: WPS433

    # Save and restore the flag so other tests in the session are not affected.
    original = server._IS_PRODUCTION
    try:
        server._IS_PRODUCTION = True
        middleware = server.security_headers_middleware

        class _Resp:
            def __init__(self):
                self.headers: dict[str, str] = {}

        async def _call_next(_req):
            return _Resp()

        resp = await middleware(None, _call_next)
        hsts = resp.headers.get("Strict-Transport-Security", "")
        assert "max-age=" in hsts
        assert "includeSubDomains" in hsts
    finally:
        server._IS_PRODUCTION = original


@pytest.mark.anyio
async def test_existing_headers_are_not_overridden():
    """An endpoint that already sets a custom value (for example a
    different CSP for an HTML preview route) must keep it. The middleware
    uses ``setdefault`` precisely so a route can opt out of the API-wide
    policy."""
    middleware = _get_middleware_callable()

    class _Resp:
        def __init__(self):
            self.headers: dict[str, str] = {
                "Content-Security-Policy": "default-src 'self'",
                "X-Frame-Options": "SAMEORIGIN",
            }

    async def _call_next(_req):
        return _Resp()

    resp = await middleware(None, _call_next)
    assert resp.headers["Content-Security-Policy"] == "default-src 'self'"
    assert resp.headers["X-Frame-Options"] == "SAMEORIGIN"
