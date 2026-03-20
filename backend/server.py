from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize the dependency injection database (new pattern)
from dependencies import init_database
init_database(mongo_url, os.environ['DB_NAME'])

# API Keys
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '')

# Max request body size (10MB)
MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024

# OpenAPI tag metadata for organized documentation
OPENAPI_TAGS = [
    {"name": "Heritage", "description": "POI discovery, search, and detail endpoints"},
    {"name": "Map", "description": "Map items, layers, and geospatial queries"},
    {"name": "Calendar", "description": "Cultural events, festivals, and calendar"},
    {"name": "Routes", "description": "Thematic routes and itineraries"},
    {"name": "Encyclopedia", "description": "Enciclopédia Viva universes and articles"},
    {"name": "Auth", "description": "Authentication, registration, and user management"},
    {"name": "Gamification", "description": "Badges, check-ins, leaderboards, and XP"},
    {"name": "Collections", "description": "Excel-imported cultural data collections"},
    {"name": "Epochs", "description": "Historical epoch classification and filtering"},
    {"name": "Agenda", "description": "Agenda Viral public events service"},
    {"name": "Stats", "description": "Platform statistics and health"},
    {"name": "Analytics", "description": "Engagement analytics and growth metrics"},
]

# Create the main app
app = FastAPI(
    title="Portugal Vivo API",
    description=(
        "API para a plataforma Portugal Vivo — descoberta interativa "
        "do património cultural português com mapa, enciclopédia, gamificação, "
        "e contribuições de utilizadores.\n\n"
        "**Endpoints públicos** não requerem autenticação. "
        "Endpoints protegidos requerem header `Authorization: Bearer <token>`."
    ),
    version="3.0.0",
    openapi_tags=OPENAPI_TAGS,
)

# Configure structured logging (JSON in production, colored dev format otherwise)
from structured_logging import setup_logging
setup_logging(os.environ.get('LOG_LEVEL', 'INFO'))
logger = logging.getLogger(__name__)

# Initialize Sentry monitoring and health check routes
from monitoring import init_monitoring
init_monitoring(app)

import time as _time
import secrets as _secrets
from starlette.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

# Standardized validation error response
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        errors.append({
            "field": ".".join(str(loc) for loc in err.get("loc", [])),
            "message": err.get("msg", ""),
            "type": err.get("type", ""),
        })
    return JSONResponse(
        status_code=422,
        content={"detail": "Dados inválidos", "type": "validation_error", "errors": errors},
    )

# Global exception handler for unhandled errors - standardized JSON format
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor", "type": "internal_error"},
    )

# Add rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.middleware("http")
async def csrf_middleware(request: Request, call_next):
    """CSRF double-submit cookie protection for state-changing requests."""
    _csrf_env = os.environ.get("ENVIRONMENT", "development")
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        # Skip CSRF for auth login/register (no cookie yet) and health checks
        path = request.url.path
        csrf_exempt = ("/api/auth/login", "/api/auth/register", "/api/auth/callback",
                       "/api/health", "/docs", "/openapi.json")
        if not any(path.startswith(p) for p in csrf_exempt):
            cookie_token = request.cookies.get("csrf_token")
            header_token = request.headers.get("X-CSRF-Token")
            if _csrf_env == "production" and (not cookie_token or cookie_token != header_token):
                from starlette.responses import JSONResponse
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF token missing or invalid"}
                )

    response = await call_next(request)

    # Set CSRF cookie if not present
    if "csrf_token" not in request.cookies:
        token = _secrets.token_urlsafe(32)
        response.set_cookie(
            "csrf_token", token, httponly=False, samesite="strict",
            secure=(_csrf_env == "production"), max_age=86400,
        )

    return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self)"
    return response

# In-memory auth rate limiter (per IP, for login/register/reset)
_auth_rate_store: Dict[str, list] = {}
AUTH_RATE_LIMIT = 10  # max attempts per window
AUTH_RATE_WINDOW = 60  # seconds

