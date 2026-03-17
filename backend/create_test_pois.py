"""
Create test POIs for IQ Engine validation
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from datetime import datetime, timezone

async def create_test_pois():
    print("📊 Criando POIs de teste...\n")

    client = AsyncIOMotorClient("mongodb://localhost:27017")

    # Braga POI
    braga_db = client["tenant_braga_db"]

    poi_braga = {
        "id": str(uuid.uuid4()),
        "name": "Santuário do Bom Jesus do Monte",
        "description": (
            "O Santuário do Bom Jesus do Monte é um complexo religioso barroco "
            "localizado em Braga, Portugal. Destaca-se pela sua monumental escadaria de "
            "589 degraus que sobe 116 metros até ao santuário. A visita demora cerca de 2 horas. "
            "É ideal para visitar na primavera quando as flores estão em pleno esplendor. "
            "O acesso é moderado devido à subida íngreme, mas existe um histórico funicular "
            "que facilita o acesso. Património Mundial da UNESCO desde 2019."
        ),
        "category": "religioso",
        "subcategory": None,
        "region": "norte",
        "location": {
            "type": "Point",
            "coordinates": [-8.376900, 41.554500],
            "lat": 41.554500,
            "lng": -8.376900
        },
        "address": "Bom Jesus do Monte, 4715-056 Braga, Portugal",
        "image_url": "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=800",
        "tags": ["UNESCO", "barroco", "escadaria", "funicular", "jardins"],
        "metadata": {
            "admission_fee": "Grátis (funicular pago)",
            "opening_hours": "08:00-20:00",
            "phone": "+351 253 676 636"
        },
        "related_items": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    result = await braga_db.heritage_items.insert_one(poi_braga)
    print(f"✅ POI Braga criado: {poi_braga['name']}")
    print(f"   ID: {poi_braga['id']}\n")

    # Porto POI
    porto_db = client["tenant_porto_db"]

    poi_porto = {
        "id": str(uuid.uuid4()),
        "name": "Torre dos Clérigos",
        "description": (
            "A Torre dos Clérigos é o ex-libris da cidade do Porto. "
            "Com 75 metros de altura, oferece uma vista panorâmica de 360 graus sobre a cidade. "
            "A subida pelos 225 degraus é moderadamente exigente mas vale a pena pelo visual. "
            "Ideal visitar ao pôr do sol. Tempo de visita: cerca de 45 minutos."
        ),
        "category": "religioso",
        "subcategory": "miradouros_secretos",
        "region": "norte",
        "location": {
            "type": "Point",
            "coordinates": [-8.614500, 41.145600],
            "lat": 41.145600,
            "lng": -8.614500
        },
        "address": "Rua dos Clérigos, 4050-099 Porto",
        "image_url": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800",
        "tags": ["barroco", "miradouro", "panorâmica", "histórico"],
        "metadata": {
            "admission_fee": "6€",
            "opening_hours": "09:00-19:00",
            "architect": "Nicolau Nasoni"
        },
        "related_items": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    result = await porto_db.heritage_items.insert_one(poi_porto)
    print(f"✅ POI Porto criado: {poi_porto['name']}")
    print(f"   ID: {poi_porto['id']}\n")

    # Lisboa POI - incomplete data for testing
    # Create Lisboa tenant first
    admin_db = client["admin_tenants"]

    lisboa_tenant = {
        "tenant_id": "lisboa",
        "name": "Município de Lisboa",
        "subdomain": "lisboa",
        "db_name": "tenant_lisboa_db",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "metadata": {"city": "Lisboa", "region": "Lisboa"},
        "settings": {"max_pois": 10000, "max_routes": 500, "features_enabled": ["iq_engine"]}
    }

    await admin_db.tenants.insert_one(lisboa_tenant)
    print("✅ Tenant Lisboa criado\n")

    lisboa_db = client["tenant_lisboa_db"]
    await lisboa_db.create_collection("heritage_items")

    poi_lisboa = {
        "id": str(uuid.uuid4()),
        "name": "Castelo de São Jorge",
        "description": "Castelo histórico.",  # Short description
        "category": None,  # Missing
        "subcategory": None,
        "region": "lisboa",
        "location": {
            "type": "Point",
            "coordinates": [-9.133333, 38.713333],
            "lat": 38.713333,
            "lng": -9.133333
        },
        "address": None,  # Missing
        "image_url": None,  # Missing
        "tags": [],
        "metadata": {},
        "related_items": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

    result = await lisboa_db.heritage_items.insert_one(poi_lisboa)
    print(f"✅ POI Lisboa criado (dados incompletos): {poi_lisboa['name']}")
    print(f"   ID: {poi_lisboa['id']}\n")

    print("="*70)
    print("📊 RESUMO:")
    print(f"   • Braga: {poi_braga['id']}")
    print(f"   • Porto: {poi_porto['id']}")
    print(f"   • Lisboa: {poi_lisboa['id']}")
    print("="*70)

    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_pois())
