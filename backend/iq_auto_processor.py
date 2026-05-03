#!/usr/bin/env python3
"""
IQ Engine Auto-Processor
Processes unprocessed POIs with a simple scoring algorithm.
For full IQ Engine processing, use the API endpoints.
"""
import asyncio
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient


def calculate_simple_iq_score(poi: dict) -> float:
    """
    Calculate a simple IQ score based on data completeness.
    Score ranges from 30 (minimal data) to 90 (complete data).
    """
    score = 30.0  # Base score
    
    # Name quality (+10)
    name = poi.get("name", "")
    if name and len(name) > 10:
        score += 5
    if name and len(name) > 30:
        score += 5
    
    # Description quality (+15)
    desc = poi.get("description") or poi.get("subtitle") or poi.get("summary") or ""
    if desc and len(desc) > 50:
        score += 5
    if desc and len(desc) > 150:
        score += 5
    if desc and len(desc) > 300:
        score += 5
    
    # Location data (+10)
    if poi.get("location"):
        score += 5
        coords = poi.get("location", {}).get("coordinates", [])
        if coords and len(coords) >= 2:
            score += 5
    
    # Category (+5)
    if poi.get("category"):
        score += 5
    
    # Region (+5)
    if poi.get("region"):
        score += 5
    
    # Image (+10)
    if poi.get("image_url"):
        score += 10
    
    # Tags (+5)
    tags = poi.get("tags", [])
    if tags and len(tags) > 0:
        score += 2
    if tags and len(tags) > 3:
        score += 3
    
    # Extra metadata (+10)
    if poi.get("address"):
        score += 3
    if poi.get("phone") or poi.get("website") or poi.get("email"):
        score += 3
    if poi.get("opening_hours") or poi.get("schedule"):
        score += 2
    if poi.get("price") or poi.get("entry_fee"):
        score += 2
    
    return min(90.0, score)  # Cap at 90


async def process_pending_pois(
    batch_size: int = 100,
    max_batches: int = 60
):
    """
    Process pending POIs with simple scoring.
    """
    mongo_url = os.getenv("MONGO_URL")
    if not mongo_url:
        print("❌ MONGO_URL not configured")
        return
    
    client = AsyncIOMotorClient(mongo_url)
    db = client.portugal_vivo
    
    # Count pending POIs
    pending_query = {
        "$or": [
            {"iq_score": {"$exists": False}},
            {"iq_score": None},
            {"iq_score": 0}
        ]
    }
    total_pending = await db.heritage_items.count_documents(pending_query)
    print(f"📊 Total POIs pendentes: {total_pending}")
    
    if total_pending == 0:
        print("✅ Todos os POIs já foram processados!")
        client.close()
        return
    
    processed_total = 0
    batch_num = 0
    
    while batch_num < max_batches:
        batch_num += 1
        
        # Get batch of pending POIs
        cursor = db.heritage_items.find(pending_query).limit(batch_size)
        pois = await cursor.to_list(length=batch_size)
        
        if not pois:
            print("   Sem mais POIs pendentes")
            break
        
        print(f"\n🔄 Batch {batch_num}/{max_batches} ({len(pois)} POIs)")
        
        # Process each POI
        updates = []
        for poi in pois:
            poi_id = poi.get("id")
            score = calculate_simple_iq_score(poi)
            
            updates.append({
                "filter": {"id": poi_id},
                "update": {"$set": {
                    "iq_score": score,
                    "iq_processed_at": datetime.utcnow(),
                    "iq_status": "completed_simple"
                }}
            })
        
        # Bulk update
        if updates:
            from pymongo import UpdateOne
            bulk_ops = [UpdateOne(u["filter"], u["update"]) for u in updates]
            result = await db.heritage_items.bulk_write(bulk_ops)
            processed_total += result.modified_count
            
            # Show sample scores
            sample_scores = [calculate_simple_iq_score(p) for p in pois[:5]]
            print(f"   ✅ {result.modified_count} processados | Scores amostra: {[f'{s:.0f}' for s in sample_scores]}")
        
        # Small delay
        await asyncio.sleep(0.5)
    
    # Final summary
    remaining = await db.heritage_items.count_documents(pending_query)
    print(f"\n{'='*50}")
    print(f"📊 RESUMO DO PROCESSAMENTO")
    print(f"   Processados: {processed_total}")
    print(f"   Restantes: {remaining}")
    print(f"{'='*50}")
    
    client.close()


async def get_iq_status():
    """Get current IQ processing status."""
    mongo_url = os.getenv("MONGO_URL")
    client = AsyncIOMotorClient(mongo_url)
    db = client.portugal_vivo
    
    total = await db.heritage_items.count_documents({})
    processed = await db.heritage_items.count_documents({"iq_score": {"$gt": 0}})
    pending = total - processed
    
    # Average score
    pipeline = [
        {"$match": {"iq_score": {"$gt": 0}}},
        {"$group": {"_id": None, "avg": {"$avg": "$iq_score"}}}
    ]
    result = await db.heritage_items.aggregate(pipeline).to_list(1)
    avg_score = result[0]["avg"] if result else 0
    
    print(f"📊 Estado do Motor IQ:")
    print(f"   Total POIs: {total}")
    print(f"   Processados: {processed} ({100*processed/total:.1f}%)")
    print(f"   Pendentes: {pending}")
    print(f"   Score médio: {avg_score:.1f}")
    
    client.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="IQ Engine Auto-Processor")
    parser.add_argument("--status", action="store_true", help="Show current IQ status")
    parser.add_argument("--batch-size", type=int, default=100, help="POIs per batch")
    parser.add_argument("--max-batches", type=int, default=60, help="Max batches to process")
    
    args = parser.parse_args()
    
    if args.status:
        asyncio.run(get_iq_status())
    else:
        asyncio.run(process_pending_pois(
            batch_size=args.batch_size,
            max_batches=args.max_batches
        ))
