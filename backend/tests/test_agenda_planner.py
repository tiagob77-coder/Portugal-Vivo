"""
Test suite for Agenda Viral and Smart Travel Planner APIs.

Tests run against the local FastAPI app via ASGI transport (no external server).
Requires MongoDB — skipped automatically when DB is unavailable.
Tests verify endpoint contract (status codes, response shape) without requiring seed data.
"""
import pytest
from conftest import requires_db


pytestmark = [pytest.mark.anyio, requires_db]


class TestAgendaStats:
    """Tests for /api/agenda/stats endpoint"""

    async def test_stats_returns_200(self, client):
        """Verify stats endpoint responds"""
        response = await client.get("/api/agenda/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data

    async def test_stats_breakdown_fields(self, client):
        """Verify breakdown fields exist"""
        response = await client.get("/api/agenda/stats")
        assert response.status_code == 200
        data = response.json()
        assert "festas" in data
        assert "festivais" in data
        assert data["festas"] + data["festivais"] == data["total"]

    async def test_stats_by_region_exists(self, client):
        """Verify region breakdown is returned"""
        response = await client.get("/api/agenda/stats")
        assert response.status_code == 200
        data = response.json()
        assert "by_region" in data
        assert isinstance(data["by_region"], list)
        # If there is data, verify structure
        if data["by_region"]:
            region = data["by_region"][0]
            assert "region" in region
            assert "count" in region

    async def test_stats_by_rarity_exists(self, client):
        """Verify rarity breakdown is returned"""
        response = await client.get("/api/agenda/stats")
        assert response.status_code == 200
        data = response.json()
        assert "by_rarity" in data
        assert isinstance(data["by_rarity"], (list, dict))


class TestAgendaCalendar:
    """Tests for /api/agenda/calendar endpoint"""

    async def test_calendar_returns_12_months(self, client):
        """Verify calendar returns exactly 12 months"""
        response = await client.get("/api/agenda/calendar")
        assert response.status_code == 200
        data = response.json()
        assert "months" in data
        assert len(data["months"]) == 12

    async def test_calendar_month_structure(self, client):
        """Verify each month has required fields"""
        response = await client.get("/api/agenda/calendar")
        assert response.status_code == 200
        data = response.json()
        for month in data["months"]:
            assert "month" in month
            assert "name" in month
            assert "total" in month
            assert "festas" in month
            assert "festivais" in month
            assert "events" in month

    async def test_calendar_months_numbered_1_to_12(self, client):
        """Verify months are numbered 1-12"""
        response = await client.get("/api/agenda/calendar")
        assert response.status_code == 200
        data = response.json()
        month_numbers = [m["month"] for m in data["months"]]
        assert month_numbers == list(range(1, 13))

    async def test_calendar_total_events_returned(self, client):
        """Verify total_events field is returned"""
        response = await client.get("/api/agenda/calendar")
        assert response.status_code == 200
        data = response.json()
        assert "total_events" in data


class TestAgendaEvents:
    """Tests for /api/agenda/events endpoint"""

    async def test_events_default_returns_200(self, client):
        """Verify default call returns 200 with expected shape"""
        response = await client.get("/api/agenda/events")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert "total" in data
        assert isinstance(data["events"], list)

    async def test_events_filter_by_type_festival(self, client):
        """Verify type=festival filter works"""
        response = await client.get("/api/agenda/events?type=festival&limit=100")
        assert response.status_code == 200
        data = response.json()
        for event in data["events"]:
            assert event["type"] == "festival"

    async def test_events_filter_by_type_festa(self, client):
        """Verify type=festa filter works"""
        response = await client.get("/api/agenda/events?type=festa&limit=200")
        assert response.status_code == 200
        data = response.json()
        for event in data["events"]:
            assert event["type"] == "festa"

    async def test_events_filter_by_region(self, client):
        """Verify region filter works"""
        response = await client.get("/api/agenda/events?region=Norte&limit=100")
        assert response.status_code == 200
        data = response.json()
        for event in data["events"]:
            assert "Norte" in event.get("region", "")

    async def test_events_structure(self, client):
        """Verify event structure has required fields"""
        response = await client.get("/api/agenda/events?limit=5")
        assert response.status_code == 200
        data = response.json()
        if data["events"]:
            event = data["events"][0]
            assert "id" in event
            assert "type" in event
            assert "name" in event

    async def test_events_limit_parameter(self, client):
        """Verify limit parameter works"""
        response = await client.get("/api/agenda/events?limit=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data["events"]) <= 10


class TestAgendaExpedicao:
    """Tests for /api/agenda/expedicao endpoint"""

    async def test_expedicao_returns_stages(self, client):
        """Verify expedition returns stages"""
        response = await client.get("/api/agenda/expedicao")
        assert response.status_code == 200
        data = response.json()
        assert "stages" in data
        assert "total" in data
        assert len(data["stages"]) == data["total"]

    async def test_expedicao_stage_structure(self, client):
        """Verify each stage has required fields"""
        response = await client.get("/api/agenda/expedicao")
        assert response.status_code == 200
        data = response.json()
        for stage in data["stages"]:
            assert "id" in stage
            assert "phase" in stage
            assert "stage" in stage
            assert "main_location" in stage
            assert "highlights" in stage

    async def test_expedicao_has_multiple_phases(self, client):
        """Verify expedition has multiple phases"""
        response = await client.get("/api/agenda/expedicao")
        assert response.status_code == 200
        data = response.json()
        phases = set(s["phase"] for s in data["stages"])
        assert len(phases) >= 4


class TestPlannerSuggest:
    """Tests for /api/planner/suggest endpoint"""

    async def test_suggest_returns_itinerary(self, client):
        """Verify suggest returns itinerary"""
        response = await client.get(
            "/api/planner/suggest?region=Lisboa&days=3&interests=cultura"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["region"] == "Lisboa"
        assert data["days"] == 3
        assert "itinerary" in data

    async def test_suggest_daily_plan_structure(self, client):
        """Verify daily plan has morning and afternoon POIs"""
        response = await client.get(
            "/api/planner/suggest?region=Lisboa&days=3&interests=cultura"
        )
        assert response.status_code == 200
        data = response.json()
        for day in data["itinerary"]:
            assert "day" in day
            assert "theme" in day
            assert "morning" in day
            assert "afternoon" in day

    async def test_suggest_transport_info_returned(self, client):
        """Verify transport information is returned"""
        response = await client.get(
            "/api/planner/suggest?region=Lisboa&days=3&interests=cultura"
        )
        assert response.status_code == 200
        data = response.json()
        assert "transport" in data

    async def test_suggest_region_norte(self, client):
        """Verify suggest works for Norte region"""
        response = await client.get(
            "/api/planner/suggest?region=Norte&days=2&interests=historia"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["region"] == "Norte"
        assert data["days"] == 2

    async def test_suggest_center_coordinates(self, client):
        """Verify center coordinates for map are returned"""
        response = await client.get(
            "/api/planner/suggest?region=Lisboa&days=3&interests=cultura"
        )
        assert response.status_code == 200
        data = response.json()
        assert "center" in data


class TestPlannerRegions:
    """Tests for /api/planner/regions endpoint"""

    async def test_regions_returns_list(self, client):
        """Verify regions endpoint returns region list"""
        response = await client.get("/api/planner/regions")
        assert response.status_code == 200
        data = response.json()
        assert "regions" in data
        assert isinstance(data["regions"], list)

    async def test_regions_have_counts(self, client):
        """Verify each region has POI count"""
        response = await client.get("/api/planner/regions")
        assert response.status_code == 200
        data = response.json()
        for region in data["regions"]:
            assert "id" in region
            assert "count" in region

    async def test_regions_structure(self, client):
        """Verify main regions endpoint works"""
        response = await client.get("/api/planner/regions")
        assert response.status_code == 200
        data = response.json()
        assert "regions" in data
