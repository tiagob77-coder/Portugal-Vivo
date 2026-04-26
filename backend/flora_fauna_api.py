"""
flora_fauna_api.py — Atlas Nacional de Flora, Fauna e Habitats
GET  /flora-fauna/flora            → lista de espécies de flora (filtros: status, habitat, mes, regiao, ameaca, search)
GET  /flora-fauna/flora/seasonal   → flora em floração no mês atual
GET  /flora-fauna/flora/{id}       → detalhe de espécie
GET  /flora-fauna/fauna            → lista de espécies de fauna (filtros: classe, raridade, habitat, regiao, endemica)
GET  /flora-fauna/fauna/rarity     → fauna por nível de raridade
GET  /flora-fauna/fauna/{id}       → detalhe de espécie de fauna
GET  /flora-fauna/habitats         → lista de habitats prioritários
GET  /flora-fauna/habitats/{id}    → detalhe de habitat
GET  /flora-fauna/nearby           → fauna/flora próximas de coordenada
POST /flora-fauna/identify         → identificação por LLM (foto URL + descrição)
GET  /flora-fauna/stats            → estatísticas do módulo
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from typing import Optional, List
import math
import datetime
import os
import httpx

from models.api_models import User
from llm_cache import build_cache_key, cache_get, cache_set, record_llm_call
from llm_client import call_chat_completion

flora_fauna_router = APIRouter(prefix="/flora-fauna", tags=["Flora Fauna"])

_db = None
_llm_key = ""
_require_auth = None

def set_flora_fauna_db(database) -> None:
    global _db
    _db = database

def set_flora_fauna_llm_key(key: str) -> None:
    global _llm_key
    _llm_key = key

def set_flora_fauna_auth(auth_fn) -> None:
    global _require_auth
    _require_auth = auth_fn

async def _auth_dep(request: Request) -> User:
    return await _require_auth(request)


# ─── Seed Data ─────────────────────────────────────────────────────────────────

SEED_FLORA = [
    {
        "id": "fl001",
        "scientific_name": "Quercus suber",
        "common_name": "Sobreiro",
        "family": "Fagaceae",
        "status": "autocone",
        "threat_status": "LC",
        "flowering_start_month": 4,
        "flowering_end_month": 5,
        "habitats": ["montado", "mata_mediterranica", "charneca"],
        "regions": ["alentejo", "algarve", "estremadura"],
        "rarity_score": 2,
        "uses": ["cortica", "alimento_fauna", "sombra"],
        "curiosity": "A cortiça do sobreiro é colhida de 9 em 9 anos sem matar a árvore.",
        "photo_url": "",
        "lat": 38.5,
        "lng": -8.2,
        "tag_endemic": False,
        "tag_protected": True,
    },
    {
        "id": "fl002",
        "scientific_name": "Lavandula viridis",
        "common_name": "Rosmaninho-verde",
        "family": "Lamiaceae",
        "status": "endemica",
        "threat_status": "LC",
        "flowering_start_month": 3,
        "flowering_end_month": 6,
        "habitats": ["charneca", "rocha_siliciosa"],
        "regions": ["algarve", "alentejo"],
        "rarity_score": 7,
        "uses": ["aromatica", "apicultura"],
        "curiosity": "Endémica do sul da Península Ibérica, com flores esverdeadas únicas.",
        "photo_url": "",
        "lat": 37.2,
        "lng": -8.1,
        "tag_endemic": True,
        "tag_protected": False,
    },
    {
        "id": "fl003",
        "scientific_name": "Drosophyllum lusitanicum",
        "common_name": "Orvalhinha",
        "family": "Drosophyllaceae",
        "status": "endemica",
        "threat_status": "VU",
        "flowering_start_month": 4,
        "flowering_end_month": 5,
        "habitats": ["charneca_degradada", "matagal_baixo"],
        "regions": ["algarve", "alentejo", "extremadura_espanhola"],
        "rarity_score": 9,
        "uses": ["planta_carnivora", "raridade_botanica"],
        "curiosity": "Única espécie carnívora endémica ibérica — captura insectos com glândulas pegajosas.",
        "photo_url": "",
        "lat": 37.4,
        "lng": -8.6,
        "tag_endemic": True,
        "tag_protected": True,
    },
    {
        "id": "fl004",
        "scientific_name": "Cistus ladanifer",
        "common_name": "Esteva",
        "family": "Cistaceae",
        "status": "autocone",
        "threat_status": "LC",
        "flowering_start_month": 4,
        "flowering_end_month": 6,
        "habitats": ["charneca", "matagal_mediterranico"],
        "regions": ["alentejo", "algarve", "beira_baixa"],
        "rarity_score": 1,
        "uses": ["ladano", "apicultura", "colonizacao_pos_fogo"],
        "curiosity": "Produz ladano, resina aromática usada desde a antiguidade em perfumaria.",
        "photo_url": "",
        "lat": 38.1,
        "lng": -7.9,
        "tag_endemic": False,
        "tag_protected": False,
    },
    {
        "id": "fl005",
        "scientific_name": "Narcissus bulbocodium",
        "common_name": "Campainha-amarela",
        "family": "Amaryllidaceae",
        "status": "autocone",
        "threat_status": "LC",
        "flowering_start_month": 1,
        "flowering_end_month": 4,
        "habitats": ["pastagem_humida", "prado_atlantico"],
        "regions": ["minho", "douro", "tras_os_montes"],
        "rarity_score": 4,
        "uses": ["ornamental", "indicador_biodiversidade"],
        "curiosity": "Floresce em janeiro nos prados húmidos do norte — sinal do fim do inverno.",
        "photo_url": "",
        "lat": 41.8,
        "lng": -7.5,
        "tag_endemic": False,
        "tag_protected": False,
    },
    {
        "id": "fl006",
        "scientific_name": "Silene cintrana",
        "common_name": "Silene de Sintra",
        "family": "Caryophyllaceae",
        "status": "endemica",
        "threat_status": "EN",
        "flowering_start_month": 5,
        "flowering_end_month": 7,
        "habitats": ["rochedo_costeiro", "mato_costeiro"],
        "regions": ["estremadura", "sintra"],
        "rarity_score": 10,
        "uses": [],
        "curiosity": "Uma das plantas mais raras do mundo — existe apenas nos penhascos de Sintra.",
        "photo_url": "",
        "lat": 38.79,
        "lng": -9.48,
        "tag_endemic": True,
        "tag_protected": True,
    },
    {
        "id": "fl007",
        "scientific_name": "Pinus pinea",
        "common_name": "Pinheiro-manso",
        "family": "Pinaceae",
        "status": "autocone",
        "threat_status": "LC",
        "flowering_start_month": 3,
        "flowering_end_month": 5,
        "habitats": ["litoral_arenoso", "mata_de_pinheiro"],
        "regions": ["setúbal", "alentejo_litoral", "algarve"],
        "rarity_score": 2,
        "uses": ["pinhao", "madeira", "sombra"],
        "curiosity": "Os pinhões da Mata de Comporta são colhidos à mão por apanhadores tradicionais.",
        "photo_url": "",
        "lat": 38.4,
        "lng": -8.8,
        "tag_endemic": False,
        "tag_protected": False,
    },
    {
        "id": "fl008",
        "scientific_name": "Arbutus unedo",
        "common_name": "Medronheiro",
        "family": "Ericaceae",
        "status": "autocone",
        "threat_status": "LC",
        "flowering_start_month": 10,
        "flowering_end_month": 12,
        "habitats": ["mata_mediterranica", "matagal_de_urzal"],
        "regions": ["algarve", "alentejo", "ribatejo"],
        "rarity_score": 3,
        "uses": ["medronho_aguardente", "mel", "fruto"],
        "curiosity": "Floresce e frutifica ao mesmo tempo — em outubro convivem flores e frutos vermelhos na mesma árvore.",
        "photo_url": "",
        "lat": 37.3,
        "lng": -8.5,
        "tag_endemic": False,
        "tag_protected": False,
    },
]

SEED_FAUNA = [
    {
        "id": "fa001",
        "scientific_name": "Lynx pardinus",
        "common_name": "Lince-ibérico",
        "class": "mamifero",
        "family": "Felidae",
        "status": "endemica",
        "threat_status": "EN",
        "rarity_level": "Epico",
        "habitats": ["montado", "matagal_mediterranico"],
        "regions": ["alentejo", "algarve"],
        "best_observation_months": [3, 4, 9, 10],
        "is_flagship": True,
        "tag_endemic": True,
        "tag_in_danger": True,
        "curiosity": "O mamífero mais ameaçado da Europa — recuperou de menos de 100 para mais de 1500 indivíduos.",
        "photo_url": "",
        "lat": 37.6,
        "lng": -7.8,
    },
    {
        "id": "fa002",
        "scientific_name": "Ciconia nigra",
        "common_name": "Cegonha-preta",
        "class": "ave",
        "family": "Ciconiidae",
        "status": "migradora",
        "threat_status": "LC",
        "rarity_level": "Raro",
        "habitats": ["ribeirinho", "floresta_madura"],
        "regions": ["alentejo", "beira_baixa", "tras_os_montes"],
        "best_observation_months": [4, 5, 6, 7, 8],
        "is_flagship": False,
        "tag_endemic": False,
        "tag_in_danger": False,
        "curiosity": "Nidifica em penhascos fluviais — muito mais esquiva que a cegonha-branca.",
        "photo_url": "",
        "lat": 39.5,
        "lng": -7.4,
    },
    {
        "id": "fa003",
        "scientific_name": "Tursiops truncatus",
        "common_name": "Roaz-corvineiro",
        "class": "mamifero",
        "family": "Delphinidae",
        "status": "residente",
        "threat_status": "LC",
        "rarity_level": "Incomum",
        "habitats": ["oceano_atlantico", "estuario"],
        "regions": ["algarve", "setubal", "costa_vicentina"],
        "best_observation_months": [4, 5, 6, 7, 8, 9],
        "is_flagship": True,
        "tag_endemic": False,
        "tag_in_danger": False,
        "curiosity": "O grupo residente do Sado é um dos mais estudados do mundo — coopera com pescadores há gerações.",
        "photo_url": "",
        "lat": 38.45,
        "lng": -8.9,
    },
    {
        "id": "fa004",
        "scientific_name": "Aquila adalberti",
        "common_name": "Águia-imperial-ibérica",
        "class": "ave",
        "family": "Accipitridae",
        "status": "endemica",
        "threat_status": "VU",
        "rarity_level": "Epico",
        "habitats": ["montado", "floresta_riparia"],
        "regions": ["alentejo", "ribatejo", "beira_baixa"],
        "best_observation_months": [1, 2, 3, 4, 11, 12],
        "is_flagship": True,
        "tag_endemic": True,
        "tag_in_danger": True,
        "curiosity": "Endémica da Península Ibérica — Portugal alberga cerca de 20% da população mundial.",
        "photo_url": "",
        "lat": 38.9,
        "lng": -7.6,
    },
    {
        "id": "fa005",
        "scientific_name": "Chioglossa lusitanica",
        "common_name": "Salamandra-lusitânica",
        "class": "anfibio",
        "family": "Plethodontidae",
        "status": "endemica",
        "threat_status": "VU",
        "rarity_level": "Raro",
        "habitats": ["ribeirinho", "floresta_atlantica"],
        "regions": ["minho", "douro_litoral", "galiza"],
        "best_observation_months": [10, 11, 12, 1, 2, 3],
        "is_flagship": False,
        "tag_endemic": True,
        "tag_in_danger": True,
        "curiosity": "A salamandra mais rara da Península — vive apenas em ribeiros de água límpida do noroeste ibérico.",
        "photo_url": "",
        "lat": 41.5,
        "lng": -8.1,
    },
    {
        "id": "fa006",
        "scientific_name": "Caretta caretta",
        "common_name": "Tartaruga-comum",
        "class": "reptil",
        "family": "Cheloniidae",
        "status": "visitante",
        "threat_status": "VU",
        "habitats": ["oceano_atlantico", "praia_nidificacao"],
        "regions": ["algarve", "madeira", "acores"],
        "best_observation_months": [6, 7, 8, 9],
        "rarity_level": "Raro",
        "is_flagship": True,
        "tag_endemic": False,
        "tag_in_danger": True,
        "curiosity": "Nidifica ocasionalmente no Algarve — o ponto mais norte da sua área de nidificação no Atlântico.",
        "photo_url": "",
        "lat": 37.0,
        "lng": -7.9,
    },
    {
        "id": "fa007",
        "scientific_name": "Garranus lusitanicus",
        "common_name": "Garrano",
        "class": "mamifero",
        "family": "Equidae",
        "status": "raca_autocone",
        "threat_status": "EN",
        "rarity_level": "Raro",
        "habitats": ["montanha", "pastagem_montana"],
        "regions": ["minho", "tras_os_montes"],
        "best_observation_months": [5, 6, 7, 8, 9],
        "is_flagship": True,
        "tag_endemic": True,
        "tag_in_danger": True,
        "curiosity": "Raça equina autóctone do noroeste peninsular — vive em semi-liberdade nas serras do Minho.",
        "photo_url": "",
        "lat": 41.9,
        "lng": -8.0,
    },
    {
        "id": "fa008",
        "scientific_name": "Neophron percnopterus",
        "common_name": "Abutre-do-Egipto",
        "class": "ave",
        "family": "Accipitridae",
        "status": "migradora",
        "threat_status": "EN",
        "rarity_level": "Epico",
        "habitats": ["penhascos", "estepe_cereal"],
        "regions": ["alentejo", "tras_os_montes", "beira_interior"],
        "best_observation_months": [3, 4, 5, 6, 7, 8, 9],
        "is_flagship": False,
        "tag_endemic": False,
        "tag_in_danger": True,
        "curiosity": "Um dos poucos animais que usa ferramentas — parte ovos de avestruz com pedras.",
        "photo_url": "",
        "lat": 41.2,
        "lng": -7.0,
    },
]

SEED_HABITATS = [
    {
        "id": "ha001",
        "name": "Montado de Sobro e Azinho",
        "habitat_code": "6310",
        "directive_status": "prioritario",
        "area_km2": 7200,
        "regions": ["alentejo", "algarve", "ribatejo"],
        "key_species_flora": ["Quercus suber", "Quercus rotundifolia", "Cistus ladanifer"],
        "key_species_fauna": ["Lynx pardinus", "Aquila adalberti", "Sus scrofa"],
        "threats": ["fogo", "abandono_rural", "monocultura_eucalipto"],
        "conservation_status": "desfavoravel_inadequado",
        "description": "Paisagem agro-silvopastoril única da bacia mediterrânica, com extraordinária biodiversidade associada.",
        "lat": 38.2,
        "lng": -7.8,
    },
    {
        "id": "ha002",
        "name": "Dunas Costeiras Atlânticas",
        "habitat_code": "2130",
        "directive_status": "prioritario",
        "area_km2": 340,
        "regions": ["minho", "douro_litoral", "beira_litoral", "estremadura"],
        "key_species_flora": ["Ammophila arenaria", "Otanthus maritimus", "Armeria pungens"],
        "key_species_fauna": ["Charadrius alexandrinus", "Lacerta lepida"],
        "threats": ["urbanizacao", "turismo_massivo", "invasoras"],
        "conservation_status": "desfavoravel_mau",
        "description": "Sistema dunar da costa atlântica portuguesa, com flora especializada adaptada ao sal e ao vento.",
        "lat": 40.5,
        "lng": -8.8,
    },
    {
        "id": "ha003",
        "name": "Charneca de Tojo e Urze",
        "habitat_code": "4030",
        "directive_status": "interesse_comunitario",
        "area_km2": 1800,
        "regions": ["minho", "tras_os_montes", "beira_alta"],
        "key_species_flora": ["Ulex europaeus", "Calluna vulgaris", "Erica umbellata"],
        "key_species_fauna": ["Circus cyaneus", "Emberiza hortulana"],
        "threats": ["fogo", "abandono", "reflorestacao_monocultura"],
        "conservation_status": "favoravel",
        "description": "Charnecas atlânticas e sub-atlânticas com coberto de tojo, urze e carqueja.",
        "lat": 41.5,
        "lng": -7.2,
    },
    {
        "id": "ha004",
        "name": "Sapais e Marismas do Tejo",
        "habitat_code": "1310",
        "directive_status": "interesse_comunitario",
        "area_km2": 145,
        "regions": ["estremadura", "ribatejo"],
        "key_species_flora": ["Spartina maritima", "Salicornia europaea", "Halimione portulacoides"],
        "key_species_fauna": ["Flamingo-comum", "Garça-real", "Perna-vermelha"],
        "threats": ["poluicao", "aterros", "alteracoes_hidrologicas"],
        "conservation_status": "desfavoravel_inadequado",
        "description": "Estuário do Tejo — um dos mais importantes da Europa para aves limícolas e anatídeos.",
        "lat": 38.72,
        "lng": -9.05,
    },
    {
        "id": "ha005",
        "name": "Florestas Ripárias de Amieiro",
        "habitat_code": "91E0",
        "directive_status": "prioritario",
        "area_km2": 620,
        "regions": ["minho", "douro", "beira_alta", "alentejo"],
        "key_species_flora": ["Alnus glutinosa", "Salix atrocinerea", "Fraxinus angustifolia"],
        "key_species_fauna": ["Lutra lutra", "Alcedo atthis", "Chioglossa lusitanica"],
        "threats": ["regularizacao_rios", "poluicao", "invasoras_riparias"],
        "conservation_status": "desfavoravel_mau",
        "description": "Galerias ripárias de amieiro ao longo dos cursos de água — refúgio da lontra e da salamandra-lusitânica.",
        "lat": 40.1,
        "lng": -7.9,
    },
]


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def _col_or_seed(col: str, seed: list) -> list:
    if _db is None:
        return list(seed)
    docs = await _db[col].find({}, {"_id": 0}).to_list(1000)
    return docs if docs else list(seed)


# ─── Flora endpoints ───────────────────────────────────────────────────────────

@flora_fauna_router.get("/flora")
async def list_flora(
    status: Optional[str] = Query(None, description="autocone|endemica|introduzida|protegida"),
    habitat: Optional[str] = Query(None),
    mes: Optional[int] = Query(None, ge=1, le=12, description="Mês de floração (1-12)"),
    regiao: Optional[str] = Query(None),
    ameaca: Optional[str] = Query(None, description="LC|NT|VU|EN|CR|DD"),
    endemica: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    items = await _col_or_seed("flora_species", SEED_FLORA)
    if status:
        items = [i for i in items if i.get("status") == status]
    if habitat:
        items = [i for i in items if habitat in i.get("habitats", [])]
    if mes:
        items = [
            i for i in items
            if i.get("flowering_start_month", 0) <= mes <= i.get("flowering_end_month", 12)
        ]
    if regiao:
        items = [i for i in items if regiao in i.get("regions", [])]
    if ameaca:
        items = [i for i in items if i.get("threat_status") == ameaca]
    if endemica is not None:
        items = [i for i in items if i.get("tag_endemic") == endemica]
    if search:
        q = search.lower()
        items = [
            i for i in items
            if q in i.get("common_name", "").lower()
            or q in i.get("scientific_name", "").lower()
        ]
    return {"flora": items[:limit], "total": len(items)}


@flora_fauna_router.get("/flora/seasonal")
async def flora_seasonal():
    mes = datetime.datetime.now().month
    items = await _col_or_seed("flora_species", SEED_FLORA)
    em_floracao = [
        i for i in items
        if i.get("flowering_start_month", 0) <= mes <= i.get("flowering_end_month", 12)
    ]
    return {"month": mes, "flowering": em_floracao, "total": len(em_floracao)}


@flora_fauna_router.get("/flora/{item_id}")
async def get_flora(item_id: str):
    items = await _col_or_seed("flora_species", SEED_FLORA)
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        raise HTTPException(404, "Espécie de flora não encontrada")
    return item


# ─── Fauna endpoints ───────────────────────────────────────────────────────────

@flora_fauna_router.get("/fauna")
async def list_fauna(
    classe: Optional[str] = Query(None, description="ave|mamifero|reptil|anfibio|peixe|invertebrado|raca_autocone"),
    raridade: Optional[str] = Query(None, description="Comum|Incomum|Raro|Epico"),
    habitat: Optional[str] = Query(None),
    regiao: Optional[str] = Query(None),
    endemica: Optional[bool] = Query(None),
    em_perigo: Optional[bool] = Query(None),
    flagship: Optional[bool] = Query(None),
    mes: Optional[int] = Query(None, ge=1, le=12, description="Mês de melhor observação"),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    items = await _col_or_seed("fauna_species", SEED_FAUNA)
    if classe:
        items = [i for i in items if i.get("class") == classe]
    if raridade:
        items = [i for i in items if i.get("rarity_level") == raridade]
    if habitat:
        items = [i for i in items if habitat in i.get("habitats", [])]
    if regiao:
        items = [i for i in items if regiao in i.get("regions", [])]
    if endemica is not None:
        items = [i for i in items if i.get("tag_endemic") == endemica]
    if em_perigo is not None:
        items = [i for i in items if i.get("tag_in_danger") == em_perigo]
    if flagship is not None:
        items = [i for i in items if i.get("is_flagship") == flagship]
    if mes:
        items = [i for i in items if mes in i.get("best_observation_months", [])]
    if search:
        q = search.lower()
        items = [
            i for i in items
            if q in i.get("common_name", "").lower()
            or q in i.get("scientific_name", "").lower()
        ]
    return {"fauna": items[:limit], "total": len(items)}


@flora_fauna_router.get("/fauna/rarity")
async def fauna_by_rarity():
    items = await _col_or_seed("fauna_species", SEED_FAUNA)
    grouped: dict = {}
    for item in items:
        lvl = item.get("rarity_level", "Comum")
        grouped.setdefault(lvl, []).append(item)
    return {"by_rarity": grouped}


@flora_fauna_router.get("/fauna/{item_id}")
async def get_fauna(item_id: str):
    items = await _col_or_seed("fauna_species", SEED_FAUNA)
    item = next((i for i in items if i["id"] == item_id), None)
    if not item:
        raise HTTPException(404, "Espécie de fauna não encontrada")
    return item


# ─── Habitats endpoints ────────────────────────────────────────────────────────

@flora_fauna_router.get("/habitats")
async def list_habitats(
    directive_status: Optional[str] = Query(None, description="prioritario|interesse_comunitario"),
    regiao: Optional[str] = Query(None),
    conservation: Optional[str] = Query(None),
):
    items = await _col_or_seed("habitats", SEED_HABITATS)
    if directive_status:
        items = [i for i in items if i.get("directive_status") == directive_status]
    if regiao:
        items = [i for i in items if regiao in i.get("regions", [])]
    if conservation:
        items = [i for i in items if i.get("conservation_status") == conservation]
    return {"habitats": items, "total": len(items)}


@flora_fauna_router.get("/habitats/{habitat_id}")
async def get_habitat(habitat_id: str):
    items = await _col_or_seed("habitats", SEED_HABITATS)
    item = next((i for i in items if i["id"] == habitat_id), None)
    if not item:
        raise HTTPException(404, "Habitat não encontrado")
    return item


# ─── Nearby ────────────────────────────────────────────────────────────────────

@flora_fauna_router.get("/nearby")
async def nearby_species(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(50.0, le=200.0),
    tipo: str = Query("fauna", description="flora|fauna|habitats|all"),
):
    results: dict = {}
    if tipo in ("fauna", "all"):
        fauna = await _col_or_seed("fauna_species", SEED_FAUNA)
        results["fauna"] = [
            {**f, "distance_km": round(_haversine(lat, lng, f["lat"], f["lng"]), 1)}
            for f in fauna
            if f.get("lat") and _haversine(lat, lng, f["lat"], f["lng"]) <= radius_km
        ]
        results["fauna"].sort(key=lambda x: x["distance_km"])
    if tipo in ("flora", "all"):
        flora = await _col_or_seed("flora_species", SEED_FLORA)
        results["flora"] = [
            {**f, "distance_km": round(_haversine(lat, lng, f["lat"], f["lng"]), 1)}
            for f in flora
            if f.get("lat") and _haversine(lat, lng, f["lat"], f["lng"]) <= radius_km
        ]
        results["flora"].sort(key=lambda x: x["distance_km"])
    if tipo in ("habitats", "all"):
        habitats = await _col_or_seed("habitats", SEED_HABITATS)
        results["habitats"] = [
            {**h, "distance_km": round(_haversine(lat, lng, h["lat"], h["lng"]), 1)}
            for h in habitats
            if h.get("lat") and _haversine(lat, lng, h["lat"], h["lng"]) <= radius_km
        ]
        results["habitats"].sort(key=lambda x: x["distance_km"])
    return {"lat": lat, "lng": lng, "radius_km": radius_km, "results": results}


# ─── AI Identification ─────────────────────────────────────────────────────────

class IdentifyRequest(BaseModel):
    description: str
    photo_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    tipo: str = "fauna"  # fauna|flora


@flora_fauna_router.post("/identify")
async def identify_species(
    req: IdentifyRequest,
    current_user: User = Depends(_auth_dep),
):
    if not _llm_key:
        return {"error": "LLM key not configured", "identified": None}

    import json as _json
    # Cache on normalised description+tipo — repeated identical queries hit
    # the cache; coordinates intentionally excluded (same species at a
    # different spot should reuse the ID).
    cache_key = build_cache_key(
        "species-identify", req.tipo, (req.description or "").strip().lower()
    )
    cached = await cache_get("species-identify", cache_key)
    if cached:
        try:
            return {"identified": _json.loads(cached), "source": "cache"}
        except Exception:
            pass

    prompt = (
        f"És um especialista em biodiversidade portuguesa. "
        f"Identifica a espécie de {req.tipo} com base na seguinte descrição: '{req.description}'. "
        f"{'Localização: lat=' + str(req.lat) + ' lng=' + str(req.lng) + '.' if req.lat else ''}"
        f" Responde em JSON com: scientific_name, common_name, family, confidence (0-1), "
        f"threat_status (código IUCN), habitat_hint, observation_tip."
    )
    content = await call_chat_completion(
        prompt,
        temperature=0.3,
        response_format={"type": "json_object"},
        timeout=20.0,
    )
    if content is not None:
        try:
            parsed = _json.loads(content)
            await cache_set(
                "species-identify", cache_key,
                _json.dumps(parsed, ensure_ascii=False),
                ttl_seconds=60 * 60 * 24 * 7,
            )
            record_llm_call("species-identify", "success")
            return {"identified": parsed, "source": "llm"}
        except Exception:
            pass
    record_llm_call("species-identify", "fallback")
    return {
            "identified": {
                "scientific_name": "Desconhecida",
                "common_name": "Não identificado",
                "confidence": 0,
                "observation_tip": "Tente uma descrição mais detalhada ou uma fotografia mais nítida.",
            },
            "source": "fallback",
        }


# ─── Stats ─────────────────────────────────────────────────────────────────────

@flora_fauna_router.get("/stats")
async def flora_fauna_stats():
    flora = await _col_or_seed("flora_species", SEED_FLORA)
    fauna = await _col_or_seed("fauna_species", SEED_FAUNA)
    habitats = await _col_or_seed("habitats", SEED_HABITATS)

    endemicas_flora = sum(1 for f in flora if f.get("tag_endemic"))
    endemicas_fauna = sum(1 for f in fauna if f.get("tag_endemic"))
    em_perigo = sum(1 for f in fauna if f.get("tag_in_danger"))
    flagship = sum(1 for f in fauna if f.get("is_flagship"))
    prioritarios = sum(1 for h in habitats if h.get("directive_status") == "prioritario")

    return {
        "flora": {"total": len(flora), "endemicas": endemicas_flora},
        "fauna": {
            "total": len(fauna),
            "endemicas": endemicas_fauna,
            "em_perigo": em_perigo,
            "flagship": flagship,
        },
        "habitats": {"total": len(habitats), "prioritarios": prioritarios},
    }
