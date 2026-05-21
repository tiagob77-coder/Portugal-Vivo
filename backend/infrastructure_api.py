"""
Infrastructure API — Passadiços, Pontes Suspensas, Ecovias, Miradouros
MongoDB Atlas (Motor async) · FastAPI
"""
from __future__ import annotations

import math
import re
from shared_utils import haversine_km as _haversine
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from auth_api import get_current_user
from models.api_models import User
from shared_utils import apply_municipality_filter

infrastructure_router = APIRouter(prefix="/infrastructure", tags=["Infrastructure"])


def _db_or_none():
    try:
        from dependencies import get_db
        return get_db()
    except Exception:
        return None


# ─── Seed data ───────────────────────────────────────────────────────────────

SEED_INFRA: List[Dict[str, Any]] = [
    {
        "_id": "inf_001",
        "name": "Passadiços do Paiva",
        "type": "passadico",
        "subtype": "ribeirinho",
        "region": "Aveiro",
        "municipality": "Arouca",
        "description_short": "8,7 km de percurso sobre o rio Paiva com canyons, piscinas naturais e pontes de madeira suspensas.",
        "description_long": "Considerado um dos melhores passadiços do mundo, percorre ambas as margens do Rio Paiva entre Areinho e Espiunca. Inclui a famosa Ponte 516 Arouca e atravessa paisagens de natureza selvagem.",
        "length_m": 8700,
        "difficulty": "media",
        "access_type": "pago",
        "is_family_friendly": True,
        "is_dog_friendly": False,
        "is_accessible": False,
        "best_season": ["primavera", "verao", "outono"],
        "opening_hours": "Ter-Dom 09h-17h (época baixa) / 08h-19h (época alta)",
        "lat": 40.970826,
        "lng": -8.193645,
        "start_point": {"name": "Praia Fluvial do Areinho", "lat": 40.952689, "lng": -8.175847},
        "end_point": {"name": "Espiunca", "lat": 40.992964, "lng": -8.211442},
        "waypoints": [
            {"name": "Praia Fluvial do Areinho (entrada sul)", "lat": 40.952689, "lng": -8.175847, "order": 1},
            {"name": "Ponte 516 Arouca", "lat": 40.968408, "lng": -8.174970, "order": 2},
            {"name": "Miradouro do Paiva", "lat": 40.975000, "lng": -8.190000, "order": 3},
            {"name": "Espiunca (entrada norte)", "lat": 40.992964, "lng": -8.211442, "order": 4},
        ],
        "iq_score": 99,
        "tags": ["rio", "canyons", "ponte suspensa", "natureza"],
    },
    {
        "_id": "inf_002",
        "name": "Passadiço de Carreço",
        "type": "passadico",
        "subtype": "costeiro",
        "region": "Viana do Castelo",
        "municipality": "Viana do Castelo",
        "description_short": "1,2 km de passadiço de madeira sobre falésias rochosas com vistas para o Atlântico.",
        "description_long": "Integrado na Ecovia do Litoral Norte, este passadiço costeiro permite observar as falésias de Carreço e o oceano Atlântico em total segurança, com acesso inclusivo.",
        "length_m": 1200,
        "difficulty": "facil",
        "access_type": "livre",
        "is_family_friendly": True,
        "is_dog_friendly": True,
        "is_accessible": True,
        "best_season": ["primavera", "verao", "outono"],
        "lat": 41.8112,
        "lng": -8.8763,
        "iq_score": 88,
        "tags": ["costa", "falésia", "acessível", "atlântico"],
    },
    {
        "_id": "inf_003",
        "name": "Passadiço das Sete Lagoas",
        "type": "passadico",
        "subtype": "ribeirinho",
        "region": "Braga",
        "municipality": "Terras de Bouro",
        "description_short": "2,1 km em madeira ao longo do rio Homem, dentro do Parque Nacional da Peneda-Gerês.",
        "length_m": 2100,
        "difficulty": "facil",
        "access_type": "livre",
        "is_family_friendly": True,
        "is_dog_friendly": True,
        "best_season": ["primavera", "verao"],
        "lat": 41.7543,
        "lng": -8.1652,
        "iq_score": 91,
        "tags": ["Gerês", "rio", "parque nacional", "família"],
    },
    {
        "_id": "inf_004",
        "name": "Ponte 516 Arouca",
        "type": "ponte_suspensa",
        "subtype": "vale_profundo",
        "region": "Aveiro",
        "municipality": "Arouca",
        "description_short": "A maior ponte pedonal suspensa do mundo com 516 metros de comprimento e 175 metros de altura sobre o rio Paiva.",
        "description_long": "Inaugurada em 2021 e incluída nos Passadiços do Paiva, é um ex-libris da engenharia verde portuguesa. O tabuleiro translúcido permite ver o rio 175m abaixo.",
        "length_m": 516,
        "height_m": 175,
        "access_type": "pago",
        "is_family_friendly": True,
        "safety_restrictions": "Vento superior a 60 km/h. Não recomendado para pessoas com medo de alturas.",
        "best_season": ["primavera", "verao", "outono"],
        "opening_hours": "Ter-Dom 09h-17h",
        "lat": 40.968408,
        "lng": -8.174970,
        "iq_score": 98,
        "tags": ["recorde mundial", "engenharia", "espetacular"],
    },
    {
        "_id": "inf_005",
        "name": "Ponte Pedonal do Caneiro",
        "type": "ponte_suspensa",
        "subtype": "panoramica",
        "region": "Viseu",
        "municipality": "Sernancelhe",
        "description_short": "Ponte suspensa panorâmica sobre o rio Távora com vistas para o vale vinhateiro.",
        "length_m": 156,
        "height_m": 42,
        "access_type": "livre",
        "is_family_friendly": True,
        "best_season": ["primavera", "verao", "outono"],
        "lat": 40.8912,
        "lng": -7.4823,
        "iq_score": 82,
        "tags": ["rio Távora", "vinha", "Douro"],
    },
    {
        "_id": "inf_006",
        "name": "Ecovia do Tâmega",
        "type": "ecovia",
        "subtype": "ferroviario",
        "region": "Porto / Braga",
        "municipality": "Amarante",
        "description_short": "35 km de ecopista sobre a antiga linha ferroviária do Tâmega, entre Amarante e Arco de Baúlhe.",
        "description_long": "Percorre o vale do rio Tâmega aproveitando a linha de caminho de ferro desactivada. Piso estabilizado e praticamente plano, ideal para cicloturismo e famílias.",
        "length_m": 35000,
        "difficulty": "facil",
        "access_type": "livre",
        "is_family_friendly": True,
        "is_dog_friendly": True,
        "is_accessible": True,
        "best_season": ["primavera", "verao", "outono"],
        "lat": 41.2722,
        "lng": -8.0795,
        "start_point": {"name": "Amarante", "lat": 41.268100, "lng": -8.074200},
        "end_point": {"name": "Arco de Baúlhe", "lat": 41.502500, "lng": -7.977800},
        "waypoints": [
            {"name": "Amarante (início)", "lat": 41.268100, "lng": -8.074200, "order": 1},
            {"name": "Celorico de Basto", "lat": 41.389200, "lng": -7.988900, "order": 2},
            {"name": "Arco de Baúlhe (fim)", "lat": 41.502500, "lng": -7.977800, "order": 3},
        ],
        "iq_score": 90,
        "tags": ["ciclovia", "ferroviário", "rio Tâmega", "família"],
    },
    {
        "_id": "inf_007",
        "name": "Ecovia do Litoral Norte",
        "type": "ecovia",
        "subtype": "costeiro",
        "region": "Viana do Castelo",
        "municipality": "Viana do Castelo",
        "description_short": "22 km de ecovia costeira entre Ancora e Caminha com vistas para o Atlântico e a Galiza.",
        "length_m": 22000,
        "difficulty": "facil",
        "access_type": "livre",
        "is_family_friendly": True,
        "is_accessible": True,
        "best_season": ["primavera", "verao", "outono"],
        "lat": 41.8742,
        "lng": -8.8532,
        "start_point": {"name": "Âncora", "lat": 41.815300, "lng": -8.862800},
        "end_point": {"name": "Caminha", "lat": 41.875100, "lng": -8.836200},
        "waypoints": [
            {"name": "Âncora (início)", "lat": 41.815300, "lng": -8.862800, "order": 1},
            {"name": "Vila Praia de Âncora", "lat": 41.816500, "lng": -8.872200, "order": 2},
            {"name": "Moledo do Minho", "lat": 41.843200, "lng": -8.865100, "order": 3},
            {"name": "Caminha (fim)", "lat": 41.875100, "lng": -8.836200, "order": 4},
        ],
        "iq_score": 87,
        "tags": ["costa", "ciclovia", "Minho", "Galiza"],
    },
    {
        "_id": "inf_008",
        "name": "Via Verde do Dão",
        "type": "via_verde",
        "subtype": "ferroviario",
        "region": "Viseu",
        "municipality": "Viseu",
        "description_short": "48 km de via verde ao longo do rio Dão, sobre a antiga linha ferroviária, com túneis e pontes históricas.",
        "description_long": "Uma das mais belas vias verdes de Portugal. Atravessa paisagens vinhateiras, túneis de pedra e pontes metálicas sobre o rio Dão, entre Viseu e Satão.",
        "length_m": 48000,
        "difficulty": "facil",
        "access_type": "livre",
        "is_family_friendly": True,
        "is_dog_friendly": True,
        "is_accessible": True,
        "best_season": ["primavera", "verao", "outono"],
        "lat": 40.6566,
        "lng": -7.9122,
        "start_point": {"name": "Viseu", "lat": 40.656600, "lng": -7.912200},
        "end_point": {"name": "Satão", "lat": 40.736100, "lng": -7.725800},
        "waypoints": [
            {"name": "Viseu (início)", "lat": 40.656600, "lng": -7.912200, "order": 1},
            {"name": "Abrunhosa-a-Velha", "lat": 40.696700, "lng": -7.829400, "order": 2},
            {"name": "Satão (fim)", "lat": 40.736100, "lng": -7.725800, "order": 3},
        ],
        "iq_score": 93,
        "tags": ["ciclovia", "rio Dão", "túneis", "vinha"],
    },
    {
        "_id": "inf_009",
        "name": "Miradouro de São Jerónimo",
        "type": "miradouro",
        "subtype": "montanha",
        "region": "Guarda",
        "municipality": "Manteigas",
        "description_short": "O miradouro mais alto da Serra da Estrela com vistas panorâmicas a 360° sobre o vale glaciar do Zêzere.",
        "height_m": 1548,
        "access_type": "livre",
        "is_accessible": True,
        "best_season": ["primavera", "verao", "outono"],
        "lat": 40.3245,
        "lng": -7.5912,
        "iq_score": 96,
        "tags": ["serra", "glaciar", "panorâmico", "neve"],
    },
    {
        "_id": "inf_010",
        "name": "Miradouro das Portas do Ródão",
        "type": "miradouro",
        "subtype": "geologico",
        "region": "Castelo Branco",
        "municipality": "Vila Velha de Ródão",
        "description_short": "Vista impressionante sobre as gargantas do rio Tejo esculpidas em quartzito, com abutre-do-egipto e falcão peregrino.",
        "height_m": 320,
        "access_type": "livre",
        "is_accessible": True,
        "best_season": ["primavera", "outono"],
        "lat": 39.6642,
        "lng": -7.6712,
        "iq_score": 94,
        "tags": ["geologia", "abutre", "Tejo", "quartzito"],
    },
    {
        "_id": "inf_011",
        "name": "Miradouro do Pico do Facho",
        "type": "miradouro",
        "subtype": "costeiro",
        "region": "Madeira",
        "municipality": "Machico",
        "description_short": "Miradouro a 280m de altitude no Pico do Facho, com panorâmica 360° sobre Machico, o vale e a costa leste da Madeira.",
        "height_m": 280,
        "access_type": "livre",
        "best_season": ["primavera", "verao", "outono", "inverno"],
        "lat": 32.723890,
        "lng": -16.758710,
        "iq_score": 97,
        "tags": ["Madeira", "oceano", "panorâmico", "vulcânico"],
    },
    {
        "_id": "inf_012",
        "name": "Miradouro da Ponta da Madrugada",
        "type": "miradouro",
        "subtype": "costeiro",
        "region": "Açores",
        "municipality": "Nordeste",
        "description_short": "O nascer do sol mais espetacular dos Açores, na costa nordeste de São Miguel a 276m de altitude.",
        "access_type": "livre",
        "best_season": ["primavera", "verao"],
        "lat": 37.840000,
        "lng": -25.140000,
        "iq_score": 95,
        "tags": ["Açores", "Europa", "nascer do sol", "atlântico"],
    },
    {
        "_id": "inf_013",
        "name": "Torre de Observação Paul de Arzila",
        "type": "torre_observacao",
        "subtype": "zonas_humidas",
        "region": "Coimbra",
        "municipality": "Coimbra",
        "description_short": "Torre de observação de aves na Reserva Natural do Paul de Arzila, habitat de garças, patos e guarda-rios.",
        "height_m": 12,
        "access_type": "livre",
        "is_family_friendly": True,
        "is_accessible": True,
        "best_season": ["inverno", "primavera"],
        "opening_hours": "Diário ao amanhecer e entardecer",
        "lat": 40.1023,
        "lng": -8.5343,
        "iq_score": 85,
        "tags": ["birdwatching", "zona húmida", "garça", "guarda-rios"],
    },
    {
        "_id": "inf_014",
        "name": "Passadiço da Praia Fluvial de Algares",
        "type": "passadico",
        "subtype": "ribeirinho",
        "region": "Santarém",
        "municipality": "Constância",
        "description_short": "Passadiço ribeirinho inclusivo no encontro dos rios Tejo e Zêzere, com praia fluvial e merendas.",
        "length_m": 850,
        "difficulty": "facil",
        "access_type": "livre",
        "is_family_friendly": True,
        "is_dog_friendly": True,
        "is_accessible": True,
        "best_season": ["primavera", "verao"],
        "lat": 39.4712,
        "lng": -8.3345,
        "iq_score": 80,
        "tags": ["Tejo", "praia fluvial", "acessível", "família"],
    },
]


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _serialize(doc: Dict) -> Dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id", doc.get("id", "")))
    return doc


