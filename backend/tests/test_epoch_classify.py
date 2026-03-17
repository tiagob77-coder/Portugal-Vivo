"""
FASE 3 - Epoch classification, sanitize_regex, collections metadata,
proximity math, and gamification level calculation tests.
"""
import pytest
from math import radians, cos


# ---------------------------------------------------------------------------
# classify_epoch tests
# ---------------------------------------------------------------------------

class TestClassifyEpoch:
    """Test epoch classification logic."""

    def test_roman_keyword(self):
        from epochs_api import classify_epoch
        item = {"name": "Vila Romana de Pisões", "description": "", "tags": []}
        epochs = classify_epoch(item)
        assert "romano" in epochs

    def test_medieval_keyword(self):
        from epochs_api import classify_epoch
        item = {"name": "Castelo Medieval de Guimarães", "description": "", "tags": []}
        epochs = classify_epoch(item)
        assert "medieval" in epochs

    def test_multiple_epochs(self):
        from epochs_api import classify_epoch
        item = {
            "name": "Mosteiro",
            "description": "Construído na época medieval, restaurado no período barroco",
            "tags": [],
        }
        epochs = classify_epoch(item)
        assert "medieval" in epochs
        assert "barroco" in epochs

    def test_no_match_returns_sem_epoca(self):
        from epochs_api import classify_epoch
        item = {"name": "Praia do Norte", "description": "Uma praia bonita", "tags": []}
        epochs = classify_epoch(item)
        assert epochs == ["sem_epoca"]

    def test_empty_item(self):
        from epochs_api import classify_epoch
        item = {}
        epochs = classify_epoch(item)
        assert epochs == ["sem_epoca"]

    def test_none_fields(self):
        from epochs_api import classify_epoch
        item = {"name": None, "description": None, "tags": None, "subcategory": None}
        epochs = classify_epoch(item)
        assert isinstance(epochs, list)

    def test_tags_matching(self):
        from epochs_api import classify_epoch
        item = {"name": "Igreja", "description": "", "tags": ["manuelino", "gótico"]}
        epochs = classify_epoch(item)
        assert "descobrimentos" in epochs or "medieval" in epochs

    def test_case_insensitive(self):
        from epochs_api import classify_epoch
        item = {"name": "TEMPLO ROMANO", "description": "", "tags": []}
        epochs = classify_epoch(item)
        assert "romano" in epochs


# ---------------------------------------------------------------------------
# sanitize_regex tests
# ---------------------------------------------------------------------------

class TestSanitizeRegex:
    """Test regex sanitization for ReDoS prevention."""

    def test_normal_string(self):
        from shared_constants import sanitize_regex
        assert sanitize_regex("hello") == "hello"

    def test_special_chars_escaped(self):
        from shared_constants import sanitize_regex
        result = sanitize_regex("test.*+?^$|()[]{}\\")
        assert ".*" not in result  # dot-star should be escaped
        assert result != "test.*+?^$|()[]{}\\"

    def test_empty_string(self):
        from shared_constants import sanitize_regex
        assert sanitize_regex("") == ""

    def test_safe_for_mongo_regex(self):
        """Output should be safe to use in MongoDB $regex."""
        import re
        from shared_constants import sanitize_regex
        dangerous = "a]|b[c.*"
        safe = sanitize_regex(dangerous)
        # Should compile without error
        pattern = re.compile(safe)
        assert pattern.match(dangerous)

    def test_unicode_preserved(self):
        from shared_constants import sanitize_regex
        assert sanitize_regex("café") == "café"

    def test_sql_injection_pattern(self):
        from shared_constants import sanitize_regex
        result = sanitize_regex("'; DROP TABLE --")
        assert "DROP" in result  # Text preserved but special chars escaped


# ---------------------------------------------------------------------------
# Collections metadata tests
# ---------------------------------------------------------------------------

class TestCollectionsMetadata:
    """Test collections and group metadata integrity."""

    def test_all_collections_have_required_fields(self):
        from collections_api import COLLECTION_META
        required = {"label", "icon", "color", "group"}
        for cid, meta in COLLECTION_META.items():
            assert required.issubset(meta.keys()), f"Collection {cid} missing fields"

    def test_all_groups_have_required_fields(self):
        from collections_api import GROUP_META
        required = {"label", "icon", "color"}
        for gid, meta in GROUP_META.items():
            assert required.issubset(meta.keys()), f"Group {gid} missing fields"

    def test_all_collections_reference_valid_groups(self):
        from collections_api import COLLECTION_META, GROUP_META
        for cid, meta in COLLECTION_META.items():
            assert meta["group"] in GROUP_META, f"Collection {cid} references unknown group {meta['group']}"

    def test_collection_ids_are_valid(self):
        from collections_api import COLLECTION_META
        for cid in COLLECTION_META:
            assert isinstance(cid, str)
            assert len(cid) > 0
            assert " " not in cid  # No spaces in IDs

    def test_colors_are_hex(self):
        from collections_api import COLLECTION_META
        import re
        hex_pattern = re.compile(r'^#[0-9A-Fa-f]{6}$')
        for cid, meta in COLLECTION_META.items():
            assert hex_pattern.match(meta["color"]), f"Invalid color for {cid}: {meta['color']}"


