"""
Portugal Vivo — Content Toolkit API
AI-assisted content creation for small cultural agents (agentes culturais).

Draft → Enrich → Review → Publish workflow:
  1. POST /toolkit/draft      — submit human draft (POI description / event / local story)
  2. POST /toolkit/enrich     — AI enrichment pass (tone, facts, keywords, depth)
  3. POST /toolkit/review     — automated quality review (authenticity, completeness, IQ)
  4. POST /toolkit/publish    — commit enriched content back to the POI / event record

Each draft is persisted in `content_drafts` collection with a `draft_id`.
Status flow: draft → enriching → enriched → reviewing → reviewed → published

v1 endpoints:
  POST /toolkit/draft              — create/update draft
  POST /toolkit/enrich/{draft_id} — run AI enrichment
  POST /toolkit/review/{draft_id} — run automated quality review
  POST /toolkit/publish/{draft_id}— publish to target record
  GET  /toolkit/drafts            — list my drafts (paginated)
  GET  /toolkit/draft/{draft_id}  — get single draft
  DELETE /toolkit/draft/{draft_id}— discard draft
  GET  /toolkit/guidelines        — style guide + authenticity tips
"""
from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth_api import get_current_user, require_auth
from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

toolkit_router = APIRouter(prefix="/toolkit", tags=["Content Toolkit"])

_db_holder = DatabaseHolder("content_toolkit")
set_content_toolkit_db = _db_holder.set
_get_db = _db_holder.get

# ──────────────────────────────────────────────────────────────────────────────
# LLM helper (graceful degradation if key absent)
# ──────────────────────────────────────────────────────────────────────────────

_llm_key: str = ""


def set_toolkit_llm_key(key: str) -> None:
    global _llm_key
    _llm_key = key


async def _call_llm(system_prompt: str, user_prompt: str, max_tokens: int = 800) -> str:
    if not _llm_key:
        return ""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=_llm_key,
            session_id=f"toolkit-{uuid.uuid4().hex[:8]}",
            system_message=system_prompt,
        ).with_model("openai", "gpt-4o-mini").with_max_tokens(max_tokens)
        resp = await chat.send_message(UserMessage(content=user_prompt))
        return resp.strip() if resp else ""
    except Exception as exc:
        logger.warning("LLM call failed in toolkit: %s", exc)
        return ""


# ──────────────────────────────────────────────────────────────────────────────
# AUTHENTICITY GUIDELINES
# ──────────────────────────────────────────────────────────────────────────────

STYLE_GUIDELINES: Dict[str, Any] = {
    "principles": [
        "Escreve na primeira pessoa do plural quando falas de comunidade (nós, a nossa aldeia).",
        "Evita superlativos vazios: 'magnífico', 'deslumbrante' sem contexto específico.",
        "Ancora cada afirmação histórica numa data, figura ou evento verificável.",
        "Usa detalhes sensoriais: cheiros, texturas, sons locais.",
        "Menciona pelo menos uma tradição ou prática oral viva.",
        "Evita linguagem de brochura turística: 'paraíso', 'imperdível', 'único no mundo'.",
        "Inclui a perspetiva dos habitantes locais, não apenas a do visitante externo.",
    ],
    "structure_snackable": "1 frase de gancho + 2-3 factos concretos + 1 convite à ação (≤120 palavras)",
    "structure_historia": "Contexto histórico → Personagem/Evento pivot → Hoje em dia → Como visitar (≤500 palavras)",
    "structure_enciclopedico": "Origem → Desenvolvimento → Impacto cultural → Detalhes técnicos/artísticos → Fontes (≤1200 palavras)",
    "forbidden_patterns": [
        "único no mundo", "imperdível", "paraíso", "maravilhoso", "fantástico",
        "o melhor de Portugal", "não pode perder", "simplesmente incrível",
    ],
    "tone_by_category": {
        "castelos": "histórico, evocativo, narrativo",
        "gastronomia": "sensorial, caloroso, íntimo",
        "natureza": "contemplativo, científico-acessível",
        "festas_romarias": "comunitário, oral, celebratório",
        "museus": "curioso, analítico, revelador",
    },
}

