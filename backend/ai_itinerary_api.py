"""
ai_itinerary_api.py — Itinerários IA e enriquecimento de POIs
POST /ai/itinerary  — gera itinerário temático com POIs próximos via LLM
POST /ai/enrich     — enriquece um POI com história/lenda/curiosidade/dica_fotografo via LLM
GET  /ai/themes     — lista temas disponíveis com ícones e descrições
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, List
import math
import logging
import datetime
import json

from llm_utils import llm_chat
from models.api_models import User

logger = logging.getLogger(__name__)

ai_itinerary_router = APIRouter(prefix="/ai", tags=["AI Itinerary"])

_db = None
_require_auth = None


def set_ai_itinerary_db(database):
    global _db
    _db = database


def set_ai_itinerary_auth(auth_fn):
    global _require_auth
    _require_auth = auth_fn


async def _auth_dep(request: Request) -> User:
    return await _require_auth(request)


# ─── Temas disponíveis ────────────────────────────────────────────────────────

THEMES = [
    {
        "id": "familia",
        "label": "Família",
        "icon": "family_restroom",
        "color": "#F59E0B",
        "descricao": "Atividades e locais ideais para toda a família, com segurança e diversão garantidas.",
    },
    {
        "id": "foto",
        "label": "Fotografia",
        "icon": "photo_camera",
        "color": "#EC4899",
        "descricao": "Os melhores fotospots, luz natural e enquadramentos únicos de Portugal.",
    },
    {
        "id": "natureza",
        "label": "Natureza",
        "icon": "forest",
        "color": "#16A34A",
        "descricao": "Trilhos, fauna, flora e reservas naturais — para quem ama o ar livre.",
    },
    {
        "id": "historia",
        "label": "História",
        "icon": "account_balance",
        "color": "#C49A6C",
        "descricao": "Monumentos, arqueologia e patrimônio cultural com séculos de história.",
    },
    {
        "id": "surf",
        "label": "Surf & Mar",
        "icon": "surfing",
        "color": "#0EA5E9",
        "descricao": "Praias atlânticas, ondas perfeitas e desportos aquáticos.",
    },
    {
        "id": "gastronomia",
        "label": "Gastronomia",
        "icon": "restaurant",
        "color": "#EF4444",
        "descricao": "Produtos locais, tascas tradicionais, vinhos e mercados regionais.",
    },
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

DURATION_LABELS = {"1h": "1 hora", "3h": "3 horas", "1dia": "1 dia", "2dias": "2 dias"}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = (
        math.sin(dLat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


async def _call_llm(messages: list, max_tokens: int = 800) -> Optional[str]:
    """Thin shim kept for backwards compat — delegates to llm_utils.llm_chat."""
    return await llm_chat(messages, max_tokens=max_tokens)


def _build_fallback_itinerary(pois: list, theme: str, duration: str) -> dict:
    """Structured fallback itinerary built directly from POIs without LLM."""
    max_stops = DURATION_STOPS.get(duration, 4)
    selected = pois[:max_stops]
    theme_label = next((t["label"] for t in THEMES if t["id"] == theme), theme.title())
    dur_label = DURATION_LABELS.get(duration, duration)

    per_stop_time = {
        "1h": "30 min",
        "3h": "45 min",
        "1dia": "1h 30min",
        "2dias": "2h",
    }.get(duration, "45 min")

    paradas = []
    for i, poi in enumerate(selected):
        loc = poi.get("location", {})
        paradas.append({
            "ordem": i + 1,
            "nome": poi.get("name", "Local"),
            "descricao_curta": (poi.get("description") or "Ponto de interesse local.")[:150],
            "duracao_visita": per_stop_time,
            "tipo": poi.get("category", "patrimonio"),
            "lat": loc.get("lat") or 0.0,
            "lng": loc.get("lng") or 0.0,
        })

    total_dist = 0.0
    for i in range(1, len(paradas)):
        a, b = paradas[i - 1], paradas[i]
        total_dist += _haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])

    return {
        "titulo": f"Roteiro de {theme_label} — {dur_label}",
        "subtitulo": "Itinerário gerado automaticamente a partir de pontos de interesse próximos",
        "duracao": dur_label,
        "tema": theme,
        "paradas": paradas,
        "dica_geral": "Explore ao seu próprio ritmo e deixe-se surpreender pelos tesouros locais.",
        "melhor_hora": "Manhã (9h–12h)" if duration in ("1h", "3h") else "9h00",
        "distancia_total_km": round(total_dist, 1),
        "fonte": "fallback",
    }


def _clean_llm_json(raw: str) -> Optional[dict]:
    """Strip markdown fences and parse LLM JSON output."""
    text = raw.strip()
    if text.startswith("```"):
        parts = text.split("```")
        # parts[1] may start with 'json\n'
        text = parts[1].lstrip("json").strip() if len(parts) > 1 else text
    try:
        return json.loads(text)
    except Exception as e:
        logger.warning(f"[AI] JSON parse error: {e}")
        return None


# ─── Pydantic models ──────────────────────────────────────────────────────────

class ItineraryRequest(BaseModel):
    duration: str = Field(..., min_length=1, max_length=16, description="1h | 3h | 1dia | 2dias")
    theme: str = Field(..., min_length=1, max_length=32, description="familia | foto | natureza | historia | surf | gastronomia")
    lat: float = Field(..., ge=-90, le=90, description="Latitude do centro do itinerário")
    lng: float = Field(..., ge=-180, le=180, description="Longitude do centro do itinerário")
    radius_km: float = Field(30.0, ge=1.0, le=150.0, description="Raio de busca em km")


class EnrichRequest(BaseModel):
    poi_id: str = Field(..., min_length=1, max_length=128, description="ID do POI na coleção heritage_items")
    tipo: str = Field("historia", min_length=1, max_length=32, description="historia | lenda | curiosidade | dica_fotografo")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@ai_itinerary_router.get("/themes")
async def list_themes():
    """Lista os temas disponíveis para itinerários com ícones e descrições."""
    return {
        "themes": THEMES,
        "durations": [
            {"id": "1h",    "label": "1 hora",   "max_paradas": 2},
            {"id": "3h",    "label": "3 horas",  "max_paradas": 4},
            {"id": "1dia",  "label": "1 dia",    "max_paradas": 7},
            {"id": "2dias", "label": "2 dias",   "max_paradas": 12},
        ],
    }


@ai_itinerary_router.post("/itinerary")
async def generate_itinerary(
    body: ItineraryRequest,
    current_user: User = Depends(_auth_dep),
):
    """
    Gera um micro-itinerário personalizado com POIs próximos.
    Usa o LLM para criar uma narrativa coerente; fallback automático se o LLM falhar.
    """
    if body.duration not in DURATION_STOPS:
        raise HTTPException(
            status_code=400,
            detail=f"Duração inválida '{body.duration}'. Use: {list(DURATION_STOPS.keys())}",
        )
    if body.theme not in THEME_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Tema inválido '{body.theme}'. Use: {list(THEME_CATEGORIES.keys())}",
        )

    # ── Buscar POIs próximos na DB ────────────────────────────────────────────
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
        cursor = _db["heritage_items"].find(
            query,
            {
                "_id": 0, "id": 1, "name": 1, "category": 1,
                "description": 1, "region": 1, "location": 1, "iq_score": 1,
            },
        ).limit(30)

        async for doc in cursor:
            loc = doc.get("location", {})
            plat = loc.get("lat") or loc.get("latitude") or 0.0
            plng = loc.get("lng") or loc.get("longitude") or 0.0
            if not plat or not plng:
                continue
            dist = _haversine_km(body.lat, body.lng, plat, plng)
            if dist <= body.radius_km:
                doc["distance_km"] = round(dist, 2)
                pois.append(doc)

        # Sort: closest first, then higher IQ score
        pois.sort(key=lambda p: (p.get("distance_km", 99), -(p.get("iq_score") or 0)))

    max_stops = DURATION_STOPS[body.duration]
    dur_label = DURATION_LABELS[body.duration]
    theme_label = next((t["label"] for t in THEMES if t["id"] == body.theme), body.theme)

    # ── Preparar contexto para o LLM ─────────────────────────────────────────
    poi_lines = "\n".join(
        f"- {p['name']} ({p.get('category', '?')}), {p.get('distance_km', '?')}km"
        + (f", IQ {p['iq_score']}" if p.get("iq_score") else "")
        for p in pois[:15]
    ) or "Sem POIs encontrados — usa conhecimento geral sobre a região portuguesa."

    system_prompt = (
        "És um guia turístico especialista em Portugal. Crias itinerários evocativos, poéticos e práticos. "
        "Responde APENAS com JSON válido, sem markdown, sem texto adicional fora do JSON."
    )
    user_prompt = f"""Cria um itinerário de {dur_label} com tema "{theme_label}" centrado em ({body.lat:.4f}, {body.lng:.4f}).

