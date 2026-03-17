"""
ICNF Service - Instituto da Conservação da Natureza e das Florestas
Integration with IDE-ICNF and SNIG via WMS/WFS for:
- Áreas Protegidas de Portugal
- Rede Natura 2000 (SIC + ZPE)
- Estações de Biodiversidade
APIs: https://geocatalogo.icnf.pt / https://snig.dgterritorio.gov.pt
"""
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from math import radians, sin, cos, sqrt, atan2

logger = logging.getLogger(__name__)


class ProtectedArea(BaseModel):
    id: str
    name: str
    designation: str  # Parque Nacional, Parque Natural, Reserva Natural, etc.
    area_km2: Optional[float] = None
    region: str = ""
    municipality: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    bbox: Optional[List[float]] = None  # [minx, miny, maxx, maxy]
    description: str = ""
    classification: str = ""  # IUCN category
    network: str = ""  # RNAP, Natura2000-SIC, Natura2000-ZPE
    source: str = "ICNF"


class BiodiversityStation(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    municipality: str = ""
    district: str = ""
    habitat_type: str = ""
    species_count: Optional[int] = None
    highlights: List[str] = []
    trails_nearby: List[str] = []
    source: str = "ICNF"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


# Static data for Portuguese Protected Areas (RNAP)
PROTECTED_AREAS = [
    ProtectedArea(id="pnpg", name="Parque Nacional da Peneda-Gerês", designation="Parque Nacional",
                  area_km2=695.9, region="Minho", municipality="Terras de Bouro",
                  lat=41.75, lng=-8.15, network="RNAP",
                  description="Único Parque Nacional de Portugal, com paisagens graníticas e biodiversidade única"),
    ProtectedArea(id="pnse", name="Parque Natural da Serra da Estrela", designation="Parque Natural",
                  area_km2=888.5, region="Beiras", municipality="Seia",
                  lat=40.33, lng=-7.62, network="RNAP",
                  description="Ponto mais alto de Portugal continental, glaciar e paisagens de montanha"),
    ProtectedArea(id="pnsc", name="Parque Natural de Sintra-Cascais", designation="Parque Natural",
                  area_km2=145.0, region="Lisboa", municipality="Sintra",
                  lat=38.78, lng=-9.42, network="RNAP",
                  description="Paisagem Cultural UNESCO com floresta atlântica e falésias costeiras"),
    ProtectedArea(id="pnaa", name="Parque Natural da Arrábida", designation="Parque Natural",
                  area_km2=108.0, region="Setúbal", municipality="Setúbal",
                  lat=38.48, lng=-8.98, network="RNAP",
                  description="Floresta mediterrânica e falésias calcárias sobre o Atlântico"),
    ProtectedArea(id="pndi", name="Parque Natural do Douro Internacional", designation="Parque Natural",
                  area_km2=858.5, region="Trás-os-Montes", municipality="Miranda do Douro",
                  lat=41.18, lng=-6.45, network="RNAP",
                  description="Arribas do Douro com águia-real e abutre-do-Egipto"),
    ProtectedArea(id="pnsac", name="Parque Natural das Serras de Aire e Candeeiros", designation="Parque Natural",
                  area_km2=384.0, region="Ribatejo", municipality="Porto de Mós",
                  lat=39.53, lng=-8.82, network="RNAP",
                  description="Maior maciço calcário de Portugal com grutas e dolinas"),
    ProtectedArea(id="pnrf", name="Parque Natural da Ria Formosa", designation="Parque Natural",
                  area_km2=183.0, region="Algarve", municipality="Olhão",
                  lat=37.02, lng=-7.83, network="RNAP",
                  description="Zona húmida de importância internacional, aves migratórias"),
    ProtectedArea(id="pnvg", name="Parque Natural do Vale do Guadiana", designation="Parque Natural",
                  area_km2=695.0, region="Alentejo", municipality="Mértola",
                  lat=37.65, lng=-7.65, network="RNAP",
                  description="Paisagem alentejana com lince-ibérico e minas romanas"),
    ProtectedArea(id="pnsm", name="Parque Natural do Sudoeste Alentejano e Costa Vicentina", designation="Parque Natural",
                  area_km2=607.0, region="Alentejo/Algarve", municipality="Odemira",
                  lat=37.30, lng=-8.85, network="RNAP",
                  description="Costa selvagem com flora endémica e Rota Vicentina"),
    ProtectedArea(id="pntv", name="Parque Natural do Tejo Internacional", designation="Parque Natural",
                  area_km2=264.7, region="Beira Baixa", municipality="Castelo Branco",
                  lat=39.77, lng=-7.22, network="RNAP",
                  description="Raptores rupícolas e bosques de zimbro"),
    ProtectedArea(id="pnal", name="Parque Natural do Alvão", designation="Parque Natural",
                  area_km2=72.2, region="Trás-os-Montes", municipality="Vila Real",
                  lat=41.37, lng=-7.78, network="RNAP",
                  description="Cascatas das Fisgas de Ermelo e lobo-ibérico"),
    ProtectedArea(id="pnml", name="Parque Natural da Serra de São Mamede", designation="Parque Natural",
                  area_km2=561.0, region="Alto Alentejo", municipality="Portalegre",
                  lat=39.30, lng=-7.38, network="RNAP",
                  description="Transição mediterrânica-atlântica com castanheiros e carvalhos"),
    ProtectedArea(id="pnln", name="Parque Natural do Litoral Norte", designation="Parque Natural",
                  area_km2=16.0, region="Minho", municipality="Esposende",
                  lat=41.53, lng=-8.78, network="RNAP",
                  description="Dunas e zonas húmidas costeiras"),
    ProtectedArea(id="rne", name="Reserva Natural do Estuário do Sado", designation="Reserva Natural",
                  area_km2=233.0, region="Setúbal", municipality="Setúbal",
                  lat=38.47, lng=-8.78, network="RNAP",
                  description="Golfinhos-roazes e salinas, zona húmida Ramsar"),
    ProtectedArea(id="rnet", name="Reserva Natural do Estuário do Tejo", designation="Reserva Natural",
                  area_km2=148.0, region="Ribatejo", municipality="Vila Franca de Xira",
                  lat=38.87, lng=-8.92, network="RNAP",
                  description="Uma das zonas húmidas mais importantes da Europa"),
    ProtectedArea(id="rnb", name="Reserva Natural das Berlengas", designation="Reserva Natural",
                  area_km2=104.0, region="Oeste", municipality="Peniche",
                  lat=39.42, lng=-9.50, network="RNAP",
                  description="Arquipélago Reserva da Biosfera UNESCO"),
    ProtectedArea(id="ppge", name="Paisagem Protegida da Serra do Açor", designation="Paisagem Protegida",
                  area_km2=340.0, region="Beiras", municipality="Arganil",
                  lat=40.22, lng=-7.90, network="RNAP",
                  description="Mata da Margaraça com relíquias da floresta laurissilva"),
]

# Natura 2000 sites (major ones)
NATURA_2000_SITES = [
    {"id": "n2k_sac_alvao", "name": "Alvão / Marão", "type": "SIC", "lat": 41.35, "lng": -7.80,
     "area_km2": 588.0, "region": "Trás-os-Montes", "habitats": ["Florestas de carvalho", "Turfeiras"]},
    {"id": "n2k_sac_geres", "name": "Peneda / Gerês", "type": "SIC", "lat": 41.78, "lng": -8.10,
     "area_km2": 886.0, "region": "Minho", "habitats": ["Carvalhais", "Matos húmidos", "Turfeiras"]},
    {"id": "n2k_sac_montesinho", "name": "Montesinho / Nogueira", "type": "SIC", "lat": 41.90, "lng": -6.85,
     "area_km2": 1037.0, "region": "Trás-os-Montes", "habitats": ["Carvalhais", "Lameiros"]},
    {"id": "n2k_sac_estrela", "name": "Serra da Estrela", "type": "SIC", "lat": 40.35, "lng": -7.60,
     "area_km2": 884.0, "region": "Beiras", "habitats": ["Cervunais", "Zimbro", "Vidoal"]},
    {"id": "n2k_sac_arrabida", "name": "Arrábida / Espichel", "type": "SIC", "lat": 38.48, "lng": -9.00,
     "area_km2": 175.0, "region": "Setúbal", "habitats": ["Matos mediterrânicos", "Falésias"]},
    {"id": "n2k_sac_guadiana", "name": "Guadiana", "type": "SIC", "lat": 37.60, "lng": -7.60,
     "area_km2": 393.0, "region": "Alentejo", "habitats": ["Montado", "Galerias ripícolas"]},
    {"id": "n2k_sac_ria_formosa", "name": "Ria Formosa / Castro Marim", "type": "SIC", "lat": 37.05, "lng": -7.80,
     "area_km2": 220.0, "region": "Algarve", "habitats": ["Sapais", "Dunas", "Lagunas"]},
    {"id": "n2k_sac_costa_vicentina", "name": "Costa Sudoeste", "type": "SIC", "lat": 37.30, "lng": -8.85,
     "area_km2": 365.0, "region": "Alentejo/Algarve", "habitats": ["Falésias", "Charnecas litorais"]},
    {"id": "n2k_zpe_tejo", "name": "Estuário do Tejo", "type": "ZPE", "lat": 38.85, "lng": -8.90,
     "area_km2": 446.0, "region": "Ribatejo", "habitats": ["Zona húmida", "Sapal"]},
    {"id": "n2k_zpe_sado", "name": "Estuário do Sado", "type": "ZPE", "lat": 38.45, "lng": -8.78,
     "area_km2": 247.0, "region": "Setúbal", "habitats": ["Sapal", "Salinas"]},
    {"id": "n2k_zpe_castro_verde", "name": "Castro Verde", "type": "ZPE", "lat": 37.70, "lng": -8.10,
     "area_km2": 856.0, "region": "Alentejo", "habitats": ["Estepe cerealífera", "Abetarda"]},
]

# Biodiversity stations
BIODIVERSITY_STATIONS = [
    BiodiversityStation(id="eb_geres", name="Estação de Biodiversidade de Mata da Albergaria",
                        lat=41.77, lng=-8.12, municipality="Terras de Bouro", district="Braga",
                        habitat_type="Carvalhal autóctone", species_count=340,
                        highlights=["Carvalho-alvarinho", "Salamandra-lusitânica", "Águia-real"]),
    BiodiversityStation(id="eb_berlenga", name="Estação de Biodiversidade da Berlenga",
                        lat=39.41, lng=-9.51, municipality="Peniche", district="Leiria",
                        habitat_type="Insular oceânico", species_count=120,
                        highlights=["Sardinheira-da-berlenga", "Lagartixa-da-berlenga"]),
    BiodiversityStation(id="eb_arrabida", name="Estação de Biodiversidade da Arrábida",
                        lat=38.49, lng=-8.97, municipality="Setúbal", district="Setúbal",
                        habitat_type="Floresta mediterrânica", species_count=280,
                        highlights=["Carvalho-português", "Medronheiro", "Bonelli's Eagle"]),
    BiodiversityStation(id="eb_paul_arzila", name="Estação de Biodiversidade do Paul de Arzila",
                        lat=40.15, lng=-8.55, municipality="Coimbra", district="Coimbra",
                        habitat_type="Zona húmida", species_count=210,
                        highlights=["Garça-vermelha", "Lontra", "Nenúfar-branco"]),
    BiodiversityStation(id="eb_castro_verde", name="Estação de Biodiversidade de Castro Verde",
                        lat=37.70, lng=-8.08, municipality="Castro Verde", district="Beja",
                        habitat_type="Estepe cerealífera", species_count=195,
                        highlights=["Abetarda", "Peneireiro-das-torres", "Sisão"]),
    BiodiversityStation(id="eb_dunas_mira", name="Estação de Biodiversidade das Dunas de Mira",
                        lat=40.42, lng=-8.80, municipality="Mira", district="Coimbra",
                        habitat_type="Dunas costeiras", species_count=165,
                        highlights=["Camaleão-comum", "Lírio-das-areias"]),
    BiodiversityStation(id="eb_montesinho", name="Estação de Biodiversidade de Montesinho",
                        lat=41.93, lng=-6.83, municipality="Bragança", district="Bragança",
                        habitat_type="Carvalhal sub-montano", species_count=310,
                        highlights=["Lobo-ibérico", "Veado", "Azinheira"]),
    BiodiversityStation(id="eb_ria_formosa", name="Estação de Biodiversidade da Ria Formosa",
                        lat=37.02, lng=-7.82, municipality="Olhão", district="Faro",
                        habitat_type="Zona húmida costeira", species_count=290,
                        highlights=["Cavalinho-marinho", "Flamingo", "Caimão"]),
]


class ICNFService:
    """Service for ICNF Protected Areas and Biodiversity data"""

    WFS_BASE = "https://geocatalogo.icnf.pt/geoserver/wfs"
    WMS_BASE = "https://geocatalogo.icnf.pt/geoserver/wms"

    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = timedelta(hours=6)
        self._last_fetch: Dict[str, datetime] = {}

    def _is_cache_valid(self, key: str) -> bool:
        if key not in self._last_fetch:
            return False
        return datetime.now(timezone.utc) - self._last_fetch[key] < self._cache_ttl

    def get_protected_areas(self, lat: Optional[float] = None, lng: Optional[float] = None,
                            radius_km: float = 50.0, network: Optional[str] = None) -> List[ProtectedArea]:
        """Get protected areas, optionally filtered by proximity"""
        areas = PROTECTED_AREAS.copy()

        if network:
            areas = [a for a in areas if a.network.lower() == network.lower()]

        if lat is not None and lng is not None:
            result = []
            for area in areas:
                if area.lat and area.lng:
                    dist = _haversine_km(lat, lng, area.lat, area.lng)
                    if dist <= radius_km:
                        area_dict = area.model_copy()
                        result.append((dist, area_dict))
            result.sort(key=lambda x: x[0])
            return [a for _, a in result]

        return areas

    def get_nearest_protected_area(self, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        """Get the single nearest protected area to coordinates"""
        best_dist = float("inf")
        best_area = None
        for area in PROTECTED_AREAS:
            if area.lat and area.lng:
                dist = _haversine_km(lat, lng, area.lat, area.lng)
                if dist < best_dist:
                    best_dist = dist
                    best_area = area
        if best_area:
            return {
                "area": best_area.model_dump(),
                "distance_km": round(best_dist, 2),
            }
        return None

    def get_natura2000_sites(self, lat: Optional[float] = None, lng: Optional[float] = None,
                             radius_km: float = 50.0, site_type: Optional[str] = None) -> List[Dict]:
        """Get Natura 2000 sites (SIC + ZPE)"""
        sites = NATURA_2000_SITES.copy()
        if site_type:
            sites = [s for s in sites if s["type"].upper() == site_type.upper()]

        if lat is not None and lng is not None:
            result = []
            for site in sites:
                dist = _haversine_km(lat, lng, site["lat"], site["lng"])
                if dist <= radius_km:
                    s = dict(site)
                    s["distance_km"] = round(dist, 2)
                    result.append(s)
            result.sort(key=lambda x: x["distance_km"])
            return result

        return sites

    def get_biodiversity_stations(self, lat: Optional[float] = None, lng: Optional[float] = None,
                                   radius_km: float = 50.0) -> List[Dict]:
        """Get biodiversity stations, optionally by proximity"""
        stations = BIODIVERSITY_STATIONS
        if lat is not None and lng is not None:
            result = []
            for st in stations:
                dist = _haversine_km(lat, lng, st.lat, st.lng)
                if dist <= radius_km:
                    d = st.model_dump()
                    d["distance_km"] = round(dist, 2)
                    result.append(d)
            result.sort(key=lambda x: x["distance_km"])
            return result
        return [s.model_dump() for s in stations]

    def get_nearest_biodiversity_station(self, lat: float, lng: float) -> Optional[Dict]:
        """Get nearest biodiversity station"""
        best_dist = float("inf")
        best = None
        for st in BIODIVERSITY_STATIONS:
            dist = _haversine_km(lat, lng, st.lat, st.lng)
            if dist < best_dist:
                best_dist = dist
                best = st
        if best:
            return {
                "station": best.model_dump(),
                "distance_km": round(best_dist, 2),
            }
        return None

    async def query_wfs_protected_areas(self, bbox: Optional[List[float]] = None) -> List[Dict]:
        """Query ICNF WFS for protected areas (live API call)"""
        cache_key = f"wfs_ap_{bbox}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeName": "icnf:areas_protegidas",
            "outputFormat": "application/json",
            "srsName": "EPSG:4326",
            "maxFeatures": "100",
        }
        if bbox:
            params["bbox"] = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]},EPSG:4326"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(self.WFS_BASE, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    features = data.get("features", [])
                    result = []
                    for f in features:
                        props = f.get("properties", {})
                        geom = f.get("geometry", {})
                        result.append({
                            "name": props.get("nome", ""),
                            "designation": props.get("designacao", ""),
                            "area_ha": props.get("area_ha"),
                            "geometry_type": geom.get("type", ""),
                        })
                    self._cache[cache_key] = result
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return result
        except Exception as e:
            logger.warning(f"ICNF WFS query failed: {e}")

        # Fallback to static data
        return [a.model_dump() for a in PROTECTED_AREAS]

    def get_wms_layer_url(self, layer: str = "areas_protegidas") -> str:
        """Get WMS tile URL for map overlay"""
        layers_map = {
            "areas_protegidas": "icnf:areas_protegidas",
            "natura2000_sic": "icnf:natura2000_sic",
            "natura2000_zpe": "icnf:natura2000_zpe",
            "rede_natura": "icnf:rede_natura_2000",
        }
        layer_name = layers_map.get(layer, layer)
        return (
            f"{self.WMS_BASE}?"
            f"service=WMS&version=1.1.1&request=GetMap"
            f"&layers={layer_name}&srs=EPSG:4326"
            f"&format=image/png&transparent=true"
            f"&width=256&height=256"
            f"&bbox={{bbox}}"
        )
