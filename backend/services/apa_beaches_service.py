"""
APA Beaches Service — Qualidade da Água e Bandeira Azul
Sources:
  - SNIAmb / APA API: https://sniambiente.apambiente.pt
  - Bandeira Azul (ABAE): lista curada 2026
Cache TTL: 4 horas (dados de qualidade não mudam com frequência)
"""
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Bandeira Azul 2026 — lista curada das praias certificadas
# Fonte: bandeiraazul.abae.pt — auditoria anual publicada em Maio
# ---------------------------------------------------------------------------
BANDEIRA_AZUL_2026: Dict[str, bool] = {
    # Lisboa / Setúbal
    "carcavelos": True, "costa-da-caparica": True, "guincho": True,
    "sao-pedro-estoril": True, "estoril": True, "cascais": True,
    "portinho-da-arrabida": True, "sesimbra": True, "troia": True,
    "meco": False,
    # Centro
    "nazare": True, "sao-martinho-do-porto": True, "figueira-da-foz": True,
    "peniche": True, "lagoa-de-obidos": True,
    # Norte
    "viana-do-castelo": True, "espinho": True, "vila-do-conde": True,
    "ofir": True, "cabedelo": True, "miramar": True,
    # Algarve
    "meia-praia": True, "luz-lagos": True, "dona-ana": True,
    "camilo": True, "albufeira": True, "falesia": True,
    "olhos-dagua": True, "vilamoura": True, "quarteira": True,
    "vale-do-lobo": True, "quinta-do-lago": True, "tavira": True,
    "manta-rota": True, "monte-gordo": True, "sagres-mareta": True,
    "odeceixe": True, "arrifana": True,
    # Alentejo
    "comporta": True, "melides": True, "santo-andre": True,
    # Açores
    "ponta-delgada": True, "mosteiros": True,
    # Madeira
    "machico": True, "porto-santo": True,
}

