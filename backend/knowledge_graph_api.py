"""
Portugal Vivo — Knowledge Graph Universal
==========================================
Cross-module graph engine: cultural_routes ↔ heritage_items ↔ flora_fauna
↔ gastronomy ↔ prehistoria ↔ marine_biodiversity ↔ maritime_culture ↔ trails ↔ events

Edges based on:
  • shared municipality / region
  • shared instruments / dances / gastronomy tags
  • UNESCO status (both flagged)
  • geo proximity (bbox ~50 km)
  • thematic family / category overlap

Endpoints:
  GET /api/graph/traverse?node_id=X&node_type=cultural_route&depth=2
  GET /api/graph/search?q=adufe&limit=20
  GET /api/graph/summary
"""
from __future__ import annotations

import math
from typing import Any, Optional

from fastapi import APIRouter, Query, HTTPException

graph_router = APIRouter(prefix="/graph", tags=["Knowledge Graph"])
_db = None


def set_graph_db(database) -> None:
    global _db
    _db = database


# ─── Constants ────────────────────────────────────────────────────────────────

NODE_COLLECTIONS: dict[str, str] = {
    "cultural_route":    "cultural_routes",
    "heritage":          "heritage_items",
    "gastronomy":        "coastal_gastronomy",
    "flora":             "flora_fauna",
    "fauna":             "flora_fauna",
    "prehistoria":       "geo_prehistoria",
    "maritime":          "maritime_culture",
    "marine":            "marine_biodiversity",
    "trail":             "trails",
    "event":             "events",
}

NODE_COLORS: dict[str, str] = {
    "cultural_route": "#A855F7",
    "heritage":       "#F59E0B",
    "gastronomy":     "#EF4444",
    "flora":          "#22C55E",
    "fauna":          "#14B8A6",
    "prehistoria":    "#F97316",
    "maritime":       "#3B82F6",
    "marine":         "#06B6D4",
    "trail":          "#84CC16",
    "event":          "#EC4899",
}

MAX_NEIGHBORS_PER_NODE = 6
MAX_TOTAL_NODES = 60
MAX_DEPTH = 3

MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]


# ─── Haversine ────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── Node normaliser ──────────────────────────────────────────────────────────

def _node_id(doc: dict, node_type: str) -> str:
    raw = str(doc.get("_id") or doc.get("id") or doc.get("slug") or doc.get("name", ""))
    return f"{node_type}:{raw}"


def _normalise(doc: dict, node_type: str) -> dict:
    name = (
        doc.get("name")
        or doc.get("common_name")
        or doc.get("species_name")
        or doc.get("title")
        or "—"
    )
    region = doc.get("region") or doc.get("habitat") or ""
    municipalities = doc.get("municipalities") or doc.get("municipality") or []
    if isinstance(municipalities, str):
        municipalities = [municipalities]

    tags: list[str] = []
    for field in ("instruments", "dances", "gastronomy", "festivals", "costumes",
                  "categories", "category", "tags", "period", "family", "sub_family"):
        val = doc.get(field)
        if isinstance(val, list):
            tags.extend(str(v) for v in val)
        elif isinstance(val, str) and val:
            tags.append(val)

    lat = doc.get("lat") or doc.get("latitude")
    lng = doc.get("lng") or doc.get("longitude")
    if isinstance(lat, dict):   # GeoJSON point embedded
        lat = None
    if isinstance(lng, dict):
        lng = None

    return {
        "id":             _node_id(doc, node_type),
        "type":           node_type,
        "name":           name,
        "region":         region,
        "municipalities": municipalities,
        "tags":           list(set(tags)),
        "unesco":         bool(doc.get("unesco") or doc.get("unesco_label")),
        "lat":            float(lat) if lat is not None else None,
        "lng":            float(lng) if lng is not None else None,
        "color":          NODE_COLORS.get(node_type, "#6B7280"),
        "iq_score":       doc.get("iq_score") or doc.get("reliability_score"),
        "description":    (doc.get("description_short") or doc.get("story_short") or
                           doc.get("description") or "")[:160],
    }


# ─── Edge scorer ──────────────────────────────────────────────────────────────

def _score_connection(a: dict, b: dict) -> tuple[float, str]:
    """Return (weight 0–1, edge_type label). Returns (0, '') if no connection."""
    reasons: list[tuple[float, str]] = []

    # Shared tags
    shared = set(a["tags"]) & set(b["tags"])
    if shared:
        w = min(0.4 + len(shared) * 0.1, 0.8)
        reasons.append((w, f"partilha: {', '.join(list(shared)[:3])}"))

    # Shared municipality
    mA = set(a["municipalities"])
    mB = set(b["municipalities"])
    shared_m = mA & mB
    if shared_m:
        reasons.append((0.5, f"município: {list(shared_m)[0]}"))

    # Same region
    if a["region"] and b["region"] and a["region"].lower() == b["region"].lower():
        reasons.append((0.35, f"região: {a['region']}"))

    # Both UNESCO
    if a["unesco"] and b["unesco"]:
        reasons.append((0.6, "ambos UNESCO"))

    # Geo proximity
    if a["lat"] and a["lng"] and b["lat"] and b["lng"]:
        dist = _haversine(a["lat"], a["lng"], b["lat"], b["lng"])
        if dist <= 15:
            reasons.append((0.7, f"{dist:.0f} km"))
        elif dist <= 50:
            reasons.append((0.4, f"{dist:.0f} km"))

    if not reasons:
        return 0.0, ""

    best = max(reasons, key=lambda x: x[0])
    return best


# ─── DB helpers ──────────────────────────────────────────────────────────────

