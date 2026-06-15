"""
Integration tests for premium_api.py.

Endpoints that are fully static (tiers, payment methods) run without any DB.
Endpoints requiring auth (status, my-features, check-feature, stats) are
tested to verify correct auth rejection — the live DB-dependent paths need
@requires_db on CI.
"""
import pytest

from conftest import requires_db

pytestmark = pytest.mark.anyio


# ─── Static endpoints ─────────────────────────────────────────────────────────

class TestTiers:
    async def test_returns_tiers(self, client):
        resp = await client.get("/api/premium/tiers")
        assert resp.status_code == 200
        data = resp.json()
        assert "tiers" in data
        assert len(data["tiers"]) >= 2  # at least free + premium

    async def test_tiers_have_required_fields(self, client):
        tiers = (await client.get("/api/premium/tiers")).json()["tiers"]
        for tier in tiers:
            for key in ("id", "name", "features"):
                assert key in tier, f"Tier missing '{key}'"
            # price field may be named "price" or "price_monthly"
            assert "price" in tier or "price_monthly" in tier
            for feat in tier["features"]:
                assert "id" in feat and "name" in feat and "included" in feat

    async def test_currency_is_eur(self, client):
        data = (await client.get("/api/premium/tiers")).json()
        assert data["currency"] == "EUR"

    async def test_payment_methods_listed(self, client):
        data = (await client.get("/api/premium/tiers")).json()
        methods = data["payment_methods"]
        method_ids = {m["id"] for m in methods}
        assert {"card", "mb_way", "multibanco"}.issubset(method_ids)

    async def test_trial_days_present(self, client):
        data = (await client.get("/api/premium/tiers")).json()
        assert isinstance(data["trial_days"], int) and data["trial_days"] >= 0

    async def test_free_tier_exists(self, client):
        tiers = (await client.get("/api/premium/tiers")).json()["tiers"]
        free = next((t for t in tiers if t["id"] == "free"), None)
        assert free is not None
        # price field is "price" or "price_monthly" depending on version
        price_val = free.get("price", free.get("price_monthly", -1))
        assert price_val == 0


# ─── Auth guard tests (no DB required) ───────────────────────────────────────

class TestAuthGuards:
    @pytest.mark.parametrize("path", [
        "/api/premium/status/user-123",
        "/api/premium/my-features",
        "/api/premium/check-feature/offline_maps",
        "/api/premium/stats",
    ])
    async def test_requires_auth(self, client, path):
        resp = await client.get(path)
        assert resp.status_code in (401, 403), (
            f"Expected 401/403 on {path} without auth, got {resp.status_code}"
        )

    @pytest.mark.parametrize("path", [
        "/api/premium/create-checkout",
        "/api/premium/create-portal",
        "/api/premium/subscribe",
    ])
    async def test_post_requires_auth(self, client, path):
        resp = await client.post(path, json={})
        assert resp.status_code in (401, 403, 422)


# ─── Paywall intent endpoint ─────────────────────────────────────────────────

class TestPaywallIntent:
    async def test_intent_anonymous_accepted(self, client):
        resp = await client.post(
            "/api/premium/intent",
            json={"tier": "premium", "payment_method": "card", "source": "premium_screen"},
        )
        assert resp.status_code == 200
        assert resp.json()["recorded"] is True

    async def test_intent_invalid_tier_rejected(self, client):
        resp = await client.post(
            "/api/premium/intent",
            json={"tier": "bogus", "payment_method": "card", "source": "premium_gate"},
        )
        assert resp.status_code == 400

    async def test_intent_requires_fields(self, client):
        resp = await client.post("/api/premium/intent", json={"tier": "premium"})
        assert resp.status_code == 422


# ─── Webhook endpoint validation ─────────────────────────────────────────────

class TestWebhook:
    async def test_webhook_stripe_not_configured(self, client):
        # Stripe is disabled by default in test env → 503
        resp = await client.post(
            "/api/premium/webhook",
            content=b'{"type": "checkout.session.completed"}',
            headers={"Content-Type": "application/json"},
        )
        # Demo mode (stripe not installed) → 503; or 400/401 if partially configured
        assert resp.status_code in (400, 401, 422, 503)
