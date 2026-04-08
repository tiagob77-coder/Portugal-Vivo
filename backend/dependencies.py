"""
FastAPI Dependency Injection - Replaces the global _db = None pattern.
All routers should use `db = Depends(get_db)` instead of module-level globals.

Usage in a router:
    from dependencies import get_db
    from motor.motor_asyncio import AsyncIOMotorDatabase

    @router.get("/items")
    async def get_items(db: AsyncIOMotorDatabase = Depends(get_db)):
        items = await db.items.find({}).to_list(100)
        return items
"""
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import certifi
import logging

logger = logging.getLogger(__name__)

# Singleton database connection
_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


def init_database(mongo_url: str, db_name: str) -> AsyncIOMotorDatabase:
    """Initialize the database connection with optimized pooling. Called once at startup."""
    global _client, _db
    # Support Atlas SRV connections with proper SSL
    extra_kwargs = {}
    if 'mongodb+srv' in mongo_url or 'mongodb.net' in mongo_url:
        extra_kwargs['tlsCAFile'] = certifi.where()
    _client = AsyncIOMotorClient(
        mongo_url,
        maxPoolSize=50,
        minPoolSize=5,
        maxIdleTimeMS=30000,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=10000,
        socketTimeoutMS=30000,
        retryWrites=True,
        retryReads=True,
        w="majority",
        **extra_kwargs,
    )
    _db = _client[db_name]
    logger.info("Database initialized: %s (pool: 5-50, timeouts: connect=10s, socket=30s)", db_name)
    return _db


def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency - provides database access to route handlers.

    Usage:
        @router.get("/items")
        async def get_items(db = Depends(get_db)):
            ...
    """
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return _db


def get_client() -> AsyncIOMotorClient:
    """Get the raw MongoDB client (for admin operations)."""
    if _client is None:
        raise RuntimeError("Database not initialized.")
    return _client


async def close_database():
    """Close database connection. Called at shutdown."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
        logger.info("Database connection closed")
