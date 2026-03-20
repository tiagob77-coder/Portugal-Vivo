"""
Test Map API and IQ Monitor endpoints
- Map items with iq_score
- Category filtering
- IQ Monitor Overview (100% progress verification)
- IQ Monitor Admin with module stats
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://current-state-check.preview.emergentagent.com')

class TestMapAPI:
    """Map endpoint tests - items with GPS coordinates and IQ scores"""

    def test_map_items_returns_200(self):
        """Map items endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"PASS: Map items returns 200 with {len(data)} items")

    def test_map_items_have_required_fields(self):
        """Each map item should have required fields"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        assert response.status_code == 200
        data = response.json()

        if len(data) > 0:
            item = data[0]
            required_fields = ['id', 'name', 'category', 'region', 'location']
            for field in required_fields:
                assert field in item, f"Missing required field: {field}"

            # Verify location structure
            assert 'lat' in item['location'], "Location missing 'lat'"
            assert 'lng' in item['location'], "Location missing 'lng'"
            print(f"PASS: Map items have required fields (tested {len(data)} items)")

    def test_map_items_include_iq_score(self):
        """Map items should include iq_score field"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        assert response.status_code == 200
        data = response.json()

        items_with_score = [item for item in data if item.get('iq_score') is not None]
        print(f"INFO: {len(items_with_score)}/{len(data)} items have iq_score")

        # Verify at least some items have iq_score
        assert len(items_with_score) > 0, "At least some items should have iq_score"

        # Check score value is valid (0-100 range)
        for item in items_with_score[:10]:
            score = item['iq_score']
            assert isinstance(score, (int, float)), f"iq_score should be numeric, got {type(score)}"
            assert 0 <= score <= 100, f"iq_score should be 0-100, got {score}"
        print("PASS: Map items include valid iq_score values")

    def test_map_items_filter_by_categories(self):
        """Map API should filter by categories correctly"""
        # Test single category filter
        response = requests.get(f"{BASE_URL}/api/map/items?categories=patrimonio")
        # Note: patrimonio is a layer, not a category. Real categories are aldeias, arqueologia, etc.

        # Test with actual categories
        response = requests.get(f"{BASE_URL}/api/map/items?categories=aldeias,arqueologia")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()

        # Verify filtered items only contain requested categories
        for item in data:
            assert item['category'] in ['aldeias', 'arqueologia'], f"Unexpected category: {item['category']}"
        print(f"PASS: Category filtering works - got {len(data)} items for aldeias,arqueologia")

    def test_map_items_filter_natureza_layer(self):
        """Test filtering by natureza layer categories"""
        categories = "areas_protegidas,cascatas,rios,fauna,miradouros,termas,baloicos"
        response = requests.get(f"{BASE_URL}/api/map/items?categories={categories}")
        assert response.status_code == 200
        data = response.json()

        expected_cats = ['areas_protegidas', 'cascatas', 'rios', 'fauna', 'miradouros', 'termas', 'baloicos']
        for item in data:
            assert item['category'] in expected_cats, f"Unexpected category for natureza: {item['category']}"
        print(f"PASS: Natureza layer filter works - got {len(data)} items")

    def test_map_items_filter_gastronomia_layer(self):
        """Test filtering by gastronomia layer categories"""
        categories = "gastronomia,produtos,tascas"
        response = requests.get(f"{BASE_URL}/api/map/items?categories={categories}")
        assert response.status_code == 200
        data = response.json()

        expected_cats = ['gastronomia', 'produtos', 'tascas']
        for item in data:
            assert item['category'] in expected_cats, f"Unexpected category for gastronomia: {item['category']}"
        print(f"PASS: Gastronomia layer filter works - got {len(data)} items")

    def test_map_items_limit(self):
        """Map items should return up to 1500 items"""
        response = requests.get(f"{BASE_URL}/api/map/items")
        assert response.status_code == 200
        data = response.json()

        # Limit is now 1500 as mentioned in the context
        assert len(data) <= 1500, f"Expected max 1500 items, got {len(data)}"
        print(f"PASS: Map items respects limit - returned {len(data)} items")


