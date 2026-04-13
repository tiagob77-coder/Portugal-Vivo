#!/usr/bin/env python3
"""
CAOP ingestion — reads CAOP GeoPackage files from backend/data/caop/,
reprojects geometries from EPSG:3763 (ETRS89/PT-TM06) to EPSG:4326 (WGS84),
normalizes names, computes centroid/bbox/area_km2, and upserts into MongoDB.

Collections produced:
  - caop_distritos
  - caop_concelhos
  - caop_freguesias

Each collection has:
  - 2dsphere index on `geometry`
  - unique index on `code`
  - index on `name_clean`

Usage:
    cd backend
    python3 scripts/ingest_caop.py [--wipe] [--file path/to/file.gpkg]

If no --file is given, all *.gpkg files in data/caop/ are processed.
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
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform

# Make backend/ importable when running as a script
_BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND))

from services.caop_normalize import clean_name, parse_dtmnfr, title_case_pt  # noqa: E402
from services.nuts_mapping import DISTRICT_TO_NUTS2, resolve as resolve_nuts  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
)
log = logging.getLogger("caop_ingest")


# ─── Geometry helpers ────────────────────────────────────────────────────────

_TRANSFORMER_3763_TO_4326 = Transformer.from_crs(
    "EPSG:3763", "EPSG:4326", always_xy=True
)
_TRANSFORMER_4326_TO_3763 = Transformer.from_crs(
    "EPSG:4326", "EPSG:3763", always_xy=True
)


def reproject_to_wgs84(geom, source_crs: str | None):
    """Reproject to EPSG:4326. If source is already WGS84, return unchanged."""
    if not source_crs:
        return geom
    s = source_crs.upper().replace("EPSG:", "")
    if s in ("4326", "WGS84", "WGS 84"):
        return geom
    if s in ("3763", "3857"):  # PT-TM06 or Web Mercator
        # pyproj's Transformer with always_xy handles lon/lat order for output
        return shp_transform(
            lambda x, y, z=None: _TRANSFORMER_3763_TO_4326.transform(x, y),
            geom,
        )
    log.warning("Unsupported source CRS %s — assuming WGS84", source_crs)
    return geom


def compute_area_km2(geom_wgs84) -> float:
    """Area in km² (via projection back to PT-TM06 meters, then divide 1e6)."""
    try:
        projected = shp_transform(
            lambda x, y, z=None: _TRANSFORMER_4326_TO_3763.transform(x, y),
            geom_wgs84,
        )
        return round(projected.area / 1_000_000.0, 4)
    except Exception:
        return 0.0


def compute_bbox(geom) -> list[float]:
    """[min_lng, min_lat, max_lng, max_lat]."""
    minx, miny, maxx, maxy = geom.bounds
    return [round(minx, 6), round(miny, 6), round(maxx, 6), round(maxy, 6)]


def compute_centroid(geom) -> dict[str, float]:
    c = geom.representative_point()  # guaranteed inside polygon
    return {"lat": round(c.y, 6), "lng": round(c.x, 6)}


# ─── GPKG reading ────────────────────────────────────────────────────────────

def _detect_layer(gpkg_path: Path) -> list[dict[str, Any]]:
    """Return list of {layer_name, guessed_kind, source_crs} for GPKG layers."""
    try:
        import pyogrio
    except ImportError as e:
        raise RuntimeError("pyogrio is required — pip install pyogrio") from e
    info = pyogrio.list_layers(str(gpkg_path))
    detected: list[dict[str, Any]] = []
    for row in info:
        name, geom_type = row[0], row[1] if len(row) > 1 else None
        lower = name.lower()
        kind = None
        if "freg" in lower:
            kind = "freguesia"
        elif "conc" in lower or "munic" in lower:
            kind = "concelho"
        elif "dist" in lower or "ilha" in lower or "arh" in lower:
            kind = "distrito"
        detected.append({"layer": name, "kind": kind, "geom_type": geom_type})
    return detected


def _read_layer(gpkg_path: Path, layer: str):
    """Yield (attrs_dict, shapely_geom, source_crs_str) for each feature."""
    import pyogrio
    info = pyogrio.read_info(str(gpkg_path), layer=layer)
    source_crs = info.get("crs") or "EPSG:3763"
    arr = pyogrio.read_dataframe(str(gpkg_path), layer=layer, use_arrow=False)
    for _, row in arr.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        attrs = {k: v for k, v in row.items() if k != "geometry"}
        yield attrs, geom, source_crs


# ─── Attribute normalization ─────────────────────────────────────────────────

_ATTR_ALIASES = {
    "dtmnfr": ["DTMNFR", "DICOFRE", "COD_FREG", "COD_DTMNFR", "CODIGO"],
    "name_freg": ["NOME_FREG", "FREGUESIA", "NOME", "DESIG"],
    "name_conc": ["NOME_CONC", "CONCELHO", "MUNICIPIO", "MUN_NAME"],
    "name_dist": ["NOME_DIST", "DISTRITO", "ILHA", "NOME_ILHA", "ARH"],
    "nuts3": ["NUTSIII", "NUTS_III", "NUTS3", "NUTS_3", "COD_NUT3"],
    "nuts2": ["NUTSII", "NUTS_II", "NUTS2", "COD_NUT2"],
    "municipality_code": ["COD_MUN", "COD_CONC", "MUN_COD", "DICOFRE_MUN"],
}


def _pick(attrs: dict, key: str) -> Any:
    for alias in _ATTR_ALIASES.get(key, []):
        if alias in attrs and attrs[alias] not in (None, "", "NULL"):
            return attrs[alias]
        # case-insensitive fallback
        for k in attrs:
            if k.upper() == alias.upper() and attrs[k] not in (None, "", "NULL"):
                return attrs[k]
    return None


def _build_parish_doc(attrs: dict, geom_wgs) -> dict[str, Any]:
    dtmnfr = _pick(attrs, "dtmnfr")
    district_code, mun_code, parish_code = parse_dtmnfr(dtmnfr)
    raw_name = _pick(attrs, "name_freg") or ""
    nuts3 = _pick(attrs, "nuts3") or ""
    nuts_info = resolve_nuts(str(nuts3)) if nuts3 else {}
    return {
        "parish_id": f"parish_{parish_code}" if parish_code else None,
        "code": parish_code,
        "name": title_case_pt(raw_name) if raw_name else "",
        "name_raw": raw_name,
        "name_clean": clean_name(raw_name),
        "municipality_code": mun_code,
        "district_code": district_code,
        "nuts3_code": nuts_info.get("nuts3_code") or str(nuts3) or None,
        "nuts2_code": nuts_info.get("nuts2_code")
            or DISTRICT_TO_NUTS2.get(district_code),
        "nuts1_code": nuts_info.get("nuts1_code"),
        "geometry": mapping(geom_wgs),
        "centroid": compute_centroid(geom_wgs),
        "bbox": compute_bbox(geom_wgs),
        "area_km2": compute_area_km2(geom_wgs),
        "source": "CAOP",
    }


def _build_municipality_doc(attrs: dict, geom_wgs) -> dict[str, Any]:
    dtmnfr = _pick(attrs, "dtmnfr")
    district_code, mun_code, _parish = parse_dtmnfr(dtmnfr)
    # Municipality layer may carry its own code
    if _pick(attrs, "municipality_code"):
        mun_code = str(_pick(attrs, "municipality_code")).zfill(4)
        district_code = mun_code[:2]
    raw_name = _pick(attrs, "name_conc") or ""
    nuts3 = _pick(attrs, "nuts3") or ""
    nuts_info = resolve_nuts(str(nuts3)) if nuts3 else {}
    return {
        "municipality_id": f"mun_{mun_code}" if mun_code else None,
        "code": mun_code,
        "name": title_case_pt(raw_name),
        "name_raw": raw_name,
        "name_clean": clean_name(raw_name),
        "district_code": district_code,
        "nuts3_code": nuts_info.get("nuts3_code") or (str(nuts3) if nuts3 else None),
        "nuts2_code": nuts_info.get("nuts2_code")
            or DISTRICT_TO_NUTS2.get(district_code),
        "nuts1_code": nuts_info.get("nuts1_code"),
        "geometry": mapping(geom_wgs),
        "centroid": compute_centroid(geom_wgs),
        "bbox": compute_bbox(geom_wgs),
        "area_km2": compute_area_km2(geom_wgs),
        "source": "CAOP",
    }


def _build_district_doc(attrs: dict, geom_wgs) -> dict[str, Any]:
    dtmnfr = _pick(attrs, "dtmnfr")
    district_code, _m, _p = parse_dtmnfr(dtmnfr)
    raw_name = _pick(attrs, "name_dist") or ""
    nuts2 = _pick(attrs, "nuts2") or DISTRICT_TO_NUTS2.get(district_code)
    n2_info = None
    if nuts2:
        from services.nuts_mapping import NUTS2 as _N2
        n2_info = _N2.get(nuts2)
    return {
        "district_id": f"dist_{district_code}" if district_code else None,
        "code": district_code,
        "name": title_case_pt(raw_name),
        "name_raw": raw_name,
        "name_clean": clean_name(raw_name),
        "nuts2_code": nuts2,
        "nuts1_code": n2_info[1] if n2_info else None,
        "geometry": mapping(geom_wgs),
        "centroid": compute_centroid(geom_wgs),
        "bbox": compute_bbox(geom_wgs),
        "area_km2": compute_area_km2(geom_wgs),
        "source": "CAOP",
    }


# ─── Main ingestion ──────────────────────────────────────────────────────────

async def _ensure_indexes(db):
    for col in ("caop_freguesias", "caop_concelhos", "caop_distritos"):
        await db[col].create_index([("geometry", "2dsphere")])
        await db[col].create_index("code", unique=False)
        await db[col].create_index("name_clean")
    log.info("Indexes ensured on 3 CAOP collections")


async def _wipe(db):
    for col in ("caop_freguesias", "caop_concelhos", "caop_distritos"):
        n = await db[col].delete_many({})
        log.info("Wiped %d from %s", n.deleted_count, col)


async def ingest_file(db, gpkg_path: Path) -> dict[str, int]:
    if not gpkg_path.exists():
        log.warning("Skipping missing file: %s", gpkg_path)
        return {}
    log.info("Processing %s", gpkg_path.name)
    layers = _detect_layer(gpkg_path)
    log.info("  layers found: %s", [f"{l['layer']} ({l['kind']})" for l in layers])

    counts: dict[str, int] = {"freguesia": 0, "concelho": 0, "distrito": 0}
    for layer_info in layers:
        kind = layer_info["kind"]
        if not kind:
            continue
        layer = layer_info["layer"]
        batch: list[dict[str, Any]] = []
        for attrs, geom, src_crs in _read_layer(gpkg_path, layer):
            try:
                geom_wgs = reproject_to_wgs84(geom, src_crs)
                if kind == "freguesia":
                    doc = _build_parish_doc(attrs, geom_wgs)
                elif kind == "concelho":
                    doc = _build_municipality_doc(attrs, geom_wgs)
                else:
                    doc = _build_district_doc(attrs, geom_wgs)
                if not doc.get("code"):
                    continue
                batch.append(doc)
            except Exception as e:
                log.warning("  skipping feature: %s", e)
                continue

        if not batch:
            continue
        coll = {"freguesia": "caop_freguesias",
                "concelho": "caop_concelhos",
                "distrito": "caop_distritos"}[kind]
        # Upsert by code
        from pymongo import UpdateOne
        ops = [UpdateOne({"code": d["code"]}, {"$set": d}, upsert=True) for d in batch]
        if ops:
            result = await db[coll].bulk_write(ops, ordered=False)
            counts[kind] += (result.upserted_count or 0) + (result.modified_count or 0)
            log.info("  %s: upserted %d features", coll, len(ops))
    return counts


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wipe", action="store_true", help="drop existing CAOP data first")
    ap.add_argument("--file", type=str, help="specific .gpkg file to ingest")
    args = ap.parse_args()

    load_dotenv(_BACKEND / ".env")
    mongo_url = os.environ.get("MONGO_URL") or os.environ.get("MONGODB_URI")
    db_name = os.environ.get("DB_NAME", "portugalvivo")
    if not mongo_url:
        log.error("MONGO_URL not set in .env")
        sys.exit(1)

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    if args.wipe:
        await _wipe(db)
    await _ensure_indexes(db)

    data_dir = _BACKEND / "data" / "caop"
    files = [Path(args.file)] if args.file else sorted(data_dir.glob("*.gpkg"))
    if not files:
        log.error("No .gpkg files found in %s — place CAOP files there first", data_dir)
        log.info("See %s/README.md for details", data_dir)
        sys.exit(2)

    totals: dict[str, int] = {"freguesia": 0, "concelho": 0, "distrito": 0}
    for f in files:
        counts = await ingest_file(db, f)
        for k, v in counts.items():
            totals[k] = totals.get(k, 0) + v

    log.info("=" * 60)
    log.info("DONE. Totals: %s", totals)
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
