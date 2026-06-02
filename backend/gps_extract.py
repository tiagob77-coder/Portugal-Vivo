"""
gps_extract.py — robust coordinate parsing for the Excel ingestion path.

The master workbook stores coordinates in several human-entered formats:

  * dot-decimal           "41.276400, -8.283100"
  * Portuguese comma-decimal  "41,086875, -8,132567"   (comma = decimal sep)
  * Google Maps URL       ".../@41.27,-8.28,15z"  or  "...?q=41.27,-8.28"
  * emoji-prefixed place  "📍 Parque Nacional Peneda-Gerês"  (NOT a coord)

The previous `extract_gps_from_text` regex only handled the dot-decimal case;
comma-decimal rows (e.g. the whole *Barragens e Albufeiras* sheet) silently
failed and the POI was dropped. This module centralises parsing so the
importer and the editorial geocoding tool agree on what counts as a real
coordinate.

All parsers are pure and return ``None`` rather than raising.
"""
from __future__ import annotations

import re
from typing import Optional, Tuple

# Portugal bounding envelope (mainland + Madeira + Azores).
PT_LAT_MIN, PT_LAT_MAX = 32.0, 42.5
PT_LNG_MIN, PT_LNG_MAX = -31.5, -6.0

# A latitude in PT is two integer digits (32..42); longitude one or two
# (-6..-31). We keep the integer part short so we don't accidentally glue a
# postal code or phone number into a "coordinate".
_DOT = re.compile(r"(-?\d{1,3}\.\d{3,})\s*[,;]\s*(-?\d{1,3}\.\d{3,})")
# Comma-decimal: exactly four comma/semicolon-separated integer groups, where
# the 1st+2nd form the latitude and the 3rd+4th form the longitude:
#   "41,086875 , -8,132567"  ->  (41.086875, -8.132567)
_COMMA4 = re.compile(
    r"(-?\d{1,3}),(\d{3,})\s*[,;]\s*(-?\d{1,3}),(\d{3,})"
)
# Google Maps URL forms.
_AT = re.compile(r"@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)")
_Q = re.compile(r"[?&](?:q|ll|destination)=(-?\d{1,3}\.\d+)[,%20\s]+(-?\d{1,3}\.\d+)")


def _world_ok(lat: float, lng: float) -> bool:
    return -90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0


def in_pt_envelope(lat: float, lng: float) -> bool:
    return PT_LAT_MIN <= lat <= PT_LAT_MAX and PT_LNG_MIN <= lng <= PT_LNG_MAX


def parse_coord_text(value: object) -> Optional[Tuple[float, float]]:
    """Parse a free-text coordinate cell into (lat, lng).

    Handles dot-decimal and Portuguese comma-decimal. Returns None for place
    names, empty cells, or anything that doesn't yield a world-valid pair.
    Does NOT enforce the PT envelope — callers decide (the importer rejects
    out-of-PT separately so it can log the reason).
    """
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None

    # Dot-decimal first — it's unambiguous and the most common.
    m = _DOT.search(s)
    if m:
        lat, lng = float(m.group(1)), float(m.group(2))
        if _world_ok(lat, lng):
            return (lat, lng)

    # Comma-decimal (four integer groups). Guard against matching a
    # dot-decimal pair that merely contains a thousands-style comma by only
    # firing when there is no '.' in the matched span.
    m = _COMMA4.search(s)
    if m and "." not in m.group(0):
        lat = float(f"{m.group(1)}.{m.group(2)}")
        lng = float(f"{m.group(3)}.{m.group(4)}")
        if _world_ok(lat, lng):
            return (lat, lng)

    return None


def parse_coord_url(value: object) -> Optional[Tuple[float, float]]:
    """Parse a Google Maps hyperlink/URL into (lat, lng)."""
    if value is None:
        return None
    s = str(value)
    if not s:
        return None
    for rx in (_AT, _Q):
        m = rx.search(s)
        if m:
            lat, lng = float(m.group(1)), float(m.group(2))
            if _world_ok(lat, lng):
                return (lat, lng)
    return None


def extract_coords(value: object) -> Optional[Tuple[float, float]]:
    """Best-effort: try URL forms first (more specific), then free text."""
    return parse_coord_url(value) or parse_coord_text(value)


# ── Header-aware column detection ────────────────────────────────────────────

# Header labels (lower-cased, substring match) that mark a coordinate column.
_GPS_HEADER = "gps"
# Anchor columns, in geocoding-preference order: a full street address beats a
# bare locality, which beats a habitat/observation hint.
_ANCHOR_HEADERS = (
    "morada",
    "endereço",
    "endereco",
    "address",
    "local emblemático",
    "local emblematico",
    "localização",
    "localizacao",
    "onde observar",
    "localidade",
    "habitat",
    "restaurante sug",
    "local",
)


def detect_gps_columns(headers: list) -> list:
    """Return indices of every column whose header contains 'gps'."""
    return [
        ci for ci, h in enumerate(headers)
        if h and _GPS_HEADER in str(h).lower()
    ]


def detect_anchor_column(headers: list) -> Optional[int]:
    """Return the index of the best geocoding-anchor column, or None."""
    lowered = [(ci, str(h).lower().strip()) for ci, h in enumerate(headers) if h]
    for key in _ANCHOR_HEADERS:
        for ci, hl in lowered:
            if key == hl or key in hl:
                return ci
    return None


# Emoji / label prefixes that decorate anchor cells ("📍 X", "🍽 Y", "👁 Z").
_ANCHOR_PREFIX = re.compile(r"^[^\w\(]+", re.UNICODE)


def clean_anchor(value: object) -> str:
    """Strip leading emoji/pin decorations from an anchor cell."""
    if value is None:
        return ""
    return _ANCHOR_PREFIX.sub("", str(value).strip()).strip()
