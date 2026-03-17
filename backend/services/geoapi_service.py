"""
GeoAPI.pt Service - API geográfica de Portugal
API: https://geoapi.pt
Provides geographic data: freguesias, concelhos, distritos, códigos postais
"""
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class GeoLocation(BaseModel):
    lat: float
    lng: float
    freguesia: str = ""
    concelho: str = ""
    distrito: str = ""
    codigo_postal: str = ""
    nuts_ii: str = ""
    nuts_iii: str = ""


class Municipality(BaseModel):
    name: str
    distrito: str
    area_km2: Optional[float] = None
    population: Optional[int] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    codigo: str = ""


class GeoAPIService:
    """Service for GeoAPI.pt geographic data"""

    BASE_URL = "https://geoapi.pt"

    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = timedelta(hours=24)
        self._last_fetch: Dict[str, datetime] = {}

    def _is_cache_valid(self, key: str) -> bool:
        if key not in self._last_fetch:
            return False
        return datetime.now(timezone.utc) - self._last_fetch[key] < self._cache_ttl

    async def reverse_geocode(self, lat: float, lng: float) -> Optional[GeoLocation]:
        """Reverse geocode: coordinates -> freguesia/concelho/distrito"""
        cache_key = f"rgeo_{lat:.4f}_{lng:.4f}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/gps/{lat},{lng}",
                    headers={"Accept": "application/json"}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    result = GeoLocation(
                        lat=lat,
                        lng=lng,
                        freguesia=data.get("freguesia", ""),
                        concelho=data.get("concelho", ""),
                        distrito=data.get("distrito", ""),
                        codigo_postal=data.get("CP", ""),
                        nuts_ii=data.get("NUTSII", ""),
                        nuts_iii=data.get("NUTSIII", ""),
                    )
                    self._cache[cache_key] = result
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return result
        except Exception as e:
            logger.warning(f"GeoAPI reverse geocode failed: {e}")

        return None

    async def get_municipality_info(self, concelho: str) -> Optional[Dict]:
        """Get municipality information"""
        cache_key = f"mun_{concelho.lower()}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/municipio/{concelho}",
                    headers={"Accept": "application/json"}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    result = {
                        "name": data.get("nome", concelho),
                        "distrito": data.get("distrito", ""),
                        "area_km2": data.get("area", None),
                        "population": data.get("populacao", None),
                        "nif": data.get("nif", ""),
                        "codigo": data.get("codigo", ""),
                        "freguesias": data.get("freguesias", []),
                    }
                    self._cache[cache_key] = result
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return result
        except Exception as e:
            logger.warning(f"GeoAPI municipality failed: {e}")

        return None

    async def search_postal_code(self, cp: str) -> Optional[Dict]:
        """Search by postal code (ex: 1000-001)"""
        cache_key = f"cp_{cp}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/cp/{cp}",
                    headers={"Accept": "application/json"}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    result = {
                        "codigo_postal": cp,
                        "localidade": data.get("Localidade", ""),
                        "concelho": data.get("Concelho", ""),
                        "distrito": data.get("Distrito", ""),
                        "lat": data.get("lat"),
                        "lng": data.get("lng"),
                        "ruas": data.get("ruas", []),
                    }
                    self._cache[cache_key] = result
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return result
        except Exception as e:
            logger.warning(f"GeoAPI postal code failed: {e}")

        return None

    async def get_distrito_info(self, distrito: str) -> Optional[Dict]:
        """Get district information with municipalities"""
        cache_key = f"dist_{distrito.lower()}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/distrito/{distrito}",
                    headers={"Accept": "application/json"}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    result = {
                        "name": data.get("nome", distrito),
                        "municipios": data.get("municipios", []),
                    }
                    self._cache[cache_key] = result
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return result
        except Exception as e:
            logger.warning(f"GeoAPI distrito failed: {e}")

        return None
