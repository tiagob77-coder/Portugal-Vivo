"""
Smart Route Generator API
Gera rotas inteligentes combinando os scores dos módulos M12-M19 do IQ Engine.
Suporta filtros por tema, duração, dificuldade, perfil e região.
"""
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, HTTPException, Depends
from shared_constants import sanitize_regex
from shared_utils import haversine_km, DatabaseHolder
from premium_guard import require_feature

logger = logging.getLogger("route_generator")

route_gen_router = APIRouter(prefix="/routes-smart", tags=["Smart Routes"])

_db_holder = DatabaseHolder("route_generator")
set_route_gen_db = _db_holder.set
_get_db = _db_holder.get


_haversine_km = haversine_km


def _get_poi_coords(poi: Dict) -> Optional[tuple]:
    loc = poi.get("location", {})
    if isinstance(loc, dict):
        lat = loc.get("lat")
        lng = loc.get("lng")
        if lat and lng:
            return (float(lat), float(lng))
    return None


def _get_iq_module_data(poi: Dict, module_name: str) -> Dict:
    """Extract data from a specific IQ module result"""
    for result in poi.get("iq_results", []):
        if isinstance(result, dict) and result.get("module") == module_name:
            return result.get("data", {})
    return {}


def _point_to_segment_distance(plat: float, plng: float,
                               alat: float, alng: float,
                               blat: float, blng: float) -> float:
    """Approximate distance (km) from a point to the line segment A-B.

    Uses planar projection (fine for Portugal-scale distances) and clamps
    to the segment endpoints so POIs beyond origin/destination are penalised.
    """
    import math
    # Approximate degree lengths at Portugal latitude (~39 N)
    km_per_lat = 111.0
    km_per_lng = 111.0 * math.cos(math.radians((alat + blat) / 2))

    ax, ay = alng * km_per_lng, alat * km_per_lat
    bx, by = blng * km_per_lng, blat * km_per_lat
    px, py = plng * km_per_lng, plat * km_per_lat

    dx, dy = bx - ax, by - ay
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq < 1e-9:
        return math.sqrt((px - ax) ** 2 + (py - ay) ** 2)

    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg_len_sq))
    proj_x = ax + t * dx
    proj_y = ay + t * dy
    return math.sqrt((px - proj_x) ** 2 + (py - proj_y) ** 2)


def _optimize_route_order(pois: List[Dict]) -> List[Dict]:
    """Simple nearest-neighbor TSP to order POIs geographically"""
    if len(pois) <= 2:
        return pois

    # Start with the first POI
    ordered = [pois[0]]
    remaining = list(pois[1:])

    while remaining:
        current_coords = _get_poi_coords(ordered[-1])
        if not current_coords:
            ordered.append(remaining.pop(0))
            continue

        # Find nearest unvisited POI
        best_idx = 0
        best_dist = float('inf')
        for i, poi in enumerate(remaining):
            poi_coords = _get_poi_coords(poi)
            if poi_coords:
                dist = _haversine_km(current_coords[0], current_coords[1], poi_coords[0], poi_coords[1])
                if dist < best_dist:
                    best_dist = dist
                    best_idx = i

        ordered.append(remaining.pop(best_idx))

    return ordered


def _calculate_route_metrics(pois: List[Dict]) -> Dict:
    """Calculate total distance, duration, and other metrics for a route"""
    total_distance = 0.0
    total_visit_time = 0
    total_travel_time = 0

    for i, poi in enumerate(pois):
        # Visit time from M13
        time_data = _get_iq_module_data(poi, "time_routing")
        visit_mins = time_data.get("estimated_visit_minutes", 30)
        total_visit_time += visit_mins

        # Distance to next POI
        if i < len(pois) - 1:
            coords1 = _get_poi_coords(poi)
            coords2 = _get_poi_coords(pois[i + 1])
            if coords1 and coords2:
                dist = _haversine_km(coords1[0], coords1[1], coords2[0], coords2[1])
                total_distance += dist
                # Estimate 40km/h average speed
                total_travel_time += int(dist / 40 * 60)

    return {
        "total_distance_km": round(total_distance, 1),
        "total_visit_minutes": total_visit_time,
        "total_travel_minutes": total_travel_time,
        "total_duration_minutes": total_visit_time + total_travel_time,
        "total_duration_label": _format_duration(total_visit_time + total_travel_time),
        "poi_count": len(pois),
    }


def _format_duration(minutes: int) -> str:
    if minutes < 60:
        return f"{minutes}min"
    hours = minutes // 60
    mins = minutes % 60
    if mins == 0:
        return f"{hours}h"
    return f"{hours}h {mins}min"


