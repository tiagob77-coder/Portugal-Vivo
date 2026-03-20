"""
Portugal Vivo — Content Strategy API
"Conteúdo Vivo": multi-depth content, cognitive profile adaptation,
micro-stories, and seasonal contextualisation.

Vision: After using Portugal Vivo, users describe it as
  "a app que me fez sentir o Portugal de uma forma que nunca tinha sentido —
   como se cada pedra, cada receita, cada paisagem me contasse uma história
   feita só para mim."

Three content depth levels per POI:
  snackable    — 30-60 s reading; hook for first contact
  historia     — 3-5 min; full narrative with cultural context
  enciclopedico — 7-12 min; scholar-grade detail for advanced users

Five cognitive profiles (from M2 / user preferences):
  gourmet | familia | arquitetura | natureza_radical | historia_profunda
"""
from __future__ import annotations

import hashlib
import logging
import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth_api import get_current_user, require_auth
from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

content_strategy_router = APIRouter(prefix="/content", tags=["Content Strategy"])

_db_holder = DatabaseHolder("content_strategy")
set_content_strategy_db = _db_holder.set
_get_db = _db_holder.get

_llm_key: str = ""


def set_content_strategy_llm_key(key: str) -> None:
    global _llm_key
    _llm_key = key


# ──────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ──────────────────────────────────────────────────────────────────────────────

# Cognitive profile definitions — feed priorities + narrative tone
COGNITIVE_PROFILES: Dict[str, Dict] = {
    "gourmet": {
        "label": "Gourmet & Sabores",
        "emoji": "🍷",
        "priority_categories": [
            "restaurantes_gastronomia", "produtores_dop", "tabernas_historicas",
            "mercados_feiras", "oficios_artesanato",
        ],
        "narrative_tone": (
            "Usa linguagem sensorial — evoca aromas, sabores e texturas. "
            "Menciona sempre produtos regionais certificados, receitas transmitidas e produtores locais. "
            "Tom: cálido, connoisseur, sem exageros."
        ),
        "feed_boost": {"produtores_dop": 2.0, "restaurantes_gastronomia": 1.8, "tabernas_historicas": 1.6},
        "micro_story_hook": "Já provou algo feito assim?",
        "route_preference": "gastronomico",
    },
    "familia": {
        "label": "Família & Aventura Suave",
        "emoji": "👨‍👩‍👧",
        "priority_categories": [
            "praias_fluviais", "ecovias_passadicos", "museus", "parques_naturais",
            "aventura_natureza",
        ],
        "narrative_tone": (
            "Linguagem acessível, entusiasta e inclusiva. "
            "Destaca o que as crianças vão adorar, segurança do percurso, picnics, "
            "sombra e pontos de água. Evita termos técnicos."
        ),
        "feed_boost": {"praias_fluviais": 2.0, "ecovias_passadicos": 1.8, "museus": 1.4},
        "micro_story_hook": "Os miúdos vão querer voltar!",
        "route_preference": "familia",
    },
    "arquitetura": {
        "label": "Arquitetura & Arte",
        "emoji": "🏛️",
        "priority_categories": [
            "castelos", "museus", "arte_urbana", "arqueologia_geologia",
            "moinhos_azenhas", "rotas_tematicas",
        ],
        "narrative_tone": (
            "Preciso e técnico mas evocativo. Menciona estilo arquitectónico, época, "
            "construtores, materiais, intervenções de restauro e curiosidades de engenharia. "
            "Tom: erudito mas acessível."
        ),
        "feed_boost": {"castelos": 2.0, "arte_urbana": 1.8, "arqueologia_geologia": 1.7},
        "micro_story_hook": "Quantos séculos têm estas pedras?",
        "route_preference": "arquitetura",
    },
    "natureza_radical": {
        "label": "Natureza & Radical",
        "emoji": "🏔️",
        "priority_categories": [
            "percursos_pedestres", "aventura_natureza", "cascatas_pocos", "surf",
            "natureza_especializada", "praias_fluviais",
        ],
        "narrative_tone": (
            "Energético e inspirador. Foca-se em desafio físico, biodiversidade, "
            "altitudes, caudais e condições. "
            "Inclui dicas de segurança discretas. Tom: aventureiro."
        ),
        "feed_boost": {"percursos_pedestres": 2.0, "surf": 1.9, "cascatas_pocos": 1.8},
        "micro_story_hook": "Estás pronto para este desafio?",
        "route_preference": "aventura",
    },
    "historia_profunda": {
        "label": "História & Memória",
        "emoji": "📜",
        "priority_categories": [
            "castelos", "arqueologia_geologia", "museus", "festas_romarias",
            "musica_tradicional", "oficios_artesanato",
        ],
        "narrative_tone": (
            "Narrativo e cronológico. Contextualiza o POI na sua época, liga a figuras "
            "históricas, decisões políticas, guerras ou movimentos culturais. "
            "Cita fontes sem ser académico. Tom: jornalístico-histórico."
        ),
        "feed_boost": {"castelos": 1.8, "arqueologia_geologia": 2.0, "museus": 1.7},
        "micro_story_hook": "O que aconteceu aqui há 500 anos?",
        "route_preference": "historico",
    },
}

