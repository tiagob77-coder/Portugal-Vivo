"""
Script para criar índices MongoDB otimizados para a aplicação Portugal Vivo.
Cobre as queries mais frequentes para performance.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

async def create_indexes():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    logger.info("Creating MongoDB indexes...")

    # heritage_items - core collection
    await db.heritage_items.create_index("id", unique=True, name="idx_heritage_id")
    await db.heritage_items.create_index("category", name="idx_heritage_category")
    await db.heritage_items.create_index("region", name="idx_heritage_region")
    await db.heritage_items.create_index([("category", 1), ("region", 1)], name="idx_heritage_cat_region")
    await db.heritage_items.create_index("slug", sparse=True, name="idx_heritage_slug")
    await db.heritage_items.create_index("iq_score", sparse=True, name="idx_heritage_iq_score")
    await db.heritage_items.create_index(
        [("name", "text"), ("description", "text")],
        default_language="portuguese",
        name="idx_heritage_text_search"
    )
    await db.heritage_items.create_index(
        [("location.lat", 1), ("location.lng", 1)],
        name="idx_heritage_location"
    )
    logger.info("  heritage_items: 8 indexes created")

    # users
    await db.users.create_index("user_id", unique=True, name="idx_users_userid")
    await db.users.create_index("email", unique=True, name="idx_users_email")
    logger.info("  users: 2 indexes created")

    # user_sessions
    await db.user_sessions.create_index("session_token", unique=True, name="idx_sessions_token")
    await db.user_sessions.create_index("user_id", name="idx_sessions_userid")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0, name="idx_sessions_ttl")
    logger.info("  user_sessions: 3 indexes created (with TTL)")

    # user_progress
    await db.user_progress.create_index("user_id", unique=True, name="idx_progress_userid")
    await db.user_progress.create_index("total_points", name="idx_progress_points")
    await db.user_progress.create_index([("user_id", 1), ("total_points", -1)], name="idx_progress_user_points")
    logger.info("  user_progress: 3 indexes created")

    # visits
    await db.visits.create_index("user_id", name="idx_visits_userid")
    await db.visits.create_index("poi_id", name="idx_visits_poiid")
    await db.visits.create_index([("user_id", 1), ("poi_id", 1)], name="idx_visits_user_poi")
    await db.visits.create_index("timestamp", name="idx_visits_timestamp")
    await db.visits.create_index([("user_id", 1), ("timestamp", -1)], name="idx_visits_user_time")
    logger.info("  visits: 5 indexes created")

    # gamification_profiles
    await db.gamification_profiles.create_index("user_id", unique=True, name="idx_gamification_userid")
    await db.gamification_profiles.create_index([("xp", -1)], name="idx_gamification_xp")
    await db.gamification_profiles.create_index([("user_id", 1), ("xp", -1)], name="idx_gamification_user_xp")
    logger.info("  gamification_profiles: 3 indexes created")

    # checkins
    await db.checkins.create_index("user_id", name="idx_checkins_userid")
    await db.checkins.create_index([("user_id", 1), ("checked_in_at", -1)], name="idx_checkins_user_time")
    await db.checkins.create_index([("user_id", 1), ("poi_id", 1)], name="idx_checkins_user_poi")
    logger.info("  checkins: 3 indexes created")

    # contributions
    await db.contributions.create_index("id", unique=True, name="idx_contrib_id")
    await db.contributions.create_index("status", name="idx_contrib_status")
    await db.contributions.create_index("user_id", name="idx_contrib_userid")
    await db.contributions.create_index("created_at", name="idx_contrib_created")
    logger.info("  contributions: 4 indexes created")

    # routes
    await db.routes.create_index("id", unique=True, name="idx_routes_id")
    await db.routes.create_index("category", name="idx_routes_category")
    await db.routes.create_index("region", name="idx_routes_region")
    logger.info("  routes: 3 indexes created")

    # user_preferences
    await db.user_preferences.create_index("user_id", unique=True, name="idx_prefs_userid")
    logger.info("  user_preferences: 1 index created")

    # user_badges
    await db.user_badges.create_index("user_id", name="idx_badges_userid")
    await db.user_badges.create_index([("user_id", 1), ("badge_id", 1)], unique=True, name="idx_badges_user_badge")
    logger.info("  user_badges: 2 indexes created")

    # favorite_spots
    await db.favorite_spots.create_index([("user_id", 1), ("spot_id", 1)], unique=True, name="idx_favspots_user_spot")
    logger.info("  favorite_spots: 1 index created")

    # password_resets
    await db.password_resets.create_index("token", name="idx_resets_token")
    await db.password_resets.create_index("expires_at", expireAfterSeconds=0, name="idx_resets_ttl")
    logger.info("  password_resets: 2 indexes created (with TTL)")

    # encyclopedia_articles
    await db.encyclopedia_articles.create_index("id", unique=True, sparse=True, name="idx_encyclopedia_id")
    await db.encyclopedia_articles.create_index("universe", sparse=True, name="idx_encyclopedia_universe")
    await db.encyclopedia_articles.create_index("slug", sparse=True, name="idx_encyclopedia_slug")
    logger.info("  encyclopedia_articles: 3 indexes created")

    # notifications
    await db.notifications.create_index("user_id", name="idx_notif_userid")
    await db.notifications.create_index([("user_id", 1), ("read", 1)], name="idx_notif_user_read")
    logger.info("  notifications: 2 indexes created")

    # reviews
    await db.reviews.create_index("item_id", name="idx_reviews_itemid")
    await db.reviews.create_index("user_id", name="idx_reviews_userid")
    logger.info("  reviews: 2 indexes created")

    # poi_translations
    await db.poi_translations.create_index(
        [("item_id", 1), ("language", 1)], unique=True, name="idx_translations_item_lang"
    )
    await db.poi_translations.create_index("language", name="idx_translations_language")
    await db.poi_translations.create_index("translated_at", name="idx_translations_translated_at")
    logger.info("  poi_translations: 3 indexes created")

    total = 8 + 2 + 3 + 3 + 5 + 3 + 3 + 4 + 3 + 1 + 2 + 1 + 2 + 3 + 2 + 2 + 3
    logger.info(f"\nTotal: {total} indexes created across 17 collections")

    client.close()

if __name__ == "__main__":
    asyncio.run(create_indexes())
