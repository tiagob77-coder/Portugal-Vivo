"""
Cultural Routes API — Rotas Culturais Completas de Portugal (Premium)
Música · Dança · Festas · Tradições · Trajes · Instrumentos · Gastronomia
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

from llm_cache import build_cache_key, cache_get, cache_set, record_llm_call
from models.api_models import User

cultural_routes_router = APIRouter(prefix="/cultural-routes", tags=["Cultural Routes"])

_db = None
_llm_key: str = ""
_require_admin = None
_require_auth = None


def set_cultural_routes_db(database) -> None:
    global _db
    _db = database


def set_cultural_routes_llm_key(key: str) -> None:
    global _llm_key
    _llm_key = key


def set_cultural_routes_admin(admin_fn) -> None:
    global _require_admin
    _require_admin = admin_fn


def set_cultural_routes_auth(auth_fn) -> None:
    global _require_auth
    _require_auth = auth_fn


async def _admin_dep(request: Request) -> User:
    return await _require_admin(request)


async def _auth_dep(request: Request) -> User:
    return await _require_auth(request)


# ─── Route Family enum ────────────────────────────────────────────────────────

ROUTE_FAMILIES = {
    "musicais": {"label": "Rotas Musicais", "icon": "music-note", "color": "#8B5CF6"},
    "danca": {"label": "Rotas de Dança e Folclore", "icon": "directions-run", "color": "#EC4899"},
    "festas": {"label": "Rotas de Festas e Romarias", "icon": "celebration", "color": "#F59E0B"},
    "trajes": {"label": "Rotas de Trajes e Identidade", "icon": "checkroom", "color": "#06B6D4"},
    "instrumentos": {"label": "Rotas de Instrumentos Tradicionais", "icon": "piano", "color": "#10B981"},
    "integradas": {"label": "Rotas Culturais Integradas", "icon": "auto-awesome", "color": "#EF4444"},
}

REGIONS_PT = [
    "Minho", "Trás-os-Montes", "Douro", "Porto", "Beira Litoral",
    "Beira Interior", "Ribatejo", "Estremadura", "Alentejo", "Algarve",
    "Lisboa", "Açores", "Madeira",
]


# ─── SEED DATA: Rotas Musicais ───────────────────────────────────────────────

SEED_ROUTES: List[Dict[str, Any]] = [
    # ── 2.1 Rota do Fado ──────────────────────────────────────────────────
    {
        "_id": "cr_mus_001",
        "name": "Rota do Fado",
        "family": "musicais",
        "sub_family": "fado",
        "region": "Lisboa",
        "municipalities": ["Lisboa", "Coimbra"],
        "unesco": True,
        "unesco_label": "Fado — Património Imaterial da Humanidade (2011)",
        "description_short": "Do Bairro Alto à Mouraria, de Alfama a Coimbra — a rota completa do Fado, o canto da alma portuguesa.",
        "description_long": "O Fado, inscrito na lista UNESCO desde 2011, é mais do que música: é identidade. Esta rota percorre as casas históricas de Lisboa (Museu do Fado, Casa da Mariquinhas, Clube de Fado), as tascas de Alfama, a Mouraria onde nasceu, e sobe a Coimbra para as serenatas académicas. Inclui oficinas de guitarra portuguesa, percursos de luthiers e uma linha-tempo interativa de Amália a Mariza.",
        "stops": [
            {"name": "Museu do Fado", "lat": 38.7108, "lng": -9.1314, "municipality": "Lisboa", "type": "museu"},
            {"name": "Alfama — Casas de Fado", "lat": 38.7116, "lng": -9.1300, "municipality": "Lisboa", "type": "bairro_historico"},
            {"name": "Mouraria — Berço do Fado", "lat": 38.7148, "lng": -9.1350, "municipality": "Lisboa", "type": "bairro_historico"},
            {"name": "Bairro Alto — Noite de Fado", "lat": 38.7137, "lng": -9.1465, "municipality": "Lisboa", "type": "bairro_historico"},
            {"name": "Coimbra — Serenatas Académicas", "lat": 40.2089, "lng": -8.4265, "municipality": "Coimbra", "type": "universidade"},
        ],
        "duration_days": 3,
        "best_months": [3, 4, 5, 6, 9, 10],
        "music_genres": ["fado_tradicional", "fado_coimbra", "guitarra_portuguesa"],
        "instruments": ["guitarra_portuguesa", "viola_de_fado", "baixo_acustico"],
        "dances": [],
        "gastronomy": ["petiscos de Alfama", "bacalhau à Brás", "pastéis de nata", "ginjinha", "vinho do Porto"],
        "costumes": ["xaile negro da fadista", "traje académico de Coimbra"],
        "voices_orality": ["Amália Rodrigues", "Carlos Paredes", "Mariza", "Ana Moura", "Camané"],
        "festivals": ["Festa do Fado (Mouraria)", "Caixa Alfama", "Festival de Fado de Coimbra"],
        "tags": ["fado", "UNESCO", "Lisboa", "Coimbra", "guitarra", "saudade", "premium"],
        "premium": True,
        "iq_score": 99,
        "lat": 38.7116,
        "lng": -9.1300,
    },
    # ── 2.2 Rota das Modas Alentejanas ────────────────────────────────────
    {
        "_id": "cr_mus_002",
        "name": "Rota do Cante Alentejano",
        "family": "musicais",
        "sub_family": "cante_alentejano",
        "region": "Alentejo",
        "municipalities": ["Beja", "Évora", "Serpa", "Reguengos de Monsaraz", "Cuba"],
        "unesco": True,
        "unesco_label": "Cante Alentejano — Património Imaterial da Humanidade (2014)",
        "description_short": "Vozes que ecoam na planície — a rota do Cante Alentejano, canto polifónico masculino e feminino do sul.",
        "description_long": "O Cante Alentejano, inscrito na UNESCO em 2014, é um canto polifónico singular. Grupos corais de homens e mulheres cantam em tabernas, festas e saraus. Esta rota percorre concelhos de Beja a Évora, mapeando mais de 150 grupos activos, tabernas tradicionais com degustação (pão, queijo, azeite DOP, vinho), e oficinas de aprendizagem do cante.",
        "stops": [
            {"name": "Serpa — Capital do Cante", "lat": 37.9419, "lng": -7.5987, "municipality": "Serpa", "type": "sede_cultural"},
            {"name": "Casa do Cante — Serpa", "lat": 37.9430, "lng": -7.5970, "municipality": "Serpa", "type": "museu"},
            {"name": "Beja — Grupos Corais", "lat": 38.0151, "lng": -7.8632, "municipality": "Beja", "type": "cidade"},
            {"name": "Reguengos de Monsaraz", "lat": 38.4274, "lng": -7.5330, "municipality": "Reguengos de Monsaraz", "type": "vila"},
            {"name": "Évora — Tabernas de Cante", "lat": 38.5710, "lng": -7.9093, "municipality": "Évora", "type": "cidade_historica"},
        ],
        "duration_days": 3,
        "best_months": [3, 4, 5, 9, 10, 11],
        "music_genres": ["cante_alentejano", "polifonia_coral"],
        "instruments": [],
        "dances": ["danca_roda_alentejana"],
        "gastronomy": ["migas alentejanas", "açorda", "queijo de Serpa DOP", "azeite de Moura DOP", "vinho do Alentejo"],
        "costumes": ["traje de pastor alentejano", "traje de ceifeira", "chapéu alentejano"],
        "voices_orality": ["Grupo Coral de Serpa", "Grupo Coral de Cuba", "Cantadeiras de Beja"],
        "festivals": ["Festival do Cante (Serpa)", "Encontro de Cante Alentejano"],
        "tags": ["cante", "UNESCO", "Alentejo", "polifonia", "coral", "taberna", "premium"],
        "premium": True,
        "iq_score": 98,
        "lat": 37.9419,
        "lng": -7.5987,
    },
    # ── 2.3 Rota das Chamarritas Açorianas ────────────────────────────────
    {
        "_id": "cr_mus_003",
        "name": "Rota das Chamarritas Açorianas",
        "family": "musicais",
        "sub_family": "chamarrita",
        "region": "Açores",
        "municipalities": ["Angra do Heroísmo", "Ponta Delgada", "Horta", "Madalena"],
        "unesco": False,
        "description_short": "De ilha em ilha, as Chamarritas açorianas — ritmos de roda, rajões e concertinas sobre o Atlântico.",
        "description_long": "A Chamarrita é a dança-canção símbolo dos Açores. Cada ilha tem variantes: 3/4 na Terceira, 2/4 em São Miguel, com rajão no Pico. Esta rota percorre as 9 ilhas mapeando grupos de folclore, festas do Espírito Santo, casas de brinquinho e oficinas de instrumentos tradicionais açorianos.",
        "stops": [
            {"name": "Angra do Heroísmo — Terceira", "lat": 38.6547, "lng": -27.2211, "municipality": "Angra do Heroísmo", "type": "cidade_UNESCO"},
            {"name": "Ponta Delgada — São Miguel", "lat": 37.7412, "lng": -25.6756, "municipality": "Ponta Delgada", "type": "cidade"},
            {"name": "Horta — Faial", "lat": 38.5327, "lng": -28.6296, "municipality": "Horta", "type": "cidade"},
            {"name": "Madalena — Pico", "lat": 38.5333, "lng": -28.5333, "municipality": "Madalena", "type": "vila"},
        ],
        "duration_days": 7,
        "best_months": [5, 6, 7, 8, 9],
        "music_genres": ["chamarrita", "baile_roda_acoriano"],
        "instruments": ["rajao", "viola", "concertina", "triangulo", "pandeireta"],
        "dances": ["chamarrita", "sapateia"],
        "gastronomy": ["alcatra", "cozido das Furnas", "queijadas da Vila", "vinho do Pico"],
        "costumes": ["traje de chamarrita", "traje de festa açoriano"],
        "voices_orality": ["cantadores à desafio", "filarmónicas insulares"],
        "festivals": ["Festas do Espírito Santo", "Sanjoaninas (Terceira)"],
        "tags": ["Açores", "chamarrita", "ilhas", "rajão", "folclore_insular", "premium"],
        "premium": True,
        "iq_score": 93,
        "lat": 38.6547,
        "lng": -27.2211,
    },
    # ── 2.4 Rota dos Pauliteiros de Miranda ───────────────────────────────
    {
        "_id": "cr_mus_004",
        "name": "Rota dos Pauliteiros de Miranda",
        "family": "musicais",
        "sub_family": "pauliteiros",
        "region": "Trás-os-Montes",
        "municipalities": ["Miranda do Douro", "Vimioso", "Mogadouro", "Bragança"],
        "unesco": False,
        "description_short": "A dança guerreira dos Pauliteiros — paus, gaitas-de-foles e aldeias de granito no planalto mirandês.",
        "description_long": "Os Pauliteiros de Miranda são uma dança guerreira ancestral, executada com paus (paulitos) cruzados ao ritmo da gaita-de-foles transmontana. Esta rota percorre as aldeias do planalto mirandês, onde se mantêm grupos activos, oficinas de gaita-de-foles, museus de traje mirandês e circuitos pedestres pelas aldeias de Vimioso e Mogadouro.",
        "stops": [
            {"name": "Miranda do Douro — Núcleo Central", "lat": 41.5000, "lng": -6.2747, "municipality": "Miranda do Douro", "type": "cidade"},
            {"name": "Duas Igrejas — Pauliteiros", "lat": 41.4667, "lng": -6.3000, "municipality": "Miranda do Douro", "type": "aldeia"},
            {"name": "Vimioso — Aldeias de Gaita", "lat": 41.5833, "lng": -6.5333, "municipality": "Vimioso", "type": "vila"},
            {"name": "Mogadouro — Circuito Rural", "lat": 41.3400, "lng": -6.7167, "municipality": "Mogadouro", "type": "vila"},
            {"name": "Bragança — Museu Ibérico da Máscara", "lat": 41.8061, "lng": -6.7567, "municipality": "Bragança", "type": "museu"},
        ],
        "duration_days": 3,
        "best_months": [5, 6, 7, 8, 12],
        "music_genres": ["musica_pauliteiros", "gaita_de_foles"],
        "instruments": ["gaita_de_foles", "caixa", "bombo", "paulitos"],
        "dances": ["pauliteiros", "danca_roda_transmontana"],
        "gastronomy": ["posta mirandesa", "alheira de Mirandela", "azeite DOP de Trás-os-Montes", "vinho do Douro"],
        "costumes": ["traje mirandês masculino", "traje mirandês feminino", "saiote de Pauliteiro"],
        "voices_orality": ["língua mirandesa", "cantigas de trabalho"],
        "festivals": ["Festas de Santa Bárbara", "Festival Intercéltico de Miranda"],
        "tags": ["Pauliteiros", "Miranda", "gaita-de-foles", "dança_guerreira", "Trás-os-Montes", "premium"],
        "premium": True,
        "iq_score": 96,
        "lat": 41.5000,
        "lng": -6.2747,
    },
    # ── 2.5 Rota da Viola Braguesa e Cavaquinho ───────────────────────────
    {
        "_id": "cr_mus_005",
        "name": "Rota da Viola Braguesa e Cavaquinho",
        "family": "musicais",
        "sub_family": "viola_braguesa",
        "region": "Minho",
        "municipalities": ["Braga", "Vila Verde", "Terras de Bouro", "Vieira do Minho"],
        "unesco": False,
        "description_short": "O coração cordofone do Minho — violas braguesas, cavaquinhos e oficinas de luthiers entre Braga e o Gerês.",
        "description_long": "O Minho é o berço da viola braguesa e do cavaquinho (que viajou ao Brasil e deu origem ao ukulele). Esta rota liga Braga a Vila Verde, Terras de Bouro e Vieira do Minho, passando por oficinas de luthiers, grupos folclóricos de tanças, viras e chulas, e festas de romaria onde os instrumentos ganham vida.",
        "stops": [
            {"name": "Braga — Casa dos Cordofones", "lat": 41.5503, "lng": -8.4275, "municipality": "Braga", "type": "museu"},
            {"name": "Vila Verde — Luthiers de Viola", "lat": 41.6500, "lng": -8.4333, "municipality": "Vila Verde", "type": "oficina"},
            {"name": "Terras de Bouro — Folclore do Gerês", "lat": 41.7167, "lng": -8.3000, "municipality": "Terras de Bouro", "type": "vila"},
            {"name": "Vieira do Minho — Cavaquinhos", "lat": 41.6333, "lng": -8.1333, "municipality": "Vieira do Minho", "type": "vila"},
        ],
        "duration_days": 2,
        "best_months": [5, 6, 7, 8, 9],
        "music_genres": ["musica_minhota", "chula", "vira"],
        "instruments": ["viola_braguesa", "cavaquinho", "concertina", "adufe", "ferrinhos"],
        "dances": ["vira", "chula", "tanca", "cana_verde"],
        "gastronomy": ["arroz de sarrabulho", "rojões", "papas de sarrabulho", "vinho verde"],
        "costumes": ["traje de Viana", "traje de romeira minhota"],
        "voices_orality": ["cantigas ao desafio", "cantares de roda"],
        "festivals": ["Festas de São João de Braga", "Romaria de São Bento da Porta Aberta"],
        "tags": ["viola_braguesa", "cavaquinho", "Minho", "luthier", "folclore", "premium"],
        "premium": True,
        "iq_score": 94,
        "lat": 41.5503,
        "lng": -8.4275,
    },
    # ── 2.6 Rota da Música Atlântica (Madeira + Açores) ──────────────────
    {
        "_id": "cr_mus_006",
        "name": "Rota da Música Atlântica",
        "family": "musicais",
        "sub_family": "musica_atlantica",
        "region": "Madeira",
        "municipalities": ["Funchal", "Câmara de Lobos", "São Jorge", "Curral das Freiras"],
        "unesco": False,
        "description_short": "Bailinhos da Madeira e brinquinhos — a música das ilhas atlânticas entre o Funchal e o mar.",
        "description_long": "A Madeira preserva um folclore rural singular: o Bailinho da Madeira com as suas variantes (Curral das Freiras, São Jorge, Porto Santo). O brinquinho, instrumento-boneco com bonecos de madeira que dançam, é símbolo da ilha. Esta rota liga o Funchal a Câmara de Lobos, São Jorge e regiões rurais, com oficinas de construção de brinquinho e espetáculos de folclore insular.",
        "stops": [
            {"name": "Funchal — Casa-Museu do Folclore", "lat": 32.6500, "lng": -16.9083, "municipality": "Funchal", "type": "museu"},
            {"name": "Câmara de Lobos — Luthiers de Brinquinho", "lat": 32.6500, "lng": -16.9764, "municipality": "Câmara de Lobos", "type": "oficina"},
            {"name": "Curral das Freiras — Bailinho Rural", "lat": 32.7200, "lng": -16.9800, "municipality": "Funchal", "type": "aldeia"},
            {"name": "São Jorge — Folclore de Montanha", "lat": 32.8300, "lng": -16.9000, "municipality": "São Jorge", "type": "vila"},
        ],
        "duration_days": 3,
        "best_months": [4, 5, 6, 7, 8, 9],
        "music_genres": ["bailinho_madeira", "brinquinho"],
        "instruments": ["brinquinho", "machete", "rajao", "viola_de_arame"],
        "dances": ["bailinho_madeira", "charamba"],
        "gastronomy": ["espetada madeirense", "bolo de mel", "poncha", "vinho Madeira"],
        "costumes": ["traje madeirense de festa", "barrete de orelhas"],
        "voices_orality": ["despiques", "cantigas de embalar madeirenses"],
        "festivals": ["Festa da Flor", "Festival de Folclore da Madeira"],
        "tags": ["Madeira", "bailinho", "brinquinho", "ilhas", "Atlântico", "premium"],
        "premium": True,
        "iq_score": 91,
        "lat": 32.6500,
        "lng": -16.9083,
    },
    # ── 3.1 Rota das Danças do Minho ──────────────────────────────────────
    {
        "_id": "cr_dan_001",
        "name": "Rota das Danças do Minho",
        "family": "danca",
        "sub_family": "dancas_minho",
        "region": "Minho",
        "municipalities": ["Viana do Castelo", "Braga", "Ponte de Lima", "Barcelos"],
        "unesco": False,
        "description_short": "Viras, chulas e canas-verdes — as danças mais vibrantes do Norte, entre romarias e trajes bordados.",
        "description_long": "O Minho é o epicentro do folclore português. Viras, chulas, canas-verdes e danças de roda animam romarias de São João, São Pedro e São Martinho. Os trajes de Viana, com rendas, filigranas e bordados de ouro, são a expressão máxima da identidade minhota. Esta rota liga Viana do Castelo a Braga, passando por Ponte de Lima e Barcelos.",
        "stops": [
            {"name": "Viana do Castelo — Traje de Dote", "lat": 41.6934, "lng": -8.8301, "municipality": "Viana do Castelo", "type": "cidade"},
            {"name": "Ponte de Lima — Feiras Medievais", "lat": 41.7672, "lng": -8.5842, "municipality": "Ponte de Lima", "type": "vila"},
            {"name": "Barcelos — Galo e Folclore", "lat": 41.5353, "lng": -8.6177, "municipality": "Barcelos", "type": "cidade"},
            {"name": "Braga — Romarias e Danças", "lat": 41.5503, "lng": -8.4275, "municipality": "Braga", "type": "cidade"},
        ],
        "duration_days": 3,
        "best_months": [5, 6, 7, 8],
        "music_genres": ["musica_minhota", "rancho_folclorico"],
        "instruments": ["concertina", "viola_braguesa", "cavaquinho", "bombo", "ferrinhos"],
        "dances": ["vira", "chula", "cana_verde", "malhao"],
        "gastronomy": ["rojões à minhota", "papas de sarrabulho", "arroz de lampreia", "vinho verde"],
        "costumes": ["traje de Viana", "traje de dote", "traje de lavradeira"],
        "festivals": ["Festa da Agonia (Viana)", "São João de Braga", "Feira de Barcelos"],
        "tags": ["Minho", "vira", "chula", "folclore", "traje_viana", "premium"],
        "premium": True,
        "iq_score": 97,
        "lat": 41.6934,
        "lng": -8.8301,
    },
    # ── 3.2 Rota das Danças Transmontanas ─────────────────────────────────
    {
        "_id": "cr_dan_002",
        "name": "Rota das Danças Transmontanas",
        "family": "danca",
        "sub_family": "dancas_transmontanas",
        "region": "Trás-os-Montes",
        "municipalities": ["Bragança", "Miranda do Douro", "Mirandela", "Vinhais"],
        "unesco": False,
        "description_short": "Pauliteiros, danças de roda e burel — o folclore guerreiro e pastoril do planalto transmontano.",
        "description_long": "Trás-os-Montes preserva danças ancestrais: os Pauliteiros de Miranda (dança guerreira com paus), danças de roda em festas de santo-padroeiro, e rituais de Inverno com caretos e máscaras. As oficinas de tecelagem de burel e lã completam a rota, ligando música, dança e artesanato têxtil.",
        "stops": [
            {"name": "Bragança — Museu da Máscara", "lat": 41.8061, "lng": -6.7567, "municipality": "Bragança", "type": "museu"},
            {"name": "Miranda — Pauliteiros", "lat": 41.5000, "lng": -6.2747, "municipality": "Miranda do Douro", "type": "cidade"},
            {"name": "Mirandela — Tecelagem de Burel", "lat": 41.4850, "lng": -7.1833, "municipality": "Mirandela", "type": "oficina"},
            {"name": "Vinhais — Danças de Roda", "lat": 41.8333, "lng": -7.0000, "municipality": "Vinhais", "type": "vila"},
        ],
        "duration_days": 3,
        "best_months": [6, 7, 8, 12, 1, 2],
        "music_genres": ["gaita_de_foles", "musica_pauliteiros"],
        "instruments": ["gaita_de_foles", "caixa", "bombo", "paulitos"],
        "dances": ["pauliteiros", "danca_roda_transmontana", "danca_caretos"],
        "gastronomy": ["posta mirandesa", "alheira", "folar de Vinhais", "castanhas"],
        "costumes": ["traje mirandês", "traje de careto", "capa de burel"],
        "festivals": ["Carnaval de Podence", "Entrudo Chocalheiro", "Festas de Santa Bárbara"],
        "tags": ["Trás-os-Montes", "pauliteiros", "caretos", "burel", "danças_guerreiras", "premium"],
        "premium": True,
        "iq_score": 95,
        "lat": 41.8061,
        "lng": -6.7567,
    },
    # ── 3.3 Rota das Danças Beirãs ────────────────────────────────────────
    {
        "_id": "cr_dan_003",
        "name": "Rota das Adufeiras e Danças Beirãs",
        "family": "danca",
        "sub_family": "dancas_beiras",
        "region": "Beira Interior",
        "municipalities": ["Idanha-a-Nova", "Castelo Branco", "Monsanto", "Penamacor"],
        "unesco": True,
        "unesco_label": "Idanha-a-Nova — Cidade Criativa da Música UNESCO (2015)",
        "description_short": "Adufes, romarias e danças de trabalho — a Beira Interior como guardiã de tradições milenares.",
        "description_long": "A Beira Interior, com Idanha-a-Nova como Cidade Criativa da Música UNESCO, preserva tradições únicas: as adufeiras (mulheres que tocam adufe, tambor quadrado de origem árabe), danças de vindima, ceifa e apanha de azeitona, e romarias rurais. Monsanto, a aldeia mais portuguesa de Portugal, é paragem obrigatória.",
        "stops": [
            {"name": "Idanha-a-Nova — Capital do Adufe", "lat": 39.9222, "lng": -7.2367, "municipality": "Idanha-a-Nova", "type": "cidade_criativa_UNESCO"},
            {"name": "Monsanto — Aldeia Histórica", "lat": 40.0389, "lng": -7.1142, "municipality": "Idanha-a-Nova", "type": "aldeia_historica"},
            {"name": "Castelo Branco — Bordado e Dança", "lat": 39.8224, "lng": -7.4913, "municipality": "Castelo Branco", "type": "cidade"},
            {"name": "Penamacor — Romarias Serranas", "lat": 40.1667, "lng": -7.1667, "municipality": "Penamacor", "type": "vila"},
        ],
        "duration_days": 2,
        "best_months": [4, 5, 6, 9, 10],
        "music_genres": ["musica_adufe", "cantigas_trabalho"],
        "instruments": ["adufe", "gaita", "concertina"],
        "dances": ["danca_adufe", "danca_vindima", "danca_ceifa"],
        "gastronomy": ["cabrito assado", "queijo da Serra", "azeite da Beira Baixa", "tigelada"],
        "costumes": ["traje de adufeira", "traje de bordadeira de Castelo Branco"],
        "festivals": ["Boom Festival", "Festival Terras sem Sombra", "Romaria de Monsanto"],
        "tags": ["adufe", "UNESCO", "Beira", "Idanha", "Monsanto", "danças_trabalho", "premium"],
        "premium": True,
        "iq_score": 94,
        "lat": 39.9222,
        "lng": -7.2367,
    },
    # ── 3.4 Rota das Danças Ribatejanas ───────────────────────────────────
    {
        "_id": "cr_dan_004",
        "name": "Rota das Danças Ribatejanas",
        "family": "danca",
        "sub_family": "dancas_ribatejo",
        "region": "Ribatejo",
        "municipalities": ["Santarém", "Golegã", "Vila Franca de Xira", "Coruche"],
        "unesco": False,
        "description_short": "Campinos, fandangos e festas taurinas — o folclore equestre e rural da lezíria do Tejo.",
        "description_long": "O Ribatejo é terra de campinos, cavalos e touros. As danças ribatejanas mesclam tradições equestres com fandangos e rituais de São Martinho e São Nicolau. A Golegã (Feira do Cavalo), Vila Franca de Xira (colete encarnado) e Santarém (Feira da Agricultura) são os vértices desta rota de folclore agrário.",
        "stops": [
            {"name": "Santarém — Capital do Gótico", "lat": 39.2361, "lng": -8.6851, "municipality": "Santarém", "type": "cidade"},
            {"name": "Golegã — Feira do Cavalo", "lat": 39.4000, "lng": -8.4833, "municipality": "Golegã", "type": "vila"},
            {"name": "Vila Franca de Xira — Colete Encarnado", "lat": 38.9500, "lng": -8.9833, "municipality": "Vila Franca de Xira", "type": "cidade"},
            {"name": "Coruche — Capital do Touro", "lat": 38.9572, "lng": -8.5278, "municipality": "Coruche", "type": "vila"},
        ],
        "duration_days": 2,
        "best_months": [6, 7, 10, 11],
        "music_genres": ["fandango", "musica_campina"],
        "instruments": ["concertina", "viola", "guitarra", "bombo"],
        "dances": ["fandango_ribatejano", "danca_campinos"],
        "gastronomy": ["sopa da pedra", "morcela de arroz", "fatias de Tomar", "vinho do Ribatejo"],
        "costumes": ["traje de campino", "colete encarnado", "barrete verde"],
        "festivals": ["Feira Nacional do Cavalo (Golegã)", "Colete Encarnado (VFX)", "Feira de Santarém"],
        "tags": ["Ribatejo", "campinos", "cavalos", "fandango", "touros", "premium"],
        "premium": True,
        "iq_score": 92,
        "lat": 39.2361,
        "lng": -8.6851,
    },
    # ── 3.5–3.7 Danças Alentejanas, Algarvias, Insulares ────────────────
    {
        "_id": "cr_dan_005",
        "name": "Rota das Danças do Alentejo e Algarve",
        "family": "danca",
        "sub_family": "dancas_sul",
        "region": "Alentejo",
        "municipalities": ["Évora", "Mértola", "Vila Real de Santo António", "São Brás de Alportel"],
        "unesco": False,
        "description_short": "Danças lentas do Alentejo e danças marítimas do Algarve — o sul em movimento circular.",
        "description_long": "No Alentejo, as danças lentas e circulares de roda acompanham o Cante; no Algarve, danças marítimas de pescadores marcam festas de São Pedro. Esta rota dual liga Évora a Mértola (aldeia islâmica) e desce ao Algarve costeiro, cruzando culturas de planície e mar.",
        "stops": [
            {"name": "Évora — Danças de Roda", "lat": 38.5710, "lng": -7.9093, "municipality": "Évora", "type": "cidade_historica"},
            {"name": "Mértola — Herança Árabe", "lat": 37.6410, "lng": -7.6609, "municipality": "Mértola", "type": "vila_historica"},
            {"name": "Vila Real de Santo António — Danças do Mar", "lat": 37.1944, "lng": -7.4180, "municipality": "Vila Real de Santo António", "type": "cidade"},
            {"name": "São Brás de Alportel — Folclore Algarvio", "lat": 37.1500, "lng": -7.8833, "municipality": "São Brás de Alportel", "type": "vila"},
        ],
        "duration_days": 3,
        "best_months": [4, 5, 6, 9, 10],
        "music_genres": ["cante_alentejano", "musica_algarvia"],
        "instruments": ["viola_campaniça", "adufe", "concertina"],
        "dances": ["danca_roda_alentejana", "danca_pescadores_algarve", "corridinho"],
        "gastronomy": ["cataplana", "xerém", "migas", "figos secos com amêndoa"],
        "costumes": ["traje de pastor alentejano", "traje de pescador algarvio"],
        "festivals": ["Festival Islâmico de Mértola", "FolkFaro"],
        "tags": ["Alentejo", "Algarve", "danças_circulares", "pescadores", "corridinho", "premium"],
        "premium": True,
        "iq_score": 89,
        "lat": 38.5710,
        "lng": -7.9093,
    },
    # ── 4.1 Rota das Festas do Espírito Santo ────────────────────────────
    {
        "_id": "cr_fes_001",
        "name": "Rota das Festas do Espírito Santo",
        "family": "festas",
        "sub_family": "espirito_santo",
        "region": "Açores",
        "municipalities": ["Ponta Delgada", "Angra do Heroísmo", "Horta", "Praia da Vitória"],
        "unesco": False,
        "description_short": "Impérios, coroações e Sopas do Espírito Santo — a maior tradição festiva dos Açores, ilha a ilha.",
        "description_long": "As Festas do Espírito Santo são o coração cultural dos Açores. Cada ilha celebra com Impérios (capelas decoradas), coroações de imperadores e imperatrizes, bandas filarmónicas e as famosas Sopas do Espírito Santo. Esta rota percorre as 9 ilhas, mapeando Impérios, calendários de coroações e circuitos gastronómicos associados.",
        "stops": [
            {"name": "Ponta Delgada — Impérios de São Miguel", "lat": 37.7412, "lng": -25.6756, "municipality": "Ponta Delgada", "type": "cidade"},
            {"name": "Angra — Impérios da Terceira", "lat": 38.6547, "lng": -27.2211, "municipality": "Angra do Heroísmo", "type": "cidade_UNESCO"},
            {"name": "Horta — Impérios do Faial", "lat": 38.5327, "lng": -28.6296, "municipality": "Horta", "type": "cidade"},
            {"name": "Praia da Vitória — Festas Maiores", "lat": 38.7333, "lng": -27.0667, "municipality": "Praia da Vitória", "type": "cidade"},
        ],
        "duration_days": 5,
        "best_months": [5, 6, 7],
        "music_genres": ["filarmonica_acoriana", "marchas_populares"],
        "instruments": ["filarmonica", "clarinete", "trombone", "caixa"],
        "dances": ["chamarrita", "sapateia"],
        "gastronomy": ["Sopas do Espírito Santo", "alcatra", "massa sovada", "vinho do Pico"],
        "costumes": ["traje de imperador", "traje de coroação"],
        "festivals": ["Festas do Espírito Santo (todas as ilhas)"],
        "tags": ["Açores", "Espírito_Santo", "Impérios", "coroações", "filarmónicas", "premium"],
        "premium": True,
        "iq_score": 98,
        "lat": 37.7412,
        "lng": -25.6756,
    },
    # ── 4.2 Rota dos Santos Populares ─────────────────────────────────────
    {
        "_id": "cr_fes_002",
        "name": "Rota dos Santos Populares",
        "family": "festas",
        "sub_family": "santos_populares",
        "region": "Lisboa",
        "municipalities": ["Lisboa", "Porto", "Braga", "Aveiro", "Coimbra"],
        "unesco": False,
        "description_short": "Santo António, São João e São Pedro — as maiores festas urbanas de Portugal, de Lisboa ao Porto.",
        "description_long": "Os Santos Populares (Junho) são a festa de rua mais vibrante de Portugal. Lisboa celebra Santo António com marchas, arraiais e casamentos populares; o Porto e Braga vibram com o São João (martelos, balões, fogueiras, manjericos); São Pedro estende-se de Coimbra ao Alentejo. Esta rota liga as 3 capitais festivas numa viagem de arraiais, sardinhas, caldo verde e música ao vivo.",
        "stops": [
            {"name": "Lisboa — Marchas de Santo António", "lat": 38.7223, "lng": -9.1393, "municipality": "Lisboa", "type": "cidade"},
            {"name": "Porto — Noite de São João", "lat": 41.1579, "lng": -8.6291, "municipality": "Porto", "type": "cidade"},
            {"name": "Braga — São João Minhopto", "lat": 41.5503, "lng": -8.4275, "municipality": "Braga", "type": "cidade"},
            {"name": "Aveiro — Festas de São Pedro", "lat": 40.6405, "lng": -8.6538, "municipality": "Aveiro", "type": "cidade"},
        ],
        "duration_days": 4,
        "best_months": [6],
        "music_genres": ["marchas_populares", "musica_popular", "pimba"],
        "instruments": ["concertina", "guitarra", "bombo", "martelos_sao_joao"],
        "dances": ["marchas_populares", "bailarico"],
        "gastronomy": ["sardinhas assadas", "caldo verde", "manjericos", "bifanas", "ginjinha"],
        "costumes": ["traje de marcha popular", "traje de arraial"],
        "festivals": ["Festas de Lisboa", "São João do Porto", "São João de Braga"],
        "tags": ["Santos_Populares", "Lisboa", "Porto", "sardinhas", "marchas", "arraial", "premium"],
        "premium": True,
        "iq_score": 99,
        "lat": 38.7223,
        "lng": -9.1393,
    },
    # ── 4.3 Rota das Romarias do Minho ───────────────────────────────────
    {
        "_id": "cr_fes_003",
        "name": "Rota das Romarias do Minho",
        "family": "festas",
        "sub_family": "romarias_minho",
        "region": "Minho",
        "municipalities": ["Viana do Castelo", "Ponte de Lima", "Braga", "Guimarães"],
        "unesco": False,
        "description_short": "Agonia, Bom Jesus e São Bento — as romarias mais espetaculares do norte, com trajes de ouro e fogo.",
        "description_long": "O Minho é terra de romarias. A Festa da Agonia (Viana) com tapetes de flores e trajes de dote de ouro é a mais famosa. São Bento da Porta Aberta, Bom Jesus de Braga e as romarias de Guimarães completam um circuito único de devoção, música e gastronomia.",
        "stops": [
            {"name": "Viana — Festa da Agonia", "lat": 41.6934, "lng": -8.8301, "municipality": "Viana do Castelo", "type": "cidade"},
            {"name": "Ponte de Lima — Feiras e Romarias", "lat": 41.7672, "lng": -8.5842, "municipality": "Ponte de Lima", "type": "vila"},
            {"name": "Braga — Bom Jesus / São João", "lat": 41.5503, "lng": -8.4275, "municipality": "Braga", "type": "cidade"},
            {"name": "Guimarães — Nicolinas", "lat": 41.4434, "lng": -8.2917, "municipality": "Guimarães", "type": "cidade_historica"},
        ],
        "duration_days": 4,
        "best_months": [6, 7, 8, 12],
        "music_genres": ["rancho_folclorico", "bandas_filarmonica"],
        "instruments": ["concertina", "viola_braguesa", "bombo", "gaita"],
        "dances": ["vira", "chula", "malhao"],
        "gastronomy": ["rojões", "sarrabulho", "arroz de pato", "vinho verde"],
        "costumes": ["traje de dote de Viana", "traje de romeira"],
        "festivals": ["Festa da Agonia", "Festas Nicolinas (Guimarães)", "São João de Braga"],
        "tags": ["Minho", "romarias", "Agonia", "Nicolinas", "traje_ouro", "premium"],
        "premium": True,
        "iq_score": 97,
        "lat": 41.6934,
        "lng": -8.8301,
    },
    # ── 4.4 Rota das Festas Agrícolas ────────────────────────────────────
    {
        "_id": "cr_fes_004",
        "name": "Rota das Festas Agrícolas",
        "family": "festas",
        "sub_family": "festas_agricolas",
        "region": "Douro",
        "municipalities": ["Peso da Régua", "Pinhão", "Viseu", "Fundão"],
        "unesco": True,
        "unesco_label": "Alto Douro Vinhateiro — Património Mundial (2001)",
        "description_short": "Vindimas, ceifas e transumância — as festas do ciclo agrário, do Douro à Serra da Estrela.",
        "description_long": "As festas agrícolas celebram o ciclo da terra: vindimas no Douro (lagaradas e pisas, com cânticos de trabalho), ceifas na Beira Interior, apanha da azeitona no Alentejo e transumância na Serra da Estrela. Esta rota liga o Douro vinhateiro a Viseu, Fundão e aldeias serranas, com recriações autênticas, degustações e música de trabalho.",
        "stops": [
            {"name": "Pinhão — Vindimas do Douro", "lat": 41.1883, "lng": -7.5460, "municipality": "Pinhão", "type": "aldeia"},
            {"name": "Peso da Régua — Lagaradas", "lat": 41.1625, "lng": -7.7894, "municipality": "Peso da Régua", "type": "cidade"},
            {"name": "Viseu — Feira de São Mateus", "lat": 40.6566, "lng": -7.9125, "municipality": "Viseu", "type": "cidade"},
            {"name": "Fundão — Cereja e Ceifa", "lat": 40.1376, "lng": -7.5014, "municipality": "Fundão", "type": "cidade"},
        ],
        "duration_days": 4,
        "best_months": [6, 7, 8, 9, 10],
        "music_genres": ["cantigas_trabalho", "musica_vindima"],
        "instruments": ["concertina", "gaita", "adufe", "bombo"],
        "dances": ["danca_vindima", "danca_ceifa", "corridinho"],
        "gastronomy": ["mosto do Douro", "chanfana", "queijo Serra da Estrela DOP", "cereja do Fundão"],
        "costumes": ["traje de vindimador", "traje de pastor serrano"],
        "festivals": ["Festa das Vindimas (Douro)", "Feira de São Mateus (Viseu)", "Festa da Cereja (Fundão)"],
        "tags": ["vindimas", "Douro", "UNESCO", "agrícola", "ceifa", "transumância", "premium"],
        "premium": True,
        "iq_score": 96,
        "lat": 41.1883,
        "lng": -7.5460,
    },
    # ── 4.6 Rota das Festas de Inverno ───────────────────────────────────
    {
        "_id": "cr_fes_005",
        "name": "Rota das Festas de Inverno e Caretos",
        "family": "festas",
        "sub_family": "festas_inverno",
        "region": "Trás-os-Montes",
        "municipalities": ["Podence", "Lazarim", "Bragança", "Vinhais", "Mogadouro"],
        "unesco": True,
        "unesco_label": "Caretos de Podence — Património Imaterial da Humanidade (2019)",
        "description_short": "Caretos, chocalhos e máscaras ancestrais — os rituais de Inverno mais selvagens da Europa.",
        "description_long": "O nordeste transmontano preserva rituais de Inverno pré-cristãos únicos na Europa. Os Caretos de Podence (UNESCO 2019) correm pelas ruas em fatos de franjas coloridas; em Lazarim, máscaras de madeira gigantes satirizam a sociedade; o Entrudo Chocalheiro (Vinhais) faz tremer a serra com centenas de chocalhos. Esta rota percorre aldeias de granito onde o paganismo e o catolicismo coexistem.",
        "stops": [
            {"name": "Podence — Caretos UNESCO", "lat": 41.5572, "lng": -6.9158, "municipality": "Podence", "type": "aldeia"},
            {"name": "Lazarim — Máscaras de Madeira", "lat": 41.0500, "lng": -7.8500, "municipality": "Lamego", "type": "aldeia"},
            {"name": "Vinhais — Entrudo Chocalheiro", "lat": 41.8333, "lng": -7.0000, "municipality": "Vinhais", "type": "vila"},
            {"name": "Mogadouro — Festas de Santo Estêvão", "lat": 41.3400, "lng": -6.7167, "municipality": "Mogadouro", "type": "vila"},
            {"name": "Bragança — Museu Ibérico da Máscara", "lat": 41.8061, "lng": -6.7567, "municipality": "Bragança", "type": "museu"},
        ],
        "duration_days": 4,
        "best_months": [12, 1, 2],
        "music_genres": ["musica_caretos", "gaita_de_foles"],
        "instruments": ["chocalhos", "gaita_de_foles", "caixa", "bombo"],
        "dances": ["danca_caretos", "corridas_caretos"],
        "gastronomy": ["folar de carne", "alheira de Mirandela", "castanhas assadas", "vinho quente"],
        "costumes": ["fato de careto (franjas coloridas)", "máscara de madeira", "capa de burel"],
        "festivals": ["Carnaval de Podence", "Carnaval de Lazarim", "Entrudo Chocalheiro de Vinhais"],
        "tags": ["caretos", "UNESCO", "máscaras", "Inverno", "Trás-os-Montes", "paganismo", "premium"],
        "premium": True,
        "iq_score": 99,
        "lat": 41.5572,
        "lng": -6.9158,
    },
    # ── 5.1 Rota dos Trajes do Minho ─────────────────────────────────────
    {
        "_id": "cr_tra_001",
        "name": "Rota dos Trajes do Norte",
        "family": "trajes",
        "sub_family": "trajes_norte",
        "region": "Minho",
        "municipalities": ["Viana do Castelo", "Braga", "Barcelos", "Miranda do Douro"],
        "unesco": False,
        "description_short": "Do traje de dote vianês ao saiote mirandês — a identidade portuguesa tecida em ouro, lã e linho.",
        "description_long": "Portugal tem uma riqueza têxtil extraordinária. O traje de dote de Viana (com filigranas de ouro) é o mais emblemático, mas esta rota abrange também os trajes de Braga, Barcelos (do Galo), e os trajes mirandeses de Trás-os-Montes. Cada peça conta uma história: tecidos, bordados, botões, rendas e cores codificam estado civil, profissão e região.",
        "stops": [
            {"name": "Viana — Museu do Traje", "lat": 41.6934, "lng": -8.8301, "municipality": "Viana do Castelo", "type": "museu"},
            {"name": "Braga — Traje de Romeira", "lat": 41.5503, "lng": -8.4275, "municipality": "Braga", "type": "cidade"},
            {"name": "Barcelos — Traje de Galo", "lat": 41.5353, "lng": -8.6177, "municipality": "Barcelos", "type": "cidade"},
            {"name": "Miranda do Douro — Traje Mirandês", "lat": 41.5000, "lng": -6.2747, "municipality": "Miranda do Douro", "type": "cidade"},
        ],
        "duration_days": 3,
        "best_months": [5, 6, 7, 8],
        "music_genres": [],
        "instruments": [],
        "dances": [],
        "gastronomy": ["rojões", "posta mirandesa"],
        "costumes": ["traje de dote vianês", "traje de romeira bracarense", "traje mirandês", "saiote de Pauliteiro"],
        "festivals": ["Festa da Agonia (Viana)", "Festas de Santa Bárbara (Miranda)"],
        "tags": ["trajes", "filigrana", "ouro", "Viana", "Miranda", "identidade", "premium"],
        "premium": True,
        "iq_score": 95,
        "lat": 41.6934,
        "lng": -8.8301,
    },
    # ── 5.2-5.4 Trajes do Sul e Ilhas ────────────────────────────────────
    {
        "_id": "cr_tra_002",
        "name": "Rota dos Trajes do Sul e Ilhas",
        "family": "trajes",
        "sub_family": "trajes_sul_ilhas",
        "region": "Alentejo",
        "municipalities": ["Évora", "Redondo", "Funchal", "Ponta Delgada"],
        "unesco": False,
        "description_short": "Bordados alentejanos, trajes de bailinho madeirense e capotes açorianos — o sul e as ilhas em tecido.",
        "description_long": "No sul e nas ilhas, os trajes contam histórias diferentes: no Alentejo, o traje de pastor, de ceifeira e os bordados de Redondo e Estremoz; na Madeira, o traje de bailinho com barrete de orelhas; nos Açores, o traje de chamarrita com variantes de cor e renda por ilha. Esta rota dual percorre ateliers de bordado, museus de traje e festas onde os trajes ganham vida.",
        "stops": [
            {"name": "Évora — Traje Alentejano", "lat": 38.5710, "lng": -7.9093, "municipality": "Évora", "type": "cidade_historica"},
            {"name": "Redondo — Bordados e Barros", "lat": 38.6467, "lng": -7.5464, "municipality": "Redondo", "type": "vila"},
            {"name": "Funchal — Traje Madeirense", "lat": 32.6500, "lng": -16.9083, "municipality": "Funchal", "type": "cidade"},
            {"name": "Ponta Delgada — Traje Açoriano", "lat": 37.7412, "lng": -25.6756, "municipality": "Ponta Delgada", "type": "cidade"},
        ],
        "duration_days": 4,
        "best_months": [4, 5, 6, 9, 10],
        "music_genres": [],
        "instruments": [],
        "dances": [],
        "gastronomy": ["migas", "espetada madeirense", "alcatra açoriana"],
        "costumes": ["traje de pastor alentejano", "traje de ceifeira", "traje de bailinho madeirense", "capote açoriano"],
        "festivals": ["Festa dos Tabuleiros (Tomar)", "Festa da Flor (Funchal)"],
        "tags": ["trajes", "bordados", "Alentejo", "Madeira", "Açores", "identidade_têxtil", "premium"],
        "premium": True,
        "iq_score": 90,
        "lat": 38.5710,
        "lng": -7.9093,
    },
    # ── 6.1 Rota da Gaita-de-foles ───────────────────────────────────────
    {
        "_id": "cr_ins_001",
        "name": "Rota da Gaita-de-foles",
        "family": "instrumentos",
        "sub_family": "gaita_de_foles",
        "region": "Trás-os-Montes",
        "municipalities": ["Miranda do Douro", "Mogadouro", "Vila Nova de Foz Côa", "Ponte de Lima"],
        "unesco": False,
        "description_short": "O sopro ancestral de Trás-os-Montes — a rota da gaita-de-foles, dos gaiteiros às oficinas de construção.",
        "description_long": "A gaita-de-foles transmontana é um dos instrumentos mais antigos de Portugal. De Miranda do Douro a Mogadouro, passando por Foz Côa e subindo ao Alto Minho, esta rota mapeia gaiteiros activos, oficinas de construção artesanal (roncos, ponteiras, bordões), festivais intercélticos e as festas onde a gaita ecoa sobre os vales do Douro.",
        "stops": [
            {"name": "Miranda do Douro — Gaiteiros Mirandeses", "lat": 41.5000, "lng": -6.2747, "municipality": "Miranda do Douro", "type": "sede_cultural"},
            {"name": "Mogadouro — Oficinas de Gaita", "lat": 41.3400, "lng": -6.7167, "municipality": "Mogadouro", "type": "oficina"},
            {"name": "Vila Nova de Foz Côa — Gravuras e Gaita", "lat": 41.0833, "lng": -7.1333, "municipality": "Vila Nova de Foz Côa", "type": "vila"},
            {"name": "Ponte de Lima — Gaita Minhota", "lat": 41.7672, "lng": -8.5842, "municipality": "Ponte de Lima", "type": "vila"},
        ],
        "duration_days": 3,
        "best_months": [6, 7, 8, 12],
        "music_genres": ["gaita_de_foles", "musica_celtica"],
        "instruments": ["gaita_de_foles_transmontana", "gaita_de_foles_galega", "bombo", "caixa"],
        "dances": ["pauliteiros"],
        "gastronomy": ["posta mirandesa", "alheira", "vinho do Douro"],
        "costumes": ["traje de gaiteiro"],
        "festivals": ["Festival Intercéltico de Miranda", "Festival de Gaita-de-foles de Ponte de Lima"],
        "tags": ["gaita-de-foles", "Trás-os-Montes", "celtico", "luthier", "premium"],
        "premium": True,
        "iq_score": 93,
        "lat": 41.5000,
        "lng": -6.2747,
    },
    # ── 6.2 Rota das Violas Portuguesas ───────────────────────────────────
    {
        "_id": "cr_ins_002",
        "name": "Rota das Violas Portuguesas",
        "family": "instrumentos",
        "sub_family": "violas",
        "region": "Minho",
        "municipalities": ["Vila Verde", "Amarante", "Coimbra", "Odemira"],
        "unesco": False,
        "description_short": "Braguesa, amarantina, beiroa e campaniça — 4 violas, 4 regiões, uma alma cordofone portuguesa.",
        "description_long": "Portugal possui pelo menos 4 tipos de violas tradicionais distintas: a braguesa (Minho), a amarantina (Douro), a beiroa (Beira Baixa) e a campaniça (Alentejo). Esta rota liga os 4 núcleos de construção artesanal, com oficinas de luthiers, demonstrações de técnica, repertório regional e ligações ao cante, fado e folclore de cada região.",
        "stops": [
            {"name": "Vila Verde — Viola Braguesa", "lat": 41.6500, "lng": -8.4333, "municipality": "Vila Verde", "type": "oficina"},
            {"name": "Amarante — Viola Amarantina", "lat": 41.2681, "lng": -8.0742, "municipality": "Amarante", "type": "cidade"},
            {"name": "Coimbra — Guitarra de Coimbra", "lat": 40.2089, "lng": -8.4265, "municipality": "Coimbra", "type": "cidade"},
            {"name": "Odemira — Viola Campaniça", "lat": 37.5964, "lng": -8.6397, "municipality": "Odemira", "type": "vila"},
        ],
        "duration_days": 5,
        "best_months": [4, 5, 6, 9, 10],
        "music_genres": ["musica_minhota", "fado_coimbra", "cante_alentejano"],
        "instruments": ["viola_braguesa", "viola_amarantina", "viola_beiroa", "viola_campanica", "guitarra_coimbra"],
        "dances": ["vira", "chula"],
        "gastronomy": ["vinho verde", "pastéis de Tentúgal", "migas alentejanas"],
        "costumes": [],
        "festivals": ["Festival de Guitarra de Coimbra", "Encontro de Violas Tradicionais"],
        "tags": ["violas", "cordofones", "luthier", "braguesa", "campaniça", "premium"],
        "premium": True,
        "iq_score": 94,
        "lat": 41.6500,
        "lng": -8.4333,
    },
    # ── 6.3 Rota dos Adufes ──────────────────────────────────────────────
    {
        "_id": "cr_ins_003",
        "name": "Rota dos Adufes",
        "family": "instrumentos",
        "sub_family": "adufe",
        "region": "Beira Interior",
        "municipalities": ["Idanha-a-Nova", "Monsanto", "Castelo Branco"],
        "unesco": True,
        "unesco_label": "Idanha-a-Nova — Cidade Criativa da Música UNESCO (2015)",
        "description_short": "O tambor quadrado de herança árabe — adufeiras da Beira Baixa, de Idanha a Monsanto.",
        "description_long": "O adufe é um tambor quadrado de pele de cabra, herança árabe na Península Ibérica. As adufeiras da Beira Baixa (especialmente de Idanha-a-Nova, Cidade Criativa da Música UNESCO) mantêm viva uma tradição de séculos, cantando e tocando em romarias, festas e rituais agrários. Esta rota inclui oficinas de construção de adufe e espetáculos ao vivo.",
        "stops": [
            {"name": "Idanha-a-Nova — Casa do Adufe", "lat": 39.9222, "lng": -7.2367, "municipality": "Idanha-a-Nova", "type": "museu"},
            {"name": "Monsanto — Adufeiras da Aldeia", "lat": 40.0389, "lng": -7.1142, "municipality": "Idanha-a-Nova", "type": "aldeia_historica"},
            {"name": "Castelo Branco — Bordado e Adufe", "lat": 39.8224, "lng": -7.4913, "municipality": "Castelo Branco", "type": "cidade"},
        ],
        "duration_days": 2,
        "best_months": [4, 5, 6, 9, 10],
        "music_genres": ["musica_adufe"],
        "instruments": ["adufe"],
        "dances": ["danca_adufe"],
        "gastronomy": ["cabrito assado", "tigelada", "queijo de Castelo Branco"],
        "costumes": ["traje de adufeira"],
        "festivals": ["Festival Terras sem Sombra", "Monsanto em Festa"],
        "tags": ["adufe", "UNESCO", "Beira_Baixa", "adufeiras", "herança_árabe", "premium"],
        "premium": True,
        "iq_score": 93,
        "lat": 39.9222,
        "lng": -7.2367,
    },
    # ── Rota Cultural Integrada ──────────────────────────────────────────
    {
        "_id": "cr_int_001",
        "name": "Grande Rota Cultural de Portugal",
        "family": "integradas",
        "sub_family": "grande_rota",
        "region": "Lisboa",
        "municipalities": ["Lisboa", "Porto", "Coimbra", "Évora", "Viana do Castelo", "Miranda do Douro", "Ponta Delgada", "Funchal"],
        "unesco": True,
        "unesco_label": "Múltiplos sítios UNESCO integrados",
        "description_short": "A grande rota que cruza música, dança, festas, trajes e gastronomia — de ponta a ponta de Portugal.",
        "description_long": "A Grande Rota Cultural de Portugal é a experiência premium máxima: uma viagem de 14 dias que cruza todas as famílias culturais. Do Fado de Lisboa ao Cante do Alentejo, dos Pauliteiros de Miranda às Chamarritas dos Açores, dos Caretos de Podence às Vindimas do Douro. Inclui IA narrativa contextual, áudio-guias em PT-PT, playlists temáticas, mapa 3D interactivo e calendário cultural sincronizado.",
        "stops": [
            {"name": "Lisboa — Fado e Santos Populares", "lat": 38.7223, "lng": -9.1393, "municipality": "Lisboa", "type": "cidade"},
            {"name": "Coimbra — Guitarra e Universidade", "lat": 40.2089, "lng": -8.4265, "municipality": "Coimbra", "type": "cidade"},
            {"name": "Porto — São João e Douro", "lat": 41.1579, "lng": -8.6291, "municipality": "Porto", "type": "cidade"},
            {"name": "Viana — Trajes e Romarias", "lat": 41.6934, "lng": -8.8301, "municipality": "Viana do Castelo", "type": "cidade"},
            {"name": "Miranda — Pauliteiros e Gaita", "lat": 41.5000, "lng": -6.2747, "municipality": "Miranda do Douro", "type": "cidade"},
            {"name": "Évora — Cante e Alentejo", "lat": 38.5710, "lng": -7.9093, "municipality": "Évora", "type": "cidade_historica"},
            {"name": "Ponta Delgada — Espírito Santo", "lat": 37.7412, "lng": -25.6756, "municipality": "Ponta Delgada", "type": "cidade"},
            {"name": "Funchal — Bailinho Atlântico", "lat": 32.6500, "lng": -16.9083, "municipality": "Funchal", "type": "cidade"},
        ],
        "duration_days": 14,
        "best_months": [5, 6, 7, 8, 9],
        "music_genres": ["fado", "cante_alentejano", "chamarrita", "gaita_de_foles", "bailinho"],
        "instruments": ["guitarra_portuguesa", "viola_braguesa", "gaita_de_foles", "adufe", "rajao", "brinquinho"],
        "dances": ["vira", "pauliteiros", "chamarrita", "fandango", "corridinho"],
        "gastronomy": ["bacalhau", "sardinhas", "rojões", "migas", "cataplana", "espetada", "alcatra"],
        "costumes": ["traje de fadista", "traje vianês", "traje mirandês", "traje alentejano", "traje madeirense"],
        "voices_orality": ["Amália Rodrigues", "Mariza", "língua mirandesa", "cantadores à desafio"],
        "festivals": ["Caixa Alfama", "São João do Porto", "Festa da Agonia", "Carnaval de Podence"],
        "tags": ["grande_rota", "integrada", "UNESCO", "premium", "14_dias", "todas_regioes"],
        "premium": True,
        "iq_score": 100,
        "lat": 38.7223,
        "lng": -9.1393,
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


# ─── Endpoints ───────────────────────────────────────────────────────────────

@cultural_routes_router.get("/families")
async def list_families():
    """List all 6 macro-families of cultural routes."""
    return {"families": ROUTE_FAMILIES, "total": len(ROUTE_FAMILIES)}


@cultural_routes_router.get("/regions")
async def list_regions():
    """List all Portuguese regions for filtering."""
    return {"regions": REGIONS_PT}


@cultural_routes_router.get("/routes")
async def list_routes(
    family: Optional[str] = Query(None, description="Filter by family: musicais, danca, festas, trajes, instrumentos, integradas"),
    region: Optional[str] = Query(None, description="Filter by region"),
    unesco: Optional[bool] = Query(None, description="Only UNESCO routes"),
    search: Optional[str] = Query(None, description="Search by name, tags, description"),
    premium_only: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List cultural routes with filtering."""
    items = await _col_or_seed("cultural_routes", SEED_ROUTES)

    if family:
        items = [i for i in items if i.get("family") == family]
    if region:
        items = [i for i in items if region.lower() in [r.lower() for r in i.get("municipalities", [])] or region.lower() in i.get("region", "").lower()]
    if unesco is True:
        items = [i for i in items if i.get("unesco")]
    if premium_only is True:
        items = [i for i in items if i.get("premium")]
    if search:
        pat = re.compile(search, re.IGNORECASE)
        items = [i for i in items if pat.search(
            i.get("name", "") + " " + i.get("description_short", "") + " " + " ".join(i.get("tags", []))
        )]

    total = len(items)
    items_sorted = sorted(items, key=lambda x: x.get("iq_score", 0), reverse=True)
    return {"total": total, "offset": offset, "limit": limit, "results": items_sorted[offset: offset + limit]}


