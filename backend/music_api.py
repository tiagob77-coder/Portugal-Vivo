"""
Music API — Musica Tradicional Portuguesa
MongoDB Atlas (Motor async) . FastAPI
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

music_router = APIRouter(prefix="/music", tags=["Music"])

_db = None
_llm_key: str = ""
_require_auth = None


def set_music_db(database) -> None:
    global _db
    _db = database


def set_music_llm_key(key: str) -> None:
    global _llm_key
    _llm_key = key


def set_music_auth(auth_fn) -> None:
    global _require_auth
    _require_auth = auth_fn


async def _auth_dep(request: Request) -> User:
    return await _require_auth(request)


# --- Seed data ---

SEED_ITEMS: list[dict] = [
    {
        "_id": "mus_001",
        "name": "Fado de Lisboa",
        "type": "fado",
        "region": "Lisboa",
        "municipality": "Lisboa",
        "description_short": "Genero musical urbano nascido em Alfama no sec. XIX, Patrimonio Imaterial da Humanidade UNESCO desde 2011.",
        "description_long": "O Fado de Lisboa e a expressao mais profunda da saudade portuguesa. Nascido nos bairros populares de Alfama, Mouraria e Madragoa, o fado lisboeta caracteriza-se pela voz solista acompanhada de guitarra portuguesa e viola de fado. Amalia Rodrigues internacionalizou o genero e em 2011 a UNESCO classificou-o como Patrimonio Cultural Imaterial da Humanidade.",
        "instruments": ["Guitarra portuguesa", "Viola de fado"],
        "genres": ["Fado tradicional", "Fado vadio", "Novo fado"],
        "artists": ["Amalia Rodrigues", "Mariza", "Ana Moura", "Camane"],
        "venues": ["Clube de Fado", "A Severa", "Tasca do Chico"],
        "unesco": True,
        "period": "Sec. XIX-presente",
        "tags": ["UNESCO", "Alfama", "saudade", "guitarra portuguesa", "noite"],
        "lat": 38.7103,
        "lng": -9.1303,
        "iq_score": 99,
        "best_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    {
        "_id": "mus_002",
        "name": "Fado de Coimbra",
        "type": "fado",
        "region": "Centro",
        "municipality": "Coimbra",
        "description_short": "Variante academica do fado cantada por estudantes da Universidade de Coimbra, com serenatas nocturnas na capa negra.",
        "description_long": "O Fado de Coimbra distingue-se do lisboeta pela ligacao a vida academica. Cantado exclusivamente por homens de capa negra, as serenatas realizam-se nas escadarias da Se Velha ou da Universidade. Jose Afonso e Adriano Correia de Oliveira renovaram o genero nos anos 60.",
        "instruments": ["Guitarra de Coimbra", "Viola"],
        "genres": ["Serenata", "Balada de Coimbra"],
        "artists": ["Jose Afonso", "Adriano Correia de Oliveira", "Luis Goes", "Fernando Machado Soares"],
        "venues": ["Se Velha", "Universidade de Coimbra", "Fado ao Centro"],
        "unesco": False,
        "period": "Sec. XIX-presente",
        "tags": ["academico", "serenata", "capa negra", "Universidade"],
        "lat": 40.2033,
        "lng": -8.4103,
        "iq_score": 96,
        "best_months": [3, 4, 5, 6, 10, 11],
    },
    {
        "_id": "mus_003",
        "name": "Guitarra Portuguesa",
        "type": "instrumento",
        "region": "Nacional",
        "municipality": "Lisboa",
        "description_short": "Instrumento de 12 cordas metalicas com forma de pera, simbolo sonoro do fado e da identidade musical portuguesa.",
        "description_long": "A guitarra portuguesa descende da cistre medieval e existe em duas variantes principais: a guitarra de Lisboa (mais brilhante, usada no fado) e a guitarra de Coimbra (mais grave, para serenatas). As 12 cordas em 6 ordens produzem o timbre inconfundivel que define o som do fado.",
        "instruments": ["Guitarra portuguesa de Lisboa", "Guitarra de Coimbra"],
        "genres": ["Fado", "Musica erudita", "Musica popular"],
        "artists": ["Carlos Paredes", "Antonio Chainho", "Pedro Caldeira Cabral", "Ricardo Rocha"],
        "unesco": False,
        "period": "Sec. XVIII-presente",
        "tags": ["12 cordas", "cistre", "luthier", "cordofone"],
        "lat": 38.7223,
        "lng": -9.1393,
        "iq_score": 97,
    },
    {
        "_id": "mus_004",
        "name": "Rancho Folclorico do Minho",
        "type": "folclore",
        "region": "Minho",
        "municipality": "Viana do Castelo",
        "description_short": "Grupos de dancas e cantares tradicionais minhotos com trajes bordados a ouro e instrumentos populares.",
        "description_long": "Os ranchos folcloricos do Minho preservam dancas como a vira, o malhao e a chula, acompanhadas por concertina, bombo, cavaquinho e ferrinhos. O traje vianense, com o ouro sobre o peito, e dos mais ricos da Peninsula Iberica. As romarias minhotas sao o palco natural destas actuacoes.",
        "instruments": ["Concertina", "Bombo", "Cavaquinho", "Ferrinhos"],
        "genres": ["Vira", "Malhao", "Chula", "Cana verde"],
        "artists": ["Ranchos de Viana do Castelo", "Ranchos de Ponte de Lima"],
        "unesco": False,
        "period": "Tradicao secular",
        "tags": ["traje vianense", "ouro", "romarias", "dancar"],
        "lat": 41.6934,
        "lng": -8.8301,
        "iq_score": 93,
        "best_months": [6, 7, 8, 9],
    },
    {
        "_id": "mus_005",
        "name": "Cante Alentejano",
        "type": "canto_polifonico",
        "region": "Alentejo",
        "municipality": "Serpa",
        "description_short": "Canto polifonico a cappella do Alentejo, Patrimonio Imaterial da Humanidade UNESCO desde 2014.",
        "description_long": "O Cante Alentejano e um canto coral polifonico a duas vozes praticado em grupos (corais) por homens e mulheres do Alentejo. O ponto (voz solista) inicia a melodia e o alto e o baixo respondem em coro. Associado ao trabalho rural e as tabernas, foi classificado pela UNESCO em 2014. Serpa e o epicentro desta tradicao.",
        "instruments": [],
        "genres": ["Canto polifonico", "Canto a cappella"],
        "artists": ["Grupo Coral de Serpa", "Grupo Coral de Pias", "Grupo Coral de Cuba"],
        "unesco": True,
        "period": "Sec. XV-presente",
        "tags": ["UNESCO", "polifonia", "a cappella", "coral", "Alentejo"],
        "lat": 37.9441,
        "lng": -7.5976,
        "iq_score": 98,
    },
    {
        "_id": "mus_006",
        "name": "Viola Campanica",
        "type": "instrumento",
        "region": "Alentejo",
        "municipality": "Odemira",
        "description_short": "Viola tradicional alentejana com 5 ordens de cordas, usada para acompanhar o cante e as modas do Baixo Alentejo.",
        "description_long": "A viola campanica e o instrumento emblematico do Baixo Alentejo, com origem nos seculos XVI-XVII. Com cinco ordens de cordas (algumas triplas), distingue-se pelo timbre aspero e ritmico que acompanha as modas e despiques alentejanos. Odemira e Ourique sao os centros historicos desta tradicao.",
        "instruments": ["Viola campanica"],
        "genres": ["Modas alentejanas", "Despiques"],
        "unesco": False,
        "period": "Sec. XVI-presente",
        "tags": ["cordofone", "Baixo Alentejo", "5 ordens"],
        "lat": 37.5967,
        "lng": -8.6398,
        "iq_score": 88,
    },
    {
        "_id": "mus_007",
        "name": "Corridinho Algarvio",
        "type": "danca_tradicional",
        "region": "Algarve",
        "municipality": "Loule",
        "description_short": "Danca rapida em roda tipica do Algarve, com pares a girar ao som do acordeao e da harmonica.",
        "description_long": "O corridinho e a danca mais caracteristica do Algarve, executada em roda com pares que giram a grande velocidade ao som do acordeao, harmonica e viola. As festas populares algarvias sao incompletas sem o corridinho, que exige agilidade e resistencia dos dancadores.",
        "instruments": ["Acordeao", "Harmonica", "Viola"],
        "genres": ["Corridinho", "Danca de roda"],
        "unesco": False,
        "period": "Sec. XIX-presente",
        "tags": ["danca de roda", "acordeao", "festas populares"],
        "lat": 37.1355,
        "lng": -8.0200,
        "iq_score": 85,
        "best_months": [6, 7, 8, 9],
    },
    {
        "_id": "mus_008",
        "name": "Pauliteiros de Miranda",
        "type": "danca_tradicional",
        "region": "Tras-os-Montes",
        "municipality": "Miranda do Douro",
        "description_short": "Danca guerreira de paus (paulitos) de origem celta, exclusiva de Miranda do Douro e arredores.",
        "description_long": "Os Pauliteiros de Miranda executam uma danca ancestral de origem provavelmente celta, batendo paus (paulitos) em coreografias complexas acompanhados por gaita de foles e bombo. Os oito dancadores vestem saias de la branca com fitas coloridas. Esta tradicao e cantada em mirandes, segunda lingua oficial de Portugal.",
        "instruments": ["Gaita de foles", "Bombo", "Caixa"],
        "genres": ["Danca de paus", "Danca guerreira"],
        "artists": ["Pauliteiros de Duas Igrejas", "Pauliteiros de Cerce"],
        "unesco": False,
        "period": "Origem celta/medieval",
        "tags": ["paus", "mirandes", "celta", "danca guerreira"],
        "lat": 41.4953,
        "lng": -6.2742,
        "iq_score": 94,
        "best_months": [6, 7, 8, 12],
    },
    {
        "_id": "mus_009",
        "name": "Gaita de Foles Transmontana",
        "type": "instrumento",
        "region": "Tras-os-Montes",
        "municipality": "Braganca",
        "description_short": "Aerofone de pele de cabra com ponteiro e ronco, instrumento-simbolo de Tras-os-Montes e do nordeste transmontano.",
        "description_long": "A gaita de foles transmontana e um instrumento ancestral de pele de cabra com ponteiro melodico e ronco grave. E o instrumento central das festas de inverno (Festa dos Rapazes, Caretos de Podence) e das romarias serranas. Gaiteiros como Mestre Augusto preservam uma tradicao milenar.",
        "instruments": ["Gaita de foles"],
        "genres": ["Musica transmontana", "Festas de inverno"],
        "artists": ["Mestre Augusto", "Galandum Galundaina"],
        "unesco": False,
        "period": "Origem celta/medieval",
        "tags": ["aerofone", "pele de cabra", "festas de inverno", "caretos"],
        "lat": 41.8062,
        "lng": -6.7569,
        "iq_score": 91,
        "best_months": [12, 1, 2, 6, 7, 8],
    },
    {
        "_id": "mus_010",
        "name": "Adufeiras de Monsanto",
        "type": "canto_tradicional",
        "region": "Beira Baixa",
        "municipality": "Idanha-a-Nova",
        "description_short": "Mulheres cantadeiras que tocam adufe quadrado, instrumento ancestral de pele de cabra unico da Beira Baixa.",
        "description_long": "As adufeiras sao mulheres da raia beiroa que cantam e tocam adufe — um pandeiro quadrado de pele de cabra com sementes no interior. O adufe e unico na Beira Baixa e norte-alentejano, e as suas cantadeiras preservam um repertorio de romances medievais e cantigas de trabalho.",
        "instruments": ["Adufe"],
        "genres": ["Cantigas de trabalho", "Romances medievais"],
        "artists": ["Adufeiras de Monsanto", "Adufeiras de Idanha"],
        "unesco": False,
        "period": "Origem medieval/arabe",
        "tags": ["adufe", "pandeiro quadrado", "cantadeiras", "raia"],
        "lat": 40.0389,
        "lng": -7.1136,
        "iq_score": 90,
    },
    {
        "_id": "mus_011",
        "name": "Festival Musicas do Mundo",
        "type": "festival",
        "region": "Alentejo",
        "municipality": "Sines",
        "description_short": "Festival internacional de world music em Sines, cidade natal de Vasco da Gama, com palcos junto ao mar.",
        "description_long": "O FMM Sines e um dos maiores festivais de musicas do mundo em Portugal, realizado no Castelo de Sines e na Praia Vasco da Gama. Desde 1999, reune artistas de todos os continentes com entrada livre em varios palcos. A localizacao junto ao Atlantico e o ambiente cosmopolita tornam-no unico.",
        "instruments": [],
        "genres": ["World music", "Musica etnica", "Fusao"],
        "unesco": False,
        "period": "1999-presente",
        "tags": ["world music", "Sines", "festival", "gratuito", "verao"],
        "lat": 37.9561,
        "lng": -8.8697,
        "iq_score": 87,
        "best_months": [7],
    },
    {
        "_id": "mus_012",
        "name": "Festival de Fado de Lisboa",
        "type": "festival",
        "region": "Lisboa",
        "municipality": "Lisboa",
        "description_short": "Festival anual que celebra o fado nos palcos historicos de Lisboa, com fadistas consagrados e nova geracao.",
        "description_long": "O Festival de Fado de Lisboa decorre em locais emblematicos como o Castelo de Sao Jorge, o Museu do Fado e as casas de fado de Alfama. Reune os maiores nomes do fado contemporaneo e promove novos talentos numa celebracao da alma musical lisboeta.",
        "instruments": ["Guitarra portuguesa", "Viola de fado"],
        "genres": ["Fado"],
        "unesco": False,
        "period": "2004-presente",
        "tags": ["festival", "fado", "Castelo", "noite"],
        "lat": 38.7139,
        "lng": -9.1394,
        "iq_score": 86,
        "best_months": [6, 7],
    },
    {
        "_id": "mus_013",
        "name": "Tunas Academicas",
        "type": "tuna",
        "region": "Centro",
        "municipality": "Coimbra",
        "description_short": "Grupos musicais universitarios de capa e batina que tocam instrumentos de corda e sopro em serenatas e festivais.",
        "description_long": "As tunas academicas sao uma tradicao viva das universidades portuguesas, com origem em Coimbra. Vestidos de capa e batina, os tunantes tocam bandolim, guitarra, viola baixo e flauta em serenatas, cortejo da Queima das Fitas e festivais internacionais de tunas. Cada universidade tem as suas tunas masculinas, femininas e mistas.",
        "instruments": ["Bandolim", "Guitarra", "Viola baixo", "Flauta", "Pandeireta"],
        "genres": ["Serenata", "Marcha academica", "Fado de Coimbra"],
        "artists": ["Tuna Academica de Coimbra", "Tuna Feminina de Coimbra"],
        "unesco": False,
        "period": "Sec. XIX-presente",
        "tags": ["universidade", "capa e batina", "Queima das Fitas"],
        "lat": 40.2089,
        "lng": -8.4194,
        "iq_score": 82,
        "best_months": [5],
    },
    {
        "_id": "mus_014",
        "name": "Cavaquinho Minhoto",
        "type": "instrumento",
        "region": "Minho",
        "municipality": "Braga",
        "description_short": "Pequeno cordofone de 4 cordas nascido no Minho, antepassado do ukulele havaiano e do cavaquinho brasileiro.",
        "description_long": "O cavaquinho minhoto e um pequeno instrumento de 4 cordas metalicas originario de Braga. Os navegadores portugueses levaram-no ao Hawaii (onde se tornou ukulele), ao Brasil e a Cabo Verde. No Minho, e instrumento essencial dos ranchos folcloricos e dos desgarradas, com um som agudo e ritmico.",
        "instruments": ["Cavaquinho"],
        "genres": ["Folclore minhoto", "Desgarrada"],
        "artists": ["Julio Pereira"],
        "unesco": False,
        "period": "Sec. XVI-presente",
        "tags": ["4 cordas", "ukulele", "Braga", "exportacao cultural"],
        "lat": 41.5503,
        "lng": -8.4200,
        "iq_score": 89,
    },
]


# --- Helpers ---

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


async def _col_or_seed(col: str, seed: list) -> list:
    if _db is None:
        return [dict(d) for d in seed]
    try:
        docs = await _db[col].find({}).to_list(500)
        if docs:
            return [_serialize(d) for d in docs]
    except Exception:
        pass
    return [dict(d) for d in seed]


MUSIC_TYPES = {
    "fado": {"label": "Fado", "icon": "music_note"},
    "folclore": {"label": "Folclore", "icon": "groups"},
    "canto_polifonico": {"label": "Canto Polifonico", "icon": "mic"},
    "canto_tradicional": {"label": "Canto Tradicional", "icon": "record_voice_over"},
    "danca_tradicional": {"label": "Danca Tradicional", "icon": "directions_run"},
    "instrumento": {"label": "Instrumento", "icon": "piano"},
    "festival": {"label": "Festival", "icon": "festival"},
    "tuna": {"label": "Tuna Academica", "icon": "school"},
}


# --- Endpoints ---

@music_router.get("/items")
async def list_items(
    type: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    unesco: Optional[bool] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    items = await _col_or_seed("music_items", SEED_ITEMS)

    if type:
        items = [i for i in items if i.get("type") == type]
    if region:
        items = [i for i in items if region.lower() in i.get("region", "").lower()]
    if unesco is not None:
        items = [i for i in items if i.get("unesco") == unesco]
    if search:
        pat = re.compile(search, re.IGNORECASE)
        items = [i for i in items if pat.search(
            i.get("name", "") + " " + i.get("description_short", "") + " " + i.get("municipality", "")
        )]

    total = len(items)
    items_sorted = sorted(items, key=lambda x: x.get("iq_score", 0), reverse=True)
    return {"total": total, "offset": offset, "limit": limit, "results": items_sorted[offset: offset + limit]}


@music_router.get("/items/nearby")
async def items_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(80.0, le=500.0),
    type: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
):
    items = await _col_or_seed("music_items", SEED_ITEMS)
    results = []
    for item in items:
        if type and item.get("type") != type:
            continue
        dist = _haversine(lat, lng, item.get("lat", 0), item.get("lng", 0))
        if dist <= radius_km:
            results.append({**item, "distance_km": round(dist, 1)})
    results.sort(key=lambda x: x.get("distance_km", 9999))
    return {"lat": lat, "lng": lng, "radius_km": radius_km, "total": len(results), "results": results[:limit]}


@music_router.get("/types")
async def list_types():
    return {"types": MUSIC_TYPES}


@music_router.get("/items/{item_id}")
async def get_item_detail(item_id: str):
    items = await _col_or_seed("music_items", SEED_ITEMS)
    for item in items:
        if str(item.get("_id", item.get("id", ""))) == item_id:
            return item
    raise HTTPException(status_code=404, detail="Item musical nao encontrado")


# --- AI Narrative ---

class NarrativeRequest(BaseModel):
    item_id: str = Field(..., min_length=1, max_length=128)
    style: str = Field(default="cultural", min_length=1, max_length=32, description="cultural | children | academic | tourism")
    language: str = Field(default="pt", min_length=2, max_length=8, description="pt | en | es | fr")


@music_router.post("/narrative")
async def generate_narrative(
    body: NarrativeRequest,
    current_user: User = Depends(_auth_dep),
):
    items = await _col_or_seed("music_items", SEED_ITEMS)
    item = next((i for i in items if str(i.get("_id", i.get("id", ""))) == body.item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item musical nao encontrado")

    style_map = {
        "cultural": "narrativa cultural aprofundada com contexto historico e emocional",
        "children": "texto simples e divertido para criancas dos 8 aos 12 anos",
        "academic": "texto academico com referencias etnomusicologicas",
        "tourism": "texto turistico convidativo que motive a descoberta",
    }
    style_desc = style_map.get(body.style, style_map["cultural"])
    lang_map = {"pt": "portugues de Portugal", "en": "English", "es": "espanol", "fr": "francais"}
    lang = lang_map.get(body.language, "portugues de Portugal")

    instruments_str = ", ".join(item.get("instruments", [])) or "N/A"
    artists_str = ", ".join(item.get("artists", [])) or "N/A"

    prompt = f"""Escreve uma {style_desc} em {lang} sobre a seguinte tradicao musical portuguesa:

