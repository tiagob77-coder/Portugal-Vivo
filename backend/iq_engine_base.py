"""
IQ Engine - Base Classes and Pipeline
Sistema de processamento inteligente para POIs e Rotas

Two-level architecture:
  Level 1 — Data Quality Pipeline: M1–M7 + M9–M10 + dedup
  Level 2 — Recommendation / Routing Engine: M8 + M12–M19
             (fed by features produced at Level 1)
"""
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from enum import Enum
import logging

logger = logging.getLogger(__name__)

# Re-export quality profile types so callers only need one import
from iq_quality_profiles import (   # noqa: E402
    ReliabilityLevel,
    SourceType,
    TerrainType,
    POIQualityProfile,
    RouteContextProfile,
    compute_reliability_level,
)

# ========================
# ENUMS & CONSTANTS
# ========================

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REQUIRES_REVIEW = "requires_review"

class ModuleType(str, Enum):
    # Validation & Inference (M1-M3)
    SEMANTIC_VALIDATION = "semantic_validation"  # M1
    COGNITIVE_INFERENCE = "cognitive_inference"  # M2
    IMAGE_QUALITY = "image_quality"              # M3

    # Normalization (M4-M6)
    SLUG_GENERATOR = "slug_generator"            # M4
    ADDRESS_NORMALIZATION = "address_norm"       # M5
    DEDUPLICATION = "deduplication"              # M6

    # Scoring (M7-M8)
    POI_SCORING = "poi_scoring"                  # M7
    ROUTE_SCORING = "route_scoring"              # M8

    # Enrichment (M9-M11)
    DATA_ENRICHMENT = "data_enrichment"          # M9-M10
    DESCRIPTION_GENERATION = "description_gen"   # M11

    # Smart Routing (M12-M19)
    THEMATIC_ROUTING = "thematic_routing"        # M12
    TIME_ROUTING = "time_routing"                # M13
    DIFFICULTY_ROUTING = "difficulty_routing"     # M14
    PROFILE_ROUTING = "profile_routing"          # M15
    WEATHER_ROUTING = "weather_routing"           # M16
    TIME_OF_DAY_ROUTING = "time_of_day_routing"  # M17
    MULTI_DAY_ROUTING = "multi_day_routing"      # M18
    ROUTE_OPTIMIZER = "route_optimizer"           # M19

# ========================
# MODELS
# ========================

class ProcessingResult(BaseModel):
    """Result from a processing module"""
    module: ModuleType
    status: ProcessingStatus
    score: Optional[float] = None  # 0-100 score
    confidence: Optional[float] = None  # 0-1 confidence
    reliability_level: Optional[ReliabilityLevel] = None  # set by M7; propagated to pipeline
    data: Dict[str, Any] = Field(default_factory=dict)
    issues: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    execution_time_ms: float = 0
    processed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IQProcessingJob(BaseModel):
    """Job for IQ Engine processing"""
    job_id: str
    tenant_id: str
    entity_type: str  # "poi" or "route"
    entity_id: str
    modules: List[ModuleType]
    status: ProcessingStatus = ProcessingStatus.PENDING
    results: List[ProcessingResult] = Field(default_factory=list)
    overall_score: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None

class POIProcessingData(BaseModel):
    """Data for POI processing"""
    id: str
    name: str
    description: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    region: Optional[str] = None
    location: Optional[Any] = None  # Accept any format (GeoJSON or simple dict)
    address: Optional[str] = None
    image_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Stable identity — survives merges/dedup (set by M6 or at ingest)
    lifetime_id: Optional[str] = None
    # Context vector injected at processing time (consumed by Level-2 modules)
    route_context: Optional[RouteContextProfile] = None

# ──────────────────────────────────────────
# TWO-LEVEL ARCHITECTURE CONSTANTS
# ──────────────────────────────────────────

# Level 1: Data Quality Pipeline (run first; produces POIQualityProfile features)
DATA_QUALITY_MODULES = {
    ModuleType.SEMANTIC_VALIDATION,    # M1
    ModuleType.COGNITIVE_INFERENCE,    # M2
    ModuleType.IMAGE_QUALITY,          # M3
    ModuleType.SLUG_GENERATOR,         # M4
    ModuleType.ADDRESS_NORMALIZATION,  # M5
    ModuleType.DEDUPLICATION,          # M6
    ModuleType.POI_SCORING,            # M7 — produces iq_score + reliability_level
    ModuleType.DATA_ENRICHMENT,        # M9-M10
    ModuleType.DESCRIPTION_GENERATION, # M11
}

# Level 2: Recommendation / Routing Engine (consumes Level-1 features)
RECOMMENDATION_MODULES = {
    ModuleType.ROUTE_SCORING,          # M8
    ModuleType.THEMATIC_ROUTING,       # M12
    ModuleType.TIME_ROUTING,           # M13
    ModuleType.DIFFICULTY_ROUTING,     # M14
    ModuleType.PROFILE_ROUTING,        # M15
    ModuleType.WEATHER_ROUTING,        # M16
    ModuleType.TIME_OF_DAY_ROUTING,    # M17
    ModuleType.MULTI_DAY_ROUTING,      # M18
    ModuleType.ROUTE_OPTIMIZER,        # M19
}

