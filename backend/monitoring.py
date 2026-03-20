"""
Sentry Error Monitoring, Prometheus Metrics & Health Check Endpoints (P2-3)

- Sentry: captures unhandled exceptions + explicit 5xx alert via middleware
- Prometheus: exposes /api/metrics compatible with prometheus_client
- Health: /api/health and /api/health/detailed
"""
import os
import time
import logging
from datetime import datetime, timezone
from typing import Optional

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from fastapi import APIRouter, FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

try:
    from prometheus_client import (
        Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST, REGISTRY
    )
    _PROMETHEUS_AVAILABLE = True
except ImportError:
    _PROMETHEUS_AVAILABLE = False

logger = logging.getLogger(__name__)

_start_time = time.monotonic()

# ---------------------------------------------------------------------------
# Sentry SDK Initialization
# ---------------------------------------------------------------------------

def _traces_sampler(sampling_context: dict) -> float:
    """Filter out health check transactions from performance monitoring."""
    transaction_name = sampling_context.get("transaction_context", {}).get("name", "")
    if "/health" in transaction_name or "/api/health" in transaction_name:
        return 0.0
    default_rate = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    return default_rate


def init_sentry() -> bool:
    """Initialize Sentry SDK. Returns True if DSN was configured."""
    dsn = os.environ.get("SENTRY_DSN", "")
    if not dsn:
        logger.info("SENTRY_DSN not set — Sentry monitoring disabled")
        return False

    environment = os.environ.get("ENVIRONMENT", "development")
    version = os.environ.get("APP_VERSION", "0.0.0")

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        release=f"patrimonio-backend@{version}",
        traces_sampler=_traces_sampler,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            StarletteIntegration(transaction_style="endpoint"),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        send_default_pii=False,
        # Attach server name for multi-instance deployments
        server_name=os.environ.get("HOSTNAME", None),
    )

    # Custom tags applied to every event
    sentry_sdk.set_tag("service", "patrimonio-backend")
    sentry_sdk.set_tag("version", version)

    logger.info("Sentry initialized (env=%s, version=%s)", environment, version)
    return True


# ---------------------------------------------------------------------------
# Prometheus metrics (P2-3)
# ---------------------------------------------------------------------------

if _PROMETHEUS_AVAILABLE:
    _http_requests_total = Counter(
        "http_requests_total",
        "Total HTTP requests",
        ["method", "endpoint", "status_code"],
    )
    _http_request_duration = Histogram(
        "http_request_duration_seconds",
        "HTTP request latency",
        ["method", "endpoint"],
    )
    _http_5xx_total = Counter(
        "http_5xx_errors_total",
        "Total HTTP 5xx errors",
        ["method", "endpoint"],
    )


class _MetricsMiddleware(BaseHTTPMiddleware):
    """Record per-request metrics and capture 5xx to Sentry."""

    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        duration = time.monotonic() - start

        # Normalise endpoint label (strip query string, cap length)
        path = request.url.path[:120]
        method = request.method
        status = response.status_code

        if _PROMETHEUS_AVAILABLE:
            _http_requests_total.labels(method, path, status).inc()
            _http_request_duration.labels(method, path).observe(duration)
            if status >= 500:
                _http_5xx_total.labels(method, path).inc()

        # Sentry: explicit capture for 5xx so it appears as an issue even
        # when the exception was caught internally (e.g. HTTPException 500).
        if status >= 500:
            with sentry_sdk.new_scope() as scope:
                scope.set_tag("http.method", method)
                scope.set_tag("http.path", path)
                scope.set_tag("http.status_code", status)
                scope.set_extra("duration_ms", round(duration * 1000, 1))
                sentry_sdk.capture_message(
                    f"HTTP {status} {method} {path}",
                    level="error",
                    scope=scope,
                )

        return response


# ---------------------------------------------------------------------------
# Health Check Router
# ---------------------------------------------------------------------------