@app.middleware("http")
async def auth_rate_limit_middleware(request: Request, call_next):
    """Rate limit auth endpoints to prevent brute-force attacks"""
    path = request.url.path
    if request.method == "POST" and path in (
        "/api/auth/login", "/api/auth/register",
        "/api/auth/forgot-password", "/api/auth/reset-password"
    ):
        ip = request.client.host if request.client else "unknown"
        now = _time.monotonic()
        key = f"{ip}:{path}"
        timestamps = _auth_rate_store.get(key, [])
        # Prune old entries
        timestamps = [t for t in timestamps if now - t < AUTH_RATE_WINDOW]
        if len(timestamps) >= AUTH_RATE_LIMIT:
            return Response(
                status_code=429,
                content="Demasiadas tentativas. Tente novamente em 1 minuto.",
                headers={"Retry-After": str(AUTH_RATE_WINDOW)}
            )
        timestamps.append(now)
        _auth_rate_store[key] = timestamps
    return await call_next(request)

@app.middleware("http")
async def limit_request_body(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_BODY_BYTES:
        return Response(status_code=413, content="Request body too large")
    response = await call_next(request)
    # Add cache headers for static-like endpoints
    path = request.url.path
    if path in ("/api/categories", "/api/regions") or path.startswith("/api/config"):
        response.headers["Cache-Control"] = "public, max-age=3600"
    elif path == "/api/stats":
        response.headers["Cache-Control"] = "public, max-age=60"
    elif path.startswith("/api/map/") or path.startswith("/api/encyclopedia/"):
        response.headers["Cache-Control"] = "no-cache, max-age=0"
    return response

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start = _time.monotonic()
    response = await call_next(request)
    duration_ms = round((_time.monotonic() - start) * 1000, 1)
    if request.url.path.startswith("/api/"):
        logger.info(
            "%s %s %s %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={
                "method": request.method,
                "path": str(request.url.path),
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "ip": request.client.host if request.client else None,
            },
        )
    return response

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ========================
# MODELS (extracted to models/api_models.py)
# ========================
from models.api_models import (
    User, Location, HeritageItem, Route, NarrativeRequest, RoutePlanRequest, RoutePlanResponse,
    NearbyPOIRequest, NearbyPOIResponse, NarrativeResponse,
)

# Import shared constants from single source of truth
from shared_constants import CATEGORIES, REGIONS, ENCYCLOPEDIA_UNIVERSES, UNIVERSE_BADGES, GAMIFICATION_BADGES

# ========================
# AUTH (extracted to auth_api.py)
# ========================
from auth_api import auth_router, set_auth_db, get_current_user, require_auth, require_admin
set_auth_db(db)

# ========================
# HERITAGE ENDPOINTS (extracted to heritage_api.py)
# ========================
from heritage_api import heritage_router, set_heritage_db
set_heritage_db(db)



# ========================
# ROUTES (extracted to routes_inline_api.py)
# ========================
from routes_inline_api import routes_inline_router, set_routes_inline_db, set_routes_google_key
set_routes_inline_db(db)
set_routes_google_key(GOOGLE_MAPS_API_KEY)

# ========================
# NEARBY POIs (extracted to map_nearby_api.py)
# ========================
from map_nearby_api import map_nearby_router, set_map_nearby_db
set_map_nearby_db(db)

# ========================
# FAVORITES (extracted to favorites_api.py)
# ========================
from favorites_api import favorites_router, set_favorites_db, set_favorites_auth
set_favorites_db(db)
set_favorites_auth(require_auth)

# ========================
# NARRATIVE (extracted to narrative_api.py)
# ========================
from narrative_api import narrative_router, set_narrative_db, set_narrative_llm_key
set_narrative_db(db)
set_narrative_llm_key(EMERGENT_LLM_KEY)

# ========================
# COMMUNITY (extracted to community_api.py)
# ========================
from community_api import community_router, set_community_db, set_community_auth
set_community_db(db)
set_community_auth(require_auth)

# ========================
# ADMIN DASHBOARD + GALLERY + SHARE + STATS (extracted to admin_dashboard_api.py)
# ========================
from admin_dashboard_api import router as admin_dashboard_router, set_admin_dashboard_db
set_admin_dashboard_db(db)




# ========================
# GAMIFICATION PROGRESS (extracted to gamification_progress_api.py)
# ========================
from gamification_progress_api import gamification_progress_router, set_gamification_progress_db
set_gamification_progress_db(db)

# ========================
# CALENDAR (extracted to calendar_api.py)
# ========================
from calendar_api import calendar_router, set_calendar_db, _get_calendar_events
set_calendar_db(db)

# ========================
# DASHBOARD (extracted to dashboard_inline_api.py)
# ========================
from dashboard_inline_api import dashboard_inline_router, set_dashboard_inline_db, set_dashboard_redis_lb
set_dashboard_inline_db(db)


