"""
Importador JSON — Rotas Megalíticas de Portugal Vivo

Importa rotas megalíticas de um ficheiro JSON para a colecção routes.
Suporta dois formatos:
  1. GeoJSON FeatureCollection (type: "FeatureCollection", features: [...])
  2. Array de objectos de rota [{name, waypoints, ...}, ...]

Para cada waypoint com lat/lng, tenta fazer match com heritage_items existentes
ou insere o POI novo com geo_location GeoJSON.

Uso:
    python backend/import_rotas_megaliticas_json.py --json portugal_vivo_rotas_megaliticas.json
    python backend/import_rotas_megaliticas_json.py --json portugal_vivo_rotas_megaliticas.json --dry-run
"""
import asyncio
import argparse
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Distância máxima (graus ≈ ~500m) para match de POI existente por coordenadas
COORD_MATCH_DELTA = 0.005


def _v(obj: dict, *keys: str, default=None):
    """Pega o primeiro valor não-nulo de uma lista de chaves alternativas."""
    for k in keys:
        if obj.get(k) is not None:
            return obj[k]
    return default


def _parse_coord(val) -> Optional[float]:
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _extract_waypoints(route_obj: dict) -> list[dict]:
    """
    Extrai waypoints de um objecto de rota.
    Aceita: waypoints, pois, items, stops, pontos, locais, features (GeoJSON).
    Cada entry deve ter lat/lng ou coordinates [lng, lat].
    """
    raw = (
        route_obj.get("waypoints")
        or route_obj.get("pois")
        or route_obj.get("items")
        or route_obj.get("stops")
        or route_obj.get("pontos")
        or route_obj.get("locais")
        or []
    )
    results = []
    for wp in raw:
        if not isinstance(wp, dict):
            continue
        # Coordenadas podem vir como lat/lng ou GeoJSON coordinates: [lng, lat]
        lat = _parse_coord(_v(wp, "lat", "latitude"))
        lng = _parse_coord(_v(wp, "lng", "lon", "longitude"))
        if lat is None and lng is None:
            coords = wp.get("coordinates") or wp.get("geometry", {}).get("coordinates")
            if coords and len(coords) >= 2:
                lng, lat = _parse_coord(coords[0]), _parse_coord(coords[1])

        results.append({
            "name": _v(wp, "name", "nome", "designacao", "designação", "title", default=""),
            "description": _v(wp, "description", "descricao", "descrição", default=None),
            "lat": lat,
            "lng": lng,
            "category": _v(wp, "category", "categoria", "categoria_pv", default="arqueologia"),
            "poi_id": _v(wp, "id", "poi_id", default=None),
        })
    return results


def _normalise_route(raw: dict) -> Optional[dict]:
    """Constrói um objecto de rota normalizado a partir do JSON bruto."""
    name = _v(raw, "name", "nome", "title", "titulo", "título")
    if not name:
        return None

    # Tags automáticas para megalíticos
    tags: list = list(raw.get("tags") or [])
    for auto in ["megalítico", "pré-história", "arqueologia", "portugal"]:
        if auto not in tags:
            tags.append(auto)

    # Geometry da rota (LineString GeoJSON), se existir
    geometry = raw.get("geometry") or raw.get("geojson")

    return {
        "id": _v(raw, "id") or str(uuid.uuid4())[:8],
        "name": name,
        "description": _v(raw, "description", "descricao", "descrição", default="Rota megalítica de Portugal Vivo."),
        "category": _v(raw, "category", "categoria", default="arqueologia"),
        "theme": _v(raw, "theme", "tema", default="megalítico"),
        "region": _v(raw, "region", "regiao", "região", "distrito"),
        "distance_km": _parse_coord(_v(raw, "distance_km", "distancia_km", "distancia", "distance")),
        "duration_hours": _parse_coord(_v(raw, "duration_hours", "duracao_horas", "duracao")),
        "difficulty": _v(raw, "difficulty", "dificuldade"),
        "image_url": _v(raw, "image_url", "imagem"),
        "tags": tags,
        "geometry": geometry,
        "source": "megaliticos_json",
        "created_at": datetime.now(timezone.utc),
        "_raw_waypoints": _extract_waypoints(raw),
    }