# Content depth system prompts — appended to the base narrative prompt
DEPTH_SYSTEM_ADDENDUM: Dict[str, str] = {
    "snackable": (
        "Gera um texto de 40-70 palavras (30-60 segundos de leitura). "
        "Começa com uma frase-gancho que surpreende ou emociona. "
        "Usa linguagem viva, um facto único e um convite subtil à visita. "
        "Sem subtítulos, sem listas — texto corrido, fluido."
    ),
    "historia": (
        "Gera um texto de 250-400 palavras (3-5 minutos de leitura). "
        "Estrutura: gancho → contexto histórico → momento-chave → curiosidade → chamada à acção. "
        "Inclui 1-2 factos surpreendentes e menciona ligações a outros POIs próximos se relevante."
    ),
    "enciclopedico": (
        "Gera um texto de 600-900 palavras com subtítulos em Markdown (##). "
        "Secções: Origem e História | Arquitectura/Características | Contexto Cultural | "
        "Lendas e Curiosidades | Como Visitar | Ligações Temáticas. "
        "Inclui datas precisas, estilos, figuras históricas e referências cruzadas a eventos ou POIs relacionados."
    ),
}

# Seasonal micro-story hooks — injected based on current month
SEASONAL_HOOKS: Dict[int, str] = {
    1: "Em pleno inverno, poucos visitam este lugar — e é justamente aí que a magia está.",
    2: "Fevereiro traz chuva, mas também as amendoeiras em flor que poucos vêem.",
    3: "A primavera chega primeiro aqui do que em qualquer outro lugar.",
    4: "Abril em Portugal tem uma luz que os pintores nunca conseguiram reproduzir completamente.",
    5: "Maio é o mês em que a natureza portuguesa está no seu auge — e este lugar sabe-o bem.",
    6: "O verão transforma este lugar — venha antes das 9h ou depois das 18h.",
    7: "Julho aqui tem um cheiro a alfazema e urze que não esquece.",
    8: "Agosto leva as multidões para a praia. Nós levamos-te para aqui.",
    9: "Setembro é o segredo mais bem guardado de Portugal — e este local confirma-o.",
    10: "Outubro pinta as serras portuguesas de laranja e cobre. Prepare-se.",
    11: "Novembro traz a chuva que renova os rios e as cascatas. Vale a pena.",
    12: "Dezembro tem aqui uma atmosfera que não encontrará em mais nenhum lugar.",
}

