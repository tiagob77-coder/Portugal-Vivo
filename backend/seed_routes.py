"""
Seed Thematic Routes from existing POIs
Creates 25 curated routes across Portugal's regions and themes.
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Thematic route definitions
ROUTES = [
    # Norte
    {
        "name": "Rota dos Castelos do Norte",
        "description": "Dos castelos de Guimarães a Bragança, descubra as fortalezas que defenderam Portugal.",
        "region": "norte",
        "theme": "patrimonio",
        "difficulty": "moderado",
        "duration_days": 3,
        "keywords": ["castelo", "fortaleza", "muralha", "torre", "medieval"],
        "icon": "castle",
    },
    {
        "name": "Rota do Românico do Douro",
        "description": "Igrejas e mosteiros românicas ao longo do vale do Douro.",
        "region": "norte",
        "theme": "patrimonio",
        "difficulty": "fácil",
        "duration_days": 2,
        "keywords": ["românico", "igreja", "mosteiro", "convento", "capela"],
        "icon": "church",
    },
    {
        "name": "Vinhos do Douro e Porto",
        "description": "Das quintas do Douro às caves de Vila Nova de Gaia, a rota do vinho mais antiga do mundo.",
        "region": "norte",
        "theme": "gastronomia",
        "difficulty": "fácil",
        "duration_days": 3,
        "keywords": ["vinho", "douro", "porto", "quinta", "vindima", "adega", "enoturismo"],
        "icon": "wine_bar",
    },
    {
        "name": "Trilhos do Gerês",
        "description": "Percursos pedestres pelo único Parque Nacional de Portugal.",
        "region": "norte",
        "theme": "natureza",
        "difficulty": "difícil",
        "duration_days": 2,
        "keywords": ["gerês", "peneda", "trilho", "cascata", "montanha", "parque nacional"],
        "icon": "hiking",
    },
    # Centro
    {
        "name": "Aldeias Históricas do Centro",
        "description": "12 aldeias medievais preservadas no interior de Portugal, entre granito e história.",
        "region": "centro",
        "theme": "patrimonio",
        "difficulty": "moderado",
        "duration_days": 4,
        "keywords": ["aldeia", "históric", "medieval", "monsanto", "sortelha", "piódão", "linhares"],
        "icon": "holiday_village",
    },
    {
        "name": "Praias Fluviais do Centro",
        "description": "Mergulhe nas águas cristalinas dos rios e ribeiras do interior.",
        "region": "centro",
        "theme": "natureza",
        "difficulty": "fácil",
        "duration_days": 3,
        "keywords": ["praia fluvial", "rio", "ribeira", "piscina natural", "banho", "fluvial"],
        "icon": "pool",
    },
    {
        "name": "Rota dos Templários",
        "description": "De Tomar a Almourol, siga os passos dos Cavaleiros Templários em Portugal.",
        "region": "centro",
        "theme": "patrimonio",
        "difficulty": "fácil",
        "duration_days": 2,
        "keywords": ["templário", "tomar", "almourol", "convento de cristo", "cavaleiro", "ordem"],
        "icon": "shield",
    },
    {
        "name": "Serra da Estrela — Queijo e Neve",
        "description": "Do ponto mais alto de Portugal continental ao queijo mais famoso do país.",
        "region": "centro",
        "theme": "gastronomia",
        "difficulty": "moderado",
        "duration_days": 2,
        "keywords": ["serra da estrela", "queijo", "neve", "torre", "manteigas", "seia"],
        "icon": "terrain",
    },
    {
        "name": "Passadiços e Miradouros do Centro",
        "description": "Os percursos mais espetaculares sobre rios e vales do centro de Portugal.",
        "region": "centro",
        "theme": "natureza",
        "difficulty": "moderado",
        "duration_days": 2,
        "keywords": ["passadiço", "miradouro", "paiva", "percurso", "panorâmic"],
        "icon": "landscape",
    },
    # Lisboa
    {
        "name": "Lisboa Monumental",
        "description": "De Belém ao Castelo de São Jorge, os grandes monumentos da capital.",
        "region": "lisboa",
        "theme": "patrimonio",
        "difficulty": "fácil",
        "duration_days": 2,
        "keywords": ["belém", "jerónimos", "torre", "castelo", "são jorge", "alfama", "monumento"],
        "icon": "account_balance",
    },
    {
        "name": "Sintra Mágica",
        "description": "Palácios, jardins e mistérios na serra mais romântica de Portugal.",
        "region": "lisboa",
        "theme": "patrimonio",
        "difficulty": "moderado",
        "duration_days": 1,
        "keywords": ["sintra", "palácio", "pena", "monserrate", "regaleira", "serra"],
        "icon": "auto_awesome",
    },
    {
        "name": "Tascas e Fado de Lisboa",
        "description": "Uma viagem gastronómica e musical pelos bairros históricos da capital.",
        "region": "lisboa",
        "theme": "gastronomia",
        "difficulty": "fácil",
        "duration_days": 1,
        "keywords": ["tasca", "fado", "alfama", "mouraria", "bairro alto", "restaurante", "taberna"],
        "icon": "restaurant",
    },
    # Alentejo
    {
        "name": "Rota do Megalitismo Alentejano",
        "description": "Antas, menires e cromeleques — os monumentos mais antigos de Portugal.",
        "region": "alentejo",
        "theme": "patrimonio",
        "difficulty": "fácil",
        "duration_days": 2,
        "keywords": ["megalít", "anta", "menir", "cromeleque", "évora", "pré-histór"],
        "icon": "blur_on",
    },
    {
        "name": "Alentejo — Cortiça, Vinho e Azeite",
        "description": "Os sabores e tradições do campo alentejano, entre montados e vinhas.",
        "region": "alentejo",
        "theme": "gastronomia",
        "difficulty": "fácil",
        "duration_days": 3,
        "keywords": ["cortiça", "vinho", "azeite", "montado", "herdade", "alentejo"],
        "icon": "local_drink",
    },
    {
        "name": "Castelos da Raia Alentejana",
        "description": "As fortalezas medievais que guardam a fronteira entre Portugal e Espanha.",
        "region": "alentejo",
        "theme": "patrimonio",
        "difficulty": "moderado",
        "duration_days": 3,
        "keywords": ["castelo", "fortaleza", "marvão", "elvas", "estremoz", "fronteira"],
        "icon": "castle",
    },
    # Algarve
    {
        "name": "Falésias e Grutas do Algarve",
        "description": "As formações rochosas mais impressionantes da costa algarvia.",
        "region": "algarve",
        "theme": "natureza",
        "difficulty": "moderado",
        "duration_days": 2,
        "keywords": ["falésia", "gruta", "benagil", "costa", "rocha", "algar"],
        "icon": "water",
    },
    {
        "name": "Ria Formosa — Natureza Viva",
        "description": "O parque natural mais emblemático do Algarve, entre ilhas e sapais.",
        "region": "algarve",
        "theme": "natureza",
        "difficulty": "fácil",
        "duration_days": 2,
        "keywords": ["ria formosa", "ilha", "sapal", "flamingo", "natureza", "olhão", "tavira"],
        "icon": "water",
    },
    {
        "name": "Algarve Gastronómico",
        "description": "Cataplanas, mariscos e doces de amêndoa — os sabores do sul.",
        "region": "algarve",
        "theme": "gastronomia",
        "difficulty": "fácil",
        "duration_days": 2,
        "keywords": ["cataplana", "marisco", "amêndoa", "figo", "restaurante", "mercado"],
        "icon": "restaurant",
    },
    # Açores
    {
        "name": "Açores Vulcânicos",
        "description": "Caldeiras, lagoas e fumarolas — a força da terra nos Açores.",
        "region": "acores",
        "theme": "natureza",
        "difficulty": "moderado",
        "duration_days": 3,
        "keywords": ["vulcão", "caldeira", "lagoa", "sete cidades", "furnas", "fumarola"],
        "icon": "volcano",
    },
    {
        "name": "Trilhos dos Açores",
        "description": "Percursos pedestres entre crateras, hortênsias e o oceano Atlântico.",
        "region": "acores",
        "theme": "natureza",
        "difficulty": "difícil",
        "duration_days": 4,
        "keywords": ["trilho", "percurso", "açores", "cratera", "faial", "pico", "flores"],
        "icon": "hiking",
    },
    # Madeira
    {
        "name": "Levadas da Madeira",
        "description": "Caminhe ao longo dos canais de irrigação centenários pela floresta Laurissilva.",
        "region": "madeira",
        "theme": "natureza",
        "difficulty": "moderado",
        "duration_days": 3,
        "keywords": ["levada", "laurissilva", "madeira", "floresta", "vereda", "funchal"],
        "icon": "forest",
    },
    {
        "name": "Funchal — Jardins e Sabores",
        "description": "Jardins tropicais, mercado dos lavradores e gastronomia madeirense.",
        "region": "madeira",
        "theme": "gastronomia",
        "difficulty": "fácil",
        "duration_days": 1,
        "keywords": ["funchal", "jardim", "mercado", "vinho madeira", "espetada", "bolo do caco"],
        "icon": "local_florist",
    },
    # Transversais
    {
        "name": "Caminho de Santiago Português",
        "description": "O percurso de peregrinação desde Lisboa até Santiago de Compostela.",
        "region": "norte",
        "theme": "patrimonio",
        "difficulty": "difícil",
        "duration_days": 14,
        "keywords": ["santiago", "peregrino", "caminho", "albergue", "peregrinação"],
        "icon": "directions_walk",
    },
    {
        "name": "Termas de Portugal",
        "description": "As melhores estâncias termais do país, de norte a sul.",
        "region": "centro",
        "theme": "bem-estar",
        "difficulty": "fácil",
        "duration_days": 5,
        "keywords": ["terma", "termal", "spa", "água", "banho", "mineral"],
        "icon": "spa",
    },
    {
        "name": "Festas e Romarias Populares",
        "description": "As tradições festivas mais autênticas de Portugal, de norte a sul.",
        "region": "norte",
        "theme": "cultura",
        "difficulty": "fácil",
        "duration_days": 7,
        "keywords": ["festa", "romaria", "festival", "santos populares", "tradição", "procissão"],
        "icon": "celebration",
    },
]


async def match_pois_to_route(route_def, pois):
    """Find POIs that match a route's theme using keywords and region."""
    matched = []
    keywords = route_def["keywords"]
    region = route_def["region"]

    for poi in pois:
        poi_name = (poi.get("name") or "").lower()
        poi_desc = (poi.get("description") or "").lower()
        poi_cat = (poi.get("category") or "").lower()
        poi_region = (poi.get("region") or "").lower()
        text = f"{poi_name} {poi_desc} {poi_cat}"

        # Region match (soft — bonus, not required for transversal routes)
        region_match = poi_region == region

        # Keyword match
        keyword_hits = sum(1 for kw in keywords if kw in text)

        if keyword_hits >= 1 and region_match:
            matched.append((poi, keyword_hits + 1))
        elif keyword_hits >= 2:
            matched.append((poi, keyword_hits))

    # Sort by relevance, take top 30
    matched.sort(key=lambda x: x[1], reverse=True)
    return [m[0] for m in matched[:30]]


