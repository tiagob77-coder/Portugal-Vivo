"""
Geocode POIs that the v19 Excel left without coordinates.

Reads `poi_gps_v19_missing.json` (produced by extract_poi_gps_v19.py) and
calls Nominatim/OpenStreetMap to resolve each POI's lat/lng using its
name + locality + concelho + region. Results are appended into
`poi_gps_v19.json` so a subsequent `apply_poi_gps_v19.py --apply` will push
them to MongoDB.

Nominatim usage policy: 1 request per second, valid User-Agent required.
We persist a per-name cache so re-runs don't re-hit the API for known POIs.

Usage:
    python geocode_missing_pois.py --limit 100      # only first 100
    python geocode_missing_pois.py --user-agent "PortugalVivo/1.0 (you@example.com)"
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any, Optional

import urllib.parse
import urllib.request

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

DEFAULT_MISSING = Path(__file__).parent / "data" / "poi_gps_v19_missing.json"
DEFAULT_OUT = Path(__file__).parent / "data" / "poi_gps_v19.json"
DEFAULT_CACHE = Path(__file__).parent / "data" / "poi_gps_v19_geocode_cache.json"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
LAT_MIN, LAT_MAX = 32.0, 43.0
LNG_MIN, LNG_MAX = -32.0, -6.0


def build_query(poi: dict) -> str:
    parts = [poi["name"]]
    for k in ("localidade", "concelho", "distrito"):
        v = poi.get(k)
        if v and v not in parts:
            parts.append(v)
    parts.append("Portugal")
    return ", ".join(parts)


def geocode_one(query: str, user_agent: str, timeout: float = 10.0) -> Optional[dict]:
    params = {
        "q": query,
        "format": "json",
        "limit": "1",
        "countrycodes": "pt",
        "accept-language": "pt-PT",
    }
    url = f"{NOMINATIM_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": user_agent})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.load(resp)
    except Exception as e:
        log.warning(f"  ! request failed for {query!r}: {e}")
        return None
    if not data:
        return None
    hit = data[0]
    try:
        lat = float(hit["lat"])
        lng = float(hit["lon"])
    except (KeyError, ValueError):
        return None
    if not (LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX):
        return None
    return {"lat": lat, "lng": lng, "display_name": hit.get("display_name", "")}


def load_cache(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        log.warning("Cache file corrupt — starting fresh.")
        return {}


def save_cache(path: Path, cache: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=2))


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--missing", type=Path, default=DEFAULT_MISSING)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT,
                   help="poi_gps_v19.json to append into")
    p.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    p.add_argument("--limit", type=int, default=0, help="Process at most N POIs (0 = all)")
    p.add_argument("--user-agent", default="PortugalVivo-GPS/1.0 (admin@portugalvivo.pt)")
    p.add_argument("--sleep", type=float, default=1.05,
                   help="Seconds between requests (Nominatim policy = 1/s).")
    args = p.parse_args()

    if not args.missing.exists():
        log.error(f"Missing JSON not found: {args.missing}")
        return 1

    missing_payload = json.loads(args.missing.read_text())
    pois = missing_payload["pois"]
    if args.limit > 0:
        pois = pois[: args.limit]

    cache = load_cache(args.cache)
    log.info(f"📥 {len(pois)} POIs to geocode (cache: {len(cache)} entries)")

    new_results: list[dict] = []
    cache_hits, api_hits, misses = 0, 0, 0

    for i, poi in enumerate(pois, 1):
        key = f"{poi['name_normalised']}|{poi.get('concelho') or poi.get('localidade') or ''}|{poi.get('region') or ''}".lower()
        cached = cache.get(key)
        if cached is not None:
            cache_hits += 1
            if cached.get("location"):
                poi_out = dict(poi)
                poi_out["location"] = cached["location"]
                poi_out["coord_source"] = "nominatim_cached"
                new_results.append(poi_out)
            continue

        query = build_query(poi)
        result = geocode_one(query, args.user_agent)
        time.sleep(args.sleep)

        if result:
            api_hits += 1
            loc = {"lat": result["lat"], "lng": result["lng"]}
            cache[key] = {"location": loc, "query": query, "display_name": result.get("display_name", "")}
            poi_out = dict(poi)
            poi_out["location"] = loc
            poi_out["coord_source"] = "nominatim"
            new_results.append(poi_out)
            if i % 20 == 0:
                save_cache(args.cache, cache)
                log.info(f"  💾 cache flushed at {i}/{len(pois)} ({api_hits} hits, {misses} misses)")
        else:
            misses += 1
            cache[key] = {"location": None, "query": query}

        if i % 50 == 0:
            log.info(f"  … {i}/{len(pois)} processed")

    save_cache(args.cache, cache)

    # Merge into output JSON. Include `sheet` (and source_id) in the dedup
    # key — the same name+region may appear in multiple sheets.
    def _dedup_key(p: dict) -> tuple:
        return (
            p["name_normalised"],
            p.get("region", ""),
            p.get("sheet", ""),
            p.get("source_id") or "",
        )

    out_payload = json.loads(args.out.read_text()) if args.out.exists() else {"pois": []}
    existing_keys = {_dedup_key(p) for p in out_payload.get("pois", [])}
    appended = 0
    for poi in new_results:
        k = _dedup_key(poi)
        if k in existing_keys:
            continue
        out_payload["pois"].append(poi)
        existing_keys.add(k)
        appended += 1

    out_payload["totals"] = out_payload.get("totals", {})
    out_payload["totals"]["geocoded_via_nominatim"] = out_payload["totals"].get("geocoded_via_nominatim", 0) + api_hits
    args.out.write_text(json.dumps(out_payload, ensure_ascii=False, indent=2))

    log.info("\n" + "=" * 60)
    log.info("📊 GEOCODING SUMMARY")
    log.info("=" * 60)
    log.info(f"  Input POIs:    {len(pois)}")
    log.info(f"  Cache hits:    {cache_hits}")
    log.info(f"  API hits:      {api_hits}")
    log.info(f"  Misses (none): {misses}")
    log.info(f"  Appended to {args.out.name}: {appended}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
