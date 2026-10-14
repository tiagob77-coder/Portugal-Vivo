"""
Territory helpers shared by the B2G (municipal) and B2B (partner API) modules.

heritage_items identify their municipality in two ways that co-exist in the
dataset: ``municipality_id`` (set by the Excel importer) and ``concelho``
(free-text name from the master workbook). Everything municipal keys on a
single slug so both forms resolve to the same territory:

    "Évora"            -> "evora"
    "Vila Nova de Gaia" -> "vila-nova-de-gaia"
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, Iterable, Optional

# Public listings hide POIs a municipality unpublished. Items without the
# field (the whole national dataset) stay visible — same convention as
# agenda_api.PUBLISHED_FILTER for events.
PUBLISHED_POI_FILTER: Dict[str, Any] = {"is_published": {"$ne": False}}

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def municipality_slug(name: Optional[str]) -> str:
    """Accent-insensitive, lowercase, hyphenated slug for a municipality name."""
    if not name:
        return ""
    ascii_name = unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode("ascii")
    return _SLUG_RE.sub("-", ascii_name.lower()).strip("-")


def resolve_poi_municipality(poi: Dict[str, Any]) -> Optional[str]:
    """Municipality slug for a POI document, or None when it has no territory."""
    explicit = poi.get("municipality_id")
    if explicit:
        return municipality_slug(explicit)
    concelho = poi.get("concelho")
    if concelho:
        return municipality_slug(concelho)
    return None


_ACCENTS = {
    "a": "aáàâãAÁÀÂÃ", "e": "eéèêEÉÈÊ", "i": "iíìîIÍÌÎ", "o": "oóòôõOÓÒÔÕ",
    "u": "uúùûüUÚÙÛÜ", "c": "cçCÇ",
}


def name_regex(name: str) -> str:
    """Anchored, accent- and case-insensitive regex for a municipality name
    ("evora" matches "Évora"; "vila-nova-de-gaia" matches "Vila Nova de Gaia")."""
    parts = []
    for ch in municipality_slug(name):
        if ch == "-":
            parts.append(r"[\s\-_]+")
        elif ch in _ACCENTS:
            parts.append(f"[{_ACCENTS[ch]}]")
        else:
            parts.append(f"[{ch}{ch.upper()}]" if ch.isalpha() else re.escape(ch))
    return "^" + "".join(parts) + "$"


def territory_filter(municipality_ids: Iterable[str] = (), concelhos: Iterable[str] = ()) -> Dict[str, Any]:
    """Mongo filter matching POIs of any of the given municipalities.

    Matches ``municipality_id`` exactly (raw value and slug) and ``concelho``
    accent- and case-insensitively, so POIs imported through either path are
    found.
    Returns a filter that matches nothing when both inputs are empty, so a
    misconfigured tenant never sees the national dataset.
    """
    ids = {m for m in municipality_ids if m}
    slugs = {municipality_slug(m) for m in ids}
    # excel_import_api normalises names with underscores ("vila_nova_de_gaia")
    ids |= slugs | {s.replace("-", "_") for s in slugs}
    names = {municipality_slug(c) for c in concelhos if c} | slugs
    clauses: list = []
    if ids:
        clauses.append({"municipality_id": {"$in": sorted(ids)}})
    for name in sorted(n for n in names if n):
        clauses.append({"concelho": {"$regex": name_regex(name)}})
    if not clauses:
        return {"_id": {"$exists": False}}
    return clauses[0] if len(clauses) == 1 else {"$or": clauses}
