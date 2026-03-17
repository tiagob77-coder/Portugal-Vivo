"""
Fogos.pt Service - Portuguese Wildfires API
Real-time fire data from Civil Protection
API: https://api.fogos.pt
"""
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class FireStatus(str, Enum):
    ACTIVE = "active"           # Em curso
    RESOLVING = "resolving"     # Em resolução
    CONCLUDED = "concluded"     # Concluído
    VIGILANCE = "vigilance"     # Vigilância
    FIRST_ALERT = "first_alert" # 1º Alerta


class FireImportance(str, Enum):
    LOCAL = "local"
    SIGNIFICANT = "significant"
    IMPORTANT = "important"


class ActiveFire(BaseModel):
    id: str
    lat: float
    lng: float
    district: str
    municipality: str
    parish: str
    location: str
    status: FireStatus
    importance: FireImportance
    start_time: datetime
    firefighters: int
    ground_vehicles: int
    aerial_vehicles: int
    nature: str  # Tipo de incêndio (agrícola, florestal, etc.)
    updated_at: datetime


class FireStats(BaseModel):
    date: str
    total_fires: int
    active_fires: int
    total_firefighters: int
    total_ground_vehicles: int
    total_aerial_vehicles: int
    fires_by_district: Dict[str, int]


# District name mapping for Portuguese districts
DISTRICT_NAMES = {
    "AVR": "Aveiro",
    "BJA": "Beja",
    "BRA": "Braga",
    "BGC": "Bragança",
    "CTB": "Castelo Branco",
    "CBR": "Coimbra",
    "EVR": "Évora",
    "FAR": "Faro",
    "GRD": "Guarda",
    "LRA": "Leiria",
    "LSB": "Lisboa",
    "PTG": "Portalegre",
    "PRT": "Porto",
    "STR": "Santarém",
    "STB": "Setúbal",
    "VCT": "Viana do Castelo",
    "VRL": "Vila Real",
    "VIS": "Viseu",
}