async def seed_routes():
    """Seed thematic routes into the database."""
    logger.info("🚀 Iniciando seed de rotas temáticas...")

    # Get all POIs
    pois = await db.heritage_items.find({}).to_list(length=10000)
    logger.info(f"📊 {len(pois)} POIs disponíveis para matching")

    # Clear existing seeded routes
    result = await db.routes.delete_many({"source": "seed_thematic"})
    logger.info(f"🗑️ {result.deleted_count} rotas anteriores removidas")

    created = 0
    for route_def in ROUTES:
        matched_pois = await match_pois_to_route(route_def, pois)

        if len(matched_pois) < 3:
            logger.warning(f"⚠️ '{route_def['name']}': apenas {len(matched_pois)} POIs — criada mesmo assim")

        route_items = [
            {
                "id": poi.get("id", str(poi.get("_id", ""))),
                "name": poi.get("name", ""),
                "category": poi.get("category", ""),
                "region": poi.get("region", ""),
            }
            for poi in matched_pois
        ]

        route_doc = {
            "id": f"route-{uuid.uuid4().hex[:8]}",
            "name": route_def["name"],
            "description": route_def["description"],
            "region": route_def["region"],
            "theme": route_def["theme"],
            "difficulty": route_def["difficulty"],
            "duration_days": route_def["duration_days"],
            "icon": route_def.get("icon", "route"),
            "items": route_items,
            "item_count": len(route_items),
            "source": "seed_thematic",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        await db.routes.insert_one(route_doc)
        created += 1
        logger.info(f"  ✅ {route_def['name']}: {len(route_items)} POIs")

    logger.info(f"\n🎉 {created} rotas criadas com sucesso!")

    # Summary
    total_routes = await db.routes.count_documents({})
    routes_with_items = await db.routes.count_documents({"item_count": {"$gt": 0}})
    logger.info(f"📊 Total rotas na BD: {total_routes}")
    logger.info(f"📊 Rotas com POIs: {routes_with_items}")


if __name__ == "__main__":
    asyncio.run(seed_routes())
