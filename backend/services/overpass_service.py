"""
Overpass API Service - OpenStreetMap data for trails and cycling routes
API: https://overpass-api.de/api/interpreter
Provides hiking trails, EuroVelo cycling routes, and pedestrian paths in Portugal
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


# EuroVelo routes in Portugal
EUROVELO_PT = [
    {"id": "ev1", "name": "EuroVelo 1 - Rota da Costa Atlântica",
     "description": "De Sagres a Valença, ao longo da costa atlântica portuguesa",
     "distance_km": 960, "start": "Sagres", "end": "Valença do Minho",
     "highlights": ["Costa Vicentina", "Lisboa", "Porto", "Minho"],
     "difficulty": "moderado", "surface": "misto (asfalto e terra batida)"},
    {"id": "ev3", "name": "EuroVelo 3 - Rota dos Peregrinos",
     "description": "Caminho de Santiago português, de Lisboa a Valença",
     "distance_km": 620, "start": "Lisboa", "end": "Valença do Minho",
     "highlights": ["Tomar", "Coimbra", "Porto", "Caminho de Santiago"],
     "difficulty": "moderado", "surface": "misto"},
]

# Notable Portuguese long-distance trails
LONG_DISTANCE_TRAILS = [
    {"id": "rv_historical", "name": "Rota Vicentina - Caminho Histórico",
     "distance_km": 230, "stages": 12, "difficulty": "moderado",
     "start_lat": 37.84, "start_lng": -8.64, "end_lat": 37.00, "end_lng": -8.93,
     "region": "Alentejo/Algarve",
     "description": "Trilho interior entre Santiago do Cacém e Cabo de São Vicente"},
    {"id": "rv_fishermen", "name": "Rota Vicentina - Trilho dos Pescadores",
     "distance_km": 226, "stages": 13, "difficulty": "moderado",
     "start_lat": 37.75, "start_lng": -8.79, "end_lat": 37.00, "end_lng": -8.93,
     "region": "Alentejo/Algarve",
     "description": "Trilho costeiro espetacular pelas falésias do sudoeste"},
    {"id": "gr11e", "name": "GR11E - Grande Rota do Alentejo e Algarve",
     "distance_km": 300, "stages": 15, "difficulty": "moderado",
     "start_lat": 38.57, "start_lng": -7.91, "end_lat": 37.02, "end_lng": -7.93,
     "region": "Alentejo/Algarve",
     "description": "Travessia norte-sul pelo interior alentejano"},
    {"id": "via_algarviana", "name": "Via Algarviana",
     "distance_km": 300, "stages": 14, "difficulty": "moderado",
     "start_lat": 37.17, "start_lng": -7.44, "end_lat": 37.00, "end_lng": -8.93,
     "region": "Algarve",
     "description": "Travessia este-oeste pelo Algarve interior, de Alcoutim ao Cabo de São Vicente"},
    {"id": "geres_travessia", "name": "Travessia do Gerês",
     "distance_km": 70, "stages": 4, "difficulty": "dificil",
     "start_lat": 41.72, "start_lng": -8.15, "end_lat": 41.85, "end_lng": -8.05,
     "region": "Minho",
     "description": "Travessia do Parque Nacional, paisagens graníticas e cascatas"},
    {"id": "caminho_santiago", "name": "Caminho de Santiago Português (Central)",
     "distance_km": 260, "stages": 12, "difficulty": "moderado",
     "start_lat": 38.72, "start_lng": -9.14, "end_lat": 42.00, "end_lng": -8.58,
     "region": "Centro/Norte",
     "description": "Caminho tradicional de Lisboa ao Porto e Valença"},
]


class OverpassService:
    """Service for Overpass API (OpenStreetMap) trail and cycling data"""

    BASE_URL = "https://overpass-api.de/api/interpreter"

    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = timedelta(hours=6)
        self._last_fetch: Dict[str, datetime] = {}

    def _is_cache_valid(self, key: str) -> bool:
        if key not in self._last_fetch:
            return False
        return datetime.now(timezone.utc) - self._last_fetch[key] < self._cache_ttl

    async def find_hiking_trails(self, lat: float, lng: float,
                                  radius_m: int = 10000) -> List[Dict]:
        """Find hiking trails near coordinates using Overpass API"""
        cache_key = f"hike_{lat:.2f}_{lng:.2f}_{radius_m}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        query = f"""
        [out:json][timeout:25];
        (
          way["highway"="path"]["sac_scale"](around:{radius_m},{lat},{lng});
          relation["route"="hiking"](around:{radius_m},{lat},{lng});
          way["highway"="footway"]["name"](around:{radius_m},{lat},{lng});
        );
        out body;
        >;
        out skel qt;
        """

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(self.BASE_URL, data={"data": query})
                if resp.status_code == 200:
                    data = resp.json()
                    trails = self._parse_trail_elements(data.get("elements", []))
                    self._cache[cache_key] = trails
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return trails
        except Exception as e:
            logger.warning(f"Overpass hiking query failed: {e}")

        return []

    async def find_cycling_routes(self, lat: float, lng: float,
                                   radius_m: int = 15000) -> List[Dict]:
        """Find cycling routes near coordinates (including EuroVelo)"""
        cache_key = f"cycle_{lat:.2f}_{lng:.2f}_{radius_m}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        query = f"""
        [out:json][timeout:25];
        (
          relation["route"="bicycle"](around:{radius_m},{lat},{lng});
          way["highway"="cycleway"](around:{radius_m},{lat},{lng});
          way["cycleway"](around:{radius_m},{lat},{lng});
        );
        out body;
        >;
        out skel qt;
        """

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(self.BASE_URL, data={"data": query})
                if resp.status_code == 200:
                    data = resp.json()
                    routes = self._parse_cycling_elements(data.get("elements", []))
                    self._cache[cache_key] = routes
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return routes
        except Exception as e:
            logger.warning(f"Overpass cycling query failed: {e}")

        return []

    async def find_pois_near_trail(self, lat: float, lng: float,
                                    radius_m: int = 2000) -> List[Dict]:
        """Find points of interest near a trail point (viewpoints, springs, shelters)"""
        cache_key = f"tpoi_{lat:.3f}_{lng:.3f}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        query = f"""
        [out:json][timeout:15];
        (
          node["tourism"="viewpoint"](around:{radius_m},{lat},{lng});
          node["natural"="spring"](around:{radius_m},{lat},{lng});
          node["tourism"="wilderness_hut"](around:{radius_m},{lat},{lng});
          node["amenity"="shelter"](around:{radius_m},{lat},{lng});
          node["tourism"="picnic_site"](around:{radius_m},{lat},{lng});
          node["natural"="peak"](around:{radius_m},{lat},{lng});
          node["historic"](around:{radius_m},{lat},{lng});
          node["amenity"="drinking_water"](around:{radius_m},{lat},{lng});
        );
        out body;
        """

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(self.BASE_URL, data={"data": query})
                if resp.status_code == 200:
                    data = resp.json()
                    pois = []
                    for el in data.get("elements", []):
                        if el.get("type") == "node":
                            tags = el.get("tags", {})
                            poi_type = "unknown"
                            if "tourism" in tags:
                                poi_type = tags["tourism"]
                            elif "natural" in tags:
                                poi_type = tags["natural"]
                            elif "historic" in tags:
                                poi_type = "historic"
                            elif "amenity" in tags:
                                poi_type = tags["amenity"]

                            pois.append({
                                "osm_id": el["id"],
                                "name": tags.get("name", f"{poi_type}"),
                                "type": poi_type,
                                "lat": el["lat"],
                                "lng": el["lon"],
                                "elevation": tags.get("ele"),
                                "description": tags.get("description", ""),
                            })
                    self._cache[cache_key] = pois
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return pois
        except Exception as e:
            logger.warning(f"Overpass trail POIs query failed: {e}")

        return []

    def get_eurovelo_routes(self) -> List[Dict]:
        """Get EuroVelo routes in Portugal"""
        return EUROVELO_PT

    def get_long_distance_trails(self, region: Optional[str] = None) -> List[Dict]:
        """Get long-distance trails, optionally filtered by region"""
        trails = LONG_DISTANCE_TRAILS
        if region:
            region_lower = region.lower()
            trails = [t for t in trails if region_lower in t["region"].lower()]
        return trails

    def get_nearest_long_trail(self, lat: float, lng: float) -> Optional[Dict]:
        """Find nearest long-distance trail to coordinates"""
        best_dist = float("inf")
        best_trail = None
        for trail in LONG_DISTANCE_TRAILS:
            # Check distance to start point
            dist = _haversine_km(lat, lng, trail["start_lat"], trail["start_lng"])
            if dist < best_dist:
                best_dist = dist
                best_trail = trail
            # Check distance to end point
            dist2 = _haversine_km(lat, lng, trail.get("end_lat", trail["start_lat"]),
                                   trail.get("end_lng", trail["start_lng"]))
            if dist2 < best_dist:
                best_dist = dist2
                best_trail = trail

        if best_trail:
            return {
                "trail": best_trail,
                "distance_km": round(best_dist, 2),
            }
        return None

    def _parse_trail_elements(self, elements: List[Dict]) -> List[Dict]:
        """Parse Overpass elements into trail objects"""
        trails = []
        relations = [e for e in elements if e.get("type") == "relation"]
        ways = [e for e in elements if e.get("type") == "way"]
        nodes = {e["id"]: e for e in elements if e.get("type") == "node"}

        for rel in relations:
            tags = rel.get("tags", {})
            trails.append({
                "osm_id": rel["id"],
                "name": tags.get("name", "Trilho sem nome"),
                "type": "hiking",
                "distance": tags.get("distance", ""),
                "difficulty": tags.get("sac_scale", ""),
                "network": tags.get("network", ""),
                "operator": tags.get("operator", ""),
                "description": tags.get("description", ""),
                "source": "OSM",
            })

        for way in ways[:20]:
            tags = way.get("tags", {})
            if tags.get("name"):
                trails.append({
                    "osm_id": way["id"],
                    "name": tags.get("name", ""),
                    "type": "path",
                    "surface": tags.get("surface", ""),
                    "difficulty": tags.get("sac_scale", ""),
                    "source": "OSM",
                })

        return trails

    def _parse_cycling_elements(self, elements: List[Dict]) -> List[Dict]:
        """Parse Overpass elements into cycling route objects"""
        routes = []
        relations = [e for e in elements if e.get("type") == "relation"]

        for rel in relations:
            tags = rel.get("tags", {})
            is_eurovelo = "EuroVelo" in tags.get("network", "")
            routes.append({
                "osm_id": rel["id"],
                "name": tags.get("name", "Ciclovia sem nome"),
                "ref": tags.get("ref", ""),
                "type": "eurovelo" if is_eurovelo else "cycling",
                "network": tags.get("network", ""),
                "distance": tags.get("distance", ""),
                "operator": tags.get("operator", ""),
                "description": tags.get("description", ""),
                "source": "OSM",
            })

        return routes
