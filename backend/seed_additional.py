"""
Script de Seed Expandido para Portugal Vivo
Inclui todas as camadas + imagens representativas
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# Banco de imagens por categoria
CATEGORY_IMAGES = {
    "lendas": [
        "https://images.pexels.com/photos/32236951/pexels-photo-32236951.jpeg",
        "https://images.pexels.com/photos/15259460/pexels-photo-15259460.jpeg",
    ],
    "festas": [
        "https://images.pexels.com/photos/32618016/pexels-photo-32618016.jpeg",
        "https://images.pexels.com/photos/35801424/pexels-photo-35801424.jpeg",
    ],
    "saberes": [
        "https://images.unsplash.com/photo-1581858348434-86eed6d96970",
        "https://images.unsplash.com/photo-1531899276738-d90a7ed42b10",
        "https://images.pexels.com/photos/34930582/pexels-photo-34930582.jpeg",
    ],
    "crencas": [
        "https://images.pexels.com/photos/18912075/pexels-photo-18912075.jpeg",
    ],
    "gastronomia": [
        "https://images.pexels.com/photos/34963720/pexels-photo-34963720.jpeg",
        "https://images.pexels.com/photos/20147044/pexels-photo-20147044.jpeg",
    ],
    "produtos": [
        "https://images.pexels.com/photos/32906683/pexels-photo-32906683.jpeg",
        "https://images.pexels.com/photos/34297389/pexels-photo-34297389.jpeg",
    ],
    "termas": [
        "https://images.pexels.com/photos/5943520/pexels-photo-5943520.jpeg",
    ],
    "florestas": [
        "https://images.pexels.com/photos/19124732/pexels-photo-19124732.jpeg",
    ],
    "aldeias": [
        "https://images.pexels.com/photos/32885073/pexels-photo-32885073.jpeg",
        "https://images.pexels.com/photos/33891096/pexels-photo-33891096.png",
    ],
    "arte": [
        "https://images.pexels.com/photos/14475309/pexels-photo-14475309.jpeg",
        "https://images.pexels.com/photos/34930529/pexels-photo-34930529.jpeg",
    ],
    "religioso": [
        "https://images.pexels.com/photos/14648739/pexels-photo-14648739.jpeg",
    ],
    "default": [
        "https://images.unsplash.com/photo-1570117119750-728152e9df3b",
        "https://images.pexels.com/photos/22682099/pexels-photo-22682099.jpeg",
    ],
}

def get_image_for_category(category: str, index: int = 0) -> str:
    """Get an image URL for a category"""
    images = CATEGORY_IMAGES.get(category, CATEGORY_IMAGES["default"])
    return images[index % len(images)]

# ========================
# PERCURSOS PEDESTRES (Nova categoria)
# ========================
PERCURSOS = [
    {"name": "Passadiços do Paiva", "description": "8 km de passadiços de madeira ao longo do Rio Paiva, uma das mais espetaculares caminhadas de Portugal.", "region": "norte", "location": {"lat": 40.9667, "lng": -8.2333}, "address": "Arouca"},
    {"name": "Trilho dos Pescadores", "description": "Percurso costeiro de 226 km ao longo da Costa Vicentina, de Porto Covo a Lagos.", "region": "alentejo", "location": {"lat": 37.8500, "lng": -8.7833}, "address": "Costa Vicentina"},
    {"name": "Rota Vicentina - Caminho Histórico", "description": "263 km de trilhos pelo interior alentejano até ao Cabo de São Vicente.", "region": "alentejo", "location": {"lat": 37.0000, "lng": -8.8000}, "address": "Alentejo - Algarve"},
    {"name": "Levada do Caldeirão Verde", "description": "13 km de caminhada ao longo de levadas através da Laurissilva até cascatas espetaculares.", "region": "madeira", "location": {"lat": 32.7833, "lng": -16.9167}, "address": "Santana, Madeira"},
    {"name": "Levada das 25 Fontes", "description": "Percurso até às 25 fontes naturais e à cascata do Risco, uma das mais populares da Madeira.", "region": "madeira", "location": {"lat": 32.7500, "lng": -17.1167}, "address": "Rabaçal, Madeira"},
    {"name": "PR1 Lagoa do Fogo", "description": "Trilho de 9 km até à mais bela lagoa de São Miguel, de origem vulcânica.", "region": "acores", "location": {"lat": 37.7667, "lng": -25.4833}, "address": "Ribeira Grande, São Miguel"},
    {"name": "Trilho da Serra da Estrela - Torre", "description": "Subida ao ponto mais alto de Portugal continental (1993m).", "region": "centro", "location": {"lat": 40.3217, "lng": -7.6114}, "address": "Serra da Estrela"},
    {"name": "Percurso das Aldeias do Xisto", "description": "Rede de trilhos que liga 27 aldeias de xisto na Serra da Lousã.", "region": "centro", "location": {"lat": 40.1000, "lng": -8.2333}, "address": "Serra da Lousã"},
    {"name": "Trilho do Gerês - Mata da Albergaria", "description": "Caminhada pela floresta mais bem preservada do Parque Nacional.", "region": "norte", "location": {"lat": 41.7667, "lng": -8.1333}, "address": "Gerês"},
    {"name": "PR7 Vereda dos Balcões", "description": "Pequeno trilho com vista panorâmica sobre os vales da Madeira.", "region": "madeira", "location": {"lat": 32.7333, "lng": -16.8833}, "address": "Ribeiro Frio, Madeira"},
    {"name": "Trilho do Vale do Côa", "description": "Caminhada pelo vale com gravuras rupestres Património Mundial.", "region": "norte", "location": {"lat": 41.0833, "lng": -7.1167}, "address": "Vila Nova de Foz Côa"},
    {"name": "Percurso do Pico", "description": "Subida ao ponto mais alto de Portugal (2351m) na ilha do Pico.", "region": "acores", "location": {"lat": 38.4667, "lng": -28.4000}, "address": "Pico, Açores"},
    {"name": "Trilho da Arrábida", "description": "Percurso pela serra calcária com vistas sobre o mar.", "region": "lisboa", "location": {"lat": 38.4833, "lng": -8.9833}, "address": "Serra da Arrábida"},
    {"name": "Caminho Português de Santiago", "description": "Percurso de peregrinação de Lisboa a Santiago de Compostela.", "region": "norte", "location": {"lat": 41.1579, "lng": -8.6291}, "address": "Porto - Santiago"},
    {"name": "Trilho das Sete Cidades", "description": "Circuito pelas lagoas gémeas e miradouros de São Miguel.", "region": "acores", "location": {"lat": 37.8410, "lng": -25.7870}, "address": "Sete Cidades, Açores"},
]

# ========================
# COGUMELOS (Expandido)
# ========================
COGUMELOS_EXPANDED = [
    {"name": "Boletus edulis - Porcini", "description": "O rei dos cogumelos, muito apreciado na gastronomia portuguesa. Encontra-se em pinhais e carvalhais de setembro a novembro.", "region": "norte", "subcategory": "comestivel", "location": {"lat": 41.8000, "lng": -6.7500}},
    {"name": "Lactarius deliciosus - Míscaro", "description": "Cogumelo laranja comestível muito popular em Trás-os-Montes. Excelente grelhado ou em arroz.", "region": "norte", "subcategory": "comestivel", "location": {"lat": 41.8000, "lng": -6.7500}},
    {"name": "Amanita caesarea - Ovo-de-rei", "description": "Considerado o melhor cogumelo do mundo desde a Roma Antiga. Raro e precioso.", "region": "norte", "subcategory": "comestivel", "location": {"lat": 41.5000, "lng": -7.0000}},
    {"name": "Macrolepiota procera - Parasol", "description": "Cogumelo grande e saboroso, muito apreciado panado. Comum em pastagens.", "region": "centro", "subcategory": "comestivel", "location": {"lat": 40.3217, "lng": -7.6114}},
    {"name": "Craterellus cornucopioides - Trompeta-negra", "description": "Cogumelo negro aromático, excelente em risottos e massas.", "region": "norte", "subcategory": "comestivel", "location": {"lat": 41.8000, "lng": -6.7500}},
    {"name": "Cantharellus cibarius - Cantarelo", "description": "Cogumelo amarelo dourado com aroma frutado, muito versátil na cozinha.", "region": "norte", "subcategory": "comestivel", "location": {"lat": 41.5000, "lng": -7.5000}},
    {"name": "Agaricus campestris - Cogumelo-do-campo", "description": "O cogumelo branco comum dos prados, muito apreciado.", "region": "centro", "subcategory": "comestivel", "location": {"lat": 40.0000, "lng": -8.0000}},
    {"name": "Pleurotus ostreatus - Cogumelo-ostra", "description": "Cogumelo que cresce em troncos, cultivado comercialmente em Portugal.", "region": "centro", "subcategory": "comestivel", "location": {"lat": 40.2000, "lng": -8.4000}},
    {"name": "Amanita phalloides - Cicuta-verde", "description": "MORTAL - Responsável pela maioria das mortes por cogumelos. Nunca colher cogumelos sem conhecimento especializado!", "region": "norte", "subcategory": "toxico", "location": {"lat": 41.8000, "lng": -6.7500}},
    {"name": "Amanita muscaria - Mata-moscas", "description": "Cogumelo vermelho com pintas brancas, tóxico e alucinogénico. Muito fotogénico mas perigoso.", "region": "norte", "subcategory": "toxico", "location": {"lat": 41.5000, "lng": -7.5000}},
    {"name": "Festival Micológico de Montemor-o-Novo", "description": "Evento anual de celebração dos cogumelos no Alentejo, com passeios, workshops e gastronomia.", "region": "alentejo", "subcategory": "evento", "location": {"lat": 38.6500, "lng": -8.2167}},
    {"name": "Festival do Cogumelo de Alcácer do Sal", "description": "Festa que celebra os cogumelos da região, com degustações e atividades.", "region": "alentejo", "subcategory": "evento", "location": {"lat": 38.3667, "lng": -8.5167}},
]

# ========================
# PEDRAS E MINERAIS (Nova categoria completa)
# ========================
MINERAIS = [
    {"name": "Minas de Aljustrel", "description": "Minas de cobre e zinco exploradas desde a época romana. Património industrial único.", "region": "alentejo", "location": {"lat": 37.8667, "lng": -8.1667}, "address": "Aljustrel"},
    {"name": "Minas de São Domingos", "description": "Antiga exploração de pirite abandonada, hoje património industrial e paisagem lunar.", "region": "alentejo", "location": {"lat": 37.6667, "lng": -7.5000}, "address": "Mértola"},
    {"name": "Minas de Panasqueira", "description": "Uma das maiores minas de volfrâmio do mundo, ainda em exploração.", "region": "centro", "location": {"lat": 40.1500, "lng": -7.7500}, "address": "Covilhã"},
    {"name": "Minas da Urgeiriça", "description": "Antiga mina de urânio, hoje museu e património industrial.", "region": "centro", "location": {"lat": 40.5833, "lng": -7.7500}, "address": "Nelas"},
    {"name": "Calcário de Ançã", "description": "Pedra calcária branca usada na escultura coimbrã desde a Idade Média.", "region": "centro", "location": {"lat": 40.2833, "lng": -8.5667}, "address": "Cantanhede"},
    {"name": "Granito de Alpalhão", "description": "Granito rosa característico do Alto Alentejo, usado em construção.", "region": "alentejo", "location": {"lat": 39.4667, "lng": -7.6333}, "address": "Nisa"},
    {"name": "Mármore de Estremoz", "description": "Mármore branco e rosa de qualidade mundial, exportado globalmente.", "region": "alentejo", "location": {"lat": 38.8500, "lng": -7.5833}, "address": "Estremoz, Borba, Vila Viçosa"},
    {"name": "Xisto da Lousã", "description": "Pedra de xisto que caracteriza as aldeias serranas do Centro.", "region": "centro", "location": {"lat": 40.1000, "lng": -8.2333}, "address": "Serra da Lousã"},
    {"name": "Basalto dos Açores", "description": "Rocha vulcânica negra que caracteriza a arquitetura açoriana.", "region": "acores", "location": {"lat": 38.4667, "lng": -28.2667}, "address": "Açores"},
    {"name": "Pedras Parideiras de Arouca", "description": "Fenómeno geológico único onde granito 'dá à luz' nódulos de biotite.", "region": "norte", "location": {"lat": 40.9333, "lng": -8.2333}, "address": "Arouca"},
    {"name": "Pegmatitos de Ponte da Barca", "description": "Jazidas de lítio e minerais raros no Alto Minho.", "region": "norte", "location": {"lat": 41.8167, "lng": -8.4167}, "address": "Ponte da Barca"},
    {"name": "Salinas de Rio Maior", "description": "Salinas milenares no interior de Portugal, com água 7x mais salgada que o mar.", "region": "centro", "location": {"lat": 39.3833, "lng": -8.9000}, "address": "Rio Maior"},
]

# ========================
# CONTRIBUIÇÕES DA COMUNIDADE
# ========================
async def create_contribution_indexes():
    """Create indexes for the contributions collection"""
    await db.contributions.create_index("user_id")
    await db.contributions.create_index("status")
    await db.contributions.create_index("created_at")
    await db.contributions.create_index([("type", 1), ("status", 1)])

# ========================
# SEED ADDITIONAL DATA
# ========================
async def seed_additional_data():
    """Seed the database with additional heritage data"""
    print("Starting additional data seeding...")

    # Helper function to create heritage item
    def create_item(data, category, index=0):
        return {
            "id": str(uuid.uuid4()),
            "name": data["name"],
            "description": data["description"],
            "category": category,
            "subcategory": data.get("subcategory"),
            "region": data["region"],
            "location": data.get("location"),
            "address": data.get("address"),
            "image_url": get_image_for_category(category, index),
            "tags": [category, data["region"]],
            "metadata": {},
            "created_at": datetime.now(timezone.utc)
        }

    all_items = []

    # Percursos Pedestres
    print("Adding hiking trails...")
    for i, item in enumerate(PERCURSOS):
        all_items.append(create_item(item, "percursos", i))

    # Cogumelos expandido
    print("Adding mushrooms...")
    # First delete existing cogumelos
    await db.heritage_items.delete_many({"category": "cogumelos"})
    for i, item in enumerate(COGUMELOS_EXPANDED):
        all_items.append(create_item(item, "cogumelos", i))

    # Minerais
    print("Adding minerals and stones...")
    for i, item in enumerate(MINERAIS):
        all_items.append(create_item(item, "minerais", i))

    # Insert all items
    print(f"Inserting {len(all_items)} additional heritage items...")
    if all_items:
        await db.heritage_items.insert_many(all_items)

    # Update existing items with images
    print("Updating existing items with images...")
    categories_to_update = ["lendas", "festas", "saberes", "gastronomia", "produtos", "aldeias", "arte", "religioso"]

    for category in categories_to_update:
        items = await db.heritage_items.find({"category": category, "image_url": None}).to_list(100)
        for i, item in enumerate(items):
            image_url = get_image_for_category(category, i)
            await db.heritage_items.update_one(
                {"id": item["id"]},
                {"$set": {"image_url": image_url}}
            )

    # Create indexes for contributions
    print("Creating contribution indexes...")
    await create_contribution_indexes()

    # Get final stats
    total_items = await db.heritage_items.count_documents({})
    print("\nDatabase seeded successfully!")
    print(f"Total items now: {total_items}")

    # Print summary by category
    print("\nSummary by category:")
    pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    async for doc in db.heritage_items.aggregate(pipeline):
        print(f"  {doc['_id']}: {doc['count']}")

if __name__ == "__main__":
    asyncio.run(seed_additional_data())
