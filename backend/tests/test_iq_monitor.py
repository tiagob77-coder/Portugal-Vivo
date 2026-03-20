"""
IQ Monitor API Tests
Tests the /api/iq-monitor/overview and /api/iq-monitor/admin endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://current-state-check.preview.emergentagent.com').rstrip('/')


class TestIQMonitorOverview:
    """Tests for GET /api/iq-monitor/overview endpoint"""

    def test_overview_returns_200(self):
        """Overview endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Overview API returned 200")

    def test_overview_has_required_fields(self):
        """Overview should have all required fields"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        data = response.json()

        required_fields = [
            'total_pois', 'iq_processed', 'iq_pending', 'iq_progress_pct',
            'with_coordinates', 'avg_iq_score', 'max_iq_score', 'min_iq_score',
            'score_distribution', 'categories', 'regions'
        ]

        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        print(f"✓ All {len(required_fields)} required fields present")

    def test_overview_score_distribution_has_5_buckets(self):
        """Score distribution should have 5 buckets (Excelente, Bom, Médio, Baixo, Crítico)"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        data = response.json()

        score_dist = data.get('score_distribution', [])
        assert len(score_dist) == 5, f"Expected 5 buckets, got {len(score_dist)}"

        expected_labels = ['Excelente', 'Bom', 'Médio', 'Baixo', 'Crítico']
        actual_labels = [b['label'] for b in score_dist]
        assert actual_labels == expected_labels, f"Labels don't match. Got: {actual_labels}"

        # Check each bucket has required fields
        for bucket in score_dist:
            assert 'label' in bucket
            assert 'min' in bucket
            assert 'max' in bucket
            assert 'count' in bucket
            assert 'color' in bucket

        print(f"✓ Score distribution has 5 correct buckets: {expected_labels}")

    def test_overview_progress_percentage_valid(self):
        """Progress percentage should be between 0 and 100"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        data = response.json()

        pct = data.get('iq_progress_pct', 0)
        assert 0 <= pct <= 100, f"Progress percentage {pct} out of range"

        # Verify calculation
        total = data.get('total_pois', 0)
        processed = data.get('iq_processed', 0)
        if total > 0:
            expected_pct = round(100 * processed / total, 1)
            assert abs(pct - expected_pct) < 0.5, "Progress calculation mismatch"

        print(f"✓ Progress: {pct}% ({processed}/{total})")

    def test_overview_categories_have_scores(self):
        """Categories should include avg_score and max_score"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        data = response.json()

        categories = data.get('categories', [])
        assert len(categories) > 0, "Should have at least some categories"

        for cat in categories[:5]:  # Check first 5
            assert 'name' in cat
            assert 'count' in cat
            assert 'avg_score' in cat
            assert 'max_score' in cat
            assert isinstance(cat['avg_score'], (int, float))

        print(f"✓ Found {len(categories)} categories with scores")

    def test_overview_regions_have_scores(self):
        """Regions should include avg_score"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        data = response.json()

        regions = data.get('regions', [])
        assert len(regions) > 0, "Should have at least some regions"

        for reg in regions[:5]:  # Check first 5
            assert 'name' in reg
            assert 'count' in reg
            assert 'avg_score' in reg

        print(f"✓ Found {len(regions)} regions with scores")

    def test_overview_data_integrity(self):
        """Verify data consistency (processed + pending = total)"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        data = response.json()

        total = data.get('total_pois', 0)
        processed = data.get('iq_processed', 0)
        pending = data.get('iq_pending', 0)

        assert processed + pending == total, f"Data inconsistency: {processed} + {pending} != {total}"
        print(f"✓ Data integrity verified: {processed} + {pending} = {total}")


