"""
IQ Engine API Endpoints
APIs para processar POIs através do IQ Engine
"""
from fastapi import APIRouter, HTTPException, status, BackgroundTasks, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import logging

from iq_engine_base import (
    POIProcessingData,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    get_iq_engine
)
from tenant_context import get_current_tenant
from tenant_manager import get_tenant_manager

logger = logging.getLogger(__name__)

# Router for IQ Engine operations
iq_router = APIRouter(prefix="/api/iq", tags=["IQ Engine"])

# ========================
# MODELS
# ========================

class ProcessPOIRequest(BaseModel):
    """Request to process a POI"""
    poi_id: str
    modules: Optional[List[str]] = None  # If None, run all modules

class ProcessPOIResponse(BaseModel):
    """Response from POI processing"""
    poi_id: str
    poi_name: str
    overall_score: float
    processing_time_ms: float
    modules_run: List[str]
    results: List[Dict[str, Any]]
    status: str
    issues: List[str]
    warnings: List[str]

class BatchProcessRequest(BaseModel):
    """Request to process multiple POIs"""
    poi_ids: List[str]
    modules: Optional[List[str]] = None

class IQEngineHealthResponse(BaseModel):
    """IQ Engine health check"""
    status: str
    modules_registered: List[str]
    total_modules: int

# ========================
# ENDPOINTS
# ========================

@iq_router.get("/health", response_model=IQEngineHealthResponse)
async def iq_engine_health():
    """Check IQ Engine health and registered modules"""
    try:
        engine = get_iq_engine()

        return IQEngineHealthResponse(
            status="healthy",
            modules_registered=[m.value for m in engine.modules.keys()],
            total_modules=len(engine.modules)
        )
    except Exception as e:
        logger.error(f"IQ Engine health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="IQ Engine not available"
        )

@iq_router.post("/process-poi/{poi_id}", response_model=ProcessPOIResponse)
async def process_poi(poi_id: str, request: Request):
    """
    Process a single POI through IQ Engine
    
    Runs validation, inference, and quality assessment modules
    """
    import time
    start_time = time.time()

    # Parse optional modules from body
    modules = None
    try:
        body = await request.json()
        if isinstance(body, list):
            modules = body
        elif isinstance(body, dict) and 'modules' in body:
            modules = body['modules']
    except Exception as e:
        logger.debug(f"No body or invalid JSON in request: {e}")

    tenant_id = get_current_tenant()
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required (use X-Tenant-ID header)"
        )

    try:
        # Get tenant database
        tenant_manager = get_tenant_manager()
        tenant_db = await tenant_manager.get_tenant_db(tenant_id)

        # Fetch POI from database
        poi_doc = await tenant_db.heritage_items.find_one({"id": poi_id})

        if not poi_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"POI '{poi_id}' not found in tenant '{tenant_id}'"
            )

        # Convert to POIProcessingData
        poi_data = POIProcessingData(
            id=poi_doc.get("id", poi_id),
            name=poi_doc.get("name", ""),
            description=poi_doc.get("description", ""),
            category=poi_doc.get("category"),
            subcategory=poi_doc.get("subcategory"),
            region=poi_doc.get("region"),
            location=poi_doc.get("location"),
            address=poi_doc.get("address"),
            image_url=poi_doc.get("image_url"),
            tags=poi_doc.get("tags", []),
            metadata=poi_doc.get("metadata", {})
        )

        # Parse module list
        module_types = None
        if modules:
            try:
                module_types = [ModuleType(m) for m in modules]
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid module name: {e}"
                )

        # Process through IQ Engine
        engine = get_iq_engine()

        # Pre-load existing POIs for deduplication module (M6)
        from iq_module_m6_dedup import DeduplicationModule
        dedup_module = engine.modules.get(ModuleType.DEDUPLICATION)
        if dedup_module and isinstance(dedup_module, DeduplicationModule):
            existing_docs = await tenant_db.heritage_items.find(
                {"id": {"$ne": poi_id}},
                {"id": 1, "name": 1, "description": 1, "category": 1, "location": 1}
            ).limit(500).to_list(length=500)

            existing_pois = [
                POIProcessingData(
                    id=doc.get("id", ""),
                    name=doc.get("name", ""),
                    description=doc.get("description", ""),
                    category=doc.get("category"),
                    location=doc.get("location")
                )
                for doc in existing_docs
            ]
            dedup_module.existing_pois = existing_pois
            logger.info(f"Loaded {len(existing_pois)} existing POIs for dedup check")

        results = await engine.process_poi(poi_data, module_types, tenant_id)

        # Calculate overall metrics
        scores = [r.score for r in results if r.score is not None]
        overall_score = sum(scores) / len(scores) if scores else 0

        # Collect issues and warnings
        all_issues = []
        all_warnings = []
        for r in results:
            all_issues.extend(r.issues)
            all_warnings.extend(r.warnings)

        # Determine overall status
        failed = any(r.status == ProcessingStatus.FAILED for r in results)
        requires_review = any(r.status == ProcessingStatus.REQUIRES_REVIEW for r in results)

        if failed:
            overall_status = "failed"
        elif requires_review:
            overall_status = "requires_review"
        else:
            overall_status = "completed"

        # Save results to database
        await _save_iq_results(tenant_db, poi_id, overall_score, results)

        # Prepare response
        processing_time = (time.time() - start_time) * 1000

        return ProcessPOIResponse(
            poi_id=poi_id,
            poi_name=poi_data.name,
            overall_score=round(overall_score, 1),
            processing_time_ms=round(processing_time, 2),
            modules_run=[r.module.value for r in results],
            results=[
                {
                    "module": r.module.value,
                    "status": r.status.value,
                    "score": r.score,
                    "confidence": r.confidence,
                    "data": r.data,
                    "issues": r.issues,
                    "warnings": r.warnings,
                    "execution_time_ms": r.execution_time_ms
                }
                for r in results
            ],
            status=overall_status,
            issues=all_issues,
            warnings=all_warnings
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error processing POI %s: %s", poi_id, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao processar POI"
        )

