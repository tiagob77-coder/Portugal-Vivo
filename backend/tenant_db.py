"""
Tenant Database Helper
Provides tenant-aware database access
"""
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from tenant_context import get_current_tenant
from tenant_manager import get_tenant_manager

logger = logging.getLogger(__name__)

async def get_tenant_db() -> AsyncIOMotorDatabase:
    """
    Dependency to get tenant-specific database
    Uses tenant from context set by TenantMiddleware
    """
    tenant_id = get_current_tenant()

    if not tenant_id:
        # For backward compatibility, allow some endpoints without tenant
        # This can be restricted later
        logger.warning("No tenant context found, using default database")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required. Use X-Tenant-ID header or subdomain"
        )

    try:
        tenant_manager = get_tenant_manager()
        db = await tenant_manager.get_tenant_db(tenant_id)
        logger.debug(f"Database retrieved for tenant: {tenant_id}")
        return db
    except Exception as e:
        logger.error(f"Error getting tenant database: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error accessing tenant database"
        )

async def get_tenant_db_optional() -> AsyncIOMotorDatabase:
    """
    Optional tenant database - falls back to default if no tenant
    Use for endpoints that can work with or without tenant
    """
    tenant_id = get_current_tenant()

    if not tenant_id:
        # Fall back to default database for backward compatibility
        from server import db as default_db
        logger.info("No tenant context, using default database")
        return default_db

    try:
        tenant_manager = get_tenant_manager()
        db = await tenant_manager.get_tenant_db(tenant_id)
        logger.debug(f"Database retrieved for tenant: {tenant_id}")
        return db
    except Exception as e:
        logger.error(f"Error getting tenant database: {e}")
        # Fall back to default
        from server import db as default_db
        return default_db