POIs disponíveis na zona:
{poi_lines}

Usa no máximo {max_stops} paragens. Inclui APENAS paragens que façam sentido para o tema "{theme_label}".
Responde com este JSON exato (sem campos extra):
{{
  "titulo": "título poético e curto",
  "subtitulo": "subtítulo descritivo da experiência",
  "duracao": "{dur_label}",
  "tema": "{body.theme}",
  "paradas": [
    {{
      "ordem": 1,
      "nome": "nome do local",
      "descricao_curta": "descrição evocativa max 150 chars",
      "duracao_visita": "ex: 45 min",
      "tipo": "categoria do poi",
      "lat": 38.0,
      "lng": -8.0,
      "dica_fotografo": "dica opcional para fotografos"
    }}
  ],
  "dica_geral": "conselho prático e evocativo max 200 chars",
  "melhor_hora": "ex: 9h00 ou Fim de tarde",
  "distancia_total_km": 12.5
}}"""

    llm_raw = await _call_llm(
        [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        max_tokens=1400,
    )

    if llm_raw:
        parsed = _clean_llm_json(llm_raw)
        if parsed and isinstance(parsed.get("paradas"), list):
            parsed["fonte"] = "llm"
            return parsed
        logger.warning("[AI] LLM returned invalid structure — using fallback")

    # ── Fallback estruturado ──────────────────────────────────────────────────
    return _build_fallback_itinerary(pois, body.theme, body.duration)


@ai_itinerary_router.post("/enrich")
async def enrich_poi(
    body: EnrichRequest,
    current_user: User = Depends(_auth_dep),
):
    """
    Enriquece um POI com conteúdo cultural gerado por IA.
    Tipos: historia | lenda | curiosidade | dica_fotografo
    """
    valid_tipos = ("historia", "lenda", "curiosidade", "dica_fotografo")
    if body.tipo not in valid_tipos:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo inválido '{body.tipo}'. Use: {valid_tipos}",
        )

    # ── Buscar POI na DB ──────────────────────────────────────────────────────
    poi = None
    if _db is not None:
        poi = await _db["heritage_items"].find_one({"id": body.poi_id}, {"_id": 0})

    if not poi:
        raise HTTPException(status_code=404, detail=f"POI '{body.poi_id}' não encontrado")

    poi_name = poi.get("name", "Local desconhecido")
    poi_region = poi.get("region", "Portugal")
    poi_category = poi.get("category", "")
    poi_desc = (poi.get("description") or "")[:300]

    # ── Templates de fallback por tipo ───────────────────────────────────────
    fallbacks = {
        "historia": (
            f"{poi_name} é um dos pontos de interesse mais marcantes de {poi_region}, "
            f"com uma história que remonta a séculos de ocupação humana e transformação cultural."
        ),
        "lenda": (
            f"Conta a lenda local que {poi_name} guarda um segredo ancestral, "
            f"transmitido de geração em geração pelos habitantes de {poi_region}."
        ),
        "curiosidade": (
            f"Sabia que {poi_name} é considerado um dos locais mais singulares de {poi_region}? "
            f"O seu contexto geográfico e cultural fazem deste ponto uma descoberta verdadeiramente única."
        ),
        "dica_fotografo": (
            f"Para fotografar {poi_name}, a luz dourada do fim de tarde cria contrastes únicos. "
            f"Experimente enquadramentos que incluam o contexto natural ou arquitetónico envolvente."
        ),
    }

    # ── Prompts por tipo ─────────────────────────────────────────────────────
    tipo_prompts = {
        "historia": (
            f"Escreve um parágrafo evocativo sobre a história e contexto cultural de '{poi_name}' "
            f"em {poi_region} (categoria: {poi_category}). Máximo 400 caracteres. Tom culto mas acessível."
        ),
        "lenda": (
            f"Reconta ou inventa uma lenda local sobre '{poi_name}' em {poi_region}. "
            f"Máximo 400 caracteres. Tom mítico e evocativo, como se fosse uma tradição oral antiga."
        ),
        "curiosidade": (
            f"Partilha uma curiosidade surpreendente sobre '{poi_name}' em {poi_region}. "
            f"Máximo 400 caracteres. Algo que o visitante comum desconhece."
        ),
        "dica_fotografo": (
            f"Dá dicas profissionais de fotografia para '{poi_name}' em {poi_region}: "
            f"melhor hora do dia, ângulo, luz e composição. Máximo 400 caracteres. Tom de fotógrafo experiente."
        ),
    }

    system_prompt = (
        "És um especialista em cultura, história e turismo português. "
        "Escreves em português europeu, com estilo evocativo e literário. "
        "Responde APENAS com o texto pedido, sem introduções nem conclusões."
    )
    context_line = f"\n\nContexto disponível: {poi_desc}" if poi_desc else ""
    user_prompt = tipo_prompts[body.tipo] + context_line

    llm_text = await _call_llm(
        [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        max_tokens=250,
    )

    conteudo = (llm_text or fallbacks[body.tipo])[:400]

    return {
        "poi_id": body.poi_id,
        "tipo": body.tipo,
        "conteudo": conteudo,
        "fonte": "ai_generated" if llm_text else "fallback_template",
        "gerado_em": datetime.datetime.utcnow().isoformat() + "Z",
    }


class RecommendationsRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    interests: List[str] = Field(default_factory=list, max_length=20, description="ex: ['natureza','historia','surf']")
    radius_km: float = Field(25.0, ge=1, le=100)
    limit: int = Field(10, ge=1, le=30)
    exclude_ids: List[str] = Field(default_factory=list, max_length=200, description="IDs já vistos")


@ai_itinerary_router.post("/recommendations")
async def get_recommendations(
    body: RecommendationsRequest,
    current_user: User = Depends(_auth_dep),
):
    """
    Recomendações personalizadas por localização + interesses.
    Combina proximidade geográfica, categorias de interesse e IQ score.
    """
    # Map interests to categories
    interest_categories: List[str] = []
    for interest in body.interests:
        cats = THEME_CATEGORIES.get(interest, [])
        interest_categories.extend(cats)
    # If no interests specified, use broad categories
    if not interest_categories:
        interest_categories = ["historia", "natureza", "miradouros", "patrimonio", "percursos_pedestres"]

    lat_delta = body.radius_km / 111.0
    lng_delta = body.radius_km / (111.0 * abs(math.cos(math.radians(body.lat))) + 0.001)

    query: dict = {
        "location.lat": {"$gte": body.lat - lat_delta, "$lte": body.lat + lat_delta},
        "location.lng": {"$gte": body.lng - lng_delta, "$lte": body.lng + lng_delta},
        "category": {"$in": list(set(interest_categories))},
    }
    if body.exclude_ids:
        query["id"] = {"$nin": body.exclude_ids}

    recs: list = []
    if _db is not None:
        cursor = _db["heritage_items"].find(query, {
            "_id": 0, "id": 1, "name": 1, "category": 1, "description": 1,
            "region": 1, "location": 1, "iq_score": 1, "image_url": 1,
        }).limit(body.limit * 4)

        async for doc in cursor:
            loc = doc.get("location", {})
            plat = loc.get("lat") or 0
            plng = loc.get("lng") or 0
            dist = _haversine_km(body.lat, body.lng, plat, plng)
            if dist <= body.radius_km:
                # Score: weighted mix of proximity + IQ score
                iq = doc.get("iq_score") or 50
                proximity_score = max(0, 1 - dist / body.radius_km)
                doc["_score"] = round(proximity_score * 0.5 + (iq / 100) * 0.5, 3)
                doc["distance_km"] = round(dist, 2)
                recs.append(doc)

    # Sort by combined score desc
    recs.sort(key=lambda x: x.get("_score", 0), reverse=True)
    top = recs[:body.limit]

    # Clean internal score field
    for r in top:
        r.pop("_score", None)

    # Generate AI micro-descriptions if LLM available
    if top and _get_llm_key():
        names = ", ".join(r["name"] for r in top[:5])
        try:
            tip = await _call_llm([
                {"role": "system", "content": "És um guia turístico português. Responde em português europeu, conciso."},
                {"role": "user", "content": f"Em 1 frase evocativa (máx 120 chars), descreve por que visitar esta zona com estes locais: {names}"}
            ], max_tokens=80)
        except Exception:
            tip = None
    else:
        tip = None

    return {
        "recommendations": top,
        "total": len(top),
        "interests": body.interests,
        "center": {"lat": body.lat, "lng": body.lng},
        "radius_km": body.radius_km,
        "ai_tip": tip,
        "source": "geo_iq_weighted",
    }
