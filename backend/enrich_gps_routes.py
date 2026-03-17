"""
GPS Enrichment & Route Linking Script
Enriches POIs with GPS coordinates and links them to thematic routes
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Known locations in Portugal with coordinates
KNOWN_LOCATIONS = {
    # Distritos e principais cidades
    'lisboa': (38.7223, -9.1393),
    'porto': (41.1579, -8.6291),
    'braga': (41.5518, -8.4229),
    'coimbra': (40.2033, -8.4103),
    'faro': (37.0194, -7.9322),
    'évora': (38.5719, -7.9097),
    'aveiro': (40.6405, -8.6538),
    'viseu': (40.6566, -7.9125),
    'guarda': (40.5373, -7.2676),
    'leiria': (39.7436, -8.8071),
    'setúbal': (38.5244, -8.8882),
    'santarém': (39.2369, -8.6870),
    'beja': (38.0154, -7.8631),
    'portalegre': (39.2967, -7.4307),
    'castelo branco': (39.8197, -7.4931),
    'bragança': (41.8057, -6.7589),
    'vila real': (41.2959, -7.7461),
    'viana do castelo': (41.6931, -8.8328),
    'funchal': (32.6669, -16.9241),
    'ponta delgada': (37.7394, -25.6687),

    # Parques e áreas naturais
    'peneda-gerês': (41.7500, -8.1500),
    'gerês': (41.7228, -8.1542),
    'sintra': (38.7979, -9.3901),
    'arrábida': (38.4833, -8.9833),
    'serra da estrela': (40.3211, -7.6119),
    'douro': (41.1621, -7.7889),
    'alentejo': (38.5, -7.9),
    'algarve': (37.0, -8.0),

    # Aldeias históricas
    'monsanto': (40.0389, -7.1147),
    'marvão': (39.3936, -7.3764),
    'óbidos': (39.3622, -9.1569),
    'monsaraz': (38.4431, -7.3803),
    'piódão': (40.2286, -7.8308),
    'sortelha': (40.3536, -7.2117),
    'castelo rodrigo': (40.8778, -6.9639),
    'idanha-a-velha': (39.9967, -7.1458),
    'linhares da beira': (40.5333, -7.4583),
    'trancoso': (40.7792, -7.3486),
    'marialva': (40.9133, -7.2325),
    'belmonte': (40.3569, -7.3486),

    # Praias e costa
    'nazaré': (39.6021, -9.0710),
    'ericeira': (38.9631, -9.4175),
    'peniche': (39.3563, -9.3810),
    'cascais': (38.6979, -9.4215),
    'lagos': (37.1028, -8.6731),
    'sagres': (37.0086, -8.9403),
    'tavira': (37.1269, -7.6506),

    # Açores
    'são miguel': (37.7833, -25.5833),
    'terceira': (38.7167, -27.2167),
    'faial': (38.5667, -28.7167),
    'pico': (38.4667, -28.3333),
    'flores': (39.4500, -31.2000),
    'furnas': (37.7689, -25.3020),
    'sete cidades': (37.8500, -25.7833),

    # Madeira
    'madeira': (32.7500, -16.9500),
    'porto santo': (33.0500, -16.3500),
    'santana': (32.8000, -16.8833),

    # Termas
    'chaves': (41.7400, -7.4708),
    'vidago': (41.6333, -7.5667),
    'pedras salgadas': (41.5333, -7.5833),
    'caldas da rainha': (39.4042, -9.1375),
    'monchique': (37.3167, -8.5500),

    # Outras localidades
    'guimarães': (41.4425, -8.2918),
    'tomar': (39.6022, -8.4092),
    'batalha': (39.6600, -8.8250),
    'alcobaça': (39.5517, -8.9772),
    'mafra': (38.9381, -9.3264),
    'queluz': (38.7547, -9.2547),
}

# Route keywords mapping
ROUTE_KEYWORDS = {
    'Aldeias Históricas': ['aldeia', 'históric', 'medieval', 'antiga', 'tradicional'],
    'Românico': ['românico', 'igreja', 'mosteiro', 'convento', 'capela'],
    'Templários': ['templário', 'castelo', 'fortaleza', 'ordem', 'cavaleiro'],
    'Santiago': ['santiago', 'peregrino', 'caminho', 'albergue'],
    'UNESCO': ['unesco', 'património', 'mundial', 'humanidade'],
    'Vinhos': ['vinho', 'vindima', 'adega', 'enoturismo', 'uva', 'quinta'],
    'Gastronomia': ['gastronomi', 'culinári', 'restaurante', 'taberna', 'mercado'],
    'Natureza': ['natureza', 'parque', 'reserva', 'floresta', 'montanha'],
    'Praias': ['praia', 'costa', 'mar', 'surf', 'oceano', 'fluvial'],
    'Termas': ['terma', 'spa', 'banho', 'água', 'mineral'],
    'Castelos': ['castelo', 'fortaleza', 'torre', 'muralha', 'defesa'],
    'Museus': ['museu', 'arte', 'exposição', 'galeria', 'coleção'],
    'Percursos': ['trilho', 'percurso', 'caminhada', 'passadiço', 'ecovia'],
    'Festas': ['festa', 'romaria', 'festival', 'tradição', 'santos'],
    'Douro': ['douro', 'vinho do porto', 'vindima', 'rabelo'],
    'Alentejo': ['alentejo', 'planície', 'montado', 'cortiça'],
    'Algarve': ['algarve', 'barlavento', 'sotavento', 'ria formosa'],
    'Açores': ['açores', 'vulcão', 'lagoa', 'caldeira', 'sete cidades'],
    'Madeira': ['madeira', 'levada', 'funchal', 'laurissilva'],
    'Serra da Estrela': ['serra da estrela', 'neve', 'queijo', 'torre'],
}

def extract_location_from_text(text):
    """Extract location name from text"""
    if not text:
        return None

    text_lower = text.lower()

    # Check known locations
    for location, coords in KNOWN_LOCATIONS.items():
        if location in text_lower:
            return coords

    return None

def extract_location_from_metadata(poi):
    """Try to extract GPS from POI metadata"""
    # Check address field
    address = poi.get('metadata', {}).get('address', '')
    if address:
        coords = extract_location_from_text(address)
        if coords:
            return coords

    # Check name
    name = poi.get('name', '')
    coords = extract_location_from_text(name)
    if coords:
        return coords

    # Check description
    description = poi.get('description', '')
    coords = extract_location_from_text(description)
    if coords:
        return coords

    # Fallback to region center
    region = poi.get('region', 'centro')
    region_centers = {
        'norte': (41.5, -8.0),
        'centro': (40.2, -8.0),
        'lisboa': (38.7, -9.1),
        'alentejo': (38.5, -7.9),
        'algarve': (37.1, -8.5),
        'acores': (37.8, -25.5),
        'madeira': (32.7, -16.9),
    }
    return region_centers.get(region, (39.5, -8.0))

async def enrich_pois_with_gps():
    """Enrich POIs with GPS coordinates"""
    logger.info("🗺️ Iniciando enriquecimento GPS...")

    # Get POIs without location
    pois = await db.heritage_items.find({
        '$or': [
            {'location': None},
            {'location': {'$exists': False}}
        ]
    }).to_list(length=10000)

    logger.info(f"📍 {len(pois)} POIs para enriquecer")

    enriched = 0
    batch_size = 100

    for i, poi in enumerate(pois):
        coords = extract_location_from_metadata(poi)

        if coords:
            lat, lng = coords
            # Add small random offset to avoid stacking
            import random
            lat += random.uniform(-0.01, 0.01)
            lng += random.uniform(-0.01, 0.01)

            await db.heritage_items.update_one(
                {'_id': poi['_id']},
                {'$set': {
                    'location': {'lat': lat, 'lng': lng},
                    'updated_at': datetime.now(timezone.utc)
                }}
            )
            enriched += 1

        if (i + 1) % batch_size == 0:
            logger.info(f"  Processados {i + 1}/{len(pois)} POIs...")

    logger.info(f"✅ {enriched} POIs enriquecidos com GPS")
    return enriched

def match_poi_to_route(poi, route):
    """Check if POI matches a route theme"""
    route_name = route.get('name', '').lower()
    poi_name = poi.get('name', '').lower()
    poi_desc = poi.get('description', '').lower()
    poi_category = poi.get('category', '')
    poi_region = poi.get('region', '')

    text = f"{poi_name} {poi_desc}"

    # Check route keywords
    for keyword_group, keywords in ROUTE_KEYWORDS.items():
        if keyword_group.lower() in route_name:
            for keyword in keywords:
                if keyword in text:
                    return True

    # Check direct name match
    for word in route_name.split():
        if len(word) > 4 and word in text:
            return True

    # Check region match
    if poi_region in route_name:
        return True

    # Category-based matching
    category_route_map = {
        'arqueologia': ['castelo', 'românico', 'templário', 'históric'],
        'gastronomia': ['gastronom', 'vinho', 'culinári'],
        'termas': ['terma', 'spa', 'água'],
        'percursos': ['caminho', 'trilho', 'percurso'],
        'festas': ['festa', 'romaria', 'tradição'],
        'arte': ['arte', 'museu', 'cultura'],
        'piscinas': ['praia', 'fluvial', 'banho'],
        'aldeias': ['aldeia', 'históric', 'rural'],
    }

    if poi_category in category_route_map:
        for keyword in category_route_map[poi_category]:
            if keyword in route_name:
                return True

    return False

async def link_pois_to_routes():
    """Link POIs to thematic routes"""
    logger.info("🔗 Iniciando ligação POIs-Rotas...")

    routes = await db.routes.find({}).to_list(length=500)
    pois = await db.heritage_items.find({}).to_list(length=10000)

    logger.info(f"📊 {len(routes)} rotas, {len(pois)} POIs")

    total_links = 0

    for route in routes:
        route_items = []

        for poi in pois:
            if match_poi_to_route(poi, route):
                route_items.append({
                    'id': poi['id'],
                    'name': poi['name'],
                    'category': poi.get('category', ''),
                    'region': poi.get('region', ''),
                })

        # Limit items per route
        route_items = route_items[:50]

        if route_items:
            await db.routes.update_one(
                {'_id': route['_id']},
                {'$set': {
                    'items': route_items,
                    'item_count': len(route_items),
                    'updated_at': datetime.now(timezone.utc)
                }}
            )
            total_links += len(route_items)
            logger.info(f"  ✅ {route['name'][:40]}: {len(route_items)} POIs")

    logger.info(f"✅ Total: {total_links} ligações criadas")
    return total_links

async def main():
    print("=" * 60)
    print("🚀 ENRIQUECIMENTO GPS & LIGAÇÃO ROTAS")
    print("=" * 60)

    # Step 1: Enrich GPS
    print("\n📍 FASE 1: Enriquecimento GPS")
    gps_count = await enrich_pois_with_gps()

    # Step 2: Link routes
    print("\n🔗 FASE 2: Ligação POIs-Rotas")
    link_count = await link_pois_to_routes()

    # Final stats
    pois_with_gps = await db.heritage_items.count_documents({'location': {'$ne': None}})
    routes_with_items = await db.routes.count_documents({'item_count': {'$gt': 0}})

    print("\n" + "=" * 60)
    print("📊 RESUMO FINAL")
    print("=" * 60)
    print(f"  📍 POIs com GPS: {pois_with_gps}")
    print(f"  🔗 Rotas com POIs: {routes_with_items}")
    print(f"  🔢 Total ligações: {link_count}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