# Contextual triggers for micro-stories
CONTEXTUAL_TRIGGERS: Dict[str, str] = {
    "evento_proximo": "Há um evento especial aqui este fim-de-semana.",
    "hora_dourada": "Agora é a hora perfeita para visitar — luz dourada garantida.",
    "chuva_recente": "A chuva das últimas horas transformou este lugar.",
    "fim_de_semana": "Fim-de-semana perfeito para uma escapada diferente.",
    "feriado": "Dia especial para descobrir um Portugal que poucos conhecem.",
}


# ──────────────────────────────────────────────────────────────────────────────
# MODELS
# ──────────────────────────────────────────────────────────────────────────────

class ContentDepthRequest(BaseModel):
    poi_id: str
    depth: str = Field("snackable", pattern="^(snackable|historia|enciclopedico)$")
    cognitive_profile: Optional[str] = None  # one of COGNITIVE_PROFILES keys
    language: str = "pt"
    force_regenerate: bool = False


class MicroStoryRequest(BaseModel):
    poi_ids: List[str] = Field(..., min_length=1, max_length=10)
    cognitive_profile: Optional[str] = None
    context_trigger: Optional[str] = None  # key from CONTEXTUAL_TRIGGERS


class ProfileFeedRequest(BaseModel):
    cognitive_profile: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    limit: int = Field(20, ge=5, le=50)
    exclude_ids: List[str] = Field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _cache_key(poi_id: str, depth: str, profile: Optional[str]) -> str:
    raw = f"{poi_id}|{depth}|{profile or 'generic'}"
    return "content_" + hashlib.sha256(raw.encode()).hexdigest()[:16]


def _get_seasonal_hook() -> str:
    month = datetime.now(timezone.utc).month
    return SEASONAL_HOOKS.get(month, "")


async def _generate_with_llm(
    poi: Dict[str, Any],
    depth: str,
    profile: Optional[str],
    context_trigger: Optional[str] = None,
) -> Optional[str]:
    """Call LLM to generate depth-adapted, profile-aware content."""
    if not _llm_key:
        return None

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        profile_cfg = COGNITIVE_PROFILES.get(profile or "") or {}
        tone_addendum = profile_cfg.get("narrative_tone", "")
        depth_addendum = DEPTH_SYSTEM_ADDENDUM.get(depth, "")
        seasonal_hook = _get_seasonal_hook()

        system_msg = (
            "És um especialista em conteúdo cultural e turístico português. "
            "Escreve sempre em português de Portugal — culto, fluido e autêntico. "
            "Nunca uses frases genéricas como 'ponto de interesse' ou 'vale a pena visitar'. "
            f"{tone_addendum} "
            f"{depth_addendum}"
        )

        context_note = ""
        if context_trigger and context_trigger in CONTEXTUAL_TRIGGERS:
            context_note = f"\nContexto adicional: {CONTEXTUAL_TRIGGERS[context_trigger]}"

        seasonal_note = f"\nContexto sazonal: {seasonal_hook}" if seasonal_hook else ""

        user_msg = (
            f"POI: {poi.get('name', '')}\n"
            f"Categoria: {poi.get('category', '')}\n"
            f"Região: {poi.get('region', 'Portugal')}\n"
            f"Descrição base: {(poi.get('description') or '')[:400]}\n"
            f"Tags: {', '.join((poi.get('tags') or [])[:8])}\n"
            f"{seasonal_note}{context_note}\n\n"
            f"Gera o conteúdo de nível '{depth}' para este POI:"
        )

        session_id = _cache_key(poi.get("id", "?"), depth, profile)
        chat = LlmChat(
            api_key=_llm_key,
            session_id=session_id,
            system_message=system_msg,
        ).with_model("openai", "gpt-4o-mini")

        response = await chat.send_message(UserMessage(text=user_msg))
        return str(response).strip()

    except Exception as e:
        logger.warning(f"LLM content generation failed: {e}")
        return None


