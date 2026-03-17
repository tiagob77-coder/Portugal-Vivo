"""
Import PortugalVivo_BaseDados_POI_v19.xlsx - Final Smart Import v3
Correctly parses Excel structure with proper column mapping
"""
import asyncio
import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid
import os
import re
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Sheet configurations: (category, name_col_idx, desc_col_idx, region_col_idx, other_cols)
SHEET_CONFIG = {
    'Percursos Pedestres': ('percursos', 1, 9, 2, {'distance': 3, 'duration': 4, 'difficulty': 5, 'type': 6, 'altitude': 7, 'season': 8, 'address': 11}),
    'Praias Fluviais': ('piscinas', 1, 6, 2, {'services': 3, 'type': 4, 'water': 5, 'address': 8}),
    'Termas e Banhos': ('termas', 1, 6, 2, {'type': 3, 'services': 4, 'temperature': 5, 'address': 8}),
    'Cascatas e Poços Naturais': ('cascatas', 1, 6, 2, {'type': 3, 'access': 4, 'height': 5, 'address': 8}),
    'Miradouros Portugal': ('miradouros', 1, 5, 2, {'type': 3, 'view': 4, 'address': 7}),
    'Castelos': ('arqueologia', 1, 6, 2, {'period': 3, 'type': 4, 'state': 5, 'address': 8}),
    'Palácios e Solares': ('arqueologia', 1, 6, 2, {'period': 3, 'style': 4, 'state': 5, 'address': 8}),
    'Museus': ('arte', 1, 6, 2, {'type': 3, 'collection': 4, 'hours': 5, 'address': 8}),
    'Tabernas Históricas': ('gastronomia', 1, 6, 2, {'specialty': 3, 'founded': 4, 'address': 8}),
    'Restaurantes e Gastronomia': ('gastronomia', 1, 6, 2, {'specialty': 3, 'price': 4, 'address': 8}),
    'Mercados e Feiras': ('gastronomia', 1, 6, 2, {'type': 3, 'schedule': 4, 'address': 8}),
    '🧀 Produtores DOP e Locais': ('produtos', 1, 6, 2, {'product': 3, 'certification': 4, 'address': 8}),
    'Festas e Romarias': ('festas', 1, 6, 2, {'date': 3, 'type': 4, 'tradition': 5, 'address': 8}),
    '🎪 Festivais de Música': ('festas', 1, 6, 2, {'date': 3, 'genre': 4, 'venue': 5, 'address': 7}),
    'Aventura e Natureza': ('aventura', 1, 6, 2, {'activity': 3, 'difficulty': 4, 'address': 7}),
    'Natureza Especializada': ('areas_protegidas', 1, 6, 2, {'type': 3, 'species': 4, 'address': 7}),
    'Surf': ('aventura', 1, 6, 2, {'wave': 3, 'level': 4, 'season': 5}),
    'Ecovias e Passadiços': ('percursos', 1, 6, 2, {'distance': 3, 'type': 4, 'access': 5, 'address': 8}),
    'Praias Bandeira Azul': ('piscinas', 1, 5, 2, {'type': 3, 'services': 4, 'address': 7}),
    'Património Ferroviário': ('arqueologia', 1, 6, 2, {'line': 3, 'period': 4, 'state': 5, 'address': 8}),
    'Arte Urbana e Intervenção': ('arte', 1, 5, 2, {'artist': 3, 'year': 4, 'address': 7}),
    'Moinhos e Azenhas': ('saberes', 1, 5, 2, {'type': 3, 'state': 4, 'address': 7}),
    'Arqueologia, Geologia e Mineral': ('arqueologia', 1, 5, 2, {'type': 3, 'period': 4, 'address': 7}),
    'Parques de Campismo': ('aventura', 1, 6, 2, {'type': 3, 'services': 4, 'price': 5, 'address': 8}),
    'Pousadas de Juventude': ('aventura', 1, 6, 2, {'capacity': 3, 'services': 4, 'price': 5, 'address': 8}),
    'Flora Autóctone': ('areas_protegidas', 1, 5, 2, {'scientific': 3, 'habitat': 4}),
    'Fauna Autóctone': ('areas_protegidas', 1, 5, 2, {'scientific': 3, 'habitat': 4}),
    'Flora Botânica': ('areas_protegidas', 1, 5, 2, {'scientific': 3, 'type': 4}),
    'Biodiversidade | Avistamentos': ('areas_protegidas', 1, 6, 2, {'species': 3, 'season': 4, 'location': 5}),
    '🌊 Barragens e Albufeiras': ('piscinas', 1, 6, 2, {'river': 3, 'capacity': 4, 'activities': 5}),
    'Ofícios e Artesanato': ('saberes', 1, 5, 2, {'craft': 3, 'tradition': 4}),
    'Faróis': ('miradouros', 1, None, None, {}),
    'Alojamentos Rurais': ('aldeias', 1, 6, 2, {'type': 3, 'capacity': 4, 'price': 5, 'address': 8}),
    'Agroturismo e Enoturismo': ('gastronomia', 1, 6, 2, {'type': 3, 'product': 4, 'address': 7}),
    '💎 Pérolas de Portugal': ('aldeias', 1, 6, 2, {'type': 3, 'highlight': 4, 'address': 8}),
    'Pratos Típicos': ('gastronomia', 1, 5, 2, {'ingredients': 3, 'origin': 4}),
    '🍬 Doçaria Regional': ('gastronomia', 1, 5, 2, {'origin': 3, 'ingredients': 4}),
    'Sopas Típicas': ('gastronomia', 1, 5, 2, {'ingredients': 3, 'origin': 4}),
    'Rotas Temáticas': ('rotas', 1, 3, 2, {'theme': 4, 'duration': 5}),
}

