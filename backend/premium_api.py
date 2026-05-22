"""
Premium Tier & Monetization API
Manages freemium/premium user tiers, Stripe Checkout, webhooks, and feature gating.

Tier Model:
- Free (Explorador): Basic discovery, map, favorites, up to 3 routes/day
- Premium (Descobridor, 4.99€/month): AI itineraries, offline mode, unlimited routes,
  audio guides, advanced filters, priority support
- Annual (Guardião, 39.99€/year): Everything Premium + early access, custom routes, export

Stripe Integration:
- Checkout Sessions for new subscriptions
- Customer Portal for managing existing subscriptions
- Webhook handler for payment events (checkout.session.completed,
  customer.subscription.updated/deleted, invoice.payment_failed)
"""
import os
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Header, Depends
from auth_api import require_auth, require_admin
from pydantic import BaseModel
from typing import Optional
from shared_utils import DatabaseHolder
from models.api_models import User

logger = logging.getLogger(__name__)

# Stripe setup - graceful if key not configured
_IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"

try:
    import stripe
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_ENABLED = bool(stripe.api_key)
    if STRIPE_ENABLED:
        logger.info("Stripe integration enabled")
        if not STRIPE_WEBHOOK_SECRET:
            _msg = (
                "STRIPE_WEBHOOK_SECRET not set — webhook signature verification disabled. "
                "This MUST be set in production to prevent forged webhook events."
            )
            if _IS_PRODUCTION:
                raise RuntimeError(_msg)
            logger.warning(_msg)
        if not os.getenv("STRIPE_PRICE_PREMIUM") or not os.getenv("STRIPE_PRICE_ANNUAL"):
            _msg = "STRIPE_PRICE_PREMIUM and STRIPE_PRICE_ANNUAL must be set when Stripe is enabled"
            if _IS_PRODUCTION:
                raise RuntimeError(_msg)
            logger.warning(_msg)
    else:
        _msg = "Stripe not configured - running in demo mode (set STRIPE_SECRET_KEY)"
        if _IS_PRODUCTION:
            raise RuntimeError("STRIPE_SECRET_KEY is required in production. " + _msg)
        logger.warning(_msg)
except ImportError:
    STRIPE_ENABLED = False
    stripe = None
    STRIPE_WEBHOOK_SECRET = ""
    _msg = "stripe package not installed - running in demo mode"
    if _IS_PRODUCTION:
        raise RuntimeError("stripe package required in production. " + _msg)
    logger.warning(_msg)

premium_router = APIRouter(prefix="/premium", tags=["Premium"])

_db_holder = DatabaseHolder("premium")
set_premium_db = _db_holder.set

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


# =============================================================================
# STRIPE PRICE IDS (configure in environment or Stripe Dashboard)
# =============================================================================

STRIPE_PRICES = {
    "premium": os.getenv("STRIPE_PRICE_PREMIUM", ""),   # Monthly 4.99€
    "annual": os.getenv("STRIPE_PRICE_ANNUAL", ""),      # Annual 39.99€
}


# =============================================================================
# TIER DEFINITIONS
# =============================================================================