async def _col_or_seed(col: str, seed: List[Dict], query: Optional[Dict] = None) -> List[Dict]:
    q = query or {}
    db = _db_or_none()
    if db is None:
        docs = [dict(d) for d in seed]
        if q.get("municipality_id"):
            docs = [d for d in docs if d.get("municipality_id") == q["municipality_id"]]
        return docs
    try:
        docs = await db[col].find(q).to_list(500)
        if docs:
            return [_serialize(d) for d in docs]
    except Exception:
        pass
    return [dict(d) for d in seed]


# ─── Endpoints ───────────────────────────────────────────────────────────────

@infrastructure_router.get("/list")
async def list_infrastructure(
    type: Optional[str] = Query(None),
    subtype: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    accessible: Optional[bool] = Query(None),
    family_friendly: Optional[bool] = Query(None),
    dog_friendly: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    apply_municipality_filter(query, current_user)
    items = await _col_or_seed("infrastructure", SEED_INFRA, query)

    if type:
        items = [i for i in items if i.get("type") == type]
    if subtype:
        items = [i for i in items if i.get("subtype") == subtype]
    if region:
        items = [i for i in items if region.lower() in i.get("region", "").lower()]
    if accessible is True:
        items = [i for i in items if i.get("is_accessible")]
    if family_friendly is True:
        items = [i for i in items if i.get("is_family_friendly")]
    if dog_friendly is True:
        items = [i for i in items if i.get("is_dog_friendly")]
    if search:
        pat = re.compile(search, re.IGNORECASE)
        items = [i for i in items if pat.search(i.get("name", "") + " " + i.get("description_short", ""))]

    total = len(items)
    return {"total": total, "offset": offset, "limit": limit, "results": items[offset: offset + limit]}


@infrastructure_router.get("/nearby")
async def infra_nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(50.0, le=300.0),
    type: Optional[str] = Query(None),
    accessible: Optional[bool] = Query(None),
    limit: int = Query(20, le=100),
):
    items = await _col_or_seed("infrastructure", SEED_INFRA)
    results = []

    for item in items:
        if type and item.get("type") != type:
            continue
        if accessible is True and not item.get("is_accessible"):
            continue
        dist = _haversine(lat, lng, item.get("lat", 0), item.get("lng", 0))
        if dist <= radius_km:
            results.append({**item, "distance_km": round(dist, 1)})

    results.sort(key=lambda x: x.get("distance_km", 9999))
    return {"lat": lat, "lng": lng, "radius_km": radius_km, "total": len(results), "results": results[:limit]}


