"""
IQ Engine - Módulo 8: Route Scoring
Sistema de pontuação para rotas (0-100).

v2 additions:
  - logistical_robustness_score: checks if POIs have consistent opening-hours
    coverage and transport accessibility
  - internal_diversity_score: checks category/theme diversity within the route
"""
from typing import Dict, List
import logging
from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData,
)

logger = logging.getLogger(__name__)


class RouteScoringModule(IQModule):
    """
    Módulo 8: Route Score (0-100) v2

    Criteria:
    1. Coerência Temática (20%)
    2. Qualidade Geográfica (20%)
    3. Acessibilidade (15%)
    4. Qualidade dos POIs (20%)
    5. Experiência do Utilizador (10%)
    6. Robustez Logística (10%)   — v2
    7. Diversidade Interna (5%)   — v2
    """

    def __init__(self):
        super().__init__(ModuleType.ROUTE_SCORING)

        self.weights = {
            "thematic_coherence":      0.20,
            "geographic_quality":      0.20,
            "accessibility":           0.15,
            "poi_quality":             0.20,
            "user_experience":         0.10,
            "logistical_robustness":   0.10,  # v2
            "internal_diversity":      0.05,  # v2
        }

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """
        Calculate route score
        Note: This processes route metadata, not individual POIs
        """

        scores = {}
        details = {}

        # Extract route-specific data from metadata
        route_data = data.metadata or {}

        # 1. Coerência Temática
        theme_score, theme_details = self._score_thematic_coherence(data, route_data)
        scores["thematic_coherence"] = theme_score
        details["thematic_coherence"] = theme_details

        # 2. Qualidade Geográfica
        geo_score, geo_details = self._score_geographic_quality(data, route_data)
        scores["geographic_quality"] = geo_score
        details["geographic_quality"] = geo_details

        # 3. Acessibilidade
        access_score, access_details = self._score_accessibility(data, route_data)
        scores["accessibility"] = access_score
        details["accessibility"] = access_details

        # 4. Qualidade dos POIs
        poi_score, poi_details = self._score_poi_quality(data, route_data)
        scores["poi_quality"] = poi_score
        details["poi_quality"] = poi_details

        # 5. Experiência do Utilizador
        ux_score, ux_details = self._score_user_experience(data, route_data)
        scores["user_experience"] = ux_score
        details["user_experience"] = ux_details

        # 6. Robustez Logística (v2)
        logistic_score, logistic_details = self._score_logistical_robustness(data, route_data)
        scores["logistical_robustness"] = logistic_score
        details["logistical_robustness"] = logistic_details

        # 7. Diversidade Interna (v2)
        diversity_score, diversity_details = self._score_internal_diversity(data, route_data)
        scores["internal_diversity"] = diversity_score
        details["internal_diversity"] = diversity_details

        # Score final ponderado
        final_score = sum(
            scores[criterion] * self.weights[criterion] * 100
            for criterion in scores
        )

        # Quality level
        quality_level = self._get_quality_level(final_score)

        # Issues e warnings
        issues = []
        warnings = []

        for criterion, score in scores.items():
            if score < 0.4:
                issues.append(f"{criterion}: score muito baixo ({score*100:.0f}%)")
            elif score < 0.6:
                warnings.append(f"{criterion}: score médio ({score*100:.0f}%)")

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=final_score,
            confidence=0.85,  # Slightly lower confidence for routes
            data={
                "overall_score": round(final_score, 1),
                "quality_level": quality_level,
                "scores_breakdown": {k: round(v*100, 1) for k, v in scores.items()},
                "details": details,
                "weights": {k: v*100 for k, v in self.weights.items()}
            },
            issues=issues,
            warnings=warnings
        )

    def _score_thematic_coherence(self, data: POIProcessingData, route_data: Dict) -> tuple:
        """Score thematic coherence of route (0-1)"""
        score = 0.5  # Base score
        details = {}

        # Check if route has clear theme
        theme = route_data.get("theme") or data.category
        if theme:
            score += 0.3
            details["has_theme"] = True
            details["theme"] = theme

        # Check description for thematic keywords
        if data.description:
            thematic_words = ['temática', 'percurso', 'rota', 'itinerário', 'trilho']
            if any(word in data.description.lower() for word in thematic_words):
                score += 0.2
                details["thematic_description"] = True

        return min(1.0, score), details

    def _score_geographic_quality(self, data: POIProcessingData, route_data: Dict) -> tuple:
        """Score geographic quality of route (0-1)"""
        score = 0
        details = {}

        # Check for route coordinates/path
        waypoints = route_data.get("waypoints", [])
        distance_km = route_data.get("distance_km", 0)

        if waypoints and len(waypoints) >= 2:
            score += 0.4
            details["has_waypoints"] = True
            details["waypoint_count"] = len(waypoints)

        if distance_km > 0:
            score += 0.3
            details["distance_km"] = distance_km

            # Reasonable distance scoring
            if 1 <= distance_km <= 50:
                score += 0.3
                details["distance_quality"] = "optimal"
            elif distance_km < 1:
                score += 0.1
                details["distance_quality"] = "very_short"
            elif distance_km > 100:
                score += 0.1
                details["distance_quality"] = "very_long"

        return min(1.0, score), details

    def _score_accessibility(self, data: POIProcessingData, route_data: Dict) -> tuple:
        """Score route accessibility (0-1)"""
        score = 0.5  # Base score
        details = {}

        # Check difficulty level
        difficulty = route_data.get("difficulty", "").lower()
        if difficulty:
            details["difficulty"] = difficulty
            if difficulty in ["facil", "fácil", "easy"]:
                score += 0.3
                details["highly_accessible"] = True
            elif difficulty in ["moderado", "moderate"]:
                score += 0.2
            else:
                score += 0.1

        # Check for accessibility info
        accessibility_keywords = [
            'acessível', 'mobilidade reduzida', 'cadeira de rodas',
            'pavimentado', 'plano', 'sinalizado'
        ]

        desc = (data.description or "").lower()
        accessibility_mentions = sum(1 for kw in accessibility_keywords if kw in desc)

        if accessibility_mentions > 0:
            score += min(0.2, accessibility_mentions * 0.1)
            details["accessibility_mentioned"] = True

        return min(1.0, score), details

    def _score_poi_quality(self, data: POIProcessingData, route_data: Dict) -> tuple:
        """Score quality of POIs in route (0-1)"""
        score = 0
        details = {}

        # Get POI count
        poi_count = route_data.get("poi_count", 0)
        poi_ids = route_data.get("poi_ids", [])

        if not poi_ids:
            poi_ids = data.related_items if hasattr(data, 'related_items') else []

        actual_count = len(poi_ids) if poi_ids else poi_count

        if actual_count > 0:
            details["poi_count"] = actual_count

            # Optimal POI count: 3-10 POIs
            if 3 <= actual_count <= 10:
                score += 0.6
                details["poi_count_quality"] = "optimal"
            elif 2 <= actual_count <= 15:
                score += 0.4
                details["poi_count_quality"] = "good"
            else:
                score += 0.2
                details["poi_count_quality"] = "suboptimal"

        # Check if POIs have scores (from M7)
        avg_poi_score = route_data.get("avg_poi_score")
        if avg_poi_score:
            score += (avg_poi_score / 100) * 0.4
            details["avg_poi_score"] = avg_poi_score

        return min(1.0, score), details

    def _score_user_experience(self, data: POIProcessingData, route_data: Dict) -> tuple:
        """Score overall user experience (0-1)"""
        score = 0.5  # Base score
        details = {}

        # Check for duration estimation
        duration = route_data.get("duration_hours") or route_data.get("duration_minutes")
        if duration:
            score += 0.3
            details["has_duration"] = True
            details["duration"] = duration

        # Check for highlights/recommendations
        highlights = route_data.get("highlights", [])
        if highlights and len(highlights) > 0:
            score += 0.2
            details["has_highlights"] = True
            details["highlight_count"] = len(highlights)

        return min(1.0, score), details

    def _score_logistical_robustness(self, data: POIProcessingData, route_data: Dict) -> tuple:
        """
        Score logistical robustness (0-1).
        Checks:
        - POIs have opening hours → routes won't break due to closed venues
        - At least one transport option is mentioned
        - Total visit duration is ≤ 12h (realistic for a day route)
        """
        score = 0.4  # base
        details = {}

        poi_ids = route_data.get("poi_ids", [])
        poi_count = len(poi_ids) if poi_ids else route_data.get("poi_count", 0)

        # Opening hours coverage
        pois_with_hours = route_data.get("pois_with_opening_hours", 0)
        if poi_count > 0:
            coverage = pois_with_hours / poi_count
            score += coverage * 0.3
            details["opening_hours_coverage"] = round(coverage, 2)
        else:
            details["opening_hours_coverage"] = None

        # Transport info present
        transport_info = route_data.get("transport_info") or route_data.get("accessibility_notes")
        if transport_info:
            score += 0.15
            details["has_transport_info"] = True

        # Duration sanity check (≤ 12h total = 720 min)
        duration_min = route_data.get("duration_minutes") or (
            (route_data.get("duration_hours") or 0) * 60
        )
        if duration_min > 0:
            if duration_min <= 720:
                score += 0.15
                details["duration_realistic"] = True
            else:
                details["duration_realistic"] = False
                details["duration_minutes"] = duration_min

        return min(1.0, score), details

    def _score_internal_diversity(self, data: POIProcessingData, route_data: Dict) -> tuple:
        """
        Score internal category/theme diversity (0-1).
        A good route mixes different category types (nature + culture + gastronomy etc.)
        """
        score = 0.3  # base
        details = {}

        poi_categories: List[str] = route_data.get("poi_categories", [])
        if not poi_categories:
            return score, {"note": "Sem dados de categorias dos POIs"}

        unique_categories = set(poi_categories)
        diversity_ratio = len(unique_categories) / max(len(poi_categories), 1)
        details["unique_categories"] = list(unique_categories)
        details["diversity_ratio"] = round(diversity_ratio, 2)

        if len(unique_categories) >= 4:
            score = 1.0
            details["diversity_level"] = "excelente"
        elif len(unique_categories) >= 3:
            score = 0.8
            details["diversity_level"] = "bom"
        elif len(unique_categories) == 2:
            score = 0.6
            details["diversity_level"] = "moderado"
        else:
            score = 0.3
            details["diversity_level"] = "baixo"

        return score, details

    def _get_quality_level(self, score: float) -> str:
        """Determine quality level"""
        if score >= 85:
            return "excelente"
        elif score >= 70:
            return "muito_bom"
        elif score >= 55:
            return "bom"
        elif score >= 40:
            return "mediano"
        else:
            return "insuficiente"