TIERS = {
    "free": {
        "id": "free",
        "name": "Explorador",
        "price": 0,
        "price_label": "Grátis",
        "features": [
            {"id": "map", "name": "Mapa Interativo", "description": "6 camadas e clustering", "included": True},
            {"id": "discovery", "name": "Feed de Descoberta", "description": "POIs com IQ Score", "included": True},
            {"id": "favorites", "name": "Favoritos", "description": "Guardar locais favoritos", "included": True},
            {"id": "search", "name": "Pesquisa Global", "description": "Por nome, região e categoria", "included": True},
            {"id": "calendar", "name": "Calendário de Eventos", "description": "Festas e tradições", "included": True},
            {"id": "routes", "name": "Rotas Curadas", "description": "Até 3 consultas/dia", "included": True, "limit": 3},
            {"id": "badges", "name": "Badges Básicos", "description": "Sistema de conquistas", "included": True},
            {"id": "ai_itinerary", "name": "Roteiros IA", "description": "Itinerários personalizados", "included": False},
            {"id": "audio_guides", "name": "Áudio Guias", "description": "Narrativas com voz IA", "included": False},
            {"id": "offline", "name": "Modo Offline", "description": "Download de regiões", "included": False},
            {"id": "epochs", "name": "Épocas Históricas", "description": "Timeline interativa", "included": False},
            {"id": "collections", "name": "Coleções Completas", "description": "12 coleções temáticas", "included": False},
        ],
    },
    "premium": {
        "id": "premium",
        "name": "Descobridor",
        "price": 4.99,
        "price_label": "4,99€/mês",
        "features": [
            {"id": "map", "name": "Mapa Interativo", "description": "Todos os modos e camadas", "included": True},
            {"id": "discovery", "name": "Feed de Descoberta", "description": "POIs com IQ Score", "included": True},
            {"id": "favorites", "name": "Favoritos", "description": "Ilimitados + sincronização", "included": True},
            {"id": "search", "name": "Pesquisa Avançada", "description": "Filtros avançados + proximidade", "included": True},
            {"id": "calendar", "name": "Calendário de Eventos", "description": "Com alertas personalizados", "included": True},
            {"id": "routes", "name": "Rotas Ilimitadas", "description": "Sem limite diário", "included": True},
            {"id": "badges", "name": "Todos os Badges", "description": "25 badges + progresso", "included": True},
            {"id": "ai_itinerary", "name": "Roteiros IA", "description": "Itinerários GPT-4o personalizados", "included": True},
            {"id": "audio_guides", "name": "Áudio Guias", "description": "9 vozes, todas as narrativas", "included": True},
            {"id": "offline", "name": "Modo Offline", "description": "Download de todas as regiões", "included": True},
            {"id": "epochs", "name": "Épocas Históricas", "description": "Timeline + filtros temporais", "included": True},
            {"id": "collections", "name": "Coleções Completas", "description": "12 coleções + filtros", "included": True},
        ],
    },
    "annual": {
        "id": "annual",
        "name": "Guardião",
        "price": 39.99,
        "price_label": "39,99€/ano",
        "features": [
            {"id": "all_premium", "name": "Tudo do Premium", "description": "Todas as funcionalidades", "included": True},
            {"id": "early_access", "name": "Acesso Antecipado", "description": "Novas funcionalidades primeiro", "included": True},
            {"id": "custom_routes", "name": "Rotas Personalizadas", "description": "Criar e partilhar rotas", "included": True},
            {"id": "export", "name": "Exportar Roteiros", "description": "PDF e GPX", "included": True},
        ],
    },
}

PREMIUM_FEATURE_IDS = {"ai_itinerary", "audio_guides", "offline", "epochs", "collections", "custom_routes", "export", "early_access"}


# =============================================================================
# MODELS
# =============================================================================

class CheckoutRequest(BaseModel):
    tier: str  # "premium" or "annual"


class SubscriptionRequest(BaseModel):
    tier: str  # "premium" or "annual"
    payment_method: Optional[str] = None


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def _get_or_create_stripe_customer(user_id: str, email: str) -> str:
    """Get existing or create new Stripe customer for a user."""
    db = _db_holder.db
    user = await db.subscriptions.find_one({"user_id": user_id, "stripe_customer_id": {"$exists": True}})
    if user and user.get("stripe_customer_id"):
        return user["stripe_customer_id"]

    customer = stripe.Customer.create(
        email=email,
        metadata={"user_id": user_id},
    )

    await db.subscriptions.update_one(
        {"user_id": user_id},
        {"$set": {"stripe_customer_id": customer.id}},
        upsert=True,
    )
    return customer.id


