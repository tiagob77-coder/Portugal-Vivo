"""
Tenant Middleware
Extracts tenant from request and sets context for database isolation
"""
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
import logging
from typing import Optional
import re

from tenant_context import set_current_tenant, clear_current_tenant
from tenant_manager import get_tenant_manager

logger = logging.getLogger(__name__)

_TENANT_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_-]{1,64}$')


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware to extract tenant from:
    1. X-Tenant-ID header (priority)
    2. Subdomain (e.g., braga.pv.pt -> braga)
    3. Query parameter ?tenant=xxx
    """

    def __init__(self, app, require_tenant: bool = False):
        super().__init__(app)
        self.require_tenant = require_tenant
        self.excluded_paths = [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/admin",  # All admin endpoints (manage tenants)
            "/api/health",
            "/api/stats"  # Allow stats without tenant for backward compat
        ]

    async def dispatch(self, request: Request, call_next):
        # Skip tenant extraction for excluded paths
        if any(request.url.path.startswith(path) for path in self.excluded_paths):
            logger.debug(f"Skipping tenant extraction for {request.url.path}")
            response = await call_next(request)
            return response

        tenant_id = None

        # 1. Try X-Tenant-ID header (highest priority)
        tenant_id = request.headers.get("X-Tenant-ID")
        if tenant_id:
            logger.info(f"Tenant from header: {tenant_id}")

        # 2. Try subdomain extraction
        if not tenant_id:
            tenant_id = self._extract_from_subdomain(request)
            if tenant_id:
                logger.info(f"Tenant from subdomain: {tenant_id}")

        # 3. Try query parameter
        if not tenant_id:
            tenant_id = request.query_params.get("tenant")
            if tenant_id:
                logger.info(f"Tenant from query: {tenant_id}")

        # Validate tenant ID format
        if tenant_id and not _TENANT_ID_PATTERN.match(tenant_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant ID format"
            )

        # Validate tenant exists
        if tenant_id:
            try:
                # Check if tenant manager is initialized
                try:
                    tenant_manager = get_tenant_manager()
                except RuntimeError:
                    logger.warning("Tenant manager not yet initialized, skipping validation")
                    # Set tenant context anyway for early startup
                    set_current_tenant(tenant_id)
                    response = await call_next(request)
                    return response

                tenant_info = await tenant_manager.get_tenant(tenant_id)

                if not tenant_info:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Tenant not found"
                    )

                if tenant_info.get("status") != "active":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Tenant is not active"
                    )

                # Set tenant context
                set_current_tenant(tenant_id)
                logger.info(f"✅ Tenant context set: {tenant_id}")

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error validating tenant: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error validating tenant"
                )

        elif self.require_tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant ID required. Provide via X-Tenant-ID header, subdomain, or ?tenant= query parameter"
            )

        try:
            response = await call_next(request)
            return response
        finally:
            # Clear tenant context after request
            clear_current_tenant()
            logger.debug("Tenant context cleared")

    def _extract_from_subdomain(self, request: Request) -> Optional[str]:
        """
        Extract tenant from subdomain
        Examples:
        - braga.pv.pt -> braga
        - porto.patrimonio.pt -> porto
        - localhost -> None
        - patrimonio-iq.preview.emergentagent.com -> None (dev environment)
        """
        host = request.headers.get("host", "")

        logger.info(f"🔍 Subdomain check - host: '{host}'")

        # Skip localhost and IPs
        if "localhost" in host or re.match(r"^\d+\.\d+\.\d+\.\d+", host):
            return None

        # Skip development/preview environments
        dev_domains = ["preview.emergentagent.com", "emergentcf.cloud", "ngrok", "tunnel", "expo.dev", "localhost"]
        if any(d in host for d in dev_domains):
            return None

        # Extract subdomain (first part before first dot)
        parts = host.split(".")
        if len(parts) >= 2:
            subdomain = parts[0]
            # Filter out common non-tenant subdomains
            non_tenant_subdomains = {"www", "api", "admin", "mail", "smtp", "ftp", "ns1", "ns2", "cdn", "static", "assets", "staging", "dev", "test"}
            if subdomain in non_tenant_subdomains:
                return None
            # Validate subdomain format matches tenant_id pattern
            if _TENANT_ID_PATTERN.match(subdomain):
                return subdomain

        return None