def _template_snackable(poi: Dict, profile: Optional[str]) -> str:
    """Fallback template for snackable content."""
    profile_cfg = COGNITIVE_PROFILES.get(profile or "") or {}
    hook = profile_cfg.get("micro_story_hook", "Descubra este lugar.")
    name = poi.get("name", "Este lugar")
    region = poi.get("region", "Portugal")
    desc = (poi.get("description") or "")[:120]
    seasonal = _get_seasonal_hook()
    return f"{seasonal} {name}, em {region} — {desc} {hook}"[:300]


def _template_micro_story(poi: Dict, profile: Optional[str], trigger: Optional[str]) -> str:
    """Generate a 15-30s micro-story text."""
    name = poi.get("name", "Este local")
    region = poi.get("region", "Portugal")
    category = poi.get("category", "")
    desc = (poi.get("description") or "")[:100]

    profile_cfg = COGNITIVE_PROFILES.get(profile or "") or {}
    hook = profile_cfg.get("micro_story_hook", "Vale a pena visitar.")

    context_line = ""
    if trigger and trigger in CONTEXTUAL_TRIGGERS:
        context_line = CONTEXTUAL_TRIGGERS[trigger] + " "

    seasonal = _get_seasonal_hook()
    if seasonal:
        intro = seasonal
    else:
        intros = [
            f"Em {region}, há um lugar que poucos conhecem:",
            f"Se um dia passar por {region}, não passe à frente de",
            f"Há algo em {name} que não se encontra em guias turísticos:",
        ]
        intro = random.choice(intros)

    return f"{intro} {name}. {context_line}{desc} {hook}"[:250]


# ──────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

@content_strategy_router.post("/depth")
async def get_depth_content(request: ContentDepthRequest):
    """
    Return depth-adapted, profile-aware content for a single POI.

    Checks cache first (stored in heritage_items.content_cache).
    Falls back to LLM → template if cache miss.

    depth:
      snackable    — 30-60s hook text
      historia     — 3-5min narrative
      enciclopedico — full scholarly text
    """
    db = _get_db()
    poi = await db.heritage_items.find_one({"id": request.poi_id}, {"_id": 0})
    if not poi:
        raise HTTPException(status_code=404, detail="POI não encontrado")

    cache_field = _cache_key(request.poi_id, request.depth, request.cognitive_profile)

    # Check existing cache
    content_cache: Dict = poi.get("content_cache", {})
    if not request.force_regenerate and cache_field in content_cache:
        cached = content_cache[cache_field]
        return {
            "poi_id": request.poi_id,
            "depth": request.depth,
            "cognitive_profile": request.cognitive_profile,
            "content": cached["text"],
            "generated_at": cached.get("generated_at"),
            "source": "cache",
        }

    # Generate via LLM
    text = await _generate_with_llm(poi, request.depth, request.cognitive_profile)

    # Fallback template
    if not text:
        if request.depth == "snackable":
            text = _template_snackable(poi, request.cognitive_profile)
        elif request.depth == "historia":
            desc = poi.get("description") or ""
            text = f"{poi.get('name', '')} — {desc[:600]}" if desc else _template_snackable(poi, request.cognitive_profile)
        else:
            text = poi.get("description") or _template_snackable(poi, request.cognitive_profile)

    # Persist to cache
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.heritage_items.update_one(
        {"id": request.poi_id},
        {"$set": {f"content_cache.{cache_field}": {"text": text, "generated_at": now_iso}}}
    )

    return {
        "poi_id": request.poi_id,
        "depth": request.depth,
        "cognitive_profile": request.cognitive_profile,
        "content": text,
        "generated_at": now_iso,
        "source": "llm" if _llm_key else "template",
    }


