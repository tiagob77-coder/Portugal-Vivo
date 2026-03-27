"""
Test region filter and navigation functionality
Tests /api/map/items with region parameter
"""
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://project-analyzer-131.preview.emergentagent.com')

class TestRegionFilterAPI:
    """Tests for region-based POI filtering"""

    def test_map_items_norte_region(self):
        """Test GET /api/map/items?region=norte returns filtered results"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=norte")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Norte region should have POIs"

        # Verify all items are from norte region
        for item in data[:10]:
            assert item.get('region') == 'norte', f"Item {item.get('name')} should be in norte region"

        print(f"✓ Norte region: {len(data)} POIs")

    def test_map_items_centro_region(self):
        """Test GET /api/map/items?region=centro returns filtered results"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=centro")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Centro region should have POIs"

        # Verify items are from centro region
        for item in data[:10]:
            assert item.get('region') == 'centro', f"Item {item.get('name')} should be in centro region"

        print(f"✓ Centro region: {len(data)} POIs")

    def test_map_items_algarve_region(self):
        """Test GET /api/map/items?region=algarve returns filtered results"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=algarve")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Algarve region should have POIs"

        # Verify items are from algarve region
        for item in data[:10]:
            assert item.get('region') == 'algarve', f"Item {item.get('name')} should be in algarve region"

        print(f"✓ Algarve region: {len(data)} POIs")

    def test_map_items_lisboa_region(self):
        """Test GET /api/map/items?region=lisboa returns filtered results"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=lisboa")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)

        # Verify items are from lisboa region
        for item in data[:10]:
            assert item.get('region') == 'lisboa', f"Item {item.get('name')} should be in lisboa region"

        print(f"✓ Lisboa region: {len(data)} POIs")

    def test_map_items_alentejo_region(self):
        """Test GET /api/map/items?region=alentejo returns filtered results"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=alentejo")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)

        for item in data[:10]:
            assert item.get('region') == 'alentejo', f"Item {item.get('name')} should be in alentejo region"

        print(f"✓ Alentejo region: {len(data)} POIs")

    def test_map_items_acores_region(self):
        """Test GET /api/map/items?region=acores returns filtered results"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=acores")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)

        print(f"✓ Açores region: {len(data)} POIs")

    def test_map_items_madeira_region(self):
        """Test GET /api/map/items?region=madeira returns filtered results"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=madeira")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)

        print(f"✓ Madeira region: {len(data)} POIs")

    def test_different_regions_return_different_results(self):
        """Test that different regions return different POI sets"""
        norte_response = requests.get(f"{BASE_URL}/api/map/items?region=norte")
        algarve_response = requests.get(f"{BASE_URL}/api/map/items?region=algarve")

        assert norte_response.status_code == 200
        assert algarve_response.status_code == 200

        norte_data = norte_response.json()
        algarve_data = algarve_response.json()

        # Get IDs from each region
        norte_ids = {item['id'] for item in norte_data}
        algarve_ids = {item['id'] for item in algarve_data}

        # There should be no overlap
        overlap = norte_ids.intersection(algarve_ids)
        assert len(overlap) == 0, f"Norte and Algarve should have no overlapping POIs, found: {len(overlap)}"

        print(f"✓ Norte ({len(norte_data)} POIs) and Algarve ({len(algarve_data)} POIs) have distinct results")

    def test_map_items_without_region_returns_all(self):
        """Test GET /api/map/items without region returns all POIs"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)

        # Should have more POIs than any single region
        norte_response = requests.get(f"{BASE_URL}/api/map/items?region=norte")
        norte_data = norte_response.json()

        assert len(data) >= len(norte_data), "All POIs should be >= Norte region POIs"

        print(f"✓ All regions: {len(data)} POIs, Norte alone: {len(norte_data)} POIs")

    def test_map_item_structure(self):
        """Test that map items have required fields"""
        response = requests.get(f"{BASE_URL}/api/map/items?region=norte")
        assert response.status_code == 200

        data = response.json()
        assert len(data) > 0

        item = data[0]
        required_fields = ['id', 'name', 'category', 'region', 'location']

        for field in required_fields:
            assert field in item, f"Missing required field: {field}"

        # Check location has lat/lng
        assert 'lat' in item['location'], "Location should have lat"
        assert 'lng' in item['location'], "Location should have lng"

        print(f"✓ Map item structure is correct with fields: {list(item.keys())}")


class TestMapItemsWithCategories:
    """Test map items with category and region combined"""

    def test_map_items_with_category_and_region(self):
        """Test filtering by both category and region"""
        response = requests.get(f"{BASE_URL}/api/map/items?categories=lendas&region=norte")
        assert response.status_code == 200

        data = response.json()
        assert isinstance(data, list)

        for item in data:
            assert item.get('region') == 'norte', "All items should be in norte region"
            assert item.get('category') == 'lendas', "All items should be lendas category"

        print(f"✓ Combined filter (lendas + norte): {len(data)} POIs")
