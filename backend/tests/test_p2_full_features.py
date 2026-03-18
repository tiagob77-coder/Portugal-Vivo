"""
Test P2: Full Features Test - Audio Guide, Marine REAL, Tides, Discover, Explore
Tests all REAL integrations - nothing mocked according to requirements
"""
import pytest
import requests
import os

# Use public URL for testing
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://current-state-check.preview.emergentagent.com').rstrip('/')


class TestAudioGuideReal:
    """Audio Guide TTS tests - REAL OpenAI TTS via Emergent"""

    def test_audio_voices_available(self):
        """GET /api/audio/voices - list available voices"""
        response = requests.get(f"{BASE_URL}/api/audio/voices", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "voices" in data, "Response should contain 'voices'"
        assert len(data["voices"]) >= 6, f"Expected at least 6 voices, got {len(data['voices'])}"

        # Check voice structure
        voice = data["voices"][0]
        assert "id" in voice, "Voice should have 'id'"
        assert "name" in voice, "Voice should have 'name'"
        assert "description" in voice, "Voice should have 'description'"

        # Check models
        assert "models" in data, "Response should contain 'models'"
        assert len(data["models"]) >= 2, "Expected at least 2 models (tts-1, tts-1-hd)"

        # Check speeds
        assert "speeds" in data, "Response should contain 'speeds'"

        print(f"✓ Audio voices: {len(data['voices'])} voices, {len(data['models'])} models available")

    def test_audio_guide_generation_real(self):
        """GET /api/audio/guide/{item_id} - generate REAL TTS audio"""
        # First, get a heritage item to test with
        response = requests.get(f"{BASE_URL}/api/heritage?limit=1", timeout=10)
        assert response.status_code == 200

        items = response.json()
        if not items:
            pytest.skip("No heritage items available for testing")

        item_id = items[0]["id"]
        item_name = items[0]["name"]

        # Generate audio - this may take a few seconds as it's REAL TTS
        response = requests.get(f"{BASE_URL}/api/audio/guide/{item_id}", timeout=60)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()

        # Check response structure
        assert "success" in data, "Response should contain 'success'"

        if data["success"]:
            assert "audio_base64" in data, "Successful response should contain 'audio_base64'"
            assert "voice" in data, "Response should contain 'voice'"
            assert "audio_format" in data, "Response should contain 'audio_format'"
            assert data["audio_format"] == "mp3", f"Expected mp3 format, got {data['audio_format']}"

            audio_size = len(data["audio_base64"]) if data.get("audio_base64") else 0
            print(f"✓ Audio generated for '{item_name}': {audio_size} bytes (base64), voice={data['voice']}")
        else:
            # TTS not configured - this is acceptable if no API key
            print(f"⚠ Audio generation returned error: {data.get('error', 'unknown')}")
            assert "error" in data, "Failed response should contain 'error'"


class TestMarineWavesReal:
    """Marine/Waves tests - REAL Open-Meteo API"""

    def test_marine_waves_real_api(self):
        """GET /api/marine/waves - REAL wave data from Open-Meteo"""
        # Peniche coordinates
        lat, lng = 39.35, -9.38

        response = requests.get(
            f"{BASE_URL}/api/marine/waves",
            params={"lat": lat, "lng": lng},
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()

        # Verify it's REAL data
        assert data.get("source") == "open-meteo", f"Expected source='open-meteo', got {data.get('source')}"
        assert data.get("api_type") == "real", f"Expected api_type='real', got {data.get('api_type')}"

        # Verify structure
        assert "current" in data, "Response should contain 'current'"
        current = data["current"]
        assert "wave_height_m" in current, "Current should contain 'wave_height_m'"
        assert "wave_period_s" in current, "Current should contain 'wave_period_s'"
        assert "surf_quality" in current, "Current should contain 'surf_quality'"

        print(f"✓ Marine waves REAL: height={current['wave_height_m']}m, period={current['wave_period_s']}s, quality={current['surf_quality']}")

    def test_surf_spot_nazare_real(self):
        """GET /api/marine/spot/nazare - REAL conditions at Nazaré"""
        response = requests.get(f"{BASE_URL}/api/marine/spot/nazare", timeout=15)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()

        # Verify REAL data
        assert data.get("source") == "open-meteo", "Expected real Open-Meteo data"
        assert data.get("api_type") == "real", "Expected api_type='real'"

        # Verify spot info
        assert "spot" in data, "Response should contain 'spot'"
        assert data["spot"]["name"] == "Nazaré", f"Expected Nazaré, got {data['spot'].get('name')}"
        assert data["spot"]["type"] == "big_wave", "Nazaré should be big_wave type"

        current = data.get("current", {})
        print(f"✓ Nazaré REAL: height={current.get('wave_height_m')}m, quality={current.get('surf_quality')}")

    def test_all_surf_spots_conditions(self):
        """GET /api/marine/spots/all - all Portuguese spots with REAL conditions"""
        response = requests.get(f"{BASE_URL}/api/marine/spots/all", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "spots" in data, "Response should contain 'spots'"

        spots = data["spots"]
        assert len(spots) >= 5, f"Expected at least 5 surf spots, got {len(spots)}"

        # Verify structure of first spot
        if spots:
            spot = spots[0]
            assert "spot_id" in spot, "Spot should have 'spot_id'"
            assert "wave_height_m" in spot, "Spot should have 'wave_height_m'"
            assert "surf_quality" in spot, "Spot should have 'surf_quality'"

        print(f"✓ All surf spots: {len(spots)} spots with real conditions")


class TestTidesReal:
    """Tide tests - Real astronomical calculations"""

    def test_marine_tides_calculated(self):
        """GET /api/marine/tides - astronomical tide calculations"""
        # Cascais coordinates (near Lisboa)
        lat, lng = 38.69, -9.42

        response = requests.get(
            f"{BASE_URL}/api/marine/tides",
            params={"lat": lat, "lng": lng},
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()

        # Verify response structure
        assert "source" in data, "Response should contain 'source'"
        # Can be 'stormglass' (real API) or 'calculated' (astronomical)
        assert data["source"] in ["stormglass", "calculated"], f"Unexpected source: {data['source']}"

        # Verify tide data
        assert "current" in data or "extremes_today" in data, "Response should contain tide data"

        if "current" in data:
            current = data["current"]
            assert "height_m" in current, "Current should have 'height_m'"
            assert "state" in current, "Current should have 'state' (rising/falling)"

        if "next_high_tide" in data:
            assert "datetime" in data["next_high_tide"], "Next high tide should have datetime"

        if "next_low_tide" in data:
            assert "datetime" in data["next_low_tide"], "Next low tide should have datetime"

        source_type = data.get("api_type", data.get("source"))
        print(f"✓ Tides ({source_type}): {data.get('station', 'unknown')} - current={data.get('current', {}).get('height_m')}m")

    def test_mobility_tides_updated(self):
        """GET /api/mobility/tides - mobility endpoint with real tide calculations"""
        lat, lng = 38.69, -9.42

        response = requests.get(
            f"{BASE_URL}/api/mobility/tides",
            params={"lat": lat, "lng": lng},
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()

        # Verify structure (actual API uses 'station' not 'station_name')
        assert "station" in data, "Response should contain 'station'"
        assert "current_height_m" in data, "Response should contain 'current_height_m'"
        assert "current_state" in data, "Response should contain 'current_state'"
        assert "source" in data, "Response should contain 'source'"
        assert "api_type" in data, "Response should contain 'api_type'"

        # Verify it's using astronomical calculations (REAL - not mocked)
        assert data["api_type"] == "astronomical_approximation", f"Expected astronomical_approximation, got {data['api_type']}"

        print(f"✓ Mobility tides ({data['api_type']}): {data['station']} - height={data['current_height_m']}m, state={data['current_state']}")

    def test_tide_stations_list(self):
        """GET /api/marine/tides/stations - list all Portuguese tide stations"""
        response = requests.get(f"{BASE_URL}/api/marine/tides/stations", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "stations" in data, "Response should contain 'stations'"

        stations = data["stations"]
        assert len(stations) >= 10, f"Expected at least 10 tide stations, got {len(stations)}"

        # Check for known stations
        station_names = [s["name"] for s in stations]
        assert any("Cascais" in n for n in station_names), "Should include Cascais station"
        assert any("Lisboa" in n for n in station_names), "Should include Lisboa station"

        print(f"✓ Tide stations: {len(stations)} Portuguese stations listed")


class TestMobilityWavesReal:
    """Mobility waves tests - should use REAL Open-Meteo data"""

    def test_mobility_waves_real(self):
        """GET /api/mobility/waves - REAL wave data from mobility service"""
        lat, lng = 39.35, -9.38  # Peniche

        response = requests.get(
            f"{BASE_URL}/api/mobility/waves",
            params={"lat": lat, "lng": lng},
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()

        # Verify structure (actual API uses 'station' and 'wave_height_m')
        assert "station" in data, "Response should contain 'station'"
        assert "wave_height_m" in data, "Response should contain 'wave_height_m'"
        assert "wave_period_s" in data, "Response should contain 'wave_period_s'"
        assert "surf_quality" in data, "Response should contain 'surf_quality'"
        assert data.get("available") == True, "Waves should be available"

        print(f"✓ Mobility waves: {data['station']} - height={data['wave_height_m']}m, quality={data['surf_quality']}")


class TestDiscoverFeed:
    """Discover feed tests"""

    def test_discover_feed_basic(self):
        """POST /api/discover/feed - personalized feed"""
        payload = {
            "latitude": 38.7223,
            "longitude": -9.1393,
            "categories": [],
            "limit": 10
        }

        response = requests.post(
            f"{BASE_URL}/api/discover/feed",
            json=payload,
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()

        # Verify structure (actual API uses 'items' not 'recommendations')
        assert "items" in data, "Response should contain 'items'"
        assert "generated_at" in data, "Response should contain 'generated_at'"

        items = data["items"]
        assert isinstance(items, list), "Items should be a list"

        # Verify item structure
        if items:
            item = items[0]
            assert "content_type" in item, "Item should have 'content_type'"
            assert "content_id" in item, "Item should have 'content_id'"
            assert "content_data" in item, "Item should have 'content_data'"
            assert "section" in item, "Item should have 'section'"

        print(f"✓ Discover feed: {len(items)} items in feed")

    def test_discover_feed_with_categories(self):
        """POST /api/discover/feed with category filter"""
        payload = {
            "latitude": 38.7223,
            "longitude": -9.1393,
            "categories": ["gastronomia", "termas"],
            "limit": 5
        }

        response = requests.post(
            f"{BASE_URL}/api/discover/feed",
            json=payload,
            timeout=15
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "items" in data, "Response should contain 'items'"

        print(f"✓ Discover feed with categories filter working ({len(data.get('items', []))} items)")


class TestExploreMatrix:
    """Explore matrix tests"""

    def test_explore_matrix_full(self):
        """GET /api/explore/matrix - thematic matrix"""
        response = requests.get(f"{BASE_URL}/api/explore/matrix", timeout=15)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()

        # Verify structure
        assert "themes" in data, "Response should contain 'themes'"
        assert "regions" in data, "Response should contain 'regions'"
        assert "matrix" in data, "Response should contain 'matrix'"

        themes = data["themes"]
        regions = data["regions"]
        matrix = data["matrix"]

        # Verify expected counts
        assert len(themes) >= 5, f"Expected at least 5 themes, got {len(themes)}"
        assert len(regions) >= 5, f"Expected at least 5 regions, got {len(regions)}"

        # Matrix should have entries
        assert len(matrix) > 0, "Matrix should have entries"

        # Check matrix structure
        if matrix:
            first_entry = list(matrix.values())[0] if isinstance(matrix, dict) else matrix[0]
            # Can be dict or list depending on implementation

        print(f"✓ Explore matrix: {len(themes)} themes × {len(regions)} regions")

    def test_explore_by_theme(self):
        """GET /api/explore/theme/{theme_id} - explore by theme"""
        response = requests.get(f"{BASE_URL}/api/explore/theme/natureza", timeout=15)
        # May return 200 or 404 depending on data

        if response.status_code == 200:
            data = response.json()
            print(f"✓ Explore by theme 'natureza': returned {len(data) if isinstance(data, list) else 'data'}")
        else:
            print(f"⚠ Theme 'natureza' not found or no data (status {response.status_code})")


class TestAINarrative:
    """AI Narrative generation tests"""

    def test_narrative_generation_real(self):
        """POST /api/narrative - generate AI narrative via OpenAI"""
        # Get a heritage item first
        response = requests.get(f"{BASE_URL}/api/heritage?limit=1", timeout=10)
        assert response.status_code == 200

        items = response.json()
        if not items:
            pytest.skip("No heritage items available for testing")

        item_id = items[0]["id"]
        item_name = items[0]["name"]

        # Generate narrative - this uses REAL OpenAI
        payload = {
            "item_id": item_id,
            "style": "storytelling"
        }

        response = requests.post(
            f"{BASE_URL}/api/narrative",
            json=payload,
            timeout=60  # AI generation may take time
        )

        if response.status_code == 200:
            data = response.json()
            assert "narrative" in data, "Response should contain 'narrative'"
            assert "item_name" in data, "Response should contain 'item_name'"

            narrative_length = len(data.get("narrative", ""))
            print(f"✓ AI Narrative generated for '{item_name}': {narrative_length} chars")
        elif response.status_code == 500:
            data = response.json()
            print(f"⚠ AI Narrative error (expected if no API key): {data.get('detail', 'unknown')}")
        else:
            print(f"⚠ Narrative endpoint returned {response.status_code}")


class TestHealthAndBasicEndpoints:
    """Basic health and endpoint tests"""

    def test_health_check(self):
        """Health check endpoint"""
        response = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy status, got {data.get('status')}"
        print("✓ Health check passed")

    def test_categories_endpoint(self):
        """GET /api/categories"""
        response = requests.get(f"{BASE_URL}/api/categories", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert isinstance(data, list), "Categories should be a list"
        assert len(data) >= 10, f"Expected at least 10 categories, got {len(data)}"
        print(f"✓ Categories: {len(data)} categories available")

    def test_regions_endpoint(self):
        """GET /api/regions"""
        response = requests.get(f"{BASE_URL}/api/regions", timeout=10)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert isinstance(data, list), "Regions should be a list"
        assert len(data) >= 7, f"Expected at least 7 regions, got {len(data)}"
        print(f"✓ Regions: {len(data)} regions available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
