"""
CAOP pipeline unit tests — do not require MongoDB or CAOP data.

Covers:
- caop_normalize string helpers
- NUTS hierarchy resolver
- geo_validator behaviour with an empty (not-loaded) lookup
- shapely STRtree wiring on synthetic data

Integration tests that require an actual CAOP GeoPackage live in
test_caop_integration.py (skipped if no data).
"""
from __future__ import annotations

import pytest
from shapely.geometry import Polygon, mapping


# ──────────────────────────────────────────────────────────────────────────────
# caop_normalize
# ──────────────────────────────────────────────────────────────────────────────


class TestNormalize:
    def test_clean_name_strips_uf_prefix(self):
        from services.caop_normalize import clean_name
        assert clean_name("União das Freguesias de Lisboa (Santa Maria Maior)") \
            == "lisboa santa maria maior"
        assert clean_name("União das Freguesias de Braga") == "braga"

    def test_clean_name_strips_diacritics(self):
        from services.caop_normalize import clean_name
        assert clean_name("Évora") == "evora"
        assert clean_name("São João da Madeira") == "sao joao da madeira"

    def test_clean_name_lowercases_and_trims(self):
        from services.caop_normalize import clean_name
        assert clean_name("  FAFE  ") == "fafe"
        assert clean_name("Vila Nova de Famalicão") == "vila nova de famalicao"

    def test_clean_name_handles_empty(self):
        from services.caop_normalize import clean_name
        assert clean_name("") == ""
        assert clean_name(None) == ""  # type: ignore

    def test_title_case_pt_keeps_connectives_lowercase(self):
        from services.caop_normalize import title_case_pt
        assert title_case_pt("vila nova de gaia") == "Vila Nova de Gaia"
        assert title_case_pt("são joão das lampas") == "São João das Lampas"

    def test_title_case_pt_first_word_always_capitalized(self):
        from services.caop_normalize import title_case_pt
        assert title_case_pt("da ribeira") == "Da Ribeira"

    def test_parse_dtmnfr(self):
        from services.caop_normalize import parse_dtmnfr
        assert parse_dtmnfr("030302") == ("03", "0303", "030302")
        assert parse_dtmnfr(30302) == ("03", "0303", "030302")
        # Zero-padded for short codes
        assert parse_dtmnfr("1105") == ("00", "0011", "001105")

    def test_parse_dtmnfr_none(self):
        from services.caop_normalize import parse_dtmnfr
        assert parse_dtmnfr(None) == ("", "", "")


# ──────────────────────────────────────────────────────────────────────────────
# NUTS hierarchy
# ──────────────────────────────────────────────────────────────────────────────


class TestNUTSHierarchy:
    def test_nuts1_constants(self):
        from services.nuts_mapping import NUTS1
        assert NUTS1["PT1"] == "Continente"
        assert NUTS1["PT2"] == "Região Autónoma dos Açores"
        assert NUTS1["PT3"] == "Região Autónoma da Madeira"

    def test_nuts3_resolves_full_hierarchy(self):
        from services.nuts_mapping import resolve
        # Cávado is PT112 → PT11 (Norte) → PT1 (Continente)
        h = resolve("PT112")
        assert h["nuts3_code"] == "PT112"
        assert h["nuts3_name"] == "Cávado"
        assert h["nuts2_code"] == "PT11"
        assert h["nuts2_name"] == "Norte"
        assert h["nuts1_code"] == "PT1"

    def test_algarve_resolves(self):
        from services.nuts_mapping import resolve
        h = resolve("PT150")
        assert h["nuts2_code"] == "PT15"
        assert h["nuts1_code"] == "PT1"

    def test_acores_resolves(self):
        from services.nuts_mapping import resolve
        h = resolve("PT200")
        assert h["nuts2_code"] == "PT20"
        assert h["nuts1_code"] == "PT2"

    def test_unknown_returns_minimal(self):
        from services.nuts_mapping import resolve
        h = resolve("PT999")
        assert h == {"nuts3_code": "PT999"}

    def test_all_nuts3_entries_have_valid_parent(self):
        from services.nuts_mapping import NUTS2, NUTS3
        for code, (name, parent) in NUTS3.items():
            assert parent in NUTS2, f"{code} parent {parent} not in NUTS2"
            assert name, f"{code} has empty name"

    def test_district_to_nuts2_covers_continent(self):
        from services.nuts_mapping import DISTRICT_TO_NUTS2
        # Districts 01-18 plus islands 31,32,40-49
        for d in range(1, 19):
            key = f"{d:02d}"
            assert key in DISTRICT_TO_NUTS2, f"missing district {key}"