health_router = APIRouter(prefix="/api/health", tags=["Stats"])


@health_router.get("/metrics", tags=["Stats"], include_in_schema=False)
async def prometheus_metrics():
    """Prometheus scrape endpoint — exposes all registered metrics."""
    if not _PROMETHEUS_AVAILABLE:
        return Response(
            content="# prometheus_client not installed\n",
            media_type="text/plain",
            status_code=503,
        )
    return Response(
        content=generate_latest(REGISTRY),
        media_type=CONTENT_TYPE_LATEST,
    )


@health_router.get("", summary="Simple health check (UptimeRobot-compatible)")
async def simple_health():
    """Returns 200 OK with minimal JSON — compatible with UptimeRobot and similar monitors."""
    return {"status": "ok"}


@health_router.get("/detailed", summary="Detailed health check")
async def detailed_health():
    """Comprehensive health check covering DB, cache, disk, and memory."""
    import psutil
    import redis.asyncio as aioredis

    checks = {}
    overall = "healthy"

    # --- MongoDB connectivity ---
    try:
        mongo_url = os.environ.get("MONGO_URL", "")
        db_name = os.environ.get("DB_NAME", "")
        if mongo_url and db_name:
            t0 = time.monotonic()
            motor_client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=3000)
            await motor_client[db_name].command("ping")
            mongo_ms = round((time.monotonic() - t0) * 1000, 1)
            checks["mongodb"] = {"status": "connected", "response_ms": mongo_ms}
            motor_client.close()
        else:
            checks["mongodb"] = {"status": "not_configured"}
            overall = "degraded"
    except Exception as exc:
        checks["mongodb"] = {"status": "unreachable", "error": str(exc)}
        overall = "degraded"

    # --- Redis connectivity ---
    try:
        redis_url = os.environ.get("REDIS_URL", "")
        if redis_url:
            t0 = time.monotonic()
            r = aioredis.from_url(redis_url, socket_connect_timeout=3)
            await r.ping()
            redis_ms = round((time.monotonic() - t0) * 1000, 1)
            checks["redis"] = {"status": "connected", "response_ms": redis_ms}
            await r.close()
        else:
            checks["redis"] = {"status": "not_configured"}
    except Exception as exc:
        checks["redis"] = {"status": "unreachable", "error": str(exc)}
        overall = "degraded"

    # --- Disk space ---
    try:
        disk = psutil.disk_usage("/")
        disk_pct = disk.percent
        checks["disk"] = {
            "status": "ok" if disk_pct < 90 else "warning",
            "used_percent": disk_pct,
            "free_gb": round(disk.free / (1024 ** 3), 2),
        }
        if disk_pct >= 95:
            overall = "degraded"
    except Exception as exc:
        checks["disk"] = {"status": "error", "error": str(exc)}

    # --- Memory usage ---
    try:
        mem = psutil.virtual_memory()
        checks["memory"] = {
            "status": "ok" if mem.percent < 90 else "warning",
            "used_percent": mem.percent,
            "available_mb": round(mem.available / (1024 ** 2), 1),
        }
        if mem.percent >= 95:
            overall = "degraded"
    except Exception as exc:
        checks["memory"] = {"status": "error", "error": str(exc)}

    # --- Uptime ---
    uptime_seconds = round(time.monotonic() - _start_time, 1)

    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": uptime_seconds,
        "checks": checks,
    }


# ---------------------------------------------------------------------------
# Public init helper — called from server.py
# ---------------------------------------------------------------------------

def init_monitoring(app: FastAPI) -> None:
    """Initialize Sentry, Prometheus middleware, and health check routes."""
    init_sentry()
    app.add_middleware(_MetricsMiddleware)
    app.include_router(health_router)
    if _PROMETHEUS_AVAILABLE:
        logger.info("Prometheus metrics available at /api/health/metrics")
    logger.info("Monitoring and health check routes registered")