# Region mapping
REGION_MAP = {
    'norte': 'norte', 'minho': 'norte', 'douro': 'norte', 'trás-os-montes': 'norte',
    'viana': 'norte', 'braga': 'norte', 'porto': 'norte', 'vila real': 'norte', 'bragança': 'norte',
    'centro': 'centro', 'beira': 'centro', 'aveiro': 'centro', 'viseu': 'centro',
    'guarda': 'centro', 'coimbra': 'centro', 'leiria': 'centro', 'castelo branco': 'centro',
    'lisboa': 'lisboa', 'setúbal': 'lisboa', 'santarém': 'lisboa', 'ribatejo': 'lisboa',
    'alentejo': 'alentejo', 'portalegre': 'alentejo', 'évora': 'alentejo', 'beja': 'alentejo',
    'algarve': 'algarve', 'faro': 'algarve', 'lagos': 'algarve', 'portimão': 'algarve',
    'açores': 'acores', 'acores': 'acores', 'ponta delgada': 'acores', 'angra': 'acores',
    'madeira': 'madeira', 'funchal': 'madeira',
}

def get_region(text):
    """Extract region from text"""
    if not text or pd.isna(text):
        return 'centro'
    text_lower = str(text).lower()
    for key, region in REGION_MAP.items():
        if key in text_lower:
            return region
    return 'centro'

def is_valid_name(name):
    """Check if name is valid (not a header or number)"""
    if not name or pd.isna(name):
        return False
    name_str = str(name).strip()

    # Skip empty or too short
    if len(name_str) < 3:
        return False

    # Skip numbers only
    if re.match(r'^[\d\s\.]+$', name_str):
        return False

    # Skip header patterns
    skip_patterns = [
        r'^#$', r'^nome$', r'^região$', r'^descrição$',
        r'norte\s*·\s*centro', r'\d+\s*(entradas|pratos|percursos|locais)',
        r'^🟦', r'^🟧', r'^🟫', r'^🟪', r'^🔵',
    ]
    for pattern in skip_patterns:
        if re.search(pattern, name_str.lower()):
            return False

    return True

def clean_text(val):
    """Clean text value"""
    if pd.isna(val) or val is None:
        return ''
    return str(val).strip()

