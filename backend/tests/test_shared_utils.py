"""
Pure-function tests for ``shared_utils``.

``apply_municipality_filter`` already has its own dedicated test file —
this one pins everything else so the module stops being a "trust me"
helper for the dozens of routers that depend on it.
"""
from __future__ import annotations

import math
import pytest
from fastapi import HTTPException

from shared_utils import (
    DatabaseHolder,
    clamp_pagination,
    haversine_km,
    haversine_meters,
)


# ---------------------------------------------------------------------------
# Haversine
# ---------------------------------------------------------------------------

class TestHaversine:
    def test_same_point_is_zero(self):
        assert haversine_km(38.7223, -9.1393, 38.7223, -9.1393) == pytest.approx(0.0, abs=1e-6)

    def test_lisboa_porto_known_distance(self):
        # Lisboa (Marquês) → Porto (Centro). The straight-line distance is
        # ~270 km; we accept ±5 km because the Haversine formula assumes a
        # perfect sphere.
        d = haversine_km(38.7223, -9.1393, 41.1496, -8.6109)
        assert 265.0 < d < 280.0

    def test_meters_is_km_times_1000(self):
        km = haversine_km(40.0, -8.0, 41.0, -8.0)
        m = haversine_meters(40.0, -8.0, 41.0, -8.0)
        assert m == pytest.approx(km * 1000, rel=1e-9)

    def test_symmetric(self):
        a = haversine_km(38.7, -9.1, 41.1, -8.6)
        b = haversine_km(41.1, -8.6, 38.7, -9.1)
        assert a == pytest.approx(b, abs=1e-9)

    def test_one_degree_latitude_is_about_111_km(self):
        d = haversine_km(38.0, -9.0, 39.0, -9.0)
        # A degree of latitude is ~111.2 km on a perfect sphere.
        assert 110.0 < d < 112.0


# ---------------------------------------------------------------------------
# clamp_pagination
# ---------------------------------------------------------------------------

class TestClampPagination:
    def test_normal_values_passthrough(self):
        assert clamp_pagination(20, 50) == (20, 50)

    def test_negative_skip_clamped_to_zero(self):
        assert clamp_pagination(-10, 50) == (0, 50)

    def test_zero_limit_clamped_to_one(self):
        """A limit of zero would return an empty page and likely confuse
        the consumer — minimum is 1."""
        assert clamp_pagination(0, 0) == (0, 1)

    def test_negative_limit_clamped(self):
        assert clamp_pagination(0, -5) == (0, 1)

    def test_overlimit_clamped_to_max(self):
        assert clamp_pagination(0, 10_000) == (0, 2000)

    def test_custom_max_limit(self):
        assert clamp_pagination(0, 10_000, max_limit=100) == (0, 100)


# ---------------------------------------------------------------------------
# DatabaseHolder
# ---------------------------------------------------------------------------

class TestDatabaseHolder:
    def test_uninitialised_get_raises_500(self):
        h = DatabaseHolder("test-mod")
        with pytest.raises(HTTPException) as exc:
            h.get()
        assert exc.value.status_code == 500
        assert "test-mod" in exc.value.detail

    def test_db_property_raises_when_uninitialised(self):
        h = DatabaseHolder()
        with pytest.raises(HTTPException):
            _ = h.db

    def test_set_then_get(self):
        h = DatabaseHolder()
        sentinel = object()
        h.set(sentinel)
        assert h.get() is sentinel
        assert h.db is sentinel

    def test_set_twice_overrides(self):
        h = DatabaseHolder()
        h.set("first")
        h.set("second")
        assert h.db == "second"
