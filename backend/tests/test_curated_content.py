"""
Curated sheet text (Resumo, História, Crianças, Enciclopédia written from
official sources): read in every shape an editor may use, served by
/content/depth without calling the LLM, in the UI language when translated,
and read by the audio guide.
"""
from __future__ import annotations

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI

mongomock_motor = pytest.importorskip("mongomock_motor")

import content_strategy_api  # noqa: E402
import llm_client  # noqa: E402
from curated_content import curated_field, curated_sources, curated_text, curated_texts, verified_at  # noqa: E402
from services import audio_guide_service as ags  # noqa: E402

BRITEIROS = {
    "id": "briteiros", "name": "Citânia de Briteiros", "category": "arqueologia", "region": "Norte",
    "description": "Povoado fortificado da Idade do Ferro.",
    "conteudo": {
        "resumo": "Um dos maiores povoados da Idade do Ferro do noroeste peninsular.",
        "historia": "A citânia foi escavada a partir de 1875 por Francisco Martins Sarmento.",
        "criancas": "Imagina uma aldeia de casas redondas de pedra no alto de um monte.",
        "enciclopedia": [{"eixo": "Origem", "texto": "Ocupação desde a Idade do Ferro."},
                         {"eixo": "Escavações", "texto": "Iniciadas em 1875 por Martins Sarmento."}],
        "fontes": [{"titulo": "Património Cultural, I.P.", "url": "https://example.pt/briteiros"},
                   "Sociedade Martins Sarmento"],
        "verificado_em": "2026-10-15",
    },
}
BRITEIROS_EN = {"item_id": "briteiros", "language": "en", "name": "Citânia de Briteiros",
                "historia": "The citânia was excavated from 1875 by Francisco Martins Sarmento."}
PLAIN = {"id": "plain", "name": "Fonte da Vila", "description": "Fonte setecentista no centro da vila."}


# ── Reader ────────────────────────────────────────────────────────────────────

def test_reads_the_conteudo_object_and_formats_the_research_axes():
    assert curated_text(BRITEIROS, "snackable").startswith("Um dos maiores")
    assert curated_text(BRITEIROS, "historia").startswith("A citânia")
    assert curated_text(BRITEIROS, "criancas").startswith("Imagina")
    assert curated_text(BRITEIROS, "enciclopedico") == (
        "Origem\nOcupação desde a Idade do Ferro.\n\nEscavações\nIniciadas em 1875 por Martins Sarmento.")
    assert curated_sources(BRITEIROS) == [
        {"titulo": "Património Cultural, I.P.", "url": "https://example.pt/briteiros"},
        {"titulo": "Sociedade Martins Sarmento"}]
    assert verified_at(BRITEIROS) == "2026-10-15"


def test_reads_top_level_accented_and_legacy_fields():
    sheet = {"História": "x", "história": "Texto da história.", "crianças": "Texto para crianças.",
             "enciclopédia": {"Origem": "Romana.", "Arquitetura": "Granito."},
             "content_depth": {"snackable": "Resumo antigo."}, "fontes": "https://example.pt/fonte"}
    assert curated_field(sheet, "historia") == "Texto da história."
    assert curated_field(sheet, "criancas") == "Texto para crianças."
    assert curated_field(sheet, "enciclopedia") == "Origem\nRomana.\n\nArquitetura\nGranito."
    assert curated_field(sheet, "resumo") == "Resumo antigo."
    assert curated_sources(sheet) == [{"titulo": "https://example.pt/fonte", "url": "https://example.pt/fonte"}]
    assert curated_texts(PLAIN) == {}


# ── /content/depth ────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def db():
    database = mongomock_motor.AsyncMongoMockClient()["pv_curated_test"]
    await database.heritage_items.insert_many([dict(BRITEIROS), dict(PLAIN)])
    await database.poi_translations.insert_one(dict(BRITEIROS_EN))
    return database


@pytest.fixture
def llm(monkeypatch):
    calls = []

    async def fake(prompt=None, *, messages=None, **kwargs):
        calls.append(messages)
        return "Texto gerado pela IA."

    monkeypatch.setattr(llm_client, "call_chat_completion", fake)
    return calls


@pytest_asyncio.fixture
async def client(db, monkeypatch):
    monkeypatch.setattr(content_strategy_api, "_get_db", lambda: db)
    app = FastAPI()
    app.include_router(content_strategy_api.content_strategy_router, prefix="/api")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c


async def _depth(client, poi, depth, language="pt"):
    resp = await client.post("/api/content/depth", json={"poi_id": poi, "depth": depth, "language": language})
    assert resp.status_code == 200
    return resp.json()


async def test_curated_text_is_served_without_calling_the_llm(client, db, llm):
    for depth, start in (("snackable", "Um dos maiores"), ("historia", "A citânia"),
                         ("criancas", "Imagina"), ("enciclopedico", "Origem\n")):
        body = await _depth(client, "briteiros", depth)
        assert body["content"].startswith(start)
        assert body["source"] == "editorial" and body["language"] == "pt"
        assert body["credibility"]["last_verified"] == "2026-10-15"
        assert body["sources"][0]["url"] == "https://example.pt/briteiros"
    assert llm == []
    assert await db.narrative_cache.count_documents({}) == 0


async def test_curated_text_follows_the_ui_language_when_translated(client, llm):
    english = await _depth(client, "briteiros", "historia", "en")
    assert english["content"].startswith("The citânia") and english["language"] == "en"

    # No French translation yet: the verified Portuguese text, never a generated one.
    french = await _depth(client, "briteiros", "historia", "fr")
    assert french["content"].startswith("A citânia") and french["language"] == "pt"
    assert llm == []


async def test_sheets_without_curated_text_keep_the_generated_path(client, llm):
    body = await _depth(client, "plain", "historia")
    assert body["content"] == "Texto gerado pela IA." and body["source"] == "llm"
    assert len(llm) == 1


# ── Audio guide ───────────────────────────────────────────────────────────────

async def test_audio_guide_reads_the_curated_historia(db):
    pt = await ags.localized_narration(db, dict(BRITEIROS), "pt")
    assert pt["text"].startswith("A citânia") and pt["language"] == "pt"
    en = await ags.localized_narration(db, dict(BRITEIROS), "en")
    assert en["text"].startswith("The citânia") and en["language"] == "en"
    plain = await ags.localized_narration(db, dict(PLAIN), "pt")
    assert plain["text"] == PLAIN["description"]
