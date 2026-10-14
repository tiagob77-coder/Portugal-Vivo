"""
In-app purchases: App Store / Google Play verification, account binding,
store notifications and the premium status they feed.

Store calls are replaced by fakes except in the last test, which runs the
real App Store verifier (app-store-server-library) on a JWS signed by a
throw-away certificate chain shaped like Apple's.
"""
from __future__ import annotations

import base64
import json
from datetime import datetime, timedelta, timezone

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

mongomock_motor = pytest.importorskip("mongomock_motor")

import iap_api  # noqa: E402
import premium_api  # noqa: E402
from auth_api import require_auth  # noqa: E402
from dependencies import get_db  # noqa: E402
from iap_api import IAP_PRODUCTS, account_token, iap_router  # noqa: E402
from models.api_models import User  # noqa: E402
from shared_utils import DatabaseHolder  # noqa: E402

NOW = datetime.now(timezone.utc)
MONTHLY = IAP_PRODUCTS["premium"]
ANNUAL = IAP_PRODUCTS["annual"]


def _ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def _user(uid: str) -> User:
    return User(user_id=uid, email=f"{uid}@pv.pt", name=uid, created_at=NOW)


def _apple_tx(**overrides):
    tx = {"original_transaction_id": "1000001", "transaction_id": "2000001", "product_id": ANNUAL,
          "expires_ms": _ms(NOW + timedelta(days=365)), "revoked": False,
          "account_token": account_token("u-ana"), "environment": "Sandbox", "bundle_id": "pt.portugalvivo"}
    tx.update(overrides)
    return tx


def _play_sub(**overrides):
    sub = {"state": "SUBSCRIPTION_STATE_ACTIVE", "product_id": MONTHLY,
           "expires_at": (NOW + timedelta(days=30)).isoformat(), "auto_renew": True,
           "account_token": account_token("u-ana"), "linked_purchase_token": None, "test_purchase": True}
    sub.update(overrides)
    return sub


@pytest_asyncio.fixture
async def db():
    return mongomock_motor.AsyncMongoMockClient()["pv_iap_test"]


@pytest_asyncio.fixture
async def client(db, monkeypatch):
    state = {"user": _user("u-ana"), "apple": {}, "google": {}}
    app = FastAPI()
    app.include_router(iap_router, prefix="/api")
    app.include_router(premium_api.premium_router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_auth] = lambda: state["user"]
    holder = DatabaseHolder("premium-test")
    holder.set(db)
    monkeypatch.setattr(premium_api, "_db_holder", holder)

    async def _current_user(request):
        return state["user"]

    async def _apple(jws):
        if jws not in state["apple"]:
            raise iap_api.StoreVerificationError("Transação App Store inválida (VERIFICATION_FAILURE)")
        return state["apple"][jws]

    async def _google(token):
        if token not in state["google"]:
            raise iap_api.StoreVerificationError("Compra Google Play não encontrada")
        return state["google"][token]

    monkeypatch.setattr(iap_api, "get_current_user", _current_user)
    monkeypatch.setattr(iap_api, "verify_apple_transaction", _apple)
    monkeypatch.setattr(iap_api, "google_get_subscription", _google)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        c.state = state
        yield c


async def _verify(client, platform, product_id, token):
    return await client.post("/api/iap/verify",
                             json={"platform": platform, "product_id": product_id, "purchase_token": token})


async def _status(client, uid="u-ana"):
    return (await client.get(f"/api/premium/status/{uid}")).json()


# ─── catalogue & account binding ─────────────────────────────────────────────

@pytest.mark.anyio
async def test_products_carry_account_token_only_when_signed_in(client, db):
    body = (await client.get("/api/iap/products")).json()
    assert {p["tier"]: p["product_id"] for p in body["products"]} == {"premium": MONTHLY, "annual": ANNUAL}
    assert body["account_token"] == account_token("u-ana")
    assert await db.iap_account_tokens.count_documents({"user_id": "u-ana"}) == 1
    client.state["user"] = None
    assert "account_token" not in (await client.get("/api/iap/products")).json()


def test_account_token_is_a_stable_uuid():
    assert account_token("u-ana") == account_token("u-ana") != account_token("u-rui")
    assert len(account_token("u-ana")) == 36


