"""
excel_import_api.py — Importador de POIs a partir de Excel / CSV

Modos de uso:
  1. Via API:    POST /admin/import/excel   (upload do ficheiro)
  2. Script:     python excel_import_api.py --file pois.xlsx [--dry-run] [--municipality guimaraes]

Suporta colunas em PT e EN, com detecção automática.
Cria/actualiza documentos na colecção heritage_items com municipality_id.
"""

import asyncio
import argparse
import json
import math
import uuid
import re
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

import openpyxl
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel

from tenant_middleware import TenantContext, require_tenant_write

logger = logging.getLogger(__name__)

# ─── Router ───────────────────────────────────────────────────────────────────

router = APIRouter(prefix="/admin/import", tags=["Excel Import"])
_db = None

def set_import_db(database):
    global _db
    _db = database

# ─── Mapeamento de colunas (PT + EN + variações) ──────────────────────────────

COLUMN_MAP: Dict[str, List[str]] = {
    "name":          ["nome", "name", "título", "titulo", "local", "designação", "designacao", "denominação", "denominacao", "topónimo", "toponimo"],
    "category":      ["categoria", "category", "tipo", "type", "tipologia", "subtipo"],
    "description":   ["descrição", "descricao", "description", "desc", "texto", "sobre", "informação", "informacao", "sumário", "sumario"],
    "region":        ["região", "regiao", "region", "distrito", "nuts_ii", "nuts2"],
    "municipality":  ["município", "municipio", "municipality", "concelho", "câmara", "camara", "c_municipal"],
    "parish":        ["freguesia", "parish", "localidade"],
    "lat":           ["latitude", "lat", "y", "coord_lat", "lat_wgs84", "coordenada_y"],
    "lng":           ["longitude", "lng", "lon", "long", "x", "coord_lon", "lng_wgs84", "coordenada_x"],
    "address":       ["morada", "address", "endereço", "endereco", "localização", "localizacao", "sítio", "sitio"],
    "website":       ["website", "web", "url", "site", "www", "link"],
    "phone":         ["telefone", "phone", "tel", "telemovel", "telemóvel", "contacto", "telefone_geral"],
    "email":         ["email", "e-mail", "correio_eletronico", "correio_electrónico"],
    "image_url":     ["foto", "photo", "image", "imagem", "foto_url", "image_url", "fotografia"],
    "tags":          ["tags", "palavras_chave", "keywords", "etiquetas", "temas"],
    "opening_hours": ["horário", "horario", "opening_hours", "horas", "funcionamento"],
    "admission":     ["entrada", "admission", "preço", "preco", "price", "bilhete"],
    "difficulty":    ["dificuldade", "difficulty", "nível", "nivel"],
    "distance_km":   ["distância", "distancia", "distance_km", "km", "extensão", "extensao"],
}

# ─── Normalização de categorias ───────────────────────────────────────────────

CATEGORY_NORMALIZE: Dict[str, str] = {
    # Historia
    "histórico": "historia", "historic": "historia", "história": "historia",
    "castelo": "historia", "palácio": "historia", "palacio": "historia",
    "fortaleza": "historia", "monumento": "historia", "ruína": "historia",
    "ruinas": "historia", "archaeological": "arqueologia",
    # Religioso
    "igreja": "religioso", "mosteiro": "religioso", "convento": "religioso",
    "santuário": "religioso", "santuario": "religioso", "capella": "religioso",
    "ermida": "religioso", "catedral": "religioso",
    # Natureza
    "nature": "natureza", "parque": "natureza", "reserva": "natureza",
    "floresta": "natureza", "rio": "natureza", "serra": "natureza",
    "lagoa": "natureza", "cascata": "natureza", "geologia": "natureza",
    # Percursos
    "trilho": "percursos", "percurso": "percursos", "rota": "percursos",
    "caminhada": "percursos", "hiking": "percursos", "trail": "percursos",
    # Praias
    "praia": "praias", "beach": "praias", "litoral": "praias",
    # Museus
    "museu": "museus", "museum": "museus", "galeria": "museus",
    "exposição": "museus", "centro_interpretativo": "museus",
    # Gastronomia
    "gastronomia": "gastronomia", "food": "gastronomia", "restaurante": "gastronomia",
    "vinho": "vinhos", "queijo": "gastronomia", "doce": "gastronomia",
    # Eventos / Festas
    "festa": "festas", "festival": "festas", "romaria": "festas",
    "evento": "eventos", "event": "eventos",
    # Artesanato / Saberes
    "artesanato": "saberes", "craft": "saberes", "olaria": "saberes",
    # Miradouros
    "miradouro": "miradouros", "viewpoint": "miradouros", "vista": "miradouros",
}

