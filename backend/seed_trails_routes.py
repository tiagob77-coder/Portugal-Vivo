"""
Seed Trails and Cultural Routes from existing POIs
"""
import asyncio
import os
import random
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# Cultural Routes (Rotas Temáticas) definitions
CULTURAL_ROUTES = [
    {
        "id": "rota-vinhos-douro",
        "name": "Rota dos Vinhos do Douro",
        "description": "Percurso pelas quintas e adegas do Alto Douro Vinhateiro, Património Mundial UNESCO",
        "region": "Norte",
        "difficulty": "fácil",
        "duration_days": 3,
        "distance_km": 180,
        "theme": "gastronomia",
        "highlights": ["Quinta do Crasto", "Pinhão", "Régua", "Lamego"],
        "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
        "featured": True
    },
    {
        "id": "rota-romanico",
        "name": "Rota do Românico",
        "description": "Descoberta das igrejas e mosteiros românicos do Norte de Portugal",
        "region": "Norte",
        "difficulty": "moderado",
        "duration_days": 4,
        "distance_km": 250,
        "theme": "patrimonio",
        "highlights": ["Mosteiro de Paço de Sousa", "Igreja de Rates", "Mosteiro de Travanca"],
        "image_url": "https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800",
        "featured": True
    },
    {
        "id": "rota-aldeias-historicas",
        "name": "Rota das Aldeias Históricas",
        "description": "Viagem pelas 12 Aldeias Históricas de Portugal na Serra da Estrela e Beira Interior",
        "region": "Centro",
        "difficulty": "moderado",
        "duration_days": 5,
        "distance_km": 350,
        "theme": "patrimonio",
        "highlights": ["Monsanto", "Sortelha", "Belmonte", "Piódão", "Linhares da Beira"],
        "image_url": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800",
        "featured": True
    },
    {
        "id": "rota-en2",
        "name": "EN2 - Estrada Nacional 2",
        "description": "A mítica estrada que liga Chaves a Faro, atravessando Portugal de Norte a Sul",
        "region": "Nacional",
        "difficulty": "difícil",
        "duration_days": 7,
        "distance_km": 739,
        "theme": "aventura",
        "highlights": ["Chaves", "Vila Real", "Viseu", "Coimbra", "Almodôvar", "Faro"],
        "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
        "featured": True
    },
    {
        "id": "rota-costa-vicentina",
        "name": "Rota Vicentina",
        "description": "Trilhos costeiros no Parque Natural do Sudoeste Alentejano e Costa Vicentina",
        "region": "Alentejo",
        "difficulty": "moderado",
        "duration_days": 6,
        "distance_km": 450,
        "theme": "natureza",
        "highlights": ["Zambujeira do Mar", "Aljezur", "Sagres", "Odeceixe"],
        "image_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
        "featured": True
    },
    {
        "id": "rota-templarios",
        "name": "Rota dos Templários",
        "description": "Nas pegadas da Ordem do Templo pelos castelos e conventos medievais",
        "region": "Centro",
        "difficulty": "moderado",
        "duration_days": 3,
        "distance_km": 200,
        "theme": "patrimonio",
        "highlights": ["Tomar", "Castelo de Almourol", "Convento de Cristo"],
        "image_url": "https://images.unsplash.com/photo-1568454537842-d933259bb258?w=800",
        "featured": True
    },
    {
        "id": "rota-levadas-madeira",
        "name": "Rota das Levadas da Madeira",
        "description": "Percursos únicos ao longo dos canais de irrigação centenários da ilha",
        "region": "Madeira",
        "difficulty": "moderado",
        "duration_days": 5,
        "distance_km": 80,
        "theme": "natureza",
        "highlights": ["25 Fontes", "Caldeirão Verde", "Pico do Arieiro"],
        "image_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
        "featured": False
    },
    {
        "id": "rota-gastronomia-alentejo",
        "name": "Rota Gastronómica do Alentejo",
        "description": "Sabores autênticos do Alentejo: porco preto, azeite, vinho e doçaria conventual",
        "region": "Alentejo",
        "difficulty": "fácil",
        "duration_days": 4,
        "distance_km": 300,
        "theme": "gastronomia",
        "highlights": ["Évora", "Estremoz", "Marvão", "Elvas"],
        "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
        "featured": False
    }
]


async def seed_all():
    mongo_url = os.getenv('MONGO_URL')
    client = AsyncIOMotorClient(mongo_url)
    db = client['portugal_vivo']
    
    # 1. Seed Cultural Routes
    existing_routes = await db.cultural_routes.count_documents({})
    if existing_routes == 0:
        await db.cultural_routes.insert_many(CULTURAL_ROUTES)
        print(f"✅ Inserted {len(CULTURAL_ROUTES)} cultural routes")
    else:
        print(f"ℹ️ Cultural routes already exist: {existing_routes}")
    
    # 2. Seed Trails from Percursos Pedestres
    existing_trails = await db.trails.count_documents({})
    if existing_trails == 0:
        # Get percursos pedestres with location
        percursos = await db.heritage_items.find({
            "category": "percursos_pedestres",
            "location.lat": {"$exists": True, "$ne": None}
        }).to_list(500)
        
        trails_to_insert = []
        for p in percursos:
            # Extract distance from name if possible (e.g., "PR1" = ~5km, "GR" = longer)
            name = p.get("name", "")
            is_gr = "GR" in name.upper()
            estimated_km = random.uniform(15, 50) if is_gr else random.uniform(3, 15)
            
            trail = {
                "id": p["id"],
                "name": p["name"],
                "description": p.get("description", ""),
                "municipality_id": p.get("concelho", p.get("region", "")).lower().replace(" ", "_"),
                "region": p.get("region", "Norte"),
                "difficulty": random.choice(["fácil", "moderado", "difícil"]),
                "distance_km": round(estimated_km, 1),
                "duration_hours": round(estimated_km / 4, 1),  # ~4km/h walking pace
                "elevation_gain": random.randint(100, 800),
                "trail_type": "grande_rota" if is_gr else "pequena_rota",
                "surface": random.choice(["terra batida", "misto", "calcetado", "floresta"]),
                "start_point": p.get("location", {}),
                "points": [p.get("location", {})],  # Simplified - just start point
                "image_url": p.get("image_url", ""),
                "tags": p.get("tags", []),
                "featured": random.random() < 0.1,  # 10% featured
            }
            trails_to_insert.append(trail)
        
        if trails_to_insert:
            await db.trails.insert_many(trails_to_insert)
            print(f"✅ Inserted {len(trails_to_insert)} trails from percursos pedestres")
    else:
        print(f"ℹ️ Trails already exist: {existing_trails}")
    
    # 3. Verify Grande Expedição
    exp_count = await db.grande_expedicao.count_documents({})
    print(f"ℹ️ Grande Expedição stages: {exp_count}")
    
    # Summary
    print("\n📊 Final counts:")
    print(f"  - Cultural Routes: {await db.cultural_routes.count_documents({})}")
    print(f"  - Trails: {await db.trails.count_documents({})}")
    print(f"  - Grande Expedição: {await db.grande_expedicao.count_documents({})}")


if __name__ == "__main__":
    asyncio.run(seed_all())
