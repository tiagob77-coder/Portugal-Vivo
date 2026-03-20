"""
Geo Administrative API — CAOP (Carta Administrativa Oficial de Portugal)
Exposes the official Portuguese administrative hierarchy via GeoAPI.pt,
which is based on DGT/CAOP data.

Endpoints:
  GET /geo/distritos              - All distritos
  GET /geo/concelhos              - All concelhos (optionally by distrito)
  GET /geo/freguesias             - All freguesias (optionally by concelho)
  GET /geo/hierarchy              - Full nested hierarchy (cached)
  GET /geo/lookup?lat=&lng=       - Reverse geocode → admin hierarchy
  GET /geo/municipio/{nome}       - Info about a municipality
  POST /geo/enrich/{poi_id}       - Enrich a single POI with admin data
"""
import asyncio
import logging
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query, Path
from pydantic import BaseModel

from services.geoapi_service import GeoAPIService
from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

geo_router = APIRouter(prefix="/geo", tags=["GeoAdministrative"])

_db_holder = DatabaseHolder("geo_administrative")
set_geo_db = _db_holder.set

_geoapi = GeoAPIService()

# ---------------------------------------------------------------------------
# All 18 distritos of continental Portugal + 2 autonomous regions
# Source: DGT CAOP 2024
# ---------------------------------------------------------------------------
DISTRITOS = [
    {"id": "aveiro",       "name": "Aveiro",        "nuts_ii": "centro",   "capital": "Aveiro"},
    {"id": "beja",         "name": "Beja",           "nuts_ii": "alentejo", "capital": "Beja"},
    {"id": "braga",        "name": "Braga",          "nuts_ii": "norte",    "capital": "Braga"},
    {"id": "braganca",     "name": "Bragança",       "nuts_ii": "norte",    "capital": "Bragança"},
    {"id": "castelo_branco","name": "Castelo Branco","nuts_ii": "centro",   "capital": "Castelo Branco"},
    {"id": "coimbra",      "name": "Coimbra",        "nuts_ii": "centro",   "capital": "Coimbra"},
    {"id": "evora",        "name": "Évora",          "nuts_ii": "alentejo", "capital": "Évora"},
    {"id": "faro",         "name": "Faro",           "nuts_ii": "algarve",  "capital": "Faro"},
    {"id": "guarda",       "name": "Guarda",         "nuts_ii": "centro",   "capital": "Guarda"},
    {"id": "leiria",       "name": "Leiria",         "nuts_ii": "centro",   "capital": "Leiria"},
    {"id": "lisboa",       "name": "Lisboa",         "nuts_ii": "lisboa",   "capital": "Lisboa"},
    {"id": "portalegre",   "name": "Portalegre",     "nuts_ii": "alentejo", "capital": "Portalegre"},
    {"id": "porto",        "name": "Porto",          "nuts_ii": "norte",    "capital": "Porto"},
    {"id": "santarem",     "name": "Santarém",       "nuts_ii": "lisboa",   "capital": "Santarém"},
    {"id": "setubal",      "name": "Setúbal",        "nuts_ii": "lisboa",   "capital": "Setúbal"},
    {"id": "viana_castelo","name": "Viana do Castelo","nuts_ii": "norte",   "capital": "Viana do Castelo"},
    {"id": "vila_real",    "name": "Vila Real",      "nuts_ii": "norte",    "capital": "Vila Real"},
    {"id": "viseu",        "name": "Viseu",          "nuts_ii": "centro",   "capital": "Viseu"},
    {"id": "acores",       "name": "Açores",         "nuts_ii": "acores",   "capital": "Ponta Delgada"},
    {"id": "madeira",      "name": "Madeira",        "nuts_ii": "madeira",  "capital": "Funchal"},
]

# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------

class DistritoInfo(BaseModel):
    id: str
    name: str
    nuts_ii: str
    capital: str
    total_concelhos: Optional[int] = None


class ConcelhoInfo(BaseModel):
    name: str
    distrito: str
    codigo: Optional[str] = None
    area_km2: Optional[float] = None
    population: Optional[int] = None


class FreguesiaSummary(BaseModel):
    name: str
    concelho: str


class AdminLookupResult(BaseModel):
    lat: float
    lng: float
    freguesia: str
    concelho: str
    distrito: str
    nuts_ii: str
    nuts_iii: str
    codigo_postal: Optional[str] = None


class HierarchyNode(BaseModel):
    distrito: str
    nuts_ii: str
    concelhos: List[str] = []


