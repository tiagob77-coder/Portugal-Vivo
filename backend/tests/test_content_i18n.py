"""
AI narrative (/narrative) and depth content (/content/depth) in the UI
language: the LLM is asked to write in that language, the static fallback is
built from the translated sheet, and an untranslated sheet answers in
Portuguese instead of mixing languages (and is not cached under the other
language).
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

mongomock_motor = pytest.importorskip("mongomock_motor")

import content_strategy_api  # noqa: E402
import llm_client  # noqa: E402
import narrative_api  # noqa: E402
import premium_guard  # noqa: E402
from auth_api import require_auth  # noqa: E402
from models.api_models import User  # noqa: E402
from shared_utils import DatabaseHolder, language_from_header, normalize_language  # noqa: E402

USER = User(user_id="u-premium", email="ana@pv.pt", name="Ana", created_at=datetime.now(timezone.utc))

TEMPLE = {"id": "poi-1", "name": "Templo Romano", "category": "arqueologia", "region": "Alentejo",
          "description": "Templo romano do século I, um dos mais bem preservados da Península Ibérica."}
TEMPLE_EN = {"item_id": "poi-1", "language": "en", "name": "Roman Temple",
             "description": "First-century Roman temple, one of the best preserved in the Iberian Peninsula."}


@pytest_asyncio.fixture
async def db():
    database = mongomock_motor.AsyncMongoMockClient()["pv_content_i18n_test"]
    await database.heritage_items.insert_one(dict(TEMPLE))
    await database.poi_translations.insert_one(dict(TEMPLE_EN))
    await database.subscriptions.insert_one({"user_id": USER.user_id, "tier": "premium", "status": "active"})
    return database


@pytest.fixture
def llm(monkeypatch):
    """Records the prompts; returns `reply` (None = no LLM configured)."""
    state = {"reply": None, "calls": []}

    async def fake(prompt=None, *, messages=None, **kwargs):
        state["calls"].append(messages)
        return state["reply"]

    monkeypatch.setattr(narrative_api, "call_chat_completion", fake)
    monkeypatch.setattr(llm_client, "call_chat_completion", fake)
    return state


@pytest_asyncio.fixture
async def client(db, monkeypatch):
    for module, name in ((premium_guard, "premium_guard"), (narrative_api, "narrative"),
                         (content_strategy_api, "content_strategy")):
        holder = DatabaseHolder(name)
        holder.set(db)
        monkeypatch.setattr(module, "_db_holder", holder)
    monkeypatch.setattr(content_strategy_api, "_get_db", lambda: db)
    app = FastAPI()
    app.include_router(narrative_api.narrative_router, prefix="/api")
    app.include_router(content_strategy_api.content_strategy_router, prefix="/api")
    app.dependency_overrides[require_auth] = lambda: USER
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c


def test_language_helpers():
    assert normalize_language("en-GB") == "en"
    assert normalize_language("de") == "pt" and normalize_language(None) == "pt"
    assert language_from_header("de-DE,fr;q=0.8,en;q=0.5") == "fr"
    assert language_from_header("") is None


# ── /narrative ────────────────────────────────────────────────────────────────

async def test_narrative_asks_the_llm_for_the_ui_language(client, llm):
    llm["reply"] = "Two thousand years ago..."
    resp = await client.post("/api/narrative", json={"item_id": "poi-1", "style": "storytelling", "language": "en"})
    assert resp.status_code == 200
    assert resp.json()["language"] == "en" and resp.json()["narrative"] == "Two thousand years ago..."
    system = llm["calls"][0][0]["content"]
    assert "Write the whole narrative in English" in system and "Responde sempre em português" not in system


async def test_narrative_fallback_uses_the_translated_sheet_or_stays_portuguese(client, llm):
    english = (await client.post("/api/narrative", json={"item_id": "poi-1", "language": "en"})).json()
    assert english["language"] == "en"
    assert english["narrative"].startswith("Some stories time has kept safe in Roman Temple")
    assert "First-century Roman temple" in english["narrative"]

    french = (await client.post("/api/narrative", json={"item_id": "poi-1", "language": "fr"})).json()
    assert french["language"] == "pt"
    assert french["narrative"].startswith("Há histórias que o tempo guardou em Templo Romano")

    portuguese = (await client.post("/api/narrative", json={"item_id": "poi-1"})).json()
    assert portuguese["language"] == "pt"


# ── /content/depth ────────────────────────────────────────────────────────────

async def test_depth_content_is_written_and_cached_per_language(client, db, llm):
    llm["reply"] = "A temple that outlived an empire."
    resp = (await client.post("/api/content/depth", json={"poi_id": "poi-1", "depth": "historia", "language": "en"})).json()
    assert resp["language"] == "en" and resp["content"] == "A temple that outlived an empire."
    assert "Write in English" in llm["calls"][0][0]["content"]

    # Portuguese keeps its own cache entry (and its old key).
    llm["reply"] = "Um templo que sobreviveu a um império."
    pt = (await client.post("/api/content/depth", json={"poi_id": "poi-1", "depth": "historia"})).json()
    assert pt["content"].startswith("Um templo") and pt["language"] == "pt"
    assert await db.narrative_cache.count_documents({}) == 2
    assert content_strategy_api._cache_key("poi-1", "historia", None) == content_strategy_api._cache_key(
        "poi-1", "historia", None, "pt")

    cached = (await client.post("/api/content/depth", json={"poi_id": "poi-1", "depth": "historia", "language": "en"})).json()
    assert cached["source"] == "cache" and cached["content"] == "A temple that outlived an empire."


async def test_depth_fallback_reads_the_translation_and_never_caches_a_portuguese_stand_in(client, db, llm):
    english = (await client.post("/api/content/depth", json={"poi_id": "poi-1", "depth": "snackable", "language": "en"})).json()
    assert english["language"] == "en" and english["content"].startswith("Roman Temple — First-century")

    spanish = (await client.post("/api/content/depth", json={"poi_id": "poi-1", "depth": "snackable", "language": "es"})).json()
    assert spanish["language"] == "pt" and "Templo Romano" in spanish["content"]
    cached_languages = sorted(d["language"] for d in await db.narrative_cache.find({}).to_list(10))
    assert cached_languages == ["en"]
