"""
Backend tests for 3 new features:
1. Guia de Transportes - 37 operators, 8 cards, 5 sections
2. Webcams de Praia - 12 beachcams
3. Explorador Noturno - Night POIs with night_type and night_icon
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://current-app-1.preview.emergentagent.com').rstrip('/')


class TestTransportOperators:
    """Transport API /api/transportes/operators tests"""

    def test_get_all_operators_returns_37(self):
        """Should return 37 operators total"""
        response = requests.get(f"{BASE_URL}/api/transportes/operators")
        assert response.status_code == 200
        data = response.json()
        assert "operators" in data
        assert "total" in data
        assert data["total"] == 37, f"Expected 37 operators, got {data['total']}"
        print(f"PASS: Total operators = {data['total']}")

    def test_get_lisboa_operators_returns_6(self):
        """Should return 6 operators for Lisbon section"""
        response = requests.get(f"{BASE_URL}/api/transportes/operators?section=lisboa")
        assert response.status_code == 200
        data = response.json()
        assert "operators" in data
        assert data["total"] == 6, f"Expected 6 operators for Lisboa, got {data['total']}"
        # Verify all are from lisboa section
        for op in data["operators"]:
            assert op.get("section") == "lisboa", f"Operator {op.get('name')} has section {op.get('section')}"
        print(f"PASS: Lisboa operators = {data['total']}")

    def test_get_nacional_operators(self):
        """Should return nacional section operators"""
        response = requests.get(f"{BASE_URL}/api/transportes/operators?section=nacional")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] > 0
        print(f"PASS: Nacional operators = {data['total']}")

    def test_get_porto_operators(self):
        """Should return porto section operators"""
        response = requests.get(f"{BASE_URL}/api/transportes/operators?section=porto")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] > 0
        print(f"PASS: Porto operators = {data['total']}")

    def test_operators_have_required_fields(self):
        """Operators should have required fields"""
        response = requests.get(f"{BASE_URL}/api/transportes/operators")
        assert response.status_code == 200
        data = response.json()
        if data["operators"]:
            op = data["operators"][0]
            assert "name" in op, "Operator missing 'name'"
            assert "section" in op, "Operator missing 'section'"
            assert "transport_type" in op, "Operator missing 'transport_type'"
            assert "geographic_zone" in op, "Operator missing 'geographic_zone'"
            print("PASS: Operators have required fields")


class TestTransportCards:
    """Transport API /api/transportes/cards tests"""

    def test_get_cards_returns_8(self):
        """Should return 8 transport cards"""
        response = requests.get(f"{BASE_URL}/api/transportes/cards")
        assert response.status_code == 200
        data = response.json()
        assert "cards" in data
        assert "total" in data
        assert data["total"] == 8, f"Expected 8 cards, got {data['total']}"
        print(f"PASS: Transport cards = {data['total']}")

    def test_cards_have_required_fields(self):
        """Cards should have name, city_zone, base_price"""
        response = requests.get(f"{BASE_URL}/api/transportes/cards")
        assert response.status_code == 200
        data = response.json()
        if data["cards"]:
            card = data["cards"][0]
            assert "name" in card, "Card missing 'name'"
            assert "city_zone" in card, "Card missing 'city_zone'"
            assert "base_price" in card, "Card missing 'base_price'"
            print(f"PASS: Cards have required fields (name={card['name']}, price={card['base_price']})")


class TestTransportSections:
    """Transport API /api/transportes/sections tests"""

    def test_get_sections_returns_5(self):
        """Should return 5 sections with counts"""
        response = requests.get(f"{BASE_URL}/api/transportes/sections")
        assert response.status_code == 200
        data = response.json()
        assert "sections" in data
        assert len(data["sections"]) == 5, f"Expected 5 sections, got {len(data['sections'])}"
        print(f"PASS: Sections count = {len(data['sections'])}")

    def test_sections_have_counts(self):
        """Each section should have id, label, count, icon"""
        response = requests.get(f"{BASE_URL}/api/transportes/sections")
        assert response.status_code == 200
        data = response.json()
        for sec in data["sections"]:
            assert "id" in sec
            assert "label" in sec
            assert "count" in sec
            assert "icon" in sec
            assert sec["count"] > 0
        # Verify total_operators matches sum of counts
        total = sum(s["count"] for s in data["sections"])
        assert data.get("total_operators") == total
        print(f"PASS: Sections have correct structure, total_operators={total}")


class TestBeachcamList:
    """Beachcam API /api/beachcams/list tests"""

    def test_get_all_beachcams_returns_12(self):
        """Should return 12 beachcams"""
        response = requests.get(f"{BASE_URL}/api/beachcams/list")
        assert response.status_code == 200
        data = response.json()
        assert "beachcams" in data
        assert "total" in data
        assert data["total"] == 12, f"Expected 12 beachcams, got {data['total']}"
        print(f"PASS: Total beachcams = {data['total']}")

    def test_filter_by_algarve_region(self):
        """Should filter beachcams by Algarve region"""
        response = requests.get(f"{BASE_URL}/api/beachcams/list?region=Algarve")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] > 0, "Expected at least 1 Algarve beachcam"
        for cam in data["beachcams"]:
            assert cam["region"] == "Algarve", f"Expected Algarve, got {cam['region']}"
        print(f"PASS: Algarve beachcams = {data['total']}")

    def test_filter_by_lisboa_region(self):
        """Should filter beachcams by Lisboa region"""
        response = requests.get(f"{BASE_URL}/api/beachcams/list?region=Lisboa")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] > 0
        for cam in data["beachcams"]:
            assert cam["region"] == "Lisboa"
        print(f"PASS: Lisboa beachcams = {data['total']}")

    def test_beachcams_have_required_fields(self):
        """Beachcams should have id, name, region, embed_url, location, surf_level"""
        response = requests.get(f"{BASE_URL}/api/beachcams/list")
        assert response.status_code == 200
        data = response.json()
        if data["beachcams"]:
            cam = data["beachcams"][0]
            assert "id" in cam, "Missing 'id'"
            assert "name" in cam, "Missing 'name'"
            assert "region" in cam, "Missing 'region'"
            assert "embed_url" in cam, "Missing 'embed_url'"
            assert "location" in cam, "Missing 'location'"
            assert "surf_level" in cam, "Missing 'surf_level'"
            print(f"PASS: Beachcams have required fields (id={cam['id']})")


class TestBeachcamDetail:
    """Beachcam API /api/beachcams/{cam_id} tests"""

    def test_get_nazare_norte_beachcam(self):
        """Should return Nazare Norte beachcam details"""
        response = requests.get(f"{BASE_URL}/api/beachcams/nazare-norte")
        assert response.status_code == 200
        data = response.json()
        assert data.get("id") == "nazare-norte"
        assert "Nazare" in data.get("name", "")
        assert data.get("region") == "Centro"
        assert "embed_url" in data
        assert "highlights" in data
        print(f"PASS: Nazare Norte beachcam found (name={data['name']})")

    def test_get_nonexistent_beachcam(self):
        """Should return error for nonexistent beachcam"""
        response = requests.get(f"{BASE_URL}/api/beachcams/nonexistent-beach")
        assert response.status_code == 200  # API returns 200 with error
        data = response.json()
        assert "error" in data
        print("PASS: Nonexistent beachcam returns error")


class TestNightExplorer:
    """Night Explorer API /api/map/night-explorer tests"""

    def test_night_explorer_returns_items(self):
        """Should return night POIs with night_type and night_icon"""
        response = requests.get(f"{BASE_URL}/api/map/night-explorer")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] > 0, "Expected at least some night POIs"
        print(f"PASS: Night explorer returns {data['total']} items")

    def test_night_pois_have_night_type(self):
        """Night POIs should have night_type field"""
        response = requests.get(f"{BASE_URL}/api/map/night-explorer")
        assert response.status_code == 200
        data = response.json()
        if data["items"]:
            item = data["items"][0]
            assert "night_type" in item, "Missing 'night_type'"
            valid_types = ["Gastronomia Noturna", "Evento/Festa", "Sabores Nocturnos",
                          "Iluminacao Patrimonial", "Arte & Cultura", "Miradouro/Lenda"]
            assert item["night_type"] in valid_types, f"Invalid night_type: {item['night_type']}"
            print(f"PASS: Night POI has night_type={item['night_type']}")

    def test_night_pois_have_night_icon(self):
        """Night POIs should have night_icon field"""
        response = requests.get(f"{BASE_URL}/api/map/night-explorer")
        assert response.status_code == 200
        data = response.json()
        if data["items"]:
            item = data["items"][0]
            assert "night_icon" in item, "Missing 'night_icon'"
            valid_icons = ["restaurant", "celebration", "local-dining", "church", "palette", "visibility"]
            assert item["night_icon"] in valid_icons, f"Invalid night_icon: {item['night_icon']}"
            print(f"PASS: Night POI has night_icon={item['night_icon']}")

    def test_night_pois_have_location(self):
        """Night POIs should have location for map display"""
        response = requests.get(f"{BASE_URL}/api/map/night-explorer")
        assert response.status_code == 200
        data = response.json()
        for item in data["items"][:5]:  # Check first 5
            assert "location" in item, f"Missing location for {item.get('name')}"
            assert "lat" in item["location"]
            assert "lng" in item["location"]
        print("PASS: Night POIs have valid locations")

    def test_night_pois_limited_to_800(self):
        """Night explorer should return max 800 POIs"""
        response = requests.get(f"{BASE_URL}/api/map/night-explorer")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] <= 800, f"Expected max 800, got {data['total']}"
        print(f"PASS: Night POIs within 800 limit (got {data['total']})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
