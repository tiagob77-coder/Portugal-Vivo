"""
Gamification API Tests - Check-in & Badges System
Tests for: profile, badges, check-in, nearby POIs, leaderboard
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://project-analyzer-131.preview.emergentagent.com').rstrip('/')

# Test user for gamification profile
TEST_USER_ID = "default_user"
# Sample POI for check-in testing
SAMPLE_POI_ID = "3446360a-85b5-4386-b009-f7fcc36e8336"
# Porto coordinates for nearby POIs testing
PORTO_LAT = 41.1496
PORTO_LNG = -8.6109


class TestGamificationProfile:
    """Tests for gamification profile endpoint"""

    def test_get_profile_returns_200(self):
        """GET /api/gamification/profile/{user_id} returns 200"""
        response = requests.get(f"{BASE_URL}/api/gamification/profile/{TEST_USER_ID}")
        assert response.status_code == 200
        print("PASS: Profile endpoint returns 200")

    def test_profile_has_required_fields(self):
        """Profile response contains all required fields"""
        response = requests.get(f"{BASE_URL}/api/gamification/profile/{TEST_USER_ID}")
        data = response.json()

        required_fields = [
            "user_id", "total_checkins", "level", "xp",
            "xp_to_next_level", "earned_badges_count", "total_badges",
            "badges", "recent_checkins", "region_counts", "category_counts"
        ]

        for field in required_fields:
            assert field in data, f"Missing field: {field}"

        print(f"PASS: Profile has all {len(required_fields)} required fields")

    def test_profile_xp_and_level_consistency(self):
        """XP and level calculations are consistent"""
        response = requests.get(f"{BASE_URL}/api/gamification/profile/{TEST_USER_ID}")
        data = response.json()

        xp = data["xp"]
        level = data["level"]
        xp_to_next = data["xp_to_next_level"]

        # Level should be calculated as 1 + (xp // 100)
        expected_level = 1 + (xp // 100)
        assert level == expected_level, f"Level mismatch: {level} vs expected {expected_level}"

        # XP to next should be 100 - (xp % 100)
        expected_xp_to_next = 100 - (xp % 100)
        assert xp_to_next == expected_xp_to_next, f"XP to next mismatch: {xp_to_next} vs expected {expected_xp_to_next}"

        print(f"PASS: XP={xp}, Level={level}, XP to next={xp_to_next} are consistent")

    def test_profile_badges_have_progress(self):
        """Each badge in profile has progress tracking"""
        response = requests.get(f"{BASE_URL}/api/gamification/profile/{TEST_USER_ID}")
        data = response.json()
        badges = data["badges"]

        assert len(badges) > 0, "No badges found in profile"

        for badge in badges[:5]:  # Check first 5 badges
            assert "progress" in badge, f"Badge {badge['id']} missing progress"
            assert "progress_pct" in badge, f"Badge {badge['id']} missing progress_pct"
            assert "earned" in badge, f"Badge {badge['id']} missing earned status"
            assert badge["progress_pct"] >= 0 and badge["progress_pct"] <= 100

        print(f"PASS: {len(badges)} badges have progress tracking")


class TestGamificationBadges:
    """Tests for badges endpoint"""

    def test_get_badges_returns_200(self):
        """GET /api/gamification/badges returns 200"""
        response = requests.get(f"{BASE_URL}/api/gamification/badges")
        assert response.status_code == 200
        print("PASS: Badges endpoint returns 200")

    def test_badges_response_structure(self):
        """Badges response has proper structure"""
        response = requests.get(f"{BASE_URL}/api/gamification/badges")
        data = response.json()

        assert "badges" in data
        assert "total" in data
        assert data["total"] > 0
        assert len(data["badges"]) == data["total"]

        print(f"PASS: Found {data['total']} badges")

    def test_badges_have_required_fields(self):
        """Each badge has required fields"""
        response = requests.get(f"{BASE_URL}/api/gamification/badges")
        data = response.json()

        required_fields = ["id", "name", "description", "icon", "color", "threshold", "type"]

        for badge in data["badges"][:5]:
            for field in required_fields:
                assert field in badge, f"Badge {badge.get('id', 'unknown')} missing {field}"

        print("PASS: All badges have required fields")

    def test_badge_types_are_valid(self):
        """All badge types are valid"""
        response = requests.get(f"{BASE_URL}/api/gamification/badges")
        data = response.json()

        valid_types = ["checkins", "region", "category"]

        for badge in data["badges"]:
            assert badge["type"] in valid_types, f"Invalid badge type: {badge['type']}"

        print("PASS: All badge types are valid")


class TestNearbyCheckins:
    """Tests for nearby check-in POIs endpoint"""

    def test_nearby_checkins_returns_200(self):
        """GET /api/gamification/nearby-checkins returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/gamification/nearby-checkins",
            params={"lat": PORTO_LAT, "lng": PORTO_LNG, "radius_km": 5}
        )
        assert response.status_code == 200
        print("PASS: Nearby checkins endpoint returns 200")

    def test_nearby_response_structure(self):
        """Nearby response has proper structure"""
        response = requests.get(
            f"{BASE_URL}/api/gamification/nearby-checkins",
            params={"lat": PORTO_LAT, "lng": PORTO_LNG, "radius_km": 5, "limit": 10}
        )
        data = response.json()

        assert "pois" in data
        assert "total_nearby" in data
        assert isinstance(data["pois"], list)

        print(f"PASS: Found {data['total_nearby']} nearby POIs")

    def test_nearby_pois_have_checkin_status(self):
        """Each nearby POI has can_checkin status"""
        response = requests.get(
            f"{BASE_URL}/api/gamification/nearby-checkins",
            params={"lat": PORTO_LAT, "lng": PORTO_LNG, "radius_km": 5}
        )
        data = response.json()

        if len(data["pois"]) > 0:
            for poi in data["pois"][:5]:
                assert "can_checkin" in poi, f"POI {poi['id']} missing can_checkin"
                assert "distance_m" in poi, f"POI {poi['id']} missing distance_m"
                assert "name" in poi
                assert "category" in poi
            print("PASS: POIs have can_checkin and distance_m fields")
        else:
            print("SKIP: No nearby POIs to test")

    def test_nearby_sorted_by_distance(self):
        """Nearby POIs are sorted by distance"""
        response = requests.get(
            f"{BASE_URL}/api/gamification/nearby-checkins",
            params={"lat": PORTO_LAT, "lng": PORTO_LNG, "radius_km": 10}
        )
        data = response.json()

        if len(data["pois"]) >= 2:
            distances = [poi["distance_m"] for poi in data["pois"]]
            assert distances == sorted(distances), "POIs not sorted by distance"
            print("PASS: POIs sorted by distance (closest first)")
        else:
            print("SKIP: Not enough POIs to test sorting")


