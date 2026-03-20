#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for Património Vivo de Portugal
Coverage: Auth, Gamification, Routes, Nearby, Discovery, Encyclopedia, Marine/Weather, Search
Following same pattern as backend_test.py (httpx async + TestResults)
"""

import pytest

# This is a standalone integration test script (run via __main__), not a pytest suite.
# Skip collection to avoid fixture/parameter conflicts with conftest.py.
pytestmark = pytest.mark.skip(reason="Standalone integration script — run directly with python")

import httpx
import asyncio
import uuid
from datetime import datetime

BASE_URL = "https://current-state-check.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"


class TestResults:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []

    def record_test(self, test_name, passed, message=""):
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"  ✅ {test_name}")
        else:
            self.tests_failed += 1
            self.failures.append(f"{test_name}: {message}")
            print(f"  ❌ {test_name}: {message}")

    def summary(self):
        print(f"\n{'='*60}")
        print(f"Tests Run: {self.tests_run}")
        print(f"Passed:    {self.tests_passed}")
        print(f"Failed:    {self.tests_failed}")
        if self.failures:
            print("\nFailures:")
            for f in self.failures:
                print(f"  - {f}")
        return self.tests_failed == 0


# ============================================================
# 1. AUTHENTICATION (6 tests)
# ============================================================
async def test_auth(client: httpx.AsyncClient, results: TestResults):
    print("\n🔐 1. AUTHENTICATION")

    test_email = f"testuser_{uuid.uuid4().hex[:8]}@test.com"
    test_password = "TestPass123!"
    test_name = "Teste Automatizado"
    session_token = None

    # 1.1 Register with valid credentials -> 200 + user data
    try:
        r = await client.post(f"{API_BASE}/auth/register", json={
            "email": test_email, "password": test_password, "name": test_name
        })
        passed = r.status_code == 200
        data = r.json() if passed else {}
        results.record_test(
            "Register - valid credentials -> 200",
            passed and "user_id" in data and "message" in data,
            f"status={r.status_code}, body={r.text[:200]}"
        )
    except Exception as e:
        results.record_test("Register - valid credentials -> 200", False, str(e))

    # 1.2 Register with duplicate email -> 400
    try:
        r = await client.post(f"{API_BASE}/auth/register", json={
            "email": test_email, "password": test_password, "name": test_name
        })
        results.record_test(
            "Register - duplicate email -> 400",
            r.status_code == 400,
            f"status={r.status_code}"
        )
    except Exception as e:
        results.record_test("Register - duplicate email -> 400", False, str(e))

    # 1.3 Login with valid credentials -> 200 + token
    try:
        r = await client.post(f"{API_BASE}/auth/login", json={
            "email": test_email, "password": test_password
        })
        passed = r.status_code == 200
        data = r.json() if passed else {}
        has_token = "session_token" in data
        has_user = "user" in data
        if has_token:
            session_token = data["session_token"]
        results.record_test(
            "Login - valid credentials -> 200 + token + user",
            passed and has_token and has_user,
            f"status={r.status_code}, has_token={has_token}, has_user={has_user}"
        )
    except Exception as e:
        results.record_test("Login - valid credentials -> 200 + token + user", False, str(e))

    # 1.4 Login with wrong password -> 401
    try:
        r = await client.post(f"{API_BASE}/auth/login", json={
            "email": test_email, "password": "wrongpassword"
        })
        results.record_test(
            "Login - wrong password -> 401",
            r.status_code == 401,
            f"status={r.status_code}"
        )
    except Exception as e:
        results.record_test("Login - wrong password -> 401", False, str(e))

    # 1.5 GET /auth/me with valid token -> 200 + user
    try:
        r = await client.get(
            f"{API_BASE}/auth/me",
            cookies={"session_token": session_token} if session_token else {}
        )
        passed = r.status_code == 200
        data = r.json() if passed else {}
        results.record_test(
            "Auth/me - valid token -> 200 + user",
            passed and "email" in data and data.get("email") == test_email,
            f"status={r.status_code}, email={data.get('email')}"
        )
    except Exception as e:
        results.record_test("Auth/me - valid token -> 200 + user", False, str(e))

    # 1.6 Logout -> 200
    try:
        r = await client.post(
            f"{API_BASE}/auth/logout",
            cookies={"session_token": session_token} if session_token else {}
        )
        results.record_test(
            "Logout -> 200",
            r.status_code == 200,
            f"status={r.status_code}"
        )
    except Exception as e:
        results.record_test("Logout -> 200", False, str(e))


# ============================================================
# 2. GAMIFICATION (4 tests)
# ============================================================
async def test_gamification(client: httpx.AsyncClient, results: TestResults):
    print("\n🎮 2. GAMIFICATION")

    test_user = f"testuser_{uuid.uuid4().hex[:8]}"

    # 2.1 Checkin with coordinates near a POI
    # First get a nearby POI to use
    try:
        r = await client.get(f"{API_BASE}/gamification/nearby-checkins", params={
            "lat": 40.2033, "lng": -8.4103, "radius_km": 50
        })
        passed = r.status_code == 200
        data = r.json() if passed else {}
        pois = data.get("pois", [])
        poi_id = pois[0]["id"] if pois else None

        if poi_id and pois[0].get("can_checkin"):
            poi_loc = pois[0].get("location", {})
            r2 = await client.post(f"{API_BASE}/gamification/checkin", json={
                "user_lat": poi_loc.get("lat", 40.2033),
                "user_lng": poi_loc.get("lng", -8.4103),
                "poi_id": poi_id
            })
            data2 = r2.json() if r2.status_code == 200 else {}
            # Accept both first-checkin (xp_earned) and already-checked-in (success=false)
            valid = ("xp_earned" in data2) or (data2.get("success") is False and "message" in data2)
            results.record_test(
                "Checkin - near POI -> valid response",
                r2.status_code == 200 and valid,
                f"status={r2.status_code}, body={r2.text[:200]}"
            )
        elif poi_id:
            # POI found but not within checkin range, still test the endpoint
            r2 = await client.post(f"{API_BASE}/gamification/checkin", json={
                "user_lat": 40.2033, "user_lng": -8.4103, "poi_id": poi_id
            })
            # Expect 400 (too far) or 200 (success) - both are valid endpoint responses
            results.record_test(
                "Checkin - endpoint responds correctly",
                r2.status_code in [200, 400],
                f"status={r2.status_code}, body={r2.text[:200]}"
            )
        else:
            results.record_test("Checkin - near POI -> success", False, "No POIs found nearby")
    except Exception as e:
        results.record_test("Checkin - near POI -> success", False, str(e))

    # 2.2 GET profile with badges and stats
    try:
        r = await client.get(f"{API_BASE}/gamification/profile/{test_user}")
        passed = r.status_code == 200
        data = r.json() if passed else {}
        required = ["user_id", "total_checkins", "level", "xp", "badges", "recent_checkins"]
        missing = [f for f in required if f not in data]
        results.record_test(
            "Profile - returns badges + stats",
            passed and not missing and isinstance(data.get("badges"), list),
            f"status={r.status_code}, missing={missing}"
        )
    except Exception as e:
        results.record_test("Profile - returns badges + stats", False, str(e))

    # 2.3 GET nearby-checkins with lat/lng
    try:
        r = await client.get(f"{API_BASE}/gamification/nearby-checkins", params={
            "lat": 40.2033, "lng": -8.4103, "radius_km": 10
        })
        passed = r.status_code == 200
        data = r.json() if passed else {}
        pois = data.get("pois", [])
        valid_structure = all(
            isinstance(p.get("id"), str) and "distance_m" in p and "can_checkin" in p
            for p in pois[:3]
        ) if pois else True
        results.record_test(
            "Nearby-checkins - returns POIs with distance + can_checkin",
            passed and "pois" in data and "total_nearby" in data and valid_structure,
            f"status={r.status_code}, count={len(pois)}"
        )
    except Exception as e:
        results.record_test("Nearby-checkins - returns POIs with distance + can_checkin", False, str(e))

    # 2.4 GET leaderboard
    try:
        r = await client.get(f"{API_BASE}/gamification/leaderboard")
        passed = r.status_code == 200
        data = r.json() if passed else {}
        lb = data.get("leaderboard", [])
        valid_entry = all(
            "rank" in e and "user_id" in e and "xp" in e
            for e in lb[:3]
        ) if lb else True
        results.record_test(
            "Leaderboard - sorted list with rank/xp",
            passed and "leaderboard" in data and valid_entry,
            f"status={r.status_code}, entries={len(lb)}"
        )
    except Exception as e:
        results.record_test("Leaderboard - sorted list with rank/xp", False, str(e))


# ============================================================
# 3. ADVANCED ROUTES (3 tests)
# ============================================================
async def test_routes(client: httpx.AsyncClient, results: TestResults):
    print("\n🗺️  3. ADVANCED ROUTES")

    # 3.1 POST /routes/plan Lisboa -> Porto
    try:
        r = await client.post(f"{API_BASE}/routes/plan", json={
            "origin": "Lisboa", "destination": "Porto"
        })
        passed = r.status_code == 200
        data = r.json() if passed else {}
        required = ["origin", "destination", "suggested_stops", "total_distance_km"]
        missing = [f for f in required if f not in data]
        stops = data.get("suggested_stops", [])
        results.record_test(
            "Route plan Lisboa->Porto -> route with suggested_stops",
            passed and not missing and isinstance(stops, list),
            f"status={r.status_code}, missing={missing}, stops={len(stops)}"
        )
    except Exception as e:
        results.record_test("Route plan Lisboa->Porto -> route with stops", False, str(e))

    # 3.2 GET /routes-smart/generate with theme and region
    try:
        r = await client.get(f"{API_BASE}/routes-smart/generate", params={
            "theme": "natureza", "region": "centro", "max_pois": 5
        })
        passed = r.status_code == 200
        data = r.json() if passed else {}
        has_pois = isinstance(data.get("pois"), list) and len(data.get("pois", [])) > 0
        has_name = isinstance(data.get("route_name"), str)
        results.record_test(
            "Smart route generate - theme + region -> route with pois",
            passed and has_pois and has_name,
            f"status={r.status_code}, route={data.get('route_name')}, pois={len(data.get('pois', []))}"
        )
    except Exception as e:
        results.record_test("Smart route generate - theme + region -> route", False, str(e))

    # 3.3 GET /routes-smart/themes -> list of themes
    try:
        r = await client.get(f"{API_BASE}/routes-smart/themes")
        passed = r.status_code == 200
        data = r.json() if passed else {}
        themes = data.get("themes", [])
        valid_theme = all("id" in t and "name" in t and "poi_count" in t for t in themes[:3]) if themes else False
        results.record_test(
            "Smart route themes -> list with id/name/poi_count",
            passed and "themes" in data and len(themes) > 0 and valid_theme,
            f"status={r.status_code}, themes={len(themes)}"
        )
    except Exception as e:
        results.record_test("Smart route themes -> list with id/name", False, str(e))


# ============================================================
# 4. NEARBY POIs (2 tests)
# ============================================================
async def test_nearby(client: httpx.AsyncClient, results: TestResults):
    print("\n📍 4. NEARBY POIs")

    # 4.1 POST /nearby with Coimbra coordinates
    try:
        r = await client.post(f"{API_BASE}/nearby", json={
            "latitude": 40.2033, "longitude": -8.4103, "radius_km": 50
        })
        passed = r.status_code == 200
        data = r.json() if passed else {}
        pois = data.get("pois", [])
        has_distance = all("distance_km" in p for p in pois[:3]) if pois else True
        results.record_test(
            "Nearby Coimbra 50km -> POIs with distance_km",
            passed and "pois" in data and "total_found" in data and has_distance,
            f"status={r.status_code}, found={data.get('total_found', 0)}"
        )
    except Exception as e:
        results.record_test("Nearby Coimbra 50km -> POIs with distance_km", False, str(e))

    # 4.2 GET /nearby/categories
    try:
        r = await client.get(f"{API_BASE}/nearby/categories", params={
            "latitude": 40.2033, "longitude": -8.4103, "radius_km": 50
        })
        passed = r.status_code == 200
        data = r.json() if passed else {}
        cats = data.get("categories", [])
        valid_cat = all("category" in c and "count" in c for c in cats[:3]) if cats else True
        results.record_test(
            "Nearby categories -> category counts",
            passed and "categories" in data and "total_pois" in data and valid_cat,
            f"status={r.status_code}, categories={len(cats)}, total={data.get('total_pois', 0)}"
        )
    except Exception as e:
        results.record_test("Nearby categories -> category counts", False, str(e))


# ============================================================
# 5. DISCOVERY (3 tests)
# ============================================================
async def test_discovery(client: httpx.AsyncClient, results: TestResults):
    print("\n🔍 5. DISCOVERY")

    # 5.1 POST /discover/feed
    try:
        r = await client.post(f"{API_BASE}/discover/feed", json={"limit": 10})
        passed = r.status_code == 200
        data = r.json() if passed else {}
        items = data.get("items", [])
        results.record_test(
            "Discovery feed -> items list",
            passed and "items" in data and isinstance(items, list) and "generated_at" in data,
            f"status={r.status_code}, items={len(items)}"
        )
    except Exception as e:
        results.record_test("Discovery feed -> items list", False, str(e))

    # 5.2 GET /discover/trending
    try:
        r = await client.get(f"{API_BASE}/discover/trending")
        passed = r.status_code == 200
        data = r.json() if passed else {}
        results.record_test(
            "Trending -> items + period",
            passed and "items" in data and "period" in data,
            f"status={r.status_code}, items={len(data.get('items', []))}"
        )
    except Exception as e:
        results.record_test("Trending -> items + period", False, str(e))

    # 5.3 GET /discover/seasonal
    try:
        r = await client.get(f"{API_BASE}/discover/seasonal")
        passed = r.status_code == 200
        data = r.json() if passed else {}
        required = ["season", "events", "recommended_items", "categories_in_focus"]
        missing = [f for f in required if f not in data]
        results.record_test(
            "Seasonal -> season + events + items",
            passed and not missing,
            f"status={r.status_code}, missing={missing}, season={data.get('season')}"
        )
    except Exception as e:
        results.record_test("Seasonal -> season + events + items", False, str(e))


# ============================================================
# 6. ENCYCLOPEDIA (3 tests)
# ============================================================
async def test_encyclopedia(client: httpx.AsyncClient, results: TestResults):
    print("\n📚 6. ENCYCLOPEDIA")

    # 6.1 GET /encyclopedia/universes -> 6 universes
    universe_id = None
    try:
        r = await client.get(f"{API_BASE}/encyclopedia/universes")
        passed = r.status_code == 200
        data = r.json() if passed else []
        is_list = isinstance(data, list)
        has_six = len(data) == 6 if is_list else False
        valid_item = all("id" in u and "name" in u for u in data[:3]) if is_list and data else True
        if is_list and data:
            universe_id = data[0]["id"]
        results.record_test(
            "Universes -> 6 universes with id/name",
            passed and is_list and has_six and valid_item,
            f"status={r.status_code}, count={len(data) if is_list else 'not list'}"
        )
    except Exception as e:
        results.record_test("Universes -> 6 universes with id/name", False, str(e))

    # 6.2 GET /encyclopedia/universe/{id} -> detail with articles
    try:
        uid = universe_id or "patrimonio-arquitetonico"
        r = await client.get(f"{API_BASE}/encyclopedia/universe/{uid}")
        passed = r.status_code == 200
        data = r.json() if passed else {}
        required = ["id", "name", "articles", "featured_items"]
        missing = [f for f in required if f not in data]
        results.record_test(
            "Universe detail -> articles + featured_items",
            passed and not missing,
            f"status={r.status_code}, missing={missing}, articles={len(data.get('articles', []))}"
        )
    except Exception as e:
        results.record_test("Universe detail -> articles + featured_items", False, str(e))

    # 6.3 GET /encyclopedia/search?q=termas
    try:
        r = await client.get(f"{API_BASE}/encyclopedia/search", params={"q": "termas"})
        passed = r.status_code == 200
        data = r.json() if passed else {}
        required = ["query", "articles", "items", "total"]
        missing = [f for f in required if f not in data]
        results.record_test(
            "Encyclopedia search 'termas' -> results",
            passed and not missing and isinstance(data.get("total"), int),
            f"status={r.status_code}, missing={missing}, total={data.get('total', 0)}"
        )
    except Exception as e:
        results.record_test("Encyclopedia search 'termas' -> results", False, str(e))


# ============================================================
# 7. MARINE / WEATHER (4 tests)
# ============================================================
async def test_marine_weather(client: httpx.AsyncClient, results: TestResults):
    print("\n🌊 7. MARINE / WEATHER")

    # 7.1 GET /marine/waves
    try:
        r = await client.get(f"{API_BASE}/marine/waves", params={"lat": 38.7, "lng": -9.4})
        passed = r.status_code == 200
        data = r.json() if passed else {}
        # API may return available=False or actual wave data
        results.record_test(
            "Marine waves -> response with data or available flag",
            passed and isinstance(data, dict),
            f"status={r.status_code}, keys={list(data.keys())[:5]}"
        )
    except Exception as e:
        results.record_test("Marine waves -> response with data or available flag", False, str(e))

    # 7.2 GET /marine/spots
    try:
        r = await client.get(f"{API_BASE}/marine/spots")
        passed = r.status_code == 200
        data = r.json() if passed else {}
        spots = data.get("spots", [])
        valid_spot = all("id" in s and "name" in s for s in spots[:3]) if spots else True
        results.record_test(
            "Marine spots -> list of surf spots",
            passed and "spots" in data and "total" in data and valid_spot,
            f"status={r.status_code}, total={data.get('total', 0)}"
        )
    except Exception as e:
        results.record_test("Marine spots -> list of surf spots", False, str(e))

    # 7.3 GET /weather/alerts
    try:
        r = await client.get(f"{API_BASE}/weather/alerts")
        passed = r.status_code == 200
        data = r.json() if passed else {}
        required = ["alerts", "total", "source"]
        missing = [f for f in required if f not in data]
        results.record_test(
            "Weather alerts -> alerts + total + source",
            passed and not missing and isinstance(data.get("alerts"), list),
            f"status={r.status_code}, missing={missing}, alerts={data.get('total', 0)}"
        )
    except Exception as e:
        results.record_test("Weather alerts -> alerts + total + source", False, str(e))

    # 7.4 GET /safety/check
    try:
        r = await client.get(f"{API_BASE}/safety/check", params={"lat": 38.7, "lng": -9.1})
        passed = r.status_code == 200
        data = r.json() if passed else {}
        required = ["safety_level", "message", "weather_alerts", "nearby_fires", "checked_at"]
        missing = [f for f in required if f not in data]
        valid_level = data.get("safety_level") in ["safe", "warning", "danger"]
        results.record_test(
            "Safety check -> safety_level + alerts + fires",
            passed and not missing and valid_level,
            f"status={r.status_code}, level={data.get('safety_level')}, missing={missing}"
        )
    except Exception as e:
        results.record_test("Safety check -> safety_level + alerts + fires", False, str(e))


# ============================================================
# 8. SEARCH (2 tests)
# ============================================================
async def test_search(client: httpx.AsyncClient, results: TestResults):
    print("\n🔎 8. SEARCH")

    # 8.1 POST /search with query 'termas'
    try:
        r = await client.post(f"{API_BASE}/search", json={"query": "termas"})
        passed = r.status_code == 200
        data = r.json() if passed else {}
        required = ["results", "total", "query"]
        missing = [f for f in required if f not in data]
        items = data.get("results", [])
        valid_item = all("name" in i and "id" in i for i in items[:3]) if items else True
        results.record_test(
            "Search 'termas' -> grouped results with name/id",
            passed and not missing and valid_item,
            f"status={r.status_code}, missing={missing}, total={data.get('total', 0)}"
        )
    except Exception as e:
        results.record_test("Search 'termas' -> grouped results with name/id", False, str(e))

    # 8.2 GET /search/suggestions?q=ter
    try:
        r = await client.get(f"{API_BASE}/search/suggestions", params={"q": "ter"})
        passed = r.status_code == 200
        data = r.json() if passed else {}
        suggestions = data.get("suggestions", [])
        valid_sug = all("type" in s and "text" in s for s in suggestions[:3]) if suggestions else True
        results.record_test(
            "Search suggestions 'ter' -> suggestions with type/text",
            passed and "suggestions" in data and valid_sug,
            f"status={r.status_code}, suggestions={len(suggestions)}"
        )
    except Exception as e:
        results.record_test("Search suggestions 'ter' -> suggestions with type/text", False, str(e))


# ============================================================
# MAIN
# ============================================================
async def main():
    print(f"{'='*60}")
    print("  Património Vivo - Comprehensive API Tests")
    print(f"  Base: {BASE_URL}")
    print(f"  Started: {datetime.now().isoformat()}")
    print(f"{'='*60}")

    results = TestResults()

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        await test_auth(client, results)
        await test_gamification(client, results)
        await test_routes(client, results)
        await test_nearby(client, results)
        await test_discovery(client, results)
        await test_encyclopedia(client, results)
        await test_marine_weather(client, results)
        await test_search(client, results)

    success = results.summary()
    print(f"\nFinished: {datetime.now().isoformat()}")

    if success:
        print("🎉 All tests passed!")
    else:
        print("💥 Some tests failed.")

    return 0 if success else 1


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))
