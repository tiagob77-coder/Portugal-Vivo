"""
context_orchestrator_api.py — Smart Context Orchestrator

O "cérebro" do Portugal Vivo: recebe contexto do utilizador (localização, hora,
perfil, histórico) e retorna acções inteligentes — módulos a activar, sugestões
contextuais e dados pré-carregados de múltiplos módulos.

Padrão: set_orchestrator_db(database) + _db global (como todos os módulos).
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import math
import logging

from module_registry import (
    MODULE_REGISTRY,
    evaluate_modules,
    resolve_dependencies,
    public_catalog as modules_catalog,
)
from workflow_chains import (
    select_chain,
    expand_chain_to_actions,
    public_catalog as chains_catalog,
)

orchestrator_router = APIRouter(prefix="/orchestrator", tags=["Smart Orchestrator"])
_db = None
logger = logging.getLogger("orchestrator")


def set_orchestrator_db(database) -> None:
    global _db
    _db = database


# ─── Models ────────────────────────────────────────────────────────────────────

class UserContext(BaseModel):
    """Contexto enviado pelo frontend a cada mudança significativa."""
    lat: Optional[float] = None
    lng: Optional[float] = None
    user_id: Optional[str] = None
    hour: Optional[int] = Field(None, ge=0, le=23)
    day_of_week: Optional[int] = Field(None, ge=0, le=6)  # 0=Mon
    month: Optional[int] = Field(None, ge=1, le=12)
    is_premium: bool = False
    traveler_profile: Optional[str] = None  # aventureiro|gastronomo|cultural|familia
    active_tab: Optional[str] = None  # descobrir|mapa|experienciar|profile
    last_categories_viewed: List[str] = []
    connectivity: str = "online"  # online|slow|offline


class SmartAction(BaseModel):
    """Uma acção sugerida pelo orquestrador."""
    type: str  # navigate|notify|preload|highlight|suggest
    priority: int = Field(ge=1, le=10, default=5)
    title: str
    subtitle: Optional[str] = None
    icon: Optional[str] = None  # MaterialIcons name
    route: Optional[str] = None  # Expo Router path
    data: Optional[Dict[str, Any]] = None
    module: str  # Módulo de origem


class OrchestratorResponse(BaseModel):
    """Resposta completa do orquestrador."""
    active_modules: List[str]
    actions: List[SmartAction]
    preloaded: Dict[str, Any] = {}
    context_label: str  # "morning_nature"|"evening_gastro"|"weekend_family"


# ─── Haversine ─────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── Context Classification ───────────────────────────────────────────────────

def _classify_context(ctx: UserContext) -> str:
    """Classifica o contexto numa label semântica."""
    hour = ctx.hour if ctx.hour is not None else datetime.now(timezone.utc).hour
    month = ctx.month if ctx.month is not None else datetime.now(timezone.utc).month
    profile = ctx.traveler_profile or "cultural"
    is_weekend = ctx.day_of_week in (5, 6) if ctx.day_of_week is not None else False

    time_slot = "morning" if hour < 12 else "afternoon" if hour < 18 else "evening"
    season = (
        "summer" if month in (6, 7, 8) else
        "winter" if month in (12, 1, 2) else
        "spring" if month in (3, 4, 5) else "autumn"
    )

    parts = [time_slot]
    if is_weekend:
        parts.append("weekend")
    parts.append(profile)
    if season in ("summer",):
        parts.append("beach")
    return "_".join(parts)


# ─── Module Activation ────────────────────────────────────────────────────────
# Rules now live in module_registry.MODULE_REGISTRY (single source of truth).

def _get_active_modules(ctx: UserContext) -> List[str]:
    hour = ctx.hour if ctx.hour is not None else datetime.now(timezone.utc).hour
    month = ctx.month if ctx.month is not None else datetime.now(timezone.utc).month
    active = evaluate_modules(ctx, hour, month)
    # Auto-include dependencies so downstream code never asks for a missing one.
    return resolve_dependencies(active)


# ─── Smart Actions Generator ──────────────────────────────────────────────────

async def _generate_actions(ctx: UserContext, active: List[str]) -> List[SmartAction]:
    actions: List[SmartAction] = []
    hour = ctx.hour if ctx.hour is not None else datetime.now(timezone.utc).hour
    month = ctx.month if ctx.month is not None else datetime.now(timezone.utc).month

    # ── Proximity-based actions ──
    if ctx.lat and ctx.lng and _db is not None:
        nearby = await _db.heritage_items.find({
            "location": {
                "$nearSphere": {
                    "$geometry": {"type": "Point", "coordinates": [ctx.lng, ctx.lat]},
                    "$maxDistance": 2000,  # 2km
                }
            }
        }).to_list(5)

        if nearby:
            top = nearby[0]
            dist = _haversine(ctx.lat, ctx.lng, top["location"]["coordinates"][1], top["location"]["coordinates"][0])
            actions.append(SmartAction(
                type="highlight",
                priority=9,
                title=top.get("name", "Local próximo"),
                subtitle=f"A {int(dist * 1000)}m de si",
                icon="place",
                route=f"/heritage/{top['_id']}",
                module="heritage",
                data={"distance_m": int(dist * 1000), "category": top.get("category", "")},
            ))

        # Trail suggestion if morning + near nature
        if hour < 14 and "trails" in active:
            trails = await _db.trails.find({
                "start_location": {
                    "$nearSphere": {
                        "$geometry": {"type": "Point", "coordinates": [ctx.lng, ctx.lat]},
                        "$maxDistance": 10000,
                    }
                }
            }).to_list(3)
            for t in trails[:1]:
                actions.append(SmartAction(
                    type="suggest",
                    priority=7,
                    title=f"Trilho: {t.get('name', 'Percurso')}",
                    subtitle=f"{t.get('distance_km', '?')} km · {t.get('difficulty', 'moderado')}",
                    icon="terrain",
                    route=f"/trail/{t['_id']}",
                    module="trails",
                ))

    # ── Time-based actions ──
    if 11 <= hour <= 14 and "gastronomy" in active:
        actions.append(SmartAction(
            type="suggest",
            priority=6,
            title="Hora de almoço",
            subtitle="Descubra gastronomia local perto de si",
            icon="restaurant",
            route="/gastronomia",
            module="gastronomy",
        ))

    if hour >= 18 and "nightlife" in active:
        actions.append(SmartAction(
            type="suggest",
            priority=5,
            title="Modo noturno",
            subtitle="Explore o mapa nocturno com eventos ao vivo",
            icon="nightlife",
            route="/(tabs)/mapa",
            data={"mapMode": "noturno"},
            module="nightlife",
        ))

    # ── Season-based actions ──
    if month in (6, 7, 8) and "beaches" in active:
        actions.append(SmartAction(
            type="suggest",
            priority=6,
            title="Praias e mar",
            subtitle="Condições de praia, surf e webcams",
            icon="beach-access",
            route="/costa",
            module="beaches",
        ))

    # ── Profile-based actions ──
    if ctx.traveler_profile == "aventureiro":
        actions.append(SmartAction(
            type="suggest",
            priority=4,
            title="Desafio do dia",
            subtitle="Complete uma missão de exploração",
            icon="emoji-events",
            route="/gamification",
            module="gamification",
        ))
    elif ctx.traveler_profile == "cultural":
        actions.append(SmartAction(
            type="suggest",
            priority=4,
            title="Enciclopédia Viva",
            subtitle="Novos artigos sobre história e património",
            icon="auto-stories",
            route="/encyclopedia",
            module="encyclopedia",
        ))

    # ── Safety alerts (always check) ──
    if _db is not None:
        fires = await _db.safety_alerts.find({
            "type": "fire",
            "active": True,
        }).to_list(3)
        if fires:
            actions.append(SmartAction(
                type="notify",
                priority=10,
                title=f"{len(fires)} incêndio(s) ativo(s)",
                subtitle="Consulte o mapa de segurança",
                icon="warning",
                route="/(tabs)/mapa",
                data={"mapMode": "explorador"},
                module="safety",
            ))

    # ── Events today ──
    if _db is not None:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        events = await _db.calendar_events.find({
            "date": {"$regex": f"^{today}"}
        }).to_list(3)
        if events:
            actions.append(SmartAction(
                type="highlight",
                priority=7,
                title=f"{len(events)} evento(s) hoje",
                subtitle=events[0].get("title", ""),
                icon="event",
                route="/evento/" + str(events[0].get("_id", "")),
                module="events",
            ))

    # ── Workflow chain expansion ──
    # If the current context label matches a registered chain, append its
    # ordered steps so the frontend can run them sequentially.
    label = _classify_context(ctx)
    chain = select_chain(label, active)
    if chain:
        for step in expand_chain_to_actions(chain):
            actions.append(SmartAction(
                type=step["type"],
                priority=step["priority"],
                title=step["title"],
                subtitle=step.get("subtitle"),
                icon=step.get("icon"),
                route=step.get("route"),
                data=step.get("data"),
                module=step["module"],
            ))

    # Sort by priority (highest first)
    actions.sort(key=lambda a: a.priority, reverse=True)
    return actions[:12]  # Max 12 actions (raised from 8 to fit chains)


# ─── Preload Data ──────────────────────────────────────────────────────────────

async def _preload_data(ctx: UserContext, active: List[str]) -> Dict[str, Any]:
    """Pré-carrega dados dos módulos activos para evitar waterfalls no frontend."""
    preloaded: Dict[str, Any] = {}
    if _db is None:
        return preloaded

    # Weather if available
    if "weather" in active and ctx.lat and ctx.lng:
        weather = await _db.weather_cache.find_one(
            {"region": {"$exists": True}},
            sort=[("updated_at", -1)],
        )
        if weather:
            preloaded["weather"] = {
                "description": weather.get("description", ""),
                "temp": weather.get("temp"),
                "icon": weather.get("icon", ""),
            }

    # User stats if authenticated
    if ctx.user_id and "gamification" in active:
        progress = await _db.user_progress.find_one({"user_id": ctx.user_id})
        if progress:
            preloaded["gamification"] = {
                "level": progress.get("level", 1),
                "xp": progress.get("xp", 0),
                "badges_count": len(progress.get("badges", [])),
                "active_streak": progress.get("active_streak", 0),
            }

    # POI count by active modules
    if ctx.lat and ctx.lng:
        nearby_count = await _db.heritage_items.count_documents({
            "location": {
                "$nearSphere": {
                    "$geometry": {"type": "Point", "coordinates": [ctx.lng, ctx.lat]},
                    "$maxDistance": 5000,
                }
            }
        })
        preloaded["nearby_count"] = nearby_count

    return preloaded


# ─── Main Endpoint ─────────────────────────────────────────────────────────────

@orchestrator_router.post("/context", response_model=OrchestratorResponse)
async def process_context(ctx: UserContext):
    """
    Endpoint principal do orquestrador.
    Recebe contexto → retorna módulos activos, acções e dados pré-carregados.
    """
    try:
        label = _classify_context(ctx)
        active = _get_active_modules(ctx)
        actions = await _generate_actions(ctx, active)
        preloaded = await _preload_data(ctx, active)

        return OrchestratorResponse(
            active_modules=active,
            actions=actions,
            preloaded=preloaded,
            context_label=label,
        )
    except Exception as e:
        logger.error("Orchestrator error: %s", e)
        # Fallback — never break the app
        return OrchestratorResponse(
            active_modules=["heritage", "map", "safety", "weather", "events"],
            actions=[],
            preloaded={},
            context_label="fallback",
        )


# ─── Smart Search — Cross-Module POI Discovery ────────────────────────────────

# All collections that contain geo-located items
POI_SOURCES = [
    {"collection": "heritage_items", "module": "heritage", "icon": "account-balance", "route_prefix": "/heritage"},
    {"collection": "trails", "module": "trails", "icon": "terrain", "route_prefix": "/trail"},
    {"collection": "calendar_events", "module": "events", "icon": "event", "route_prefix": "/evento"},
    {"collection": "coastal_gastronomy", "module": "gastronomy", "icon": "restaurant", "route_prefix": "/gastronomia"},
    {"collection": "flora_species", "module": "flora", "icon": "local-florist", "route_prefix": "/flora"},
    {"collection": "fauna_species", "module": "fauna", "icon": "pets", "route_prefix": "/fauna"},
    {"collection": "marine_species", "module": "marine_bio", "icon": "water", "route_prefix": "/biodiversidade"},
    {"collection": "coastal_data", "module": "costa", "icon": "waves", "route_prefix": "/costa"},
    {"collection": "maritime_culture", "module": "maritime", "icon": "sailing", "route_prefix": "/cultura-maritima"},
    {"collection": "infrastructure_items", "module": "infrastructure", "icon": "construction", "route_prefix": "/infraestrutura"},
    {"collection": "prehistoria_sites", "module": "prehistoria", "icon": "history-edu", "route_prefix": "/prehistoria"},
    {"collection": "economy_markets", "module": "economy", "icon": "storefront", "route_prefix": "/economia"},
]


@orchestrator_router.post("/smart-discover")
async def smart_discover(
    ctx: UserContext,
    radius_km: float = Query(5.0, ge=0.5, le=50),
    limit: int = Query(20, ge=1, le=100),
):
    """
    Descoberta inteligente cross-module.
    Pesquisa em TODAS as colecções geo-localizadas e retorna resultados
    ordenados por relevância (proximidade + IQ score + perfil).
    """
    if _db is None or not ctx.lat or not ctx.lng:
        raise HTTPException(400, "Location required for smart discover")

    active = _get_active_modules(ctx)
    results = []
    max_dist = radius_km * 1000  # metros

    for source in POI_SOURCES:
        # Skip inactive modules
        if source["module"] not in active and source["module"] not in ("heritage", "events"):
            continue

        col = _db[source["collection"]]

        # Try geo query — different collections may store location differently
        try:
            # Pattern 1: GeoJSON location field
            items = await col.find({
                "location": {
                    "$nearSphere": {
                        "$geometry": {"type": "Point", "coordinates": [ctx.lng, ctx.lat]},
                        "$maxDistance": max_dist,
                    }
                }
            }).to_list(limit // 2)
        except Exception:
            # Pattern 2: lat/lng fields
            try:
                items = await col.find({
                    "lat": {"$exists": True},
                    "lng": {"$exists": True},
                }).to_list(200)
                # Manual distance filter
                items = [
                    i for i in items
                    if _haversine(ctx.lat, ctx.lng, i.get("lat", 0), i.get("lng", 0)) <= radius_km
                ][:limit // 2]
            except Exception:
                items = []

        for item in items:
            # Extract location
            if "location" in item and isinstance(item["location"], dict):
                coords = item["location"].get("coordinates", [0, 0])
                item_lng, item_lat = coords[0], coords[1]
            elif "lat" in item and "lng" in item:
                item_lat, item_lng = item["lat"], item["lng"]
            else:
                continue

            dist = _haversine(ctx.lat, ctx.lng, item_lat, item_lng)
            iq = item.get("iq_score", item.get("score", 50))

            # Relevance score: closer + higher IQ + profile match
            profile_boost = 1.2 if item.get("category") in (ctx.last_categories_viewed or []) else 1.0
            relevance = (1.0 / max(dist, 0.05)) * (iq / 100) * profile_boost

            results.append({
                "id": str(item.get("_id", "")),
                "name": item.get("name", item.get("title", "Sem nome")),
                "module": source["module"],
                "icon": source["icon"],
                "route": f"{source['route_prefix']}/{item.get('_id', '')}",
                "category": item.get("category", source["module"]),
                "distance_km": round(dist, 2),
                "iq_score": iq,
                "relevance": round(relevance, 3),
                "image_url": item.get("image_url", ""),
                "description": (item.get("description", "") or "")[:120],
                "region": item.get("region", ""),
                "lat": item_lat,
                "lng": item_lng,
            })

    # Sort by relevance
    results.sort(key=lambda r: r["relevance"], reverse=True)
    results = results[:limit]

    # Group by module for summary
    module_counts = {}
    for r in results:
        module_counts[r["module"]] = module_counts.get(r["module"], 0) + 1

    return {
        "results": results,
        "total": len(results),
        "radius_km": radius_km,
        "modules_found": module_counts,
        "context_label": _classify_context(ctx),
    }


@orchestrator_router.get("/modules")
async def list_available_modules():
    """Lista todos os módulos disponíveis com metadata completa do registry."""
    catalog = modules_catalog()
    return {
        "modules": catalog,
        "total": len(catalog),
    }


@orchestrator_router.get("/chains")
async def list_available_chains():
    """Lista todos os workflow chains registados."""
    catalog = chains_catalog()
    return {
        "chains": catalog,
        "total": len(catalog),
    }