class EnrichResult(BaseModel):
    poi_id: str
    updated: bool
    concelho: Optional[str] = None
    freguesia: Optional[str] = None
    distrito: Optional[str] = None
    message: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@geo_router.get(
    "/distritos",
    response_model=List[DistritoInfo],
    summary="Lista todos os distritos de Portugal (CAOP)",
)
async def list_distritos(nuts_ii: Optional[str] = Query(None, description="Filtrar por região NUTS II")):
    """
    Retorna os 18 distritos continentais + Açores e Madeira.
    Fonte: DGT CAOP 2024 via GeoAPI.pt
    """
    result = DISTRITOS
    if nuts_ii:
        result = [d for d in DISTRITOS if d["nuts_ii"] == nuts_ii.lower()]

    output = []
    for d in result:
        try:
            info = await _geoapi.get_distrito_info(d["name"])
            n_concelhos = len(info.get("municipios", [])) if info else None
        except Exception:
            n_concelhos = None
        output.append(DistritoInfo(
            id=d["id"],
            name=d["name"],
            nuts_ii=d["nuts_ii"],
            capital=d["capital"],
            total_concelhos=n_concelhos,
        ))
    return output


@geo_router.get(
    "/concelhos",
    response_model=List[ConcelhoInfo],
    summary="Lista concelhos de um distrito (CAOP)",
)
async def list_concelhos(
    distrito: str = Query(..., description="Nome do distrito (ex: Braga, Porto, Évora)"),
):
    """
    Lista todos os concelhos/municípios de um dado distrito.
    Dados provenientes da GeoAPI.pt (baseada em CAOP oficial).
    """
    info = await _geoapi.get_distrito_info(distrito)
    if not info:
        raise HTTPException(status_code=404, detail=f"Distrito '{distrito}' não encontrado")

    municipios = info.get("municipios", [])
    return [ConcelhoInfo(name=m, distrito=distrito) for m in municipios]


@geo_router.get(
    "/concelhos/{nome}",
    response_model=ConcelhoInfo,
    summary="Informação detalhada de um concelho",
)
async def get_concelho_info(nome: str = Path(..., description="Nome do concelho")):
    """
    Retorna área, população e código INE de um município.
    """
    info = await _geoapi.get_municipality_info(nome)
    if not info:
        raise HTTPException(status_code=404, detail=f"Concelho '{nome}' não encontrado")
    return ConcelhoInfo(
        name=info.get("name", nome),
        distrito=info.get("distrito", ""),
        codigo=info.get("codigo"),
        area_km2=info.get("area_km2"),
        population=info.get("population"),
    )


@geo_router.get(
    "/freguesias",
    response_model=List[FreguesiaSummary],
    summary="Lista freguesias de um concelho (CAOP)",
)
async def list_freguesias(
    concelho: str = Query(..., description="Nome do concelho (ex: Guimarães, Sintra)"),
):
    """
    Lista todas as freguesias de um dado concelho.
    Dados provenientes da GeoAPI.pt (baseada em CAOP oficial).
    """
    info = await _geoapi.get_municipality_info(concelho)
    if not info:
        raise HTTPException(status_code=404, detail=f"Concelho '{concelho}' não encontrado")

    freguesias = info.get("freguesias", [])
    return [FreguesiaSummary(name=f, concelho=concelho) for f in freguesias]


@geo_router.get(
    "/lookup",
    response_model=AdminLookupResult,
    summary="Reverse geocode: coordenadas → hierarquia administrativa CAOP",
)
async def geo_lookup(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude"),
):
    """
    Converte coordenadas GPS em hierarquia administrativa oficial (CAOP):
    Freguesia → Concelho → Distrito → NUTS II → NUTS III.
    """
    result = await _geoapi.reverse_geocode(lat, lng)
    if not result:
        raise HTTPException(
            status_code=503,
            detail="Serviço de geocodificação temporariamente indisponível"
        )
    return AdminLookupResult(
        lat=lat,
        lng=lng,
        freguesia=result.freguesia,
        concelho=result.concelho,
        distrito=result.distrito,
        nuts_ii=result.nuts_ii,
        nuts_iii=result.nuts_iii,
        codigo_postal=result.codigo_postal or None,
    )


