"""
Tests for trails_api.parse_gpx — the GPX-file parser behind trail uploads.

Regression cover for TRAIL-001: parse_gpx used ``find(...) or find(...)``
chains, and an ElementTree element with no children is falsy, so the real
<name>/<desc>/<ele> nodes of a standard namespaced GPX 1.1 file were skipped.
Elevation, name and description were silently dropped — which zeroed the
Naismith time estimate and pinned every uploaded trail to "facil".
"""
import pytest

from trails_api import parse_gpx


def _gpx_11(track_body: str) -> str:
    return (
        '<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">'
        f'{track_body}</gpx>'
    )


def _seg(points) -> str:
    """Build a <trkseg> from (lat, lon, ele) tuples; ele may be None."""
    pts = "".join(
        f'<trkpt lat="{lat}" lon="{lon}">'
        + (f'<ele>{ele}</ele>' if ele is not None else '')
        + '</trkpt>'
        for lat, lon, ele in points
    )
    return f'<trkseg>{pts}</trkseg>'


def test_namespaced_gpx_extracts_name_and_description():
    gpx = _gpx_11(
        '<trk><name>Trilho da Serra</name><desc>Bonito</desc>'
        + _seg([(38.70, -9.10, 100), (38.71, -9.10, 150)])
        + '</trk>'
    )
    out = parse_gpx(gpx)
    assert out["name"] == "Trilho da Serra"
    assert out["description"] == "Bonito"


def test_namespaced_gpx_extracts_elevation():
    """TRAIL-001: elevation must survive parsing of a standard GPX 1.1 file."""
    gpx = _gpx_11('<trk>' + _seg([
        (38.70, -9.10, 100),
        (38.71, -9.10, 150),
        (38.72, -9.10, 120),
    ]) + '</trk>')
    out = parse_gpx(gpx)
    assert out["elevation_gain"] == 50   # 100 -> 150
    assert out["elevation_loss"] == 30   # 150 -> 120
    assert out["min_elevation"] == 100
    assert out["max_elevation"] == 150


def test_distance_is_summed_across_points():
    gpx = _gpx_11('<trk>' + _seg([
        (38.70, -9.10, None), (38.71, -9.10, None), (38.72, -9.10, None),
    ]) + '</trk>')
    out = parse_gpx(gpx)
    # ~1.11 km per 0.01 deg of latitude, across two segments.
    assert out["distance_km"] == pytest.approx(2.2, abs=0.2)
    assert len(out["points"]) == 3


def test_no_elevation_data_yields_zero_elevation_stats():
    gpx = _gpx_11('<trk>' + _seg([(38.70, -9.10, None), (38.71, -9.10, None)]) + '</trk>')
    out = parse_gpx(gpx)
    assert out["elevation_gain"] == 0
    assert out["elevation_loss"] == 0
    assert out["min_elevation"] == 0
    assert out["max_elevation"] == 0
    assert out["distance_km"] > 0  # distance is still computed


def test_empty_gpx_without_tracks():
    out = parse_gpx(_gpx_11(''))
    assert out["points"] == []
    assert out["distance_km"] == 0
    assert out["elevation_gain"] == 0
    assert out["name"] == ""


def test_single_point_has_zero_distance():
    gpx = _gpx_11('<trk>' + _seg([(38.70, -9.10, 100)]) + '</trk>')
    out = parse_gpx(gpx)
    assert len(out["points"]) == 1
    assert out["distance_km"] == 0


def test_missing_name_and_desc_default_to_empty():
    gpx = _gpx_11('<trk>' + _seg([(38.70, -9.10, 100), (38.71, -9.10, 110)]) + '</trk>')
    out = parse_gpx(gpx)
    assert out["name"] == ""
    assert out["description"] == ""


def test_non_namespaced_gpx_is_parsed():
    gpx = (
        '<gpx version="1.1"><trk><name>Sem NS</name>'
        + _seg([(40.00, -8.00, 10), (40.01, -8.00, 40)])
        + '</trk></gpx>'
    )
    out = parse_gpx(gpx)
    assert out["name"] == "Sem NS"
    assert out["elevation_gain"] == 30
    assert len(out["points"]) == 2


def test_elevation_gain_only_for_uphill_track():
    gpx = _gpx_11('<trk>' + _seg([
        (38.70, -9.10, 100), (38.71, -9.10, 200), (38.72, -9.10, 350),
    ]) + '</trk>')
    out = parse_gpx(gpx)
    assert out["elevation_gain"] == 250
    assert out["elevation_loss"] == 0
