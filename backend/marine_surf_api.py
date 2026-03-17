from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from services.marine_service import marine_service, SURF_SPOTS_PT
from services.tide_service import real_tide_service, TIDE_POINTS_PT
from models.api_models import User
from auth_api import require_auth

router = APIRouter()

_db = None


def set_marine_surf_db(database):
    global _db
    _db = database


# ========================
# REAL MARINE DATA ENDPOINTS (Open-Meteo)
# ========================


@router.get("/marine/waves")
async def get_real_wave_conditions(lat: float, lng: float):
    """Get REAL wave conditions from Open-Meteo Marine API"""
    conditions = await marine_service.get_wave_conditions(lat, lng)
    if not conditions:
        return {
            "available": False,
            "message": "Não foi possível obter dados de ondas para esta localização",
            "source": "open-meteo"
        }
    return conditions


@router.get("/marine/spots")
async def list_surf_spots():
    """List all Portuguese surf spots"""
    return {
        "spots": [
            {"id": spot_id, **spot}
            for spot_id, spot in SURF_SPOTS_PT.items()
        ],
        "total": len(SURF_SPOTS_PT)
    }


@router.get("/marine/spot/{spot_id}")
async def get_surf_spot_conditions(spot_id: str):
    """Get REAL conditions for a specific surf spot"""
    conditions = await marine_service.get_surf_spot_conditions(spot_id)
    if not conditions:
        raise HTTPException(status_code=404, detail="Surf spot not found")
    return conditions


@router.get("/marine/spots/all")
async def get_all_spots_conditions():
    """Get current conditions for all Portuguese surf spots"""
    return {
        "spots": await marine_service.get_all_spots_conditions(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "open-meteo"
    }


# ========================
# REAL TIDE DATA ENDPOINTS
# ========================


@router.get("/marine/tides")
async def get_real_tide_conditions(lat: float, lng: float):
    """Get REAL or calculated tide conditions for a coastal location"""
    conditions = await real_tide_service.get_current_tide(lat, lng)
    if not conditions:
        return {
            "available": False,
            "message": "Não foi possível obter dados de maré para esta localização",
        }
    return conditions


@router.get("/marine/tides/stations")
async def list_tide_stations():
    """List all Portuguese tide stations"""
    return {
        "stations": [
            {"id": station_id, **station}
            for station_id, station in TIDE_POINTS_PT.items()
        ],
        "total": len(TIDE_POINTS_PT)
    }


@router.get("/marine/tides/extremes")
async def get_tide_extremes(lat: float, lng: float):
    """Get tide extremes (high/low) for the next 24 hours"""
    return await real_tide_service.get_tide_extremes(lat, lng)


# ========================
# SURF ALERTS
# ========================

class SurfAlertPreferences(BaseModel):
    enabled: bool = False
    spots: List[str] = []  # List of spot IDs to monitor
    min_quality: str = "good"  # minimum quality to alert: fair, good, excellent
    notify_time: str = "morning"  # morning, afternoon, evening, anytime


@router.get("/alerts/surf")
async def get_surf_alert_preferences(current_user: User = Depends(require_auth)):
    """Get user's surf alert preferences"""
    prefs = await _db.surf_alerts.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0}
    )

    if not prefs:
        return SurfAlertPreferences()

    return SurfAlertPreferences(**prefs)


@router.put("/alerts/surf")
async def update_surf_alert_preferences(
    prefs: SurfAlertPreferences,
    current_user: User = Depends(require_auth)
):
    """Update user's surf alert preferences"""
    await _db.surf_alerts.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "user_id": current_user.user_id,
            "enabled": prefs.enabled,
            "spots": prefs.spots,
            "min_quality": prefs.min_quality,
            "notify_time": prefs.notify_time,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )

    return {"message": "Surf alert preferences updated"}


