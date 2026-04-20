"""
Script para adicionar imagens reais aos POIs do Portugal Vivo
Usa Cloudinary para servir imagens otimizadas do Unsplash
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME', 'dhsz4efox')

def cloudinary_fetch_url(unsplash_url: str, width: int = 800, height: int = 600) -> str:
    """Gera URL do Cloudinary que faz fetch e otimiza imagem do Unsplash"""
    # Cloudinary fetch URL - otimiza automaticamente
    return f"https://res.cloudinary.com/{CLOUD_NAME}/image/fetch/c_fill,w_{width},h_{height},q_auto,f_auto/{unsplash_url}"

# Mapeamento de imagens reais para categorias e nomes específicos
# Usando Unsplash com fotos de Portugal e temas relacionados

CATEGORY_IMAGES = {
    "lendas": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",  # Mystical castle
    "festas": "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",  # Festival
    "saberes": "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800",  # Crafts
    "crencas": "https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800",  # Church
    "gastronomia": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",  # Food
    "produtos": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800",  # Market
    "termas": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",  # Spa
    "florestas": "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800",  # Forest
    "rios": "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800",  # River waterfall
    "aldeias": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800",  # Village
    "piscinas": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",  # Natural pool
    "cogumelos": "https://images.unsplash.com/photo-1504545102780-26774c1bb073?w=800",  # Mushrooms
    "arqueologia": "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=800",  # Ruins
    "fauna": "https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=800",  # Wildlife
    "arte": "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=800",  # Street art
    "religioso": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",  # Church interior
}

# Imagens específicas por nome de POI (palavras-chave)
SPECIFIC_IMAGES = {
    # Lendas
    "galo": "https://images.unsplash.com/photo-1569428034239-f9565e32e224?w=800",  # Rooster
    "barcelos": "https://images.unsplash.com/photo-1569428034239-f9565e32e224?w=800",
    "moura": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",  # Mountains
    "serra": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",  # Mountains
    "estrela": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
    "sete cidades": "https://images.unsplash.com/photo-1555881400-69e8f57ffde3?w=800",  # Azores lakes
    "açores": "https://images.unsplash.com/photo-1555881400-69e8f57ffde3?w=800",
    "acores": "https://images.unsplash.com/photo-1555881400-69e8f57ffde3?w=800",
    "adamastor": "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800",  # Stormy sea
    "cabo": "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800",
    "castelo": "https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?w=800",  # Castle
    "torre": "https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?w=800",
    "inês": "https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800",  # Monastery
    "ines": "https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800",
    "nazaré": "https://images.unsplash.com/photo-1505459668311-8dfac7952bf0?w=800",  # Big waves
    "nazare": "https://images.unsplash.com/photo-1505459668311-8dfac7952bf0?w=800",
    "sebastião": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",  # Fog
    "sebastiao": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
    
    # Festas
    "santos populares": "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",
    "santo antónio": "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",
    "santo antonio": "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800",
    "são joão": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",  # Fireworks
    "sao joao": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
    "carnaval": "https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=800",  # Carnival
    "romaria": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
    "procissão": "https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800",
    "tabuleiros": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
    "flor": "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800",  # Flowers
    "vindimas": "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800",  # Grapes
    "cereja": "https://images.unsplash.com/photo-1528821128474-27f963b062bf?w=800",  # Cherries
    
    # Gastronomia
    "sardinha": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800",  # Fish
    "bacalhau": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800",
    "pastel": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800",  # Pastry
    "nata": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800",
    "queijo": "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=800",  # Cheese
    "vinho": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800",  # Wine
    "porto": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800",  # Porto city
    "douro": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",  # Douro valley
    "azeite": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800",  # Olive oil
    "mel": "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800",  # Honey
    "enchido": "https://images.unsplash.com/photo-1558030006-450675393462?w=800",  # Sausages
    "presunto": "https://images.unsplash.com/photo-1558030006-450675393462?w=800",
    
    # Natureza
    "cascata": "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800",  # Waterfall
    "praia": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",  # Beach
    "oceano": "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800",  # Ocean
    "floresta": "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800",  # Forest
    "montanha": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",  # Mountain
    "rio": "https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800",  # River
    "lagoa": "https://images.unsplash.com/photo-1555881400-69e8f57ffde3?w=800",  # Lake
    "peneda": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
    "gerês": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
    "geres": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
    "arrábida": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
    "arrabida": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
    "sintra": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800",  # Sintra
    
    # Fauna
    "lobo": "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=800",  # Wolf
    "lince": "https://images.unsplash.com/photo-1606567595334-d39972c85dfd?w=800",  # Lynx
    "águia": "https://images.unsplash.com/photo-1611689342806-0863700ce1e4?w=800",  # Eagle
    "aguia": "https://images.unsplash.com/photo-1611689342806-0863700ce1e4?w=800",
    "golfinho": "https://images.unsplash.com/photo-1607153333879-c174d265f1d2?w=800",  # Dolphin
    "cegonha": "https://images.unsplash.com/photo-1591608971362-f08b2a75731a?w=800",  # Stork
    "cavalo": "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800",  # Horse
    
    # Regiões
    "lisboa": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800",  # Lisbon
    "algarve": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",  # Algarve coast
    "madeira": "https://images.unsplash.com/photo-1555881400-69e8f57ffde3?w=800",  # Madeira
    "funchal": "https://images.unsplash.com/photo-1555881400-69e8f57ffde3?w=800",
    "coimbra": "https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800",  # Coimbra
    "braga": "https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800",
    "évora": "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=800",  # Evora
    "evora": "https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=800",
    "alentejo": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",  # Alentejo plains
    "minho": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",  # Green mountains
    "trás-os-montes": "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
    
    # Termas
    "termas": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",  # Spa
    "caldas": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
    "luso": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
    "gerês": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
    
    # Artesanato
    "azulejo": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",  # Tiles
    "filigrana": "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800",  # Jewelry
    "bordado": "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800",  # Embroidery
    "olaria": "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800",  # Pottery
    "cortiça": "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800",  # Cork
    "cortica": "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800",
}

def get_image_for_poi(name: str, category: str) -> str:
    """Determina a melhor imagem para um POI baseado no nome e categoria"""
    name_lower = name.lower()
    
    # Primeiro, procura por palavras-chave específicas no nome
    for keyword, url in SPECIFIC_IMAGES.items():
        if keyword in name_lower:
            return cloudinary_fetch_url(url)
    
    # Senão, usa a imagem da categoria
    if category in CATEGORY_IMAGES:
        return cloudinary_fetch_url(CATEGORY_IMAGES[category])
    
    # Fallback: imagem genérica de Portugal
    return cloudinary_fetch_url("https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800")


async def update_poi_images():
    """Atualiza todos os POIs com imagens do Cloudinary"""
    print("🔄 A atualizar imagens dos POIs...")
    
    # Buscar todos os POIs sem imagem ou com imagem None
    pois = await db.heritage_items.find({
        "$or": [
            {"image_url": None},
            {"image_url": {"$exists": False}},
            {"image_url": ""}
        ]
    }).to_list(None)
    
    print(f"📍 Encontrados {len(pois)} POIs sem imagem")
    
    updated = 0
    for poi in pois:
        image_url = get_image_for_poi(poi['name'], poi.get('category', ''))
        
        await db.heritage_items.update_one(
            {"_id": poi["_id"]},
            {"$set": {"image_url": image_url}}
        )
        updated += 1
        
        if updated % 50 == 0:
            print(f"  ✓ {updated}/{len(pois)} atualizados...")
    
    print(f"\n✅ {updated} POIs atualizados com imagens do Cloudinary!")
    
    # Mostrar alguns exemplos
    print("\n📸 Exemplos de imagens adicionadas:")
    samples = await db.heritage_items.find({"image_url": {"$ne": None}}).limit(5).to_list(5)
    for s in samples:
        print(f"  - {s['name']}")
        print(f"    {s['image_url'][:80]}...")


async def main():
    await update_poi_images()


if __name__ == "__main__":
    asyncio.run(main())