async def import_sheet(sheet_name, df, config):
    """Import a sheet with specific column configuration"""
    category, name_idx, desc_idx, region_idx, other_cols = config
    pois = []

    for idx, row in df.iterrows():
        # Skip first few header rows
        if idx < 3:
            continue

        # Get name
        name = clean_text(row.iloc[name_idx]) if name_idx < len(row) else ''

        if not is_valid_name(name):
            continue

        # Get description
        description = ''
        if desc_idx and desc_idx < len(row):
            description = clean_text(row.iloc[desc_idx])

        # Get region
        region = 'centro'
        if region_idx and region_idx < len(row):
            region_text = clean_text(row.iloc[region_idx])
            region = get_region(region_text)
        if region == 'centro' and description:
            region = get_region(description)

        # Get other fields as metadata
        metadata = {}
        for field_name, col_idx in other_cols.items():
            if col_idx < len(row):
                val = clean_text(row.iloc[col_idx])
                if val:
                    metadata[field_name] = val

        # Create POI
        poi_id = f"v19_{category}_{str(uuid.uuid4())[:8]}"

        poi = {
            'id': poi_id,
            'name': name[:300],
            'description': description[:2000] if description else name,
            'category': category,
            'region': region,
            'location': None,  # Will be enriched later
            'source': 'excel_v19',
            'sheet': sheet_name,
            'tags': [category],
            'metadata': metadata,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
        }

        pois.append(poi)

    return pois

async def import_routes(df):
    """Import routes"""
    routes = []

    for idx, row in df.iterrows():
        if idx < 3:
            continue

        name = clean_text(row.iloc[1]) if len(row) > 1 else ''

        if not is_valid_name(name):
            continue

        # Build description
        description = ''
        if len(row) > 3:
            description = clean_text(row.iloc[3])

        route_id = f"rota_v19_{str(uuid.uuid4())[:8]}"

        route = {
            'id': route_id,
            'name': name[:300],
            'description': description[:1000] if description else name,
            'category': 'rotas',
            'region': get_region(description or name),
            'items': [],
            'duration_hours': 4,
            'difficulty': 'moderate',
            'source': 'excel_v19',
            'created_at': datetime.now(timezone.utc),
        }

        routes.append(route)

    return routes

async def main():
    print("=" * 60)
    print("📥 IMPORTAÇÃO FINAL v3 - PortugalVivo v19")
    print("=" * 60)

    excel_path = '/tmp/PortugalVivo_POI_v19.xlsx'
    xl = pd.ExcelFile(excel_path)

    total_pois = 0
    total_routes = 0

    # Clear previous v19 imports
    await db.heritage_items.delete_many({'source': 'excel_v19'})
    await db.routes.delete_many({'source': 'excel_v19'})
    print("✅ Dados v19 anteriores removidos")

    print("\n📋 Importando folhas...")

    for sheet_name in xl.sheet_names:
        if sheet_name not in SHEET_CONFIG:
            print(f"  ⏭ Ignorando: {sheet_name}")
            continue

        config = SHEET_CONFIG[sheet_name]

        try:
            df = pd.read_excel(xl, sheet_name=sheet_name, header=None)

            if sheet_name == 'Rotas Temáticas':
                routes = await import_routes(df)
                if routes:
                    await db.routes.insert_many(routes)
                    total_routes += len(routes)
                    print(f"  ✅ {sheet_name}: {len(routes)} rotas")
                else:
                    print(f"  ⚠️ {sheet_name}: 0 rotas")
            else:
                pois = await import_sheet(sheet_name, df, config)
                if pois:
                    await db.heritage_items.insert_many(pois)
                    total_pois += len(pois)
                    print(f"  ✅ {sheet_name}: {len(pois)} POIs ({config[0]})")
                else:
                    print(f"  ⚠️ {sheet_name}: 0 POIs")
        except Exception as e:
            print(f"  ❌ {sheet_name}: Erro - {str(e)[:80]}")

    # Final counts
    final_pois = await db.heritage_items.count_documents({})
    final_routes = await db.routes.count_documents({})

    print("\n" + "=" * 60)
    print("📊 RESUMO FINAL")
    print("=" * 60)
    print(f"  ✅ POIs importados: {total_pois}")
    print(f"  ✅ Rotas importadas: {total_routes}")
    print(f"  📦 Total: {final_pois} POIs, {final_routes} rotas")
    print("=" * 60)

    # Stats by category
    print("\n📈 Por Categoria:")
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    async for doc in db.heritage_items.aggregate(pipeline):
        print(f"  • {doc['_id']}: {doc['count']}")

    # Stats by region
    print("\n🗺 Por Região:")
    pipeline = [
        {"$group": {"_id": "$region", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    async for doc in db.heritage_items.aggregate(pipeline):
        print(f"  • {doc['_id']}: {doc['count']}")

if __name__ == "__main__":
    asyncio.run(main())
