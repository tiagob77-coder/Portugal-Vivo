"""
Spatial Cross-Reference Service
Connects events, transport, trails, protected areas, and biodiversity
This is the core integration engine for the sustainable tourism platform
"""
import logging
from typing import List, Dict, Any
from math import radians, sin, cos, sqrt, atan2

from services.icnf_service import ICNFService
from services.gbif_service import GBIFService
from services.geoapi_service import GeoAPIService
from services.overpass_service import OverpassService
from services.gtfs_service import GTFSTransportService
from services.ipma_service import IPMAService
from services.fogos_service import FogosService

logger = logging.getLogger(__name__)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


class SpatialCrossRefService:
    """
    Cross-references spatial data from multiple sources:
    - Event location (Agenda Viral) <-> Protected areas (ICNF)
    - Event location <-> Transport (GTFS/Metro/CP)
    - Trail coordinates <-> Weather (IPMA)
    - Biodiversity stations <-> Trails
    """

    def __init__(self):
        self.icnf = ICNFService()
        self.gbif = GBIFService()
        self.geoapi = GeoAPIService()
        self.overpass = OverpassService()
        self.transport = GTFSTransportService()
        self.ipma = IPMAService()
        self.fogos = FogosService()

    async def enrich_event_location(self, lat: float, lng: float,
                                     event_name: str = "") -> Dict[str, Any]:
        """
        Given an event location, find:
        1. Nearest protected area
        2. Nearest biodiversity station
        3. Nearest transport stops
        4. Nearby trails
        5. Weather alerts for the area
        6. Geographic context (concelho/distrito)
        """
        result = {
            "event": {"name": event_name, "lat": lat, "lng": lng},
            "protected_area": None,
            "biodiversity_station": None,
            "transport": [],
            "trails": [],
            "weather_alerts": [],
            "geo_context": None,
            "nature_suggestions": [],
        }

        # 1. Nearest protected area
        pa = self.icnf.get_nearest_protected_area(lat, lng)
        if pa:
            result["protected_area"] = pa

        # 2. Nearest biodiversity station
        bs = self.icnf.get_nearest_biodiversity_station(lat, lng)
        if bs:
            result["biodiversity_station"] = bs

        # 3. Nearby transport
        stops = self.transport.find_nearest_stops(lat, lng, radius_km=5.0)
        result["transport"] = stops[:5]

        # 4. Nearby trails (long-distance)
        trail = self.overpass.get_nearest_long_trail(lat, lng)
        if trail:
            result["trails"].append(trail)

        # 5. Natura 2000 sites nearby
        natura = self.icnf.get_natura2000_sites(lat, lng, radius_km=30.0)
        if natura:
            result["natura2000_nearby"] = natura[:3]

        # 6. Geographic context
        geo = await self.geoapi.reverse_geocode(lat, lng)
        if geo:
            result["geo_context"] = geo.model_dump()

        # 7. Nature suggestions for "next day" itinerary
        result["nature_suggestions"] = self._generate_nature_suggestions(
            lat, lng, pa, bs, trail
        )

        return result

    async def plan_event_to_nature(self, event_lat: float, event_lng: float,
                                    event_name: str = "") -> Dict[str, Any]:
        """
        User Flow: Concert at event -> next day biodiversity visit using public transport
        Returns a suggested itinerary linking event, nature, and transport
        """
        enriched = await self.enrich_event_location(event_lat, event_lng, event_name)

        itinerary = {
            "event": enriched["event"],
            "day_1_evening": {
                "activity": event_name or "Evento cultural",
                "location": {"lat": event_lat, "lng": event_lng},
                "transport_to_event": enriched["transport"][:3],
            },
            "day_2_morning": None,
            "transport_between": None,
        }

        # Find best nature destination for day 2
        best_nature = None
        best_nature_lat = None
        best_nature_lng = None

        if enriched.get("biodiversity_station"):
            bs = enriched["biodiversity_station"]
            if bs["distance_km"] < 80:
                best_nature = {
                    "type": "biodiversity_station",
                    "name": bs["station"]["name"],
                    "distance_from_event_km": bs["distance_km"],
                    "highlights": bs["station"].get("highlights", []),
                    "habitat": bs["station"].get("habitat_type", ""),
                    "species_count": bs["station"].get("species_count"),
                }
                best_nature_lat = bs["station"]["lat"]
                best_nature_lng = bs["station"]["lng"]

        if not best_nature and enriched.get("protected_area"):
            pa = enriched["protected_area"]
            if pa["distance_km"] < 100:
                area = pa["area"]
                best_nature = {
                    "type": "protected_area",
                    "name": area["name"],
                    "designation": area["designation"],
                    "distance_from_event_km": pa["distance_km"],
                    "description": area.get("description", ""),
                }
                best_nature_lat = area.get("lat")
                best_nature_lng = area.get("lng")

        if best_nature and best_nature_lat and best_nature_lng:
            itinerary["day_2_morning"] = {
                "activity": f"Visita a {best_nature['name']}",
                "nature_destination": best_nature,
                "location": {"lat": best_nature_lat, "lng": best_nature_lng},
            }

            # Transport from event area to nature destination
            route = self.transport.plan_route_to_destination(
                event_lat, event_lng,
                best_nature_lat, best_nature_lng
            )
            itinerary["transport_between"] = route

            # Notable species at destination
            species = self.gbif.get_notable_species()
            # Filter by region if we have geo_context
            if enriched.get("geo_context"):
                distrito = enriched["geo_context"].get("distrito", "")
                if distrito:
                    species = [s for s in species
                               if any(distrito.lower() in r.lower() for r in s.get("regions", []))]
            itinerary["day_2_morning"]["notable_species"] = species[:5]

        itinerary["sustainability_tips"] = [
            "Use transportes públicos para reduzir a pegada de carbono",
            "Respeite as regras das áreas protegidas - não saia dos trilhos marcados",
            "Leve o lixo consigo e minimize o impacto ambiental",
            "Prefira alojamento local e gastronomia regional",
            "Partilhe a sua experiência para promover o turismo sustentável",
        ]

        return itinerary

    def find_trails_near_protected_area(self, area_id: str) -> Dict:
        """Find trails associated with a protected area"""
        areas = {a.id: a for a in self.icnf.get_protected_areas()}
        area = areas.get(area_id)
        if not area or not area.lat or not area.lng:
            return {"error": "Area not found"}

        trail = self.overpass.get_nearest_long_trail(area.lat, area.lng)
        biodiversity = self.icnf.get_biodiversity_stations(area.lat, area.lng, radius_km=30.0)

        return {
            "protected_area": area.model_dump(),
            "nearest_long_trail": trail,
            "biodiversity_stations": biodiversity[:3],
            "transport": self.transport.find_nearest_stops(area.lat, area.lng, radius_km=10.0)[:5],
        }

    async def get_trail_safety_info(self, lat: float, lng: float) -> Dict:
        """Get weather/safety info for a trail coordinate, including fire risk"""
        alerts = await self.ipma.get_weather_alerts()
        trail_alerts = []

        for alert in alerts:
            trail_alerts.append({
                "type": alert.type.value if hasattr(alert.type, 'value') else str(alert.type),
                "level": alert.level.value if hasattr(alert.level, 'value') else str(alert.level),
                "region": alert.region,
                "title": alert.title,
                "description": alert.description,
            })

        # Fire data from fogos.pt
        fire_warnings = []
        try:
            nearby_fires = await self.fogos.get_fires_near_location(lat, lng, radius_km=30)
            for fire in nearby_fires:
                fire_warnings.append({
                    "type": "fire",
                    "level": "red" if fire.importance.value == "important" else "orange",
                    "district": fire.district,
                    "municipality": fire.municipality,
                    "status": fire.status.value,
                    "distance_km": getattr(fire, "distance_km", None),
                    "firefighters": fire.firefighters,
                    "description": f"Incêndio {fire.status.value} em {fire.municipality} ({fire.nature})",
                })
        except Exception as e:
            logger.warning(f"Failed to fetch fire data: {e}")

        # Fire risk from IPMA
        fire_risk = []
        try:
            risk_data = await self.ipma.get_fire_risk()
            if risk_data:
                for risk in risk_data:
                    if risk.risk_level >= 4:
                        fire_risk.append({
                            "district": risk.region,
                            "risk_level": risk.risk_level,
                            "risk_name": risk.risk_name,
                        })
        except Exception:
            pass

        # Natura2000 / protected area rules
        nearby_pa = self.icnf.get_nearest_protected_area(lat, lng)
        rules = []
        if nearby_pa and nearby_pa["distance_km"] < 5:
            rules = [
                "Está dentro ou próximo de uma área protegida",
                "Mantenha-se nos trilhos assinalados",
                "Não faça lume nem acampe fora dos locais designados",
                "Respeite a fauna e flora - não recolha espécies",
                f"Área: {nearby_pa['area']['name']}",
            ]

        # Overall safety level
        safety_level = "green"
        if fire_warnings:
            safety_level = "red"
        elif fire_risk:
            safety_level = "orange"
        elif trail_alerts:
            max_level = max((a["level"] for a in trail_alerts), default="green")
            if max_level in ("red", "orange"):
                safety_level = max_level

        return {
            "location": {"lat": lat, "lng": lng},
            "safety_level": safety_level,
            "weather_alerts": trail_alerts,
            "fire_warnings": fire_warnings,
            "fire_risk": fire_risk,
            "protected_area_rules": rules,
            "nearby_protected_area": nearby_pa,
        }

    def _generate_nature_suggestions(self, lat: float, lng: float,
                                      pa, bs, trail) -> List[Dict]:
        """Generate contextual nature suggestions based on nearby features"""
        suggestions = []

        if bs and bs.get("distance_km", 999) < 50:
            station = bs["station"]
            suggestions.append({
                "type": "biodiversity_visit",
                "title": f"Visite a {station['name']}",
                "description": f"A {bs['distance_km']}km, com {station.get('species_count', 'várias')} espécies registadas",
                "highlights": station.get("highlights", []),
                "distance_km": bs["distance_km"],
                "priority": 1,
            })

        if pa and pa.get("distance_km", 999) < 60:
            area = pa["area"]
            suggestions.append({
                "type": "protected_area_visit",
                "title": f"Explore {area['name']}",
                "description": area.get("description", ""),
                "designation": area["designation"],
                "distance_km": pa["distance_km"],
                "priority": 2,
            })

        if trail and trail.get("distance_km", 999) < 40:
            t = trail["trail"]
            suggestions.append({
                "type": "trail_walk",
                "title": f"Caminhe no {t['name']}",
                "description": t.get("description", ""),
                "difficulty": t.get("difficulty", "moderado"),
                "trail_distance_km": t.get("distance_km", 0),
                "distance_km": trail["distance_km"],
                "priority": 3,
            })

        suggestions.sort(key=lambda x: x["priority"])
        return suggestions
