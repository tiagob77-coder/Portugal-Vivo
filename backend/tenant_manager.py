"""
Tenant Management
Handles tenant provisioning, database isolation, and tenant operations
"""
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, Dict, List
from datetime import datetime, timezone
import logging
import json
from slugify import slugify
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


def _serialize_tenant(tenant: Dict) -> str:
    """Serializa documento de tenant para JSON, convertendo datetimes."""
    tenant_json = tenant.copy()
    for field in ("created_at", "updated_at"):
        if field in tenant_json and isinstance(tenant_json[field], datetime):
            tenant_json[field] = tenant_json[field].isoformat()
    return json.dumps(tenant_json)


class TenantManager:
    """Manages tenants and their isolated databases"""

    def __init__(self, mongo_url: str, redis_url: str = "redis://localhost:6379"):
        self.mongo_url = mongo_url
        self.redis_url = redis_url
        self.client = AsyncIOMotorClient(
            mongo_url,
            maxPoolSize=50,
            minPoolSize=5,
            maxIdleTimeMS=30000,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
        )
        self.redis: Optional[aioredis.Redis] = None
        self._db_cache: Dict[str, any] = {}
        logger.info("TenantManager initialized")

    async def init_redis(self):
        """Initialize Redis connection"""
        try:
            self.redis = await aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis.ping()
            logger.info("✅ Redis connected successfully")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            self.redis = None

    async def close(self):
        """Close all connections"""
        if self.redis:
            await self.redis.close()
        self.client.close()

    def _get_tenant_db_name(self, tenant_id: str) -> str:
        """Generate database name for tenant"""
        return f"tenant_{slugify(tenant_id, separator='_')}_db"

    def _cache_key(self, tenant_id: str) -> str:
        return f"tenant:{tenant_id}"

    async def _invalidate_tenant_cache(self, tenant_id: str):
        """Remove tenant entry from Redis cache."""
        if self.redis:
            try:
                await self.redis.delete(self._cache_key(tenant_id))
            except Exception as e:
                logger.warning(f"Redis cache invalidation failed: {e}")

    async def get_tenant_db(self, tenant_id: str):
        """Get database instance for specific tenant"""
        if tenant_id in self._db_cache:
            return self._db_cache[tenant_id]

        db_name = self._get_tenant_db_name(tenant_id)
        db = self.client[db_name]
        self._db_cache[tenant_id] = db

        logger.info(f"📊 Database '{db_name}' assigned to tenant '{tenant_id}'")
        return db

    async def create_tenant(
        self,
        tenant_id: str,
        name: str,
        subdomain: str,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """Create a new tenant with isolated database"""

        # Validate tenant_id format
        tenant_slug = slugify(tenant_id, separator='_')
        if not tenant_slug:
            raise ValueError("Invalid tenant_id format")

        # Check if tenant already exists
        admin_db = self.client['admin_tenants']
        existing = await admin_db.tenants.find_one({"tenant_id": tenant_slug})
        if existing:
            raise ValueError(f"Tenant '{tenant_slug}' already exists")

        # Create tenant record
        tenant_doc = {
            "tenant_id": tenant_slug,
            "name": name,
            "subdomain": subdomain,
            "db_name": self._get_tenant_db_name(tenant_slug),
            "status": "active",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "metadata": metadata or {},
            "settings": {
                "max_pois": 10000,
                "max_routes": 500,
                "features_enabled": [
                    "iq_engine",
                    "gamification",
                    "ai_narratives"
                ]
            }
        }

        # Insert tenant
        result = await admin_db.tenants.insert_one(tenant_doc)
        tenant_doc["_id"] = str(result.inserted_id)

        # Initialize tenant database with collections and indexes
        tenant_db = await self.get_tenant_db(tenant_slug)
        await self._init_tenant_collections(tenant_db)

        # Cache tenant info in Redis
        if self.redis:
            try:
                await self.redis.setex(
                    self._cache_key(tenant_slug),
                    3600,
                    _serialize_tenant(tenant_doc)
                )
            except Exception as e:
                logger.warning(f"Redis cache write failed on create: {e}")

        logger.info(f"✅ Tenant '{tenant_slug}' created successfully")
        return tenant_doc

    async def _init_tenant_collections(self, db):
        """Initialize collections and all indexes for a new tenant."""
        from create_indexes import create_all_indexes

        collections = [
            "heritage_items",
            "routes",
            "users",
            "user_sessions",
            "user_progress",
            "contributions",
            "iq_processing_queue",
            "iq_processing_results",
            "reviews",
            "review_votes",
            "visits",
            "push_tokens",
            "notification_history",
            "gamification_profiles",
            "checkins",
            "user_preferences",
            "user_badges",
            "favorite_spots",
            "password_resets",
            "encyclopedia_articles",
            "notifications",
            "poi_translations",
        ]

        for collection in collections:
            await db.create_collection(collection, check_exists=False)

        await create_all_indexes(db)

        # review_votes: índice único para evitar votos duplicados
        await db.review_votes.create_index("key", unique=True)
        # push_tokens e notification_history (não cobertos pelo create_all_indexes)
        await db.push_tokens.create_index("user_id")
        await db.notification_history.create_index([("user_id", 1), ("sent_at", -1)])

        logger.info("Collections and indexes initialized for tenant database")

    async def get_tenant(self, tenant_id: str) -> Optional[Dict]:
        """Get tenant information"""
        # Try cache first
        if self.redis:
            try:
                cached = await self.redis.get(self._cache_key(tenant_id))
                if cached:
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Redis cache read failed: {e}")

        # Fetch from DB
        admin_db = self.client['admin_tenants']
        tenant = await admin_db.tenants.find_one(
            {"tenant_id": tenant_id},
            {"_id": 0}
        )

        if tenant and self.redis:
            try:
                await self.redis.setex(self._cache_key(tenant_id), 3600, _serialize_tenant(tenant))
            except Exception as e:
                logger.warning(f"Redis cache write failed: {e}")

        return tenant

    async def update_tenant(self, tenant_id: str, updates: Dict) -> Optional[Dict]:
        """Update tenant fields and invalidate cache."""
        admin_db = self.client['admin_tenants']
        updates["updated_at"] = datetime.now(timezone.utc)

        result = await admin_db.tenants.find_one_and_update(
            {"tenant_id": tenant_id},
            {"$set": updates},
            projection={"_id": 0},
            return_document=True
        )

        if result:
            await self._invalidate_tenant_cache(tenant_id)

        return result

    async def list_tenants(self, skip: int = 0, limit: int = 50) -> List[Dict]:
        """List all tenants"""
        admin_db = self.client['admin_tenants']
        tenants = await admin_db.tenants.find(
            {},
            {"_id": 0}
        ).skip(skip).limit(limit).to_list(limit)
        return tenants

    async def delete_tenant(self, tenant_id: str) -> bool:
        """Delete a tenant and its database"""
        tenant = await self.get_tenant(tenant_id)
        if not tenant:
            return False

        # Drop tenant database
        db_name = tenant["db_name"]
        await self.client.drop_database(db_name)

        # Remove tenant record
        admin_db = self.client['admin_tenants']
        await admin_db.tenants.delete_one({"tenant_id": tenant_id})

        # Clear Redis cache
        await self._invalidate_tenant_cache(tenant_id)

        # Clear local cache
        if tenant_id in self._db_cache:
            del self._db_cache[tenant_id]

        logger.info(f"🗑️ Tenant '{tenant_id}' deleted")
        return True

    async def get_tenant_stats(self, tenant_id: str) -> Dict:
        """Get statistics for a tenant"""
        tenant_db = await self.get_tenant_db(tenant_id)

        stats = {
            "tenant_id": tenant_id,
            "total_pois": await tenant_db.heritage_items.count_documents({}),
            "total_routes": await tenant_db.routes.count_documents({}),
            "total_users": await tenant_db.users.count_documents({}),
            "total_contributions": await tenant_db.contributions.count_documents({}),
            "database_size_mb": 0  # Would need to calculate actual size
        }

        return stats


# Global instance
tenant_manager: Optional[TenantManager] = None


def get_tenant_manager() -> TenantManager:
    """Get global tenant manager instance"""
    global tenant_manager
    if tenant_manager is None:
        raise RuntimeError("TenantManager not initialized")
    return tenant_manager


async def init_tenant_manager(mongo_url: str, redis_url: str = "redis://localhost:6379"):
    """Initialize global tenant manager"""
    global tenant_manager
    tenant_manager = TenantManager(mongo_url, redis_url)
    await tenant_manager.init_redis()
    logger.info("✅ Global TenantManager initialized")
    return tenant_manager
