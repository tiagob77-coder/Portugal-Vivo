"""
IQ Engine - Módulo 6: De-duplicação
Detecção de POIs duplicados via fuzzy matching e proximidade geográfica
"""
from typing import Dict, List, Optional
import logging
from fuzzywuzzy import fuzz
from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData
)

logger = logging.getLogger(__name__)

class DeduplicationModule(IQModule):
    """
    Módulo 6: De-duplicação
    
    Detecta POIs potencialmente duplicados usando:
    - Fuzzy matching textual (nome + descrição)
    - Proximidade geográfica (< 100m)
    - Similaridade de categorias
    """

    def __init__(self, existing_pois: Optional[List[POIProcessingData]] = None):
        super().__init__(ModuleType.DEDUPLICATION)
        self.existing_pois = existing_pois or []
        self.min_text_similarity = 80  # 80% similarity threshold
        self.max_distance_meters = 100  # 100m proximity threshold

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """Check for potential duplicates"""

        issues = []
        warnings = []
        duplicates = []

        if not self.existing_pois:
            # No existing POIs to compare against
            return ProcessingResult(
                module=self.module_type,
                status=ProcessingStatus.COMPLETED,
                score=100,
                confidence=0.5,
                data={
                    "is_duplicate": False,
                    "duplicate_count": 0,
                    "message": "No existing POIs to compare"
                },
                issues=issues,
                warnings=warnings
            )

        # Check against existing POIs
        for existing_poi in self.existing_pois:
            # Skip self-comparison
            if existing_poi.id == data.id:
                continue

            duplicate_info = self._check_duplicate(data, existing_poi)

            if duplicate_info["is_duplicate"]:
                duplicates.append(duplicate_info)

        # Analyze results
        is_duplicate = len(duplicates) > 0

        if is_duplicate:
            # Get best match
            duplicates.sort(key=lambda x: x["overall_score"], reverse=True)
            best_match = duplicates[0]

            if best_match["overall_score"] >= 90:
                issues.append(
                    f"Provável duplicado de '{best_match['poi_name']}' "
                    f"(similaridade: {best_match['overall_score']:.0f}%)"
                )
                score = 10  # Very low score for clear duplicate
            elif best_match["overall_score"] >= 70:
                warnings.append(
                    f"Possível duplicado de '{best_match['poi_name']}' "
                    f"(similaridade: {best_match['overall_score']:.0f}%)"
                )
                score = 50  # Medium score for possible duplicate
            else:
                score = 80  # Low confidence duplicate
        else:
            score = 100  # No duplicates found

        status = ProcessingStatus.COMPLETED if score >= 70 else ProcessingStatus.REQUIRES_REVIEW

        return ProcessingResult(
            module=self.module_type,
            status=status,
            score=score,
            confidence=1.0 if len(self.existing_pois) > 10 else 0.7,
            data={
                "is_duplicate": is_duplicate,
                "duplicate_count": len(duplicates),
                "potential_duplicates": duplicates[:5],  # Top 5
                "checked_against": len(self.existing_pois)
            },
            issues=issues,
            warnings=warnings
        )

    def _check_duplicate(self, poi1: POIProcessingData, poi2: POIProcessingData) -> Dict:
        """Check if two POIs are potential duplicates"""

        # Text similarity
        name_similarity = fuzz.ratio(poi1.name.lower(), poi2.name.lower())

        # Description similarity (if both exist)
        desc_similarity = 0
        if poi1.description and poi2.description:
            desc_similarity = fuzz.partial_ratio(
                poi1.description.lower()[:200],  # First 200 chars
                poi2.description.lower()[:200]
            )

        # Geographic proximity
        distance = None
        geo_score = 0
        if poi1.location and poi2.location:
            distance = self._calculate_distance(poi1.location, poi2.location)
            if distance < self.max_distance_meters:
                # Closer = higher score
                geo_score = 100 - (distance / self.max_distance_meters * 100)

        # Category match
        category_match = 0
        if poi1.category and poi2.category:
            category_match = 100 if poi1.category == poi2.category else 0

        # Calculate overall duplicate probability
        # Weighted average: name (40%), description (20%), geo (30%), category (10%)
        weights = {
            "name": 0.4,
            "description": 0.2,
            "geo": 0.3,
            "category": 0.1
        }

        overall_score = (
            name_similarity * weights["name"] +
            desc_similarity * weights["description"] +
            geo_score * weights["geo"] +
            category_match * weights["category"]
        )

        # Determine if duplicate
        is_duplicate = False
        if name_similarity >= self.min_text_similarity and distance and distance < self.max_distance_meters:
            is_duplicate = True
        elif name_similarity >= 95:  # Very similar name
            is_duplicate = True
        elif geo_score >= 95 and category_match == 100:  # Very close + same category
            is_duplicate = True

        return {
            "is_duplicate": is_duplicate,
            "poi_id": poi2.id,
            "poi_name": poi2.name,
            "name_similarity": name_similarity,
            "description_similarity": desc_similarity,
            "distance_meters": distance,
            "geo_score": geo_score,
            "category_match": category_match,
            "overall_score": overall_score
        }

    def _calculate_distance(self, loc1: Dict, loc2: Dict) -> Optional[float]:
        """Calculate distance between two coordinates in meters"""
        from math import radians, sin, cos, sqrt, atan2

        try:
            # Extract lat/lng (handle different formats)
            if isinstance(loc1, dict):
                if 'lat' in loc1 and 'lng' in loc1:
                    lat1, lon1 = loc1['lat'], loc1['lng']
                elif 'coordinates' in loc1:
                    lon1, lat1 = loc1['coordinates']  # GeoJSON format
                else:
                    return None
            else:
                return None

            if isinstance(loc2, dict):
                if 'lat' in loc2 and 'lng' in loc2:
                    lat2, lon2 = loc2['lat'], loc2['lng']
                elif 'coordinates' in loc2:
                    lon2, lat2 = loc2['coordinates']
                else:
                    return None
            else:
                return None

            # Haversine formula
            R = 6371000  # Earth radius in meters

            lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
            dlat = lat2 - lat1
            dlon = lon2 - lon1

            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))

            return R * c
        except Exception as e:
            logger.error(f"Error calculating distance: {e}")
            return None
