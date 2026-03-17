"""
IQ Engine - Módulo 5: Address Normalization
Normalização de moradas via Google Maps API
"""
from typing import Dict, Optional
import logging
import httpx
from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData
)
import os

logger = logging.getLogger(__name__)

class AddressNormalizationModule(IQModule):
    """
    Módulo 5: Address Normalization
    
    Normaliza moradas usando Google Maps Geocoding API:
    - Valida formato de morada
    - Obtém componentes estruturados (rua, número, CP, cidade, distrito)
    - Verifica coordenadas
    - Corrige erros ortográficos
    """

    def __init__(self, api_key: Optional[str] = None):
        super().__init__(ModuleType.ADDRESS_NORMALIZATION)
        self.api_key = api_key or os.environ.get('GOOGLE_MAPS_API_KEY')
        self.geocoding_url = "https://maps.googleapis.com/maps/api/geocode/json"

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """Normalize address via Google Maps API"""

        issues = []
        warnings = []
        address_data = {}

        # Check if address exists
        if not data.address:
            issues.append("Morada não fornecida")
            return ProcessingResult(
                module=self.module_type,
                status=ProcessingStatus.REQUIRES_REVIEW,
                score=0,
                confidence=0.0,
                data={"has_address": False},
                issues=issues
            )

        address_data["original_address"] = data.address
        address_data["has_address"] = True

        # Check if API key is available
        if not self.api_key:
            warnings.append("Google Maps API key não configurada - normalização limitada")
            # Do basic validation without API
            basic_validation = self._basic_address_validation(data.address)
            address_data.update(basic_validation)

            score = 40 if basic_validation.get("appears_valid") else 20

            return ProcessingResult(
                module=self.module_type,
                status=ProcessingStatus.REQUIRES_REVIEW,
                score=score,
                confidence=0.5,
                data=address_data,
                issues=issues,
                warnings=warnings
            )

        # Call Google Maps Geocoding API
        try:
            geocode_result = await self._geocode_address(data.address, data.location)
            address_data.update(geocode_result)

            # Score based on results
            score = self._calculate_address_score(geocode_result)

            # Check for issues
            if not geocode_result.get("geocoded"):
                issues.append("Morada não encontrada no Google Maps")

            # Check coordinate accuracy
            if data.location and geocode_result.get("geocoded"):
                distance = self._calculate_distance(
                    data.location,
                    geocode_result.get("geocoded_location")
                )
                address_data["distance_from_provided"] = distance

                if distance > 1000:  # More than 1km difference
                    warnings.append(f"Coordenadas diferem {distance:.0f}m da morada")

            status = ProcessingStatus.COMPLETED if score >= 70 else ProcessingStatus.REQUIRES_REVIEW

            return ProcessingResult(
                module=self.module_type,
                status=status,
                score=score,
                confidence=0.9 if geocode_result.get("geocoded") else 0.3,
                data=address_data,
                issues=issues,
                warnings=warnings
            )

        except Exception as e:
            logger.error(f"Error in address normalization: {e}")
            issues.append(f"Erro na normalização: {str(e)}")
            return ProcessingResult(
                module=self.module_type,
                status=ProcessingStatus.FAILED,
                score=20,
                confidence=0.0,
                data=address_data,
                issues=issues
            )

    def _basic_address_validation(self, address: str) -> Dict:
        """Basic address validation without API"""
        import re

        result = {
            "appears_valid": False,
            "has_postal_code": False,
            "has_city": False,
            "estimated_completeness": 0
        }

        # Check for postal code pattern (XXXX-XXX)
        postal_pattern = r'\d{4}-\d{3}'
        if re.search(postal_pattern, address):
            result["has_postal_code"] = True
            result["estimated_completeness"] += 30

        # Check for common Portuguese city names
        cities = ["lisboa", "porto", "braga", "coimbra", "faro", "évora", "guimarães"]
        if any(city in address.lower() for city in cities):
            result["has_city"] = True
            result["estimated_completeness"] += 30

        # Check for street indicators
        street_indicators = ["rua", "av", "avenida", "praça", "largo", "estrada"]
        if any(ind in address.lower() for ind in street_indicators):
            result["estimated_completeness"] += 40

        result["appears_valid"] = result["estimated_completeness"] >= 60

        return result

    async def _geocode_address(self, address: str, location: Optional[Dict]) -> Dict:
        """Geocode address using Google Maps API"""
        params = {
            "address": address,
            "key": self.api_key,
            "region": "pt",  # Bias towards Portugal
            "language": "pt"
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(self.geocoding_url, params=params)
                response.raise_for_status()
                data = response.json()

                if data.get("status") == "OK" and data.get("results"):
                    result = data["results"][0]

                    # Extract components
                    components = {}
                    for comp in result.get("address_components", []):
                        types = comp.get("types", [])
                        if "street_number" in types:
                            components["street_number"] = comp.get("long_name")
                        elif "route" in types:
                            components["street"] = comp.get("long_name")
                        elif "postal_code" in types:
                            components["postal_code"] = comp.get("long_name")
                        elif "locality" in types:
                            components["city"] = comp.get("long_name")
                        elif "administrative_area_level_1" in types:
                            components["district"] = comp.get("long_name")
                        elif "country" in types:
                            components["country"] = comp.get("long_name")

                    geometry = result.get("geometry", {})
                    location_data = geometry.get("location", {})

                    return {
                        "geocoded": True,
                        "formatted_address": result.get("formatted_address"),
                        "components": components,
                        "geocoded_location": {
                            "lat": location_data.get("lat"),
                            "lng": location_data.get("lng")
                        },
                        "location_type": geometry.get("location_type"),
                        "place_id": result.get("place_id")
                    }

                return {
                    "geocoded": False,
                    "error": data.get("status"),
                    "error_message": data.get("error_message")
                }

        except Exception as e:
            logger.error(f"Geocoding API error: {e}")
            return {
                "geocoded": False,
                "error": str(e)
            }

    def _calculate_address_score(self, result: Dict) -> float:
        """Calculate address quality score"""
        if not result.get("geocoded"):
            return 20

        score = 50  # Base score for successful geocoding

        components = result.get("components", {})

        # Award points for complete components
        if components.get("street"):
            score += 10
        if components.get("street_number"):
            score += 10
        if components.get("postal_code"):
            score += 15
        if components.get("city"):
            score += 10
        if components.get("district"):
            score += 5

        # Location type quality
        location_type = result.get("location_type", "")
        if location_type == "ROOFTOP":
            score += 10  # Most precise
        elif location_type == "RANGE_INTERPOLATED":
            score += 5

        return min(100, score)

    def _calculate_distance(self, loc1: Dict, loc2: Dict) -> float:
        """Calculate distance between two coordinates in meters"""
        from math import radians, sin, cos, sqrt, atan2

        # Extract lat/lng (handle different formats)
        if isinstance(loc1, dict):
            if 'lat' in loc1 and 'lng' in loc1:
                lat1, lon1 = loc1['lat'], loc1['lng']
            elif 'coordinates' in loc1:
                lon1, lat1 = loc1['coordinates']  # GeoJSON format
            else:
                return 0
        else:
            return 0

        if isinstance(loc2, dict):
            lat2, lon2 = loc2.get('lat', 0), loc2.get('lng', 0)
        else:
            return 0

        # Haversine formula
        R = 6371000  # Earth radius in meters

        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))

        return R * c