@router.get("/alerts/surf/check")
async def check_surf_conditions_for_alerts():
    """Check current surf conditions and return spots meeting alert criteria"""
    from services.marine_service import marine_service

    spots_conditions = await marine_service.get_all_spots_conditions()

    quality_levels = {"flat": 0, "poor": 1, "fair": 2, "good": 3, "excellent": 4}

    alerts = []
    for spot in spots_conditions:
        quality = spot.get("surf_quality", "fair")
        if quality_levels.get(quality, 0) >= quality_levels["good"]:
            alerts.append({
                "spot_id": spot["spot_id"],
                "spot_name": spot["spot"]["name"],
                "wave_height_m": spot["wave_height_m"],
                "surf_quality": quality,
                "message": f"Condições {quality} em {spot['spot']['name']}!"
            })

    return {
        "has_alerts": len(alerts) > 0,
        "alerts": alerts,
        "checked_at": datetime.now(timezone.utc).isoformat()
    }


# ========================
# FAVORITE SURF SPOTS
# ========================

class FavoriteSpot(BaseModel):
    spot_id: str
    spot_name: str
    added_at: Optional[datetime] = None
    notify_excellent: bool = True
    notify_good: bool = False


@router.get("/favorites/spots")
async def get_favorite_spots(current_user: User = Depends(require_auth)):
    """Get user's favorite surf spots with current conditions"""
    from services.marine_service import marine_service

    user_favorites = await _db.favorite_spots.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).to_list(20)

    if not user_favorites:
        return {"spots": [], "total": 0}

    # Get current conditions for favorite spots
    spots_with_conditions = []
    for fav in user_favorites:
        try:
            conditions = await marine_service.get_spot_conditions(fav["spot_id"])
            spots_with_conditions.append({
                **fav,
                "current_conditions": {
                    "wave_height_m": conditions.get("current", {}).get("wave_height_m"),
                    "surf_quality": conditions.get("current", {}).get("surf_quality"),
                    "wave_direction": conditions.get("current", {}).get("wave_direction_cardinal"),
                }
            })
        except Exception:
            spots_with_conditions.append({**fav, "current_conditions": None})

    return {"spots": spots_with_conditions, "total": len(spots_with_conditions)}


@router.post("/favorites/spots/{spot_id}")
async def add_favorite_spot(
    spot_id: str,
    notify_excellent: bool = True,
    notify_good: bool = False,
    current_user: User = Depends(require_auth)
):
    """Add a surf spot to favorites"""
    # Check if spot exists
    from services.marine_service import SURF_SPOTS
    spot = next((s for s in SURF_SPOTS if s["id"] == spot_id), None)
    if not spot:
        raise HTTPException(status_code=404, detail="Spot não encontrado")

    # Check if already favorited
    existing = await _db.favorite_spots.find_one({
        "user_id": current_user.user_id,
        "spot_id": spot_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Spot já está nos favoritos")

    await _db.favorite_spots.insert_one({
        "user_id": current_user.user_id,
        "spot_id": spot_id,
        "spot_name": spot["name"],
        "added_at": datetime.now(timezone.utc),
        "notify_excellent": notify_excellent,
        "notify_good": notify_good
    })

    return {"message": f"{spot['name']} adicionado aos favoritos"}


@router.delete("/favorites/spots/{spot_id}")
async def remove_favorite_spot(
    spot_id: str,
    current_user: User = Depends(require_auth)
):
    """Remove a surf spot from favorites"""
    result = await _db.favorite_spots.delete_one({
        "user_id": current_user.user_id,
        "spot_id": spot_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Spot não encontrado nos favoritos")

    return {"message": "Spot removido dos favoritos"}


@router.put("/favorites/spots/{spot_id}/notifications")
async def update_spot_notifications(
    spot_id: str,
    notify_excellent: bool = True,
    notify_good: bool = False,
    current_user: User = Depends(require_auth)
):
    """Update notification preferences for a favorite spot"""
    result = await _db.favorite_spots.update_one(
        {"user_id": current_user.user_id, "spot_id": spot_id},
        {"$set": {
            "notify_excellent": notify_excellent,
            "notify_good": notify_good
        }}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Spot não encontrado nos favoritos")

    return {"message": "Preferências de notificação atualizadas"}