async def _activate_subscription(user_id: str, tier: str, stripe_subscription_id: str = None, stripe_customer_id: str = None):
    """Activate a subscription for a user in the database."""
    db = _db_holder.db

    # Deactivate existing subscriptions
    await db.subscriptions.update_many(
        {"user_id": user_id, "status": "active"},
        {"$set": {"status": "replaced", "replaced_at": datetime.now(timezone.utc).isoformat()}}
    )

    tier_data = TIERS.get(tier, TIERS["premium"])
    now = datetime.now(timezone.utc)
    sub = {
        "user_id": user_id,
        "tier": tier,
        "status": "active",
        "price": tier_data["price"],
        "started_at": now.isoformat(),
    }
    if stripe_subscription_id:
        sub["stripe_subscription_id"] = stripe_subscription_id
    else:
        # No recurring Stripe subscription (one-time MB Way / Multibanco
        # payment, or demo mode): Stripe will never renew or expire it, so we
        # set an explicit expiry. Without this a single one-time payment would
        # grant premium forever.
        sub["expires_at"] = (now + timedelta(days=365 if tier == "annual" else 30)).isoformat()
    if stripe_customer_id:
        sub["stripe_customer_id"] = stripe_customer_id

    await db.subscriptions.insert_one(sub)
    logger.info(f"Subscription activated: user={user_id}, tier={tier}")


async def _cancel_subscription(stripe_subscription_id: str):
    """Cancel a subscription by Stripe subscription ID."""
    db = _db_holder.db
    result = await db.subscriptions.update_many(
        {"stripe_subscription_id": stripe_subscription_id, "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
    )
    logger.info(f"Subscription cancelled: stripe_sub={stripe_subscription_id}, matched={result.modified_count}")


def _active_sub_filter(user_id: str) -> dict:
    """Mongo filter for a user's currently-valid subscription.

    A subscription counts only if its status is active AND it either has no
    expiry (recurring Stripe subscriptions — Stripe manages their lifecycle)
    or an expiry still in the future (one-time MB Way / Multibanco payments).
    """
    return {
        "user_id": user_id,
        "status": "active",
        "$or": [
            {"expires_at": {"$exists": False}},
            {"expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}},
        ],
    }


# =============================================================================
# ENDPOINTS
# =============================================================================

@premium_router.get("/tiers")
async def get_tiers():
    """Get all available subscription tiers with feature comparison."""
    return {
        "tiers": list(TIERS.values()),
        "currency": "EUR",
        "trial_days": 7,
        "stripe_enabled": STRIPE_ENABLED,
        "payment_methods": [
            {"id": "card", "name": "Cartão de Crédito/Débito", "icon": "credit-card", "recurring": True},
            {"id": "paypal", "name": "PayPal", "icon": "account-balance-wallet", "recurring": True},
            {"id": "mb_way", "name": "MB Way", "icon": "phone-android", "recurring": False},
            {"id": "multibanco", "name": "Multibanco", "icon": "account-balance", "recurring": False},
        ],
    }


@premium_router.get("/status/{user_id}")
async def get_subscription_status(user_id: str, current_user: User = Depends(require_auth)):
    """Check a user's current subscription status."""
    if current_user.user_id != user_id:
        user_doc = await _db_holder.db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "role": 1})
        if not user_doc or user_doc.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Acesso restrito ao próprio utilizador")
    db = _db_holder.db
    sub = await db.subscriptions.find_one(
        _active_sub_filter(user_id),
        {"_id": 0}
    )

    if sub:
        tier = TIERS.get(sub.get("tier", "free"), TIERS["free"])
        payment_method = sub.get("payment_method", "")
        requires_manual_renewal = payment_method in ("mb_way", "multibanco")
        expires_at = sub.get("expires_at")
        days_until_expiry: int | None = None
        if expires_at and requires_manual_renewal:
            try:
                exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                days_until_expiry = (exp_dt - datetime.now(timezone.utc)).days
            except Exception:
                pass
        return {
            "user_id": user_id,
            "tier": sub.get("tier", "free"),
            "tier_name": tier["name"],
            "status": "active",
            "features": tier["features"],
            "started_at": sub.get("started_at"),
            "expires_at": expires_at,
            "stripe_subscription_id": sub.get("stripe_subscription_id"),
            "payment_method": payment_method,
            "requires_manual_renewal": requires_manual_renewal,
            "days_until_expiry": days_until_expiry,
        }

    return {
        "user_id": user_id,
        "tier": "free",
        "tier_name": "Explorador",
        "status": "active",
        "features": TIERS["free"]["features"],
        "requires_manual_renewal": False,
    }


