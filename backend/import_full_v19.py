"""
Universal Multi-Sheet POI Importer for PortugalVivo_BaseDados_POI_v19.xlsx
Processes all 39 sheets with different formats into a unified POI structure.
"""
import os
import re
import uuid
import asyncio
import logging
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any

import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger("universal_importer")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "patrimonio_vivo")
GOOGLE_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
EXCEL_PATH = "/tmp/PortugalVivo_BaseDados_POI_v19.xlsx"

# Sheets to skip (guides, not POI data)
SKIP_SHEETS = {'🗺 Guia do Viajante', '🚌 Transportes', 'Categorias', '🎵 Música Tradicional'}

# Sheet → (category, subcategory) mapping
SHEET_CATEGORY_MAP = {
    '🌊 Barragens e Albufeiras': ('barragens_albufeiras', 'Barragem'),
    '🎪 Festivais de Música': ('festas_romarias', 'Festival de Música'),
    'Base de Dados POI': (None, None),  # Uses own Categoria column
    'Festas e Romarias': ('festas_romarias', 'Festa/Romaria'),
    'Percursos Pedestres': ('percursos_pedestres', 'Percurso Pedestre'),
    'Ofícios e Artesanato': ('oficios_artesanato', 'Artesanato'),
    'Mercados e Feiras': ('mercados_feiras', 'Mercado/Feira'),
    'Tabernas Históricas': ('tabernas_historicas', 'Taberna Histórica'),
    'Museus': ('museus', 'Museu'),
    'Fauna Autóctone': ('fauna_autoctone', 'Fauna'),
    'Flora Autóctone': ('flora_autoctone', 'Flora'),
    'Aventura e Natureza': ('aventura_natureza', 'Aventura'),
    'Natureza Especializada': ('natureza_especializada', 'Natureza Especializada'),
    'Flora Botânica': ('natureza_especializada', 'Jardim Botânico'),
    'Castelos': ('castelos', 'Castelo'),
    'Palácios e Solares': ('arqueologia_geologia', 'Palácio/Solar'),
    'Surf': ('surf', 'Surf'),
    'Praias Fluviais': ('praias_fluviais', 'Praia Fluvial'),
    '🧀 Produtores DOP e Locais': ('produtores_dop', 'Produtor DOP'),
    'Agentes Turísticos': ('rotas_tematicas', 'Agente Turístico'),
    'Parques de Campismo': ('aventura_natureza', 'Parque Campismo'),
    'Arqueologia e Geologia': ('arqueologia_geologia', 'Arqueologia'),
    'Pousadas de Juventude': ('alojamentos_rurais', 'Pousada Juventude'),
    'Rotas Temáticas': ('rotas_tematicas', 'Rota Temática'),
    'Grande Expedição 2026': ('rotas_tematicas', 'Grande Expedição'),
    'Restaurantes e Gastronomia': ('restaurantes_gastronomia', 'Restaurante'),
    'Entidades e Operadores': ('rotas_tematicas', 'Entidade'),
    'Alojamentos Rurais': ('alojamentos_rurais', 'Alojamento Rural'),
    'Descobertas Raras': ('natureza_especializada', 'Descoberta Rara'),
    'Miradouros Portugal': ('miradouros', 'Miradouro'),
    'Património Ferroviário': ('arqueologia_geologia', 'Património Ferroviário'),
    'Arte Urbana e Intervenção': ('arte_urbana', 'Arte Urbana'),
    'Cascatas e Poços Naturais': ('cascatas_pocos', 'Cascata/Poço'),
    'Termas e Banhos': ('termas_banhos', 'Termas'),
    'Agroturismo e Enoturismo': ('produtores_dop', 'Agroturismo'),
}

# Name column aliases per sheet type
NAME_ALIASES = [
    'nome', 'name', 'poi', 'nome / poi', 'nome do castelo', 'spot / praia',
    'espécie', 'produtor / poi', 'nome / miradouro', 'nome / obra',
    'nome / quinta', 'nome / linha', 'nome / sítio', 'nome da rota',
    'festa / romaria', 'etapa', 'nome do percurso', 'local / poi',
    'playlist / evento',
]

