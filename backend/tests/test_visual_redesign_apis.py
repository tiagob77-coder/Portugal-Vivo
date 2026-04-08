"""
Backend API Tests for Visual Redesign - Testing that theme-related endpoints work
and all required APIs for the UI components are responding correctly.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://portugal-vivo-3.preview.emergentagent.com').rstrip('/')


class TestStatsAPI:
    """Stats API - used on Welcome and Profile pages"""

    def test_get_stats(self):
        """Test stats endpoint returns required fields for theme display"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_items" in data
        assert "total_routes" in data
        assert data["total_items"] > 0
        print(f"Stats: {data['total_items']} items, {data['total_routes']} routes")


class TestDiscoveryFeed:
    """Discovery Feed API - main data for Descobrir tab"""

    def test_get_discovery_feed(self):
        """Test discovery feed returns items for display (POST endpoint)"""
        # Discovery feed is a POST endpoint with body params
        response = requests.post(f"{BASE_URL}/api/discover/feed", json={"limit": 10})
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        print(f"Discovery feed returned {len(data.get('items', []))} items")

    def test_get_poi_do_dia(self):
        """Test POI do Dia endpoint for featured card"""
        response = requests.get(f"{BASE_URL}/api/poi-do-dia")
        assert response.status_code == 200
        data = response.json()
        # POI do dia may or may not have data
        if data.get("has_poi"):
            assert "poi" in data
            assert "category_label" in data
            print(f"POI do Dia: {data['poi'].get('name', 'N/A')}")
        else:
            print("POI do Dia: No featured POI today")


class TestCollectionsAPI:
    """Collections/Enciclopedia API - for coleccoes page"""

    def test_collections_overview(self):
        """Test collections overview returns groups and collections"""
        response = requests.get(f"{BASE_URL}/api/collections/overview")
        assert response.status_code == 200
        data = response.json()
        assert "groups" in data
        assert "total_items" in data
        assert len(data["groups"]) == 5  # 5 collection groups
        print(f"Collections: {data['total_items']} total items in {len(data['groups'])} groups")

    def test_collections_browse(self):
        """Test browsing a specific collection"""
        response = requests.get(f"{BASE_URL}/api/collections/browse/castelos?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "collection" in data
        print(f"Castelos collection: {len(data['items'])} items")


class TestBadgesAPI:
    """Badges API - for Profile page achievements section"""

    def test_get_badges(self):
        """Test badges endpoint returns available badges"""
        response = requests.get(f"{BASE_URL}/api/badges")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            badge = data[0]
            assert "id" in badge
            assert "name" in badge
            assert "icon" in badge
        print(f"Badges: {len(data)} available badges")


class TestCategoriesAPI:
    """Categories API - for map layers and filters"""

    def test_get_categories(self):
        """Test categories endpoint returns category list"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"Categories: {len(data)} categories available")


class TestMapAPI:
    """Map API - for Mapa tab"""

    def test_get_map_items(self):
        """Test map items endpoint returns POIs with locations"""
        response = requests.get(f"{BASE_URL}/api/map/items?categories=aldeias")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            item = data[0]
            assert "id" in item
            assert "name" in item
        print(f"Map items: {len(data)} items for aldeias category")


class TestCalendarAPI:
    """Calendar API - for Eventos tab"""

    def test_get_calendar_events(self):
        """Test calendar endpoint returns events"""
        response = requests.get(f"{BASE_URL}/api/calendar?month=2")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Calendar events: {len(data)} events in February")

    def test_get_upcoming_events(self):
        """Test upcoming events endpoint"""
        response = requests.get(f"{BASE_URL}/api/calendar/upcoming?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Upcoming events: {len(data)} events")


class TestTrendingAPI:
    """Trending API - for trending section on Descobrir"""

    def test_get_trending_items(self):
        """Test trending items endpoint"""
        response = requests.get(f"{BASE_URL}/api/discover/trending?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        print(f"Trending: {len(data.get('items', []))} trending items")


class TestEncyclopediaAPI:
    """Encyclopedia Universes API - for Enciclopedia Viva section"""

    def test_get_universes(self):
        """Test encyclopedia universes endpoint"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/universes")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            universe = data[0]
            assert "id" in universe
            assert "name" in universe
        print(f"Encyclopedia: {len(data)} universes")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
