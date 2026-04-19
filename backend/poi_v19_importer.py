"""
POI v19 Bulk Importer
Importador especializado para o formato CSV "PortugalVivo_BaseDados_POI_v19"
Colunas: ID, Nome, Regiao, Categoria, Subcategoria, Morada, Website, Raridade, Descricao, GPS, Prompt_IA
"""
import os
import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from io import BytesIO, StringIO

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Query

logger = logging.getLogger("poi_v19_importer")

poi_v19_router = APIRouter(prefix="/importer-v19", tags=["POI v19 Importer"])

from shared_utils import DatabaseHolder
from poi_dedup import find_duplicate, normalise_name

_db_holder = DatabaseHolder("poi_v19")
set_poi_v19_db = _db_holder.set
_get_db = _db_holder.get


# ============================================
# Category mapping: CSV → app categories
# ============================================
CATEGORY_MAP = {
    "natureza": "areas_protegidas",
    "agroturismo": "produtos",
    "fauna": "fauna",
    "gastronomia": "gastronomia",
    "comércio": "produtos",
    "comercio": "produtos",
    "monumentos": "arqueologia",
    "bem-estar": "termas",
    "aventura": "aventura",
    "turismo rural": "aldeias",
    "mobilidade": "rotas",
    "roteiro": "rotas",
    "artesanato": "saberes",
    "cultura": "arte",
    "religião": "religioso",
    "religiao": "religioso",
    "miradouros": "miradouros",
    "cascatas": "cascatas",
    "termalismo": "termas",
    "pedestrianismo": "percursos",
    "tascas": "tascas",
    "piscinas": "piscinas",
}

REGION_MAP = {
    "norte": "norte",
    "centro": "centro",
    "lisboa": "lisboa",
    "alentejo": "alentejo",
    "algarve": "algarve",
    "açores": "acores",
    "acores": "acores",
    "madeira": "madeira",
    "nacional": "portugal",
    "sul": "algarve",
}

RARITY_SCORES = {
    "comum": 1,
    "incomum": 2,
    "raro": 3,
    "difícil": 4,
    "dificil": 4,
    "épico": 5,
    "epico": 5,
    "secular": 4,
    "histórico": 3,
    "historico": 3,
    "excecional": 5,
    "excepcional": 5,
}

# In-memory progress
_v19_progress: Dict[str, Dict] = {}


def _clean(val: Any) -> Optional[str]:
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    return s if s and s.lower() not in ("nan", "n/a", "none", "") else None


def _map_category(cat: str, subcat: Optional[str] = None) -> str:
    """Map CSV category to app category"""
    cat_lower = cat.lower().strip()
    if subcat:
        sub_lower = subcat.lower().strip()
        mapped = CATEGORY_MAP.get(sub_lower)
        if mapped:
            return mapped
    mapped = CATEGORY_MAP.get(cat_lower)
    return mapped or cat_lower


def _map_region(region: str) -> str:
    r = region.lower().strip()
    return REGION_MAP.get(r, r)


def _extract_gps_text(gps_val: str) -> Optional[str]:
    """Extract useful location text from GPS column (which has emojis + text)"""
    if not gps_val:
        return None
    cleaned = re.sub(r'[📍🍇🛒🏛🗺🍷]', '', gps_val).strip()
    cleaned = re.sub(r'^Ver Mapa$', '', cleaned, flags=re.IGNORECASE).strip()
    return cleaned if cleaned else None


def _try_parse_coords(gps_val: str) -> Optional[Dict[str, float]]:
    """Try to extract actual coordinates if present"""
    if not gps_val:
        return None
    match = re.search(r'(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)', gps_val)
    if match:
        a, b = float(match.group(1)), float(match.group(2))
        if 32 <= a <= 43 and -32 <= b <= -6:
            return {"lat": a, "lng": b}
        if 32 <= b <= 43 and -32 <= a <= -6:
            return {"lat": b, "lng": a}
    return None


async def _geocode_address(address: str, name: str) -> Optional[Dict[str, float]]:
    """Geocode an address using Google Maps API"""
    import httpx
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
    if not api_key:
        return None

    query = f"{name}, {address}, Portugal"
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params={"address": query, "key": api_key})
            data = resp.json()
            if data.get("status") == "OK" and data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                lat, lng = loc["lat"], loc["lng"]
                if 32 <= lat <= 43 and -32 <= lng <= -6:
                    return {"lat": lat, "lng": lng}
    except Exception as e:
        logger.debug(f"Geocode error for {name}: {e}")
    return None