class FogosService:
    """Service for Fogos.pt wildfire data"""

    BASE_URL = "https://api.fogos.pt"  # Without /v2

    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = timedelta(minutes=5)  # Fires update frequently
        self._last_fetch: Dict[str, datetime] = {}

    def _is_cache_valid(self, key: str) -> bool:
        if key not in self._last_fetch:
            return False
        return datetime.now(timezone.utc) - self._last_fetch[key] < self._cache_ttl

    async def get_active_fires(self, district: Optional[str] = None) -> List[ActiveFire]:
        """Get all active fires in Portugal"""
        cache_key = f"fires_{district or 'all'}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(f"{self.BASE_URL}/v2/fires")

                if response.status_code != 200:
                    logger.warning(f"Fogos API error: {response.status_code}")
                    return []

                data = response.json()
                fires = []

                for fire_data in data.get("data", []):
                    try:
                        # Parse status
                        status_map = {
                            "Em Curso": FireStatus.ACTIVE,
                            "Em Resolução": FireStatus.RESOLVING,
                            "Conclusão": FireStatus.CONCLUDED,
                            "Vigilância": FireStatus.VIGILANCE,
                            "1º Alerta": FireStatus.FIRST_ALERT,
                        }
                        status = status_map.get(fire_data.get("status", ""), FireStatus.ACTIVE)

                        # Determine importance based on resources
                        firefighters = int(fire_data.get("man", 0) or 0)
                        importance = FireImportance.LOCAL
                        if firefighters > 100:
                            importance = FireImportance.IMPORTANT
                        elif firefighters > 30:
                            importance = FireImportance.SIGNIFICANT

                        fire_district = fire_data.get("district", "")

                        # Filter by district if specified
                        if district and fire_district.lower() != district.lower():
                            continue

                        fire = ActiveFire(
                            id=str(fire_data.get("id", "")),
                            lat=float(fire_data.get("lat", 0)),
                            lng=float(fire_data.get("lng", 0)),
                            district=DISTRICT_NAMES.get(fire_district, fire_district),
                            municipality=fire_data.get("concelho", ""),
                            parish=fire_data.get("freguesia", ""),
                            location=fire_data.get("local", ""),
                            status=status,
                            importance=importance,
                            start_time=self._parse_datetime(fire_data.get("dateTime", {}).get("sec", 0)),
                            firefighters=firefighters,
                            ground_vehicles=int(fire_data.get("terrain", 0) or 0),
                            aerial_vehicles=int(fire_data.get("aerial", 0) or 0),
                            nature=fire_data.get("natureza", "Indefinido"),
                            updated_at=datetime.now(timezone.utc),
                        )
                        fires.append(fire)

                    except Exception as e:
                        logger.warning(f"Error parsing fire data: {e}")
                        continue

                # Sort by importance and firefighters
                fires.sort(key=lambda f: (
                    0 if f.importance == FireImportance.IMPORTANT else
                    1 if f.importance == FireImportance.SIGNIFICANT else 2,
                    -f.firefighters
                ))

                self._cache[cache_key] = fires
                self._last_fetch[cache_key] = datetime.now(timezone.utc)
                return fires

        except Exception as e:
            logger.error(f"Error fetching active fires: {e}")
            return []

    async def get_fires_near_location(
        self,
        lat: float,
        lng: float,
        radius_km: float = 50
    ) -> List[ActiveFire]:
        """Get active fires within radius of a location"""
        all_fires = await self.get_active_fires()

        nearby = []
        for fire in all_fires:
            distance = self._haversine_distance(lat, lng, fire.lat, fire.lng)
            if distance <= radius_km:
                nearby.append(fire)

        return nearby

    async def get_fire_stats(self) -> Optional[FireStats]:
        """Get daily fire statistics"""
        cache_key = "fire_stats"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            fires = await self.get_active_fires()

            if not fires:
                return FireStats(
                    date=datetime.now().strftime("%Y-%m-%d"),
                    total_fires=0,
                    active_fires=0,
                    total_firefighters=0,
                    total_ground_vehicles=0,
                    total_aerial_vehicles=0,
                    fires_by_district={},
                )

            # Calculate stats
            active_fires = [f for f in fires if f.status in [FireStatus.ACTIVE, FireStatus.FIRST_ALERT]]

            fires_by_district: Dict[str, int] = {}
            for fire in fires:
                district = fire.district
                fires_by_district[district] = fires_by_district.get(district, 0) + 1

            stats = FireStats(
                date=datetime.now().strftime("%Y-%m-%d"),
                total_fires=len(fires),
                active_fires=len(active_fires),
                total_firefighters=sum(f.firefighters for f in fires),
                total_ground_vehicles=sum(f.ground_vehicles for f in fires),
                total_aerial_vehicles=sum(f.aerial_vehicles for f in fires),
                fires_by_district=fires_by_district,
            )

            self._cache[cache_key] = stats
            self._last_fetch[cache_key] = datetime.now(timezone.utc)
            return stats

        except Exception as e:
            logger.error(f"Error calculating fire stats: {e}")
            return None

    async def get_danger_zones(self, lat: float, lng: float, radius_km: float = 100) -> Dict[str, Any]:
        """Get danger zone information for trip planning"""
        fires = await self.get_fires_near_location(lat, lng, radius_km)

        # Categorize by danger level
        danger_zones = {
            "high_danger": [],  # Fires with > 100 firefighters or < 10km
            "medium_danger": [],  # Fires with > 30 firefighters or < 30km
            "low_danger": [],  # Other fires within radius
        }

        for fire in fires:
            distance = self._haversine_distance(lat, lng, fire.lat, fire.lng)

            if distance < 10 or fire.importance == FireImportance.IMPORTANT:
                danger_zones["high_danger"].append({
                    "fire": fire.dict(),
                    "distance_km": round(distance, 1),
                })
            elif distance < 30 or fire.importance == FireImportance.SIGNIFICANT:
                danger_zones["medium_danger"].append({
                    "fire": fire.dict(),
                    "distance_km": round(distance, 1),
                })
            else:
                danger_zones["low_danger"].append({
                    "fire": fire.dict(),
                    "distance_km": round(distance, 1),
                })

        return {
            "location": {"lat": lat, "lng": lng},
            "search_radius_km": radius_km,
            "total_fires_in_area": len(fires),
            "danger_zones": danger_zones,
            "recommendation": self._get_danger_recommendation(danger_zones),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

    def _get_danger_recommendation(self, danger_zones: Dict) -> str:
        """Generate safety recommendation based on nearby fires"""
        high = len(danger_zones["high_danger"])
        medium = len(danger_zones["medium_danger"])

        if high > 0:
            return "⚠️ PERIGO ELEVADO: Incêndio significativo nas proximidades. Evite a zona e consulte as autoridades locais."
        elif medium > 0:
            return "⚠️ ATENÇÃO: Incêndios ativos na região. Mantenha-se informado e evite zonas florestais."
        else:
            return "✅ Zona segura. Mantenha-se atento às condições meteorológicas e de risco de incêndio."

    def _parse_datetime(self, timestamp: int) -> datetime:
        """Parse Unix timestamp to datetime"""
        if timestamp:
            return datetime.fromtimestamp(timestamp, tz=timezone.utc)
        return datetime.now(timezone.utc)

    def _haversine_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points in km"""
        import math
        R = 6371  # Earth radius in km

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)

        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c


# Global instance
fogos_service = FogosService()
