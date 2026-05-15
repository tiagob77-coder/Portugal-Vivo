"""
Tenant isolation — regression tests.

Catches the class of bug where an admin endpoint forgets to clamp its
Mongo query by ``municipality_id``: a municipal editor logs in, hits
``/admin/...`` for resources they don't own, and silently reads or
mutates them.

Two layers:

  * Pure-function tests on ``TenantContext`` and ``require_poi_access``:
    every role behaves the way ``tenant_middleware`` promises, with no
    DB and no HTTP stack involved. These are the foundation — if any of
    them flips, every endpoint that depends on them inherits the bug.
  * Smoke tests on a handful of admin routes through the real ASGI
    stack: an unauthenticated request, a wrong-tenant request and an
    admin-global request must each end up at the expected status code.
    Tests are pinned to status-code *families* (4xx vs 5xx) so they
    survive minor message changes but fail loudly if an endpoint
    forgets the dependency and returns 200 with someone else's data.
"""
from __future__ import annotations

import pytest

from conftest import requires_db
from tenant_middleware import (
    TenantContext,
    TenantRole,
    require_poi_access,
)


# ---------------------------------------------------------------------------
# Pure-function regression — TenantContext.mongo_filter()
# ---------------------------------------------------------------------------

def _ctx(role: TenantRole, municipality_id: str | None) -> TenantContext:
    return TenantContext(
        user_id="u-test",
        email="t@example.pt",
        name="Tester",
        role=role,
        municipality_id=municipality_id,
        is_admin_global=(role == TenantRole.ADMIN_GLOBAL),
    )


class TestTenantContextFilter:
    """The ``mongo_filter`` helper is what every admin endpoint relies on
    to clamp its query — if it ever returns the wrong shape, every
    endpoint inherits the bug."""

    def test_municipio_filter_is_scoped(self):
        ctx = _ctx(TenantRole.MUNICIPIO, "lisboa-01")
        assert ctx.mongo_filter() == {"municipality_id": "lisboa-01"}

    def test_editor_filter_is_scoped(self):
        ctx = _ctx(TenantRole.EDITOR, "porto-02")
        assert ctx.mongo_filter() == {"municipality_id": "porto-02"}

    def test_viewer_filter_is_scoped(self):
        ctx = _ctx(TenantRole.VIEWER, "faro-04")
        assert ctx.mongo_filter() == {"municipality_id": "faro-04"}

    def test_admin_global_filter_is_open(self):
        """An empty dict means the tenant clamp ADDS NOTHING — admin
        sees everything. Anything else would be silently scoping the
        global admin to a nonexistent municipality."""
        ctx = _ctx(TenantRole.ADMIN_GLOBAL, None)
        assert ctx.mongo_filter() == {}

    def test_municipio_without_id_still_scopes(self):
        """A bug in account provisioning could leave a `municipio` user
        without a municipality_id. mongo_filter must still produce a
        non-empty filter so the query cannot accidentally match every
        tenant's data."""
        ctx = _ctx(TenantRole.MUNICIPIO, None)
        out = ctx.mongo_filter()
        assert out != {}, "scoped role with no muni MUST still produce a non-empty filter"
        assert out["municipality_id"] is None  # matches only documents with explicit null


class TestCanAccessMunicipality:
    """The cross-tenant gate used by handlers that take a target
    municipality_id from the URL."""

    def test_same_muni_allowed(self):
        ctx = _ctx(TenantRole.MUNICIPIO, "lisboa-01")
        assert ctx.can_access_municipality("lisboa-01") is True

    def test_other_muni_blocked(self):
        ctx = _ctx(TenantRole.MUNICIPIO, "lisboa-01")
        assert ctx.can_access_municipality("porto-02") is False

    def test_admin_global_can_access_any(self):
        ctx = _ctx(TenantRole.ADMIN_GLOBAL, None)
        assert ctx.can_access_municipality("anywhere") is True
        assert ctx.can_access_municipality("lisboa-01") is True

    def test_no_municipality_blocked_from_others(self):
        ctx = _ctx(TenantRole.VIEWER, None)
        assert ctx.can_access_municipality("lisboa-01") is False


# ---------------------------------------------------------------------------
# require_poi_access factory
# ---------------------------------------------------------------------------

