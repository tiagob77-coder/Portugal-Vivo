"""
Test Favorite Spots and Advanced Search APIs
============================================
Testing:
- GET /api/favorites/spots - Get user's favorite surf spots (auth required)
- POST /api/favorites/spots/{spotId} - Add spot to favorites (auth required)  
- DELETE /api/favorites/spots/{spotId} - Remove spot from favorites (auth required)
- POST /api/search - Advanced search with filters
- GET /api/search/suggestions?q= - Autocomplete suggestions
- GET /api/search/popular - Popular/trending items
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://portugal-vivo-3.preview.emergentagent.com').rstrip('/')


class TestSearchAPIsPublic:
    """Test public search endpoints - no auth required"""

    def test_search_endpoint_basic(self):
        """Test POST /api/search with basic query"""
        response = requests.post(
            f"{BASE_URL}/api/search",
            json={"query": "praia", "limit": 10}
        )
        print(f"Search 'praia' - Status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "results" in data, "Response should have 'results' field"
        assert "total" in data, "Response should have 'total' field"
        assert "query" in data, "Response should have 'query' field"
        assert data["query"] == "praia", f"Query should be 'praia', got {data['query']}"
        print(f"  - Found {data['total']} results, returned {len(data['results'])} items")

    def test_search_with_category_filter(self):
        """Test POST /api/search with category filter"""
        response = requests.post(
            f"{BASE_URL}/api/search",
            json={"query": "", "categories": ["piscinas", "termas"], "limit": 20}
        )
        print(f"Search with categories filter - Status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "filters_applied" in data, "Response should have 'filters_applied' field"
        print(f"  - Found {data['total']} results in categories piscinas/termas")

    def test_search_with_region_filter(self):
        """Test POST /api/search with region filter"""
        response = requests.post(
            f"{BASE_URL}/api/search",
            json={"query": "", "regions": ["norte", "centro"], "limit": 20}
        )
        print(f"Search with region filter - Status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        print(f"  - Found {data['total']} results in Norte/Centro regions")

    def test_search_with_combined_filters(self):
        """Test POST /api/search with multiple filters"""
        response = requests.post(
            f"{BASE_URL}/api/search",
            json={
                "query": "água",
                "categories": ["piscinas"],
                "regions": ["norte"],
                "limit": 10
            }
        )
        print(f"Search with combined filters - Status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "filters_applied" in data
        filters = data["filters_applied"]
        assert filters.get("categories") == ["piscinas"], "Categories filter not applied correctly"
        assert filters.get("regions") == ["norte"], "Regions filter not applied correctly"
        print(f"  - Found {data['total']} results matching all criteria")

    def test_search_suggestions_endpoint(self):
        """Test GET /api/search/suggestions?q=pra"""
        response = requests.get(f"{BASE_URL}/api/search/suggestions?q=pra&limit=5")
        print(f"Search suggestions 'pra' - Status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "suggestions" in data, "Response should have 'suggestions' field"

        suggestions = data["suggestions"]
        print(f"  - Got {len(suggestions)} suggestions")
        for s in suggestions:
            assert "type" in s, "Each suggestion should have 'type' field"
            assert "text" in s, "Each suggestion should have 'text' field"
            print(f"    - {s['type']}: {s['text']}")

    def test_search_suggestions_too_short(self):
        """Test GET /api/search/suggestions with short query (< 2 chars)"""
        response = requests.get(f"{BASE_URL}/api/search/suggestions?q=p")
        print(f"Search suggestions 'p' (too short) - Status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert data.get("suggestions") == [], "Short query should return empty suggestions"
        print("  - Correctly returned empty suggestions for query < 2 chars")

    def test_search_suggestions_longer_query(self):
        """Test GET /api/search/suggestions with longer query"""
        response = requests.get(f"{BASE_URL}/api/search/suggestions?q=term")
        print(f"Search suggestions 'term' - Status: {response.status_code}")
        assert response.status_code == 200

        data = response.json()
        print(f"  - Got {len(data.get('suggestions', []))} suggestions for 'term'")

    def test_popular_searches_endpoint(self):
        """Test GET /api/search/popular"""
        response = requests.get(f"{BASE_URL}/api/search/popular")
        print(f"Popular searches - Status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "trending_items" in data, "Response should have 'trending_items' field"
        assert "popular_categories" in data, "Response should have 'popular_categories' field"
        assert "suggested_searches" in data, "Response should have 'suggested_searches' field"

        print(f"  - Trending items: {len(data['trending_items'])}")
        print(f"  - Popular categories: {len(data['popular_categories'])}")
        print(f"  - Suggested searches: {data['suggested_searches']}")

        # Verify suggested_searches content
        suggested = data["suggested_searches"]
        assert len(suggested) > 0, "Should have at least 1 suggested search"
        assert all(isinstance(s, str) for s in suggested), "All suggestions should be strings"

    def test_search_empty_query(self):
        """Test POST /api/search with empty query (should still work with filters)"""
        response = requests.post(
            f"{BASE_URL}/api/search",
            json={"query": "", "limit": 5}
        )
        print(f"Search with empty query - Status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        print(f"  - Found {data['total']} items with empty query")


class TestFavoritesSpotsAPIs:
    """Test Favorite Spots endpoints - auth required"""

    def test_get_favorites_unauthorized(self):
        """Test GET /api/favorites/spots without auth - should return 401"""
        response = requests.get(f"{BASE_URL}/api/favorites/spots")
        print(f"Get favorites (no auth) - Status: {response.status_code}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("  - Correctly returned 401 Unauthorized")

    def test_add_favorite_unauthorized(self):
        """Test POST /api/favorites/spots/{spotId} without auth - should return 401"""
        response = requests.post(f"{BASE_URL}/api/favorites/spots/nazare")
        print(f"Add favorite (no auth) - Status: {response.status_code}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("  - Correctly returned 401 Unauthorized")

    def test_remove_favorite_unauthorized(self):
        """Test DELETE /api/favorites/spots/{spotId} without auth - should return 401"""
        response = requests.delete(f"{BASE_URL}/api/favorites/spots/nazare")
        print(f"Remove favorite (no auth) - Status: {response.status_code}")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("  - Correctly returned 401 Unauthorized")

    def test_add_favorite_invalid_spot(self):
        """Test POST /api/favorites/spots/{spotId} with invalid spot - tests without auth first"""
        # This test expects 401 first (auth required before spot validation)
        response = requests.post(
            f"{BASE_URL}/api/favorites/spots/invalid_spot_xyz",
            headers={"Authorization": "Bearer fake_token"}
        )
        print(f"Add invalid spot (fake auth) - Status: {response.status_code}")
        # Should get 401 because token is invalid (auth happens before spot validation)
        assert response.status_code == 401, f"Expected 401 for invalid token, got {response.status_code}"
        print("  - Auth validation happens before spot validation")


class TestMarineSpotsIntegration:
    """Test that marine spots endpoints work (integration with favorites)"""

    def test_get_marine_spots_list(self):
        """Test GET /api/marine/spots - verify spots exist for favorites"""
        response = requests.get(f"{BASE_URL}/api/marine/spots")
        print(f"Get marine spots list - Status: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        # Handle both dict with 'spots' key and direct list
        if isinstance(data, dict):
            spots = data.get("spots", [])
        else:
            spots = data

        assert isinstance(spots, list), "Response spots should be a list"
        assert len(spots) > 0, "Should have at least one surf spot"

        print(f"  - Found {len(spots)} surf spots available for favorites")
        for spot in spots[:3]:
            print(f"    - {spot.get('id')}: {spot.get('name')}")


class TestDataValidation:
    """Test data validation and error handling"""

    def test_search_invalid_json(self):
        """Test POST /api/search with invalid JSON"""
        response = requests.post(
            f"{BASE_URL}/api/search",
            data="not json",
            headers={"Content-Type": "application/json"}
        )
        print(f"Search with invalid JSON - Status: {response.status_code}")
        assert response.status_code == 422, f"Expected 422 for invalid JSON, got {response.status_code}"

    def test_search_missing_query_field(self):
        """Test POST /api/search without query field"""
        response = requests.post(
            f"{BASE_URL}/api/search",
            json={"categories": ["piscinas"]}
        )
        print(f"Search without query field - Status: {response.status_code}")
        # Should return 422 because 'query' is required
        assert response.status_code == 422, f"Expected 422 for missing 'query', got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
