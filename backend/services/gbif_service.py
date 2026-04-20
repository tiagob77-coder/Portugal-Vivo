"""
GBIF Service - Global Biodiversity Information Facility (Portugal)
API: https://api.gbif.org/v1/
Provides species occurrence data for Portuguese fauna and flora
"""
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

logger = logging.getLogger(__name__)

PORTUGAL_COUNTRY_CODE = "PT"
PORTUGAL_PUBLISHING_ORG_KEY = "1cd669d0-80ea-11de-a9d0-f1765f95f18b"  # GBIF Portugal public org UUID — not a secret  # gitleaks:allow


class SpeciesOccurrence(BaseModel):
    key: int
    species: str
    scientific_name: str
    common_name: str = ""
    kingdom: str = ""
    phylum: str = ""
    class_name: str = ""
    order: str = ""
    family: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    locality: str = ""
    event_date: str = ""
    basis_of_record: str = ""
    dataset_name: str = ""
    image_url: str = ""
    iucn_status: str = ""


class SpeciesSummary(BaseModel):
    taxon_key: int
    scientific_name: str
    common_name: str = ""
    kingdom: str = ""
    occurrence_count: int = 0
    image_url: str = ""
    iucn_status: str = ""


# Notable Portuguese species for quick reference
NOTABLE_PT_SPECIES = [
    {"name": "Lince-ibérico", "scientific": "Lynx pardinus", "taxon_key": 2435240,
     "iucn": "EN", "habitat": "Matos mediterrânicos", "regions": ["Alentejo", "Algarve"]},
    {"name": "Lobo-ibérico", "scientific": "Canis lupus signatus", "taxon_key": 5219173,
     "iucn": "EN", "habitat": "Montanha", "regions": ["Trás-os-Montes", "Minho"]},
    {"name": "Águia-imperial-ibérica", "scientific": "Aquila adalberti", "taxon_key": 2480583,
     "iucn": "VU", "habitat": "Montado e estepe", "regions": ["Alentejo", "Beira Baixa"]},
    {"name": "Abetarda", "scientific": "Otis tarda", "taxon_key": 2474938,
     "iucn": "VU", "habitat": "Estepe cerealífera", "regions": ["Castro Verde", "Alentejo"]},
    {"name": "Cegonha-preta", "scientific": "Ciconia nigra", "taxon_key": 2481910,
     "iucn": "LC", "habitat": "Vales fluviais", "regions": ["Tejo Internacional", "Douro"]},
    {"name": "Golfinho-roaz", "scientific": "Tursiops truncatus", "taxon_key": 2440752,
     "iucn": "LC", "habitat": "Estuários", "regions": ["Sado", "Tejo"]},
    {"name": "Camaleão-comum", "scientific": "Chamaeleo chamaeleon", "taxon_key": 2459006,
     "iucn": "LC", "habitat": "Dunas e pinhais", "regions": ["Algarve", "Costa Vicentina"]},
    {"name": "Salamandra-lusitânica", "scientific": "Chioglossa lusitanica", "taxon_key": 2431886,
     "iucn": "VU", "habitat": "Bosques húmidos", "regions": ["Minho", "Gerês"]},
    {"name": "Cabra-montês", "scientific": "Capra pyrenaica", "taxon_key": 2441035,
     "iucn": "LC", "habitat": "Montanha rochosa", "regions": ["Gerês"]},
    {"name": "Cavalinho-marinho", "scientific": "Hippocampus hippocampus", "taxon_key": 2394288,
     "iucn": "DD", "habitat": "Zona costeira", "regions": ["Ria Formosa"]},
    {"name": "Sobreiro", "scientific": "Quercus suber", "taxon_key": 2878688,
     "iucn": "LC", "habitat": "Montado", "regions": ["Alentejo", "Algarve"]},
    {"name": "Sardinheira-da-berlenga", "scientific": "Berberis maderensis", "taxon_key": 3034733,
     "iucn": "EN", "habitat": "Insular", "regions": ["Berlengas"]},
    {"name": "Narciso-do-Gerês", "scientific": "Narcissus pseudonarcissus", "taxon_key": 2856350,
     "iucn": "LC", "habitat": "Prados de altitude", "regions": ["Gerês", "Estrela"]},
    {"name": "Azinheira", "scientific": "Quercus rotundifolia", "taxon_key": 7928917,
     "iucn": "LC", "habitat": "Montado", "regions": ["Alentejo", "Trás-os-Montes"]},
]


