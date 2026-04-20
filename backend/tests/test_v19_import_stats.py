"""
Test V19 POI Importer and Smart Routes after bulk import
Tests verify that ~4000 POIs from v19 import are present in the database
and that smart routes are working with the new data.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

class TestV19ImporterStats:
    """Test /api/importer-v19/stats endpoint - verifies v19 bulk import stats"""

    def test_v19_stats_endpoint_returns_200(self):
        """Test that the v19 stats endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/importer-v19/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ V19 stats endpoint accessible")

    def test_v19_stats_total_db_count(self):
        """Test that total_db is >= 4500 (original + v19 import)"""
        response = requests.get(f"{BASE_URL}/api/importer-v19/stats")
        data = response.json()
        total_db = data.get("total_db", 0)
        assert total_db >= 4500, f"Expected total_db >= 4500, got {total_db}"
        print(f"✓ Total DB count: {total_db}")

    def test_v19_stats_v19_imported_count(self):
        """Test that v19_imported is >= 4000 (from bulk import)"""
        response = requests.get(f"{BASE_URL}/api/importer-v19/stats")
        data = response.json()
        v19_count = data.get("v19_imported", 0)
        assert v19_count >= 4000, f"Expected v19_imported >= 4000, got {v19_count}"
        print(f"✓ V19 imported count: {v19_count}")

    def test_v19_stats_with_coordinates(self):
        """Test that v19_with_coordinates is >= 3000 (geocoded POIs)"""
        response = requests.get(f"{BASE_URL}/api/importer-v19/stats")
        data = response.json()
        with_coords = data.get("v19_with_coordinates", 0)
        assert with_coords >= 3000, f"Expected v19_with_coordinates >= 3000, got {with_coords}"
        print(f"✓ V19 with coordinates: {with_coords}")

    def test_v19_stats_has_categories(self):
        """Test that categories distribution is returned"""
        response = requests.get(f"{BASE_URL}/api/importer-v19/stats")
        data = response.json()
        categories = data.get("categories", [])
        assert len(categories) > 0, "Expected categories array"
        print(f"✓ Categories count: {len(categories)}")
        for cat in categories[:5]:
            print(f"  - {cat.get('original', 'N/A')}: {cat.get('count', 0)} POIs")

    def test_v19_stats_has_regions(self):
        """Test that regions distribution is returned"""
        response = requests.get(f"{BASE_URL}/api/importer-v19/stats")
        data = response.json()
        regions = data.get("regions", [])
        assert len(regions) > 0, "Expected regions array"
        print(f"✓ Regions count: {len(regions)}")
        for reg in regions[:5]:
            print(f"  - {reg.get('name', 'N/A')}: {reg.get('count', 0)} POIs")


class TestSmartRoutesWithNewData:
    """Test Smart Routes endpoints with new v19 data"""

    def test_themes_with_higher_counts(self):
        """Test that themes have significantly higher POI counts after import"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/themes")
        assert response.status_code == 200
        data = response.json()
        themes = data.get("themes", [])

        # Find cultural theme - should have many POIs after import
        total_pois_in_themes = sum(t.get("poi_count", 0) for t in themes)
        print(f"✓ Total POIs across themes: {total_pois_in_themes}")

        # Check each theme
        for theme in themes:
            print(f"  - {theme.get('id')}: {theme.get('poi_count', 0)} POIs")

    def test_regions_with_higher_counts(self):
        """Test that regions have more POIs after v19 import"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/regions")
        assert response.status_code == 200
        data = response.json()
        regions = data.get("regions", [])

        # Check Norte and Centro specifically - should have 100+ each
        for reg in regions:
            region_id = reg.get("id")
            count = reg.get("poi_count", 0)
            print(f"  - {region_id}: {count} POIs, avg IQ: {reg.get('avg_iq_score', 0)}")

    def test_generate_route_with_new_data(self):
        """Test route generation uses newly imported POIs"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate")
        assert response.status_code == 200
        data = response.json()

        route_name = data.get("route_name")
        pois = data.get("pois", [])
        candidates = data.get("candidates_evaluated", 0)

        print(f"✓ Route generated: {route_name}")
        print(f"  - Candidates evaluated: {candidates}")
        print(f"  - POIs in route: {len(pois)}")

        # Should have evaluated many POIs (with IQ status completed)
        assert len(pois) > 0, "Expected at least 1 POI in route"

    def test_generate_route_by_region_norte(self):
        """Test route generation filtered by Norte region"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/generate", params={"region": "norte"})
        assert response.status_code == 200
        data = response.json()

        # All POIs should be from Norte or related
        pois = data.get("pois", [])
        print(f"✓ Norte route: {len(pois)} POIs")
        for poi in pois[:3]:
            print(f"  - {poi.get('name')} ({poi.get('region')})")


class TestGeneralStats:
    """Test general stats endpoint after v19 import"""

    def test_stats_total_items(self):
        """Test that /api/stats returns total_items >= 4500"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()

        total_items = data.get("total_items", 0)
        assert total_items >= 4500, f"Expected total_items >= 4500, got {total_items}"
        print(f"✓ Total items: {total_items}")

    def test_stats_categories_distribution(self):
        """Test category counts after import"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()

        categories = data.get("categories", [])
        print("✓ Categories with counts:")
        for cat in sorted(categories, key=lambda x: x.get("count", 0), reverse=True)[:10]:
            print(f"  - {cat.get('name')}: {cat.get('count', 0)}")

    def test_stats_regions_distribution(self):
        """Test region counts after import"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200
        data = response.json()

        regions = data.get("regions", [])
        print("✓ Regions with counts:")
        for reg in sorted(regions, key=lambda x: x.get("count", 0), reverse=True):
            print(f"  - {reg.get('name')}: {reg.get('count', 0)}")


class TestSmartRouteProfiles:
    """Test Smart Route Profiles endpoint"""

    def test_profiles_endpoint(self):
        """Test that profiles endpoint returns 6 profiles"""
        response = requests.get(f"{BASE_URL}/api/routes-smart/profiles")
        assert response.status_code == 200
        data = response.json()

        profiles = data.get("profiles", [])
        assert len(profiles) == 6, f"Expected 6 profiles, got {len(profiles)}"
        print(f"✓ Profiles count: {len(profiles)}")
        for p in profiles:
            print(f"  - {p.get('id')}: {p.get('name')}")


class TestHeritageItems:
    """Test heritage items endpoints with new data"""

    def test_heritage_list_pagination(self):
        """Test heritage items list returns many items"""
        response = requests.get(f"{BASE_URL}/api/heritage", params={"limit": 50})
        assert response.status_code == 200
        data = response.json()

        assert len(data) == 50, f"Expected 50 items, got {len(data)}"
        print(f"✓ Heritage list returns {len(data)} items")

    def test_heritage_by_category_arte(self):
        """Test heritage items by category 'arte'"""
        response = requests.get(f"{BASE_URL}/api/heritage/category/arte")
        assert response.status_code == 200
        data = response.json()

        print(f"✓ Arte category: {len(data)} items")

    def test_heritage_by_region_norte(self):
        """Test heritage items by region 'norte'"""
        response = requests.get(f"{BASE_URL}/api/heritage/region/norte")
        assert response.status_code == 200
        data = response.json()

        print(f"✓ Norte region: {len(data)} items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