@cultural_routes_router.get("/routes/nearby")
async def routes_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(100.0, le=500.0),
    family: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """Find cultural routes near a location."""
    items = await _col_or_seed("cultural_routes", SEED_ROUTES)
    results = []
    for item in items:
        if family and item.get("family") != family:
            continue
        dist = _haversine(lat, lng, item.get("lat", 0), item.get("lng", 0))
        if dist <= radius_km:
            results.append({**item, "distance_km": round(dist, 1)})
    results.sort(key=lambda x: x.get("distance_km", 9999))
    return {"lat": lat, "lng": lng, "radius_km": radius_km, "total": len(results), "results": results[:limit]}


@cultural_routes_router.get("/routes/{route_id}")
async def get_route_detail(route_id: str):
    """Get full detail of a cultural route including stops, instruments, etc."""
    items = await _col_or_seed("cultural_routes", SEED_ROUTES)
    for item in items:
        if str(item.get("_id", item.get("id", ""))) == route_id:
            return item
    raise HTTPException(status_code=404, detail="Rota cultural não encontrada")


@cultural_routes_router.get("/routes/{route_id}/stops")
async def get_route_stops(route_id: str):
    """Get stops/POIs for a specific cultural route (for map rendering)."""
    items = await _col_or_seed("cultural_routes", SEED_ROUTES)
    for item in items:
        if str(item.get("_id", item.get("id", ""))) == route_id:
            stops = item.get("stops", [])
            return {
                "route_id": route_id,
                "route_name": item.get("name"),
                "total_stops": len(stops),
                "stops": stops,
            }
    raise HTTPException(status_code=404, detail="Rota cultural não encontrada")


