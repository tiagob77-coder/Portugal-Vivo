"""
import_v20.py — Import the PortugalVivo v20 MongoDB export into the app schema.

The export (collections/*.ndjson from `PortugalVivo_BaseDados_POI_v20.xlsx`) uses
its own schema (`nome`/`regiao`/`poi_id`/`location` GeoJSON, Portuguese-named
collections). This importer maps every collection into `heritage_items` — the
app's universal POI collection powering the map, explore-nearby, search,
categories and the planner — resolving each doc's `folha_origem` to the app's
44-subcategory taxonomy (shared_constants). Cultural events (Festas e Romarias /
Festivais de Música) are additionally emitted into the `events` collection so
they surface in the Eventos tab.

Coordinates: uses the GeoJSON `location.coordinates` [lon, lat] when present;
otherwise fills from the offline concelho geocoder (event_geocode).

Usage:
  python import_v20.py --dir /path/to/collections --dry-run
  python import_v20.py --dir /path/to/collections --commit \\
        --mongo-url "mongodb+srv://..." --db-name portugal_vivo
"""
import argparse
import glob
import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from shared_constants import SUBCATEGORIES, SUBCATEGORY_MAP
from event_geocode import coords_from_event, geocode, in_portugal


# --------------------------------------------------------------------------
# Category resolution: v20 `folha_origem` → app subcategory id
# --------------------------------------------------------------------------

def _norm(s: str) -> str:
    n = unicodedata.normalize("NFD", (s or "")).encode("ascii", "ignore").decode("ascii")
    n = n.lower()
    n = re.sub(r"[^a-z0-9]+", " ", n).strip()
    return n


# name (normalized) → subcategory id, built from the taxonomy
_SUBCAT_BY_NAME = {_norm(s["name"]): s["id"] for s in SUBCATEGORIES}

# folha_origem / categoria values that don't match a subcategory name 1:1
_FOLHA_ALIASES = {
    "sopas tipicas": "pratos_tipicos",
    "farois": "miradouros",              # coastal landmarks → viewpoints pillar
    "biodiversidade avistamentos": "biodiversidade_avistamentos",
    "transportes": "transportes",
    "base de dados poi": None,           # generic master sheet → use categoria
    # free-text `categoria` values from the master POI sheet
    "natureza": "natureza_especializada",
    "geologia": "arqueologia_geologia",
    "arqueologia": "arqueologia_geologia",
    "termas": "termas_banhos",
    "astronomia": "natureza_especializada",
    "astroturismo": "natureza_especializada",
    "birdwatching": "biodiversidade_avistamentos",
    "rios e ribeiras": "cascatas_pocos",
    "turismo rural": "agroturismo_enoturismo",
    "monumentos e patrimonio": "museus",
    "aldeias historicas": "rotas_tematicas",
    "lendas e mitos": "musica_tradicional",
    "turismo religioso": "museus",
    "moinho de vento": "moinhos_azenhas",
    "praia maritima": "praias_bandeira_azul",
    "praia fluvial": "praias_fluviais",
    "historia": "museus",
}


def resolve_category(folha: str, categoria: str = "", subcategoria: str = "") -> Tuple[str, str]:
    """Return (category_id, main_category). category_id is an app subcategory id
    when resolvable, else a slugified fallback."""
    for candidate in (folha, subcategoria, categoria):
        key = _norm(candidate)
        if not key:
            continue
        if key in _SUBCAT_BY_NAME:
            cid = _SUBCAT_BY_NAME[key]
            return cid, SUBCATEGORY_MAP[cid]["main_category"]
        if key in _FOLHA_ALIASES and _FOLHA_ALIASES[key]:
            cid = _FOLHA_ALIASES[key]
            return cid, SUBCATEGORY_MAP.get(cid, {}).get("main_category", "territorio_natureza")
    # Fallback: slugify whatever we have, no confident main category
    slug = _norm(categoria or subcategoria or folha).replace(" ", "_") or "outros"
    return slug, "territorio_natureza"


# --------------------------------------------------------------------------
# Region / rarity normalization
# --------------------------------------------------------------------------

_REGION_IDS = {"norte", "centro", "lisboa", "alentejo", "algarve", "acores", "madeira"}
_REGION_NAME = {
    "norte": "Norte", "centro": "Centro", "lisboa": "Lisboa", "alentejo": "Alentejo",
    "algarve": "Algarve", "acores": "Açores", "madeira": "Madeira",
}
_DISTRITO_REGION = {
    "porto": "norte", "braga": "norte", "viana do castelo": "norte", "vila real": "norte",
    "braganca": "norte",
    "aveiro": "centro", "coimbra": "centro", "viseu": "centro", "guarda": "centro",
    "castelo branco": "centro", "leiria": "centro",
    "lisboa": "lisboa", "santarem": "lisboa", "setubal": "lisboa",
    "portalegre": "alentejo", "evora": "alentejo", "beja": "alentejo",
    "faro": "algarve",
    "acores": "acores", "madeira": "madeira",
}


