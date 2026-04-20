"""Test that the backend endpoints used by offline sync exist and respond correctly."""
import requests
import os

API_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'http://localhost:8001')
if not API_URL.startswith('http'):
    API_URL = 'http://localhost:8001'

def test_visit_endpoint_requires_auth():
    """POST /api/dashboard/visit should require auth."""
    r = requests.post(f"{API_URL}/api/dashboard/visit?poi_id=test123")
    assert r.status_code in (401, 403, 422), f"Expected 401/403/422, got {r.status_code}"

def test_favorite_endpoint_requires_auth():
    """POST /api/favorites/:id should require auth."""
    r = requests.post(f"{API_URL}/api/favorites/test123")
    assert r.status_code in (401, 403, 422), f"Expected 401/403/422, got {r.status_code}"

def test_contribution_endpoint_requires_auth():
    """POST /api/contributions should require auth."""
    r = requests.post(f"{API_URL}/api/contributions", json={"title": "test"})
    assert r.status_code in (401, 403, 422), f"Expected 401/403/422, got {r.status_code}"

if __name__ == "__main__":
    test_visit_endpoint_requires_auth()
    print("PASS: visit endpoint requires auth")
    test_favorite_endpoint_requires_auth()
    print("PASS: favorite endpoint requires auth")
    test_contribution_endpoint_requires_auth()
    print("PASS: contribution endpoint requires auth")
    print("\nAll offline sync endpoint tests passed!")