# ─── Normalização de regiões ──────────────────────────────────────────────────

REGION_NORMALIZE: Dict[str, str] = {
    # Norte
    "porto": "norte", "braga": "norte", "viana do castelo": "norte",
    "vila real": "norte", "bragança": "norte", "braganca": "norte",
    "north": "norte", "minho": "norte", "trás-os-montes": "norte",
    # Centro
    "coimbra": "centro", "aveiro": "centro", "viseu": "centro",
    "guarda": "centro", "castelo branco": "centro", "leiria": "centro",
    "central": "centro", "beira": "centro",
    # Lisboa
    "lisbon": "lisboa", "setúbal": "lisboa", "setubal": "lisboa",
    "santarém": "lisboa", "santarem": "lisboa", "ribatejo": "lisboa",
    # Alentejo
    "évora": "alentejo", "evora": "alentejo", "portalegre": "alentejo",
    "beja": "alentejo",
    # Algarve
    "faro": "algarve",
    # Açores
    "açores": "acores", "azores": "acores",
    "ponta delgada": "acores", "angra": "acores",
    # Madeira
    "funchal": "madeira",
}

# ─── Parser do Excel ──────────────────────────────────────────────────────────

def _normalize_header(h: str) -> str:
    return re.sub(r"[\s_\-]+", "_", str(h).lower().strip())

def _detect_columns(headers: List[str]) -> Dict[str, int]:
    """Detecta automaticamente qual coluna do Excel corresponde a cada campo."""
    normalized = {_normalize_header(h): i for i, h in enumerate(headers)}
    mapping: Dict[str, int] = {}

    for field, aliases in COLUMN_MAP.items():
        for alias in aliases:
            key = _normalize_header(alias)
            if key in normalized:
                mapping[field] = normalized[key]
                break

    return mapping

def _normalize_category(raw: str) -> str:
    if not raw:
        return "outros"
    clean = re.sub(r"[\s_\-/]+", "_", str(raw).lower().strip().rstrip("s"))
    # Try direct match
    if clean in CATEGORY_NORMALIZE:
        return CATEGORY_NORMALIZE[clean]
    # Try prefix match
    for key, val in CATEGORY_NORMALIZE.items():
        if clean.startswith(key) or key.startswith(clean):
            return val
    # Return normalized as-is (already valid slug)
    return re.sub(r"[^a-z0-9_]", "", clean) or "outros"

def _normalize_region(raw: str) -> str:
    if not raw:
        return "portugal"
    clean = str(raw).lower().strip()
    # Direct match
    if clean in {"norte", "centro", "lisboa", "alentejo", "algarve", "acores", "açores", "madeira"}:
        return clean.replace("açores", "acores")
    for key, val in REGION_NORMALIZE.items():
        if key in clean:
            return val
    return "portugal"

def _parse_float(val: Any) -> Optional[float]:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    try:
        return float(str(val).replace(",", ".").strip())
    except (ValueError, TypeError):
        return None

def _calc_health_score(poi: dict) -> int:
    """Calcula content_health_score inicial com base nos campos preenchidos."""
    score = 0
    if poi.get("name"):           score += 15
    if poi.get("description") and len(str(poi.get("description", ""))) > 50:
        score += 20
    elif poi.get("description"): score += 10
    if poi.get("category") and poi["category"] != "outros": score += 10
    if poi.get("location", {}).get("lat"):  score += 15
    if poi.get("image_url"):      score += 15
    if poi.get("address"):        score += 5
    if poi.get("website"):        score += 5
    if poi.get("phone"):          score += 5
    if poi.get("opening_hours"):  score += 5
    if poi.get("tags"):           score += 5
    return min(score, 100)

