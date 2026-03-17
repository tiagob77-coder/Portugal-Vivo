"""
Import PortugalVivo_BaseDados_POI_v19.xlsx - Full Import Script
Imports all POIs and Routes from Excel to MongoDB
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

# Category mapping from sheet names to category IDs
SHEET_TO_CATEGORY = {
    'Percursos Pedestres': 'percursos',
    'Praias Fluviais': 'piscinas',
    'Termas e Banhos': 'termas',
    'Cascatas e Poços Naturais': 'cascatas',
    'Miradouros Portugal': 'miradouros',
    'Castelos': 'arqueologia',
    'Palácios e Solares': 'arqueologia',
    'Museus': 'arte',
    'Tabernas Históricas': 'gastronomia',
    'Restaurantes e Gastronomia': 'gastronomia',
    'Mercados e Feiras': 'gastronomia',
    '🧀 Produtores DOP e Locais': 'produtos',
    'Festas e Romarias': 'festas',
    '🎪 Festivais de Música': 'festas',
    'Aventura e Natureza': 'aventura',
    'Natureza Especializada': 'areas_protegidas',
    'Surf': 'aventura',
    'Ecovias e Passadiços': 'percursos',
    'Praias Bandeira Azul': 'piscinas',
    'Património Ferroviário': 'arqueologia',
    'Arte Urbana e Intervenção': 'arte',
    'Moinhos e Azenhas': 'saberes',
    'Arqueologia, Geologia e Mineral': 'arqueologia',
    'Parques de Campismo': 'aventura',
    'Pousadas de Juventude': 'aventura',
    'Flora Autóctone': 'areas_protegidas',
    'Fauna Autóctone': 'areas_protegidas',
    'Flora Botânica': 'areas_protegidas',
    'Biodiversidade | Avistamentos': 'areas_protegidas',
    '🌊 Barragens e Albufeiras': 'piscinas',
    'Ofícios e Artesanato': 'saberes',
    'Faróis': 'miradouros',
    'Alojamentos Rurais': 'aldeias',
    'Agroturismo e Enoturismo': 'gastronomia',
    '💎 Pérolas de Portugal': 'aldeias',
    'Sopas Típicas': 'gastronomia',
    'Pratos Típicos': 'gastronomia',
    '🍬 Doçaria Regional': 'gastronomia',
    'Rotas Temáticas': 'rotas',
}

# Region mapping from district/municipality names
REGION_MAP = {
    'viana do castelo': 'norte', 'braga': 'norte', 'porto': 'norte',
    'vila real': 'norte', 'bragança': 'norte', 'braganca': 'norte',
    'aveiro': 'centro', 'viseu': 'centro', 'guarda': 'centro',
    'coimbra': 'centro', 'leiria': 'centro', 'castelo branco': 'centro',
    'lisboa': 'lisboa', 'setúbal': 'lisboa', 'setubal': 'lisboa', 'santarém': 'lisboa', 'santarem': 'lisboa',
    'portalegre': 'alentejo', 'évora': 'alentejo', 'evora': 'alentejo', 'beja': 'alentejo',
    'faro': 'algarve',
    'açores': 'acores', 'acores': 'acores', 'ponta delgada': 'acores', 'angra': 'acores', 'horta': 'acores',
    'madeira': 'madeira', 'funchal': 'madeira',
    'minho': 'norte', 'douro': 'norte', 'trás-os-montes': 'norte', 'tras-os-montes': 'norte',
    'beira': 'centro', 'ribatejo': 'lisboa',
    'alentejo': 'alentejo', 'algarve': 'algarve',
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

def parse_gps(gps_str):
    """Parse GPS coordinates from string"""
    if not gps_str or pd.isna(gps_str):
        return None

    gps_str = str(gps_str).strip()

    # Try different patterns
    patterns = [
        r'(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)',  # 41.123, -8.456
        r'(\d+\.\d+)',  # Single number (might be just lat)
    ]

    for pattern in patterns:
        match = re.search(pattern, gps_str)
        if match:
            groups = match.groups()
            if len(groups) >= 2:
                try:
                    lat = float(groups[0])
                    lng = float(groups[1])
                    if -90 <= lat <= 90 and -180 <= lng <= 180:
                        return {'lat': lat, 'lng': lng}
                except (ValueError, TypeError, IndexError):
                    pass
    return None

def clean_text(text):
    """Clean text field"""
    if pd.isna(text) or text is None:
        return ''
    return str(text).strip()

async def import_sheet(sheet_name, df, category_id):
    """Import a single sheet as POIs"""
    pois = []

    # Find column names (case insensitive)
    columns = {c.lower(): c for c in df.columns}

    name_cols = ['nome', 'name', 'título', 'titulo', 'local', 'designação']
    desc_cols = ['descrição', 'descricao', 'description', 'dica', 'notas', 'observações']
    gps_cols = ['gps', 'coordenadas', 'lat', 'latitude', 'coords']
    region_cols = ['região', 'regiao', 'distrito', 'concelho', 'localização', 'localizacao']

    name_col = None
    desc_col = None
    gps_col = None
    region_col = None

    for col in name_cols:
        if col in columns:
            name_col = columns[col]
            break

    for col in desc_cols:
        if col in columns:
            desc_col = columns[col]
            break

    for col in gps_cols:
        if col in columns:
            gps_col = columns[col]
            break

    for col in region_cols:
        if col in columns:
            region_col = columns[col]
            break

    if not name_col:
        # Use first column as name
        name_col = df.columns[0]

    if not desc_col and len(df.columns) > 1:
        desc_col = df.columns[1]

    for idx, row in df.iterrows():
        name = clean_text(row.get(name_col, ''))
        if not name or len(name) < 2:
            continue

        description = clean_text(row.get(desc_col, '')) if desc_col else ''

        # Get GPS
        location = None
        if gps_col:
            location = parse_gps(row.get(gps_col))

        # Get region
        region = 'centro'
        if region_col:
            region = get_region(row.get(region_col))
        elif description:
            region = get_region(description)

        # Create POI
        poi_id = f"v19_{category_id}_{str(uuid.uuid4())[:8]}"

        # Collect all other fields as metadata
        metadata = {}
        for col in df.columns:
            if col not in [name_col, desc_col, gps_col, region_col]:
                val = row.get(col)
                if not pd.isna(val) and val:
                    metadata[col] = str(val)

        poi = {
            'id': poi_id,
            'name': name,
            'description': description[:2000] if description else f'{name} - {sheet_name}',
            'category': category_id,
            'region': region,
            'location': location,
            'source': 'excel_v19',
            'sheet': sheet_name,
            'tags': [category_id, sheet_name.replace('🎪', '').replace('🧀', '').replace('🌊', '').replace('🍬', '').replace('💎', '').strip()],
            'metadata': metadata,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
        }

        pois.append(poi)

    return pois

async def import_routes(df):
    """Import routes from Rotas Temáticas sheet"""
    routes = []

    columns = {c.lower(): c for c in df.columns}

    for idx, row in df.iterrows():
        name = clean_text(row.get(df.columns[0], ''))
        if not name or len(name) < 3:
            continue

        description = ''
        for col in df.columns[1:4]:
            val = row.get(col)
            if not pd.isna(val):
                description += str(val) + ' '

        route_id = f"rota_v19_{str(uuid.uuid4())[:8]}"

        route = {
            'id': route_id,
            'name': name,
            'description': description.strip()[:1000],
            'category': 'rotas',
            'region': get_region(description),
            'items': [],  # Will be populated later
            'duration_hours': 4,
            'difficulty': 'moderate',
            'source': 'excel_v19',
            'created_at': datetime.now(timezone.utc),
        }

        routes.append(route)

    return routes

async def main():
    print("=" * 60)
    print("📥 IMPORTAÇÃO COMPLETA - PortugalVivo v19")
    print("=" * 60)

    # Load Excel file
    excel_path = '/tmp/PortugalVivo_POI_v19.xlsx'
    xl = pd.ExcelFile(excel_path)

    total_pois = 0
    total_routes = 0

    # Clear existing v19 data (optional - comment out to keep old data)
    # await db.heritage_items.delete_many({'source': 'excel_v19'})
    # await db.routes.delete_many({'source': 'excel_v19'})

    print("\n📋 Processando folhas...")

    for sheet_name in xl.sheet_names:
        if sheet_name in ['📊 Dashboard', '🎵 Música Tradicional', '🗺 Guia do Viajante', '🚌 Transportes', 'Categorias', 'Base de Dados POI', 'Grande Expedição 2026', 'Entidades e Operadores', 'Agentes Turísticos']:
            print(f"  ⏭ Ignorando: {sheet_name}")
            continue

        category_id = SHEET_TO_CATEGORY.get(sheet_name, 'outros')

        try:
            df = pd.read_excel(xl, sheet_name=sheet_name)

            if sheet_name == 'Rotas Temáticas':
                routes = await import_routes(df)
                if routes:
                    await db.routes.insert_many(routes)
                    total_routes += len(routes)
                    print(f"  ✅ {sheet_name}: {len(routes)} rotas importadas")
            else:
                pois = await import_sheet(sheet_name, df, category_id)
                if pois:
                    await db.heritage_items.insert_many(pois)
                    total_pois += len(pois)
                    print(f"  ✅ {sheet_name}: {len(pois)} POIs ({category_id})")
                else:
                    print(f"  ⚠️ {sheet_name}: 0 POIs válidos")
        except Exception as e:
            print(f"  ❌ {sheet_name}: Erro - {str(e)[:50]}")

    # Get final counts
    final_poi_count = await db.heritage_items.count_documents({})
    final_route_count = await db.routes.count_documents({})

    print("\n" + "=" * 60)
    print("📊 RESUMO DA IMPORTAÇÃO")
    print("=" * 60)
    print(f"  ✅ POIs importados nesta sessão: {total_pois}")
    print(f"  ✅ Rotas importadas nesta sessão: {total_routes}")
    print(f"  📦 Total POIs na base de dados: {final_poi_count}")
    print(f"  🗺 Total Rotas na base de dados: {final_route_count}")
    print("=" * 60)

    # Stats by category
    print("\n📈 POIs por Categoria:")
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    async for doc in db.heritage_items.aggregate(pipeline):
        print(f"  • {doc['_id']}: {doc['count']}")

    print("\n✅ Importação concluída!")

if __name__ == "__main__":
    asyncio.run(main())
