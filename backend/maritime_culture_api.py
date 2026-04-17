"""
Maritime Culture API — Rituais, Festas e Procissões Marítimas
MongoDB Atlas (Motor async) · FastAPI
"""
from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from pydantic import BaseModel, Field

from models.api_models import User

maritime_culture_router = APIRouter(prefix="/maritime-culture", tags=["Maritime Culture"])

_db = None
_llm_key: str = ""
_require_auth = None


def set_maritime_culture_db(database) -> None:
    global _db
    _db = database


def set_maritime_culture_llm_key(key: str) -> None:
    global _llm_key
    _llm_key = key


def set_maritime_culture_auth(auth_fn) -> None:
    global _require_auth
    _require_auth = auth_fn


async def _auth_dep(request: Request) -> User:
    return await _require_auth(request)


# ─── Seed data ───────────────────────────────────────────────────────────────

SEED_EVENTS: List[Dict[str, Any]] = [
    {
        "_id": "mc_001",
        "name": "Festa de Nossa Senhora da Agonia",
        "type": "procissao_maritima",
        "region": "Minho",
        "municipality": "Viana do Castelo",
        "month": 8,
        "date_start": "3º fin-de-semana de Agosto",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "A maior festa minhota, com procissão ao mar de barcos engalanados, tapetes de flores e cortejo etnográfico.",
        "description_long": "Celebrada desde o séc. XVIII em honra de Nossa Senhora da Agonia, padroeira dos pescadores. Inclui procissão marítima com dezenas de barcos decorados, tapetes de flores na rua, arraiais, concertos e o famoso cortejo etnográfico regional. Um dos maiores eventos culturais do Norte de Portugal.",
        "saint_or_symbol": "Nossa Senhora da Agonia",
        "boats_involved": 40,
        "activities": ["procissão marítima", "tapetes de flores", "cortejo etnográfico", "arraial", "fogo de artifício"],
        "gastronomy_links": ["papas de sarrabulho", "rojões à minhota", "vinho verde"],
        "tags": ["procissão", "barcos", "minhota", "flores", "maior"],
        "lat": 41.6934,
        "lng": -8.8301,
        "iq_score": 99,
    },
    {
        "_id": "mc_002",
        "name": "Banho Santo de São Bartolomeu",
        "type": "banho_santo",
        "region": "Minho",
        "municipality": "Esposende",
        "month": 8,
        "date_start": "24 de Agosto",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "Ritual pré-cristão de purificação no mar na praia de Ofir, na véspera de São Bartolomeu. Mistura de paganismo e catolicismo.",
        "description_long": "Na noite de 23 para 24 de Agosto, centenas de pessoas mergulham no mar na praia de Ofir em jejum ritual. A tradição, de origem provavelmente pré-romana, foi absorvida pelo calendário cristão. Acredita-se que as águas têm poderes curativos nessa noite específica.",
        "saint_or_symbol": "São Bartolomeu",
        "activities": ["banho ritual noturno", "fogueiras", "danças populares", "peregrinação"],
        "tags": ["pré-cristão", "purificação", "ritual", "Ofir", "noturno"],
        "lat": 41.5512,
        "lng": -8.7893,
        "iq_score": 95,
    },
    {
        "_id": "mc_003",
        "name": "Bênção dos Bacalhoeiros de Ílhavo",
        "type": "bencao_barcos",
        "region": "Centro",
        "municipality": "Ílhavo",
        "month": 6,
        "date_start": "Junho (data variável)",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "Cerimónia que abençoa os lugres e barcos da frota bacalhoeira antes da partida para os Mares do Norte e Terra Nova.",
        "description_long": "Ílhavo foi o principal porto bacalhoeiro de Portugal. A bênção da frota, com os barcos decorados e as famílias dos pescadores no cais, é uma das tradições mais emocionantes da costa portuguesa. O Museu Marítimo de Ílhavo preserva esta história.",
        "saint_or_symbol": "Nossa Senhora da Boa Viagem",
        "boats_involved": 15,
        "activities": ["bênção episcopal", "desfile de barcos", "missa dos pescadores", "exposição marítima"],
        "gastronomy_links": ["bacalhau à lagareiro", "bacalhau com natas"],
        "tags": ["bacalhau", "lugres", "bênção", "Ílhavo", "Terra Nova"],
        "lat": 40.6017,
        "lng": -8.6711,
        "iq_score": 92,
    },
    {
        "_id": "mc_004",
        "name": "Procissão de Nossa Senhora da Boa Viagem",
        "type": "procissao_maritima",
        "region": "Norte",
        "municipality": "Matosinhos",
        "month": 6,
        "date_start": "Junho",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "Procissão marítima com mais de 100 barcos de pesca engalanados no porto de Leixões, em honra da padroeira dos pescadores.",
        "saint_or_symbol": "Nossa Senhora da Boa Viagem",
        "boats_involved": 120,
        "activities": ["procissão marítima", "bênção dos barcos", "fogo de artifício", "arraial"],
        "gastronomy_links": ["sardinha assada", "mariscos de Matosinhos"],
        "tags": ["Leixões", "pescadores", "Matosinhos", "maior procissão norte"],
        "lat": 41.1854,
        "lng": -8.6922,
        "iq_score": 93,
    },
    {
        "_id": "mc_005",
        "name": "Festa do Mar de Matosinhos",
        "type": "festa_mar",
        "region": "Norte",
        "municipality": "Matosinhos",
        "month": 6,
        "date_start": "Junho (Festa de São Pedro)",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "Festival gastronómico e cultural junto ao mar com sardinhas assadas, música e homenagem à cultura piscatória.",
        "activities": ["sardinhas assadas", "música ao vivo", "espetáculos", "mercado artesanal"],
        "gastronomy_links": ["sardinha assada", "mariscos", "polvo grelhado"],
        "tags": ["gastronomia", "sardinha", "cultura piscatória", "festa"],
        "lat": 41.1854,
        "lng": -8.6922,
        "iq_score": 88,
    },
    {
        "_id": "mc_006",
        "name": "Procissão dos Pescadores de Nazaré",
        "type": "procissao_maritima",
        "region": "Centro",
        "municipality": "Nazaré",
        "month": 9,
        "date_start": "8 de Setembro (Nossa Senhora da Nazaré)",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "Procissão da imagem de Nossa Senhora da Nazaré da Sítio até à praia, com barca dos pescadores e trajes típicos.",
        "saint_or_symbol": "Nossa Senhora da Nazaré",
        "boats_involved": 20,
        "activities": ["procissão pedestre", "descida ao mar", "trajes típicos das varinas", "missa na praia"],
        "gastronomy_links": ["caldeirada de peixe", "peixe seco", "filetes de polvo"],
        "tags": ["Nazaré", "varinas", "sete saias", "Senhora da Nazaré"],
        "lat": 39.6016,
        "lng": -9.0713,
        "iq_score": 96,
    },
    {
        "_id": "mc_007",
        "name": "Festa da Nossa Senhora da Assunção",
        "type": "festa_mar",
        "region": "Norte",
        "municipality": "Póvoa de Varzim",
        "month": 8,
        "date_start": "15 de Agosto",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "Festa padroeira da cidade com procissão marítima de barcos e arraial nas praias da Póvoa.",
        "saint_or_symbol": "Nossa Senhora da Assunção",
        "boats_involved": 30,
        "activities": ["procissão marítima", "arraial", "fogo de artifício", "concurso de pesca"],
        "tags": ["Póvoa de Varzim", "pesca", "Assunção"],
        "lat": 41.3803,
        "lng": -8.7609,
        "iq_score": 87,
    },
    {
        "_id": "mc_008",
        "name": "Festas do Senhor Santo Cristo dos Milagres",
        "type": "ritual_religioso",
        "region": "Açores",
        "municipality": "Ponta Delgada",
        "month": 5,
        "date_start": "5º Domingo após a Páscoa",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "A maior manifestação religiosa dos Açores e da diáspora açoriana, com procissão solene e flores à imagem do Senhor Santo Cristo.",
        "saint_or_symbol": "Senhor Santo Cristo dos Milagres",
        "activities": ["procissão solene", "tapetes de flores", "foguetes", "peregrinação da diáspora"],
        "tags": ["Açores", "diáspora", "maior festa açoriana", "flores"],
        "lat": 37.7412,
        "lng": -25.6756,
        "iq_score": 98,
    },
    {
        "_id": "mc_009",
        "name": "Tradição da Arte Xávega",
        "type": "tradicao_piscatoria",
        "region": "Centro",
        "municipality": "Nazaré",
        "month": 7,
        "date_start": "Verão (Junho–Setembro)",
        "is_recurring": True,
        "frequency": "sazonal",
        "description_short": "Técnica milenar de pesca com redes arrastadas do mar por bois e homens na praia. Demonstrações públicas no verão.",
        "description_long": "A arte xávega é uma das mais antigas técnicas de pesca da costa portuguesa. A rede é lançada do mar por uma barca e depois arrastada para a praia por bois e pescadores em equipa. Demonstrações regulares na Nazaré durante o verão.",
        "boats_involved": 1,
        "activities": ["demonstração pública", "lançamento da rede", "arrasto com bois", "venda do peixe na praia"],
        "gastronomy_links": ["peixe fresco grelhado", "caldeirada"],
        "tags": ["arte xávega", "bois", "pesca tradicional", "demonstração", "milenar"],
        "lat": 39.6016,
        "lng": -9.0713,
        "iq_score": 94,
    },
    {
        "_id": "mc_010",
        "name": "Procissão Fluvial do Douro",
        "type": "procissao_maritima",
        "region": "Norte",
        "municipality": "Porto",
        "month": 6,
        "date_start": "Junho (São João)",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "Procissão de barcos rabelos com pipas de vinho na noite de São João, ligando os cais do Porto a Gaia.",
        "saint_or_symbol": "São João Baptista",
        "boats_involved": 25,
        "activities": ["regata de barcos rabelos", "fogo de artifício", "arraial", "almoços de São João"],
        "gastronomy_links": ["sardinha assada", "vinho do Porto", "bifanas"],
        "tags": ["São João", "barcos rabelos", "Douro", "vinho do Porto"],
        "lat": 41.1414,
        "lng": -8.6139,
        "iq_score": 91,
    },
    {
        "_id": "mc_011",
        "name": "Festas do Mar de Sesimbra",
        "type": "festa_mar",
        "region": "Setúbal",
        "municipality": "Sesimbra",
        "month": 8,
        "date_start": "Agosto",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "Festa marítima na vila piscatória de Sesimbra com procissão de barcos decorados e concurso de pesca.",
        "boats_involved": 30,
        "activities": ["procissão de barcos", "concurso de pesca desportiva", "gastronomia", "espetáculos"],
        "gastronomy_links": ["choco frito", "peixe grelhado", "mariscos"],
        "tags": ["Sesimbra", "pesca", "vila piscatória"],
        "lat": 38.4437,
        "lng": -9.1026,
        "iq_score": 83,
    },
    {
        "_id": "mc_012",
        "name": "Bênção da Frota Pesqueira de Olhão",
        "type": "bencao_barcos",
        "region": "Algarve",
        "municipality": "Olhão",
        "month": 10,
        "date_start": "Outubro",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "Cerimónia de bênção da frota pesqueira de Olhão antes do inverno, com barcos da Ria Formosa.",
        "saint_or_symbol": "Nossa Senhora do Rosário",
        "boats_involved": 50,
        "activities": ["bênção episcopal", "desfile de barcos", "missa dos pescadores"],
        "gastronomy_links": ["amêijoas à bulhão pato", "cataplana", "percebes"],
        "tags": ["Olhão", "Ria Formosa", "Algarve", "bênção"],
        "lat": 37.0280,
        "lng": -7.8413,
        "iq_score": 85,
    },
    {
        "_id": "mc_013",
        "name": "Festa de São Pedro de Peniche",
        "type": "festa_mar",
        "region": "Oeste",
        "municipality": "Peniche",
        "month": 6,
        "date_start": "29 de Junho",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "Festa do padroeiro dos pescadores em Peniche com procissão, concurso de pesca e gastronomia de mar.",
        "saint_or_symbol": "São Pedro",
        "boats_involved": 20,
        "activities": ["procissão marítima", "concurso de pesca", "arraial", "gastronomia"],
        "gastronomy_links": ["percebes de Peniche", "caldeirada", "peixe espada"],
        "tags": ["São Pedro", "Peniche", "percebes", "surf"],
        "lat": 39.3563,
        "lng": -9.3827,
        "iq_score": 86,
    },
    {
        "_id": "mc_014",
        "name": "Romaria ao Senhor dos Navegantes",
        "type": "ritual_religioso",
        "region": "Centro",
        "municipality": "Aveiro",
        "month": 8,
        "date_start": "Agosto",
        "is_recurring": True,
        "frequency": "anual",
        "description_short": "Procissão fluvial nos canais de Aveiro com barcos moliceiros decorados em honra do Senhor dos Navegantes.",
        "saint_or_symbol": "Senhor dos Navegantes",
        "boats_involved": 35,
        "activities": ["procissão fluvial", "barcos moliceiros decorados", "fogo de artifício", "arraial"],
        "gastronomy_links": ["ovos moles de Aveiro", "bacalhau à lagareiro"],
        "tags": ["Aveiro", "moliceiros", "canais", "fluvial"],
        "lat": 40.6405,
        "lng": -8.6538,
        "iq_score": 89,
    },
]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _serialize(doc: Dict) -> Dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id", doc.get("id", "")))
    return doc


