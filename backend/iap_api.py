"""
In-app purchases — App Store (StoreKit 2) and Google Play Billing.

The native apps sell the same Premium tiers as the web (Stripe) through the
stores, as Apple guideline 3.1.1 and Google Play's payments policy require for
digital subscriptions. The server never trusts the client's word for a
purchase:

- iOS sends the StoreKit 2 signed transaction (JWS). It is verified against
  Apple's root certificates with Apple's own library (app-store-server-library).
- Android sends the purchase token. The server reads the subscription from the
  Google Play Developer API with a service account.

Either way the result lands in the same ``subscriptions`` collection the web
uses, with an ``expires_at`` taken from the store, so premium_api's status and
feature checks work unchanged. Renewals, refunds and expiries arrive through
App Store Server Notifications V2 and Google Play real-time developer
notifications (RTDN); the app also re-sends its current purchases on start
(``/iap/verify``), which covers a missed notification.

A purchase is tied to the account that made it with an opaque token (iOS
``appAccountToken`` / Play ``obfuscatedAccountId``) derived from the user id;
a signed transaction carrying another account's token is refused, so a
leaked transaction cannot be replayed into a different account.

Configuration (environment):
    IAP_PRODUCT_PREMIUM / IAP_PRODUCT_ANNUAL   store product ids per tier
    APPLE_BUNDLE_ID, APPLE_APP_ID              app identifiers (APP_ID needed for production)
    APPLE_ROOT_CERTS_DIR                       directory with Apple root CA .cer files
    IAP_APPLE_ONLINE_CHECKS                    OCSP revocation checks (default true)
    IAP_ALLOW_SANDBOX                          accept sandbox purchases (default true: App Review uses sandbox)
    GOOGLE_PLAY_PACKAGE_NAME                   Android package name
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON / _FILE   service account with the Android Publisher scope
    GOOGLE_RTDN_TOKEN                          shared secret in the Pub/Sub push endpoint URL
"""
from __future__ import annotations

import asyncio
import base64
import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from auth_api import get_current_user, require_admin, require_auth
from dependencies import get_db
from models.api_models import User
from premium_api import TIERS

logger = logging.getLogger(__name__)

iap_router = APIRouter(prefix="/iap", tags=["In-App Purchases"])

# ─── Configuration ────────────────────────────────────────────────────────────

IAP_PRODUCTS: Dict[str, str] = {
    "premium": os.getenv("IAP_PRODUCT_PREMIUM", "pt.portugalvivo.premium.monthly"),
    "annual": os.getenv("IAP_PRODUCT_ANNUAL", "pt.portugalvivo.premium.annual"),
}
PRODUCT_TIERS: Dict[str, str] = {product: tier for tier, product in IAP_PRODUCTS.items()}

APPLE_BUNDLE_ID = os.getenv("APPLE_BUNDLE_ID", "pt.portugalvivo")
GOOGLE_PLAY_PACKAGE_NAME = os.getenv("GOOGLE_PLAY_PACKAGE_NAME", "pt.portugalvivo")
ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
ANDROID_PUBLISHER_URL = "https://androidpublisher.googleapis.com/androidpublisher/v3"

# Stable namespace for account tokens. Changing it would orphan every purchase
# made before the change from its account.
_ACCOUNT_TOKEN_NAMESPACE = uuid.UUID("5b1f6c2e-8d0a-4c47-9a3e-2f7d1c9b6a10")

STORE_APPLE = "app_store"
STORE_GOOGLE = "google_play"

# Play subscription states that still entitle the user until expiryTime.
# CANCELED means auto-renew was switched off, not that access ended.
GOOGLE_ENTITLED_STATES = {
    "SUBSCRIPTION_STATE_ACTIVE",
    "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    "SUBSCRIPTION_STATE_CANCELED",
}


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def account_token(user_id: str) -> str:
    """Opaque per-account token passed to the store at purchase time."""
    return str(uuid.uuid5(_ACCOUNT_TOKEN_NAMESPACE, user_id))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso_from_ms(ms: Optional[int]) -> Optional[str]:
    if ms is None:
        return None
    return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).isoformat()


