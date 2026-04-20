"""
IQ Engine - Módulo 7: POI Scoring
Sistema de pontuação detalhado para POIs (0-100).

v2 improvements:
  - Context-parameterizable weights via RouteContextProfile.criterion_boosts
  - Sub-scores: popularity_score (views/ratings) + freshness_score (last_updated)
  - Reliability level A/B/C assigned here and propagated to ProcessingResult
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData,
    ReliabilityLevel,
    RouteContextProfile,
    compute_reliability_level,
)

logger = logging.getLogger(__name__)

# Default weights (sum = 1.0)
DEFAULT_WEIGHTS: Dict[str, float] = {
    "geo_precision":     0.25,
    "image_quality":     0.20,
    "description":       0.20,
    "category_coherence": 0.15,
    "data_completeness": 0.20,
}


class POIScoringModule(IQModule):
    """
    Módulo 7: POI Score (0-100)

    Criteria:
    1. Precisão Geográfica (default 25%)
    2. Qualidade de Imagem (default 20%)
    3. Descrição (default 20%)
    4. Coerência Categorial (default 15%)
    5. Completude de Dados (default 20%)

    Plus sub-scores:
    - popularity_score: derived from metadata.views / metadata.rating
    - freshness_score:  based on metadata.last_updated age

    Weights can be boosted per-request via RouteContextProfile.criterion_boosts
    (e.g., photo-route context boosts image_quality weight by 1.5×).
    """

    def __init__(self):
        super().__init__(ModuleType.POI_SCORING)

    def _effective_weights(self, context: Optional[RouteContextProfile]) -> Dict[str, float]:
        """
        Apply context boosts and re-normalise so weights still sum to 1.
        """
        weights = dict(DEFAULT_WEIGHTS)

        if context and context.criterion_boosts:
            for key, multiplier in context.criterion_boosts.items():
                if key in weights:
                    weights[key] *= multiplier

        total = sum(weights.values())
        return {k: v / total for k, v in weights.items()}

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """Calculate comprehensive POI score with context-aware weights."""

        context: Optional[RouteContextProfile] = data.route_context
        weights = self._effective_weights(context)

        scores: Dict[str, float] = {}
        details: Dict[str, dict] = {}

        # 1. Precisão Geográfica
        scores["geo_precision"], details["geo_precision"] = self._score_geo_precision(data)

        # 2. Qualidade de Imagem
        scores["image_quality"], details["image_quality"] = self._score_image_quality(data)

        # 3. Descrição
        scores["description"], details["description"] = self._score_description(data)

        # 4. Coerência Categorial
        scores["category_coherence"], details["category_coherence"] = self._score_category_coherence(data)

        # 5. Completude de Dados
        scores["data_completeness"], details["data_completeness"] = self._score_data_completeness(data)

        # Weighted composite score
        final_score = sum(
            scores[criterion] * weights[criterion] * 100
            for criterion in scores
        )

        # ── Sub-scores ──────────────────────────────────────────────────────────
        popularity_score = self._score_popularity(data)
        freshness_score = self._score_freshness(data)

        # Blend: final ×85% + popularity ×7.5% + freshness ×7.5%
        blended_score = (
            final_score * 0.85
            + popularity_score * 0.075
            + freshness_score * 0.075
        )
        blended_score = round(min(blended_score, 100), 1)

        # ── Reliability level ───────────────────────────────────────────────────
        concordant_sources = int(data.metadata.get("concordant_sources", 0))
        last_validated_raw = data.metadata.get("last_validation_date")
        last_validated: Optional[datetime] = None
        if last_validated_raw:
            try:
                if isinstance(last_validated_raw, datetime):
                    last_validated = last_validated_raw
                else:
                    last_validated = datetime.fromisoformat(str(last_validated_raw))
                    if last_validated.tzinfo is None:
                        last_validated = last_validated.replace(tzinfo=timezone.utc)
            except Exception:
                pass

        reliability = compute_reliability_level(blended_score, concordant_sources, last_validated)

        # Quality level label
        quality_level = self._get_quality_level(blended_score)

        # Issues and warnings
        issues = []
        warnings = []
        for criterion, score in scores.items():
            if score < 0.4:
                issues.append(f"{criterion}: score muito baixo ({score * 100:.0f}%)")
            elif score < 0.6:
                warnings.append(f"{criterion}: score médio ({score * 100:.0f}%)")

        if reliability == ReliabilityLevel.C:
            warnings.append("Nível de fiabilidade C — recomenda-se revalidação")

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=blended_score,
            confidence=1.0,
            reliability_level=reliability,
            data={
                "overall_score": blended_score,
                "base_score": round(final_score, 1),
                "quality_level": quality_level,
                "reliability_level": reliability.value,
                "scores_breakdown": {k: round(v * 100, 1) for k, v in scores.items()},
                "sub_scores": {
                    "popularity_score": round(popularity_score, 1),
                    "freshness_score": round(freshness_score, 1),
                },
                "weights_used": {k: round(v * 100, 1) for k, v in weights.items()},
                "context_boosts": context.criterion_boosts if context else {},
                "concordant_sources": concordant_sources,
                "details": details,
            },
            issues=issues,
            warnings=warnings,
        )

    # ── Core criteria ──────────────────────────────────────────────────────────

    def _score_geo_precision(self, data: POIProcessingData) -> Tuple[float, dict]:
        """Score geographic precision (0-1)"""
        score = 0
        details = {}

        if not data.location:
            details["has_location"] = False
            return 0, details

        details["has_location"] = True
        score += 0.5

        try:
            if isinstance(data.location, dict):
                if "lat" in data.location and "lng" in data.location:
                    lat, lng = data.location["lat"], data.location["lng"]
                elif "coordinates" in data.location:
                    lng, lat = data.location["coordinates"]
                else:
                    return score, details

                lat_decimals = len(str(lat).split(".")[-1]) if "." in str(lat) else 0
                lng_decimals = len(str(lng).split(".")[-1]) if "." in str(lng) else 0

                details["lat_precision"] = lat_decimals
                details["lng_precision"] = lng_decimals

                if lat_decimals >= 6 and lng_decimals >= 6:
                    score += 0.5
                    details["precision_level"] = "high (1cm)"
                elif lat_decimals >= 4 and lng_decimals >= 4:
                    score += 0.3
                    details["precision_level"] = "medium (10m)"
                else:
                    score += 0.1
                    details["precision_level"] = "low (>100m)"
        except Exception as e:
            logger.error(f"Error scoring geo precision: {e}")

        if data.address:
            details["has_address"] = True

        return min(1.0, score), details

    def _score_image_quality(self, data: POIProcessingData) -> Tuple[float, dict]:
        """Score image quality (0-1)"""
        score = 0
        details = {}

        if not data.image_url:
            details["has_image"] = False
            return 0, details

        details["has_image"] = True
        score += 0.5

        url = data.image_url.lower()
        if url.startswith("http"):
            score += 0.2
            details["valid_url"] = True

        quality_services = ["unsplash", "pexels", "cloudinary", "wikimedia",
                             "visitportugal", "patrimoniocultural"]
        if any(s in url for s in quality_services):
            score += 0.2
            details["trusted_source"] = True

        if len(url) < 20:
            score -= 0.3
            details["url_too_short"] = True

        return max(0, min(1.0, score)), details

    def _score_description(self, data: POIProcessingData) -> Tuple[float, dict]:
        """Score description quality (0-1)"""
        score = 0
        details = {}

        if not data.description:
            details["has_description"] = False
            return 0, details

        desc = data.description.strip()
        length = len(desc)

        details["length"] = length
        details["has_description"] = True

        if length < 50:
            score += 0.2
            details["length_quality"] = "very_short"
        elif length < 100:
            score += 0.4
            details["length_quality"] = "short"
        elif length < 300:
            score += 0.7
            details["length_quality"] = "good"
        elif length < 600:
            score += 1.0
            details["length_quality"] = "excellent"
        else:
            score += 0.8
            details["length_quality"] = "too_long"

        informative_words = [
            "históric", "construct", "séc", "ano", "localiz",
            "caracteriz", "destac", "patrimoni", "cultural",
            "visit", "abert", "horári"
        ]
        word_count = sum(1 for w in informative_words if w in desc.lower())
        if word_count >= 3:
            score += 0.2
            details["informative"] = True

        generic_phrases = ["ponto de interesse", "local bonito", "vale a pena"]
        if any(p in desc.lower() for p in generic_phrases) and length < 100:
            score -= 0.2
            details["too_generic"] = True

        return max(0, min(1.0, score)), details

    def _score_category_coherence(self, data: POIProcessingData) -> Tuple[float, dict]:
        """Score category coherence (0-1)"""
        score = 0
        details = {}

        if not data.category:
            details["has_category"] = False
            return 0, details

        details["has_category"] = True
        details["category"] = data.category
        score += 0.5

        if data.subcategory:
            score += 0.2
            details["has_subcategory"] = True

        if data.tags and len(data.tags) >= 3:
            score += 0.3
            details["well_tagged"] = True

        return min(1.0, score), details

    def _score_data_completeness(self, data: POIProcessingData) -> Tuple[float, dict]:
        """Score overall data completeness (0-1)"""
        score = 0
        details = {}
        fields_present = []
        fields_missing = []

        required = {
            "name": data.name,
            "description": data.description,
            "category": data.category,
            "location": data.location,
        }
        for field, value in required.items():
            if value:
                score += 0.2
                fields_present.append(field)
            else:
                fields_missing.append(field)

        optional = {
            "address": data.address,
            "image_url": data.image_url,
            "subcategory": data.subcategory,
            "tags": data.tags,
        }
        for field, value in optional.items():
            if value:
                score += 0.05
                fields_present.append(field)

        details["fields_present"] = fields_present
        details["fields_missing"] = fields_missing
        details["completeness_percent"] = round(score * 100, 1)

        return min(1.0, score), details

    # ── Sub-scores ─────────────────────────────────────────────────────────────

    def _score_popularity(self, data: POIProcessingData) -> float:
        """
        Popularity sub-score (0-100) from metadata.
        Fields checked: views, rating, review_count, google_rating.
        """
        meta = data.metadata or {}
        score = 0.0

        views = float(meta.get("views", 0) or 0)
        if views > 0:
            # Log scale: 10k views → 40 pts
            import math
            score += min(40.0, math.log10(views + 1) * 10)

        rating = float(meta.get("rating") or meta.get("google_rating") or 0)
        if rating > 0:
            # 5-star → 40 pts; 4-star → 32 pts
            score += min(40.0, (rating / 5.0) * 40)

        review_count = float(meta.get("review_count", 0) or 0)
        if review_count > 0:
            import math
            score += min(20.0, math.log10(review_count + 1) * 8)

        return round(min(score, 100.0), 1)

    def _score_freshness(self, data: POIProcessingData) -> float:
        """
        Freshness sub-score (0-100) based on last_updated age.
        < 6 months → 100; 6-12 mo → 80; 12-24 mo → 60; 24-36 mo → 30; > 36 mo → 10.
        """
        meta = data.metadata or {}
        raw = meta.get("last_updated") or meta.get("last_validation_date")
        if not raw:
            return 50.0  # unknown — neutral

        try:
            if isinstance(raw, datetime):
                dt = raw
            else:
                dt = datetime.fromisoformat(str(raw))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
        except Exception:
            return 50.0

        months = (datetime.now(timezone.utc) - dt).days / 30.0

        if months < 6:
            return 100.0
        if months < 12:
            return 80.0
        if months < 24:
            return 60.0
        if months < 36:
            return 30.0
        return 10.0

    # ── Quality label ──────────────────────────────────────────────────────────

    def _get_quality_level(self, score: float) -> str:
        if score >= 90:
            return "excelente"
        elif score >= 75:
            return "muito_bom"
        elif score >= 60:
            return "bom"
        elif score >= 40:
            return "mediano"
        else:
            return "insuficiente"