@cultural_routes_router.get("/stats")
async def cultural_routes_stats():
    """Dashboard stats for cultural routes."""
    items = await _col_or_seed("cultural_routes", SEED_ROUTES)
    by_family: Dict[str, int] = {}
    unesco_count = 0
    total_stops = 0
    regions_set: set = set()
    for item in items:
        f = item.get("family", "unknown")
        by_family[f] = by_family.get(f, 0) + 1
        if item.get("unesco"):
            unesco_count += 1
        total_stops += len(item.get("stops", []))
        regions_set.add(item.get("region", ""))

    return {
        "total_routes": len(items),
        "by_family": by_family,
        "unesco_routes": unesco_count,
        "total_stops": total_stops,
        "regions_covered": len(regions_set),
        "families": len(ROUTE_FAMILIES),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


# ─── AI Narrative ────────────────────────────────────────────────────────────

class CulturalNarrativeRequest(BaseModel):
    route_id: str = Field(..., min_length=1, max_length=128)
    style: str = Field(default="cultural", min_length=1, max_length=32, description="cultural | children | academic | tourism | storytelling")
    language: str = Field(default="pt", min_length=2, max_length=8, description="pt | en | es | fr")


@cultural_routes_router.post("/narrative")
async def generate_cultural_narrative(
    body: CulturalNarrativeRequest,
    current_user: User = Depends(_auth_dep),
):
    """Generate AI narrative for a cultural route (Emergent LLM)."""
    items = await _col_or_seed("cultural_routes", SEED_ROUTES)
    route = next((i for i in items if str(i.get("_id", i.get("id", ""))) == body.route_id), None)
    if not route:
        raise HTTPException(status_code=404, detail="Rota cultural não encontrada")

    style_map = {
        "cultural": "narrativa cultural aprofundada com contexto histórico, etnográfico e espiritual",
        "children": "texto simples e divertido para crianças dos 8 aos 12 anos",
        "academic": "texto académico com referências etnográficas, musicológicas e antropológicas",
        "tourism": "texto turístico convidativo e prático que motive a visita",
        "storytelling": "narrativa imersiva em formato de história, como se o leitor estivesse a viver a experiência",
    }
    style_desc = style_map.get(body.style, style_map["cultural"])
    lang_map = {"pt": "português europeu de Portugal", "en": "English", "es": "español", "fr": "français"}
    lang = lang_map.get(body.language, "português europeu de Portugal")

    prompt = f"""Escreve uma {style_desc} em {lang} sobre a seguinte rota cultural portuguesa:

Nome: {route['name']}
Família: {route.get('family', '')}
Região: {route.get('region', '')}
Municípios: {', '.join(route.get('municipalities', []))}
UNESCO: {route.get('unesco_label', 'Não')}
Descrição: {route.get('description_long', route.get('description_short', ''))}
Géneros musicais: {', '.join(route.get('music_genres', []))}
Instrumentos: {', '.join(route.get('instruments', []))}
Danças: {', '.join(route.get('dances', []))}
Gastronomia: {', '.join(route.get('gastronomy', []))}
Trajes: {', '.join(route.get('costumes', []))}
Festivais: {', '.join(route.get('festivals', []))}

Responde APENAS em JSON válido:
{{
  "title": "título evocador da rota",
  "narrative": "texto de 200-300 palavras",
  "key_highlights": ["destaque 1", "destaque 2", "destaque 3", "destaque 4"],
  "visitor_tip": "dica prática para visitantes",
  "best_time_to_visit": "melhor época detalhada",
  "cultural_significance": "importância cultural em 1-2 frases"
}}"""

    fallback = {
        "title": route["name"],
        "narrative": route.get("description_long", route.get("description_short", "")),
        "key_highlights": route.get("festivals", [])[:4],
        "visitor_tip": f"Visite {', '.join(route.get('municipalities', [])[:2])} para uma experiência autêntica.",
        "best_time_to_visit": f"Meses recomendados: {', '.join(str(m) for m in route.get('best_months', []))}",
        "cultural_significance": route.get("description_short", ""),
        "source": "fallback",
    }

    if not _llm_key:
        return fallback

    import json as _json

    cache_key = build_cache_key("cultural-route-narrative", body.route_id, body.style, body.language)
    cached = await cache_get("cultural-route-narrative", cache_key)
    if cached:
        try:
            payload = _json.loads(cached)
            payload["source"] = "cache"
            return payload
        except Exception:
            pass

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
        content = resp.json()["choices"][0]["message"]["content"]
        parsed = _json.loads(content)
        await cache_set("cultural-route-narrative", cache_key, _json.dumps(parsed, ensure_ascii=False), ttl_seconds=60 * 60 * 24)
        record_llm_call("cultural-route-narrative", "success")
        return parsed
    except Exception:
        record_llm_call("cultural-route-narrative", "fallback")
        return fallback


# ─── Calendar endpoint ───────────────────────────────────────────────────────

@cultural_routes_router.get("/calendar")
async def cultural_calendar(
    month: Optional[int] = Query(None, ge=1, le=12),
    family: Optional[str] = Query(None),
):
    """Cultural calendar — which routes/festivals are best for which month."""
    items = await _col_or_seed("cultural_routes", SEED_ROUTES)
    target_month = month or datetime.now(timezone.utc).month

    results = []
    for item in items:
        if family and item.get("family") != family:
            continue
        if target_month in item.get("best_months", []):
            results.append({
                "id": str(item.get("_id", item.get("id", ""))),
                "name": item.get("name"),
                "family": item.get("family"),
                "region": item.get("region"),
                "festivals": item.get("festivals", []),
                "description_short": item.get("description_short"),
                "iq_score": item.get("iq_score", 0),
            })

    results.sort(key=lambda x: x.get("iq_score", 0), reverse=True)
    return {"month": target_month, "total": len(results), "results": results}


# ─── Hub endpoints (Entrega 1) ───────────────────────────────────────────────
# Imports are deferred inside the functions to avoid module-level circular
# import between cultural_routes_api ↔ cultural_routes_hub.

@cultural_routes_router.get("/hub", summary="Hub dashboard — spotlight + season + family stats")
async def cultural_routes_hub(
    month: Optional[int] = Query(None, ge=1, le=12, description="Target month (default: current)"),
    lat: Optional[float] = Query(None, description="Latitude for nearby routes"),
    lng: Optional[float] = Query(None, description="Longitude for nearby routes"),
):
    """
    Full Cultural Routes Hub dashboard.
    Returns spotlight (route of the day), season picks, nearby routes,
    family breakdown and UNESCO-certified routes.
    """
    from cultural_routes_hub import get_hub_dashboard  # noqa: PLC0415
    return await get_hub_dashboard(_db, SEED_ROUTES, month=month, lat=lat, lng=lng)


@cultural_routes_router.get("/spotlight", summary="Route of the day — deterministic daily rotation")
async def cultural_routes_spotlight():
    """
    Returns the featured cultural route for today.
    Rotation is deterministic (day-of-year % premium pool) — the same
    route is returned for all requests on the same calendar day.
    Includes enrichment summary (POI count, upcoming events, trails).
    """
    from cultural_routes_hub import get_spotlight  # noqa: PLC0415
    result = await get_spotlight(_db, SEED_ROUTES)
    if result is None:
        raise HTTPException(status_code=503, detail="Sem rotas disponíveis")
    return result


@cultural_routes_router.get("/discover", summary="Personalised route recommendations")
async def discover_routes(
    mood: Optional[str] = Query(
        None,
        description="aventureiro | gastronomo | cultural | familia | romaria | musica | danca | historia | natureza | patrimonio",
    ),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    limit: int = Query(10, ge=1, le=50),
):
    """
    Scores and ranks routes by mood preference, geo proximity, season
    and UNESCO/premium status.  No authentication required.
    """
    from cultural_routes_hub import score_and_discover  # noqa: PLC0415
    results = await score_and_discover(
        _db, SEED_ROUTES,
        mood=mood, lat=lat, lng=lng, month=month, limit=limit,
    )
    return {
        "mood": mood or "cultural",
        "month": month or datetime.now(timezone.utc).month,
        "total": len(results),
        "results": results,
    }


@cultural_routes_router.get(
    "/routes/{route_id}/enriched",
    summary="Enriched route — cross-module data (POIs, events, trails)",
)
async def get_enriched_route(route_id: str):
    """
    Returns a cultural route enriched with:
      - pois_nearby     → heritage_items within 15 km of each stop
      - events_upcoming → events matching route region / festival names
      - trails_nearby   → walking trails near the route
      - dynamic_iq_score → recalculated with connection density bonus

    Reads from `cultural_routes_enriched` cache (TTL 7 days).
    Computes live on cache miss.
    """
    from cultural_routes_hub import get_enriched  # noqa: PLC0415
    result = await get_enriched(_db, route_id, SEED_ROUTES)
    if result is None:
        raise HTTPException(status_code=404, detail="Rota cultural não encontrada")
    return result


@cultural_routes_router.get(
    "/routes/{route_id}/live-calendar",
    summary="Live calendar — upcoming real events for this route (next 90 days)",
)
async def route_live_calendar(route_id: str, limit: int = Query(12, ge=1, le=50)):
    """
    Returns upcoming events from the `events` collection that match
    this route's region and festival names.  Ordered by relevance score.
    """
    items = await _col_or_seed("cultural_routes", SEED_ROUTES)
    route = next(
        (i for i in items if str(i.get("_id", i.get("id", ""))) == route_id),
        None,
    )
    if route is None:
        raise HTTPException(status_code=404, detail="Rota cultural não encontrada")

    from cultural_routes_hub import _events_for_route  # noqa: PLC0415
    events = await _events_for_route(_db, route, limit=limit)
    return {
        "route_id": route_id,
        "route_name": route.get("name"),
        "region": route.get("region"),
        "festivals_in_route": route.get("festivals", []),
        "total": len(events),
        "events": events,
    }


@cultural_routes_router.get(
    "/connections-graph",
    summary="Connections graph — shared attributes between routes",
)
async def connections_graph(
    family: Optional[str] = Query(None, description="Filter by family"),
    limit: int = Query(30, ge=1, le=100),
):
    """
    Returns a graph of route connections based on shared:
    instruments, dances, gastronomy items, municipalities, UNESCO status.
    Useful for frontend visualisation (react-native-svg / D3 / vis.js).

    Response: { nodes: [...], edges: [...] }
    """
    items = await _col_or_seed("cultural_routes", SEED_ROUTES)
    if family:
        items = [i for i in items if i.get("family") == family]
    items = items[:limit]

    # Build nodes
    nodes = []
    for r in items:
        rid = str(r.get("_id", r.get("id", "")))
        nodes.append({
            "id": rid,
            "label": r.get("name", rid),
            "family": r.get("family"),
            "region": r.get("region"),
            "iq_score": r.get("iq_score", 0),
            "unesco": r.get("unesco", False),
            "group": r.get("family", "integradas"),
        })

    # Build edges (shared attributes create connections)
    edges = []
    seen_edges: set = set()

    def _add_edge(src: str, tgt: str, attr: str, weight: int):
        key = tuple(sorted([src, tgt])) + (attr,)
        if key not in seen_edges and src != tgt:
            seen_edges.add(key)
            edges.append({"source": src, "target": tgt, "attribute": attr, "weight": weight})

    for i, r1 in enumerate(items):
        id1 = str(r1.get("_id", r1.get("id", "")))
        for r2 in items[i + 1:]:
            id2 = str(r2.get("_id", r2.get("id", "")))
            # Shared instruments (weight 3)
            shared_inst = set(r1.get("instruments", [])) & set(r2.get("instruments", []))
            for inst in shared_inst:
                _add_edge(id1, id2, f"instrumento:{inst}", 3)
            # Shared dances (weight 3)
            shared_dance = set(r1.get("dances", [])) & set(r2.get("dances", []))
            for d in shared_dance:
                _add_edge(id1, id2, f"danca:{d}", 3)
            # Shared municipalities (weight 2)
            shared_mun = set(r1.get("municipalities", [])) & set(r2.get("municipalities", []))
            for m in shared_mun:
                _add_edge(id1, id2, f"municipio:{m}", 2)
            # Shared UNESCO (weight 2)
            if r1.get("unesco") and r2.get("unesco"):
                _add_edge(id1, id2, "unesco", 2)
            # Shared region (weight 1)
            if r1.get("region") and r1.get("region") == r2.get("region"):
                _add_edge(id1, id2, f"regiao:{r1.get('region')}", 1)

    return {
        "nodes": nodes,
        "edges": sorted(edges, key=lambda e: e["weight"], reverse=True),
        "total_nodes": len(nodes),
        "total_edges": len(edges),
    }


class PersonalizeRequest(BaseModel):
    route_id: str = Field(..., min_length=1, max_length=128)
    traveler_profile: str = Field(
        default="cultural",
        min_length=1,
        max_length=32,
        description="aventureiro | gastronomo | cultural | familia | romaria | musica",
    )
    duration_days: Optional[int] = Field(None, ge=1, le=14)
    mobility: str = Field(default="normal", min_length=1, max_length=32, description="normal | reduced | cycling | walking")
    language: str = Field(default="pt", min_length=2, max_length=8, description="pt | en | es | fr")


@cultural_routes_router.post(
    "/personalize",
    summary="AI-personalised route variant (LLM)",
)
async def personalize_route(
    body: PersonalizeRequest,
    current_user: User = Depends(_auth_dep),
):
    """
    Generates a personalised variant of a cultural route using the
    Emergent LLM (gpt-4o-mini).  Adapts stops, duration, gastronomy and
    activities to the traveler profile and mobility constraints.
    Falls back to structured data if LLM unavailable.
    """
    items = await _col_or_seed("cultural_routes", SEED_ROUTES)
    route = next(
        (i for i in items if str(i.get("_id", i.get("id", ""))) == body.route_id),
        None,
    )
    if route is None:
        raise HTTPException(status_code=404, detail="Rota cultural não encontrada")

    days = body.duration_days or route.get("duration_days", 2)
    lang_map = {"pt": "português europeu de Portugal", "en": "English", "es": "español", "fr": "français"}
    lang = lang_map.get(body.language, "português europeu de Portugal")

    profile_desc = {
        "aventureiro": "viajante aventureiro que prefere actividades ao ar livre e experiências intensas",
        "gastronomo":  "entusiasta gastronómico focado em pratos típicos, vinhos e mercados locais",
        "cultural":    "amante de cultura, história, museus e tradições imateriais",
        "familia":     "família com crianças que prefere experiências acessíveis e educativas",
        "romaria":     "peregrino/romeiro interessado em festividades religiosas e tradições populares",
        "musica":      "melómano focado em concertos, casas de fado, cante e música ao vivo",
    }.get(body.traveler_profile, "viajante cultural")

    mobility_note = {
        "normal":  "",
        "reduced": "com mobilidade reduzida (evitar escadas, percursos longos, terreno irregular)",
        "cycling": "de bicicleta (preferir ciclovias e percursos planos ou moderados)",
        "walking": "a pé (incluir percursos pedestres e trilhos próximos dos stops)",
    }.get(body.mobility, "")

    stops_text = "\n".join(
        f"  - {s['name']} ({s.get('municipality','')}, {s.get('type','')})"
        for s in route.get("stops", [])
    )

    prompt = f"""Adapta a seguinte rota cultural portuguesa para um {profile_desc} {mobility_note}.

Rota: {route['name']}
Região: {route.get('region','')}
Municípios: {', '.join(route.get('municipalities',[]))}
Duração original: {route.get('duration_days','?')} dias → adaptar para {days} dias
Stops disponíveis:
{stops_text}
Gastronomia: {', '.join(route.get('gastronomy',[]))}
Festivais: {', '.join(route.get('festivals',[]))}

Responde APENAS em JSON válido em {lang}:
{{
  "title": "título da variante personalizada",
  "tagline": "frase curta evocativa (máx 12 palavras)",
  "itinerary": [
    {{"day": 1, "stops": ["stop1","stop2"], "activities": ["act1"], "gastronomy": ["prato"], "tip": "dica do dia"}}
  ],
  "why_for_you": "porquê esta rota é perfeita para este perfil (2 frases)",
  "must_do": ["experiência obrigatória 1","experiência obrigatória 2","experiência obrigatória 3"],
  "avoid": ["o que evitar nesta rota para este perfil"],
  "best_time": "melhor época detalhada"
}}"""

    fallback = {
        "title": f"{route['name']} — versão {body.traveler_profile}",
        "tagline": route.get("description_short", ""),
        "itinerary": [{"day": d + 1, "stops": [s["name"] for s in route.get("stops", [])][d::days], "activities": [], "gastronomy": route.get("gastronomy", [])[:2], "tip": ""} for d in range(days)],
        "why_for_you": f"Esta rota é ideal para um perfil {body.traveler_profile}.",
        "must_do": route.get("festivals", [])[:3],
        "avoid": [],
        "best_time": f"Meses ideais: {route.get('best_months',[])}",
        "source": "fallback",
    }

    if not _llm_key:
        return fallback

    try:
        import json as _json
        async with httpx.AsyncClient(timeout=20.0) as client:
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
        content = resp.json()["choices"][0]["message"]["content"]
        parsed = _json.loads(content)
        record_llm_call("cultural-route-personalize", "success")
        return parsed
    except Exception:
        record_llm_call("cultural-route-personalize", "fallback")
        return fallback


@cultural_routes_router.post(
    "/enrich/run",
    summary="[Admin] Trigger manual enrichment of all cultural routes",
)
async def trigger_enrichment(
    background_tasks=None,
    admin: User = Depends(_admin_dep),
):
    """
    Manually triggers the full enrichment pipeline (admin only).
    Useful for post-seed re-enrichment or admin maintenance.
    Non-blocking — returns immediately; enrichment runs in background.
    """
    import asyncio as _asyncio

    from cultural_routes_hub import bootstrap_enrichment  # noqa: PLC0415

    async def _run():
        return await bootstrap_enrichment(_db)

    _asyncio.create_task(_run())
    return {
        "status": "accepted",
        "message": "Enrichment pipeline triggered in background. Check logs for progress.",
        "enriched_collection": "cultural_routes_enriched",
    }