@geo_router.get(
    "/hierarchy",
    response_model=List[HierarchyNode],
    summary="Hierarquia completa distritos → concelhos (CAOP)",
)
async def get_hierarchy(
    nuts_ii: Optional[str] = Query(None, description="Filtrar por região NUTS II"),
):
    """
    Retorna todos os distritos com os respetivos concelhos.
    Os dados são obtidos e cacheados a partir da GeoAPI.pt (CAOP).
    Pode ser lento na primeira chamada (~20 s) por carregar todos os distritos.
    """
    distritos_to_fetch = [
        d for d in DISTRITOS if (not nuts_ii or d["nuts_ii"] == nuts_ii.lower())
    ]

    async def fetch_one(d: dict) -> HierarchyNode:
        try:
            info = await _geoapi.get_distrito_info(d["name"])
            municipios = info.get("municipios", []) if info else []
        except Exception:
            municipios = []
        return HierarchyNode(
            distrito=d["name"],
            nuts_ii=d["nuts_ii"],
            concelhos=municipios,
        )

    nodes = await asyncio.gather(*[fetch_one(d) for d in distritos_to_fetch])
    return list(nodes)


@geo_router.post(
    "/enrich/{poi_id}",
    response_model=EnrichResult,
    summary="Enriquecer um POI com dados administrativos CAOP",
)
async def enrich_poi(poi_id: str = Path(..., description="ID do POI a enriquecer")):
    """
    Consulta a hierarquia administrativa (CAOP/GeoAPI.pt) para um POI
    e persiste os campos `concelho`, `freguesia`, `distrito`, `nuts_iii`
    na base de dados.
    """
    db = _db_holder.db
    if db is None:
        raise HTTPException(status_code=503, detail="Base de dados indisponível")

    poi = await db.heritage_items.find_one({"id": poi_id}, {"_id": 0})
    if not poi:
        raise HTTPException(status_code=404, detail=f"POI '{poi_id}' não encontrado")

    loc = poi.get("location") or {}
    lat = loc.get("lat")
    lng = loc.get("lng")
    if not lat or not lng:
        return EnrichResult(
            poi_id=poi_id, updated=False,
            message="POI sem coordenadas GPS — não é possível enriquecer"
        )

    geo = await _geoapi.reverse_geocode(lat, lng)
    if not geo:
        return EnrichResult(
            poi_id=poi_id, updated=False,
            message="GeoAPI.pt indisponível de momento"
        )

    update = {}
    if geo.concelho:
        update["concelho"] = geo.concelho
    if geo.freguesia:
        update["freguesia"] = geo.freguesia
    if geo.distrito:
        update["distrito"] = geo.distrito
    if geo.nuts_iii:
        update["nuts_iii"] = geo.nuts_iii
    if geo.codigo_postal:
        update["codigo_postal"] = geo.codigo_postal

    if update:
        await db.heritage_items.update_one({"id": poi_id}, {"$set": update})

    return EnrichResult(
        poi_id=poi_id,
        updated=bool(update),
        concelho=geo.concelho or None,
        freguesia=geo.freguesia or None,
        distrito=geo.distrito or None,
        message="POI atualizado com dados CAOP" if update else "Sem dados novos para atualizar",
    )


@geo_router.get(
    "/stats",
    summary="Estatísticas de cobertura administrativa CAOP nos POIs",
)
async def geo_coverage_stats():
    """
    Retorna a percentagem de POIs que já têm dados administrativos CAOP
    (concelho, freguesia, distrito) preenchidos.
    """
    db = _db_holder.db
    if db is None:
        raise HTTPException(status_code=503, detail="Base de dados indisponível")

    total = await db.heritage_items.count_documents({})
    with_loc = await db.heritage_items.count_documents({"location": {"$exists": True}})
    with_concelho = await db.heritage_items.count_documents(
        {"concelho": {"$exists": True, "$ne": ""}}
    )
    with_freguesia = await db.heritage_items.count_documents(
        {"freguesia": {"$exists": True, "$ne": ""}}
    )
    with_distrito = await db.heritage_items.count_documents(
        {"distrito": {"$exists": True, "$ne": ""}}
    )

    return {
        "total_pois": total,
        "with_location": with_loc,
        "caop_coverage": {
            "with_concelho": with_concelho,
            "with_freguesia": with_freguesia,
            "with_distrito": with_distrito,
            "pct_concelho": round(with_concelho / total * 100, 1) if total else 0,
            "pct_freguesia": round(with_freguesia / total * 100, 1) if total else 0,
        },
        "pending_enrichment": with_loc - with_concelho,
    }