def _iso_from_rfc3339(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()


class StoreVerificationError(Exception):
    """The store refused the purchase or it could not be verified."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


class StoreUnavailable(Exception):
    """Store verification is not configured on this server."""


# ─── Apple (StoreKit 2) ──────────────────────────────────────────────────────

_apple_verifiers: Optional[Dict[str, Any]] = None


def _load_apple_verifiers() -> Dict[str, Any]:
    """SignedDataVerifier per environment, built once from the configured roots."""
    global _apple_verifiers
    if _apple_verifiers is not None:
        return _apple_verifiers
    try:
        from appstoreserverlibrary.models.Environment import Environment
        from appstoreserverlibrary.signed_data_verifier import SignedDataVerifier
    except ImportError as exc:  # pragma: no cover - dependency is pinned
        raise StoreUnavailable("app-store-server-library não instalada") from exc

    certs_dir = os.getenv("APPLE_ROOT_CERTS_DIR", "")
    roots = [p.read_bytes() for p in sorted(Path(certs_dir).glob("*.cer"))] if certs_dir else []
    if not roots:
        raise StoreUnavailable("Certificados raiz da Apple não configurados (APPLE_ROOT_CERTS_DIR)")
    online = _env_flag("IAP_APPLE_ONLINE_CHECKS", True)
    verifiers: Dict[str, Any] = {}
    app_id = os.getenv("APPLE_APP_ID")
    if app_id:
        verifiers["Production"] = SignedDataVerifier(roots, online, Environment.PRODUCTION, APPLE_BUNDLE_ID, int(app_id))
    if _env_flag("IAP_ALLOW_SANDBOX", True):
        verifiers["Sandbox"] = SignedDataVerifier(roots, online, Environment.SANDBOX, APPLE_BUNDLE_ID)
    if not verifiers:
        raise StoreUnavailable("Defina APPLE_APP_ID (produção) ou IAP_ALLOW_SANDBOX")
    _apple_verifiers = verifiers
    return verifiers


def _unverified_environment(jws: str) -> str:
    """Environment claim, read only to pick the verifier; the verifier re-checks it."""
    try:
        payload_b64 = jws.split(".")[1]
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=" * (-len(payload_b64) % 4)))
    except Exception as exc:
        raise StoreVerificationError("Transação inválida") from exc
    env = payload.get("environment")
    if env is None and isinstance(payload.get("data"), dict):  # notification envelope
        env = payload["data"].get("environment")
    return env or "Production"


def _apple_verifier_for(jws: str):
    verifiers = _load_apple_verifiers()
    env = _unverified_environment(jws)
    verifier = verifiers.get(env)
    if verifier is None:
        raise StoreVerificationError(f"Ambiente App Store não aceite: {env}", status_code=403)
    return verifier


def _apple_transaction_dict(tx: Any) -> Dict[str, Any]:
    return {
        "original_transaction_id": tx.originalTransactionId,
        "transaction_id": tx.transactionId,
        "product_id": tx.productId,
        "expires_ms": tx.expiresDate,
        "revoked": tx.revocationDate is not None,
        "account_token": (tx.appAccountToken or "").lower() or None,
        "environment": tx.rawEnvironment,
        "bundle_id": tx.bundleId,
    }


async def verify_apple_transaction(jws: str) -> Dict[str, Any]:
    """Verify a StoreKit 2 signed transaction and return its relevant fields."""
    from appstoreserverlibrary.signed_data_verifier import VerificationException

    verifier = _apple_verifier_for(jws)
    try:
        tx = await asyncio.to_thread(verifier.verify_and_decode_signed_transaction, jws)
    except VerificationException as exc:
        raise StoreVerificationError(f"Transação App Store inválida ({exc.status.name})", status_code=400) from exc
    return _apple_transaction_dict(tx)


async def verify_apple_notification(signed_payload: str) -> Dict[str, Any]:
    """Verify an App Store Server Notification V2 and decode its transaction."""
    from appstoreserverlibrary.signed_data_verifier import VerificationException

    verifier = _apple_verifier_for(signed_payload)
    try:
        note = await asyncio.to_thread(verifier.verify_and_decode_notification, signed_payload)
        tx = renewal = None
        if note.data and note.data.signedTransactionInfo:
            tx = await asyncio.to_thread(verifier.verify_and_decode_signed_transaction, note.data.signedTransactionInfo)
        if note.data and note.data.signedRenewalInfo:
            renewal = await asyncio.to_thread(verifier.verify_and_decode_renewal_info, note.data.signedRenewalInfo)
    except VerificationException as exc:
        raise StoreVerificationError(f"Notificação App Store inválida ({exc.status.name})") from exc
    return {
        "notification_id": note.notificationUUID,
        "type": note.rawNotificationType,
        "subtype": note.rawSubtype,
        "transaction": _apple_transaction_dict(tx) if tx else None,
        "auto_renew": (renewal.rawAutoRenewStatus == 1) if renewal and renewal.rawAutoRenewStatus is not None else None,
        "grace_expires_ms": renewal.gracePeriodExpiresDate if renewal else None,
    }


# ─── Google Play ──────────────────────────────────────────────────────────────

_google_credentials: Any = None


def _google_service_account_info() -> Dict[str, Any]:
    raw = os.getenv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")
    if raw:
        return json.loads(raw)
    path = os.getenv("GOOGLE_PLAY_SERVICE_ACCOUNT_FILE")
    if path:
        return json.loads(Path(path).read_text())
    raise StoreUnavailable("Conta de serviço do Google Play não configurada")


def _google_access_token_sync() -> str:
    global _google_credentials
    from google.auth.transport.requests import Request as GoogleAuthRequest
    from google.oauth2 import service_account

    if _google_credentials is None:
        _google_credentials = service_account.Credentials.from_service_account_info(
            _google_service_account_info(), scopes=[ANDROID_PUBLISHER_SCOPE])
    if not _google_credentials.valid:
        _google_credentials.refresh(GoogleAuthRequest())
    return _google_credentials.token


async def google_get_subscription(purchase_token: str) -> Dict[str, Any]:
    """Read a Play subscription purchase (subscriptionsv2.get) and return its relevant fields."""
    token = await asyncio.to_thread(_google_access_token_sync)
    url = (f"{ANDROID_PUBLISHER_URL}/applications/{GOOGLE_PLAY_PACKAGE_NAME}"
           f"/purchases/subscriptionsv2/tokens/{purchase_token}")
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
    if resp.status_code in (400, 404, 410):
        raise StoreVerificationError("Compra Google Play não encontrada", status_code=400)
    if resp.status_code >= 300:
        logger.error("[iap] Google Play API %s: %s", resp.status_code, resp.text[:300])
        raise StoreVerificationError("Google Play indisponível, tente mais tarde", status_code=502)
    data = resp.json()
    items: List[Dict[str, Any]] = data.get("lineItems") or []
    item = max(items, key=lambda i: i.get("expiryTime") or "", default={})
    return {
        "state": data.get("subscriptionState"),
        "product_id": item.get("productId"),
        "expires_at": _iso_from_rfc3339(item.get("expiryTime")),
        "auto_renew": (item.get("autoRenewingPlan") or {}).get("autoRenewEnabled"),
        "account_token": ((data.get("externalAccountIdentifiers") or {}).get("obfuscatedExternalAccountId") or None),
        "linked_purchase_token": data.get("linkedPurchaseToken"),
        "test_purchase": "testPurchase" in data,
    }


# ─── Persistence ──────────────────────────────────────────────────────────────

async def _owner_of(db: AsyncIOMotorDatabase, store_original_id: str) -> Optional[str]:
    doc = await db.subscriptions.find_one({"store_original_id": store_original_id}, {"user_id": 1, "_id": 0})
    return doc.get("user_id") if doc else None


async def _user_for_account_token(db: AsyncIOMotorDatabase, token: Optional[str]) -> Optional[str]:
    if not token:
        return None
    doc = await db.iap_account_tokens.find_one({"token": token}, {"user_id": 1, "_id": 0})
    return doc.get("user_id") if doc else None


async def _remember_account_token(db: AsyncIOMotorDatabase, user_id: str) -> str:
    token = account_token(user_id)
    await db.iap_account_tokens.update_one(
        {"token": token}, {"$setOnInsert": {"token": token, "user_id": user_id, "created_at": _now()}}, upsert=True)
    return token


async def _save_store_subscription(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
    store: str,
    store_original_id: str,
    product_id: str,
    expires_at: Optional[str],
    store_allows: bool,
    store_state: str,
    auto_renew: Optional[bool] = None,
    environment: Optional[str] = None,
) -> Dict[str, Any]:
    """Upsert the subscription row for one store purchase and return the status.

    ``store_allows`` is the store's own verdict (not refunded, not on hold…);
    access also needs an expiry in the future.
    """
    tier = PRODUCT_TIERS.get(product_id)
    if tier is None:
        raise StoreVerificationError(f"Produto desconhecido: {product_id}")
    entitled = store_allows and bool(expires_at) and expires_at > _now().isoformat()
    status = "active" if entitled else "inactive"
    now = _now().isoformat()
    fields = {
        "user_id": user_id,
        "tier": tier,
        "status": status,
        "price": TIERS[tier]["price"],
        "expires_at": expires_at or now,
        "payment_method": store,
        "store": store,
        "store_original_id": store_original_id,
        "store_product_id": product_id,
        "store_environment": environment,
        "store_state": store_state,
        "updated_at": now,
    }
    if auto_renew is not None:
        fields["auto_renew"] = auto_renew
    await db.subscriptions.update_one(
        {"store_original_id": store_original_id},
        {"$set": fields, "$setOnInsert": {"started_at": now}},
        upsert=True,
    )
    logger.info("[iap] %s %s → %s (user=%s, tier=%s, expires=%s)",
                store, store_original_id, status, user_id, tier, expires_at)
    return {"active": entitled, "status": status, "tier": tier if entitled else "free",
            "store": store, "expires_at": expires_at, "auto_renew": auto_renew}


async def _check_ownership(db: AsyncIOMotorDatabase, user_id: str, store_original_id: str,
                           purchase_account_token: Optional[str]) -> None:
    expected = account_token(user_id)
    if purchase_account_token and purchase_account_token != expected:
        raise StoreVerificationError("Esta compra pertence a outra conta Portugal Vivo", status_code=409)
    owner = await _owner_of(db, store_original_id)
    if owner and owner != user_id and purchase_account_token != expected:
        raise StoreVerificationError("Esta compra já está associada a outra conta Portugal Vivo", status_code=409)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@iap_router.get("/products")
async def list_products(request: Request, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Product ids per tier. Signed-in users also get the account token to pass
    to the store (iOS appAccountToken / Android obfuscatedAccountIdAndroid)."""
    user = await get_current_user(request)
    body: Dict[str, Any] = {
        "products": [
            {"tier": tier, "product_id": product, "name": TIERS[tier]["name"],
             "reference_price_eur": TIERS[tier]["price"]}
            for tier, product in IAP_PRODUCTS.items()
        ],
    }
    if user:
        body["account_token"] = await _remember_account_token(db, user.user_id)
    return body


class VerifyRequest(BaseModel):
    platform: Literal["ios", "android"]
    product_id: str = Field(..., max_length=200)
    purchase_token: str = Field(..., min_length=10, max_length=20000,
                                description="iOS: StoreKit 2 signed transaction (JWS); Android: purchase token")


@iap_router.post("/verify")
async def verify_purchase(
    payload: VerifyRequest,
    current_user: User = Depends(require_auth),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Verify a store purchase with the store and grant the matching tier.

    Idempotent: the app calls it after each purchase, on "Restaurar compras"
    and at start-up for every purchase the store still reports.
    """
    await _remember_account_token(db, current_user.user_id)
    try:
        if payload.platform == "ios":
            tx = await verify_apple_transaction(payload.purchase_token)
            if tx["product_id"] != payload.product_id:
                raise StoreVerificationError("A transação não corresponde ao produto indicado")
            store_original_id = f"apple:{tx['original_transaction_id']}"
            await _check_ownership(db, current_user.user_id, store_original_id, tx["account_token"])
            return await _save_store_subscription(
                db, user_id=current_user.user_id, store=STORE_APPLE, store_original_id=store_original_id,
                product_id=tx["product_id"], expires_at=_iso_from_ms(tx["expires_ms"]),
                store_allows=not tx["revoked"], store_state="revoked" if tx["revoked"] else "verified",
                environment=tx["environment"])

        sub = await google_get_subscription(payload.purchase_token)
        product_id = sub["product_id"] or payload.product_id
        if product_id != payload.product_id:
            raise StoreVerificationError("A compra não corresponde ao produto indicado")
        store_original_id = f"google:{payload.purchase_token}"
        await _check_ownership(db, current_user.user_id, store_original_id, sub["account_token"])
        if sub["linked_purchase_token"]:
            # Upgrade/downgrade or resubscribe: the old token is superseded.
            await db.subscriptions.update_many(
                {"store_original_id": f"google:{sub['linked_purchase_token']}", "status": "active"},
                {"$set": {"status": "replaced", "replaced_at": _now().isoformat()}})
        return await _save_store_subscription(
            db, user_id=current_user.user_id, store=STORE_GOOGLE, store_original_id=store_original_id,
            product_id=product_id, expires_at=sub["expires_at"],
            store_allows=sub["state"] in GOOGLE_ENTITLED_STATES, store_state=sub["state"] or "unknown",
            auto_renew=sub["auto_renew"],
            environment="Test" if sub["test_purchase"] else "Production")
    except StoreUnavailable as exc:
        logger.error("[iap] store verification unavailable: %s", exc)
        raise HTTPException(status_code=503, detail="Compras na app ainda não estão configuradas neste servidor")
    except StoreVerificationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc))


async def _claim_notification(db: AsyncIOMotorDatabase, notification_id: str, source: str) -> bool:
    """Record a notification id once; False when it was already processed."""
    try:
        await db.iap_notifications.insert_one(
            {"_id": f"{source}:{notification_id}", "received_at": _now()})
        return True
    except DuplicateKeyError:
        return False


class AppleNotification(BaseModel):
    signedPayload: str = Field(..., min_length=10, max_length=100000)


@iap_router.post("/apple/notifications")
async def apple_notifications(body: AppleNotification, db: AsyncIOMotorDatabase = Depends(get_db)):
    """App Store Server Notifications V2: renewals, expiries, refunds, revocations.

    The payload is signed by Apple and verified before use. Unknown purchases
    (no account link yet) are acknowledged; the app links them on its next
    /iap/verify.
    """
    try:
        note = await verify_apple_notification(body.signedPayload)
    except StoreUnavailable:
        raise HTTPException(status_code=503, detail="App Store não configurada")
    except StoreVerificationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if note["notification_id"] and not await _claim_notification(db, note["notification_id"], "apple"):
        return {"received": True, "duplicate": True}
    tx = note["transaction"]
    if not tx or tx["product_id"] not in PRODUCT_TIERS:
        logger.info("[iap] Apple %s/%s without a known subscription transaction", note["type"], note["subtype"])
        return {"received": True}

    store_original_id = f"apple:{tx['original_transaction_id']}"
    user_id = await _owner_of(db, store_original_id) or await _user_for_account_token(db, tx["account_token"])
    if not user_id:
        logger.warning("[iap] Apple %s for unlinked purchase %s", note["type"], store_original_id)
        return {"received": True}

    expires_ms = tx["expires_ms"]
    if note["grace_expires_ms"] and (expires_ms is None or note["grace_expires_ms"] > expires_ms):
        expires_ms = note["grace_expires_ms"]  # billing retry with grace period: keep access
    revoked = tx["revoked"] or note["type"] in ("REFUND", "REVOKE")
    await _save_store_subscription(
        db, user_id=user_id, store=STORE_APPLE, store_original_id=store_original_id,
        product_id=tx["product_id"], expires_at=_iso_from_ms(expires_ms),
        store_allows=not revoked, store_state=note["type"] or "notification",
        auto_renew=note["auto_renew"], environment=tx["environment"])
    return {"received": True}


@iap_router.post("/google/rtdn")
async def google_rtdn(request: Request, token: str = Query(""), db: AsyncIOMotorDatabase = Depends(get_db)):
    """Google Play real-time developer notifications (Cloud Pub/Sub push).

    The notification only says *which* purchase changed; the state is always
    re-read from the Play Developer API, so a forged push cannot grant access.
    The shared token in the push URL keeps strangers from triggering reads.
    """
    expected = os.getenv("GOOGLE_RTDN_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=503, detail="RTDN não configurado")
    if not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=403, detail="Token inválido")

    envelope = await request.json()
    message = (envelope or {}).get("message") or {}
    try:
        data = json.loads(base64.b64decode(message.get("data", "")) or b"{}")
    except Exception:
        raise HTTPException(status_code=400, detail="Mensagem Pub/Sub inválida")
    note = data.get("subscriptionNotification")
    if not note or data.get("packageName") != GOOGLE_PLAY_PACKAGE_NAME:
        return {"received": True}  # test notification or another app
    if message.get("messageId") and not await _claim_notification(db, message["messageId"], "google"):
        return {"received": True, "duplicate": True}

    purchase_token = note.get("purchaseToken", "")
    store_original_id = f"google:{purchase_token}"
    try:
        sub = await google_get_subscription(purchase_token)
    except StoreUnavailable:
        raise HTTPException(status_code=503, detail="Google Play não configurado")
    except StoreVerificationError as exc:
        if exc.status_code >= 500:
            await db.iap_notifications.delete_one({"_id": f"google:{message.get('messageId')}"})
            raise HTTPException(status_code=502, detail=str(exc))  # Pub/Sub retries
        logger.warning("[iap] RTDN for unknown Play purchase: %s", exc)
        return {"received": True}

    product_id = sub["product_id"] or note.get("subscriptionId", "")
    if product_id not in PRODUCT_TIERS:
        logger.warning("[iap] RTDN for unknown product %s", product_id)
        return {"received": True}
    user_id = await _owner_of(db, store_original_id) or await _user_for_account_token(db, sub["account_token"])
    if not user_id:
        logger.warning("[iap] RTDN type %s for unlinked purchase", note.get("notificationType"))
        return {"received": True}
    if sub["linked_purchase_token"]:
        await db.subscriptions.update_many(
            {"store_original_id": f"google:{sub['linked_purchase_token']}", "status": "active"},
            {"$set": {"status": "replaced", "replaced_at": _now().isoformat()}})
    await _save_store_subscription(
        db, user_id=user_id, store=STORE_GOOGLE, store_original_id=store_original_id,
        product_id=product_id, expires_at=sub["expires_at"],
        store_allows=sub["state"] in GOOGLE_ENTITLED_STATES, store_state=sub["state"] or "unknown",
        auto_renew=sub["auto_renew"],
        environment="Test" if sub["test_purchase"] else "Production")
    return {"received": True}


@iap_router.get("/status")
async def iap_config_status(_: User = Depends(require_admin)):
    """Which stores this server can verify (admin; for setup)."""
    status: Dict[str, Dict[str, Any]] = {}
    try:
        _load_apple_verifiers()
        status["app_store"] = {"configured": True}
    except StoreUnavailable as exc:
        status["app_store"] = {"configured": False, "reason": str(exc)}
    try:
        _google_service_account_info()
        status["google_play"] = {"configured": True, "rtdn": bool(os.getenv("GOOGLE_RTDN_TOKEN"))}
    except (StoreUnavailable, ValueError, OSError) as exc:
        status["google_play"] = {"configured": False, "reason": str(exc)}
    return {"stores": status, "products": IAP_PRODUCTS}
