"""
IQ Engine — Quality Profiles
POIQualityProfile and RouteContextProfile Pydantic models.
Shared between the data-quality level (M1–M7, M9–M10) and the
recommendation/routing level (M8, M12–M19).
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ──────────────────────────────────────────
# ENUMS
# ──────────────────────────────────────────

class ReliabilityLevel(str, Enum):
    """
    Reliability level assigned to a POI after M7 scoring.

    A — iq_score ≥ 80, ≥ 2 concordant independent sources, validated
        within the last 12 months.
    B — iq_score 60–79 OR only 1 concordant source OR validated
        6–24 months ago.
    C — iq_score < 60 OR stale (> 24 months without validation).
    """
    A = "A"
    B = "B"
    C = "C"


class SourceType(str, Enum):
    """Image / data source priority order (higher = more trusted)."""
    OWNER = "owner"           # Direct from the place owner / official channel
    CURATED = "curated"       # Portugal Vivo editorial / licensed partner
    EXTERNAL = "external"     # Third-party aggregator, scrape, user-upload
    UNKNOWN = "unknown"


class TerrainType(str, Enum):
    FLAT = "flat"
    HILLY = "hilly"
    MOUNTAIN = "mountain"
    COASTAL = "coastal"
    URBAN = "urban"


# ──────────────────────────────────────────
# POI QUALITY PROFILE
# ──────────────────────────────────────────

class POIQualityProfile(BaseModel):
    """
    Comprehensive quality profile generated after running the full
    data-quality pipeline (M1–M7, M9–M10).

    Stored alongside the POI document; consumed by M8 and M12–M19.
    """

    # Identity
    poi_id: str
    lifetime_id: str  # Stable UUID survives merges; original ID kept as alias
    slug: str = ""
    aliases: List[str] = Field(default_factory=list)
    checksum: str = ""  # 4–6 char hash for quick dirty-check

    # Classification (M1)
    primary_category: Optional[str] = None
    secondary_categories: List[str] = Field(default_factory=list)
    category_confidence: float = 0.0
    ps_subcategory: Optional[str] = None  # "Portugal Secreto" tag if applicable

    # Structured attributes (M2)
    best_season: Optional[str] = None          # "primavera" | "verao" | "outono" | "inverno" | "todo_o_ano"
    terrain_type: Optional[TerrainType] = None
    effort_level: int = 0                      # 0-5 scale
    child_friendly: Optional[bool] = None
    pet_friendly: Optional[bool] = None
    accessibility_score: float = 0.0          # 0-1

    # Image quality (M3)
    image_source_type: SourceType = SourceType.UNKNOWN
    image_clarity_score: float = 0.0          # 0-1
    image_relevance_score: float = 0.0        # 0-1

    # Scoring (M7)
    iq_score: float = 0.0                     # 0-100 composite
    reliability_level: ReliabilityLevel = ReliabilityLevel.C
    sub_scores: Dict[str, float] = Field(default_factory=dict)
    popularity_score: float = 0.0             # 0-100 derived from views/ratings
    freshness_score: float = 0.0              # 0-100 based on last_validated

    # Enrichment flags (M9)
    reserva_obrigatoria: bool = False
    pagamento_numerario: bool = False         # Cash-only payment
    estacionamento_local: Optional[bool] = None  # None = unknown
    seasonal_closure: Optional[Dict[str, Any]] = None  # {"months": [...], "note": str}

    # Description (M11)
    micro_pitch: str = ""                     # ≤ 160 chars
    descricao_curta: str = ""                 # ≤ 300 chars

    # Data provenance
    concordant_sources: int = 0               # Number of sources that agree
    responsible_source: Optional[str] = None
    last_validation_date: Optional[datetime] = None
    version: str = "v1"                       # Increments on significant changes


# ──────────────────────────────────────────
# ROUTE CONTEXT PROFILE
# ──────────────────────────────────────────

class RouteContextProfile(BaseModel):
    """
    Real-time context vector for personalized route generation (M8, M12–M19).
    Passed in at query time; not stored on the POI.
    """

    # Environmental context
    climate_zone: Optional[str] = None        # "coastal" | "interior" | "mountain"
    current_month: Optional[int] = None       # 1-12
    hour_of_day: Optional[int] = None         # 0-23 UTC offset applied by caller

    # User profile
    visitor_profile: Optional[str] = None    # "familia" | "casal" | "solo" | "senior" | "aventureiro"
    mobility_constraints: List[str] = Field(default_factory=list)  # ["wheelchair", "elderly"]

    # Logistics
    transport_mode: Optional[str] = None     # "pe" | "bicicleta" | "carro" | "transporte_publico"
    max_route_km: Optional[float] = None
    max_route_hours: Optional[float] = None  # Used by micro-route filter (< 2h)
    budget_eur: Optional[float] = None

    # Feature boosts (M7 context weights)
    # e.g., {"image_quality": 1.5} boosts image weight for photo-route contexts
    criterion_boosts: Dict[str, float] = Field(default_factory=dict)


def compute_reliability_level(
    iq_score: float,
    concordant_sources: int,
    last_validation_date: Optional[datetime],
) -> ReliabilityLevel:
    """
    Pure function — deterministic reliability classification.

    Parameters
    ----------
    iq_score:              composite 0-100 score from M7
    concordant_sources:    number of independent sources that agree on key fields
    last_validation_date:  UTC datetime of last successful validation run
    """
    now = datetime.now(timezone.utc)
    months_since_validation = (
        (now - last_validation_date).days / 30.0
        if last_validation_date
        else 9999
    )

    if (
        iq_score >= 80
        and concordant_sources >= 2
        and months_since_validation <= 12
    ):
        return ReliabilityLevel.A

    if (
        iq_score >= 60
        and months_since_validation <= 24
    ):
        return ReliabilityLevel.B

    return ReliabilityLevel.C
