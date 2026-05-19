"""
Tests for the CAOP enrichment hook in import_excel_real.

We don't exercise the full importer (it needs an Excel + Mongo) — we
verify that:

  1. The module wires up `_enrich_poi` from geo_validator when the
     optional chain imports cleanly.
  2. The DISABLE_CAOP_ENRICH env var turns the hook off.
  3. `enrich_poi()` itself is robust when the CAOP lookup is not yet
     loaded: it leaves the POI unchanged instead of crashing.

This catches the regression where a future refactor flips the
"best-effort, do not block import" contract into a hard dependency.
"""
from __future__ import annotations

import importlib
import os

import pytest


def _reload_importer(env: dict[str, str]) -> object:
    """Reimport import_excel_real with a specific env, so the optional
    chain at module top is re-evaluated."""
    for k, v in env.items():
        os.environ[k] = v
    # Required by the rest of the module's imports:
    os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
    os.environ.setdefault("DB_NAME", "t")
    os.environ.setdefault("JWT_SECRET_KEY", "x" * 64)

    import sys as _sys
    _sys.modules.pop("import_excel_real", None)
    return importlib.import_module("import_excel_real")


def test_enrich_hook_is_wired_by_default():
    """Fresh import (no DISABLE_CAOP_ENRICH) → hook wired up."""
    os.environ.pop("DISABLE_CAOP_ENRICH", None)
    mod = _reload_importer({})
    assert mod._CAOP_ENRICH is True
    assert callable(mod._enrich_poi)


def test_disable_env_turns_hook_off():
    """Set DISABLE_CAOP_ENRICH=1 → hook flag flips to False even though
    the function reference is still wired (so a future runtime toggle
    is possible without touching imports)."""
    mod = _reload_importer({"DISABLE_CAOP_ENRICH": "1"})
    assert mod._CAOP_ENRICH is False
    # Cleanup so other tests in this session start fresh
    os.environ.pop("DISABLE_CAOP_ENRICH", None)


def test_flag_is_read_after_dotenv_loads(tmp_path, monkeypatch):
    """Regression for the Codex P2 finding on PR #166: the flag must be
    evaluated *after* load_dotenv runs, so a DISABLE_CAOP_ENRICH=1 line in
    backend/.env is actually honoured. We simulate that by pointing the
    importer's .env path at a tmp file and reloading the module."""
    fake_env = tmp_path / ".env"
    fake_env.write_text("DISABLE_CAOP_ENRICH=1\n")

    # Make absolutely sure the parent shell does NOT pre-set the flag —
    # otherwise we wouldn't be testing the dotenv path.
    monkeypatch.delenv("DISABLE_CAOP_ENRICH", raising=False)
    os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
    os.environ.setdefault("DB_NAME", "t")
    os.environ.setdefault("JWT_SECRET_KEY", "x" * 64)

    # Patch load_dotenv to load *our* file regardless of what path the
    # importer passes — that proves the ordering, not the path.
    import sys as _sys
    import dotenv as _dotenv

    real_load_dotenv = _dotenv.load_dotenv

    def fake_load_dotenv(_path=None, **_kw):
        return real_load_dotenv(fake_env, override=True)

    monkeypatch.setattr(_dotenv, "load_dotenv", fake_load_dotenv)
    _sys.modules.pop("import_excel_real", None)
    mod = importlib.import_module("import_excel_real")

    assert mod._CAOP_ENRICH is False, (
        "Hook flag must be False because backend/.env set "
        "DISABLE_CAOP_ENRICH=1 — if this is True, the flag is being read "
        "before load_dotenv runs and the documented toggle is broken."
    )
    os.environ.pop("DISABLE_CAOP_ENRICH", None)


def test_enrich_poi_is_noop_when_caop_not_loaded():
    """The enrichment must not raise when CAOP data has not been ingested
    (lookup.is_ready is False). The POI is returned unchanged so the
    importer can keep going.
    """
    from geo_validator import enrich_poi
    from services.caop_lookup import lookup
    assert not lookup.is_ready, (
        "CAOP lookup was already loaded by another test — that means our "
        "fallback path is no longer exercised"
    )

    item = {
        "id": "poi_test",
        "name": "Sé do Funchal",
        "location": {"lat": 32.6469, "lng": -16.9088},  # Madeira
    }
    out = enrich_poi(item)
    # The helper mutates + returns the same dict. Status `skipped` means
    # CAOP wasn't loaded; the importer should still get a clean dict.
    assert out is item
    # caop_validated should NOT be set when lookup is not ready.
    assert out.get("caop_validated") is not True
    # Location preserved.
    assert out["location"] == {"lat": 32.6469, "lng": -16.9088}


def test_enrich_poi_missing_location_is_noop():
    """No location → enrich_poi returns early (the importer already
    skipped this row, but the helper must be defensive)."""
    from geo_validator import enrich_poi
    item = {"id": "poi_no_gps", "name": "Sem GPS"}
    out = enrich_poi(item)
    assert out is item
    assert "freguesia_code" not in out
    assert "caop_validated" not in out


def test_enrich_poi_geojson_coords_supported():
    """The helper accepts {"coordinates": [lng, lat]} in addition to
    {"lat": ..., "lng": ...} — needed for documents that already use
    the GeoJSON Point shape."""
    from geo_validator import enrich_poi
    item = {
        "id": "poi_geojson",
        "name": "GeoJSON-form",
        "location": {"coordinates": [-9.1393, 38.7223]},  # lng, lat
    }
    out = enrich_poi(item)
    # No crash; location preserved.
    assert out is item
    assert out["location"]["coordinates"] == [-9.1393, 38.7223]