@poi_v19_router.post("/upload")
async def upload_v19(
    file: UploadFile = File(...),
    skip_duplicates: bool = Form(True),
    geocode: bool = Form(True),
    background_tasks: BackgroundTasks = None,
):
    """
    Upload and import a POI v19 CSV/Excel file.
    Format: ID,Nome,Regiao,Categoria,Subcategoria,Morada,Website,Raridade,Descricao,GPS,Prompt_IA
    """
    if not file.filename:
        raise HTTPException(400, "Ficheiro não fornecido")

    ext = file.filename.lower().split('.')[-1]
    if ext not in ('xlsx', 'xls', 'csv'):
        raise HTTPException(400, f"Formato não suportado: .{ext}")

    content = await file.read()
    import_id = f"v19_{str(uuid.uuid4())[:6]}"

    try:
        if ext == 'csv':
            for enc in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    df = pd.read_csv(BytesIO(content), encoding=enc)
                    break
                except UnicodeDecodeError:
                    continue
        else:
            df = pd.read_excel(BytesIO(content), sheet_name=0)
    except Exception as e:
        raise HTTPException(400, f"Erro ao ler ficheiro: {e}")

    logger.info(f"v19 Import {import_id}: {len(df)} rows, columns: {list(df.columns)}")

    # Normalize column names
    col_map = {}
    for c in df.columns:
        cl = c.lower().strip()
        if cl in ('id', 'poi_id'):
            col_map['poi_id'] = c
        elif cl in ('nome', 'name'):
            col_map['name'] = c
        elif cl in ('regiao', 'região', 'region'):
            col_map['region'] = c
        elif cl in ('categoria', 'category'):
            col_map['category'] = c
        elif cl in ('subcategoria', 'subcategory'):
            col_map['subcategory'] = c
        elif cl in ('morada', 'address', 'endereço'):
            col_map['address'] = c
        elif cl in ('website', 'site', 'url', 'web'):
            col_map['website'] = c
        elif cl in ('raridade', 'rarity'):
            col_map['rarity'] = c
        elif cl in ('descricao', 'descrição', 'description'):
            col_map['description'] = c
        elif cl in ('gps', 'coordenadas', 'coordinates'):
            col_map['gps'] = c
        elif cl in ('prompt_ia', 'prompt', 'ai_prompt'):
            col_map['prompt_ia'] = c

    if 'name' not in col_map:
        raise HTTPException(400, f"Coluna 'Nome' não encontrada. Colunas: {list(df.columns)}")

    db = _get_db()
    collection = db.heritage_items

    imported, skipped, duplicates, errors, geocoded = 0, 0, 0, 0, 0
    error_details: List[str] = []
    sample: List[Dict[str, Any]] = []

    for idx, row in df.iterrows():
        try:
            name = _clean(row.get(col_map.get('name', ''), ''))
            if not name:
                skipped += 1
                continue

            poi_source_id = _clean(row.get(col_map.get('poi_id', ''), ''))
            category_raw = _clean(row.get(col_map.get('category', ''), '')) or "outros"
            subcategory_raw = _clean(row.get(col_map.get('subcategory', ''), ''))
            region_raw = _clean(row.get(col_map.get('region', ''), '')) or "portugal"
            address = _clean(row.get(col_map.get('address', ''), '')) or ""
            website = _clean(row.get(col_map.get('website', ''), ''))
            rarity = _clean(row.get(col_map.get('rarity', ''), ''))
            description = _clean(row.get(col_map.get('description', ''), '')) or ""
            gps_raw = _clean(row.get(col_map.get('gps', ''), ''))
            prompt_ia = _clean(row.get(col_map.get('prompt_ia', ''), ''))

            # Map category and region
            category = _map_category(category_raw, subcategory_raw)
            region = _map_region(region_raw)

            # Try to get coordinates
            location = _try_parse_coords(gps_raw or "")
            gps_text = _extract_gps_text(gps_raw or "")

            if not location and geocode and address:
                location = await _geocode_address(address, name)
                if location:
                    geocoded += 1

            if skip_duplicates:
                existing = await find_duplicate(
                    collection,
                    name=name,
                    region=region,
                    poi_source_id=poi_source_id,
                    location=location,
                )
                if existing:
                    duplicates += 1
                    continue

            # Build tags
            tags = [category]
            if subcategory_raw:
                tags.append(subcategory_raw.lower())
            if region:
                tags.append(region)
            if rarity and rarity.lower() not in ("n/a",):
                tags.append(rarity.lower())
            tags = list(set(tags))

            # Metadata
            metadata = {}
            if website:
                metadata["website"] = website
            if rarity:
                metadata["rarity"] = rarity
                metadata["rarity_score"] = RARITY_SCORES.get(rarity.lower().strip(), 0)
            if gps_text:
                metadata["gps_label"] = gps_text

            poi_doc = {
                "id": str(uuid.uuid4()),
                "poi_source_id": poi_source_id,
                "name": name,
                "name_normalised": normalise_name(name),
                "description": description,
                "category": category,
                "subcategory": subcategory_raw,
                "category_original": category_raw,
                "region": region,
                "region_original": region_raw,
                "location": location or {},
                "address": address,
                "tags": tags,
                "metadata": metadata,
                "image_url": None,
                "created_at": datetime.now(timezone.utc),
                "source": f"poi_v19_{import_id}",
                "import_batch": import_id,
            }

            await collection.insert_one(poi_doc)
            imported += 1

            if len(sample) < 5:
                sample.append({
                    "id": poi_doc["id"],
                    "source_id": poi_source_id,
                    "name": name,
                    "category": f"{category_raw} → {category}",
                    "region": f"{region_raw} → {region}",
                    "has_location": location is not None,
                    "rarity": rarity,
                })

        except Exception as e:
            errors += 1
            if len(error_details) < 20:
                error_details.append(f"Linha {idx+2}: {str(e)[:120]}")

    logger.info(f"v19 Import {import_id}: {imported} imported, {duplicates} dups, {geocoded} geocoded, {errors} errors")

    return {
        "status": "completed",
        "import_id": import_id,
        "total_rows": len(df),
        "imported": imported,
        "skipped": skipped,
        "duplicates": duplicates,
        "geocoded": geocoded,
        "errors": errors,
        "error_details": error_details,
        "column_mapping": col_map,
        "category_mapping": {k: v for k, v in CATEGORY_MAP.items()},
        "sample": sample,
    }