@iq_router.post("/queue-poi/{poi_id}")
async def queue_poi_processing(poi_id: str, request: Request, background_tasks: BackgroundTasks):
    """
    Queue a single POI for async background processing.
    Returns immediately with a job ID for status polling.
    """
    modules = None
    try:
        body = await request.json()
        if isinstance(body, list):
            modules = body
        elif isinstance(body, dict) and 'modules' in body:
            modules = body['modules']
    except Exception:
        pass

    tenant_id = get_current_tenant()
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required (use X-Tenant-ID header)"
        )

    job_id = str(uuid.uuid4())

    background_tasks.add_task(
        _process_single_poi_background,
        job_id,
        tenant_id,
        poi_id,
        modules
    )

    return {
        "job_id": job_id,
        "poi_id": poi_id,
        "status": "queued",
        "message": "POI processing queued — poll /api/iq/job-status/{job_id} for results"
    }

@iq_router.get("/job-status/{job_id}")
async def get_job_status(job_id: str):
    """Get status of a queued IQ processing job"""
    tenant_id = get_current_tenant()
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required"
        )

    try:
        tenant_manager = get_tenant_manager()
        tenant_db = await tenant_manager.get_tenant_db(tenant_id)

        job = await tenant_db.iq_processing_queue.find_one({"job_id": job_id})

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job '{job_id}' not found"
            )

        return {
            "job_id": job_id,
            "poi_id": job.get("poi_id"),
            "status": job.get("status"),
            "overall_score": job.get("overall_score"),
            "started_at": job.get("started_at"),
            "completed_at": job.get("completed_at"),
            "error": job.get("error"),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving job status"
        )

@iq_router.post("/batch-process")
async def batch_process_pois(request: BatchProcessRequest, background_tasks: BackgroundTasks):
    """
    Process multiple POIs in batch
    Returns immediately and processes in background
    """
    tenant_id = get_current_tenant()
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required"
        )

    # Validate POI count
    if len(request.poi_ids) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 100 POIs per batch"
        )

    # Create batch job
    batch_id = str(uuid.uuid4())

    # Add to background tasks
    background_tasks.add_task(
        _process_batch_background,
        batch_id,
        tenant_id,
        request.poi_ids,
        request.modules
    )

    return {
        "batch_id": batch_id,
        "status": "processing",
        "total_pois": len(request.poi_ids),
        "message": "Batch processing started in background"
    }

@iq_router.get("/batch-status/{batch_id}")
async def get_batch_status(batch_id: str):
    """Get status of batch processing job"""
    tenant_id = get_current_tenant()
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required"
        )

    try:
        tenant_manager = get_tenant_manager()
        tenant_db = await tenant_manager.get_tenant_db(tenant_id)

        # Find batch job
        batch_job = await tenant_db.iq_processing_queue.find_one({"batch_id": batch_id})

        if not batch_job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Batch job '{batch_id}' not found"
            )

        return {
            "batch_id": batch_id,
            "status": batch_job.get("status"),
            "total": batch_job.get("total_pois"),
            "processed": batch_job.get("processed_count", 0),
            "successful": batch_job.get("successful_count", 0),
            "failed": batch_job.get("failed_count", 0),
            "started_at": batch_job.get("started_at"),
            "completed_at": batch_job.get("completed_at")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting batch status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving batch status"
        )

# ========================
# HELPER FUNCTIONS
# ========================

async def _save_iq_results(db, poi_id: str, overall_score: float, results: List[ProcessingResult]):
    """Save IQ processing results to database"""
    try:
        # Update POI with IQ scores
        await db.heritage_items.update_one(
            {"id": poi_id},
            {
                "$set": {
                    "iq_score": round(overall_score, 1),
                    "iq_processed_at": datetime.now(timezone.utc),
                    "iq_status": "completed"
                }
            }
        )

        # Save detailed results
        result_doc = {
            "poi_id": poi_id,
            "overall_score": overall_score,
            "results": [
                {
                    "module": r.module.value,
                    "status": r.status.value,
                    "score": r.score,
                    "confidence": r.confidence,
                    "data": r.data,
                    "issues": r.issues,
                    "warnings": r.warnings
                }
                for r in results
            ],
            "processed_at": datetime.now(timezone.utc)
        }

        await db.iq_processing_results.update_one(
            {"poi_id": poi_id},
            {"$set": result_doc},
            upsert=True
        )

        logger.info(f"IQ results saved for POI {poi_id} (score: {overall_score:.1f})")

    except Exception as e:
        logger.error(f"Error saving IQ results: {e}")