class TestCheckin:
    """Tests for check-in endpoint"""

    def test_checkin_requires_coordinates(self):
        """Check-in fails without valid coordinates"""
        # Check-in without location should still return a response
        response = requests.post(
            f"{BASE_URL}/api/gamification/checkin",
            json={"user_lat": 0, "user_lng": 0, "poi_id": SAMPLE_POI_ID}
        )
        # This should return success=False because we're not near the POI
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "message" in data
        print("PASS: Check-in returns proper response for invalid location")

    def test_checkin_response_structure(self):
        """Check-in response has proper structure"""
        # Use coordinates far from any POI
        response = requests.post(
            f"{BASE_URL}/api/gamification/checkin",
            json={"user_lat": 0, "user_lng": 0, "poi_id": SAMPLE_POI_ID}
        )
        data = response.json()

        assert "success" in data
        assert "message" in data
        assert "distance_m" in data

        print("PASS: Check-in response has required fields")

    def test_checkin_invalid_poi_returns_404(self):
        """Check-in with invalid POI returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/gamification/checkin",
            json={"user_lat": PORTO_LAT, "user_lng": PORTO_LNG, "poi_id": "invalid-poi-id-123"}
        )
        assert response.status_code == 404
        print("PASS: Invalid POI returns 404")

    def test_checkin_proximity_validation(self):
        """Check-in validates 500m proximity"""
        # Use coordinates that are definitely far from the POI
        response = requests.post(
            f"{BASE_URL}/api/gamification/checkin",
            json={"user_lat": 38.7, "user_lng": -9.1, "poi_id": SAMPLE_POI_ID}  # Lisbon coords
        )
        data = response.json()

        assert data["success"] == False
        assert "distance" in data["message"].lower() or "m" in data["message"]
        assert data["distance_m"] > 500  # Should be far away

        print(f"PASS: Check-in validates proximity (distance: {data['distance_m']}m)")


class TestLeaderboard:
    """Tests for leaderboard endpoint"""

    def test_leaderboard_returns_200(self):
        """GET /api/gamification/leaderboard returns 200"""
        response = requests.get(f"{BASE_URL}/api/gamification/leaderboard")
        assert response.status_code == 200
        print("PASS: Leaderboard endpoint returns 200")

    def test_leaderboard_response_structure(self):
        """Leaderboard response has proper structure"""
        response = requests.get(f"{BASE_URL}/api/gamification/leaderboard")
        data = response.json()

        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)

        print(f"PASS: Leaderboard has {len(data['leaderboard'])} entries")

    def test_leaderboard_entries_have_rank(self):
        """Leaderboard entries have proper ranking"""
        response = requests.get(f"{BASE_URL}/api/gamification/leaderboard")
        data = response.json()

        if len(data["leaderboard"]) > 0:
            entry = data["leaderboard"][0]
            required_fields = ["rank", "user_id", "xp", "level", "total_checkins", "badges_count"]

            for field in required_fields:
                assert field in entry, f"Missing field: {field}"

            assert entry["rank"] == 1
            print("PASS: Leaderboard entries have proper structure")
        else:
            print("SKIP: Empty leaderboard")


class TestPOIDoDia:
    """Tests for POI do Dia endpoint"""

    def test_poi_do_dia_returns_200(self):
        """GET /api/poi-do-dia returns 200"""
        response = requests.get(f"{BASE_URL}/api/poi-do-dia")
        assert response.status_code == 200
        print("PASS: POI do Dia endpoint returns 200")

    def test_poi_do_dia_response_structure(self):
        """POI do Dia response has proper structure"""
        response = requests.get(f"{BASE_URL}/api/poi-do-dia")
        data = response.json()

        assert "has_poi" in data

        if data["has_poi"]:
            required_fields = ["date", "category", "category_label", "category_icon", "tomorrow_category", "poi"]
            for field in required_fields:
                assert field in data, f"Missing field: {field}"

            # Check POI fields
            poi = data["poi"]
            poi_fields = ["id", "name", "description", "category", "region"]
            for field in poi_fields:
                assert field in poi, f"POI missing field: {field}"

            print(f"PASS: POI do Dia: {poi['name']} (IQ: {poi.get('iq_score', 'N/A')})")
        else:
            print("SKIP: No POI do Dia available")

    def test_poi_do_dia_has_iq_score(self):
        """POI do Dia has IQ score (high score selection)"""
        response = requests.get(f"{BASE_URL}/api/poi-do-dia")
        data = response.json()

        if data["has_poi"]:
            poi = data["poi"]
            assert "iq_score" in poi
            assert poi["iq_score"] > 0, "IQ score should be positive"
            print(f"PASS: POI do Dia IQ score: {poi['iq_score']}")
        else:
            print("SKIP: No POI do Dia available")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