# ========================
# BASE PROCESSOR CLASS
# ========================

class IQModule:
    """Base class for all IQ Engine modules"""

    def __init__(self, module_type: ModuleType):
        self.module_type = module_type
        self.logger = logging.getLogger(f"iq_engine.{module_type.value}")

    async def process(self, data: POIProcessingData) -> ProcessingResult:
        """
        Process POI data through this module
        
        Returns:
            ProcessingResult with score, confidence, and extracted data
        """
        import time
        start_time = time.time()

        try:
            self.logger.info(f"Processing {data.name} through {self.module_type.value}")

            # Call the specific module implementation
            result = await self._process_impl(data)

            # Calculate execution time
            execution_time = (time.time() - start_time) * 1000  # ms
            result.execution_time_ms = execution_time
            result.module = self.module_type

            self.logger.info(
                f"Completed {self.module_type.value} for {data.name} "
                f"(score: {result.score}, time: {execution_time:.2f}ms)"
            )

            return result

        except Exception as e:
            self.logger.error(f"Error in {self.module_type.value}: {e}")
            return ProcessingResult(
                module=self.module_type,
                status=ProcessingStatus.FAILED,
                issues=[str(e)],
                execution_time_ms=(time.time() - start_time) * 1000
            )

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """
        Implementation of the specific module logic
        Override this in subclasses
        """
        raise NotImplementedError("Subclasses must implement _process_impl")

# ========================
# IQ ENGINE PIPELINE
# ========================

class IQEngine:
    """Main IQ Engine pipeline coordinator"""

    def __init__(self):
        self.modules: Dict[ModuleType, IQModule] = {}
        self.logger = logging.getLogger("iq_engine")

    def register_module(self, module: IQModule):
        """Register a processing module"""
        self.modules[module.module_type] = module
        self.logger.info(f"Registered module: {module.module_type.value}")

    async def process_poi(
        self,
        poi_data: POIProcessingData,
        modules: Optional[List[ModuleType]] = None,
        tenant_id: Optional[str] = None
    ) -> List[ProcessingResult]:
        """
        Process a POI through specified modules
        
        Args:
            poi_data: POI data to process
            modules: List of modules to run (None = all registered)
            tenant_id: Tenant context
            
        Returns:
            List of processing results
        """
        if modules is None:
            modules = list(self.modules.keys())

        self.logger.info(f"Starting IQ processing for POI: {poi_data.name}")
        self.logger.info(f"Modules to run: {[m.value for m in modules]}")

        import asyncio

        # Run all modules concurrently
        async def _run_module(module_type: ModuleType) -> Optional[ProcessingResult]:
            if module_type not in self.modules:
                self.logger.warning(f"Module {module_type.value} not registered, skipping")
                return None
            return await self.modules[module_type].process(poi_data)

        raw_results = await asyncio.gather(*[_run_module(m) for m in modules])
        results = [r for r in raw_results if r is not None]

        # Overall score: M7 (POI_SCORING) is authoritative when present;
        # fall back to mean of all module scores.
        m7_result = next(
            (r for r in results if r.module == ModuleType.POI_SCORING and r.score is not None),
            None,
        )
        if m7_result is not None:
            overall_score = m7_result.score
        else:
            scores = [r.score for r in results if r.score is not None]
            overall_score = sum(scores) / len(scores) if scores else None

        overall_score_str = f"{overall_score:.1f}" if overall_score is not None else "N/A"
        self.logger.info(
            f"IQ processing completed for {poi_data.name}. "
            f"Overall score: {overall_score_str}"
        )

        return results

    async def process_batch(
        self,
        pois: List[POIProcessingData],
        modules: Optional[List[ModuleType]] = None,
        tenant_id: Optional[str] = None,
        concurrency: int = 5
    ) -> Dict[str, List[ProcessingResult]]:
        """
        Process multiple POIs concurrently.

        Args:
            concurrency: Max number of POIs processed in parallel (default 5)

        Returns:
            Dict mapping POI ID to processing results
        """
        import asyncio

        semaphore = asyncio.Semaphore(concurrency)

        async def _process_one(poi: POIProcessingData) -> tuple:
            async with semaphore:
                poi_results = await self.process_poi(poi, modules, tenant_id)
                return poi.id, poi_results

        pairs = await asyncio.gather(*[_process_one(poi) for poi in pois])
        return {poi_id: poi_results for poi_id, poi_results in pairs}

# Global IQ Engine instance
_iq_engine: Optional[IQEngine] = None

def get_iq_engine() -> IQEngine:
    """Get global IQ Engine instance"""
    global _iq_engine
    if _iq_engine is None:
        _iq_engine = IQEngine()
    return _iq_engine

def init_iq_engine() -> IQEngine:
    """Initialize IQ Engine with all modules"""
    engine = get_iq_engine()

    # Import and register modules here
    # Will be done in next steps

    return engine
