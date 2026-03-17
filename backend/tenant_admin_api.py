"""
Tenant Management API Endpoints
Admin endpoints for creating, managing, and monitoring tenants
Protected with admin role requirement
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
import logging

from tenant_manager import get_tenant_manager
from auth_api import require_admin

logger = logging.getLogger(__name__)

# Router for tenant admin operations
admin_router = APIRouter(prefix="/api/admin/tenants", tags=["Tenant Administration"])

# ========================
# MODELS
# ========================

class TenantCreate(BaseModel):
    """Request model for creating a new tenant"""
    tenant_id: str = Field(..., description="Unique tenant identifier (will be slugified)")
    name: str = Field(..., description="Display name of the tenant")
    subdomain: str = Field(..., description="Subdomain for tenant (e.g., 'braga' for braga.pv.pt)")
    metadata: Optional[Dict] = Field(default_factory=dict, description="Additional metadata")

class TenantResponse(BaseModel):
    """Response model for tenant information"""
    tenant_id: str
    name: str
    subdomain: str
    db_name: str
    status: str
    created_at: datetime
    updated_at: datetime
    metadata: Dict
    settings: Dict

class TenantStats(BaseModel):
    """Tenant statistics"""
    tenant_id: str
    total_pois: int
    total_routes: int
    total_users: int
    total_contributions: int
    database_size_mb: float

class TenantList(BaseModel):
    """List of tenants"""
    tenants: List[TenantResponse]
    total: int
    skip: int
    limit: int

# ========================
# ENDPOINTS
# ========================

@admin_router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(tenant_data: TenantCreate, admin: dict = Depends(require_admin)):
    """
    Create a new tenant with isolated database
    
    **Important**: This creates a completely isolated database for the tenant
    """
    try:
        tenant_manager = get_tenant_manager()

        tenant = await tenant_manager.create_tenant(
            tenant_id=tenant_data.tenant_id,
            name=tenant_data.name,
            subdomain=tenant_data.subdomain,
            metadata=tenant_data.metadata
        )

        logger.info(f"✅ Tenant created: {tenant['tenant_id']}")

        return TenantResponse(**tenant)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating tenant: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create tenant"
        )

@admin_router.get("", response_model=TenantList)
async def list_tenants(skip: int = 0, limit: int = 50, admin: dict = Depends(require_admin)):
    """
    List all tenants
    """
    try:
        tenant_manager = get_tenant_manager()
        tenants = await tenant_manager.list_tenants(skip=skip, limit=limit)

        return TenantList(
            tenants=[TenantResponse(**t) for t in tenants],
            total=len(tenants),
            skip=skip,
            limit=limit
        )
    except Exception as e:
        logger.error(f"Error listing tenants: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list tenants"
        )

@admin_router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(tenant_id: str, admin: dict = Depends(require_admin)):
    """
    Get information about a specific tenant
    """
    try:
        tenant_manager = get_tenant_manager()
        tenant = await tenant_manager.get_tenant(tenant_id)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant '{tenant_id}' not found"
            )

        return TenantResponse(**tenant)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tenant: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get tenant"
        )

@admin_router.get("/{tenant_id}/stats", response_model=TenantStats)
async def get_tenant_stats(tenant_id: str, admin: dict = Depends(require_admin)):
    """
    Get statistics for a specific tenant
    """
    try:
        tenant_manager = get_tenant_manager()

        # Verify tenant exists
        tenant = await tenant_manager.get_tenant(tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant '{tenant_id}' not found"
            )

        stats = await tenant_manager.get_tenant_stats(tenant_id)
        return TenantStats(**stats)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tenant stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get tenant statistics"
        )

@admin_router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(tenant_id: str, admin: dict = Depends(require_admin)):
    """
    Delete a tenant and all its data
    
    **Warning**: This is irreversible! All tenant data will be permanently deleted.
    """
    try:
        tenant_manager = get_tenant_manager()

        success = await tenant_manager.delete_tenant(tenant_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant '{tenant_id}' not found"
            )

        logger.info(f"🗑️ Tenant deleted: {tenant_id}")
        return

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting tenant: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete tenant"
        )

# Health check for tenant system
@admin_router.get("/system/health")
async def tenant_system_health():
    """
    Check health of tenant management system
    """
    try:
        tenant_manager = get_tenant_manager()

        # Test Redis connection
        redis_ok = False
        if tenant_manager.redis:
            try:
                await tenant_manager.redis.ping()
                redis_ok = True
            except Exception as e:
                logger.warning(f"Redis not available: {e}")
        tenants = await tenant_manager.list_tenants(limit=1000)

        return {
            "status": "healthy",
            "redis_connected": redis_ok,
            "total_tenants": len(tenants),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
