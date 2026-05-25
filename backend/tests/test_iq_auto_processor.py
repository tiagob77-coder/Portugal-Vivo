"""Pure-function tests for iq_auto_processor.calculate_simple_iq_score —
the data-completeness scoring used in batch processing of pending POIs.
Score ranges from 30 (empty doc) to 90 (everything filled). A regression
in the tier table re-scores every batched POI silently."""
import pytest

from iq_auto_processor import calculate_simple_iq_score


# ── Base ─────────────────────────────────────────────────────────────────────

def test_empty_poi_returns_base_30():
    assert calculate_simple_iq_score({}) == 30.0


def test_score_is_float():
    assert isinstance(calculate_simple_iq_score({}), float)


# ── Name tiers ───────────────────────────────────────────────────────────────

def test_short_name_under_10_chars_no_bonus():
    assert calculate_simple_iq_score({"name": "Castelo"}) == 30.0


def test_name_over_10_chars_adds_5():
    # "Castelo de Lisboa" = 17 chars > 10 → +5
    assert calculate_simple_iq_score({"name": "Castelo de Lisboa"}) == 35.0


def test_name_over_30_chars_adds_10_total():
    # 31 chars triggers both tiers (+5 +5).
    assert calculate_simple_iq_score({"name": "x" * 31}) == 40.0


# ── Description fallback chain ───────────────────────────────────────────────

def test_description_under_50_chars_no_bonus():
    assert calculate_simple_iq_score({"description": "short"}) == 30.0


def test_description_over_50_chars_adds_5():
    assert calculate_simple_iq_score({"description": "x" * 51}) == 35.0


def test_description_over_150_chars_adds_10_total():
    assert calculate_simple_iq_score({"description": "x" * 151}) == 40.0


def test_description_over_300_chars_adds_15_total():
    assert calculate_simple_iq_score({"description": "x" * 301}) == 45.0


def test_subtitle_used_when_description_missing():
    # subtitle is the second fallback.
    assert calculate_simple_iq_score({"subtitle": "x" * 51}) == 35.0


def test_summary_used_when_description_and_subtitle_missing():
    assert calculate_simple_iq_score({"summary": "x" * 51}) == 35.0


def test_empty_description_does_not_block_summary_fallback():
    # `"" or subtitle or summary` → subtitle used because "" is falsy.
    assert calculate_simple_iq_score({
        "description": "",
        "summary": "x" * 51,
    }) == 35.0


# ── Location ─────────────────────────────────────────────────────────────────

def test_location_empty_dict_no_bonus():
    # Empty dict is falsy in Python so `if poi.get("location")` skips —
    # zero bonus, which matches the semantics (no useful data).
    assert calculate_simple_iq_score({"location": {}}) == 30.0


def test_location_non_empty_dict_without_coords_adds_5():
    # Truthy dict without coords → only the first +5.
    assert calculate_simple_iq_score({"location": {"name": "anywhere"}}) == 35.0


def test_location_with_valid_coords_adds_10_total():
    assert calculate_simple_iq_score({
        "location": {"coordinates": [-9.1, 38.7]},
    }) == 40.0


def test_location_with_only_one_coord_adds_5_only():
    # `coords and len(coords) >= 2` fails for len 1.
    assert calculate_simple_iq_score({
        "location": {"coordinates": [-9.1]},
    }) == 35.0


# ── Single-bonus fields ──────────────────────────────────────────────────────

def test_category_adds_5():
    assert calculate_simple_iq_score({"category": "castelo"}) == 35.0


def test_region_adds_5():
    assert calculate_simple_iq_score({"region": "Lisboa"}) == 35.0


def test_image_url_adds_10():
    assert calculate_simple_iq_score({"image_url": "https://x"}) == 40.0


# ── Tags ─────────────────────────────────────────────────────────────────────

def test_no_tags_no_bonus():
    assert calculate_simple_iq_score({"tags": []}) == 30.0


