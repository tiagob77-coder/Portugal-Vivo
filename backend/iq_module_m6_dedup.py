"""
IQ Engine - Módulo 6: De-duplicação
Detecção de POIs duplicados via pipeline em 3 estágios.

v2 pipeline:
  Stage 1 — Hash exact match (checksum comparison — O(1) if checksums stored)
  Stage 2 — Fuzzy text match + category/region blocking (O(n) on filtered set)
  Stage 3 — Geo-proximity + category confirmation (< 50m same-category)

Confidence bands:
  ≥ 0.95  → action: auto_merge   (move to review queue in prod before merge)
  0.80–0.95 → action: review_queue
  < 0.80  → action: keep_separate

lifetime_id:
  Each POI gets a stable `lifetime_id` at ingest.
  On merge the loser's lifetime_id is recorded in `merged_aliases`.
"""
import hashlib
from typing import Dict, List, Optional
import logging
from fuzzywuzzy import fuzz
from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData,
)

logger = logging.getLogger(__name__)

# Confidence band thresholds
_AUTO_MERGE_THRESHOLD = 0.95
_REVIEW_QUEUE_THRESHOLD = 0.80


def _make_checksum(name: str) -> str:
    """Quick 8-char checksum of lowercased name for Stage-1 hash match."""
    return hashlib.sha256(name.strip().lower().encode()).hexdigest()[:8]


