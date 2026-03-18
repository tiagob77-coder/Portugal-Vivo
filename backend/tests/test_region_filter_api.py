"""
Backend API tests for Region Filter Feature
Tests the /api/map/items endpoint with region parameter
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://current-state-check.preview.emergentagent.com').rstrip('/')

class TestMapItemsRegionFilter:
    """Tests for /api/map/items endpoint with region filter"""

    def test_map_items_without_region_returns_all(self):
        """Test that /api/map/items without region param returns all POIs"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should return max 1500 items (API limit)
        assert len(data) > 500, f"Expected more than 500 items, got {len(data)}"
        print(f"✓ Without filter: {len(data)} POIs returned")

    def test_map_items_filter_norte(self):
        """Test region=norte filter returns only Norte region POIs"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=norte")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should return Norte region POIs"

        # Verify all items are from Norte region
        for item in data[:10]:  # Sample first 10
            assert item.get('region') == 'norte', f"Item {item.get('name')} has region {item.get('region')}, expected 'norte'"
        print(f"✓ Norte filter: {len(data)} POIs returned")

    def test_map_items_filter_algarve(self):
        """Test region=algarve filter returns only Algarve region POIs"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=algarve")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should return Algarve region POIs"

        # Verify all items are from Algarve region
        for item in data[:10]:  # Sample first 10
            assert item.get('region') == 'algarve', f"Item {item.get('name')} has region {item.get('region')}, expected 'algarve'"
        print(f"✓ Algarve filter: {len(data)} POIs returned")

    def test_map_items_filter_lisboa(self):
        """Test region=lisboa filter returns only Lisboa region POIs"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=lisboa")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should return Lisboa region POIs"

        for item in data[:10]:
            assert item.get('region') == 'lisboa', f"Item {item.get('name')} has region {item.get('region')}, expected 'lisboa'"
        print(f"✓ Lisboa filter: {len(data)} POIs returned")

    def test_map_items_filter_centro(self):
        """Test region=centro filter returns only Centro region POIs"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=centro")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should return Centro region POIs"

        for item in data[:10]:
            assert item.get('region') == 'centro', f"Item {item.get('name')} has region {item.get('region')}, expected 'centro'"
        print(f"✓ Centro filter: {len(data)} POIs returned")

    def test_map_items_filter_alentejo(self):
        """Test region=alentejo filter"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=alentejo")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Alentejo filter: {len(data)} POIs returned")

    def test_map_items_filter_acores(self):
        """Test region=acores filter"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=acores")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Açores filter: {len(data)} POIs returned")

    def test_map_items_filter_madeira(self):
        """Test region=madeira filter"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=madeira")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Madeira filter: {len(data)} POIs returned")

    def test_filtered_count_less_than_total(self):
        """Verify filtered results are less than unfiltered total"""
        response_all = requests.get(f"{BASE_URL}/api/map/items")
        response_norte = requests.get(f"{BASE_URL}/api/map/items?region=norte")

        assert response_all.status_code == 200
        assert response_norte.status_code == 200

        total_count = len(response_all.json())
        norte_count = len(response_norte.json())

        assert norte_count < total_count, f"Filtered count ({norte_count}) should be less than total ({total_count})"
        print(f"✓ Norte ({norte_count}) < Total ({total_count})")

    def test_invalid_region_returns_empty(self):
        """Test that invalid region returns empty array (not error)"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=invalidregion")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0, "Invalid region should return empty array"
        print("✓ Invalid region returns empty array")

    def test_map_items_with_region_and_categories(self):
        """Test combining region filter with categories filter"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=norte&categories=festas,gastronomia")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

        # Verify all items are from Norte and in specified categories
        for item in data[:10]:
            assert item.get('region') == 'norte'
            assert item.get('category') in ['festas', 'gastronomia']
        print(f"✓ Norte + categories filter: {len(data)} POIs returned")


class TestSurfAPI:
    """Tests for Surf Conditions API"""

    def test_surf_all_spots(self):
        """Test /api/surf/conditions returns surf data"""
        response = requests.get(f"{BASE_URL}/api/surf/conditions")
        assert response.status_code == 200
        data = response.json()
        assert 'spots' in data or isinstance(data, list)
        print("✓ Surf conditions API working")


class TestWeatherAPI:
    """Tests for Weather API"""

    def test_weather_forecast(self):
        """Test weather forecast endpoint"""
        response = requests.get(f"{BASE_URL}/api/weather/forecast")
        assert response.status_code == 200
        data = response.json()
        assert 'forecasts' in data or 'data' in data or isinstance(data, list)
        print("✓ Weather forecast API working")


class TestSafetyAPI:
    """Tests for Safety API"""

    def test_safety_check(self):
        """Test safety check endpoint"""
        # Use Lisboa coordinates
        response = requests.get(f"{BASE_URL}/api/safety/check?lat=38.7223&lng=-9.1393")
        assert response.status_code == 200
        data = response.json()
        assert 'safety_level' in data
        print(f"✓ Safety API working - level: {data.get('safety_level')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
