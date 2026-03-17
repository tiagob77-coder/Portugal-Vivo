"""
Test Collections API and Heritage API endpoints.
Runs against the local FastAPI app via ASGI transport.
Requires MongoDB — skipped automatically when DB is unavailable.
"""
import pytest
from conftest import requires_db


pytestmark = [pytest.mark.anyio, requires_db]


class TestCollectionsOverview:
    """Test /api/collections/overview endpoint"""

    async def test_overview_returns_groups(self, client):
        """Verify overview returns groups"""
        response = await client.get("/api/collections/overview")
        assert response.status_code == 200
        data = response.json()
        assert "groups" in data
        assert len(data["groups"]) > 0

    async def test_overview_returns_collections(self, client):
        """Verify overview returns collections"""
        response = await client.get("/api/collections/overview")
        assert response.status_code == 200
        data = response.json()
        assert "collections" in data
        assert len(data["collections"]) > 0

    async def test_overview_total_items(self, client):
        """Verify total_items is returned"""
        response = await client.get("/api/collections/overview")
        assert response.status_code == 200
        data = response.json()
        assert "total_items" in data

    async def test_overview_group_structure(self, client):
        """Verify group structure has id, label, icon, color, collections, total"""
        response = await client.get("/api/collections/overview")
        assert response.status_code == 200
        data = response.json()
        for group in data["groups"]:
            assert "id" in group
            assert "label" in group
            assert "icon" in group
            assert "color" in group
            assert "collections" in group
            assert "total" in group

    async def test_overview_collection_structure(self, client):
        """Verify collection structure has id, label, icon, color, group, count"""
        response = await client.get("/api/collections/overview")
        assert response.status_code == 200
        data = response.json()
        for col in data["collections"]:
            assert "id" in col
            assert "label" in col
            assert "icon" in col
            assert "color" in col
            assert "group" in col
            assert "count" in col

    async def test_overview_groups_match_expected(self, client):
        """Verify expected groups are present"""
        response = await client.get("/api/collections/overview")
        assert response.status_code == 200
        data = response.json()
        group_ids = [g["id"] for g in data["groups"]]
        expected = ["patrimonio", "gastronomia", "natureza", "cultura", "aventura"]
        assert sorted(group_ids) == sorted(expected)


class TestCollectionsBrowse:
    """Test /api/collections/browse/{collection_id} endpoint"""

    async def test_browse_castelos(self, client):
        """Verify browsing castelos collection returns items"""
        response = await client.get("/api/collections/browse/castelos")
        assert response.status_code == 200
        data = response.json()
        assert "collection" in data
        assert data["collection"]["id"] == "castelos"
        assert "items" in data
        assert "total" in data

    async def test_browse_invalid_collection(self, client):
        """Verify invalid collection returns 404"""
        response = await client.get("/api/collections/browse/invalid_collection")
        assert response.status_code == 404

    async def test_browse_item_structure(self, client):
        """Verify item structure has expected fields"""
        response = await client.get("/api/collections/browse/museus?limit=5")
        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert "id" in item
            assert "name" in item
            assert "collection" in item


class TestCollectionsSearch:
    """Test /api/collections/search endpoint"""

    async def test_search_porto(self, client):
        """Verify searching 'porto' returns results"""
        response = await client.get("/api/collections/search?q=porto")
        assert response.status_code == 200
        data = response.json()
        assert "query" in data
        assert data["query"] == "porto"
        assert "total" in data

    async def test_search_results_grouped_by_collection(self, client):
        """Verify search results are grouped by collection"""
        response = await client.get("/api/collections/search?q=porto")
        assert response.status_code == 200
        data = response.json()
        if data.get("results"):
            for result_group in data["results"]:
                assert "id" in result_group
                assert "label" in result_group


class TestCollectionsRegions:
    """Test /api/collections/regions/{collection_id} endpoint"""

    async def test_regions_miradouros(self, client):
        """Verify getting region distribution for miradouros"""
        response = await client.get("/api/collections/regions/miradouros")
        assert response.status_code == 200
        data = response.json()
        assert "regions" in data

    async def test_regions_invalid_collection(self, client):
        """Verify invalid collection returns 404"""
        response = await client.get("/api/collections/regions/invalid")
        assert response.status_code == 404


class TestHeritageFix:
    """Test Heritage API fix for areas_protegidas 500 error"""

    async def test_heritage_areas_protegidas_returns_200(self, client):
        """Verify /api/heritage?category=areas_protegidas returns 200"""
        response = await client.get("/api/heritage?category=areas_protegidas&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_heritage_areas_protegidas_items_valid(self, client):
        """Verify areas_protegidas items have valid structure"""
        response = await client.get("/api/heritage?category=areas_protegidas&limit=10")
        assert response.status_code == 200
        data = response.json()
        for item in data:
            assert "id" in item
            assert "name" in item

    async def test_heritage_areas_protegidas_location_valid(self, client):
        """Verify location field is properly handled"""
        response = await client.get("/api/heritage?category=areas_protegidas&limit=10")
        assert response.status_code == 200
        data = response.json()
        for item in data:
            loc = item.get("location")
            if loc is not None:
                assert "lat" in loc
                assert "lng" in loc


class TestAgendaEvents:
    """Verify Agenda API works"""

    async def test_agenda_events_returns_data(self, client):
        """Verify /api/agenda/events returns events"""
        response = await client.get("/api/agenda/events")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data


class TestPlannerSuggest:
    """Verify Planner API works"""

    async def test_planner_suggest_returns_itinerary(self, client):
        """Verify /api/planner/suggest returns itinerary"""
        response = await client.get("/api/planner/suggest?region=Lisboa&days=3")
        assert response.status_code == 200
        data = response.json()
        assert "itinerary" in data
        assert "region" in data
        assert data["region"] == "Lisboa"
