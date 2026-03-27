"""
Test Map Visualization API endpoints
Testing: Light tiles, MarkerCluster, Heatmap IQ, Satellite view, Mode switching
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://project-analyzer-131.preview.emergentagent.com')


class TestMapAPI:
    """Test Map Items API endpoint"""

    def test_map_items_returns_200(self):
        """Test that map items endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Map items endpoint returns 200")

    def test_map_items_returns_array(self):
        """Test that map items returns an array"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) > 0, "Expected at least one item"
        print(f"✓ Map items returns array with {len(data)} items")

    def test_map_items_have_required_fields(self):
        """Test that map items have required fields for map display"""
        response = requests.get(f"{BASE_URL}/api/map/items?categories=aldeias")
        data = response.json()
        assert len(data) > 0, "No items returned"

        item = data[0]
        required_fields = ['id', 'name', 'category', 'region', 'location']
        for field in required_fields:
            assert field in item, f"Missing required field: {field}"

        # Check location has lat/lng
        assert 'lat' in item['location'], "Location missing lat"
        assert 'lng' in item['location'], "Location missing lng"
        print(f"✓ Map items have all required fields: {required_fields}")

    def test_map_items_have_iq_score(self):
        """Test that map items have iq_score field for heatmap visualization"""
        response = requests.get(f"{BASE_URL}/api/map/items?categories=aldeias")
        data = response.json()

        # Check that iq_score field exists
        items_with_iq = [item for item in data if item.get('iq_score') is not None]
        assert len(items_with_iq) > 0, "No items have iq_score"

        # Verify iq_score is numeric
        sample = items_with_iq[0]
        assert isinstance(sample['iq_score'], (int, float)), f"iq_score should be numeric, got {type(sample['iq_score'])}"
        print(f"✓ {len(items_with_iq)}/{len(data)} items have iq_score field")

    def test_map_items_category_filter(self):
        """Test category filtering for layer chips"""
        # Test single category
        response = requests.get(f"{BASE_URL}/api/map/items?categories=aldeias")
        data = response.json()
        categories = set(item['category'] for item in data)
        assert categories == {'aldeias'}, f"Expected only 'aldeias', got {categories}"
        print(f"✓ Category filter works: {len(data)} items for 'aldeias'")

        # Test multiple categories (for multi-layer)
        response = requests.get(f"{BASE_URL}/api/map/items?categories=aldeias,gastronomia")
        data = response.json()
        categories = set(item['category'] for item in data)
        assert 'aldeias' in categories or 'gastronomia' in categories, "Multi-category filter failed"
        print(f"✓ Multi-category filter works: {len(data)} items for 'aldeias,gastronomia'")

    def test_map_items_patrimonio_layer(self):
        """Test patrimonio layer categories"""
        patrimonio_categories = "aldeias,arqueologia,arte,religioso,moinhos,lendas"
        response = requests.get(f"{BASE_URL}/api/map/items?categories={patrimonio_categories}")
        data = response.json()

        assert len(data) > 100, f"Expected >100 items for patrimonio layer, got {len(data)}"
        print(f"✓ Património layer returns {len(data)} items")

    def test_map_items_natureza_layer(self):
        """Test natureza layer categories"""
        natureza_categories = "areas_protegidas,cascatas,rios,fauna,miradouros,termas,baloicos"
        response = requests.get(f"{BASE_URL}/api/map/items?categories={natureza_categories}")
        data = response.json()

        assert len(data) > 50, f"Expected >50 items for natureza layer, got {len(data)}"
        print(f"✓ Natureza layer returns {len(data)} items")

    def test_map_items_gastronomia_layer(self):
        """Test gastronomia layer categories"""
        gastronomia_categories = "gastronomia,produtos,tascas"
        response = requests.get(f"{BASE_URL}/api/map/items?categories={gastronomia_categories}")
        data = response.json()

        assert len(data) > 100, f"Expected >100 items for gastronomia layer, got {len(data)}"
        print(f"✓ Gastronomia layer returns {len(data)} items")


class TestMapItemsForVisualization:
    """Test map items data quality for different visualization modes"""

    def test_items_have_valid_coordinates(self):
        """Test that items have valid GPS coordinates for clustering"""
        response = requests.get(f"{BASE_URL}/api/map/items?categories=aldeias")
        data = response.json()

        invalid_coords = []
        for item in data:
            lat = item['location']['lat']
            lng = item['location']['lng']
            # Portugal extended bounding box including Açores and Madeira:
            # Mainland: lat 36-42, lng -10 to -6
            # Açores: lat 36-40, lng -31 to -25
            # Madeira: lat 32-33, lng -17 to -16
            is_mainland = (36 <= lat <= 43) and (-12 <= lng <= -5)
            is_acores = (36 <= lat <= 40) and (-32 <= lng <= -24)
            is_madeira = (32 <= lat <= 34) and (-18 <= lng <= -15)

            if not (is_mainland or is_acores or is_madeira):
                invalid_coords.append({
                    'name': item['name'],
                    'lat': lat,
                    'lng': lng
                })

        if invalid_coords:
            print(f"Warning: {len(invalid_coords)} items with unexpected coordinates")

        # Should have no invalid coordinates with extended box
        assert len(invalid_coords) == 0, f"Found items with invalid coordinates: {invalid_coords[:5]}"
        print(f"✓ All {len(data)} items have valid coordinates (mainland, Açores, or Madeira)")

    def test_iq_scores_range_for_heatmap(self):
        """Test that IQ scores are in valid range for heatmap gradient"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        data = response.json()

        iq_scores = [item['iq_score'] for item in data if item.get('iq_score') is not None]

        if iq_scores:
            min_score = min(iq_scores)
            max_score = max(iq_scores)
            avg_score = sum(iq_scores) / len(iq_scores)

            print(f"IQ Score range: {min_score:.1f} - {max_score:.1f}, avg: {avg_score:.1f}")

            # Scores should be 0-100 for heatmap normalization
            assert 0 <= min_score <= 100, f"Min score {min_score} out of expected range"
            assert 0 <= max_score <= 100, f"Max score {max_score} out of expected range"
            print("✓ IQ scores in valid range for heatmap visualization")
        else:
            pytest.skip("No items with IQ scores found")

    def test_items_have_description_for_popup(self):
        """Test that items have description for popup display"""
        response = requests.get(f"{BASE_URL}/api/map/items?categories=aldeias")
        data = response.json()

        items_with_desc = [item for item in data if item.get('description')]

        coverage = len(items_with_desc) / len(data) * 100
        print(f"✓ {coverage:.1f}% of items have description for popup display")

        assert coverage > 50, f"Only {coverage:.1f}% of items have description"


