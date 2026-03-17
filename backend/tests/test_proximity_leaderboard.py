"""
Test Suite for Proximity (Geofencing) and Leaderboard APIs
Tests POI nearby detection, alerts, heatzone stats, and leaderboard rankings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Lisbon coordinates for testing
LISBON_LAT = 38.72
LISBON_LNG = -9.14


class TestProximityNearby:
    """Tests for GET /api/proximity/nearby - POI proximity detection"""

    def test_nearby_basic(self):
        """Test basic nearby query returns POIs sorted by distance"""
        response = requests.get(f"{BASE_URL}/api/proximity/nearby", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG,
            "radius_km": 5
        })
        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "pois" in data
        assert "total" in data
        assert "center" in data
        assert "radius_km" in data

        # Verify center coordinates
        assert data["center"]["lat"] == LISBON_LAT
        assert data["center"]["lng"] == LISBON_LNG
        assert data["radius_km"] == 5

        # Verify POIs are returned
        assert len(data["pois"]) > 0
        print(f"✓ Nearby basic: Found {data['total']} POIs within 5km")

    def test_nearby_pois_have_distance(self):
        """Test that returned POIs have distance_km and distance_m fields"""
        response = requests.get(f"{BASE_URL}/api/proximity/nearby", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG,
            "radius_km": 5
        })
        assert response.status_code == 200
        data = response.json()

        for poi in data["pois"][:5]:  # Check first 5
            assert "distance_km" in poi, f"POI {poi.get('name')} missing distance_km"
            assert "distance_m" in poi, f"POI {poi.get('name')} missing distance_m"
            assert isinstance(poi["distance_km"], (int, float))
            assert isinstance(poi["distance_m"], int)
            assert poi["distance_km"] <= 5  # Within radius
        print("✓ All POIs have distance_km and distance_m fields")

    def test_nearby_sorted_by_distance(self):
        """Test that POIs are sorted by distance (ascending)"""
        response = requests.get(f"{BASE_URL}/api/proximity/nearby", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG,
            "radius_km": 10
        })
        assert response.status_code == 200
        data = response.json()

        pois = data["pois"]
        if len(pois) > 1:
            distances = [p["distance_km"] for p in pois]
            assert distances == sorted(distances), "POIs should be sorted by distance"
        print(f"✓ POIs sorted by distance (first: {pois[0]['distance_km']}km, last: {pois[-1]['distance_km']}km)")

    def test_nearby_poi_fields(self):
        """Test that POIs have all required fields"""
        response = requests.get(f"{BASE_URL}/api/proximity/nearby", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG,
            "radius_km": 5
        })
        assert response.status_code == 200
        data = response.json()

        required_fields = ["id", "name", "category", "region", "location", "distance_km", "distance_m"]
        for poi in data["pois"][:3]:
            for field in required_fields:
                assert field in poi, f"POI missing required field: {field}"
        print("✓ POIs have all required fields")

    def test_nearby_min_iq_filter(self):
        """Test filtering by minimum IQ score"""
        response = requests.get(f"{BASE_URL}/api/proximity/nearby", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG,
            "radius_km": 10,
            "min_iq": 55
        })
        assert response.status_code == 200
        data = response.json()

        # All returned POIs should have IQ >= 55
        for poi in data["pois"]:
            iq = poi.get("iq_score", 0) or 0
            assert iq >= 55, f"POI {poi['name']} has IQ {iq}, expected >= 55"
        print(f"✓ min_iq filter: All {data['total']} POIs have IQ >= 55")

    def test_nearby_limit_parameter(self):
        """Test limit parameter restricts results"""
        response = requests.get(f"{BASE_URL}/api/proximity/nearby", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG,
            "radius_km": 50,
            "limit": 5
        })
        assert response.status_code == 200
        data = response.json()

        assert len(data["pois"]) <= 5
        print(f"✓ Limit parameter works: returned {len(data['pois'])} POIs")


class TestProximityAlerts:
    """Tests for GET /api/proximity/alerts - High-IQ POI alerts within 500m"""

    def test_alerts_basic(self):
        """Test alerts endpoint returns alert objects"""
        response = requests.get(f"{BASE_URL}/api/proximity/alerts", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG
        })
        assert response.status_code == 200
        data = response.json()

        assert "alerts" in data
        assert "total" in data
        assert isinstance(data["alerts"], list)
        print(f"✓ Alerts basic: Found {data['total']} alerts within 500m")

    def test_alerts_structure(self):
        """Test alert objects have required fields"""
        response = requests.get(f"{BASE_URL}/api/proximity/alerts", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG
        })
        assert response.status_code == 200
        data = response.json()

        if data["alerts"]:
            alert = data["alerts"][0]
            required_fields = ["poi_id", "poi_name", "category", "distance_m", "alert_type", "message"]
            for field in required_fields:
                assert field in alert, f"Alert missing field: {field}"
            print(f"✓ Alert structure verified: {alert['poi_name']} at {alert['distance_m']}m")
        else:
            print("✓ No alerts found (no high-IQ POIs within 500m)")

    def test_alerts_high_iq_only(self):
        """Test alerts only include POIs with IQ >= 55"""
        response = requests.get(f"{BASE_URL}/api/proximity/alerts", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG
        })
        assert response.status_code == 200
        data = response.json()

        for alert in data["alerts"]:
            iq = alert.get("iq_score", 0) or 0
            assert iq >= 55, f"Alert POI {alert['poi_name']} has IQ {iq}, expected >= 55"
        print(f"✓ All {len(data['alerts'])} alerts have IQ >= 55")

    def test_alerts_within_500m(self):
        """Test alerts are only for POIs within 500m"""
        response = requests.get(f"{BASE_URL}/api/proximity/alerts", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG
        })
        assert response.status_code == 200
        data = response.json()

        for alert in data["alerts"]:
            assert alert["distance_m"] <= 500, f"Alert {alert['poi_name']} at {alert['distance_m']}m exceeds 500m"
        print("✓ All alerts are within 500m radius")

    def test_alerts_type_classification(self):
        """Test alert_type is 'rare' for IQ >= 60 and 'nearby' otherwise"""
        response = requests.get(f"{BASE_URL}/api/proximity/alerts", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG
        })
        assert response.status_code == 200
        data = response.json()

        for alert in data["alerts"]:
            iq = alert.get("iq_score", 0) or 0
            expected_type = "rare" if iq >= 60 else "nearby"
            assert alert["alert_type"] == expected_type, f"Alert type mismatch for {alert['poi_name']}"
        print("✓ Alert types correctly classified (rare vs nearby)")


class TestProximityHeatzone:
    """Tests for GET /api/proximity/heatzone - Area density statistics"""

    def test_heatzone_basic(self):
        """Test heatzone returns area statistics"""
        response = requests.get(f"{BASE_URL}/api/proximity/heatzone", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG
        })
        assert response.status_code == 200
        data = response.json()

        assert "center" in data
        assert "radius_km" in data
        assert "total_pois" in data
        assert "categories" in data
        print(f"✓ Heatzone: {data['total_pois']} POIs in default radius")

    def test_heatzone_categories(self):
        """Test heatzone returns category breakdown"""
        response = requests.get(f"{BASE_URL}/api/proximity/heatzone", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG,
            "radius_km": 10
        })
        assert response.status_code == 200
        data = response.json()

        assert len(data["categories"]) > 0
        for cat in data["categories"]:
            assert "category" in cat
            assert "count" in cat
            assert "avg_iq" in cat

        # Verify sorted by count
        counts = [c["count"] for c in data["categories"]]
        assert counts == sorted(counts, reverse=True), "Categories should be sorted by count desc"
        print(f"✓ Heatzone categories: {len(data['categories'])} categories, top: {data['categories'][0]['category']}")

    def test_heatzone_custom_radius(self):
        """Test heatzone with custom radius"""
        response = requests.get(f"{BASE_URL}/api/proximity/heatzone", params={
            "lat": LISBON_LAT,
            "lng": LISBON_LNG,
            "radius_km": 5
        })
        assert response.status_code == 200
        data = response.json()

        assert data["radius_km"] == 5
        print(f"✓ Custom radius (5km): {data['total_pois']} POIs")


class TestLeaderboardTop:
    """Tests for GET /api/leaderboard/top - Ranked explorers"""

    def test_leaderboard_top_basic(self):
        """Test leaderboard top returns explorer rankings"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/top")
        assert response.status_code == 200
        data = response.json()

        assert "leaderboard" in data
        assert "total" in data
        assert "period" in data
        assert isinstance(data["leaderboard"], list)
        print(f"✓ Leaderboard top: {data['total']} explorers")

    def test_leaderboard_explorer_fields(self):
        """Test explorer objects have required fields"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/top")
        assert response.status_code == 200
        data = response.json()

        if data["leaderboard"]:
            explorer = data["leaderboard"][0]
            required_fields = ["rank", "user_id", "display_name", "avatar_color", "level", "xp", "total_checkins", "badges_count"]
            for field in required_fields:
                assert field in explorer, f"Explorer missing field: {field}"
            print(f"✓ Explorer fields verified: {explorer['display_name']} - Rank {explorer['rank']}")

    def test_leaderboard_period_all(self):
        """Test leaderboard with period=all (default)"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/top", params={"period": "all"})
        assert response.status_code == 200
        data = response.json()

        assert data["period"] == "all"
        print(f"✓ Period 'all': {data['total']} explorers")

    def test_leaderboard_period_month(self):
        """Test leaderboard with period=month"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/top", params={"period": "month"})
        assert response.status_code == 200
        data = response.json()

        assert data["period"] == "month"
        print(f"✓ Period 'month': {data['total']} explorers")

    def test_leaderboard_period_week(self):
        """Test leaderboard with period=week"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/top", params={"period": "week"})
        assert response.status_code == 200
        data = response.json()

        assert data["period"] == "week"
        print(f"✓ Period 'week': {data['total']} explorers")

    def test_leaderboard_limit(self):
        """Test leaderboard limit parameter"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/top", params={"limit": 5})
        assert response.status_code == 200
        data = response.json()

        assert len(data["leaderboard"]) <= 5
        print(f"✓ Leaderboard limit: returned {len(data['leaderboard'])} explorers")


class TestLeaderboardStats:
    """Tests for GET /api/leaderboard/stats - Overall statistics"""

    def test_stats_basic(self):
        """Test leaderboard stats returns overall statistics"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/stats")
        assert response.status_code == 200
        data = response.json()

        required_fields = ["total_explorers", "total_checkins", "total_xp"]
        for field in required_fields:
            assert field in data, f"Stats missing field: {field}"
        print(f"✓ Leaderboard stats: {data['total_explorers']} explorers, {data['total_checkins']} check-ins")

    def test_stats_top_regions(self):
        """Test stats includes top regions"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/stats")
        assert response.status_code == 200
        data = response.json()

        assert "top_regions" in data
        if data["top_regions"]:
            region = data["top_regions"][0]
            assert "region" in region
            assert "count" in region
            print(f"✓ Top region: {region['region']} with {region['count']} check-ins")
        else:
            print("✓ No top regions yet")


class TestLeaderboardExplorer:
    """Tests for GET /api/leaderboard/explorer/{user_id} - Explorer profile"""

    def test_explorer_profile_exists(self):
        """Test getting explorer profile for existing user"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/explorer/default_user")
        assert response.status_code == 200
        data = response.json()

        assert data["user_id"] == "default_user"
        assert "display_name" in data
        assert "level" in data
        assert "xp" in data
        assert "total_checkins" in data
        print(f"✓ Explorer profile: {data['display_name']} - Level {data['level']}, {data['xp']} XP")

    def test_explorer_profile_details(self):
        """Test explorer profile has all detail fields"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/explorer/default_user")
        assert response.status_code == 200
        data = response.json()

        detail_fields = ["badges", "badges_count", "region_stats", "category_stats", "rank"]
        for field in detail_fields:
            assert field in data, f"Explorer profile missing field: {field}"
        print(f"✓ Explorer details: {data['badges_count']} badges, rank #{data['rank']}")

    def test_explorer_profile_nonexistent(self):
        """Test getting profile for non-existent user returns default"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/explorer/nonexistent_user_12345")
        assert response.status_code == 200
        data = response.json()

        # Should return default profile
        assert data["user_id"] == "nonexistent_user_12345"
        assert data["xp"] == 0
        assert data["total_checkins"] == 0
        print("✓ Non-existent user returns default profile with 0 XP")

    def test_explorer_xp_progress(self):
        """Test explorer profile has XP progress fields"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/explorer/default_user")
        assert response.status_code == 200
        data = response.json()

        assert "xp_to_next_level" in data
        assert "next_level_xp" in data
        print(f"✓ XP progress: {data['xp']}/{data['next_level_xp']} XP ({data['xp_to_next_level']} to next level)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
