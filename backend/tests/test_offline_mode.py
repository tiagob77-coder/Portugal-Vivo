"""
Test Offline Mode Backend Endpoints
Tests the new offline package endpoints:
- GET /api/offline/package/version - Returns global version and region info
- GET /api/offline/package/{region} - Returns complete region data package
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://current-state-check.preview.emergentagent.com')

# Expected 7 regions
EXPECTED_REGIONS = ['norte', 'centro', 'lisboa', 'alentejo', 'algarve', 'acores', 'madeira']


class TestOfflinePackageVersion:
    """Test /api/offline/package/version endpoint"""

    def test_get_version_returns_200(self):
        """Version endpoint should return 200 status"""
        response = requests.get(f"{BASE_URL}/api/offline/package/version")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ GET /api/offline/package/version returns 200")

    def test_version_has_global_version(self):
        """Response should include global_version field"""
        response = requests.get(f"{BASE_URL}/api/offline/package/version")
        data = response.json()
        assert "global_version" in data, "Missing global_version field"
        assert isinstance(data["global_version"], str), "global_version should be string"
        print(f"✓ global_version = {data['global_version']}")

    def test_version_has_7_regions(self):
        """Response should have 7 regions with expected IDs"""
        response = requests.get(f"{BASE_URL}/api/offline/package/version")
        data = response.json()
        assert "regions" in data, "Missing regions field"
        regions = data["regions"]

        # Check all 7 regions are present
        for region_id in EXPECTED_REGIONS:
            assert region_id in regions, f"Missing region: {region_id}"

        assert len(regions) == 7, f"Expected 7 regions, got {len(regions)}"
        print(f"✓ All 7 regions present: {list(regions.keys())}")

    def test_each_region_has_poi_count_and_version(self):
        """Each region should have poi_count and version fields"""
        response = requests.get(f"{BASE_URL}/api/offline/package/version")
        data = response.json()
        regions = data["regions"]

        for region_id, region_info in regions.items():
            assert "poi_count" in region_info, f"Region {region_id} missing poi_count"
            assert "version" in region_info, f"Region {region_id} missing version"
            assert "name" in region_info, f"Region {region_id} missing name"
            assert isinstance(region_info["poi_count"], int), f"Region {region_id} poi_count should be int"
            print(f"  - {region_id}: {region_info['poi_count']} POIs, version={region_info['version']}")

        print("✓ All regions have poi_count, version, and name")


class TestOfflinePackageRegion:
    """Test /api/offline/package/{region} endpoint"""

    def test_get_centro_region_returns_200(self):
        """Centro region endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/offline/package/centro")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/offline/package/centro returns 200")

    def test_centro_package_structure(self):
        """Centro package should have pois, routes, events, categories, package_size_mb, version"""
        response = requests.get(f"{BASE_URL}/api/offline/package/centro")
        data = response.json()

        required_fields = ["pois", "routes", "events", "categories", "package_size_mb", "version"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"

        print("✓ Centro package has all required fields")
        print(f"  - POIs: {len(data['pois'])}")
        print(f"  - Routes: {len(data['routes'])}")
        print(f"  - Events: {len(data['events'])}")
        print(f"  - Categories: {len(data['categories'])}")
        print(f"  - Package size: {data['package_size_mb']} MB")
        print(f"  - Version: {data['version']}")

    def test_centro_pois_have_required_fields(self):
        """POIs should have essential fields for offline use"""
        response = requests.get(f"{BASE_URL}/api/offline/package/centro")
        data = response.json()

        if len(data["pois"]) > 0:
            poi = data["pois"][0]
            # Check essential POI fields exist
            assert "id" in poi, "POI missing id"
            assert "name" in poi, "POI missing name"
            assert "category" in poi, "POI missing category"
            assert "region" in poi, "POI missing region"
            print(f"✓ POIs have required fields (checked: {poi['name'][:50]}...)")

    def test_nonexistent_region_returns_404(self):
        """Nonexistent region should return 404"""
        response = requests.get(f"{BASE_URL}/api/offline/package/nonexistent")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ GET /api/offline/package/nonexistent returns 404")

    def test_invalid_region_returns_404(self):
        """Invalid region ID should return 404"""
        response = requests.get(f"{BASE_URL}/api/offline/package/xyz123")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ GET /api/offline/package/xyz123 returns 404")

    def test_all_regions_return_valid_packages(self):
        """All 7 regions should return valid packages"""
        for region_id in EXPECTED_REGIONS:
            response = requests.get(f"{BASE_URL}/api/offline/package/{region_id}")
            assert response.status_code == 200, f"Region {region_id} failed: {response.status_code}"
            data = response.json()
            assert "pois" in data, f"Region {region_id} missing pois"
            assert "version" in data, f"Region {region_id} missing version"
            print(f"  - {region_id}: {len(data.get('pois', []))} POIs ✓")

        print("✓ All 7 regions return valid packages")


class TestExistingHeritageEndpoint:
    """Verify cachedGet wrapper doesn't break normal flow"""

    def test_heritage_endpoint_returns_data(self):
        """GET /api/heritage should still work (cache-first wrapper test)"""
        response = requests.get(f"{BASE_URL}/api/heritage?limit=5")
        assert response.status_code == 200, f"Heritage endpoint failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Heritage endpoint should return list"
        print(f"✓ GET /api/heritage returns {len(data)} items")

    def test_categories_endpoint_still_works(self):
        """GET /api/categories should still work"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200, f"Categories endpoint failed: {response.status_code}"
        data = response.json()
        assert len(data) > 0, "Categories should not be empty"
        print(f"✓ GET /api/categories returns {len(data)} categories")

    def test_regions_endpoint_still_works(self):
        """GET /api/regions should still work"""
        response = requests.get(f"{BASE_URL}/api/regions")
        assert response.status_code == 200, f"Regions endpoint failed: {response.status_code}"
        data = response.json()
        assert len(data) == 7, f"Expected 7 regions, got {len(data)}"
        print(f"✓ GET /api/regions returns {len(data)} regions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
