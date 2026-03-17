"""
Simple Alerting Module
Sends webhook notifications (Slack / Discord / generic) when thresholds are exceeded.
Can be triggered from monitoring health checks or middleware.
"""
import os
import time
import logging
import asyncio
from collections import deque
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ALERT_WEBHOOK_URL: str = os.environ.get("ALERT_WEBHOOK_URL", "")
ALERT_THRESHOLD_ERROR_RATE: float = float(os.environ.get("ALERT_THRESHOLD_ERROR_RATE", "0.05"))  # 5%
ALERT_THRESHOLD_RESPONSE_MS: float = float(os.environ.get("ALERT_THRESHOLD_RESPONSE_MS", "2000"))  # 2s
ALERT_COOLDOWN_SECONDS: int = int(os.environ.get("ALERT_COOLDOWN_SECONDS", "300"))  # 5 min

# ---------------------------------------------------------------------------
# In-memory metrics (sliding window)
# ---------------------------------------------------------------------------

_WINDOW_SECONDS = 60
_request_log: deque = deque()  # (timestamp, status_code, duration_ms)
_last_alert_ts: dict[str, float] = {}  # alert_type -> last epoch


def record_request(status_code: int, duration_ms: float) -> None:
    """Record a request outcome for rate/latency tracking."""
    now = time.time()
    _request_log.append((now, status_code, duration_ms))
    _prune()


def _prune() -> None:
    cutoff = time.time() - _WINDOW_SECONDS
    while _request_log and _request_log[0][0] < cutoff:
        _request_log.popleft()


# ---------------------------------------------------------------------------
# Threshold evaluation
# ---------------------------------------------------------------------------

def _error_rate() -> Optional[float]:
    _prune()
    if not _request_log:
        return None
    errors = sum(1 for _, sc, _ in _request_log if sc >= 500)
    return errors / len(_request_log)


def _avg_response_ms() -> Optional[float]:
    _prune()
    if not _request_log:
        return None
    return sum(d for _, _, d in _request_log) / len(_request_log)


def evaluate_alerts() -> list[dict]:
    """Check thresholds and return list of alerts to fire."""
    alerts = []
    now = time.time()

    err = _error_rate()
    if err is not None and err > ALERT_THRESHOLD_ERROR_RATE:
        if now - _last_alert_ts.get("high_error_rate", 0) > ALERT_COOLDOWN_SECONDS:
            alerts.append({
                "type": "high_error_rate",
                "message": f"Error rate {err:.1%} exceeds threshold {ALERT_THRESHOLD_ERROR_RATE:.1%}",
                "value": round(err, 4),
                "threshold": ALERT_THRESHOLD_ERROR_RATE,
            })

    avg = _avg_response_ms()
    if avg is not None and avg > ALERT_THRESHOLD_RESPONSE_MS:
        if now - _last_alert_ts.get("slow_response", 0) > ALERT_COOLDOWN_SECONDS:
            alerts.append({
                "type": "slow_response",
                "message": f"Avg response {avg:.0f}ms exceeds threshold {ALERT_THRESHOLD_RESPONSE_MS:.0f}ms",
                "value": round(avg, 1),
                "threshold": ALERT_THRESHOLD_RESPONSE_MS,
            })

    return alerts


# ---------------------------------------------------------------------------
# Alert for DB connection issues (called from health checks)
# ---------------------------------------------------------------------------

def build_db_alert(service: str, error: str) -> dict:
    """Create a DB-connection alert payload."""
    return {
        "type": "db_connection_failure",
        "message": f"{service} connection failed: {error}",
        "service": service,
    }


# ---------------------------------------------------------------------------
# Webhook delivery
# ---------------------------------------------------------------------------

async def send_webhook(alert: dict) -> bool:
    """Send an alert payload to the configured webhook URL.

    Supports Slack-style (``{"text": ...}``), Discord-style (``{"content": ...}``),
    and generic JSON POST.
    """
    if not ALERT_WEBHOOK_URL:
        logger.debug("No ALERT_WEBHOOK_URL configured — alert suppressed: %s", alert.get("type"))
        return False

    payload = _format_payload(alert)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(ALERT_WEBHOOK_URL, json=payload)
            resp.raise_for_status()
        _last_alert_ts[alert["type"]] = time.time()
        logger.info("Alert sent: %s", alert["type"])
        return True
    except Exception as exc:
        logger.error("Failed to send alert webhook: %s", exc)
        return False


def _format_payload(alert: dict) -> dict:
    """Build a webhook payload compatible with Slack, Discord, and generic receivers."""
    url = ALERT_WEBHOOK_URL.lower()
    timestamp = datetime.now(timezone.utc).isoformat()
    text = f"[{alert['type'].upper()}] {alert['message']} (at {timestamp})"

    if "slack" in url or "hooks.slack.com" in url:
        return {"text": text}
    if "discord" in url or "discord.com" in url:
        return {"content": text}
    # Generic webhook — send full structured payload
    return {
        "alert": alert,
        "timestamp": timestamp,
        "service": "patrimonio-backend",
    }


# ---------------------------------------------------------------------------
# Convenience: evaluate + fire in one call
# ---------------------------------------------------------------------------

async def check_and_alert() -> list[dict]:
    """Evaluate thresholds and send any triggered alerts. Returns fired alerts."""
    alerts = evaluate_alerts()
    for alert in alerts:
        await send_webhook(alert)
    return alerts