# ---------------------------------------------------------------------------
# Base de dados curada de praias portuguesas com coordenadas e metadados
# Usada como fallback quando a API APA não responde
# ---------------------------------------------------------------------------
BEACHES_PT: List[Dict[str, Any]] = [
    {"id": "nazare-norte", "name": "Praia do Norte", "concelho": "Nazaré",
     "region": "Centro", "lat": 39.6095, "lng": -9.0785,
     "type": "oceânica", "length_m": 1200, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Chuveiros", "Acesso cadeira de rodas"]},
    {"id": "peniche-supertubos", "name": "Supertubos", "concelho": "Peniche",
     "region": "Centro", "lat": 39.3475, "lng": -9.3881,
     "type": "oceânica", "length_m": 800, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Escola de surf", "Parque de estacionamento"]},
    {"id": "carcavelos", "name": "Praia de Carcavelos", "concelho": "Cascais",
     "region": "Lisboa", "lat": 38.6771, "lng": -9.3372,
     "type": "oceânica", "length_m": 1100, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Chuveiros", "Restauração", "Escola de surf"]},
    {"id": "costa-caparica", "name": "Costa da Caparica", "concelho": "Almada",
     "region": "Lisboa", "lat": 38.6268, "lng": -9.2365,
     "type": "oceânica", "length_m": 30000, "bandeira_azul": True,
     "water_quality": "Boa", "facilities": ["WC", "Restauração", "Transpraia", "Nadadores-salvadores"]},
    {"id": "guincho", "name": "Praia do Guincho", "concelho": "Cascais",
     "region": "Lisboa", "lat": 38.7278, "lng": -9.4720,
     "type": "oceânica", "length_m": 2000, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Restauração", "Parque Natural Sintra-Cascais"]},
    {"id": "arrabida-portinho", "name": "Portinho da Arrábida", "concelho": "Setúbal",
     "region": "Lisboa", "lat": 38.4841, "lng": -8.9899,
     "type": "baía", "length_m": 400, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Snorkeling", "Parque Natural da Arrábida"]},
    {"id": "comporta", "name": "Praia da Comporta", "concelho": "Alcácer do Sal",
     "region": "Alentejo", "lat": 38.3766, "lng": -8.7699,
     "type": "oceânica", "length_m": 10000, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Restauração", "Camping"]},
    {"id": "melides", "name": "Praia de Melides", "concelho": "Grândola",
     "region": "Alentejo", "lat": 38.2091, "lng": -8.7158,
     "type": "oceânica", "length_m": 8000, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Nadadores-salvadores"]},
    {"id": "sagres-mareta", "name": "Praia da Mareta", "concelho": "Vila do Bispo",
     "region": "Algarve", "lat": 36.9980, "lng": -8.9422,
     "type": "oceânica", "length_m": 500, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Chuveiros", "Restauração"]},
    {"id": "luz-lagos", "name": "Praia da Luz", "concelho": "Lagos",
     "region": "Algarve", "lat": 37.0890, "lng": -8.7290,
     "type": "baía", "length_m": 700, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Restauração", "Escola de mergulho"]},
    {"id": "falesia", "name": "Praia da Falésia", "concelho": "Albufeira",
     "region": "Algarve", "lat": 37.0841, "lng": -8.1328,
     "type": "oceânica", "length_m": 6000, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Restauração", "Acesso pedestre"]},
    {"id": "meia-praia", "name": "Meia Praia", "concelho": "Lagos",
     "region": "Algarve", "lat": 37.1120, "lng": -8.6750,
     "type": "baía", "length_m": 4000, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Restauração", "Desportos náuticos"]},
    {"id": "quinta-do-lago", "name": "Praia da Quinta do Lago", "concelho": "Loulé",
     "region": "Algarve", "lat": 37.0431, "lng": -7.9933,
     "type": "estuário", "length_m": 2000, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Restauração", "Golfe"]},
    {"id": "tavira", "name": "Praia de Tavira", "concelho": "Tavira",
     "region": "Algarve", "lat": 37.0820, "lng": -7.6455,
     "type": "ilha barreira", "length_m": 12000, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Restauração", "Ferry access"]},
    {"id": "monte-gordo", "name": "Praia de Monte Gordo", "concelho": "Vila Real de S. António",
     "region": "Algarve", "lat": 37.1790, "lng": -7.4611,
     "type": "oceânica", "length_m": 5000, "bandeira_azul": True,
     "water_quality": "Boa", "facilities": ["WC", "Restauração"]},
    {"id": "espinho", "name": "Praia de Espinho", "concelho": "Espinho",
     "region": "Norte", "lat": 41.0069, "lng": -8.6439,
     "type": "oceânica", "length_m": 2000, "bandeira_azul": True,
     "water_quality": "Boa", "facilities": ["WC", "Chuveiros", "Casino"]},
    {"id": "ofir", "name": "Praia de Ofir", "concelho": "Esposende",
     "region": "Norte", "lat": 41.5292, "lng": -8.7796,
     "type": "estuário", "length_m": 4000, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Restauração", "Parque de campismo"]},
    {"id": "viana-do-castelo", "name": "Praia de Viana do Castelo", "concelho": "Viana do Castelo",
     "region": "Norte", "lat": 41.6938, "lng": -8.8327,
     "type": "oceânica", "length_m": 3000, "bandeira_azul": True,
     "water_quality": "Boa", "facilities": ["WC", "Restauração"]},
    {"id": "odeceixe", "name": "Praia de Odeceixe", "concelho": "Aljezur",
     "region": "Algarve", "lat": 37.4444, "lng": -8.7700,
     "type": "estuário", "length_m": 600, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Restauração", "Rota Vicentina"]},
    {"id": "arrifana", "name": "Praia da Arrifana", "concelho": "Aljezur",
     "region": "Algarve", "lat": 37.2986, "lng": -8.8697,
     "type": "oceânica", "length_m": 800, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Restauração", "Surf"]},
    {"id": "porto-santo", "name": "Praia do Porto Santo", "concelho": "Porto Santo",
     "region": "Madeira", "lat": 33.0650, "lng": -16.3320,
     "type": "oceânica", "length_m": 9000, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Restauração", "Desportos náuticos"]},
    {"id": "mosteiros", "name": "Piscinas Naturais dos Mosteiros", "concelho": "Sete Cidades",
     "region": "Açores", "lat": 37.8812, "lng": -25.8219,
     "type": "piscinas naturais", "length_m": 300, "bandeira_azul": True,
     "water_quality": "Excelente", "facilities": ["WC", "Restauração", "Snorkeling"]},
]

# Quality label mapping for APA codes
QUALITY_MAP = {
    "E": "Excelente",
    "B": "Boa",
    "S": "Suficiente",
    "I": "Insuficiente",
    "P": "Proibida",
}


class APABeachesService:
    """
    Service for APA beach water quality data.
    Primary source: SNIAmb REST API.
    Fallback: curated static dataset with last known quality.
    """

    # SNIAmb API endpoint for beach profiles
    SNIAM_URL = "https://sniambiente.apambiente.pt/api/v1/praias"
    # Alternative APA open data endpoint
    APA_PRAIAS_URL = "https://apambiente.pt/_zdata/Natura/praias/praias.json"

    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._cache_ttl = timedelta(hours=4)

    async def get_all_beaches(self) -> List[Dict[str, Any]]:
        """Return full list enriched with APA quality + Bandeira Azul."""
        cache_key = "all_beaches"
        if cache_key in self._cache:
            data, ts = self._cache[cache_key]
            if datetime.now(timezone.utc) - ts < self._cache_ttl:
                return data

        live_quality = await self._fetch_apa_quality()
        beaches = []
        for b in BEACHES_PT:
            beach = dict(b)
            slug = beach["id"].lower()
            # Merge live APA quality if available
            if slug in live_quality:
                beach["water_quality"] = live_quality[slug]
                beach["water_quality_source"] = "apa_live"
            else:
                beach["water_quality_source"] = "curated"
            # Bandeira Azul
            ba_key = self._normalize_key(beach["name"])
            beach["bandeira_azul"] = BANDEIRA_AZUL_2026.get(
                ba_key, BANDEIRA_AZUL_2026.get(slug, beach.get("bandeira_azul", False))
            )
            beach["bandeira_azul_year"] = 2026
            beach["last_updated"] = datetime.now(timezone.utc).isoformat()
            beaches.append(beach)

        self._cache[cache_key] = (beaches, datetime.now(timezone.utc))
        return beaches

    async def get_beach_quality(self, beach_id: str) -> Optional[Dict[str, Any]]:
        """Return water quality for a specific beach by id."""
        beaches = await self.get_all_beaches()
        for b in beaches:
            if b["id"] == beach_id:
                return {
                    "beach_id": beach_id,
                    "beach_name": b["name"],
                    "water_quality": b["water_quality"],
                    "water_quality_source": b.get("water_quality_source", "curated"),
                    "bandeira_azul": b["bandeira_azul"],
                    "bandeira_azul_year": b.get("bandeira_azul_year", 2026),
                    "lat": b["lat"],
                    "lng": b["lng"],
                    "last_updated": b.get("last_updated"),
                }
        return None

    async def get_beaches_by_region(self, region: str) -> List[Dict[str, Any]]:
        beaches = await self.get_all_beaches()
        return [b for b in beaches if b["region"].lower() == region.lower()]

    async def _fetch_apa_quality(self) -> Dict[str, str]:
        """
        Attempt to fetch live quality data from SNIAmb/APA.
        Returns dict of {beach_slug: quality_label}.
        Returns empty dict on any failure — caller uses curated fallback.
        """
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    self.SNIAM_URL,
                    headers={"Accept": "application/json", "User-Agent": "PortugalVivo/3.0"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    result = {}
                    items = data if isinstance(data, list) else data.get("praias", data.get("features", []))
                    for item in items:
                        props = item.get("properties", item)
                        name = props.get("nome", props.get("name", ""))
                        quality_code = props.get("qualidade", props.get("quality", ""))
                        if name and quality_code:
                            key = self._normalize_key(name)
                            result[key] = QUALITY_MAP.get(quality_code.upper(), quality_code)
                    if result:
                        logger.info(f"APA live quality: {len(result)} beaches loaded")
                        return result
        except Exception as e:
            logger.warning(f"APA API unavailable, using curated data: {e}")
        return {}

    @staticmethod
    def _normalize_key(name: str) -> str:
        import unicodedata
        s = unicodedata.normalize("NFD", name.lower())
        s = "".join(c for c in s if unicodedata.category(c) != "Mn")
        return s.replace(" ", "-").replace("'", "").replace("(", "").replace(")", "")


# Global singleton
apa_beaches_service = APABeachesService()
