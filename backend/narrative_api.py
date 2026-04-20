"""
Narrative API - AI narrative generation for heritage items.
Extracted from server.py.
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

from shared_utils import DatabaseHolder
from models.api_models import NarrativeRequest, NarrativeResponse
from premium_guard import require_feature

import logging
logger = logging.getLogger(__name__)

narrative_router = APIRouter(tags=["Heritage"])

_db_holder = DatabaseHolder("narrative")
set_narrative_db = _db_holder.set

_llm_key = ""


def set_narrative_llm_key(key: str):
    global _llm_key
    _llm_key = key


@narrative_router.post("/narrative", response_model=NarrativeResponse, dependencies=[Depends(require_feature("ai_itinerary"))])
async def generate_narrative(request: NarrativeRequest):
    """Generate AI narrative for a heritage item (Premium)"""
    item = await _db_holder.db.heritage_items.find_one({"id": request.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if not _llm_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        style_prompts = {
            "storytelling": "Conta esta história de forma envolvente e mística, como um contador de histórias tradicional português. Usa linguagem poética e evocativa.",
            "educational": "Explica este elemento do património de forma educativa e informativa, incluindo contexto histórico e cultural.",
            "brief": "Resume este elemento do património de forma concisa e clara, destacando os pontos principais."
        }

        system_message = f"""És um especialista em património cultural português.
        A tua tarefa é criar narrativas sobre o património imaterial de Portugal.
        {style_prompts.get(request.style, style_prompts['storytelling'])}
        Responde sempre em português de Portugal."""

        chat = LlmChat(
            api_key=_llm_key,
            session_id=f"narrative_{request.item_id}",
            system_message=system_message
        ).with_model("openai", "gpt-4o")

        user_message = UserMessage(
            text=f"""Cria uma narrativa sobre: {item['name']}

            Descrição: {item['description']}
            Categoria: {item['category']}
            Região: {item['region']}

            Informações adicionais: {item.get('metadata', {})}"""
        )

        response = await chat.send_message(user_message)

        return NarrativeResponse(
            narrative=response,
            item_name=item['name'],
            generated_at=datetime.now(timezone.utc)
        )
    except Exception as e:
        logger.error("AI generation error: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate narrative")
