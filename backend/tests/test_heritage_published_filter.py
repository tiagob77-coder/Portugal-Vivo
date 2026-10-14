"""
POIs unpublished or archived through the partner portal must disappear from
the public listings (/heritage, /map/items); POIs without the field (the
national dataset) stay visible.
"""
from __future__ import annotations

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

mongomock_motor = pytest.importorskip("mongomock_motor")

import heritage_api  # noqa: E402

LOC = {"lat": 38.57, "lng": -7.91}


@pytest_asyncio.fixture
async def client(monkeypatch):
    db = mongomock_motor.AsyncMongoMockClient()["pv_heritage_published_test"]
    await db.heritage_items.insert_many([
        {"id": "visible", "name": "Templo Romano", "description": "d", "category": "arqueologia",
         "region": "alentejo", "location": LOC},
        {"id": "published", "name": "Capela", "description": "d", "category": "religioso",
         "region": "alentejo", "location": LOC, "is_published": True},
        {"id": "hidden", "name": "Rascunho", "description": "d", "category": "religioso",
         "region": "alentejo", "location": LOC, "is_published": False},
    ])
    holder = heritage_api.DatabaseHolder("heritage-test")
    holder.set(db)
    monkeypatch.setattr(heritage_api, "_db_holder", holder)
    app = FastAPI()
    app.include_router(heritage_api.heritage_router, prefix="/api")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c


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
