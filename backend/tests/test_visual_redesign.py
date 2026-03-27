"""
Tests for Visual Redesign Features - Backend API Validation
Testing APIs used by Descobrir tab and related features
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://project-analyzer-131.preview.emergentagent.com')


class TestAPIHealth:
    """Basic API health checks"""

    def test_stats_endpoint(self):
        """Test /api/stats returns valid statistics"""
        response = requests.get(f"{BASE_URL}/api/stats")
        assert response.status_code == 200, f"Stats failed: {response.text}"

        data = response.json()
        assert "total_items" in data
        assert "total_routes" in data
        assert "total_users" in data
        assert "categories" in data
        assert "regions" in data

        # Verify counts are reasonable
        assert data["total_items"] > 0, "Should have heritage items"
        print(f"✓ Stats: {data['total_items']} items, {data['total_routes']} routes, {data['total_users']} users")


class TestEncyclopediaUniverses:
    """Test Encyclopedia Universes API used in Enciclopédia Viva section"""

    def test_get_universes(self):
        """Test /api/encyclopedia/universes returns all 6 universes"""
        response = requests.get(f"{BASE_URL}/api/encyclopedia/universes")
        assert response.status_code == 200, f"Universes failed: {response.text}"

        universes = response.json()
        assert isinstance(universes, list)
        assert len(universes) == 6, f"Expected 6 universes, got {len(universes)}"

        # Verify universe structure
        universe_ids = []
        for u in universes:
            assert "id" in u
            assert "name" in u
            assert "color" in u
            assert "icon" in u
            assert "item_count" in u
            universe_ids.append(u["id"])

        # Expected universes from design
        expected = ["territorio_natureza", "historia_patrimonio", "gastronomia_produtos",
                    "cultura_viva", "praias_mar", "experiencias_rotas"]
        for exp_id in expected:
            assert exp_id in universe_ids, f"Missing universe: {exp_id}"

        print(f"✓ Universes: {len(universes)} universes loaded with correct structure")


class TestDiscoveryFeed:
    """Test Discovery Feed API used in Descobrir tab"""

    def test_get_discovery_feed(self):
        """Test /api/discover/feed returns feed items"""
        response = requests.post(
            f"{BASE_URL}/api/discover/feed",
            json={},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Discovery feed failed: {response.text}"

        data = response.json()
        assert "items" in data

        if len(data["items"]) > 0:
            item = data["items"][0]
            assert "id" in item
            assert "content_data" in item
            assert "content_id" in item
            print(f"✓ Discovery feed: {len(data['items'])} items returned")
        else:
            print("✓ Discovery feed: Empty feed (valid response)")

    def test_get_trending_items(self):
        """Test /api/discover/trending"""
        response = requests.get(f"{BASE_URL}/api/discover/trending")
        assert response.status_code == 200, f"Trending failed: {response.text}"

        data = response.json()
        assert "items" in data
        assert "period" in data
        print(f"✓ Trending: {len(data['items'])} trending items")

    def test_get_seasonal_content(self):
        """Test /api/discover/seasonal"""
        response = requests.get(f"{BASE_URL}/api/discover/seasonal")
        assert response.status_code == 200, f"Seasonal failed: {response.text}"

        data = response.json()
        assert "events" in data
        assert "recommended_items" in data  # API returns recommended_items, not recommendations
        print(f"✓ Seasonal: {len(data['events'])} events, {len(data['recommended_items'])} recommended items")


class TestRegions:
    """Test Regions API used in Explorar por Região section"""

    def test_get_regions(self):
        """Test /api/regions returns all Portuguese regions"""
        response = requests.get(f"{BASE_URL}/api/regions")
        assert response.status_code == 200, f"Regions failed: {response.text}"

        regions = response.json()
        assert isinstance(regions, list)
        assert len(regions) >= 7, f"Expected at least 7 regions, got {len(regions)}"

        # Expected regions from design
        expected = ["norte", "centro", "lisboa", "alentejo", "algarve", "acores", "madeira"]
        region_ids = [r["id"] for r in regions]

        for exp_id in expected:
            assert exp_id in region_ids, f"Missing region: {exp_id}"

        print(f"✓ Regions: {len(regions)} regions available")

    def test_get_heritage_by_region(self):
        """Test /api/heritage/region/{region} returns items for Norte"""
        response = requests.get(f"{BASE_URL}/api/heritage/region/norte?limit=10")
        assert response.status_code == 200, f"Heritage by region failed: {response.text}"

        items = response.json()
        assert isinstance(items, list)
        print(f"✓ Heritage by region (Norte): {len(items)} items")


class TestCategories:
    """Test Categories API"""

    def test_get_categories(self):
        """Test /api/categories returns all heritage categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200, f"Categories failed: {response.text}"

        categories = response.json()
        assert isinstance(categories, list)
        assert len(categories) >= 20, f"Expected at least 20 categories, got {len(categories)}"

        # Check structure
        for cat in categories:
            assert "id" in cat
            assert "name" in cat
            assert "icon" in cat
            assert "color" in cat

        print(f"✓ Categories: {len(categories)} categories available")


class TestQuickActionsAPIs:
    """Test APIs used by Quick Actions buttons"""

    def test_map_items(self):
        """Test /api/map/items returns items with location"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        assert response.status_code == 200, f"Map items failed: {response.text}"

        items = response.json()
        assert isinstance(items, list)

        if len(items) > 0:
            # Verify items have location
            item = items[0]
            assert "location" in item
            assert "name" in item

        print(f"✓ Map items: {len(items)} items with locations")

    def test_routes(self):
        """Test /api/routes returns thematic routes"""
        response = requests.get(f"{BASE_URL}/api/routes")
        assert response.status_code == 200, f"Routes failed: {response.text}"

        routes = response.json()
        assert isinstance(routes, list)
        print(f"✓ Routes: {len(routes)} thematic routes")

    def test_calendar_events(self):
        """Test /api/calendar returns events"""
        response = requests.get(f"{BASE_URL}/api/calendar")
        assert response.status_code == 200, f"Calendar failed: {response.text}"

        events = response.json()
        assert isinstance(events, list)
        print(f"✓ Calendar events: {len(events)} events")


class TestRegionImages:
    """Verify region images are accessible"""

    REGION_IMAGES = {
        "hero": "https://customer-assets.emergentagent.com/job_3262e738-25ea-4984-9682-d41451888e20/artifacts/io31y0td_hero-portugal.jpg",
        "norte": "https://customer-assets.emergentagent.com/job_3262e738-25ea-4984-9682-d41451888e20/artifacts/0122scd6_regiao-norte.jpg",
        "centro": "https://customer-assets.emergentagent.com/job_24ca32ce-1389-47f3-a7d2-be353c2637e3/artifacts/l8xewvuk_regiao-centro.jpg",
        "lisboa": "https://customer-assets.emergentagent.com/job_24ca32ce-1389-47f3-a7d2-be353c2637e3/artifacts/ny3oen96_regiao-lisboa.jpg",
        "madeira": "https://customer-assets.emergentagent.com/job_24ca32ce-1389-47f3-a7d2-be353c2637e3/artifacts/zik2moq4_regiao-madeira.jpg"
    }

    @pytest.mark.parametrize("region,url", REGION_IMAGES.items())
    def test_region_image_accessible(self, region, url):
        """Test that region images are accessible (HEAD request)"""
        response = requests.head(url, timeout=10, allow_redirects=True)
        assert response.status_code == 200, f"Image for {region} not accessible: {url}"
        print(f"✓ Image {region}: accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