async def _col_or_seed(col: str, seed: List[Dict]) -> List[Dict]:
    if _db is None:
        return [dict(d) for d in seed]
    try:
        docs = await _db[col].find({}).to_list(500)
        if docs:
            return [_serialize(d) for d in docs]
    except Exception:
        pass
    return [dict(d) for d in seed]


def _is_upcoming(event: Dict, window_months: int = 2) -> bool:
    """True if event month is within window_months from now."""
    current = datetime.now(timezone.utc).month
    event_month = event.get("month", 0)
    if not event_month:
        return False
    diff = (event_month - current) % 12
    return diff <= window_months


# ─── Endpoints ───────────────────────────────────────────────────────────────

@maritime_culture_router.get("/events")
async def list_events(
    type: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    upcoming: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    items = await _col_or_seed("maritime_events", SEED_EVENTS)

    if type:
        items = [i for i in items if i.get("type") == type]
    if region:
        items = [i for i in items if region.lower() in i.get("region", "").lower()]
    if month:
        items = [i for i in items if i.get("month") == month]
    if upcoming is True:
        items = [i for i in items if _is_upcoming(i)]
    if search:
        pat = re.compile(search, re.IGNORECASE)
        items = [i for i in items if pat.search(
            i.get("name", "") + " " + i.get("description_short", "") + " " + i.get("municipality", "")
        )]

    # Annotate is_upcoming
    for item in items:
        item["is_upcoming"] = _is_upcoming(item)

    total = len(items)
    items_sorted = sorted(items, key=lambda x: x.get("month", 13))
    return {"total": total, "offset": offset, "limit": limit, "results": items_sorted[offset: offset + limit]}


@maritime_culture_router.get("/events/upcoming")
async def upcoming_events(window_months: int = Query(2, ge=1, le=6)):
    items = await _col_or_seed("maritime_events", SEED_EVENTS)
    results = [
        {**i, "is_upcoming": True}
        for i in items
        if _is_upcoming(i, window_months)
    ]
    results.sort(key=lambda x: x.get("month", 13))
    return {
        "current_month": datetime.now(timezone.utc).month,
        "window_months": window_months,
        "total": len(results),
        "results": results,
    }


@maritime_culture_router.get("/events/nearby")
async def events_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(80.0, le=500.0),
    upcoming_only: bool = Query(False),
    limit: int = Query(20, le=100),
):
    items = await _col_or_seed("maritime_events", SEED_EVENTS)
    results = []
    for item in items:
        if upcoming_only and not _is_upcoming(item):
            continue
        dist = _haversine(lat, lng, item.get("lat", 0), item.get("lng", 0))
        if dist <= radius_km:
            results.append({**item, "distance_km": round(dist, 1), "is_upcoming": _is_upcoming(item)})
    results.sort(key=lambda x: x.get("distance_km", 9999))
    return {"lat": lat, "lng": lng, "radius_km": radius_km, "total": len(results), "results": results[:limit]}


