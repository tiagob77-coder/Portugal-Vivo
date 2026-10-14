"""
Translation Service - AI-powered POI translation via the LLM client (llm_client).
Handles translation of heritage item content to multiple languages.
"""
import os
import json
import time
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a professional translator specializing in Portuguese cultural heritage "
    "and tourism. Translate the following content accurately, preserving cultural context, "
    "proper nouns, and local terminology. Keep place names in their original Portuguese form."
)

SUPPORTED_LANGUAGES = {"en", "es", "fr"}

# Simple rate limiter state
_rate_limit_lock = asyncio.Lock()
_rate_limit_calls = []
MAX_CALLS_PER_MINUTE = int(os.environ.get("TRANSLATION_RATE_LIMIT", "30"))


async def _check_rate_limit():
    """Enforce rate limiting on translation API calls."""
    async with _rate_limit_lock:
        now = time.time()
        # Remove calls older than 60s
        _rate_limit_calls[:] = [t for t in _rate_limit_calls if now - t < 60]
        if len(_rate_limit_calls) >= MAX_CALLS_PER_MINUTE:
            wait_time = 60 - (now - _rate_limit_calls[0])
            if wait_time > 0:
                logger.warning(f"Rate limit reached, waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)
        _rate_limit_calls.append(time.time())


TRANSLATABLE_FIELDS = ("name", "description", "tags", "address")

# One call translates a POI into every missing language; it gets a few tries
# before the POI is reported as failed (429s and timeouts are usually brief).
_BATCH_ATTEMPTS = 3
_BATCH_BACKOFF_SECONDS = (2, 6)


class TranslationUnavailable(RuntimeError):
    """The LLM call failed after retries (no key, quota, network)."""


def _source_fields(item: dict) -> Dict[str, Any]:
    return {
        "name": item.get("name") or "",
        "description": item.get("description") or "",
        "tags": [t for t in (item.get("tags") or []) if isinstance(t, str) and t.strip()],
        "address": item.get("address") or "",
    }


def _parse_batch(raw: str, source: Dict[str, Any], languages: List[str]) -> Dict[str, Dict[str, Any]]:
    """Keep the languages whose translation has the source's shape.

    A language that is missing, has a wrong type, drops a non-empty field or
    returns a different number of tags is left out, so the caller retries it
    field by field instead of storing a half translation.
    """
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    if not isinstance(data, dict):
        return {}

    parsed: Dict[str, Dict[str, Any]] = {}
    for lang in languages:
        t = data.get(lang)
        if not isinstance(t, dict):
            continue
        name, description = t.get("name"), t.get("description")
        address, tags = t.get("address", ""), t.get("tags", [])
        if not all(isinstance(v, str) for v in (name, description, address)):
            continue
        if not isinstance(tags, list) or not all(isinstance(v, str) for v in tags):
            continue
        if len(tags) != len(source["tags"]):
            continue
        if (source["name"] and not name.strip()) or (source["description"] and not description.strip()):
            continue
        parsed[lang] = {
            "name": name.strip(),
            "description": description.strip(),
            "tags": [v.strip() for v in tags],
            "address": address.strip() if source["address"] else "",
        }
    return parsed


class TranslationService:
    """Service for translating POI content via the LLM client (gpt-4o-mini) with MongoDB caching."""

    def __init__(self, db):
        self.db = db
        self.translations_col = db.poi_translations
        self.heritage_col = db.heritage_items

    async def translate_text(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate a single text string."""
        if not text or not text.strip():
            return text

        await _check_rate_limit()

        from llm_client import call_chat_completion
        prompt = (
            f"Translate the following text from {source_lang} to {target_lang}. "
            f"Return ONLY the translated text, no explanations.\n\n{text}"
        )
        translated = await call_chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            model="gpt-4o-mini",
        )
        if not translated:
            raise RuntimeError(f"Translation failed for text: {text[:50]}...")
        return translated.strip()

    async def translate_fields(self, item: dict, languages: List[str]) -> Dict[str, Dict[str, Any]]:
        """Translate name, description, tags and address into several languages in one call.

        Returns ``{lang: {name, description, tags, address}}`` for the
        languages the model got right; see ``_parse_batch`` for what is left
        out. Raises ``TranslationUnavailable`` when every attempt fails.
        """
        from llm_client import call_chat_completion

        source = _source_fields(item)
        prompt = (
            "Translate the values of this JSON object from European Portuguese into these "
            f"languages: {', '.join(languages)}.\n"
            "Return a JSON object keyed by language code. Each value has the same keys as the "
            "source: name, description and address (strings) and tags (a list with one "
            "translation per source tag, in the same order). Keep empty strings empty.\n\n"
            + json.dumps(source, ensure_ascii=False)
        )
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]

        for attempt in range(_BATCH_ATTEMPTS):
            await _check_rate_limit()
            raw = await call_chat_completion(
                messages=messages,
                model="gpt-4o-mini",
                temperature=0.2,
                response_format={"type": "json_object"},
                timeout=90.0,
            )
            if raw:
                return _parse_batch(raw, source, languages)
            if attempt < _BATCH_ATTEMPTS - 1:
                await asyncio.sleep(_BATCH_BACKOFF_SECONDS[attempt])
        raise TranslationUnavailable(f"LLM call failed for {item.get('id')}")

    async def _translate_one_language(self, item: dict, lang: str) -> Dict[str, Any]:
        """Field-by-field fallback for a language the batch call got wrong."""
        source = _source_fields(item)
        return {
            "name": await self.translate_text(source["name"], "pt", lang),
            "description": await self.translate_text(source["description"], "pt", lang),
            "tags": [await self.translate_text(tag, "pt", lang) for tag in source["tags"]],
            "address": await self.translate_text(source["address"], "pt", lang) if source["address"] else "",
        }

    async def _estimate_tokens(self, text: str) -> int:
        """Rough token estimation (4 chars per token approximation)."""
        return max(1, len(text) // 4)

    async def pending_languages(self, items: List[dict], languages: List[str]) -> Dict[str, List[str]]:
        """Map each item id to the languages that still need an AI translation.

        A language is up to date when its stored translation was made from the
        current source text. Manual translations are never overwritten.
        """
        langs = [lang for lang in languages if lang in SUPPORTED_LANGUAGES]
        ids = [item["id"] for item in items]
        existing: Dict[tuple, dict] = {}
        if ids and langs:
            async for doc in self.translations_col.find(
                {"item_id": {"$in": ids}, "language": {"$in": langs}},
                {"_id": 0, "item_id": 1, "language": 1, "source_hash": 1, "translation_source": 1},
            ):
                existing[(doc["item_id"], doc["language"])] = doc

        pending: Dict[str, List[str]] = {}
        for item in items:
            source_hash = self._content_hash(item)
            todo = []
            for lang in langs:
                doc = existing.get((item["id"], lang))
                if doc and (doc.get("translation_source") == "manual" or doc.get("source_hash") == source_hash):
                    continue
                todo.append(lang)
            pending[item["id"]] = todo
        return pending

    async def translate_item(self, item: dict, languages: List[str]) -> Dict[str, Any]:
        """Translate an already loaded POI into ``languages`` and store the result.

        ``languages`` should already exclude up-to-date ones (``pending_languages``).
        """
        item_id = item["id"]
        results: Dict[str, Any] = {}
        if not languages:
            return {"item_id": item_id, "results": results, "total_tokens_estimated": 0}

        source = _source_fields(item)
        all_source_text = " ".join([source["name"], source["description"], " ".join(source["tags"]), source["address"]])
        tokens_per_language = await self._estimate_tokens(all_source_text) * 2  # input + output
        source_hash = self._content_hash(item)

        try:
            batch = await self.translate_fields(item, languages)
        except TranslationUnavailable as e:
            logger.error(f"Translation failed for {item_id}: {e}")
            return {
                "item_id": item_id,
                "results": {lang: {"status": "error", "error": str(e)} for lang in languages},
                "total_tokens_estimated": 0,
            }

        total_tokens_estimated = 0
        for lang in languages:
            try:
                fields = batch.get(lang) or await self._translate_one_language(item, lang)
                translation_doc = {
                    "item_id": item_id,
                    "language": lang,
                    **fields,
                    "translated_at": datetime.now(timezone.utc),
                    "translation_source": "ai",
                    "quality_score": None,
                    "source_hash": source_hash,
                    "tokens_estimated": tokens_per_language,
                }
                await self.translations_col.update_one(
                    {"item_id": item_id, "language": lang},
                    {"$set": translation_doc},
                    upsert=True,
                )
                total_tokens_estimated += tokens_per_language
                results[lang] = {"status": "translated", "tokens_estimated": tokens_per_language}
            except Exception as e:
                logger.error(f"Translation failed for {item_id}/{lang}: {e}")
                results[lang] = {"status": "error", "error": str(e)}

        return {
            "item_id": item_id,
            "results": results,
            "total_tokens_estimated": total_tokens_estimated,
        }

    async def translate_poi(self, item_id: str, target_languages: List[str]) -> Dict[str, Any]:
        """
        Translate a full POI to specified target languages.
        Returns dict with translation results per language.
        """
        item = await self.heritage_col.find_one({"id": item_id}, {"_id": 0})
        if not item:
            return {"error": "Item not found", "item_id": item_id}

        todo = (await self.pending_languages([item], target_languages))[item_id]
        result = await self.translate_item(item, todo)
        for lang in target_languages:
            if lang not in SUPPORTED_LANGUAGES:
                result["results"][lang] = {"status": "skipped", "reason": f"Unsupported language: {lang}"}
            elif lang not in todo:
                result["results"][lang] = {"status": "cached"}
        return result

    async def batch_translate(
        self,
        languages: List[str],
        limit: int = 50,
        offset: int = 0,
        category_filter: Optional[str] = None,
        region_filter: Optional[str] = None,
        dry_run: bool = False,
        concurrency: int = 4,
    ) -> Dict[str, Any]:
        """
        Batch translate multiple POIs.
        Returns stats about translations performed.
        """
        query: Dict[str, Any] = {}
        if category_filter:
            query["category"] = category_filter
        if region_filter:
            query["region"] = region_filter

        projection = {"_id": 0, "id": 1, **{field: 1 for field in TRANSLATABLE_FIELDS}}
        items = await self.heritage_col.find(query, projection).sort("id", 1).skip(offset).limit(limit).to_list(limit)
        pending = await self.pending_languages(items, languages)
        to_translate = [item for item in items if pending[item["id"]]]

        if dry_run:
            return {
                "dry_run": True,
                "items_found": len(items),
                "items_to_translate": len(to_translate),
                "translations_missing": sum(len(v) for v in pending.values()),
                "languages": languages,
                "estimated_api_calls": len(to_translate),  # one call per POI covers every language
            }

        stats = {
            "total_items": len(items),
            "translated": 0,
            "cached": sum(len(languages) - len(pending[item["id"]]) for item in items),
            "errors": 0,
            "total_tokens_estimated": 0,
        }

        semaphore = asyncio.Semaphore(max(1, concurrency))

        async def run(item: dict) -> Dict[str, Any]:
            async with semaphore:
                return await self.translate_item(item, pending[item["id"]])

        for result in await asyncio.gather(*(run(item) for item in to_translate)):
            for lang_result in result.get("results", {}).values():
                status = lang_result.get("status")
                if status == "translated":
                    stats["translated"] += 1
                elif status == "error":
                    stats["errors"] += 1
            stats["total_tokens_estimated"] += result.get("total_tokens_estimated", 0)

        return stats

    @staticmethod
    def _content_hash(item: dict) -> str:
        """Create a simple hash of translatable content to detect changes."""
        import hashlib
        content = json.dumps({
            "name": item.get("name", ""),
            "description": item.get("description", ""),
            "tags": item.get("tags", []),
            "address": item.get("address", ""),
        }, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(content.encode()).hexdigest()
