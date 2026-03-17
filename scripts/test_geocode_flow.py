#!/usr/bin/env python3
"""
Test the geocoding flow in-memory.
Validates: seed data → identify approximate coords → geocoding pipeline.
No external services needed.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from batch_geocode import is_approximate, is_in_portugal, build_nominatim_query, build_query, REGION_CENTROIDS

SAMPLE_POIS = [
    {"id": "1", "name": "Igreja de São Bento", "address": "Braga", "region": "norte",
     "location": {"lat": 41.35, "lng": -8.45}, "geocoded_exact": False},
    {"id": "2", "name": "Torre de Belém", "address": "Belém, Lisboa", "region": "lisboa",
     "location": {"lat": 38.6916, "lng": -9.2160}, "geocoded_exact": True},
    {"id": "3", "name": "Universidade de Coimbra", "address": "Coimbra", "region": "centro",
     "location": {"lat": 40.30, "lng": -8.50}, "geocoded_exact": False},
    {"id": "4", "name": "Castelo de Guimarães", "address": "Guimarães", "region": "norte",
     "location": {"lat": None, "lng": None}},
    {"id": "5", "name": "Praia da Marinha", "address": "Lagoa", "region": "algarve",
     "location": {"lat": 37.09, "lng": -8.10}, "geocoded_exact": False},
    {"id": "6", "name": "Mosteiro dos Jerónimos", "address": "Belém, Lisboa", "region": "lisboa",
     "location": {"lat": 38.6979, "lng": -9.2068}, "geocoded_exact": True},
    {"id": "7", "name": "Lagoa das Sete Cidades", "address": "Ponta Delgada", "region": "acores",
     "location": {"lat": 37.85, "lng": -25.78}, "geocoded_exact": False},
]


def test_is_approximate():
    print("=== Test: is_approximate() ===")
    results = []
    for poi in SAMPLE_POIS:
        loc = poi.get("location", {})
        lat = loc.get("lat")
        lng = loc.get("lng")
        if lat is None or lng is None:
            approx = "NO_COORDS"
        else:
            approx = is_approximate(float(lat), float(lng))
        results.append((poi["name"], approx))
        status = "APPROXIMATE" if approx is True else ("EXACT" if approx is False else "NO_COORDS")
        print(f"  {poi['name']:40s} → {status}")

    assert results[0][1] is True, "Igreja de São Bento near norte centroid"
    assert results[2][1] is True, "Universidade de Coimbra near centro centroid"
    assert results[3][1] == "NO_COORDS", "Castelo de Guimarães has no coords"
    assert not is_approximate(39.60, -8.00), "Tomar should be exact"
    assert not is_approximate(41.70, -7.50), "Chaves should be exact"
    print("  ✓ All assertions passed\n")


def test_is_in_portugal():
    print("=== Test: is_in_portugal() ===")
    assert is_in_portugal(38.72, -9.14), "Lisboa should be in Portugal"
    assert is_in_portugal(37.74, -25.67), "Açores should be in Portugal"
    assert is_in_portugal(32.65, -16.92), "Madeira should be in Portugal"
    assert not is_in_portugal(40.42, -3.70), "Madrid should NOT be in Portugal"
    assert not is_in_portugal(51.50, -0.12), "London should NOT be in Portugal"
    print("  ✓ All assertions passed\n")


def test_query_building():
    print("=== Test: build_nominatim_query() ===")
    for poi in SAMPLE_POIS:
        q = build_nominatim_query(poi)
        print(f"  {poi['name']:40s} → \"{q}\"")
    print("  ✓ Queries built successfully\n")


def test_candidate_selection():
    print("=== Test: Candidate Selection ===")
    candidates = []
    for poi in SAMPLE_POIS:
        if poi.get("geocoded_exact") is True:
            continue
        loc = poi.get("location") or {}
        lat = loc.get("lat")
        lng = loc.get("lng")
        if lat is None or lng is None:
            candidates.append(poi)
        elif is_approximate(float(lat), float(lng)):
            candidates.append(poi)

    print(f"  Total POIs: {len(SAMPLE_POIS)}")
    print(f"  Candidates for geocoding: {len(candidates)}")
    for c in candidates:
        print(f"    - {c['name']} ({c['region']})")

    assert len(candidates) == 5, f"Expected 5 candidates, got {len(candidates)}"
    print("  ✓ Correct candidates selected\n")


def test_centroid_coverage():
    print("=== Test: Region Centroid Coverage ===")
    print(f"  Centroids registered: {len(REGION_CENTROIDS)}")
    seed_centroids = {
        "norte": (41.15, -8.61), "centro": (40.21, -8.43),
        "lisboa": (38.72, -9.14), "alentejo": (38.57, -7.91),
        "algarve": (37.02, -7.93), "acores": (37.74, -25.66),
        "madeira": (32.65, -16.91),
    }
    detected_count = 0
    for region, (lat, lng) in seed_centroids.items():
        detected = is_approximate(lat, lng)
        status = "✓" if detected else "✗"
        print(f"  {status} {region:10s} centroid ({lat}, {lng}) → detected={detected}")
        if detected:
            detected_count += 1

    assert detected_count == 7, f"Not all regions detected: {detected_count}/7"
    print("  ✓ All 7 region centroids correctly detected\n")


if __name__ == "__main__":
    print("=" * 60)
    print("Portugal Vivo — Geocoding Flow Validation")
    print("=" * 60)
    print()

    test_is_approximate()
    test_is_in_portugal()
    test_query_building()
    test_candidate_selection()
    test_centroid_coverage()

    print("=" * 60)
    print("ALL TESTS PASSED ✓")
    print("=" * 60)
