"""
Excel POI Importer API
Importa POIs de ficheiros Excel/CSV para a base de dados,
com opção de processamento batch pelo IQ Engine.
"""
import uuid
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from io import BytesIO

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Query
from pydantic import BaseModel

logger = logging.getLogger("excel_importer")

importer_router = APIRouter(prefix="/importer", tags=["Excel Importer"])

from shared_utils import DatabaseHolder

_db_holder = DatabaseHolder("excel_importer")
set_importer_db = _db_holder.set
_get_db = _db_holder.get

# ============================================
# Column mapping presets for common Excel formats
# ============================================
COLUMN_MAPPINGS = {
    "auto": None,  # Auto-detect
    "patrimonio_vivo_v19": {
        "name": ["nome", "name", "designação", "título", "poi_name"],
        "description": ["descrição", "description", "desc", "texto", "detalhes"],
        "category": ["categoria", "category", "tipo", "type", "cat"],
        "subcategory": ["subcategoria", "subcategory", "subtipo"],
        "region": ["região", "region", "zona", "distrito"],
        "address": ["morada", "address", "endereço", "localização", "local"],
        "latitude": ["latitude", "lat", "y", "coord_y"],
        "longitude": ["longitude", "lng", "lon", "x", "coord_x"],
        "tags": ["tags", "etiquetas", "palavras-chave", "keywords"],
        "image_url": ["imagem", "image", "image_url", "foto", "url_imagem"],
        "phone": ["telefone", "phone", "tel", "contacto"],
        "website": ["website", "site", "url", "web"],
        "email": ["email", "e-mail", "correio"],
        "opening_hours": ["horário", "hours", "opening_hours", "funcionamento"],
        "price": ["preço", "price", "custo", "entrada"],
    }
}


def _find_column(df_columns: List[str], aliases: List[str]) -> Optional[str]:
    """Find the first matching column from a list of aliases"""
    df_cols_lower = {c.lower().strip(): c for c in df_columns}
    for alias in aliases:
        if alias.lower() in df_cols_lower:
            return df_cols_lower[alias.lower()]
    return None


def _auto_detect_mapping(df_columns: List[str]) -> Dict[str, Optional[str]]:
    """Auto-detect column mapping from DataFrame columns"""
    mapping = {}
    preset = COLUMN_MAPPINGS["patrimonio_vivo_v19"]
    for field, aliases in preset.items():
        mapping[field] = _find_column(df_columns, aliases)
    return mapping


def _clean_value(val: Any) -> Any:
    """Clean a cell value"""
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, float) and val != val:  # NaN check
        return None
    if isinstance(val, str):
        val = val.strip()
        return val if val else None
    return val


def _parse_tags(val: Any) -> List[str]:
    """Parse tags from various formats"""
    if val is None or pd.isna(val):
        return []
    if isinstance(val, list):
        return [str(t).strip() for t in val if t]
    if isinstance(val, str):
        # Try comma, semicolon, pipe separators
        for sep in [',', ';', '|']:
            if sep in val:
                return [t.strip() for t in val.split(sep) if t.strip()]
        return [val.strip()] if val.strip() else []
    return []


def _parse_coordinates(lat_val: Any, lng_val: Any) -> Optional[Dict]:
    """Parse latitude and longitude into location dict"""
    try:
        lat = float(lat_val) if lat_val is not None and not pd.isna(lat_val) else None
        lng = float(lng_val) if lng_val is not None and not pd.isna(lng_val) else None

        if lat is not None and lng is not None:
            # Validate Portuguese coordinates roughly
            if 32 <= lat <= 43 and -32 <= lng <= -6:
                return {"lat": lat, "lng": lng}
            # Maybe swapped?
            if 32 <= lng <= 43 and -32 <= lat <= -6:
                return {"lat": lng, "lng": lat}
        return None
    except (ValueError, TypeError):
        return None


class ImportResult(BaseModel):
    status: str
    total_rows: int
    imported: int
    skipped: int
    errors: int
    duplicates: int
    error_details: List[str]
    column_mapping: Dict[str, Optional[str]]
    sample_data: List[Dict[str, Any]]
    import_id: str


class ImportProgress(BaseModel):
    import_id: str
    status: str
    total: int
    processed: int
    iq_processed: int
    percentage: float


# In-memory progress tracking
_import_progress: Dict[str, Dict] = {}