# ========================
# MOBILITY (extracted to mobility_extracted_api.py)
# ========================
from mobility_extracted_api import mobility_extracted_router, set_mobility_extracted_db
set_mobility_extracted_db(db)

from services.recommendation_service import create_recommendation_service
recommendation_service = create_recommendation_service(db)

# ========================
# DISCOVER FEED (extracted to discover_feed_api.py)
# ========================
from discover_feed_api import router as discover_feed_router, set_discover_feed_db, set_discover_recommendation_service
set_discover_feed_db(db)
set_discover_recommendation_service(recommendation_service)

# ========================
# PREFERENCES (extracted to preferences_api.py)
# ========================
from preferences_api import router as preferences_router, set_preferences_db
set_preferences_db(db)

# ========================
# EXPLORE MATRIX (extracted to explore_matrix_api.py)
# ========================
from explore_matrix_api import router as explore_matrix_router, set_explore_matrix_db
set_explore_matrix_db(db)

# ========================
# AUDIO GUIDES (extracted to audio_guide_api.py)
# ========================
from audio_guide_api import router as audio_guide_router, set_audio_guide_db
set_audio_guide_db(db)

# ========================
# MARINE & SURF (extracted to marine_surf_api.py)
# ========================
from marine_surf_api import router as marine_surf_router, set_marine_surf_db
set_marine_surf_db(db)

# ========================
# HEALTH CHECK
# ========================

@api_router.get("/")
async def root():
    return {"message": "Portugal Vivo API", "status": "online", "version": "2.0"}

