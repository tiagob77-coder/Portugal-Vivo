"""
Nominatim (OpenStreetMap) Geocoding Service
Free geocoding alternative using OpenStreetMap's Nominatim API.
API: https://nominatim.openstreetmap.org

Usage policy: max 1 request per second, custom User-Agent required.
"""
import asyncio
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)


# Portugal bounding box for biasing results
PORTUGAL_VIEWBOX = "-9.5,42.2,-6.1,36.9"  # west,north,east,south
PORTUGAL_COUNTRY_CODE = "pt"


class NominatimService:
    """Service for Nominatim (OpenStreetMap) geocoding"""

    BASE_URL = "https://nominatim.openstreetmap.org"
    USER_AGENT = "PortugalVivo/1.0"

    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = timedelta(hours=24)
        self._last_fetch: Dict[str, datetime] = {}
        self._last_request_time: float = 0.0
        self._rate_limit_lock = asyncio.Lock()

    def _is_cache_valid(self, key: str) -> bool:
        if key not in self._last_fetch:
            return False
        return datetime.now(timezone.utc) - self._last_fetch[key] < self._cache_ttl

    def _set_cache(self, key: str, value: Any) -> None:
        self._cache[key] = value
        self._last_fetch[key] = datetime.now(timezone.utc)

    async def _rate_limit(self) -> None:
        """Enforce Nominatim's 1 request per second policy."""
        async with self._rate_limit_lock:
            now = asyncio.get_event_loop().time()
            elapsed = now - self._last_request_time
            if elapsed < 1.0:
                await asyncio.sleep(1.0 - elapsed)
            self._last_request_time = asyncio.get_event_loop().time()

    def _build_headers(self) -> Dict[str, str]:
        return {
            "User-Agent": self.USER_AGENT,
            "Accept": "application/json",
        }

    async def reverse_geocode(
        self, lat: float, lng: float
    ) -> Optional[Dict[str, Any]]:
        """
        Reverse geocode: coordinates to address.

        Returns dict with: address, city, district, country, postal_code,
        display_name, and raw address components.
        Returns None on failure.
        """
        cache_key = f"nom_rgeo_{lat:.5f}_{lng:.5f}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            await self._rate_limit()
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/reverse",
                    params={
                        "lat": lat,
                        "lon": lng,
                        "format": "jsonv2",
                        "addressdetails": 1,
                        "accept-language": "pt",
                    },
                    headers=self._build_headers(),
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if "error" in data:
                        logger.warning(
                            f"Nominatim reverse geocode returned error: {data['error']}"
                        )
                        return None

                    addr = data.get("address", {})
                    result = {
                        "address": self._build_street_address(addr),
                        "city": (
                            addr.get("city")
                            or addr.get("town")
                            or addr.get("village")
                            or addr.get("municipality")
                            or ""
                        ),
                        "district": addr.get("state_district") or addr.get("state") or "",
                        "country": addr.get("country", ""),
                        "country_code": addr.get("country_code", ""),
                        "postal_code": addr.get("postcode", ""),
                        "display_name": data.get("display_name", ""),
                        "suburb": addr.get("suburb") or addr.get("neighbourhood") or "",
                        "osm_type": data.get("osm_type", ""),
                        "osm_id": data.get("osm_id", ""),
                        "lat": float(data.get("lat", lat)),
                        "lng": float(data.get("lon", lng)),
                        "raw_address": addr,
                    }
                    self._set_cache(cache_key, result)
                    return result
                else:
                    logger.warning(
                        f"Nominatim reverse geocode HTTP {resp.status_code}"
                    )
        except Exception as e:
            logger.warning(f"Nominatim reverse geocode failed: {e}")

        return None

    async def forward_geocode(
        self,
        query: str,
        country_code: str = PORTUGAL_COUNTRY_CODE,
        limit: int = 5,
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Forward geocode: address/name to coordinates.

        Returns list of results, each with: lat, lng, display_name,
        address components, osm metadata.
        Returns None on failure.
        """
        cache_key = f"nom_fgeo_{query.lower().strip()}_{country_code}_{limit}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            await self._rate_limit()
            params = {
                "q": query,
                "format": "jsonv2",
                "addressdetails": 1,
                "limit": limit,
                "accept-language": "pt",
                "viewbox": PORTUGAL_VIEWBOX,
                "bounded": 0,  # Prefer but don't restrict to viewbox
            }
            if country_code:
                params["countrycodes"] = country_code

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/search",
                    params=params,
                    headers=self._build_headers(),
                )
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    for item in data:
                        addr = item.get("address", {})
                        results.append(
                            {
                                "lat": float(item.get("lat", 0)),
                                "lng": float(item.get("lon", 0)),
                                "display_name": item.get("display_name", ""),
                                "type": item.get("type", ""),
                                "category": item.get("category", ""),
                                "importance": item.get("importance", 0),
                                "address": self._build_street_address(addr),
                                "city": (
                                    addr.get("city")
                                    or addr.get("town")
                                    or addr.get("village")
                                    or addr.get("municipality")
                                    or ""
                                ),
                                "district": (
                                    addr.get("state_district")
                                    or addr.get("state")
                                    or ""
                                ),
                                "country": addr.get("country", ""),
                                "country_code": addr.get("country_code", ""),
                                "postal_code": addr.get("postcode", ""),
                                "osm_type": item.get("osm_type", ""),
                                "osm_id": item.get("osm_id", ""),
                                "boundingbox": item.get("boundingbox", []),
                                "raw_address": addr,
                            }
                        )
                    self._set_cache(cache_key, results)
                    return results
                else:
                    logger.warning(
                        f"Nominatim forward geocode HTTP {resp.status_code}"
                    )
        except Exception as e:
            logger.warning(f"Nominatim forward geocode failed: {e}")

        return None

    async def search_pois_by_name(
        self,
        name: str,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radius_km: float = 50,
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Search for named places (POIs) near a location.

        If lat/lng are provided, results are biased towards that area
        within radius_km. Otherwise searches all of Portugal.
        Returns list of results or None on failure.
        """
        cache_key = (
            f"nom_poi_{name.lower().strip()}"
            f"_{lat:.4f}_{lng:.4f}_{radius_km}"
            if lat is not None and lng is not None
            else f"nom_poi_{name.lower().strip()}_pt"
        )
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            await self._rate_limit()
            params = {
                "q": name,
                "format": "jsonv2",
                "addressdetails": 1,
                "limit": 10,
                "accept-language": "pt",
                "countrycodes": PORTUGAL_COUNTRY_CODE,
            }

            # If location is provided, compute a viewbox around it
            if lat is not None and lng is not None:
                # Approximate degrees for the radius
                # 1 degree lat ~ 111km, 1 degree lng ~ 111km * cos(lat)
                import math

                delta_lat = radius_km / 111.0
                delta_lng = radius_km / (111.0 * math.cos(math.radians(lat)))
                viewbox = (
                    f"{lng - delta_lng},{lat + delta_lat},"
                    f"{lng + delta_lng},{lat - delta_lat}"
                )
                params["viewbox"] = viewbox
                params["bounded"] = 0  # Prefer but don't restrict
            else:
                params["viewbox"] = PORTUGAL_VIEWBOX
                params["bounded"] = 0

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/search",
                    params=params,
                    headers=self._build_headers(),
                )
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    for item in data:
                        addr = item.get("address", {})
                        result_lat = float(item.get("lat", 0))
                        result_lng = float(item.get("lon", 0))

                        # If location given, compute distance and filter
                        distance_km = None
                        if lat is not None and lng is not None:
                            distance_km = self._haversine_km(
                                lat, lng, result_lat, result_lng
                            )
                            if distance_km > radius_km:
                                continue

                        results.append(
                            {
                                "name": item.get("name", name),
                                "lat": result_lat,
                                "lng": result_lng,
                                "display_name": item.get("display_name", ""),
                                "type": item.get("type", ""),
                                "category": item.get("category", ""),
                                "importance": item.get("importance", 0),
                                "city": (
                                    addr.get("city")
                                    or addr.get("town")
                                    or addr.get("village")
                                    or ""
                                ),
                                "district": (
                                    addr.get("state_district")
                                    or addr.get("state")
                                    or ""
                                ),
                                "postal_code": addr.get("postcode", ""),
                                "distance_km": distance_km,
                                "osm_type": item.get("osm_type", ""),
                                "osm_id": item.get("osm_id", ""),
                            }
                        )
                    self._set_cache(cache_key, results)
                    return results
                else:
                    logger.warning(
                        f"Nominatim POI search HTTP {resp.status_code}"
                    )
        except Exception as e:
            logger.warning(f"Nominatim POI search failed: {e}")

        return None

    async def batch_geocode(
        self, items: List[Dict[str, Any]]
    ) -> List[Optional[Dict[str, Any]]]:
        """
        Batch geocode a list of items. Each item should have either:
        - 'query' key for forward geocoding, or
        - 'lat' and 'lng' keys for reverse geocoding.

        Respects Nominatim rate limit (1 req/sec).
        Returns a list of results in the same order as input.
        """
        results: List[Optional[Dict[str, Any]]] = []

        for item in items:
            if "lat" in item and "lng" in item:
                result = await self.reverse_geocode(item["lat"], item["lng"])
                results.append(result)
            elif "query" in item:
                fwd = await self.forward_geocode(
                    item["query"],
                    country_code=item.get("country_code", PORTUGAL_COUNTRY_CODE),
                    limit=1,
                )
                results.append(fwd[0] if fwd else None)
            else:
                logger.warning(
                    f"Batch geocode: item missing 'query' or 'lat'/'lng': {item}"
                )
                results.append(None)

        return results

    async def enrich_poi_address(
        self, poi: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Given a POI dict with 'lat' and 'lng', enrich it with detailed
        address data from Nominatim reverse geocoding.

        Returns an enriched copy of the POI dict, or None on failure.
        The original dict is not modified.
        """
        lat = poi.get("lat") or poi.get("latitude")
        lng = poi.get("lng") or poi.get("lon") or poi.get("longitude")

        if lat is None or lng is None:
            logger.warning("enrich_poi_address: POI missing lat/lng")
            return None

        geocoded = await self.reverse_geocode(float(lat), float(lng))
        if not geocoded:
            return None

        enriched = dict(poi)
        enriched["nominatim_address"] = geocoded.get("address", "")
        enriched["nominatim_city"] = geocoded.get("city", "")
        enriched["nominatim_district"] = geocoded.get("district", "")
        enriched["nominatim_country"] = geocoded.get("country", "")
        enriched["nominatim_postal_code"] = geocoded.get("postal_code", "")
        enriched["nominatim_display_name"] = geocoded.get("display_name", "")
        enriched["nominatim_suburb"] = geocoded.get("suburb", "")
        enriched["nominatim_raw"] = geocoded.get("raw_address", {})

        return enriched

    # ---- Private helpers ----

    @staticmethod
    def _build_street_address(addr: Dict[str, str]) -> str:
        """Build a street-level address string from Nominatim address parts."""
        parts = []
        road = addr.get("road", "")
        if road:
            house = addr.get("house_number", "")
            parts.append(f"{road} {house}".strip() if house else road)
        suburb = addr.get("suburb") or addr.get("neighbourhood") or ""
        if suburb and not road:
            parts.append(suburb)
        city = (
            addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or ""
        )
        if city:
            parts.append(city)
        postcode = addr.get("postcode", "")
        if postcode:
            parts.append(postcode)
        return ", ".join(parts)

    @staticmethod
    def _haversine_km(
        lat1: float, lng1: float, lat2: float, lng2: float
    ) -> float:
        """Calculate distance between two coordinates in kilometers."""
        from math import radians, sin, cos, sqrt, atan2

        R = 6371.0  # Earth radius in km
        lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return R * c


# Module-level singleton for convenience
nominatim_service = NominatimService()
