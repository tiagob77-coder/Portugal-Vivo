"""
Demo script para testar isolamento multi-tenant
"""
import asyncio
from tenant_manager import TenantManager
from datetime import datetime, timezone
import uuid

async def test_tenant_isolation():
    print("🧪 TESTE DE ISOLAMENTO MULTI-TENANT\n")

    # Initialize
    mongo_url = "mongodb://localhost:27017"
    redis_url = "redis://localhost:6379"

    manager = TenantManager(mongo_url, redis_url)
    await manager.init_redis()

    # Test 1: Create POI in Braga tenant
    print("1️⃣ Criando POI no tenant BRAGA...")
    braga_db = await manager.get_tenant_db("braga")

    braga_poi = {
        "id": str(uuid.uuid4()),
        "name": "Santuário do Bom Jesus do Monte",
        "description": "Santuário barroco com escadaria monumental em Braga",
        "category": "religioso",
        "region": "norte",
        "location": {"lat": 41.5545, "lng": -8.3769},
        "address": "Bom Jesus do Monte, Braga",
        "tags": ["UNESCO", "barroco", "escadaria"],
        "metadata": {},
        "related_items": [],
        "created_at": datetime.now(timezone.utc)
    }

    await braga_db.heritage_items.insert_one(braga_poi)
    print(f"   ✅ POI criado em tenant_braga_db: {braga_poi['name']}\n")

    # Test 2: Create POI in Porto tenant
    print("2️⃣ Criando POI no tenant PORTO...")
    porto_db = await manager.get_tenant_db("porto")

    porto_poi = {
        "id": str(uuid.uuid4()),
        "name": "Torre dos Clérigos",
        "description": "Ícone barroco da cidade do Porto",
        "category": "religioso",
        "region": "norte",
        "location": {"lat": 41.1456, "lng": -8.6145},
        "address": "Rua dos Clérigos, Porto",
        "tags": ["barroco", "miradouro"],
        "metadata": {},
        "related_items": [],
        "created_at": datetime.now(timezone.utc)
    }

    await porto_db.heritage_items.insert_one(porto_poi)
    print(f"   ✅ POI criado em tenant_porto_db: {porto_poi['name']}\n")

    # Test 3: Verify isolation
    print("3️⃣ Verificando ISOLAMENTO...\n")

    braga_count = await braga_db.heritage_items.count_documents({})
    porto_count = await porto_db.heritage_items.count_documents({})

    print(f"   📊 Database BRAGA: {braga_count} POIs")
    print(f"   📊 Database PORTO: {porto_count} POIs")

    # Get actual POIs
    braga_pois = await braga_db.heritage_items.find({}, {"_id": 0, "name": 1}).to_list(10)
    porto_pois = await porto_db.heritage_items.find({}, {"_id": 0, "name": 1}).to_list(10)

    print(f"\n   🏛️  POIs em BRAGA: {[p['name'] for p in braga_pois]}")
    print(f"   🏛️  POIs em PORTO: {[p['name'] for p in porto_pois]}")

    # Verification
    print("\n" + "="*60)
    if braga_count == 1 and porto_count == 1:
        print("✅ SUCESSO! Isolamento multi-tenant funcionando perfeitamente!")
        print("   • Cada tenant tem seu próprio database")
        print("   • Os dados estão completamente separados")
    else:
        print("⚠️  Atenção: Contagens inesperadas")
    print("="*60)

    await manager.close()

if __name__ == "__main__":
    asyncio.run(test_tenant_isolation())
