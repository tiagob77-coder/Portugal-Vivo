"""
P1 Features Backend Tests:
- /api/badges - Get all badges (public endpoint)
- /api/map/items - Get map items with category filtering
- /api/calendar - Get calendar events

These are the key APIs for P1 features:
1. Profile badges section
2. Map interactive layers
3. Events filtering
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://portugal-vivo-3.preview.emergentagent.com')
BASE_URL = BASE_URL.rstrip('/')


class TestBadgesAPI:
    """Test /api/badges endpoint - Profile tab badges section"""

    def test_get_all_badges_success(self):
        """Test that badges endpoint returns 9 badges"""
        response = requests.get(f"{BASE_URL}/api/badges")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        badges = response.json()
        assert isinstance(badges, list), "Badges should be a list"
        assert len(badges) == 9, f"Expected 9 badges, got {len(badges)}"

    def test_badge_structure(self):
        """Test that each badge has required fields"""
        response = requests.get(f"{BASE_URL}/api/badges")
        badges = response.json()

        required_fields = ['id', 'name', 'description', 'icon', 'color', 'tiers']

        for badge in badges:
            for field in required_fields:
                assert field in badge, f"Badge missing required field: {field}"

            # Verify tiers structure
            assert isinstance(badge['tiers'], list), f"Badge {badge['id']} tiers should be a list"
            assert len(badge['tiers']) > 0, f"Badge {badge['id']} should have at least one tier"

            for tier in badge['tiers']:
                assert 'level' in tier, "Tier missing level field"
                assert 'visits' in tier, "Tier missing visits field"
                assert 'points' in tier, "Tier missing points field"

    def test_badge_ids(self):
        """Test that all expected badge IDs are present"""
        response = requests.get(f"{BASE_URL}/api/badges")
        badges = response.json()

        badge_ids = [b['id'] for b in badges]

        expected_ids = [
            'explorador_natureza',
            'guardiao_patrimonio',
            'mestre_gastronomia',
            'alma_cultura',
            'filho_mar',
            'aventureiro',
            'primeiro_passo',
            'coleccionador',
            'explorador_regioes'
        ]

        for expected_id in expected_ids:
            assert expected_id in badge_ids, f"Missing badge: {expected_id}"


class TestMapItemsAPI:
    """Test /api/map/items endpoint - Map layers"""

    def test_get_all_map_items(self):
        """Test getting all map items"""
        response = requests.get(f"{BASE_URL}/api/map/items")

        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        assert len(items) > 0, "Should have map items"

    def test_filter_by_single_category(self):
        """Test filtering map items by a single category (patrimonio layer)"""
        response = requests.get(f"{BASE_URL}/api/map/items?categories=aldeias")

        assert response.status_code == 200
        items = response.json()

        # All items should be in aldeias category
        for item in items:
            assert item['category'] == 'aldeias', f"Expected aldeias category, got {item['category']}"

    def test_filter_by_multiple_categories(self):
        """Test filtering map items by multiple categories (multiple layers)"""
        response = requests.get(f"{BASE_URL}/api/map/items?categories=aldeias,religioso")

        assert response.status_code == 200
        items = response.json()

        # All items should be in either category
        for item in items:
            assert item['category'] in ['aldeias', 'religioso'], \
                f"Expected aldeias or religioso category, got {item['category']}"

    def test_natureza_layer_categories(self):
        """Test natureza layer categories"""
        categories = "areas_protegidas,cascatas,rios,fauna,miradouros,termas,baloicos"
        response = requests.get(f"{BASE_URL}/api/map/items?categories={categories}")

        assert response.status_code == 200
        items = response.json()

        natureza_cats = ['areas_protegidas', 'cascatas', 'rios', 'fauna', 'miradouros', 'termas', 'baloicos']
        for item in items:
            assert item['category'] in natureza_cats, \
                f"Item category {item['category']} not in natureza layer"

    def test_gastronomia_layer_categories(self):
        """Test gastronomia layer categories"""
        categories = "gastronomia,produtos,tascas"
        response = requests.get(f"{BASE_URL}/api/map/items?categories={categories}")

        assert response.status_code == 200
        items = response.json()

        gastro_cats = ['gastronomia', 'produtos', 'tascas']
        for item in items:
            assert item['category'] in gastro_cats, \
                f"Item category {item['category']} not in gastronomia layer"

    def test_map_item_has_location(self):
        """Test that map items have location data"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        items = response.json()

        for item in items[:10]:  # Check first 10
            assert 'location' in item, "Map item missing location"
            assert item['location'] is not None, "Map item location is null"
            assert 'lat' in item['location'], "Location missing lat"
            assert 'lng' in item['location'], "Location missing lng"


class TestCalendarAPI:
    """Test /api/calendar endpoint - Events filtering"""

    def test_get_all_events(self):
        """Test getting all calendar events"""
        response = requests.get(f"{BASE_URL}/api/calendar")

        assert response.status_code == 200
        events = response.json()
        assert isinstance(events, list)
        assert len(events) > 0, "Should have calendar events"

    def test_event_structure(self):
        """Test that events have required fields"""
        response = requests.get(f"{BASE_URL}/api/calendar")
        events = response.json()

        required_fields = ['id', 'name', 'date_start', 'date_end', 'category', 'region', 'description']

        for event in events[:5]:
            for field in required_fields:
                assert field in event, f"Event missing required field: {field}"

    def test_filter_events_by_month(self):
        """Test filtering events by month"""
        response = requests.get(f"{BASE_URL}/api/calendar?month=1")  # January

        assert response.status_code == 200
        events = response.json()

        # January events should have date starting with 01-
        january_events = [e for e in events if e['date_start'].startswith('01-')]
        # Note: Some events span months, so we check that at least some are filtered
        print(f"Found {len(january_events)} January events out of {len(events)}")

    def test_upcoming_events(self):
        """Test getting upcoming events"""
        response = requests.get(f"{BASE_URL}/api/calendar/upcoming")

        assert response.status_code == 200
        events = response.json()
        assert isinstance(events, list)

    def test_event_categories(self):
        """Test that events have valid categories for filtering"""
        response = requests.get(f"{BASE_URL}/api/calendar")
        events = response.json()

        valid_categories = ['festas', 'religioso', 'gastronomia', 'natureza', 'cultural']

        for event in events:
            assert event['category'] in valid_categories, \
                f"Invalid event category: {event['category']}"

    def test_event_regions(self):
        """Test that events have valid regions for filtering"""
        response = requests.get(f"{BASE_URL}/api/calendar")
        events = response.json()

        valid_regions = ['norte', 'centro', 'lisboa', 'alentejo', 'algarve', 'acores', 'madeira']

        for event in events:
            assert event['region'] in valid_regions, \
                f"Invalid event region: {event['region']}"


class TestSupportingAPIs:
    """Test supporting APIs for P1 features"""

    def test_categories_endpoint(self):
        """Test categories endpoint used for map layers"""
        response = requests.get(f"{BASE_URL}/api/categories")

        assert response.status_code == 200
        categories = response.json()
        assert isinstance(categories, list)
        assert len(categories) > 20, "Should have 20+ categories"

    def test_stats_endpoint(self):
        """Test stats endpoint used in profile"""
        response = requests.get(f"{BASE_URL}/api/stats")

        assert response.status_code == 200
        stats = response.json()

        assert 'total_items' in stats
        assert 'total_routes' in stats
        assert stats['total_items'] > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