class GBIFService:
    """Service for GBIF biodiversity data in Portugal"""

    BASE_URL = "https://api.gbif.org/v1"

    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = timedelta(hours=2)
        self._last_fetch: Dict[str, datetime] = {}

    def _is_cache_valid(self, key: str) -> bool:
        if key not in self._last_fetch:
            return False
        return datetime.now(timezone.utc) - self._last_fetch[key] < self._cache_ttl

    async def search_species_near(self, lat: float, lng: float,
                                   radius_km: float = 10.0,
                                   limit: int = 20) -> List[Dict]:
        """Search GBIF occurrences near a coordinate"""
        cache_key = f"occ_{lat:.2f}_{lng:.2f}_{radius_km}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        # Convert km to degrees (approximate)
        decimal_degrees = str(round(radius_km / 111.0, 3))

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/occurrence/search",
                    params={
                        "country": PORTUGAL_COUNTRY_CODE,
                        "decimalLatitude": f"{lat - float(decimal_degrees)},{lat + float(decimal_degrees)}",
                        "decimalLongitude": f"{lng - float(decimal_degrees)},{lng + float(decimal_degrees)}",
                        "hasCoordinate": "true",
                        "hasGeospatialIssue": "false",
                        "limit": limit,
                        "offset": 0,
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    seen_species = set()
                    for r in data.get("results", []):
                        species = r.get("species", r.get("scientificName", ""))
                        if species in seen_species:
                            continue
                        seen_species.add(species)
                        results.append({
                            "key": r.get("key"),
                            "species": species,
                            "scientific_name": r.get("scientificName", ""),
                            "kingdom": r.get("kingdom", ""),
                            "phylum": r.get("phylum", ""),
                            "class": r.get("class", ""),
                            "order": r.get("order", ""),
                            "family": r.get("family", ""),
                            "lat": r.get("decimalLatitude"),
                            "lng": r.get("decimalLongitude"),
                            "locality": r.get("locality", ""),
                            "event_date": r.get("eventDate", ""),
                            "basis_of_record": r.get("basisOfRecord", ""),
                            "dataset_name": r.get("datasetName", ""),
                        })
                    self._cache[cache_key] = results
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return results
        except Exception as e:
            logger.warning(f"GBIF search failed: {e}")

        return []

    async def get_species_count_by_area(self, lat: float, lng: float,
                                         radius_km: float = 10.0) -> Dict:
        """Get species count summary for an area"""
        cache_key = f"count_{lat:.2f}_{lng:.2f}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        dd = round(radius_km / 111.0, 3)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/occurrence/search",
                    params={
                        "country": PORTUGAL_COUNTRY_CODE,
                        "decimalLatitude": f"{lat - dd},{lat + dd}",
                        "decimalLongitude": f"{lng - dd},{lng + dd}",
                        "hasCoordinate": "true",
                        "limit": 0,
                        "facet": "kingdom",
                        "facetLimit": 10,
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    result = {
                        "total_occurrences": data.get("count", 0),
                        "location": {"lat": lat, "lng": lng, "radius_km": radius_km},
                        "kingdoms": {},
                    }
                    for facet in data.get("facets", []):
                        if facet.get("field") == "KINGDOM":
                            for count in facet.get("counts", []):
                                result["kingdoms"][count["name"]] = count["count"]
                    self._cache[cache_key] = result
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return result
        except Exception as e:
            logger.warning(f"GBIF count failed: {e}")

        return {"total_occurrences": 0, "location": {"lat": lat, "lng": lng}, "kingdoms": {}}

    def get_notable_species(self, region: Optional[str] = None) -> List[Dict]:
        """Get notable Portuguese species, optionally filtered by region"""
        species = NOTABLE_PT_SPECIES
        if region:
            region_lower = region.lower()
            species = [s for s in species if any(region_lower in r.lower() for r in s["regions"])]
        return species

    async def get_species_details(self, taxon_key: int) -> Optional[Dict]:
        """Get details for a specific species from GBIF"""
        cache_key = f"species_{taxon_key}"
        if self._is_cache_valid(cache_key) and cache_key in self._cache:
            return self._cache[cache_key]

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.BASE_URL}/species/{taxon_key}")
                if resp.status_code == 200:
                    data = resp.json()
                    # Also get media
                    media_resp = await client.get(f"{self.BASE_URL}/species/{taxon_key}/media")
                    images = []
                    if media_resp.status_code == 200:
                        for m in media_resp.json().get("results", [])[:3]:
                            if m.get("identifier"):
                                images.append(m["identifier"])

                    result = {
                        "taxon_key": data.get("key"),
                        "scientific_name": data.get("scientificName", ""),
                        "canonical_name": data.get("canonicalName", ""),
                        "kingdom": data.get("kingdom", ""),
                        "phylum": data.get("phylum", ""),
                        "class": data.get("class", ""),
                        "order": data.get("order", ""),
                        "family": data.get("family", ""),
                        "genus": data.get("genus", ""),
                        "taxonomic_status": data.get("taxonomicStatus", ""),
                        "images": images,
                    }
                    self._cache[cache_key] = result
                    self._last_fetch[cache_key] = datetime.now(timezone.utc)
                    return result
        except Exception as e:
            logger.warning(f"GBIF species detail failed: {e}")

        return None
