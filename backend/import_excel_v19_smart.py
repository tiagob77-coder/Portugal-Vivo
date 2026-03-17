"""
Import PortugalVivo_BaseDados_POI_v19.xlsx - Smart Import Script v2
Imports all POIs and Routes from Excel to MongoDB with better filtering
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

# Region mapping
REGION_MAP = {
    'viana do castelo': 'norte', 'braga': 'norte', 'porto': 'norte',
    'vila real': 'norte', 'bragança': 'norte', 'braganca': 'norte',
    'aveiro': 'centro', 'viseu': 'centro', 'guarda': 'centro',
    'coimbra': 'centro', 'leiria': 'centro', 'castelo branco': 'centro',
    'lisboa': 'lisboa', 'setúbal': 'lisboa', 'setubal': 'lisboa', 'santarém': 'lisboa',
    'portalegre': 'alentejo', 'évora': 'alentejo', 'evora': 'alentejo', 'beja': 'alentejo',
    'faro': 'algarve', 'portimão': 'algarve', 'lagos': 'algarve', 'tavira': 'algarve',
    'açores': 'acores', 'ponta delgada': 'acores', 'angra': 'acores', 'horta': 'acores',
    'madeira': 'madeira', 'funchal': 'madeira',
    'minho': 'norte', 'douro': 'norte', 'trás-os-montes': 'norte',
    'beira': 'centro', 'ribatejo': 'lisboa',
}

def is_header_row(name):
    """Check if this is a header row to skip"""
    if not name:
        return True
    name_lower = str(name).lower().strip()

    # Skip patterns
    skip_patterns = [
        r'^[0-9]+$',  # Only numbers
        r'^#',  # Starts with #
        r'^🟦', r'^🟧', r'^🟫', r'^🟪', r'^🔵',  # Region header emojis
        r'norte\s*·\s*centro',  # Multi-region header
        r'\d+\s*pratos',  # "35 pratos"
        r'\d+\s*entradas',  # "174 entradas"
        r'\d+\s*locais',  # "11 locais"
        r'gastronomia\s*regional',
        r'rotas\s*culturais',
        r'^total$',
        r'^nome$',
        r'^categoria$',
    ]

    for pattern in skip_patterns:
        if re.search(pattern, name_lower):
            return True

    # Skip if name is too short
    if len(name.strip()) < 3:
        return True

    return False

def get_region(text):
    """Extract region from text"""
    if not text or pd.isna(text):
        return 'centro'
    text_lower = str(text).lower()
    for key, region in REGION_MAP.items():
        if key in text_lower:
            return region
    return 'centro'

def parse_gps(row, columns):
    """Parse GPS coordinates from row"""
    gps_cols = ['gps', 'coordenadas', 'lat', 'latitude', 'coords', 'localização gps']
    lng_cols = ['lng', 'longitude', 'long']

    lat = None
    lng = None

    # First try combined GPS field
    for col_lower, col in columns.items():
        if any(gc in col_lower for gc in gps_cols):
            val = row.get(col)
            if val and not pd.isna(val):
                val_str = str(val).strip()
                # Try to parse "lat, lng" format
                match = re.search(r'(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)', val_str)
                if match:
                    try:
                        lat = float(match.group(1))
                        lng = float(match.group(2))
                        if -90 <= lat <= 90 and -180 <= lng <= 180:
                            return {'lat': lat, 'lng': lng}
                    except (ValueError, TypeError, IndexError):
                        pass

    # Try separate lat/lng columns
    for col_lower, col in columns.items():
        if 'lat' in col_lower and lat is None:
            val = row.get(col)
            if val and not pd.isna(val):
                try:
                    lat = float(val)
                except (ValueError, TypeError):
                    pass
        if any(lc in col_lower for lc in lng_cols) and lng is None:
            val = row.get(col)
            if val and not pd.isna(val):
                try:
                    lng = float(val)
                except (ValueError, TypeError):
                    pass

    if lat is not None and lng is not None:
        if -90 <= lat <= 90 and -180 <= lng <= 180:
            return {'lat': lat, 'lng': lng}

    return None

def clean_text(text):
    """Clean text field"""
    if pd.isna(text) or text is None:
        return ''
    return str(text).strip()

async def import_sheet(sheet_name, df, category_id):
    """Import a single sheet as POIs"""
    pois = []

    # Build column mapping
    columns = {c.lower(): c for c in df.columns}

    # Find key columns
    name_cols = ['nome', 'name', 'título', 'titulo', 'local', 'designação', 'nome do prato', 'nome do doce', 'nome da festa', 'percurso', 'praia', 'mercado', 'museu', 'castelo', 'palácio']
    desc_cols = ['descrição', 'descricao', 'description', 'dica', 'notas', 'observações', 'caracterização']
    region_cols = ['região', 'regiao', 'distrito', 'concelho', 'localização', 'zona']

    name_col = None
    desc_col = None
    region_col = None

    for col in name_cols:
        if col in columns:
            name_col = columns[col]
            break

    for col in desc_cols:
        if col in columns:
            desc_col = columns[col]
            break

    for col in region_cols:
        if col in columns:
            region_col = columns[col]
            break

    if not name_col:
        name_col = df.columns[0]

    if not desc_col and len(df.columns) > 1:
        # Use second non-name column
        for col in df.columns[1:]:
            if col != name_col:
                desc_col = col
                break

    for idx, row in df.iterrows():
        name = clean_text(row.get(name_col, ''))

        # Skip header rows
        if is_header_row(name):
            continue

        description = clean_text(row.get(desc_col, '')) if desc_col else ''

        # Get GPS
        location = parse_gps(row, columns)

        # Get region
        region = 'centro'
        if region_col:
            region = get_region(row.get(region_col))
        elif description:
            region = get_region(description)
        elif name:
            region = get_region(name)

        # Create POI
        poi_id = f"v19_{category_id}_{str(uuid.uuid4())[:8]}"

        # Collect metadata
        metadata = {}
        skip_cols = [name_col, desc_col, region_col] if region_col else [name_col, desc_col]
        for col in df.columns:
            if col not in skip_cols:
                val = row.get(col)
                if not pd.isna(val) and val and str(val).strip():
                    metadata[col] = str(val).strip()

        poi = {
            'id': poi_id,
            'name': name[:200],
            'description': description[:2000] if description else f'{name}',
            'category': category_id,
            'region': region,
            'location': location,
            'source': 'excel_v19',
            'sheet': sheet_name,
            'tags': [category_id],
            'metadata': metadata,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc),
        }

        pois.append(poi)

    return pois

async def import_routes(df):
    """Import routes from Rotas Temáticas sheet"""
    routes = []

    for idx, row in df.iterrows():
        name = clean_text(row.get(df.columns[0], ''))

        if is_header_row(name):
            continue

        # Build description from other columns
        description = ''
        for col in df.columns[1:5]:
            val = row.get(col)
            if not pd.isna(val) and val:
                description += str(val) + ' '

        route_id = f"rota_v19_{str(uuid.uuid4())[:8]}"

        route = {
            'id': route_id,
            'name': name[:200],
            'description': description.strip()[:1000],
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
    print("📥 IMPORTAÇÃO v2 - PortugalVivo v19")
    print("=" * 60)

    excel_path = '/tmp/PortugalVivo_POI_v19.xlsx'
    xl = pd.ExcelFile(excel_path)

    total_pois = 0
    total_routes = 0

    # Sheets to skip
    skip_sheets = [
        '📊 Dashboard', '🎵 Música Tradicional', '🗺 Guia do Viajante',
        '🚌 Transportes', 'Categorias', 'Base de Dados POI',
        'Grande Expedição 2026', 'Entidades e Operadores', 'Agentes Turísticos'
    ]

    print("\n📋 Processando folhas...")

    for sheet_name in xl.sheet_names:
        if sheet_name in skip_sheets:
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
                    print(f"  ✅ {sheet_name}: {len(routes)} rotas")
            else:
                pois = await import_sheet(sheet_name, df, category_id)
                if pois:
                    await db.heritage_items.insert_many(pois)
                    total_pois += len(pois)
                    print(f"  ✅ {sheet_name}: {len(pois)} POIs ({category_id})")
                else:
                    print(f"  ⚠️ {sheet_name}: 0 POIs válidos")
        except Exception as e:
            print(f"  ❌ {sheet_name}: Erro - {str(e)[:80]}")

    # Final counts
    final_pois = await db.heritage_items.count_documents({})
    final_routes = await db.routes.count_documents({})

    print("\n" + "=" * 60)
    print("📊 RESUMO")
    print("=" * 60)
    print(f"  ✅ POIs importados: {total_pois}")
    print(f"  ✅ Rotas importadas: {total_routes}")
    print(f"  📦 Total na BD: {final_pois} POIs, {final_routes} rotas")
    print("=" * 60)

    # Stats by category
    print("\n📈 Por Categoria:")
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    async for doc in db.heritage_items.aggregate(pipeline):
        print(f"  • {doc['_id']}: {doc['count']}")

if __name__ == "__main__":
    asyncio.run(main())
