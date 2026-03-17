"""
Translation Service - AI-powered POI translation using LiteLLM.
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

TRANSLATION_MODEL = os.environ.get("TRANSLATION_MODEL", "gpt-4o-mini")

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


class TranslationService:
    """Service for translating POI content using LiteLLM with MongoDB caching."""

    def __init__(self, db):
        self.db = db
        self.translations_col = db.poi_translations
        self.heritage_col = db.heritage_items

    async def translate_text(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate a single text string using LiteLLM."""
        if not text or not text.strip():
            return text

        await _check_rate_limit()

        try:
            import litellm
            response = await litellm.acompletion(
                model=TRANSLATION_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            f"Translate the following text from {source_lang} to {target_lang}. "
                            f"Return ONLY the translated text, no explanations.\n\n{text}"
                        ),
                    },
                ],
                temperature=0.2,
                max_tokens=2000,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"LiteLLM translation failed: {e}")
            # Fallback: try emergentintegrations
            return await self._fallback_translate(text, source_lang, target_lang)

    async def _fallback_translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """Fallback translation using emergentintegrations if available."""
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            llm_key = os.environ.get("EMERGENT_LLM_KEY", "")
            if not llm_key:
                raise ValueError("No EMERGENT_LLM_KEY configured for fallback")

            chat = LlmChat(api_key=llm_key)
            prompt = (
                f"{SYSTEM_PROMPT}\n\n"
                f"Translate the following text from {source_lang} to {target_lang}. "
                f"Return ONLY the translated text, no explanations.\n\n{text}"
            )
            response = await chat.send_message_async(UserMessage(content=prompt))
            return response.content.strip()
        except Exception as fallback_err:
            logger.error(f"Fallback translation also failed: {fallback_err}")
            raise RuntimeError(f"All translation methods failed for text: {text[:50]}...")

    async def _estimate_tokens(self, text: str) -> int:
        """Rough token estimation (4 chars per token approximation)."""
        return max(1, len(text) // 4)

    async def translate_poi(self, item_id: str, target_languages: List[str]) -> Dict[str, Any]:
        """
        Translate a full POI to specified target languages.
        Returns dict with translation results per language.
        """
        # Fetch the source POI
        item = await self.heritage_col.find_one({"id": item_id}, {"_id": 0})
        if not item:
            return {"error": "Item not found", "item_id": item_id}

        results = {}
        total_tokens_estimated = 0

        for lang in target_languages:
            if lang not in SUPPORTED_LANGUAGES:
                results[lang] = {"status": "skipped", "reason": f"Unsupported language: {lang}"}
                continue

            # Check if a cached translation exists and source hasn't changed
            existing = await self.translations_col.find_one(
                {"item_id": item_id, "language": lang}
            )
            if existing:
                # Check if source content has changed by comparing key fields
                source_hash = self._content_hash(item)
                if existing.get("source_hash") == source_hash:
                    results[lang] = {
                        "status": "cached",
                        "translated_at": str(existing.get("translated_at", "")),
                    }
                    continue

            # Translate each field
            try:
                translated_name = await self.translate_text(
                    item.get("name", ""), "pt", lang
                )
                translated_description = await self.translate_text(
                    item.get("description", ""), "pt", lang
                )
                translated_tags = []
                for tag in (item.get("tags") or []):
                    translated_tags.append(await self.translate_text(tag, "pt", lang))

                translated_address = ""
                if item.get("address"):
                    translated_address = await self.translate_text(
                        item["address"], "pt", lang
                    )

                # Estimate tokens used
                all_source_text = " ".join([
                    item.get("name", ""),
                    item.get("description", ""),
                    " ".join(item.get("tags") or []),
                    item.get("address", ""),
                ])
                tokens_est = await self._estimate_tokens(all_source_text) * 2  # input + output

                translation_doc = {
                    "item_id": item_id,
                    "language": lang,
                    "name": translated_name,
                    "description": translated_description,
                    "tags": translated_tags,
                    "address": translated_address,
                    "translated_at": datetime.now(timezone.utc),
                    "translation_source": "ai",
                    "quality_score": None,
                    "source_hash": self._content_hash(item),
                    "tokens_estimated": tokens_est,
                }

                # Upsert the translation
                await self.translations_col.update_one(
                    {"item_id": item_id, "language": lang},
                    {"$set": translation_doc},
                    upsert=True,
                )

                total_tokens_estimated += tokens_est
                results[lang] = {"status": "translated", "tokens_estimated": tokens_est}

            except Exception as e:
                logger.error(f"Translation failed for {item_id}/{lang}: {e}")
                results[lang] = {"status": "error", "error": str(e)}

        return {
            "item_id": item_id,
            "results": results,
            "total_tokens_estimated": total_tokens_estimated,
        }

    async def batch_translate(
        self,
        languages: List[str],
        limit: int = 50,
        offset: int = 0,
        category_filter: Optional[str] = None,
        region_filter: Optional[str] = None,
        dry_run: bool = False,
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

        items = await self.heritage_col.find(query, {"id": 1, "_id": 0}).skip(offset).limit(limit).to_list(limit)

        if dry_run:
            return {
                "dry_run": True,
                "items_found": len(items),
                "languages": languages,
                "estimated_api_calls": len(items) * len(languages) * 4,  # 4 fields per POI
            }

        stats = {
            "total_items": len(items),
            "translated": 0,
            "cached": 0,
            "errors": 0,
            "total_tokens_estimated": 0,
        }

        for item in items:
            item_id = item["id"]
            result = await self.translate_poi(item_id, languages)
            for lang, lang_result in result.get("results", {}).items():
                status = lang_result.get("status")
                if status == "translated":
                    stats["translated"] += 1
                elif status == "cached":
                    stats["cached"] += 1
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
