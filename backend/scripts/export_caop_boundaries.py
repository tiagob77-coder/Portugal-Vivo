#!/usr/bin/env python3
"""
Export CAOP boundaries to GeoJSON / TopoJSON for the frontend map.

Outputs go to backend/data/exports/:
  - caop_distritos.geojson   (~0.5 MB, always included)
  - caop_concelhos.geojson   (~3 MB)
  - caop_freguesias.geojson  (~15 MB, tolerance-simplified)
  - caop_freguesias.min.geojson (heavily simplified for overview)

Optional: if `topojson` (pip install topojson) is available, a matching
`.topojson` file is produced with shared arc encoding (~8x smaller).

For mobile offline use, convert the resulting .geojson to MBTiles with
tippecanoe (not invoked here):
    tippecanoe -o caop_freguesias.mbtiles -l freguesias \
        -z 12 -Z 6 -pk -ps \
        backend/data/exports/caop_freguesias.geojson

Usage:
    cd backend
    python3 scripts/export_caop_boundaries.py [--tolerance 0.0001]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from shapely.geometry import mapping, shape

_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s  %(message)s")
log = logging.getLogger("export_caop")


async def _dump_collection(db, coll: str, out_path: Path, tolerance: float):
    features: list[dict] = []
    async for d in db[coll].find({}, {"_id": 0}):
        g_raw = d.get("geometry")
        if not g_raw:
            continue
        try:
            geom = shape(g_raw)
            if tolerance > 0:
                geom = geom.simplify(tolerance, preserve_topology=True)
            if geom.is_empty:
                continue
        except Exception as e:
            log.warning("skip %s: %s", d.get("code"), e)
            continue
        props = {k: v for k, v in d.items() if k != "geometry"}
        features.append({
            "type": "Feature",
            "geometry": mapping(geom),
            "properties": props,
        })

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(
            {"type": "FeatureCollection", "features": features},
            ensure_ascii=False, separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    log.info("  wrote %d features → %s (%.1f KB)",
             len(features), out_path, out_path.stat().st_size / 1024)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tolerance", type=float, default=0.0001,
                    help="Douglas-Peucker tolerance in degrees (default 0.0001 ≈ 10m)")
    ap.add_argument("--min-tolerance", type=float, default=0.01,
                    help="Extra heavy tolerance for overview files")
    args = ap.parse_args()

    load_dotenv(_BACKEND / ".env")
    mongo_url = os.environ.get("MONGO_URL") or os.environ.get("MONGODB_URI")
    if not mongo_url:
        log.error("MONGO_URL not set")
        sys.exit(1)
    db = AsyncIOMotorClient(mongo_url)[os.environ.get("DB_NAME", "portugalvivo")]

    out = _BACKEND / "data" / "exports"

    await _dump_collection(db, "caop_distritos", out / "caop_distritos.geojson", args.tolerance)
    await _dump_collection(db, "caop_concelhos", out / "caop_concelhos.geojson", args.tolerance)
    await _dump_collection(db, "caop_freguesias", out / "caop_freguesias.geojson", args.tolerance)
    await _dump_collection(db, "caop_freguesias", out / "caop_freguesias.min.geojson", args.min_tolerance)

    # Optional TopoJSON
    try:
        import topojson as tp  # type: ignore
        log.info("generating TopoJSON with shared arcs…")
        for name in ("caop_distritos", "caop_concelhos", "caop_freguesias"):
            src = (out / f"{name}.geojson").read_text(encoding="utf-8")
            topo = tp.Topology(json.loads(src), prequantize=True).to_json()
            (out / f"{name}.topojson").write_text(topo, encoding="utf-8")
            log.info("  wrote %s.topojson", name)
    except ImportError:
        log.info("(skipping TopoJSON — `pip install topojson` to enable)")

    log.info("DONE — exports in %s", out)


if __name__ == "__main__":
    asyncio.run(main())