class TestHeritageDetail:
    """Test heritage detail endpoint for Ver Detalhes link"""

    def test_heritage_item_exists(self):
        """Test that heritage detail endpoint returns item data"""
        # First get an item ID from map items
        response = requests.get(f"{BASE_URL}/api/map/items?categories=aldeias")
        data = response.json()
        item_id = data[0]['id']

        # Fetch detail
        detail_response = requests.get(f"{BASE_URL}/api/heritage/{item_id}")
        assert detail_response.status_code == 200, f"Expected 200, got {detail_response.status_code}"

        detail = detail_response.json()
        assert detail['id'] == item_id, "ID mismatch"
        assert 'name' in detail, "Missing name in detail"
        assert 'description' in detail, "Missing description in detail"
        print(f"✓ Heritage detail endpoint works for item: {detail['name']}")

    def test_heritage_item_not_found(self):
        """Test 404 for non-existent item"""
        response = requests.get(f"{BASE_URL}/api/heritage/non-existent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Heritage detail returns 404 for non-existent item")


class TestMapStatistics:
    """Test map statistics for stats row display"""

    def test_stats_endpoint(self):
        """Test stats endpoint returns category counts"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert 'total_items' in data, "Missing total_items"
        assert 'categories' in data, "Missing categories"

        print(f"✓ Stats endpoint returns total_items: {data['total_items']}")
        print(f"  Categories with counts: {len(data['categories'])}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
