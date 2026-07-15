"""
Geo Verification API — cross-validation of GPS coordinates.

Answers "are these coordinates truthful?" by reverse-geocoding them
(Nominatim -> GeoAPI.pt cascade) and comparing the resulting administrative
hierarchy (freguesia / concelho / distrito / NUTS II) against what is
declared for the POI or supplied by the caller.

Endpoints:
  GET  /geo-verification/verify           - Verify arbitrary coords vs expected admin names
  GET  /geo-verification/poi/{poi_id}     - Verification report for a stored POI (read-only)
  POST /geo-verification/poi/{poi_id}     - Verify and persist result on the POI (write role)

Statuses:
  verified          - every declared field matches the geocoded hierarchy
  mismatch          - at least one declared field disagrees
  no_declared_data  - nothing declared to compare against (geocoded data returned)
  out_of_bounds     - coords outside Portugal (continente + Açores + Madeira)
  unverifiable      - all geocoding providers unavailable
"""
import logging
import unicodedata
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from dependencies import get_db
from services.geocoding_service import geocoding_service
from tenant_middleware import TenantContext, require_tenant_write

logger = logging.getLogger(__name__)

geo_verification_router = APIRouter(
    prefix="/geo-verification", tags=["GeoVerification"]
)

# Same accepted bounding box as the POI GPS pipeline (v19):
# continente + Açores + Madeira.
PT_LAT_MIN, PT_LAT_MAX = 32.0, 43.0
PT_LNG_MIN, PT_LNG_MAX = -32.0, -6.0


# ---------------------------------------------------------------------------
# Pure helpers (unit-tested in tests/test_geo_verification.py)
# ---------------------------------------------------------------------------

def _strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


def _normalize_admin_name(name: Optional[str]) -> str:
    """Normalize an administrative name for comparison:
    lowercase, accent-free, collapsed separators."""
    if not name:
        return ""
    text = _strip_accents(str(name)).lower()
    for sep in ("-", "_", "/", ","):
        text = text.replace(sep, " ")
    return " ".join(text.split())


def _names_match(declared: Optional[str], geocoded: Optional[str]) -> bool:
    """True when the normalized names are equal or one contains the other
    (handles e.g. declared "lisboa" vs NUTS "Área Metropolitana de Lisboa",
    or "União das freguesias de X e Y" vs "X")."""
    a = _normalize_admin_name(declared)
    b = _normalize_admin_name(geocoded)
    if not a or not b:
        return False
    return a == b or a in b or b in a


def _in_portugal_bounds(lat: float, lng: float) -> bool:
    return PT_LAT_MIN <= lat <= PT_LAT_MAX and PT_LNG_MIN <= lng <= PT_LNG_MAX


def _compare_admin_fields(
    declared: Dict[str, Optional[str]], geocoded: Dict[str, Any]
) -> Dict[str, Any]:
    """Compare declared admin names against a reverse-geocode result.

    ``declared`` may contain: freguesia, concelho, distrito, region.
    Only non-empty declared fields are checked. Returns per-field checks,
    a match_score in [0, 1] and the overall status.
    """
    field_sources = {
        "freguesia": [geocoded.get("freguesia")],
        # Nominatim-only results carry the concelho-level name in "city"
        "concelho": [geocoded.get("concelho"), geocoded.get("city")],
        "distrito": [geocoded.get("distrito_pt"), geocoded.get("district")],
        "region": [geocoded.get("nuts_ii")],
    }

    checks: Dict[str, Any] = {}
    matched = 0
    for field, sources in field_sources.items():
        expected = declared.get(field)
        if not expected:
            continue
        geocoded_value = next((s for s in sources if s), "")
        is_match = any(_names_match(expected, s) for s in sources if s)
        checks[field] = {
            "declared": expected,
            "geocoded": geocoded_value,
            "match": is_match,
        }
        if is_match:
            matched += 1

    total = len(checks)
    if total == 0:
        status = "no_declared_data"
        score = None
    elif matched == total:
        status = "verified"
        score = 1.0
    else:
        status = "mismatch"
        score = round(matched / total, 2)

    return {"status": status, "match_score": score, "checks": checks}


# ---------------------------------------------------------------------------
# Response model
# ---------------------------------------------------------------------------

class VerificationResult(BaseModel):
    status: str
    match_score: Optional[float] = None
    lat: float
    lng: float
    checks: Dict[str, Any] = {}
    geocoded: Optional[Dict[str, Any]] = None
    message: str = ""


# ---------------------------------------------------------------------------
# Core verification
# ---------------------------------------------------------------------------

