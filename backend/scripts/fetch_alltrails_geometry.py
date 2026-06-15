"""
Fetch + validate OSM geometry for the curated AllTrails trails and bake it into
data/alltrails_pt_geometry.json, so the featured trails render as lines on the
map without a runtime backfill.

The dev sandbox blocks outbound network, so run this where the Overpass API is
reachable (a GitHub runner, or locally):

    python scripts/fetch_alltrails_geometry.py            # dry-run, prints results
    python scripts/fetch_alltrails_geometry.py --write    # write the geometry file
    python scripts/fetch_alltrails_geometry.py --write --max-points 150 --min-score 0.4

For each trail it searches the park's bounding box by name (Overpass), picks the
best match by name+distance, validates the geometry, downsamples it, and stores
the polyline keyed by the AllTrails id. Only validated geometry is written.
"""
import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

# Make the backend package importable when run as `python scripts/...`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.overpass_service import OverpassService  # noqa: E402
from trails_quality import (  # noqa: E402
    load_alltrails_reference,
    bbox_for_trail,
    overpass_name_regex,
    pick_best_osm_match,
    validate_trail_geometry,
    downsample_points,
)

_GEOM_PATH = Path(__file__).resolve().parent.parent / "data" / "alltrails_pt_geometry.json"


async def fetch_all(write: bool, max_points: int, min_score: float) -> dict:
    overpass = OverpassService()
    trails = load_alltrails_reference()
    print(f"Curated trails: {len(trails)}")

    geometry: dict = {}
    validated = 0
    rejected = 0
    no_match = 0

    for rec in trails:
        name = rec.get("name", "")
        bbox = bbox_for_trail(rec)
        regex = overpass_name_regex(name)
        if not bbox or not regex:
            no_match += 1
            print(f"  · {name[:46]:46} sem bbox/nome")
            continue

        candidates = await overpass.find_named_hiking_trails(*bbox, regex)
        # Match against a trail-shaped dict (name + expected distance).
        target = {"name": name, "distance_km": rec.get("distance_km"), "points": []}
        best, score = pick_best_osm_match(target, candidates, min_score)
        if not best:
            no_match += 1
            print(f"  ✗ {name[:46]:46} sem match ({len(candidates)} candidatos)")
            continue

        ok, issues, stats = validate_trail_geometry(best["points"], rec.get("distance_km"))
        if not ok:
            rejected += 1
            print(f"  ⚠ {name[:46]:46} rejeitado: {', '.join(issues)} {stats}")
            continue

        pts = downsample_points(best["points"], max_points)
        geometry[str(rec["alltrails_id"])] = {
            "osm_id": best.get("osm_id"),
            "length_km": stats["length_km"],
            "validated": True,
            "points": pts,
        }
        validated += 1
        print(f"  ✓ {name[:46]:46} pts={len(pts)} len={stats['length_km']}km score={score}")

    print(f"\nValidados {validated}, rejeitados {rejected}, sem match {no_match} "
          f"(de {len(trails)}).")

    if write:
        payload = json.loads(_GEOM_PATH.read_text(encoding="utf-8")) if _GEOM_PATH.exists() else {}
        payload.setdefault("_meta", {})
        payload["geometry"] = geometry
        _GEOM_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Escrito {_GEOM_PATH} ({validated} trilhos com geometria).")
    else:
        print("Dry-run: usa --write para gravar o ficheiro.")

    return {"validated": validated, "rejected": rejected, "no_match": no_match}


def main() -> None:
    p = argparse.ArgumentParser(description="Bake validated OSM geometry into the AllTrails dataset.")
    p.add_argument("--write", action="store_true", help="Write data/alltrails_pt_geometry.json.")
    p.add_argument("--max-points", type=int, default=200, help="Downsample each polyline to at most N points.")
    p.add_argument("--min-score", type=float, default=0.45)
    args = p.parse_args()
    asyncio.run(fetch_all(args.write, args.max_points, args.min_score))


if __name__ == "__main__":
    main()