# ──────────────────────────────────────────────────────────────────────────────
# geo_validator with empty lookup
# ──────────────────────────────────────────────────────────────────────────────


class TestValidatorEmptyLookup:
    def test_rejects_non_numeric(self):
        from geo_validator import validate
        r = validate("abc", 1.0)  # type: ignore
        assert r.status == "invalid"

    def test_rejects_zero_zero(self):
        from geo_validator import validate
        r = validate(0, 0)
        assert r.status == "invalid"

    def test_rejects_out_of_envelope(self):
        from geo_validator import validate
        # Brasil
        r = validate(-23.5, -46.6)
        assert r.status == "invalid"
        # North Pole
        r = validate(80.0, 0.0)
        assert r.status == "invalid"

    def test_skipped_when_lookup_not_loaded(self):
        from geo_validator import validate
        from services.caop_lookup import lookup
        # Fresh import — lookup is not loaded by default in unit test env
        if not lookup.is_ready:
            r = validate(41.55, -8.42)  # Braga
            assert r.status == "skipped"
            assert r.lat == 41.55
            assert r.lng == -8.42

    def test_envelope_constants(self):
        from geo_validator import PT_LAT_MIN, PT_LAT_MAX, PT_LNG_MIN, PT_LNG_MAX
        # Madeira (~32.7) and Flores (~-31.2) must be inside envelope
        assert PT_LAT_MIN <= 32.7 <= PT_LAT_MAX
        assert PT_LNG_MIN <= -31.2 <= PT_LNG_MAX


# ──────────────────────────────────────────────────────────────────────────────
# CAOP lookup with synthetic data
# ──────────────────────────────────────────────────────────────────────────────


class TestCAOPLookupSynthetic:
    """Feed the lookup a hand-crafted polygon to prove the STRtree path works."""

    def setup_method(self):
        from services.caop_lookup import CAOPLookup, _Layer
        from shapely.strtree import STRtree
        # Braga-ish 1km² square centered on 41.55, -8.42
        poly = Polygon([
            (-8.43, 41.54), (-8.41, 41.54),
            (-8.41, 41.56), (-8.43, 41.56),
        ])
        doc = {
            "code": "030317",
            "name": "Braga (Sé)",
            "municipality_code": "0303",
            "district_code": "03",
            "nuts3_code": "PT112",
            "nuts2_code": "PT11",
            "nuts1_code": "PT1",
            "centroid": {"lat": 41.55, "lng": -8.42},
        }
        self.lookup = CAOPLookup()
        self.lookup._parish.geoms = [poly]
        self.lookup._parish.docs = [doc]
        self.lookup._parish.tree = STRtree([poly])
        self.lookup._parish.loaded = True

    def test_point_inside_returns_match(self):
        info = self.lookup.find_parish(41.55, -8.42)
        assert info is not None
        assert info.inside is True
        assert info.parish_code == "030317"
        assert info.nuts3_code == "PT112"
        assert info.distance_to_border_m == 0.0

    def test_point_outside_returns_none(self):
        info = self.lookup.find_parish(38.72, -9.14)  # Lisboa
        assert info is None

    def test_nearest_outside_still_returns_info(self):
        info = self.lookup.find_nearest_parish(41.56, -8.40)  # just outside bbox
        assert info is not None
        assert info.inside is False
        assert info.distance_to_border_m > 0

    def test_stats(self):
        stats = self.lookup.stats()
        assert stats["parishes"] == 1


# ──────────────────────────────────────────────────────────────────────────────
# Shapely integration guard
# ──────────────────────────────────────────────────────────────────────────────


class TestShapelyStack:
    def test_shapely_2_installed(self):
        import shapely
        major = int(shapely.__version__.split(".")[0])
        assert major >= 2, "CAOP pipeline requires shapely 2.x"

    def test_pyproj_installed(self):
        from pyproj import Transformer
        t = Transformer.from_crs("EPSG:3763", "EPSG:4326", always_xy=True)
        lon, lat = t.transform(-40000, 170000)
        # Rough PT-TM06 → WGS84 sanity: result should fall inside Portugal
        assert 36 < lat < 43
        assert -10 < lon < -6

    def test_strtree_integration(self):
        from shapely.strtree import STRtree
        from shapely.geometry import Point
        polys = [Polygon([(0, 0), (1, 0), (1, 1), (0, 1)])]
        tree = STRtree(polys)
        hits = tree.query(Point(0.5, 0.5), predicate="intersects")
        assert len(hits) == 1


