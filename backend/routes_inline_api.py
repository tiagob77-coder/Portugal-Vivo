"""
Routes Inline API - Route listing, planning, and Google Directions integration.
Extracted from server.py.
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
import httpx
import re

from shared_utils import DatabaseHolder, haversine_km, clamp_pagination
from models.api_models import Route, HeritageItem, Location, RoutePlanRequest, RoutePlanResponse

import logging
logger = logging.getLogger(__name__)

routes_inline_router = APIRouter(tags=["Routes"])

_db_holder = DatabaseHolder("routes_inline")
set_routes_inline_db = _db_holder.set

_google_maps_api_key = ""


def set_routes_google_key(key: str):
    global _google_maps_api_key
    _google_maps_api_key = key


@routes_inline_router.get("/routes", response_model=List[Route], tags=["Routes"])
async def get_routes(
    category: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = 50
):
    """Get thematic routes"""
    _, limit = clamp_pagination(0, limit, max_limit=200)
    query = {}
    if category:
        query["category"] = category
    if region:
        query["region"] = region

    routes = await _db_holder.db.routes.find(query, {"_id": 0}).limit(limit).to_list(limit)
    result = []
    for route in routes:
        try:
            # Ensure required fields have fallback values for incomplete documents
            route.setdefault("description", route.get("name", ""))
            result.append(Route(**route))
        except Exception as e:
            logger.warning("Skipping invalid route %s: %s", route.get("id", "?"), e)
    return result


@routes_inline_router.get("/routes/{route_id}", response_model=Route, tags=["Routes"])
async def get_route(route_id: str):
    """Get a single route"""
    route = await _db_holder.db.routes.find_one({"id": route_id}, {"_id": 0})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    route.setdefault("description", route.get("name", ""))
    return Route(**route)


@routes_inline_router.get("/routes/{route_id}/items", response_model=List[HeritageItem], tags=["Routes"])
async def get_route_items(route_id: str):
    """Get all items in a route"""
    route = await _db_holder.db.routes.find_one({"id": route_id}, {"_id": 0})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    items = await _db_holder.db.heritage_items.find(
        {"id": {"$in": route.get("items", [])}},
        {"_id": 0}
    ).to_list(100)
    return [HeritageItem(**item) for item in items]


@routes_inline_router.post("/routes/plan", response_model=RoutePlanResponse, tags=["Routes"])
async def plan_route(request: RoutePlanRequest):
    """Plan a route between two points, suggesting POIs along the way"""

    def point_to_line_distance(point_lat, point_lng, line_start_lat, line_start_lng, line_end_lat, line_end_lng):
        """Calculate perpendicular distance from point to line in km"""
        dx = line_end_lng - line_start_lng
        dy = line_end_lat - line_start_lat
        length_sq = dx*dx + dy*dy

        if length_sq == 0:
            return haversine_km(point_lat, point_lng, line_start_lat, line_start_lng)

        t = max(0, min(1, ((point_lng - line_start_lng) * dx + (point_lat - line_start_lat) * dy) / length_sq))
        proj_lng = line_start_lng + t * dx
        proj_lat = line_start_lat + t * dy

        return haversine_km(point_lat, point_lng, proj_lat, proj_lng)

    # Location coordinates for common places in Portugal
    KNOWN_LOCATIONS = {
        "lisboa": {"lat": 38.7223, "lng": -9.1393, "name": "Lisboa"},
        "porto": {"lat": 41.1579, "lng": -8.6291, "name": "Porto"},
        "coimbra": {"lat": 40.2033, "lng": -8.4103, "name": "Coimbra"},
        "faro": {"lat": 37.0179, "lng": -7.9304, "name": "Faro"},
        "braga": {"lat": 41.5454, "lng": -8.4265, "name": "Braga"},
        "braganca": {"lat": 41.8071, "lng": -6.7589, "name": "Bragança"},
        "montesinho": {"lat": 41.9333, "lng": -6.7833, "name": "Parque Natural de Montesinho"},
        "evora": {"lat": 38.5667, "lng": -7.9, "name": "Évora"},
        "guarda": {"lat": 40.5379, "lng": -7.2671, "name": "Guarda"},
        "viseu": {"lat": 40.6566, "lng": -7.9125, "name": "Viseu"},
        "aveiro": {"lat": 40.6405, "lng": -8.6538, "name": "Aveiro"},
        "leiria": {"lat": 39.7436, "lng": -8.8071, "name": "Leiria"},
        "castelo branco": {"lat": 39.8225, "lng": -7.4917, "name": "Castelo Branco"},
        "setubal": {"lat": 38.5244, "lng": -8.8882, "name": "Setúbal"},
        "santarem": {"lat": 39.2369, "lng": -8.6868, "name": "Santarém"},
        "vila real": {"lat": 41.3007, "lng": -7.7443, "name": "Vila Real"},
        "viana do castelo": {"lat": 41.6938, "lng": -8.8327, "name": "Viana do Castelo"},
        "geres": {"lat": 41.7333, "lng": -8.1667, "name": "Gerês"},
        "serra da estrela": {"lat": 40.3217, "lng": -7.6114, "name": "Serra da Estrela"},
        "peneda": {"lat": 41.9833, "lng": -8.2333, "name": "Peneda-Gerês"},
        "sintra": {"lat": 38.7979, "lng": -9.3904, "name": "Sintra"},
        "cascais": {"lat": 38.6979, "lng": -9.4215, "name": "Cascais"},
        "albufeira": {"lat": 37.0893, "lng": -8.2473, "name": "Albufeira"},
        "lagos": {"lat": 37.1028, "lng": -8.6730, "name": "Lagos"},
        "tavira": {"lat": 37.1282, "lng": -7.6489, "name": "Tavira"},
        "alqueva": {"lat": 38.2167, "lng": -7.5, "name": "Alqueva"},
    }

    # Get origin and destination coordinates
    origin_name = request.origin.lower().strip()
    dest_name = request.destination.lower().strip()

    origin_coords = request.origin_coords
    dest_coords = request.destination_coords

    # Try to resolve from known locations
    if not origin_coords and origin_name in KNOWN_LOCATIONS:
        loc = KNOWN_LOCATIONS[origin_name]
        origin_coords = Location(lat=loc["lat"], lng=loc["lng"])

    if not dest_coords and dest_name in KNOWN_LOCATIONS:
        loc = KNOWN_LOCATIONS[dest_name]
        dest_coords = Location(lat=loc["lat"], lng=loc["lng"])

    if not origin_coords or not dest_coords:
        raise HTTPException(status_code=400, detail="Could not resolve origin or destination coordinates")

    # Calculate direct distance and estimated duration
    direct_distance = haversine_km(
        origin_coords.lat, origin_coords.lng,
        dest_coords.lat, dest_coords.lng
    )

    # Estimate 60km/h average speed for scenic routes
    estimated_hours = direct_distance / 60

    # Build query for POIs
    query = {}
    if request.categories:
        query["category"] = {"$in": request.categories}
    query["location"] = {"$exists": True, "$ne": None}

    # Get all items with location
    all_items = await _db_holder.db.heritage_items.find(query, {"_id": 0}).to_list(500)

    # Filter items within max_detour_km of the route line
    items_on_route = []
    for item in all_items:
        if item.get("location"):
            item_lat = item["location"]["lat"]
            item_lng = item["location"]["lng"]

            # Calculate distance from route line
            distance_to_route = point_to_line_distance(
                item_lat, item_lng,
                origin_coords.lat, origin_coords.lng,
                dest_coords.lat, dest_coords.lng
            )

            if distance_to_route <= request.max_detour_km:
                # Calculate progress along route (0 = origin, 1 = destination)
                dx = dest_coords.lng - origin_coords.lng
                dy = dest_coords.lat - origin_coords.lat
                length_sq = dx*dx + dy*dy

                if length_sq > 0:
                    t = ((item_lng - origin_coords.lng) * dx + (item_lat - origin_coords.lat) * dy) / length_sq
                    t = max(0, min(1, t))
                else:
                    t = 0.5

                items_on_route.append({
                    **item,
                    "distance_to_route": distance_to_route,
                    "route_progress": t
                })

    # Sort by route progress (items closer to origin first)
    items_on_route.sort(key=lambda x: x.get("route_progress", 0.5))

    # Select top items, prioritizing those with certifications or special tags
    def score_item(item):
        score = 0
        tags = item.get("tags", [])
        metadata = item.get("metadata", {})

        # Boost for certifications
        if "Bandeira Azul" in tags:
            score += 10
        if "qualidade ouro" in tags or "Qualidade de Ouro" in str(metadata.get("certifications", [])):
            score += 8
        if "acessível" in tags or "Acessível a Todos" in str(metadata.get("certifications", [])):
            score += 5
        if "histórico" in tags or "romano" in tags:
            score += 5

        # Penalize distance from route
        score -= item.get("distance_to_route", 0) / 10

        return score

    # Group by rough position on route to spread stops evenly
    num_sections = min(request.max_stops, len(items_on_route))
    if num_sections == 0:
        selected_items = []
    else:
        selected_items = []
        for i in range(num_sections):
            section_start = i / num_sections
            section_end = (i + 1) / num_sections

            section_items = [
                item for item in items_on_route
                if section_start <= item.get("route_progress", 0.5) < section_end
            ]

            if section_items:
                # Pick best item in this section
                best_item = max(section_items, key=score_item)
                # Remove internal fields
                best_item.pop("distance_to_route", None)
                best_item.pop("route_progress", None)
                selected_items.append(HeritageItem(**best_item))

    # Create highlights
    highlights = []
    for item in selected_items[:5]:
        highlights.append({
            "name": item.name,
            "category": item.category,
            "description": item.description[:150] + "..." if len(item.description) > 150 else item.description,
            "tags": item.tags[:3]
        })

    # Generate route description
    origin_display = KNOWN_LOCATIONS.get(origin_name, {}).get("name", request.origin.title())
    dest_display = KNOWN_LOCATIONS.get(dest_name, {}).get("name", request.destination.title())

    if selected_items:
        categories_found = list(set([item.category for item in selected_items]))
        route_description = f"""
