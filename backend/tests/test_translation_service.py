"""
POI sheet translation: one LLM call per POI for every missing language,
field-by-field fallback, cache by source hash, manual translations kept,
and the scripts/translate_pois.py batch runner.
"""
from __future__ import annotations

import json
import re

import pytest
import pytest_asyncio

mongomock_motor = pytest.importorskip("mongomock_motor")

import llm_client  # noqa: E402
from services import translation_service as ts  # noqa: E402
from scripts import translate_pois  # noqa: E402

POIS = [
    {"id": "poi-1", "name": "Mosteiro da Batalha", "description": "Obra-prima do gótico.",
     "tags": ["gótico", "UNESCO"], "address": "Largo Infante Dom Henrique", "category": "religioso"},
    {"id": "poi-2", "name": "Praia da Ursa", "description": "Praia selvagem junto ao Cabo da Roca.",
     "tags": [], "address": "", "category": "praias"},
    {"id": "poi-3", "name": "Aldeia do Piódão", "description": "Aldeia de xisto.",
     "tags": ["xisto"], "category": "aldeias"},
]


class FakeLLM:
    """Answers like gpt-4o-mini would: '[lang] text' for every field."""

    def __init__(self):
        self.calls = []
        self.drop_tag_for = set()  # languages answered with a wrong tag count
        self.blank_address_for = set()  # languages answered without the address
        self.fail = False

    async def __call__(self, prompt=None, *, messages=None, response_format=None, **kwargs):
        user = messages[-1]["content"]
        self.calls.append("batch" if response_format else "field")
        if self.fail:
            return None
        if response_format:
            langs = re.search(r"languages: ([a-z, ]+)\.", user).group(1).split(", ")
            source = json.loads(user.split("\n\n", 1)[1])
            out = {}
            for lang in langs:
                tags = [f"[{lang}] {t}" for t in source["tags"]]
                if lang in self.drop_tag_for:
                    tags = tags[:-1] if tags else ["extra"]
                out[lang] = {
                    "name": f"[{lang}] {source['name']}",
                    "description": f"[{lang}] {source['description']}",
                    "tags": tags,
                    "address": f"[{lang}] {source['address']}" if source["address"] else "",
                }
                if lang in self.blank_address_for:
                    out[lang]["address"] = ""
            return json.dumps(out, ensure_ascii=False)
        lang = re.search(r"to ([a-z]{2})\.", user).group(1)
        return f"[{lang}] " + user.split("\n\n", 1)[1]


@pytest_asyncio.fixture
async def db():
    database = mongomock_motor.AsyncMongoMockClient()["pv_translation_test"]
    await database.heritage_items.insert_many([dict(p) for p in POIS])
    return database


@pytest.fixture
def llm(monkeypatch):
    fake = FakeLLM()
    monkeypatch.setattr(llm_client, "call_chat_completion", fake)
    monkeypatch.setattr(llm_client, "is_configured", lambda: True)
    monkeypatch.setattr(ts, "MAX_CALLS_PER_MINUTE", 10_000)
    monkeypatch.setattr(ts, "_BATCH_BACKOFF_SECONDS", (0, 0))
    return fake


async def _translation(db, item_id, lang):
    return await db.poi_translations.find_one({"item_id": item_id, "language": lang}, {"_id": 0})


async def test_one_call_translates_every_language_and_the_rerun_is_cached(db, llm):
    service = ts.TranslationService(db)
    result = await service.translate_poi("poi-1", ["en", "es", "fr"])

    assert llm.calls == ["batch"]
    assert {lang: r["status"] for lang, r in result["results"].items()} == {
        "en": "translated", "es": "translated", "fr": "translated"}
    fr = await _translation(db, "poi-1", "fr")
    assert fr["name"] == "[fr] Mosteiro da Batalha"
    assert fr["tags"] == ["[fr] gótico", "[fr] UNESCO"]
    assert fr["address"] == "[fr] Largo Infante Dom Henrique"
    assert fr["translation_source"] == "ai"

    again = await service.translate_poi("poi-1", ["en", "es", "fr", "de"])
    assert llm.calls == ["batch"]
    assert again["results"]["en"]["status"] == "cached"
    assert again["results"]["de"]["status"] == "skipped"


async def test_a_language_with_the_wrong_shape_falls_back_to_field_by_field(db, llm):
    llm.drop_tag_for = {"es"}
    result = await ts.TranslationService(db).translate_poi("poi-1", ["en", "es"])

    assert result["results"]["es"]["status"] == "translated"
    # name, description, two tags, address — only for Spanish
    assert llm.calls == ["batch"] + ["field"] * 5
    es = await _translation(db, "poi-1", "es")
    assert es["tags"] == ["[es] gótico", "[es] UNESCO"]
    assert (await _translation(db, "poi-1", "en"))["tags"] == ["[en] gótico", "[en] UNESCO"]