def parse_excel_to_pois(
    file_bytes: bytes,
    municipality_id: Optional[str] = None,
    file_ext: str = ".xlsx",
) -> Tuple[List[dict], List[dict]]:
    """
    Lê ficheiro Excel/CSV e devolve (pois_válidos, erros).
    Cada erro: {"row": int, "reason": str, "raw": dict}
    """
    import io

    if file_ext in (".csv",):
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8", dtype=str)
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin-1", dtype=str)
        rows = [dict(zip(df.columns, row)) for row in df.values]
        headers = list(df.columns)
    else:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        ws = wb.active
        all_rows = list(ws.iter_rows(values_only=True))
        if not all_rows:
            return [], [{"row": 0, "reason": "Ficheiro vazio"}]
        headers = [str(h) if h is not None else f"col_{i}" for i, h in enumerate(all_rows[0])]
        rows = [dict(zip(headers, row)) for row in all_rows[1:]]

    col_map = _detect_columns(headers)

    if "name" not in col_map:
        return [], [{"row": 0, "reason": f"Coluna 'nome' não encontrada. Colunas detectadas: {headers[:10]}"}]

    pois: List[dict] = []
    errors: List[dict] = []

    for i, row in enumerate(rows, start=2):
        raw = {k: v for k, v in row.items() if v is not None and str(v).strip() not in ("", "nan", "None")}

        def get(field: str) -> Optional[str]:
            idx = col_map.get(field)
            if idx is None:
                return None
            # row indexed by header name
            header = headers[idx]
            val = row.get(header)
            if val is None or str(val).strip() in ("", "nan", "None"):
                return None
            return str(val).strip()

        name = get("name")
        if not name:
            errors.append({"row": i, "reason": "Nome vazio", "raw": raw})
            continue

        lat = _parse_float(get("lat"))
        lng = _parse_float(get("lng"))

        # Validação de coordenadas (Portugal: lat 36-42, lng -10 a -6)
        if lat is not None and lng is not None:
            if not (36 <= lat <= 43 and -32 <= lng <= 0):
                errors.append({"row": i, "reason": f"Coordenadas fora de Portugal: {lat},{lng}", "raw": raw})
                lat, lng = None, None  # aceitar sem coordenadas

        category = _normalize_category(get("category") or "")
        region_raw = get("region") or get("municipality") or ""
        region = _normalize_region(region_raw)
        mun_id = municipality_id or _normalize_header(get("municipality") or region or "desconhecido")

        poi: dict = {
            "id": str(uuid.uuid4()),
            "name": name,
            "category": category,
            "region": region,
            "municipality_id": mun_id,
            "content_health_score": 0,
            "iq_score": 0,
            "status": "draft",
            "imported_at": datetime.now(timezone.utc).isoformat(),
        }

        if lat is not None and lng is not None:
            poi["location"] = {"lat": lat, "lng": lng}

        for field in ("description", "address", "website", "phone", "email",
                      "image_url", "opening_hours", "admission"):
            val = get(field)
            if val:
                poi[field] = val

        tags_raw = get("tags")
        if tags_raw:
            poi["tags"] = [t.strip() for t in re.split(r"[,;|]", tags_raw) if t.strip()]

        poi["content_health_score"] = _calc_health_score(poi)
        pois.append(poi)

    return pois, errors

# ─── Upsert no MongoDB ────────────────────────────────────────────────────────

async def upsert_pois(pois: List[dict], dry_run: bool = False) -> dict:
    """Insere ou actualiza POIs na colecção heritage_items. Deduplicação por nome+município."""
    if _db is None:
        raise RuntimeError("DB não configurada")

    created = updated = skipped = 0

    for poi in pois:
        if dry_run:
            created += 1
            continue

        existing = await _db.heritage_items.find_one({
            "name": poi["name"],
            "municipality_id": poi.get("municipality_id"),
        }, {"_id": 0, "id": 1})

        if existing:
            # Actualiza campos enriquecidos; não sobrescreve id nem dados manuais
            update_fields = {k: v for k, v in poi.items()
                             if k not in ("id", "status", "iq_score") and v}
            update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
            await _db.heritage_items.update_one(
                {"id": existing["id"]},
                {"$set": update_fields}
            )
            updated += 1
        else:
            await _db.heritage_items.insert_one(poi)
            created += 1

    return {"created": created, "updated": updated, "skipped": skipped}

# ─── Endpoint de upload ───────────────────────────────────────────────────────

class ImportReport(BaseModel):
    total_rows: int
    created: int
    updated: int
    skipped: int
    errors: int
    error_details: List[dict]
    dry_run: bool
    municipality_id: Optional[str]
    duration_seconds: float

