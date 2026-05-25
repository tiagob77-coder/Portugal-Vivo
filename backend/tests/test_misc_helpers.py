"""Pure-function tests for a cluster of small helpers spread across modules:

  - heritage_api.resolve_categories            v18 → v19 category alias map
  - route_sharing_api._generate_share_code     8-char URL-safe random code
  - marine_biodiversity_api._current_season    UTC month → season string
  - marine_biodiversity_api._serialize         Mongo doc → API-shaped doc
  - infrastructure_api._serialize              same shape, separate module

Bundling these into one file because each surface alone is too small for
a dedicated suite, but together they cover four routers."""
import datetime as dt
import re
import string
from unittest.mock import patch

import pytest

import marine_biodiversity_api
from heritage_api import CATEGORY_ALIASES, resolve_categories
from infrastructure_api import _serialize as _infra_serialize
from marine_biodiversity_api import _current_season
from marine_biodiversity_api import _serialize as _marine_serialize
from route_sharing_api import _generate_share_code


# ── heritage_api.resolve_categories ──────────────────────────────────────────

def test_resolve_categories_passes_through_unknown():
    # Unmapped IDs are returned unchanged.
    out = resolve_categories(["museus", "castelos"])
    assert set(out) == {"museus", "castelos"}


def test_resolve_categories_maps_known_aliases():
    out = resolve_categories(["fauna", "areas_protegidas"])
    assert set(out) == {"fauna_autoctone", "aventura_natureza"}


def test_resolve_categories_strips_whitespace():
    out = resolve_categories(["  fauna  ", " museus "])
    assert set(out) == {"fauna_autoctone", "museus"}


def test_resolve_categories_dedupes():
    # Two aliases that map to the same target must collapse to one.
    # "areas_protegidas" → "aventura_natureza"
    # "aventura"         → "aventura_natureza"
    # "baloicos"         → "aventura_natureza"
    out = resolve_categories(["areas_protegidas", "aventura", "baloicos"])
    assert out == ["aventura_natureza"]


def test_resolve_categories_empty_list_returns_empty():
    assert resolve_categories([]) == []


def test_resolve_categories_mixed_known_and_unknown():
    out = resolve_categories(["fauna", "unknown_cat"])
    assert set(out) == {"fauna_autoctone", "unknown_cat"}


def test_category_aliases_map_has_no_self_loops():
    # An alias mapping a key to itself would be silently no-op — useless.
    # Pin so a future addition doesn't introduce one.
    for src, dst in CATEGORY_ALIASES.items():
        assert src != dst, f"self-loop alias for {src}"


def test_category_aliases_map_targets_are_strings():
    # Defends against accidentally setting a list/None target.
    for src, dst in CATEGORY_ALIASES.items():
        assert isinstance(dst, str) and dst, f"bad target for {src}: {dst!r}"


# ── route_sharing_api._generate_share_code ───────────────────────────────────

def test_share_code_length_is_8():
    assert len(_generate_share_code()) == 8


def test_share_code_is_url_safe_alphabet():
    # secrets.token_urlsafe uses base64url alphabet — A-Z, a-z, 0-9, -, _.
    code = _generate_share_code()
    allowed = set(string.ascii_letters + string.digits + "-_")
    assert all(c in allowed for c in code), code


def test_share_code_two_calls_are_different():
    # Random — collision probability for 8 chars of base64 (~64**8 = 2.8e14)
    # is effectively zero across two calls.
    assert _generate_share_code() != _generate_share_code()


def test_share_code_distribution_no_obvious_constant():
    # Generate a batch; assert at least 90 % of codes are unique
    # (a regression that returned a constant would yield 1 unique code).
    batch = {_generate_share_code() for _ in range(200)}
    assert len(batch) >= 180


def test_share_code_returns_a_string():
    assert isinstance(_generate_share_code(), str)


# ── marine_biodiversity_api._current_season ─────────────────────────────────

def _datetime_in_month(month: int) -> dt.datetime:
    return dt.datetime(2026, month, 15, 12, 0, tzinfo=dt.timezone.utc)


@pytest.mark.parametrize("month,expected", [
    (12, "winter"), (1, "winter"), (2, "winter"),
    (3, "spring"),  (4, "spring"),  (5, "spring"),
    (6, "summer"),  (7, "summer"),  (8, "summer"),
    (9, "autumn"),  (10, "autumn"), (11, "autumn"),
])
def test_current_season_for_every_month(month, expected):
    with patch.object(marine_biodiversity_api, "datetime") as mock_dt:
        mock_dt.now.return_value = _datetime_in_month(month)
        mock_dt.timezone = dt.timezone  # preserve the timezone reference
        assert _current_season() == expected


# ── _serialize (both modules) ────────────────────────────────────────────────

@pytest.mark.parametrize("serialize", [_marine_serialize, _infra_serialize])
class TestSerializeShared:
    """Same shape contract in both modules — parametrise to cover both."""

    def test_serialize_pops_mongo_id_into_id(self, serialize):
        out = serialize({"_id": "abc123", "name": "X"})
        assert out["id"] == "abc123"
        assert "_id" not in out

    def test_serialize_uses_existing_id_when_no_mongo_id(self, serialize):
        out = serialize({"id": "existing", "name": "X"})
        assert out["id"] == "existing"

    def test_serialize_empty_string_when_no_id_at_all(self, serialize):
        out = serialize({"name": "X"})
        assert out["id"] == ""

    def test_serialize_mongo_id_wins_when_both_present(self, serialize):
        # _id is popped first; pop's default falls back to .get("id") only
        # when _id is absent. With both present, _id wins.
        out = serialize({"_id": "from_mongo", "id": "from_existing"})
        assert out["id"] == "from_mongo"

    def test_serialize_coerces_object_id_to_string(self, serialize):
        # ObjectId-like values (any non-str) get str()'d.
        class _Fake:
            def __str__(self):
                return "ObjectId(xyz)"
        out = serialize({"_id": _Fake()})
        assert out["id"] == "ObjectId(xyz)"

    def test_serialize_returns_new_dict_not_mutate(self, serialize):
        original = {"_id": "x", "name": "Y"}
        out = serialize(original)
        # Original dict should still have _id (mutation would break callers
        # that pass the same dict around).
        assert "_id" in original
        assert out is not original

    def test_serialize_preserves_other_fields(self, serialize):
        out = serialize({"_id": "x", "name": "Y", "tags": ["a", "b"]})
        assert out["name"] == "Y"
        assert out["tags"] == ["a", "b"]
