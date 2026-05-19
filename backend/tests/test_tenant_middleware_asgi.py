"""
Tests for the ASGI `TenantMiddleware` in tenant_middleware.

Spins up a tiny Starlette app, mounts the middleware in both modes
(passthrough and `require_tenant=True`), and asserts the request state
gets the right values. No FastAPI, no Mongo, no auth — pure middleware
contract.
"""
from __future__ import annotations

import httpx
import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from tenant_middleware import TenantMiddleware


def _build_app(*, require_tenant: bool) -> Starlette:
    """Tiny app that echoes the tenant headers the middleware copied
    onto request.state."""
    async def echo(request: Request) -> JSONResponse:
        return JSONResponse({
            "tenant_id": request.state.tenant_id,
            "municipality_id": request.state.municipality_id,
        })

    app = Starlette(routes=[Route("/echo", echo)])
    app.add_middleware(TenantMiddleware, require_tenant=require_tenant)
    return app


@pytest.fixture
def passthrough_client() -> httpx.AsyncClient:
    app = _build_app(require_tenant=False)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")


@pytest.fixture
def strict_client() -> httpx.AsyncClient:
    app = _build_app(require_tenant=True)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t")


# ---------------------------------------------------------------------------
# passthrough (default)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_passthrough_with_no_headers(passthrough_client):
    async with passthrough_client as c:
        resp = await c.get("/echo")
    assert resp.status_code == 200
    # The middleware attaches None defaults so downstream code never
    # crashes on `request.state.tenant_id` lookup.
    assert resp.json() == {"tenant_id": None, "municipality_id": None}


@pytest.mark.anyio
async def test_passthrough_copies_tenant_header(passthrough_client):
    async with passthrough_client as c:
        resp = await c.get("/echo", headers={"X-Tenant-Id": "lisboa-01"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["tenant_id"] == "lisboa-01"
    assert body["municipality_id"] is None


@pytest.mark.anyio
async def test_passthrough_copies_municipality_header(passthrough_client):
    async with passthrough_client as c:
        resp = await c.get("/echo", headers={"X-Municipality-Id": "evora-05"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["municipality_id"] == "evora-05"


@pytest.mark.anyio
async def test_passthrough_copies_both_headers(passthrough_client):
    async with passthrough_client as c:
        resp = await c.get(
            "/echo",
            headers={"X-Tenant-Id": "porto-02", "X-Municipality-Id": "porto"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"tenant_id": "porto-02", "municipality_id": "porto"}


@pytest.mark.anyio
async def test_passthrough_header_lookup_is_case_insensitive(passthrough_client):
    """HTTP headers are case-insensitive — Starlette normalises them, but
    pinning the behaviour here catches a regression if the middleware
    ever switches to a case-sensitive lookup."""
    async with passthrough_client as c:
        resp = await c.get("/echo", headers={"x-tenant-id": "braga-03"})
    assert resp.json()["tenant_id"] == "braga-03"


# ---------------------------------------------------------------------------
# require_tenant=True
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_strict_rejects_missing_tenant(strict_client):
    async with strict_client as c:
        resp = await c.get("/echo")
    assert resp.status_code == 400
    body = resp.json()
    assert "X-Tenant-Id" in body["detail"]


@pytest.mark.anyio
async def test_strict_passes_with_tenant(strict_client):
    async with strict_client as c:
        resp = await c.get("/echo", headers={"X-Tenant-Id": "lisboa-01"})
    assert resp.status_code == 200
    assert resp.json()["tenant_id"] == "lisboa-01"


@pytest.mark.anyio
async def test_strict_does_not_require_municipality(strict_client):
    """`require_tenant=True` only enforces the tenant header — the
    municipality header is optional."""
    async with strict_client as c:
        resp = await c.get("/echo", headers={"X-Tenant-Id": "lisboa-01"})
    assert resp.status_code == 200
    assert resp.json()["municipality_id"] is None