# =============================================================================
# STRIPE CHECKOUT
# =============================================================================

@premium_router.post("/create-checkout")
async def create_checkout_session(
    request: CheckoutRequest,
    current_user: User = Depends(require_auth),
):
    """Create a Stripe Checkout session for subscription (authenticated)."""
    if not STRIPE_ENABLED:
        raise HTTPException(status_code=503, detail="Pagamentos não configurados. Contacte o administrador.")

    if request.tier not in ("premium", "annual"):
        raise HTTPException(status_code=400, detail="Tier inválido")

    price_id = STRIPE_PRICES.get(request.tier)
    if not price_id:
        raise HTTPException(status_code=500, detail=f"Stripe Price ID não configurado para tier '{request.tier}'")

    customer_id = await _get_or_create_stripe_customer(current_user.user_id, current_user.email)

    # Portuguese payment methods: Card, PayPal, MB Way, Multibanco
    # Note: MB Way and Multibanco require one-time payments (not recurring subscriptions)
    # For subscriptions, we use card + PayPal + SEPA as recurring methods
    payment_method_types = ["card", "paypal"]

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=payment_method_types,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{FRONTEND_URL}/premium?success=true&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{FRONTEND_URL}/premium?cancelled=true",
        metadata={
            "user_id": current_user.user_id,
            "tier": request.tier,
        },
        subscription_data={
            "trial_period_days": 7,
            "metadata": {
                "user_id": current_user.user_id,
                "tier": request.tier,
            },
        },
        allow_promotion_codes=True,
        locale="pt",
    )

    return {
        "checkout_url": session.url,
        "session_id": session.id,
    }


@premium_router.post("/create-portal")
async def create_customer_portal(current_user: User = Depends(require_auth)):
    """Create a Stripe Customer Portal session to manage subscription."""
    if not STRIPE_ENABLED:
        raise HTTPException(status_code=503, detail="Pagamentos não configurados")

    db = _db_holder.db
    sub = await db.subscriptions.find_one(
        {"user_id": current_user.user_id, "stripe_customer_id": {"$exists": True}},
        {"stripe_customer_id": 1}
    )

    if not sub or not sub.get("stripe_customer_id"):
        raise HTTPException(status_code=404, detail="Nenhuma subscrição encontrada")

    session = stripe.billing_portal.Session.create(
        customer=sub["stripe_customer_id"],
        return_url=f"{FRONTEND_URL}/premium",
    )

    return {"portal_url": session.url}


# =============================================================================
# MB WAY / MULTIBANCO ONE-TIME PAYMENT
# =============================================================================

@premium_router.post("/create-checkout-mbway")
async def create_checkout_mbway(
    request: CheckoutRequest,
    current_user: User = Depends(require_auth),
):
    """Create Stripe Checkout with MB Way payment (popular in Portugal).
    MB Way doesn't support recurring - uses one-time payment + manual renewal.
    """
    if not STRIPE_ENABLED:
        raise HTTPException(status_code=503, detail="Pagamentos não configurados")

    if request.tier not in ("premium", "annual"):
        raise HTTPException(status_code=400, detail="Tier inválido")

    tier_data = TIERS.get(request.tier, TIERS["premium"])
    amount_cents = int(tier_data["price"] * 100)

    customer_id = await _get_or_create_stripe_customer(current_user.user_id, current_user.email)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["mb_way"],
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": "eur",
                "unit_amount": amount_cents,
                "product_data": {
                    "name": f"Portugal Vivo {tier_data['name']}",
                    "description": f"Subscrição {'mensal' if request.tier == 'premium' else 'anual'} — {tier_data['price_label']}",
                },
            },
            "quantity": 1,
        }],
        success_url=f"{FRONTEND_URL}/premium?success=true&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{FRONTEND_URL}/premium?cancelled=true",
        metadata={
            "user_id": current_user.user_id,
            "tier": request.tier,
            "payment_type": "mbway",
        },
        locale="pt",
    )

    return {
        "checkout_url": session.url,
        "session_id": session.id,
        "payment_method": "mb_way",
    }