# ─── App Store ───────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_ios_purchase_grants_the_tier(client):
    assert (await _status(client))["tier"] == "free"
    assert (await _verify(client, "ios", ANNUAL, "jws-forged-1")).status_code == 400  # store refuses it
    client.state["apple"]["jws-annual-1"] = _apple_tx()
    resp = await _verify(client, "ios", ANNUAL, "jws-annual-1")
    assert resp.status_code == 200, resp.text
    assert resp.json()["active"] is True and resp.json()["tier"] == "annual"
    status = await _status(client)
    assert status["tier"] == "annual" and status["store"] == "app_store"
    assert status["requires_manual_renewal"] is False
    # Idempotent: verifying again keeps one row
    assert (await _verify(client, "ios", ANNUAL, "jws-annual-1")).status_code == 200


@pytest.mark.anyio
async def test_ios_refuses_other_accounts_and_mismatched_products(client, db):
    client.state["apple"]["jws-other-acct"] = _apple_tx(account_token=account_token("u-rui"))
    assert (await _verify(client, "ios", ANNUAL, "jws-other-acct")).status_code == 409
    client.state["apple"]["jws-annual-1"] = _apple_tx()
    assert (await _verify(client, "ios", MONTHLY, "jws-annual-1")).status_code == 400
    # A purchase without account token, already linked to Ana, cannot be claimed by Rui
    client.state["apple"]["jws-no-token"] = _apple_tx(original_transaction_id="1000009", account_token=None)
    assert (await _verify(client, "ios", ANNUAL, "jws-no-token")).status_code == 200
    client.state["user"] = _user("u-rui")
    assert (await _verify(client, "ios", ANNUAL, "jws-no-token")).status_code == 409
    assert await db.subscriptions.count_documents({"user_id": "u-rui"}) == 0


@pytest.mark.anyio
async def test_ios_expired_or_refunded_transaction_does_not_grant(client):
    client.state["apple"]["jws-expired"] = _apple_tx(expires_ms=_ms(NOW - timedelta(days=1)))
    body = (await _verify(client, "ios", ANNUAL, "jws-expired")).json()
    assert body["active"] is False and body["tier"] == "free"
    client.state["apple"]["jws-refunded"] = _apple_tx(original_transaction_id="1000002", revoked=True)
    assert (await _verify(client, "ios", ANNUAL, "jws-refunded")).json()["active"] is False
    assert (await _status(client))["tier"] == "free"


# ─── Google Play ─────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_android_states(client, db):
    client.state["google"]["play-token-active"] = _play_sub()
    body = (await _verify(client, "android", MONTHLY, "play-token-active")).json()
    assert body["active"] is True and body["tier"] == "premium"

    # Auto-renew off: access until expiry
    client.state["google"]["play-token-active"] = _play_sub(state="SUBSCRIPTION_STATE_CANCELED", auto_renew=False)
    body = (await _verify(client, "android", MONTHLY, "play-token-active")).json()
    assert body["active"] is True and body["auto_renew"] is False

    # Upgrade to annual: new token links the old one, which is superseded
    client.state["google"]["play-token-annual"] = _play_sub(product_id=ANNUAL, linked_purchase_token="play-token-active",
                                                            expires_at=(NOW + timedelta(days=365)).isoformat())
    assert (await _verify(client, "android", ANNUAL, "play-token-annual")).json()["tier"] == "annual"
    old = await db.subscriptions.find_one({"store_original_id": "google:play-token-active"})
    assert old["status"] == "replaced"
    assert (await _status(client))["tier"] == "annual"

    client.state["google"]["play-token-hold"] = _play_sub(state="SUBSCRIPTION_STATE_ON_HOLD")
    assert (await _verify(client, "android", MONTHLY, "play-token-hold")).json()["active"] is False


@pytest.mark.anyio
async def test_unconfigured_store_answers_503(client, monkeypatch):
    async def _unavailable(token):
        raise iap_api.StoreUnavailable("Conta de serviço do Google Play não configurada")
    monkeypatch.setattr(iap_api, "google_get_subscription", _unavailable)
    assert (await _verify(client, "android", MONTHLY, "play-token-x")).status_code == 503


