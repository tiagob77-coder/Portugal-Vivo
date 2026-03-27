"""
Test Suite for P2/P3 Features:
- Auth API: Login, Register, Forgot Password
- Mobility API: Metro Lisboa, CP Trains, Ferries
- Push Notifications: Registration (auth required)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://project-analyzer-131.preview.emergentagent.com").rstrip("/")

# Test credentials
TEST_EMAIL = "teste@patrimonio.pt"
TEST_PASSWORD = "teste123"


class TestAuthLogin:
    """Auth Login API Tests"""

    def test_login_success(self):
        """Test successful login with test user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "user" in data, "Response should contain 'user'"
        assert "session_token" in data, "Response should contain 'session_token'"
        assert data["user"]["email"] == TEST_EMAIL, "User email should match"
        assert len(data["session_token"]) > 20, "Session token should be valid string"

    def test_login_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": "wrongpassword123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

        data = response.json()
        assert "detail" in data, "Error response should contain 'detail'"

    def test_login_nonexistent_user(self):
        """Test login with nonexistent email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@test.com", "password": "anypassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_login_missing_fields(self):
        """Test login with missing required fields"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL}  # Missing password
        )
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"


class TestAuthRegister:
    """Auth Register API Tests"""

    def test_register_new_user(self):
        """Test registering a new user"""
        unique_email = f"test_user_{uuid.uuid4().hex[:8]}@test.com"

        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": unique_email,
                "password": "testpass123",
                "name": "Test User"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "message" in data, "Response should contain 'message'"
        assert "user_id" in data, "Response should contain 'user_id'"
        assert data["user_id"].startswith("user_"), "User ID should have proper format"

    def test_register_duplicate_email(self):
        """Test registering with existing email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_EMAIL,
                "password": "newpassword",
                "name": "Test User"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

        data = response.json()
        assert "detail" in data, "Error response should contain 'detail'"

    def test_register_short_password(self):
        """Test registering with password too short"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"short_pass_{uuid.uuid4().hex[:8]}@test.com",
                "password": "12345",  # Less than 6 chars
                "name": "Test User"
            }
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"

    def test_register_missing_fields(self):
        """Test registering with missing required fields"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": "test@test.com"}  # Missing password and name
        )
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"


class TestForgotPassword:
    """Forgot Password API Tests"""

    def test_forgot_password_existing_email(self):
        """Test forgot password with existing email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": TEST_EMAIL}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "message" in data, "Response should contain 'message'"

    def test_forgot_password_nonexistent_email(self):
        """Test forgot password with nonexistent email - should not reveal if email exists"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={"email": "nonexistent_xyz@test.com"}
        )
        # Should return 200 even for nonexistent email (security best practice)
        assert response.status_code == 200, f"Expected 200 (security), got {response.status_code}"

    def test_forgot_password_missing_email(self):
        """Test forgot password with missing email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/forgot-password",
            json={}
        )
        assert response.status_code == 422, f"Expected 422 validation error, got {response.status_code}"


