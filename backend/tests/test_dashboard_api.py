"""
Dashboard/Gamification API Tests
Tests for:
- GET /api/dashboard/leaderboard (public)
- GET /api/dashboard/progress (auth required)
- GET /api/dashboard/badges (auth required)
- GET /api/dashboard/statistics (auth required)
- GET /api/dashboard/history (auth required)
- POST /api/dashboard/visit?poi_id={id} (auth required)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDashboardPublicEndpoints:
    """Test public dashboard endpoints (no auth required)"""

    def test_leaderboard_returns_200(self):
        """Test leaderboard endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/dashboard/leaderboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    def test_leaderboard_returns_list(self):
        """Test leaderboard returns a list"""
        response = requests.get(f"{BASE_URL}/api/dashboard/leaderboard")
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    def test_leaderboard_entry_structure(self):
        """Test leaderboard entries have expected fields"""
        response = requests.get(f"{BASE_URL}/api/dashboard/leaderboard")
        data = response.json()
        if len(data) > 0:
            entry = data[0]
            assert "rank" in entry, "Missing 'rank' field"
            assert "user_id" in entry, "Missing 'user_id' field"
            assert "name" in entry, "Missing 'name' field"
            assert "total_points" in entry, "Missing 'total_points' field"
            assert "level" in entry, "Missing 'level' field"
            print(f"Leaderboard entry verified: {entry['name']} with {entry['total_points']} points")
        else:
            print("Leaderboard is empty - no entries to validate")

    def test_leaderboard_with_limit(self):
        """Test leaderboard limit parameter"""
        response = requests.get(f"{BASE_URL}/api/dashboard/leaderboard?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5, f"Expected max 5 entries, got {len(data)}"
        print(f"Leaderboard returned {len(data)} entries with limit=5")


class TestDashboardAuthenticatedEndpoints:
    """Test authenticated dashboard endpoints - should return 401 without auth"""

    def test_progress_requires_auth(self):
        """Test GET /api/dashboard/progress requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/progress")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Expected error detail in response"
        print(f"Progress endpoint correctly requires auth: {data.get('detail')}")

    def test_badges_requires_auth(self):
        """Test GET /api/dashboard/badges requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/badges")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("Badges endpoint correctly requires auth")

    def test_statistics_requires_auth(self):
        """Test GET /api/dashboard/statistics requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/statistics")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("Statistics endpoint correctly requires auth")

    def test_history_requires_auth(self):
        """Test GET /api/dashboard/history requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/history")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("History endpoint correctly requires auth")

    def test_visit_requires_auth(self):
        """Test POST /api/dashboard/visit requires authentication"""
        # Use a valid POI ID from the heritage items
        poi_id = "c8ec52a9-1aaf-4f51-9ce2-36a69e8396d9"
        response = requests.post(f"{BASE_URL}/api/dashboard/visit?poi_id={poi_id}")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("Visit endpoint correctly requires auth")


class TestDashboardWithInvalidToken:
    """Test endpoints with invalid/expired tokens"""

    def test_progress_with_invalid_token(self):
        """Test progress endpoint with invalid Bearer token"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(f"{BASE_URL}/api/dashboard/progress", headers=headers)
        assert response.status_code == 401, f"Expected 401 with invalid token, got {response.status_code}"
        print("Progress correctly rejects invalid token")

    def test_badges_with_invalid_token(self):
        """Test badges endpoint with invalid Bearer token"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(f"{BASE_URL}/api/dashboard/badges", headers=headers)
        assert response.status_code == 401, f"Expected 401 with invalid token, got {response.status_code}"
        print("Badges correctly rejects invalid token")


class TestRelatedEndpoints:
    """Test related gamification endpoints"""

    def test_badges_list_available(self):
        """Test /api/badges returns available badges"""
        response = requests.get(f"{BASE_URL}/api/badges")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Expected list of badges"
        if len(data) > 0:
            badge = data[0]
            assert "id" in badge
            assert "name" in badge
            assert "description" in badge
            print(f"Found {len(data)} badges available")

    def test_heritage_items_exist(self):
        """Verify heritage items exist for visit testing"""
        response = requests.get(f"{BASE_URL}/api/heritage?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0, "No heritage items found - needed for visit tests"
        print(f"Found {len(data)} heritage items")

    def test_gamification_progress_endpoint(self):
        """Test original gamification progress endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/gamification/progress")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Gamification progress endpoint correctly requires auth")


class TestLeaderboardSorting:
    """Test leaderboard sorting and ranking"""

    def test_leaderboard_is_sorted_by_points(self):
        """Verify leaderboard is sorted by total_points descending"""
        response = requests.get(f"{BASE_URL}/api/dashboard/leaderboard")
        data = response.json()

        if len(data) > 1:
            for i in range(len(data) - 1):
                assert data[i]["total_points"] >= data[i+1]["total_points"], \
                    f"Leaderboard not sorted: {data[i]['total_points']} < {data[i+1]['total_points']}"
            print("Leaderboard correctly sorted by points (descending)")
        else:
            print("Not enough entries to verify sorting")

    def test_leaderboard_ranks_are_sequential(self):
        """Verify ranks are sequential starting from 1"""
        response = requests.get(f"{BASE_URL}/api/dashboard/leaderboard")
        data = response.json()

        for i, entry in enumerate(data):
            expected_rank = i + 1
            assert entry["rank"] == expected_rank, \
                f"Expected rank {expected_rank}, got {entry['rank']}"
        print(f"Ranks verified: 1 to {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
