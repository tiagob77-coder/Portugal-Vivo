"""
Marine Weather Service - Real Wave and Weather Data
Uses Open-Meteo Marine API (FREE, no API key required)
"""
import httpx
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import math

logger = logging.getLogger(__name__)


# Portuguese surf spots with coordinates
SURF_SPOTS_PT = {
    "peniche_supertubos": {
        "name": "Peniche - Supertubos",
        "lat": 39.3563,
        "lng": -9.3810,
        "type": "beach_break",
        "best_swell": "NW-W",
        "best_wind": "E-SE",
    },
    "nazare": {
        "name": "Nazaré",
        "lat": 39.6021,
        "lng": -9.0710,
        "type": "big_wave",
        "best_swell": "NW-W",
        "best_wind": "E",
    },
    "ericeira_ribeira": {
        "name": "Ericeira - Ribeira d'Ilhas",
        "lat": 38.9750,
        "lng": -9.4195,
        "type": "point_break",
        "best_swell": "NW-W",
        "best_wind": "E-NE",
    },
    "costa_caparica": {
        "name": "Costa da Caparica",
        "lat": 38.6335,
        "lng": -9.2388,
        "type": "beach_break",
        "best_swell": "W-SW",
        "best_wind": "E-NE",
    },
    "carcavelos": {
        "name": "Carcavelos",
        "lat": 38.6756,
        "lng": -9.3331,
        "type": "beach_break",
        "best_swell": "W-NW",
        "best_wind": "N-NE",
    },
    "sagres": {
        "name": "Sagres - Tonel",
        "lat": 37.0136,
        "lng": -8.9471,
        "type": "beach_break",
        "best_swell": "SW-W",
        "best_wind": "NE",
    },
    "figueira_da_foz": {
        "name": "Figueira da Foz",
        "lat": 40.1486,
        "lng": -8.8691,
        "type": "beach_break",
        "best_swell": "NW-W",
        "best_wind": "E",
    },
    "porto_matosinhos": {
        "name": "Matosinhos",
        "lat": 41.1820,
        "lng": -8.7028,
        "type": "beach_break",
        "best_swell": "NW-W",
        "best_wind": "E-SE",
    },
    "arrifana": {
        "name": "Arrifana",
        "lat": 37.2937,
        "lng": -8.8676,
        "type": "point_break",
        "best_swell": "NW-W",
        "best_wind": "E-NE",
    },
    "santa_cruz": {
        "name": "Santa Cruz",
        "lat": 39.1355,
        "lng": -9.3850,
        "type": "beach_break",
        "best_swell": "NW-W",
        "best_wind": "E",
    },
}


def _degrees_to_cardinal(degrees: float) -> str:
    """Convert degrees to cardinal direction"""
    directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = round(degrees / 22.5) % 16
    return directions[idx]


def _calculate_surf_quality(
    wave_height: float,
    wave_period: float,
    wind_speed: float,
    wave_direction: float,
    spot_info: Dict[str, Any]
) -> str:
    """Calculate surf quality based on conditions"""

    # Base score from wave height (ideal: 1-2m for most spots)
    if spot_info.get("type") == "big_wave":
        height_score = min(wave_height / 3.0, 1.0) if wave_height > 1 else 0.3
    else:
        if wave_height < 0.3:
            height_score = 0.2  # Flat
        elif wave_height < 0.8:
            height_score = 0.6  # Small
        elif wave_height < 1.5:
            height_score = 1.0  # Good
        elif wave_height < 2.5:
            height_score = 0.8  # Big
        else:
            height_score = 0.5  # Too big for beginners

    # Period score (longer is generally better)
    if wave_period < 6:
        period_score = 0.3  # Choppy
    elif wave_period < 10:
        period_score = 0.7  # OK
    elif wave_period < 14:
        period_score = 1.0  # Good
    else:
        period_score = 0.9  # Great swell

    # Wind score (lighter and offshore is better)
    if wind_speed < 10:
        wind_score = 1.0  # Light
    elif wind_speed < 20:
        wind_score = 0.7  # Moderate
    elif wind_speed < 30:
        wind_score = 0.4  # Windy
    else:
        wind_score = 0.2  # Too windy

    # Combined score
    total_score = (height_score * 0.4) + (period_score * 0.3) + (wind_score * 0.3)

    if total_score >= 0.85:
        return "excellent"
    elif total_score >= 0.7:
        return "good"
    elif total_score >= 0.5:
        return "fair"
    elif total_score >= 0.3:
        return "poor"
    else:
        return "flat"