async def _resolve_waypoint(db, wp: dict, dry_run: bool) -> Optional[str]:
    """
    Dado um waypoint, devolve o id do heritage_item correspondente.
    Tenta match por: 1) poi_id explícito, 2) nome, 3) coordenadas próximas.
    Se não encontrar e tiver coordenadas, insere novo POI.
    """
    # 1. ID explícito
    if wp.get("poi_id"):
        existing = await db.heritage_items.find_one({"id": wp["poi_id"]}, {"id": 1})
        if existing:
            return wp["poi_id"]

    # 2. Nome exacto
    if wp.get("name"):
        existing = await db.heritage_items.find_one({"name": wp["name"]}, {"id": 1})
        if existing:
            return existing["id"]

    # 3. Coordenadas próximas (~500m)
    lat, lng = wp.get("lat"), wp.get("lng")
    if lat is not None and lng is not None:
        existing = await db.heritage_items.find_one({
            "location.lat": {"$gte": lat - COORD_MATCH_DELTA, "$lte": lat + COORD_MATCH_DELTA},
            "location.lng": {"$gte": lng - COORD_MATCH_DELTA, "$lte": lng + COORD_MATCH_DELTA},
        }, {"id": 1})
        if existing:
            return existing["id"]

        # Inserir novo POI
        if wp.get("name") and not dry_run:
            new_id = str(uuid.uuid4())[:8]
            new_poi = {
                "id": new_id,
                "name": wp["name"],
                "description": wp.get("description"),
                "category": wp.get("category") or "arqueologia",
                "location": {"lat": lat, "lng": lng},
                "geo_location": {"type": "Point", "coordinates": [lng, lat]},  # lng primeiro — GeoJSON
                "tags": ["megalítico", "arqueologia", "pré-história", "portugal"],
                "iq_score": None,
                "source": "megaliticos_json",
            }
            await db.heritage_items.insert_one(new_poi)
            logger.info("    + Novo POI criado: %s (%.5f, %.5f)", wp["name"], lat, lng)
            return new_id
        elif wp.get("name") and dry_run:
            logger.info("    [DRY-RUN] Criaria POI: %s (%.5f, %.5f)", wp["name"], lat, lng)
            return f"dry-run-{wp['name'][:20]}"

    return None


def _parse_source(path: str) -> list[dict]:
    """Lê o JSON e normaliza para uma lista de objectos de rota."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        return data

    # GeoJSON FeatureCollection
    if isinstance(data, dict) and data.get("type") == "FeatureCollection":
        routes = []
        for feature in data.get("features", []):
            props = feature.get("properties") or {}
            geom = feature.get("geometry")
            route_obj = {**props}
            if geom:
                route_obj["geometry"] = geom
            routes.append(route_obj)
        return routes

    # Objecto único com chave "routes" ou "rotas"
    if isinstance(data, dict):
        return data.get("routes") or data.get("rotas") or [data]

    return []


async def import_json(json_path: str, dry_run: bool = False):
    path = Path(json_path)
    if not path.exists():
        logger.error("Ficheiro não encontrado: %s", json_path)
        return

    raw_routes = _parse_source(json_path)
    logger.info("Ficheiro lido: %d rotas encontradas", len(raw_routes))

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "patrimonio_vivo")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Garantir índices antes de inserir
    if not dry_run:
        await db.heritage_items.create_index(
            [("geo_location", "2dsphere")], sparse=True, name="idx_heritage_geo_2dsphere"
        )
        await db.routes.create_index("id", unique=True, name="idx_routes_id")

    inserted = updated = skipped = 0

    for raw in raw_routes:
        route = _normalise_route(raw)
        if route is None:
            logger.warning("Rota sem nome — ignorada")
            skipped += 1
            continue

        raw_waypoints = route.pop("_raw_waypoints", [])

        # Resolver waypoints → IDs de POIs
        item_ids: list[str] = []
        for wp in raw_waypoints:
            poi_id = await _resolve_waypoint(db, wp, dry_run)
            if poi_id:
                item_ids.append(poi_id)

        route["items"] = item_ids
        route["item_count"] = len(item_ids)

        if dry_run:
            logger.info("[DRY-RUN] Rota: %s | %d waypoints | região: %s",
                        route["name"], len(item_ids), route.get("region"))
            inserted += 1
            continue

        existing = await db.routes.find_one({"id": route["id"]})
        if not existing:
            existing = await db.routes.find_one({"name": route["name"]})

        if existing:
            await db.routes.update_one(
                {"_id": existing["_id"]},
                {"$set": {k: v for k, v in route.items() if k not in ("id", "created_at")}}
            )
            updated += 1
            logger.info("  Actualizada: %s (%d POIs)", route["name"], len(item_ids))
        else:
            await db.routes.insert_one(route)
            inserted += 1
            logger.info("  Inserida: %s (%d POIs)", route["name"], len(item_ids))

    client.close()
    action = "simuladas" if dry_run else "inseridas"
    logger.info("Concluído — %d %s | %d actualizadas | %d ignoradas",
                inserted, action, updated, skipped)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Importar JSON de rotas megalíticas para Portugal Vivo")
    parser.add_argument("--json", required=True, help="Caminho para o ficheiro JSON")
    parser.add_argument("--dry-run", action="store_true", help="Simular sem escrever na BD")
    args = parser.parse_args()
    asyncio.run(import_json(args.json, dry_run=args.dry_run))