def _build_route_poi(poi: Dict, order: int) -> Dict:
    """Build a clean POI object for route response"""
    coords = _get_poi_coords(poi)
    time_data = _get_iq_module_data(poi, "time_routing")
    diff_data = _get_iq_module_data(poi, "difficulty_routing")
    theme_data = _get_iq_module_data(poi, "thematic_routing")
    weather_data = _get_iq_module_data(poi, "weather_routing")
    tod_data = _get_iq_module_data(poi, "time_of_day_routing")

    return {
        "order": order,
        "id": poi.get("id", ""),
        "name": poi.get("name", ""),
        "description": (poi.get("description", "") or "")[:200],
        "category": poi.get("category", ""),
        "region": poi.get("region", ""),
        "location": {"lat": coords[0], "lng": coords[1]} if coords else None,
        "address": poi.get("address", ""),
        "iq_score": poi.get("iq_score", 0),
        "visit_minutes": time_data.get("estimated_visit_minutes", 30),
        "difficulty": diff_data.get("difficulty_label", "Moderado"),
        "best_time": tod_data.get("best_time_label", "Flexível"),
        "weather_type": weather_data.get("environment_type", "misto"),
        "primary_themes": theme_data.get("primary_themes", []),
        "image_url": poi.get("image_url"),
    }


# ============================================
# ROUTE GENERATION ENDPOINTS
# ============================================

@route_gen_router.get("/themes")
async def get_available_themes():
    """List available themes with POI counts"""
    db = _get_db()

    pois = await db.heritage_items.find(
        {"iq_status": "completed"},
        {"iq_results": 1}
    ).to_list(length=5000)

    theme_counts = {}
    for poi in pois:
        theme_data = _get_iq_module_data(poi, "thematic_routing")
        for theme in theme_data.get("primary_themes", []):
            theme_counts[theme] = theme_counts.get(theme, 0) + 1

    THEME_NAMES = {
        "religioso": "Rota Religiosa & Espiritual",
        "gastronomico": "Rota Gastronómica",
        "natureza": "Rota da Natureza",
        "historico": "Rota Histórica",
        "cultural": "Rota Cultural",
        "aventura": "Rota de Aventura",
        "arquitetura": "Rota da Arquitectura",
        "romantico": "Rota Romântica",
    }

    return {
        "themes": [
            {
                "id": theme,
                "name": THEME_NAMES.get(theme, theme.title()),
                "poi_count": count,
            }
            for theme, count in sorted(theme_counts.items(), key=lambda x: x[1], reverse=True)
        ]
    }



# Categories reserved for partnership phase — excluded from route generation
COMING_SOON_CATEGORIES = {"alojamentos_rurais", "agentes_turisticos", "entidades_operadores"}