ENRICHMENT_PROMPTS: Dict[str, str] = {
    "snackable": (
        "És um editor de conteúdo cultural português. "
        "Recebeste um rascunho de um agente cultural local. "
        "Reescreve-o no formato SNACKABLE: 1 gancho + 2-3 factos + convite. "
        "Máximo 120 palavras. Mantém a voz e os detalhes locais autênticos. "
        "Não uses superlativos vazios. Responde só com o texto final, sem cabeçalhos."
    ),
    "historia": (
        "És um editor cultural especializado em turismo de proximidade português. "
        "Enriquece este rascunho no formato HISTÓRIA: contexto histórico → personagem/evento pivot → "
        "hoje em dia → como visitar. Máximo 500 palavras. "
        "Mantém os detalhes locais. Adiciona datas e figuras históricas verificáveis quando possível. "
        "Tom narrativo, não de brochura. Responde só com o texto."
    ),
    "enciclopedico": (
        "És um historiador-editor cultural. Expande este rascunho para o nível ENCICLOPÉDICO: "
        "Origem → Desenvolvimento → Impacto cultural → Detalhes técnicos ou artísticos → Contexto atual. "
        "Máximo 1200 palavras. Cita estilos arquitetónicos, períodos históricos, figuras relevantes. "
        "Mantém rigor académico acessível. Tom erudito mas não pedante. Responde só com o texto."
    ),
    "micro_story": (
        "Cria uma micro-história de 15-30 segundos de leitura (máx 60 palavras) "
        "sobre este local, para ser partilhada num card de descoberta. "
        "Deve ser surpreendente, sensorial, e terminar com uma pergunta retórica ou facto inesperado. "
        "Tom: conversa entre amigos, não guia turístico."
    ),
    "generic": (
        "És um editor de conteúdo cultural português. "
        "Melhora este rascunho: corrige factos implausíveis, enriquece com contexto cultural, "
        "mantém a voz autêntica do autor, remove clichés turísticos. "
        "Responde só com o texto melhorado."
    ),
}

# ──────────────────────────────────────────────────────────────────────────────
# QUALITY REVIEW CRITERIA
# ──────────────────────────────────────────────────────────────────────────────

REVIEW_CRITERIA: List[Dict[str, Any]] = [
    {"id": "authenticity", "label": "Autenticidade", "max_score": 30,
     "signals": ["detalhes locais", "voz comunitária", "ausência de clichés"]},
    {"id": "completeness", "label": "Completude", "max_score": 25,
     "signals": ["contexto histórico", "informação prática", "quem/quando/onde"]},
    {"id": "readability", "label": "Legibilidade", "max_score": 20,
     "signals": ["frases curtas", "parágrafos ≤4 linhas", "sem jargão"]},
    {"id": "factual_anchoring", "label": "Ancoragem Factual", "max_score": 15,
     "signals": ["datas", "figuras históricas", "dados mensuráveis"]},
    {"id": "sensory_richness", "label": "Riqueza Sensorial", "max_score": 10,
     "signals": ["cheiros", "texturas", "sons", "sabores", "imagens vívidas"]},
]


