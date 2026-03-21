"""
Create MongoDB indexes for production performance.
Run once before deploying: python scripts/create_indexes.py
"""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent.parent / 'backend' / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']


async def create_indexes():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(f"Creating indexes on database: {DB_NAME}")

    # heritage_items — primary lookup by id, filtered by category/region/search
    await db.heritage_items.create_index('id', unique=True)
    await db.heritage_items.create_index('category')
    await db.heritage_items.create_index('region')
    await db.heritage_items.create_index([('name', 'text'), ('description', 'text'), ('tags', 'text')])
    await db.heritage_items.create_index([('geo_location', '2dsphere')], sparse=True)
    print("  heritage_items: id (unique), category, region, text search, geo_location (2dsphere)")

    # routes
    await db.routes.create_index('id', unique=True)
    await db.routes.create_index('category')
    await db.routes.create_index('region')
    print("  routes: id (unique), category, region")

    # users
    await db.users.create_index('user_id', unique=True)
    await db.users.create_index('email', unique=True)
    print("  users: user_id (unique), email (unique)")

    # user_sessions — lookup by token, expire old sessions
    await db.user_sessions.create_index('session_token', unique=True)
    await db.user_sessions.create_index('user_id')
    await db.user_sessions.create_index('expires_at', expireAfterSeconds=0)
    print("  user_sessions: session_token (unique), user_id, expires_at (TTL)")

    # contributions
    await db.contributions.create_index('id', unique=True)
    await db.contributions.create_index('user_id')
    await db.contributions.create_index('status')
    await db.contributions.create_index([('created_at', -1)])
    print("  contributions: id (unique), user_id, status, created_at (desc)")

    # user_progress
    await db.user_progress.create_index('user_id', unique=True)
    await db.user_progress.create_index([('total_points', -1)])
    print("  user_progress: user_id (unique), total_points (desc for leaderboard)")

    client.close()
    print("\nAll indexes created successfully.")


if __name__ == '__main__':
    asyncio.run(create_indexes())
