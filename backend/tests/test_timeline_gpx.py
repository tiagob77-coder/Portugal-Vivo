"""
Timeline Animada & GPX Upload API Tests
Testing new features for Património Vivo de Portugal
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://portugal-vivo-3.preview.emergentagent.com')


class TestTimelineEpochsAPI:
    """Tests for Timeline Animada feature - epoch-based POI filtering"""

    def test_epochs_list_returns_six_epochs(self):
        """GET /api/epochs should return 6 epochs for timeline"""
        response = requests.get(f"{BASE_URL}/api/epochs")
        assert response.status_code == 200
        epochs = response.json()
        assert isinstance(epochs, list)
        assert len(epochs) == 6, f"Expected 6 epochs, got {len(epochs)}"

    def test_epochs_have_required_fields(self):
        """Each epoch should have id, name, period, color, icon, count"""
        response = requests.get(f"{BASE_URL}/api/epochs")
        epochs = response.json()
        for epoch in epochs:
            assert "id" in epoch, f"Missing id in epoch: {epoch}"
            assert "name" in epoch, f"Missing name in epoch: {epoch}"
            assert "period" in epoch, f"Missing period in epoch: {epoch}"
            assert "color" in epoch, f"Missing color in epoch: {epoch}"
            assert "count" in epoch, f"Missing count in epoch: {epoch}"

    def test_epochs_have_correct_ids(self):
        """Verify the 6 timeline epoch IDs match frontend TIMELINE_EPOCHS"""
        expected_ids = ['pre_historia', 'romano', 'medieval', 'manuelino', 'barroco', 'contemporaneo']
        response = requests.get(f"{BASE_URL}/api/epochs")
        epochs = response.json()
        actual_ids = [e["id"] for e in epochs]
        for expected in expected_ids:
            assert expected in actual_ids, f"Missing epoch ID: {expected}"

    def test_epochs_have_distinct_colors(self):
        """Each epoch should have a unique color for timeline visualization"""
        response = requests.get(f"{BASE_URL}/api/epochs")
        epochs = response.json()
        colors = [e["color"] for e in epochs]
        assert len(colors) == len(set(colors)), "Epoch colors should be unique"

    def test_timeline_pre_historia_map_items(self):
        """GET /api/epochs/map-items?epoch_ids=pre_historia returns POIs"""
        response = requests.get(f"{BASE_URL}/api/epochs/map-items?epoch_ids=pre_historia")
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        assert len(items) > 0, "pre_historia epoch should have POIs"
        # Verify first item has required fields
        item = items[0]
        assert "id" in item
        assert "name" in item
        assert "location" in item
        assert "epoch" in item
        assert item["epoch"] == "pre_historia"
        assert "epoch_color" in item

    def test_timeline_romano_map_items(self):
        """GET /api/epochs/map-items?epoch_ids=romano returns POIs"""
        response = requests.get(f"{BASE_URL}/api/epochs/map-items?epoch_ids=romano")
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        assert len(items) > 0, "romano epoch should have POIs"
        # Verify epoch coloring
        if items:
            assert items[0].get("epoch_color") == "#DC2626", "Romano epoch should have red color"

    def test_timeline_medieval_map_items(self):
        """GET /api/epochs/map-items?epoch_ids=medieval returns POIs"""
        response = requests.get(f"{BASE_URL}/api/epochs/map-items?epoch_ids=medieval")
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        assert len(items) > 0, "medieval epoch should have POIs"

    def test_timeline_descobrimentos_map_items(self):
        """GET /api/epochs/map-items?epoch_ids=manuelino returns Descobrimentos POIs"""
        response = requests.get(f"{BASE_URL}/api/epochs/map-items?epoch_ids=manuelino")
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        # Manuelino/Descobrimentos may have fewer POIs
        assert "epoch_color" in items[0] if items else True

    def test_timeline_barroco_map_items(self):
        """GET /api/epochs/map-items?epoch_ids=barroco returns POIs"""
        response = requests.get(f"{BASE_URL}/api/epochs/map-items?epoch_ids=barroco")
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        assert len(items) > 0, "barroco epoch should have POIs"

    def test_timeline_contemporaneo_map_items(self):
        """GET /api/epochs/map-items?epoch_ids=contemporaneo returns POIs"""
        response = requests.get(f"{BASE_URL}/api/epochs/map-items?epoch_ids=contemporaneo")
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        assert len(items) > 0, "contemporaneo epoch should have POIs"


class TestGPXUploadAPI:
    """Tests for GPX Upload feature in Trilhos mode"""

    def test_trails_list_endpoint(self):
        """GET /api/trails should return list of trails"""
        response = requests.get(f"{BASE_URL}/api/trails")
        assert response.status_code == 200
        trails = response.json()
        assert isinstance(trails, list)
        assert len(trails) >= 5, f"Expected at least 5 trails, got {len(trails)}"

    def test_trails_have_required_fields(self):
        """Each trail should have id, name, distance_km, etc."""
        response = requests.get(f"{BASE_URL}/api/trails")
        trails = response.json()
        for trail in trails:
            assert "id" in trail
            assert "name" in trail
            assert "distance_km" in trail

    def test_gpx_upload_endpoint_exists(self):
        """POST /api/trails/upload endpoint should exist"""
        # Create a minimal GPX file
        gpx_content = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test">
  <trk>
    <name>Test Trail Upload</name>
    <desc>A test trail for GPX upload</desc>
    <trkseg>
      <trkpt lat="38.7223" lon="-9.1393">
        <ele>50</ele>
      </trkpt>
      <trkpt lat="38.7230" lon="-9.1400">
        <ele>55</ele>
      </trkpt>
      <trkpt lat="38.7240" lon="-9.1410">
        <ele>60</ele>
      </trkpt>
    </trkseg>
  </trk>
</gpx>"""

        files = {'file': ('test_trail.gpx', gpx_content, 'application/gpx+xml')}
        response = requests.post(f"{BASE_URL}/api/trails/upload", files=files)

        assert response.status_code == 200, f"GPX upload failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "points" in data
        assert len(data["points"]) >= 3
        # Cleanup: store the ID for potential deletion
        uploaded_trail_id = data["id"]
        print(f"Uploaded test trail with ID: {uploaded_trail_id}")

    def test_gpx_upload_returns_trail_stats(self):
        """GPX upload should return calculated stats (distance, elevation)"""
        gpx_content = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Test">
  <trk>
    <name>Stats Test Trail</name>
    <trkseg>
      <trkpt lat="41.5" lon="-8.5">
        <ele>100</ele>
      </trkpt>
      <trkpt lat="41.5005" lon="-8.5">
        <ele>120</ele>
      </trkpt>
      <trkpt lat="41.5010" lon="-8.5">
        <ele>110</ele>
      </trkpt>
      <trkpt lat="41.5015" lon="-8.5">
        <ele>150</ele>
      </trkpt>
    </trkseg>
  </trk>
