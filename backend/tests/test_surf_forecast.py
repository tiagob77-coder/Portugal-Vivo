"""
Test Surf Forecast API Endpoints
Tests for:
- GET /api/marine/spot/{spotId} - Returns current conditions and 24h forecast
- GET /api/marine/spots - List all surf spots
- GET /api/marine/spots/all - Get conditions for all spots
- Verify forecast_3h array has 8 forecast points
- Verify surf_quality field (excellent/good/fair/poor/flat)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://portugal-vivo-3.preview.emergentagent.com').rstrip('/')

# List of surf spots to test
SURF_SPOTS = ['nazare', 'peniche', 'ericeira', 'sagres', 'costa_da_caparica']
SURF_SPOTS_FULL_IDS = ['nazare', 'peniche_supertubos', 'ericeira_ribeira', 'sagres', 'costa_caparica']

VALID_SURF_QUALITIES = ['excellent', 'good', 'fair', 'poor', 'flat']


class TestSurfForecastAPI:
    """Test surf forecast API endpoints"""

    def test_api_health(self):
        """Test basic API health"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200, f"API not responding: {response.status_code}"
        print("✓ API is healthy and responding")

    def test_list_surf_spots(self):
        """Test GET /api/marine/spots - List all surf spots"""
        response = requests.get(f"{BASE_URL}/api/marine/spots")
        assert response.status_code == 200, f"Failed to get surf spots: {response.status_code}"

        data = response.json()
        assert "spots" in data, "Response should contain 'spots' key"
        assert len(data["spots"]) > 0, "Should have at least one surf spot"

        # Check spot structure
        spot = data["spots"][0]
        assert "id" in spot, "Spot should have 'id'"
        assert "name" in spot, "Spot should have 'name'"
        assert "lat" in spot, "Spot should have 'lat'"
        assert "lng" in spot, "Spot should have 'lng'"
        assert "type" in spot, "Spot should have 'type'"

        print(f"✓ Found {len(data['spots'])} surf spots")
        for s in data["spots"][:5]:
            print(f"  - {s['name']} ({s['id']})")

    def test_nazare_spot_forecast(self):
        """Test GET /api/marine/spot/nazare - Returns current conditions and 24h forecast"""
        response = requests.get(f"{BASE_URL}/api/marine/spot/nazare")
        assert response.status_code == 200, f"Failed to get Nazaré forecast: {response.status_code}"

        data = response.json()

        # Verify spot info
        assert "spot" in data, "Response should contain 'spot' info"
        assert data["spot"]["name"] == "Nazaré", f"Spot name should be Nazaré, got {data['spot']['name']}"

        # Verify current conditions
        assert "current" in data, "Response should contain 'current' conditions"
        current = data["current"]
        assert "wave_height_m" in current, "Current should have wave_height_m"
        assert "surf_quality" in current, "Current should have surf_quality"
        assert "wave_direction_cardinal" in current, "Current should have wave_direction_cardinal"

        # Verify surf quality is valid
        assert current["surf_quality"] in VALID_SURF_QUALITIES, \
            f"surf_quality should be one of {VALID_SURF_QUALITIES}, got {current['surf_quality']}"

        # Verify 24h forecast (forecast_3h array)
        assert "forecast_3h" in data, "Response should contain 'forecast_3h' array"
        forecast = data["forecast_3h"]
        assert isinstance(forecast, list), "forecast_3h should be a list"
        assert len(forecast) == 8, f"forecast_3h should have 8 forecast points (24h / 3h), got {len(forecast)}"

        # Verify forecast point structure
        for i, point in enumerate(forecast):
            assert "time" in point, f"Forecast point {i} should have 'time'"
            assert "wave_height_m" in point, f"Forecast point {i} should have 'wave_height_m'"
            assert "wave_direction" in point, f"Forecast point {i} should have 'wave_direction'"
            assert "wave_period_s" in point, f"Forecast point {i} should have 'wave_period_s'"

        print(f"✓ Nazaré forecast: {current['wave_height_m']}m waves, quality: {current['surf_quality']}")
        print(f"✓ 24h forecast has {len(forecast)} forecast points (3h intervals)")

    def test_peniche_spot_forecast(self):
        """Test GET /api/marine/spot/peniche_supertubos - Peniche returns valid data"""
        # Try both peniche and peniche_supertubos
        response = requests.get(f"{BASE_URL}/api/marine/spot/peniche_supertubos")

        if response.status_code == 404:
            # Try alternative ID
            response = requests.get(f"{BASE_URL}/api/marine/spot/peniche")

        assert response.status_code == 200, f"Failed to get Peniche forecast: {response.status_code}"

        data = response.json()
        assert "current" in data, "Response should contain 'current' conditions"
        assert "surf_quality" in data["current"], "Current should have surf_quality"
        assert data["current"]["surf_quality"] in VALID_SURF_QUALITIES

        print(f"✓ Peniche forecast: {data['current']['wave_height_m']}m waves, quality: {data['current']['surf_quality']}")

    def test_ericeira_spot_forecast(self):
        """Test GET /api/marine/spot/ericeira_ribeira - Ericeira returns valid data"""
        # Try both ericeira and ericeira_ribeira
        response = requests.get(f"{BASE_URL}/api/marine/spot/ericeira_ribeira")

        if response.status_code == 404:
            response = requests.get(f"{BASE_URL}/api/marine/spot/ericeira")

        assert response.status_code == 200, f"Failed to get Ericeira forecast: {response.status_code}"

        data = response.json()
        assert "current" in data, "Response should contain 'current' conditions"
        assert "surf_quality" in data["current"], "Current should have surf_quality"
        assert data["current"]["surf_quality"] in VALID_SURF_QUALITIES

        print(f"✓ Ericeira forecast: {data['current']['wave_height_m']}m waves, quality: {data['current']['surf_quality']}")

    def test_sagres_spot_forecast(self):
        """Test GET /api/marine/spot/sagres - Sagres returns valid data"""
        response = requests.get(f"{BASE_URL}/api/marine/spot/sagres")
        assert response.status_code == 200, f"Failed to get Sagres forecast: {response.status_code}"

        data = response.json()
        assert "current" in data, "Response should contain 'current' conditions"
        assert "surf_quality" in data["current"], "Current should have surf_quality"
        assert data["current"]["surf_quality"] in VALID_SURF_QUALITIES

        print(f"✓ Sagres forecast: {data['current']['wave_height_m']}m waves, quality: {data['current']['surf_quality']}")

    def test_costa_caparica_spot_forecast(self):
        """Test GET /api/marine/spot/costa_caparica - Costa da Caparica returns valid data"""
        response = requests.get(f"{BASE_URL}/api/marine/spot/costa_caparica")
        assert response.status_code == 200, f"Failed to get Costa da Caparica forecast: {response.status_code}"

        data = response.json()
        assert "current" in data, "Response should contain 'current' conditions"
        assert "surf_quality" in data["current"], "Current should have surf_quality"
        assert data["current"]["surf_quality"] in VALID_SURF_QUALITIES

        print(f"✓ Costa da Caparica forecast: {data['current']['wave_height_m']}m waves, quality: {data['current']['surf_quality']}")

    def test_all_spots_conditions(self):
        """Test GET /api/marine/spots/all - Get conditions for all Portuguese surf spots"""
        response = requests.get(f"{BASE_URL}/api/marine/spots/all")
        assert response.status_code == 200, f"Failed to get all spots conditions: {response.status_code}"

        data = response.json()
        assert "spots" in data, "Response should contain 'spots' key"
        spots = data["spots"]
        assert len(spots) > 0, "Should have at least one spot with conditions"

        # Verify each spot has required fields
        for spot in spots:
            assert "spot_id" in spot, "Spot should have 'spot_id'"
            assert "surf_quality" in spot, "Spot should have 'surf_quality'"
            assert "wave_height_m" in spot, "Spot should have 'wave_height_m'"
            assert spot["surf_quality"] in VALID_SURF_QUALITIES, \
                f"surf_quality should be valid, got {spot['surf_quality']}"

        print(f"✓ Got conditions for {len(spots)} spots")
        for s in spots[:5]:
            print(f"  - {s['spot']['name']}: {s['wave_height_m']}m, {s['surf_quality']}")

    def test_invalid_spot_returns_404(self):
        """Test that invalid spot ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/marine/spot/invalid_spot_xyz")
        assert response.status_code == 404, f"Expected 404 for invalid spot, got {response.status_code}"
        print("✓ Invalid spot correctly returns 404")

    def test_forecast_data_structure(self):
        """Verify complete data structure of forecast response"""
        response = requests.get(f"{BASE_URL}/api/marine/spot/nazare")
        assert response.status_code == 200

        data = response.json()

        # Check all required top-level keys
        required_keys = ["source", "spot", "current", "forecast_3h"]
        for key in required_keys:
            assert key in data, f"Response missing required key: {key}"

        # Verify source is real API
        assert data.get("source") == "open-meteo", f"Source should be 'open-meteo', got {data.get('source')}"
        assert data.get("api_type") == "real", "API type should be 'real' (not mocked)"

        # Verify spot structure
        spot = data["spot"]
        assert "name" in spot
        assert "type" in spot

        # Verify current conditions structure
        current = data["current"]
        assert "wave_height_m" in current
        assert "wave_direction_degrees" in current or "wave_direction_cardinal" in current
        assert "wave_period_s" in current
        assert "surf_quality" in current

        print("✓ Data structure is complete and valid")
        print(f"  - Source: {data['source']} ({data.get('api_type', 'unknown')})")
        print(f"  - Spot: {spot['name']}")
        print(f"  - Current: {current['wave_height_m']}m, {current['surf_quality']}")


class TestSurfAlerts:
    """Test surf alert endpoints"""

    def test_check_surf_alerts_public(self):
        """Test GET /api/alerts/surf/check - Public endpoint to check conditions"""
        response = requests.get(f"{BASE_URL}/api/alerts/surf/check")
        assert response.status_code == 200, f"Failed to check surf alerts: {response.status_code}"

        data = response.json()
        assert "has_alerts" in data, "Response should have 'has_alerts' key"
        assert "alerts" in data, "Response should have 'alerts' key"
        assert isinstance(data["alerts"], list), "alerts should be a list"

        print(f"✓ Surf alerts check: has_alerts={data['has_alerts']}, count={len(data['alerts'])}")
        if data["alerts"]:
            for alert in data["alerts"][:3]:
                print(f"  - {alert.get('spot_name', 'Unknown')}: {alert.get('surf_quality', 'N/A')}")

    def test_get_surf_alert_preferences_requires_auth(self):
        """Test GET /api/alerts/surf - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/alerts/surf")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ /api/alerts/surf correctly requires authentication")

    def test_update_surf_alert_preferences_requires_auth(self):
        """Test PUT /api/alerts/surf - Requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/alerts/surf",
            json={"enabled": True, "min_quality": "good", "spots": ["nazare"]}
        )
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ PUT /api/alerts/surf correctly requires authentication")


class TestMarineWavesAPI:
    """Test marine waves general API"""

    def test_get_waves_by_coordinates(self):
        """Test GET /api/marine/waves - Get waves by lat/lng"""
        # Test with Nazaré coordinates
        response = requests.get(f"{BASE_URL}/api/marine/waves?lat=39.6021&lng=-9.0710")
        assert response.status_code == 200, f"Failed to get waves: {response.status_code}"

        data = response.json()
        assert "current" in data, "Response should have 'current' conditions"
        assert "wave_height_m" in data["current"], "Should have wave_height_m"

        print(f"✓ Waves at coordinates: {data['current'].get('wave_height_m', 'N/A')}m")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
