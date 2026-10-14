"""
Municipal B2G: plans/quotas, anonymous impact events, impact dashboard,
monthly PDF report, public profile and the partner portal fixes.

In-memory mongomock-motor DB; tenant/auth dependencies are overridden so no
MongoDB or session store is needed.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException

mongomock_motor = pytest.importorskip("mongomock_motor")

import partner_portal_api  # noqa: E402
from auth_api import require_admin  # noqa: E402
from dependencies import get_db  # noqa: E402
from models.api_models import User  # noqa: E402
from municipal_api import (  # noqa: E402
    enforce_poi_quota,
    impact_router,
    municipal_admin_router,
    municipal_router,
    municipios_public_router,
)
from partner_portal_api import partner_router  # noqa: E402
from tenant_middleware import (  # noqa: E402
    TenantContext,
    TenantRole,
    require_tenant_read,
    require_tenant_write,
)
from territory import municipality_slug, name_regex, territory_filter  # noqa: E402

NOW = datetime.now(timezone.utc)
ADMIN = User(user_id="admin-1", email="admin@pv.pt", name="Admin", created_at=NOW)


def _tenant(role=TenantRole.MUNICIPIO, municipality="evora"):
    return TenantContext(user_id=f"u-{role.value}", email="t@cm-evora.pt", name="Técnico", role=role,
                         municipality_id=municipality, is_admin_global=role == TenantRole.ADMIN_GLOBAL)


@pytest_asyncio.fixture
async def db():
    client = mongomock_motor.AsyncMongoMockClient()
    database = client["pv_municipal_test"]
    await database.heritage_items.insert_many([
        {"id": "e1", "name": "Templo Romano", "category": "arqueologia", "concelho": "Évora",
         "image_url": "https://img/1.jpg", "micro_pitch": "Dois mil anos."},
        {"id": "e2", "name": "Capela dos Ossos", "category": "religioso", "concelho": "Évora"},
        {"id": "e3", "name": "Cromeleque dos Almendres", "category": "arqueologia", "municipality_id": "evora"},
        {"id": "l1", "name": "Torre de Belém", "category": "monumento", "concelho": "Lisboa"},
    ])
    await database.routes.insert_one({"id": "r1", "name": "Évora Romana", "items": ["e1", "e2"]})
    await database.trails.insert_one({"id": "t1", "name": "PR1 Ecopista de Évora", "concelho": "Évora"})
    return database


class _State:
    tenant = _tenant()
    user_id = "u-municipio"


@pytest_asyncio.fixture
async def client(db, monkeypatch):
    state = _State()
    app = FastAPI()
    for router in (municipal_router, municipal_admin_router, impact_router, municipios_public_router, partner_router):
        app.include_router(router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_admin] = lambda: ADMIN
    app.dependency_overrides[require_tenant_read] = lambda: state.tenant
    app.dependency_overrides[require_tenant_write] = lambda: state.tenant

    class _U:
        def __init__(self, uid):
            self.user_id, self.email, self.name = uid, f"{uid}@x.pt", uid

    async def _auth(request):
        return _U(state.user_id)

    async def _admin(request):
        if state.user_id != "admin-1":
            raise HTTPException(403, "admin only")
        return _U("admin-1")

    monkeypatch.setattr(partner_portal_api, "_require_auth", _auth)
    monkeypatch.setattr(partner_portal_api, "_require_admin", _admin)
    monkeypatch.setattr(partner_portal_api, "_db", lambda: db)  # module resolves the DB lazily
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        c.state = state
        yield c


async def _activate(client, plan="territorio", status="pilot", municipality="evora"):
    resp = await client.put(f"/api/admin/municipal/subscriptions/{municipality}",
                            json={"plan": plan, "status": status, "concelhos": ["Évora"]})
    assert resp.status_code == 200, resp.text
    return resp.json()


# ─── territory helpers ────────────────────────────────────────────────────────

def test_slug_and_accent_insensitive_regex():
    import re
    assert municipality_slug("Vila Nova de Gaia") == "vila-nova-de-gaia"
    assert municipality_slug("vila_nova_de_gaia") == "vila-nova-de-gaia"
    assert re.match(name_regex("evora"), "Évora")
    assert re.match(name_regex("vila-nova-de-gaia"), "Vila Nova de Gaia")
    assert not re.match(name_regex("evora"), "Évora de Alcobaça")
    assert territory_filter([], []) == {"_id": {"$exists": False}}


# ─── plans & subscriptions ────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_plan_catalogue(client):
    plans = {p["id"]: p for p in (await client.get("/api/municipal/plans")).json()["plans"]}
    assert plans["territorio"]["price_eur_year"] == 4900
    assert plans["territorio"]["max_pois"] == 150 and plans["territorio"]["max_audio_guides"] == 20
    assert all(p["price_eur_year"] < 20000 for p in plans.values())


@pytest.mark.anyio
async def test_pilot_defaults_to_three_months_and_usage_counts_territory(client):
    sub = await _activate(client)
    starts = datetime.fromisoformat(sub["starts_at"]).replace(tzinfo=timezone.utc)
    ends = datetime.fromisoformat(sub["ends_at"]).replace(tzinfo=timezone.utc)
    assert 90 <= (ends - starts).days <= 93
    body = (await client.get("/api/municipal/me/subscription")).json()
    assert body["active"] is True
    assert body["usage"]["territory_pois_total"] == 3  # 2 por concelho "Évora" + 1 por municipality_id
    assert body["usage"]["curated_pois"] == 1
    assert body["plan"]["name"] == "Território"


@pytest.mark.anyio
async def test_tenant_cannot_read_other_municipality(client):
    resp = await client.get("/api/municipal/me/subscription", params={"municipality_id": "lisboa"})
    assert resp.status_code == 403


@pytest.mark.anyio
async def test_paid_features_require_active_plan(client):
    assert (await client.get("/api/municipal/me/impact")).status_code == 402
    assert (await client.get("/api/municipal/me/reports/2026-09.pdf")).status_code == 402


@pytest.mark.anyio
async def test_poi_quota(db, client):
    with pytest.raises(HTTPException) as exc:
        await enforce_poi_quota(db, "evora", 1)
    assert exc.value.status_code == 402
    await _activate(client, plan="essencial")
    await enforce_poi_quota(db, "evora", 79)  # 1 curado + 79 = 80 → cabe
    with pytest.raises(HTTPException) as exc:
        await enforce_poi_quota(db, "evora", 80)
    assert exc.value.status_code == 403
    await _activate(client, plan="destino")
    await enforce_poi_quota(db, "evora", 10_000)  # ilimitado


@pytest.mark.anyio
async def test_audio_guide_quota(client, monkeypatch):
    import municipal_api
    await _activate(client)
    monkeypatch.setitem(municipal_api.MUNICIPAL_PLANS["territorio"], "max_audio_guides", 1)
    assert (await client.post("/api/municipal/me/audio-guides/e1")).status_code == 201
    assert (await client.post("/api/municipal/me/audio-guides/e1")).status_code == 201  # idempotente
    assert (await client.post("/api/municipal/me/audio-guides/e2")).status_code == 403
    assert (await client.post("/api/municipal/me/audio-guides/l1")).status_code == 404  # fora do território
    listing = (await client.get("/api/municipal/me/audio-guides")).json()
    assert listing["used"] == 1 and listing["max"] == 1


# ─── impact events & dashboard ────────────────────────────────────────────────

@pytest.mark.anyio
async def test_impact_events_are_anonymous_and_attributed(client, db):
    events = [
        {"event_type": "poi_view", "poi_id": "e1", "session_id": "sessao-aaaa", "locale": "en-GB", "platform": "ios"},
        {"event_type": "audio_play", "poi_id": "e1", "session_id": "sessao-aaaa", "locale": "en-GB"},
        {"event_type": "poi_view", "poi_id": "e3", "session_id": "sessao-bbbb", "locale": "pt-PT"},
        {"event_type": "route_start", "route_id": "r1", "session_id": "sessao-cccc"},
        {"event_type": "qr_scan", "municipality": "Évora", "session_id": "sessao-dddd", "source": "qr"},
        {"event_type": "poi_view", "poi_id": "l1", "session_id": "sessao-eeee"},
    ]
    resp = await client.post("/api/impact/events", json={"events": events}, headers={"CF-IPCountry": "es"})
    assert resp.status_code == 202
    assert resp.json() == {"accepted": 6, "attributed": 6}
    stored = await db.impact_events.find_one({"poi_id": "e1"})
    assert stored["municipality_id"] == "evora"
    assert stored["country"] == "ES" and stored["origin_source"] == "geoip"
    assert "sessao-aaaa" not in str(stored) and "user_id" not in stored and "ip" not in stored
    route_event = await db.impact_events.find_one({"route_id": "r1"})
    assert route_event["municipality_id"] == "evora"


@pytest.mark.anyio
async def test_impact_event_validation(client):
    bad_type = {"events": [{"event_type": "hack", "session_id": "sessao-aaaa"}]}
    assert (await client.post("/api/impact/events", json=bad_type)).status_code == 422
    too_many = {"events": [{"event_type": "poi_view", "session_id": "sessao-aaaa"}] * 51}
    assert (await client.post("/api/impact/events", json=too_many)).status_code == 422


@pytest.mark.anyio
async def test_impact_dashboard_and_pdf_report(client):
    await _activate(client)
    events = [
        {"event_type": "poi_view", "poi_id": "e1", "session_id": "sessao-uk01", "locale": "en-GB"},
        {"event_type": "poi_view", "poi_id": "e1", "session_id": "sessao-pt01", "locale": "pt-PT"},
        {"event_type": "audio_play", "poi_id": "e1", "session_id": "sessao-pt01", "locale": "pt-PT"},
        {"event_type": "poi_view", "poi_id": "e2", "session_id": "sessao-xx01"},
        {"event_type": "route_start", "route_id": "r1", "session_id": "sessao-pt01", "locale": "pt-PT"},
        {"event_type": "poi_view", "poi_id": "l1", "session_id": "sessao-lx01", "locale": "pt-PT"},
        {"event_type": "route_start", "route_id": "t1", "session_id": "sessao-pt01", "locale": "pt-PT"},
        {"event_type": "route_start", "route_id": "t1", "session_id": "sessao-uk01", "locale": "en-GB"},
    ]
    await client.post("/api/impact/events", json={"events": events})

    impact = (await client.get("/api/municipal/me/impact")).json()
    totals = impact["totals"]
    assert totals["poi_views"] == 3 and totals["audio_plays"] == 1 and totals["route_starts"] == 3
    assert totals["unique_visitors"] == 3  # Lisboa não conta
    assert impact["top_pois"][0] == {"poi_id": "e1", "name": "Templo Romano", "views": 2,
                                     "audio_plays": 1, "interactions": 3}
    assert [r["name"] for r in impact["top_routes"]] == ["PR1 Ecopista de Évora", "Évora Romana"]
    nvi = impact["national_vs_international"]
    assert nvi == {"national_sessions": 1, "international_sessions": 1, "unknown_sessions": 1,
                   "international_pct": 50.0}
    assert sum(sum(v for k, v in d.items() if k != "date") for d in impact["daily"]) == 7

    period = NOW.strftime("%Y-%m")
    pdf = await client.get(f"/api/municipal/me/reports/{period}.pdf")
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")
    assert len(pdf.content) > 1500
    future = (NOW + timedelta(days=62)).strftime("%Y-%m")
    assert (await client.get(f"/api/municipal/me/reports/{future}.pdf")).status_code == 422
    assert (await client.get("/api/municipal/me/reports/2026-13.pdf")).status_code == 422


# ─── public profile ───────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_public_profile_lifecycle(client):
    profile = {"display_name": "Évora", "tagline": "Cidade-Museu", "brand_color": "#7A1F2B",
               "website": "https://www.cm-evora.pt", "featured_poi_ids": ["e3", "e1"]}
    assert (await client.put("/api/municipal/me/profile", json=profile)).status_code == 402
    await _activate(client)
    assert (await client.put("/api/municipal/me/profile",
                             json={**profile, "brand_color": "vermelho"})).status_code == 422
    assert (await client.put("/api/municipal/me/profile",
                             json={**profile, "website": "http://inseguro.pt"})).status_code == 422
    assert (await client.put("/api/municipal/me/profile",
                             json={**profile, "featured_poi_ids": ["l1"]})).status_code == 422
    assert (await client.put("/api/municipal/me/profile", json=profile)).status_code == 200

    client.state.tenant = _tenant(TenantRole.EDITOR)
    assert (await client.put("/api/municipal/me/profile", json=profile)).status_code == 403
    client.state.tenant = _tenant()

    public = (await client.get("/api/municipios/Évora")).json()
    assert public["profile"]["tagline"] == "Cidade-Museu"
    assert [p["id"] for p in public["featured_pois"]] == ["e3", "e1"]
    assert public["stats"]["pois"] == 3
    listing = (await client.get("/api/municipios")).json()
    assert listing["total"] == 1 and listing["municipalities"][0]["slug"] == "evora"

    await _activate(client, status="suspended")
    assert (await client.get("/api/municipios/evora")).status_code == 404


# ─── partner portal fixes ─────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_partner_portal_uses_real_identity(client, db):
    client.state.user_id = "u-orgA"
    reg = {"name": "Museu A", "type": "museu", "concelhos": ["Lisboa"],
           "contact_email": "a@museu.pt", "contact_name": "A"}
    assert (await client.post("/api/partner/register", json=reg)).status_code == 201
    client.state.user_id = "u-orgB"
    assert (await client.post("/api/partner/register", json={**reg, "name": "Museu B"})).status_code == 201
    org = await db.partner_orgs.find_one({"user_id": "u-orgB"})
    assert org is not None  # antes: tudo era "anon" e o 2.º registo dava 409

    # aprovar exige administrador
    assert (await client.patch(f"/api/partner/orgs/{org['org_id']}/approve",
                               json={"approved": True})).status_code == 403
    client.state.user_id = "admin-1"
    assert (await client.patch(f"/api/partner/orgs/{org['org_id']}/approve",
                               json={"approved": True})).status_code == 200


@pytest.mark.anyio
async def test_municipal_user_gets_implicit_org_and_can_publish(client, db):
    await db.users.insert_one({"user_id": "u-cm", "tenant_role": "municipio", "municipality_id": "evora"})
    await db.users.insert_one({"user_id": "u-viewer", "tenant_role": "viewer", "municipality_id": "evora"})
    client.state.user_id = "u-cm"
    body = (await client.get("/api/partner/pois")).json()
    assert {p["id"] for p in body["pois"]} == {"e1", "e2", "e3"}
    assert all(p["status"] == "published" for p in body["pois"])

    resp = await client.patch("/api/partner/pois/e2/draft", json={"status": "draft"})
    assert resp.status_code == 200
    assert (await db.heritage_items.find_one({"id": "e2"}))["is_published"] is False
    assert (await client.patch("/api/partner/pois/l1/draft", json={"status": "draft"})).status_code == 404

    client.state.user_id = "u-viewer"
    assert (await client.patch("/api/partner/pois/e1/draft", json={"status": "draft"})).status_code == 403
    assert (await client.delete("/api/partner/pois/e1")).status_code == 403

    client.state.user_id = "u-cm"
    assert (await client.delete("/api/partner/pois/e1")).status_code == 204
    archived = await db.heritage_items.find_one({"id": "e1"})
    assert archived["deleted_at"] is not None and archived["is_published"] is False
    remaining = (await client.get("/api/partner/pois")).json()
    assert {p["id"] for p in remaining["pois"]} == {"e2", "e3"}
    metrics = (await client.get("/api/partner/metrics")).json()
    assert metrics["total_pois"] == 3
