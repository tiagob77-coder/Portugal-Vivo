"""
Pure-function regression tests for the RGPD endpoints added in round 3
(``/api/auth/export-data`` and ``/api/auth/delete-account``).

The actual endpoints need a running app + Mongo to exercise end-to-end;
these unit tests pin the bits that we control without I/O:

  * The blocklist of collections walked by both endpoints — the list is
    the single source of truth and easy to forget to update.
  * The ``_strip_internal`` helper that scrubs the user document on
    export — a regression here would leak the bcrypt hash in the JSON
    download.
  * The ``DeleteAccountRequest`` Pydantic model — the literal "DELETE"
    string is a key part of the double-confirmation guard.
"""
import pytest
from pydantic import ValidationError

from auth_api import (
    USER_DATA_COLLECTIONS,
    DeleteAccountRequest,
    _strip_internal,
)


class TestUserDataCollections:
    def test_no_duplicate_collections(self):
        names = [name for name, _ in USER_DATA_COLLECTIONS]
        assert len(names) == len(set(names)), "duplicate collection in USER_DATA_COLLECTIONS"

    def test_all_keyed_by_user_id(self):
        """Every entry must use ``user_id`` as the lookup field — that is
        the invariant assumed by both the export and the delete loops."""
        for name, field in USER_DATA_COLLECTIONS:
            assert field == "user_id", f"{name} keyed by {field!r}, expected user_id"

    def test_includes_sensitive_collections(self):
        """Sanity: the most sensitive per-user data MUST be in the list,
        otherwise a deletion would leak it forward."""
        names = {name for name, _ in USER_DATA_COLLECTIONS}
        for required in (
            "user_sessions",        # active sessions across devices
            "password_resets",      # password reset tokens
            "push_tokens",          # mobile push tokens
            "favorites",            # behavioural fingerprint
            "visits",               # location history
            "checkins",             # location history
            "reviews",              # user-generated content
            "contributions",        # user-generated content
            "notifications",
        ):
            assert required in names, f"missing {required!r} in USER_DATA_COLLECTIONS"


class TestStripInternal:
    def test_removes_mongo_id(self):
        assert "_id" not in _strip_internal({"_id": "abc", "name": "x"})

    def test_removes_password_hash(self):
        out = _strip_internal({"password_hash": "$2b$12$...", "email": "x@y"})
        assert "password_hash" not in out
        assert out["email"] == "x@y"

    def test_removes_password_salt(self):
        assert "password_salt" not in _strip_internal({"password_salt": "abcdef"})

    def test_preserves_other_fields(self):
        doc = {
            "user_id": "u1",
            "email": "x@y",
            "name": "Test",
            "favorites": ["p1", "p2"],
            "created_at": "2026-05-14",
            "_id": "obj-id",
            "password_hash": "secret",
        }
        out = _strip_internal(doc)
        for k in ("user_id", "email", "name", "favorites", "created_at"):
            assert k in out
        assert out["favorites"] == ["p1", "p2"]


class TestDeleteAccountRequest:
    def test_confirm_required(self):
        with pytest.raises(ValidationError):
            DeleteAccountRequest()  # type: ignore[call-arg]

    def test_password_is_optional(self):
        # Social-login accounts have no password — the model must accept
        # confirm-only payloads; the endpoint then decides per-user
        # whether the password is in fact required.
        req = DeleteAccountRequest(confirm="DELETE")
        assert req.password is None

    def test_accepts_literal_delete(self):
        req = DeleteAccountRequest(confirm="DELETE", password="pass1234")
        assert req.confirm == "DELETE"
        assert req.password == "pass1234"

    def test_model_does_not_enforce_literal(self):
        """The Pydantic model intentionally accepts any string — the
        literal "DELETE" check is enforced at the endpoint level so we
        can return a helpful 400 with the explanation. This test pins
        the boundary so a future refactor doesn't tighten the model
        and skip the friendly error."""
        req = DeleteAccountRequest(confirm="anything")
        assert req.confirm == "anything"