# ─── Store notifications ─────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_apple_notifications_renew_refund_and_dedupe(client, db, monkeypatch):
    client.state["apple"]["jws-monthly-1"] = _apple_tx(product_id=MONTHLY, expires_ms=_ms(NOW + timedelta(days=3)))
    assert (await _verify(client, "ios", MONTHLY, "jws-monthly-1")).json()["active"] is True
    notes = {}

    async def _note(payload):
        return notes[payload]
    monkeypatch.setattr(iap_api, "verify_apple_notification", _note)

    renewed = NOW + timedelta(days=33)
    notes["signed-renew"] = {"notification_id": "n-1", "type": "DID_RENEW", "subtype": None, "auto_renew": True,
                             "grace_expires_ms": None,
                             "transaction": _apple_tx(product_id=MONTHLY, expires_ms=_ms(renewed))}
    assert (await client.post("/api/iap/apple/notifications", json={"signedPayload": "signed-renew"})).status_code == 200
    row = await db.subscriptions.find_one({"store_original_id": "apple:1000001"})
    assert row["expires_at"] == datetime.fromtimestamp(_ms(renewed) / 1000, tz=timezone.utc).isoformat()
    dup = await client.post("/api/iap/apple/notifications", json={"signedPayload": "signed-renew"})
    assert dup.json().get("duplicate") is True

    notes["signed-refund"] = {"notification_id": "n-2", "type": "REFUND", "subtype": None, "auto_renew": None,
                              "grace_expires_ms": None,
                              "transaction": _apple_tx(product_id=MONTHLY, expires_ms=_ms(renewed))}
    await client.post("/api/iap/apple/notifications", json={"signedPayload": "signed-refund"})
    assert (await _status(client))["tier"] == "free"

    # Purchase never linked through the app and unknown account token: acknowledged, nothing stored
    notes["signed-orphan"] = {"notification_id": "n-3", "type": "SUBSCRIBED", "subtype": None, "auto_renew": True,
                              "grace_expires_ms": None,
                              "transaction": _apple_tx(original_transaction_id="999", account_token="x")}
    assert (await client.post("/api/iap/apple/notifications", json={"signedPayload": "signed-orphan"})).status_code == 200
    assert await db.subscriptions.count_documents({"store_original_id": "apple:999"}) == 0


def _push(data: dict, message_id="m-1"):
    return {"message": {"data": base64.b64encode(json.dumps(data).encode()).decode(), "messageId": message_id},
            "subscription": "projects/pv/subscriptions/play"}


@pytest.mark.anyio
async def test_google_rtdn(client, db, monkeypatch):
    note = {"packageName": iap_api.GOOGLE_PLAY_PACKAGE_NAME,
            "subscriptionNotification": {"notificationType": 13, "purchaseToken": "play-token-1",
                                         "subscriptionId": MONTHLY}}
    monkeypatch.delenv("GOOGLE_RTDN_TOKEN", raising=False)
    assert (await client.post("/api/iap/google/rtdn?token=x", json=_push(note))).status_code == 503
    monkeypatch.setenv("GOOGLE_RTDN_TOKEN", "s3cret")
    assert (await client.post("/api/iap/google/rtdn?token=wrong", json=_push(note))).status_code == 403

    client.state["google"]["play-token-1"] = _play_sub()
    assert (await _verify(client, "android", MONTHLY, "play-token-1")).json()["active"] is True
    client.state["google"]["play-token-1"] = _play_sub(state="SUBSCRIPTION_STATE_EXPIRED",
                                                       expires_at=(NOW - timedelta(hours=1)).isoformat())
    resp = await client.post("/api/iap/google/rtdn?token=s3cret", json=_push(note))
    assert resp.status_code == 200
    assert (await _status(client))["tier"] == "free"
    dup = await client.post("/api/iap/google/rtdn?token=s3cret", json=_push(note))
    assert dup.json().get("duplicate") is True
    other_app = {**note, "packageName": "com.other"}
    assert (await client.post("/api/iap/google/rtdn?token=s3cret", json=_push(other_app, "m-2"))).status_code == 200


# ─── Real App Store signature verification ───────────────────────────────────