def _review_text(text: str, target_depth: str) -> Dict[str, Any]:
    """Heuristic quality review — no LLM needed."""
    text_lower = text.lower()
    word_count = len(text.split())
    sentences = [s.strip() for s in text.replace("!", ".").replace("?", ".").split(".") if s.strip()]

    scores: Dict[str, int] = {}

    # Authenticity (30pts): penalise forbidden patterns, reward local specifics
    forbidden_hits = sum(1 for p in STYLE_GUIDELINES["forbidden_patterns"] if p in text_lower)
    auth_score = max(0, 30 - forbidden_hits * 8)
    # Boost if text has dates (year patterns like 1234 or século XII)
    import re
    has_dates = bool(re.search(r'\b(1[0-9]{3}|2[0-9]{3}|século [IVX]+)\b', text, re.IGNORECASE))
    if has_dates:
        auth_score = min(30, auth_score + 5)
    scores["authenticity"] = auth_score

    # Completeness (25pts)
    completeness = 0
    if word_count >= 30:
        completeness += 10
    if word_count >= 80:
        completeness += 8
    if has_dates:
        completeness += 7
    scores["completeness"] = min(25, completeness)

    # Readability (20pts): avg sentence length ≤20 words
    avg_sent_len = word_count / max(len(sentences), 1)
    if avg_sent_len <= 15:
        scores["readability"] = 20
    elif avg_sent_len <= 20:
        scores["readability"] = 15
    elif avg_sent_len <= 28:
        scores["readability"] = 10
    else:
        scores["readability"] = 5

    # Factual anchoring (15pts)
    factual_score = 0
    if has_dates:
        factual_score += 8
    if re.search(r'\b[A-ZÁÉÍÓÚÃÕÇ][a-záéíóúãõç]+ (I|II|III|IV|V|de [A-Z])', text):
        factual_score += 7  # Historical figure pattern
    scores["factual_anchoring"] = min(15, factual_score)

    # Sensory richness (10pts)
    sensory_words = ["cheiro", "aroma", "perfume", "textura", "rugoso", "suave",
                     "som", "silêncio", "eco", "sabor", "doce", "amargo", "salgado",
                     "luz", "sombra", "dourado", "ocre", "frio", "quente", "húmido"]
    sensory_hits = sum(1 for w in sensory_words if w in text_lower)
    scores["sensory_richness"] = min(10, sensory_hits * 3)

    total = sum(scores.values())
    warnings: List[str] = []

    if forbidden_hits > 0:
        warnings.append(f"Contém {forbidden_hits} padrão(ões) de cliché turístico — remover antes de publicar.")
    if word_count < 30:
        warnings.append("Texto muito curto — enriquecer com mais contexto.")
    if not has_dates and target_depth in ("historia", "enciclopedico"):
        warnings.append("Sem datas ou referências históricas — adicionar contexto temporal.")
    if avg_sent_len > 25:
        warnings.append("Frases muito longas (média >25 palavras) — dividir para melhor legibilidade.")
    if sensory_hits == 0 and target_depth != "snackable":
        warnings.append("Falta riqueza sensorial — adicionar pelo menos 1-2 detalhes sensoriais.")

    ready_to_publish = total >= 60 and not any("cliché" in w for w in warnings)

    return {
        "total_score": total,
        "max_score": 100,
        "grade": "A" if total >= 80 else ("B" if total >= 60 else "C"),
        "scores": scores,
        "warnings": warnings,
        "ready_to_publish": ready_to_publish,
        "word_count": word_count,
    }


# ──────────────────────────────────────────────────────────────────────────────
# PYDANTIC MODELS
# ──────────────────────────────────────────────────────────────────────────────

class DraftCreateRequest(BaseModel):
    target_type: str = Field(..., description="'poi' | 'event' | 'micro_story' | 'local_story'")
    target_id: Optional[str] = Field(None, description="POI id or event id if editing existing")
    target_depth: str = Field("historia", description="'snackable' | 'historia' | 'enciclopedico' | 'micro_story'")
    title: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=10, max_length=8000, description="Human draft text")
    category: Optional[str] = None
    region: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    notes_for_editor: Optional[str] = Field(None, description="Context note for AI enrichment (not published)")


class DraftUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    body: Optional[str] = Field(None, min_length=10, max_length=8000)
    notes_for_editor: Optional[str] = None
    tags: Optional[List[str]] = None


class EnrichRequest(BaseModel):
    override_depth: Optional[str] = None  # Force different depth than draft's target_depth
    preserve_author_voice: bool = True


class PublishRequest(BaseModel):
    field_to_update: str = Field("description", description="Which POI field to write to")
    notify_review: bool = Field(False, description="Flag for human editorial review after publish")


# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _draft_id() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