Rota de {origin_display} a {dest_display}

Esta rota atravessa algumas das mais belas paisagens de Portugal, com uma distância aproximada de {direct_distance:.0f} km.
Ao longo do percurso, descobrirá {len(selected_items)} pontos de interesse selecionados especialmente para si.

{'Destaques:' if highlights else ''}
{chr(10).join([f"• {h['name']} - {h['description'][:80]}..." for h in highlights[:3]])}

Categorias disponíveis nesta rota: {', '.join(categories_found[:5])}

Tempo estimado de viagem: {estimated_hours:.1f} horas (sem paragens)
Recomendamos adicionar 30-60 minutos por cada paragem para uma experiência completa.
""".strip()
    else:
        route_description = f"""
Rota de {origin_display} a {dest_display}

Distância aproximada: {direct_distance:.0f} km
Tempo estimado: {estimated_hours:.1f} horas

Não foram encontrados pontos de interesse nas categorias selecionadas ao longo desta rota.
Experimente aumentar a distância máxima de desvio ou selecionar mais categorias.
""".strip()

    return RoutePlanResponse(
        origin=origin_display,
        destination=dest_display,
        total_distance_km=round(direct_distance, 1),
        estimated_duration_hours=round(estimated_hours, 1),
        suggested_stops=selected_items[:request.max_stops],
        highlights=highlights,
        route_description=route_description
    )


@routes_inline_router.post("/routes/directions")
async def get_route_directions(
    origin: str,
    destination: str,
    waypoints: Optional[List[str]] = None
):
    """Get real route directions from Google Directions API"""
    if not _google_maps_api_key:
        raise HTTPException(status_code=500, detail="Google Maps API not configured")

    try:
        async with httpx.AsyncClient() as client:
            params = {
                "origin": origin,
                "destination": destination,
                "key": _google_maps_api_key,
                "mode": "driving",
                "language": "pt-PT",
                "units": "metric",
                "alternatives": "false"
            }

            if waypoints:
                params["waypoints"] = "|".join(waypoints)

            response = await client.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                params=params,
                timeout=10.0
            )

            data = response.json()

            if data.get("status") != "OK":
                logger.error("Google Directions API error: %s", data.get('status'))
                raise HTTPException(
                    status_code=400,
                    detail=f"Directions API error: {data.get('status')}"
                )

            route = data["routes"][0]
            leg = route["legs"][0]

            # Extract main roads from steps
            via_roads = []
            for step in leg["steps"]:
                instruction = step.get("html_instructions", "")
                # Extract road names like A1, IP4, EN1, etc.
                roads = re.findall(r'\b(A-?\d+|IP-?\d+|EN-?\d+|IC-?\d+|N-?\d+)\b', instruction)
                for road in roads:
                    if road not in via_roads:
                        via_roads.append(road)

            # Build steps list
            steps = []
            for step in leg["steps"]:
                # Clean HTML from instructions
                instruction = re.sub('<[^<]+?>', '', step.get("html_instructions", ""))
                steps.append({
                    "instruction": instruction,
                    "distance_km": round(step["distance"]["value"] / 1000, 2),
                    "duration_minutes": round(step["duration"]["value"] / 60, 1)
                })

            return {
                "status": "OK",
                "origin_address": leg["start_address"],
                "destination_address": leg["end_address"],
                "distance_km": round(leg["distance"]["value"] / 1000, 1),
                "duration_hours": round(leg["duration"]["value"] / 3600, 2),
                "duration_text": leg["duration"]["text"],
                "polyline": route["overview_polyline"]["points"],
                "via_roads": via_roads[:5],
                "steps": steps,
                "bounds": route["bounds"]
            }

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Google API timeout")
    except Exception as e:
        logger.error("Error fetching directions: %s", e)
        raise HTTPException(status_code=500, detail="Erro ao obter direções")
