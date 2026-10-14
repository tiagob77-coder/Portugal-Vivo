"""
POIs unpublished or archived through the partner portal must disappear from
the public read paths (listings, detail, search); POIs without the field (the
national dataset) stay visible. The owning municipality and admins can still
open an unpublished POI's detail to preview it.
"""
from __future__ import annotations

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

mongomock_motor = pytest.importorskip("mongomock_motor")

import heritage_api  # noqa: E402
import search_api  # noqa: E402
import translation_api  # noqa: E402
from models.api_models import User  # noqa: E402

LOC = {"lat": 38.57, "lng": -7.91}


@pytest_asyncio.fixture
async def client(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["pv_heritage_published_test"]
    await db.heritage_items.insert_many([
        {"id": "visible", "name": "Templo Romano", "description": "d", "category": "arqueologia",
         "region": "alentejo", "location": LOC},
        {"id": "published", "name": "Capela", "description": "d", "category": "museus",
         "region": "alentejo", "location": LOC, "is_published": True},
        {"id": "hidden", "name": "Rascunho", "description": "d", "category": "museus",
         "region": "alentejo", "location": LOC, "is_published": False, "concelho": "Évora"},
    ])
    await db.users.insert_many([
        {"user_id": "u-evora", "municipality_id": "evora", "tenant_role": "editor"},
        {"user_id": "u-lisboa", "municipality_id": "lisboa", "tenant_role": "municipio"},
        {"user_id": "u-admin", "role": "admin"},
    ])
    for module in (heritage_api, search_api, translation_api):
        holder = heritage_api.DatabaseHolder(f"{module.__name__}-test")
        holder.set(db)
        monkeypatch.setattr(module, "_db_holder", holder)
    current = {"user": None}

    async def _current_user(request):
        return current["user"]

    monkeypatch.setattr(heritage_api, "get_current_user", _current_user)
    app = FastAPI()
    app.include_router(heritage_api.heritage_router, prefix="/api")
    app.include_router(search_api.search_router, prefix="/api")
    app.include_router(translation_api.translation_router, prefix="/api")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        c.current = current
        yield c


def _user(user_id):
    return User(user_id=user_id, email=f"{user_id}@x.pt", name=user_id, created_at="2026-10-01T00:00:00Z")


@pytest.mark.anyio
async def test_heritage_list_hides_unpublished(client):
    resp = await client.get("/api/heritage")
    assert resp.status_code == 200
    assert {i["id"] for i in resp.json()} == {"visible", "published"}


@pytest.mark.anyio
async def test_map_items_hide_unpublished(client):
    resp = await client.get("/api/map/items")
    assert resp.status_code == 200
    assert {i["id"] for i in resp.json()} == {"visible", "published"}


@pytest.mark.anyio
async def test_category_and_region_hide_unpublished(client):
    assert {i["id"] for i in (await client.get("/api/heritage/category/museus")).json()} == {"published"}
    assert {i["id"] for i in (await client.get("/api/heritage/region/alentejo")).json()} == {"visible", "published"}


@pytest.mark.anyio
async def test_detail_hides_unpublished_except_for_owner_and_admin(client):
    assert (await client.get("/api/heritage/published")).status_code == 200
    assert (await client.get("/api/heritage/hidden")).status_code == 404
    client.current["user"] = _user("u-lisboa")
    assert (await client.get("/api/heritage/hidden")).status_code == 404
    client.current["user"] = _user("u-evora")
    assert (await client.get("/api/heritage/hidden")).status_code == 200
    client.current["user"] = _user("u-admin")
    assert (await client.get("/api/heritage/hidden")).status_code == 200


@pytest.mark.anyio
async def test_localized_detail_follows_the_same_rule(client):
    assert (await client.get("/api/heritage/published/localized", params={"lang": "en"})).status_code == 200
    assert (await client.get("/api/heritage/hidden/localized", params={"lang": "en"})).status_code == 404
    client.current["user"] = _user("u-evora")
    assert (await client.get("/api/heritage/hidden/localized", params={"lang": "en"})).status_code == 200


@pytest.mark.anyio
async def test_search_hides_unpublished(client):
    suggestions = (await client.get("/api/search/suggestions", params={"q": "Ra"})).json()["suggestions"]
    assert not [s for s in suggestions if s.get("id") == "hidden"]
    results = (await client.get("/api/search/global", params={"q": "Ra"})).json()["results"]
    assert not [r for r in results if r["id"] == "hidden"]
    body = (await client.post("/api/search", json={"query": "Ra"})).json()
    assert body["total"] == 0
    found = (await client.post("/api/search", json={"query": "Ca"})).json()  # "Capela" stays searchable
    assert found["total"] == 1