@route_gen_router.get("/generate", dependencies=[Depends(require_feature("custom_routes"))])
async def generate_route(
    theme: Optional[str] = Query(None, description="Theme filter: religioso, gastronomico, natureza, historico, cultural, aventura"),
    region: Optional[str] = Query(None, description="Region filter: norte, centro, sul, etc."),
    difficulty: Optional[str] = Query(None, description="Difficulty: facil, moderado, dificil"),
    profile: Optional[str] = Query(None, description="Profile: familia, casal, solo, senior, grupo, aventureiro"),
    max_duration: Optional[int] = Query(None, description="Max duration in minutes (60, 120, 240, 480)"),
    max_pois: int = Query(default=8, le=15, description="Max POIs in route"),
    rain_friendly: Optional[bool] = Query(None, description="Indoor/rain-friendly POIs only"),
    origin_lat: Optional[float] = Query(None, description="Origin latitude for corridor routing"),
    origin_lng: Optional[float] = Query(None, description="Origin longitude for corridor routing"),
    dest_lat: Optional[float] = Query(None, description="Destination latitude for corridor routing"),
    dest_lng: Optional[float] = Query(None, description="Destination longitude for corridor routing"),
    corridor_km: float = Query(default=25.0, le=80.0, description="Max distance from route corridor in km"),
):
    """
    Generate an intelligent route based on filters.
    Combines IQ Engine scores from M12-M19 to create optimized routes.
    When origin/destination are given, POIs are selected along the travel corridor.
    """
    db = _get_db()

    has_corridor = all(v is not None for v in [origin_lat, origin_lng, dest_lat, dest_lng])

    # Build MongoDB query
    query: Dict[str, Any] = {"iq_status": "completed"}
    # Exclude coming-soon partnership categories
    query["category"] = {"$nin": list(COMING_SOON_CATEGORIES)}

    if region:
        query["region"] = {"$regex": sanitize_regex(region), "$options": "i"}

    # Fetch candidates
    candidates = await db.heritage_items.find(
        query,
        {"id": 1, "name": 1, "description": 1, "category": 1, "region": 1,
         "location": 1, "address": 1, "iq_score": 1, "iq_results": 1,
         "image_url": 1, "tags": 1}
    ).to_list(length=2000)

    if not candidates:
        raise HTTPException(404, "Nenhum POI encontrado com os filtros aplicados")

    # If corridor routing, filter POIs within corridor between origin and destination
    if has_corridor:
        corridor_candidates = []
        for poi in candidates:
            coords = _get_poi_coords(poi)
            if not coords:
                continue
            dist = _point_to_segment_distance(
                coords[0], coords[1],
                origin_lat, origin_lng,  # type: ignore[arg-type]
                dest_lat, dest_lng,  # type: ignore[arg-type]
            )
            if dist <= corridor_km:
                poi["_corridor_dist"] = dist
                corridor_candidates.append(poi)
        if corridor_candidates:
            candidates = corridor_candidates

    # Score each candidate for this specific route
    scored = []
    for poi in candidates:
        route_score = 0.0
        weight_total = 0.0

        # Theme filter (M12) - weight 30
        if theme:
            theme_data = _get_iq_module_data(poi, "thematic_routing")
            primary_themes = theme_data.get("primary_themes", [])
            secondary_themes = theme_data.get("secondary_themes", [])
            if theme in primary_themes:
                route_score += 30
            elif theme in secondary_themes:
                route_score += 15
            else:
                continue  # Skip POIs without this theme
            weight_total += 30

        # Difficulty filter (M14) - weight 15
        if difficulty:
            diff_data = _get_iq_module_data(poi, "difficulty_routing")
            poi_diff = diff_data.get("difficulty_level", "moderado")
            diff_map = {"facil": 1, "moderado": 2, "dificil": 3, "expert": 4}
            target_level = diff_map.get(difficulty, 2)
            poi_level = diff_map.get(poi_diff, 2)
            if abs(poi_level - target_level) <= 1:
                route_score += 15 - abs(poi_level - target_level) * 5
            weight_total += 15

        # Profile filter (M15) - weight 20
        if profile:
            profile_data = _get_iq_module_data(poi, "profile_routing")
            suitable = profile_data.get("suitable_profiles", [])
            profiles_scores = profile_data.get("profiles", {})
            if profile in suitable:
                route_score += 20
            elif profiles_scores.get(profile, 0) > 20:
                route_score += 10
            weight_total += 20

        # Weather filter (M16) - weight 10
        if rain_friendly is not None:
            weather_data = _get_iq_module_data(poi, "weather_routing")
            is_rain_friendly = weather_data.get("rain_friendly", False)
            if rain_friendly and is_rain_friendly:
                route_score += 10
            elif rain_friendly and not is_rain_friendly:
                route_score += 2
            else:
                route_score += 8
            weight_total += 10

        # Time constraint (M13) - weight 10
        if max_duration:
            time_data = _get_iq_module_data(poi, "time_routing")
            visit_mins = time_data.get("estimated_visit_minutes", 30)
            if visit_mins <= max_duration * 0.4:  # Single POI shouldn't take >40% of time
                route_score += 10
            weight_total += 10

        # Base IQ score contribution - weight 15
        iq_score = poi.get("iq_score", 0)
        route_score += (iq_score / 100) * 15
        weight_total += 15

        # Geographic connectivity (M19) - weight 10
        optimizer_data = _get_iq_module_data(poi, "route_optimizer")
        if optimizer_data.get("has_coordinates"):
            route_score += 10
            weight_total += 10

        # Corridor proximity bonus — closer to route corridor = higher score
        if has_corridor and "_corridor_dist" in poi:
            corridor_bonus = max(0, 15 * (1 - poi["_corridor_dist"] / corridor_km))
            route_score += corridor_bonus
            weight_total += 15

        # Normalize score
        if weight_total > 0:
            final_score = (route_score / weight_total) * 100
        else:
            final_score = iq_score

        scored.append((poi, final_score))

    # Sort by route relevance score
    scored.sort(key=lambda x: x[1], reverse=True)

    # Take top candidates
    top_pois = [s[0] for s in scored[:max_pois * 2]]

    # Filter by geographic proximity if we have too many
    if len(top_pois) > max_pois:
        # Keep only POIs with coordinates for geographic optimization
        with_coords = [p for p in top_pois if _get_poi_coords(p)]
        without_coords = [p for p in top_pois if not _get_poi_coords(p)]

        if with_coords:
            top_pois = with_coords[:max_pois]
        else:
            top_pois = top_pois[:max_pois]

    # Optimize route order (nearest neighbor)
    # For corridor mode, sort by projection along the origin→destination segment
    if has_corridor:
        import math
        km_per_lat = 111.0
        km_per_lng = 111.0 * math.cos(math.radians((origin_lat + dest_lat) / 2))  # type: ignore[operator]
        ax, ay = origin_lng * km_per_lng, origin_lat * km_per_lat  # type: ignore[operator]
        bx, by = dest_lng * km_per_lng, dest_lat * km_per_lat  # type: ignore[operator]
        dx, dy = bx - ax, by - ay
        seg_len_sq = dx * dx + dy * dy

        def _projection_t(poi):
            coords = _get_poi_coords(poi)
            if not coords or seg_len_sq < 1e-9:
                return 0.5
            px, py = coords[1] * km_per_lng, coords[0] * km_per_lat
            return max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg_len_sq))

        selected = top_pois[:max_pois]
        ordered_pois = sorted(selected, key=_projection_t)
    else:
        ordered_pois = _optimize_route_order(top_pois[:max_pois])

    # Apply time constraint
    if max_duration:
        final_pois = []
        running_time = 0
        for poi in ordered_pois:
            time_data = _get_iq_module_data(poi, "time_routing")
            visit = time_data.get("estimated_visit_minutes", 30)
            travel = 15  # buffer
            if running_time + visit + travel <= max_duration:
                final_pois.append(poi)
                running_time += visit + travel
        ordered_pois = final_pois if final_pois else ordered_pois[:3]

    # Build response
    route_pois = [_build_route_poi(poi, i + 1) for i, poi in enumerate(ordered_pois)]
    metrics = _calculate_route_metrics(ordered_pois)

    # Generate route name
    theme_names = {
        "religioso": "Espiritual", "gastronomico": "Gastronómica",
        "natureza": "Natural", "historico": "Histórica",
        "cultural": "Cultural", "aventura": "Aventura",
        "arquitetura": "Arquitectónica", "romantico": "Romântica",
    }

    route_name = "Rota "
    if theme:
        route_name += theme_names.get(theme, theme.title()) + " "
    if region:
        route_name += f"do {region.title()} "
    if profile:
        profile_names = {"familia": "Familiar", "casal": "Romântica", "solo": "Solo",
                        "senior": "Sénior", "grupo": "em Grupo", "aventureiro": "Aventureira"}
        route_name += f"- {profile_names.get(profile, profile.title())}"

    if route_name == "Rota ":
        route_name = "Rota Personalizada"

    # Average route score
    avg_score = sum(p["iq_score"] for p in route_pois) / len(route_pois) if route_pois else 0

    return {
        "route_name": route_name.strip(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filters": {
            "theme": theme, "region": region, "difficulty": difficulty,
            "profile": profile, "max_duration": max_duration, "rain_friendly": rain_friendly,
        },
        "metrics": metrics,
        "avg_iq_score": round(avg_score, 1),
        "candidates_evaluated": len(candidates),
        "pois": route_pois,
    }


