"""
Collections API - Unified access to all Excel-imported cultural data collections
Covers: Miradouros, Castelos, Palácios, Restaurantes, Tabernas, Mercados,
Praias Fluviais, Cascatas, Termas, Museus, Percursos, Arte Urbana
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from shared_constants import sanitize_regex
from shared_utils import DatabaseHolder

collections_router = APIRouter(prefix="/collections", tags=["Collections"])

_db_holder = DatabaseHolder("collections")
set_collections_db = _db_holder.set


COLLECTION_META = {
    "miradouros": {"label": "Miradouros", "icon": "visibility", "color": "#7C3AED", "group": "patrimonio"},
    "castelos": {"label": "Castelos", "icon": "castle", "color": "#92400E", "group": "patrimonio"},
    "palacios": {"label": "Palacios e Solares", "icon": "villa", "color": "#B45309", "group": "patrimonio"},
    "restaurantes": {"label": "Restaurantes", "icon": "restaurant", "color": "#DC2626", "group": "gastronomia"},
    "tabernas": {"label": "Tabernas Historicas", "icon": "sports-bar", "color": "#9333EA", "group": "gastronomia"},
    "mercados": {"label": "Mercados e Feiras", "icon": "store", "color": "#059669", "group": "gastronomia"},
    "praias_fluviais": {"label": "Praias Fluviais", "icon": "pool", "color": "#0891B2", "group": "natureza"},
    "cascatas": {"label": "Cascatas e Pocos", "icon": "water", "color": "#2563EB", "group": "natureza"},
    "termas": {"label": "Termas e Banhos", "icon": "hot-tub", "color": "#14B8A6", "group": "natureza"},
    "museus": {"label": "Museus", "icon": "museum", "color": "#6366F1", "group": "cultura"},
    "percursos": {"label": "Percursos Pedestres", "icon": "hiking", "color": "#22C55E", "group": "aventura"},
    "arte_urbana": {"label": "Arte Urbana", "icon": "palette", "color": "#EC4899", "group": "cultura"},
}

GROUP_META = {
    "patrimonio": {"label": "Patrimonio Monumental", "icon": "account-balance", "color": "#92400E"},
    "gastronomia": {"label": "Gastronomia & Sabores", "icon": "restaurant", "color": "#DC2626"},
    "natureza": {"label": "Natureza & Aguas", "icon": "water", "color": "#0891B2"},
    "cultura": {"label": "Cultura & Arte", "icon": "museum", "color": "#6366F1"},
    "aventura": {"label": "Aventura", "icon": "hiking", "color": "#22C55E"},
}


@collections_router.get("/overview")
async def get_collections_overview():
    """Get all collections with counts grouped by theme."""
    collections = []
    for cid, meta in COLLECTION_META.items():
        count = await _db_holder.db[f"excel_{cid}"].count_documents({})
        collections.append({
            "id": cid,
            "label": meta["label"],
            "icon": meta["icon"],
            "color": meta["color"],
            "group": meta["group"],
            "count": count,
        })

    groups = []
    for gid, gmeta in GROUP_META.items():
        group_cols = [c for c in collections if c["group"] == gid]
        groups.append({
            "id": gid,
            "label": gmeta["label"],
            "icon": gmeta["icon"],
            "color": gmeta["color"],
            "collections": group_cols,
            "total": sum(c["count"] for c in group_cols),
        })

    return {
        "groups": groups,
        "collections": collections,
        "total_items": sum(c["count"] for c in collections),
    }


@collections_router.get("/browse/{collection_id}")
async def browse_collection(
    collection_id: str,
    region: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=200),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Browse items in a specific collection."""
    if collection_id not in COLLECTION_META:
        raise HTTPException(status_code=404, detail="Collection not found")

    col = _db_holder.db[f"excel_{collection_id}"]
    query = {}
    if region:
        query["region"] = {"$regex": sanitize_regex(region), "$options": "i"}
    if search:
        safe_search = sanitize_regex(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"description": {"$regex": safe_search, "$options": "i"}},
            {"concelho": {"$regex": safe_search, "$options": "i"}},
        ]

    total = await col.count_documents(query)
    items = await col.find(query, {"_id": 0}).skip(offset).limit(limit).to_list(limit)

    meta = COLLECTION_META[collection_id]
    return {
        "collection": {
            "id": collection_id,
            "label": meta["label"],
            "icon": meta["icon"],
            "color": meta["color"],
        },
        "items": items,
        "total": total,
    }


@collections_router.get("/search")
async def search_all_collections(
    q: str = Query(..., min_length=2, max_length=200),
    limit: int = Query(30, ge=1, le=100),
):
    """Search across all collections."""
    safe_q = sanitize_regex(q)
    query = {
        "$or": [
            {"name": {"$regex": safe_q, "$options": "i"}},
            {"description": {"$regex": safe_q, "$options": "i"}},
            {"concelho": {"$regex": safe_q, "$options": "i"}},
        ]
    }
    items = await _db_holder.db.excel_unified.find(query, {"_id": 0}).limit(limit).to_list(limit)

    by_collection = {}
    for item in items:
        cid = item.get("collection", "unknown")
        if cid not in by_collection:
            meta = COLLECTION_META.get(cid, {"label": cid, "icon": "place", "color": "#666"})
            by_collection[cid] = {"id": cid, "label": meta["label"], "color": meta["color"], "items": []}
        by_collection[cid]["items"].append(item)

    return {
        "query": q,
        "total": len(items),
        "results": list(by_collection.values()),
    }


@collections_router.get("/regions/{collection_id}")
async def get_collection_regions(collection_id: str):
    """Get region distribution for a collection."""
    if collection_id not in COLLECTION_META:
        raise HTTPException(status_code=404, detail="Collection not found")

    pipeline = [
        {"$group": {"_id": "$region", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    results = await _db_holder.db[f"excel_{collection_id}"].aggregate(pipeline).to_list(100)
    return {
        "regions": [{"region": r["_id"] or "Sem regiao", "count": r["count"]} for r in results],
    }
