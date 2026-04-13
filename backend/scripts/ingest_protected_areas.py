#!/usr/bin/env python3
"""
Ingest Rede Natura 2000 / RNAP / habitat GeoPackage files from ICNF.

Expects files in backend/data/protected_areas/:
  - rede_natura.gpkg      (ZPE + ZEC)
  - rnap.gpkg             (Rede Nacional de Áreas Protegidas)
  - habitats.gpkg         (Directiva Habitats codes)

Populates collections:
  - protected_areas
  - habitats

Usage:
    cd backend
    python3 scripts/ingest_protected_areas.py [--wipe]
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pyproj import Transformer
from shapely.geometry import mapping
from shapely.ops import transform as shp_transform

_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))

from services.caop_normalize import clean_name, title_case_pt  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s  %(message)s")
log = logging.getLogger("protected_areas_ingest")


_T_3763_TO_4326 = Transformer.from_crs("EPSG:3763", "EPSG:4326", always_xy=True)


def reproject(geom, src_crs: str | None):
    if not src_crs:
        return geom
    s = str(src_crs).upper().replace("EPSG:", "")
    if s in ("4326", "WGS84", "WGS 84"):
        return geom
    if s in ("3763", "3857"):
        return shp_transform(lambda x, y, z=None: _T_3763_TO_4326.transform(x, y), geom)
    return geom


def _read(gpkg_path: Path, layer: str):
    import pyogrio
    info = pyogrio.read_info(str(gpkg_path), layer=layer)
    crs = info.get("crs") or "EPSG:3763"
    df = pyogrio.read_dataframe(str(gpkg_path), layer=layer, use_arrow=False)
    for _, row in df.iterrows():
        g = row.geometry
        if g is None or g.is_empty:
            continue
        attrs = {k: v for k, v in row.items() if k != "geometry"}
        yield attrs, g, crs


def _pick(attrs: dict, *keys: str) -> Any:
    for k in keys:
        for actual in attrs:
            if actual.upper() == k.upper() and attrs[actual] not in (None, "", "NULL"):
                return attrs[actual]
    return None


def _build_doc(attrs: dict, geom_wgs, *, category: str, source: str) -> dict[str, Any]:
    name = (
        _pick(attrs, "NOME", "NAME", "DESIG", "DESIGNACAO", "SITE_NAME") or ""
    )
    code = (
        _pick(attrs, "COD_SITIO", "SITECODE", "CODIGO", "COD", "CODE")
        or name[:60]
    )
    bounds = geom_wgs.bounds
    c = geom_wgs.representative_point()
    return {
        "code": str(code).strip(),
        "name": title_case_pt(name),
        "name_clean": clean_name(name),
        "category": category,
        "geometry": mapping(geom_wgs),
        "centroid": {"lat": round(c.y, 6), "lng": round(c.x, 6)},
        "bbox": [round(bounds[0], 6), round(bounds[1], 6),
                 round(bounds[2], 6), round(bounds[3], 6)],
        "source": source,
    }


_LAYER_CATEGORY = {
    "zpe": "Rede Natura 2000 - ZPE",
    "zec": "Rede Natura 2000 - ZEC",
    "sic": "Rede Natura 2000 - SIC",
    "pn": "Parque Nacional",
    "pnr": "Parque Natural Regional",
    "pnat": "Parque Natural",
    "reserva": "Reserva Natural",
    "monumento": "Monumento Natural",
    "paisagem": "Paisagem Protegida",
    "rnap": "RNAP",
}


def _guess_category(layer_name: str, default: str) -> str:
    low = layer_name.lower()
    for keyword, label in _LAYER_CATEGORY.items():
        if keyword in low:
            return label
    return default


async def ingest_file(db, path: Path, *, target_collection: str, source: str):
    import pyogrio
    layers = pyogrio.list_layers(str(path))
    total = 0
    for row in layers:
        layer_name = row[0]
        category = _guess_category(layer_name, target_collection.rstrip("s").title())
        batch = []
        for attrs, geom, crs in _read(path, layer_name):
            try:
                geom_wgs = reproject(geom, crs)
                doc = _build_doc(attrs, geom_wgs, category=category, source=source)
                if doc["code"]:
                    batch.append(doc)
            except Exception as e:
                log.warning("  skipped feature in %s: %s", layer_name, e)
        if not batch:
            continue
        from pymongo import UpdateOne
        ops = [UpdateOne({"code": d["code"]}, {"$set": d}, upsert=True) for d in batch]
        result = await db[target_collection].bulk_write(ops, ordered=False)
        n = (result.upserted_count or 0) + (result.modified_count or 0)
        total += n
        log.info("  %s:%s → %d features (%s)", path.name, layer_name, n, category)
    return total


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wipe", action="store_true")
    args = ap.parse_args()

    load_dotenv(_BACKEND / ".env")
    mongo_url = os.environ.get("MONGO_URL") or os.environ.get("MONGODB_URI")
    if not mongo_url:
        log.error("MONGO_URL not set")
        sys.exit(1)
    db = AsyncIOMotorClient(mongo_url)[os.environ.get("DB_NAME", "portugalvivo")]

    if args.wipe:
        for c in ("protected_areas", "habitats"):
            r = await db[c].delete_many({})
            log.info("wiped %d from %s", r.deleted_count, c)

    for coll in ("protected_areas", "habitats"):
        await db[coll].create_index([("geometry", "2dsphere")])
        await db[coll].create_index("code")
        await db[coll].create_index("category")

    data_dir = _BACKEND / "data" / "protected_areas"
    if not data_dir.exists():
        log.error("Missing directory %s", data_dir)
        sys.exit(2)

    totals = {"protected_areas": 0, "habitats": 0}
    for f in sorted(data_dir.glob("*.gpkg")):
        lower = f.stem.lower()
        if "habitat" in lower:
            target = "habitats"
        else:
            target = "protected_areas"
        n = await ingest_file(db, f, target_collection=target, source=f.stem)
        totals[target] += n

    log.info("=" * 60)
    log.info("DONE. %s", totals)


if __name__ == "__main__":
    asyncio.run(main())