def region_id(regiao: str, distrito: str = "") -> Optional[str]:
    r = _norm(regiao)
    if r in _REGION_IDS:
        return r
    if r == "azores":
        return "acores"
    d = _norm(distrito)
    return _DISTRITO_REGION.get(d)


def rarity_id(raridade: str) -> str:
    r = _norm(raridade)
    if "epico" in r:
        return "epico"
    if "raro" in r:
        return "raro"
    if "incomum" in r:
        return "incomum"
    return "comum"


# --------------------------------------------------------------------------
# Coordinate extraction: GeoJSON [lon,lat] → (lat, lng); geocode fallback
# --------------------------------------------------------------------------

def doc_coords(doc: dict) -> Tuple[Optional[float], Optional[float], str]:
    loc = doc.get("location")
    if isinstance(loc, dict) and loc.get("type") == "Point":
        coords = loc.get("coordinates") or []
        if len(coords) == 2:
            lng, lat = coords[0], coords[1]
            if in_portugal(lat, lng):
                return lat, lng, "exact"
    # explicit lat/lng or gps fields (defensive)
    lat, lng = coords_from_event(doc)
    if lat is not None:
        return lat, lng, "exact"
    # geocode from concelho/region
    glat, glng, precision = geocode(doc.get("concelho", ""), _REGION_NAME.get(region_id(doc.get("regiao", ""), doc.get("distrito", "")) or "", ""))
    return glat, glng, precision


# --------------------------------------------------------------------------
# Transforms
# --------------------------------------------------------------------------

_EVENT_FOLHAS = {"festas e romarias", "festivais de musica"}


def to_heritage(doc: dict) -> dict:
    cid, main = resolve_category(doc.get("folha_origem", ""), doc.get("categoria", ""), doc.get("subcategoria", ""))
    lat, lng, precision = doc_coords(doc)
    rid = region_id(doc.get("regiao", ""), doc.get("distrito", ""))
    out = {
        "id": doc.get("poi_id") or doc.get("slug"),
        "poi_id": doc.get("poi_id"),
        "slug": doc.get("slug"),
        "name": doc.get("nome"),
        "category": cid,
        "main_category": main,
        "subcategory": cid,
        "region": rid or "",
        "concelho": doc.get("concelho"),
        "distrito": doc.get("distrito"),
        "municipality_id": doc.get("municipality_id"),
        "description": doc.get("descricao"),
        "rarity": rarity_id(doc.get("raridade", "")),
        "status": "active",
        "source": "v20_import",
        "tenant_id": doc.get("tenant_id"),
        "imported_at": datetime.now(timezone.utc).isoformat(),
    }
    for src, dst in (("morada", "address"), ("website", "website"),
                     ("preco", "price"), ("horario", "opening_hours"),
                     ("contacto", "contact"), ("periodo_historico", "historical_period")):
        if doc.get(src):
            out[dst] = doc[src]
    if lat is not None and lng is not None:
        out["location"] = {"lat": lat, "lng": lng}
        out["geo_location"] = {"type": "Point", "coordinates": [lng, lat]}
        out["geo_precision"] = precision
    return {k: v for k, v in out.items() if v is not None}


def to_event(doc: dict) -> Optional[dict]:
    folha = _norm(doc.get("folha_origem", ""))
    if folha not in _EVENT_FOLHAS:
        return None
    lat, lng, precision = doc_coords(doc)
    rid = region_id(doc.get("regiao", ""), doc.get("distrito", ""))
    out = {
        "id": doc.get("poi_id") or doc.get("slug"),
        "name": doc.get("nome"),
        "type": "festival" if folha == "festivais de musica" else "festa",
        "region": _REGION_NAME.get(rid or "", doc.get("regiao") or ""),
        "concelho": doc.get("concelho"),
        "description": doc.get("descricao"),
        "rarity": rarity_id(doc.get("raridade", "")),
        "source": "v20",
        "date_text": "",           # v20 events are undated (recurring / annual)
        "slug": doc.get("slug"),
    }
    if doc.get("preco"):
        out["price"] = doc["preco"]
    if lat is not None and lng is not None:
        out["latitude"] = lat
        out["longitude"] = lng
        out["location_geo"] = {"type": "Point", "coordinates": [lng, lat]}
        out["geo_precision"] = precision
    return {k: v for k, v in out.items() if v is not None}


