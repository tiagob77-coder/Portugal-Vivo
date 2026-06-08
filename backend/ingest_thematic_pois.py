"""
Hybrid thematic POI ingestion.

Reads the dataset produced by `extract_poi_gps_v19.py`
(`data/poi_gps_v19.json`, ~5.6k POIs) and feeds it into the app using a
**hybrid model**:

  1. heritage_items (geo backbone) — every POI with valid coordinates is
     upserted into `heritage_items` carrying a `module` tag and a GeoJSON
     `geo_location`. This is what powers proximity / geofencing across ALL
     thematic modules (proximity_api `$near`), turning the current handful
     of geo-located POIs into thousands.

  2. Thematic collections (rich detail) — for the modules whose dataset
     sheets are a clean schema fit (gastronomia, economia/mercados,
     infraestrutura), a "lite" document is also upserted into the module's
     own collection so the module screens grow beyond their ~10 seed
     entries. Curated seed documents are PRESERVED (re-upserted) first,
     because the module endpoints return DB docs only once a collection is
     non-empty.

Idempotent: heritage docs key on a deterministic `id`, thematic docs on a
deterministic `_id`. Re-running never duplicates. Everything written here
is tagged `source = "thematic_v19"` so an ingest can be fully reverted:

    db.heritage_items.delete_many({"source": "thematic_v19"})
    db.<collection>.delete_many({"source": "thematic_v19"})

Run modes:
  --dry-run             Compute and report, no writes (default).
  --apply               Persist.
  --heritage-only       Only feed heritage_items (skip thematic collections).
  --thematic-only       Only feed thematic collections (skip heritage_items).
  --module M            Restrict to a single module slug (repeatable).
  --limit N             Cap POIs processed (debugging).

Usage:
    python ingest_thematic_pois.py --dry-run
    python ingest_thematic_pois.py --apply
    python ingest_thematic_pois.py --apply --module gastronomia
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

log = logging.getLogger("ingest_thematic")

DEFAULT_JSON = Path(__file__).parent / "data" / "poi_gps_v19.json"

# Portugal bounding box (mainland + islands) — reject obviously bad coords.
LAT_MIN, LAT_MAX = 32.0, 43.0
LNG_MIN, LNG_MAX = -32.0, -6.0


# ---------------------------------------------------------------------------
# Sheet → module slug. The module tag drives geofencing-by-module and the
# thematic feeding below. Slugs are aligned with frontend thematic routes /
# map categories. Sheets not listed fall back to the POI's app `category`.
# ---------------------------------------------------------------------------
MODULE_BY_SHEET: Dict[str, str] = {
    "Sopas Típicas": "gastronomia",
    "Pratos Típicos": "gastronomia",
    "Doçaria Regional": "gastronomia",
    "Tabernas Históricas": "gastronomia",
    "Restaurantes e Gastronomia": "gastronomia",
    "Agroturismo e Enoturismo": "gastronomia",
    "Mercados e Feiras": "economia",
    "Produtores DOP e Locais": "economia",
    "Ofícios e Artesanato": "saberes",
    "Moinhos e Azenhas": "saberes",
    "Percursos Pedestres": "trilhos",
    "Ecovias e Passadiços": "infraestrutura",
    "Fauna Autóctone": "fauna",
    "Flora Autóctone": "flora",
    "Flora Botânica": "flora",
    "Natureza Especializada": "biodiversidade",
    "Biodiversidade | Avistamentos": "biodiversidade",
    "Museus": "cultura",
    "Arte Urbana e Intervenção": "cultura",
    "Castelos": "patrimonio",
    "Palácios e Solares": "patrimonio",
    "Património Ferroviário": "patrimonio",
    "Arqueologia, Geologia e Mineral": "patrimonio",
    "Miradouros Portugal": "miradouros",
    "Faróis": "miradouros",
    "Surf": "costa",
    "Praias Bandeira Azul": "costa",
    "Praias Fluviais": "costa",
    "Cascatas e Poços Naturais": "natureza",
    "Barragens e Albufeiras": "natureza",
    "Termas e Banhos": "termas",
    "Pérolas de Portugal": "aldeias",
    "Alojamentos Rurais": "aldeias",
    "Aventura e Natureza": "aventura",
    "Parques de Campismo": "aventura",
    "Pousadas de Juventude": "aventura",
    "Festas e Romarias": "festas",
    "Festivais de Música": "festas",
    "Agentes Turísticos": "rotas",
}

SOURCE_TAG = "thematic_v19"


def _module_for(poi: Dict[str, Any]) -> str:
    sheet = poi.get("sheet") or ""
    return MODULE_BY_SHEET.get(sheet) or poi.get("category") or "outros"


def _valid_coords(loc: Any) -> Optional[Dict[str, float]]:
    if not isinstance(loc, dict):
        return None
    lat, lng = loc.get("lat"), loc.get("lng")
    if lat is None or lng is None:
        return None
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return None
    if not (LAT_MIN <= lat <= LAT_MAX and LNG_MIN <= lng <= LNG_MAX):
        return None
    return {"lat": lat, "lng": lng}


def _heritage_id(poi: Dict[str, Any], loc: Dict[str, float]) -> str:
    key = f"{poi.get('name_normalised') or poi.get('name')}|{poi.get('sheet')}|{loc['lat']:.5f}|{loc['lng']:.5f}"
    return "th_" + hashlib.md5(key.encode("utf-8")).hexdigest()[:20]


def _thematic_id(poi: Dict[str, Any], loc: Dict[str, float]) -> str:
    key = f"{poi.get('name_normalised') or poi.get('name')}|{poi.get('sheet')}|{loc['lat']:.5f}|{loc['lng']:.5f}"
    return "thv19_" + hashlib.md5(key.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Thematic collection feeders. Each maps a clean-fit set of sheets into a
# module collection with a "lite" document. Schemas mirror the curated seeds
# closely enough that existing list/detail/nearby endpoints render correctly.
# ---------------------------------------------------------------------------
def _map_gastronomy(poi: Dict[str, Any], loc: Dict[str, float]) -> Dict[str, Any]:
    dish_sheets = {"Sopas Típicas", "Pratos Típicos", "Doçaria Regional"}
    sheet = poi.get("sheet") or ""
    return {
        "_id": _thematic_id(poi, loc),
        "name": poi.get("name"),
        "type": "prato" if sheet in dish_sheets else "local",
        "category": "regional",
        "region": poi.get("region_original") or poi.get("region") or "",
        "subregion": poi.get("localidade") or poi.get("concelho") or "",
        "seasonality": list(range(1, 13)),
        "ingredients": [],
        "techniques": [],
        "dop_igp": False,
        "sustainability_score": 0,
        "rarity_score": 0,
        "authenticity_level": "regional",
        "description": poi.get("address") or "",
        "cultural_context": "",
        "health_profile": [],
        "lat": loc["lat"],
        "lng": loc["lng"],
        "iq_score": 0,
    }


def _map_market(poi: Dict[str, Any], loc: Dict[str, float]) -> Dict[str, Any]:
    return {
        "_id": _thematic_id(poi, loc),
        "name": poi.get("name"),
        "category": "mercado_municipal",
        "region": poi.get("region_original") or poi.get("region") or "",
        "municipality": poi.get("concelho") or poi.get("localidade") or "",
        "lat": loc["lat"],
        "lng": loc["lng"],
        "description": poi.get("address") or "",
        "horario": "",
        "produtos": [],
        "tags": [poi.get("sheet")] if poi.get("sheet") else [],
        "iq_score": 0,
        "rating": None,
        "fotos": [],
    }


def _map_infrastructure(poi: Dict[str, Any], loc: Dict[str, float]) -> Dict[str, Any]:
    return {
        "_id": _thematic_id(poi, loc),
        "name": poi.get("name"),
        "type": "passadico",
        "subtype": "ecovia",
        "region": poi.get("region_original") or poi.get("region") or "",
        "municipality": poi.get("concelho") or poi.get("localidade") or "",
        "description_short": poi.get("address") or "",
        "description_long": "",
        "length_m": None,
        "difficulty": "media",
        "access_type": "livre",
        "is_family_friendly": True,
        "is_dog_friendly": False,
        "is_accessible": False,
        "best_season": [],
        "opening_hours": "",
        "lat": loc["lat"],
        "lng": loc["lng"],
        "start_point": None,
        "end_point": None,
        "waypoints": [],
        "iq_score": 0,
        "tags": [poi.get("sheet")] if poi.get("sheet") else [],
    }


# module slug → feeder config.
#   collection : target MongoDB collection
#   sheets     : dataset sheets routed here
#   mapper     : poi,loc -> lite document
#   seed       : (module_name, attr) curated seeds to preserve (re-upsert)
THEMATIC_TARGETS: Dict[str, Dict[str, Any]] = {
    "gastronomia": {
        "collection": "gastronomy_items",
        "sheets": {"Sopas Típicas", "Pratos Típicos", "Doçaria Regional",
                   "Tabernas Históricas", "Restaurantes e Gastronomia",
                   "Agroturismo e Enoturismo"},
        "mapper": _map_gastronomy,
        "seed": ("coastal_gastronomy_api", "SEED_ITEMS"),
    },
    "economia": {
        "collection": "local_markets",
        "sheets": {"Mercados e Feiras"},
        "mapper": _map_market,
        "seed": ("economy_api", "SEED_MARKETS"),
    },
    "infraestrutura": {
        "collection": "infrastructure",
        "sheets": {"Ecovias e Passadiços"},
        "mapper": _map_infrastructure,
        "seed": ("infrastructure_api", "SEED_INFRA"),
    },
}


def _build_heritage_doc(poi: Dict[str, Any], loc: Dict[str, float], module: str) -> Dict[str, Any]:
    sheet = poi.get("sheet")
    tags = list({t for t in [poi.get("category"), module, poi.get("region"), sheet] if t})
    return {
        "id": _heritage_id(poi, loc),
        "poi_source_id": poi.get("source_id"),
        "name": poi.get("name"),
        "name_normalised": poi.get("name_normalised"),
        "description": "",
        "category": poi.get("category") or "outros",
        "subcategory": sheet,
        "category_original": poi.get("category"),
        "region": poi.get("region") or "portugal",
        "region_original": poi.get("region_original") or poi.get("region"),
        "module": module,
        "location": {"lat": loc["lat"], "lng": loc["lng"]},
        "geo_location": {"type": "Point", "coordinates": [loc["lng"], loc["lat"]]},
        "address": poi.get("address") or "",
        "concelho": poi.get("concelho"),
        "distrito": poi.get("distrito"),
        "localidade": poi.get("localidade"),
        "tags": tags,
        "metadata": {"sheet": sheet},
        "image_url": None,
        "coord_precision": poi.get("coord_precision"),
        "coord_source": poi.get("coord_source"),
        "source": SOURCE_TAG,
        "source_dataset": "poi_gps_v19",
    }


# ---------------------------------------------------------------------------
# Ingestion
# ---------------------------------------------------------------------------
async def ingest(
    db: AsyncIOMotorDatabase,
    pois: List[Dict[str, Any]],
    *,
    dry_run: bool,
    do_heritage: bool,
    do_thematic: bool,
    only_modules: Optional[set],
    limit: Optional[int],
) -> Dict[str, Any]:
    stats: Dict[str, Any] = {
        "considered": 0,
        "no_coords": 0,
        "skipped_module": 0,
        "heritage_upserts": 0,
        "thematic_upserts": 0,
        "by_module": defaultdict(int),
        "by_precision": defaultdict(int),
        "thematic_by_collection": defaultdict(int),
    }

    if do_heritage and not dry_run:
        # 2dsphere is created in create_indexes.py; ensure it here too so a
        # fresh DB can serve $near right after ingest.
        try:
            await db.heritage_items.create_index(
                [("geo_location", "2dsphere")], name="idx_heritage_geo_2dsphere"
            )
        except Exception as e:
            log.warning(f"Could not ensure 2dsphere index: {e}")

    # Preserve curated thematic seeds before inserting lite docs (endpoints
    # return DB docs only once a collection is non-empty).
    if do_thematic and not dry_run:
        await _preserve_seeds(db, only_modules)

    processed = 0
    for poi in pois:
        if limit is not None and processed >= limit:
            break
        stats["considered"] += 1

        loc = _valid_coords(poi.get("location"))
        if loc is None:
            stats["no_coords"] += 1
            continue

        module = _module_for(poi)
        if only_modules and module not in only_modules:
            stats["skipped_module"] += 1
            continue

        processed += 1
        stats["by_module"][module] += 1
        stats["by_precision"][poi.get("coord_precision") or "unknown"] += 1

        if do_heritage:
            doc = _build_heritage_doc(poi, loc, module)
            if not dry_run:
                await db.heritage_items.update_one(
                    {"id": doc["id"]},
                    {
                        "$set": {k: v for k, v in doc.items() if k != "id"},
                        "$setOnInsert": {
                            "id": doc["id"],
                            "created_at": datetime.now(timezone.utc),
                        },
                        "$currentDate": {"updated_at": True},
                    },
                    upsert=True,
                )
            stats["heritage_upserts"] += 1

        if do_thematic and module in THEMATIC_TARGETS:
            target = THEMATIC_TARGETS[module]
            if poi.get("sheet") in target["sheets"]:
                tdoc = target["mapper"](poi, loc)
                tdoc["source"] = SOURCE_TAG
                tdoc["module"] = module
                col = target["collection"]
                if not dry_run:
                    await db[col].update_one(
                        {"_id": tdoc["_id"]},
                        {"$set": {k: v for k, v in tdoc.items() if k != "_id"}},
                        upsert=True,
                    )
                stats["thematic_upserts"] += 1
                stats["thematic_by_collection"][col] += 1

    return stats


async def _preserve_seeds(db: AsyncIOMotorDatabase, only_modules: Optional[set]) -> None:
    """Re-upsert curated seed documents so feeding a collection does not hide
    them (endpoints fall back to seeds only while the collection is empty)."""
    import importlib

    for module, target in THEMATIC_TARGETS.items():
        if only_modules and module not in only_modules:
            continue
        mod_name, attr = target["seed"]
        try:
            mod = importlib.import_module(mod_name)
            seeds = getattr(mod, attr, [])
        except Exception as e:
            log.warning(f"  Could not load seeds {mod_name}.{attr}: {e}")
            continue
        col = target["collection"]
        for s in seeds:
            doc = dict(s)
            _id = doc.get("_id") or doc.get("id")
            if not _id:
                continue
            doc["_id"] = _id
            doc.pop("id", None)
            doc.setdefault("source", "curated_seed")
            await db[col].update_one(
                {"_id": _id}, {"$set": {k: v for k, v in doc.items() if k != "_id"}}, upsert=True
            )
        log.info(f"  Preserved {len(seeds)} curated seeds → {col}")


def print_report(stats: Dict[str, Any], *, dry_run: bool) -> None:
    head = "DRY-RUN (no writes)" if dry_run else "APPLIED"
    log.info(f"\n──────── Thematic ingest report — {head} ────────")
    log.info(f"  POIs considered:        {stats['considered']}")
    log.info(f"  Skipped (no coords):    {stats['no_coords']}")
    log.info(f"  Skipped (module filter):{stats['skipped_module']}")
    log.info(f"  heritage_items upserts: {stats['heritage_upserts']}")
    log.info(f"  thematic upserts:       {stats['thematic_upserts']}")
    log.info("  ── by module ──")
    for m, n in sorted(stats["by_module"].items(), key=lambda x: -x[1]):
        log.info(f"     {m:18s} {n}")
    log.info("  ── coord precision ──")
    for p, n in sorted(stats["by_precision"].items(), key=lambda x: -x[1]):
        log.info(f"     {p:18s} {n}")
    if stats["thematic_by_collection"]:
        log.info("  ── thematic collections fed ──")
        for c, n in sorted(stats["thematic_by_collection"].items(), key=lambda x: -x[1]):
            log.info(f"     {c:20s} {n}")


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Hybrid thematic POI ingestion")
    p.add_argument("--json", type=Path, default=DEFAULT_JSON)
    p.add_argument("--dry-run", action="store_true", default=True)
    p.add_argument("--apply", dest="apply_changes", action="store_true",
                   help="Persist changes (disables dry-run).")
    p.add_argument("--heritage-only", action="store_true",
                   help="Only feed heritage_items.")
    p.add_argument("--thematic-only", action="store_true",
                   help="Only feed thematic collections.")
    p.add_argument("--module", action="append", dest="modules",
                   help="Restrict to a module slug (repeatable).")
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--mongo-url", default=os.environ.get("MONGO_URL"))
    p.add_argument("--db-name", default=os.environ.get("DB_NAME"))
    return p.parse_args(argv)


async def main() -> int:
    args = parse_args()
    dry_run = not args.apply_changes

    if not args.mongo_url or not args.db_name:
        log.error("MONGO_URL and DB_NAME must be set (env or flags).")
        return 2
    if not args.json.exists():
        log.error(f"Dataset not found: {args.json}")
        return 2

    do_heritage = not args.thematic_only
    do_thematic = not args.heritage_only
    only_modules = set(args.modules) if args.modules else None

    payload = json.loads(args.json.read_text())
    pois = payload.get("pois", [])
    log.info(f"📥 Loaded {len(pois)} POIs from {args.json.name}")

    client = AsyncIOMotorClient(args.mongo_url, serverSelectionTimeoutMS=10000)
    db = client[args.db_name]
    try:
        await db.command("ping")
    except Exception as e:
        log.error(f"Cannot reach MongoDB at {args.mongo_url}: {e}")
        return 2

    try:
        stats = await ingest(
            db, pois,
            dry_run=dry_run,
            do_heritage=do_heritage,
            do_thematic=do_thematic,
            only_modules=only_modules,
            limit=args.limit,
        )
        print_report(stats, dry_run=dry_run)
        if dry_run:
            log.info("\nℹ️  Dry-run: no writes. Re-run with --apply to persist.")
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    sys.exit(asyncio.run(main()))
