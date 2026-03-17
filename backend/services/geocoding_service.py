"""
Unified Geocoding Service
Cascading geocoding with free services first:
  1. Nominatim (OpenStreetMap) - free, general-purpose
  2. GeoAPI.pt - free, Portugal-specific (freguesias, concelhos)
  3. Google Maps - paid fallback, only if API key is available
"""
import logging
import os
from typing import Optional, Dict, Any, List

from services.nominatim_service import NominatimService
from services.geoapi_service import GeoAPIService

logger = logging.getLogger(__name__)


class GeocodingService:
    """
    Unified geocoding interface that cascades through providers:
      Nominatim -> GeoAPI.pt -> Google Maps (if configured).
    """

    def __init__(self, google_maps_api_key: Optional[str] = None):
        self.nominatim = NominatimService()
        self.geoapi = GeoAPIService()
        self.google_api_key = google_maps_api_key or os.environ.get(
            "GOOGLE_MAPS_API_KEY"
        )

    async def geocode(
        self, query: str, country_code: str = "pt"
    ) -> Optional[Dict[str, Any]]:
        """
        Forward geocode a query string to coordinates and address data.

        Tries providers in order: Nominatim -> Google Maps.
        Returns a normalized dict with: lat, lng, display_name, address,
        city, district, country, postal_code, source.
        Returns None if all providers fail.
        """
        # 1. Try Nominatim (free)
        try:
            results = await self.nominatim.forward_geocode(
                query, country_code=country_code, limit=1
            )
            if results:
                hit = results[0]
                result = self._normalize_forward_result(hit, source="nominatim")

                # Enrich with GeoAPI.pt Portugal-specific data if in Portugal
                if hit.get("country_code") == "pt" or country_code == "pt":
                    result = await self._enrich_with_geoapi(result)

                return result
        except Exception as e:
            logger.warning(f"Geocoding: Nominatim forward failed: {e}")

        # 2. Try Google Maps (paid fallback)
        if self.google_api_key:
            try:
                google_result = await self._google_forward_geocode(query)
                if google_result:
                    return google_result
            except Exception as e:
                logger.warning(f"Geocoding: Google Maps forward failed: {e}")

        logger.info(f"Geocoding: all providers failed for query '{query}'")
        return None

    async def reverse_geocode(
        self, lat: float, lng: float
    ) -> Optional[Dict[str, Any]]:
        """
        Reverse geocode coordinates to address data.

        Tries providers in order: Nominatim -> GeoAPI.pt -> Google Maps.
        Returns a normalized dict with: lat, lng, display_name, address,
        city, district, country, postal_code, source, and optionally
        Portugal-specific fields (freguesia, concelho, nuts).
        Returns None if all providers fail.
        """
        # 1. Try Nominatim (free)
        nominatim_result = None
        try:
            nominatim_result = await self.nominatim.reverse_geocode(lat, lng)
        except Exception as e:
            logger.warning(f"Geocoding: Nominatim reverse failed: {e}")

        # 2. Try GeoAPI.pt for Portugal-specific data
        geoapi_result = None
        if self._is_portugal_bbox(lat, lng):
            try:
                geoapi_result = await self.geoapi.reverse_geocode(lat, lng)
            except Exception as e:
                logger.warning(f"Geocoding: GeoAPI reverse failed: {e}")

        # Merge results if we have Nominatim data
        if nominatim_result:
            result = {
                "lat": nominatim_result.get("lat", lat),
                "lng": nominatim_result.get("lng", lng),
                "display_name": nominatim_result.get("display_name", ""),
                "address": nominatim_result.get("address", ""),
                "city": nominatim_result.get("city", ""),
                "district": nominatim_result.get("district", ""),
                "country": nominatim_result.get("country", ""),
                "country_code": nominatim_result.get("country_code", ""),
                "postal_code": nominatim_result.get("postal_code", ""),
                "suburb": nominatim_result.get("suburb", ""),
                "source": "nominatim",
            }

            # Merge GeoAPI Portugal-specific fields
            if geoapi_result:
                result["freguesia"] = geoapi_result.freguesia
                result["concelho"] = geoapi_result.concelho
                result["distrito_pt"] = geoapi_result.distrito
                result["codigo_postal"] = geoapi_result.codigo_postal
                result["nuts_ii"] = geoapi_result.nuts_ii
                result["nuts_iii"] = geoapi_result.nuts_iii
                result["source"] = "nominatim+geoapi"

            return result

        # If Nominatim failed but GeoAPI succeeded, use GeoAPI
        if geoapi_result:
            return {
                "lat": lat,
                "lng": lng,
                "display_name": (
                    f"{geoapi_result.freguesia}, {geoapi_result.concelho}, "
                    f"{geoapi_result.distrito}"
                ),
                "address": "",
                "city": geoapi_result.concelho,
                "district": geoapi_result.distrito,
                "country": "Portugal",
                "country_code": "pt",
                "postal_code": geoapi_result.codigo_postal,
                "freguesia": geoapi_result.freguesia,
                "concelho": geoapi_result.concelho,
                "distrito_pt": geoapi_result.distrito,
                "codigo_postal": geoapi_result.codigo_postal,
                "nuts_ii": geoapi_result.nuts_ii,
                "nuts_iii": geoapi_result.nuts_iii,
                "source": "geoapi",
            }

        # 3. Try Google Maps (paid fallback)
        if self.google_api_key:
            try:
                google_result = await self._google_reverse_geocode(lat, lng)
                if google_result:
                    return google_result
            except Exception as e:
                logger.warning(f"Geocoding: Google Maps reverse failed: {e}")

        logger.info(
            f"Geocoding: all providers failed for ({lat}, {lng})"
        )
        return None

    # ---- Private: Google Maps fallback ----

    async def _google_forward_geocode(
        self, query: str
    ) -> Optional[Dict[str, Any]]:
        """Forward geocode via Google Maps Geocoding API."""
        import httpx

        params = {
            "address": query,
            "key": self.google_api_key,
            "region": "pt",
            "language": "pt",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params=params,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "OK" and data.get("results"):
                    item = data["results"][0]
                    components = self._parse_google_components(item)
                    geo = item.get("geometry", {}).get("location", {})
                    return {
                        "lat": geo.get("lat"),
                        "lng": geo.get("lng"),
                        "display_name": item.get("formatted_address", ""),
                        "address": item.get("formatted_address", ""),
                        "city": components.get("city", ""),
                        "district": components.get("district", ""),
                        "country": components.get("country", ""),
                        "country_code": components.get("country_code", ""),
                        "postal_code": components.get("postal_code", ""),
                        "place_id": item.get("place_id", ""),
                        "source": "google",
                    }
        return None

    async def _google_reverse_geocode(
        self, lat: float, lng: float
    ) -> Optional[Dict[str, Any]]:
        """Reverse geocode via Google Maps Geocoding API."""
        import httpx

        params = {
            "latlng": f"{lat},{lng}",
            "key": self.google_api_key,
            "language": "pt",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params=params,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "OK" and data.get("results"):
                    item = data["results"][0]
                    components = self._parse_google_components(item)
                    return {
                        "lat": lat,
                        "lng": lng,
                        "display_name": item.get("formatted_address", ""),
                        "address": item.get("formatted_address", ""),
                        "city": components.get("city", ""),
                        "district": components.get("district", ""),
                        "country": components.get("country", ""),
                        "country_code": components.get("country_code", ""),
                        "postal_code": components.get("postal_code", ""),
                        "place_id": item.get("place_id", ""),
                        "source": "google",
                    }
        return None

    # ---- Private helpers ----

    @staticmethod
    def _normalize_forward_result(
        hit: Dict[str, Any], source: str
    ) -> Dict[str, Any]:
        """Normalize a Nominatim forward-geocode hit into unified format."""
        return {
            "lat": hit.get("lat"),
            "lng": hit.get("lng"),
            "display_name": hit.get("display_name", ""),
            "address": hit.get("address", ""),
            "city": hit.get("city", ""),
            "district": hit.get("district", ""),
            "country": hit.get("country", ""),
            "country_code": hit.get("country_code", ""),
            "postal_code": hit.get("postal_code", ""),
            "source": source,
        }

    async def _enrich_with_geoapi(
        self, result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Add Portugal-specific GeoAPI.pt data to an existing result."""
        lat = result.get("lat")
        lng = result.get("lng")
        if lat is None or lng is None:
            return result

        try:
            geo = await self.geoapi.reverse_geocode(float(lat), float(lng))
            if geo:
                result["freguesia"] = geo.freguesia
                result["concelho"] = geo.concelho
                result["distrito_pt"] = geo.distrito
                result["codigo_postal"] = geo.codigo_postal
                result["nuts_ii"] = geo.nuts_ii
                result["nuts_iii"] = geo.nuts_iii
                result["source"] = f"{result['source']}+geoapi"
        except Exception as e:
            logger.debug(f"GeoAPI enrichment failed: {e}")

        return result

    @staticmethod
    def _parse_google_components(item: Dict) -> Dict[str, str]:
        """Extract structured address components from a Google result."""
        components: Dict[str, str] = {}
        for comp in item.get("address_components", []):
            types = comp.get("types", [])
            if "locality" in types:
                components["city"] = comp.get("long_name", "")
            elif "administrative_area_level_1" in types:
                components["district"] = comp.get("long_name", "")
            elif "country" in types:
                components["country"] = comp.get("long_name", "")
                components["country_code"] = comp.get("short_name", "").lower()
            elif "postal_code" in types:
                components["postal_code"] = comp.get("long_name", "")
        return components

    @staticmethod
    def _is_portugal_bbox(lat: float, lng: float) -> bool:
        """Check if coordinates fall within Portugal's bounding box."""
        return 36.9 <= lat <= 42.2 and -9.5 <= lng <= -6.1


# Module-level singleton for convenience
geocoding_service = GeocodingService()
