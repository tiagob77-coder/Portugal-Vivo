"""
Smart Routes API Tests - Tests for IQ Engine route generation endpoints
Tests: GET /api/routes-smart/themes, profiles, regions, generate
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://project-analyzer-131.preview.emergentagent.com')


class TestSmartRouteThemesAPI:
    """Tests for GET /api/routes-smart/themes"""

    def test_themes_endpoint_returns_200(self):
        """Test themes endpoint returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/themes")
        assert response.status_code == 200
        print("✓ Themes endpoint returned 200")

    def test_themes_returns_list_of_themes(self):
        """Test themes endpoint returns list with proper structure"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/themes")
        data = response.json()

        assert "themes" in data
        assert isinstance(data["themes"], list)
        assert len(data["themes"]) > 0
        print(f"✓ Themes endpoint returned {len(data['themes'])} themes")

    def test_theme_structure(self):
        """Test each theme has required fields"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/themes")
        data = response.json()

        for theme in data["themes"]:
            assert "id" in theme
            assert "name" in theme
            assert "poi_count" in theme
            assert isinstance(theme["poi_count"], int)
            assert theme["poi_count"] >= 0
        print("✓ All themes have correct structure (id, name, poi_count)")

    def test_themes_include_known_types(self):
        """Test themes include expected types like natureza, gastronomico"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/themes")
        data = response.json()

        theme_ids = [t["id"] for t in data["themes"]]
        assert "natureza" in theme_ids, "Expected 'natureza' theme"
        print(f"✓ Themes include 'natureza': {theme_ids}")


class TestSmartRouteProfilesAPI:
    """Tests for GET /api/routes-smart/profiles"""

    def test_profiles_endpoint_returns_200(self):
        """Test profiles endpoint returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/profiles")
        assert response.status_code == 200
        print("✓ Profiles endpoint returned 200")

    def test_profiles_returns_list(self):
        """Test profiles endpoint returns list with proper structure"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/profiles")
        data = response.json()

        assert "profiles" in data
        assert isinstance(data["profiles"], list)
        assert len(data["profiles"]) == 6  # Expected 6 profiles
        print(f"✓ Profiles endpoint returned {len(data['profiles'])} profiles")

    def test_profile_structure(self):
        """Test each profile has required fields"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/profiles")
        data = response.json()

        for profile in data["profiles"]:
            assert "id" in profile
            assert "name" in profile
            assert "icon" in profile
            assert "description" in profile
            assert "default_difficulty" in profile
            assert "default_max_duration" in profile
        print("✓ All profiles have correct structure")

    def test_profiles_include_familia(self):
        """Test profiles include family profile"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/profiles")
        data = response.json()

        profile_ids = [p["id"] for p in data["profiles"]]
        assert "familia" in profile_ids
        print(f"✓ Profiles include 'familia': {profile_ids}")


class TestSmartRouteRegionsAPI:
    """Tests for GET /api/routes-smart/regions"""

    def test_regions_endpoint_returns_200(self):
        """Test regions endpoint returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/regions")
        assert response.status_code == 200
        print("✓ Regions endpoint returned 200")

    def test_regions_returns_list(self):
        """Test regions endpoint returns list with proper structure"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/regions")
        data = response.json()

        assert "regions" in data
        assert isinstance(data["regions"], list)
        assert len(data["regions"]) > 0
        print(f"✓ Regions endpoint returned {len(data['regions'])} regions")

    def test_region_structure(self):
        """Test each region has required fields"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/regions")
        data = response.json()

        for region in data["regions"]:
            assert "id" in region
            assert "name" in region
            assert "poi_count" in region
            assert "avg_iq_score" in region
            assert isinstance(region["poi_count"], int)
            assert isinstance(region["avg_iq_score"], (int, float))
        print("✓ All regions have correct structure")

    def test_regions_include_norte_centro(self):
        """Test regions include Norte and Centro"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/regions")
        data = response.json()

        region_ids = [r["id"] for r in data["regions"]]
        assert "norte" in region_ids
        assert "centro" in region_ids
        print(f"✓ Regions include 'norte' and 'centro': {region_ids}")


class TestSmartRouteGenerateAPI:
    """Tests for GET /api/routes-smart/generate"""

    def test_generate_no_filters_returns_200(self):
        """Test generate endpoint with no filters returns 200"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate")
        assert response.status_code == 200
        print("✓ Generate (no filters) returned 200")

    def test_generate_no_filters_returns_route(self):
        """Test generate with no filters returns valid route structure"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate")
        data = response.json()

        assert "route_name" in data
        assert "generated_at" in data
        assert "filters" in data
        assert "metrics" in data
        assert "avg_iq_score" in data
        assert "candidates_evaluated" in data
        assert "pois" in data
        print(f"✓ Generate (no filters) returned route: {data['route_name']}")

    def test_generate_with_theme_filter(self):
        """Test generate with theme filter"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate?theme=natureza")
        assert response.status_code == 200
        data = response.json()

        assert data["filters"]["theme"] == "natureza"
        assert "natureza" in data["route_name"].lower() or "natural" in data["route_name"].lower()
        print(f"✓ Generate with theme=natureza: {data['route_name']}")

    def test_generate_with_region_filter(self):
        """Test generate with region filter"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate?region=norte")
        assert response.status_code == 200
        data = response.json()

        assert data["filters"]["region"] == "norte"
        print(f"✓ Generate with region=norte: {data['route_name']}")

    def test_generate_with_theme_and_region(self):
        """Test generate with both theme and region filters"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate?theme=natureza&region=norte")
        assert response.status_code == 200
        data = response.json()

        assert data["filters"]["theme"] == "natureza"
        assert data["filters"]["region"] == "norte"
        assert len(data["pois"]) > 0
        print(f"✓ Generate with theme=natureza&region=norte returned {len(data['pois'])} POIs")

    def test_generate_metrics_structure(self):
        """Test generate returns proper metrics structure"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate")
        data = response.json()

        metrics = data["metrics"]
        assert "total_distance_km" in metrics
        assert "total_visit_minutes" in metrics
        assert "total_travel_minutes" in metrics
        assert "total_duration_minutes" in metrics
        assert "total_duration_label" in metrics
        assert "poi_count" in metrics

        assert isinstance(metrics["total_distance_km"], (int, float))
        assert isinstance(metrics["poi_count"], int)
        assert metrics["poi_count"] > 0
        print(f"✓ Metrics structure valid: {metrics['poi_count']} POIs, {metrics['total_distance_km']}km")

    def test_generate_pois_structure(self):
        """Test each POI in generated route has required fields"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate")
        data = response.json()

        assert len(data["pois"]) > 0

        for poi in data["pois"]:
            assert "order" in poi
            assert "id" in poi
            assert "name" in poi
            assert "description" in poi
            assert "category" in poi
            assert "region" in poi
            assert "iq_score" in poi
            assert "visit_minutes" in poi
            assert "difficulty" in poi
            assert "best_time" in poi
            assert "weather_type" in poi
            assert "primary_themes" in poi

        print(f"✓ All {len(data['pois'])} POIs have correct structure")

    def test_generate_with_difficulty_filter(self):
        """Test generate with difficulty filter"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate?difficulty=facil")
        assert response.status_code == 200
        data = response.json()

        assert data["filters"]["difficulty"] == "facil"
        print(f"✓ Generate with difficulty=facil: {data['route_name']}")

    def test_generate_with_profile_filter(self):
        """Test generate with profile filter"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate?profile=familia")
        assert response.status_code == 200
        data = response.json()

        assert data["filters"]["profile"] == "familia"
        print(f"✓ Generate with profile=familia: {data['route_name']}")

    def test_generate_with_max_duration(self):
        """Test generate with max_duration filter"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate?max_duration=120")
        assert response.status_code == 200
        data = response.json()

        assert data["filters"]["max_duration"] == 120
        # Route duration should respect max_duration constraint
        print(f"✓ Generate with max_duration=120: {data['metrics']['total_duration_label']}")

    def test_generate_with_rain_friendly(self):
        """Test generate with rain_friendly filter"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate?rain_friendly=true")
        assert response.status_code == 200
        data = response.json()

        assert data["filters"]["rain_friendly"] == True
        print(f"✓ Generate with rain_friendly=true: {data['route_name']}")