async def _process_single_poi_background(job_id: str, tenant_id: str, poi_id: str, modules: Optional[List[str]]):
    """Background task to process a single POI asynchronously"""
    from tenant_context import set_current_tenant

    set_current_tenant(tenant_id)

    try:
        tenant_manager = get_tenant_manager()
        tenant_db = await tenant_manager.get_tenant_db(tenant_id)

        # Create job record
        await tenant_db.iq_processing_queue.insert_one({
            "job_id": job_id,
            "poi_id": poi_id,
            "tenant_id": tenant_id,
            "status": "processing",
            "started_at": datetime.now(timezone.utc)
        })

        # Fetch POI
        poi_doc = await tenant_db.heritage_items.find_one({"id": poi_id})
        if not poi_doc:
            await tenant_db.iq_processing_queue.update_one(
                {"job_id": job_id},
                {"$set": {"status": "failed", "error": f"POI '{poi_id}' not found"}}
            )
            return

        poi_data = POIProcessingData(
            id=poi_doc.get("id", poi_id),
            name=poi_doc.get("name", ""),
            description=poi_doc.get("description", ""),
            category=poi_doc.get("category"),
            subcategory=poi_doc.get("subcategory"),
            region=poi_doc.get("region"),
            location=poi_doc.get("location"),
            address=poi_doc.get("address"),
            image_url=poi_doc.get("image_url"),
            tags=poi_doc.get("tags", []),
            metadata=poi_doc.get("metadata", {})
        )

        # Parse modules
        module_types = None
        if modules:
            module_types = [ModuleType(m) for m in modules]

        # Process
        engine = get_iq_engine()
        results = await engine.process_poi(poi_data, module_types, tenant_id)

        scores = [r.score for r in results if r.score is not None]
        overall_score = sum(scores) / len(scores) if scores else 0

        await _save_iq_results(tenant_db, poi_id, overall_score, results)

        await tenant_db.iq_processing_queue.update_one(
            {"job_id": job_id},
            {"$set": {
                "status": "completed",
                "overall_score": round(overall_score, 1),
                "completed_at": datetime.now(timezone.utc)
            }}
        )

        logger.info(f"Async job {job_id} completed for POI {poi_id} (score: {overall_score:.1f})")

    except Exception as e:
        logger.error(f"Error in async POI processing job {job_id}: {e}")
        try:
            await tenant_db.iq_processing_queue.update_one(
                {"job_id": job_id},
                {"$set": {"status": "failed", "error": str(e)}}
            )
        except Exception:
            pass

async def _process_batch_background(batch_id: str, tenant_id: str, poi_ids: List[str], modules: Optional[List[str]]):
    """Background task to process batch of POIs"""
    from tenant_context import set_current_tenant

    # Set tenant context for background task
    set_current_tenant(tenant_id)

    try:
        tenant_manager = get_tenant_manager()
        tenant_db = await tenant_manager.get_tenant_db(tenant_id)

        # Create batch job record
        await tenant_db.iq_processing_queue.insert_one({
            "batch_id": batch_id,
            "tenant_id": tenant_id,
            "status": "processing",
            "total_pois": len(poi_ids),
            "processed_count": 0,
            "successful_count": 0,
            "failed_count": 0,
            "started_at": datetime.now(timezone.utc)
        })

        # Process each POI
        successful = 0
        failed = 0

        for idx, poi_id in enumerate(poi_ids):
            try:
                # This would call the processing logic
                # For now, just increment counter
                successful += 1
            except Exception as e:
                logger.error(f"Error processing POI {poi_id} in batch: {e}")
                failed += 1

            # Update progress
            await tenant_db.iq_processing_queue.update_one(
                {"batch_id": batch_id},
                {
                    "$set": {
                        "processed_count": idx + 1,
                        "successful_count": successful,
                        "failed_count": failed
                    }
                }
            )

        # Mark as completed
        await tenant_db.iq_processing_queue.update_one(
            {"batch_id": batch_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc)
                }
            }
        )

        logger.info(f"Batch {batch_id} completed: {successful} successful, {failed} failed")

    except Exception as e:
        logger.error(f"Error in batch processing: {e}")
        # Mark batch as failed
        try:
            await tenant_db.iq_processing_queue.update_one(
                {"batch_id": batch_id},
                {"$set": {"status": "failed", "error": str(e)}}
            )
        except Exception as e:
            logger.error(f"Failed to update queue status for batch {batch_id}: {e}")