@premium_router.post("/create-checkout-multibanco")
async def create_checkout_multibanco(
    request: CheckoutRequest,
    current_user: User = Depends(require_auth),
):
    """Create Stripe Checkout with Multibanco reference payment (Portugal).
    Generates a Multibanco reference that user pays at ATM or homebanking.
    """
    if not STRIPE_ENABLED:
        raise HTTPException(status_code=503, detail="Pagamentos não configurados")

    if request.tier not in ("premium", "annual"):
        raise HTTPException(status_code=400, detail="Tier inválido")

    tier_data = TIERS.get(request.tier, TIERS["premium"])
    amount_cents = int(tier_data["price"] * 100)

    customer_id = await _get_or_create_stripe_customer(current_user.user_id, current_user.email)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["multibanco"],
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": "eur",
                "unit_amount": amount_cents,
                "product_data": {
                    "name": f"Portugal Vivo {tier_data['name']}",
                    "description": f"Subscrição {'mensal' if request.tier == 'premium' else 'anual'} — {tier_data['price_label']}",
                },
            },
            "quantity": 1,
        }],
        success_url=f"{FRONTEND_URL}/premium?success=true&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{FRONTEND_URL}/premium?cancelled=true",
        metadata={
            "user_id": current_user.user_id,
            "tier": request.tier,
            "payment_type": "multibanco",
        },
        locale="pt",
    )

    return {
        "checkout_url": session.url,
        "session_id": session.id,
        "payment_method": "multibanco",
    }


# =============================================================================
# STRIPE WEBHOOK
# =============================================================================

