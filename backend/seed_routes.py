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
    # Caminhos de Santiago
    {
        "name": "Caminho Português da Costa",
        "description": "O caminho mais panorâmico até Santiago, ao longo da Costa Atlântica de Lisboa a Caminha.",
        "region": "norte",
        "theme": "peregrino",
        "difficulty": "moderado",
        "duration_days": 12,
        "distance_km": 280,
        "keywords": ["santiago", "peregrino", "caminho", "costa", "albergue", "peregrinação", "caminhada"],
        "icon": "directions_walk",
        "external_url": "https://caminodesantiago.consumer.es/pt/os-caminhos-de-santiago/caminho-portugues-da-costa/",
        "highlights": ["Porto", "Viana do Castelo", "Caminha", "Vila Praia de Âncora"],
    },
    {
        "name": "Caminho Português Central",
        "description": "O caminho mais percorrido desde Lisboa, pelo interior de Portugal até à Galiza.",
        "region": "norte",
        "theme": "peregrino",
        "difficulty": "moderado",
        "duration_days": 14,
        "distance_km": 620,
        "keywords": ["santiago", "peregrino", "caminho", "central", "albergue", "peregrinação", "caminhada"],
        "icon": "directions_walk",
        "external_url": "https://www.santiago-compostela.net/pt/caminhos/caminho-portugues",
        "highlights": ["Lisboa", "Santarém", "Coimbra", "Porto", "Ponte de Lima"],
    },
    {
        "name": "Caminho de Santiago Interior",
        "description": "Pelo interior de Portugal, por paisagens selvagens e aldeias históricas até à Galiza.",
        "region": "norte",
        "theme": "peregrino",
        "difficulty": "difícil",
        "duration_days": 10,
        "distance_km": 220,
        "keywords": ["santiago", "peregrino", "caminho", "interior", "albergue", "peregrinação", "caminhada"],
        "icon": "directions_walk",
        "highlights": ["Chaves", "Verín", "Ourense"],
    },
    {
        "name": "Caminho de Santiago Região Centro",
        "description": "Pelo coração de Portugal, da Figueira da Foz ao Porto, com passagem pela Mealhada.",
        "region": "centro",
        "theme": "peregrino",
        "difficulty": "moderado",
        "duration_days": 5,
        "distance_km": 120,
        "keywords": ["santiago", "peregrino", "caminho", "centro", "albergue", "peregrinação", "caminhada"],
        "icon": "directions_walk",
        "highlights": ["Figueira da Foz", "Coimbra", "Mealhada", "Albergaria-a-Velha"],
    },
    # Road Trips
    {
        "name": "Rota Nacional 2 — De Chaves a Faro",
        "description": "738 km pela estrada mais longa de Portugal, do norte transmontano ao sul algarvio.",
        "region": "nacional",
        "theme": "road_trip",
        "difficulty": "fácil",
        "duration_days": 7,
        "distance_km": 738,
        "keywords": ["n2", "estrada", "road trip", "percurso", "viagem", "rota nacional"],
        "icon": "directions_car",
        "external_url": "https://rotadan2.com",
        "highlights": ["Chaves", "Vila Real", "Viseu", "Castelo Branco", "Portalegre", "Évora", "Faro"],
    },
    {
        "name": "EN222 — Estrada de Vinho do Douro",
        "description": "A estrada mais bonita do mundo segundo a National Geographic, ao longo do Rio Douro.",
        "region": "norte",
        "theme": "road_trip",
        "difficulty": "fácil",
        "duration_days": 3,
        "distance_km": 115,
        "keywords": ["en222", "douro", "vinho", "estrada", "road trip", "national geographic", "quinta"],
        "icon": "directions_car",
        "highlights": ["Régua", "Pinhão", "São João da Pesqueira", "Vila Nova de Foz Côa"],
    },
    {
        "name": "Alto Minho em 4 Dias",
        "description": "10 rotas culturais pelo Alto Minho: castros, capelas, moinhos e gastronomia.",
        "region": "norte",
        "theme": "road_trip",
        "difficulty": "fácil",
        "duration_days": 4,
        "keywords": ["alto minho", "cultura", "castro", "minho", "viana", "caminha", "paredes de coura"],
        "icon": "directions_car",
        "highlights": ["Viana do Castelo", "Ponte de Lima", "Arcos de Valdevez", "Monção", "Caminha"],
    },
    # Castelos e Patrimônio
    {
        "name": "Castelos e Fortalezas do Oeste",
        "description": "Das muralhas de Óbidos às fortalezas de Peniche, o oeste histórico de Portugal.",
        "region": "centro",
        "theme": "patrimonio",
        "difficulty": "fácil",
        "duration_days": 3,
        "keywords": ["castelo", "fortaleza", "muralha", "óbidos", "peniche", "nazaré", "alcobaça", "torres vedras"],
        "icon": "castle",
        "highlights": ["Óbidos", "Peniche", "Torres Vedras", "Alcobaça", "Nazaré"],
    },
    {
        "name": "Linhas de Torres Vedras",
        "description": "Os 152 fortins que travaram Napoleão em 1810-1811, o maior sistema defensivo das Guerras Peninsulares.",
        "region": "centro",
        "theme": "patrimonio",
        "difficulty": "moderado",
        "duration_days": 2,
        "distance_km": 65,
        "keywords": ["torres vedras", "fortim", "napoleão", "guerras peninsulares", "wellington", "forte", "defesa"],
        "icon": "shield",
        "highlights": ["Torres Vedras", "Sobral de Monte Agraço", "Arruda dos Vinhos", "Mafra"],
    },
    {
        "name": "Rota da Herança Judaica",
        "description": "Judiarias, sinagogas e memória sefardita nas aldeias e cidades do interior.",
        "region": "centro",
        "theme": "patrimonio",
        "difficulty": "fácil",
        "duration_days": 4,
        "keywords": ["judiaria", "sinagoga", "judaica", "sefardita", "belmonte", "castelo de vide", "guarda", "trancoso"],
        "icon": "synagogue",
        "highlights": ["Belmonte", "Castelo de Vide", "Guarda", "Trancoso", "Covilhã"],
    },
    {
        "name": "Arte Rupestre do Vale do Côa",
        "description": "Património Mundial da UNESCO: gravuras rupestres paleolíticas ao ar livre, entre 10 000 e 22 000 anos.",
        "region": "norte",
        "theme": "patrimonio",
        "difficulty": "moderado",
        "duration_days": 2,
        "keywords": ["côa", "rupestre", "gravura", "paleolítico", "unesco", "museu", "foz côa"],
        "icon": "history_edu",
        "external_url": "https://www.arte-coa.pt",
        "highlights": ["Vila Nova de Foz Côa", "Parque Arqueológico do Côa", "Museu do Côa"],
    },
    {
        "name": "Roteiro das Minas de Portugal",
        "description": "Minas de ouro romanas, schist villages e geologia viva no interior do país.",
        "region": "centro",
        "theme": "patrimonio",
        "difficulty": "moderado",
        "duration_days": 3,
        "keywords": ["mina", "mineração", "ouro", "romano", "geologia", "schist", "lousal", "panasqueira"],
        "icon": "terrain",
        "highlights": ["Lousal", "Aljustrel", "Panasqueira", "Três Minas", "Arouca Geoparque"],
    },
    # Trilhos de longa distância
    {
        "name": "Via Algarviana",
        "description": "300 km a pé pelo Algarve interior, da Serra de Alcaria Real a Alcoutim.",
        "region": "algarve",
        "theme": "caminhada",
        "difficulty": "difícil",
        "duration_days": 14,
        "distance_km": 300,
        "keywords": ["via algarviana", "trilho", "caminhada", "algarve", "percurso", "sr", "gr"],
        "icon": "hiking",
        "external_url": "https://www.viaalgarviana.org",
        "highlights": ["Alcoutim", "Cachopo", "Alte", "Monchique", "Aljezur"],
    },
    {
        "name": "Rota Vicentina",
        "description": "O trilho mais selvagem da Europa: Fishermen's Trail e Historical Way ao longo da costa Vicentina.",
        "region": "alentejo",
        "theme": "caminhada",
        "difficulty": "moderado",
        "duration_days": 10,
        "distance_km": 450,
        "keywords": ["vicentina", "trilho", "caminhada", "costa", "fishermen", "historical", "alentejo", "algarve"],
        "icon": "hiking",
        "external_url": "https://www.rotavicentina.com",
        "highlights": ["Porto Covo", "Vila Nova de Milfontes", "Odeceixe", "Sagres"],
    },
    {
        "name": "Grande Rota do Tejo — GR 14",
        "description": "Siga o maior rio da Península Ibérica desde a nascente até Lisboa, 1 163 km de paisagens.",
        "region": "centro",
        "theme": "caminhada",
        "difficulty": "difícil",
        "duration_days": 21,
        "distance_km": 1163,
        "keywords": ["tejo", "gr14", "grande rota", "trilho", "caminhada", "percurso"],
        "icon": "hiking",
        "highlights": ["Malpica de Tejo", "Abrantes", "Santarém", "Constância", "Lisboa"],
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
            # Optional enrichment fields
            **({"distance_km": route_def["distance_km"]} if "distance_km" in route_def else {}),
            **({"external_url": route_def["external_url"]} if "external_url" in route_def else {}),
            **({"highlights": route_def["highlights"]} if "highlights" in route_def else {}),
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
