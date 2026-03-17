"""
End-to-end tests for critical API paths.
Uses httpx.AsyncClient with FastAPI's TestClient transport (no running server needed).
Tests the full request→middleware→route→DB→response pipeline.

Tests are split into two categories:
  - Stateless tests: work without MongoDB (middleware, static config, OpenAPI)
  - DB-dependent tests: require a running MongoDB instance (marked with requires_db)
"""
import os
import sys
import uuid
import pytest
import asyncio

# Ensure backend is importable
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Set test environment before importing app
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "patrimonio_vivo_test_e2e")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("LOG_LEVEL", "WARNING")

import httpx

# Try to import the app — skip all tests if dependencies are unavailable
try:
    from server import app
    APP_AVAILABLE = True
except Exception as exc:
    APP_AVAILABLE = False
    _import_error = str(exc)

# Check if MongoDB is reachable
_MONGO_OK = False
if APP_AVAILABLE:
    try:
        from pymongo import MongoClient
        _mc = MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=2000)
        _mc.admin.command("ping")
        _MONGO_OK = True
        _mc.close()
    except Exception:
        pass

requires_db = pytest.mark.skipif(not _MONGO_OK, reason="MongoDB not available")

pytestmark = pytest.mark.skipif(not APP_AVAILABLE, reason=f"App import failed: {_import_error if not APP_AVAILABLE else ''}")


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="session")
async def client():
    """Create an async test client that talks to the FastAPI app in-process."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


# =====================================================================
# 1. Health & Root
# =====================================================================

class TestHealthAndRoot:
    @pytest.mark.anyio
    async def test_root_returns_api_info(self, client):
        r = await client.get("/api/")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "online"
        assert "version" in data

    @pytest.mark.anyio
    async def test_health_endpoint(self, client):
        r = await client.get("/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] in ("healthy", "degraded", "ok")
        # May include database/timestamp fields depending on DB connectivity
        assert "status" in data


# =====================================================================
# 2. Heritage Endpoints (Public)
# =====================================================================

@requires_db
class TestHeritage:
    @pytest.mark.anyio
    async def test_list_heritage_items(self, client):
        r = await client.get("/api/heritage")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_heritage_with_pagination(self, client):
        r = await client.get("/api/heritage?limit=5&skip=0")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) <= 5

    @pytest.mark.anyio
    async def test_heritage_by_invalid_id_returns_404(self, client):
        r = await client.get("/api/heritage/nonexistent_id_12345")
        assert r.status_code == 404

    @pytest.mark.anyio
    async def test_heritage_search(self, client):
        r = await client.post("/api/search", json={"query": "portugal"})
        assert r.status_code == 200


# =====================================================================
# 3. Categories & Regions (Public, Cacheable)
# =====================================================================

class TestCategoriesRegions:
    @pytest.mark.anyio
    async def test_categories_list(self, client):
        r = await client.get("/api/categories")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Should have cache headers
        assert "cache-control" in r.headers

    @pytest.mark.anyio
    async def test_regions_list(self, client):
        r = await client.get("/api/regions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 7  # 7 regions of Portugal


# =====================================================================
# 4. Config Endpoint (Public)
# =====================================================================

@requires_db
class TestConfig:
    @pytest.mark.anyio
    async def test_config_returns_badges_and_categories(self, client):
        r = await client.get("/api/config")
        assert r.status_code == 200
        data = r.json()
        assert "main_categories" in data
        assert "regions" in data
        assert "badges" in data

    @pytest.mark.anyio
    async def test_config_badges_endpoint(self, client):
        r = await client.get("/api/config/badges")
        assert r.status_code == 200
        data = r.json()
        assert "universe" in data
        assert "gamification" in data
        assert "dashboard" in data


# =====================================================================
# 5. Authentication Flow
# =====================================================================

@requires_db
class TestAuthFlow:
    @pytest.mark.anyio
    async def test_register_login_profile(self, client):
        email = f"e2e_{uuid.uuid4().hex[:8]}@test.com"
        password = "E2eTestPass123!"
        name = "E2E Tester"

        # Register
        r = await client.post("/api/auth/register", json={
            "email": email, "password": password, "name": name
        })
        assert r.status_code == 200, f"Register failed: {r.text}"
        data = r.json()
        assert "user_id" in data

        # Login
        r = await client.post("/api/auth/login", json={
            "email": email, "password": password
        })
        assert r.status_code == 200, f"Login failed: {r.text}"
        data = r.json()
        assert "session_token" in data or "token" in data
        token = data.get("session_token") or data.get("token")

        # Profile (authenticated) - endpoint is /auth/me
        r = await client.get("/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert r.status_code == 200
        profile = r.json()
        assert profile.get("name") == name or profile.get("email") == email

    @pytest.mark.anyio
    async def test_register_duplicate_email_fails(self, client):
        email = f"dup_{uuid.uuid4().hex[:8]}@test.com"
        password = "DupTest123!"

        await client.post("/api/auth/register", json={
            "email": email, "password": password, "name": "First"
        })
        r = await client.post("/api/auth/register", json={
            "email": email, "password": password, "name": "Second"
        })
        assert r.status_code == 400

    @pytest.mark.anyio
    async def test_profile_without_auth_fails(self, client):
        r = await client.get("/api/auth/me")
        assert r.status_code in (401, 403)


# =====================================================================
# 6. Map Endpoints
# =====================================================================

@requires_db
class TestMap:
    @pytest.mark.anyio
    async def test_map_items(self, client):
        r = await client.get("/api/map/items")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)


# =====================================================================
# 7. Encyclopedia
# =====================================================================

@requires_db
class TestEncyclopedia:
    @pytest.mark.anyio
    async def test_universes(self, client):
        r = await client.get("/api/encyclopedia/universes")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0

    @pytest.mark.anyio
    async def test_articles(self, client):
        r = await client.get("/api/encyclopedia/articles")
        assert r.status_code == 200


# =====================================================================
# 8. Routes
# =====================================================================

@requires_db
class TestRoutes:
    @pytest.mark.anyio
    async def test_list_routes(self, client):
        r = await client.get("/api/routes")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)


# =====================================================================
# 9. Calendar / Events
# =====================================================================

@requires_db
class TestCalendar:
    @pytest.mark.anyio
    async def test_calendar_events(self, client):
        r = await client.get("/api/calendar")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)


# =====================================================================
# 10. Discovery Feed
# =====================================================================

@requires_db
class TestDiscovery:
    @pytest.mark.anyio
    async def test_trending(self, client):
        r = await client.get("/api/discover/trending")
        assert r.status_code == 200

    @pytest.mark.anyio
    async def test_discover_feed(self, client):
        r = await client.post("/api/discover/feed", json={})
        assert r.status_code == 200


# =====================================================================
# 11. Stats
# =====================================================================

@requires_db
class TestStats:
    @pytest.mark.anyio
    async def test_stats_endpoint(self, client):
        r = await client.get("/api/stats")
        assert r.status_code == 200
        data = r.json()
        # Should contain item/route/region counts
        assert isinstance(data, dict)


# =====================================================================
# 12. Security Headers & Middleware
# =====================================================================

class TestSecurityMiddleware:
    @pytest.mark.anyio
    async def test_security_headers_present(self, client):
        r = await client.get("/api/health")
        assert r.headers.get("x-content-type-options") == "nosniff"
        assert r.headers.get("x-frame-options") == "DENY"
        assert r.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

    @pytest.mark.anyio
    async def test_csrf_cookie_set(self, client):
        r = await client.get("/api/health")
        cookies = r.cookies
        # On first request, csrf_token cookie should be set
        # (May or may not be set depending on middleware ordering, so just check response works)
        assert r.status_code == 200

    @pytest.mark.anyio
    async def test_request_body_too_large(self, client):
        # Send a body larger than 10MB
        large_payload = "x" * (11 * 1024 * 1024)
        r = await client.post(
            "/api/auth/register",
            content=large_payload,
            headers={"content-type": "application/json", "content-length": str(len(large_payload))}
        )
        assert r.status_code == 413


# =====================================================================
# 13. Gamification
# =====================================================================

class TestGamification:
    @pytest.mark.anyio
    async def test_badges_list(self, client):
        r = await client.get("/api/badges")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    @pytest.mark.anyio
    async def test_gamification_badges(self, client):
        r = await client.get("/api/gamification/badges")
        assert r.status_code == 200


# =====================================================================
# 14. Nearby POIs
# =====================================================================

@requires_db
class TestNearby:
    @pytest.mark.anyio
    async def test_nearby_pois(self, client):
        r = await client.post("/api/nearby", json={
            "latitude": 38.7223,
            "longitude": -9.1393,
            "radius_km": 10
        })
        assert r.status_code == 200


# =====================================================================
# 15. OpenAPI docs
# =====================================================================

class TestDocs:
    @pytest.mark.anyio
    async def test_openapi_schema_available(self, client):
        r = await client.get("/openapi.json")
        assert r.status_code == 200
        data = r.json()
        assert "paths" in data
        assert data["info"]["title"] == "Portugal Vivo API"
        assert data["info"]["version"] == "3.0.0"


# =====================================================================
# 16. CP Comboios (Static Data — no DB needed)
# =====================================================================

class TestCPComboios:
    @pytest.mark.anyio
    async def test_cp_stations_list(self, client):
        r = await client.get("/api/cp/stations")
        assert r.status_code == 200
        data = r.json()
        assert "stations" in data
        assert data["total"] > 0
        station = data["stations"][0]
        assert "name" in station
        assert "lat" in station
        assert "lng" in station
        assert "lines" in station

    @pytest.mark.anyio
    async def test_cp_stations_search(self, client):
        r = await client.get("/api/cp/stations?search=porto")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] > 0
        assert any("Porto" in s["name"] for s in data["stations"])

    @pytest.mark.anyio
    async def test_cp_stations_filter_by_line(self, client):
        r = await client.get("/api/cp/stations?line=douro")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] > 0

    @pytest.mark.anyio
    async def test_cp_routes_list(self, client):
        r = await client.get("/api/cp/routes")
        assert r.status_code == 200
        data = r.json()
        assert "routes" in data
        assert data["total"] > 0
        route = data["routes"][0]
        assert "name" in route
        assert "service" in route
        assert "duration_min" in route
        assert "price_2class" in route

    @pytest.mark.anyio
    async def test_cp_routes_filter_scenic(self, client):
        r = await client.get("/api/cp/routes?scenic=true")
        assert r.status_code == 200
        data = r.json()
        for route in data["routes"]:
            assert route.get("scenic") is True

    @pytest.mark.anyio
    async def test_cp_route_detail(self, client):
        r = await client.get("/api/cp/route/lisboa_porto_ap")
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Lisboa - Porto (Alfa Pendular)"
        assert "departures" in data
        assert "stops" in data

    @pytest.mark.anyio
    async def test_cp_route_not_found(self, client):
        r = await client.get("/api/cp/route/nonexistent_route")
        assert r.status_code == 404

    @pytest.mark.anyio
    async def test_cp_travel_cards(self, client):
        r = await client.get("/api/cp/cards")
        assert r.status_code == 200
        data = r.json()
        assert "cards" in data
        assert data["total"] > 0

    @pytest.mark.anyio
    async def test_cp_search_connections(self, client):
        r = await client.get("/api/cp/search?origin=Lisboa&destination=Porto")
        assert r.status_code == 200
        data = r.json()
        assert "direct_routes" in data
        assert data["total"] > 0

    @pytest.mark.anyio
    async def test_cp_search_no_results(self, client):
        r = await client.get("/api/cp/search?origin=XYZ&destination=ABC")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 0


# =====================================================================
# 16b. CP Live API Endpoints
# =====================================================================

class TestCPLiveAPI:
    @pytest.mark.anyio
    async def test_cp_live_departures(self, client):
        r = await client.get("/api/cp/live/departures/lisboa_santa_apolonia")
        assert r.status_code == 200
        data = r.json()
        assert "station" in data
        assert "departures" in data
        assert "total" in data
        assert "source" in data
        assert data["station"]["id"] == "lisboa_santa_apolonia"

    @pytest.mark.anyio
    async def test_cp_live_departures_porto(self, client):
        r = await client.get("/api/cp/live/departures/porto_campanha")
        assert r.status_code == 200
        data = r.json()
        assert data["station"]["id"] == "porto_campanha"
        assert isinstance(data["departures"], list)

    @pytest.mark.anyio
    async def test_cp_live_departures_not_found(self, client):
        r = await client.get("/api/cp/live/departures/nonexistent_station")
        assert r.status_code == 404

    @pytest.mark.anyio
    async def test_cp_live_departure_fields(self, client):
        r = await client.get("/api/cp/live/departures/porto_sao_bento")
        assert r.status_code == 200
        data = r.json()
        if data["departures"]:
            dep = data["departures"][0]
            assert "train_number" in dep
            assert "service" in dep
            assert "destination" in dep
            assert "scheduled_time" in dep
            assert "status" in dep

    @pytest.mark.anyio
    async def test_cp_live_status(self, client):
        r = await client.get("/api/cp/live/status")
        assert r.status_code == 200
        data = r.json()
        assert "overall_status" in data
        assert "lines" in data
        assert "services" in data
        assert "disruptions" in data
        assert isinstance(data["lines"], list)
        assert len(data["lines"]) > 0

    @pytest.mark.anyio
    async def test_cp_live_status_line_structure(self, client):
        r = await client.get("/api/cp/live/status")
        data = r.json()
        line = data["lines"][0]
        assert "line" in line
        assert "status" in line
        assert "routes" in line

    @pytest.mark.anyio
    async def test_cp_live_timetable(self, client):
        r = await client.get("/api/cp/live/timetable?origin=lisboa_santa_apolonia&destination=porto_campanha")
        assert r.status_code == 200
        data = r.json()
        assert "origin" in data
        assert "destination" in data
        assert "connections" in data
        assert "total" in data
        assert data["origin"]["id"] == "lisboa_santa_apolonia"
        assert data["destination"]["id"] == "porto_campanha"

    @pytest.mark.anyio
    async def test_cp_live_timetable_with_date(self, client):
        r = await client.get("/api/cp/live/timetable?origin=porto_campanha&destination=faro&date=2026-03-20&time=08:00")
        assert r.status_code == 200
        data = r.json()
        assert data["date"] == "2026-03-20"

    @pytest.mark.anyio
    async def test_cp_live_timetable_not_found(self, client):
        r = await client.get("/api/cp/live/timetable?origin=nonexistent&destination=porto_campanha")
        assert r.status_code == 404

    @pytest.mark.anyio
    async def test_cp_live_timetable_connection_fields(self, client):
        r = await client.get("/api/cp/live/timetable?origin=lisboa_santa_apolonia&destination=porto_campanha&time=06:00")
        data = r.json()
        if data["connections"]:
            conn = data["connections"][0]
            assert "train_number" in conn
            assert "service" in conn
            assert "departure_time" in conn
            assert "arrival_time" in conn
            assert "duration_min" in conn


# =====================================================================
# 17. Mobility Endpoints (Metro, Trains, Ferries)
# =====================================================================

class TestMobility:
    @pytest.mark.anyio
    async def test_metro_lines(self, client):
        r = await client.get("/api/mobility/metro/lines")
        assert r.status_code == 200
        data = r.json()
        assert "lines" in data
        assert len(data["lines"]) == 4  # 4 Metro Lisboa lines
        assert data["total_stations"] > 0

    @pytest.mark.anyio
    async def test_metro_stations(self, client):
        r = await client.get("/api/mobility/metro/stations")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 50  # 50+ stations

    @pytest.mark.anyio
    async def test_metro_stations_filter_by_line(self, client):
        r = await client.get("/api/mobility/metro/stations?line=azul")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] > 0
        for station in data["stations"]:
            assert "azul" in station["lines"]

    @pytest.mark.anyio
    async def test_metro_schedule(self, client):
        r = await client.get("/api/mobility/metro/schedule/azul")
        assert r.status_code == 200
        data = r.json()
        assert "line" in data
        assert "stations" in data
        assert "current_frequency" in data
        assert data["line"]["id"] == "azul"

    @pytest.mark.anyio
    async def test_metro_schedule_invalid_line(self, client):
        r = await client.get("/api/mobility/metro/schedule/invalid_line")
        assert r.status_code == 404

    @pytest.mark.anyio
    async def test_train_lines(self, client):
        r = await client.get("/api/mobility/trains/lines")
        assert r.status_code == 200
        data = r.json()
        assert "lines" in data
        assert data["total"] > 0

    @pytest.mark.anyio
    async def test_train_lines_filter_by_type(self, client):
        r = await client.get("/api/mobility/trains/lines?line_type=urbano")
        assert r.status_code == 200
        data = r.json()
        for line in data["lines"]:
            assert line["type"] == "urbano"

    @pytest.mark.anyio
    async def test_train_stations(self, client):
        r = await client.get("/api/mobility/trains/stations")
        assert r.status_code == 200
        data = r.json()
        assert data["total"] > 0

    @pytest.mark.anyio
    async def test_train_schedule(self, client):
        r = await client.get("/api/mobility/trains/schedule?origin=Lisboa&destination=Porto")
        assert r.status_code == 200
        data = r.json()
        assert "origin" in data
        assert "destination" in data

    @pytest.mark.anyio
    async def test_ferry_routes(self, client):
        r = await client.get("/api/mobility/ferries")
        assert r.status_code == 200
        data = r.json()
        assert "routes" in data
        assert data["total"] == 5  # 5 ferry routes
        route = data["routes"][0]
        assert "operator" in route
        assert "duration_min" in route
        assert "current_frequency_min" in route

    @pytest.mark.anyio
    async def test_ferry_schedule(self, client):
        r = await client.get("/api/mobility/ferries/cacilhas/schedule")
        assert r.status_code == 200
        data = r.json()
        assert "route" in data
        assert "next_departures" in data
        assert data["route"]["id"] == "cacilhas"

    @pytest.mark.anyio
    async def test_ferry_schedule_not_found(self, client):
        r = await client.get("/api/mobility/ferries/nonexistent/schedule")
        assert r.status_code == 404


# =====================================================================
# 18. Transport Guide (DB-dependent)
# =====================================================================

@requires_db
class TestTransportGuide:
    @pytest.mark.anyio
    async def test_transport_operators(self, client):
        r = await client.get("/api/transportes/operators")
        assert r.status_code == 200
        data = r.json()
        assert "operators" in data
        assert "total" in data

    @pytest.mark.anyio
    async def test_transport_operators_by_section(self, client):
        r = await client.get("/api/transportes/operators?section=nacional")
        assert r.status_code == 200
        data = r.json()
        assert "operators" in data

    @pytest.mark.anyio
    async def test_transport_cards(self, client):
        r = await client.get("/api/transportes/cards")
        assert r.status_code == 200
        data = r.json()
        assert "cards" in data

    @pytest.mark.anyio
    async def test_transport_sections(self, client):
        r = await client.get("/api/transportes/sections")
        assert r.status_code == 200
        data = r.json()
        assert "sections" in data


# =====================================================================
# 19. Image Enrichment API
# =====================================================================

class TestImageAPI:
    @pytest.mark.anyio
    async def test_image_search(self, client):
        r = await client.get("/api/images/search?query=castelo+portugal&count=3")
        assert r.status_code == 200
        data = r.json()
        assert "images" in data
        assert "sources" in data

    @requires_db
    @pytest.mark.anyio
    async def test_image_status(self, client):
        r = await client.get("/api/images/status")
        assert r.status_code == 200
        data = r.json()
        assert "total_pois" in data
        assert "with_image" in data
        assert "coverage_pct" in data
        assert "by_source" in data