class TestMetroLisboa:
    """Metro Lisboa API Tests"""

    def test_get_metro_lines(self):
        """Test getting all Metro Lisboa lines"""
        response = requests.get(f"{BASE_URL}/api/mobility/metro/lines")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "lines" in data, "Response should contain 'lines'"
        assert len(data["lines"]) == 4, "Should return exactly 4 Metro lines"

        # Verify line structure
        line_ids = [line["id"] for line in data["lines"]]
        assert "azul" in line_ids, "Should have 'azul' line"
        assert "amarela" in line_ids, "Should have 'amarela' line"
        assert "verde" in line_ids, "Should have 'verde' line"
        assert "vermelha" in line_ids, "Should have 'vermelha' line"

        # Verify line properties
        for line in data["lines"]:
            assert "id" in line, "Line should have 'id'"
            assert "name" in line, "Line should have 'name'"
            assert "color" in line, "Line should have 'color'"
            assert "terminals" in line, "Line should have 'terminals'"

    def test_get_metro_stations(self):
        """Test getting all Metro stations"""
        response = requests.get(f"{BASE_URL}/api/mobility/metro/stations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "stations" in data, "Response should contain 'stations'"
        assert "total" in data, "Response should contain 'total'"
        assert data["total"] > 0, "Should have at least 1 station"

        # Verify station structure
        for station in data["stations"]:
            assert "name" in station, "Station should have 'name'"
            assert "lines" in station, "Station should have 'lines'"
            assert "lat" in station, "Station should have 'lat'"
            assert "lng" in station, "Station should have 'lng'"

    def test_get_metro_stations_filtered_by_line(self):
        """Test filtering Metro stations by line"""
        response = requests.get(f"{BASE_URL}/api/mobility/metro/stations?line=azul")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "stations" in data, "Response should contain 'stations'"

        # All returned stations should be on the azul line
        for station in data["stations"]:
            assert "azul" in station["lines"], f"Station {station['name']} should be on azul line"

    def test_get_metro_schedule_valid_line(self):
        """Test getting Metro schedule for valid line"""
        response = requests.get(f"{BASE_URL}/api/mobility/metro/schedule/azul")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "line" in data, "Response should contain 'line'"
        assert "first_train" in data, "Response should contain 'first_train'"
        assert "last_train" in data, "Response should contain 'last_train'"
        assert "frequency_min" in data, "Response should contain 'frequency_min'"
        assert "status" in data, "Response should contain 'status'"

        # Verify schedule data
        assert data["first_train"] == "06:30", "First train should be at 06:30"
        assert data["last_train"] == "01:00", "Last train should be at 01:00"
        assert data["status"] == "operational", "Status should be operational"

    def test_get_metro_schedule_invalid_line(self):
        """Test getting Metro schedule for invalid line"""
        response = requests.get(f"{BASE_URL}/api/mobility/metro/schedule/invalid_line")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestCPTrains:
    """CP Trains API Tests (Demo Data)"""

    def test_get_train_stations(self):
        """Test getting all train stations"""
        response = requests.get(f"{BASE_URL}/api/mobility/trains/stations")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "stations" in data, "Response should contain 'stations'"
        assert "total" in data, "Response should contain 'total'"
        assert data["total"] >= 5, "Should have at least 5 stations"

        # Verify station structure
        for station in data["stations"]:
            assert "id" in station, "Station should have 'id'"
            assert "name" in station, "Station should have 'name'"
            assert "city" in station, "Station should have 'city'"
            assert "lat" in station, "Station should have 'lat'"
            assert "lng" in station, "Station should have 'lng'"

    def test_get_train_stations_filtered_by_city(self):
        """Test filtering train stations by city"""
        response = requests.get(f"{BASE_URL}/api/mobility/trains/stations?city=Lisboa")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "stations" in data, "Response should contain 'stations'"

        # All returned stations should be in Lisboa
        for station in data["stations"]:
            assert station["city"].lower() == "lisboa", "Station should be in Lisboa"

    def test_get_train_schedule(self):
        """Test getting train schedule (demo data)"""
        response = requests.get(
            f"{BASE_URL}/api/mobility/trains/schedule",
            params={"origin": "Lisboa", "destination": "Porto"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "origin" in data, "Response should contain 'origin'"
        assert "destination" in data, "Response should contain 'destination'"
        assert "trains" in data, "Response should contain 'trains'"
        assert "note" in data, "Response should contain 'note' (demo warning)"
        assert "cp_url" in data, "Response should contain 'cp_url'"

        # Verify train data structure
        assert len(data["trains"]) > 0, "Should have at least 1 train"
        for train in data["trains"]:
            assert "type" in train, "Train should have 'type'"
            assert "departure" in train, "Train should have 'departure'"
            assert "duration" in train, "Train should have 'duration'"
            assert "price" in train, "Train should have 'price'"


class TestFerries:
    """Tagus Ferry API Tests"""

    def test_get_ferry_routes(self):
        """Test getting all ferry routes"""
        response = requests.get(f"{BASE_URL}/api/mobility/ferries")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "routes" in data, "Response should contain 'routes'"
        assert len(data["routes"]) >= 4, "Should have at least 4 ferry routes"

        # Verify route structure
        for route in data["routes"]:
            assert "id" in route, "Route should have 'id'"
            assert "name" in route, "Route should have 'name'"
            assert "operator" in route, "Route should have 'operator'"
            assert "duration_min" in route, "Route should have 'duration_min'"
            assert "frequency_min" in route, "Route should have 'frequency_min'"

    def test_get_ferry_schedule_valid_route(self):
        """Test getting ferry schedule for valid route"""
        response = requests.get(f"{BASE_URL}/api/mobility/ferries/cacilhas/schedule")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "route" in data, "Response should contain 'route'"
        assert "next_departures" in data, "Response should contain 'next_departures'"
        assert "status" in data, "Response should contain 'status'"
        assert "timestamp" in data, "Response should contain 'timestamp'"

        # Verify departures
        assert len(data["next_departures"]) > 0, "Should have at least 1 next departure"
        assert data["status"] == "operational", "Status should be operational"

    def test_get_ferry_schedule_all_routes(self):
        """Test getting ferry schedule for all routes"""
        routes = ["cacilhas", "barreiro", "trafaria", "seixal"]

        for route_id in routes:
            response = requests.get(f"{BASE_URL}/api/mobility/ferries/{route_id}/schedule")
            assert response.status_code == 200, f"Expected 200 for {route_id}, got {response.status_code}"

    def test_get_ferry_schedule_invalid_route(self):
        """Test getting ferry schedule for invalid route"""
        response = requests.get(f"{BASE_URL}/api/mobility/ferries/invalid_route/schedule")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestMobilityNearby:
    """Nearby Transport API Tests"""

    def test_get_nearby_transport_lisbon_center(self):
        """Test getting nearby transport options in Lisbon center"""
        response = requests.get(
            f"{BASE_URL}/api/mobility/nearby",
            params={"lat": 38.71, "lng": -9.14}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "location" in data, "Response should contain 'location'"
        assert "radius_m" in data, "Response should contain 'radius_m'"
        assert "metro_stations" in data, "Response should contain 'metro_stations'"
        assert "train_stations" in data, "Response should contain 'train_stations'"
        assert "ferry_terminals" in data, "Response should contain 'ferry_terminals'"
        assert "timestamp" in data, "Response should contain 'timestamp'"

        # Should find some transport options in Lisbon center
        total_options = (
            len(data.get("metro_stations", [])) +
            len(data.get("train_stations", [])) +
            len(data.get("ferry_terminals", []))
        )
        assert total_options > 0, "Should find some transport options in Lisbon center"

    def test_get_nearby_transport_custom_radius(self):
        """Test getting nearby transport with custom radius"""
        response = requests.get(
            f"{BASE_URL}/api/mobility/nearby",
            params={"lat": 38.71, "lng": -9.14, "radius_m": 2000}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert data["radius_m"] == 2000, "Radius should be 2000m"


class TestPushNotifications:
    """Push Notifications API Tests"""

    def test_register_push_token_requires_auth(self):
        """Test that push token registration requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/notifications/register",
            json={
                "token": "ExponentPushToken[test12345]",
                "platform": "android"
            }
        )
        # Should return 401 without auth
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_register_push_token_with_auth(self):
        """Test push token registration with authentication"""
        # First, login to get a session token
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )

        if login_response.status_code != 200:
            pytest.skip("Login failed, skipping authenticated test")

        session_token = login_response.json()["session_token"]

        # Now register push token with auth
        response = requests.post(
            f"{BASE_URL}/api/notifications/register",
            headers={"Authorization": f"Bearer {session_token}"},
            json={
                "token": f"ExponentPushToken[test_{uuid.uuid4().hex[:8]}]",
                "platform": "android"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "message" in data, "Response should contain 'message'"

    def test_notification_preferences_requires_auth(self):
        """Test that notification preferences require authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications/preferences")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    def test_notification_history_requires_auth(self):
        """Test that notification history requires authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications/history")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestAuthenticatedNotifications:
    """Authenticated notification tests"""

    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed")
        return login_response.json()["session_token"]

    def test_get_notification_preferences(self, auth_token):
        """Test getting notification preferences with auth"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/preferences",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        # Should return default preferences
        assert "surf_alerts" in data, "Should have surf_alerts field"
        assert "geofence_alerts" in data, "Should have geofence_alerts field"
        assert "event_reminders" in data, "Should have event_reminders field"

    def test_update_notification_preferences(self, auth_token):
        """Test updating notification preferences"""
        response = requests.put(
            f"{BASE_URL}/api/notifications/preferences",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "surf_alerts": False,
                "geofence_alerts": True,
                "event_reminders": True,
                "min_surf_quality": "excellent"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    def test_get_notification_history(self, auth_token):
        """Test getting notification history"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/history",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"

        data = response.json()
        assert "notifications" in data, "Response should contain 'notifications'"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