@api_router.get("/health", tags=["Stats"])
async def health():
    """Health check with DB connectivity verification"""
    db_ok = False
    try:
        await db.command("ping")
        db_ok = True
    except Exception:
        pass
    status = "healthy" if db_ok else "degraded"
    return {"status": status, "database": "connected" if db_ok else "unreachable", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include Excel Importer router
from excel_importer_api import importer_router, set_importer_db
set_importer_db(db)
api_router.include_router(importer_router)

# Include Smart Route Generator router
from route_generator_api import route_gen_router, set_route_gen_db
set_route_gen_db(db)
api_router.include_router(route_gen_router)

# Include POI v19 Importer router
from poi_v19_importer import poi_v19_router, set_poi_v19_db
set_poi_v19_db(db)
api_router.include_router(poi_v19_router)

# Include IQ Monitor router
from iq_monitor_api import iq_monitor_router, set_iq_monitor_db
set_iq_monitor_db(db)
api_router.include_router(iq_monitor_router)

# Include POI do Dia router
from poi_dia_api import poi_dia_router, set_poi_dia_db
set_poi_dia_db(db)
api_router.include_router(poi_dia_router)

# Include Gamification router
from gamification_api import gamification_router, set_gamification_db
set_gamification_db(db)
api_router.include_router(gamification_router)

# Include Trails router
from trails_api import trails_router, set_db as set_trails_db
set_trails_db(db)
api_router.include_router(trails_router)

# Include Epochs router
from epochs_api import epochs_router, set_db as set_epochs_db
set_epochs_db(db)
api_router.include_router(epochs_router)

# Include Proximity router
from proximity_api import proximity_router, set_proximity_db
set_proximity_db(db)
api_router.include_router(proximity_router)

# Include Leaderboard router (Redis-powered)
from leaderboard_api import leaderboard_router, set_db as set_leaderboard_db
set_leaderboard_db(db)
api_router.include_router(leaderboard_router)
from services.redis_leaderboard import redis_lb
set_dashboard_redis_lb(redis_lb)

# Transport Guide
from transport_api import transport_router, set_transport_db
set_transport_db(db)
api_router.include_router(transport_router)

# Beachcam
from beachcam_api import beachcam_router
api_router.include_router(beachcam_router)

# Agenda Viral
from agenda_api import agenda_router, set_agenda_db, seed_grande_expedicao
set_agenda_db(db)
api_router.include_router(agenda_router)

# Smart Travel Planner
from planner_api import planner_router, set_planner_db
set_planner_db(db)
api_router.include_router(planner_router)

# Collections (Excel data)
from collections_api import collections_router, set_collections_db
set_collections_db(db)
api_router.include_router(collections_router)

# Premium & Monetization
from premium_api import premium_router, set_premium_db
set_premium_db(db)
api_router.include_router(premium_router)

# Premium Feature Guard
from premium_guard import set_premium_guard_db
set_premium_guard_db(db)

# Nature & Biodiversity (ICNF, GBIF, GeoAPI.pt)
from nature_api import nature_router
api_router.include_router(nature_router)

# Discovery - Sustainable Tourism Engine (cross-references events, nature, transport)
from discovery_api import discovery_router
api_router.include_router(discovery_router)

# Auth (extracted from server.py)
api_router.include_router(auth_router)

# Heritage + Accessibility (extracted from server.py)
api_router.include_router(heritage_router)

# Reviews (extracted from server.py)
from reviews_api import reviews_router, set_reviews_db, set_auth_deps as set_reviews_auth
set_reviews_db(db)
set_reviews_auth(require_auth)
api_router.include_router(reviews_router)

# Safety - Weather, Fire, Safety Check (extracted from server.py)
from safety_api import safety_router
api_router.include_router(safety_router)

# Search (extracted from server.py)
from search_api import search_router, set_search_db
set_search_db(db)
api_router.include_router(search_router)

# Notifications (extracted from server.py)
from notifications_api import notifications_router, set_notifications_db, set_notifications_auth
set_notifications_db(db)
set_notifications_auth(require_auth)
api_router.include_router(notifications_router)

# Encyclopedia (extracted from server.py)
from encyclopedia_api import encyclopedia_router, set_encyclopedia_db, seed_encyclopedia_if_empty
set_encyclopedia_db(db)
api_router.include_router(encyclopedia_router)

# Mobility - expanded (extracted from server.py)
api_router.include_router(mobility_extracted_router)

# Image Enrichment Service (P3)
from image_enrichment_api import image_router, set_image_db, set_image_auth
set_image_db(db)
set_image_auth(require_auth, require_admin)
api_router.include_router(image_router)

# Image Optimization Pipeline (WebP variants, compression, real image apply)
from image_optimization_api import optimization_router, set_optimization_db
set_optimization_db(db)
api_router.include_router(optimization_router)

# Newsletter Backend (P3 - replaces MOCKED frontend-only)
from newsletter_api import newsletter_router, set_newsletter_db
set_newsletter_db(db)
api_router.include_router(newsletter_router)

# Google OAuth Social Sign-In (P4)
from google_auth_api import google_auth_router, set_google_auth_db
set_google_auth_db(db)
api_router.include_router(google_auth_router)

# SEO - Open Graph, Sitemap, Share Pages (P4)
from seo_api import seo_router, set_seo_db
set_seo_db(db)
api_router.include_router(seo_router)

# Streaks & Active Gamification (P4)
from streaks_api import streaks_router, set_streaks_db
set_streaks_db(db)
api_router.include_router(streaks_router)

# Explore Nearby - Proximity-based POI discovery (P4)
from explore_nearby_api import explore_nearby_router, set_explore_nearby_db
set_explore_nearby_db(db)
api_router.include_router(explore_nearby_router)

# Route Sharing - Shareable route links (P4)
from route_sharing_api import route_sharing_router, set_route_sharing_db
set_route_sharing_db(db)
api_router.include_router(route_sharing_router)

# Smart Notifications - Proximity + Events (P4)
from smart_notifications_api import smart_notifications_router, set_smart_notifications_db
set_smart_notifications_db(db)
api_router.include_router(smart_notifications_router)

# Offline Region Packages (P4)
from offline_api import offline_router, set_offline_db
set_offline_db(db)
api_router.include_router(offline_router)

# Routes inline (extracted from server.py)
api_router.include_router(routes_inline_router)

# Map Nearby (extracted from server.py)
api_router.include_router(map_nearby_router)

# Favorites (extracted from server.py)
api_router.include_router(favorites_router)

# Narrative (extracted from server.py)
api_router.include_router(narrative_router)

# Community contributions (extracted from server.py)
api_router.include_router(community_router)

# Calendar events (extracted from server.py)
api_router.include_router(calendar_router)

# Admin Dashboard + Gallery + Share + Stats (extracted from server.py)
api_router.include_router(admin_dashboard_router)

# Gamification Progress (extracted from server.py)
api_router.include_router(gamification_progress_router)

# Dashboard inline - visit tracking, progress, badges, statistics (extracted from server.py)
api_router.include_router(dashboard_inline_router)

# Discover Feed - discovery, trending, seasonal (extracted from server.py)
api_router.include_router(discover_feed_router)

# Preferences (extracted from server.py)
api_router.include_router(preferences_router)

# Explore Matrix (extracted from server.py)
api_router.include_router(explore_matrix_router)

# Audio Guides (extracted from server.py)
api_router.include_router(audio_guide_router)

# Marine & Surf (extracted from server.py)
api_router.include_router(marine_surf_router)

# Translation - Multi-language POI translations
from translation_api import translation_router, set_translation_db
set_translation_db(db)
api_router.include_router(translation_router)

# Analytics Dashboard
from analytics_api import analytics_router, set_analytics_db
set_analytics_db(db)
api_router.include_router(analytics_router)

# Config - Shared constants for frontend
from config_api import config_router
api_router.include_router(config_router)

# User Image Uploads (Cloudinary or MongoDB fallback)
from upload_api import upload_router, set_upload_db, set_upload_auth
set_upload_db(db)
set_upload_auth(require_auth)
api_router.include_router(upload_router)
# Cloudinary Image Upload
from cloudinary_api import cloudinary_router, set_cloudinary_db
set_cloudinary_db(db)
api_router.include_router(cloudinary_router)

# CP Comboios de Portugal
from cp_api import cp_router
api_router.include_router(cp_router)

# Geo Administrative — CAOP (Carta Administrativa Oficial de Portugal)
from geo_administrative_api import geo_router, set_geo_db
set_geo_db(db)
api_router.include_router(geo_router)

# Ambassador Program
from ambassador_api import ambassador_router, set_ambassador_db, set_ambassador_auth
set_ambassador_db(db)
set_ambassador_auth(require_auth, require_admin)
api_router.include_router(ambassador_router)

# Saved Itineraries — Trip Planner persistence, collaboration, budget
from saved_itineraries_api import itineraries_router, set_itineraries_db, set_itineraries_auth
set_itineraries_db(db)
set_itineraries_auth(require_auth)
api_router.include_router(itineraries_router)

# Include the router in the main app
app.include_router(api_router)

_env = os.environ.get("ENVIRONMENT", "development")
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
if not ALLOWED_ORIGINS:
    if _env == "production":
        logger.warning("CORS_ORIGINS not set in production — defaulting to no origins")
        ALLOWED_ORIGINS = []
    else:
        ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:8081", "http://localhost:19006"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Tenant-ID", "X-CSRF-Token"],
    max_age=3600,
)