@route_gen_router.get("/profiles")
async def get_route_profiles():
    """Get pre-built route profiles with descriptions"""
    return {
        "profiles": [
            {
                "id": "familia",
                "name": "Família com Crianças",
                "icon": "family-restroom",
                "description": "POIs seguros e divertidos para toda a família",
                "default_difficulty": "facil",
                "default_max_duration": 240,
            },
            {
                "id": "casal",
                "name": "Escapadinha Romântica",
                "icon": "favorite",
                "description": "Locais encantadores para casais",
                "default_difficulty": "moderado",
                "default_max_duration": 480,
            },
            {
                "id": "solo",
                "name": "Viajante Solo",
                "icon": "person",
                "description": "Experiências culturais e de descoberta",
                "default_difficulty": "moderado",
                "default_max_duration": 480,
            },
            {
                "id": "senior",
                "name": "Passeio Sénior",
                "icon": "elderly",
                "description": "Percursos acessíveis e confortáveis",
                "default_difficulty": "facil",
                "default_max_duration": 240,
            },
            {
                "id": "aventureiro",
                "name": "Aventura",
                "icon": "hiking",
                "description": "Trilhos, desporto e adrenalina",
                "default_difficulty": "dificil",
                "default_max_duration": 480,
            },
            {
                "id": "grupo",
                "name": "Grupo / Excursão",
                "icon": "groups",
                "description": "Pontos de interesse para grupos organizados",
                "default_difficulty": "moderado",
                "default_max_duration": 480,
            },
        ]
    }


@route_gen_router.get("/regions")
async def get_route_regions():
    """Get available regions with POI counts"""
    db = _get_db()

    pipeline = [
        {"$match": {"iq_status": "completed"}},
        {"$group": {"_id": "$region", "count": {"$sum": 1}, "avg_score": {"$avg": "$iq_score"}}},
        {"$sort": {"count": -1}},
    ]
    results = await db.heritage_items.aggregate(pipeline).to_list(length=20)

    return {
        "regions": [
            {
                "id": r["_id"],
                "name": (r["_id"] or "").title(),
                "poi_count": r["count"],
                "avg_iq_score": round(r["avg_score"] or 0, 1),
            }
            for r in results if r["_id"]
        ]
    }
