"""
Narrative Routes API — Pedestrian narrative navigation for Portugal Vivo.

Provides "story cues" along walking routes — triggered when the user enters
a 50m radius around a waypoint. Transforms ordinary navigation into a
contextual journey through history, culture, and place memory.

Core concepts:
- Story cue: a geo-anchored content block (text + optional audio hook)
- Narrative route: a walking route with >= 3 story cues, themed, <= 5km
- Story trigger: proximity-based (50m by default) or manual tap
- Narrative mode vs. navigation mode:
    Navigation → go from A to B efficiently
    Narrative → walk through a story, discover along the way

Minimum requirements for a "narrative route":
    1. >= 3 story cues with text >= 100 chars each
    2. Named narrative theme (historia, cultura, gastronomia, natureza, mistico)
    3. Total distance <= 8km (walkable in <= 2h)
    4. All POIs have location coordinates
    5. At least 1 photo spot or audio hook
"""
import logging
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from math import radians, cos

from shared_utils import DatabaseHolder, haversine_km

logger = logging.getLogger(__name__)

_db_holder = DatabaseHolder("narrative_routes")
set_narrative_routes_db = _db_holder.set
_get_db = _db_holder.get

narrative_routes_router = APIRouter(prefix="/narrative", tags=["Navegação Narrativa"])


# ========================
# NARRATIVE TEMPLATES & DATA
# ========================

NARRATIVE_THEMES = {
    "historia": {
        "label": "História e Memória",
        "icon": "history-edu",
        "color": "#C49A6C",
        "description": "Percurso pelo passado do lugar — castelos, igrejas, ruas com séculos de história.",
    },
    "cultura": {
        "label": "Cultura Viva",
        "icon": "celebration",
        "color": "#8B5CF6",
        "description": "Arte, música, artesanato e tradições que ainda pulsam no território.",
    },
    "gastronomia": {
        "label": "Gastronomia e Sabores",
        "icon": "restaurant",
        "color": "#EF4444",
        "description": "Roteiro pelos sabores locais — mercados, tabernas e produtores.",
    },
    "natureza": {
        "label": "Natureza e Paisagem",
        "icon": "terrain",
        "color": "#22C55E",
        "description": "Percurso pela paisagem natural — trilhos, miradouros e ecossistemas.",
    },
    "mistico": {
        "label": "Lendas e Mistério",
        "icon": "auto-stories",
        "color": "#6366F1",
        "description": "Lugares de lenda, tradição oral e espiritualidade popular.",
    },
}

# Category → narrative theme mapping
CATEGORY_THEME_MAP = {
    "castelos": "historia", "museus": "historia", "palacios_solares": "historia",
    "arqueologia_geologia": "historia", "patrimonio_ferroviario": "historia",
    "arte_urbana": "cultura", "oficios_artesanato": "cultura",
    "festivais_musica": "cultura", "musica_tradicional": "cultura",
    "restaurantes_gastronomia": "gastronomia", "tabernas_historicas": "gastronomia",
    "mercados_feiras": "gastronomia", "produtores_dop": "gastronomia",
    "percursos_pedestres": "natureza", "miradouros": "natureza",
    "cascatas_pocos": "natureza", "fauna_autoctone": "natureza",
    "flora_botanica": "natureza", "ecovias_passadicos": "natureza",
    "festas_romarias": "mistico", "moinhos_azenhas": "mistico",
    "termas_banhos": "mistico",
}

# Qualification criteria
MIN_STORY_CUES = 3
MIN_CUE_TEXT_LEN = 60  # chars (relaxed from 100 for real-world data)
MAX_ROUTE_KM = 8.0
STORY_TRIGGER_RADIUS_M = 50

