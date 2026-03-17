"""
Tenant Context Management
Manages tenant isolation using ContextVars for async-safe context propagation
"""
from contextvars import ContextVar
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Context variable for current tenant
_current_tenant: ContextVar[Optional[str]] = ContextVar('current_tenant', default=None)

def get_current_tenant() -> Optional[str]:
    """Get the current tenant ID from context"""
    tenant = _current_tenant.get()
    logger.debug(f"Getting current tenant: {tenant}")
    return tenant

def set_current_tenant(tenant_id: str) -> None:
    """Set the current tenant ID in context"""
    logger.info(f"Setting current tenant: {tenant_id}")
    _current_tenant.set(tenant_id)

def clear_current_tenant() -> None:
    """Clear the current tenant from context"""
    logger.debug("Clearing current tenant")
    _current_tenant.set(None)

class TenantContext:
    """Context manager for tenant isolation"""

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self.token = None

    def __enter__(self):
        self.token = _current_tenant.set(self.tenant_id)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.token:
            _current_tenant.reset(self.token)
        return False
