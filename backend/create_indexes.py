"""
Script para criar índices MongoDB otimizados para a aplicação Portugal Vivo.
Cobre as queries mais frequentes para performance.

A função create_all_indexes(db) pode ser importada pelo tenant_manager
para garantir que todos os tenants têm o conjunto completo de índices.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()


async def create_all_indexes(db):
    """
    Cria todos os índices necessários numa instância de base de dados.
    Pode ser chamada tanto pelo script standalone como pelo tenant_manager.
    """

    # heritage_items - core collection
    await db.heritage_items.create_index("id", unique=True, name="idx_heritage_id")
    await db.heritage_items.create_index("category", name="idx_heritage_category")
    await db.heritage_items.create_index("region", name="idx_heritage_region")
    await db.heritage_items.create_index([("category", 1), ("region", 1)], name="idx_heritage_cat_region")
    await db.heritage_items.create_index("slug", sparse=True, name="idx_heritage_slug")
    await db.heritage_items.create_index("iq_score", sparse=True, name="idx_heritage_iq_score")
    await db.heritage_items.create_index([("created_at", -1)], name="idx_heritage_created_at")
    await db.heritage_items.create_index(
        [("name", "text"), ("description", "text"), ("tags", "text")],
        default_language="portuguese",
        weights={"name": 10, "tags": 5, "description": 1},
        name="idx_heritage_text_search"
    )
    await db.heritage_items.create_index(
        [("location.lat", 1), ("location.lng", 1)],
        name="idx_heritage_location"
    )
    await db.heritage_items.create_index(
        [("geo_location", "2dsphere")],
        sparse=True,
        name="idx_heritage_geo_2dsphere"
    )
    # Multi-tenant hot paths — tenant-scoped browsing and proximity
    await db.heritage_items.create_index(
        "municipality_id", sparse=True, name="idx_heritage_muni"
    )
    await db.heritage_items.create_index(
        [("municipality_id", 1), ("category", 1)],
        sparse=True,
        name="idx_heritage_muni_cat",
    )
    await db.heritage_items.create_index(
        [("municipality_id", 1), ("iq_score", -1)],
        sparse=True,
        name="idx_heritage_muni_iq",
    )
    # 2dsphere compound — $near + municipality filter (proximity_api.nearby)
    await db.heritage_items.create_index(
        [("geo_location", "2dsphere"), ("municipality_id", 1)],
        sparse=True,
        name="idx_heritage_geo_muni",
    )
    logger.info("  heritage_items: 14 indexes created")

    # users
    await db.users.create_index("user_id", unique=True, name="idx_users_userid")
    await db.users.create_index("email", unique=True, name="idx_users_email")
    logger.info("  users: 2 indexes created")

    # user_sessions - TTL automático via expireAfterSeconds=0 (expira quando expires_at < now)
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
    await db.visits.create_index("category", sparse=True, name="idx_visits_category")
    await db.visits.create_index("region", sparse=True, name="idx_visits_region")
    logger.info("  visits: 7 indexes created")

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
    # Compound para queries de moderação: filtrar por status e ordenar por data
    await db.contributions.create_index(
        [("status", 1), ("created_at", -1)], name="idx_contrib_status_date"
    )
    logger.info("  contributions: 5 indexes created")

    # routes
    await db.routes.create_index("id", unique=True, name="idx_routes_id")
    await db.routes.create_index("category", name="idx_routes_category")
    await db.routes.create_index("region", name="idx_routes_region")
    await db.routes.create_index(
        [("share_count", -1)], sparse=True, name="idx_routes_share_count"
    )
    logger.info("  routes: 4 indexes created")

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

    # password_resets - TTL de 1 hora
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
    await db.notifications.create_index(
        [("user_id", 1), ("created_at", -1)], name="idx_notif_user_date"
    )
    logger.info("  notifications: 3 indexes created")

    # notification_history - TTL de 90 dias para histórico de push
    await db.notification_history.create_index(
        [("user_id", 1), ("sent_at", -1)], name="idx_notif_history_user_date"
    )
    await db.notification_history.create_index(
        "sent_at", expireAfterSeconds=7776000, name="idx_notif_history_ttl"  # 90 dias
    )
    logger.info("  notification_history: 2 indexes created (with TTL 90d)")

    # push_tokens
    await db.push_tokens.create_index(
        [("user_id", 1), ("token", 1)], unique=True, name="idx_push_tokens_user_token"
    )
    logger.info("  push_tokens: 1 index created")

    # notification_prefs
    await db.notification_prefs.create_index("user_id", unique=True, name="idx_notif_prefs_userid")
    logger.info("  notification_prefs: 1 index created")

    # reviews
    await db.reviews.create_index("item_id", name="idx_reviews_itemid")
    await db.reviews.create_index("user_id", name="idx_reviews_userid")
    await db.reviews.create_index([("user_id", 1), ("item_id", 1)], unique=True, name="idx_reviews_unique_user_item")
    await db.reviews.create_index([("item_id", 1), ("created_at", -1)], name="idx_reviews_item_date")
    await db.reviews.create_index(
        [("item_id", 1), ("rating", -1)], name="idx_reviews_item_rating"
    )
    await db.reviews.create_index(
        [("item_id", 1), ("helpful_votes", -1)], name="idx_reviews_item_helpful"
    )
    logger.info("  reviews: 6 indexes created")

    # poi_translations
    await db.poi_translations.create_index(
        [("item_id", 1), ("language", 1)], unique=True, name="idx_translations_item_lang"
    )
    await db.poi_translations.create_index("language", name="idx_translations_language")
    await db.poi_translations.create_index("translated_at", name="idx_translations_translated_at")
    logger.info("  poi_translations: 3 indexes created")

    # iq_processing_queue - índice de status para queries de itens pendentes + TTL de 7 dias
    await db.iq_processing_queue.create_index(
        [("status", 1), ("created_at", 1)], name="idx_iq_queue_status_date"
    )
    await db.iq_processing_queue.create_index(
        "created_at", expireAfterSeconds=604800, name="idx_iq_queue_ttl"  # 7 dias
    )
    logger.info("  iq_processing_queue: 2 indexes created (with TTL 7d)")

    # iq_processing_results - TTL de 30 dias para resultados processados
    await db.iq_processing_results.create_index("item_id", name="idx_iq_results_item")
    await db.iq_processing_results.create_index(
        "created_at", expireAfterSeconds=2592000, name="idx_iq_results_ttl"  # 30 dias
    )
    logger.info("  iq_processing_results: 2 indexes created (with TTL 30d)")

    # schema_versions - track database migrations
    await db.schema_versions.create_index("version", unique=True, name="idx_schema_version")
    logger.info("  schema_versions: 1 index created")

    # --- narrative_cache (dedicated LLM narrative cache) ---
    await db.narrative_cache.create_index("cache_key", unique=True)
    await db.narrative_cache.create_index("poi_id")
    await db.narrative_cache.create_index("generated_at")
    logger.info("  narrative_cache: 3 indexes created")

    # --- narratives (cultural narratives upload/curate/publish) ---
    await db.narratives.create_index("id", unique=True)
    await db.narratives.create_index("status")
    await db.narratives.create_index("theme")
    await db.narratives.create_index("region")
    await db.narratives.create_index("poi_id")
    await db.narratives.create_index("created_at")
    await db.narratives.create_index([("title", "text"), ("summary", "text"), ("story_text", "text")])
    logger.info("  narratives: 7 indexes created")

    # --- events (agenda / discover / smart notifications) ---
    await db.events.create_index("id", unique=True, sparse=True, name="idx_events_id")
    await db.events.create_index("region", sparse=True, name="idx_events_region")
    await db.events.create_index("month", sparse=True, name="idx_events_month")
    await db.events.create_index(
        [("month", 1), ("region", 1)], sparse=True, name="idx_events_month_region"
    )
    await db.events.create_index("date_start", sparse=True, name="idx_events_date_start")
    await db.events.create_index("type", sparse=True, name="idx_events_type")
    await db.events.create_index(
        "municipality_id", sparse=True, name="idx_events_muni"
    )
    await db.events.create_index(
        [("location.lat", 1), ("location.lng", 1)],
        sparse=True,
        name="idx_events_location",
    )
    logger.info("  events: 8 indexes created")

    # --- maritime_events (maritime culture narratives) ---
    await db.maritime_events.create_index("id", unique=True, sparse=True, name="idx_maritime_id")
    await db.maritime_events.create_index("region", sparse=True, name="idx_maritime_region")
    await db.maritime_events.create_index(
        [("location.lat", 1), ("location.lng", 1)],
        sparse=True,
        name="idx_maritime_location",
    )
    logger.info("  maritime_events: 3 indexes created")

    # --- cultural_routes (cultural routes hub) ---
    await db.cultural_routes.create_index("id", unique=True, sparse=True, name="idx_cultural_routes_id")
    await db.cultural_routes.create_index("region", sparse=True, name="idx_cultural_routes_region")
    await db.cultural_routes.create_index("family", sparse=True, name="idx_cultural_routes_family")
    await db.cultural_routes.create_index(
        [("family", 1), ("region", 1)],
        sparse=True,
        name="idx_cultural_routes_family_region",
    )
    logger.info("  cultural_routes: 4 indexes created")

    # --- streaks (gamification daily streak) ---
    await db.streaks.create_index("user_id", unique=True, name="idx_streaks_user")
    logger.info("  streaks: 1 index created")

    # --- notification_log (dedup for proximity pushes, TTL 30d) ---
    await db.notification_log.create_index(
        [("user_id", 1), ("poi_id", 1), ("sent_at", -1)],
        name="idx_notif_log_user_poi_date",
    )
    await db.notification_log.create_index(
        "sent_at", expireAfterSeconds=2592000, name="idx_notif_log_ttl"
    )
    logger.info("  notification_log: 2 indexes created (with TTL 30d)")

    # --- notification_preferences (smart notifications prefs, distinct from notification_prefs) ---
    await db.notification_preferences.create_index(
        "user_id", unique=True, name="idx_notif_prefs_smart_user"
    )
    logger.info("  notification_preferences: 1 index created")

    # --- Total ---
    # heritage_items: 14, users: 2, user_sessions: 3, user_progress: 3,
    # visits: 7, gamification_profiles: 3, checkins: 3, contributions: 5,
    # routes: 4, user_preferences: 1, user_badges: 2, favorite_spots: 1,
    # password_resets: 2, encyclopedia_articles: 3, notifications: 3,
    # notification_history: 2, push_tokens: 1, notification_prefs: 1,
    # reviews: 6, poi_translations: 3, iq_processing_queue: 2,
    # iq_processing_results: 2, schema_versions: 1,
    # narrative_cache: 3, narratives: 7,
    # events: 8, maritime_events: 3, cultural_routes: 4, streaks: 1,
    # notification_log: 2, notification_preferences: 1
    total = (
        14 + 2 + 3 + 3 + 7 + 3 + 3 + 5 + 4 + 1 + 2 + 1 + 2 + 3 + 3 + 2
        + 1 + 1 + 6 + 3 + 2 + 2 + 1 + 3 + 7
        + 8 + 3 + 4 + 1 + 2 + 1
    )
    logger.info(f"\nTotal: {total} indexes across 31 collections")


async def create_indexes():
    """Script standalone para criação de índices numa base de dados existente."""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    logger.info(f"Creating MongoDB indexes on '{db_name}'...")
    await create_all_indexes(db)
    client.close()


if __name__ == "__main__":
    asyncio.run(create_indexes())