async def _all_of_type(node_type: str) -> list[dict]:
    col = NODE_COLLECTIONS.get(node_type)
    if not col or _db is None:
        return []
    try:
        docs = await _db[col].find({}).to_list(500)
        return [_normalise(d, node_type) for d in docs]
    except Exception:
        return []


async def _fetch_node(node_id: str, node_type: str) -> Optional[dict]:
    col = NODE_COLLECTIONS.get(node_type)
    if not col or _db is None:
        return None
    raw_id = node_id.split(":", 1)[-1] if ":" in node_id else node_id
    try:
        from bson import ObjectId
        query: dict[str, Any] = {}
        try:
            query = {"_id": ObjectId(raw_id)}
        except Exception:
            query = {"$or": [{"id": raw_id}, {"slug": raw_id}, {"name": raw_id}]}
        doc = await _db[col].find_one(query)
        return _normalise(doc, node_type) if doc else None
    except Exception:
        return None


# ─── Graph traversal ──────────────────────────────────────────────────────────

async def _traverse(
    root: dict,
    depth: int,
    visited: set[str],
    nodes: dict[str, dict],
    edges: list[dict],
) -> None:
    if depth <= 0 or len(nodes) >= MAX_TOTAL_NODES:
        return

    visited.add(root["id"])
    nodes[root["id"]] = root

    # Gather candidates from all other collections
    candidates: list[dict] = []
    for nt in NODE_COLLECTIONS:
        if len(nodes) >= MAX_TOTAL_NODES:
            break
        items = await _all_of_type(nt)
        for item in items:
            if item["id"] != root["id"] and item["id"] not in visited:
                score, label = _score_connection(root, item)
                if score > 0.3:
                    candidates.append({"node": item, "score": score, "label": label})

    candidates.sort(key=lambda x: -x["score"])

    for c in candidates[:MAX_NEIGHBORS_PER_NODE]:
        if len(nodes) >= MAX_TOTAL_NODES:
            break
        nb = c["node"]
        edge_id = f"{root['id']}--{nb['id']}"
        rev_id  = f"{nb['id']}--{root['id']}"
        already = any(e["id"] in (edge_id, rev_id) for e in edges)
        if not already:
            edges.append({
                "id":     edge_id,
                "from":   root["id"],
                "to":     nb["id"],
                "weight": round(c["score"], 2),
                "label":  c["label"],
            })
        if nb["id"] not in visited:
            await _traverse(nb, depth - 1, visited, nodes, edges)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@graph_router.get("/traverse", summary="Traverse knowledge graph from a node")
async def traverse_graph(
    node_id:   str = Query(..., description="Node ID or raw document ID"),
    node_type: str = Query("cultural_route", description="Node type (cultural_route|heritage|gastronomy|flora|fauna|prehistoria|maritime|marine|trail|event)"),
    depth:     int = Query(2, ge=1, le=MAX_DEPTH, description="Traversal depth (max 3)"),
):
    """
    Starting from `node_id`, returns a knowledge graph of related entities
    across all modules up to `depth` hops away.

    Response: { nodes: [...], edges: [...], stats: {...} }
    """
    root = await _fetch_node(node_id, node_type)
    if root is None:
        # Fallback: search by name across all collections
        for nt in NODE_COLLECTIONS:
            items = await _all_of_type(nt)
            match = next((i for i in items if node_id.lower() in i["name"].lower()), None)
            if match:
                root = match
                break

    if root is None:
        raise HTTPException(404, f"Node '{node_id}' not found in type '{node_type}'")

    nodes: dict[str, dict] = {}
    edges: list[dict] = []
    visited: set[str] = set()

    await _traverse(root, depth, visited, nodes, edges)

    node_list = list(nodes.values())
    type_counts: dict[str, int] = {}
    for n in node_list:
        type_counts[n["type"]] = type_counts.get(n["type"], 0) + 1

    return {
        "root_id":    root["id"],
        "root_name":  root["name"],
        "depth":      depth,
        "nodes":      node_list,
        "edges":      edges,
        "stats": {
            "total_nodes": len(node_list),
            "total_edges": len(edges),
            "by_type":     type_counts,
        },
    }


@graph_router.get("/search", summary="Search for a starting node across all modules")
async def search_nodes(
    q:     str = Query(..., min_length=2, description="Search term"),
    limit: int = Query(20, ge=1, le=100),
):
    """Full-text search across all module collections to find a graph starting node."""
    results: list[dict] = []
    q_lower = q.lower()

    for node_type in NODE_COLLECTIONS:
        if len(results) >= limit:
            break
        items = await _all_of_type(node_type)
        for item in items:
            text = f"{item['name']} {item['region']} {' '.join(item['tags'])}".lower()
            if q_lower in text:
                results.append(item)
            if len(results) >= limit:
                break

    results.sort(key=lambda x: (-(x.get("iq_score") or 0), x["name"]))
    return {"query": q, "total": len(results), "results": results[:limit]}


@graph_router.get("/summary", summary="Knowledge graph global statistics")
async def graph_summary():
    """Returns count of nodes per collection and total potential connections."""
    counts: dict[str, int] = {}
    total = 0
    for node_type, col in NODE_COLLECTIONS.items():
        if _db is None:
            counts[node_type] = 0
            continue
        try:
            n = await _db[col].count_documents({})
            counts[node_type] = n
            total += n
        except Exception:
            counts[node_type] = 0

    return {
        "collections": counts,
        "total_entities": total,
        "node_types": list(NODE_COLLECTIONS.keys()),
        "edge_types": ["geo_proximity", "shared_tag", "shared_municipality", "same_region", "both_unesco"],
        "max_depth": MAX_DEPTH,
    }
