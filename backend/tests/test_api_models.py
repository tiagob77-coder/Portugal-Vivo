"""
Pure-Pydantic tests for the response models in models/api_models.py.

These pin the shape every API endpoint depends on. Catches accidental
field renames or required→optional flips at PR time.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from models.api_models import (
    AccessibilityInfo,
    EncyclopediaArticle,
    HeritageItem,
    HeritageItemCreate,
    Location,
    NearbyPOIRequest,
    Route,
    RouteCreate,
    RouteItem,
    RoutePlanRequest,
    SessionDataResponse,
    User,
    UserContribution,
    UserSession,
)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class TestUser:
    def _make(self, **overrides) -> User:
        defaults = {
            "user_id": "u_001",
            "email": "test@example.pt",
            "name": "Tester",
            "created_at": datetime.now(timezone.utc),
        }
        defaults.update(overrides)
        return User(**defaults)

    def test_minimal_required_fields(self):
        u = self._make()
        assert u.user_id == "u_001"
        assert u.email == "test@example.pt"
        assert u.favorites == []
        assert u.picture is None

    def test_email_must_be_present(self):
        with pytest.raises(ValidationError):
            User(user_id="u_001", name="x", created_at=datetime.now(timezone.utc))

    def test_picture_optional(self):
        u = self._make(picture="https://cdn.example/p.png")
        assert u.picture == "https://cdn.example/p.png"

    def test_favorites_default_to_empty_list(self):
        u = self._make()
        # Mutating one instance's list MUST NOT leak into another —
        # classic Pydantic mutable-default trap.
        u.favorites.append("poi-1")
        u2 = self._make()
        assert u2.favorites == []


# ---------------------------------------------------------------------------
# UserSession / SessionDataResponse
# ---------------------------------------------------------------------------

class TestSession:
    def test_user_session_minimal(self):
        s = UserSession(
            user_id="u_001",
            session_token="tok",
            expires_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
        )
        assert s.session_token == "tok"

    def test_session_data_response_minimal(self):
        r = SessionDataResponse(
            id="u_001",
            email="x@y",
            name="x",
            session_token="tok",
        )
        assert r.email == "x@y"
        assert r.picture is None


# ---------------------------------------------------------------------------
# Location
# ---------------------------------------------------------------------------

class TestLocation:
    def test_basic(self):
        loc = Location(lat=38.7223, lng=-9.1393)
        assert loc.lat == pytest.approx(38.7223)
        assert loc.lng == pytest.approx(-9.1393)

    def test_lat_lng_required(self):
        with pytest.raises(ValidationError):
            Location(lat=38.7223)  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# AccessibilityInfo
# ---------------------------------------------------------------------------

class TestAccessibility:
    def test_defaults_to_false(self):
        a = AccessibilityInfo()
        # Bool fields default to False (not None) so callers can rely on
        # the value without optional-handling boilerplate.
        assert a.wheelchair_accessible is False
        assert a.braille_available is False
        assert a.notes is None

    def test_round_trip(self):
        a = AccessibilityInfo(
            wheelchair_accessible=True,
            braille_available=False,
            sign_language=True,
            notes="Rampa nas traseiras",
        )
        dumped = a.model_dump()
        assert dumped["wheelchair_accessible"] is True
        assert dumped["sign_language"] is True
        assert a.notes == "Rampa nas traseiras"


# ---------------------------------------------------------------------------
# HeritageItem + HeritageItemCreate
# ---------------------------------------------------------------------------

class TestHeritageItem:
    def _payload(self, **overrides) -> dict:
        base = {
            "id": "h_001",
            "name": "Torre de Belém",
            "description": "Marco da Era dos Descobrimentos.",
            "category": "monumento",
            "region": "Lisboa",
            "location": {"lat": 38.6916, "lng": -9.2159},
        }
        base.update(overrides)
        return base

    def test_minimum_payload_validates(self):
        item = HeritageItem(**self._payload())
        assert item.id == "h_001"
        assert item.location.lat == pytest.approx(38.6916)

    def test_location_lat_lng_round_trip(self):
        item = HeritageItem(**self._payload())
        dumped = item.model_dump()
        assert dumped["location"]["lat"] == pytest.approx(38.6916)
        assert dumped["location"]["lng"] == pytest.approx(-9.2159)

    def test_create_does_not_require_id(self):
        """HeritageItemCreate is the inbound shape — server assigns id."""
        payload = self._payload()
        payload.pop("id", None)
        item = HeritageItemCreate(**payload)
        assert item.name == "Torre de Belém"


# ---------------------------------------------------------------------------
# Route / RouteCreate / RouteItem
# ---------------------------------------------------------------------------

class TestRoute:
    def _payload(self, **overrides) -> dict:
        base = {
            "id": "r_001",
            "name": "Rota da Mouraria",
            "description": "Pelos becos do fado.",
            # Route.items is List[Any] — accepts strings, dicts, or RouteItem.
            "items": ["h_001", "h_002"],
            "duration_hours": 1.5,
            "difficulty": "facil",
        }
        base.update(overrides)
        return base

    def test_basic(self):
        route = Route(**self._payload())
        assert len(route.items) == 2
        assert route.duration_hours == pytest.approx(1.5)

    def test_ignores_extra_fields(self):
        """Route has model_config = extra=ignore so a payload with
        unknown keys still validates (forwards-compat with new fields)."""
        route = Route(**self._payload(unknown_field="should be ignored"))
        assert not hasattr(route, "unknown_field")

    def test_route_create_round_trip(self):
        rc = RouteCreate(
            name="Rota X",
            description="Algures por aí",
            category="patrimonio",
            items=["h_001"],
        )
        assert rc.category == "patrimonio"


# ---------------------------------------------------------------------------
# RoutePlanRequest / NearbyPOIRequest — request validation
# ---------------------------------------------------------------------------

class TestRoutePlanRequest:
    def test_basic(self):
        # origin/destination are place-name strings; coords are optional.
        req = RoutePlanRequest(origin="Lisboa", destination="Porto")
        assert req.origin == "Lisboa"
        assert req.max_detour_km == 50  # default

    def test_with_coords(self):
        req = RoutePlanRequest(
            origin="Lisboa",
            destination="Porto",
            origin_coords={"lat": 38.7, "lng": -9.1},
        )
        assert req.origin_coords.lat == pytest.approx(38.7)

    def test_origin_destination_required(self):
        with pytest.raises(ValidationError):
            RoutePlanRequest(origin="Lisboa")  # type: ignore[call-arg]


class TestNearbyPOIRequest:
    def test_minimal(self):
        # The field names are latitude/longitude (not lat/lng) because the
        # request model was added before the Location helper existed.
        req = NearbyPOIRequest(latitude=38.7, longitude=-9.1)
        assert req.radius_km == 25  # default
        assert req.limit == 20      # default

    def test_radius_bounds(self):
        with pytest.raises(ValidationError):
            NearbyPOIRequest(latitude=38.7, longitude=-9.1, radius_km=300)


# ---------------------------------------------------------------------------
# UserContribution + EncyclopediaArticle
# ---------------------------------------------------------------------------

class TestUserContribution:
    def test_basic(self):
        contrib = UserContribution(
            user_id="u_001",
            heritage_item_id="h_001",
            type="photo",
            content="https://cdn.example/x.jpg",
        )
        assert contrib.status == "pending"   # default
        # Server-assigned id falls back to a uuid factory.
        assert contrib.id


class TestEncyclopediaArticle:
    def test_basic(self):
        art = EncyclopediaArticle(
            id="e_001",
            slug="bartolomeu-dias",
            title="Bartolomeu Dias",
            universe="historia",
            summary="Navegador português do séc. XV.",
            content="Lorem ipsum dolor sit amet.",
        )
        assert art.slug == "bartolomeu-dias"
        assert art.universe == "historia"
        assert art.views == 0  # default