# Story cue text templates per category (used when POI lacks description)
CUE_TEMPLATES = {
    "castelos": "Este castelo guardou durante séculos a memória de quem aqui viveu, amou e morreu. "
                "Repara nas pedras — cada uma foi colocada à mão, há centenas de anos.",
    "museus": "Os museus não guardam apenas objetos. Guardam contexto — o 'porquê' das coisas. "
              "O que aqui se preserva foi considerado demasiado importante para esquecer.",
    "arte_urbana": "A arte urbana é o diário público de uma cidade. Quem a criou quis deixar aqui "
                   "uma mensagem — para ti, para o tempo, para quem ainda não nasceu.",
    "miradouros": "Este miradouro foi frequentado por gerações. O que vês hoje foi visto também "
                  "por pastores, viajantes, amantes — todos silenciados pelo mesmo horizonte.",
    "mercados_feiras": "Os mercados são o coração social de uma comunidade. Aqui trocam-se produtos, "
                       "mas também histórias, fofocas e sabedoria popular.",
    "tabernas_historicas": "As tabernas históricas são o confessionário laico do povo. "
                           "Aqui falou-se de tudo — política, amor, colheitas, guerras.",
    "cascatas_pocos": "A água modelou esta paisagem durante milhões de anos. "
                      "O que ouves é o som do tempo a mover-se.",
    "oficios_artesanato": "Este ofício sobreviveu séculos. As mãos que o praticam hoje "
                          "carregam o conhecimento de dezenas de gerações anteriores.",
    "festas_romarias": "As festas populares misturam o sagrado e o profano há séculos. "
                       "O que parece simples folclore esconde uma cosmologia inteira.",
    "moinhos_azenhas": "Antes da eletricidade, os moinhos eram a tecnologia de ponta. "
                       "Transformavam grão em farinha, movimento em vida.",
}


