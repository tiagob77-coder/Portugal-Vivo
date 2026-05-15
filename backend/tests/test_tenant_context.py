"""
Pure-function tests for ``tenant_context``.

The module is small but every async task in the request chain reads
``get_current_tenant()`` — if any of these helpers regresses, requests
silently get the wrong tenant or the right tenant gets the wrong
database.
"""
from __future__ import annotations

import pytest

from tenant_context import (
    TenantContext,
    clear_current_tenant,
    get_current_tenant,
    set_current_tenant,
)


@pytest.fixture(autouse=True)
def _reset_context():
    """Each test starts with a clean ContextVar; otherwise leaks between
    tests would mask real regressions."""
    clear_current_tenant()
    yield
    clear_current_tenant()


class TestGetSetClear:
    def test_default_is_none(self):
        assert get_current_tenant() is None

    def test_set_then_get(self):
        set_current_tenant("lisboa-01")
        assert get_current_tenant() == "lisboa-01"

    def test_clear_resets_to_none(self):
        set_current_tenant("porto-02")
        clear_current_tenant()
        assert get_current_tenant() is None

    def test_set_overrides_previous(self):
        set_current_tenant("first")
        set_current_tenant("second")
        assert get_current_tenant() == "second"


class TestContextManager:
    def test_with_block_scopes_the_tenant(self):
        assert get_current_tenant() is None
        with TenantContext("aveiro-09"):
            assert get_current_tenant() == "aveiro-09"
        # Restored on exit:
        assert get_current_tenant() is None

    def test_nested_with_blocks(self):
        with TenantContext("outer"):
            assert get_current_tenant() == "outer"
            with TenantContext("inner"):
                assert get_current_tenant() == "inner"
            assert get_current_tenant() == "outer"
        assert get_current_tenant() is None

    def test_exception_inside_block_still_resets(self):
        with pytest.raises(RuntimeError):
            with TenantContext("braga-03"):
                assert get_current_tenant() == "braga-03"
                raise RuntimeError("boom")
        assert get_current_tenant() is None
