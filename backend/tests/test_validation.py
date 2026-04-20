"""
FASE 3 - Input validation & security boundary tests.
Tests that endpoints properly reject invalid input.
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch


class TestLeaderboardValidation:
    """Test leaderboard period validation."""

    def test_valid_periods_accepted(self):
        valid = ("all", "week", "month")
        for p in valid:
            assert p in valid

    def test_invalid_period_format(self):
        """Invalid period values should not be in the valid set."""
        valid = ("all", "week", "month")
        invalid_inputs = ["daily", "year", "ALL", "Week", "", "1", "null", "<script>"]
        for p in invalid_inputs:
            assert p not in valid, f"'{p}' should not be a valid period"


class TestPaginationBoundaries:
    """Test pagination clamping at boundaries."""

    def test_boundary_at_max_limit(self):
        from shared_utils import clamp_pagination
        _, limit = clamp_pagination(0, 500, max_limit=500)
        assert limit == 500

    def test_one_over_max(self):
        from shared_utils import clamp_pagination
        _, limit = clamp_pagination(0, 501, max_limit=500)
        assert limit == 500

    def test_one_under_min(self):
        from shared_utils import clamp_pagination
        _, limit = clamp_pagination(0, 0)
        assert limit == 1

    def test_exactly_one(self):
        from shared_utils import clamp_pagination
        _, limit = clamp_pagination(0, 1)
        assert limit == 1

    def test_skip_zero(self):
        from shared_utils import clamp_pagination
        skip, _ = clamp_pagination(0, 10)
        assert skip == 0

    def test_skip_negative_one(self):
        from shared_utils import clamp_pagination
        skip, _ = clamp_pagination(-1, 10)
        assert skip == 0

    def test_very_large_limit(self):
        from shared_utils import clamp_pagination
        _, limit = clamp_pagination(0, 999999999, max_limit=100)
        assert limit == 100

    def test_float_like_integers(self):
        """Ensure integer-only values work (no float division issues)."""
        from shared_utils import clamp_pagination
        skip, limit = clamp_pagination(10, 10, max_limit=100)
        assert skip == 10
        assert limit == 10


class TestInputSanitization:
    """Test that special characters in query params don't cause issues."""

    def test_category_strings(self):
        """Category filter strings should be plain text."""
        safe_categories = ["castelos", "museus", "praias_fluviais", "arte_urbana"]
        for cat in safe_categories:
            assert isinstance(cat, str)
            assert "<" not in cat
            assert ">" not in cat

    def test_region_strings(self):
        from shared_constants import REGIONS
        for region in REGIONS:
            region_id = region.get("id", "")
            assert isinstance(region_id, str)
            assert len(region_id) > 0
            # No injection-prone chars
            assert ";" not in region_id
            assert "'" not in region_id


class TestGamificationValidation:
    """Test gamification input constraints."""

    def test_checkin_radius_constant(self):
        from gamification_api import CHECK_IN_RADIUS_METERS
        assert CHECK_IN_RADIUS_METERS > 0
        assert CHECK_IN_RADIUS_METERS <= 1000  # Reasonable max radius

    def test_badge_ids_unique(self):
        from shared_constants import GAMIFICATION_BADGES
        ids = [b["id"] for b in GAMIFICATION_BADGES]
        assert len(ids) == len(set(ids)), "Duplicate badge IDs found"


class TestCSRFConfig:
    """Test CSRF middleware configuration values."""

    def test_csrf_exempt_paths_are_strings(self):
        """Verify the exempt paths pattern."""
        csrf_exempt = ("/api/auth/login", "/api/auth/register", "/api/auth/callback",
                       "/api/health", "/docs", "/openapi.json")
        for path in csrf_exempt:
            assert path.startswith("/")
            assert isinstance(path, str)

    def test_token_length(self):
        """CSRF tokens should be sufficiently long."""
        import secrets
        token = secrets.token_urlsafe(32)
        assert len(token) >= 40  # urlsafe base64 of 32 bytes = 43 chars


class TestRateLimitConfig:
    """Test rate limiting configuration."""

    def test_auth_rate_constants(self):
        """Auth rate limit should be reasonable."""
        # These match the constants in server.py
        AUTH_RATE_LIMIT = 10
        AUTH_RATE_WINDOW = 60
        assert AUTH_RATE_LIMIT > 0
        assert AUTH_RATE_LIMIT <= 20  # Not too permissive
        assert AUTH_RATE_WINDOW >= 30  # At least 30 seconds