@poi_v19_router.post("/upload-text")
async def upload_v19_text(
    csv_text: str = Form(...),
    skip_duplicates: bool = Form(True),
    geocode: bool = Form(True),
    background_tasks: BackgroundTasks = None,
):
    """
    Import POI v19 data from raw CSV text (pasted directly).
    """
    try:
        df = pd.read_csv(StringIO(csv_text))
    except Exception as e:
        raise HTTPException(400, f"Erro ao processar CSV: {e}")

    # Reuse the upload logic by creating a temporary file-like object
    content = csv_text.encode('utf-8')
    import_id = f"v19_{str(uuid.uuid4())[:6]}"

    # Same processing logic as upload
    col_map = {}
    for c in df.columns:
        cl = c.lower().strip()
        if cl in ('id', 'poi_id'):
            col_map['poi_id'] = c
        elif cl in ('nome', 'name'):
            col_map['name'] = c
        elif cl in ('regiao', 'região', 'region'):
            col_map['region'] = c
        elif cl in ('categoria', 'category'):
            col_map['category'] = c
        elif cl in ('subcategoria', 'subcategory'):
            col_map['subcategory'] = c
        elif cl in ('morada', 'address', 'endereço'):
            col_map['address'] = c
        elif cl in ('morada', 'address'):
            col_map['address'] = c
        elif cl in ('website', 'site', 'url', 'web'):
            col_map['website'] = c
        elif cl in ('raridade', 'rarity'):
            col_map['rarity'] = c
        elif cl in ('descricao', 'descrição', 'description'):
            col_map['description'] = c
        elif cl in ('gps', 'coordenadas', 'coordinates'):
            col_map['gps'] = c
        elif cl in ('prompt_ia', 'prompt', 'ai_prompt'):
            col_map['prompt_ia'] = c

    if 'name' not in col_map:
        raise HTTPException(400, f"Coluna 'Nome' não encontrada. Colunas: {list(df.columns)}")

    db = _get_db()
    collection = db.heritage_items

    imported, skipped, duplicates, errors, geocoded = 0, 0, 0, 0, 0
    error_details: List[str] = []
    sample: List[Dict[str, Any]] = []

    for idx, row in df.iterrows():
        try:
            name = _clean(row.get(col_map.get('name', ''), ''))
            if not name:
                skipped += 1
                continue

            poi_source_id = _clean(row.get(col_map.get('poi_id', ''), ''))
            category_raw = _clean(row.get(col_map.get('category', ''), '')) or "outros"
            subcategory_raw = _clean(row.get(col_map.get('subcategory', ''), ''))
            region_raw = _clean(row.get(col_map.get('region', ''), '')) or "portugal"
            address = _clean(row.get(col_map.get('address', ''), '')) or ""
            website = _clean(row.get(col_map.get('website', ''), ''))
            rarity = _clean(row.get(col_map.get('rarity', ''), ''))
            description = _clean(row.get(col_map.get('description', ''), '')) or ""
            gps_raw = _clean(row.get(col_map.get('gps', ''), ''))
            prompt_ia = _clean(row.get(col_map.get('prompt_ia', ''), ''))

            category = _map_category(category_raw, subcategory_raw)
            region = _map_region(region_raw)

            location = _try_parse_coords(gps_raw or "")
            gps_text = _extract_gps_text(gps_raw or "")

            if not location and geocode and address:
                location = await _geocode_address(address, name)
                if location:
                    geocoded += 1

            if skip_duplicates:
                existing = await find_duplicate(
                    collection,
                    name=name,
                    region=region,
                    poi_source_id=poi_source_id,
                    location=location,
                )
                if existing:
                    duplicates += 1
                    continue

            tags = list(set(filter(None, [category, subcategory_raw and subcategory_raw.lower(), region, rarity and rarity.lower() if rarity and rarity.lower() not in ("n/a",) else None])))

            metadata = {}
            if website:
                metadata["website"] = website
            if rarity:
                metadata["rarity"] = rarity
                metadata["rarity_score"] = RARITY_SCORES.get(rarity.lower().strip(), 0)
            # prompt_ia removed — not used in frontend
            if gps_text:
                metadata["gps_label"] = gps_text

            poi_doc = {
                "id": str(uuid.uuid4()),
                "poi_source_id": poi_source_id,
                "name": name,
                "name_normalised": normalise_name(name),
                "description": description,
                "category": category,
                "subcategory": subcategory_raw,
                "category_original": category_raw,
                "region": region,
                "region_original": region_raw,
                "location": location or {},
                "address": address,
                "tags": tags,
                "metadata": metadata,
                "image_url": None,
                "created_at": datetime.now(timezone.utc),
                "source": f"poi_v19_{import_id}",
                "import_batch": import_id,
            }

            await collection.insert_one(poi_doc)
            imported += 1

            if len(sample) < 5:
                sample.append({
                    "id": poi_doc["id"],
                    "source_id": poi_source_id,
                    "name": name,
                    "category": f"{category_raw} → {category}",
                    "region": f"{region_raw} → {region}",
                    "has_location": location is not None,
                    "rarity": rarity,
                })

        except Exception as e:
            errors += 1
            if len(error_details) < 20:
                error_details.append(f"Linha {idx+2}: {str(e)[:120]}")

    return {
        "status": "completed",
        "import_id": import_id,
        "total_rows": len(df),
        "imported": imported,
        "skipped": skipped,
        "duplicates": duplicates,
        "geocoded": geocoded,
        "errors": errors,
        "error_details": error_details,
        "sample": sample,
    }


