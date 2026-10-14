"""
Partner API (B2B): API keys, plan features, monthly quotas and /v1 endpoints.

Runs a minimal FastAPI app with the api_keys / partner_api_v1 routers on an
in-memory mongomock-motor database — no MongoDB or auth server needed.
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

mongomock_motor = pytest.importorskip("mongomock_motor")

import api_keys_api  # noqa: E402
from api_keys_api import API_PLANS, api_keys_admin_router, api_keys_public_router, hash_api_key  # noqa: E402
from auth_api import require_admin  # noqa: E402
from dependencies import get_db  # noqa: E402
from models.api_models import User  # noqa: E402
from partner_api_v1 import partner_api_v1_router  # noqa: E402

ADMIN = User(user_id="admin-1", email="admin@pv.pt", name="Admin", created_at=datetime.now(timezone.utc))


@pytest_asyncio.fixture
async def db():
    client = mongomock_motor.AsyncMongoMockClient()
    database = client["pv_partner_api_test"]
    await database.heritage_items.insert_many([
        {"id": "poi-1", "name": "Templo Romano", "category": "arqueologia", "region": "alentejo",
         "concelho": "Évora", "location": {"lat": 38.5725, "lng": -7.9072},
         "description": "Templo romano do século I, um dos mais bem preservados da Península Ibérica.",
         "micro_pitch": "O templo que sobreviveu a dois mil anos."},
        {"id": "poi-2", "name": "Capela dos Ossos", "category": "religioso", "region": "alentejo",
         "concelho": "Évora", "location": {"lat": 38.5681, "lng": -7.9083}},
        {"id": "poi-3", "name": "Torre de Belém", "category": "monumento", "region": "lisboa",
         "concelho": "Lisboa", "location": {"lat": 38.6916, "lng": -9.2160}},
        {"id": "poi-hidden", "name": "POI despublicado", "category": "monumento", "region": "alentejo",
         "concelho": "Évora", "is_published": False, "location": {"lat": 38.57, "lng": -7.90}},
    ])
    await database.routes.insert_one({"id": "rota-1", "name": "Évora Romana", "region": "alentejo",
                                      "items": ["poi-2", "poi-1", "poi-hidden"]})
    await database.narratives.insert_one({"id": "n-1", "poi_id": "poi-1", "status": "published",
                                          "title": "Diana", "story_text": "Lenda..."})
    await database.events.insert_many([
        {"id": "ev-1", "name": "Feira de São João", "region": "Alentejo", "concelho": "Évora", "month": 6},
        {"id": "ev-2", "name": "Rascunho", "region": "Alentejo", "is_published": False},
    ])
    return database


@pytest_asyncio.fixture
async def client(db):
    app = FastAPI()
    for router in (api_keys_public_router, api_keys_admin_router, partner_api_v1_router):
        app.include_router(router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_admin] = lambda: ADMIN
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c


async def _new_key(client, plan="explorador") -> str:
    resp = await client.post("/api/admin/api-keys", json={"name": "Teste", "org_name": "Agência X", "plan": plan})
    assert resp.status_code == 201, resp.text
    return resp.json()["api_key"]


@pytest.mark.anyio
async def test_plans_catalogue_matches_pricing_doc(client):
    resp = await client.get("/api/v1/plans")
    assert resp.status_code == 200
    plans = {p["id"]: p for p in resp.json()["plans"]}
    assert plans["parceiro"]["price_eur_month"] == 49
    assert plans["pro"]["price_eur_month"] == 149
    assert plans["parceiro"]["price_eur_month_billed_annually"] == pytest.approx(39.2)
    assert plans["explorador"]["monthly_quota"] == 500
    assert plans["enterprise"]["monthly_quota"] is None
    assert "audio" not in plans["parceiro"]["features"] and "audio" in plans["pro"]["features"]


@pytest.mark.anyio
async def test_key_is_stored_hashed_and_shown_once(client, db):
    raw = await _new_key(client)
    assert raw.startswith("pv_live_")
    doc = await db.api_keys.find_one({})
    assert doc["key_hash"] == hash_api_key(raw)
    assert raw not in str(doc)
    listing = (await client.get("/api/admin/api-keys")).json()
    assert "key_hash" not in listing["keys"][0] and "api_key" not in listing["keys"][0]


@pytest.mark.anyio
async def test_v1_requires_valid_key(client):
    assert (await client.get("/api/v1/heritage")).status_code == 401
    resp = await client.get("/api/v1/heritage", headers={"X-API-Key": "pv_live_invalida"})
    assert resp.status_code == 401


@pytest.mark.anyio
async def test_heritage_listing_hides_unpublished_and_filters_by_municipality(client):
    key = await _new_key(client)
    resp = await client.get("/api/v1/heritage", params={"municipality": "evora"}, headers={"X-API-Key": key})
    assert resp.status_code == 200
    body = resp.json()
    ids = {p["id"] for p in body["data"]}
    assert ids == {"poi-1", "poi-2"}
    assert body["meta"]["total"] == 2
    assert body["attribution"].startswith("Conteúdo Portugal Vivo")
    assert resp.headers["X-RateLimit-Limit"] == "500"
    assert resp.headers["X-RateLimit-Remaining"] == "499"
    assert all(p["municipality"] == "evora" for p in body["data"])


@pytest.mark.anyio
async def test_bbox_filter_and_validation(client):
    key = await _new_key(client)
    lisbon = "-9.5,38.6,-9.0,38.8"
    resp = await client.get("/api/v1/map/items", params={"bbox": lisbon}, headers={"X-API-Key": key})
    assert [p["id"] for p in resp.json()["data"]] == ["poi-3"]
    bad = await client.get("/api/v1/map/items", params={"bbox": "1,2,3"}, headers={"X-API-Key": key})
    assert bad.status_code == 422


@pytest.mark.anyio
async def test_route_detail_returns_published_pois_in_order(client):
    key = await _new_key(client)
    resp = await client.get("/api/v1/routes/rota-1", headers={"X-API-Key": key})
    assert resp.status_code == 200
    assert [p["id"] for p in resp.json()["data"]["pois"]] == ["poi-2", "poi-1"]


@pytest.mark.anyio
async def test_plan_features_gate_endpoints(client):
    explorador = await _new_key(client, "explorador")
    resp = await client.get("/api/v1/narratives/poi-1", headers={"X-API-Key": explorador})
    assert resp.status_code == 403
    assert "Parceiro" in resp.json()["detail"]

    parceiro = await _new_key(client, "parceiro")
    resp = await client.get("/api/v1/narratives/poi-1", headers={"X-API-Key": parceiro})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["stories"][0]["title"] == "Diana"
    assert data["audio_available"] is False and "audio_endpoint" not in data
    assert (await client.get("/api/v1/audio/poi-1", headers={"X-API-Key": parceiro})).status_code == 403

    events = await client.get("/api/v1/events", headers={"X-API-Key": parceiro})
    assert [e["id"] for e in events.json()["data"]] == ["ev-1"]

    pro = await _new_key(client, "pro")
    resp = await client.get("/api/v1/narratives/poi-1", headers={"X-API-Key": pro})
    assert resp.json()["data"]["audio_endpoint"] == "/api/v1/audio/poi-1"
    assert "attribution" not in resp.json()  # white-label


@pytest.mark.anyio
async def test_monthly_quota_is_enforced(client, monkeypatch):
    monkeypatch.setitem(API_PLANS["explorador"], "monthly_quota", 2)
    key = await _new_key(client)
    headers = {"X-API-Key": key}
    assert (await client.get("/api/v1/heritage", headers=headers)).status_code == 200
    assert (await client.get("/api/v1/heritage/poi-1", headers=headers)).status_code == 200
    resp = await client.get("/api/v1/heritage", headers=headers)
    assert resp.status_code == 429
    usage = (await client.get("/api/v1/usage", headers=headers)).json()
    assert usage["used"] == 3 and usage["remaining"] == 0
    assert usage["by_feature"]["heritage"] == 3


@pytest.mark.anyio
async def test_revoked_and_suspended_keys_are_refused(client):
    key = await _new_key(client)
    key_id = (await client.get("/api/admin/api-keys")).json()["keys"][0]["key_id"]
    resp = await client.patch(f"/api/admin/api-keys/{key_id}", json={"status": "suspended"})
    assert resp.status_code == 200 and resp.json()["status"] == "suspended"
    assert (await client.get("/api/v1/heritage", headers={"X-API-Key": key})).status_code == 401
    assert (await client.delete(f"/api/admin/api-keys/{key_id}")).status_code == 204
    resp = await client.patch(f"/api/admin/api-keys/{key_id}", json={"status": "active"})
    assert resp.status_code == 409


@pytest.mark.anyio
async def test_access_request_flow(client, db):
    resp = await client.post("/api/v1/access-requests", json={
        "org_name": "Hotel Boutique", "contact_name": "Ana", "contact_email": "ana@hotel.pt",
        "use_case": "Página 'Descobrir a região' no site do hotel.", "desired_plan": "parceiro",
    })
    assert resp.status_code == 201
    request_id = resp.json()["request_id"]
    pending = (await client.get("/api/admin/api-keys/requests")).json()
    assert pending["total"] == 1
    created = await client.post("/api/admin/api-keys", json={
        "name": "Hotel", "org_name": "Hotel Boutique", "plan": "parceiro", "request_id": request_id})
    assert created.status_code == 201
    req = await db.api_access_requests.find_one({"request_id": request_id})
    assert req["status"] == "approved"
    keys = (await client.get("/api/admin/api-keys")).json()
    assert keys["mrr_eur_list_price"] == 49


def test_unknown_feature_is_a_programming_error():
    with pytest.raises(ValueError):
        api_keys_api.require_api_key("nope")