@infrastructure_router.get("/passadiços")
async def list_passadiços(
    accessible: Optional[bool] = Query(None),
    family_friendly: Optional[bool] = Query(None),
    region: Optional[str] = Query(None),
):
    items = await _col_or_seed("infrastructure", SEED_INFRA)
    items = [i for i in items if i.get("type") == "passadico"]
    if accessible is True:
        items = [i for i in items if i.get("is_accessible")]
    if family_friendly is True:
        items = [i for i in items if i.get("is_family_friendly")]
    if region:
        items = [i for i in items if region.lower() in i.get("region", "").lower()]
    return {"total": len(items), "results": items}


@infrastructure_router.get("/pontes-suspensas")
async def list_bridges():
    items = await _col_or_seed("infrastructure", SEED_INFRA)
    items = [i for i in items if i.get("type") == "ponte_suspensa"]
    items.sort(key=lambda x: x.get("length_m", 0), reverse=True)
    return {"total": len(items), "results": items}


@infrastructure_router.get("/ecovias")
async def list_ecovias(
    subtype: Optional[str] = Query(None),
    accessible: Optional[bool] = Query(None),
):
    items = await _col_or_seed("infrastructure", SEED_INFRA)
    items = [i for i in items if i.get("type") in ("ecovia", "via_verde")]
    if subtype:
        items = [i for i in items if i.get("subtype") == subtype]
    if accessible is True:
        items = [i for i in items if i.get("is_accessible")]
    items.sort(key=lambda x: x.get("length_m", 0), reverse=True)
    return {"total": len(items), "results": items}