@router.post("/excel", response_model=ImportReport)
async def import_excel(
    file: UploadFile = File(...),
    municipality_id: Optional[str] = Form(None),
    dry_run: bool = Form(False),
    tenant: TenantContext = Depends(require_tenant_write),
):
    """
    Importa POIs a partir de ficheiro Excel (.xlsx) ou CSV.
    Se dry_run=true, valida sem gravar na BD.
    municipality_id obrigatório para editors/municipio; admin_global pode omitir.
    """
    import time
    t0 = time.time()

    # Tenant sem municipality_id deve especificar
    effective_mun = municipality_id or tenant.municipality_id
    if not tenant.is_admin_global and not effective_mun:
        raise HTTPException(status_code=400, detail="municipality_id obrigatório")

    # Verificar tipo de ficheiro
    ext = Path(file.filename or "file.xlsx").suffix.lower()
    if ext not in (".xlsx", ".xls", ".csv"):
        raise HTTPException(status_code=400, detail="Formato suportado: .xlsx, .xls, .csv")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10 MB
        raise HTTPException(status_code=413, detail="Ficheiro demasiado grande (máx. 10 MB)")

    pois, errors = parse_excel_to_pois(contents, effective_mun, ext)

    # Tenant não-admin só pode importar para o seu município
    if not tenant.is_admin_global and effective_mun:
        filtered = [p for p in pois if p.get("municipality_id") == effective_mun]
        if len(filtered) < len(pois):
            logger.warning(f"Tenant {tenant.municipality_id} tentou importar POIs de outro município")
        pois = filtered

    result = await upsert_pois(pois, dry_run=dry_run)

    return ImportReport(
        total_rows=len(pois) + len(errors),
        created=result["created"],
        updated=result["updated"],
        skipped=result["skipped"],
        errors=len(errors),
        error_details=errors[:50],  # max 50 erros devolvidos
        dry_run=dry_run,
        municipality_id=effective_mun,
        duration_seconds=round(time.time() - t0, 2),
    )

@router.get("/template")
async def download_template():
    """Devolve a estrutura esperada do Excel (cabeçalhos e exemplo)."""
    return {
        "required_columns": ["nome", "categoria", "latitude", "longitude"],
        "optional_columns": [
            "descrição", "região", "município", "morada",
            "website", "telefone", "email", "imagem",
            "horário", "entrada", "tags", "dificuldade",
        ],
        "category_values": list(set(CATEGORY_NORMALIZE.values())),
        "region_values": ["norte", "centro", "lisboa", "alentejo", "algarve", "acores", "madeira"],
        "example_row": {
            "nome": "Castelo de Guimarães",
            "categoria": "historia",
            "latitude": "41.4430",
            "longitude": "-8.2952",
            "descrição": "Berço de Portugal, castelo medieval do séc. X.",
            "região": "norte",
            "município": "guimaraes",
            "website": "https://www.patrimoniocultural.gov.pt",
            "tags": "castelo,medieval,unesco",
        },
    }

# ─── Script standalone ────────────────────────────────────────────────────────

async def _run_script(file_path: str, municipality_id: Optional[str], dry_run: bool, mongo_url: str, db_name: str):
    import motor.motor_asyncio
    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    set_import_db(db)

    ext = Path(file_path).suffix.lower()
    contents = Path(file_path).read_bytes()

    print(f"📂 A ler '{file_path}' ({len(contents)//1024} KB)...")
    pois, errors = parse_excel_to_pois(contents, municipality_id, ext)

    print(f"✅ {len(pois)} POIs válidos | ❌ {len(errors)} erros")

    if errors:
        print("\n── Erros (primeiros 10) ──")
        for e in errors[:10]:
            print(f"  Linha {e.get('row')}: {e.get('reason')}")

    if dry_run:
        print(f"\n[DRY RUN] Seria inserido/actualizado {len(pois)} POIs — nenhuma alteração na BD.")
        sample = pois[:3]
        print("\n── Amostra (3 POIs) ──")
        print(json.dumps(sample, ensure_ascii=False, default=str, indent=2))
        return

    print("\n⏳ A importar para MongoDB...")
    result = await upsert_pois(pois, dry_run=False)
    print(f"✅ Criados: {result['created']} | 🔄 Actualizados: {result['updated']}")

    report_path = Path(file_path).stem + "_import_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "file": file_path,
            "municipality_id": municipality_id,
            "total": len(pois),
            "errors": errors,
            **result,
        }, f, ensure_ascii=False, default=str, indent=2)
    print(f"📄 Relatório guardado em '{report_path}'")

if __name__ == "__main__":
    import os
    parser = argparse.ArgumentParser(description="Importador de POIs — Portugal Vivo")
    parser.add_argument("--file", required=True, help="Caminho para o ficheiro .xlsx ou .csv")
    parser.add_argument("--municipality", help="ID do município (ex: guimaraes)")
    parser.add_argument("--dry-run", action="store_true", help="Validar sem gravar na BD")
    parser.add_argument("--mongo-url", default=os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    parser.add_argument("--db-name", default=os.environ.get("DB_NAME", "portugal_vivo"))
    args = parser.parse_args()

    asyncio.run(_run_script(
        file_path=args.file,
        municipality_id=args.municipality,
        dry_run=args.dry_run,
        mongo_url=args.mongo_url,
        db_name=args.db_name,
    ))