REGION_ALIASES = ['região', 'regiao', 'region']
ADDRESS_ALIASES = ['morada', 'morada / cidade', 'morada / partida', 'address', 'localidade', 'localização principal']
DESCRIPTION_ALIASES = ['descrição', 'descricao', 'notas', 'descrição cultural', 'nota de segurança']
GPS_ALIASES = ['gps (maps)', 'gps', 'gps habitat', 'coordenadas']
WEBSITE_ALIASES = ['website', 'site', 'url', 'web']

REGION_MAP = {
    'norte': 'norte', 'centro': 'centro', 'lisboa': 'lisboa',
    'alentejo': 'alentejo', 'algarve': 'algarve',
    'açores': 'acores', 'acores': 'acores',
    'madeira': 'madeira', 'nacional': 'portugal', 'sul': 'algarve',
    'lvt': 'lisboa',
}


def find_col(headers: List[str], aliases: List[str]) -> Optional[str]:
    """Find the first matching column from headers"""
    h_lower = {h.lower().strip(): h for h in headers}
    for a in aliases:
        if a.lower() in h_lower:
            return h_lower[a.lower()]
    # Partial match
    for a in aliases:
        for h, orig in h_lower.items():
            if a.lower() in h:
                return orig
    return None


def clean(val: Any) -> Optional[str]:
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    return s if s and s.lower() not in ('nan', 'n/a', 'none', '', 'n/d') else None


def map_region(r: str) -> str:
    r_lower = r.lower().strip()
    return REGION_MAP.get(r_lower, r_lower)


def try_parse_coords(val: str) -> Optional[Dict[str, float]]:
    if not val:
        return None
    match = re.search(r'(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)', val)
    if match:
        a, b = float(match.group(1)), float(match.group(2))
        if 32 <= a <= 43 and -32 <= b <= -6:
            return {"lat": a, "lng": b}
        if 32 <= b <= 43 and -32 <= a <= -6:
            return {"lat": b, "lng": a}
    return None


def detect_header_row(df: pd.DataFrame, sheet_name: str) -> int:
    """Find the actual header row in the dataframe"""
    # Barragens already has proper headers
    if 'Nome' in df.columns and 'Região' in df.columns:
        return -1  # Use existing columns

    for i in range(min(5, len(df))):
        vals = [str(v).strip().lower() for v in df.iloc[i].values if pd.notna(v)]
        joined = ' '.join(vals)
        if any(a in joined for a in ['nome', 'região', 'morada', 'espécie', 'spot', 'etapa', 'festa']):
            return i
    return 1  # Default to row 1


async def geocode(address: str, name: str, semaphore: asyncio.Semaphore) -> Optional[Dict[str, float]]:
    if not GOOGLE_API_KEY or not address:
        return None
    async with semaphore:
        query = f"{name}, {address}, Portugal"
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, params={"address": query, "key": GOOGLE_API_KEY})
                data = resp.json()
                if data.get("status") == "OK" and data.get("results"):
                    loc = data["results"][0]["geometry"]["location"]
                    lat, lng = loc["lat"], loc["lng"]
                    if 32 <= lat <= 43 and -32 <= lng <= -6:
                        return {"lat": lat, "lng": lng}
        except Exception as e:
            logger.warning(f"Geocoding failed: {e}")
    return None


