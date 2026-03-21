"""
Importador CSV — Megalíticos de Portugal Vivo

Importa POIs megalíticos de um ficheiro CSV para a colecção heritage_items.
Converte lat/lng para GeoJSON (lng primeiro, conforme especificação GeoJSON).

Uso:
    python backend/import_megaliticos_csv.py --csv portugal_vivo_megaliticos.csv
    python backend/import_megaliticos_csv.py --csv portugal_vivo_megaliticos.csv --dry-run
"""
import asyncio
import argparse
import csv
import logging
import os
import uuid
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Mapeamento de nomes de colunas aceites → campo interno
COLUMN_ALIASES = {
    "nome": "name",
    "name": "name",
    "designacao": "name",
    "designação": "name",
    "descricao": "description",
    "descrição": "description",
    "description": "description",
    "lat": "lat",
    "latitude": "lat",
    "lng": "lng",
    "lon": "lng",
    "longitude": "lng",
    "categoria_pv": "category",
    "categoria": "category",
    "category": "category",
    "tipo": "subcategory",
    "type": "subcategory",
    "subtipo": "subcategory",
    "regiao": "region",
    "região": "region",
    "region": "region",
    "concelho": "concelho",
    "distrito": "distrito",
    "periodo": "period",
    "período": "period",
    "periodo_historico": "period",
    "fonte": "source",
    "source": "source",
    "url": "source_url",
    "link": "source_url",
    "imagem": "image_url",
    "image_url": "image_url",
    "slug": "slug",
    "tags": "tags",
}

# Categoria padrão para megalíticos quando não especificada
DEFAULT_CATEGORY = "arqueologia"

# Mapeamento de valores de categoria_pv → categoria interna
CATEGORY_MAP = {
    "patrimônio": "arqueologia",
    "patrimônio": "arqueologia",
    "patrimônio megalítico": "arqueologia",
    "megalítico": "arqueologia",
    "megalíticos": "arqueologia",
    "arqueologia": "arqueologia",
    "arqueologia e geologia": "arqueologia_geologia",
    "castelos": "castelos",
    "museus": "museus",
    "miradouros": "miradouros",
}


def _normalise_header(h: str) -> str:
    return h.strip().lower().replace(" ", "_").replace("-", "_")


def _map_category(raw: str) -> str:
    if not raw:
        return DEFAULT_CATEGORY
    return CATEGORY_MAP.get(raw.strip().lower(), raw.strip().lower())


def _parse_float(val: str) -> Optional[float]:
    try:
        return float(val.replace(",", ".").strip())
    except (ValueError, AttributeError):
        return None


def _parse_tags(raw: str) -> list:
    if not raw:
        return []
    return [t.strip() for t in raw.replace(";", ",").split(",") if t.strip()]


def _build_poi(row: dict, header_map: dict) -> Optional[dict]:
    """Constrói um documento POI a partir de uma linha do CSV."""

    def get(field: str) -> str:
        col = header_map.get(field)
        return row.get(col, "").strip() if col else ""

    name = get("name")
    if not name:
        return None

    lat = _parse_float(get("lat"))
    lng = _parse_float(get("lng"))

    if lat is None or lng is None:
        logger.warning("  Ignorado (sem coordenadas): %s", name)
        return None

    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        logger.warning("  Ignorado (coordenadas inválidas): %s lat=%s lng=%s", name, lat, lng)
        return None

    poi_id = str(uuid.uuid4())[:8]
    category = _map_category(get("category"))

    # Slug simples
    slug = get("slug") or name.lower().replace(" ", "-").replace("/", "-")[:80]

    tags = _parse_tags(get("tags"))
    # Tags automáticas
    for auto in ["megalítico", "arqueologia", "pré-história", "portugal"]:
        if auto not in tags:
            tags.append(auto)
    period = get("period")
    if period and period not in tags:
        tags.append(period.lower())

    extra: dict = {}
    for field in ("concelho", "distrito", "period", "source", "source_url"):
        val = get(field)
        if val:
            extra[field] = val

    poi = {
        "id": poi_id,
        "name": name,
        "slug": slug,
        "description": get("description") or None,
        "category": category,
        "subcategory": get("subcategory") or None,
        "region": get("region") or extra.pop("distrito", None) or extra.pop("concelho", None),
        "location": {"lat": lat, "lng": lng},
        # GeoJSON Point — coordinates: [lng, lat] conforme RFC 7946
        "geo_location": {
            "type": "Point",
            "coordinates": [lng, lat],
        },
        "image_url": get("image_url") or None,
        "tags": tags,
        "iq_score": None,
        "source": "megaliticos_csv",
        **extra,
    }
    return poi


async def import_csv(csv_path: str, dry_run: bool = False):
    path = Path(csv_path)
    if not path.exists():
        logger.error("Ficheiro não encontrado: %s", csv_path)
        return

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "patrimonio_vivo")

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Garantir índice 2dsphere antes de inserir
    if not dry_run:
        await db.heritage_items.create_index(
            [("geo_location", "2dsphere")],
            sparse=True,
            name="idx_heritage_geo_2dsphere",
        )
        logger.info("Índice 2dsphere assegurado em heritage_items.geo_location")

    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        raw_headers = reader.fieldnames or []

    # Mapear cabeçalhos normalizados → nome original da coluna
    header_map: dict[str, str] = {}
    for raw_h in raw_headers:
        normalised = _normalise_header(raw_h)
        field = COLUMN_ALIASES.get(normalised)
        if field and field not in header_map:
            header_map[field] = raw_h

    logger.info("Colunas detectadas: %s", list(header_map.items()))
    if "name" not in header_map:
        logger.error("Coluna de nome (nome/name/designacao) não encontrada no CSV.")
        client.close()
        return
    if "lat" not in header_map or "lng" not in header_map:
        logger.error("Colunas lat/lng não encontradas no CSV.")
        client.close()
        return

    inserted = skipped = updated = 0

    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            poi = _build_poi(row, header_map)
            if poi is None:
                skipped += 1
                continue

            if dry_run:
                logger.info("  [DRY-RUN] %s → %s (%.5f, %.5f)",
                            poi["name"], poi["category"],
                            poi["location"]["lat"], poi["location"]["lng"])
                inserted += 1
                continue

            # Upsert por nome + coordenadas (evita duplicados)
            existing = await db.heritage_items.find_one({"name": poi["name"]})
            if existing:
                await db.heritage_items.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "geo_location": poi["geo_location"],
                        "location": poi["location"],
                        "category": poi["category"],
                        "tags": list(set(existing.get("tags", []) + poi["tags"])),
                    }}
                )
                updated += 1
            else:
                await db.heritage_items.insert_one(poi)
                inserted += 1

    client.close()
    action = "simulados" if dry_run else "inseridos"
    logger.info(
        "Concluído — %d %s | %d actualizados | %d ignorados",
        inserted, action, updated, skipped
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Importar CSV de megalíticos para Portugal Vivo")
    parser.add_argument("--csv", required=True, help="Caminho para o ficheiro CSV")
    parser.add_argument("--dry-run", action="store_true", help="Simular sem escrever na BD")
    args = parser.parse_args()
    asyncio.run(import_csv(args.csv, dry_run=args.dry_run))
