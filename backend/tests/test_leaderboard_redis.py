"""
Test Redis-powered Leaderboard API endpoints.
Tests for P1 - Advanced Leaderboards feature with Redis Sorted Sets.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

class TestLeaderboardTopEndpoint:
    """Tests for GET /api/leaderboard/top - main leaderboard retrieval"""

    def test_get_top_default(self):
        """Test default top leaderboard (all-time, no region filter)"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/top")
        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "leaderboard" in data
        assert "total" in data
        assert "period" in data
        assert "region" in data

        # Verify default values
        assert data["period"] == "all"
        assert data["region"] == ""
        assert isinstance(data["leaderboard"], list)
        assert isinstance(data["total"], int)

        # Verify enriched user data structure if results exist
        if len(data["leaderboard"]) > 0:
            entry = data["leaderboard"][0]
            assert "user_id" in entry
            assert "score" in entry
            assert "rank" in entry
            assert "name" in entry
            assert "level" in entry
            assert "badges_count" in entry
            print(f"Top user: {entry['name']} with {entry['score']} points")

    def test_get_top_week_period(self):
        """Test leaderboard with week period filter"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/top?period=week")
        assert response.status_code == 200
        data = response.json()

        assert data["period"] == "week"
        assert "leaderboard" in data
        assert "total" in data
        print(f"Weekly leaderboard: {data['total']} players")

    def test_get_top_month_period(self):
        """Test leaderboard with month period filter"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/top?period=month")
        assert response.status_code == 200
        data = response.json()

        assert data["period"] == "month"
        assert "leaderboard" in data
        assert "total" in data
        print(f"Monthly leaderboard: {data['total']} players")

    def test_get_top_region_filter(self):
        """Test leaderboard with region filter"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/top?region=norte")
        assert response.status_code == 200
        data = response.json()

        # Region filter should be applied
        assert data["region"] == "norte"
        assert "leaderboard" in data
        print(f"Norte region: {len(data['leaderboard'])} players")

    def test_get_top_with_limit(self):
        """Test leaderboard with custom limit"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/top?limit=5")
        assert response.status_code == 200
        data = response.json()

        assert "leaderboard" in data
        # Leaderboard should not exceed requested limit
        assert len(data["leaderboard"]) <= 5