@toolkit_router.post("/draft", status_code=201)
async def create_draft(
    req: DraftCreateRequest,
    current_user: dict = Depends(require_auth),
):
    """Submit a new human draft for AI-assisted enrichment."""
    db = _get_db()
    draft_id = _draft_id()
    doc = {
        "draft_id": draft_id,
        "author_id": current_user["user_id"],
        "author_name": current_user.get("name", "Agente Cultural"),
        "target_type": req.target_type,
        "target_id": req.target_id,
        "target_depth": req.target_depth,
        "title": req.title,
        "body_original": req.body,
        "body_current": req.body,
        "body_enriched": None,
        "category": req.category,
        "region": req.region,
        "tags": req.tags,
        "notes_for_editor": req.notes_for_editor,
        "status": "draft",
        "review_result": None,
        "enrichment_meta": None,
        "created_at": _now(),
        "updated_at": _now(),
        "published_at": None,
    }
    await db.content_drafts.insert_one(doc)
    doc.pop("_id", None)
    return {"draft_id": draft_id, "status": "draft", "message": "Rascunho criado. Pronto para enriquecimento IA."}


@toolkit_router.get("/draft/{draft_id}")
async def get_draft(draft_id: str, current_user: dict = Depends(require_auth)):
    """Get a single draft by ID."""
    db = _get_db()
    doc = await db.content_drafts.find_one({"draft_id": draft_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Rascunho não encontrado")
    # Only author or admin can read
    if doc["author_id"] != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    return doc


@toolkit_router.patch("/draft/{draft_id}")
async def update_draft(
    draft_id: str,
    req: DraftUpdateRequest,
    current_user: dict = Depends(require_auth),
):
    """Update draft body or metadata (only while in draft/enriched/reviewed state)."""
    db = _get_db()
    doc = await db.content_drafts.find_one({"draft_id": draft_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Rascunho não encontrado")
    if doc["author_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if doc["status"] == "published":
        raise HTTPException(status_code=400, detail="Rascunho já publicado — não pode ser editado")

    updates: Dict[str, Any] = {"updated_at": _now()}
    if req.title is not None:
        updates["title"] = req.title
    if req.body is not None:
        updates["body_current"] = req.body
        updates["body_enriched"] = None  # Invalidate enrichment
        updates["status"] = "draft"
        updates["review_result"] = None
    if req.notes_for_editor is not None:
        updates["notes_for_editor"] = req.notes_for_editor
    if req.tags is not None:
        updates["tags"] = req.tags

    await db.content_drafts.update_one({"draft_id": draft_id}, {"$set": updates})
    return {"draft_id": draft_id, "updated": list(updates.keys())}


@toolkit_router.delete("/draft/{draft_id}", status_code=204)
async def delete_draft(draft_id: str, current_user: dict = Depends(require_auth)):
    """Discard a draft (unpublished only)."""
    db = _get_db()
    doc = await db.content_drafts.find_one({"draft_id": draft_id}, {"author_id": 1, "status": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Rascunho não encontrado")
    if doc["author_id"] != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    if doc["status"] == "published":
        raise HTTPException(status_code=400, detail="Não é possível apagar um rascunho publicado")
    await db.content_drafts.delete_one({"draft_id": draft_id})


@toolkit_router.get("/drafts")
async def list_drafts(
    current_user: dict = Depends(require_auth),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """List current user's drafts, newest first."""
    db = _get_db()
    query: Dict[str, Any] = {"author_id": current_user["user_id"]}
    if status:
        query["status"] = status
    total = await db.content_drafts.count_documents(query)
    docs = await db.content_drafts.find(
        query,
        {"_id": 0, "body_original": 0, "body_enriched": 0, "notes_for_editor": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(length=limit)

    for d in docs:
        for k in ("created_at", "updated_at", "published_at"):
            if d.get(k) and hasattr(d[k], "isoformat"):
                d[k] = d[k].isoformat()

    return {"total": total, "offset": offset, "limit": limit, "drafts": docs}


@toolkit_router.post("/enrich/{draft_id}")
async def enrich_draft(
    draft_id: str,
    req: EnrichRequest = EnrichRequest(),
    current_user: dict = Depends(require_auth),
):
    """
    Run AI enrichment on a draft.
    Uses the draft's target_depth unless overridden.
    Preserves original body — enriched version stored separately.
    """
    db = _get_db()
    doc = await db.content_drafts.find_one({"draft_id": draft_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Rascunho não encontrado")
    if doc["author_id"] != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    if doc["status"] == "published":
        raise HTTPException(status_code=400, detail="Rascunho já publicado")

    depth = req.override_depth or doc["target_depth"]
    system_prompt = ENRICHMENT_PROMPTS.get(depth, ENRICHMENT_PROMPTS["generic"])

    if req.preserve_author_voice:
        system_prompt += (
            "\n\nIMPORTANTE: O texto foi escrito por um agente cultural local. "
            "Preserva a sua voz e os detalhes únicos que ele menciona. "
            "Só corrige facto, estrutura e clareza — não homogeneízes o estilo."
        )

    notes = doc.get("notes_for_editor") or ""
    user_prompt = f"RASCUNHO:\n{doc['body_current']}"
    if notes:
        user_prompt += f"\n\nNOTA DO AUTOR (contexto, não publicar): {notes}"

    # Mark as enriching
    await db.content_drafts.update_one(
        {"draft_id": draft_id},
        {"$set": {"status": "enriching", "updated_at": _now()}}
    )

    enriched_text = await _call_llm(system_prompt, user_prompt, max_tokens=1200)

    if not enriched_text:
        # Fallback: return original body with minor cleanup note
        enriched_text = doc["body_current"]
        enrichment_note = "LLM indisponível — texto original mantido. Revê manualmente antes de publicar."
    else:
        enrichment_note = f"Enriquecido com perfil '{depth}'. Compara com original antes de publicar."

    await db.content_drafts.update_one(
        {"draft_id": draft_id},
        {"$set": {
            "body_enriched": enriched_text,
            "body_current": enriched_text,
            "status": "enriched",
            "updated_at": _now(),
            "enrichment_meta": {
                "depth_used": depth,
                "preserved_voice": req.preserve_author_voice,
                "enriched_at": _now().isoformat(),
                "note": enrichment_note,
            },
        }}
    )

    return {
        "draft_id": draft_id,
        "status": "enriched",
        "body_enriched": enriched_text,
        "body_original": doc["body_original"],
        "note": enrichment_note,
    }


@toolkit_router.post("/review/{draft_id}")
async def review_draft(
    draft_id: str,
    current_user: dict = Depends(require_auth),
):
    """
    Run automated quality review on current draft body.
    Returns score breakdown and actionable warnings.
    Does not require LLM.
    """
    db = _get_db()
    doc = await db.content_drafts.find_one({"draft_id": draft_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Rascunho não encontrado")
    if doc["author_id"] != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")

    text = doc["body_current"]
    target_depth = doc["target_depth"]
    review = _review_text(text, target_depth)

    await db.content_drafts.update_one(
        {"draft_id": draft_id},
        {"$set": {
            "status": "reviewed",
            "review_result": review,
            "updated_at": _now(),
        }}
    )

    return {
        "draft_id": draft_id,
        "status": "reviewed",
        "review": review,
        "next_step": (
            "Pronto para publicar!" if review["ready_to_publish"]
            else "Corrige os avisos antes de publicar para melhor qualidade."
        ),
    }


@toolkit_router.post("/publish/{draft_id}")
async def publish_draft(
    draft_id: str,
    req: PublishRequest = PublishRequest(),
    current_user: dict = Depends(require_auth),
):
    """
    Publish draft content to the target POI or event record.
    Writes `body_current` to `target_id[field_to_update]` in `heritage_items`.
    For events, writes to `events` collection instead.
    """
    db = _get_db()
    doc = await db.content_drafts.find_one({"draft_id": draft_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Rascunho não encontrado")
    if doc["author_id"] != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    if doc["status"] == "published":
        raise HTTPException(status_code=400, detail="Já publicado")

    # Optional: refuse if review score is too low and force_publish not set
    review = doc.get("review_result")
    if review and review.get("total_score", 100) < 40:
        raise HTTPException(
            status_code=422,
            detail=f"Qualidade insuficiente para publicar (score {review['total_score']}/100). "
                   "Enriqueça e reveja primeiro."
        )

    target_id = doc.get("target_id")
    content_to_publish = doc["body_current"]
    target_type = doc.get("target_type", "poi")
    published_to = None

    if target_id:
        if target_type == "event":
            result = await db.events.update_one(
                {"id": target_id},
                {"$set": {
                    req.field_to_update: content_to_publish,
                    "last_edited_at": _now(),
                    "last_editor_id": current_user["user_id"],
                }}
            )
            published_to = f"events/{target_id}"
        else:
            # Default: poi / local_story goes to heritage_items
            field = req.field_to_update
            # Safety: only allow writing to content fields, not critical metadata
            allowed_fields = {"description", "micro_pitch", "descricao_curta", "local_story", "historia_local"}
            if field not in allowed_fields:
                raise HTTPException(status_code=400, detail=f"Campo '{field}' não permitido via toolkit")
            result = await db.heritage_items.update_one(
                {"id": target_id},
                {"$set": {
                    field: content_to_publish,
                    "last_edited_at": _now(),
                    "last_editor_id": current_user["user_id"],
                    "content_toolkit_published": True,
                    "needs_editorial_review": req.notify_review,
                }}
            )
            published_to = f"heritage_items/{target_id}/{field}"

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Registo alvo não encontrado")

    await db.content_drafts.update_one(
        {"draft_id": draft_id},
        {"$set": {
            "status": "published",
            "published_at": _now(),
            "published_to": published_to,
            "updated_at": _now(),
        }}
    )

    return {
        "draft_id": draft_id,
        "status": "published",
        "published_to": published_to or "standalone (sem target_id)",
        "notify_review": req.notify_review,
        "message": "Conteúdo publicado com sucesso." + (
            " Sinalizado para revisão editorial." if req.notify_review else ""
        ),
    }


@toolkit_router.get("/guidelines")
async def get_guidelines():
    """Return style guide, authenticity principles, and writing tips for cultural agents."""
    return {
        "style_guide": STYLE_GUIDELINES,
        "enrichment_depths": {
            "snackable": {
                "label": "Snackable (30-60s)",
                "description": "Gancho rápido para redes sociais e cards de descoberta.",
                "word_target": "80-120 palavras",
                "use_for": "Posts, notificações, cards de mapa",
            },
            "historia": {
                "label": "História (3-5 min)",
                "description": "Narrativa completa com contexto cultural.",
                "word_target": "300-500 palavras",
                "use_for": "Página de detalhe do POI, guias de rota",
            },
            "enciclopedico": {
                "label": "Enciclopédico (7-12 min)",
                "description": "Profundidade académica acessível.",
                "word_target": "800-1200 palavras",
                "use_for": "Enciclopédia Viva, downloads offline, press kit",
            },
            "micro_story": {
                "label": "Micro-história (15-30s)",
                "description": "Facto surpreendente ou detalhe sensorial único.",
                "word_target": "40-60 palavras",
                "use_for": "Cards de scroll, notificações de proximidade",
            },
        },
        "workflow": [
            {"step": 1, "action": "POST /toolkit/draft", "description": "Escreve o teu rascunho humano — qualquer qualidade serve"},
            {"step": 2, "action": "POST /toolkit/enrich/{draft_id}", "description": "A IA enriquece mantendo a tua voz"},
            {"step": 3, "action": "POST /toolkit/review/{draft_id}", "description": "Revisão automática de qualidade (score 0-100)"},
            {"step": 4, "action": "Revê manualmente", "description": "Compara original vs enriquecido, aceita ou edita"},
            {"step": 5, "action": "POST /toolkit/publish/{draft_id}", "description": "Publica no registo do POI ou evento"},
        ],
        "quality_criteria": REVIEW_CRITERIA,
    }
