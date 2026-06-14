"""
Backfill real GPS geometry for trails that only have a trailhead point.

AllTrails (and the heritage-derived seed) provide trail metadata but no
polyline, so such trails render as a single marker instead of a line — the map
only draws a trail when ``points.length > 1``. This script queries OSM via
Overpass around each trail's trailhead, picks the best matching hiking route by
name / distance / proximity (see ``trails_quality.pick_best_osm_match``), and
writes its ``points`` polyline back to MongoDB.

Usage:
    python backfill_trail_geometry.py                  # dry-run, prints matches
    python backfill_trail_geometry.py --apply          # write geometry to Mongo
    python backfill_trail_geometry.py --apply --limit 50 --radius 8000
"""
import argparse
import asyncio
import os

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from services.overpass_service import OverpassService
from trails_quality import pick_best_osm_match, bbox_for_trail, overpass_name_regex

load_dotenv()


async def backfill(apply: bool, limit: int, radius_m: int, min_score: float) -> dict:
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client[os.getenv("DB_NAME", "portugal_vivo")]
    overpass = OverpassService()

    # Trails lacking a drawable polyline: explicit flag OR fewer than 2 points.
    query = {"$or": [{"needs_geometry": True}, {"points.1": {"$exists": False}}]}
    trails = await db.trails.find(query, {"_id": 0}).limit(limit).to_list(limit)
    print(f"Trails needing geometry: {len(trails)}")

    matched = 0
    for t in trails:
        pts = t.get("points") or []
        if pts and pts[0].get("lat") is not None:
            # Trail with a trailhead point (heritage seed): search around it.
            candidates = await overpass.find_hiking_trails_with_geometry(
                pts[0]["lat"], pts[0]["lng"], radius_m)
        else:
            # No coordinate (AllTrails set): search the park bbox by name.
            bbox = bbox_for_trail(t)
            regex = overpass_name_regex(t.get("name"))
            if not bbox or not regex:
                print(f"  · {t.get('name', '?')[:48]:48}  skipped (no trailhead / bbox)")
                continue
            candidates = await overpass.find_named_hiking_trails(*bbox, regex)

        best, score = pick_best_osm_match(t, candidates, min_score)

        if not best:
            print(f"  ✗ {t.get('name', '?')[:48]:48}  no match "
                  f"({len(candidates)} candidates)")
            continue

        matched += 1
        print(f"  ✓ {t.get('name', '?')[:48]:48}  ← OSM '{best['name'][:36]}' "
              f"score={score} pts={best['point_count']}")
        if apply:
            await db.trails.update_one(
                {"id": t["id"]},
                {"$set": {
                    "points": best["points"],
                    "needs_geometry": False,
                    "geometry_source": "osm",
                    "osm_id": best.get("osm_id"),
                    "gps_distance_km": best.get("distance_km"),
                }},
            )

    print(f"\n{'Applied' if apply else 'Dry-run'}: {matched}/{len(trails)} matched.")
    client.close()
    return {"total": len(trails), "matched": matched, "applied": apply}


def main() -> None:
    p = argparse.ArgumentParser(
        description="Backfill trail GPS geometry from OSM/Overpass."
    )
    p.add_argument("--apply", action="store_true",
                   help="Write geometry to MongoDB (default: dry-run).")
    p.add_argument("--limit", type=int, default=200)
    p.add_argument("--radius", type=int, default=6000,
                   help="Overpass search radius around the trailhead (metres).")
    p.add_argument("--min-score", type=float, default=0.45)
    args = p.parse_args()
    asyncio.run(backfill(args.apply, args.limit, args.radius, args.min_score))


if __name__ == "__main__":
    main()
