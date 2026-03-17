"""
Tests for Nature & Discovery APIs
Tests ICNF, GBIF, GeoAPI, Overpass, GTFS services and API endpoints
"""
import sys
import os
import types

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Mock the services __init__ to avoid importing motor/pymongo
_services_pkg = types.ModuleType("services")
_services_pkg.__path__ = [os.path.join(os.path.dirname(__file__), "..", "services")]
_services_pkg.__package__ = "services"
sys.modules["services"] = _services_pkg


def _load(name):
    """Load a service module directly"""
    import importlib.util
    path = os.path.join(os.path.dirname(__file__), "..", "services", f"{name}.py")
    spec = importlib.util.spec_from_file_location(f"services.{name}", path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[f"services.{name}"] = mod
    spec.loader.exec_module(mod)
    return mod


# Pre-load services to avoid __init__.py chain
icnf_mod = _load("icnf_service")
gbif_mod = _load("gbif_service")
geoapi_mod = _load("geoapi_service")
overpass_mod = _load("overpass_service")
gtfs_mod = _load("gtfs_service")


# ========================
# SERVICE UNIT TESTS
# ========================

class TestICNFService:
    def setup_method(self):
        self.service = icnf_mod.ICNFService()

    def test_get_all_protected_areas(self):
        areas = self.service.get_protected_areas()
        assert len(areas) > 0
        assert areas[0].name
        assert areas[0].designation

    def test_get_protected_areas_by_proximity(self):
        areas = self.service.get_protected_areas(lat=38.78, lng=-9.42, radius_km=30)
        assert len(areas) > 0
        names = [a.name for a in areas]
        assert any("Sintra" in n for n in names)

    def test_get_nearest_protected_area(self):
        result = self.service.get_nearest_protected_area(lat=38.72, lng=-9.14)
        assert result is not None
        assert "area" in result
        assert "distance_km" in result
        assert result["area"]["name"]

    def test_get_natura2000_sites(self):
        sites = self.service.get_natura2000_sites()
        assert len(sites) > 0
        assert "type" in sites[0]
        assert sites[0]["type"] in ("SIC", "ZPE")

    def test_get_natura2000_by_type(self):
        sic = self.service.get_natura2000_sites(site_type="SIC")
        zpe = self.service.get_natura2000_sites(site_type="ZPE")
        assert all(s["type"] == "SIC" for s in sic)
        assert all(s["type"] == "ZPE" for s in zpe)

    def test_get_biodiversity_stations(self):
        stations = self.service.get_biodiversity_stations()
        assert len(stations) > 0
        assert "name" in stations[0]
        assert "habitat_type" in stations[0]

    def test_get_biodiversity_stations_by_proximity(self):
        stations = self.service.get_biodiversity_stations(lat=41.77, lng=-8.12, radius_km=20)
        assert len(stations) > 0
        assert stations[0]["distance_km"] < 20

    def test_get_nearest_biodiversity_station(self):
        result = self.service.get_nearest_biodiversity_station(lat=38.50, lng=-9.00)
        assert result is not None
        assert "station" in result
        assert result["station"]["name"]

    def test_wms_layer_url(self):
        url = self.service.get_wms_layer_url("areas_protegidas")
        assert "WMS" in url
        assert "icnf" in url


class TestGBIFService:
    def setup_method(self):
        self.service = gbif_mod.GBIFService()

    def test_get_notable_species_all(self):
        species = self.service.get_notable_species()
        assert len(species) > 0
        assert "name" in species[0]
        assert "scientific" in species[0]
        assert "iucn" in species[0]

    def test_get_notable_species_by_region(self):
        species = self.service.get_notable_species(region="Alentejo")
        assert len(species) > 0
        assert all(any("Alentejo" in r for r in s["regions"]) for s in species)

    def test_get_notable_species_minho(self):
        species = self.service.get_notable_species(region="Minho")
        assert len(species) > 0


class TestOverpassService:
    def setup_method(self):
        self.service = overpass_mod.OverpassService()

    def test_get_eurovelo_routes(self):
        routes = self.service.get_eurovelo_routes()
        assert len(routes) == 2
        assert routes[0]["id"] == "ev1"
        assert routes[1]["id"] == "ev3"

    def test_get_long_distance_trails(self):
        trails = self.service.get_long_distance_trails()
        assert len(trails) > 0
        assert "name" in trails[0]
        assert "distance_km" in trails[0]

    def test_get_long_distance_trails_by_region(self):
        trails = self.service.get_long_distance_trails(region="Algarve")
        assert len(trails) > 0
        assert all("Algarve" in t["region"] for t in trails)

    def test_get_nearest_long_trail(self):
        result = self.service.get_nearest_long_trail(lat=37.00, lng=-8.93)
        assert result is not None
        assert "trail" in result
        assert "distance_km" in result


class TestGTFSTransportService:
    def setup_method(self):
        self.service = gtfs_mod.GTFSTransportService()

    def test_find_nearest_stops_lisboa(self):
        stops = self.service.find_nearest_stops(lat=38.711, lng=-9.140, radius_km=1.0)
        assert len(stops) > 0
        assert stops[0]["distance_km"] < 1.0
        assert "operator" in stops[0]

    def test_find_nearest_stops_porto(self):
        stops = self.service.find_nearest_stops(lat=41.152, lng=-8.610, radius_km=1.0)
        assert len(stops) > 0
        operators = [s["operator"] for s in stops]
        assert any("Porto" in o for o in operators)

    def test_find_nearest_stops_by_type(self):
        stops = self.service.find_nearest_stops(lat=38.711, lng=-9.140, radius_km=2.0, transport_type="metro")
        assert all(s["transport_type"] == "metro" for s in stops)

    def test_find_nearest_station(self):
        station = self.service.find_nearest_station(lat=38.711, lng=-9.140)
        assert station is not None
        assert "name" in station

    def test_plan_route(self):
        route = self.service.plan_route_to_destination(
            38.711, -9.140,
            41.152, -8.610,
        )
        assert "origin" in route
        assert "destination" in route
        assert "direct_distance_km" in route
        assert route["direct_distance_km"] > 200

    def test_no_stops_in_remote_area(self):
        stops = self.service.find_nearest_stops(lat=37.0, lng=-15.0, radius_km=1.0)
        assert len(stops) == 0


# ========================
# GAMIFICATION BADGE TESTS
# ========================

class TestNatureBadges:
    def test_nature_badges_exist(self):
        from shared_constants import GAMIFICATION_BADGES
        nature_badge_ids = [
            "guardiao_natureza", "biodiversidade", "trilheiro",
            "ciclista_verde", "observador_aves", "viajante_sustentavel",
            "peregrino", "costa_atlantica",
        ]
        badge_ids = [b["id"] for b in GAMIFICATION_BADGES]
        for bid in nature_badge_ids:
            assert bid in badge_ids, f"Badge {bid} not found"

    def test_total_badges_count(self):
        from shared_constants import GAMIFICATION_BADGES
        assert len(GAMIFICATION_BADGES) >= 25


# ========================
# DATA INTEGRITY TESTS
# ========================

class TestDataIntegrity:
    def test_all_protected_areas_have_coordinates(self):
        for area in icnf_mod.PROTECTED_AREAS:
            assert area.lat is not None, f"{area.name} missing lat"
            assert area.lng is not None, f"{area.name} missing lng"
            assert -90 <= area.lat <= 90
            assert -180 <= area.lng <= 180

    def test_all_biodiversity_stations_have_coordinates(self):
        for st in icnf_mod.BIODIVERSITY_STATIONS:
            assert st.lat is not None
            assert st.lng is not None
            assert 36 < st.lat < 43  # Portugal bounds
            assert -10 < st.lng < -6

    def test_all_metro_lisboa_stations_valid(self):
        for st in gtfs_mod.METRO_LISBOA_STATIONS:
            assert st["name"]
            assert 38.5 < st["lat"] < 39.0
            assert -9.3 < st["lng"] < -9.0

    def test_all_metro_porto_stations_valid(self):
        for st in gtfs_mod.METRO_PORTO_STATIONS:
            assert st["name"]
            assert 41.0 < st["lat"] < 41.4
            assert -8.8 < st["lng"] < -8.5

    def test_all_cp_stations_valid(self):
        for st in gtfs_mod.CP_MAJOR_STATIONS:
            assert st["name"]
            assert 37.0 < st["lat"] < 42.0
            assert -9.5 < st["lng"] < -6.5
            assert len(st["lines"]) > 0

    def test_notable_species_have_all_fields(self):
        for sp in gbif_mod.NOTABLE_PT_SPECIES:
            assert sp["name"]
            assert sp["scientific"]
            assert sp["taxon_key"] > 0
            assert sp["iucn"]
            assert len(sp["regions"]) > 0

    def test_eurovelo_routes_complete(self):
        routes = overpass_mod.EUROVELO_PT
        assert len(routes) == 2
        for r in routes:
            assert r["distance_km"] > 0
            assert r["start"]
            assert r["end"]

    def test_long_distance_trails_complete(self):
        trails = overpass_mod.LONG_DISTANCE_TRAILS
        assert len(trails) >= 5
        for t in trails:
            assert t["distance_km"] > 0
            assert t["stages"] > 0
            assert t["start_lat"]
            assert t["start_lng"]

    def test_natura2000_sites_complete(self):
        for site in icnf_mod.NATURA_2000_SITES:
            assert site["name"]
            assert site["type"] in ("SIC", "ZPE")
            assert site["lat"]
            assert site["lng"]
            assert site["area_km2"] > 0
