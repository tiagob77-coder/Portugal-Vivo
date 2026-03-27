"""
Portugal Vivo — Linha do Tempo Regional
Timeline API: historical events, figures, periods and linked POIs per region.

Concept:
  Each region has a chronological timeline that connects:
    - Historical dates & periods (século, reinado, guerra, descoberta)
    - Key historical figures (reis, arquitetos, poets, navigators)
    - Festivals and recurring annual events
    - Natural phenomena (migrations, blooms, harvests)
    - Linked POIs (castelos, museus, sítios arqueológicos)

Example: Minho timeline connects Guimarães (fundação de Portugal 1128),
  Celtas, Romanos, Viriato, feira de Barcelos, Festas Gualterianas, etc.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

timeline_router = APIRouter(prefix="/timeline", tags=["Timeline"])

_db_holder = DatabaseHolder("timeline")
set_timeline_db = _db_holder.set
_get_db = _db_holder.get

_llm_key: str = ""


def set_timeline_llm_key(key: str) -> None:
    global _llm_key
    _llm_key = key


# ──────────────────────────────────────────────────────────────────────────────
# SEED DATA — Curated timelines per region
# ──────────────────────────────────────────────────────────────────────────────

REGION_TIMELINES: Dict[str, List[Dict]] = {
    "minho": [
        {
            "year": -800,
            "era": "Pré-História",
            "event": "Povos celtas constroem castros no Minho — alguns visíveis hoje",
            "event_type": "historia",
            "related_categories": ["arqueologia_geologia"],
            "figure": None,
            "poi_hint": "Castro de Briteiros, Braga",
            "emoji": "🏰",
        },
        {
            "year": -140,
            "era": "Romanização",
            "event": "Fundação de Bracara Augusta (Braga) como capital da Gallaecia romana",
            "event_type": "historia",
            "related_categories": ["arqueologia_geologia", "museus"],
            "figure": "Imperador Augusto",
            "poi_hint": "Termas Romanas de Braga",
            "emoji": "🏛️",
        },
        {
            "year": 1128,
            "era": "Fundação de Portugal",
            "event": "Batalha de São Mamede — Afonso Henriques derrota a mãe e torna-se Senhor de Portugal",
            "event_type": "historia",
            "related_categories": ["castelos"],
            "figure": "D. Afonso Henriques",
            "poi_hint": "Castelo de Guimarães",
            "emoji": "⚔️",
        },
        {
            "year": 1139,
            "era": "Fundação de Portugal",
            "event": "Batalha de Ourique — Portugal proclamado reino",
            "event_type": "historia",
            "related_categories": ["castelos", "museus"],
            "figure": "D. Afonso Henriques",
            "poi_hint": "Paço dos Duques de Bragança, Guimarães",
            "emoji": "👑",
        },
        {
            "year": 1250,
            "era": "Medieval",
            "event": "Expansão das feiras medievais — a Feira de Barcelos tem raízes neste século",
            "event_type": "cultura",
            "related_categories": ["mercados_feiras", "festas_romarias"],
            "figure": None,
            "poi_hint": "Campo da Feira, Barcelos",
            "emoji": "🐓",
        },
        {
            "year": 1488,
            "era": "Descobrimentos",
            "event": "João II prepara em Braga a expedição que levou Bartolomeu Dias ao Cabo da Boa Esperança",
            "event_type": "historia",
            "related_categories": ["museus"],
            "figure": "D. João II",
            "poi_hint": "Museu Pio XII, Braga",
            "emoji": "⛵",
        },
        {
            "year": 1750,
            "era": "Barroco",
            "event": "Construção do Santuário do Bom Jesus do Monte — símbolo do barroco português",
            "event_type": "arquitetura",
            "related_categories": ["festas_romarias"],
            "figure": "Arcebispo de Braga",
            "poi_hint": "Bom Jesus do Monte, Braga",
            "emoji": "✝️",
        },
        {
            "year": 1810,
            "era": "Invasões Francesas",
            "event": "Batalha do Souto destruiu partes da região — Minho resistiu",
            "event_type": "historia",
            "related_categories": ["museus", "castelos"],
            "figure": "General Silveira",
            "poi_hint": "Museu Municipal de Viana do Castelo",
            "emoji": "🪖",
        },
        {
            "year": 2001,
            "era": "Contemporâneo",
            "event": "Guimarães classificada Património Mundial pela UNESCO",
            "event_type": "patrimonio",
            "related_categories": ["castelos", "museus"],
            "figure": None,
            "poi_hint": "Centro Histórico de Guimarães",
            "emoji": "🏅",
        },
        # Recurring annual events
        {
            "year": None,
            "recurring_month": 8,
            "era": "Anual",
            "event": "Festas Gualterianas de Guimarães — cortejos medievais em agosto",
            "event_type": "festa",
            "related_categories": ["festas_romarias"],
            "figure": None,
            "poi_hint": "Guimarães — centro histórico",
            "emoji": "🎭",
        },
        {
            "year": None,
            "recurring_month": 3,
            "era": "Anual",
            "event": "Feira de Barcelos — a maior feira semanal de Portugal às quintas-feiras",
            "event_type": "mercado",
            "related_categories": ["mercados_feiras", "oficios_artesanato"],
            "figure": None,
            "poi_hint": "Campo da República, Barcelos",
            "emoji": "🐓",
        },
    ],

    "lisboa": [
        {
            "year": -700,
            "era": "Fenícia / Pré-História",
            "event": "Fenícios estabelecem entreposto comercial na foz do Tejo",
            "event_type": "historia",
            "related_categories": ["arqueologia_geologia"],
            "figure": None,
            "poi_hint": "Museu Nacional de Arqueologia",
            "emoji": "⚓",
        },
        {
            "year": -138,
            "era": "Romanização",
            "event": "Olisipo torna-se municipium romano — anfiteatro, thermas, forum",
            "event_type": "historia",
            "related_categories": ["arqueologia_geologia", "museus"],
            "figure": "Júlio César",
            "poi_hint": "Teatro Romano de Lisboa",
            "emoji": "🏛️",
        },
        {
            "year": 711,
            "era": "Al-Ândalus",
            "event": "Mouros conquistam Lisboa — al-Ushbuna floresce durante 4 séculos",
            "event_type": "historia",
            "related_categories": ["castelos"],
            "figure": None,
            "poi_hint": "Castelo de São Jorge",
            "emoji": "🕌",
        },
        {
            "year": 1147,
            "era": "Reconquista",
            "event": "D. Afonso Henriques reconquista Lisboa com ajuda de cruzados",
            "event_type": "historia",
            "related_categories": ["castelos", "festas_romarias"],
            "figure": "D. Afonso Henriques",
            "poi_hint": "Castelo de São Jorge, Lisboa",
            "emoji": "⚔️",
        },
        {
            "year": 1498,
            "era": "Descobrimentos",
            "event": "Vasco da Gama parte de Lisboa e chega à Índia — mundo muda para sempre",
            "event_type": "historia",
            "related_categories": ["museus"],
            "figure": "Vasco da Gama",
            "poi_hint": "Torre de Belém / Padrão dos Descobrimentos",
            "emoji": "⛵",
        },
        {
            "year": 1502,
            "era": "Manuelino",
            "event": "Início da construção do Mosteiro dos Jerónimos — obra máxima do manuelino",
            "event_type": "arquitetura",
            "related_categories": ["festas_romarias", "museus"],
            "figure": "D. Manuel I",
            "poi_hint": "Mosteiro dos Jerónimos, Belém",
            "emoji": "⛪",
        },
        {
            "year": 1755,
            "era": "Iluminismo",
            "event": "Grande Terramoto de Lisboa (1 novembro) — 80% da cidade destruída",
            "event_type": "catastrofe",
            "related_categories": ["museus", "arte_urbana"],
            "figure": "Marquês de Pombal",
            "poi_hint": "Baixa Pombalina / Museu do Azulejo",
            "emoji": "🌊",
        },
        {
            "year": 1910,
            "era": "República",
            "event": "Proclamação da República Portuguesa em Lisboa",
            "event_type": "historia",
            "related_categories": ["museus"],
            "figure": "Teófilo Braga",
            "poi_hint": "Museu da Cidade, Lisboa",
            "emoji": "🇵🇹",
        },
        {
            "year": 1998,
            "era": "Contemporâneo",
            "event": "Expo 98 — Lisboa recebe a Exposição Mundial; nasce o Parque das Nações",
            "event_type": "cultura",
            "related_categories": ["arte_urbana", "museus"],
            "figure": None,
            "poi_hint": "Parque das Nações, Oceanário",
            "emoji": "🌍",
        },
        {
            "year": None,
            "recurring_month": 6,
            "era": "Anual",
            "event": "Festas de Lisboa — Santos Populares com marchas, sardinha e manjerico",
            "event_type": "festa",
            "related_categories": ["festas_romarias", "musica_tradicional"],
            "figure": None,
            "poi_hint": "Alfama, Mouraria, Intendente",
            "emoji": "🐟",
        },
    ],

    "alentejo": [
        {
            "year": -3000,
            "era": "Neolítico",
            "event": "Construção de antas e menires — Alentejo tem a maior concentração megalítica da Europa",
            "event_type": "historia",
            "related_categories": ["arqueologia_geologia"],
            "figure": None,
            "poi_hint": "Cromeleque dos Almendres, Évora",
            "emoji": "🗿",
        },
        {
            "year": 59,
            "era": "Romana",
            "event": "Julio César funda Ebora Liberalitas Julia — hoje Évora",
            "event_type": "historia",
            "related_categories": ["arqueologia_geologia", "museus"],
            "figure": "Júlio César",
            "poi_hint": "Templo Romano de Évora",
            "emoji": "🏛️",
        },
        {
            "year": 1166,
            "era": "Medieval",
            "event": "Geraldo Sem Pavor reconquista Évora aos Mouros",
            "event_type": "historia",
            "related_categories": ["castelos"],
            "figure": "Geraldo Sem Pavor",
            "poi_hint": "Sé Catedral de Évora",
            "emoji": "⚔️",
        },
        {
            "year": 1559,
            "era": "Renascimento",
            "event": "Fundação da Universidade de Évora — a segunda mais antiga de Portugal",
            "event_type": "cultura",
            "related_categories": ["museus"],
            "figure": "Cardeal Henrique",
            "poi_hint": "Universidade de Évora",
            "emoji": "📚",
        },
        {
            "year": 1986,
            "era": "Contemporâneo",
            "event": "Centro Histórico de Évora inscrito como Património Mundial UNESCO",
            "event_type": "patrimonio",
            "related_categories": ["museus", "castelos"],
            "figure": None,
            "poi_hint": "Évora — centro histórico",
            "emoji": "🏅",
        },
        {
            "year": None,
            "recurring_month": 9,
            "era": "Anual",
            "event": "Vindimas do Alentejo — colheita da uva nas adegas de Borba, Reguengos e Redondo",
            "event_type": "gastronomia",
            "related_categories": ["produtores_dop", "rotas_tematicas"],
            "figure": None,
            "poi_hint": "Adega Cartuxa, Évora",
            "emoji": "🍇",
        },
    ],

    "algarve": [
        {
            "year": -500,
            "era": "Fenícia/Cartaginesa",
            "event": "Fenícios e cartagineses exploram a costa algarviana",
            "event_type": "historia",
            "related_categories": ["arqueologia_geologia"],
            "figure": None,
            "poi_hint": "Museu Municipal de Faro",
            "emoji": "⚓",
        },
        {
            "year": 1189,
            "era": "Reconquista",
            "event": "D. Sancho I conquista Silves — capital do Algarve árabe",
            "event_type": "historia",
            "related_categories": ["castelos"],
            "figure": "D. Sancho I",
            "poi_hint": "Castelo de Silves",
            "emoji": "⚔️",
        },
        {
            "year": 1444,
            "era": "Descobrimentos",
            "event": "Lagos — ponto de partida das expedições de Infante D. Henrique",
            "event_type": "historia",
            "related_categories": ["museus"],
            "figure": "Infante D. Henrique",
            "poi_hint": "Mercado de Escravos, Lagos",
            "emoji": "⛵",
        },
        {
            "year": 1755,
            "era": "Terramoto",
            "event": "Terramoto e tsunami destroem Faro e grande parte da costa",
            "event_type": "catastrofe",
            "related_categories": ["museus"],
            "figure": None,
            "poi_hint": "Sé de Faro (reconstruída)",
            "emoji": "🌊",
        },
        {
            "year": None,
            "recurring_month": 7,
            "era": "Anual",
            "event": "Festival Sudoeste TMN — música internacional nas areias de Zambujeira do Mar",
            "event_type": "festa",
            "related_categories": ["festas_romarias"],
            "figure": None,
            "poi_hint": "Zambujeira do Mar, Odemira",
            "emoji": "🎵",
        },
    ],
}

# Short historical epochs for UI colour-coding
EPOCH_COLOURS: Dict[str, str] = {
    "Pré-História": "#8B6914",
    "Fenícia / Pré-História": "#8B6914",
    "Fenícia/Cartaginesa": "#8B6914",
    "Romanização": "#C25B0A",
    "Romana": "#C25B0A",
    "Al-Ândalus": "#1A6B3C",
    "Medieval": "#2A4A8B",
    "Reconquista": "#7B1A1A",
    "Fundação de Portugal": "#7B1A1A",
    "Descobrimentos": "#0A4A7B",
    "Manuelino": "#5A0A7B",
    "Renascimento": "#5A0A7B",
    "Barroco": "#7B5A0A",
    "Iluminismo": "#0A5A6B",
    "Invasões Francesas": "#6B1A0A",
    "República": "#0A6B2A",
    "Contemporâneo": "#2A2A2A",
    "Anual": "#C25B0A",
}

# Regions available
AVAILABLE_REGIONS = list(REGION_TIMELINES.keys())


# ──────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

@timeline_router.get("/{region}")
async def get_regional_timeline(
    region: str,
    year_from: Optional[int] = Query(None, description="Start year (negative = BCE)"),
    year_to: Optional[int] = Query(None, description="End year"),
    event_types: Optional[str] = Query(None, description="Comma-separated: historia,cultura,festa,gastronomia"),
    include_recurring: bool = Query(True),
):
    """
    Return the historical timeline for a region.

    Includes historical events, cultural milestones, recurring annual events,
    and linked POI hints.
    """
    db = _get_db()
    region_key = region.lower().strip()

    # Fetch curated timeline
    events = list(REGION_TIMELINES.get(region_key, []))

    # Also pull from DB (user/agent-created events)
    db_events = await db.timeline_events.find(
        {"region": {"$regex": region_key, "$options": "i"}},
        {"_id": 0}
    ).sort("year", 1).to_list(length=200)
    events.extend(db_events)

    # Filter by year range
    if year_from is not None:
        events = [e for e in events if e.get("year") is None or (e.get("year") or 9999) >= year_from]
    if year_to is not None:
        events = [e for e in events if e.get("year") is None or (e.get("year") or -9999) <= year_to]

    # Filter recurring events
    if not include_recurring:
        events = [e for e in events if e.get("year") is not None]

    # Filter by event_types
    if event_types:
        type_set = {t.strip() for t in event_types.split(",")}
        events = [e for e in events if e.get("event_type") in type_set]

    # Sort: historical events by year, recurring events by recurring_month at end
    historical = sorted([e for e in events if e.get("year") is not None], key=lambda x: x["year"])
    recurring = [e for e in events if e.get("year") is None]
    all_events = historical + recurring

    # Enrich with DB-linked POIs
    poi_hints = [e.get("poi_hint") for e in all_events if e.get("poi_hint")]
    linked_pois: Dict[str, Dict] = {}

    if poi_hints and db is not None:
        # Find POIs whose name approximately matches the hint
        for hint in poi_hints[:10]:
            hint_words = hint.split(",")[0].strip()
            poi = await db.heritage_items.find_one(
                {"name": {"$regex": hint_words[:20], "$options": "i"}},
                {"_id": 0, "id": 1, "name": 1, "category": 1, "image_url": 1, "region": 1}
            )
            if poi:
                linked_pois[hint] = poi

    # Add colour and linked POI to each event
    for event in all_events:
        era = event.get("era", "")
        event["era_colour"] = EPOCH_COLOURS.get(era, "#555555")
        hint = event.get("poi_hint")
        if hint and hint in linked_pois:
            event["linked_poi"] = linked_pois[hint]

    # Epoch summary for UI overview
    epochs_seen = {}
    for e in historical:
        era = e.get("era", "")
        if era and era not in epochs_seen:
            epochs_seen[era] = {
                "era": era,
                "colour": EPOCH_COLOURS.get(era, "#555"),
                "year_start": e.get("year"),
            }

    return {
        "region": region_key,
        "available_regions": AVAILABLE_REGIONS,
        "total_events": len(all_events),
        "year_span": {
            "from": all_events[0].get("year") if historical else None,
            "to": all_events[-1].get("year") if len(historical) > 1 else None,
        },
        "epochs": list(epochs_seen.values()),
        "events": all_events,
        "recurring_events": recurring,
    }


@timeline_router.get("/")
async def list_timelines():
    """List available regional timelines."""
    return {
        "available_regions": AVAILABLE_REGIONS,
        "total_events": {r: len(REGION_TIMELINES.get(r, [])) for r in AVAILABLE_REGIONS},
    }


@timeline_router.post("/events")
async def create_timeline_event(
    event: Dict,
):
    """
    Create a custom timeline event (used by AI content toolkit).
    Fields: region, year, era, event, event_type, figure, poi_hint, emoji
    """
    db = _get_db()

    required = ["region", "event", "event_type"]
    for field in required:
        if field not in event:
            raise HTTPException(status_code=400, detail=f"Campo obrigatório: {field}")

    event["created_at"] = datetime.now(timezone.utc).isoformat()
    event["source"] = "agent_toolkit"
    result = await db.timeline_events.insert_one(event)

    return {"created": True, "id": str(result.inserted_id)}


@timeline_router.get("/enrich/{poi_id}")
async def enrich_poi_timeline_context(poi_id: str):
    """
    Return the historical timeline events most relevant to a specific POI.
    Used to add contextual timeline snippets to POI detail pages.
    """
    db = _get_db()
    poi = await db.heritage_items.find_one({"id": poi_id}, {"_id": 0, "name": 1, "category": 1, "region": 1})
    if not poi:
        raise HTTPException(status_code=404, detail="POI não encontrado")

    region = (poi.get("region") or "").lower().split()[0][:10]
    events = REGION_TIMELINES.get(region, [])

    # Filter to category-relevant events
    cat = poi.get("category", "")
    relevant = [
        e for e in events
        if cat in (e.get("related_categories") or [])
        or (poi.get("name", "").lower()[:15] in (e.get("poi_hint") or "").lower())
    ][:5]

    return {
        "poi_id": poi_id,
        "poi_name": poi.get("name"),
        "region": region,
        "relevant_events": relevant,
        "timeline_url": f"/timeline/{region}",
    }