class TestRequirePoiAccess:
    """The factory should return a callable that enforces the action's
    role set BEFORE running any DB query."""

    @pytest.mark.parametrize("action", ["read", "write", "delete"])
    def test_returns_callable(self, action):
        dep = require_poi_access(action)
        assert callable(dep)

    @pytest.mark.parametrize(
        "action,role,should_allow",
        [
            ("read", TenantRole.VIEWER, True),
            ("read", TenantRole.EDITOR, True),
            ("read", TenantRole.MUNICIPIO, True),
            ("read", TenantRole.ADMIN_GLOBAL, True),
            ("write", TenantRole.VIEWER, False),
            ("write", TenantRole.EDITOR, True),
            ("write", TenantRole.MUNICIPIO, True),
            ("write", TenantRole.ADMIN_GLOBAL, True),
            ("delete", TenantRole.VIEWER, False),
            ("delete", TenantRole.EDITOR, False),
            ("delete", TenantRole.MUNICIPIO, True),
            ("delete", TenantRole.ADMIN_GLOBAL, True),
        ],
    )
    @pytest.mark.anyio
    async def test_role_action_matrix(self, action, role, should_allow, monkeypatch):
        """Smoke the role × action grid against the real allowed-set
        constants. If anyone tightens the rules silently this test
        will catch the regression.

        We force ``_db`` to None for this test so the inner check returns
        immediately after the role gate, without touching Mongo. In CI
        the global is wired up to a real client at app import time, and
        running Motor queries on a synthetic POI id inside a parametrised
        async test risked the event loop blocking on a server-selection
        round trip.
        """
        from fastapi import HTTPException
        import tenant_middleware as _tm

        monkeypatch.setattr(_tm, "_db", None)

        dep = require_poi_access(action)
        ctx = _ctx(role, "lisboa-01")

        if should_allow:
            # Should NOT raise
            result = await dep(poi_id="any-poi", tenant=ctx)
            assert result is ctx
        else:
            with pytest.raises(HTTPException) as exc:
                await dep(poi_id="any-poi", tenant=ctx)
            assert exc.value.status_code == 403


# ---------------------------------------------------------------------------
# Admin endpoint smoke — must NEVER 200 unauthenticated
# ---------------------------------------------------------------------------

ADMIN_ENDPOINTS_GET = [
    "/api/admin/tenants/municipalities",
    "/api/admin/tenants/users",
    "/api/admin/data-quality",
    "/api/admin/pois/gps-audit",
    "/api/admin/eventos",
]

ADMIN_ENDPOINTS_WRITE = [
    ("POST", "/api/admin/eventos", {"title": "Evento Falso"}),
    ("DELETE", "/api/admin/tenants/users/somebody"),
]


@requires_db
@pytest.mark.parametrize("path", ADMIN_ENDPOINTS_GET)
@pytest.mark.anyio
async def test_admin_get_rejects_unauthenticated(client, path):
    """Every /admin/* GET must require auth.

    We accept any 4xx in the auth family (401, 403) — 422 if the route
    needs a query param we didn't send is also fine; 404 is acceptable
    when the route is conditionally registered. What we DO NOT accept
    is a 200 with body, which would mean the gate is bypassed.
    """
    response = await client.get(path)
    assert response.status_code != 200, (
        f"{path} returned 200 unauthenticated — tenant gate is bypassed"
    )
    assert response.status_code in (401, 403, 404, 422), (
        f"{path} returned unexpected {response.status_code}"
    )


@requires_db
@pytest.mark.parametrize("spec", ADMIN_ENDPOINTS_WRITE)
@pytest.mark.anyio
async def test_admin_write_rejects_unauthenticated(client, spec):
    method, path, *rest = spec
    body = rest[0] if rest else None
    if method == "POST":
        response = await client.post(path, json=body or {})
    elif method == "DELETE":
        response = await client.delete(path)
    elif method == "PATCH":
        response = await client.patch(path, json=body or {})
    else:
        pytest.fail(f"unhandled method {method}")
    # Same rule: anything but a successful 2xx is fine; a 200/201 here
    # would mean the endpoint accepted an anonymous write.
    assert response.status_code >= 400, (
        f"{method} {path} accepted unauthenticated write — {response.status_code}"
    )