def test_tags_with_one_entry_adds_2():
    assert calculate_simple_iq_score({"tags": ["historic"]}) == 32.0


def test_tags_with_four_entries_adds_5_total():
    assert calculate_simple_iq_score({
        "tags": ["a", "b", "c", "d"],
    }) == 35.0


# ── Extra metadata ───────────────────────────────────────────────────────────

def test_address_adds_3():
    assert calculate_simple_iq_score({"address": "R. de Santa Cruz"}) == 33.0


def test_phone_adds_3():
    assert calculate_simple_iq_score({"phone": "+351 21..."}) == 33.0


def test_website_adds_3_via_same_bucket():
    # phone/website/email share one +3 bucket.
    assert calculate_simple_iq_score({"website": "https://x"}) == 33.0


def test_email_adds_3_via_same_bucket():
    assert calculate_simple_iq_score({"email": "info@x.pt"}) == 33.0


def test_phone_and_website_together_still_add_only_3():
    # Bucket is OR — having both doesn't double-count.
    assert calculate_simple_iq_score({
        "phone": "+351",
        "website": "https://x",
    }) == 33.0


def test_opening_hours_adds_2():
    assert calculate_simple_iq_score({"opening_hours": "9-18"}) == 32.0


def test_schedule_adds_2_via_same_bucket_as_opening_hours():
    assert calculate_simple_iq_score({"schedule": "9-18"}) == 32.0


def test_price_adds_2():
    assert calculate_simple_iq_score({"price": "15€"}) == 32.0


def test_entry_fee_adds_2_via_same_bucket_as_price():
    assert calculate_simple_iq_score({"entry_fee": "15€"}) == 32.0


# ── Cap at 90 ────────────────────────────────────────────────────────────────

def test_complete_poi_caps_at_90():
    poi = {
        "name": "x" * 50,                                # +10
        "description": "x" * 400,                        # +15
        "location": {"coordinates": [-9.1, 38.7]},       # +10
        "category": "museu",                             # +5
        "region": "Lisboa",                              # +5
        "image_url": "https://x",                        # +10
        "tags": ["a", "b", "c", "d", "e"],               # +5
        "address": "R. de Santa Cruz",                   # +3
        "phone": "+351 21",                              # +3
        "opening_hours": "9-18",                         # +2
        "price": "15€",                                  # +2
    }
    # Total raw = 30 + 10 + 15 + 10 + 5 + 5 + 10 + 5 + 3 + 3 + 2 + 2 = 100 → capped at 90.
    assert calculate_simple_iq_score(poi) == 90.0


def test_score_never_exceeds_90_even_with_all_optional_buckets():
    # Stress: add every bucket twice; cap must still hold.
    poi = {
        "name": "x" * 100,
        "description": "x" * 1000,
        "subtitle": "x" * 1000,
        "summary": "x" * 1000,
        "location": {"coordinates": [-9.1, 38.7]},
        "category": "museu",
        "region": "Lisboa",
        "image_url": "https://x",
        "tags": ["a"] * 20,
        "address": "A",
        "phone": "P",
        "website": "W",
        "email": "E",
        "opening_hours": "H",
        "schedule": "S",
        "price": "P",
        "entry_fee": "F",
    }
    assert calculate_simple_iq_score(poi) == 90.0


# ── Boundary parametrisation ─────────────────────────────────────────────────

@pytest.mark.parametrize("desc_len,expected_extra", [
    (0, 0),    # no description
    (50, 0),   # `> 50` is strict, 50 chars gives no bonus
    (51, 5),
    (150, 5),  # 150 still no extra (strict >)
    (151, 10),
    (300, 10),
    (301, 15),
])
def test_description_tier_boundaries(desc_len, expected_extra):
    poi = {"description": "x" * desc_len} if desc_len else {}
    assert calculate_simple_iq_score(poi) == 30.0 + expected_extra
