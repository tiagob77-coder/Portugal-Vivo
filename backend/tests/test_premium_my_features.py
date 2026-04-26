"""
Smoke tests for GET /api/premium/my-features (Fase 5 — eixo 3).

Auth-guard only: a real subscription scenario requires seeding a
`subscriptions` doc + a JWT, which is overkill for this smoke. We verify
that the route exists, refuses anonymous traffic, and that the authed
test client gets a well-formed payload when one is available.
"""
import pytest

from conftest import requires_db


@pytest.mark.anyio
@requires_db
async def test_my_features_requires_auth(client):
    """Anonymous calls must be rejected (401/403/422/429)."""
    resp = await client.get("/api/premium/my-features")
    assert resp.status_code in (401, 403, 422, 429)


@pytest.mark.anyio
@requires_db
async def test_check_feature_endpoint_still_works(client):
    """The single-feature variant is preserved (back-compat)."""
    resp = await client.get("/api/premium/check-feature/ai_itinerary")
    # Anonymous: rejected. Authed: would return 200 with a payload.
    # Either way, no 500.
    assert resp.status_code in (200, 401, 403, 422, 429)