# ========================
# MULTI-TENANT SETUP
# ========================

from tenant_middleware import TenantMiddleware
from tenant_admin_api import admin_router
from tenant_manager import init_tenant_manager, get_tenant_manager

# Add per-user/endpoint rate limiting (after CORS)
from rate_limiter import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware)

# Add tenant middleware (after CORS)
app.add_middleware(TenantMiddleware, require_tenant=False)

# Include admin router
app.include_router(admin_router)

logger.info("🏗️ Multi-tenant middleware and admin routes registered")

# ========================
# IQ ENGINE SETUP
# ========================

from iq_engine_api import iq_router
from iq_engine_base import get_iq_engine
from iq_module_m1_semantic import SemanticValidationModule
from iq_module_m2_cognitive import CognitiveInferenceModule
from iq_module_m3_image import ImageQualityModule
from iq_module_m4_slug import SlugGeneratorModule
from iq_module_m5_address import AddressNormalizationModule
from iq_module_m6_dedup import DeduplicationModule
from iq_module_m12_thematic import ThematicRoutingModule
from iq_module_m13_m19_routing import (
    TimeRoutingModule, DifficultyRoutingModule, ProfileRoutingModule,
    WeatherRoutingModule, TimeOfDayRoutingModule, MultiDayRoutingModule,
    RouteOptimizerModule
)

# Include IQ Engine router
app.include_router(iq_router)

logger.info("🧠 IQ Engine routes registered")
logger.info("📥 Excel Importer routes registered")