def _build_story_cue(poi: dict, order: int, cumulative_km: float) -> dict:
    """Build a story cue from a POI with text, trigger radius, and audio hook hint."""
    cat = poi.get("category", "")
    desc = (poi.get("description") or "").strip()

    # Build story text: use description if long enough, else use template
    if len(desc) >= MIN_CUE_TEXT_LEN:
        story_text = desc[:400]
    else:
        template = CUE_TEMPLATES.get(cat, "")
        if template:
            story_text = template
            if desc:
                story_text = desc[:200] + " " + template
        else:
            story_text = desc or f"Este local faz parte da história e cultura do lugar."

    # Determine narrative theme
    theme_id = CATEGORY_THEME_MAP.get(cat, "historia")
    theme = NARRATIVE_THEMES.get(theme_id, NARRATIVE_THEMES["historia"])

    return {
        "order": order,
        "poi_id": poi.get("id"),
        "name": poi.get("name"),
        "category": cat,
        "location": poi.get("location"),
        "image_url": poi.get("image_url"),
        "story_text": story_text,
        "story_text_short": story_text[:120] + ("…" if len(story_text) > 120 else ""),
        "theme_id": theme_id,
        "theme_label": theme["label"],
        "theme_color": theme["color"],
        "trigger_radius_m": STORY_TRIGGER_RADIUS_M,
        "cumulative_km": round(cumulative_km, 2),
        "has_audio_hook": bool(poi.get("audio_url")),
        "audio_url": poi.get("audio_url"),
        "duration_seconds": max(20, len(story_text) // 15),  # ~15 chars/second reading speed
    }


def _detect_dominant_theme(pois: list) -> str:
    """Find the most common narrative theme among a list of POIs."""
    theme_count: dict = {}
    for poi in pois:
        cat = poi.get("category", "")
        theme = CATEGORY_THEME_MAP.get(cat, "historia")
        theme_count[theme] = theme_count.get(theme, 0) + 1
    if not theme_count:
        return "historia"
    return max(theme_count, key=lambda k: theme_count[k])


def _qualify_narrative_route(pois: list, total_km: float) -> dict:
    """Check if a set of POIs qualifies as a narrative route and explain why."""
    cues_with_text = [
        p for p in pois
        if len((p.get("description") or CUE_TEMPLATES.get(p.get("category", ""), "")).strip()) >= MIN_CUE_TEXT_LEN
    ]
    has_location = all(p.get("location", {}).get("lat") and p.get("location", {}).get("lng") for p in pois)
    has_photo_spot = any(p.get("category") in {"miradouros", "arte_urbana", "cascatas_pocos", "castelos"} for p in pois)

    reasons_failed = []
    if len(cues_with_text) < MIN_STORY_CUES:
        reasons_failed.append(f"Precisa de >= {MIN_STORY_CUES} cues com texto (tem {len(cues_with_text)})")
    if total_km > MAX_ROUTE_KM:
        reasons_failed.append(f"Rota muito longa ({total_km:.1f}km > {MAX_ROUTE_KM}km)")
    if not has_location:
        reasons_failed.append("Nem todos os POIs têm coordenadas GPS")
    if len(pois) < 2:
        reasons_failed.append("Precisa de pelo menos 2 POIs")

    qualified = len(reasons_failed) == 0
    return {
        "qualified": qualified,
        "cues_with_text": len(cues_with_text),
        "has_photo_spot": has_photo_spot,
        "total_km": round(total_km, 2),
        "reasons_failed": reasons_failed,
        "score": min(100, int((len(cues_with_text) / max(1, MIN_STORY_CUES)) * 60
                    + (1 if has_photo_spot else 0) * 20
                    + max(0, 1 - total_km / MAX_ROUTE_KM) * 20)),
    }


# ========================
# ENDPOINTS
# ========================

@narrative_routes_router.get("/nearby-stories")
async def get_nearby_stories(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(1.0, ge=0.1, le=10.0),
    theme: Optional[str] = Query(None, description="Filtrar por tema: historia, cultura, gastronomia, natureza, mistico"),
    limit: int = Query(10, ge=1, le=30),
):
    """
    Obter story cues próximas da localização atual.
    Cada item inclui texto narrativo, tema, radius de trigger e hint de áudio.
    Usado para modo de exploração narrativa livre (sem rota definida).
    """
    db = _get_db()
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * cos(radians(lat)))

    query = {
        "location.lat": {"$gte": lat - lat_delta, "$lte": lat + lat_delta},
        "location.lng": {"$gte": lng - lng_delta, "$lte": lng + lng_delta},
        "location.lat": {"$exists": True, "$ne": None},
    }
    if theme:
        valid_cats = [cat for cat, t in CATEGORY_THEME_MAP.items() if t == theme]
        if valid_cats:
            query["category"] = {"$in": valid_cats}

    pois = await db.heritage_items.find(
        query,
        {"_id": 0, "id": 1, "name": 1, "category": 1, "description": 1,
         "location": 1, "image_url": 1, "audio_url": 1, "iq_score": 1}
    ).sort("iq_score", -1).limit(limit * 3).to_list(limit * 3)

    # Filter by actual distance
    nearby = []
    for poi in pois:
        loc = poi.get("location", {})
        if not loc.get("lat") or not loc.get("lng"):
            continue
        dist = haversine_km(lat, lng, loc["lat"], loc["lng"])
        if dist <= radius_km:
            poi["distance_km"] = round(dist, 3)
            nearby.append(poi)

    nearby.sort(key=lambda p: p.get("distance_km", 99))
    nearby = nearby[:limit]

    cues = []
    cumulative = 0.0
    for i, poi in enumerate(nearby):
        if i > 0:
            prev = nearby[i - 1]
            seg = haversine_km(
                prev["location"]["lat"], prev["location"]["lng"],
                poi["location"]["lat"], poi["location"]["lng"]
            )
            cumulative += seg
        cues.append(_build_story_cue(poi, i + 1, cumulative))

    theme_info = NARRATIVE_THEMES.get(theme, None) if theme else None

    return {
        "cues": cues,
        "total": len(cues),
        "center": {"lat": lat, "lng": lng},
        "radius_km": radius_km,
        "theme": theme_info,
        "dominant_theme": _detect_dominant_theme(nearby),
    }


