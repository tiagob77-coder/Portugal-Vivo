"""
IPMA Service - Instituto Português do Mar e da Atmosfera
Weather alerts, forecasts, and fire risk for Portugal
API: https://api.ipma.pt
"""
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class AlertLevel(str, Enum):
    GREEN = "green"      # Sem aviso
    YELLOW = "yellow"    # Aviso amarelo
    ORANGE = "orange"    # Aviso laranja
    RED = "red"          # Aviso vermelho


class AlertType(str, Enum):
    WIND = "wind"
    RAIN = "rain"
    SNOW = "snow"
    FOG = "fog"
    HEAT = "heat"
    COLD = "cold"
    COASTAL = "coastal"
    FIRE_RISK = "fire_risk"
    UV = "uv"


class WeatherAlert(BaseModel):
    id: str
    type: AlertType
    level: AlertLevel
    region: str
    region_id: str  # Changed to str to handle various formats
    title: str
    description: str
    start_time: datetime
    end_time: datetime
    source: str = "IPMA"


class WeatherForecast(BaseModel):
    date: str
    location: str
    location_id: int
    temp_min: float
    temp_max: float
    precipitation_prob: float
    wind_direction: str
    wind_speed_class: int
    weather_type: int
    weather_description: str


class FireRisk(BaseModel):
    date: str
    region: str
    district_id: int
    risk_level: int  # 1-5
    risk_name: str   # Reduzido, Moderado, Elevado, Muito Elevado, Máximo


class SeaConditions(BaseModel):
    location: str
    location_id: int
    date: str
    wave_height: Optional[float]
    wave_direction: str
    wave_period: Optional[float]
    sea_temp: Optional[float]
    wind_direction: str
    wind_speed: str


# IPMA Location IDs for main cities
IPMA_LOCATIONS = {
    "lisboa": 1110600,
    "porto": 1131200,
    "faro": 1080500,
    "coimbra": 1060300,
    "braga": 1030300,
    "aveiro": 1010500,
    "evora": 1070500,
    "funchal": 2310300,
    "ponta_delgada": 3480200,
    "setubal": 1151200,
    "leiria": 1100900,
    "viseu": 1182300,
    "guarda": 1090700,
    "braganca": 1040200,
    "castelo_branco": 1050200,
    "vila_real": 1171400,
    "viana_castelo": 1160900,
    "santarem": 1141600,
    "portalegre": 1121100,
    "beja": 1020500,
}

# District IDs for fire risk
IPMA_DISTRICTS = {
    "aveiro": 1,
    "beja": 2,
    "braga": 3,
    "braganca": 4,
    "castelo_branco": 5,
    "coimbra": 6,
    "evora": 7,
    "faro": 8,
    "guarda": 9,
    "leiria": 10,
    "lisboa": 11,
    "portalegre": 12,
    "porto": 13,
    "santarem": 14,
    "setubal": 15,
    "viana_castelo": 16,
    "vila_real": 17,
    "viseu": 18,
}

# Weather type descriptions
WEATHER_TYPES = {
    1: "Céu limpo",
    2: "Céu pouco nublado",
    3: "Céu parcialmente nublado",
    4: "Céu muito nublado ou encoberto",
    5: "Céu nublado por nuvens altas",
    6: "Aguaceiros",
    7: "Aguaceiros fracos",
    8: "Aguaceiros moderados",
    9: "Chuva",
    10: "Chuva fraca",
    11: "Chuva moderada",
    12: "Chuva forte",
    13: "Chuva intermitente",
    14: "Trovoada",
    15: "Neve",
    16: "Nevoeiro",
    17: "Neblina",
    18: "Granizo",
    19: "Geada",
}

FIRE_RISK_NAMES = {
    1: "Reduzido",
    2: "Moderado",
    3: "Elevado",
    4: "Muito Elevado",
    5: "Máximo"
}