@poi_v19_router.get("/progress/{batch_id}")
async def get_v19_progress(batch_id: str):
    if batch_id not in _v19_progress:
        raise HTTPException(404, f"Batch {batch_id} não encontrado")
    return _v19_progress[batch_id]


@poi_v19_router.post("/batch-iq/{import_id}")
async def batch_iq_v19(
    import_id: str,
    background_tasks: BackgroundTasks,
    limit: int = Query(default=100, le=1000),
):
    """Run IQ Engine on POIs from a v19 import batch."""
    db = _get_db()

    pois = await db.heritage_items.find(
        {"import_batch": import_id, "$or": [{"iq_status": {"$exists": False}}, {"iq_status": {"$ne": "completed"}}]},
        {"id": 1, "name": 1, "_id": 0}
    ).limit(limit).to_list(length=limit)

    if not pois:
        return {"status": "completed", "message": "Todos os POIs já processados", "total": 0}

    _v19_progress[import_id] = {
        "status": "processing",
        "total": len(pois),
        "processed": 0,
        "iq_processed": 0,
        "errors": [],
    }

    background_tasks.add_task(_run_iq_batch, import_id, pois, db)

    return {
        "status": "started",
        "import_id": import_id,
        "total_pois": len(pois),
        "message": f"IQ Engine a processar {len(pois)} POIs em background",
    }


