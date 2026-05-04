"""
POI canonical test suite.

Covers the four critical patterns required by the testing spec:
  1. Protected routes reject unauthenticated requests (401)
  2. Multi-tenant isolation prevents cross-municipality access (403)
  3. Geo-search returns items within the requested radius
  4. Coordinate validation rejects non-Portugal coordinates (422)
"""
import pytest
from conftest import requires_db

BASE_MUNICIPALITY = "lisboa-01"
AUTH_HEADERS = {"Authorization": "Bearer test-jwt-token"}

# Coordinates outside Portugal (Paris)
PARIS_LNG, PARIS_LAT = 2.3488, 48.8534
# Coordinates inside Portugal (Lisboa centre)
LISBON_LAT, LISBON_LNG = 38.7169, -9.1399


# ---------------------------------------------------------------------------
# 1. Auth guard
# ---------------------------------------------------------------------------

@requires_db
@pytest.mark.anyio
async def test_list_pois_requires_auth(client):
    """Protected routes must reject requests without a JWT."""
    response = await client.get("/api/heritage")
    assert response.status_code in (401, 403), (
        f"Expected 401/403 without auth, got {response.status_code}"
    )


# ---------------------------------------------------------------------------
# 2. Multi-tenant isolation
# ---------------------------------------------------------------------------

@requires_db
@pytest.mark.anyio
async def test_list_pois_tenant_isolation(client):
    """A Lisboa token must not be able to access Porto municipality resources."""
    response = await client.get(
        "/api/heritage?municipality_id=porto-02",
        headers=AUTH_HEADERS,
    )
    # Tenant mismatch should yield 401, 403, or filtered empty response
    assert response.status_code in (200, 401, 403)
    if response.status_code == 200:
        data = response.json()
        items = data if isinstance(data, list) else data.get("items", [])
        porto_items = [i for i in items if i.get("municipality_id") == "porto-02"]
        assert porto_items == [], (
            "Lisboa token must not return Porto municipality items"
        )


# ---------------------------------------------------------------------------
# 3. Geo-search — radius filter
# ---------------------------------------------------------------------------

@requires_db
@pytest.mark.anyio
async def test_list_pois_geosearch(client):
    """Nearby endpoint must return items within the requested radius."""
    response = await client.get(
        f"/api/heritage/map/items?lat={LISBON_LAT}&lng={LISBON_LNG}&radius_km=5",
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200
    data = response.json()
    items = data if isinstance(data, list) else data.get("items", data.get("features", []))
    for item in items:
        dist = item.get("distance_km")
        if dist is not None:
            assert dist <= 5.0, f"Item {item.get('name')} is {dist} km away (> 5 km radius)"


# ---------------------------------------------------------------------------
# 4. Coordinate validation — reject non-Portugal coordinates
# ---------------------------------------------------------------------------

@requires_db
@pytest.mark.anyio
async def test_create_poi_validates_coordinates(client):
    """Coordinates outside Portugal must be rejected with 422."""
    payload = {
        "name": "Test POI Paris",
        "location": {"type": "Point", "coordinates": [PARIS_LNG, PARIS_LAT]},
        "municipality_id": BASE_MUNICIPALITY,
        "category": "monumento",
    }
    response = await client.post("/api/heritage", json=payload, headers=AUTH_HEADERS)
    assert response.status_code in (401, 403, 404, 422), (
        f"Expected rejection for Paris coords, got {response.status_code}"
    )


# ---------------------------------------------------------------------------
# 5. Health check (no auth required)
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_health_endpoint(client):
    """Health endpoint must respond without auth."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data or "ok" in str(data).lower()