class DeduplicationModule(IQModule):
    """
    Módulo 6: De-duplicação — 3-stage pipeline with confidence bands.

    Stage 1: Hash exact match on normalised name checksum
    Stage 2: Fuzzy text + blocking (same region/category)
    Stage 3: Geo-proximity (< 50 m) + same category

    Outputs recommended action: auto_merge | review_queue | keep_separate
    """

    def __init__(self, existing_pois: Optional[List[POIProcessingData]] = None):
        super().__init__(ModuleType.DEDUPLICATION)
        self.existing_pois = existing_pois or []
        # Pre-build checksum index for Stage 1
        self._checksum_index: Dict[str, str] = {
            _make_checksum(p.name): p.id
            for p in self.existing_pois
        }
        self.max_distance_meters = 50  # Stage-3 geo threshold

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """Run 3-stage deduplication pipeline."""

        issues: List[str] = []
        warnings: List[str] = []

        if not self.existing_pois:
            return ProcessingResult(
                module=self.module_type,
                status=ProcessingStatus.COMPLETED,
                score=100,
                confidence=0.5,
                data={
                    "is_duplicate": False,
                    "action": "keep_separate",
                    "stage_reached": 0,
                    "message": "Sem POIs existentes para comparar",
                    "lifetime_id": data.lifetime_id or data.id,
                },
                issues=issues,
                warnings=warnings
            )

        # Stage 1 — Hash exact match
        stage1_match = self._stage1_hash_match(data)

        # Stage 2 — Fuzzy text + blocking
        stage2_candidates = self._stage2_fuzzy_blocked(data) if not stage1_match else []

        # Stage 3 — Geo-proximity on stage-2 survivors
        stage3_match = None
        if not stage1_match and stage2_candidates:
            stage3_match = self._stage3_geo_proximity(data, stage2_candidates)

        # ── Determine best match & confidence ─────────────────────────────────
        best_match = stage1_match or stage3_match
        if best_match:
            confidence = best_match["confidence"]
        else:
            # No match found above thresholds
            confidence = 0.0

        if confidence >= _AUTO_MERGE_THRESHOLD:
            action = "auto_merge"
            score = 10
            issues.append(
                f"[Stage {best_match['stage']}] Auto-merge com '{best_match['poi_name']}' "
                f"(confiança: {confidence:.0%})"
            )
        elif confidence >= _REVIEW_QUEUE_THRESHOLD:
            action = "review_queue"
            score = 50
            warnings.append(
                f"[Stage {best_match['stage']}] Fila de revisão — possível duplicado de "
                f"'{best_match['poi_name']}' (confiança: {confidence:.0%})"
            )
        else:
            action = "keep_separate"
            score = 100

        stage_reached = best_match["stage"] if best_match else 0

        # lifetime_id: preserve existing id for new POIs
        lifetime_id = data.lifetime_id or data.id

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED if score >= 70 else ProcessingStatus.REQUIRES_REVIEW,
            score=score,
            confidence=1.0 if len(self.existing_pois) > 10 else 0.7,
            data={
                "is_duplicate": action != "keep_separate",
                "action": action,
                "confidence": round(confidence, 3),
                "stage_reached": stage_reached,
                "best_match": best_match,
                "all_candidates": (stage2_candidates or [])[:5],
                "checked_against": len(self.existing_pois),
                "lifetime_id": lifetime_id,
            },
            issues=issues,
            warnings=warnings
        )

    # ── Stage helpers ─────────────────────────────────────────────────────────

    def _stage1_hash_match(self, data: POIProcessingData) -> Optional[Dict]:
        """
        Stage 1 — O(1) hash lookup on normalised name checksum.
        Returns match dict with confidence=1.0 if found.
        """
        cs = _make_checksum(data.name)
        matched_id = self._checksum_index.get(cs)
        if matched_id and matched_id != data.id:
            poi = next((p for p in self.existing_pois if p.id == matched_id), None)
            if poi:
                return {
                    "stage": 1,
                    "poi_id": matched_id,
                    "poi_name": poi.name,
                    "confidence": 1.0,
                    "method": "hash_exact",
                }
        return None

    def _stage2_fuzzy_blocked(self, data: POIProcessingData) -> List[Dict]:
        """
        Stage 2 — Fuzzy text match restricted to same-region AND same-category block.
        Returns all candidates with confidence ≥ 0.60.
        """
        candidates = []
        for existing in self.existing_pois:
            if existing.id == data.id:
                continue
            # Blocking: skip if different region OR different category
            if data.region and existing.region and data.region != existing.region:
                continue
            if data.category and existing.category and data.category != existing.category:
                continue

            name_sim = fuzz.ratio(data.name.lower(), existing.name.lower()) / 100.0
            desc_sim = 0.0
            if data.description and existing.description:
                desc_sim = fuzz.partial_ratio(
                    data.description.lower()[:200],
                    existing.description.lower()[:200]
                ) / 100.0

            # Weighted: name 60%, description 40%
            confidence = name_sim * 0.6 + desc_sim * 0.4

            if confidence >= 0.60:
                candidates.append({
                    "stage": 2,
                    "poi_id": existing.id,
                    "poi_name": existing.name,
                    "confidence": round(confidence, 3),
                    "name_similarity": round(name_sim, 3),
                    "desc_similarity": round(desc_sim, 3),
                    "method": "fuzzy_blocked",
                })

        candidates.sort(key=lambda x: x["confidence"], reverse=True)
        return candidates

    def _stage3_geo_proximity(
        self,
        data: POIProcessingData,
        candidates: List[Dict],
    ) -> Optional[Dict]:
        """
        Stage 3 — Geo-proximity confirmation on Stage-2 candidates.
        Upgrades confidence if same-category POI is within max_distance_meters.
        Returns the best confirmed match or None.
        """
        for cand in candidates:
            existing = next((p for p in self.existing_pois if p.id == cand["poi_id"]), None)
            if not existing or not data.location or not existing.location:
                continue

            distance = self._calculate_distance(data.location, existing.location)
            if distance is None:
                continue

            if distance <= self.max_distance_meters:
                geo_boost = 1 - (distance / self.max_distance_meters) * 0.2  # 0.80–1.00
                new_confidence = min(1.0, cand["confidence"] * geo_boost + 0.15)
                return {
                    **cand,
                    "stage": 3,
                    "confidence": round(new_confidence, 3),
                    "distance_meters": round(distance, 1),
                    "method": "geo_proximity",
                }

        return None

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