@premium_router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events for subscription lifecycle."""
    if not STRIPE_ENABLED:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    # Refuse to process webhooks without signature verification — a forged
    # payload could otherwise activate paid tiers free of charge.
    if not STRIPE_WEBHOOK_SECRET:
        logger.error("Refusing Stripe webhook: STRIPE_WEBHOOK_SECRET not configured")
        raise HTTPException(
            status_code=503,
            detail="Webhook signature verification not configured",
        )

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    data = event["data"]["object"]

    logger.info(f"Stripe webhook: {event_type}")

    if event_type in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        user_id = data.get("metadata", {}).get("user_id")
        tier = data.get("metadata", {}).get("tier", "premium")
        payment_type = data.get("metadata", {}).get("payment_type", "")
        subscription_id = data.get("subscription")
        customer_id = data.get("customer")

        if user_id:
            if payment_type in ("mbway", "multibanco"):
                # One-time async payment. checkout.session.completed fires
                # when the Multibanco reference is issued — at that point
                # payment_status is still "unpaid", so activating would hand
                # out premium before any money moved. Only fulfil once the
                # payment has cleared (payment_status "paid", delivered here
                # or on checkout.session.async_payment_succeeded).
                if data.get("payment_status") == "paid":
                    await _activate_subscription(user_id, tier, stripe_customer_id=customer_id)
                    logger.info(f"One-time {payment_type} payment confirmed: user={user_id}, tier={tier}")
                else:
                    logger.info(f"One-time {payment_type} awaiting payment: user={user_id}")
            else:
                await _activate_subscription(user_id, tier, subscription_id, customer_id)

    elif event_type == "customer.subscription.updated":
        subscription_id = data.get("id")
        status = data.get("status")
        user_id = data.get("metadata", {}).get("user_id")

        if status == "active" and user_id:
            tier = data.get("metadata", {}).get("tier", "premium")
            await _activate_subscription(user_id, tier, subscription_id)
        elif status in ("canceled", "unpaid", "past_due"):
            await _cancel_subscription(subscription_id)

    elif event_type == "customer.subscription.deleted":
        subscription_id = data.get("id")
        await _cancel_subscription(subscription_id)

    elif event_type == "invoice.payment_failed":
        customer_id = data.get("customer")
        logger.warning(f"Payment failed for customer: {customer_id}")

    return {"received": True}


# =============================================================================
# LEGACY / DEMO SUBSCRIBE (fallback when Stripe not configured)
# =============================================================================

@premium_router.post("/subscribe")
async def subscribe(
    request: SubscriptionRequest,
    current_user: User = Depends(require_auth),
):
    """Create or upgrade a subscription (demo mode when Stripe not configured)."""
    if request.tier not in ("premium", "annual"):
        raise HTTPException(status_code=400, detail="Tier inválido")

    if STRIPE_ENABLED:
        raise HTTPException(
            status_code=400,
            detail="Use /premium/create-checkout para subscrições com pagamento"
        )

    await _activate_subscription(current_user.user_id, request.tier)

    tier = TIERS[request.tier]
    return {
        "success": True,
        "message": f"Subscrição {tier['name']} ativada com sucesso (modo demo)",
        "tier": request.tier,
        "tier_name": tier["name"],
        "features": tier["features"],
    }


# =============================================================================
# FEATURE GATING
# =============================================================================

@premium_router.get("/my-features")
async def my_features(current_user=Depends(require_auth)):
    """Bulk feature-access map for the authenticated user.

    Single round-trip alternative to N calls to /check-feature/{id}. The
    frontend uses this once at app boot to populate a per-feature
    capability map and then drives PremiumGate locally without further
    backend calls.
    """
    db = _db_holder.db
    sub = await db.subscriptions.find_one(
        _active_sub_filter(current_user.user_id),
        {"_id": 0, "tier": 1},
    )
    user_tier = sub.get("tier", "free") if sub else "free"
    tier_data = TIERS.get(user_tier, TIERS["free"])

    # Free features: anything NOT in the premium-only set.
    # Premium features: included only if listed in the user's tier with
    # ``included=True``.
    free_features = {f["id"] for f in TIERS["free"]["features"] if f.get("included")}
    paid_features = {f["id"] for f in tier_data["features"] if f.get("included")}
    granted = free_features | paid_features

    # The full universe of feature ids = union across all tiers, so the
    # client can render a complete capability matrix without guessing.
    all_feature_ids: set[str] = set()
    for tier in TIERS.values():
        for f in tier["features"]:
            all_feature_ids.add(f["id"])

    features = {fid: (fid in granted) for fid in all_feature_ids}
    return {
        "user_id": current_user.user_id,
        "tier": user_tier,
        "tier_name": tier_data.get("name"),
        "features": features,
    }


@premium_router.get("/check-feature/{feature_id}")
async def check_feature_access(feature_id: str, current_user=Depends(require_auth)):
    """Check if the authenticated user has access to a specific premium feature."""
    db = _db_holder.db
    user_id = current_user.user_id
    sub = await db.subscriptions.find_one(
        _active_sub_filter(user_id),
        {"_id": 0, "tier": 1}
    )

    user_tier = sub.get("tier", "free") if sub else "free"
    tier_data = TIERS.get(user_tier, TIERS["free"])

    has_access = feature_id not in PREMIUM_FEATURE_IDS
    for feature in tier_data["features"]:
        if feature["id"] == feature_id and feature["included"]:
            has_access = True
            break

    return {
        "user_id": user_id,
        "feature_id": feature_id,
        "has_access": has_access,
        "user_tier": user_tier,
        "upgrade_needed": not has_access,
    }


# =============================================================================
# ADMIN
# =============================================================================

@premium_router.get("/stats")
async def get_premium_stats(_: User = Depends(require_admin)):
    """Get premium subscription statistics (admin)."""
    db = _db_holder.db
    total = await db.subscriptions.count_documents({"status": "active"})
    premium = await db.subscriptions.count_documents({"status": "active", "tier": "premium"})
    annual = await db.subscriptions.count_documents({"status": "active", "tier": "annual"})

    return {
        "total_active": total,
        "premium": premium,
        "annual": annual,
        "mrr_estimate": premium * 4.99 + annual * (39.99 / 12),
        "stripe_enabled": STRIPE_ENABLED,
    }