@content_strategy_router.post("/micro-stories")
async def get_micro_stories(request: MicroStoryRequest):
    """
    Generate 15-30s micro-stories for a list of POI IDs.
    Used between locations during a route walk.
    Includes seasonal and contextual hooks.
    """
    db = _get_db()

    pois = await db.heritage_items.find(
        {"id": {"$in": request.poi_ids}},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "description": 1, "tags": 1}
    ).to_list(length=10)

    poi_map = {p["id"]: p for p in pois}

    stories = []
    for poi_id in request.poi_ids:
        poi = poi_map.get(poi_id)
        if not poi:
            continue

        # Try LLM micro-story (very short, so fast)
        llm_text = None
        if _llm_key:
            mini_prompt = (
                f"POI: {poi.get('name')} | Região: {poi.get('region')} | "
                f"Categoria: {poi.get('category')} | "
                f"Descrição: {(poi.get('description') or '')[:150]}\n\n"
                f"Gera uma micro-história de 2-3 frases (máx 160 caracteres) "
                f"para ler entre dois locais numa rota. "
                f"Começa com um facto surpreendente. "
                f"Tom: {'entusiasta' if request.cognitive_profile == 'natureza_radical' else 'evocativo'}."
            )
            try:
                from emergentintegrations.llm.chat import LlmChat, UserMessage
                chat = LlmChat(
                    api_key=_llm_key,
                    session_id=f"micro_{poi_id}_{request.cognitive_profile}",
                    system_message="És um guia cultural português conciso e fascinante.",
                ).with_model("openai", "gpt-4o-mini")
                llm_text = str(await chat.send_message(UserMessage(text=mini_prompt))).strip()
                if len(llm_text) > 200:
                    llm_text = llm_text[:197] + "…"
            except Exception:
                pass

        text = llm_text or _template_micro_story(poi, request.cognitive_profile, request.context_trigger)

        stories.append({
            "poi_id": poi_id,
            "poi_name": poi.get("name"),
            "category": poi.get("category"),
            "text": text,
            "estimated_read_seconds": max(15, min(30, len(text.split()) * 2)),
            "seasonal_hook": _get_seasonal_hook(),
            "context_trigger": request.context_trigger,
            "has_audio": False,  # flag for future TTS integration
        })

    return {
        "stories": stories,
        "cognitive_profile": request.cognitive_profile,
        "total": len(stories),
    }


@content_strategy_router.post("/profile-feed")
async def get_profile_feed(request: ProfileFeedRequest):
    """
    Return a cognitively-adapted discovery feed.
    Boosts POIs matching the profile's priority categories.
    Annotates each POI with the profile's micro-story hook.
    """
    db = _get_db()

    profile_cfg = COGNITIVE_PROFILES.get(request.cognitive_profile)
    if not profile_cfg:
        raise HTTPException(
            status_code=400,
            detail=f"Perfil desconhecido. Válidos: {list(COGNITIVE_PROFILES.keys())}"
        )

    priority_cats = profile_cfg["priority_categories"]
    boosts = profile_cfg["feed_boost"]

    # Base query: priority categories
    query: Dict = {
        "category": {"$in": priority_cats},
        "location": {"$exists": True},
    }
    if request.exclude_ids:
        query["id"] = {"$nin": request.exclude_ids}

    pois = await db.heritage_items.find(
        query,
        {
            "_id": 0,
            "id": 1, "name": 1, "category": 1, "region": 1,
            "description": 1, "image_url": 1, "iq_score": 1,
            "location": 1, "tags": 1,
        }
    ).limit(request.limit * 2).to_list(length=request.limit * 2)

    # Score and sort
    def _feed_score(poi: Dict) -> float:
        cat = poi.get("category", "")
        iq = float(poi.get("iq_score") or 50)
        boost = boosts.get(cat, 1.0)
        return iq * boost

    pois.sort(key=_feed_score, reverse=True)
    pois = pois[: request.limit]

    hook = profile_cfg.get("micro_story_hook", "")
    seasonal = _get_seasonal_hook()

    return {
        "cognitive_profile": request.cognitive_profile,
        "profile_label": profile_cfg["label"],
        "profile_emoji": profile_cfg["emoji"],
        "seasonal_hook": seasonal,
        "preferred_route_theme": profile_cfg.get("route_preference"),
        "feed": [
            {
                "id": p.get("id"),
                "name": p.get("name"),
                "category": p.get("category"),
                "region": p.get("region"),
                "image_url": p.get("image_url"),
                "iq_score": p.get("iq_score"),
                "hook": hook,
                "feed_score": round(_feed_score(p), 1),
                "snackable_preview": (p.get("description") or "")[:120],
            }
            for p in pois
        ],
        "total": len(pois),
    }


