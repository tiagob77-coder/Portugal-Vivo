"""
Beaches Real-Time API
Combina:
  - Metadados e qualidade da água (APA / curado)
  - Bandeira Azul 2026 (ABAE)
  - Dados de marés por praia (Stormglass fallback astronómico)
  - Webcams MEO (beachcam_api.py já existente — não duplicado aqui)

Prefixo: /beaches
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
import logging

from services.apa_beaches_service import apa_beaches_service
from services.tide_service import real_tide_service

logger = logging.getLogger(__name__)

beaches_router = APIRouter(prefix="/beaches", tags=["Beaches"])


@beaches_router.get("/")
async def list_beaches(
    region: Optional[str] = Query(None, description="Norte | Centro | Lisboa | Alentejo | Algarve | Açores | Madeira"),
    bandeira_azul: Optional[bool] = Query(None, description="Filtrar por Bandeira Azul 2026"),
    quality: Optional[str] = Query(None, description="Excelente | Boa | Suficiente"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Lista praias portuguesas com qualidade da água APA e Bandeira Azul.
    """
    beaches = await apa_beaches_service.get_all_beaches()

    if region:
        beaches = [b for b in beaches if b["region"].lower() == region.lower()]
    if bandeira_azul is not None:
        beaches = [b for b in beaches if b.get("bandeira_azul") == bandeira_azul]
    if quality:
        beaches = [b for b in beaches if b.get("water_quality", "").lower() == quality.lower()]

    total = len(beaches)
    page = beaches[offset: offset + limit]

    return {
        "beaches": page,
        "total": total,
        "filters": {
            "region": region,
            "bandeira_azul": bandeira_azul,
            "quality": quality,
        },
        "source": "apa_beaches_service",
    }


@beaches_router.get("/bandeira-azul")
async def list_bandeira_azul():
    """
    Lista todas as praias com Bandeira Azul 2026.
    """
    beaches = await apa_beaches_service.get_all_beaches()
    certified = [b for b in beaches if b.get("bandeira_azul")]
    by_region: dict = {}
    for b in certified:
        r = b["region"]
        by_region.setdefault(r, []).append({"id": b["id"], "name": b["name"], "concelho": b.get("concelho", "")})

    return {
        "total": len(certified),
        "year": 2026,
        "by_region": by_region,
        "source": "abae_curated_2026",
    }


@beaches_router.get("/{beach_id}")
async def get_beach(beach_id: str):
    """
    Detalhe de praia: qualidade, Bandeira Azul e previsão de marés.
    """
    quality = await apa_beaches_service.get_beach_quality(beach_id)
    if not quality:
        raise HTTPException(status_code=404, detail=f"Praia '{beach_id}' não encontrada")

    # Enrich with tide data for this location
    try:
        tides = await real_tide_service.get_tide_extremes(quality["lat"], quality["lng"])
    except Exception as e:
        logger.warning(f"Could not fetch tides for beach {beach_id}: {e}")
        tides = None

    return {
        **quality,
        "tides": tides,
    }


@beaches_router.get("/{beach_id}/tides")
async def get_beach_tides(beach_id: str):
    """
    Previsão de marés para uma praia específica (Stormglass ou cálculo astronómico).
    """
    quality = await apa_beaches_service.get_beach_quality(beach_id)
    if not quality:
        raise HTTPException(status_code=404, detail=f"Praia '{beach_id}' não encontrada")

    tides = await real_tide_service.get_tide_extremes(quality["lat"], quality["lng"])
    return {
        "beach_id": beach_id,
        "beach_name": quality["beach_name"],
        "lat": quality["lat"],
        "lng": quality["lng"],
        "tides": tides,
    }