async def _verify_coordinates(
    lat: float,
    lng: float,
    declared: Dict[str, Optional[str]],
) -> VerificationResult:
    if not _in_portugal_bounds(lat, lng):
        return VerificationResult(
            status="out_of_bounds",
            lat=lat,
            lng=lng,
            message=(
                "Coordenadas fora dos limites de Portugal "
                "(continente + Açores + Madeira)"
            ),
        )

    geocoded = await geocoding_service.reverse_geocode(lat, lng)
    if not geocoded:
        return VerificationResult(
            status="unverifiable",
            lat=lat,
            lng=lng,
            message="Serviços de geocodificação indisponíveis de momento",
        )

    comparison = _compare_admin_fields(declared, geocoded)
    messages = {
        "verified": "Coordenadas coerentes com a localização declarada",
        "mismatch": "Divergência entre coordenadas e localização declarada",
        "no_declared_data": (
            "Sem dados declarados para comparar — devolvida apenas a "
            "geocodificação reversa"
        ),
    }
    return VerificationResult(
        status=comparison["status"],
        match_score=comparison["match_score"],
        lat=lat,
        lng=lng,
        checks=comparison["checks"],
        geocoded=geocoded,
        message=messages[comparison["status"]],
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@geo_verification_router.get(
    "/verify",
    response_model=VerificationResult,
    summary="Verificar coordenadas GPS contra nomes administrativos esperados",
)
async def verify_coordinates(
    lat: float = Query(..., ge=-90, le=90, description="Latitude decimal"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude decimal"),
    concelho: Optional[str] = Query(None, description="Concelho esperado"),
    distrito: Optional[str] = Query(None, description="Distrito esperado"),
    freguesia: Optional[str] = Query(None, description="Freguesia esperada"),
    region: Optional[str] = Query(None, description="Região NUTS II esperada"),
):
    """
    Geocodifica reversamente as coordenadas e compara a hierarquia
    administrativa obtida com os nomes esperados fornecidos.
    """
    return await _verify_coordinates(
        lat,
        lng,
        {
            "concelho": concelho,
            "distrito": distrito,
            "freguesia": freguesia,
            "region": region,
        },
    )


def _declared_from_poi(poi: Dict[str, Any]) -> Dict[str, Optional[str]]:
    return {
        "freguesia": poi.get("freguesia"),
        "concelho": poi.get("concelho"),
        "distrito": poi.get("distrito"),
        "region": poi.get("region"),
    }


async def _load_poi_coords(
    db: AsyncIOMotorDatabase, poi_id: str
) -> tuple[Dict[str, Any], float, float]:
    poi = await db.heritage_items.find_one({"id": poi_id}, {"_id": 0})
    if not poi:
        raise HTTPException(status_code=404, detail=f"POI '{poi_id}' não encontrado")

    loc = poi.get("location") or {}
    lat, lng = loc.get("lat"), loc.get("lng")
    if lat is None or lng is None:
        raise HTTPException(
            status_code=422, detail="POI sem coordenadas GPS — nada para verificar"
        )
    return poi, float(lat), float(lng)


@geo_verification_router.get(
    "/poi/{poi_id}",
    response_model=VerificationResult,
    summary="Relatório de verificação GPS de um POI (read-only)",
)
async def verify_poi(
    poi_id: str = Path(..., description="ID do POI a verificar"),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Verifica se as coordenadas guardadas do POI são coerentes com os campos
    administrativos declarados (freguesia/concelho/distrito/region).
    Não altera a base de dados.
    """
    poi, lat, lng = await _load_poi_coords(db, poi_id)
    return await _verify_coordinates(lat, lng, _declared_from_poi(poi))


@geo_verification_router.post(
    "/poi/{poi_id}",
    response_model=VerificationResult,
    summary="Verificar um POI e persistir o resultado (requer role de escrita)",
)
async def verify_and_persist_poi(
    poi_id: str = Path(..., description="ID do POI a verificar"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    tenant: TenantContext = Depends(require_tenant_write),
):
    """
    Igual ao GET, mas grava o resultado no documento do POI em
    ``gps_verification`` (status, match_score, checks, verified_at),
    para alimentar auditorias e o dashboard de qualidade de dados.
    """
    poi, lat, lng = await _load_poi_coords(db, poi_id)
    result = await _verify_coordinates(lat, lng, _declared_from_poi(poi))

    await db.heritage_items.update_one(
        {"id": poi_id},
        {
            "$set": {
                "gps_verification": {
                    "status": result.status,
                    "match_score": result.match_score,
                    "checks": result.checks,
                    "verified_at": datetime.now(timezone.utc).isoformat(),
                    "verified_by": tenant.user_id,
                }
            }
        },
    )
    return result
