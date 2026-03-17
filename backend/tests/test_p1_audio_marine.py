"""
Test P1 Features: Audio Guide (TTS) and Marine REAL API (Open-Meteo)
Tests the new endpoints added for audio guides with OpenAI TTS and real wave data from Open-Meteo Marine API.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://current-app-1.preview.emergentagent.com').rstrip('/')


class TestAudioGuideVoices:
    """Test GET /api/audio/voices - List available TTS voices"""

    def test_get_voices_returns_200(self):
        """Audio voices endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/audio/voices")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/audio/voices returns 200")

    def test_voices_response_structure(self):
        """Voices response has correct structure with voices, models, speeds"""
        response = requests.get(f"{BASE_URL}/api/audio/voices")
        data = response.json()

        # Check required fields
        assert "voices" in data, "Response should have 'voices' field"
        assert "models" in data, "Response should have 'models' field"
        assert "speeds" in data, "Response should have 'speeds' field"
        assert "supported_languages" in data, "Response should have 'supported_languages' field"

        # Check voices structure
        assert isinstance(data["voices"], list), "Voices should be a list"
        assert len(data["voices"]) > 0, "Should have at least one voice"

        first_voice = data["voices"][0]
        assert "id" in first_voice, "Voice should have 'id'"
        assert "name" in first_voice, "Voice should have 'name'"
        assert "description" in first_voice, "Voice should have 'description'"
        assert "best_for" in first_voice, "Voice should have 'best_for'"

        print(f"✓ Found {len(data['voices'])} voices: {[v['id'] for v in data['voices']]}")
        print(f"✓ Available models: {[m['id'] for m in data['models']]}")
        print(f"✓ Supported languages: {data['supported_languages']}")


class TestAudioGuideGeneration:
    """Test GET /api/audio/guide/{item_id} - Generate audio for POI"""

    def test_audio_guide_for_valid_item(self):
        """Audio guide generation for valid item returns audio or error message"""
        # First get a valid heritage item
        items_response = requests.get(f"{BASE_URL}/api/heritage", params={"limit": 5})
        assert items_response.status_code == 200, f"Failed to get heritage items: {items_response.text}"

        items = items_response.json()
        if not items:
            pytest.skip("No heritage items found to test audio guide")

        item = items[0]
        item_id = item.get("id")
        print(f"Testing audio guide for item: {item.get('name')} (ID: {item_id})")

        response = requests.get(f"{BASE_URL}/api/audio/guide/{item_id}")

        # Audio guide may fail if EMERGENT_LLM_KEY not configured, but should return structured response
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "success" in data, "Response should have 'success' field"

        if data["success"]:
            assert "audio_base64" in data, "Successful response should have audio_base64"
            assert "voice" in data, "Successful response should have voice"
            assert "poi_name" in data, "Successful response should have poi_name"
            print(f"✓ Audio generated successfully - voice: {data.get('voice')}, cached: {data.get('cached')}")
        else:
            assert "error" in data, "Failed response should have error message"
            print(f"⚠ Audio not generated (expected if TTS not configured): {data.get('error')}")

    def test_audio_guide_nonexistent_item(self):
        """Audio guide for non-existent item returns 404"""
        response = requests.get(f"{BASE_URL}/api/audio/guide/nonexistent-item-12345")
        assert response.status_code == 404, f"Expected 404 for non-existent item, got {response.status_code}"
        print("✓ GET /api/audio/guide/nonexistent returns 404")


class TestMarineWavesReal:
    """Test GET /api/marine/waves - Real wave data from Open-Meteo"""

    def test_waves_peniche_returns_200(self):
        """Wave conditions for Peniche returns 200"""
        # Peniche coordinates
        lat, lng = 39.35, -9.38

        response = requests.get(f"{BASE_URL}/api/marine/waves", params={"lat": lat, "lng": lng})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/marine/waves?lat={lat}&lng={lng} returns 200")

    def test_waves_response_structure(self):
        """Wave response has correct structure with real API data"""
        lat, lng = 39.35, -9.38

        response = requests.get(f"{BASE_URL}/api/marine/waves", params={"lat": lat, "lng": lng})
        data = response.json()

        # Check it's real API data (not mocked)
        assert data.get("source") == "open-meteo", f"Expected source 'open-meteo', got {data.get('source')}"
        assert data.get("api_type") == "real", f"Expected api_type 'real', got {data.get('api_type')}"

        # Check current conditions
        assert "current" in data, "Response should have 'current' field"
        current = data["current"]
        assert "wave_height_m" in current, "Current should have wave_height_m"
        assert "wave_period_s" in current, "Current should have wave_period_s"
        assert "wave_direction_cardinal" in current, "Current should have wave_direction_cardinal"
        assert "surf_quality" in current, "Current should have surf_quality"

        print("✓ Real wave data from Open-Meteo:")
        print(f"  - Wave height: {current.get('wave_height_m')}m")
        print(f"  - Wave period: {current.get('wave_period_s')}s")
        print(f"  - Direction: {current.get('wave_direction_cardinal')}")
        print(f"  - Surf quality: {current.get('surf_quality')}")

    def test_waves_has_forecast(self):
        """Wave response includes 3-hour forecast"""
        lat, lng = 39.35, -9.38

        response = requests.get(f"{BASE_URL}/api/marine/waves", params={"lat": lat, "lng": lng})
        data = response.json()

        assert "forecast_3h" in data, "Response should have 'forecast_3h' field"
        forecast = data["forecast_3h"]
        assert isinstance(forecast, list), "Forecast should be a list"

        if len(forecast) > 0:
            first_forecast = forecast[0]
            assert "time" in first_forecast, "Forecast item should have 'time'"
            print(f"✓ Forecast available with {len(forecast)} time slots")
        else:
            print("⚠ Forecast array is empty (but endpoint works)")