def process_sheet(df: pd.DataFrame, sheet_name: str) -> List[Dict[str, Any]]:
    """Process a single sheet into a list of POI dicts"""
    header_row = detect_header_row(df, sheet_name)

    if header_row == -1:
        # Already has proper columns
        work_df = df.copy()
    else:
        # Set proper header and skip decorative rows
        work_df = df.iloc[header_row + 1:].copy()
        work_df.columns = [str(v).strip() if pd.notna(v) else f'col_{j}' for j, v in enumerate(df.iloc[header_row].values)]
        work_df = work_df.reset_index(drop=True)

    headers = list(work_df.columns)
    cat_default, subcat_default = SHEET_CATEGORY_MAP.get(sheet_name, ('outros', sheet_name))

    name_col = find_col(headers, NAME_ALIASES)
    region_col = find_col(headers, REGION_ALIASES)
    addr_col = find_col(headers, ADDRESS_ALIASES)
    desc_col = find_col(headers, DESCRIPTION_ALIASES)
    gps_col = find_col(headers, GPS_ALIASES)
    web_col = find_col(headers, WEBSITE_ALIASES)

    if not name_col:
        logger.warning(f"  ⚠ No name column found in '{sheet_name}': {headers[:8]}")
        return []

    pois = []
    for _, row in work_df.iterrows():
        name = clean(row.get(name_col, ''))
        if not name or len(name) < 2:
            continue

        # Skip section headers (🟦 NORTE, etc)
        if name.startswith('🟦') or name.startswith('🟧') or name.startswith('🟨') or name.startswith('🟩'):
            continue

        region = clean(row.get(region_col, '')) if region_col else None
        address = clean(row.get(addr_col, '')) if addr_col else None
        desc = clean(row.get(desc_col, '')) if desc_col else None
        gps_raw = clean(row.get(gps_col, '')) if gps_col else None
        website = clean(row.get(web_col, '')) if web_col else None

        # Handle Base de Dados POI with its own category
        if sheet_name == 'Base de Dados POI':
            cat_col = find_col(headers, ['categoria', 'category'])
            subcat_col = find_col(headers, ['subcategoria'])
            category_raw = clean(row.get(cat_col, '')) if cat_col else None
            subcategory = clean(row.get(subcat_col, '')) if subcat_col else None
            category = category_raw.lower() if category_raw else 'outros'
            # Map known categories
            cat_map = {
                'natureza': 'areas_protegidas', 'monumentos e património': 'arqueologia',
                'gastronomia': 'gastronomia', 'fauna': 'fauna', 'comércio': 'produtos',
                'bem-estar': 'termas', 'aventura': 'aventura', 'turismo rural': 'aldeias',
                'mobilidade': 'rotas', 'roteiro': 'rotas', 'agroturismo': 'produtos',
            }
            category = cat_map.get(category, category)
        else:
            category = cat_default or 'outros'
            subcategory = subcat_default

        # Try parse lat/lon if available (Barragens sheet has explicit columns)
        location = None
        lat_col = find_col(headers, ['lat', 'latitude'])
        lon_col = find_col(headers, ['lon', 'longitude', 'lng'])
        if lat_col and lon_col:
            try:
                lat_v = float(row.get(lat_col, 0))
                lng_v = float(row.get(lon_col, 0))
                if 32 <= lat_v <= 43 and -32 <= lng_v <= -6:
                    location = {"lat": lat_v, "lng": lng_v}
            except (ValueError, TypeError) as e:
                logger.warning(f"Could not parse coordinates: {e}")

        if not location and gps_raw:
            location = try_parse_coords(gps_raw)

        # Build metadata from extra columns
        metadata = {"sheet_source": sheet_name}
        if website:
            metadata["website"] = website

        # Collect extra fields
        known_cols = {name_col, region_col, addr_col, desc_col, gps_col, web_col}
        for h in headers:
            if h in known_cols or h.startswith('col_') or h.startswith('Unnamed'):
                continue
            val = clean(row.get(h, ''))
            if val and h.lower() not in ('🎨 prompt visual ia (2 imagens)', '#'):
                key = h.lower().replace(' ', '_').replace('/', '_')[:30]
                if len(val) < 200:
                    metadata[key] = val

        mapped_region = map_region(region) if region else 'portugal'

        tags = list(set(filter(None, [category, subcategory and subcategory.lower(), mapped_region])))

        pois.append({
            "id": str(uuid.uuid4()),
            "name": name,
            "description": desc or "",
            "category": category,
            "subcategory": subcategory,
            "category_original": sheet_name,
            "region": mapped_region,
            "region_original": region,
            "location": location or {},
            "address": address or "",
            "tags": tags,
            "metadata": metadata,
            "image_url": None,
            "created_at": datetime.now(timezone.utc),
            "source": "poi_v19_full",
            "import_batch": "v19_full",
            "needs_geocoding": location is None and bool(address),
        })

    return pois