async def _run_iq_batch(batch_id: str, pois: List[Dict], db):
    from iq_engine_base import get_iq_engine, POIProcessingData

    engine = get_iq_engine()
    progress = _v19_progress[batch_id]

    for poi_ref in pois:
        try:
            poi_doc = await db.heritage_items.find_one({"id": poi_ref["id"]}, {"_id": 0})
            if not poi_doc:
                progress["processed"] += 1
                continue

            location = poi_doc.get("location", {})
            poi_data = POIProcessingData(
                id=poi_ref["id"],
                name=poi_doc.get("name", ""),
                description=poi_doc.get("description", ""),
                category=poi_doc.get("category"),
                subcategory=poi_doc.get("subcategory"),
                region=poi_doc.get("region"),
                location=location if location else None,
                address=poi_doc.get("address"),
                tags=poi_doc.get("tags", []),
                images=([poi_doc["image_url"]] if poi_doc.get("image_url") else []),
                metadata=poi_doc.get("metadata", {}),
            )

            results = await engine.process_poi(poi_data)
            scores = [r.score for r in results if r.score is not None]
            overall_score = sum(scores) / len(scores) if scores else 0

            results_data = [{
                "module": r.module.value if hasattr(r.module, 'value') else str(r.module),
                "score": r.score,
                "status": r.status.value if hasattr(r.status, 'value') else str(r.status),
                "confidence": r.confidence,
                "data": r.data or {},
            } for r in results]

            await db.heritage_items.update_one(
                {"id": poi_ref["id"]},
                {"$set": {
                    "iq_score": round(overall_score, 1),
                    "iq_status": "completed",
                    "iq_processed_at": datetime.now(timezone.utc),
                    "iq_results": results_data,
                    "iq_module_count": len(results),
                }}
            )
            progress["iq_processed"] += 1

        except Exception as e:
            logger.error(f"IQ error for {poi_ref.get('name', '?')}: {e}")
            if len(progress["errors"]) < 20:
                progress["errors"].append(f"{poi_ref.get('name', '?')}: {str(e)[:80]}")

        progress["processed"] += 1

    progress["status"] = "completed"
    logger.info(f"v19 Batch IQ {batch_id}: {progress['iq_processed']}/{progress['total']} processed")


@poi_v19_router.get("/stats")
async def get_v19_stats():
    """Stats specific to v19 imports"""
    db = _get_db()

    total = await db.heritage_items.count_documents({})
    v19_count = await db.heritage_items.count_documents({"$or": [{"source": {"$regex": "^poi_v19_"}}, {"source": "poi_v19_full"}]})
    iq_done = await db.heritage_items.count_documents({"$or": [{"source": {"$regex": "^poi_v19_"}}, {"source": "poi_v19_full"}], "iq_status": "completed"})
    with_location = await db.heritage_items.count_documents({"$or": [{"source": {"$regex": "^poi_v19_"}}, {"source": "poi_v19_full"}], "location.lat": {"$exists": True}})

    # Category distribution for v19 imports
    v19_filter = {"$or": [{"source": {"$regex": "^poi_v19_"}}, {"source": "poi_v19_full"}]}
    pipeline = [
        {"$match": v19_filter},
        {"$group": {"_id": "$category_original", "count": {"$sum": 1}, "mapped": {"$first": "$category"}}},
        {"$sort": {"count": -1}},
    ]
    cats = await db.heritage_items.aggregate(pipeline).to_list(length=50)

    # Region distribution
    reg_pipeline = [
        {"$match": v19_filter},
        {"$group": {"_id": "$region_original", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    regions = await db.heritage_items.aggregate(reg_pipeline).to_list(length=20)

    # Rarity distribution
    rar_pipeline = [
        {"$match": {**v19_filter, "metadata.rarity": {"$exists": True}}},
        {"$group": {"_id": "$metadata.rarity", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    rarities = await db.heritage_items.aggregate(rar_pipeline).to_list(length=10)

    return {
        "total_db": total,
        "v19_imported": v19_count,
        "v19_iq_processed": iq_done,
        "v19_iq_pending": v19_count - iq_done,
        "v19_with_coordinates": with_location,
        "categories": [{"original": c["_id"], "mapped": c["mapped"], "count": c["count"]} for c in cats if c["_id"]],
        "regions": [{"name": r["_id"], "count": r["count"]} for r in regions if r["_id"]],
        "rarities": [{"level": r["_id"], "count": r["count"]} for r in rarities if r["_id"]],
    }
