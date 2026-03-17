"""
Structured JSON Logging Configuration
Provides JSON-formatted logs for production with human-readable fallback for dev.
"""
import logging
import json
import sys
import os
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Formats log records as JSON lines for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add module/function info
        if record.pathname:
            log_entry["module"] = record.module
        if record.funcName and record.funcName != "<module>":
            log_entry["function"] = record.funcName
        if record.lineno:
            log_entry["line"] = record.lineno

        # Add exception info if present
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info),
            }

        # Add extra fields (request_id, tenant_id, user_id, etc.)
        for key in ("request_id", "tenant_id", "user_id", "method", "path",
                     "status_code", "duration_ms", "ip"):
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)

        return json.dumps(log_entry, ensure_ascii=False, default=str)


class DevFormatter(logging.Formatter):
    """Human-readable formatter for development."""

    COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[35m",
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        ts = datetime.now().strftime("%H:%M:%S")
        msg = record.getMessage()
        base = f"{color}{ts} [{record.levelname:7s}]{self.RESET} {record.name}: {msg}"

        if record.exc_info and record.exc_info[1]:
            base += f"\n{self.formatException(record.exc_info)}"

        return base


def setup_logging(log_level: str = "INFO"):
    """Configure structured logging for the application.

    Uses JSON format in production, colored human-readable format in dev.
    Set LOG_FORMAT=json to force JSON output.
    """
    is_production = os.environ.get("LOG_FORMAT", "").lower() == "json" or \
                    os.environ.get("ENVIRONMENT", "").lower() in ("production", "staging")

    root = logging.getLogger()
    root.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Remove existing handlers
    root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    if is_production:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(DevFormatter())

    root.addHandler(handler)

    # Reduce noise from third-party loggers
    for noisy in ("uvicorn.access", "httpx", "httpcore", "urllib3",
                   "motor", "pymongo", "asyncio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger("uvicorn").setLevel(logging.INFO)

    return root