class TestSmartRouteIntegration:
    """Integration tests for smart routes workflow"""

    def test_full_workflow_themes_to_generate(self):
        """Test full workflow: get themes, then generate with theme"""
        # Get themes
        themes_response = requests.get(f"{BASE_URL}/api/routes-smart/themes")
        assert themes_response.status_code == 200
        themes = themes_response.json()["themes"]

        # Use first theme to generate route
        first_theme = themes[0]["id"]
        generate_response = requests.get(f"{BASE_URL}/api/routes-smart/generate?theme={first_theme}")
        assert generate_response.status_code == 200

        route = generate_response.json()
        assert route["filters"]["theme"] == first_theme
        print(f"✓ Full workflow: themes -> generate with '{first_theme}' returned {len(route['pois'])} POIs")

    def test_full_workflow_regions_to_generate(self):
        """Test full workflow: get regions, then generate with region"""
        # Get regions
        regions_response = requests.get(f"{BASE_URL}/api/routes-smart/regions")
        assert regions_response.status_code == 200
        regions = regions_response.json()["regions"]

        # Use first region to generate route
        first_region = regions[0]["id"]
        generate_response = requests.get(f"{BASE_URL}/api/routes-smart/generate?region={first_region}")
        assert generate_response.status_code == 200

        route = generate_response.json()
        assert route["filters"]["region"] == first_region
        print(f"✓ Full workflow: regions -> generate with '{first_region}' returned {len(route['pois'])} POIs")

    def test_combined_filters(self):
        """Test generate with multiple filters combined"""
        response = requests.get(
            f"{BASE_URL}/api/routes-smart/generate?"
            "theme=natureza&region=norte&difficulty=facil&profile=familia&max_duration=240"
        )
        assert response.status_code == 200
        data = response.json()

        assert data["filters"]["theme"] == "natureza"
        assert data["filters"]["region"] == "norte"
        assert data["filters"]["difficulty"] == "facil"
        assert data["filters"]["profile"] == "familia"
        assert data["filters"]["max_duration"] == 240

        print(f"✓ Combined filters: {data['route_name']} with {len(data['pois'])} POIs")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