# --------------------------------------------------------------------------
# Runner
# --------------------------------------------------------------------------

def load_all(collections_dir: str) -> List[dict]:
    docs = []
    for path in sorted(glob.glob(os.path.join(collections_dir, "*.ndjson"))):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    docs.append(json.loads(line))
    return docs


def transform_all(docs: List[dict]) -> Tuple[List[dict], List[dict], dict]:
    heritage, events = [], []
    stats = {"total": len(docs), "geo_exact": 0, "geo_geocoded": 0, "geo_none": 0,
             "by_category": {}, "by_main": {}, "events": 0}
    for d in docs:
        h = to_heritage(d)
        heritage.append(h)
        prec = h.get("geo_precision")
        if prec == "exact":
            stats["geo_exact"] += 1
        elif prec in (None,) and "location" not in h:
            stats["geo_none"] += 1
        else:
            stats["geo_geocoded"] += 1
        stats["by_category"][h["category"]] = stats["by_category"].get(h["category"], 0) + 1
        stats["by_main"][h.get("main_category", "?")] = stats["by_main"].get(h.get("main_category", "?"), 0) + 1
        ev = to_event(d)
        if ev:
            events.append(ev)
    stats["events"] = len(events)
    return heritage, events, stats


async def commit(heritage: List[dict], events: List[dict], mongo_url: str, db_name: str) -> dict:
    import motor.motor_asyncio
    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    for h in heritage:
        await db.heritage_items.update_one({"id": h["id"]}, {"$set": h}, upsert=True)
    for e in events:
        await db.events.update_one({"id": e["id"]}, {"$set": e}, upsert=True)
    await db.heritage_items.create_index([("geo_location", "2dsphere")], sparse=True)
    await db.heritage_items.create_index("category", sparse=True)
    await db.events.create_index([("location_geo", "2dsphere")], sparse=True)
    return {"heritage": len(heritage), "events": len(events)}


def _print_report(heritage, events, stats):
    print(f"\n{'='*60}")
    print(f"v20 → app import — DRY RUN")
    print(f"{'='*60}")
    print(f"Source docs:      {stats['total']}")
    print(f"→ heritage_items: {len(heritage)}")
    print(f"→ events:         {stats['events']} (Festas e Romarias + Festivais de Música)")
    print(f"\nCoordinates:")
    print(f"  exact (v20 GPS):   {stats['geo_exact']}")
    print(f"  geocoded (concelho): {stats['geo_geocoded']}")
    print(f"  none:              {stats['geo_none']}")
    print(f"\nBy main category:")
    for k, v in sorted(stats["by_main"].items(), key=lambda x: -x[1]):
        print(f"  {v:5d}  {k}")
    unknown = [c for c in stats["by_category"] if c not in SUBCATEGORY_MAP]
    print(f"\nSubcategories resolved: {len([c for c in stats['by_category'] if c in SUBCATEGORY_MAP])}"
          f" | unmapped slugs: {len(unknown)}")
    if unknown:
        print(f"  unmapped: {sorted(unknown)[:15]}")
    print(f"\nSample heritage_items doc:")
    print(json.dumps(heritage[0], ensure_ascii=False, indent=2, default=str))
    if events:
        print(f"\nSample events doc:")
        print(json.dumps(next(e for e in events if e.get('location_geo')), ensure_ascii=False, indent=2, default=str))


def main():
    ap = argparse.ArgumentParser(description="Import PortugalVivo v20 export into the app schema")
    ap.add_argument("--dir", required=True, help="Path to the export's collections/ folder")
    ap.add_argument("--dry-run", action="store_true", help="Validate + report, no writes (default)")
    ap.add_argument("--commit", action="store_true", help="Upsert into MongoDB")
    ap.add_argument("--mongo-url", default=os.environ.get("MONGO_URL"))
    ap.add_argument("--db-name", default=os.environ.get("DB_NAME", "portugal_vivo"))
    args = ap.parse_args()

    docs = load_all(args.dir)
    heritage, events, stats = transform_all(docs)
    _print_report(heritage, events, stats)

    if args.commit:
        if not args.mongo_url:
            raise SystemExit("--commit requires --mongo-url (or MONGO_URL env)")
        import asyncio
        result = asyncio.run(commit(heritage, events, args.mongo_url, args.db_name))
        print(f"\n✅ Committed: {result['heritage']} heritage_items, {result['events']} events")
    else:
        print(f"\n[DRY RUN] No writes. Re-run with --commit --mongo-url ... to import.")


if __name__ == "__main__":
    main()