@narrative_routes_router.get("/route/{route_id}/cues")
async def get_route_story_cues(
    route_id: str,
    theme: Optional[str] = Query(None, description="Override theme"),
):
    """
    Gerar story cues para uma rota existente.
    Associa cada waypoint da rota ao seu conteúdo narrativo.
    Inclui qualificação: se a rota reúne condições para ser "rota narrativa".
    """
    db = _get_db()

    route = await db.routes.find_one({"id": route_id}, {"_id": 0})
    if not route:
        raise HTTPException(404, detail=f"Rota '{route_id}' não encontrada")

    # Get POIs along the route (via waypoints or region+category filter)
    waypoint_ids = route.get("poi_ids") or route.get("waypoint_ids") or []
    pois = []

    if waypoint_ids:
        pois = await db.heritage_items.find(
            {"id": {"$in": waypoint_ids}},
            {"_id": 0, "id": 1, "name": 1, "category": 1, "description": 1,
             "location": 1, "image_url": 1, "audio_url": 1, "iq_score": 1}
        ).to_list(50)
        # Preserve waypoint order
        poi_map = {p["id"]: p for p in pois}
        pois = [poi_map[wid] for wid in waypoint_ids if wid in poi_map]
    else:
        # Fallback: find POIs in the route's region
        region = route.get("region", "")
        if region:
            pois = await db.heritage_items.find(
                {"region": {"$regex": region, "$options": "i"}},
                {"_id": 0, "id": 1, "name": 1, "category": 1, "description": 1,
                 "location": 1, "image_url": 1, "audio_url": 1, "iq_score": 1}
            ).sort("iq_score", -1).limit(10).to_list(10)

    # Calculate total route distance
    total_km = 0.0
    cumulative = 0.0
    for i in range(1, len(pois)):
        prev = pois[i - 1].get("location", {})
        curr = pois[i].get("location", {})
        if prev.get("lat") and curr.get("lat"):
            total_km += haversine_km(prev["lat"], prev["lng"], curr["lat"], curr["lng"])

    # Build cues
    cues = []
    cumulative = 0.0
    for i, poi in enumerate(pois):
        if i > 0:
            prev = pois[i - 1].get("location", {})
            curr = poi.get("location", {})
            if prev.get("lat") and curr.get("lat"):
                cumulative += haversine_km(prev["lat"], prev["lng"], curr["lat"], curr["lng"])
        cues.append(_build_story_cue(poi, i + 1, cumulative))

    qualification = _qualify_narrative_route(pois, total_km)
    detected_theme = theme or _detect_dominant_theme(pois)
    theme_info = NARRATIVE_THEMES.get(detected_theme, NARRATIVE_THEMES["historia"])

    total_duration = sum(c.get("duration_seconds", 30) for c in cues)
    walking_minutes = round((total_km / 5.0) * 60)  # 5 km/h

    return {
        "route_id": route_id,
        "route_name": route.get("name", ""),
        "cues": cues,
        "total_cues": len(cues),
        "qualification": qualification,
        "theme": theme_info,
        "theme_id": detected_theme,
        "summary": {
            "total_km": round(total_km, 2),
            "walking_minutes": walking_minutes,
            "narrative_minutes": round(total_duration / 60, 1),
            "total_experience_minutes": walking_minutes + round(total_duration / 60),
            "trigger_radius_m": STORY_TRIGGER_RADIUS_M,
        },
    }


@narrative_routes_router.get("/qualify")
async def qualify_route(
    pois_csv: str = Query(..., description="POI IDs separados por vírgula"),
):
    """
    Verificar se um conjunto de POIs forma uma rota narrativa válida.
    Retorna score (0-100), critérios cumpridos, e razões de exclusão se falhar.
    """
    poi_ids = [p.strip() for p in pois_csv.split(",") if p.strip()]
    if not poi_ids:
        raise HTTPException(400, detail="Forneça pelo menos 1 POI ID")

    db = _get_db()
    pois = await db.heritage_items.find(
        {"id": {"$in": poi_ids}},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "description": 1, "location": 1}
    ).to_list(50)

    total_km = 0.0
    poi_map = {p["id"]: p for p in pois}
    ordered = [poi_map[pid] for pid in poi_ids if pid in poi_map]
    for i in range(1, len(ordered)):
        prev = ordered[i - 1].get("location", {})
        curr = ordered[i].get("location", {})
        if prev.get("lat") and curr.get("lat"):
            total_km += haversine_km(prev["lat"], prev["lng"], curr["lat"], curr["lng"])

    result = _qualify_narrative_route(ordered, total_km)
    result["dominant_theme"] = _detect_dominant_theme(ordered)
    result["theme_info"] = NARRATIVE_THEMES.get(result["dominant_theme"])
    result["narrative_themes"] = NARRATIVE_THEMES
    return result


@narrative_routes_router.get("/themes")
async def list_narrative_themes():
    """Listar todos os temas narrativos disponíveis."""
    return {
        "themes": [
            {"id": k, **v}
            for k, v in NARRATIVE_THEMES.items()
        ]
    }