class TestMarineSurfSpots:
    """Test GET /api/marine/spots - List Portuguese surf spots"""

    def test_spots_list_returns_200(self):
        """Surf spots list returns 200"""
        response = requests.get(f"{BASE_URL}/api/marine/spots")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/marine/spots returns 200")

    def test_spots_has_10_portuguese_spots(self):
        """Should return 10 Portuguese surf spots"""
        response = requests.get(f"{BASE_URL}/api/marine/spots")
        data = response.json()

        assert "spots" in data, "Response should have 'spots' field"
        spots = data["spots"]

        assert len(spots) == 10, f"Expected 10 spots, got {len(spots)}"

        # Check spot structure
        for spot in spots:
            assert "id" in spot, "Spot should have 'id'"
            assert "name" in spot, "Spot should have 'name'"
            assert "lat" in spot, "Spot should have 'lat'"
            assert "lng" in spot, "Spot should have 'lng'"
            assert "type" in spot, "Spot should have 'type'"

        spot_names = [s["name"] for s in spots]
        print(f"✓ Found {len(spots)} Portuguese surf spots: {spot_names}")


class TestMarineSurfSpotConditions:
    """Test GET /api/marine/spot/{spot_id} - Conditions for specific spot"""

    def test_nazare_conditions(self):
        """Get conditions for Nazaré (big wave spot)"""
        response = requests.get(f"{BASE_URL}/api/marine/spot/nazare")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert data.get("source") == "open-meteo", "Should use real Open-Meteo API"
        assert "spot" in data, "Response should include spot info"
        assert data["spot"]["name"] == "Nazaré", f"Expected Nazaré, got {data['spot'].get('name')}"

        current = data.get("current", {})
        print("✓ Nazaré conditions:")
        print(f"  - Wave height: {current.get('wave_height_m')}m")
        print(f"  - Surf quality: {current.get('surf_quality')}")

    def test_peniche_supertubos_conditions(self):
        """Get conditions for Peniche Supertubos"""
        response = requests.get(f"{BASE_URL}/api/marine/spot/peniche_supertubos")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert data.get("source") == "open-meteo", "Should use real Open-Meteo API"
        assert "spot" in data, "Response should include spot info"
        assert "Peniche" in data["spot"]["name"], f"Expected Peniche, got {data['spot'].get('name')}"

        current = data.get("current", {})
        print("✓ Peniche Supertubos conditions:")
        print(f"  - Wave height: {current.get('wave_height_m')}m")
        print(f"  - Surf quality: {current.get('surf_quality')}")

    def test_invalid_spot_returns_404(self):
        """Invalid spot ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/marine/spot/invalid_spot_12345")
        assert response.status_code == 404, f"Expected 404 for invalid spot, got {response.status_code}"
        print("✓ GET /api/marine/spot/invalid_spot returns 404")


class TestMobilityWavesUpdated:
    """Test GET /api/mobility/waves - Now uses REAL Open-Meteo data"""

    def test_mobility_waves_returns_200(self):
        """Mobility waves endpoint returns 200"""
        lat, lng = 39.35, -9.38
        response = requests.get(f"{BASE_URL}/api/mobility/waves", params={"lat": lat, "lng": lng})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ GET /api/mobility/waves?lat={lat}&lng={lng} returns 200")

    def test_mobility_waves_response_structure(self):
        """Mobility waves response has expected structure"""
        lat, lng = 39.35, -9.38
        response = requests.get(f"{BASE_URL}/api/mobility/waves", params={"lat": lat, "lng": lng})
        data = response.json()

        assert "available" in data, "Response should have 'available' field"

        if data["available"]:
            assert "wave_height_m" in data, "Available response should have wave_height_m"
            assert "surf_quality" in data, "Available response should have surf_quality"
            print(f"✓ Mobility waves: {data.get('wave_height_m')}m, quality: {data.get('surf_quality')}")
        else:
            print(f"⚠ Wave data not available: {data.get('message')}")


class TestDiscoverFeed:
    """Test GET /api/discover/feed - Verify it still works"""

    def test_discover_feed_returns_200(self):
        """Discover feed endpoint returns 200"""
        response = requests.post(f"{BASE_URL}/api/discover/feed", json={})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ POST /api/discover/feed returns 200")

    def test_discover_feed_structure(self):
        """Discover feed has correct structure"""
        response = requests.post(f"{BASE_URL}/api/discover/feed", json={"limit": 10})
        data = response.json()

        assert "items" in data, "Response should have 'items'"
        assert "generated_at" in data, "Response should have 'generated_at'"
        print(f"✓ Discover feed returned {len(data.get('items', []))} items")


class TestExploreMatrix:
    """Test GET /api/explore/matrix - Verify it still works"""

    def test_explore_matrix_returns_200(self):
        """Explore matrix endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/explore/matrix")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/explore/matrix returns 200")

    def test_explore_matrix_structure(self):
        """Explore matrix has correct structure"""
        response = requests.get(f"{BASE_URL}/api/explore/matrix")
        data = response.json()

        assert "matrix" in data, "Response should have 'matrix'"
        assert "themes" in data, "Response should have 'themes'"
        assert "regions" in data, "Response should have 'regions'"
        print(f"✓ Explore matrix: {len(data.get('themes', []))} themes, {len(data.get('regions', []))} regions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
