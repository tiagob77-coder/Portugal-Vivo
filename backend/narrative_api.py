"""
Narrative API - AI narrative generation for heritage items.
Extracted from server.py.
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone

from shared_utils import DatabaseHolder
from models.api_models import NarrativeRequest, NarrativeResponse
from premium_guard import require_feature
from llm_client import call_chat_completion

import logging
logger = logging.getLogger(__name__)

narrative_router = APIRouter(tags=["Heritage"])

_db_holder = DatabaseHolder("narrative")
set_narrative_db = _db_holder.set


def set_narrative_llm_key(key: str):
    """No-op shim. The LLM provider/key is now resolved centrally in
    ``llm_client`` (OPENAI_API_KEY → Emergent → static fallback). Kept so the
    existing ``set_narrative_llm_key(...)`` call in server.py keeps working
    without changes."""
    _ = key


_STYLE_PROMPTS = {
    "storytelling": "Conta esta história de forma envolvente e mística, como um contador de histórias tradicional português. Usa linguagem poética e evocativa.",
    "educational": "Explica este elemento do património de forma educativa e informativa, incluindo contexto histórico e cultural.",
    "brief": "Resume este elemento do património de forma concisa e clara, destacando os pontos principais.",
}


def _static_narrative(item: dict, style: str) -> str:
    """Deterministic fallback used when no LLM provider is configured or the
    call fails — keeps the endpoint useful instead of returning a 500."""
    name = item.get("name", "Este local")
    region = item.get("region") or "Portugal"
    category = item.get("category") or "património"
    description = (item.get("description") or "").strip()

    if style == "brief":
        return f"{name} ({region}) — {category}. {description}".strip()

    lead = {
        "educational": f"{name}, em {region}, é um exemplo de {category} português.",
        "storytelling": f"Há histórias que o tempo guardou em {name}, no coração de {region}.",
    }.get(style, f"{name}, em {region}, é um exemplo de {category} português.")

    if description:
        return f"{lead} {description}"
    return (
        f"{lead} Um lugar que vale a pena descobrir com calma, deixando que a "
        f"paisagem e a memória de {region} contem a sua própria história."
    )


@narrative_router.post("/narrative", response_model=NarrativeResponse, dependencies=[Depends(require_feature("ai_itinerary"))])
async def generate_narrative(request: NarrativeRequest):
    """Generate an AI narrative for a heritage item (Premium).

    Uses the central ``llm_client`` auto-select (OpenAI direct → Emergent →
    None). When no provider is configured or the call fails, returns a
    structured static narrative instead of erroring — per project policy of
    always having a fallback when the LLM is unavailable.
    """
    item = await _db_holder.db.heritage_items.find_one({"id": request.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    style = request.style if request.style in _STYLE_PROMPTS else "storytelling"
    system_message = (
        "És um especialista em património cultural português. A tua tarefa é "
        "criar narrativas sobre o património de Portugal.\n"
        f"{_STYLE_PROMPTS[style]}\n"
        "Responde sempre em português de Portugal."
    )
    user_message = (
        f"Cria uma narrativa sobre: {item.get('name', '')}\n\n"
        f"Descrição: {item.get('description', '')}\n"
        f"Categoria: {item.get('category', '')}\n"
        f"Região: {item.get('region', '')}\n\n"
        f"Informações adicionais: {item.get('metadata', {})}"
    )

    try:
        narrative = await call_chat_completion(
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message},
            ],
            model="gpt-4o",
            temperature=0.7,
            max_tokens=600,
        )
    except Exception as e:  # defensive: llm_client already swallows, but never 500 here
        logger.warning("Narrative LLM call raised, using static fallback: %s", e)
        narrative = None

    if not narrative:
        narrative = _static_narrative(item, style)

    return NarrativeResponse(
        narrative=narrative,
        item_name=item.get("name", ""),
        generated_at=datetime.now(timezone.utc),
    )