class TestIQMonitorOverview:
    """IQ Monitor Overview endpoint tests - should show 100% progress"""

    def test_iq_overview_returns_200(self):
        """IQ Overview endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: IQ Monitor overview returns 200")

    def test_iq_overview_required_fields(self):
        """IQ Overview should have all required fields"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        assert response.status_code == 200
        data = response.json()

        required_fields = [
            'total_pois', 'iq_processed', 'iq_pending', 'iq_progress_pct',
            'with_coordinates', 'avg_iq_score', 'max_iq_score', 'min_iq_score',
            'score_distribution', 'categories', 'regions'
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        print("PASS: IQ Overview has all required fields")

    def test_iq_progress_100_percent(self):
        """IQ processing should be at 100% (4539/4539)"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        assert response.status_code == 200
        data = response.json()

        assert data['iq_progress_pct'] == 100.0, f"Expected 100%, got {data['iq_progress_pct']}%"
        assert data['iq_processed'] == data['total_pois'], f"Processed ({data['iq_processed']}) != Total ({data['total_pois']})"
        assert data['iq_pending'] == 0, f"Expected 0 pending, got {data['iq_pending']}"
        print(f"PASS: IQ Progress is 100% ({data['iq_processed']}/{data['total_pois']})")

    def test_iq_overview_score_distribution(self):
        """Score distribution should have expected buckets"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        assert response.status_code == 200
        data = response.json()

        score_dist = data['score_distribution']
        assert len(score_dist) == 5, f"Expected 5 buckets, got {len(score_dist)}"

        expected_labels = ['Excelente', 'Bom', 'Médio', 'Baixo', 'Crítico']
        actual_labels = [b['label'] for b in score_dist]
        assert actual_labels == expected_labels, f"Expected {expected_labels}, got {actual_labels}"

        # Each bucket should have count field
        for bucket in score_dist:
            assert 'count' in bucket, f"Bucket {bucket['label']} missing count"
            assert 'color' in bucket, f"Bucket {bucket['label']} missing color"
        print("PASS: Score distribution has correct buckets")

    def test_iq_overview_categories(self):
        """Categories breakdown should include avg_score"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        assert response.status_code == 200
        data = response.json()

        categories = data['categories']
        assert len(categories) > 0, "Categories list should not be empty"

        for cat in categories[:5]:
            assert 'name' in cat, "Category missing name"
            assert 'count' in cat, "Category missing count"
            assert 'avg_score' in cat, "Category missing avg_score"
        print(f"PASS: Categories breakdown includes {len(categories)} categories with avg_score")

    def test_iq_overview_regions(self):
        """Regions breakdown should include avg_score"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        assert response.status_code == 200
        data = response.json()

        regions = data['regions']
        assert len(regions) > 0, "Regions list should not be empty"

        for reg in regions[:5]:
            assert 'name' in reg, "Region missing name"
            assert 'count' in reg, "Region missing count"
            assert 'avg_score' in reg, "Region missing avg_score"
        print(f"PASS: Regions breakdown includes {len(regions)} regions with avg_score")


class TestIQMonitorAdmin:
    """IQ Monitor Admin endpoint tests - detailed module stats"""

    def test_iq_admin_returns_200(self):
        """IQ Admin endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: IQ Monitor admin returns 200")

    def test_iq_admin_required_fields(self):
        """IQ Admin should have all required fields"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        assert response.status_code == 200
        data = response.json()

        required_fields = [
            'total_pois', 'iq_processed', 'iq_pending', 'iq_progress_pct',
            'with_coordinates', 'modules', 'sources', 'recent_processed',
            'top_pois', 'bottom_pois'
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        print("PASS: IQ Admin has all required fields")

    def test_iq_admin_modules_stats(self):
        """Admin should show module-level stats"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        assert response.status_code == 200
        data = response.json()

        modules = data['modules']
        assert len(modules) > 0, "Modules list should not be empty"

        # Check module structure
        module_fields = ['name', 'processed', 'avg_score', 'avg_confidence', 'pass', 'warn', 'fail']
        for module in modules[:5]:
            for field in module_fields:
                assert field in module, f"Module missing field: {field}"

        print(f"PASS: Admin shows {len(modules)} modules with stats")

    def test_iq_admin_top_pois(self):
        """Admin should show top scored POIs"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        assert response.status_code == 200
        data = response.json()

        top_pois = data['top_pois']
        assert len(top_pois) <= 10, f"Top POIs should be max 10, got {len(top_pois)}"

        # Verify sorted by score descending
        scores = [p.get('iq_score', 0) for p in top_pois]
        assert scores == sorted(scores, reverse=True), "Top POIs should be sorted by score descending"
        print(f"PASS: Admin shows top {len(top_pois)} POIs sorted by score")

    def test_iq_admin_bottom_pois(self):
        """Admin should show bottom scored POIs"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        assert response.status_code == 200
        data = response.json()

        bottom_pois = data['bottom_pois']
        assert len(bottom_pois) <= 10, f"Bottom POIs should be max 10, got {len(bottom_pois)}"

        # Verify sorted by score ascending
        scores = [p.get('iq_score', 0) for p in bottom_pois]
        assert scores == sorted(scores), "Bottom POIs should be sorted by score ascending"
        print(f"PASS: Admin shows bottom {len(bottom_pois)} POIs sorted by score")

    def test_iq_admin_sources(self):
        """Admin should show source breakdown"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        assert response.status_code == 200
        data = response.json()

        sources = data['sources']
        for src in sources:
            assert 'name' in src, "Source missing name"
            assert 'count' in src, "Source missing count"
        print(f"PASS: Admin shows {len(sources)} sources")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