@importer_router.post("/preview")
async def preview_excel(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Form(None),
):
    """
    Preview an Excel/CSV file before importing.
    Returns column mapping and sample data.
    """
    if not file.filename:
        raise HTTPException(400, "Ficheiro não fornecido")

    ext = file.filename.lower().split('.')[-1]
    if ext not in ('xlsx', 'xls', 'csv'):
        raise HTTPException(400, f"Formato não suportado: .{ext}. Use .xlsx, .xls ou .csv")

    content = await file.read()

    try:
        if ext == 'csv':
            # Try different encodings
            for encoding in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    df = pd.read_csv(BytesIO(content), encoding=encoding, nrows=100)
                    break
                except UnicodeDecodeError:
                    continue
        else:
            df = pd.read_excel(BytesIO(content), sheet_name=sheet_name or 0, nrows=100)
    except Exception as e:
        raise HTTPException(400, f"Erro ao ler ficheiro: {str(e)}")

    # Auto-detect mapping
    mapping = _auto_detect_mapping(list(df.columns))

    # Get sample data
    sample = []
    for _, row in df.head(5).iterrows():
        sample.append({str(k): _clean_value(v) for k, v in row.items()})

    return {
        "filename": file.filename,
        "total_rows": len(df),
        "columns": list(df.columns),
        "detected_mapping": mapping,
        "mapped_fields": {k: v for k, v in mapping.items() if v is not None},
        "unmapped_fields": [k for k, v in mapping.items() if v is None],
        "sample_data": sample,
    }


@importer_router.post("/upload", response_model=ImportResult)
async def upload_and_import(
    file: UploadFile = File(...),
    tenant_id: str = Form("default"),
    sheet_name: Optional[str] = Form(None),
    skip_duplicates: bool = Form(True),
    background_tasks: BackgroundTasks = None,
):
    """
    Upload and import an Excel/CSV file into the database.
    """
    if not file.filename:
        raise HTTPException(400, "Ficheiro não fornecido")

    ext = file.filename.lower().split('.')[-1]
    if ext not in ('xlsx', 'xls', 'csv'):
        raise HTTPException(400, f"Formato não suportado: .{ext}")

    content = await file.read()
    import_id = str(uuid.uuid4())[:8]

    try:
        if ext == 'csv':
            for encoding in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    df = pd.read_csv(BytesIO(content), encoding=encoding)
                    break
                except UnicodeDecodeError:
                    continue
        else:
            df = pd.read_excel(BytesIO(content), sheet_name=sheet_name or 0)
    except Exception as e:
        raise HTTPException(400, f"Erro ao ler ficheiro: {str(e)}")

    logger.info(f"📥 Import {import_id}: {len(df)} rows from {file.filename}")

    # Auto-detect column mapping
    mapping = _auto_detect_mapping(list(df.columns))
    logger.info(f"📋 Column mapping: {mapping}")

    # Get database
    db = _get_db()
    collection = db.heritage_items

    # Get existing names for duplicate detection
    existing_names = set()
    if skip_duplicates:
        existing = await collection.find({}, {"name": 1}).to_list(length=10000)
        existing_names = {doc["name"].lower().strip() for doc in existing if doc.get("name")}

    imported = 0
    skipped = 0
    errors = 0
    duplicates = 0
    error_details = []
    sample_imported = []

    for idx, row in df.iterrows():
        try:
            # Extract name (required)
            name_col = mapping.get("name")
            name = _clean_value(row[name_col]) if name_col else None

            if not name:
                skipped += 1
                continue

            # Check duplicates
            if skip_duplicates and name.lower().strip() in existing_names:
                duplicates += 1
                continue

            # Extract all fields
            desc_col = mapping.get("description")
            cat_col = mapping.get("category")
            subcat_col = mapping.get("subcategory")
            region_col = mapping.get("region")
            addr_col = mapping.get("address")
            lat_col = mapping.get("latitude")
            lng_col = mapping.get("longitude")
            tags_col = mapping.get("tags")
            img_col = mapping.get("image_url")
            phone_col = mapping.get("phone")
            web_col = mapping.get("website")
            email_col = mapping.get("email")
            hours_col = mapping.get("opening_hours")
            price_col = mapping.get("price")

            # Build POI document
            description = _clean_value(row[desc_col]) if desc_col else None
            category = _clean_value(row[cat_col]) if cat_col else None
            subcategory = _clean_value(row[subcat_col]) if subcat_col else None
            region = _clean_value(row[region_col]) if region_col else None
            address = _clean_value(row[addr_col]) if addr_col else None

            # Parse location
            lat_val = _clean_value(row[lat_col]) if lat_col else None
            lng_val = _clean_value(row[lng_col]) if lng_col else None
            location = _parse_coordinates(lat_val, lng_val)

            # Parse tags
            tags_raw = _clean_value(row[tags_col]) if tags_col else None
            tags = _parse_tags(tags_raw)
            if category and category.lower() not in [t.lower() for t in tags]:
                tags.append(category.lower())
            if region and region.lower() not in [t.lower() for t in tags]:
                tags.append(region.lower())

            # Build metadata
            metadata = {}
            if phone_col:
                phone = _clean_value(row[phone_col])
                if phone:
                    metadata["phone"] = str(phone)
            if web_col:
                website = _clean_value(row[web_col])
                if website:
                    metadata["website"] = str(website)
            if email_col:
                email = _clean_value(row[email_col])
                if email:
                    metadata["email"] = str(email)
            if hours_col:
                hours = _clean_value(row[hours_col])
                if hours:
                    metadata["opening_hours"] = str(hours)
            if price_col:
                price = _clean_value(row[price_col])
                if price:
                    metadata["price"] = str(price)

            poi_doc = {
                "id": str(uuid.uuid4()),
                "name": name,
                "description": description or "",
                "category": (category or "outros").lower().strip(),
                "subcategory": subcategory,
                "region": (region or "portugal").lower().strip(),
                "location": location or {},
                "address": address or "",
                "tags": tags,
                "metadata": metadata,
                "image_url": _clean_value(row[img_col]) if img_col else None,
                "created_at": datetime.utcnow(),
                "source": f"excel_import_{import_id}",
                "import_batch": import_id,
            }

            await collection.insert_one(poi_doc)
            imported += 1
            existing_names.add(name.lower().strip())

            if len(sample_imported) < 3:
                sample_imported.append({
                    "id": poi_doc["id"],
                    "name": poi_doc["name"],
                    "category": poi_doc["category"],
                    "region": poi_doc["region"],
                    "has_location": location is not None,
                    "has_description": bool(description),
                })

        except Exception as e:
            errors += 1
            if len(error_details) < 10:
                error_details.append(f"Linha {idx + 2}: {str(e)[:100]}")

    logger.info(f"✅ Import {import_id} complete: {imported} imported, {skipped} skipped, {duplicates} duplicates, {errors} errors")

    return ImportResult(
        status="completed",
        total_rows=len(df),
        imported=imported,
        skipped=skipped,
        errors=errors,
        duplicates=duplicates,
        error_details=error_details,
        column_mapping={k: v for k, v in mapping.items() if v is not None},
        sample_data=sample_imported,
        import_id=import_id,
    )


