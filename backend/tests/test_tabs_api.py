"""
Backend API Tests for Tab Navigation Features
Tests for: calendar, routes, map/items endpoints
Used by: Descobrir, Mapa, Planeador, Eventos tabs
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://current-app-1.preview.emergentagent.com')


class TestCalendarAPI:
    """Tests for Events Tab (Eventos) - Calendar API"""

    def test_get_all_calendar_events(self):
        """Test GET /api/calendar returns all events"""
        response = requests.get(f"{BASE_URL}/api/calendar")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

        # Verify event structure
        event = data[0]
        assert "id" in event
        assert "name" in event
        assert "date_start" in event
        assert "date_end" in event
        assert "category" in event
        assert "region" in event
        assert "description" in event
        print(f"SUCCESS: Calendar API returned {len(data)} events")

    def test_calendar_events_by_month(self):
        """Test GET /api/calendar?month=6 filters by month"""
        response = requests.get(f"{BASE_URL}/api/calendar?month=6")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        # June events should exist (Santos Populares)
        june_events = [e for e in data if e["date_start"].startswith("06")]
        assert len(june_events) > 0
        print(f"SUCCESS: Calendar API filtered to {len(data)} events for June")

    def test_upcoming_events(self):
        """Test GET /api/calendar/upcoming returns upcoming events"""
        response = requests.get(f"{BASE_URL}/api/calendar/upcoming?limit=5")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 5
        print(f"SUCCESS: Upcoming events API returned {len(data)} events")

    def test_calendar_event_categories(self):
        """Verify events have valid categories"""
        response = requests.get(f"{BASE_URL}/api/calendar")
        assert response.status_code == 200

        data = response.json()
        valid_categories = {"festas", "religioso", "gastronomia", "natureza", "cultural"}

        for event in data:
            assert event["category"] in valid_categories, f"Invalid category: {event['category']}"
        print(f"SUCCESS: All {len(data)} events have valid categories")


class TestRoutesAPI:
    """Tests for Planner Tab (Planeador) - Routes API"""

    def test_get_all_routes(self):
        """Test GET /api/routes returns all routes"""
        response = requests.get(f"{BASE_URL}/api/routes")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

        # Verify route structure
        route = data[0]
        assert "id" in route
        assert "name" in route
        assert "description" in route
        assert "category" in route
        print(f"SUCCESS: Routes API returned {len(data)} routes")

    def test_filter_routes_by_category(self):
        """Test GET /api/routes?category=vinho filters by category"""
        response = requests.get(f"{BASE_URL}/api/routes?category=vinho")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        # All returned routes should be wine routes
        for route in data:
            assert route["category"] == "vinho"
        print(f"SUCCESS: Routes filtered by category returned {len(data)} wine routes")

    def test_filter_routes_by_region(self):
        """Test GET /api/routes?region=norte filters by region"""
        response = requests.get(f"{BASE_URL}/api/routes?region=norte")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        # All returned routes should be in Norte region
        for route in data:
            assert route.get("region") == "norte"
        print(f"SUCCESS: Routes filtered by region returned {len(data)} routes from Norte")

    def test_route_categories(self):
        """Verify routes have valid categories"""
        response = requests.get(f"{BASE_URL}/api/routes")
        assert response.status_code == 200

        data = response.json()
        categories_found = set(route["category"] for route in data)
        print(f"SUCCESS: Found route categories: {categories_found}")
        assert len(categories_found) > 0


class TestMapItemsAPI:
    """Tests for Map Tab (Mapa) - Map Items API"""

    def test_get_all_map_items(self):
        """Test GET /api/map/items returns items with locations"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

        # Verify all items have location
        for item in data:
            assert "location" in item
            if item["location"]:
                assert "lat" in item["location"]
                assert "lng" in item["location"]
        print(f"SUCCESS: Map API returned {len(data)} items with locations")

    def test_filter_map_items_by_categories(self):
        """Test GET /api/map/items?categories=lendas,festas filters by categories"""
        response = requests.get(f"{BASE_URL}/api/map/items?categories=lendas,festas")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)

        # All items should be in specified categories
        for item in data:
            assert item["category"] in ["lendas", "festas"]
        print(f"SUCCESS: Map items filtered by categories returned {len(data)} items")

    def test_filter_map_items_by_region(self):
        """Test GET /api/map/items?region=norte filters by region"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=norte")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)

        for item in data:
            assert item["region"] == "norte"
        print(f"SUCCESS: Map items filtered by region returned {len(data)} items from Norte")

    def test_map_items_structure(self):
        """Verify map items have required fields"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        assert response.status_code == 200

        data = response.json()
        if len(data) > 0:
            item = data[0]
            required_fields = ["id", "name", "category", "region", "location"]
            for field in required_fields:
                assert field in item, f"Missing field: {field}"
        print("SUCCESS: Map items have correct structure")


