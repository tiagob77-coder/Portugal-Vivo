"""
Audio guide in the user's language: translated POI sheet text, greeting per
language, accent guidance sent as TTS `instructions` (never read out loud),
Portuguese fallback while a sheet has no translation, and the Partner API
`?lang=` parameter.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

mongomock_motor = pytest.importorskip("mongomock_motor")

import premium_guard  # noqa: E402
from api_keys_api import api_keys_admin_router  # noqa: E402
from audio_guide_api import router as audio_router  # noqa: E402
from auth_api import require_admin, require_auth  # noqa: E402
from dependencies import get_db  # noqa: E402
from models.api_models import User  # noqa: E402
from partner_api_v1 import partner_api_v1_router  # noqa: E402
from services import audio_guide_service as ags  # noqa: E402
from shared_utils import DatabaseHolder  # noqa: E402

USER = User(user_id="u-premium", email="ana@pv.pt", name="Ana", created_at=datetime.now(timezone.utc))

TEMPLE = {
    "id": "poi-1", "name": "Templo Romano", "category": "arqueologia",
    "ai_narrative": "Há dois mil anos, este templo dominava o fórum de Ebora Liberalitas Julia.",
    "description": "Templo romano do século I, um dos mais bem preservados da Península Ibérica.",
}
TRANSLATIONS = [
    {"item_id": "poi-1", "language": "en", "name": "Roman Temple",
     "description": "First-century Roman temple, one of the best preserved in the Iberian Peninsula."},
    {"item_id": "poi-1", "language": "fr", "name": "Temple romain",
     "description": "Temple romain du Ier siècle, l'un des mieux conservés de la péninsule Ibérique."},
    {"item_id": "poi-1", "language": "es", "name": "Templo romano", "description": "Corto."},
]


@pytest_asyncio.fixture
async def db():
    database = mongomock_motor.AsyncMongoMockClient()["pv_audio_i18n_test"]
    await database.heritage_items.insert_many([dict(TEMPLE), {"id": "poi-empty", "name": "Fonte"}])
    await database.poi_translations.insert_many([dict(t) for t in TRANSLATIONS])
    await database.subscriptions.insert_one({"user_id": USER.user_id, "tier": "premium", "status": "active"})
    return database


@pytest.fixture
def device_only(monkeypatch):
    """No remote TTS: the endpoint answers with the text to read on the device."""
    monkeypatch.setattr(ags.audio_guide_service, "provider", None)


@pytest_asyncio.fixture
async def client(db, monkeypatch):
    holder = DatabaseHolder("premium_guard")
    holder.set(db)
    monkeypatch.setattr(premium_guard, "_db_holder", holder)
    app = FastAPI()
    for router in (audio_router, api_keys_admin_router, partner_api_v1_router):
        app.include_router(router, prefix="/api")
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[require_auth] = lambda: USER
    app.dependency_overrides[require_admin] = lambda: USER
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c


# ── Text preparation ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("lang, greeting", [
    ("pt", "Bem-vindo a Sé. "), ("en", "Welcome to Sé. "),
    ("es", "Bienvenido a Sé. "), ("fr", "Bienvenue à Sé. "), ("de", "Bem-vindo a Sé. "),
])
def test_greeting_follows_the_language_and_no_engine_hint_is_spoken(lang, greeting):
    service = ags.AudioGuideService()
    text = service._prepare_text_for_tts("Catedral do século XII.", "Sé", lang)
    assert text == greeting + "Catedral do século XII."
    assert "[" not in text and "sotaque" not in text


def test_long_narration_is_cut_with_a_closing_line_in_the_same_language():
    text = ags.AudioGuideService()._prepare_text_for_tts("palavra " * 1000, "Sé", "fr")
    assert len(text) <= 4000
    assert text.endswith("Continuez à explorer pour en découvrir davantage.")


# ── OpenAI request ────────────────────────────────────────────────────────────

@pytest.fixture
def openai_service(monkeypatch, tmp_path):
    monkeypatch.setenv("AUDIO_CACHE_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    requests = []
    real_client = httpx.AsyncClient

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(json.loads(request.content))
        return httpx.Response(200, content=b"ID3-fake-mp3")

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler)))
    return ags.AudioGuideService(), requests


async def test_openai_gets_the_accent_as_instructions_not_in_the_text(openai_service):
    service, requests = openai_service
    result = await service.generate_audio_guide(
        text="Templo romano do século I.", poi_name="Templo Romano", poi_id="poi-1",
        language="pt", speed="slow")

    assert result["success"] and result["language"] == "pt" and result["model"] == "gpt-4o-mini-tts"
    sent = requests[0]
    assert sent["model"] == "gpt-4o-mini-tts"
    assert sent["input"] == "Bem-vindo a Templo Romano. Templo romano do século I."
    assert "European Portuguese" in sent["instructions"] and "slower" in sent["instructions"]

    english = await service.generate_audio_guide(
        text="First-century Roman temple.", poi_name="Roman Temple", poi_id="poi-1", language="en")
    assert english["cached"] is False
    assert requests[1]["input"].startswith("Welcome to Roman Temple.")
    assert "English" in requests[1]["instructions"]


async def test_hd_and_the_emergent_proxy_keep_tts1_without_instructions(openai_service):
    service, requests = openai_service
    await service.generate_audio_guide(
        text="Templo romano do século I.", poi_name="Templo Romano", poi_id="poi-1", use_hd=True)
    assert requests[0]["model"] == "tts-1-hd" and "instructions" not in requests[0]

    service.provider = "emergent"
    assert service._select_model(use_hd=False) == "tts-1"


# ── Which text is narrated ────────────────────────────────────────────────────

async def test_narration_uses_the_translated_sheet_and_falls_back_to_portuguese(db):
    item = dict(TEMPLE)
    english = await ags.localized_narration(db, item, "en-GB")
    assert english == {"text": TRANSLATIONS[0]["description"], "name": "Roman Temple", "language": "en"}

    # Spanish translation too short to narrate → Portuguese AI narrative.
    spanish = await ags.localized_narration(db, item, "es")
    assert spanish == {"text": TEMPLE["ai_narrative"], "name": "Templo Romano", "language": "pt"}

    assert (await ags.localized_narration(db, item, None))["language"] == "pt"


# ── Endpoints ─────────────────────────────────────────────────────────────────

async def test_app_endpoint_follows_lang_then_accept_language(client, device_only):
    english = (await client.get("/api/audio/guide/poi-1", params={"lang": "en"})).json()
    assert english["language"] == "en"
    assert english["text"].startswith("Welcome to Roman Temple. First-century Roman temple")

    french = (await client.get("/api/audio/guide/poi-1", headers={"Accept-Language": "fr-FR,fr;q=0.9"})).json()
    assert french["language"] == "fr"
    assert french["text"].startswith("Bienvenue à Temple romain. Temple romain du Ier siècle")

    spanish = (await client.get("/api/audio/guide/poi-1", params={"lang": "es"})).json()
    assert spanish["language"] == "pt"
    assert spanish["text"].startswith("Bem-vindo a Templo Romano. Há dois mil anos")

    empty = (await client.get("/api/audio/guide/poi-empty", params={"lang": "en"})).json()
    assert empty["success"] is False and empty["audio_available"] is False


async def test_partner_api_audio_takes_a_language(client, device_only):
    created = await client.post("/api/admin/api-keys", json={"name": "Teste", "org_name": "Agência X", "plan": "pro"})
    headers = {"X-API-Key": created.json()["api_key"]}

    resp = await client.get("/api/v1/audio/poi-1", params={"lang": "en"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["language"] == "en"
    assert resp.json()["data"]["text"].startswith("Welcome to Roman Temple.")

    assert (await client.get("/api/v1/audio/poi-1", params={"lang": "de"}, headers=headers)).status_code == 422
