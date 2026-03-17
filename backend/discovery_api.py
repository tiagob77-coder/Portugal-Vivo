"""
Discovery API - Sustainable Tourism Discovery Engine
Links events (Agenda Viral) with nature, transport, and trails
Core endpoint for the "ponta-a-ponta" experience
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from services.spatial_crossref_service import SpatialCrossRefService
from services.overpass_service import OverpassService
from services.gtfs_service import GTFSTransportService

discovery_router = APIRouter(prefix="/discovery", tags=["Discovery - Turismo Sustentável"])

crossref = SpatialCrossRefService()
overpass_service = OverpassService()
transport_service = GTFSTransportService()


# ========================
# EVENT ENRICHMENT
# ========================

@discovery_router.get("/enrich-event")
async def enrich_event(
    lat: float = Query(..., description="Latitude do evento"),
    lng: float = Query(..., description="Longitude do evento"),
    name: str = Query("", description="Nome do evento"),
):
    """
    Enriquece a localização de um evento com dados de natureza, transporte e trilhos.

    Dado um evento da Agenda Viral (lat/lng), retorna:
    - Área protegida mais próxima (ICNF/RNAP)
    - Estação de biodiversidade mais próxima
    - Transportes públicos próximos (Metro/CP/Carris)
    - Trilhos de natureza adjacentes
    - Contexto geográfico (freguesia/concelho/distrito)
    - Sugestões de visita de natureza
    """
    result = await crossref.enrich_event_location(lat, lng, name)
    return result


# ========================
# EVENT -> NATURE ITINERARY
# ========================

@discovery_router.get("/event-to-nature")
async def event_to_nature_itinerary(
    lat: float = Query(..., description="Latitude do evento"),
    lng: float = Query(..., description="Longitude do evento"),
    name: str = Query("", description="Nome do evento"),
):
    """
    Planeia um itinerário de 2 dias: evento cultural + visita de natureza.

    User Flow:
    1. Utilizador vai a um concerto (Dia 1 - noite)
    2. No dia seguinte, é sugerida uma visita a uma Estação de Biodiversidade próxima
    3. Inclui transportes públicos para chegar ao destino de natureza
    4. Mostra espécies notáveis que pode observar
    5. Dicas de sustentabilidade

    Exemplo: Concerto no Coliseu de Lisboa -> Dia 2: Reserva Natural do Estuário do Tejo
    via comboio CP desde Lisboa Oriente
    """
    result = await crossref.plan_event_to_nature(lat, lng, name)
    return result


# ========================
# TRAIL SAFETY
# ========================

@discovery_router.get("/trail-safety")
async def get_trail_safety(
    lat: float = Query(..., description="Latitude do ponto do trilho"),
    lng: float = Query(..., description="Longitude do ponto do trilho"),
):
    """
    Informação de segurança para um trilho:
    - Alertas meteorológicos IPMA para a zona
    - Regras de área protegida (se aplicável)
    - Área protegida mais próxima
    """
    result = await crossref.get_trail_safety_info(lat, lng)
    return result


# ========================
# TRAILS & CYCLING
# ========================

@discovery_router.get("/trails/hiking")
async def find_hiking_trails(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_m: int = Query(10000, description="Raio em metros"),
):
    """
    Trilhos pedestres próximos via Overpass API (OpenStreetMap).
    Inclui GR (Grandes Rotas) e PR (Pequenas Rotas).
    """
    trails = await overpass_service.find_hiking_trails(lat, lng, radius_m)
    return {
        "trails": trails,
        "total": len(trails),
        "source": "OpenStreetMap/Overpass",
    }


@discovery_router.get("/trails/cycling")
async def find_cycling_routes(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_m: int = Query(15000),
):
    """
    Ciclovias e rotas ciclísticas próximas (inclui EuroVelo).
    Fonte: OpenStreetMap/Overpass API
    """
    routes = await overpass_service.find_cycling_routes(lat, lng, radius_m)
    return {
        "routes": routes,
        "total": len(routes),
        "source": "OpenStreetMap/Overpass",
    }


@discovery_router.get("/trails/eurovelo")
async def get_eurovelo_routes():
    """
    Rotas EuroVelo em Portugal.
    EV1 - Rota da Costa Atlântica
    EV3 - Rota dos Peregrinos
    """
    routes = overpass_service.get_eurovelo_routes()
    return {
        "routes": routes,
        "total": len(routes),
        "source": "EuroVelo/OSM",
    }


@discovery_router.get("/trails/long-distance")
async def get_long_distance_trails(
    region: Optional[str] = Query(None, description="Filtro por região"),
):
    """
    Trilhos de longa distância em Portugal:
    Rota Vicentina, Via Algarviana, Caminho de Santiago, etc.
    """
    trails = overpass_service.get_long_distance_trails(region)
    return {
        "trails": trails,
        "total": len(trails),
        "source": "Turismo de Portugal/OSM",
    }


@discovery_router.get("/trails/pois-nearby")
async def get_trail_pois(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_m: int = Query(2000),
):
    """
    Pontos de interesse perto de um ponto do trilho:
    miradouros, nascentes, abrigos, mesas de piquenique, picos, monumentos.
    """
    pois = await overpass_service.find_pois_near_trail(lat, lng, radius_m)
    return {
        "pois": pois,
        "total": len(pois),
        "source": "OpenStreetMap/Overpass",
    }


# ========================
# TRANSPORT PLANNING
# ========================

@discovery_router.get("/transport/nearby")
async def find_nearby_transport(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(2.0),
    transport_type: Optional[str] = Query(None, description="metro, train, cp"),
):
    """
    Paragens/estações de transporte público mais próximas.
    Inclui Metro de Lisboa, Metro do Porto, e CP Comboios.
    """
    stops = transport_service.find_nearest_stops(lat, lng, radius_km, transport_type)
    return {
        "stops": stops,
        "total": len(stops),
        "source": "GTFS/Metro/CP",
    }


@discovery_router.get("/transport/route")
async def plan_transport_route(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...),
):
    """
    Planeamento básico de rota multimodal entre dois pontos.
    Encontra estações próximas à origem e destino e sugere ligações.
    """
    route = transport_service.plan_route_to_destination(
        origin_lat, origin_lng, dest_lat, dest_lng
    )
    return route


# ========================
# PROTECTED AREA EXPLORATION
# ========================

@discovery_router.get("/explore/protected-area/{area_id}")
async def explore_protected_area(area_id: str):
    """
    Explora uma Área Protegida: trilhos, estações de biodiversidade, transportes.
    """
    result = crossref.find_trails_near_protected_area(area_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
