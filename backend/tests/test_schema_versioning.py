"""
Tests for schema_versioning — runs against mongomock so there is no real
Mongo dependency. Covers the registry, the two existing migrations, and
the idempotency contract of ``run_migrations``.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

# mongomock-motor is optional; skip cleanly when it is not installed.
mongomock_motor = pytest.importorskip("mongomock_motor")

from schema_versioning import (
    MIGRATIONS,
    SCHEMA_VERSION,
    _migrate_v1,
    _migrate_v2,
    _record_version,
    get_current_version,
    run_migrations,
)


@pytest.fixture
async def db():
    client = mongomock_motor.AsyncMongoMockClient()
    yield client["pv_test"]


# ---------------------------------------------------------------------------
# Registry sanity
# ---------------------------------------------------------------------------

class TestRegistry:
    def test_schema_version_matches_registry(self):
        """SCHEMA_VERSION is the constant code reads to know "where we
        want to be". Every migration in MIGRATIONS must have a slot up
        to that number — otherwise run_migrations would silently skip
        steps."""
        assert SCHEMA_VERSION == max(MIGRATIONS.keys())
        for v in range(1, SCHEMA_VERSION + 1):
            assert v in MIGRATIONS, f"missing migration v{v}"

    def test_migration_entries_have_description(self):
        for v, (func, desc) in MIGRATIONS.items():
            assert callable(func), f"v{v} migration is not callable"
            assert isinstance(desc, str) and desc, f"v{v} description empty"


# ---------------------------------------------------------------------------
# get_current_version + _record_version
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_get_current_version_empty(db):
    """Fresh DB → version 0. Crucial: returning anything else would skip
    migrations forever."""
    assert await get_current_version(db) == 0


@pytest.mark.anyio
async def test_record_then_read(db):
    await _record_version(db, 1, "first migration")
    await _record_version(db, 2, "second migration")
    # Highest wins (sorted by version desc inside get_current_version).
    assert await get_current_version(db) == 2


@pytest.mark.anyio
async def test_record_persists_metadata(db):
    await _record_version(db, 7, "lucky")
    row = await db.schema_versions.find_one({"version": 7})
    assert row is not None
    assert row["description"] == "lucky"
    assert isinstance(row["applied_at"], datetime)


# ---------------------------------------------------------------------------
# _migrate_v1 — backfill geo_location from location.{lat,lng}
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_v1_adds_geo_location(db):
    await db.heritage_items.insert_many([
        {"id": "p1", "location": {"lat": 38.7, "lng": -9.1}},
        {"id": "p2", "location": {"lat": 41.1, "lng": -8.6}},
    ])
    await _migrate_v1(db)
    p1 = await db.heritage_items.find_one({"id": "p1"})
    assert p1["geo_location"] == {"type": "Point", "coordinates": [-9.1, 38.7]}


@pytest.mark.anyio
async def test_v1_skips_existing_geo_location(db):
    await db.heritage_items.insert_one({
        "id": "p1",
        "location": {"lat": 38.7, "lng": -9.1},
        "geo_location": {"type": "Point", "coordinates": [0, 0]},  # garbage
    })
    await _migrate_v1(db)
    # Garbage NOT overwritten — migration only fills the gap.
    p1 = await db.heritage_items.find_one({"id": "p1"})
    assert p1["geo_location"] == {"type": "Point", "coordinates": [0, 0]}


@pytest.mark.anyio
async def test_v1_skips_when_location_missing(db):
    await db.heritage_items.insert_one({"id": "p1"})
    await _migrate_v1(db)
    p1 = await db.heritage_items.find_one({"id": "p1"})
    assert "geo_location" not in p1


@pytest.mark.anyio
async def test_v1_skips_when_lat_or_lng_none(db):
    await db.heritage_items.insert_one({
        "id": "p1",
        "location": {"lat": None, "lng": -9.1},
    })
    await _migrate_v1(db)
    p1 = await db.heritage_items.find_one({"id": "p1"})
    assert "geo_location" not in p1


# ---------------------------------------------------------------------------
# _migrate_v2 — created_at string → datetime in users
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_v2_parses_iso_string(db):
    await db.users.insert_one({"user_id": "u1", "created_at": "2026-01-15T10:30:00Z"})
    await _migrate_v2(db)
    u1 = await db.users.find_one({"user_id": "u1"})
    assert isinstance(u1["created_at"], datetime)
    assert u1["created_at"].year == 2026
    # mongomock collapses tzinfo on insert, so we cannot assert
    # `.tzinfo is not None` on the round-tripped value. We do assert
    # the wall-clock components match what we parsed.
    assert u1["created_at"].month == 1
    assert u1["created_at"].day == 15
    assert u1["created_at"].hour == 10


@pytest.mark.anyio
async def test_v2_skips_malformed_string(db):
    """A garbage value should NOT crash the migration — it stays as a
    string and the rest of the collection still migrates."""
    await db.users.insert_many([
        {"user_id": "u1", "created_at": "not a date"},
        {"user_id": "u2", "created_at": "2026-01-15T10:30:00Z"},
    ])
    await _migrate_v2(db)
    u1 = await db.users.find_one({"user_id": "u1"})
    u2 = await db.users.find_one({"user_id": "u2"})
    assert u1["created_at"] == "not a date"     # untouched
    assert isinstance(u2["created_at"], datetime)


@pytest.mark.anyio
async def test_v2_leaves_already_datetime_alone(db):
    """Users with `created_at` already a datetime are filtered out by
    the `$type: string` selector. Verify they survive unchanged."""
    now = datetime.now(timezone.utc)
    await db.users.insert_one({"user_id": "u1", "created_at": now})
    await _migrate_v2(db)
    u1 = await db.users.find_one({"user_id": "u1"})
    # Comparing the datetime instances directly fails on mongomock
    # because it normalises tzinfo and microsecond precision on insert.
    # The contract we care about is: it stays a datetime, NOT a string.
    assert isinstance(u1["created_at"], datetime)


# ---------------------------------------------------------------------------
# run_migrations end-to-end
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_run_migrations_applies_pending(db):
    """Fresh DB → SCHEMA_VERSION migrations applied."""
    applied = await run_migrations(db)
    assert applied == SCHEMA_VERSION
    assert await get_current_version(db) == SCHEMA_VERSION


@pytest.mark.anyio
async def test_run_migrations_is_idempotent(db):
    await run_migrations(db)
    applied2 = await run_migrations(db)
    assert applied2 == 0
    assert await get_current_version(db) == SCHEMA_VERSION


@pytest.mark.anyio
async def test_run_migrations_picks_up_from_middle(db):
    """If v1 was already recorded, run_migrations starts at v2."""
    await _record_version(db, 1, "v1 (manually marked)")
    applied = await run_migrations(db)
    # Started at 1, target SCHEMA_VERSION → applied = SCHEMA_VERSION - 1
    assert applied == SCHEMA_VERSION - 1
    assert await get_current_version(db) == SCHEMA_VERSION
