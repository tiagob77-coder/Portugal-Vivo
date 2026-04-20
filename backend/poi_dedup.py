"""
POI deduplication helpers.

Centralises the rules that decide whether two POI rows represent the same
real-world place. Used by importers (`poi_v19_importer`, future excel/CSV
paths) and the data-quality validator script.

Why centralise:
  - Importers were each rolling their own in-memory dedup set (race-prone
    when DB state changes mid-import, no protection against repeated runs).
  - The data-quality script needs the same rules to flag existing duplicates.

The natural-key rules are intentionally conservative:
  1. `poi_source_id` (when present) is a hard unique key.
  2. Otherwise, name+region (case/whitespace-normalised) is the soft key.
  3. If coordinates exist on both sides, items closer than 50m AND with the
     same normalised name are treated as duplicates regardless of region.
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any, Dict, Iterable, List, Optional, Tuple

from shared_utils import haversine_meters

# Two POIs with the same name but coords closer than this are duplicates.
_COORD_DUPLICATE_RADIUS_M = 50.0

_WS_RE = re.compile(r"\s+")
_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)


def normalise_name(name: Optional[str]) -> str:
    """Lowercase, strip diacritics, collapse whitespace, drop punctuation."""
    if not name:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(name))
    no_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    no_punct = _PUNCT_RE.sub(" ", no_accents.lower())
    return _WS_RE.sub(" ", no_punct).strip()


def normalise_region(region: Optional[str]) -> str:
    if not region:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(region))
    no_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    return no_accents.lower().strip()


def _location_coords(location: Any) -> Optional[Tuple[float, float]]:
    """Extract (lat, lng) from heritage_items.location or None."""
    if not isinstance(location, dict):
        return None
    lat = location.get("lat")
    lng = location.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return None
    return float(lat), float(lng)


def is_same_poi(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    """True if `a` and `b` represent the same place under the dedup rules."""
    a_src = (a.get("poi_source_id") or "").strip()
    b_src = (b.get("poi_source_id") or "").strip()
    if a_src and b_src and a_src == b_src:
        return True

    a_name = normalise_name(a.get("name"))
    b_name = normalise_name(b.get("name"))
    if not a_name or not b_name or a_name != b_name:
        return False

    a_region = normalise_region(a.get("region"))
    b_region = normalise_region(b.get("region"))
    if a_region and b_region and a_region == b_region:
        return True

    a_coords = _location_coords(a.get("location"))
    b_coords = _location_coords(b.get("location"))
    if a_coords and b_coords:
        dist = haversine_meters(a_coords[0], a_coords[1], b_coords[0], b_coords[1])
        if dist <= _COORD_DUPLICATE_RADIUS_M:
            return True

    return False


async def find_duplicate(
    collection,
    *,
    name: str,
    region: Optional[str] = None,
    poi_source_id: Optional[str] = None,
    location: Optional[Dict[str, float]] = None,
) -> Optional[Dict[str, Any]]:
    """Look up an existing POI that matches the dedup rules.

    Returns the existing document (without `_id`) or None.
    Designed to be called once per row during import — uses the indexed
    `name_normalised` field so the cost is O(log n).
    """
    src = (poi_source_id or "").strip()
    if src:
        existing = await collection.find_one(
            {"poi_source_id": src}, {"_id": 0}
        )
        if existing:
            return existing

    norm_name = normalise_name(name)
    if not norm_name:
        return None

    # Primary lookup: normalised-name index (accent/case insensitive).
    candidates = await collection.find(
        {"name_normalised": norm_name},
        {
            "_id": 0, "id": 1, "name": 1, "region": 1,
            "location": 1, "poi_source_id": 1, "name_normalised": 1,
        },
    ).to_list(length=20)

    # Fallback for legacy rows without name_normalised: case-insensitive exact
    # regex on the raw name (will miss accent variants, but that's the only
    # way to find pre-migration documents).
    if not candidates:
        candidates = await collection.find(
            {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}},
            {"_id": 0, "id": 1, "name": 1, "region": 1,
             "location": 1, "poi_source_id": 1},
        ).to_list(length=20)

    candidate_doc = {
        "name": name,
        "region": region,
        "location": location or {},
        "poi_source_id": src,
    }
    for cand in candidates:
        if is_same_poi(candidate_doc, cand):
            return cand
    return None


def find_duplicates_in_set(docs: Iterable[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    """Group docs into duplicate clusters (size>=2) for the validator script.

    O(n^2) within name buckets — fine for full-collection sweeps in the
    thousands; we don't want to hit it on the import hot path.
    """
    by_name: Dict[str, List[Dict[str, Any]]] = {}
    for doc in docs:
        key = normalise_name(doc.get("name"))
        if not key:
            continue
        by_name.setdefault(key, []).append(doc)

    clusters: List[List[Dict[str, Any]]] = []
    for bucket in by_name.values():
        if len(bucket) < 2:
            continue
        used = [False] * len(bucket)
        for i, doc in enumerate(bucket):
            if used[i]:
                continue
            cluster = [doc]
            used[i] = True
            for j in range(i + 1, len(bucket)):
                if used[j]:
                    continue
                if is_same_poi(doc, bucket[j]):
                    cluster.append(bucket[j])
                    used[j] = True
            if len(cluster) >= 2:
                clusters.append(cluster)
    return clusters
