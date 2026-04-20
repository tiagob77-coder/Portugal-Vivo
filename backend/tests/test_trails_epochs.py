"""
Test Trails GPX API and Epochs Classification API
Tests for the new map features: Trilhos and Épocas
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://portugal-vivo-3.preview.emergentagent.com').rstrip('/')


class TestTrailsAPI:
    """Tests for GET /api/trails endpoints"""

    def test_list_trails_returns_200(self):
        """Test GET /api/trails returns 200"""
        response = requests.get(f"{BASE_URL}/api/trails")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/trails returned 200")

    def test_list_trails_returns_array(self):
        """Test GET /api/trails returns an array"""
        response = requests.get(f"{BASE_URL}/api/trails")
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ /api/trails returns array with {len(data)} trails")

    def test_list_trails_has_5_trails(self):
        """Test that we have 5 sample trails"""
        response = requests.get(f"{BASE_URL}/api/trails")
        data = response.json()
        assert len(data) >= 5, f"Expected at least 5 trails, got {len(data)}"
        print(f"✓ Found {len(data)} trails (expected ≥5)")

    def test_trail_has_required_fields(self):
        """Test trail list items have required fields"""
        response = requests.get(f"{BASE_URL}/api/trails")
        data = response.json()
        if len(data) == 0:
            pytest.skip("No trails in database")

        trail = data[0]
        required_fields = ['id', 'name', 'distance_km', 'elevation_gain', 'elevation_loss', 'difficulty']
        for field in required_fields:
            assert field in trail, f"Missing field: {field}"
        print(f"✓ Trail has required fields: {required_fields}")

    def test_known_trail_ids_exist(self):
        """Test that known trail IDs exist"""
        response = requests.get(f"{BASE_URL}/api/trails")
        data = response.json()
        trail_ids = [t['id'] for t in data]

        expected_ids = ['rota-vicentina', 'caminho-santiago', 'geres-sete-lagoas', 'sintra-pena', 'aldeias-xisto']
        found_ids = [tid for tid in expected_ids if tid in trail_ids]
        print(f"✓ Found {len(found_ids)}/{len(expected_ids)} expected trails: {found_ids}")
        assert len(found_ids) >= 3, f"Expected at least 3 known trails, found {len(found_ids)}"


class TestTrailDetail:
    """Tests for GET /api/trails/{trail_id}"""

    def test_get_trail_rota_vicentina(self):
        """Test GET /api/trails/rota-vicentina returns trail with points"""
        response = requests.get(f"{BASE_URL}/api/trails/rota-vicentina")

        if response.status_code == 404:
            pytest.skip("Trail 'rota-vicentina' not found - may use different seed data")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()

        assert 'points' in data, "Missing 'points' field"
        assert isinstance(data['points'], list), "'points' should be array"
        assert len(data['points']) > 0, "Trail should have points"
        print(f"✓ Trail rota-vicentina has {len(data['points'])} points")

    def test_trail_points_have_coordinates(self):
        """Test trail points have lat/lng coordinates"""
        response = requests.get(f"{BASE_URL}/api/trails/rota-vicentina")

        if response.status_code == 404:
            pytest.skip("Trail not found")

        data = response.json()
        if not data.get('points'):
            pytest.skip("No points in trail")

        point = data['points'][0]
        assert 'lat' in point, "Point missing 'lat'"
        assert 'lng' in point, "Point missing 'lng'"
        assert isinstance(point['lat'], (int, float)), "lat should be numeric"
        assert isinstance(point['lng'], (int, float)), "lng should be numeric"
        print("✓ Trail points have valid lat/lng coordinates")

    def test_trail_has_distance_and_elevation(self):
        """Test trail has distance and elevation data"""
        response = requests.get(f"{BASE_URL}/api/trails/rota-vicentina")

        if response.status_code == 404:
            pytest.skip("Trail not found")

        data = response.json()

        assert 'distance_km' in data, "Missing distance_km"
        assert 'elevation_gain' in data, "Missing elevation_gain"
        assert 'elevation_loss' in data, "Missing elevation_loss"
        assert data['distance_km'] > 0, "distance_km should be positive"
        print(f"✓ Trail: {data['distance_km']}km, +{data['elevation_gain']}m/-{data['elevation_loss']}m")

    def test_get_nonexistent_trail_returns_404(self):
        """Test GET /api/trails/nonexistent returns 404"""
        response = requests.get(f"{BASE_URL}/api/trails/nonexistent-trail-xyz")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Nonexistent trail returns 404")


class TestTrailElevation:
    """Tests for GET /api/trails/elevation/{trail_id}"""

    def test_elevation_profile_endpoint(self):
        """Test GET /api/trails/elevation/{trail_id} returns elevation data"""
        response = requests.get(f"{BASE_URL}/api/trails/elevation/rota-vicentina")

        if response.status_code == 404:
            pytest.skip("Trail not found")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()

        assert 'profile' in data, "Missing 'profile' field"
        assert 'trail_name' in data, "Missing 'trail_name' field"
        print(f"✓ Elevation profile returned for '{data.get('trail_name')}'")

    def test_elevation_profile_has_points(self):
        """Test elevation profile has point data"""
        response = requests.get(f"{BASE_URL}/api/trails/elevation/rota-vicentina")

        if response.status_code == 404:
            pytest.skip("Trail not found")

        data = response.json()
        profile = data.get('profile', [])

        assert len(profile) > 0, "Profile should have points"

        point = profile[0]
        assert 'distance_km' in point, "Profile point missing distance_km"
        assert 'elevation' in point, "Profile point missing elevation"
        print(f"✓ Elevation profile has {len(profile)} points with distance_km and elevation")


class TestEpochsAPI:
    """Tests for GET /api/epochs endpoints"""

    def test_list_epochs_returns_200(self):
        """Test GET /api/epochs returns 200"""
        response = requests.get(f"{BASE_URL}/api/epochs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/epochs returned 200")

    def test_list_epochs_returns_6_epochs(self):
        """Test GET /api/epochs returns 6 historical epochs"""
        response = requests.get(f"{BASE_URL}/api/epochs")
        data = response.json()

        assert isinstance(data, list), f"Expected list, got {type(data)}"
        assert len(data) == 6, f"Expected 6 epochs, got {len(data)}"

        epoch_names = [e.get('name') for e in data]
        print(f"✓ Found 6 epochs: {epoch_names}")

    def test_epochs_have_required_fields(self):
        """Test each epoch has required fields"""
        response = requests.get(f"{BASE_URL}/api/epochs")
        data = response.json()

        required_fields = ['id', 'name', 'period', 'color', 'count']

        for epoch in data:
            for field in required_fields:
                assert field in epoch, f"Epoch '{epoch.get('id', 'unknown')}' missing field: {field}"

        print(f"✓ All epochs have required fields: {required_fields}")

    def test_epochs_have_expected_ids(self):
        """Test epochs include expected historical periods"""
        response = requests.get(f"{BASE_URL}/api/epochs")
        data = response.json()

        epoch_ids = [e['id'] for e in data]
        expected_ids = ['pre_historia', 'romano', 'medieval', 'manuelino', 'barroco', 'contemporaneo']

        for expected_id in expected_ids:
            assert expected_id in epoch_ids, f"Missing epoch: {expected_id}"

        print(f"✓ All expected epoch IDs present: {expected_ids}")

    def test_epochs_have_distinct_colors(self):
        """Test each epoch has a distinct color"""
        response = requests.get(f"{BASE_URL}/api/epochs")
        data = response.json()

        colors = [e['color'] for e in data]
        unique_colors = set(colors)

        assert len(unique_colors) == len(colors), "Epochs should have distinct colors"

        expected_colors = {
            'pre_historia': '#8B4513',
            'romano': '#DC2626',
            'medieval': '#7C3AED',
            'manuelino': '#2563EB',
            'barroco': '#D97706',
            'contemporaneo': '#059669',
        }

        for epoch in data:
            if epoch['id'] in expected_colors:
                assert epoch['color'] == expected_colors[epoch['id']], f"Epoch {epoch['id']} has wrong color"

        print(f"✓ Epochs have distinct colors: {colors}")

    def test_epochs_have_poi_counts(self):
        """Test epochs return POI counts"""
        response = requests.get(f"{BASE_URL}/api/epochs")
        data = response.json()

        for epoch in data:
            assert 'count' in epoch, f"Epoch '{epoch['id']}' missing count"
            assert isinstance(epoch['count'], int), "count should be integer"

        total_count = sum(e['count'] for e in data)
        print(f"✓ Total POIs across epochs: {total_count}")

        # Print individual counts
        for e in data:
            print(f"   - {e['name']}: {e['count']} POIs")


class TestEpochPOIs:
    """Tests for GET /api/epochs/{epoch_id}/pois"""

    def test_get_medieval_pois(self):
        """Test GET /api/epochs/medieval/pois returns filtered POIs"""
        response = requests.get(f"{BASE_URL}/api/epochs/medieval/pois")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert 'pois' in data, "Response missing 'pois' field"
        assert 'epoch' in data, "Response missing 'epoch' field"

        print(f"✓ Medieval epoch: {len(data['pois'])} POIs found")

    def test_epoch_pois_have_location(self):
        """Test epoch POIs have location coordinates"""
        response = requests.get(f"{BASE_URL}/api/epochs/romano/pois")
        data = response.json()

        pois = data.get('pois', [])
        if not pois:
            pytest.skip("No POIs in romano epoch")

        poi = pois[0]
        assert 'location' in poi, "POI missing location"
        assert 'lat' in poi['location'], "POI location missing lat"
        assert 'lng' in poi['location'], "POI location missing lng"

        print("✓ Romano POIs have location coordinates")

    def test_invalid_epoch_returns_error(self):
        """Test invalid epoch ID returns error"""
        response = requests.get(f"{BASE_URL}/api/epochs/invalid_epoch/pois")
        data = response.json()

        # API returns 200 with error message in body
        assert 'error' in data or 'pois' in data, "Expected error or empty pois"
        if 'pois' in data:
            assert len(data['pois']) == 0, "Invalid epoch should return empty pois"
        print("✓ Invalid epoch handled correctly")


class TestEpochMapItems:
    """Tests for GET /api/epochs/map-items"""

    def test_map_items_no_filter(self):
        """Test GET /api/epochs/map-items returns all epoch POIs"""
        response = requests.get(f"{BASE_URL}/api/epochs/map-items")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ /api/epochs/map-items returns {len(data)} items")

    def test_map_items_with_epoch_filter(self):
        """Test GET /api/epochs/map-items?epoch_ids=romano,medieval"""
        response = requests.get(f"{BASE_URL}/api/epochs/map-items?epoch_ids=romano,medieval")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"

        if len(data) > 0:
            # Verify items have epoch info
            item = data[0]
            assert 'epoch' in item, "Item missing epoch field"
            assert 'epoch_color' in item, "Item missing epoch_color field"
            assert item['epoch'] in ['romano', 'medieval'], f"Unexpected epoch: {item['epoch']}"

        print(f"✓ Filtered by romano,medieval: {len(data)} items")

    def test_map_items_have_epoch_color(self):
        """Test map items include epoch color for markers"""
        response = requests.get(f"{BASE_URL}/api/epochs/map-items?epoch_ids=medieval")
        data = response.json()

        if len(data) == 0:
            pytest.skip("No medieval POIs found")

        item = data[0]
        assert 'epoch_color' in item, "Item missing epoch_color"
        assert item['epoch_color'] == '#7C3AED', f"Expected medieval purple, got {item['epoch_color']}"

        print(f"✓ Medieval items have correct epoch_color: {item['epoch_color']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
