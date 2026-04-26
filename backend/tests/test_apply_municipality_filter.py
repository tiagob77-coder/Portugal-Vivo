"""
Unit tests for ``shared_utils.apply_municipality_filter``.

Pure-function tests — no DB, no FastAPI client. The helper is the
foundation for the multi-tenant rollout (Fase 5 PR #120) so we lock
its semantics here:

  · anonymous (user is None)        → query unchanged
  · admin (is_admin=True)            → query unchanged
  · tenant user with municipality_id → query gains "municipality_id" key
  · pre-existing key (e.g. header)   → never overridden
"""
from types import SimpleNamespace

from shared_utils import apply_municipality_filter


def _user(municipality_id=None, is_admin=False):
    """Compact User-shaped object — Pydantic round-trip not required for the helper."""
    return SimpleNamespace(municipality_id=municipality_id, is_admin=is_admin)


def test_anonymous_returns_query_unchanged():
    q = {"category": "praia"}
    out = apply_municipality_filter(q, None)
    assert out == {"category": "praia"}
    assert "municipality_id" not in out


def test_admin_user_does_not_get_filtered():
    """Global admins see everything — no implicit tenant clamp."""
    q = {"category": "praia"}
    apply_municipality_filter(q, _user(municipality_id="lisboa", is_admin=True))
    assert "municipality_id" not in q


def test_tenant_user_adds_municipality_id():
    q = {"category": "praia"}
    apply_municipality_filter(q, _user(municipality_id="porto"))
    assert q == {"category": "praia", "municipality_id": "porto"}


def test_user_without_municipality_id_is_a_noop():
    """An authenticated user with no tenant scope (e.g. legacy users) shouldn't
    fall into a fictitious empty-string filter."""
    q = {"category": "praia"}
    apply_municipality_filter(q, _user(municipality_id=None))
    assert q == {"category": "praia"}


def test_existing_municipality_id_is_not_overridden():
    """An explicit X-Municipality-Id header (set by TenantMiddleware before us)
    or a query-param override must win."""
    q = {"category": "praia", "municipality_id": "lisboa"}
    apply_municipality_filter(q, _user(municipality_id="porto"))
    assert q["municipality_id"] == "lisboa"  # not "porto"


def test_returns_same_dict_instance():
    """Helper mutates and returns the same object — callers compose it inline."""
    q = {"x": 1}
    out = apply_municipality_filter(q, _user(municipality_id="aveiro"))
    assert out is q
