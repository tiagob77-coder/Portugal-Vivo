"""
Config API - Serves shared constants to frontend clients.
Eliminates the need for frontend to hardcode categories, regions, and badges.
"""
from fastapi import APIRouter
from shared_constants import (
    MAIN_CATEGORIES, SUBCATEGORIES, SUBCATEGORIES_BY_MAIN,
    REGIONS, ENCYCLOPEDIA_UNIVERSES, UNIVERSE_BADGES,
    GAMIFICATION_BADGES, DASHBOARD_BADGES, LEVEL_DEFINITIONS,
)

config_router = APIRouter(tags=["Config"])


@config_router.get("/config")
async def get_config():
    """Return all shared constants for frontend consumption."""
    return {
        "main_categories": MAIN_CATEGORIES,
        "subcategories_by_main": SUBCATEGORIES_BY_MAIN,
        "regions": REGIONS,
        "universes": ENCYCLOPEDIA_UNIVERSES,
        "badges": {
            "universe": UNIVERSE_BADGES,
            "gamification": GAMIFICATION_BADGES,
            "dashboard": DASHBOARD_BADGES,
        },
        "levels": LEVEL_DEFINITIONS,
    }


@config_router.get("/config/categories")
async def get_categories():
    """Return main categories with their subcategories."""
    return {
        "main_categories": MAIN_CATEGORIES,
        "subcategories": SUBCATEGORIES_BY_MAIN,
    }


@config_router.get("/config/regions")
async def get_regions():
    """Return all regions."""
    return {"regions": REGIONS}


@config_router.get("/config/badges")
async def get_badges():
    """Return all badge definitions."""
    return {
        "universe": UNIVERSE_BADGES,
        "gamification": GAMIFICATION_BADGES,
        "dashboard": DASHBOARD_BADGES,
    }