async def main():
    logger.info(f"📂 Reading Excel: {EXCEL_PATH}")
    xl = pd.ExcelFile(EXCEL_PATH)
    logger.info(f"📊 Found {len(xl.sheet_names)} sheets")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    collection = db.heritage_items

    # Get existing names for dedup
    existing = await collection.find({}, {"name": 1, "_id": 0}).to_list(length=50000)
    existing_names = {d["name"].lower().strip() for d in existing if d.get("name")}
    logger.info(f"📋 Existing POIs in DB: {len(existing_names)}")

    all_pois = []
    sheet_stats = []

    for sheet_name in xl.sheet_names:
        if sheet_name in SKIP_SHEETS:
            logger.info(f"⏭  Skipping: {sheet_name}")
            continue

        df = pd.read_excel(xl, sheet_name=sheet_name)
        pois = process_sheet(df, sheet_name)

        # Deduplicate
        new_pois = []
        for p in pois:
            key = p["name"].lower().strip()
            if key not in existing_names:
                existing_names.add(key)
                new_pois.append(p)

        all_pois.extend(new_pois)
        dupes = len(pois) - len(new_pois)
        sheet_stats.append({"sheet": sheet_name, "parsed": len(pois), "new": len(new_pois), "dupes": dupes})
        logger.info(f"  ✅ {sheet_name}: {len(pois)} parsed, {len(new_pois)} new, {dupes} duplicates")

    logger.info(f"\n📊 TOTAL: {len(all_pois)} new POIs to import")

    # Insert in batches
    if all_pois:
        batch_size = 100
        for i in range(0, len(all_pois), batch_size):
            batch = all_pois[i:i + batch_size]
            await collection.insert_many(batch)
            logger.info(f"  💾 Inserted batch {i // batch_size + 1}: {len(batch)} POIs")

    # Geocoding for POIs without coordinates
    needs_geo = [p for p in all_pois if p.get("needs_geocoding")]
    logger.info(f"\n🌍 Geocoding {len(needs_geo)} POIs...")

    semaphore = asyncio.Semaphore(5)  # Max 5 concurrent requests
    geocoded_count = 0
    batch_size = 20

    for i in range(0, len(needs_geo), batch_size):
        batch = needs_geo[i:i + batch_size]
        tasks = [geocode(p["address"], p["name"], semaphore) for p in batch]
        results = await asyncio.gather(*tasks)

        for poi, location in zip(batch, results):
            if location:
                await collection.update_one(
                    {"id": poi["id"]},
                    {"$set": {"location": location, "needs_geocoding": False}}
                )
                geocoded_count += 1

        logger.info(f"  🌍 Geocoded batch {i // batch_size + 1}: {sum(1 for r in results if r)}/{len(batch)}")
        await asyncio.sleep(0.2)  # Rate limit

    # Clean up needs_geocoding field
    await collection.update_many(
        {"needs_geocoding": {"$exists": True}},
        {"$unset": {"needs_geocoding": ""}}
    )

    # Final stats
    total = await collection.count_documents({})
    with_coords = await collection.count_documents({"location.lat": {"$exists": True}})

    logger.info(f"\n{'='*60}")
    logger.info("📊 IMPORT COMPLETE")
    logger.info(f"  Total POIs in DB: {total}")
    logger.info(f"  New POIs imported: {len(all_pois)}")
    logger.info(f"  Geocoded: {geocoded_count}")
    logger.info(f"  With coordinates: {with_coords}")
    logger.info(f"{'='*60}")

    for s in sheet_stats:
        logger.info(f"  {s['new']:>4} new | {s['dupes']:>3} dupes | {s['sheet']}")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
