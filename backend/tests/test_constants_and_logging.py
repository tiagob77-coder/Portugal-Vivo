"""
Cheap regression tests for constants, structured logging helpers and
shared Pydantic models.

These pin the surface that the rest of the codebase imports — if any of
the constant tables silently change shape, all the modules that depend
on them are at risk.
"""
from __future__ import annotations

import json
import logging
import pytest

import shared_constants
from shared_constants import (
    CATEGORIES,
    MAIN_CATEGORIES,
    REGIONS,
    SUBCATEGORIES,
    SUBCATEGORIES_BY_MAIN,
    sanitize_regex,
)


# ---------------------------------------------------------------------------
# sanitize_regex — used at every search endpoint, must never let metacharacters
# through.
# ---------------------------------------------------------------------------

class TestSanitizeRegex:
    @pytest.mark.parametrize(
        "raw,injection_attempt",
        [
            (".*", "anything"),
            ("(a|b)", "a"),
            ("[abc]", "b"),
            ("a+", "aaaaa"),
            ("\\d+", "12345"),
        ],
    )
    def test_metacharacters_lose_their_power(self, raw, injection_attempt):
        """Real regression: an attacker who types `.*` in a search box
        must NOT cause the escaped pattern to match arbitrary input."""
        import re as _re
        escaped = sanitize_regex(raw)
        # The escaped form is a literal match of the original characters —
        # it cannot still match a different string like ``injection_attempt``.
        assert _re.fullmatch(escaped, injection_attempt) is None
        assert _re.fullmatch(escaped, raw) is not None

    def test_empty_string_safe(self):
        assert sanitize_regex("") == ""

    def test_plain_text_passthrough(self):
        assert sanitize_regex("praia") == "praia"


# ---------------------------------------------------------------------------
# MAIN_CATEGORIES / CATEGORIES / REGIONS shape
# ---------------------------------------------------------------------------

class TestMainCategories:
    def test_count(self):
        # CLAUDE.md says 6 pillars — a regression here means the taxonomy
        # silently changed.
        assert len(MAIN_CATEGORIES) == 6

    def test_required_fields(self):
        required = {"id", "name", "icon", "color", "description", "poi_target"}
        for cat in MAIN_CATEGORIES:
            assert required.issubset(cat.keys()), f"missing fields in {cat.get('id')!r}"

    def test_unique_ids(self):
        ids = [c["id"] for c in MAIN_CATEGORIES]
        assert len(ids) == len(set(ids))

    def test_ids_are_snake_case(self):
        for cat in MAIN_CATEGORIES:
            assert " " not in cat["id"]
            assert cat["id"] == cat["id"].lower()


class TestSubcategories:
    def test_present(self):
        assert len(SUBCATEGORIES) > 0

    def test_each_subcategory_has_main(self):
        main_ids = {c["id"] for c in MAIN_CATEGORIES}
        for sub in SUBCATEGORIES:
            assert "main_category" in sub
            assert sub["main_category"] in main_ids, (
                f"subcategory {sub.get('id')!r} points at unknown main "
                f"{sub.get('main_category')!r}"
            )

    def test_subcategories_by_main_is_consistent(self):
        # The derived dict must agree with the source-of-truth list.
        for main_id, subs in SUBCATEGORIES_BY_MAIN.items():
            assert isinstance(subs, list)
            for s in subs:
                assert s["main_category"] == main_id


class TestRegions:
    def test_count(self):
        # 7 regions: Norte / Centro / Lisboa / Alentejo / Algarve / Açores / Madeira
        assert len(REGIONS) == 7

    def test_required_fields(self):
        for r in REGIONS:
            assert "id" in r and "name" in r


class TestCategoriesLegacy:
    def test_categories_present(self):
        assert len(CATEGORIES) > 0


# ---------------------------------------------------------------------------
# structured_logging — JSONFormatter, RequestIdFilter, DevFormatter
# ---------------------------------------------------------------------------

import structured_logging  # noqa: E402


class TestJSONFormatter:
    def test_basic_record(self):
        fmt = structured_logging.JSONFormatter()
        record = logging.LogRecord(
            name="t", level=logging.INFO, pathname=__file__, lineno=1,
            msg="hello %s", args=("world",), exc_info=None,
        )
        out = fmt.format(record)
        parsed = json.loads(out)
        assert parsed["level"] == "INFO"
        assert parsed["logger"] == "t"
        assert parsed["message"] == "hello world"
        assert "timestamp" in parsed

    def test_exception_is_serialised(self):
        fmt = structured_logging.JSONFormatter()
        try:
            raise ValueError("kaboom")
        except ValueError:
            import sys
            record = logging.LogRecord(
                name="t", level=logging.ERROR, pathname=__file__, lineno=1,
                msg="oops", args=(), exc_info=sys.exc_info(),
            )
        out = fmt.format(record)
        parsed = json.loads(out)
        assert parsed["exception"]["type"] == "ValueError"
        assert "kaboom" in parsed["exception"]["message"]

    def test_extras_propagated(self):
        fmt = structured_logging.JSONFormatter()
        record = logging.LogRecord(
            name="t", level=logging.INFO, pathname=__file__, lineno=1,
            msg="m", args=(), exc_info=None,
        )
        record.request_id = "req-abc"  # type: ignore[attr-defined]
        record.user_id = "u-1"  # type: ignore[attr-defined]
        record.status_code = 200  # type: ignore[attr-defined]
        parsed = json.loads(fmt.format(record))
        assert parsed["request_id"] == "req-abc"
        assert parsed["user_id"] == "u-1"
        assert parsed["status_code"] == 200


class TestRequestIdFilter:
    def test_inserts_context_id(self):
        token = structured_logging.request_id_ctx.set("req-xyz")
        try:
            flt = structured_logging.RequestIdFilter()
            record = logging.LogRecord(
                name="t", level=logging.INFO, pathname=__file__, lineno=1,
                msg="m", args=(), exc_info=None,
            )
            assert flt.filter(record) is True
            assert record.request_id == "req-xyz"  # type: ignore[attr-defined]
        finally:
            structured_logging.request_id_ctx.reset(token)

    def test_does_not_override_explicit_id(self):
        token = structured_logging.request_id_ctx.set("req-ctx")
        try:
            flt = structured_logging.RequestIdFilter()
            record = logging.LogRecord(
                name="t", level=logging.INFO, pathname=__file__, lineno=1,
                msg="m", args=(), exc_info=None,
            )
            record.request_id = "req-explicit"  # type: ignore[attr-defined]
            flt.filter(record)
            assert record.request_id == "req-explicit"  # type: ignore[attr-defined]
        finally:
            structured_logging.request_id_ctx.reset(token)


# ---------------------------------------------------------------------------
# models.api_models — Pydantic shape
# ---------------------------------------------------------------------------

from models.api_models import User  # noqa: E402


class TestUserModel:
    def test_minimal_ok(self):
        from datetime import datetime, timezone
        u = User(user_id="u1", email="a@b.pt", name="Tester",
                 created_at=datetime.now(timezone.utc))
        assert u.user_id == "u1"
        assert u.email == "a@b.pt"
        assert u.favorites == []

    def test_optional_fields(self):
        from datetime import datetime, timezone
        u = User(user_id="u1", email="a@b.pt", name="Tester",
                 created_at=datetime.now(timezone.utc),
                 picture="https://x/p.jpg")
        assert u.picture == "https://x/p.jpg"
