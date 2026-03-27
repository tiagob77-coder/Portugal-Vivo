"""
Marine Widgets API Tests - SurfWidget and TidesWidget Backend Endpoints
Tests the real-time wave and tide data endpoints that power the frontend widgets.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://project-analyzer-131.preview.emergentagent.com')


class TestMarineWavesEndpoint:
    """Tests for /api/marine/waves - Wave data from Open-Meteo API"""

    def test_waves_endpoint_returns_200(self):
        """Verify /api/marine/waves returns 200 with valid coordinates"""
        # Peniche coordinates
        response = requests.get(
            f"{BASE_URL}/api/marine/waves",
            params={"lat": 39.3563, "lng": -9.3810},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ /api/marine/waves returns 200 OK")

    def test_waves_returns_real_data(self):
        """Verify wave data comes from real Open-Meteo API"""
        response = requests.get(
            f"{BASE_URL}/api/marine/waves",
            params={"lat": 39.3563, "lng": -9.3810},
            timeout=30
        )
        data = response.json()

        # Verify source is real API
        assert data.get("source") == "open-meteo", f"Expected source 'open-meteo', got {data.get('source')}"
        assert data.get("api_type") == "real", f"Expected api_type 'real', got {data.get('api_type')}"
        print(f"✓ Data source verified: {data.get('source')} ({data.get('api_type')})")

    def test_waves_contains_current_conditions(self):
        """Verify wave data contains current conditions with required fields"""
        response = requests.get(
            f"{BASE_URL}/api/marine/waves",
            params={"lat": 39.3563, "lng": -9.3810},
            timeout=30
        )
        data = response.json()

        # Verify current conditions exist
        assert "current" in data, "Missing 'current' field in response"
        current = data["current"]

        # Verify required fields for SurfWidget
        assert "wave_height_m" in current, "Missing wave_height_m"
        assert "wave_period_s" in current, "Missing wave_period_s"
        assert "wave_direction_cardinal" in current, "Missing wave_direction_cardinal"
        assert "surf_quality" in current, "Missing surf_quality"

        # Verify data types
        assert isinstance(current["wave_height_m"], (int, float)), "wave_height_m should be numeric"
        assert isinstance(current["wave_period_s"], (int, float)), "wave_period_s should be numeric"
        assert current["surf_quality"] in ["excellent", "good", "fair", "poor", "flat"], \
            f"Invalid surf_quality: {current['surf_quality']}"

        print(f"✓ Current conditions: {current['wave_height_m']}m, {current['wave_period_s']}s, {current['wave_direction_cardinal']}, quality={current['surf_quality']}")

    def test_waves_contains_forecast(self):
        """Verify wave data includes forecast"""
        response = requests.get(
            f"{BASE_URL}/api/marine/waves",
            params={"lat": 39.3563, "lng": -9.3810},
            timeout=30
        )
        data = response.json()

        # Verify forecast exists
        assert "forecast_3h" in data, "Missing forecast_3h field"
        forecast = data["forecast_3h"]
        assert isinstance(forecast, list), "forecast_3h should be a list"
        assert len(forecast) > 0, "forecast_3h should not be empty"

        # Verify forecast entry structure
        entry = forecast[0]
        assert "time" in entry, "Forecast entry missing 'time'"
        assert "wave_height_m" in entry, "Forecast entry missing 'wave_height_m'"

        print(f"✓ Forecast includes {len(forecast)} entries")


class TestMarineSpotsEndpoint:
    """Tests for /api/marine/spots/all - All surf spots with conditions"""

    def test_spots_all_returns_200(self):
        """Verify /api/marine/spots/all returns 200"""
        response = requests.get(f"{BASE_URL}/api/marine/spots/all", timeout=60)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ /api/marine/spots/all returns 200 OK")

    def test_spots_all_returns_portuguese_spots(self):
        """Verify all Portuguese surf spots are returned with conditions"""
        response = requests.get(f"{BASE_URL}/api/marine/spots/all", timeout=60)
        data = response.json()

        assert "spots" in data, "Missing 'spots' field"
        spots = data["spots"]
        assert isinstance(spots, list), "spots should be a list"
        assert len(spots) >= 5, f"Expected at least 5 spots, got {len(spots)}"

        # Verify each spot has required fields for SurfWidget
        for spot in spots[:3]:  # Check first 3 spots
            assert "spot_id" in spot, "Missing spot_id"
            assert "spot" in spot, "Missing spot info"
            assert "wave_height_m" in spot, "Missing wave_height_m"
            assert "wave_period_s" in spot, "Missing wave_period_s"
            assert "surf_quality" in spot, "Missing surf_quality"

        print(f"✓ {len(spots)} Portuguese surf spots with conditions")
        for spot in spots[:3]:
            print(f"  - {spot['spot']['name']}: {spot['wave_height_m']}m, quality={spot['surf_quality']}")

    def test_spots_sorted_by_quality(self):
        """Verify spots are sorted by surf quality (best first)"""
        response = requests.get(f"{BASE_URL}/api/marine/spots/all", timeout=60)
        data = response.json()
        spots = data["spots"]

        quality_order = {"excellent": 0, "good": 1, "fair": 2, "poor": 3, "flat": 4}

        for i in range(len(spots) - 1):
            current_q = quality_order.get(spots[i]["surf_quality"], 5)
            next_q = quality_order.get(spots[i+1]["surf_quality"], 5)
            assert current_q <= next_q, f"Spots not sorted by quality at index {i}"

        print("✓ Spots are sorted by surf quality (best first)")


class TestSingleSpotEndpoint:
    """Tests for /api/marine/spot/{id} - Single spot conditions"""

    def test_peniche_spot_returns_200(self):
        """Verify Peniche Supertubos spot returns data"""
        response = requests.get(f"{BASE_URL}/api/marine/spot/peniche_supertubos", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ /api/marine/spot/peniche_supertubos returns 200 OK")

    def test_spot_contains_full_data(self):
        """Verify single spot returns full wave data"""
        response = requests.get(f"{BASE_URL}/api/marine/spot/nazare", timeout=30)
        data = response.json()

        # Verify required fields
        assert "spot_id" in data, "Missing spot_id"
        assert "spot" in data, "Missing spot info"
        assert "current" in data, "Missing current conditions"

        # Verify spot info
        spot = data["spot"]
        assert spot["name"] == "Nazaré", f"Expected Nazaré, got {spot.get('name')}"
        assert spot["type"] == "big_wave", f"Expected big_wave type, got {spot.get('type')}"

        print(f"✓ Nazaré spot: {data['current']['wave_height_m']}m, quality={data['current']['surf_quality']}")

    def test_invalid_spot_returns_404(self):
        """Verify invalid spot ID returns 404"""
        response = requests.get(f"{BASE_URL}/api/marine/spot/invalid_spot_xyz", timeout=30)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid spot returns 404 as expected")


class TestTidesEndpoint:
    """Tests for /api/marine/tides - Tide data for TidesWidget"""

    def test_tides_endpoint_returns_200(self):
        """Verify /api/marine/tides returns 200"""
        # Peniche coordinates
        response = requests.get(
            f"{BASE_URL}/api/marine/tides",
            params={"lat": 39.3563, "lng": -9.3810},
            timeout=30
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ /api/marine/tides returns 200 OK")

    def test_tides_returns_current_conditions(self):
        """Verify tide data contains current height and state"""
        response = requests.get(
            f"{BASE_URL}/api/marine/tides",
            params={"lat": 39.3563, "lng": -9.3810},
            timeout=30
        )
        data = response.json()

        # Verify current conditions for TidesWidget
        assert "current" in data, "Missing 'current' field"
        current = data["current"]

        assert "height_m" in current, "Missing height_m in current"
        assert "state" in current, "Missing state in current"

        # Verify data types
        assert isinstance(current["height_m"], (int, float)), "height_m should be numeric"
        assert current["state"] in ["rising", "falling", "high", "low"], \
            f"Invalid state: {current['state']}"

        print(f"✓ Current tide: {current['height_m']:.2f}m, state={current['state']}")

    def test_tides_contains_next_extremes(self):
        """Verify tide data contains next high/low tide info"""
        response = requests.get(
            f"{BASE_URL}/api/marine/tides",
            params={"lat": 39.3563, "lng": -9.3810},
            timeout=30
        )
        data = response.json()

        # Verify next tide info for TidesWidget
        assert "next_high_tide" in data, "Missing next_high_tide"
        assert "next_low_tide" in data, "Missing next_low_tide"

        # Verify high tide structure
        high = data["next_high_tide"]
        assert "type" in high, "Missing type in next_high_tide"
        assert "datetime" in high, "Missing datetime in next_high_tide"
        assert "height_m" in high, "Missing height_m in next_high_tide"
        assert high["type"] == "high", f"Expected type 'high', got {high['type']}"

        # Verify low tide structure
        low = data["next_low_tide"]
        assert low["type"] == "low", f"Expected type 'low', got {low['type']}"

        print(f"✓ Next high: {high['height_m']:.2f}m at {high['datetime'][:16]}")
        print(f"✓ Next low: {low['height_m']:.2f}m at {low['datetime'][:16]}")

    def test_tides_contains_moon_phase(self):
        """Verify tide data includes moon phase for TidesWidget"""
        response = requests.get(
            f"{BASE_URL}/api/marine/tides",
            params={"lat": 39.3563, "lng": -9.3810},
            timeout=30
        )
        data = response.json()

        assert "moon_phase" in data, "Missing moon_phase"
        assert "tide_type" in data, "Missing tide_type"

        assert 0 <= data["moon_phase"] <= 1, f"moon_phase should be 0-1, got {data['moon_phase']}"
        assert data["tide_type"] in ["spring", "neap", "moderate"], \
            f"Invalid tide_type: {data['tide_type']}"

        print(f"✓ Moon phase: {data['moon_phase']:.2f}, tide type: {data['tide_type']}")

    def test_tides_api_type(self):
        """Verify tide data source information"""
        response = requests.get(
            f"{BASE_URL}/api/marine/tides",
            params={"lat": 39.3563, "lng": -9.3810},
            timeout=30
        )
        data = response.json()

        # Should be either real (stormglass) or astronomical_approximation
        assert "source" in data, "Missing source field"
        assert "api_type" in data, "Missing api_type field"

        # Since STORMGLASS_API_KEY is not configured, should use astronomical calculations
        if data["api_type"] == "astronomical_approximation":
            print("✓ Using astronomical tide calculations (Stormglass API not configured)")
        elif data["api_type"] == "real":
            print("✓ Using real Stormglass API data")
        else:
            pytest.fail(f"Unexpected api_type: {data['api_type']}")


class TestTideStationsEndpoint:
    """Tests for /api/marine/tides/stations"""

    def test_stations_returns_200(self):
        """Verify /api/marine/tides/stations returns 200"""
        response = requests.get(f"{BASE_URL}/api/marine/tides/stations", timeout=30)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ /api/marine/tides/stations returns 200 OK")

    def test_stations_returns_portuguese_stations(self):
        """Verify Portuguese tide stations are returned"""
        response = requests.get(f"{BASE_URL}/api/marine/tides/stations", timeout=30)
        data = response.json()

        assert "stations" in data, "Missing 'stations' field"
        assert "total" in data, "Missing 'total' field"

        stations = data["stations"]
        assert len(stations) >= 10, f"Expected at least 10 stations, got {len(stations)}"

        # Verify station structure
        for station in stations[:3]:
            assert "id" in station, "Missing station id"
            assert "name" in station, "Missing station name"
            assert "lat" in station, "Missing station lat"
            assert "lng" in station, "Missing station lng"

        print(f"✓ {data['total']} Portuguese tide stations")
        for station in stations[:5]:
            print(f"  - {station['name']}: ({station['lat']:.4f}, {station['lng']:.4f})")


class TestWidgetIntegration:
    """Integration tests simulating widget data fetching"""

    def test_surfwidget_data_flow(self):
        """Simulate SurfConditionsWidget data fetching"""
        # SurfWidget calls getAllSpotsConditions() which uses /api/marine/spots/all
        response = requests.get(f"{BASE_URL}/api/marine/spots/all", timeout=60)
        assert response.status_code == 200

        data = response.json()
        spots = data["spots"]

        # Widget displays best spot (first in sorted list)
        if len(spots) > 0:
            best_spot = spots[0]

            # Verify all fields used by SurfWidget are present
            assert "wave_height_m" in best_spot
            assert "wave_period_s" in best_spot
            assert "wave_direction" in best_spot
            assert "surf_quality" in best_spot
            assert "spot" in best_spot
            assert "name" in best_spot["spot"]

            print(f"✓ SurfWidget will display: {best_spot['spot']['name']}")
            print(f"  - Height: {best_spot['wave_height_m']}m")
            print(f"  - Period: {best_spot['wave_period_s']}s")
            print(f"  - Direction: {best_spot['wave_direction']}")
            print(f"  - Quality: {best_spot['surf_quality']}")

    def test_tideswidget_data_flow(self):
        """Simulate TidesWidget data fetching"""
        # TidesWidget calls getTideData(lat, lng) which uses /api/marine/tides
        # The widget in descobrir.tsx uses lat=39.3563, lng=-9.3810 (Peniche)
        response = requests.get(
            f"{BASE_URL}/api/marine/tides",
            params={"lat": 39.3563, "lng": -9.3810},
            timeout=30
        )
        assert response.status_code == 200

        data = response.json()

        # Verify all fields used by TidesWidget are present
        assert "current" in data
        assert "height_m" in data["current"]
        assert "state" in data["current"]
        assert "next_high_tide" in data
        assert "next_low_tide" in data
        assert "moon_phase" in data
        assert "tide_type" in data

        print("✓ TidesWidget will display:")
        print(f"  - Current: {data['current']['height_m']:.2f}m ({data['current']['state']})")
        print(f"  - Moon phase: {data['moon_phase']:.2f}")
        print(f"  - Tide type: {data['tide_type']}")
        if data.get("next_high_tide"):
            print(f"  - Next high: {data['next_high_tide']['height_m']:.2f}m")
        if data.get("next_low_tide"):
            print(f"  - Next low: {data['next_low_tide']['height_m']:.2f}m")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
