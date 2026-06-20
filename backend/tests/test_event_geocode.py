"""
Unit tests for event geocoding + Excel data normalization (pure functions, no DB).
"""
from event_geocode import geocode, coords_from_event, in_portugal


class TestGeocode:
    def test_municipio_exact(self):
        lat, lng, precision = geocode("Porto", "Norte")
        assert precision == "municipio"
        assert 41.0 < lat < 41.3 and -8.8 < lng < -8.5

    def test_venue_resolves_to_city(self):
        # "Cem Soldos, Tomar" → Tomar
        lat, lng, precision = geocode("Cem Soldos, Tomar", "Centro")
        assert precision in ("municipio", "alias")
        assert 39.4 < lat < 39.8

    def test_alias_alges(self):
        lat, lng, precision = geocode("Passeio Maritimo de Alges", "Lisboa")
        assert precision == "alias"

    def test_region_fallback(self):
        lat, lng, precision = geocode("Várias localidades", "Norte")
        assert precision == "regiao"

    def test_islands(self):
        lat, _lng, _p = geocode("Funchal", "Madeira")
        assert 32.5 < lat < 32.9  # Madeira is ~32.6N


class TestCoordsFromEvent:
    def test_numeric(self):
        assert coords_from_event({"latitude": 38.72, "longitude": -9.14}) == (38.72, -9.14)

    def test_comma_decimals(self):
        assert coords_from_event({"latitude": "38,72", "longitude": "-9,14"}) == (38.72, -9.14)

    def test_gps_string(self):
        assert coords_from_event({"gps": "41.15,-8.61"}) == (41.15, -8.61)

    def test_coordinates_pair(self):
        assert coords_from_event({"coordinates": [37.02, -7.93]}) == (37.02, -7.93)

    def test_out_of_portugal_rejected(self):
        assert coords_from_event({"latitude": 51.5, "longitude": -0.12}) == (None, None)

    def test_absent(self):
        assert coords_from_event({"concelho": "Porto"}) == (None, None)


class TestInPortugal:
    def test_mainland(self):
        assert in_portugal(38.72, -9.14) is True

    def test_azores(self):
        assert in_portugal(37.74, -25.67) is True

    def test_outside(self):
        assert in_portugal(48.85, 2.35) is False

    def test_none(self):
        assert in_portugal(None, None) is False


class TestCleanDescription:
    def test_removes_boilerplate(self):
        from services.public_events_service import clean_event_description
        orig = (
            "Festival de Indie em Algés, cada Julho. Um dos maiores eventos culturais "
            "de Portugal, com alinhamentos de artistas nacionais e internacionais que "
            "definem a cena musical contemporânea. Até 55.000 por dia."
        )
        cleaned = clean_event_description(orig)
        assert "definem a cena musical" not in cleaned
        assert "Festival de Indie" in cleaned
        assert "Até 55.000 por dia." in cleaned

    def test_empty_passthrough(self):
        from services.public_events_service import clean_event_description
        assert clean_event_description("") == ""
