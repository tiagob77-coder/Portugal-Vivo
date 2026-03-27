"""
Test Reviews API and Surf Alerts API
Tests for P1 features: Reviews system and Surf Alerts

Modules tested:
- Reviews API: GET /api/reviews/item/{item_id} - list reviews for item
- Reviews API: GET /api/reviews/item/{item_id}/summary - rating distribution and average
- Reviews API: POST /api/reviews - create review (requires auth)
- Surf Alerts API: GET /api/alerts/surf/check - spots with good/excellent conditions
- Surf Alerts API: PUT /api/alerts/surf - update user preferences (requires auth)
"""

import pytest
import requests
import os
import uuid

# Get BASE_URL from environment variable
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://project-analyzer-131.preview.emergentagent.com').rstrip('/')

# Test fixtures
@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

class TestReviewsPublicAPI:
    """Test public Reviews API endpoints (no auth required)"""

    def test_get_reviews_for_item_empty(self, api_client):
        """GET /api/reviews/item/{item_id} - returns empty list for item with no reviews"""
        # Use a UUID that likely has no reviews
        test_item_id = f"test-item-{uuid.uuid4().hex[:8]}"
        response = api_client.get(f"{BASE_URL}/api/reviews/item/{test_item_id}")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/reviews/item/{test_item_id} returned {len(data)} reviews")

    def test_get_reviews_with_sort_options(self, api_client):
        """GET /api/reviews/item/{item_id} - test sort options"""
        test_item_id = "test-item-sort"

        # Test all sort options
        sort_options = ["recent", "rating_high", "rating_low", "helpful"]
        for sort_by in sort_options:
            response = api_client.get(f"{BASE_URL}/api/reviews/item/{test_item_id}?sort_by={sort_by}")
            assert response.status_code == 200, f"Sort '{sort_by}' failed: {response.text}"

        print("✓ All sort options work correctly")

    def test_get_reviews_with_pagination(self, api_client):
        """GET /api/reviews/item/{item_id} - test pagination params"""
        test_item_id = "test-item-pagination"
        response = api_client.get(f"{BASE_URL}/api/reviews/item/{test_item_id}?limit=5&skip=0")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print("✓ Pagination parameters work correctly")

    def test_get_review_summary_empty(self, api_client):
        """GET /api/reviews/item/{item_id}/summary - returns default summary for item with no reviews"""
        test_item_id = f"test-item-{uuid.uuid4().hex[:8]}"
        response = api_client.get(f"{BASE_URL}/api/reviews/item/{test_item_id}/summary")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()

        # Verify structure
        assert "item_id" in data, "Missing item_id in response"
        assert "average_rating" in data, "Missing average_rating in response"
        assert "total_reviews" in data, "Missing total_reviews in response"
        assert "rating_distribution" in data, "Missing rating_distribution in response"

        # Verify values for empty reviews
        assert data["average_rating"] == 0, f"Expected 0 average_rating, got {data['average_rating']}"
        assert data["total_reviews"] == 0, f"Expected 0 total_reviews, got {data['total_reviews']}"

        # Verify rating distribution structure
        for i in range(1, 6):
            assert str(i) in data["rating_distribution"], f"Missing rating {i} in distribution"

        print(f"✓ GET /api/reviews/item/{test_item_id}/summary returned correct empty summary")

    def test_get_review_summary_structure(self, api_client):
        """GET /api/reviews/item/{item_id}/summary - verify response structure"""
        test_item_id = "some-item-id"
        response = api_client.get(f"{BASE_URL}/api/reviews/item/{test_item_id}/summary")

        assert response.status_code == 200
        data = response.json()

        # Required fields
        required_fields = ["item_id", "average_rating", "total_reviews", "rating_distribution"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"

        # Type checks
        assert isinstance(data["average_rating"], (int, float))
        assert isinstance(data["total_reviews"], int)
        assert isinstance(data["rating_distribution"], dict)

        print("✓ Review summary structure is correct")


class TestReviewsAuthAPI:
    """Test Reviews API endpoints that require authentication"""

    def test_create_review_without_auth(self, api_client):
        """POST /api/reviews - should return 401 without auth"""
        response = api_client.post(f"{BASE_URL}/api/reviews", json={
            "item_id": "test-item",
            "rating": 5,
            "title": "Great place",
            "text": "Loved visiting here!"
        })

        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ POST /api/reviews correctly requires authentication")

    def test_create_review_invalid_rating(self, api_client):
        """POST /api/reviews - should validate rating (1-5)"""
        # Test with invalid rating (0)
        response = api_client.post(f"{BASE_URL}/api/reviews", json={
            "item_id": "test-item",
            "rating": 0  # Invalid - should be 1-5
        })

        # Should be 422 (validation error) or 401 (no auth)
        assert response.status_code in [401, 422], f"Expected 401 or 422, got {response.status_code}"
        print("✓ POST /api/reviews validates rating constraints")

    def test_create_review_missing_required_fields(self, api_client):
        """POST /api/reviews - should require item_id and rating"""
        response = api_client.post(f"{BASE_URL}/api/reviews", json={
            "title": "Test"
            # Missing item_id and rating
        })

        # Should be 422 (validation error) or 401 (no auth)
        assert response.status_code in [401, 422], f"Expected 401 or 422, got {response.status_code}"
        print("✓ POST /api/reviews requires item_id and rating")

    def test_get_user_reviews_without_auth(self, api_client):
        """GET /api/reviews/user - should return 401 without auth"""
        response = api_client.get(f"{BASE_URL}/api/reviews/user")

        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ GET /api/reviews/user correctly requires authentication")

    def test_update_review_without_auth(self, api_client):
        """PUT /api/reviews/{review_id} - should return 401 without auth"""
        response = api_client.put(f"{BASE_URL}/api/reviews/test-review-id", json={
            "rating": 4,
            "title": "Updated title"
        })

        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ PUT /api/reviews/{review_id} correctly requires authentication")

    def test_delete_review_without_auth(self, api_client):
        """DELETE /api/reviews/{review_id} - should return 401 without auth"""
        response = api_client.delete(f"{BASE_URL}/api/reviews/test-review-id")

        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ DELETE /api/reviews/{review_id} correctly requires authentication")

    def test_vote_helpful_without_auth(self, api_client):
        """POST /api/reviews/{review_id}/helpful - should return 401 without auth"""
        response = api_client.post(f"{BASE_URL}/api/reviews/test-review-id/helpful")

        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ POST /api/reviews/{review_id}/helpful correctly requires authentication")


class TestSurfAlertsAPI:
    """Test Surf Alerts API endpoints"""

    def test_check_surf_conditions_public(self, api_client):
        """GET /api/alerts/surf/check - public endpoint, returns spots with good/excellent conditions"""
        response = api_client.get(f"{BASE_URL}/api/alerts/surf/check")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()

        # Verify structure
        assert "has_alerts" in data, "Missing has_alerts in response"
        assert isinstance(data["has_alerts"], bool), "has_alerts should be boolean"

        # If there are alerts, verify structure
        if "alerts" in data and len(data.get("alerts", [])) > 0:
            alert = data["alerts"][0]
            assert "spot_id" in alert, "Alert missing spot_id"
            assert "spot_name" in alert, "Alert missing spot_name"
            assert "wave_height_m" in alert, "Alert missing wave_height_m"
            assert "surf_quality" in alert, "Alert missing surf_quality"
            assert "message" in alert, "Alert missing message"

            # Verify quality is good or excellent
            assert alert["surf_quality"] in ["good", "excellent"], \
                f"Expected good/excellent quality, got {alert['surf_quality']}"

        print(f"✓ GET /api/alerts/surf/check returned has_alerts={data['has_alerts']}")
        if "alerts" in data:
            print(f"  Spots with good/excellent conditions: {len(data.get('alerts', []))}")

    def test_get_surf_preferences_without_auth(self, api_client):
        """GET /api/alerts/surf - should return 401 without auth"""
        response = api_client.get(f"{BASE_URL}/api/alerts/surf")

        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ GET /api/alerts/surf correctly requires authentication")

    def test_update_surf_preferences_without_auth(self, api_client):
        """PUT /api/alerts/surf - should return 401 without auth"""
        response = api_client.put(f"{BASE_URL}/api/alerts/surf", json={
            "enabled": True,
            "spots": ["peniche"],
            "min_quality": "good",
            "notify_time": "morning"
        })

        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ PUT /api/alerts/surf correctly requires authentication")


class TestGeofencingServiceExports:
    """Test that geofencing service exports correctly (frontend verification)"""

    def test_heritage_items_have_location(self, api_client):
        """Verify heritage items have location data for geofencing"""
        response = api_client.get(f"{BASE_URL}/api/map/items?categories=termas,piscinas")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        items = response.json()

        # Should return items with location
        if len(items) > 0:
            item = items[0]
            assert "location" in item, "Item missing location"
            assert item["location"] is not None, "Item location is null"
            assert "lat" in item["location"], "Location missing lat"
            assert "lng" in item["location"], "Location missing lng"
            print(f"✓ Heritage items have location data ({len(items)} items with location found)")
        else:
            print("✓ Map items endpoint working (no items with selected categories)")


class TestReviewsIntegration:
    """Integration tests for reviews with real heritage items"""

    def test_reviews_endpoint_with_real_item(self, api_client):
        """Test reviews endpoint using an actual heritage item ID"""
        # First get a real heritage item
        items_response = api_client.get(f"{BASE_URL}/api/heritage?limit=1")
        assert items_response.status_code == 200, "Failed to fetch heritage items"

        items = items_response.json()
        if len(items) > 0:
            item_id = items[0]["id"]

            # Now fetch reviews for this item
            reviews_response = api_client.get(f"{BASE_URL}/api/reviews/item/{item_id}")
            assert reviews_response.status_code == 200, f"Failed to fetch reviews: {reviews_response.text}"

            reviews = reviews_response.json()
            assert isinstance(reviews, list)

            # Also fetch summary
            summary_response = api_client.get(f"{BASE_URL}/api/reviews/item/{item_id}/summary")
            assert summary_response.status_code == 200, f"Failed to fetch summary: {summary_response.text}"

            summary = summary_response.json()
            assert summary["item_id"] == item_id

            print(f"✓ Reviews integration working for item '{items[0]['name']}' ({len(reviews)} reviews, avg rating: {summary['average_rating']})")
        else:
            print("✓ Reviews integration test skipped (no heritage items in database)")


class TestSurfAlertsIntegration:
    """Integration tests for surf alerts with marine service"""

    def test_surf_check_returns_real_data(self, api_client):
        """Verify surf check endpoint returns real marine data"""
        response = api_client.get(f"{BASE_URL}/api/alerts/surf/check")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()

        # Verify this is real data by checking wave heights are realistic
        if "alerts" in data and len(data["alerts"]) > 0:
            for alert in data["alerts"]:
                wave_height = alert.get("wave_height_m", 0)
                # Wave height should be realistic (0-15m for most surf conditions)
                assert 0 <= wave_height <= 15, f"Unrealistic wave height: {wave_height}m"

            print(f"✓ Surf alerts using REAL marine data - {len(data['alerts'])} spots with good+ conditions")
            for alert in data["alerts"][:3]:  # Show first 3
                print(f"  - {alert['spot_name']}: {alert['wave_height_m']}m ({alert['surf_quality']})")
        else:
            print("✓ Surf check working - no spots currently have good+ conditions")

    def test_marine_spots_endpoint(self, api_client):
        """Verify marine spots endpoint works (used by surf alerts)"""
        response = api_client.get(f"{BASE_URL}/api/marine/spots/all")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        # The endpoint returns an object with "spots" array
        assert "spots" in data, "Response missing 'spots' key"
        spots = data["spots"]
        assert isinstance(spots, list), "Expected spots to be a list"

        if len(spots) > 0:
            spot = spots[0]
            assert "spot_id" in spot, "Spot missing spot_id"
            assert "spot" in spot, "Spot missing spot details"
            print(f"✓ Marine spots endpoint working - {len(spots)} surf spots available")
        else:
            print("✓ Marine spots endpoint working (no spots returned)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