# ──────────────────────────────────────────────────────────────────────────────
# Island CAOP ingestion regressions
# ──────────────────────────────────────────────────────────────────────────────


class TestIslandCAOPIngest:
    """Regressions for CAOP 2025 island GPKGs (EPSG:5014/5015/5016, dtmn/dt)."""

    def test_ptra08_crs_reprojection(self):
        from scripts.ingest_caop import reproject_to_wgs84
        from shapely.geometry import Point
        # A point in PTRA08 / UTM 28N (Madeira) — should land inside Madeira
        pt = Point(298000, 3630000)
        wgs = reproject_to_wgs84(pt, "EPSG:5016")
        assert 32.4 < wgs.y < 33.2, f"expected Madeira lat, got {wgs.y}"
        assert -17.5 < wgs.x < -16.2, f"expected Madeira lng, got {wgs.x}"

    def test_azores_western_reprojection(self):
        from scripts.ingest_caop import reproject_to_wgs84
        from shapely.geometry import Point
        # Point in PTRA08 / UTM 25N should land somewhere in the North Atlantic
        # inside the PT bounding envelope (Flores/Corvo area is the target).
        pt = Point(328000, 4398000)
        wgs = reproject_to_wgs84(pt, "EPSG:5014")
        # Reasonable latitude band for the Azores western group
        assert 38.0 < wgs.y < 41.0
        # Must be west of mainland and east of the date line
        assert -35.5 < wgs.x < -30.0

    def test_normalize_nuts_code_prepends_pt(self):
        from scripts.ingest_caop import _normalize_nuts_code
        assert _normalize_nuts_code("300") == "PT300"
        assert _normalize_nuts_code("200") == "PT200"
        assert _normalize_nuts_code("PT112") == "PT112"
        assert _normalize_nuts_code(None) is None
        assert _normalize_nuts_code("") is None

    def test_parish_doc_from_island_attrs(self):
        from scripts.ingest_caop import _build_parish_doc
        # Minimal MultiPolygon in WGS84 around Prazeres, Madeira
        poly = Polygon([
            (-17.25, 32.75), (-17.24, 32.75),
            (-17.24, 32.76), (-17.25, 32.76),
        ])
        attrs = {
            "dtmnfr": "310108",
            "freguesia": "Prazeres",
            "municipio": "Calheta",
            "distrito_ilha": "Ilha da Madeira",
            "nuts3_cod": "300",
            "nuts3": "Região Autónoma da Madeira",
        }
        doc = _build_parish_doc(attrs, poly)
        assert doc["code"] == "310108"
        assert doc["municipality_code"] == "3101"
        assert doc["district_code"] == "31"
        assert doc["nuts3_code"] == "PT300"
        assert doc["nuts2_code"] == "PT30"
        assert doc["nuts1_code"] == "PT3"
        assert doc["name"] == "Prazeres"

    def test_municipality_doc_uses_dtmn(self):
        from scripts.ingest_caop import _build_municipality_doc
        poly = Polygon([
            (-17.20, 32.70), (-17.10, 32.70),
            (-17.10, 32.80), (-17.20, 32.80),
        ])
        attrs = {
            "dtmn": "3101",
            "municipio": "Calheta",
            "nuts3_cod": "300",
        }
        doc = _build_municipality_doc(attrs, poly)
        assert doc["code"] == "3101"
        assert doc["district_code"] == "31"
        assert doc["nuts3_code"] == "PT300"
        assert doc["name"] == "Calheta"

    def test_district_doc_uses_dt(self):
        from scripts.ingest_caop import _build_district_doc
        poly = Polygon([
            (-17.30, 32.60), (-16.70, 32.60),
            (-16.70, 32.90), (-17.30, 32.90),
        ])
        attrs = {
            "dt": "31",
            "distrito": "Ilha da Madeira",
            "nuts1_cod": "3",
        }
        doc = _build_district_doc(attrs, poly)
        assert doc["code"] == "31"
        assert doc["name"] == "Ilha da Madeira"
        # nuts1_cod=3 → PT3 via _normalize_nuts_code
        assert doc["nuts1_code"] == "PT3"
