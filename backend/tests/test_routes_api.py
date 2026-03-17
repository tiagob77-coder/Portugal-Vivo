"""
Backend API tests for Património Vivo de Portugal
Focus: Routes endpoint and related APIs
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://current-app-1.preview.emergentagent.com')


class TestHealthEndpoint:
    """Health check and basic API tests"""

    def test_health_endpoint(self):
        """Test health endpoint returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        print(f"✓ Health check passed: {data}")

    def test_root_endpoint(self):
        """Test root API endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["status"] == "online"
        print(f"✓ Root endpoint passed: {data}")


class TestRoutesEndpoint:
    """Routes API endpoint tests - Critical for Routes tab fix"""

    def test_get_routes_returns_data(self):
        """Test GET /routes returns route data"""
        response = requests.get(f"{BASE_URL}/api/routes")
        assert response.status_code == 200
        data = response.json()

        # Data assertion - routes should be a non-empty list
        assert isinstance(data, list)
        assert len(data) > 0, "Routes endpoint should return at least one route"
        print(f"✓ Routes endpoint returned {len(data)} routes")

    def test_routes_data_structure(self):
        """Test routes have required fields for FlatList rendering"""
        response = requests.get(f"{BASE_URL}/api/routes")
        assert response.status_code == 200
        data = response.json()

        # Verify first route has all required fields for RouteCard component
        route = data[0]
        required_fields = ['id', 'name', 'description', 'category']
        for field in required_fields:
            assert field in route, f"Route missing required field: {field}"

        # Data assertion - validate field types
        assert isinstance(route['id'], str) and len(route['id']) > 0
        assert isinstance(route['name'], str) and len(route['name']) > 0
        assert isinstance(route['description'], str) and len(route['description']) > 0
        assert isinstance(route['category'], str) and len(route['category']) > 0

        print(f"✓ Route data structure validated: {route['name']}")

    def test_routes_category_filter(self):
        """Test filtering routes by category"""
        # First get all categories that have routes
        all_routes = requests.get(f"{BASE_URL}/api/routes").json()
        categories = set(route['category'] for route in all_routes)

        # Test filtering by first available category
        test_category = list(categories)[0]
        response = requests.get(f"{BASE_URL}/api/routes", params={'category': test_category})
        assert response.status_code == 200
        data = response.json()

        # All returned routes should have the requested category
        for route in data:
            assert route['category'] == test_category

        print(f"✓ Category filter works: {test_category} returned {len(data)} routes")

    def test_routes_region_filter(self):
        """Test filtering routes by region"""
        all_routes = requests.get(f"{BASE_URL}/api/routes").json()
        regions = [route.get('region') for route in all_routes if route.get('region')]

        if regions:
            test_region = regions[0]
            response = requests.get(f"{BASE_URL}/api/routes", params={'region': test_region})
            assert response.status_code == 200
            data = response.json()

            for route in data:
                assert route.get('region') == test_region
            print(f"✓ Region filter works: {test_region} returned {len(data)} routes")
        else:
            print("⚠ No routes with region found - skipping region filter test")

    def test_get_single_route(self):
        """Test GET /routes/{id} returns single route"""
        # First get a route ID
        all_routes = requests.get(f"{BASE_URL}/api/routes").json()
        route_id = all_routes[0]['id']

        response = requests.get(f"{BASE_URL}/api/routes/{route_id}")
        assert response.status_code == 200
        route = response.json()

        assert route['id'] == route_id
        assert 'name' in route
        assert 'description' in route
        print(f"✓ Single route fetch works: {route['name']}")

    def test_get_nonexistent_route(self):
        """Test 404 for non-existent route"""
        response = requests.get(f"{BASE_URL}/api/routes/nonexistent-id-12345")
        assert response.status_code == 404
        print("✓ Non-existent route returns 404")

    def test_route_items(self):
        """Test GET /routes/{id}/items endpoint"""
        all_routes = requests.get(f"{BASE_URL}/api/routes").json()
        route_id = all_routes[0]['id']

        response = requests.get(f"{BASE_URL}/api/routes/{route_id}/items")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Route items endpoint works: returned {len(data)} items")


class TestCategoriesAndRegions:
    """Test categories and regions endpoints - used by Routes tab filters"""

    def test_get_categories(self):
        """Test categories endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)
        assert len(data) > 0

        # Validate category structure
        category = data[0]
        assert 'id' in category
        assert 'name' in category
        print(f"✓ Categories endpoint returned {len(data)} categories")

    def test_get_regions(self):
        """Test regions endpoint returns data"""
        response = requests.get(f"{BASE_URL}/api/regions")
        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)
        assert len(data) > 0

        region = data[0]
        assert 'id' in region
        assert 'name' in region
        print(f"✓ Regions endpoint returned {len(data)} regions")


class TestHeritageEndpoints:
    """Test heritage items - related to routes functionality"""

    def test_get_heritage_items(self):
        """Test heritage items endpoint"""
        response = requests.get(f"{BASE_URL}/api/heritage")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Heritage items endpoint returned {len(data)} items")

    def test_get_heritage_by_category(self):
        """Test heritage items by category"""
        response = requests.get(f"{BASE_URL}/api/heritage/category/festas")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Heritage by category returned {len(data)} items")


class TestStatsEndpoint:
    """Statistics endpoint tests"""

    def test_stats_endpoint(self):
        """Test stats endpoint returns expected data"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()

        assert 'total_items' in data
        assert 'total_routes' in data
        assert 'categories' in data
        assert 'regions' in data

        print(f"✓ Stats: {data['total_items']} items, {data['total_routes']} routes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