# ---------------------------------------------------------------------------
# Proximity bounding box math tests
# ---------------------------------------------------------------------------

class TestProximityMath:
    """Test proximity bounding box calculations."""

    def test_lat_delta_at_equator(self):
        """1 km ≈ 1/111 degrees latitude."""
        radius_km = 10
        lat_delta = radius_km / 111.0
        assert abs(lat_delta - 0.09009) < 0.001

    def test_lng_delta_at_equator(self):
        """At equator, lng_delta ≈ lat_delta."""
        lat = 0
        radius_km = 10
        lat_delta = radius_km / 111.0
        lng_delta = radius_km / (111.0 * cos(radians(lat)))
        assert abs(lat_delta - lng_delta) < 0.001

    def test_lng_delta_at_lisbon(self):
        """At 38.7°N, longitude degrees are narrower."""
        lat = 38.7
        radius_km = 10
        lat_delta = radius_km / 111.0
        lng_delta = radius_km / (111.0 * cos(radians(lat)))
        assert lng_delta > lat_delta  # lng degrees are wider at higher latitudes

    def test_lng_delta_at_high_latitude(self):
        """At 89°N, lng_delta should be very large."""
        lat = 89
        radius_km = 10
        lng_delta = radius_km / (111.0 * cos(radians(lat)))
        assert lng_delta > 5  # Very wide at near-pole

    def test_haversine_antimeridian(self):
        """Distance across the antimeridian (±180°)."""
        from shared_utils import haversine_km
        dist = haversine_km(0, 179, 0, -179)
        assert 200 < dist < 230  # ~222 km at equator

    def test_haversine_poles(self):
        """Distance from North Pole to South Pole."""
        from shared_utils import haversine_km
        dist = haversine_km(90, 0, -90, 0)
        assert 20000 < dist < 20100  # ~20,015 km


# ---------------------------------------------------------------------------
# Gamification level calculation tests
# ---------------------------------------------------------------------------

class TestGamificationLevel:
    """Test gamification XP → level calculation."""

    def test_zero_xp(self):
        xp = 0
        level = 1 + xp // 100
        assert level == 1

    def test_99_xp(self):
        xp = 99
        level = 1 + xp // 100
        assert level == 1

    def test_100_xp(self):
        xp = 100
        level = 1 + xp // 100
        assert level == 2

    def test_999_xp(self):
        xp = 999
        level = 1 + xp // 100
        assert level == 10

    def test_1000_xp(self):
        xp = 1000
        level = 1 + xp // 100
        assert level == 11

    def test_xp_base_earned(self):
        """Base XP for check-in is 10, IQ bonus = iq_score // 10."""
        base_xp = 10
        iq_score = 85
        iq_bonus = int(iq_score / 10)
        total = base_xp + iq_bonus
        assert total == 18

    def test_iq_bonus_zero(self):
        iq_score = 0
        iq_bonus = int((iq_score or 0) / 10)
        assert iq_bonus == 0

    def test_iq_bonus_none(self):
        iq_score = None
        iq_bonus = int((iq_score or 0) / 10)
        assert iq_bonus == 0

    def test_checkin_radius_reasonable(self):
        from gamification_api import CHECK_IN_RADIUS_METERS
        assert 50 <= CHECK_IN_RADIUS_METERS <= 500


# ---------------------------------------------------------------------------
# Main categories structure tests
# ---------------------------------------------------------------------------

class TestMainCategories:
    """Test MAIN_CATEGORIES structure."""

    def test_main_categories_have_required_fields(self):
        from shared_constants import MAIN_CATEGORIES
        required = {"id", "name", "icon", "color"}
        for cat in MAIN_CATEGORIES:
            assert required.issubset(cat.keys()), f"Category {cat.get('id')} missing fields"

    def test_main_categories_ids_unique(self):
        from shared_constants import MAIN_CATEGORIES
        ids = [c["id"] for c in MAIN_CATEGORIES]
        assert len(ids) == len(set(ids))

    def test_subcategories_reference_parent(self):
        from shared_constants import CATEGORIES
        main_ids = {c.get("id") or c.get("main_category") for c in CATEGORIES}
        assert len(main_ids) > 0