@app.on_event("startup")
async def ensure_indexes():
    """Create MongoDB indexes for common query patterns."""
    try:
        await db.heritage_items.create_index("id", unique=True)
        await db.heritage_items.create_index("category")
        await db.heritage_items.create_index("region")
        await db.heritage_items.create_index([("location.lat", 1), ("location.lng", 1)])
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token")
        await db.user_sessions.create_index("user_id")
        await db.reviews.create_index("item_id")
        await db.checkins.create_index([("user_id", 1), ("poi_id", 1), ("checked_in_at", -1)])
        await db.events.create_index("region")
        await db.encyclopedia_articles.create_index("universe")
        await db.encyclopedia_articles.create_index("slug", unique=True)
        logger.info("MongoDB indexes ensured")
    except Exception as e:
        logger.warning("Index creation partial failure (non-critical): %s", e)


@app.on_event("startup")
async def startup_tenant_system():
    """Initialize tenant management system and Redis leaderboard"""
    try:
        await init_tenant_manager(mongo_url, redis_url)
        logger.info("✅ Tenant management system initialized")
    except Exception as e:
        logger.error("Failed to initialize tenant system: %s", e)

    # Initialize Redis leaderboard
    try:
        await redis_lb.init(redis_url, db)
        count = await redis_lb.sync_from_mongo()
        logger.info("Redis leaderboard initialized, synced %d users", count)
    except Exception as e:
        logger.error("Failed to initialize Redis leaderboard: %s", e)

    # Initialize IQ Engine
    try:
        engine = get_iq_engine()

        # Register modules M1-M3 (Validation)
        engine.register_module(SemanticValidationModule(use_ai=False))
        engine.register_module(CognitiveInferenceModule())
        engine.register_module(ImageQualityModule())

        # Register modules M4-M6 (Normalization)
        engine.register_module(SlugGeneratorModule())
        engine.register_module(AddressNormalizationModule(api_key=GOOGLE_MAPS_API_KEY))
        engine.register_module(DeduplicationModule())

        # Import and register M7-M8 (Scoring)
        from iq_module_m7_poi_scoring import POIScoringModule
        from iq_module_m8_route_scoring import RouteScoringModule
        engine.register_module(POIScoringModule())
        engine.register_module(RouteScoringModule())

        # Import and register M9-M11
        from iq_module_m9_enrichment import DataEnrichmentModule
        from iq_module_m11_description import DescriptionGenerationModule
        engine.register_module(DataEnrichmentModule(google_places_key=GOOGLE_MAPS_API_KEY))
        engine.register_module(DescriptionGenerationModule())

        # Register modules M12-M19 (Smart Routing)
        engine.register_module(ThematicRoutingModule())
        engine.register_module(TimeRoutingModule())
        engine.register_module(DifficultyRoutingModule())
        engine.register_module(ProfileRoutingModule())
        engine.register_module(WeatherRoutingModule())
        engine.register_module(TimeOfDayRoutingModule())
        engine.register_module(MultiDayRoutingModule())
        engine.register_module(RouteOptimizerModule())

        logger.info("IQ Engine initialized with %d modules", len(engine.modules))
    except Exception as e:
        logger.error("Failed to initialize IQ Engine: %s", e)

@app.on_event("startup")
async def seed_expedicao_data():
    """Seed Grande Expedição stages if collection is empty."""
    try:
        await seed_grande_expedicao(db)
    except Exception as e:
        logger.warning("Grande Expedição seed (non-critical): %s", e)

@app.on_event("startup")
async def seed_encyclopedia_data():
    """Seed encyclopedia articles from heritage_items if empty."""
    try:
        await seed_encyclopedia_if_empty(db)
    except Exception as e:
        logger.warning("Encyclopedia seed (non-critical): %s", e)

@app.on_event("startup")
async def sync_public_events():
    """Sync curated + public events into the events collection on startup."""
    try:
        from services.public_events_service import public_events_service
        public_events_service.set_db(db)
        count = await public_events_service.sync_to_events_collection()
        await db.events.create_index("id", unique=True)
        await db.events.create_index("month")
        logger.info("Synced %d public events to agenda", count)
    except Exception as e:
        logger.warning("Public events sync (non-critical): %s", e)

@app.on_event("shutdown")
async def shutdown_db_client():
    """Cleanup on shutdown"""
    try:
        await redis_lb.close()
        logger.info("Redis leaderboard closed")
    except Exception as e:
        logger.error("Redis shutdown error: %s", e)
    try:
        tenant_manager = get_tenant_manager()
        await tenant_manager.close()
        logger.info("Tenant manager connections closed")
    except Exception as e:
        logger.error("Shutdown error: %s", e)
    client.close()
    logger.info("MongoDB client closed")