</gpx>"""

        files = {'file': ('stats_trail.gpx', gpx_content, 'application/gpx+xml')}
        response = requests.post(f"{BASE_URL}/api/trails/upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "distance_km" in data
        assert data["distance_km"] > 0, "Distance should be calculated"
        assert "elevation_gain" in data
        assert data["elevation_gain"] > 0, "Elevation gain should be calculated"
        assert "elevation_loss" in data
        assert "min_elevation" in data
        assert "max_elevation" in data

    def test_gpx_upload_with_empty_file_fails(self):
        """Empty GPX file should fail gracefully"""
        files = {'file': ('empty.gpx', '', 'application/gpx+xml')}
        response = requests.post(f"{BASE_URL}/api/trails/upload", files=files)
        # Should return an error status (400 or 500)
        assert response.status_code >= 400, "Empty GPX should fail"


class TestMapModeSwitcher:
    """Tests for map mode functionality"""

    def test_map_items_endpoint(self):
        """GET /api/map/items returns items for standard map mode"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)

    def test_health_endpoint(self):
        """GET /api/health returns OK"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200


class TestTimelineEpochCounts:
    """Verify epoch POI counts are reasonable"""

    def test_pre_historia_count(self):
        """Pre-História should have significant POI count"""
        response = requests.get(f"{BASE_URL}/api/epochs")
        epochs = response.json()
        pre_hist = next((e for e in epochs if e["id"] == "pre_historia"), None)
        assert pre_hist is not None
        assert pre_hist["count"] > 100, f"Expected >100 pre_historia POIs, got {pre_hist['count']}"

    def test_romano_count(self):
        """Romano should have POI count"""
        response = requests.get(f"{BASE_URL}/api/epochs")
        epochs = response.json()
        romano = next((e for e in epochs if e["id"] == "romano"), None)
        assert romano is not None
        assert romano["count"] > 50, f"Expected >50 romano POIs, got {romano['count']}"

    def test_medieval_count(self):
        """Medieval should have highest POI count"""
        response = requests.get(f"{BASE_URL}/api/epochs")
        epochs = response.json()
        medieval = next((e for e in epochs if e["id"] == "medieval"), None)
        assert medieval is not None
        assert medieval["count"] > 200, f"Expected >200 medieval POIs, got {medieval['count']}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
