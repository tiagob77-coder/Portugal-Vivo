"""
AI Itinerary API — Micro-itinerários personalizados e enriquecimento cultural
via LLM (Emergent/Claude-compatible API).

Endpoints:
  POST /ai/itinerary  — gera itinerário temático com POIs próximos
  POST /ai/enrich     — enriquece um POI com história/lenda/curiosidade
  GET  /ai/themes     — lista temas disponíveis
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import os
import math
import logging
import httpx
import datetime

logger = logging.getLogger(__name__)

ai_itinerary_router = APIRouter(prefix="/ai", tags=["AI Itinerary"])

_db = None
_LLM_URL = "https://llm.lil.re.emergentmethods.ai/v1/chat/completions"
_LLM_MODEL = "gpt-4o-mini"


def set_ai_itinerary_db(database):
    global _db
    _db = database


def _get_llm_key() -> str:
    return os.environ.get("EMERGENT_LLM_KEY", "")


# ─── Temas disponíveis ────────────────────────────────────────────────────────

THEMES = [
    {"id": "familia",     "label": "Família",       "icon": "family-restroom", "color": "#F59E0B", "desc": "Atividades e locais ideais para toda a família"},
    {"id": "foto",        "label": "Fotografia",     "icon": "photo-camera",   "color": "#EC4899", "desc": "Os melhores fotospots e luz natural"},
    {"id": "natureza",    "label": "Natureza",       "icon": "forest",         "color": "#16A34A", "desc": "Trilhos, fauna, flora e reservas naturais"},
    {"id": "historia",    "label": "História",       "icon": "account-balance","color": "#C49A6C", "desc": "Monumentos, arqueologia e patrimônio cultural"},
    {"id": "surf",        "label": "Surf & Mar",     "icon": "surfing",        "color": "#0EA5E9", "desc": "Praias, ondas e desportos aquáticos"},
    {"id": "gastronomia", "label": "Gastronomia",    "icon": "restaurant",     "color": "#EF4444", "desc": "Produtos locais, tabernas e mercados"},
]

THEME_CATEGORIES = {
    "familia":     ["percursos_pedestres", "praias", "museus", "parques", "fauna_autoctone"],
    "foto":        ["miradouros", "fotospots", "patrimonio", "aldeias", "cascatas_pocos"],
    "natureza":    ["percursos_pedestres", "natureza", "fauna_autoctone", "flora_autoctone", "barragens_albufeiras"],
    "historia":    ["historia", "arqueologia", "castelos", "museus", "arte", "religioso"],
    "surf":        ["surf", "praias", "costa"],
    "gastronomia": ["gastronomia", "vinhos", "mercados", "restaurantes", "tabernas_historicas"],
}

DURATION_STOPS = {"1h": 2, "3h": 4, "1dia": 7, "2dias": 12}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


async def _call_llm(messages: list, max_tokens: int = 800) -> Optional[str]:
    key = _get_llm_key()
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                _LLM_URL,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": _LLM_MODEL, "messages": messages, "max_tokens": max_tokens, "temperature": 0.7},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.warning(f"[AI] LLM call failed: {e}")
        return None


def _build_fallback_itinerary(pois: list, theme: str, duration: str) -> dict:
    """Itinerário de fallback sem LLM — estruturado a partir dos POIs."""
    max_stops = DURATION_STOPS.get(duration, 4)
    selected = pois[:max_stops]
    dur_map = {"1h": "1 hora", "3h": "3 horas", "1dia": "1 dia", "2dias": "2 dias"}
    theme_labels = {t["id"]: t["label"] for t in THEMES}
    paradas = []
    for i, poi in enumerate(selected):
        loc = poi.get("location", {})
        paradas.append({
            "ordem": i + 1,
            "nome": poi.get("name", "Local"),
            "descricao_curta": (poi.get("description") or "Ponto de interesse local.")[:150],
            "duracao_visita": "30 min" if duration == "1h" else "45 min",
            "tipo": poi.get("category", "patrimonio"),
            "lat": loc.get("lat", 0),
            "lng": loc.get("lng", 0),
        })

    total_dist = 0.0
    for i in range(1, len(paradas)):
        a, b = paradas[i - 1], paradas[i]
        total_dist += _haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])

    return {
        "titulo": f"Roteiro de {theme_labels.get(theme, theme).title()} — {dur_map.get(duration, duration)}",
        "subtitulo": "Itinerário gerado automaticamente",
        "duracao": dur_map.get(duration, duration),
        "tema": theme,
        "paradas": paradas,
        "dica_geral": "Explore ao seu ritmo e descubra os tesouros locais.",
        "melhor_hora": "Manhã (9h-12h)" if duration in ("1h", "3h") else "9h00",
        "distancia_total_km": round(total_dist, 1),
        "fonte": "fallback",
    }


# ─── Modelos ──────────────────────────────────────────────────────────────────

class ItineraryRequest(BaseModel):
    duration: str = Field(..., description="1h | 3h | 1dia | 2dias")
    theme: str = Field(..., description="familia | foto | natureza | historia | surf | gastronomia")
    lat: float
    lng: float
    radius_km: float = Field(30.0, ge=1, le=150)


class EnrichRequest(BaseModel):
    poi_id: str
    tipo: str = Field("historia", description="historia | lenda | curiosidade | dica_fotografo")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@ai_itinerary_router.get("/themes")
async def list_themes():
    """Lista de temas disponíveis para itinerários."""
    return {"themes": THEMES, "durations": ["1h", "3h", "1dia", "2dias"]}


@ai_itinerary_router.post("/itinerary")
async def generate_itinerary(body: ItineraryRequest):
    """Gera um micro-itinerário personalizado com POIs próximos."""
    if body.duration not in DURATION_STOPS:
        raise HTTPException(400, detail=f"Duração inválida. Use: {list(DURATION_STOPS.keys())}")
    if body.theme not in THEME_CATEGORIES:
        raise HTTPException(400, detail=f"Tema inválido. Use: {list(THEME_CATEGORIES.keys())}")

    # ── Buscar POIs próximos ──────────────────────────────────────────────────
    pois: list = []
    if _db is not None:
        lat_delta = body.radius_km / 111.0
        lng_delta = body.radius_km / (111.0 * abs(math.cos(math.radians(body.lat))) + 0.001)
        theme_cats = THEME_CATEGORIES[body.theme]

        query = {
            "location.lat": {"$gte": body.lat - lat_delta, "$lte": body.lat + lat_delta},
            "location.lng": {"$gte": body.lng - lng_delta, "$lte": body.lng + lng_delta},
            "category": {"$in": theme_cats},
        }
        cursor = _db["heritage_items"].find(query, {
            "_id": 0, "id": 1, "name": 1, "category": 1, "description": 1,
            "region": 1, "location": 1, "iq_score": 1,
        }).limit(30)

        async for doc in cursor:
            loc = doc.get("location", {})
            plat = loc.get("lat") or 0
            plng = loc.get("lng") or 0
            dist = _haversine_km(body.lat, body.lng, plat, plng)
            if dist <= body.radius_km:
                doc["distance_km"] = round(dist, 2)
                pois.append(doc)

        pois.sort(key=lambda p: (p.get("distance_km", 99), -(p.get("iq_score") or 0)))

    max_stops = DURATION_STOPS[body.duration]

    # ── Tentar LLM ───────────────────────────────────────────────────────────
    poi_summary = "\n".join(
        f"- {p['name']} ({p.get('category','?')}), {p.get('distance_km', '?')}km, IQ {p.get('iq_score', '?')}"
        for p in pois[:15]
    )
    theme_label = next((t["label"] for t in THEMES if t["id"] == body.theme), body.theme)
    dur_map = {"1h": "1 hora", "3h": "3 horas", "1dia": "1 dia completo", "2dias": "2 dias"}

    system_prompt = (
        "És um guia turístico especialista em Portugal. Crias itinerários evocativos, poéticos e práticos. "
        "Responde APENAS em JSON válido, sem markdown, sem explicações fora do JSON."
    )
    user_prompt = f"""Cria um itinerário de {dur_map.get(body.duration)} com tema "{theme_label}" para a localização ({body.lat:.4f}, {body.lng:.4f}).