def _apple_like_chain(tmp_path):
    """Root → intermediate → leaf with the OIDs Apple's verifier requires."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import NameOID

    def name(cn):
        return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])

    def cert(subject, issuer, key, issuer_key, ca, extra_oid=None):
        builder = (x509.CertificateBuilder()
                   .subject_name(name(subject)).issuer_name(name(issuer))
                   .public_key(key.public_key()).serial_number(x509.random_serial_number())
                   .not_valid_before(NOW - timedelta(days=1)).not_valid_after(NOW + timedelta(days=30))
                   .add_extension(x509.BasicConstraints(ca=ca, path_length=None), critical=True)
                   .add_extension(x509.KeyUsage(digital_signature=not ca, key_cert_sign=ca, crl_sign=ca,
                                                content_commitment=False, key_encipherment=False,
                                                data_encipherment=False, key_agreement=False,
                                                encipher_only=False, decipher_only=False), critical=True)
                   .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
                   .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(issuer_key.public_key()),
                                  critical=False))
        if extra_oid:
            builder = builder.add_extension(
                x509.UnrecognizedExtension(x509.ObjectIdentifier(extra_oid), b"\x05\x00"), critical=False)
        return builder.sign(issuer_key, hashes.SHA256())

    root_key, int_key, leaf_key = (ec.generate_private_key(ec.SECP256R1()) for _ in range(3))
    root = cert("Test Root", "Test Root", root_key, root_key, True)
    inter = cert("Test WWDR", "Test Root", int_key, root_key, True, "1.2.840.113635.100.6.2.1")
    leaf = cert("Test Signer", "Test WWDR", leaf_key, int_key, False, "1.2.840.113635.100.6.11.1")
    (tmp_path / "root.cer").write_bytes(root.public_bytes(serialization.Encoding.DER))
    x5c = [base64.b64encode(c.public_bytes(serialization.Encoding.DER)).decode() for c in (leaf, inter, root)]
    return leaf_key, x5c


@pytest.mark.anyio
async def test_real_verifier_accepts_a_correctly_signed_transaction(tmp_path, monkeypatch):
    pytest.importorskip("appstoreserverlibrary")
    import jwt

    leaf_key, x5c = _apple_like_chain(tmp_path)
    monkeypatch.setenv("APPLE_ROOT_CERTS_DIR", str(tmp_path))
    monkeypatch.setenv("IAP_APPLE_ONLINE_CHECKS", "false")
    monkeypatch.delenv("APPLE_APP_ID", raising=False)
    monkeypatch.setattr(iap_api, "_apple_verifiers", None)
    claims = {"originalTransactionId": "1000001", "transactionId": "2000001", "productId": ANNUAL,
              "bundleId": iap_api.APPLE_BUNDLE_ID, "environment": "Sandbox", "type": "Auto-Renewable Subscription",
              "appAccountToken": account_token("u-ana"), "purchaseDate": _ms(NOW),
              "expiresDate": _ms(NOW + timedelta(days=365)), "signedDate": _ms(NOW)}
    jws = jwt.encode(claims, leaf_key, algorithm="ES256", headers={"x5c": x5c})

    tx = await iap_api.verify_apple_transaction(jws)
    assert tx["product_id"] == ANNUAL and tx["account_token"] == account_token("u-ana")
    assert tx["environment"] == "Sandbox" and tx["revoked"] is False

    # Same claims signed by a key outside the chain → refused
    from cryptography.hazmat.primitives.asymmetric import ec
    rogue = jwt.encode(claims, ec.generate_private_key(ec.SECP256R1()), algorithm="ES256", headers={"x5c": x5c})
    with pytest.raises(iap_api.StoreVerificationError):
        await iap_api.verify_apple_transaction(rogue)
    # Another app's bundle → refused
    other_bundle = jwt.encode({**claims, "bundleId": "com.other"}, leaf_key, algorithm="ES256", headers={"x5c": x5c})
    with pytest.raises(iap_api.StoreVerificationError):
        await iap_api.verify_apple_transaction(other_bundle)
    # Production purchases need APPLE_APP_ID configured
    prod = jwt.encode({**claims, "environment": "Production"}, leaf_key, algorithm="ES256", headers={"x5c": x5c})
    with pytest.raises(iap_api.StoreVerificationError):
        await iap_api.verify_apple_transaction(prod)
    monkeypatch.setattr(iap_api, "_apple_verifiers", None)