async def test_a_dropped_address_falls_back_instead_of_being_cached(db, llm):
    llm.blank_address_for = {"fr"}
    await ts.TranslationService(db).translate_poi("poi-1", ["fr"])

    assert llm.calls == ["batch"] + ["field"] * 5
    assert (await _translation(db, "poi-1", "fr"))["address"] == "[fr] Largo Infante Dom Henrique"


async def test_an_unavailable_llm_is_retried_then_reported_without_storing(db, llm):
    llm.fail = True
    result = await ts.TranslationService(db).translate_poi("poi-2", ["en", "fr"])

    assert llm.calls == ["batch"] * 3
    assert {r["status"] for r in result["results"].values()} == {"error"}
    assert await db.poi_translations.count_documents({}) == 0


async def test_changed_source_is_retranslated_but_manual_translations_are_kept(db, llm):
    service = ts.TranslationService(db)
    await service.translate_poi("poi-3", ["en", "fr"])
    await db.poi_translations.update_one(
        {"item_id": "poi-3", "language": "fr"},
        {"$set": {"name": "Village de Piódão", "translation_source": "manual"}})
    await db.heritage_items.update_one({"id": "poi-3"}, {"$set": {"description": "Aldeia histórica de xisto."}})

    result = await service.translate_poi("poi-3", ["en", "fr"])

    assert result["results"]["en"]["status"] == "translated"
    assert result["results"]["fr"]["status"] == "cached"
    assert (await _translation(db, "poi-3", "en"))["description"] == "[en] Aldeia histórica de xisto."
    assert (await _translation(db, "poi-3", "fr"))["name"] == "Village de Piódão"


async def test_batch_translate_dry_run_and_run(db, llm):
    service = ts.TranslationService(db)
    await service.translate_poi("poi-1", ["en"])
    llm.calls.clear()

    dry = await service.batch_translate(["en", "es"], limit=10, dry_run=True)
    assert dry["items_to_translate"] == 3
    assert dry["translations_missing"] == 5
    assert dry["estimated_api_calls"] == 3
    assert llm.calls == []

    stats = await service.batch_translate(["en", "es"], limit=10)
    assert stats == {"total_items": 3, "translated": 5, "cached": 1, "errors": 0,
                     "total_tokens_estimated": stats["total_tokens_estimated"]}
    assert llm.calls == ["batch"] * 3


@pytest.fixture
def script_env(db, monkeypatch):
    monkeypatch.setenv("MONGO_URL", "mongodb://mock")
    monkeypatch.setenv("DB_NAME", "pv_translation_test")
    monkeypatch.setattr(translate_pois, "AsyncIOMotorClient", lambda *a, **k: db.client)
    monkeypatch.setattr(translate_pois, "CHUNK_SIZE", 2)
    return db


async def test_script_translates_the_whole_catalogue_across_chunks(script_env, llm, capsys):
    code = await translate_pois.run(translate_pois._parse_args(["--languages", "en", "fr"]))

    assert code == 0
    assert llm.calls == ["batch"] * 3
    assert await script_env.poi_translations.count_documents({}) == 6
    out = capsys.readouterr().out
    report = json.loads(out[out.index("\n{") + 1:])
    assert report["stats"]["outcome"] == "completed"
    assert report["stats"]["pois_checked"] == 3
    assert report["stats"]["translated"] == 6
    assert report["coverage"]["fr"] == {"translated": 3, "total": 3, "pct": 100.0}

    # Second run: nothing left to do.
    llm.calls.clear()
    assert await translate_pois.run(translate_pois._parse_args(["--languages", "en", "fr"])) == 0
    assert llm.calls == []


async def test_script_dry_run_limit_and_abort(script_env, llm, monkeypatch):
    assert await translate_pois.run(translate_pois._parse_args(["--dry-run"])) == 0
    assert llm.calls == []

    assert await translate_pois.run(translate_pois._parse_args(["--languages", "en", "--limit", "2"])) == 0
    assert await script_env.poi_translations.count_documents({}) == 2

    llm.fail = True
    monkeypatch.setattr(translate_pois, "MIN_FAILED_TO_ABORT", 1)
    assert await translate_pois.run(translate_pois._parse_args(["--languages", "es"])) == 1


async def test_script_refuses_to_run_without_an_llm_key(script_env, monkeypatch):
    monkeypatch.setattr(llm_client, "is_configured", lambda: False)
    assert await translate_pois.run(translate_pois._parse_args([])) == 2
