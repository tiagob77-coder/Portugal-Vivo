"""
Marine Biodiversity API — Vida Marinha e Biodiversidade
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
from llm_cache import build_cache_key, cache_get, cache_set, record_llm_call

marine_biodiversity_router = APIRouter(prefix="/biodiversity", tags=["Biodiversity"])

_db = None
_llm_key: str = ""
_require_auth = None


def set_marine_biodiversity_db(database) -> None:
    global _db
    _db = database


def set_marine_biodiversity_llm_key(key: str) -> None:
    global _llm_key
    _llm_key = key


def set_marine_biodiversity_auth(auth_fn) -> None:
    global _require_auth
    _require_auth = auth_fn


async def _auth_dep(request: Request) -> User:
    return await _require_auth(request)


# ─── Seed data ───────────────────────────────────────────────────────────────

SEED_SPECIES: List[Dict[str, Any]] = [
    {
        "_id": "sp_001",
        "scientific_name": "Delphinus delphis",
        "common_name_pt": "Golfinho-comum",
        "common_name_en": "Common dolphin",
        "category": "mammal",
        "iucn_status": "LC",
        "region": ["Atlântico", "Costa Portuguesa", "Açores", "Madeira"],
        "season": "year-round",
        "activity_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        "description_short": "O golfinho mais comum nas águas portuguesas. Forma grandes grupos (até 1000 indivíduos) e é frequente em toda a costa atlântica.",
        "curiosity": "Capaz de mergulhar até 300m e atingir 60 km/h. Comunicam por apitos únicos individuais.",
        "habitat": "Oceano aberto e plataforma continental",
        "depth_range": "0–300m",
        "best_spots": ["Sado", "Setúbal", "Faial (Açores)", "Sagres"],
        "iq_score": 95,
        "lat": 38.5,
        "lng": -9.0,
    },
    {
        "_id": "sp_002",
        "scientific_name": "Megaptera novaeangliae",
        "common_name_pt": "Baleia-de-bossas",
        "common_name_en": "Humpback whale",
        "category": "mammal",
        "iucn_status": "LC",
        "region": ["Açores", "Madeira", "Atlântico Norte"],
        "season": "migration",
        "activity_months": [4, 5, 6, 7, 8, 9, 10],
        "description_short": "Em migração entre o Atlântico Norte e as tropicais, passa pelos Açores entre Abril e Outubro. Os seus saltos e cânticos são únicos.",
        "curiosity": "Os machos cantam canções complexas que podem durar 20 minutos e propagam-se centenas de km.",
        "habitat": "Oceano aberto, zonas de alimentação árticas e reprodução tropicais",
        "depth_range": "0–150m",
        "best_spots": ["Faial (Açores)", "Pico (Açores)", "Madeira"],
        "iq_score": 98,
        "lat": 38.5,
        "lng": -28.5,
    },
    {
        "_id": "sp_003",
        "scientific_name": "Halichoerus grypus",
        "common_name_pt": "Foca-cinzenta",
        "common_name_en": "Grey seal",
        "category": "mammal",
        "iucn_status": "LC",
        "region": ["Norte", "Costa Vicentina", "Berlengas"],
        "season": "year-round",
        "activity_months": [1, 2, 3, 4, 5, 10, 11, 12],
        "description_short": "Presente nas costas rochosas do Norte e ilhas Berlengas. Avistamentos raros mas consistentes no Outono/Inverno.",
        "curiosity": "Pode mergulhar até 70 minutos sem respirar e atingir 300m de profundidade.",
        "habitat": "Costas rochosas, praias isoladas",
        "depth_range": "0–300m",
        "best_spots": ["Berlengas", "Viana do Castelo", "Costa Vicentina"],
        "iq_score": 82,
        "lat": 39.4,
        "lng": -9.5,
    },
    {
        "_id": "sp_004",
        "scientific_name": "Calonectris borealis",
        "common_name_pt": "Cagarra",
        "common_name_en": "Cory's shearwater",
        "category": "seabird",
        "iucn_status": "LC",
        "region": ["Açores", "Madeira", "Selvagens"],
        "season": "summer",
        "activity_months": [3, 4, 5, 6, 7, 8, 9, 10],
        "description_short": "A maior gaivota-de-alma portuguesa. Nidifica nos Açores e Madeira de Março a Outubro, migrando para o Sul no Inverno.",
        "curiosity": "Percorre até 100.000 km por ano. Navegam por olfacto durante noites sem estrelas.",
        "habitat": "Oceano aberto, falésias para nidificação",
        "best_spots": ["Faial (Açores)", "Madeira", "Selvagens"],
        "iq_score": 88,
        "lat": 32.6,
        "lng": -16.9,
    },
    {
        "_id": "sp_005",
        "scientific_name": "Larus michahellis",
        "common_name_pt": "Gaivota-de-patas-amarelas",
        "common_name_en": "Yellow-legged gull",
        "category": "seabird",
        "iucn_status": "LC",
        "region": ["Costa Portuguesa", "Açores", "Madeira"],
        "season": "year-round",
        "activity_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        "description_short": "A gaivota mais comum de Portugal. Adaptou-se a cidades e portos, mas continua a nidificar em falésias costeiras.",
        "habitat": "Costas, portos, cidades litorais",
        "best_spots": ["Lisboa", "Porto", "Setúbal", "Algarve"],
        "iq_score": 70,
        "lat": 38.7,
        "lng": -9.1,
    },
    {
        "_id": "sp_006",
        "scientific_name": "Uria aalge",
        "common_name_pt": "Airo",
        "common_name_en": "Common guillemot",
        "category": "seabird",
        "iucn_status": "LC",
        "region": ["Norte", "Berlengas"],
        "season": "winter",
        "activity_months": [10, 11, 12, 1, 2, 3],
        "description_short": "Ave mergulhadora que visita as costas do Norte entre Outubro e Março. Usa as asas para nadar debaixo de água.",
        "curiosity": "Mergulha até 180m para capturar peixes. Os pintos saltam do ninho antes de saber voar.",
        "habitat": "Mar aberto no inverno, falésias rochosas para nidificação",
        "depth_range": "0–180m",
        "best_spots": ["Berlengas", "Viana do Castelo", "Norte"],
        "iq_score": 79,
        "lat": 39.4,
        "lng": -9.5,
    },
    {
        "_id": "sp_007",
        "scientific_name": "Thunnus thynnus",
        "common_name_pt": "Atum-rabilho",
        "common_name_en": "Atlantic bluefin tuna",
        "category": "fish",
        "iucn_status": "EN",
        "region": ["Algarve", "Açores", "Atlântico"],
        "season": "migration",
        "activity_months": [6, 7, 8, 9],
        "description_short": "O maior atum do mundo, em migração pelo Atlântico. Cruza as águas do Algarve e Açores entre Junho e Setembro.",
        "curiosity": "Pode atingir 3m e 680kg. Mantém temperatura corporal acima da água — é endotérmico.",
        "habitat": "Oceano aberto, plataforma continental",
        "depth_range": "0–1000m",
        "best_spots": ["Algarve (armações)", "Açores", "Setúbal"],
        "iq_score": 91,
        "lat": 37.0,
        "lng": -8.5,
    },
    {
        "_id": "sp_008",
        "scientific_name": "Epinephelus marginatus",
        "common_name_pt": "Mero",
        "common_name_en": "Dusky grouper",
        "category": "fish",
        "iucn_status": "EN",
        "region": ["Costa Vicentina", "Madeira", "Açores"],
        "season": "year-round",
        "activity_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        "description_short": "Peixe protegido de grandes dimensões. Vive em fundos rochosos e é curioso com mergulhadores. A sua presença indica boa qualidade ecológica.",
        "curiosity": "Nasce fêmea e pode mudar para macho aos 9–12 anos. Pode viver mais de 50 anos.",
        "habitat": "Fundos rochosos sublitorais",
        "depth_range": "5–50m",
        "best_spots": ["Costa Vicentina", "Madeira", "Berlengas"],
        "iq_score": 93,
        "lat": 37.4,
        "lng": -9.0,
    },
    {
        "_id": "sp_009",
        "scientific_name": "Hippocampus guttulatus",
        "common_name_pt": "Cavalo-marinho",
        "common_name_en": "Long-snouted seahorse",
        "category": "fish",
        "iucn_status": "LC",
        "region": ["Ria Formosa", "Estuários", "Algarve"],
        "season": "year-round",
        "activity_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        "description_short": "Uma das espécies mais icónicas da Ria Formosa. Portugal tem uma das maiores populações da Europa.",
        "curiosity": "O macho é que fica grávido e dá à luz. Cada casal tem um ritual de dança matinal.",
        "habitat": "Pradarias de erva-do-mar, estuários",
        "depth_range": "0–15m",
        "best_spots": ["Ria Formosa (Faro)", "Ria de Alvor", "Lagoa de Óbidos"],
        "iq_score": 97,
        "lat": 37.0,
        "lng": -7.9,
    },
    {
        "_id": "sp_010",
        "scientific_name": "Paracentrotus lividus",
        "common_name_pt": "Ouriço-do-mar",
        "common_name_en": "Purple sea urchin",
        "category": "invertebrate",
        "iucn_status": "LC",
        "region": ["Costa Portuguesa", "Açores", "Madeira"],
        "season": "year-round",
        "activity_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        "description_short": "Abundante na zona entre-marés rochosa. A suas ovas são uma iguaria e contribuem para controlo de algas.",
        "curiosity": "Usa as espinhas para se mover e como âncora contra as ondas. Pode viver 15 anos.",
        "habitat": "Costas rochosas, poças de maré",
        "depth_range": "0–80m",
        "best_spots": ["Cascais", "Algarve", "Costa Norte", "Açores"],
        "iq_score": 72,
        "lat": 38.7,
        "lng": -9.4,
    },
    {
        "_id": "sp_011",
        "scientific_name": "Octopus vulgaris",
        "common_name_pt": "Polvo-comum",
        "common_name_en": "Common octopus",
        "category": "invertebrate",
        "iucn_status": "LC",
        "region": ["Costa Portuguesa", "Açores", "Madeira"],
        "season": "year-round",
        "activity_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        "description_short": "O molusco mais inteligente do planeta. Camuflagem instantânea, resolução de problemas e memória de longo prazo.",
        "curiosity": "Tem 3 corações, sangue azul e 9 cérebros (1 central + 1 por tentáculo).",
        "habitat": "Fundos rochosos e arenosos, poças de maré",
        "depth_range": "0–200m",
        "best_spots": ["Algarve", "Setúbal", "Peniche", "Açores"],
        "iq_score": 85,
        "lat": 37.1,
        "lng": -8.5,
    },
    {
        "_id": "sp_012",
        "scientific_name": "Posidonia oceanica",
        "common_name_pt": "Posidónia",
        "common_name_en": "Neptune grass",
        "category": "plant",
        "iucn_status": "EN",
        "region": ["Algarve", "Costa Sul"],
        "season": "year-round",
        "activity_months": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        "description_short": "A pradaria submarina mais importante do Mediterrâneo. Produz 14L de oxigénio por m² por dia e é habitat de 400+ espécies.",
        "curiosity": "Um clone de posidónia nos Baleares tem 100.000 anos — um dos organismos mais antigos do planeta.",
        "habitat": "Fundos arenosos sublitorais",
        "depth_range": "0–40m",
        "best_spots": ["Meia Praia (Lagos)", "Alvor", "Tavira"],
        "iq_score": 94,
        "lat": 37.1,
        "lng": -8.6,
    },
    {
        "_id": "sp_013",
        "scientific_name": "Dermochelys coriacea",
        "common_name_pt": "Tartaruga-de-couro",
        "common_name_en": "Leatherback sea turtle",
        "category": "reptile",
        "iucn_status": "VU",
        "region": ["Algarve", "Açores", "Madeira", "Costa Atlântica"],
        "season": "summer",
        "activity_months": [5, 6, 7, 8, 9],
        "description_short": "A maior tartaruga do mundo. Visita as águas portuguesas entre Maio e Setembro para se alimentar de medusas.",
        "curiosity": "Pode mergulhar até 1200m e suportar temperaturas de 0°C graças a um sistema de contracorrente vascular.",
        "habitat": "Oceano aberto, zonas com alta densidade de medusas",
        "depth_range": "0–1200m",
        "best_spots": ["Algarve", "Setúbal", "Açores"],
        "iq_score": 96,
        "lat": 37.2,
        "lng": -8.6,
    },
    {
        "_id": "sp_014",
        "scientific_name": "Mobula mobular",
        "common_name_pt": "Arraia-jamanta",
        "common_name_en": "Giant devil ray",
        "category": "fish",
        "iucn_status": "EN",
        "region": ["Algarve", "Açores", "Atlântico"],
        "season": "summer",
        "activity_months": [6, 7, 8],
        "description_short": "A maior raia do Mediterrâneo e Atlântico oriental. Os saltos fora de água podem atingir 2 metros de altura.",
        "curiosity": "Filtram plâncton como as baleias. Os seus saltos são possivelmente comunicação ou remoção de parasitas.",
        "habitat": "Oceano aberto, plataforma continental",
        "depth_range": "0–500m",
        "best_spots": ["Algarve", "Açores", "Sines"],
        "iq_score": 92,
        "lat": 36.9,
        "lng": -8.2,
    },
]

SEED_HABITATS: List[Dict[str, Any]] = [
    {
        "_id": "hab_001",
        "name": "Ria Formosa",
        "type": "lagoon",
        "region": "Algarve",
        "description": "Sistema lagunar com 60km de extensão. Habitat crítico de cavalo-marinho, aves limícolas e peixes juvenis.",
        "protection_level": "Parque Natural",
        "eu_habitat_code": "1150",
        "species_count": 120,
        "lat": 37.0,
        "lng": -7.9,
    },
    {
        "_id": "hab_002",
        "name": "Costa Vicentina",
        "type": "rocky_shore",
        "region": "Alentejo/Algarve",
        "description": "A costa mais selvagem e bem conservada da Europa Ocidental. Habitat de mero, polvo e aves marinhas.",
        "protection_level": "Parque Natural",
        "eu_habitat_code": "1170",
        "species_count": 200,
        "lat": 37.4,
        "lng": -9.0,
    },
    {
        "_id": "hab_003",
        "name": "Estuário do Sado",
        "type": "estuary",
        "region": "Setúbal",
        "description": "Único estuário com população residente de golfinhos-roazes em Portugal. UNESCO Biosphere Reserve.",
        "protection_level": "Reserva Natural",
        "eu_habitat_code": "1130",
        "species_count": 95,
        "lat": 38.4,
        "lng": -8.7,
    },
    {
        "_id": "hab_004",
        "name": "Berlengas",
        "type": "island",
        "region": "Oeste",
        "description": "Arquipélago isolado com ecossistemas marinhos excepcionais. Reserva da Biosfera UNESCO.",
        "protection_level": "Reserva Natural + UNESCO",
        "eu_habitat_code": "1170",
        "species_count": 150,
        "lat": 39.4,
        "lng": -9.5,
    },
    {
        "_id": "hab_005",
        "name": "Banco D. João de Castro (Açores)",
        "type": "seamount",
        "region": "Açores",
        "description": "Monte submarino activo com hidrotermais entre Terceira e São Miguel. Ecossistema único no mundo.",
        "protection_level": "Marine Protected Area",
        "eu_habitat_code": "1180",
        "species_count": 300,
        "lat": 38.2,
        "lng": -26.6,
    },
]

SEED_SIGHTINGS: List[Dict[str, Any]] = [
    {
        "_id": "sight_001",
        "species_id": "sp_001",
        "timestamp": "2026-03-20T10:30:00Z",
        "lat": 38.4,
        "lng": -8.9,
        "observer_type": "citizen",
        "confidence": 0.85,
        "count": 12,
        "notes": "Grupo com crias. Mar calmo.",
        "source": "app",
    },
    {
        "_id": "sight_002",
        "species_id": "sp_009",
        "timestamp": "2026-03-18T09:00:00Z",
        "lat": 37.01,
        "lng": -7.94,
        "observer_type": "scientific",
        "confidence": 1.0,
        "count": 3,
        "notes": "Monitorização CCMAR. Dois adultos e um juvenil.",
        "source": "ICNF",
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


def _current_season() -> str:
    month = datetime.now(timezone.utc).month
    if month in (12, 1, 2):
        return "winter"
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    return "autumn"


def _serialize(doc: Dict) -> Dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id", doc.get("id", "")))
    return doc


async def _get_col_or_seed(col: str, seed: List[Dict]) -> List[Dict]:
    if _db is None:
        return [dict(d) for d in seed]
    try:
        docs = await _db[col].find({}).to_list(500)
        if docs:
            return [_serialize(d) for d in docs]
    except Exception:
        pass
    return [dict(d) for d in seed]


# ─── Endpoints — Species ─────────────────────────────────────────────────────

@marine_biodiversity_router.get("/species")
async def list_species(
    category: Optional[str] = Query(None),
    iucn_status: Optional[str] = Query(None),
    season: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    items = await _get_col_or_seed("marine_species", SEED_SPECIES)

    if category:
        items = [i for i in items if i.get("category") == category]
    if iucn_status:
        items = [i for i in items if i.get("iucn_status") == iucn_status.upper()]
    if season:
        items = [
            i for i in items
            if i.get("season") == season or i.get("season") == "year-round"
        ]
    if region:
        items = [
            i for i in items
            if any(region.lower() in r.lower() for r in i.get("region", []))
        ]
    if search:
        pat = re.compile(search, re.IGNORECASE)
        items = [
            i for i in items
            if pat.search(i.get("common_name_pt", "") + " " + i.get("scientific_name", ""))
        ]

    total = len(items)
    return {"total": total, "offset": offset, "limit": limit, "results": items[offset: offset + limit]}


@marine_biodiversity_router.get("/species/seasonal")
async def seasonal_species():
    """Species observable in the current season."""
    season = _current_season()
    month = datetime.now(timezone.utc).month
    items = await _get_col_or_seed("marine_species", SEED_SPECIES)

    observable = [
        i for i in items
        if i.get("season") == "year-round"
        or i.get("season") == season
        or i.get("season") == "migration"
        or month in i.get("activity_months", [])
    ]
    return {"season": season, "month": month, "total": len(observable), "species": observable}


@marine_biodiversity_router.get("/species/nearby")
async def species_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(50.0, le=500.0),
    category: Optional[str] = Query(None),
):
    items = await _get_col_or_seed("marine_species", SEED_SPECIES)
    month = datetime.now(timezone.utc).month
    results = []

    for sp in items:
        if category and sp.get("category") != category:
            continue
        slat, slng = sp.get("lat"), sp.get("lng")
        if slat is None or slng is None:
            results.append({**sp, "distance_km": None, "observable_now": month in sp.get("activity_months", [])})
            continue
        dist = _haversine(lat, lng, slat, slng)
        if dist <= radius_km:
            results.append({
                **sp,
                "distance_km": round(dist, 1),
                "observable_now": month in sp.get("activity_months", []),
            })

    results.sort(key=lambda x: (x.get("distance_km") or 9999))
    return {"lat": lat, "lng": lng, "radius_km": radius_km, "total": len(results), "results": results}


@marine_biodiversity_router.get("/species/{species_id}")
async def get_species_detail(species_id: str):
    items = await _get_col_or_seed("marine_species", SEED_SPECIES)
    for sp in items:
        if str(sp.get("_id", sp.get("id", ""))) == species_id:
            return sp
    raise HTTPException(status_code=404, detail="Espécie não encontrada")


# ─── Endpoints — Sightings ───────────────────────────────────────────────────

class SightingIn(BaseModel):
    species_id: Optional[str] = None
    lat: float
    lng: float
    observer_type: str = "citizen"
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    count: int = Field(default=1, ge=1)
    notes: Optional[str] = None
    photo_urls: List[str] = Field(default_factory=list)


@marine_biodiversity_router.get("/sightings")
async def list_sightings(
    species_id: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    items = await _get_col_or_seed("sightings", SEED_SIGHTINGS)
    if species_id:
        items = [i for i in items if i.get("species_id") == species_id]
    items = sorted(items, key=lambda x: x.get("timestamp", ""), reverse=True)
    return {"total": len(items), "results": items[:limit]}


@marine_biodiversity_router.get("/sightings/nearby")
async def sightings_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(20.0, le=200.0),
    limit: int = Query(20, le=100),
):
    items = await _get_col_or_seed("sightings", SEED_SIGHTINGS)
    results = []
    for s in items:
        dist = _haversine(lat, lng, s.get("lat", 0), s.get("lng", 0))
        if dist <= radius_km:
            results.append({**s, "distance_km": round(dist, 1)})
    results.sort(key=lambda x: x.get("distance_km", 9999))
    return {"total": len(results), "results": results[:limit]}


@marine_biodiversity_router.post("/sightings", status_code=201)
async def submit_sighting(
    body: SightingIn,
    current_user: User = Depends(_auth_dep),
):
    doc = body.model_dump()
    doc["timestamp"] = datetime.now(timezone.utc).isoformat()
    doc["source"] = "app"
    doc["user_id"] = current_user.user_id
    if _db is not None:
        result = await _db["sightings"].insert_one(doc)
        doc["id"] = str(result.inserted_id)
    else:
        doc["id"] = "offline_" + doc["timestamp"]
    return {"status": "submitted", "sighting": doc}


# ─── Endpoints — Habitats ────────────────────────────────────────────────────

@marine_biodiversity_router.get("/habitats")
async def list_habitats(
    type: Optional[str] = Query(None),
    protection_level: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
):
    items = await _get_col_or_seed("marine_habitats", SEED_HABITATS)
    if type:
        items = [i for i in items if i.get("type") == type]
    if protection_level:
        items = [
            i for i in items
            if protection_level.lower() in i.get("protection_level", "").lower()
        ]
    if region:
        items = [i for i in items if region.lower() in i.get("region", "").lower()]
    return {"total": len(items), "results": items}


@marine_biodiversity_router.get("/habitats/{habitat_id}")
async def get_habitat_detail(habitat_id: str):
    items = await _get_col_or_seed("marine_habitats", SEED_HABITATS)
    for h in items:
        if str(h.get("_id", h.get("id", ""))) == habitat_id:
            return h
    raise HTTPException(status_code=404, detail="Habitat não encontrado")


# ─── Endpoint — AI Species Identification ────────────────────────────────────

class IdentifyRequest(BaseModel):
    description: str = Field(..., min_length=10)
    lat: Optional[float] = None
    lng: Optional[float] = None
    month: Optional[int] = None


@marine_biodiversity_router.post("/identify")
async def identify_species(
    body: IdentifyRequest,
    current_user: User = Depends(_auth_dep),
):
    """
    AI species identification from text description.
    Uses Emergent LLM (gpt-4o-mini) with structured fallback.
    """
    current_month = body.month or datetime.now(timezone.utc).month
    species_names = [
        f"{s['common_name_pt']} ({s['scientific_name']})"
        for s in SEED_SPECIES
    ]
    species_list = "\n".join(f"- {n}" for n in species_names)

    prompt = f"""És um especialista em biodiversidade marinha portuguesa.
