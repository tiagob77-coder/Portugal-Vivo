"""
Safety API - Weather, fire, and safety endpoints extracted from server.py.
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone

from services.ipma_service import ipma_service, IPMA_LOCATIONS, IPMA_DISTRICTS
from services.fogos_service import fogos_service

safety_router = APIRouter()


# ========================
# IPMA - WEATHER ALERTS & FORECASTS
# ========================

@safety_router.get("/weather/alerts")
async def get_weather_alerts():
    """Get active weather alerts from IPMA"""
    alerts = await ipma_service.get_weather_alerts()
    return {
        "alerts": [a.dict() for a in alerts],
        "total": len(alerts),
        "source": "IPMA - Instituto Portugues do Mar e da Atmosfera",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@safety_router.get("/weather/forecast/{location}")
async def get_weather_forecast(location: str):
    """Get 5-day weather forecast for a location"""
    location_id = ipma_service.get_location_id(location)
    if not location_id:
        try:
            location_id = int(location)
        except ValueError:
            raise HTTPException(
                status_code=404,
                detail=f"Location '{location}' not found. Available: {list(IPMA_LOCATIONS.keys())}"
            )

    forecasts = await ipma_service.get_forecast(location_id)
    return {
        "location": location,
        "location_id": location_id,
        "forecasts": [f.dict() for f in forecasts],
        "source": "IPMA",
    }


@safety_router.get("/weather/fire-risk")
async def get_fire_risk(district: Optional[str] = None):
    """Get fire risk index from IPMA"""
    district_id = None
    if district:
        district_id = ipma_service.get_district_id(district)

    risks = await ipma_service.get_fire_risk(district_id)
    return {
        "fire_risks": [r.dict() for r in risks],
        "total": len(risks),
        "source": "IPMA - Risco de Incendio",
        "legend": {
            1: "Reduzido (verde)",
            2: "Moderado (amarelo)",
            3: "Elevado (laranja)",
            4: "Muito Elevado (vermelho)",
            5: "Maximo (roxo)"
        }
    }


@safety_router.get("/weather/locations")
async def list_weather_locations():
    """List available weather forecast locations"""
    return {
        "locations": IPMA_LOCATIONS,
        "districts": IPMA_DISTRICTS,
    }


# ========================
# FOGOS.PT - WILDFIRES
# ========================

@safety_router.get("/fires/active")
async def get_active_fires(district: Optional[str] = None):
    """Get active wildfires in Portugal from Fogos.pt"""
    fires = await fogos_service.get_active_fires(district)
    return {
        "fires": [f.dict() for f in fires],
        "total": len(fires),
        "active_count": len([f for f in fires if f.status.value == "active"]),
        "source": "Fogos.pt / Protecao Civil",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@safety_router.get("/fires/nearby")
async def get_fires_nearby(lat: float, lng: float, radius_km: float = 50):
    """Get active fires near a location"""
    fires = await fogos_service.get_fires_near_location(lat, lng, radius_km)
    return {
        "location": {"lat": lat, "lng": lng},
        "radius_km": radius_km,
        "fires": [f.dict() for f in fires],
        "total": len(fires),
        "warning": "Dados em tempo real - verifique sempre fontes oficiais" if fires else None,
    }


@safety_router.get("/fires/stats")
async def get_fire_stats():
    """Get daily wildfire statistics"""
    stats = await fogos_service.get_fire_stats()
    if not stats:
        return {"message": "Sem dados de incendios disponiveis"}
    return stats.dict()


@safety_router.get("/fires/danger-zones")
async def get_danger_zones(lat: float, lng: float, radius_km: float = 100):
    """Get danger zone analysis for trip planning"""
    return await fogos_service.get_danger_zones(lat, lng, radius_km)


@safety_router.get("/safety/check")
async def safety_check(lat: float, lng: float):
    """Combined safety check - weather alerts + fires"""
    alerts = await ipma_service.get_weather_alerts()
    active_alerts = [a.dict() for a in alerts if a.level.value in ["orange", "red"]]

    fires = await fogos_service.get_fires_near_location(lat, lng, 50)
    significant_fires = [f.dict() for f in fires if f.importance.value in ["significant", "important"]]

    if significant_fires or any(a["level"] == "red" for a in active_alerts):
        safety_level = "danger"
        message = "PERIGO: Existem riscos significativos na area. Tome precaucoes."
    elif fires or active_alerts:
        safety_level = "warning"
        message = "ATENCAO: Existem alertas ativos na regiao. Mantenha-se informado."
    else:
        safety_level = "safe"
        message = "Sem alertas significativos na area."

    return {
        "location": {"lat": lat, "lng": lng},
        "safety_level": safety_level,
        "message": message,
        "weather_alerts": active_alerts,
        "nearby_fires": significant_fires,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
