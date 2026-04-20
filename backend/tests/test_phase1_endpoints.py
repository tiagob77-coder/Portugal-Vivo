"""
Test Suite for Phase 1 Implementation:
- Discovery Feed (Tab Descobrir)
- Thematic Matrix (Tab Explorar)
- Mobility endpoints (Transport, Tides, Waves)
- User Preferences

Uses the production external URL for testing.
"""
import pytest
import requests
import os

# Use production URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://portugal-vivo-3.preview.emergentagent.com')
BASE_URL = BASE_URL.rstrip('/')


class TestExploreMatrixEndpoints:
    """Tests for /api/explore/* endpoints (Tab Explorar)"""

    def test_get_thematic_matrix(self):
        """GET /api/explore/matrix - Should return thematic × geographic matrix"""
        response = requests.get(f"{BASE_URL}/api/explore/matrix")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()

        # Verify structure
        assert "matrix" in data, "Response should have 'matrix' field"
        assert "themes" in data, "Response should have 'themes' field"
        assert "regions" in data, "Response should have 'regions' field"

        # Verify matrix has themes
        assert len(data["matrix"]) > 0, "Matrix should have at least one theme"

        # Verify first theme has expected structure
        first_theme = data["matrix"][0]
        assert "theme" in first_theme, "Theme entry should have 'theme' field"
        assert "regions" in first_theme, "Theme entry should have 'regions' field"

        # Verify theme object structure
        theme = first_theme["theme"]
        assert "id" in theme, "Theme should have 'id'"
        assert "name" in theme, "Theme should have 'name'"
        assert "categories" in theme, "Theme should have 'categories'"

        # Verify region structure in matrix
        if first_theme["regions"]:
            region_entry = first_theme["regions"][0]
            assert "region" in region_entry, "Region entry should have 'region'"
            assert "count" in region_entry, "Region entry should have 'count'"

        print(f"✓ Thematic matrix returned {len(data['themes'])} themes and {len(data['regions'])} regions")

    def test_explore_by_theme_gastronomy(self):
        """GET /api/explore/theme/gastronomy_wines - Should return gastronomy items"""
        response = requests.get(f"{BASE_URL}/api/explore/theme/gastronomy_wines")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()

        # Verify structure
        assert "theme" in data, "Response should have 'theme' field"
        assert "items" in data, "Response should have 'items' field"
        assert "total_items" in data, "Response should have 'total_items' field"
        assert "by_region" in data, "Response should have 'by_region' field"

        # Verify theme info
        assert data["theme"]["id"] == "gastronomy_wines", "Theme ID should match"

        print(f"✓ Gastronomy theme returned {data['total_items']} items")

    def test_explore_by_invalid_theme(self):
        """GET /api/explore/theme/invalid_theme - Should return 404"""
        response = requests.get(f"{BASE_URL}/api/explore/theme/invalid_theme_xyz")
        assert response.status_code == 404, f"Expected 404 for invalid theme, got {response.status_code}"
        print("✓ Invalid theme returns 404 as expected")

    def test_explore_by_theme_with_region_filter(self):
        """GET /api/explore/theme/nature_adventure?region=norte - Should filter by region"""
        response = requests.get(f"{BASE_URL}/api/explore/theme/nature_adventure", params={"region": "norte"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "items" in data, "Response should have 'items'"

        # If items returned, verify they're from Norte region
        for item in data["items"][:5]:
            assert item.get("region") == "norte", f"Item region should be 'norte', got {item.get('region')}"

        print(f"✓ Theme filtered by region returned {len(data['items'])} items from Norte")


class TestDiscoverFeedEndpoints:
    """Tests for /api/discover/* endpoints (Tab Descobrir)"""

    def test_post_discovery_feed(self):
        """POST /api/discover/feed - Should return personalized feed"""
        payload = {"lat": 38.72, "lng": -9.14, "limit": 30}
        response = requests.post(f"{BASE_URL}/api/discover/feed", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()

        # Verify structure
        assert "items" in data, "Response should have 'items' field"
        assert "generated_at" in data, "Response should have 'generated_at' field"
        assert "personalized" in data, "Response should have 'personalized' field"

        # Anonymous request should not be personalized
        assert data["personalized"] == False, "Anonymous request should not be personalized"

        print(f"✓ Discovery feed returned {len(data['items'])} items")

    def test_post_discovery_feed_minimal(self):
        """POST /api/discover/feed - Should work with minimal payload"""
        payload = {"limit": 10}
        response = requests.post(f"{BASE_URL}/api/discover/feed", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "items" in data, "Response should have 'items'"
        print("✓ Discovery feed works with minimal payload")

    def test_get_trending_items(self):
        """GET /api/discover/trending - Should return trending items"""
        response = requests.get(f"{BASE_URL}/api/discover/trending", params={"limit": 10})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()

        # Verify structure
        assert "items" in data, "Response should have 'items' field"
        assert "period" in data, "Response should have 'period' field"

        print(f"✓ Trending endpoint returned {len(data['items'])} items for period '{data['period']}'")

    def test_get_seasonal_content(self):
        """GET /api/discover/seasonal - Should return seasonal content"""
        response = requests.get(f"{BASE_URL}/api/discover/seasonal")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()

        # Verify structure
        assert "season" in data, "Response should have 'season' field"
        assert "events" in data, "Response should have 'events' field"
        assert "recommended_items" in data, "Response should have 'recommended_items' field"
        assert "categories_in_focus" in data, "Response should have 'categories_in_focus' field"

        # Verify season is valid
        valid_seasons = ["winter", "spring", "summer", "autumn"]
        assert data["season"] in valid_seasons, f"Season '{data['season']}' should be one of {valid_seasons}"

        print(f"✓ Seasonal content returned for season '{data['season']}' with {len(data['events'])} events")


class TestMobilityEndpoints:
    """Tests for /api/mobility/* endpoints"""

    def test_get_transport_info_lisbon(self):
        """GET /api/mobility/transport - Should return transport info for Lisbon area"""
        # Lisbon coordinates (Baixa area)
        params = {"lat": 38.72, "lng": -9.14, "radius_m": 2000}
        response = requests.get(f"{BASE_URL}/api/mobility/transport", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()

        # Verify structure
        assert "stops" in data, "Response should have 'stops' field"
        assert "next_departures" in data, "Response should have 'next_departures' field"

        # Verify stops structure if any found
        if data["stops"]:
            stop = data["stops"][0]
            assert "external_id" in stop, "Stop should have 'external_id'"
            assert "name" in stop, "Stop should have 'name'"
            assert "lat" in stop, "Stop should have 'lat'"
            assert "lng" in stop, "Stop should have 'lng'"
            print(f"✓ Transport info returned {len(data['stops'])} stops near Lisbon")
        else:
            print("⚠ No transport stops found (Carris API may have returned empty)")

    def test_get_tide_info_cascais(self):
        """GET /api/mobility/tides - Should return tide info for Cascais area"""
        # Cascais coordinates (coastal area)
        params = {"lat": 38.69, "lng": -9.42}
        response = requests.get(f"{BASE_URL}/api/mobility/tides", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()

        # Verify structure
        assert "available" in data, "Response should have 'available' field"

        if data["available"]:
            assert "station" in data, "Response should have 'station' when available"
            assert "current_height_m" in data, "Response should have 'current_height_m'"
            assert "current_state" in data, "Response should have 'current_state'"

            # Verify current_state is valid
            valid_states = ["rising", "falling", "unknown", "high", "low"]
            assert data["current_state"] in valid_states, f"State '{data['current_state']}' should be valid"

            print(f"✓ Tide info: {data['station']} - Height: {data['current_height_m']}m, State: {data['current_state']}")
        else:
            print(f"⚠ Tide info not available: {data.get('message', 'No message')}")

    def test_get_wave_info_peniche(self):
        """GET /api/mobility/waves - Should return wave info for Peniche area"""
        # Peniche coordinates (surf spot)
        params = {"lat": 39.35, "lng": -9.38}
        response = requests.get(f"{BASE_URL}/api/mobility/waves", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()

        # Verify structure
        assert "available" in data, "Response should have 'available' field"

        if data["available"]:
            assert "station" in data, "Response should have 'station'"
            assert "wave_height_m" in data, "Response should have 'wave_height_m'"
            assert "wave_period_s" in data, "Response should have 'wave_period_s'"
            assert "surf_quality" in data, "Response should have 'surf_quality'"

            print(f"✓ Wave info: {data['station']} - Height: {data['wave_height_m']}m, Quality: {data['surf_quality']}")
        else:
            print(f"⚠ Wave info not available: {data.get('message', 'No message')}")

    def test_get_wave_info_inland(self):
        """GET /api/mobility/waves - Should handle inland locations gracefully"""
        # Inland coordinates (no surf)
        params = {"lat": 40.20, "lng": -7.50}  # Near Guarda, inland
        response = requests.get(f"{BASE_URL}/api/mobility/waves", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        # Should either be unavailable or return nearest coastal data
        assert "available" in data, "Response should have 'available' field"
        print(f"✓ Inland wave query handled gracefully (available: {data['available']})")


class TestUserPreferencesEndpoints:
    """Tests for /api/preferences endpoints (require auth)"""

    def test_get_preferences_requires_auth(self):
        """GET /api/preferences - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/preferences")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ GET /api/preferences correctly requires authentication")

    def test_put_preferences_requires_auth(self):
        """PUT /api/preferences - Should require authentication"""
        payload = {"preferred_pace": "slow"}
        response = requests.put(f"{BASE_URL}/api/preferences", json=payload)
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ PUT /api/preferences correctly requires authentication")

    def test_onboarding_requires_auth(self):
        """POST /api/preferences/onboarding - Should require authentication"""
        payload = {
            "traveler_profiles": {"nature_lover": 0.8},
            "favorite_regions": ["norte"],
            "interests": ["hiking"]
        }
        response = requests.post(f"{BASE_URL}/api/preferences/onboarding", json=payload)
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ POST /api/preferences/onboarding correctly requires authentication")


class TestExistingEndpointsStillWork:
    """Regression tests to ensure existing endpoints still work"""

    def test_health_endpoint(self):
        """GET /api/health - Health check still works"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", "Status should be healthy"
        print("✓ Health endpoint working")

    def test_categories_endpoint(self):
        """GET /api/categories - Categories still work"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert len(data) > 0, "Should return categories"
        print(f"✓ Categories endpoint returned {len(data)} categories")

    def test_regions_endpoint(self):
        """GET /api/regions - Regions still work"""
        response = requests.get(f"{BASE_URL}/api/regions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert len(data) == 7, "Should return 7 regions (NUTS II)"
        print(f"✓ Regions endpoint returned {len(data)} regions")

    def test_heritage_items_endpoint(self):
        """GET /api/heritage - Heritage items still work"""
        response = requests.get(f"{BASE_URL}/api/heritage", params={"limit": 5})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"✓ Heritage endpoint returned {len(data)} items")

    def test_routes_endpoint(self):
        """GET /api/routes - Routes still work"""
        response = requests.get(f"{BASE_URL}/api/routes", params={"limit": 5})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"✓ Routes endpoint returned {len(data)} routes")

    def test_calendar_endpoint(self):
        """GET /api/calendar - Calendar still works"""
        response = requests.get(f"{BASE_URL}/api/calendar")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"✓ Calendar endpoint returned {len(data)} events")


class TestExploreRegionEndpoint:
    """Tests for /api/explore/region/{region_id}"""

    def test_explore_by_region_norte(self):
        """GET /api/explore/region/norte - Should return Norte region items"""
        response = requests.get(f"{BASE_URL}/api/explore/region/norte")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()

        # Verify structure
        assert "region" in data, "Response should have 'region' field"
        assert "items" in data, "Response should have 'items' field"
        assert "total_items" in data, "Response should have 'total_items' field"
        assert "by_theme" in data, "Response should have 'by_theme' field"

        # Verify region info
        assert data["region"]["id"] == "norte", "Region ID should match"

        print(f"✓ Norte region returned {data['total_items']} items")

    def test_explore_by_invalid_region(self):
        """GET /api/explore/region/invalid - Should return 404"""
        response = requests.get(f"{BASE_URL}/api/explore/region/invalid_region_xyz")
        assert response.status_code == 404, f"Expected 404 for invalid region, got {response.status_code}"
        print("✓ Invalid region returns 404 as expected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
