"""
GTFS Service - General Transit Feed Specification for Portuguese transport
Sources:
- dados.gov.pt GTFS packages (CIM regions)
- Metro de Lisboa real-time API
- Metro do Porto real-time API
- CP Comboios de Portugal
"""
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from math import radians, sin, cos, sqrt, atan2

logger = logging.getLogger(__name__)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


# Metro de Lisboa stations with coordinates
METRO_LISBOA_STATIONS = [
    {"id": "ml_aeroporto", "name": "Aeroporto", "line": "Vermelha", "lat": 38.7692, "lng": -9.1286},
    {"id": "ml_encarnacao", "name": "Encarnação", "line": "Vermelha", "lat": 38.7668, "lng": -9.1335},
    {"id": "ml_moscavide", "name": "Moscavide", "line": "Vermelha", "lat": 38.7640, "lng": -9.1065},
    {"id": "ml_oriente", "name": "Oriente", "line": "Vermelha", "lat": 38.7676, "lng": -9.0991},
    {"id": "ml_alameda", "name": "Alameda", "line": "Vermelha/Verde", "lat": 38.7376, "lng": -9.1336},
    {"id": "ml_saldanha", "name": "Saldanha", "line": "Vermelha/Amarela", "lat": 38.7357, "lng": -9.1452},
    {"id": "ml_sao_sebastiao", "name": "São Sebastião", "line": "Vermelha/Azul", "lat": 38.7337, "lng": -9.1537},
    {"id": "ml_marquês", "name": "Marquês de Pombal", "line": "Azul/Amarela", "lat": 38.7253, "lng": -9.1500},
    {"id": "ml_baixa_chiado", "name": "Baixa-Chiado", "line": "Azul/Verde", "lat": 38.7108, "lng": -9.1400},
    {"id": "ml_rossio", "name": "Rossio", "line": "Verde", "lat": 38.7145, "lng": -9.1405},
    {"id": "ml_restauradores", "name": "Restauradores", "line": "Azul", "lat": 38.7165, "lng": -9.1418},
    {"id": "ml_terreiro", "name": "Terreiro do Paço", "line": "Azul", "lat": 38.7073, "lng": -9.1365},
    {"id": "ml_cais_sodre", "name": "Cais do Sodré", "line": "Verde", "lat": 38.7060, "lng": -9.1440},
    {"id": "ml_campo_grande", "name": "Campo Grande", "line": "Amarela/Verde", "lat": 38.7593, "lng": -9.1587},
    {"id": "ml_entre_campos", "name": "Entre Campos", "line": "Amarela", "lat": 38.7487, "lng": -9.1480},
    {"id": "ml_roma", "name": "Roma", "line": "Amarela", "lat": 38.7470, "lng": -9.1410},
    {"id": "ml_rato", "name": "Rato", "line": "Amarela", "lat": 38.7200, "lng": -9.1548},
    {"id": "ml_santa_apolonia", "name": "Santa Apolónia", "line": "Azul", "lat": 38.7146, "lng": -9.1231},
    {"id": "ml_intendente", "name": "Intendente", "line": "Verde", "lat": 38.7208, "lng": -9.1355},
    {"id": "ml_arroios", "name": "Arroios", "line": "Verde", "lat": 38.7265, "lng": -9.1368},
]

# Metro do Porto stations (main ones)
METRO_PORTO_STATIONS = [
    {"id": "mp_trindade", "name": "Trindade", "line": "A/B/C/D/E/F", "lat": 41.1524, "lng": -8.6096},
    {"id": "mp_aliados", "name": "Aliados", "line": "D", "lat": 41.1484, "lng": -8.6108},
    {"id": "mp_sao_bento", "name": "São Bento", "line": "D", "lat": 41.1456, "lng": -8.6106},
    {"id": "mp_bolhao", "name": "Bolhão", "line": "A/B/C/E/F", "lat": 41.1502, "lng": -8.6050},
    {"id": "mp_campanha", "name": "Campanhã", "line": "A/B/C/E/F", "lat": 41.1487, "lng": -8.5859},
    {"id": "mp_casa_musica", "name": "Casa da Música", "line": "A/B/C/E/F", "lat": 41.1581, "lng": -8.6305},
    {"id": "mp_hospital_sao_joao", "name": "Hospital de São João", "line": "D", "lat": 41.1851, "lng": -8.6035},
    {"id": "mp_estadio_dragao", "name": "Estádio do Dragão", "line": "A/B/C/E/F", "lat": 41.1614, "lng": -8.5880},
    {"id": "mp_aeroporto", "name": "Aeroporto", "line": "E", "lat": 41.2358, "lng": -8.6710},
    {"id": "mp_matosinhos", "name": "Matosinhos Sul", "line": "A", "lat": 41.1816, "lng": -8.6880},
    {"id": "mp_vila_nova_gaia", "name": "General Torres", "line": "D", "lat": 41.1335, "lng": -8.6133},
    {"id": "mp_santo_ovidio", "name": "Santo Ovídio", "line": "D", "lat": 41.1120, "lng": -8.6144},
]