@infrastructure_router.get("/miradouros")
async def list_miradouros(
    subtype: Optional[str] = Query(None),
    accessible: Optional[bool] = Query(None),
    region: Optional[str] = Query(None),
):
    items = await _col_or_seed("infrastructure", SEED_INFRA)
    items = [i for i in items if i.get("type") in ("miradouro", "torre_observacao")]
    if subtype:
        items = [i for i in items if i.get("subtype") == subtype]
    if accessible is True:
        items = [i for i in items if i.get("is_accessible")]
    if region:
        items = [i for i in items if region.lower() in i.get("region", "").lower()]
    items.sort(key=lambda x: x.get("iq_score", 0), reverse=True)
    return {"total": len(items), "results": items}


@infrastructure_router.get("/{infra_id}")
async def get_infra_detail(infra_id: str):
    items = await _col_or_seed("infrastructure", SEED_INFRA)
    for item in items:
        if str(item.get("_id", item.get("id", ""))) == infra_id:
            return item
    raise HTTPException(status_code=404, detail="Infraestrutura não encontrada")


@infrastructure_router.get("/stats/summary")
async def infra_stats():
    items = await _col_or_seed("infrastructure", SEED_INFRA)
    by_type: Dict[str, int] = {}
    accessible_count = 0
    family_count = 0
    for item in items:
        t = item.get("type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1
        if item.get("is_accessible"):
            accessible_count += 1
        if item.get("is_family_friendly"):
            family_count += 1

    total_km = sum(
        item.get("length_m", 0) for item in items
        if item.get("type") in ("ecovia", "via_verde", "passadico")
    ) / 1000

    return {
        "total": len(items),
        "by_type": by_type,
        "accessible_count": accessible_count,
        "family_friendly_count": family_count,
        "total_km_paths": round(total_km, 1),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