@content_strategy_router.get("/profiles")
async def list_cognitive_profiles():
    """Return all available cognitive profiles with metadata."""
    return {
        "profiles": [
            {
                "id": pid,
                "label": cfg["label"],
                "emoji": cfg["emoji"],
                "priority_categories": cfg["priority_categories"][:4],
                "micro_story_hook": cfg["micro_story_hook"],
            }
            for pid, cfg in COGNITIVE_PROFILES.items()
        ]
    }


@content_strategy_router.get("/seasonal")
async def get_seasonal_content(
    region: Optional[str] = Query(None),
    limit: int = Query(10, ge=3, le=30),
):
    """
    Return seasonally relevant POIs + contextual hook for the current month.
    Filters by region if provided.
    """
    db = _get_db()
    month = datetime.now(timezone.utc).month

    # Month → relevant categories / tags
    MONTH_BOOSTS: Dict[int, List[str]] = {
        1:  ["museus", "termas_banhos", "gastronomia"],
        2:  ["flora_autoctone", "festas_romarias", "gastronomia"],    # amendoeiras
        3:  ["percursos_pedestres", "flora_autoctone", "natureza_especializada"],
        4:  ["percursos_pedestres", "cascatas_pocos", "praias_fluviais"],
        5:  ["percursos_pedestres", "flora_autoctone", "miradouros", "fauna_autoctone"],
        6:  ["praias_fluviais", "surf", "aventura_natureza", "mercados_feiras"],
        7:  ["praias_fluviais", "surf", "festas_romarias", "cascatas_pocos"],
        8:  ["praias_fluviais", "surf", "aventura_natureza", "miradouros"],
        9:  ["produtores_dop", "gastronomia", "rotas_tematicas"],     # vindimas
        10: ["natureza_especializada", "flora_autoctone", "percursos_pedestres"],
        11: ["museus", "festas_romarias", "gastronomia"],
        12: ["termas_banhos", "museus", "festas_romarias", "gastronomia"],
    }

    cats = MONTH_BOOSTS.get(month, ["museus", "percursos_pedestres"])
    query: Dict = {"category": {"$in": cats}}
    if region:
        query["region"] = {"$regex": region, "$options": "i"}

    pois = await db.heritage_items.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "category": 1, "region": 1, "image_url": 1, "description": 1}
    ).sort("iq_score", -1).limit(limit).to_list(length=limit)

    return {
        "month": month,
        "seasonal_hook": SEASONAL_HOOKS.get(month, ""),
        "highlight_categories": cats,
        "region_filter": region,
        "pois": [
            {
                "id": p["id"],
                "name": p["name"],
                "category": p.get("category"),
                "region": p.get("region"),
                "image_url": p.get("image_url"),
                "snackable": (p.get("description") or "")[:120],
            }
            for p in pois
        ],
    }


@content_strategy_router.get("/depth-levels")
async def get_depth_levels():
    """Return depth level metadata for UI rendering."""
    return {
        "levels": [
            {
                "id": "snackable",
                "label": "Resumo",
                "icon": "flash-on",
                "read_time": "30-60s",
                "description": "Gancho rápido — ideal para decidir se quer saber mais",
            },
            {
                "id": "historia",
                "label": "História",
                "icon": "menu-book",
                "read_time": "3-5 min",
                "description": "Narrativa completa com contexto histórico e cultural",
            },
            {
                "id": "enciclopedico",
                "label": "Enciclopédia",
                "icon": "library-books",
                "read_time": "7-12 min",
                "description": "Nível scholar — para os mais curiosos e investigadores",
            },
        ]
    }
