"""
Tests for Premium Feature Guard, extracted modules, and batch geocoding.
Unit tests - no database or server required.
"""
import sys
from pathlib import Path
import pytest

# Ensure scripts/ is importable for batch_geocode tests
_scripts_dir = str(Path(__file__).resolve().parent.parent.parent / "scripts")
if _scripts_dir not in sys.path:
    sys.path.insert(0, _scripts_dir)


# ---------------------------------------------------------------------------
# Premium Guard - Constants & Logic
# ---------------------------------------------------------------------------

class TestPremiumGuardConstants:
    """Test premium guard configuration."""

    def test_premium_feature_ids_exist(self):
        from premium_guard import PREMIUM_FEATURE_IDS
        assert "ai_itinerary" in PREMIUM_FEATURE_IDS
        assert "audio_guides" in PREMIUM_FEATURE_IDS
        assert "offline" in PREMIUM_FEATURE_IDS
        assert "epochs" in PREMIUM_FEATURE_IDS
        assert "collections" in PREMIUM_FEATURE_IDS
        assert "custom_routes" in PREMIUM_FEATURE_IDS
        assert "export" in PREMIUM_FEATURE_IDS
        assert "early_access" in PREMIUM_FEATURE_IDS

    def test_tier_hierarchy_ordering(self):
        from premium_guard import TIER_HIERARCHY
        assert TIER_HIERARCHY["free"] < TIER_HIERARCHY["premium"]
        assert TIER_HIERARCHY["premium"] < TIER_HIERARCHY["annual"]

    def test_free_tier_is_zero(self):
        from premium_guard import TIER_HIERARCHY
        assert TIER_HIERARCHY["free"] == 0

    def test_unknown_tier_defaults_to_zero(self):
        from premium_guard import TIER_HIERARCHY
        assert TIER_HIERARCHY.get("unknown_tier", 0) == 0

    def test_require_feature_returns_callable(self):
        from premium_guard import require_feature
        guard = require_feature("audio_guides")
        assert callable(guard)

    def test_require_feature_for_free_feature(self):
        from premium_guard import require_feature, PREMIUM_FEATURE_IDS
        assert "map_view" not in PREMIUM_FEATURE_IDS
        guard = require_feature("map_view")
        assert callable(guard)

    def test_all_premium_features_are_strings(self):
        from premium_guard import PREMIUM_FEATURE_IDS
        for fid in PREMIUM_FEATURE_IDS:
            assert isinstance(fid, str)
            assert len(fid) > 0


# ---------------------------------------------------------------------------
# Dashboard Leaderboard - N+1 fix verification
# ---------------------------------------------------------------------------

class TestLeaderboardConstants:
    """Test dashboard constants are properly defined."""

    def test_badge_definitions_exist(self):
        from dashboard_inline_api import BADGE_DEFINITIONS
        assert len(BADGE_DEFINITIONS) > 0
        for badge in BADGE_DEFINITIONS:
            assert "id" in badge
            assert "name" in badge
            assert "points" in badge
            assert "requirement" in badge
            assert "type" in badge

    def test_level_definitions_ascending(self):
        from dashboard_inline_api import LEVEL_DEFINITIONS
        assert len(LEVEL_DEFINITIONS) >= 5
        for i in range(1, len(LEVEL_DEFINITIONS)):
            assert LEVEL_DEFINITIONS[i]["min_points"] > LEVEL_DEFINITIONS[i - 1]["min_points"]
            assert LEVEL_DEFINITIONS[i]["level"] > LEVEL_DEFINITIONS[i - 1]["level"]

    def test_level_starts_at_zero_points(self):
        from dashboard_inline_api import LEVEL_DEFINITIONS
        assert LEVEL_DEFINITIONS[0]["min_points"] == 0
        assert LEVEL_DEFINITIONS[0]["level"] == 1

    def test_badge_ids_unique(self):
        from dashboard_inline_api import BADGE_DEFINITIONS
        ids = [b["id"] for b in BADGE_DEFINITIONS]
        assert len(ids) == len(set(ids)), "Badge IDs must be unique"


# ---------------------------------------------------------------------------
# Extracted Modules - Import Verification
# ---------------------------------------------------------------------------

class TestExtractedModulesImport:
    """Verify extracted API modules export expected symbols."""

    def test_admin_dashboard_api(self):
        from admin_dashboard_api import router, set_admin_dashboard_db
        assert router is not None
        assert callable(set_admin_dashboard_db)

    def test_audio_guide_api(self):
        from audio_guide_api import router, set_audio_guide_db
        assert router is not None
        assert callable(set_audio_guide_db)

    def test_dashboard_inline_api(self):
        from dashboard_inline_api import dashboard_inline_router, set_dashboard_inline_db, set_dashboard_redis_lb
        assert dashboard_inline_router is not None
        assert callable(set_dashboard_inline_db)
        assert callable(set_dashboard_redis_lb)

    def test_discover_feed_api(self):
        from discover_feed_api import router, set_discover_feed_db, set_discover_recommendation_service
        assert router is not None
        assert callable(set_discover_feed_db)
        assert callable(set_discover_recommendation_service)

    def test_explore_matrix_api(self):
        from explore_matrix_api import router, set_explore_matrix_db, THEMATIC_AXES
        assert router is not None
        assert callable(set_explore_matrix_db)
        assert len(THEMATIC_AXES) >= 5

    def test_gamification_progress_api(self):
        from gamification_progress_api import gamification_progress_router, set_gamification_progress_db
        assert gamification_progress_router is not None
        assert callable(set_gamification_progress_db)

    def test_marine_surf_api(self):
        from marine_surf_api import router, set_marine_surf_db
        assert router is not None
        assert callable(set_marine_surf_db)

    def test_preferences_api(self):
        from preferences_api import router, set_preferences_db
        assert router is not None
        assert callable(set_preferences_db)

    def test_premium_guard(self):
        from premium_guard import require_premium, require_feature, set_premium_guard_db
        assert callable(require_premium)
        assert callable(require_feature)
        assert callable(set_premium_guard_db)


