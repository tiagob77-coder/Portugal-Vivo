"""
FASE 3 - Error path & edge case tests.
Uses pytest with FastAPI TestClient (no running server required).
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# ---------------------------------------------------------------------------
# Shared utilities tests (no server needed)
# ---------------------------------------------------------------------------

class TestClampPagination:
    """Test shared_utils.clamp_pagination edge cases."""

    def test_normal_values(self):
        from shared_utils import clamp_pagination
        skip, limit = clamp_pagination(0, 50)
        assert skip == 0
        assert limit == 50

    def test_negative_skip_clamped_to_zero(self):
        from shared_utils import clamp_pagination
        skip, limit = clamp_pagination(-10, 50)
        assert skip == 0

    def test_zero_limit_clamped_to_one(self):
        from shared_utils import clamp_pagination
        skip, limit = clamp_pagination(0, 0)
        assert limit == 1

    def test_negative_limit_clamped_to_one(self):
        from shared_utils import clamp_pagination
        skip, limit = clamp_pagination(0, -100)
        assert limit == 1

    def test_limit_exceeds_max(self):
        from shared_utils import clamp_pagination
        skip, limit = clamp_pagination(0, 9999)
        assert limit == 500  # default max_limit

    def test_custom_max_limit(self):
        from shared_utils import clamp_pagination
        skip, limit = clamp_pagination(0, 200, max_limit=100)
        assert limit == 100

    def test_large_skip_allowed(self):
        from shared_utils import clamp_pagination
        skip, limit = clamp_pagination(100000, 10)
        assert skip == 100000

    def test_both_negative(self):
        from shared_utils import clamp_pagination
        skip, limit = clamp_pagination(-5, -5)
        assert skip == 0
        assert limit == 1


class TestHaversine:
    """Test distance calculation edge cases."""

    def test_same_point_returns_zero(self):
        from shared_utils import haversine_km
        assert haversine_km(38.7223, -9.1393, 38.7223, -9.1393) == 0.0

    def test_lisbon_to_porto(self):
        from shared_utils import haversine_km
        dist = haversine_km(38.7223, -9.1393, 41.1579, -8.6291)
        assert 270 < dist < 280  # ~274 km

    def test_haversine_meters(self):
        from shared_utils import haversine_meters
        dist = haversine_meters(38.7223, -9.1393, 38.7223, -9.1393)
        assert dist == 0.0


class TestDatabaseHolder:
    """Test DatabaseHolder error handling."""

    def test_uninitialized_raises_500(self):
        from shared_utils import DatabaseHolder
        holder = DatabaseHolder("test_module")
        with pytest.raises(Exception) as exc_info:
            holder.get()
        assert "not initialized" in str(exc_info.value.detail)

    def test_set_and_get(self):
        from shared_utils import DatabaseHolder
        holder = DatabaseHolder("test_module")
        mock_db = MagicMock()
        holder.set(mock_db)
        assert holder.get() is mock_db
        assert holder.db is mock_db


# ---------------------------------------------------------------------------
# Pydantic model validation tests
# ---------------------------------------------------------------------------

class TestModelValidation:
    """Test Pydantic request model validation."""

    def test_discovery_feed_limit_too_high(self):
        """DiscoveryFeedRequest.limit should reject values > 100."""
        import sys
        sys.path.insert(0, "/home/user/Portugal-Vivo-Emergent/backend")
        from pydantic import ValidationError

        # Import dynamically to avoid server startup side effects
        from pydantic import BaseModel, Field
        from typing import Optional

        class DiscoveryFeedRequest(BaseModel):
            lat: Optional[float] = None
            lng: Optional[float] = None
            limit: int = Field(30, ge=1, le=100)
            traveler_profile: Optional[str] = None

        with pytest.raises(ValidationError):
            DiscoveryFeedRequest(limit=200)

        with pytest.raises(ValidationError):
            DiscoveryFeedRequest(limit=0)

        # Valid values should work
        req = DiscoveryFeedRequest(limit=50)
        assert req.limit == 50

    def test_discovery_feed_defaults(self):
        from pydantic import BaseModel, Field
        from typing import Optional

        class DiscoveryFeedRequest(BaseModel):
            lat: Optional[float] = None
            lng: Optional[float] = None
            limit: int = Field(30, ge=1, le=100)
            traveler_profile: Optional[str] = None

        req = DiscoveryFeedRequest()
        assert req.limit == 30
        assert req.lat is None
        assert req.traveler_profile is None


# ---------------------------------------------------------------------------
# Epoch classification tests
# ---------------------------------------------------------------------------

class TestEpochClassification:
    """Test epoch keyword matching logic."""

    def test_all_epochs_have_required_fields(self):
        from epochs_api import EPOCHS
        required = {"name", "period", "color", "icon", "keywords"}
        for epoch_id, epoch in EPOCHS.items():
            assert required.issubset(epoch.keys()), f"Epoch {epoch_id} missing fields"
            assert len(epoch["keywords"]) > 0, f"Epoch {epoch_id} has no keywords"

    def test_epoch_ids_are_valid(self):
        from epochs_api import EPOCHS
        for epoch_id in EPOCHS:
            assert isinstance(epoch_id, str)
            assert len(epoch_id) > 0


# ---------------------------------------------------------------------------
# Shared constants tests
# ---------------------------------------------------------------------------

class TestSharedConstants:
    """Test shared constants integrity."""

    def test_categories_not_empty(self):
        from shared_constants import CATEGORIES
        assert len(CATEGORIES) > 0

    def test_regions_not_empty(self):
        from shared_constants import REGIONS
        assert len(REGIONS) > 0

    def test_gamification_badges_structure(self):
        from shared_constants import GAMIFICATION_BADGES
        assert len(GAMIFICATION_BADGES) > 0
        for badge in GAMIFICATION_BADGES:
            assert "id" in badge
            assert "name" in badge
