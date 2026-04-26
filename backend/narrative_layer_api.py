"""
Portugal Vivo — Narrative Layer Global
======================================
Camada universal de storytelling LLM que QUALQUER entidade pode invocar.

Generates rich, persona-tailored narratives for any module entity using
Emergent LLM (gpt-4o-mini) with aggressive Mongo cache (TTL 30 days).

Endpoints:
  POST /api/narrative-layer/generate   — gerar/obter narrativa (cache-first)
  GET  /api/narrative-layer/get        — recuperar narrativa cached por hash
  POST /api/narrative-layer/invalidate — forçar regeneração
  GET  /api/narrative-layer/stats      — estatísticas globais de cache
  GET  /api/narrative-layer/personas   — listar personas, moods, línguas
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from pydantic import BaseModel, Field

from models.api_models import User
from llm_client import call_chat_completion

narrative_layer_router = APIRouter(prefix="/narrative-layer", tags=["Narrative Layer"])
_db = None
_llm_key: Optional[str] = None
_require_admin = None
_require_auth = None

LLM_URL = "https://llm.lil.re.emergentmethods.ai/v1/chat/completions"
MODEL = "gpt-4o-mini"
CACHE_TTL_DAYS = 30
CACHE_COLLECTION = "narrative_cache"


def set_narrative_layer_db(database) -> None:
    global _db
    _db = database


def set_narrative_layer_llm_key(key: Optional[str]) -> None:
    global _llm_key
    _llm_key = key


def set_narrative_layer_admin(admin_fn) -> None:
    global _require_admin
    _require_admin = admin_fn


def set_narrative_layer_auth(auth_fn) -> None:
    global _require_auth
    _require_auth = auth_fn


async def _admin_dep(request: Request) -> User:
    return await _require_admin(request)


async def _auth_dep(request: Request) -> User:
    return await _require_auth(request)


# ─── Personas + tones ─────────────────────────────────────────────────────────

PERSONAS: dict[str, dict] = {
    "familia": {
        "label": "Família",
        "instruction": "Linguagem clara, próxima e divertida para famílias com crianças. Inclui factos curiosos.",
        "max_tokens": 280,
    },
    "estudante": {
        "label": "Estudante",
        "instruction": "Linguagem analítica e rigorosa, com ângulo histórico e contexto académico.",
        "max_tokens": 320,
    },
    "viajante": {
        "label": "Viajante",
        "instruction": "Tom evocativo e poético, focado na experiência e atmosfera do lugar.",
        "max_tokens": 300,
    },
    "fotografo": {
        "label": "Fotógrafo",
        "instruction": "Foca enquadramentos visuais, melhores horas de luz, ângulos icónicos.",
        "max_tokens": 260,
    },
    "gastrónomo": {
        "label": "Gastrónomo",
        "instruction": "Conta a história através do paladar — produtos, técnicas, restaurantes de referência.",
        "max_tokens": 280,
    },
    "academico": {
        "label": "Académico",
        "instruction": "Tom científico, com referências cronológicas e bibliográficas implícitas.",
        "max_tokens": 320,
    },
    "default": {
        "label": "Genérico",
        "instruction": "Tom equilibrado, informativo e cativante.",
        "max_tokens": 260,
    },
}

MOODS: dict[str, str] = {
    "aventureiro": "Sublinha o lado de descoberta, raridade e singularidade.",
    "cultural":    "Foca no património imaterial, tradições e identidade.",
    "romantico":   "Linguagem evocativa, sensorial, ideal para casais.",
    "espiritual":  "Foca em silêncio, introspecção, ligação à terra.",
    "festivo":     "Energia, ritmo, celebração colectiva.",
    "nostalgico":  "Evoca memória, tempo antigo, gerações passadas.",
    "default":     "Equilibrado entre informação e emoção.",
}

LANGUAGES: dict[str, str] = {
    "pt": "Português de Portugal",
    "en": "English (UK)",
    "es": "Español",
    "fr": "Français",
    "de": "Deutsch",
}

ENTITY_COLLECTIONS: dict[str, str] = {
    "cultural_route": "cultural_routes",
    "heritage":       "heritage_items",
    "gastronomy":     "coastal_gastronomy",
    "flora":          "flora_fauna",
    "fauna":          "flora_fauna",
    "prehistoria":    "geo_prehistoria",
    "maritime":       "maritime_culture",
    "marine":         "marine_biodiversity",
    "trail":          "trails",
    "event":          "events",
    "music":          "music_traditions",
}


# ─── Models ───────────────────────────────────────────────────────────────────

class NarrativeRequest(BaseModel):
    entity_type: str = Field(..., description="cultural_route|heritage|gastronomy|flora|fauna|...")
    entity_id:   str = Field(..., description="Document ID, slug or name")
    persona:     str = Field("default", description="familia|estudante|viajante|fotografo|gastrónomo|academico")
    mood:        str = Field("default", description="aventureiro|cultural|romantico|espiritual|festivo|nostalgico")
    lang:        str = Field("pt", description="pt|en|es|fr|de")
    season:      Optional[str] = Field(None, description="Optional season hint: inverno|primavera|verao|outono")
    force:       bool = Field(False, description="If true, bypass cache and regenerate")


# ─── Cache helpers ────────────────────────────────────────────────────────────

def _cache_key(req: NarrativeRequest) -> str:
    payload = f"{req.entity_type}|{req.entity_id}|{req.persona}|{req.mood}|{req.lang}|{req.season or ''}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


async def _ensure_index() -> None:
    if _db is None:
        return
    try:
        await _db[CACHE_COLLECTION].create_index("cache_key", unique=True)
        await _db[CACHE_COLLECTION].create_index("expires_at", expireAfterSeconds=0)
    except Exception:
        pass


async def _get_cached(key: str) -> Optional[dict]:
    if _db is None:
        return None
    try:
        doc = await _db[CACHE_COLLECTION].find_one({"cache_key": key})
        if doc:
            doc.pop("_id", None)
            return doc
    except Exception:
        pass
    return None


async def _save_cached(key: str, payload: dict) -> None:
    if _db is None:
        return
    try:
        expires = datetime.now(timezone.utc) + timedelta(days=CACHE_TTL_DAYS)
        doc = {**payload, "cache_key": key, "expires_at": expires, "cached_at": datetime.now(timezone.utc)}
        await _db[CACHE_COLLECTION].replace_one({"cache_key": key}, doc, upsert=True)
    except Exception:
        pass


# ─── Entity loader ────────────────────────────────────────────────────────────

async def _load_entity(entity_type: str, entity_id: str) -> Optional[dict]:
    if _db is None:
        return None
    col = ENTITY_COLLECTIONS.get(entity_type)
    if not col:
        return None
    try:
        from bson import ObjectId
        query: dict[str, Any]
        try:
            query = {"_id": ObjectId(entity_id)}
        except Exception:
            query = {"$or": [{"id": entity_id}, {"slug": entity_id},
                              {"name": {"$regex": entity_id, "$options": "i"}}]}
        return await _db[col].find_one(query)
    except Exception:
        return None


def _entity_summary(doc: dict, entity_type: str) -> str:
    """Compact summary fed to the LLM."""
    parts: list[str] = []
    name = doc.get("name") or doc.get("common_name") or doc.get("species_name") or "—"
    parts.append(f"Nome: {name}")
    if doc.get("region"):
        parts.append(f"Região: {doc['region']}")
    if doc.get("municipality") or doc.get("municipalities"):
        m = doc.get("municipality") or doc.get("municipalities")
        parts.append(f"Município(s): {m}")
    if doc.get("description_short") or doc.get("story_short") or doc.get("description"):
        parts.append(f"Descrição: {(doc.get('description_short') or doc.get('story_short') or doc.get('description'))[:300]}")
    if doc.get("unesco") or doc.get("unesco_label"):
        parts.append(f"UNESCO: {doc.get('unesco_label') or 'sim'}")
    for f in ("instruments", "dances", "festivals", "gastronomy", "costumes", "tags", "ingredients"):
        v = doc.get(f)
        if isinstance(v, list) and v:
            parts.append(f"{f}: {', '.join(str(x) for x in v[:6])}")
    if doc.get("best_months"):
        parts.append(f"Melhores meses: {doc['best_months']}")
    parts.append(f"Tipo: {entity_type}")
    return "\n".join(parts)


# ─── LLM call ────────────────────────────────────────────────────────────────

async def _call_llm(system_prompt: str, user_prompt: str, max_tokens: int) -> Optional[dict]:
    content = await call_chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        model=MODEL,
        temperature=0.85,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
        timeout=30.0,
    )
    if content is None:
        return None
    try:
        return json.loads(content)
    except Exception:
        return None


def _fallback_narrative(entity: dict, req: NarrativeRequest) -> dict:
    """Deterministic narrative used when LLM unavailable."""
    name = entity.get("name") or entity.get("common_name") or req.entity_id
    region = entity.get("region") or ""
    desc = entity.get("description_short") or entity.get("story_short") or entity.get("description") or ""
    persona_label = PERSONAS.get(req.persona, PERSONAS["default"])["label"]

    title = f"{name}" + (f" — {region}" if region else "")
    hook = f"Para {persona_label.lower()}, {name} é {desc[:120]}." if desc else f"Descobre {name} em {region}."
    body_parts = [hook]
    if entity.get("instruments"):
        body_parts.append(f"Sons: {', '.join(entity['instruments'][:3])}.")
    if entity.get("gastronomy"):
        body_parts.append(f"Sabores: {', '.join(entity['gastronomy'][:3])}.")
    if entity.get("festivals"):
        body_parts.append(f"Festas a não perder: {', '.join(entity['festivals'][:2])}.")
    body = " ".join(body_parts)

    return {
        "title":      title,
        "hook":       hook,
        "body":       body,
        "highlights": (entity.get("festivals") or entity.get("instruments") or [])[:3],
        "tip":        f"Visita {name} fora da época alta para uma experiência mais autêntica.",
        "tags":       (entity.get("tags") or entity.get("instruments") or [])[:5],
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@narrative_layer_router.post("/generate", summary="Generate or fetch cached narrative for any entity")
async def generate_narrative(
    req: NarrativeRequest,
    current_user: User = Depends(_auth_dep),
):
    """
    Returns a persona-tailored narrative for the entity, using LLM with
    aggressive Mongo cache (TTL 30 days). If `force=true`, bypasses cache.
    """
    await _ensure_index()

    key = _cache_key(req)
    if not req.force:
        cached = await _get_cached(key)
        if cached:
            cached["cache_hit"] = True
            return cached

    entity = await _load_entity(req.entity_type, req.entity_id)
    if entity is None:
        # Synthetic minimal entity so we still return something
        entity = {"name": req.entity_id, "region": "", "description": ""}

    persona_cfg = PERSONAS.get(req.persona, PERSONAS["default"])
    mood_instruction = MOODS.get(req.mood, MOODS["default"])
    lang_label = LANGUAGES.get(req.lang, LANGUAGES["pt"])

    system_prompt = (
        f"És um storyteller cultural português especializado em património, "
        f"natureza e tradições de Portugal. Escreve em {lang_label}.\n"
        f"Persona alvo: {persona_cfg['label']}. {persona_cfg['instruction']}\n"
        f"Tom emocional: {mood_instruction}\n"
        f"Devolve EXCLUSIVAMENTE JSON com as chaves: "
        f"title (string), hook (string, 1 frase forte), body (string, 2-4 parágrafos), "
        f"highlights (array de 3-5 strings), tip (string, 1 dica prática), "
        f"tags (array de 4-6 strings). Não incluas markdown."
    )

    user_prompt = (
        f"Cria uma narrativa imersiva sobre esta entidade:\n\n"
        f"{_entity_summary(entity, req.entity_type)}\n\n"
        + (f"Estação actual: {req.season}\n" if req.season else "")
        + "Devolve apenas o JSON pedido."
    )

    llm_result = await _call_llm(system_prompt, user_prompt, persona_cfg["max_tokens"])

    if llm_result is None or not isinstance(llm_result, dict) or "title" not in llm_result:
        llm_result = _fallback_narrative(entity, req)
        source = "fallback"
    else:
        source = "llm"

    payload = {
        "entity_type": req.entity_type,
        "entity_id":   req.entity_id,
        "persona":     req.persona,
        "mood":        req.mood,
        "lang":        req.lang,
        "season":      req.season,
        "narrative":   llm_result,
        "source":      source,
        "model":       MODEL,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "cache_hit":   False,
    }

    if source == "llm":
        await _save_cached(key, payload)

    return payload


@narrative_layer_router.get("/get", summary="Fetch cached narrative by parameters")
async def get_narrative(
    entity_type: str = Query(...),
    entity_id:   str = Query(...),
    persona:     str = Query("default"),
    mood:        str = Query("default"),
    lang:        str = Query("pt"),
    season:      Optional[str] = Query(None),
):
    """Returns cached narrative without triggering LLM. 404 if not cached."""
    req = NarrativeRequest(
        entity_type=entity_type, entity_id=entity_id,
        persona=persona, mood=mood, lang=lang, season=season,
    )
    cached = await _get_cached(_cache_key(req))
    if cached is None:
        raise HTTPException(404, "Narrative not cached. Use POST /generate to create.")
    cached["cache_hit"] = True
    return cached


@narrative_layer_router.post("/invalidate", summary="Force regeneration on next request")
async def invalidate_narrative(
    req: NarrativeRequest,
    admin: User = Depends(_admin_dep),
):
    """Deletes cached narrative (admin only); next /generate call will hit the LLM."""
    if _db is None:
        return {"deleted": 0}
    key = _cache_key(req)
    try:
        result = await _db[CACHE_COLLECTION].delete_one({"cache_key": key})
        return {"deleted": result.deleted_count, "cache_key": key}
    except Exception as exc:
        raise HTTPException(500, f"Failed to invalidate: {exc}")


@narrative_layer_router.get("/stats", summary="Narrative cache statistics")
async def narrative_stats():
    """Returns cache size, breakdown by entity_type, persona and language."""
    if _db is None:
        return {"total": 0, "available": False}
    try:
        total = await _db[CACHE_COLLECTION].count_documents({})

        by_type: dict[str, int] = {}
        async for row in _db[CACHE_COLLECTION].aggregate([
            {"$group": {"_id": "$entity_type", "n": {"$sum": 1}}},
        ]):
            by_type[row["_id"] or "unknown"] = row["n"]

        by_persona: dict[str, int] = {}
        async for row in _db[CACHE_COLLECTION].aggregate([
            {"$group": {"_id": "$persona", "n": {"$sum": 1}}},
        ]):
            by_persona[row["_id"] or "unknown"] = row["n"]

        by_lang: dict[str, int] = {}
        async for row in _db[CACHE_COLLECTION].aggregate([
            {"$group": {"_id": "$lang", "n": {"$sum": 1}}},
        ]):
            by_lang[row["_id"] or "pt"] = row["n"]

        return {
            "total":       total,
            "ttl_days":    CACHE_TTL_DAYS,
            "available":   True,
            "by_entity_type": by_type,
            "by_persona":  by_persona,
            "by_language": by_lang,
            "personas_supported": list(PERSONAS.keys()),
            "moods_supported":    list(MOODS.keys()),
            "langs_supported":    list(LANGUAGES.keys()),
            "model":       MODEL,
        }
    except Exception as exc:
        return {"total": 0, "available": False, "error": str(exc)}


@narrative_layer_router.get("/personas", summary="List available personas, moods, languages")
async def list_options():
    """Quick reference for clients building narrative request UIs."""
    return {
        "personas": {k: v["label"] for k, v in PERSONAS.items()},
        "moods":    list(MOODS.keys()),
        "languages": LANGUAGES,
        "entity_types": list(ENTITY_COLLECTIONS.keys()),
    }
