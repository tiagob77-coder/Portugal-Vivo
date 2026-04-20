"""
Pytest configuration for the backend test suite.

Provides shared fixtures:
  - client: async httpx client connected to the local FastAPI app via ASGI transport
  - requires_db: marker to skip tests when MongoDB is not available

All API tests run against the local app (no external server needed).
"""
import os
import sys

import pytest
import pytest_asyncio

# Ensure backend is importable
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Set test environment before importing app
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "patrimonio_vivo_test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("LOG_LEVEL", "WARNING")

import httpx

# Try to import the rate limiter store so we can reset it between tests
try:
    from rate_limiter import _store as _rate_limit_store
    _RATE_LIMITER_AVAILABLE = True
except Exception:
    _RATE_LIMITER_AVAILABLE = False
    _rate_limit_store = None

# Try to import the app
try:
    from server import app  # noqa: E402
    APP_AVAILABLE = True
except Exception as exc:
    APP_AVAILABLE = False
    app = None
    _import_error = str(exc)

# Check if MongoDB is reachable
MONGO_OK = False
if APP_AVAILABLE:
    try:
        from pymongo import MongoClient
        _mc = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=2000)
        _mc.admin.command("ping")
        MONGO_OK = True
        _mc.close()
    except Exception:
        pass

requires_db = pytest.mark.skipif(not MONGO_OK, reason="MongoDB not available")

# Whether an external server URL is configured for integration tests
_EXT_URL = os.environ.get("REACT_APP_BACKEND_URL", "").strip()


def pytest_collection_modifyitems(config, items):
    """Auto-skip old-style integration tests that use `requests` against an external server
    when no REACT_APP_BACKEND_URL is configured."""
    if _EXT_URL:
        return  # External server available, run everything

    skip_marker = pytest.mark.skip(
        reason="Integration test — set REACT_APP_BACKEND_URL to run"
    )
    for item in items:
        # Only skip sync tests that use the `requests` library (not our async ASGI tests)
        if item.get_closest_marker("anyio"):
            continue
        try:
            source = item.fspath.read_text(encoding="utf-8")
            if "import requests" in source and (
                "requests.get(" in source
                or "requests.post(" in source
                or "requests.put(" in source
                or "requests.delete(" in source
                or "requests.Session(" in source
            ):
                item.add_marker(skip_marker)
        except Exception:
            pass


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset the in-memory rate limiter store before each test to prevent
    accumulated request counts from triggering 429 responses in the test suite."""
    if _RATE_LIMITER_AVAILABLE and _rate_limit_store is not None:
        _rate_limit_store._store.clear()


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def client():
    """Async test client that talks to the FastAPI app in-process (no running server).

    Session-scoped with an explicit session loop_scope so the Motor client (created
    once at server import) stays on the same event loop for the entire test run,
    regardless of asyncio_default_fixture_loop_scope ini settings.
    """
    if not APP_AVAILABLE:
        pytest.skip(f"App import failed: {_import_error}")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c
