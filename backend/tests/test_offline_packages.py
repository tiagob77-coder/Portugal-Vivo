"""
Pacotes offline de região — conteúdo real.

O pacote tem de trazer os POIs da coleção que o resto da API usa
(`heritage_items`). Durante meses lia de `heritage`, que não existe, e os
pacotes saíam vazios sem erro nenhum.
"""
import json

import mongomock_motor
import pytest
import pytest_asyncio

import offline_api

NORTE_POI = {
    "id": "poi-norte-1", "name": "Mosteiro de Tibães", "category": "religioso",
    "region": "norte", "location": {"lat": 41.556, "lng": -8.478},
    "description": "Mosteiro beneditino.", "audio_guide": "pesado",
    "updated_at": "2026-10-01T10:00:00+00:00",
}
LISBOA_POI = {
    "id": "poi-lisboa-1", "name": "Torre de Belém", "category": "monumentos",
    "region": "lisboa", "location": {"lat": 38.691, "lng": -9.216},
    "description": "Torre manuelina.",
}


@pytest_asyncio.fixture
async def db():
    database = mongomock_motor.AsyncMongoMockClient()["pv_offline_packages_test"]
    await database.heritage_items.insert_many([dict(NORTE_POI), dict(LISBOA_POI)])
    await database.routes.insert_one({"id": "rota-1", "name": "Rota do Românico", "region": "norte", "items": ["poi-norte-1"]})
    await database.categories.insert_one({"id": "religioso", "name": "Religioso"})
    offline_api.set_offline_db(database)
    return database


async def _package(region: str) -> dict:
    response = await offline_api.download_region_package(region)
    return json.loads(response.body)


@pytest.mark.asyncio
async def test_package_includes_the_region_pois(db):
    pkg = await _package("norte")

    assert [p["id"] for p in pkg["heritage_items"]] == ["poi-norte-1"]
    assert pkg["counts"]["heritage_items"] == 1
    assert [r["id"] for r in pkg["routes"]] == ["rota-1"]


@pytest.mark.asyncio
async def test_package_drops_heavy_fields(db):
    pkg = await _package("norte")

    assert "audio_guide" not in pkg["heritage_items"][0]
    assert pkg["heritage_items"][0]["name"] == "Mosteiro de Tibães"


@pytest.mark.asyncio
async def test_region_stats_count_the_real_collection(db):
    stats = await offline_api._get_region_stats(db, "norte")

    assert stats["poi_count"] == 1
    assert stats["last_updated"] == "2026-10-01T10:00:00+00:00"


@pytest.mark.asyncio
async def test_version_hash_changes_when_pois_change(db):
    before = (await _package("norte"))["version_hash"]
    await db.heritage_items.insert_one({"id": "poi-norte-2", "name": "Bom Jesus", "region": "norte"})
    after = (await _package("norte"))["version_hash"]

    assert before != after