O utilizador descreve uma espécie que observou:
"{body.description}"
Contexto: mês {current_month}, {'latitude ' + str(body.lat) + ', longitude ' + str(body.lng) if body.lat else 'localização desconhecida'}.

Espécies marinhas portuguesas conhecidas:
{species_list}

Responde em JSON com esta estrutura exacta:
{{
  "top_matches": [
    {{"species": "nome comum", "scientific": "nome científico", "confidence": 0.85, "reason": "razão breve"}},
    {{"species": "nome comum", "scientific": "nome científico", "confidence": 0.60, "reason": "razão breve"}}
  ],
  "tip": "conselho breve de observação"
}}"""

    fallback = {
        "top_matches": [
            {"species": "Golfinho-comum", "scientific": "Delphinus delphis", "confidence": 0.5, "reason": "Espécie mais comum nas águas portuguesas"},
        ],
        "tip": "Tenta observar ao amanhecer ou ao anoitecer, quando os animais estão mais activos.",
        "source": "fallback",
    }

    if not _llm_key:
        return fallback

    import json as _json

    cache_key = build_cache_key(
        "marine-identify", (body.description or "").strip().lower()
    )
    cached = await cache_get("marine-identify", cache_key)
    if cached:
        try:
            return {**_json.loads(cached), "source": "cache"}
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
                    "temperature": 0.4,
                    "response_format": {"type": "json_object"},
                },
            )
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        parsed = _json.loads(content)
        await cache_set(
            "marine-identify",
            cache_key,
            _json.dumps(parsed, ensure_ascii=False),
            ttl_seconds=60 * 60 * 24 * 7,
        )
        record_llm_call("marine-identify", "success")
        return {**parsed, "source": "llm"}
    except Exception:
        record_llm_call("marine-identify", "fallback")
        return fallback


# ─── Endpoint — Stats ────────────────────────────────────────────────────────

@marine_biodiversity_router.get("/stats")
async def biodiversity_stats():
    species = await _get_col_or_seed("marine_species", SEED_SPECIES)
    habitats = await _get_col_or_seed("marine_habitats", SEED_HABITATS)
    sightings = await _get_col_or_seed("sightings", SEED_SIGHTINGS)

    by_category: Dict[str, int] = {}
    by_iucn: Dict[str, int] = {}
    for sp in species:
        by_category[sp.get("category", "unknown")] = by_category.get(sp.get("category", "unknown"), 0) + 1
        by_iucn[sp.get("iucn_status", "??")] = by_iucn.get(sp.get("iucn_status", "??"), 0) + 1

    threatened = sum(v for k, v in by_iucn.items() if k in ("VU", "EN", "CR"))

    return {
        "species_total": len(species),
        "by_category": by_category,
        "by_iucn": by_iucn,
        "threatened_count": threatened,
        "habitats_total": len(habitats),
        "sightings_total": len(sightings),
        "current_season": _current_season(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