class OpenMeteoMarineService:
    """
    Real marine weather data from Open-Meteo API
    Free, no API key required, high quality data
    """

    BASE_URL = "https://marine-api.open-meteo.com/v1/marine"

    async def get_wave_conditions(
        self,
        lat: float,
        lng: float,
        hours_ahead: int = 24
    ) -> Optional[Dict[str, Any]]:
        """
        Get real wave conditions from Open-Meteo Marine API
        
        Args:
            lat: Latitude
            lng: Longitude
            hours_ahead: Hours of forecast to retrieve
        
        Returns:
            Dictionary with wave conditions
        """
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    self.BASE_URL,
                    params={
                        "latitude": lat,
                        "longitude": lng,
                        "hourly": [
                            "wave_height",
                            "wave_direction",
                            "wave_period",
                            "swell_wave_height",
                            "swell_wave_direction",
                            "swell_wave_period",
                            "wind_wave_height",
                            "wind_wave_direction",
                            "wind_wave_period",
                            "ocean_current_velocity",
                            "ocean_current_direction",
                        ],
                        "current": [
                            "wave_height",
                            "wave_direction",
                            "wave_period",
                        ],
                        "forecast_hours": hours_ahead,
                        "timezone": "Europe/Lisbon"
                    }
                )

                if response.status_code != 200:
                    logger.error(f"Open-Meteo API error: {response.status_code}")
                    return None

                data = response.json()

                # Extract current conditions
                current = data.get("current", {})
                hourly = data.get("hourly", {})

                wave_height = current.get("wave_height", 0)
                wave_direction = current.get("wave_direction", 0)
                wave_period = current.get("wave_period", 0)

                # Find nearest surf spot
                nearest_spot = self._find_nearest_spot(lat, lng)

                # Calculate surf quality
                surf_quality = _calculate_surf_quality(
                    wave_height,
                    wave_period,
                    10,  # Default wind (would need weather API for accurate)
                    wave_direction,
                    nearest_spot or {}
                )

                # Build forecast
                forecast = []
                if hourly and "time" in hourly:
                    times = hourly.get("time", [])[:24]  # Next 24 hours
                    heights = hourly.get("wave_height", [])[:24]
                    directions = hourly.get("wave_direction", [])[:24]
                    periods = hourly.get("wave_period", [])[:24]

                    for i, time in enumerate(times):
                        if i % 3 == 0:  # Every 3 hours
                            forecast.append({
                                "time": time,
                                "wave_height_m": heights[i] if i < len(heights) else None,
                                "wave_direction": _degrees_to_cardinal(directions[i]) if i < len(directions) else None,
                                "wave_period_s": periods[i] if i < len(periods) else None,
                            })

                return {
                    "source": "open-meteo",
                    "api_type": "real",
                    "latitude": lat,
                    "longitude": lng,
                    "nearest_spot": nearest_spot,
                    "current": {
                        "wave_height_m": wave_height,
                        "wave_direction_degrees": wave_direction,
                        "wave_direction_cardinal": _degrees_to_cardinal(wave_direction) if wave_direction else "N/A",
                        "wave_period_s": wave_period,
                        "surf_quality": surf_quality,
                    },
                    "swell": {
                        "height_m": hourly.get("swell_wave_height", [None])[0],
                        "direction_degrees": hourly.get("swell_wave_direction", [None])[0],
                        "period_s": hourly.get("swell_wave_period", [None])[0],
                    },
                    "wind_waves": {
                        "height_m": hourly.get("wind_wave_height", [None])[0],
                        "direction_degrees": hourly.get("wind_wave_direction", [None])[0],
                        "period_s": hourly.get("wind_wave_period", [None])[0],
                    },
                    "forecast_3h": forecast[:8],  # Next 24h in 3h intervals
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "timezone": "Europe/Lisbon"
                }

        except Exception as e:
            logger.error(f"Error fetching wave data: {e}")
            return None

    async def get_surf_spot_conditions(self, spot_id: str) -> Optional[Dict[str, Any]]:
        """Get conditions for a specific surf spot"""
        spot = SURF_SPOTS_PT.get(spot_id)
        if not spot:
            return None

        conditions = await self.get_wave_conditions(spot["lat"], spot["lng"])
        if conditions:
            conditions["spot"] = spot
            conditions["spot_id"] = spot_id

        return conditions

    async def get_all_spots_conditions(self) -> List[Dict[str, Any]]:
        """Get conditions for all Portuguese surf spots"""
        results = []

        for spot_id, spot in SURF_SPOTS_PT.items():
            try:
                conditions = await self.get_wave_conditions(spot["lat"], spot["lng"])
                if conditions:
                    results.append({
                        "spot_id": spot_id,
                        "spot": spot,
                        "wave_height_m": conditions["current"]["wave_height_m"],
                        "wave_period_s": conditions["current"]["wave_period_s"],
                        "wave_direction": conditions["current"]["wave_direction_cardinal"],
                        "surf_quality": conditions["current"]["surf_quality"],
                    })
            except Exception as e:
                logger.error(f"Error fetching {spot_id}: {e}")
                continue

        # Sort by surf quality
        quality_order = {"excellent": 0, "good": 1, "fair": 2, "poor": 3, "flat": 4}
        results.sort(key=lambda x: quality_order.get(x["surf_quality"], 5))

        return results

    def _find_nearest_spot(self, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        """Find nearest surf spot to given coordinates"""
        min_dist = float('inf')
        nearest = None

        for spot_id, spot in SURF_SPOTS_PT.items():
            dist = self._haversine(lat, lng, spot["lat"], spot["lng"])
            if dist < min_dist:
                min_dist = dist
                nearest = {"id": spot_id, **spot, "distance_km": round(dist, 1)}

        return nearest if nearest and min_dist < 50 else None

    def _haversine(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points in km"""
        R = 6371
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lng2 - lng1)

        a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

        return R * c


# Global instance
marine_service = OpenMeteoMarineService()