@importer_router.post("/batch-iq/{import_id}")
async def batch_iq_process(
    import_id: str,
    background_tasks: BackgroundTasks,
    limit: int = Query(default=50, le=500),
):
    """
    Run IQ Engine batch processing on recently imported POIs.
    Runs in background and returns progress tracking ID.
    """
    db = _get_db()

    # Find POIs from this import batch
    pois = await db.heritage_items.find(
        {"import_batch": import_id},
        {"id": 1, "name": 1}
    ).limit(limit).to_list(length=limit)

    if not pois:
        raise HTTPException(404, f"Nenhum POI encontrado para o import {import_id}")

    # Initialize progress
    _import_progress[import_id] = {
        "status": "processing",
        "total": len(pois),
        "processed": 0,
        "iq_processed": 0,
        "errors": [],
    }

    # Run in background
    background_tasks.add_task(_run_batch_iq, import_id, pois, db)

    return {
        "status": "started",
        "import_id": import_id,
        "total_pois": len(pois),
        "message": f"Processamento IQ iniciado para {len(pois)} POIs em background",
    }


async def _run_batch_iq(import_id: str, pois: List[Dict], db):
    """Background task for batch IQ processing"""
    from iq_engine_base import get_iq_engine, POIProcessingData, ProcessingResult

    engine = get_iq_engine()
    progress = _import_progress[import_id]

    for poi_ref in pois:
        try:
            poi_id = poi_ref["id"]

            # Fetch full POI
            poi_doc = await db.heritage_items.find_one({"id": poi_id})
            if not poi_doc:
                progress["processed"] += 1
                continue

            # Build processing data
            location = poi_doc.get("location", {})
            poi_data = POIProcessingData(
                id=poi_id,
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

            # Process through IQ Engine
            results: List[ProcessingResult] = await engine.process_poi(poi_data)

            # Calculate overall score from results
            scores = [r.score for r in results if r.score is not None]
            overall_score = sum(scores) / len(scores) if scores else 0

            # Convert results to serializable dicts
            results_data = []
            for r in results:
                results_data.append({
                    "module": r.module.value if hasattr(r.module, 'value') else str(r.module),
                    "score": r.score,
                    "status": r.status.value if hasattr(r.status, 'value') else str(r.status),
                    "confidence": r.confidence,
                    "data": r.data or {},
                })

            # Save results
            await db.heritage_items.update_one(
                {"id": poi_id},
                {"$set": {
                    "iq_score": round(overall_score, 1),
                    "iq_status": "completed",
                    "iq_processed_at": datetime.utcnow(),
                    "iq_results": results_data,
                    "iq_module_count": len(results),
                }}
            )

            progress["iq_processed"] += 1

        except Exception as e:
            logger.error(f"Batch IQ error for {poi_ref.get('name', '?')}: {str(e)}")
            if len(progress["errors"]) < 20:
                progress["errors"].append(f"{poi_ref.get('name', '?')}: {str(e)[:80]}")

        progress["processed"] += 1

    progress["status"] = "completed"
    logger.info(f"✅ Batch IQ {import_id}: {progress['iq_processed']}/{progress['total']} processed")


@importer_router.get("/progress/{import_id}", response_model=ImportProgress)
async def get_import_progress(import_id: str):
    """Get progress of a batch IQ processing job"""
    if import_id not in _import_progress:
        raise HTTPException(404, f"Import {import_id} não encontrado")

    p = _import_progress[import_id]
    return ImportProgress(
        import_id=import_id,
        status=p["status"],
        total=p["total"],
        processed=p["processed"],
        iq_processed=p["iq_processed"],
        percentage=round(p["processed"] / max(p["total"], 1) * 100, 1),
    )


@importer_router.post("/batch-iq-all")
async def batch_iq_all(
    background_tasks: BackgroundTasks,
    limit: int = Query(default=100, le=500),
):
    """
    Process ALL pending POIs through IQ Engine (those without iq_status=completed).
    """
    db = _get_db()

    # Find POIs not yet processed
    pois = await db.heritage_items.find(
        {"$or": [{"iq_status": {"$exists": False}}, {"iq_status": {"$ne": "completed"}}]},
        {"id": 1, "name": 1}
    ).limit(limit).to_list(length=limit)

    if not pois:
        return {"status": "completed", "message": "Todos os POIs já foram processados!", "total": 0}

    batch_id = f"all_{str(uuid.uuid4())[:6]}"

    _import_progress[batch_id] = {
        "status": "processing",
        "total": len(pois),
        "processed": 0,
        "iq_processed": 0,
        "errors": [],
    }

    background_tasks.add_task(_run_batch_iq, batch_id, pois, db)

    return {
        "status": "started",
        "batch_id": batch_id,
        "total_pois": len(pois),
        "message": f"Processamento IQ iniciado para {len(pois)} POIs pendentes",
    }


@importer_router.get("/stats")
async def get_import_stats():
    """Get import statistics"""
    db = _get_db()

    total = await db.heritage_items.count_documents({})
    imported = await db.heritage_items.count_documents({"source": {"$regex": "^excel_import_"}})
    iq_processed = await db.heritage_items.count_documents({"iq_status": "completed"})

    # Category breakdown
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20}
    ]
    categories = await db.heritage_items.aggregate(pipeline).to_list(length=20)

    # Region breakdown
    region_pipeline = [
        {"$group": {"_id": "$region", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    regions = await db.heritage_items.aggregate(region_pipeline).to_list(length=10)

    # Average IQ score
    iq_pipeline = [
        {"$match": {"iq_score": {"$exists": True, "$gt": 0}}},
        {"$group": {"_id": None, "avg_score": {"$avg": "$iq_score"}, "count": {"$sum": 1}}}
    ]
    iq_stats = await db.heritage_items.aggregate(iq_pipeline).to_list(length=1)

    return {
        "total_pois": total,
        "imported_from_excel": imported,
        "iq_processed": iq_processed,
        "iq_pending": total - iq_processed,
        "avg_iq_score": round(iq_stats[0]["avg_score"], 1) if iq_stats else None,
        "categories": {c["_id"]: c["count"] for c in categories if c["_id"]},
        "regions": {r["_id"]: r["count"] for r in regions if r["_id"]},
    }


@importer_router.post("/generate-sample")
async def generate_sample_csv():
    """Generate a sample CSV template for import"""
    import csv
    from io import StringIO
    from fastapi.responses import StreamingResponse

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "nome", "descrição", "categoria", "região", "morada",
        "latitude", "longitude", "tags", "imagem", "telefone",
        "website", "horário", "preço"
    ])
    writer.writerow([
        "Santuário do Bom Jesus do Monte",
        "Santuário barroco com escadaria monumental, Património UNESCO",
        "religioso", "norte", "Bom Jesus, Braga",
        "41.5545", "-8.3769", "UNESCO,barroco,escadaria",
        "", "253 676 636", "https://bomjesus.pt", "09:00-17:30", "Gratuito"
    ])
    writer.writerow([
        "Torre dos Clérigos",
        "Torre icónica do Porto com vista panorâmica, obra de Nasoni",
        "monumentos", "norte", "Rua de São Filipe de Nery, Porto",
        "41.1458", "-8.6144", "barroco,Nasoni,torre",
        "", "222 001 817", "https://torredosclerigos.pt", "09:00-19:00", "8€"
    ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=patrimonio_template.csv"}
    )
