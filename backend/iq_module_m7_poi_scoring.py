"""
IQ Engine - Módulo 7: POI Scoring
Sistema de pontuação detalhado para POIs (0-100)
"""
import logging
from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData
)

logger = logging.getLogger(__name__)

class POIScoringModule(IQModule):
    """
    Módulo 7: POI Score (0-100)
    
    Critérios de pontuação:
    1. Precisão Geográfica (25 pontos)
    2. Qualidade de Imagem (20 pontos)
    3. Descrição (20 pontos)
    4. Coerência Categorial (15 pontos)
    5. Completude de Dados (20 pontos)
    """

    def __init__(self):
        super().__init__(ModuleType.POI_SCORING)

        # Pesos dos critérios
        self.weights = {
            "geo_precision": 0.25,
            "image_quality": 0.20,
            "description": 0.20,
            "category_coherence": 0.15,
            "data_completeness": 0.20
        }

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """Calculate comprehensive POI score"""

        scores = {}
        details = {}

        # 1. Precisão Geográfica (25 pontos)
        geo_score, geo_details = self._score_geo_precision(data)
        scores["geo_precision"] = geo_score
        details["geo_precision"] = geo_details

        # 2. Qualidade de Imagem (20 pontos)
        image_score, image_details = self._score_image_quality(data)
        scores["image_quality"] = image_score
        details["image_quality"] = image_details

        # 3. Descrição (20 pontos)
        desc_score, desc_details = self._score_description(data)
        scores["description"] = desc_score
        details["description"] = desc_details

        # 4. Coerência Categorial (15 pontos)
        cat_score, cat_details = self._score_category_coherence(data)
        scores["category_coherence"] = cat_score
        details["category_coherence"] = cat_details

        # 5. Completude de Dados (20 pontos)
        comp_score, comp_details = self._score_data_completeness(data)
        scores["data_completeness"] = comp_score
        details["data_completeness"] = comp_details

        # Calcular score final ponderado
        final_score = sum(
            scores[criterion] * self.weights[criterion] * 100
            for criterion in scores
        )

        # Determinar nível de qualidade
        quality_level = self._get_quality_level(final_score)

        # Issues e warnings
        issues = []
        warnings = []

        # Identificar critérios problemáticos
        for criterion, score in scores.items():
            if score < 0.4:  # < 40%
                issues.append(f"{criterion}: score muito baixo ({score*100:.0f}%)")
            elif score < 0.6:  # < 60%
                warnings.append(f"{criterion}: score médio ({score*100:.0f}%)")

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=final_score,
            confidence=1.0,
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

    def _score_geo_precision(self, data: POIProcessingData) -> tuple:
        """Score geographic precision (0-1)"""
        score = 0
        details = {}

        if not data.location:
            details["has_location"] = False
            return 0, details

        details["has_location"] = True
        score += 0.5  # Base score for having location

        # Check coordinate precision (6 decimal places = 1cm precision)
        try:
            if isinstance(data.location, dict):
                if 'lat' in data.location and 'lng' in data.location:
                    lat, lng = data.location['lat'], data.location['lng']
                elif 'coordinates' in data.location:
                    lng, lat = data.location['coordinates']
                else:
                    return score, details

                # Count decimal places
                lat_str = str(lat).split('.')
                lng_str = str(lng).split('.')

                if len(lat_str) > 1 and len(lng_str) > 1:
                    lat_decimals = len(lat_str[1])
                    lng_decimals = len(lng_str[1])

                    details["lat_precision"] = lat_decimals
                    details["lng_precision"] = lng_decimals

                    # Award points for precision
                    if lat_decimals >= 6 and lng_decimals >= 6:
                        score += 0.5  # Full precision
                        details["precision_level"] = "high (1cm)"
                    elif lat_decimals >= 4 and lng_decimals >= 4:
                        score += 0.3  # Medium precision
                        details["precision_level"] = "medium (10m)"
                    else:
                        score += 0.1  # Low precision
                        details["precision_level"] = "low (>100m)"
        except Exception as e:
            logger.error(f"Error scoring geo precision: {e}")

        # Check if has address
        if data.address:
            details["has_address"] = True

        return min(1.0, score), details

    def _score_image_quality(self, data: POIProcessingData) -> tuple:
        """Score image quality (0-1)"""
        score = 0
        details = {}

        if not data.image_url:
            details["has_image"] = False
            return 0, details

        details["has_image"] = True
        score += 0.5  # Base score for having image

        # Check URL format
        url = data.image_url.lower()
        if url.startswith('http'):
            score += 0.2
            details["valid_url"] = True

        # Check for known image services (higher quality)
        quality_services = ['unsplash', 'pexels', 'cloudinary', 'imgur']
        if any(service in url for service in quality_services):
            score += 0.2
            details["known_service"] = True

        # Penalize very short URLs (likely broken)
        if len(url) < 20:
            score -= 0.3
            details["url_too_short"] = True

        return max(0, min(1.0, score)), details

    def _score_description(self, data: POIProcessingData) -> tuple:
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

        # Length scoring
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

        # Check for informative content
        informative_words = [
            'históric', 'construct', 'séc', 'ano', 'localiz',
            'caracteriz', 'destac', 'patrimoni', 'cultural',
            'visit', 'abert', 'horári'
        ]

        word_count = sum(1 for word in informative_words if word in desc.lower())
        if word_count >= 3:
            score += 0.2
            details["informative"] = True

        # Penalize very generic descriptions
        generic_phrases = ['ponto de interesse', 'local bonito', 'vale a pena']
        if any(phrase in desc.lower() for phrase in generic_phrases) and length < 100:
            score -= 0.2
            details["too_generic"] = True

        return max(0, min(1.0, score)), details

    def _score_category_coherence(self, data: POIProcessingData) -> tuple:
        """Score category coherence (0-1)"""
        score = 0
        details = {}

        if not data.category:
            details["has_category"] = False
            return 0, details

        details["has_category"] = True
        details["category"] = data.category
        score += 0.5  # Base score

        # Check if has subcategory
        if data.subcategory:
            score += 0.2
            details["has_subcategory"] = True
            details["subcategory"] = data.subcategory

        # Check if tags align with category
        if data.tags:
            details["tag_count"] = len(data.tags)
            # Simple heuristic: having relevant tags
            if len(data.tags) >= 3:
                score += 0.3
                details["well_tagged"] = True

        return min(1.0, score), details

    def _score_data_completeness(self, data: POIProcessingData) -> tuple:
        """Score overall data completeness (0-1)"""
        score = 0
        details = {}
        fields_present = []
        fields_missing = []

        # Required fields (40% each = 80%)
        required = {
            "name": data.name,
            "description": data.description,
            "category": data.category,
            "location": data.location
        }

        for field, value in required.items():
            if value:
                score += 0.2
                fields_present.append(field)
            else:
                fields_missing.append(field)

        # Optional but valuable fields (5% each = 20%)
        optional = {
            "address": data.address,
            "image_url": data.image_url,
            "subcategory": data.subcategory,
            "tags": data.tags
        }

        for field, value in optional.items():
            if value:
                if field == "tags" and len(value) > 0:
                    score += 0.05
                    fields_present.append(field)
                elif value:
                    score += 0.05
                    fields_present.append(field)

        details["fields_present"] = fields_present
        details["fields_missing"] = fields_missing
        details["completeness_percent"] = round(score * 100, 1)

        return min(1.0, score), details

    def _get_quality_level(self, score: float) -> str:
        """Determine quality level based on score"""
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