@maritime_culture_router.get("/events/{event_id}")
async def get_event_detail(event_id: str):
    items = await _col_or_seed("maritime_events", SEED_EVENTS)
    for item in items:
        if str(item.get("_id", item.get("id", ""))) == event_id:
            return {**item, "is_upcoming": _is_upcoming(item)}
    raise HTTPException(status_code=404, detail="Evento não encontrado")


# ─── AI Narrative ─────────────────────────────────────────────────────────────

class NarrativeRequest(BaseModel):
    event_id: str
    style: str = Field(default="cultural", description="cultural | children | academic | tourism")
    language: str = Field(default="pt", description="pt | en | es | fr")


@maritime_culture_router.post("/narrative")
async def generate_narrative(
    body: NarrativeRequest,
    current_user: User = Depends(_auth_dep),
):
    items = await _col_or_seed("maritime_events", SEED_EVENTS)
    event = next((i for i in items if str(i.get("_id", i.get("id", ""))) == body.event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    style_map = {
        "cultural": "narrativa cultural aprofundada com contexto histórico e espiritual",
        "children": "texto simples e divertido para crianças dos 8 aos 12 anos",
        "academic": "texto académico com referências etnográficas e antropológicas",
        "tourism": "texto turístico convidativo que motive a visita",
    }
    style_desc = style_map.get(body.style, style_map["cultural"])
    lang_map = {"pt": "português de Portugal", "en": "English", "es": "español", "fr": "français"}
    lang = lang_map.get(body.language, "português de Portugal")

    prompt = f"""Escreve uma {style_desc} em {lang} sobre o seguinte evento cultural marítimo português:

Nome: {event['name']}
Tipo: {event['type']}
Município: {event.get('municipality', '')}
Data: {event.get('date_start', '')}
Santo/Símbolo: {event.get('saint_or_symbol', 'N/A')}
Descrição base: {event.get('description_long', event.get('description_short', ''))}
Actividades: {', '.join(event.get('activities', []))}

Responde em JSON com:
{{
  "title": "título evocador",
  "narrative": "texto de 150-200 palavras",
  "key_facts": ["facto 1", "facto 2", "facto 3"],
  "visitor_tip": "dica prática para visitantes"
}}"""

    fallback = {
        "title": event["name"],
        "narrative": event.get("description_long", event.get("description_short", "")),
        "key_facts": event.get("activities", [])[:3],
        "visitor_tip": f"Visite {event.get('municipality', '')} durante o evento para uma experiência autêntica.",
        "source": "fallback",
    }

    if not _llm_key:
        return fallback

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://llm.lil.re.emergentmethods.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {_llm_key}", "Content-Type": "application/json"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7,
                    "response_format": {"type": "json_object"},
                },
            )
        import json as _json
        content = resp.json()["choices"][0]["message"]["content"]
        return _json.loads(content)
    except Exception:
        return fallback