class TestHeritageAPI:
    """Tests for Discover Tab (Descobrir) - Heritage API"""

    def test_get_heritage_items(self):
        """Test GET /api/heritage returns heritage items"""
        response = requests.get(f"{BASE_URL}/api/heritage?limit=10")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

        # Verify item structure
        item = data[0]
        assert "id" in item
        assert "name" in item
        assert "description" in item
        assert "category" in item
        assert "region" in item
        print(f"SUCCESS: Heritage API returned {len(data)} items")

    def test_filter_heritage_by_category(self):
        """Test GET /api/heritage?category=lendas filters by category"""
        response = requests.get(f"{BASE_URL}/api/heritage?category=lendas&limit=10")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)

        for item in data:
            assert item["category"] == "lendas"
        print(f"SUCCESS: Heritage filtered by category returned {len(data)} lendas")

    def test_search_heritage(self):
        """Test GET /api/heritage?search=lisboa searches items"""
        response = requests.get(f"{BASE_URL}/api/heritage?search=lisboa&limit=10")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        print(f"SUCCESS: Heritage search returned {len(data)} results for 'lisboa'")


class TestCategoriesAndRegions:
    """Tests for categories and regions endpoints"""

    def test_get_categories(self):
        """Test GET /api/categories returns all categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 20  # Should have 20+ categories

        # Verify category structure
        category = data[0]
        assert "id" in category
        assert "name" in category
        assert "icon" in category
        assert "color" in category
        print(f"SUCCESS: Categories API returned {len(data)} categories")

    def test_get_regions(self):
        """Test GET /api/regions returns all regions"""
        response = requests.get(f"{BASE_URL}/api/regions")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 7  # Should have 7 regions

        # Verify expected regions
        region_ids = [r["id"] for r in data]
        expected_regions = ["norte", "centro", "lisboa", "alentejo", "algarve", "acores", "madeira"]
        for region in expected_regions:
            assert region in region_ids
        print(f"SUCCESS: Regions API returned {len(data)} regions")


class TestDiscoveryFeed:
    """Tests for Discovery Feed (Descobrir Tab)"""

    def test_trending_items(self):
        """Test GET /api/trending returns trending items"""
        response = requests.get(f"{BASE_URL}/api/trending?limit=10")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, dict)
        assert "items" in data
        print(f"SUCCESS: Trending API returned {len(data.get('items', []))} items")

    def test_seasonal_content(self):
        """Test GET /api/seasonal returns seasonal content"""
        response = requests.get(f"{BASE_URL}/api/seasonal")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, dict)
        assert "season" in data
        assert data["season"] in ["winter", "spring", "summer", "autumn"]
        print(f"SUCCESS: Seasonal API returned content for {data['season']}")


class TestStats:
    """Tests for stats endpoint"""

    def test_get_stats(self):
        """Test GET /api/stats returns statistics"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200

        data = response.json()
        assert "total_items" in data
        assert "total_routes" in data
        assert "categories" in data
        assert "regions" in data
        print(f"SUCCESS: Stats API - {data['total_items']} items, {data['total_routes']} routes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
