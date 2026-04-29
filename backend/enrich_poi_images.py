#!/usr/bin/env python3
"""
POI Image Enrichment Script
Adds fallback images to POIs without images based on their category.
"""
import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

# Fallback images by category (high-quality Unsplash/Pexels URLs)
CATEGORY_FALLBACK_IMAGES = {
    # Praias
    'praias_bandeira_azul': 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    'praias_fluviais': 'https://images.unsplash.com/photo-1504858700536-882c978a3464?w=800&q=80',
    'surf': 'https://images.unsplash.com/photo-1502680390548-bdbac40b3e1a?w=800&q=80',
    
    # Natureza
    'percursos_pedestres': 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
    'miradouros': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    'ecovias_passadicos': 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
    'parques_campismo': 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
    'cascatas_pocos': 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=800&q=80',
    'barragens_albufeiras': 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800&q=80',
    
    # Gastronomia
    'restaurantes_gastronomia': 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    'pratos_tipicos': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
    'docaria_regional': 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80',
    'tabernas_historicas': 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80',
    'mercados_feiras': 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80',
    
    # Património
    'museus': 'https://images.unsplash.com/photo-1565060169194-19fabf63012c?w=800&q=80',
    'castelos': 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800&q=80',
    'palacios_solares': 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80',
    'patrimonio_ferroviario': 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800&q=80',
    'arqueologia_geologia': 'https://images.unsplash.com/photo-1531177071211-ed1b7991958b?w=800&q=80',
    'moinhos_azenhas': 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&q=80',
    
    # Cultura
    'arte_urbana': 'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=800&q=80',
    'festas_romarias': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80',
    'musica_tradicional': 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80',
    
    # Serviços
    'agentes_turisticos': 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80',
    'alojamentos_rurais': 'https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=800&q=80',
    'pousadas_juventude': 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
    
    # Default
    '_default': 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80',
}


async def enrich_poi_images():
    """Add fallback images to POIs without images."""
    mongo_url = os.getenv("MONGO_URL")
    if not mongo_url:
        print("❌ MONGO_URL not configured")
        return
    
    client = AsyncIOMotorClient(mongo_url)
    db = client.portugal_vivo
    
    # Find POIs without images
    query = {
        '$or': [
            {'image_url': {'$exists': False}},
            {'image_url': None},
            {'image_url': ''}
        ]
    }
    
    total_without = await db.heritage_items.count_documents(query)
    print(f"📊 POIs sem imagem: {total_without}")
    
    if total_without == 0:
        print("✅ Todos os POIs já têm imagem!")
        client.close()
        return
    
    # Process by category
    updated_total = 0
    
    for category, image_url in CATEGORY_FALLBACK_IMAGES.items():
        if category == '_default':
            continue
        
        cat_query = {
            **query,
            'category': category
        }
        
        count = await db.heritage_items.count_documents(cat_query)
        if count == 0:
            continue
        
        result = await db.heritage_items.update_many(
            cat_query,
            {'$set': {
                'image_url': image_url,
                'image_source': 'unsplash_fallback',
                'image_enriched_at': datetime.utcnow()
            }}
        )
        
        if result.modified_count > 0:
            print(f"   ✅ {category}: {result.modified_count} POIs atualizados")
            updated_total += result.modified_count
    
    # Update remaining POIs with default image
    remaining = await db.heritage_items.count_documents(query)
    if remaining > 0:
        result = await db.heritage_items.update_many(
            query,
            {'$set': {
                'image_url': CATEGORY_FALLBACK_IMAGES['_default'],
                'image_source': 'unsplash_default',
                'image_enriched_at': datetime.utcnow()
            }}
        )
        print(f"   ✅ _default: {result.modified_count} POIs atualizados")
        updated_total += result.modified_count
    
    # Final stats
    final_with_image = await db.heritage_items.count_documents({
        'image_url': {'$exists': True, '$ne': None, '$ne': ''}
    })
    total = await db.heritage_items.count_documents({})
    
    print(f"\n{'='*50}")
    print(f"📊 RESULTADO FINAL")
    print(f"   Atualizados: {updated_total}")
    print(f"   Com imagem: {final_with_image}/{total} ({100*final_with_image/total:.1f}%)")
    print(f"{'='*50}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(enrich_poi_images())