POIs disponíveis:
{poi_summary if poi_summary else "Sem POIs específicos — usa conhecimento geral sobre a região."}

Máximo de {max_stops} paragens. Responde com este JSON exato:
{{
  "titulo": "título poético curto",
  "subtitulo": "subtítulo descritivo",
  "duracao": "{dur_map.get(body.duration)}",
  "tema": "{body.theme}",
  "paradas": [
    {{"ordem": 1, "nome": "...", "descricao_curta": "max 150 chars", "duracao_visita": "X min", "tipo": "categoria", "lat": 0.0, "lng": 0.0, "dica_fotografo": "opcional"}}
  ],
  "dica_geral": "conselho prático max 200 chars",
  "melhor_hora": "ex: 9h00 ou Manhã",
  "distancia_total_km": 0.0
}}"""

    llm_result = await _call_llm(
        [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        max_tokens=1200,
    )

    if llm_result:
        try:
            import json
            # Limpar possível markdown
            clean = llm_result.strip()
            if clean.startswith("```"):
                clean = clean.split("```")[1]
                if clean.startswith("json"):
                    clean = clean[4:]
            itinerary = json.loads(clean)
            itinerary["fonte"] = "llm"
            return itinerary
        except Exception as e:
            logger.warning(f"[AI] Failed to parse LLM JSON: {e}")

    # Fallback sem LLM
    return _build_fallback_itinerary(pois, body.theme, body.duration)


@ai_itinerary_router.post("/enrich")
async def enrich_poi(body: EnrichRequest):
    """Enriquece um POI com conteúdo cultural gerado por IA."""
    valid_tipos = ("historia", "lenda", "curiosidade", "dica_fotografo")
    if body.tipo not in valid_tipos:
        raise HTTPException(400, detail=f"Tipo inválido. Use: {valid_tipos}")

    poi = None
    if _db is not None:
        poi = await _db["heritage_items"].find_one({"id": body.poi_id}, {"_id": 0})

    if not poi:
        raise HTTPException(404, detail=f"POI '{body.poi_id}' não encontrado")

    poi_name = poi.get("name", "Local desconhecido")
    poi_region = poi.get("region", "Portugal")
    poi_category = poi.get("category", "")
    poi_desc = poi.get("description", "")

    # Templates de fallback por tipo
    fallbacks = {
        "historia": f"{poi_name} é um dos pontos de interesse mais marcantes de {poi_region}, com uma história que remonta a séculos de ocupação humana e transformação cultural da região.",
        "lenda": f"Conta a lenda local que {poi_name} guarda um segredo ancestral, transmitido de geração em geração pelos habitantes de {poi_region} como parte da sua identidade coletiva.",
        "curiosidade": f"Sabia que {poi_name} é considerado um dos locais mais únicos de {poi_region}? O seu contexto geográfico e cultural fazem deste ponto uma descoberta imperdível.",
        "dica_fotografo": f"Para fotografar {poi_name}, a luz dourada do fim de tarde cria contrastes únicos. Experimente enquadramentos que incluam o contexto natural ou arquitetónico envolvente.",
    }

    tipo_prompts = {
        "historia": f"Escreve um parágrafo evocativo sobre a história e contexto cultural de '{poi_name}' em {poi_region} (categoria: {poi_category}). Max 400 caracteres. Tom culto mas acessível.",
        "lenda": f"Inventa ou reconta uma lenda local sobre '{poi_name}' em {poi_region}. Max 400 caracteres. Tom mítico e evocativo, como se fosse uma tradição oral antiga.",
        "curiosidade": f"Partilha uma curiosidade surpreendente sobre '{poi_name}' em {poi_region}. Max 400 caracteres. Algo que o visitante comum não sabe.",
        "dica_fotografo": f"Dá dicas profissionais de fotografia para '{poi_name}' em {poi_region}: melhor hora do dia, ângulo, luz. Max 400 caracteres. Tom de fotógrafo experiente.",
    }

    system_prompt = (
        "És um especialista em cultura e turismo português. Escreves em português europeu, "
        "com um estilo evocativo e literário. Responde APENAS com o texto pedido, sem introduções."
    )

    context = f"Informação disponível: {poi_desc[:300]}" if poi_desc else ""
    user_prompt = f"{tipo_prompts[body.tipo]}\n\n{context}".strip()

    llm_text = await _call_llm(
        [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        max_tokens=250,
    )

    conteudo = (llm_text or fallbacks[body.tipo])[:400]

    return {
        "poi_id": body.poi_id,
        "poi_name": poi_name,
        "tipo": body.tipo,
        "conteudo": conteudo,
        "fonte": "llm" if llm_text else "fallback_template",
        "gerado_em": datetime.datetime.utcnow().isoformat() + "Z",
    }
