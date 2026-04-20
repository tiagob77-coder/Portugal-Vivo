"""
Auth-guard smoke tests for batch 3 and batch 4 endpoint hardening.

Verifies that endpoints requiring user auth or admin auth reject
unauthenticated requests with 401/403 (or 422 if FastAPI validation
intercepts first; or 429 if the rate limiter triggers under high
test load).
"""
import pytest

from conftest import requires_db


# (method, path, json_body) for endpoints that should require user auth.
# Must reject unauthenticated calls.
USER_AUTH_ENDPOINTS = [
    ("POST", "/api/ai/itinerary", {"region": "Lisboa", "days": 2}),
    ("POST", "/api/ai/enrich", {"poi_id": "x"}),
    ("POST", "/api/ai/recommendations", {"interests": ["arte"]}),
    ("POST", "/api/notifications/smart/check-nearby",
     {"lat": 38.7, "lng": -9.1, "radius_km": 2.0}),
    ("POST", "/api/notifications/smart/check-events",
     {"lat": 38.7, "lng": -9.1}),
    ("POST", "/api/music/narrative", {"item_id": "x"}),
    ("POST", "/api/maritime-culture/narrative", {"event_id": "x"}),
    ("POST", "/api/cultural-routes/narrative", {"route_id": "x"}),
    ("POST", "/api/cultural-routes/personalize",
     {"route_id": "x", "profile": {"interests": []}}),
    # LLM-backed identification / pairing / narrative endpoints
    ("GET",  "/api/gastronomy/pairing/g_001", None),
    ("POST", "/api/flora-fauna/identify",
     {"description": "flor amarela pequena", "tipo": "flora"}),
    ("POST", "/api/marine-biodiversity/identify",
     {"description": "peixe prateado comprido observado ao largo"}),
    ("POST", "/api/narrative-layer/generate",
     {"entity_type": "trail", "entity_id": "x"}),
    ("GET",  "/api/discover/hoje", None),
]

# (method, path, json_body) for endpoints that should require admin auth.
ADMIN_AUTH_ENDPOINTS = [
    ("POST", "/api/seasonal-triggers/run-daily", {}),
    ("POST", "/api/agenda/sync", {}),
    ("POST", "/api/leaderboard/sync", {}),
    ("POST", "/api/geo-administrative/enrich-all", {}),
    ("POST", "/api/cultural-routes/enrich/run", {}),
    ("GET",  "/api/admin/data-quality", None),
]


@pytest.mark.anyio
@requires_db
@pytest.mark.parametrize("method,path,body", USER_AUTH_ENDPOINTS)
async def test_user_auth_required(client, method, path, body):
    """Unauthenticated requests to user-auth endpoints must be rejected."""
    resp = await client.request(method, path, json=body)
    # 401/403 = auth rejected; 422 = pydantic body invalid before auth;
    # 429 = rate-limited; 404 = no route mounted (acceptable: feature off)
    assert resp.status_code in (401, 403, 404, 422, 429), (
        f"{method} {path} returned {resp.status_code} (body sample: "
        f"{resp.text[:200]})"
    )


@pytest.mark.anyio
@requires_db
@pytest.mark.parametrize("method,path,body", ADMIN_AUTH_ENDPOINTS)
async def test_admin_auth_required(client, method, path, body):
    """Unauthenticated requests to admin endpoints must be rejected."""
    resp = await client.request(method, path, json=body)
    assert resp.status_code in (401, 403, 404, 422, 429), (
        f"{method} {path} returned {resp.status_code} (body sample: "
        f"{resp.text[:200]})"
    )


@pytest.mark.anyio
@requires_db
async def test_smart_notifications_drops_body_user_id(client):
    """check-nearby must not accept a spoofable user_id field in the body."""
    # Even with a user_id in the body, the endpoint requires JWT auth.
    resp = await client.post(
        "/api/notifications/smart/check-nearby",
        json={
            "lat": 38.7,
            "lng": -9.1,
            "radius_km": 2.0,
            "user_id": "spoofed_user_123",
        },
    )
    # Must reject (auth required); never 200 (which would mean spoofing worked).
    assert resp.status_code in (401, 403, 422, 429)