Nome: {item["name"]}
Tipo: {item["type"]}
Municipio: {item.get("municipality", "")}
Regiao: {item.get("region", "")}
Periodo: {item.get("period", "N/A")}
UNESCO: {"Sim" if item.get("unesco") else "Nao"}
Descricao base: {item.get("description_long", item.get("description_short", ""))}
Instrumentos: {instruments_str}
Artistas: {artists_str}

Responde em JSON com:
{{
  "title": "titulo evocador",
  "narrative": "texto de 150-200 palavras",
  "key_facts": ["facto 1", "facto 2", "facto 3"],
  "visitor_tip": "dica pratica para visitantes"
}}"""

    fallback = {
        "title": item["name"],
        "narrative": item.get("description_long", item.get("description_short", "")),
        "key_facts": item.get("tags", [])[:3],
        "visitor_tip": f"Visite {item.get('municipality', '')} para viver esta tradicao musical.",
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


# --- Themed Routes ---

THEMED_ROUTES = [
    {
        "id": "route_fado",
        "name": "Rota do Fado",
        "type": "fado",
        "region": "Lisboa - Coimbra",
        "description": "De Alfama as escadarias da Se Velha, seguindo o fado de Lisboa a Coimbra.",
        "stops": ["Lisboa (Alfama)", "Lisboa (Mouraria)", "Coimbra (Se Velha)", "Coimbra (Universidade)"],
        "duration_days": 3,
        "best_months": [3, 4, 5, 6, 9, 10, 11],
        "iq_score": 98,
    },
    {
        "id": "route_norte",
        "name": "Rota das Gaitas e Dancas do Norte",
        "type": "folclore",
        "region": "Minho - Tras-os-Montes",
        "description": "Dos ranchos minhotos aos pauliteiros transmontanos, passando pela gaita de foles.",
        "stops": ["Viana do Castelo", "Braga", "Braganca", "Miranda do Douro"],
        "duration_days": 4,
        "best_months": [6, 7, 8],
        "iq_score": 95,
    },
    {
        "id": "route_cante",
        "name": "Rota do Cante Alentejano",
        "type": "canto",
        "region": "Alentejo",
        "description": "Pelas tabernas e corais do Alentejo, onde o cante polifonico ecoa nas planicies.",
        "stops": ["Serpa", "Cuba", "Pias", "Beja", "Odemira"],
        "duration_days": 3,
        "best_months": [4, 5, 9, 10],
        "iq_score": 96,
    },
]


@music_router.get("/routes")
async def list_routes():
    return {"total": len(THEMED_ROUTES), "routes": THEMED_ROUTES}


# --- Stats ---

@music_router.get("/stats")
async def music_stats():
    items = await _col_or_seed("music_items", SEED_ITEMS)
    by_type: Dict[str, int] = {}
    unesco_count = 0
    for item in items:
        t = item.get("type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1
        if item.get("unesco"):
            unesco_count += 1

    return {
        "total_items": len(items),
        "by_type": by_type,
        "unesco_count": unesco_count,
        "themed_routes": len(THEMED_ROUTES),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