# CP major stations
CP_MAJOR_STATIONS = [
    {"id": "cp_lisboa_oriente", "name": "Lisboa Oriente", "lat": 38.7676, "lng": -9.0991,
     "lines": ["AP", "IC", "IR", "Regional", "Urbano"]},
    {"id": "cp_lisboa_sta_ap", "name": "Lisboa Santa Apolónia", "lat": 38.7146, "lng": -9.1231,
     "lines": ["AP", "IC", "IR"]},
    {"id": "cp_porto_campanha", "name": "Porto Campanhã", "lat": 41.1487, "lng": -8.5859,
     "lines": ["AP", "IC", "IR", "Regional", "Urbano"]},
    {"id": "cp_porto_sao_bento", "name": "Porto São Bento", "lat": 41.1456, "lng": -8.6106,
     "lines": ["Urbano", "Regional"]},
    {"id": "cp_coimbra_b", "name": "Coimbra-B", "lat": 40.2244, "lng": -8.4376,
     "lines": ["AP", "IC", "IR", "Regional"]},
    {"id": "cp_faro", "name": "Faro", "lat": 37.0192, "lng": -7.9326,
     "lines": ["IC", "IR", "Regional"]},
    {"id": "cp_braga", "name": "Braga", "lat": 41.5493, "lng": -8.4341,
     "lines": ["IC", "Urbano"]},
    {"id": "cp_aveiro", "name": "Aveiro", "lat": 40.6434, "lng": -8.6521,
     "lines": ["AP", "IC", "IR", "Regional"]},
    {"id": "cp_evora", "name": "Évora", "lat": 38.5667, "lng": -7.8992,
     "lines": ["IC", "Regional"]},
    {"id": "cp_guimaraes", "name": "Guimarães", "lat": 41.4442, "lng": -8.2916,
     "lines": ["Urbano"]},
    {"id": "cp_leiria", "name": "Leiria", "lat": 39.7440, "lng": -8.8072,
     "lines": ["IC", "Regional"]},
    {"id": "cp_sintra", "name": "Sintra", "lat": 38.7992, "lng": -9.3860,
     "lines": ["Urbano (Linha de Sintra)"]},
    {"id": "cp_cascais", "name": "Cascais", "lat": 38.6960, "lng": -9.4215,
     "lines": ["Urbano (Linha de Cascais)"]},
    {"id": "cp_setubal", "name": "Setúbal", "lat": 38.5243, "lng": -8.8926,
     "lines": ["Regional (Linha do Sado)"]},
    {"id": "cp_tunes", "name": "Tunes", "lat": 37.1624, "lng": -8.2413,
     "lines": ["IC", "IR", "Regional (Algarve)"]},
]


