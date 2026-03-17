"""
Nature & Biodiversity API - Protected areas, Natura 2000, GBIF species, biodiversity stations
Integrates ICNF, SNIG, GBIF, and GeoAPI.pt data
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional

from services.icnf_service import ICNFService
from services.gbif_service import GBIFService
from services.geoapi_service import GeoAPIService

nature_router = APIRouter(prefix="/nature", tags=["Natureza e Biodiversidade"])

icnf_service = ICNFService()
gbif_service = GBIFService()
geoapi_service = GeoAPIService()


# ========================
# PROTECTED AREAS (ICNF/RNAP)
# ========================

@nature_router.get("/protected-areas")
async def get_protected_areas(
    lat: Optional[float] = Query(None, description="Latitude para busca por proximidade"),
    lng: Optional[float] = Query(None, description="Longitude para busca por proximidade"),
    radius_km: float = Query(50.0, description="Raio de busca em km"),
    network: Optional[str] = Query(None, description="Filtro por rede: RNAP"),
):
    """
    Lista as Áreas Protegidas de Portugal (RNAP).
    Opcionalmente filtra por proximidade a coordenadas GPS.
    Fonte: ICNF - Instituto da Conservação da Natureza e das Florestas
    """
    areas = icnf_service.get_protected_areas(lat, lng, radius_km, network)
    return {
        "areas": [a.model_dump() for a in areas],
        "total": len(areas),
        "source": "ICNF/RNAP",
        "filters": {"lat": lat, "lng": lng, "radius_km": radius_km},
    }


@nature_router.get("/protected-areas/nearest")
async def get_nearest_protected_area(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """
    Encontra a Área Protegida mais próxima de uma coordenada GPS.
    """
    result = icnf_service.get_nearest_protected_area(lat, lng)
    if not result:
        raise HTTPException(status_code=404, detail="Nenhuma área protegida encontrada")
    return result


# ========================
# NATURA 2000 (SIC + ZPE)
# ========================

@nature_router.get("/natura2000")
async def get_natura2000_sites(
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    radius_km: float = Query(50.0),
    site_type: Optional[str] = Query(None, description="SIC ou ZPE"),
):
    """
    Lista os sítios da Rede Natura 2000 em Portugal.
    SIC = Sítios de Importância Comunitária
    ZPE = Zonas de Proteção Especial
    Fonte: ICNF via IDE-ICNF WFS
    """
    sites = icnf_service.get_natura2000_sites(lat, lng, radius_km, site_type)
    return {
        "sites": sites,
        "total": len(sites),
        "source": "ICNF/Natura2000",
    }


# ========================
# BIODIVERSITY STATIONS
# ========================

@nature_router.get("/biodiversity-stations")
async def get_biodiversity_stations(
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    radius_km: float = Query(50.0),
):
    """
    Lista as Estações de Biodiversidade em Portugal.
    Fonte: ICNF / GeoAPI.pt
    """
    stations = icnf_service.get_biodiversity_stations(lat, lng, radius_km)
    return {
        "stations": stations,
        "total": len(stations),
        "source": "ICNF",
    }


@nature_router.get("/biodiversity-stations/nearest")
async def get_nearest_biodiversity_station(
    lat: float = Query(...),
    lng: float = Query(...),
):
    """Encontra a Estação de Biodiversidade mais próxima."""
    result = icnf_service.get_nearest_biodiversity_station(lat, lng)
    if not result:
        raise HTTPException(status_code=404, detail="Nenhuma estação encontrada")
    return result


# ========================
# GBIF - FAUNA & FLORA
# ========================

@nature_router.get("/species/nearby")
async def get_species_nearby(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius_km: float = Query(10.0),
    limit: int = Query(20, le=50),
):
    """
    Espécies registadas no GBIF próximas de uma coordenada.
    Fonte: GBIF.org (Global Biodiversity Information Facility)
    """
    species = await gbif_service.search_species_near(lat, lng, radius_km, limit)
    return {
        "species": species,
        "total": len(species),
        "source": "GBIF",
        "location": {"lat": lat, "lng": lng, "radius_km": radius_km},
    }


@nature_router.get("/species/count")
async def get_species_count(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(10.0),
):
    """Contagem de ocorrências GBIF numa área, por reino taxonómico."""
    counts = await gbif_service.get_species_count_by_area(lat, lng, radius_km)
    return counts


@nature_router.get("/species/notable")
async def get_notable_species(
    region: Optional[str] = Query(None, description="Filtro por região (ex: Alentejo, Minho)"),
):
    """
    Espécies notáveis de Portugal (fauna e flora emblemáticas).
    Inclui estado IUCN e habitats.
    """
    species = gbif_service.get_notable_species(region)
    return {
        "species": species,
        "total": len(species),
        "source": "GBIF/ICNF",
    }


@nature_router.get("/species/{taxon_key}")
async def get_species_details(taxon_key: int):
    """Detalhes de uma espécie por chave taxonómica GBIF."""
    details = await gbif_service.get_species_details(taxon_key)
    if not details:
        raise HTTPException(status_code=404, detail="Espécie não encontrada")
    return details


# ========================
# MAP LAYERS (WMS)
# ========================

@nature_router.get("/map-layers")
async def get_map_layer_urls():
    """
    URLs WMS para sobreposição nos mapas (Leaflet/MapLibre).
    Camadas: Áreas Protegidas, Natura 2000 SIC, Natura 2000 ZPE
    """
    return {
        "layers": [
            {
                "id": "areas_protegidas",
                "name": "Áreas Protegidas (RNAP)",
                "wms_url": icnf_service.get_wms_layer_url("areas_protegidas"),
                "type": "wms",
                "opacity": 0.5,
                "color": "#22c55e",
            },
            {
                "id": "natura2000_sic",
                "name": "Natura 2000 - SIC",
                "wms_url": icnf_service.get_wms_layer_url("natura2000_sic"),
                "type": "wms",
                "opacity": 0.4,
                "color": "#3b82f6",
            },
            {
                "id": "natura2000_zpe",
                "name": "Natura 2000 - ZPE",
                "wms_url": icnf_service.get_wms_layer_url("natura2000_zpe"),
                "type": "wms",
                "opacity": 0.4,
                "color": "#a855f7",
            },
        ],
        "source": "ICNF WMS / SNIG",
        "usage": "Adicione estas URLs como TileLayer WMS no Leaflet com bbox como parâmetro",
    }


# ========================
# GEO CONTEXT (GeoAPI.pt)
# ========================

@nature_router.get("/geo/reverse")
async def reverse_geocode(
    lat: float = Query(...),
    lng: float = Query(...),
):
    """
    Geocodificação reversa: coordenadas -> freguesia, concelho, distrito.
    Fonte: GeoAPI.pt
    """
    result = await geoapi_service.reverse_geocode(lat, lng)
    if not result:
        raise HTTPException(status_code=404, detail="Localização não encontrada")
    return result.model_dump()


@nature_router.get("/geo/municipality/{concelho}")
async def get_municipality(concelho: str):
    """Informação sobre um concelho. Fonte: GeoAPI.pt"""
    result = await geoapi_service.get_municipality_info(concelho)
    if not result:
        raise HTTPException(status_code=404, detail="Concelho não encontrado")
    return result


@nature_router.get("/geo/postal/{cp}")
async def get_postal_code(cp: str):
    """Pesquisa por código postal. Fonte: GeoAPI.pt"""
    result = await geoapi_service.search_postal_code(cp)
    if not result:
        raise HTTPException(status_code=404, detail="Código postal não encontrado")
    return result