class TestIQMonitorAdmin:
    """Tests for GET /api/iq-monitor/admin endpoint"""

    def test_admin_returns_200(self):
        """Admin endpoint should return 200"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Admin API returned 200")

    def test_admin_has_required_fields(self):
        """Admin should have all required fields"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        data = response.json()

        required_fields = [
            'total_pois', 'iq_processed', 'iq_pending', 'iq_progress_pct',
            'with_coordinates', 'modules', 'sources', 'recent_processed',
            'top_pois', 'bottom_pois', 'import_batches'
        ]

        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        print(f"✓ All {len(required_fields)} required fields present")

    def test_admin_has_18_modules(self):
        """Admin should return 18 IQ Engine modules"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        data = response.json()

        modules = data.get('modules', [])
        assert len(modules) == 18, f"Expected 18 modules, got {len(modules)}"

        # Check module structure
        for module in modules:
            assert 'name' in module
            assert 'processed' in module
            assert 'avg_score' in module
            assert 'avg_confidence' in module
            assert 'pass' in module
            assert 'warn' in module
            assert 'fail' in module

        module_names = [m['name'] for m in modules]
        print(f"✓ Found 18 modules: {', '.join(module_names[:5])}...")

    def test_admin_modules_have_confidence(self):
        """Each module should have avg_confidence"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        data = response.json()

        modules = data.get('modules', [])

        for module in modules:
            conf = module.get('avg_confidence', None)
            assert conf is not None, f"Module {module.get('name')} missing confidence"
            assert 0 <= conf <= 1, f"Confidence {conf} out of range for {module.get('name')}"

        print("✓ All modules have valid confidence values")

    def test_admin_top_pois_structure(self):
        """Top POIs should have correct structure"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        data = response.json()

        top_pois = data.get('top_pois', [])
        assert len(top_pois) <= 10, f"Expected at most 10 top POIs, got {len(top_pois)}"

        for poi in top_pois:
            assert 'id' in poi
            assert 'name' in poi
            assert 'category' in poi
            assert 'region' in poi
            assert 'iq_score' in poi

        if top_pois:
            print(f"✓ Top POI: {top_pois[0]['name']} with score {top_pois[0]['iq_score']}")

    def test_admin_bottom_pois_structure(self):
        """Bottom POIs should have correct structure"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        data = response.json()

        bottom_pois = data.get('bottom_pois', [])
        assert len(bottom_pois) <= 10, f"Expected at most 10 bottom POIs, got {len(bottom_pois)}"

        for poi in bottom_pois:
            assert 'id' in poi
            assert 'name' in poi
            assert 'category' in poi
            assert 'region' in poi
            assert 'iq_score' in poi

        if bottom_pois:
            print(f"✓ Bottom POI: {bottom_pois[0]['name']} with score {bottom_pois[0]['iq_score']}")

    def test_admin_sources_structure(self):
        """Sources should have name and count"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        data = response.json()

        sources = data.get('sources', [])
        assert len(sources) > 0, "Should have at least one source"

        for source in sources:
            assert 'name' in source
            assert 'count' in source

        source_names = [s['name'] for s in sources]
        print(f"✓ Found {len(sources)} sources: {source_names[:3]}")

    def test_admin_recent_processed_structure(self):
        """Recent processed should have correct structure"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        data = response.json()

        recent = data.get('recent_processed', [])

        for item in recent[:5]:
            assert 'id' in item
            assert 'name' in item
            assert 'category' in item
            assert 'region' in item
            assert 'iq_score' in item
            assert 'iq_module_count' in item

        if recent:
            print(f"✓ Most recent: {recent[0]['name']} ({recent[0]['iq_module_count']} modules)")

    def test_admin_import_batches_structure(self):
        """Import batches should have correct structure"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/admin")
        data = response.json()

        batches = data.get('import_batches', [])

        for batch in batches:
            assert 'batch_id' in batch
            assert 'total' in batch
            assert 'iq_done' in batch

        print(f"✓ Found {len(batches)} import batches")

    def test_admin_consistency_with_overview(self):
        """Admin and Overview should have consistent data"""
        overview_resp = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        admin_resp = requests.get(f"{BASE_URL}/api/iq-monitor/admin")

        overview = overview_resp.json()
        admin = admin_resp.json()

        # Check key metrics match
        assert overview['total_pois'] == admin['total_pois'], "total_pois mismatch"
        assert overview['iq_processed'] == admin['iq_processed'], "iq_processed mismatch"
        assert overview['iq_pending'] == admin['iq_pending'], "iq_pending mismatch"
        assert overview['iq_progress_pct'] == admin['iq_progress_pct'], "iq_progress_pct mismatch"

        print("✓ Admin and Overview data consistent")


class TestIQMonitorDataContent:
    """Tests to verify actual data content"""

    def test_total_pois_matches_expected(self):
        """Should have ~4539 POIs as per previous import"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        data = response.json()

        total = data.get('total_pois', 0)
        assert total >= 4500, f"Expected ~4539 POIs, got {total}"
        print(f"✓ Total POIs: {total}")

    def test_iq_processed_count(self):
        """Should have ~2527 IQ processed as per context"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        data = response.json()

        processed = data.get('iq_processed', 0)
        assert processed >= 2500, f"Expected ~2527 processed, got {processed}"
        print(f"✓ IQ Processed: {processed}")

    def test_avg_score_reasonable(self):
        """Average IQ score should be reasonable (30-70 range)"""
        response = requests.get(f"{BASE_URL}/api/iq-monitor/overview")
        data = response.json()

        avg = data.get('avg_iq_score', 0)
        assert 30 <= avg <= 70, f"Average score {avg} seems unreasonable"
        print(f"✓ Average IQ Score: {avg}")


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