# ---------------------------------------------------------------------------
# Premium Gates Applied - Verify decorators have dependencies
# ---------------------------------------------------------------------------

class TestPremiumGatesApplied:
    """Verify premium feature gates are applied to the correct endpoints."""

    @staticmethod
    def _find_route(router, path_suffix):
        """Find a route by path suffix (handles prefixed routers)."""
        for r in router.routes:
            if hasattr(r, "path") and r.path.endswith(path_suffix):
                return r
        return None

    def test_offline_package_gated(self):
        from offline_api import offline_router
        route = self._find_route(offline_router, "/package/{region}")
        assert route is not None, "Route /package/{region} not found"
        assert len(route.dependencies) > 0

    def test_epochs_list_gated(self):
        from epochs_api import epochs_router
        route = None
        for r in epochs_router.routes:
            if hasattr(r, "path") and r.name == "list_epochs":
                route = r
                break
        assert route is not None, "list_epochs route not found"
        assert len(route.dependencies) > 0

    def test_route_generator_open(self):
        # Basic route generation is free for all users (premium tiers may
        # unlock richer features at higher levels — gating is enforced
        # in those add-on endpoints, not on the generator itself).
        from route_generator_api import route_gen_router
        route = self._find_route(route_gen_router, "/generate")
        assert route is not None, "Route /generate not found"
        assert len(route.dependencies) == 0

    def test_narrative_gated(self):
        from narrative_api import narrative_router
        route = self._find_route(narrative_router, "/narrative")
        assert route is not None, "Route /narrative not found"
        assert len(route.dependencies) > 0

    def test_offline_regions_not_gated(self):
        """Listing regions should remain public."""
        from offline_api import offline_router
        route = self._find_route(offline_router, "/regions")
        assert route is not None, "Route /regions not found"
        assert len(route.dependencies) == 0

    def test_audio_guide_generate_gated(self):
        from audio_guide_api import router
        route = self._find_route(router, "/audio/generate")
        assert route is not None, "Route /audio/generate not found"
        assert len(route.dependencies) > 0

    def test_audio_guide_item_gated(self):
        from audio_guide_api import router
        route = self._find_route(router, "/audio/guide/{item_id}")
        assert route is not None, "Route /audio/guide/{item_id} not found"
        assert len(route.dependencies) > 0


# ---------------------------------------------------------------------------
# Batch Geocode Script - Unit tests
# ---------------------------------------------------------------------------

class TestBatchGeocode:
    """Test batch geocode helper functions."""

    def test_is_approximate_norte(self):
        from batch_geocode import is_approximate
        assert is_approximate(41.45, -8.30)
        assert is_approximate(41.50, -8.25)  # Within tolerance

    def test_is_approximate_exact_coords(self):
        from batch_geocode import is_approximate
        assert not is_approximate(40.6405, -8.6538)  # Aveiro - precise

    def test_is_approximate_all_centroids(self):
        from batch_geocode import is_approximate, REGION_CENTROIDS
        for lat, lng in REGION_CENTROIDS:
            assert is_approximate(lat, lng), f"Centroid ({lat}, {lng}) should be approximate"

    def test_build_query_with_address(self):
        from batch_geocode import build_query
        poi = {"address": "Rua de Santa Maria", "name": "Torre de Belém", "region": "lisboa"}
        query = build_query(poi)
        assert "Rua de Santa Maria" in query
        assert "Torre de Belém" in query
        assert "Lisboa" in query

    def test_build_query_minimal(self):
        from batch_geocode import build_query
        poi = {}
        query = build_query(poi)
        assert query == "Portugal"

    def test_build_query_name_only(self):
        from batch_geocode import build_query
        poi = {"name": "Castelo de Guimarães"}
        query = build_query(poi)
        assert "Castelo de Guimarães" in query

    def test_region_centroids_coverage(self):
        from batch_geocode import REGION_CENTROIDS
        # REGION_CENTROIDS is a list of (lat, lng) tuples covering all 7 regions
        assert len(REGION_CENTROIDS) >= 7

    def test_centroid_tolerance(self):
        from batch_geocode import CENTROID_TOLERANCE_DEG
        assert 0.05 < CENTROID_TOLERANCE_DEG < 0.6


# ---------------------------------------------------------------------------
# Explore Matrix - Thematic Axes
# ---------------------------------------------------------------------------

class TestExploreMatrix:
    """Test thematic axis definitions."""

    def test_all_axes_have_categories(self):
        from explore_matrix_api import THEMATIC_AXES
        for axis in THEMATIC_AXES:
            assert "id" in axis
            assert "name" in axis
            assert "categories" in axis
            assert len(axis["categories"]) > 0

    def test_known_axes_exist(self):
        from explore_matrix_api import THEMATIC_AXES
        axis_ids = {a["id"] for a in THEMATIC_AXES}
        assert "nature_adventure" in axis_ids
        assert "culture_heritage" in axis_ids
        assert "gastronomy_wines" in axis_ids

    def test_no_duplicate_axis_ids(self):
        from explore_matrix_api import THEMATIC_AXES
        ids = [a["id"] for a in THEMATIC_AXES]
        assert len(ids) == len(set(ids))
