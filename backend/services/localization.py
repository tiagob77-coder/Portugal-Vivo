"""
localization.py — Editorial bilingual content generation for Portugal Vivo POIs.

Generates structured PT-PT / EN content fields (title, subtitle, short_description,
full_description, cultural_fact, practical_info) via LLM with category-aware tone,
Portuguese cultural term preservation, and deterministic fallback when LLM is unavailable.

Storage: poi_localizations collection
    { poi_id, poi_type, lang, title, subtitle, short_description,
      full_description, cultural_fact, practical_info,
      generated_at, source ("ai"|"manual"), quality_score }
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import llm_client

logger = logging.getLogger("localization")

SUPPORTED_LANGS = {"pt", "en"}

# ── Category → editorial tone hints passed to the LLM ─────────────────────

_TONE_MAP: Dict[str, Dict[str, str]] = {
    "museu": {"pt": "reverente, informativo e preciso", "en": "educational and evocative"},
    "monumento": {"pt": "reverente, informativo e preciso", "en": "educational and evocative"},
    "trilho": {"pt": "entusiasta e aventureiro", "en": "adventurous and inspiring"},
    "percurso": {"pt": "entusiasta e aventureiro", "en": "adventurous and inspiring"},
    "aldeia": {"pt": "nostálgico, autêntico e íntimo", "en": "authentic, warm and discovery-focused"},
    "praia": {"pt": "relaxado e sensorial", "en": "inviting and vivid"},
    "gastronomia": {"pt": "apaixonado e sensorial", "en": "enticing and cultural"},
    "restaurante": {"pt": "apaixonado e sensorial", "en": "enticing and cultural"},
    "default": {"pt": "informativo e envolvente", "en": "informative and engaging"},
}

_PRESERVED_TERMS = (
    "fado, saudade, bacalhau (→ EN: bacalhau (salted cod)), "
    "miradouro (→ EN: miradouro (viewpoint)), azulejo (→ EN: azulejo (decorative tile)), "
    "serra, rio, ribeira, quinta — manter forma portuguesa + tradução entre parênteses em EN"
)

_SYSTEM_PROMPT = (
    "És um editor especializado em turismo cultural português para a plataforma Portugal Vivo. "
    "Regras absolutas:\n"
    "1. Nunca traduzir: fado, saudade, bacalhau, azulejo, miradouro, aldeia — "
    "em EN explicar entre parênteses na primeira ocorrência.\n"
    "2. Tom: autêntico, nunca promocional ou exagerado.\n"
    "3. PT-PT (não PT-BR): 'utilizar', 'autocarro', 'telemóvel'.\n"
    "4. EN natural para nativos britânicos/americanos — sem 'Portinglish'.\n"
    "5. Comprimentos: respeitar os limites indicados no pedido.\n"
    "6. Retornar APENAS JSON válido, sem markdown, sem texto extra."
)


def _tone(category: str, lang: str) -> str:
    cat = (category or "").lower()
    for key, tones in _TONE_MAP.items():
        if key in cat:
            return tones.get(lang, tones["pt"])
    return _TONE_MAP["default"].get(lang, _TONE_MAP["default"]["pt"])


def _build_prompt(poi: dict, lang: str) -> str:
    category = poi.get("category", poi.get("tipo", ""))
    tone = _tone(category, lang)
    name = poi.get("name", poi.get("nome", ""))
    description = poi.get("description", poi.get("descricao", ""))
    region = poi.get("region", poi.get("regiao", ""))
    address = poi.get("address", poi.get("morada", ""))
    tags = ", ".join(poi.get("tags", []))

    if lang == "pt":
        return (
            f"Cria conteúdo editorial em PT-PT para este POI com tom {tone}.\n\n"
            f"Nome: {name}\nCategoria: {category}\nRegião: {region}\n"
            f"Descrição base: {description}\nMorada: {address}\nTags: {tags}\n\n"
            "Retorna JSON com exactamente estas chaves:\n"
            '{"title": "máx 60 chars — [Nome] — [Tipologia] em [Município]",'
            '"subtitle": "máx 100 chars — facto histórico/natural mais impactante",'
            '"short_description": "150-200 chars — para cards e listagens",'
            '"full_description": "300-500 chars — para página de detalhe",'
            '"cultural_fact": "1 facto surpreendente ou curiosidade cultural",'
            '"practical_info": "horários, preços, como chegar"}'
        )
    else:
        return (
            f"Create editorial content in English for international tourists with a {tone} tone.\n"
            f"Provide cultural context that British/American visitors may lack.\n"
            f"Preserve these Portuguese terms (explain in parentheses on first use): {_PRESERVED_TERMS}\n\n"
            f"Name: {name}\nCategory: {category}\nRegion: {region}\n"
            f"Base description: {description}\nAddress: {address}\nTags: {tags}\n\n"
            "Return JSON with exactly these keys:\n"
            '{"title": "max 60 chars — adapted title (not a literal translation)",'
            '"subtitle": "max 100 chars — most compelling fact for an international visitor",'
            '"short_description": "150-200 chars — for cards and listings",'
            '"full_description": "300-500 chars — for detail page with cultural context",'
            '"cultural_fact": "1 surprising fact or cultural insight",'
            '"practical_info": "opening hours, prices, how to get there"}'
        )


def _fallback_content(poi: dict, lang: str) -> Dict[str, Any]:
    name = poi.get("name", poi.get("nome", "Unknown"))
    category = poi.get("category", poi.get("tipo", ""))
    region = poi.get("region", poi.get("regiao", ""))
    description = poi.get("description", poi.get("descricao", ""))

    short_desc = (description[:197] + "...") if len(description) > 200 else description

    if lang == "pt":
        return {
            "title": f"{name[:55]} — {category.title()} em {region}"[:60] if region else name[:60],
            "subtitle": f"{category.title()} em {region}" if region else category.title(),
            "short_description": short_desc or f"{name} — {category} em {region}.",
            "full_description": description[:500] if description else f"{name} é um {category} localizado em {region}.",
            "cultural_fact": "",
            "practical_info": poi.get("address", poi.get("morada", "")),
        }
    else:
        return {
            "title": name[:60],
            "subtitle": f"{category.title()} in {region}" if region else category.title(),
            "short_description": short_desc or f"{name} — {category} in {region}.",
            "full_description": description[:500] if description else f"{name} is a {category} located in {region}, Portugal.",
            "cultural_fact": "",
            "practical_info": poi.get("address", poi.get("morada", "")),
        }


def _parse_llm_json(raw: Optional[str], poi: dict, lang: str) -> Dict[str, Any]:
    """Parse LLM JSON response; fall back to static content on any error."""
    if not raw:
        return _fallback_content(poi, lang)
    try:
        parsed = json.loads(raw)
        required = {"title", "subtitle", "short_description", "full_description",
                    "cultural_fact", "practical_info"}
        if not required.issubset(parsed.keys()):
            raise ValueError("Missing required keys")
        # Enforce hard length limits silently
        parsed["title"] = parsed["title"][:60]
        parsed["subtitle"] = parsed["subtitle"][:100]
        parsed["short_description"] = parsed["short_description"][:200]
        return parsed
    except Exception as exc:
        logger.warning("Failed to parse LLM localization JSON: %s", exc)
        return _fallback_content(poi, lang)


# ── Public API ─────────────────────────────────────────────────────────────

class LocalizationService:
    def __init__(self, db) -> None:
        self.db = db
        self.col = db.poi_localizations

    async def get(self, poi_id: str, lang: str) -> Optional[Dict[str, Any]]:
        doc = await self.col.find_one(
            {"poi_id": poi_id, "lang": lang}, {"_id": 0}
        )
        if doc and doc.get("generated_at"):
            doc["generated_at"] = str(doc["generated_at"])
        return doc

    async def generate(
        self,
        poi_id: str,
        lang: str,
        poi_collection: str = "heritage_items",
        force: bool = False,
    ) -> Dict[str, Any]:
        """Generate (or re-generate) localized content for one POI."""
        if lang not in SUPPORTED_LANGS:
            return {"error": f"Unsupported language: {lang}"}

        existing = await self.col.find_one({"poi_id": poi_id, "lang": lang})
        if existing and not force:
            return {"status": "cached", "poi_id": poi_id, "lang": lang}

        poi = await self.db[poi_collection].find_one(
            {"$or": [{"id": poi_id}, {"_id": poi_id}]}, {"_id": 0}
        )
        if not poi:
            return {"error": f"POI not found: {poi_id}"}

        prompt = _build_prompt(poi, lang)
        raw = await llm_client.call_chat_completion(
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
            response_format={"type": "json_object"},
            timeout=20.0,
        )

        content = _parse_llm_json(raw, poi, lang)
        source = "ai" if raw else "fallback"

        doc = {
            "poi_id": poi_id,
            "poi_type": poi.get("category", poi.get("tipo", "")),
            "lang": lang,
            **content,
            "generated_at": datetime.now(timezone.utc),
            "source": source,
            "quality_score": None,
        }

        await self.col.update_one(
            {"poi_id": poi_id, "lang": lang},
            {"$set": doc},
            upsert=True,
        )

        logger.info("Localized poi=%s lang=%s source=%s", poi_id, lang, source)
        return {"status": "generated", "poi_id": poi_id, "lang": lang, "source": source}

    async def batch_generate(
        self,
        poi_ids: List[str],
        lang: str,
        poi_collection: str = "heritage_items",
        force: bool = False,
    ) -> Dict[str, Any]:
        stats = {"total": len(poi_ids), "generated": 0, "cached": 0, "errors": 0}
        for poi_id in poi_ids:
            result = await self.generate(poi_id, lang, poi_collection, force)
            if "error" in result:
                stats["errors"] += 1
            elif result.get("status") == "cached":
                stats["cached"] += 1
            else:
                stats["generated"] += 1
        return stats

    async def coverage_stats(self) -> Dict[str, Any]:
        pipeline = [
            {"$group": {
                "_id": {"lang": "$lang", "source": "$source"},
                "count": {"$sum": 1},
            }},
        ]
        rows = await self.col.aggregate(pipeline).to_list(50)
        stats: Dict[str, Any] = {}
        for row in rows:
            lang = row["_id"]["lang"]
            source = row["_id"]["source"]
            if lang not in stats:
                stats[lang] = {}
            stats[lang][source] = row["count"]
        return {"per_language": stats}

    async def manual_update(
        self, poi_id: str, lang: str, fields: Dict[str, Any]
    ) -> bool:
        fields["source"] = "manual"
        fields["generated_at"] = datetime.now(timezone.utc)
        result = await self.col.update_one(
            {"poi_id": poi_id, "lang": lang},
            {"$set": fields},
        )
        return result.matched_count > 0