# ─── Routes ──────────────────────────────────────────────────────────────────

THEMED_ROUTES = [
    {
        "id": "route_procissoes",
        "name": "Rota das Procissões ao Mar",
        "type": "procissoes",
        "region": "Costa Atlântica",
        "description": "Da Póvoa de Varzim a Setúbal, seguindo as grandes procissões marítimas do litoral português.",
        "stops": ["Póvoa de Varzim", "Matosinhos", "Aveiro", "Nazaré", "Sesimbra"],
        "duration_days": 4,
        "best_months": [6, 8, 9],
        "iq_score": 94,
    },
    {
        "id": "route_festas_norte",
        "name": "Rota das Festas do Mar do Norte",
        "type": "festas",
        "region": "Minho / Norte",
        "description": "De Viana do Castelo ao Porto, pelas maiores festas marítimas do Norte.",
        "stops": ["Viana do Castelo", "Esposende", "Póvoa de Varzim", "Matosinhos"],
        "duration_days": 3,
        "best_months": [6, 7, 8],
        "iq_score": 97,
    },
    {
        "id": "route_tradicoes",
        "name": "Rota das Tradições Piscatórias",
        "type": "tradicoes",
        "region": "Costa Centro",
        "description": "Nazaré, Ílhavo e Peniche — as capitais vivas da pesca artesanal e das suas tradições.",
        "stops": ["Ílhavo", "Nazaré", "Peniche"],
        "duration_days": 2,
        "best_months": [6, 7, 8, 9],
        "iq_score": 91,
    },
]


@maritime_culture_router.get("/routes")
async def list_routes():
    return {"total": len(THEMED_ROUTES), "routes": THEMED_ROUTES}


# ─── Stats ───────────────────────────────────────────────────────────────────

@maritime_culture_router.get("/stats")
async def culture_stats():
    items = await _col_or_seed("maritime_events", SEED_EVENTS)
    by_type: Dict[str, int] = {}
    upcoming_count = 0
    for item in items:
        t = item.get("type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1
        if _is_upcoming(item):
            upcoming_count += 1

    return {
        "total_events": len(items),
        "by_type": by_type,
        "upcoming_count": upcoming_count,
        "current_month": datetime.now(timezone.utc).month,
        "themed_routes": len(THEMED_ROUTES),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
