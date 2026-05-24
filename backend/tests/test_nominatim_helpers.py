"""Pure-function tests for NominatimService._build_street_address — the
static helper that flattens Nominatim's varied address dict into a single
human-readable string."""
from services.nominatim_service import NominatimService

_build = NominatimService._build_street_address


def test_road_only():
    assert _build({"road": "Rua da Felicidade"}) == "Rua da Felicidade"


def test_road_with_house_number():
    assert _build({"road": "Rua X", "house_number": "10"}) == "Rua X 10"


def test_full_address_road_city_postcode():
    out = _build({
        "road": "Rua X", "house_number": "10",
        "city": "Lisboa", "postcode": "1000-100",
    })
    assert out == "Rua X 10, Lisboa, 1000-100"


def test_city_falls_back_to_town():
    assert _build({"town": "Évora"}) == "Évora"


def test_city_falls_back_to_village():
    assert _build({"village": "Aldeia da Mata"}) == "Aldeia da Mata"


def test_suburb_used_when_no_road():
    assert "Centro" in _build({"suburb": "Centro", "city": "Lisboa"})


def test_suburb_dropped_when_road_present():
    # When the road is given it locates the place; the suburb is redundant.
    out = _build({"road": "Rua X", "suburb": "Centro", "city": "Lisboa"})
    assert "Centro" not in out


def test_neighbourhood_as_suburb_fallback():
    out = _build({"neighbourhood": "Alfama", "city": "Lisboa"})
    assert "Alfama" in out


def test_empty_address_dict_returns_empty_string():
    assert _build({}) == ""


def test_postcode_only():
    assert _build({"postcode": "1000-100"}) == "1000-100"