class IPMAService:
    """Service for IPMA weather data and alerts"""

    BASE_URL = "https://api.ipma.pt/open-data"

    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = timedelta(minutes=30)
        self._last_fetch: Dict[str, datetime] = {}

    def _is_cache_valid(self, key: str) -> bool:
        if key not in self._last_fetch:
            return False
        return datetime.now(timezone.utc) - self._last_fetch[key] < self._cache_ttl

    async def get_weather_alerts(self) -> List[WeatherAlert]:
        """Get active weather alerts for Portugal"""
        cache_key = "alerts"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.BASE_URL}/forecast/warnings/warnings_www.json")

                if response.status_code != 200:
                    logger.warning(f"IPMA alerts API error: {response.status_code}")
                    return []

                data = response.json()
                alerts = []

                # Handle both list and dict responses
                alert_list = data if isinstance(data, list) else data.get("data", [])

                for alert_data in alert_list:
                    try:
                        alert = WeatherAlert(
                            id=f"ipma_{alert_data.get('idAreaAviso', '')}_{alert_data.get('awarenessTypeName', '')}",
                            type=self._map_alert_type(alert_data.get("awarenessTypeName", "")),
                            level=self._map_alert_level(alert_data.get("awarenessLevelID", "")),
                            region=alert_data.get("areaDesc", ""),
                            region_id=alert_data.get("idAreaAviso", 0),
                            title=f"Aviso {alert_data.get('awarenessLevelID', '')} - {alert_data.get('awarenessTypeName', '')}",
                            description=alert_data.get("text", ""),
                            start_time=datetime.fromisoformat(alert_data.get("startTime", "2026-01-01T00:00:00").replace("Z", "+00:00")),
                            end_time=datetime.fromisoformat(alert_data.get("endTime", "2026-01-01T00:00:00").replace("Z", "+00:00")),
                        )
                        alerts.append(alert)
                    except Exception as e:
                        logger.warning(f"Error parsing alert: {e}")
                        continue

                self._cache[cache_key] = alerts
                self._last_fetch[cache_key] = datetime.now(timezone.utc)
                return alerts

        except Exception as e:
            logger.error(f"Error fetching IPMA alerts: {e}")
            return []

    async def get_forecast(self, location_id: int) -> List[WeatherForecast]:
        """Get 5-day forecast for a location"""
        cache_key = f"forecast_{location_id}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/forecast/meteorology/cities/daily/{location_id}.json"
                )

                if response.status_code != 200:
                    logger.warning(f"IPMA forecast API error: {response.status_code}")
                    return []

                data = response.json()
                forecasts = []

                location_name = data.get("globalIdLocal", location_id)

                for day_data in data.get("data", []):
                    try:
                        weather_type = day_data.get("idWeatherType", 1)
                        forecast = WeatherForecast(
                            date=day_data.get("forecastDate", ""),
                            location=str(location_name),
                            location_id=location_id,
                            temp_min=float(day_data.get("tMin", 0)),
                            temp_max=float(day_data.get("tMax", 0)),
                            precipitation_prob=float(day_data.get("precipitaProb", 0)),
                            wind_direction=day_data.get("predWindDir", "N"),
                            wind_speed_class=int(day_data.get("classWindSpeed", 1)),
                            weather_type=weather_type,
                            weather_description=WEATHER_TYPES.get(weather_type, "Desconhecido"),
                        )
                        forecasts.append(forecast)
                    except Exception as e:
                        logger.warning(f"Error parsing forecast day: {e}")
                        continue

                self._cache[cache_key] = forecasts
                self._last_fetch[cache_key] = datetime.now(timezone.utc)
                return forecasts

        except Exception as e:
            logger.error(f"Error fetching IPMA forecast: {e}")
            return []

    async def get_fire_risk(self, district_id: Optional[int] = None) -> List[FireRisk]:
        """Get fire risk index for districts"""
        cache_key = "fire_risk"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            data = self._cache[cache_key]
            if district_id:
                return [r for r in data if r.district_id == district_id]
            return data

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Get today's date
                today = datetime.now().strftime("%Y-%m-%d")
                response = await client.get(
                    f"{self.BASE_URL}/forecast/meteorology/rcm/rcm-d0.json"
                )

                if response.status_code != 200:
                    logger.warning(f"IPMA fire risk API error: {response.status_code}")
                    return []

                data = response.json()
                risks = []

                for risk_data in data.get("data", []):
                    try:
                        risk_level = int(risk_data.get("rcm", 1))
                        risk = FireRisk(
                            date=today,
                            region=risk_data.get("dico", ""),
                            district_id=int(risk_data.get("dico", 0)),
                            risk_level=risk_level,
                            risk_name=FIRE_RISK_NAMES.get(risk_level, "Desconhecido"),
                        )
                        risks.append(risk)
                    except Exception as e:
                        logger.warning(f"Error parsing fire risk: {e}")
                        continue

                self._cache[cache_key] = risks
                self._last_fetch[cache_key] = datetime.now(timezone.utc)

                if district_id:
                    return [r for r in risks if r.district_id == district_id]
                return risks

        except Exception as e:
            logger.error(f"Error fetching IPMA fire risk: {e}")
            return []

    async def get_sea_conditions(self, location_id: int) -> Optional[SeaConditions]:
        """Get sea/beach conditions for coastal locations"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.BASE_URL}/forecast/oceanography/daily/hp-daily-sea-forecast-day0.json"
                )

                if response.status_code != 200:
                    return None

                data = response.json()

                for location_data in data.get("data", []):
                    if location_data.get("globalIdLocal") == location_id:
                        return SeaConditions(
                            location=location_data.get("local", ""),
                            location_id=location_id,
                            date=datetime.now().strftime("%Y-%m-%d"),
                            wave_height=location_data.get("sstMax"),
                            wave_direction=location_data.get("predWaveDir", ""),
                            wave_period=location_data.get("wavePeriod"),
                            sea_temp=location_data.get("sst"),
                            wind_direction=location_data.get("predWindDir", ""),
                            wind_speed=location_data.get("classWindSpeed", ""),
                        )

                return None

        except Exception as e:
            logger.error(f"Error fetching sea conditions: {e}")
            return None

    def _map_alert_type(self, type_name: str) -> AlertType:
        """Map IPMA alert type to our enum"""
        type_map = {
            "Vento": AlertType.WIND,
            "Precipitação": AlertType.RAIN,
            "Neve": AlertType.SNOW,
            "Nevoeiro": AlertType.FOG,
            "Tempo quente": AlertType.HEAT,
            "Tempo frio": AlertType.COLD,
            "Agitação Marítima": AlertType.COASTAL,
        }
        return type_map.get(type_name, AlertType.WIND)

    def _map_alert_level(self, level_id: str) -> AlertLevel:
        """Map IPMA alert level to our enum"""
        level_map = {
            "green": AlertLevel.GREEN,
            "yellow": AlertLevel.YELLOW,
            "orange": AlertLevel.ORANGE,
            "red": AlertLevel.RED,
        }
        return level_map.get(level_id.lower(), AlertLevel.GREEN)

    def get_location_id(self, location_name: str) -> Optional[int]:
        """Get IPMA location ID from name"""
        return IPMA_LOCATIONS.get(location_name.lower())

    def get_district_id(self, district_name: str) -> Optional[int]:
        """Get IPMA district ID from name"""
        return IPMA_DISTRICTS.get(district_name.lower())


# Global instance
ipma_service = IPMAService()