class TestLeaderboardStatsEndpoint:
    """Tests for GET /api/leaderboard/stats - aggregate statistics"""

    def test_get_stats(self):
        """Test leaderboard aggregate statistics"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/stats")
        assert response.status_code == 200
        data = response.json()

        # Verify required fields
        assert "total_explorers" in data
        assert "total_checkins" in data
        assert "total_xp" in data
        assert "top3" in data
        assert "top_regions" in data

        # Verify types
        assert isinstance(data["total_explorers"], int)
        assert isinstance(data["total_checkins"], int)
        assert isinstance(data["total_xp"], int)
        assert isinstance(data["top3"], list)
        assert isinstance(data["top_regions"], list)

        # Verify top3 enriched data
        if len(data["top3"]) > 0:
            top = data["top3"][0]
            assert "user_id" in top
            assert "name" in top
            assert "score" in top
            assert "rank" in top

        # Verify top_regions structure
        if len(data["top_regions"]) > 0:
            region = data["top_regions"][0]
            assert "region" in region
            assert "count" in region

        print(f"Stats: {data['total_explorers']} explorers, {data['total_checkins']} checkins")


class TestExplorerProfileEndpoint:
    """Tests for GET /api/leaderboard/explorer/{user_id} - detailed profile"""

    def test_get_explorer_profile_existing_user(self):
        """Test getting existing user's explorer profile"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/explorer/default_user")
        assert response.status_code == 200
        data = response.json()

        # Verify required fields
        assert "user_id" in data
        assert data["user_id"] == "default_user"
        assert "name" in data
        assert "level" in data
        assert "xp" in data
        assert "xp_to_next_level" in data
        assert "next_level_xp" in data
        assert "total_checkins" in data
        assert "badges" in data
        assert "badges_count" in data
        assert "region_stats" in data
        assert "category_stats" in data
        assert "recent_checkins" in data
        assert "streak_days" in data
        assert "member_since" in data
        assert "rank" in data

        # Verify types
        assert isinstance(data["level"], int)
        assert isinstance(data["xp"], int)
        assert isinstance(data["badges"], list)
        assert isinstance(data["region_stats"], list)
        assert isinstance(data["rank"], int)

        # Verify region_stats structure if present
        if len(data["region_stats"]) > 0:
            rs = data["region_stats"][0]
            assert "region" in rs
            assert "count" in rs
            assert "color" in rs

        print(f"Profile: {data['name']}, Level {data['level']}, Rank #{data['rank']}")

    def test_get_explorer_profile_nonexistent_user(self):
        """Test getting non-existent user's profile - should return default values"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/explorer/nonexistent_test_user")
        assert response.status_code == 200
        data = response.json()

        # Should return default values for non-existent user
        assert data["user_id"] == "nonexistent_test_user"
        assert data["name"] == "Explorador"
        assert data["level"] == 1
        assert data["xp"] == 0
        assert data["total_checkins"] == 0
        assert data["badges"] == []
        assert data["rank"] == 0


class TestLeaderboardRegionsEndpoint:
    """Tests for GET /api/leaderboard/regions - available regions"""

    def test_get_regions(self):
        """Test getting available regions with player counts"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/regions")
        assert response.status_code == 200
        data = response.json()

        # Should return a list
        assert isinstance(data, list)

        # Should have 7 Portuguese regions
        assert len(data) == 7

        # Verify structure of each region
        for region in data:
            assert "region" in region
            assert "players" in region
            assert isinstance(region["players"], int)

        # Check expected regions
        region_names = [r["region"] for r in data]
        expected_regions = ["norte", "centro", "lisboa", "alentejo", "algarve", "acores", "madeira"]
        for expected in expected_regions:
            assert expected in region_names, f"Missing region: {expected}"

        print(f"Regions: {[r['region'] + ':' + str(r['players']) for r in data]}")


class TestLeaderboardMeEndpoint:
    """Tests for GET /api/leaderboard/me - user's rank across periods"""

    def test_get_my_rank_existing_user(self):
        """Test getting rank for existing user"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/me?user_id=default_user")
        assert response.status_code == 200
        data = response.json()

        # Verify structure
        assert "user_id" in data
        assert data["user_id"] == "default_user"
        assert "all" in data
        assert "week" in data
        assert "month" in data

        # Each period should have rank and score
        for period in ["all", "week", "month"]:
            assert "rank" in data[period]
            assert "score" in data[period]
            assert isinstance(data[period]["rank"], int)
            assert isinstance(data[period]["score"], int)

        print(f"User ranks - All: #{data['all']['rank']}, Week: #{data['week']['rank']}, Month: #{data['month']['rank']}")

    def test_get_my_rank_nonexistent_user(self):
        """Test getting rank for non-existent user - should return zeros"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/me?user_id=nonexistent_test_user")
        assert response.status_code == 200
        data = response.json()

        # Should return 0 rank and score for all periods
        assert data["all"]["rank"] == 0
        assert data["all"]["score"] == 0


class TestLeaderboardSyncEndpoint:
    """Tests for POST /api/leaderboard/sync - manual MongoDB to Redis sync"""

    def test_sync_leaderboard(self):
        """Test manual sync from MongoDB to Redis"""
        response = requests.post(f"{BASE_URL}/api/leaderboard/sync")
        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "synced" in data
        assert "timestamp" in data

        # synced should be an integer
        assert isinstance(data["synced"], int)

        # timestamp should be an ISO format string
        assert isinstance(data["timestamp"], str)
        assert "T" in data["timestamp"]  # ISO format check

        print(f"Synced {data['synced']} users at {data['timestamp']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