class GTFSTransportService:
    """Service for Portuguese public transport data (GTFS + real-time)"""

    METRO_LISBOA_API = "https://api.metrolisboa.pt/v1"
    METRO_PORTO_API = "https://api.metrodoporto.pt/v1"

    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = timedelta(minutes=5)
        self._last_fetch: Dict[str, datetime] = {}

    def _is_cache_valid(self, key: str) -> bool:
        if key not in self._last_fetch:
            return False
        return datetime.now(timezone.utc) - self._last_fetch[key] < self._cache_ttl

    def find_nearest_stops(self, lat: float, lng: float,
                            radius_km: float = 2.0,
                            transport_type: Optional[str] = None) -> List[Dict]:
        """Find nearest public transport stops to coordinates"""
        all_stops = []

        # Metro Lisboa
        if transport_type in (None, "metro", "metro_lisboa"):
            for st in METRO_LISBOA_STATIONS:
                dist = _haversine_km(lat, lng, st["lat"], st["lng"])
                if dist <= radius_km:
                    all_stops.append({
                        **st,
                        "transport_type": "metro",
                        "operator": "Metro de Lisboa",
                        "distance_km": round(dist, 2),
                        "distance_m": round(dist * 1000),
                    })

        # Metro Porto
        if transport_type in (None, "metro", "metro_porto"):
            for st in METRO_PORTO_STATIONS:
                dist = _haversine_km(lat, lng, st["lat"], st["lng"])
                if dist <= radius_km:
                    all_stops.append({
                        **st,
                        "transport_type": "metro",
                        "operator": "Metro do Porto",
                        "distance_km": round(dist, 2),
                        "distance_m": round(dist * 1000),
                    })

        # CP Trains
        if transport_type in (None, "train", "cp"):
            for st in CP_MAJOR_STATIONS:
                dist = _haversine_km(lat, lng, st["lat"], st["lng"])
                if dist <= radius_km:
                    all_stops.append({
                        **st,
                        "transport_type": "train",
                        "operator": "CP - Comboios de Portugal",
                        "distance_km": round(dist, 2),
                        "distance_m": round(dist * 1000),
                    })

        all_stops.sort(key=lambda x: x["distance_km"])
        return all_stops

    def find_nearest_station(self, lat: float, lng: float) -> Optional[Dict]:
        """Find single nearest transport station"""
        stops = self.find_nearest_stops(lat, lng, radius_km=50.0)
        return stops[0] if stops else None

    async def get_metro_lisboa_wait_times(self, station_id: str) -> Optional[Dict]:
        """Get real-time wait times for Metro de Lisboa station"""
        cache_key = f"ml_wait_{station_id}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.METRO_LISBOA_API}/tempoEspera/{station_id}"
                )
                if resp.status_code == 200:
                    data = resp.json()
                    result = {
                        "station": station_id,
                        "operator": "Metro de Lisboa",
                        "wait_times": data,
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                    }
                    self._cache[cache_key] = result
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return result
        except Exception as e:
            logger.warning(f"Metro Lisboa API failed: {e}")

        return None

    async def get_metro_porto_wait_times(self, station_id: str) -> Optional[Dict]:
        """Get real-time wait times for Metro do Porto station"""
        cache_key = f"mp_wait_{station_id}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.METRO_PORTO_API}/tempoEspera/{station_id}"
                )
                if resp.status_code == 200:
                    data = resp.json()
                    result = {
                        "station": station_id,
                        "operator": "Metro do Porto",
                        "wait_times": data,
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                    }
                    self._cache[cache_key] = result
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return result
        except Exception as e:
            logger.warning(f"Metro Porto API failed: {e}")

        return None

    def plan_route_to_destination(self, origin_lat: float, origin_lng: float,
                                   dest_lat: float, dest_lng: float) -> Dict:
        """Plan a multimodal transport route (basic version using nearest stops)"""
        origin_stops = self.find_nearest_stops(origin_lat, origin_lng, radius_km=5.0)
        dest_stops = self.find_nearest_stops(dest_lat, dest_lng, radius_km=5.0)

        direct_distance = _haversine_km(origin_lat, origin_lng, dest_lat, dest_lng)

        route = {
            "origin": {"lat": origin_lat, "lng": origin_lng},
            "destination": {"lat": dest_lat, "lng": dest_lng},
            "direct_distance_km": round(direct_distance, 2),
            "origin_stops": origin_stops[:5],
            "destination_stops": dest_stops[:5],
            "suggestions": [],
        }

        if origin_stops and dest_stops:
            # Try same operator first
            for os in origin_stops[:3]:
                for ds in dest_stops[:3]:
                    if os["operator"] == ds["operator"]:
                        route["suggestions"].append({
                            "type": "direct",
                            "operator": os["operator"],
                            "from_station": os["name"],
                            "to_station": ds["name"],
                            "walk_origin_m": os["distance_m"],
                            "walk_dest_m": ds["distance_m"],
                        })

            if not route["suggestions"] and origin_stops and dest_stops:
                route["suggestions"].append({
                    "type": "transfer",
                    "from_operator": origin_stops[0]["operator"],
                    "from_station": origin_stops[0]["name"],
                    "to_operator": dest_stops[0]["operator"],
                    "to_station": dest_stops[0]["name"],
                    "note": "Pode necessitar de transferência entre operadores",
                })

        return route
