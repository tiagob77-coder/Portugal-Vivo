"""
Heritage API - Heritage CRUD and map endpoints extracted from server.py.
"""
from fastapi import APIRouter, HTTPException
from fastapi import Response
from typing import List, Optional

from models.api_models import HeritageItem, AccessibilityInfo
from shared_constants import CATEGORIES, REGIONS, MAIN_CATEGORIES, SUBCATEGORIES, SUBCATEGORIES_BY_MAIN, SUBCATEGORY_MAP, MAIN_CATEGORY_MAP, sanitize_regex
from shared_utils import DatabaseHolder, clamp_pagination

heritage_router = APIRouter()

_db_holder = DatabaseHolder("heritage")
set_heritage_db = _db_holder.set

# Backward compatibility: old category IDs -> new v19 category IDs
CATEGORY_ALIASES = {
    "areas_protegidas": "aventura_natureza",
    "cascatas": "cascatas_pocos",
    "rios": "praias_fluviais",
    "fauna": "fauna_autoctone",
    "percursos": "percursos_pedestres",
    "aldeias": "perolas_portugal",
    "arqueologia": "arqueologia_geologia",
    "arte": "arte_urbana",
    "religioso": "perolas_portugal",
    "moinhos": "moinhos_azenhas",
    "lendas": "musica_tradicional",
    "gastronomia": "restaurantes_gastronomia",
    "produtos": "produtores_dop",
    "tascas": "tabernas_historicas",
    "festas": "festas_romarias",
    "piscinas": "praias_fluviais",
    "termas": "termas_banhos",
    "baloicos": "aventura_natureza",
    "aventura": "aventura_natureza",
    "cogumelos": "natureza_especializada",
    "florestas": "natureza_especializada",
    "minerais": "arqueologia_geologia",
    "crencas": "festas_romarias",
    "saberes": "oficios_artesanato",
    "rotas": "rotas_tematicas",
    "comunidade": "guia_viajante",
}

def resolve_categories(cat_list: list) -> list:
    """Resolve old category IDs to new v19 IDs using alias mapping."""
    resolved = set()
    for cat in cat_list:
        cat = cat.strip()
        resolved.add(CATEGORY_ALIASES.get(cat, cat))
    return list(resolved)


@heritage_router.get("/categories")
async def get_categories(response: Response):
    """Get all heritage categories (legacy flat list for backward compat)"""
    response.headers["Cache-Control"] = "public, max-age=3600"
    return CATEGORIES


@heritage_router.get("/main-categories")
async def get_main_categories():
    """Get 6 main thematic categories with their subcategories"""
    result = []
    for mc in MAIN_CATEGORIES:
        subs = SUBCATEGORIES_BY_MAIN.get(mc["id"], [])
        result.append({
            **mc,
            "subcategory_count": len(subs),
            "subcategories": [
                {"id": s["id"], "name": s["name"], "icon": s["icon"], "color": s["color"], "theme": s["theme"], "poi_target": s["poi_target"], **({"coming_soon": True} if s.get("coming_soon") else {})}
                for s in subs
            ],
        })
    return result


@heritage_router.get("/subcategories")
async def get_subcategories(main_category: str = None):
    """Get subcategories, optionally filtered by main category"""
    if main_category:
        return SUBCATEGORIES_BY_MAIN.get(main_category, [])
    return SUBCATEGORIES


@heritage_router.get("/regions")
async def get_regions(response: Response):
    """Get all regions"""
    response.headers["Cache-Control"] = "public, max-age=3600"
    return REGIONS


@heritage_router.get("/heritage", response_model=List[HeritageItem])
async def get_heritage_items(
    category: Optional[str] = None,
    region: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get heritage items with filters"""
    skip, limit = clamp_pagination(skip, limit)
    query = {}

    if category:
        resolved = CATEGORY_ALIASES.get(category, category)
        query["category"] = resolved
    if region:
        query["region"] = region
    if search:
        safe_search = sanitize_regex(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"description": {"$regex": safe_search, "$options": "i"}},
            {"tags": {"$regex": safe_search, "$options": "i"}}
        ]

    items = await _db_holder.db.heritage_items.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    for item in items:
        loc = item.get("location")
        if isinstance(loc, dict) and ("lat" not in loc or "lng" not in loc):
            item["location"] = None
        # Strip internal-only fields from metadata
        meta = item.get("metadata")
        if isinstance(meta, dict):
            meta.pop("prompt_ia", None)
    return [HeritageItem(**item) for item in items]


@heritage_router.get("/heritage/{item_id}", response_model=HeritageItem)
async def get_heritage_item(item_id: str):
    """Get a single heritage item"""
    item = await _db_holder.db.heritage_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return HeritageItem(**item)


@heritage_router.get("/heritage/category/{category}", response_model=List[HeritageItem])
async def get_heritage_by_category(category: str, limit: int = 100):
    """Get heritage items by category"""
    resolved = CATEGORY_ALIASES.get(category, category)
    items = await _db_holder.db.heritage_items.find({"category": resolved}, {"_id": 0}).limit(limit).to_list(limit)
    return [HeritageItem(**item) for item in items]


@heritage_router.get("/heritage/region/{region}", response_model=List[HeritageItem])
async def get_heritage_by_region(region: str, limit: int = 100):
    """Get heritage items by region"""
    items = await _db_holder.db.heritage_items.find({"region": region}, {"_id": 0}).limit(limit).to_list(limit)
    return [HeritageItem(**item) for item in items]


@heritage_router.get("/map/items")
async def get_map_items(
    categories: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = 10000,
):
    """Get heritage items for map display (only items with GPS coordinates)"""
    query = {"location.lat": {"$exists": True, "$ne": None}}

    if categories:
        cat_list = resolve_categories(categories.split(","))
        query["category"] = {"$in": cat_list}
    if region:
        query["region"] = region

    projection = {
        "_id": 0, "id": 1, "name": 1, "description": 1, "category": 1,
        "subcategory": 1, "region": 1, "location": 1, "address": 1,
        "image_url": 1, "tags": 1, "related_items": 1, "metadata": 1,
        "created_at": 1, "iq_results.score": 1
    }
    capped = min(limit, 10000)
    items = await _db_holder.db.heritage_items.find(query, projection).limit(capped).to_list(capped)

    result = []
    for item in items:
        iq_score = None
        iq = item.get("iq_results")
        if iq:
            if isinstance(iq, list):
                scores = [m.get("score", 0) for m in iq if isinstance(m, dict) and m.get("score")]
                if scores:
                    iq_score = round(sum(scores) / len(scores), 1)
            elif isinstance(iq, dict):
                iq_score = iq.get("score")
        item.pop("iq_results", None)
        item["iq_score"] = iq_score
        # Strip internal-only fields from metadata
        meta = item.get("metadata")
        if isinstance(meta, dict):
            meta.pop("prompt_ia", None)
        if item.get("created_at"):
            item["created_at"] = str(item["created_at"])
        result.append(item)

    return result


@heritage_router.get("/map/night-explorer")
async def get_night_explorer_items():
    """Get POIs with night-relevant categories"""
    # New subcategory IDs (aligned with 44-subcategory taxonomy)
    night_categories = [
        "tabernas_historicas", "restaurantes_gastronomia",  # Gastronomia noturna
        "festas_romarias", "festivais_musica",              # Eventos/Festas
        "musica_tradicional",                                # Cultura noturna
        "arte_urbana",                                       # Arte & Cultura
    ]
    query = {
        "location.lat": {"$exists": True, "$ne": None},
        "category": {"$in": night_categories}
    }
    projection = {
        "_id": 0, "id": 1, "name": 1, "description": 1, "category": 1,
        "subcategory": 1, "region": 1, "location": 1, "image_url": 1,
        "iq_results.score": 1
    }
    items = await _db_holder.db.heritage_items.find(query, projection).limit(800).to_list(800)

    # Map subcategory -> night display info
    NIGHT_TYPE_MAP = {
        "tabernas_historicas": ("Gastronomia Noturna", "restaurant"),
        "restaurantes_gastronomia": ("Sabores Nocturnos", "local-dining"),
        "festas_romarias": ("Evento/Festa", "celebration"),
        "festivais_musica": ("Festival de Musica", "music-note"),
        "musica_tradicional": ("Cultura & Musica", "music-note"),
        "arte_urbana": ("Arte & Cultura", "palette"),
    }

    result = []
    for item in items:
        iq_score = None
        iq = item.get("iq_results")
        if iq:
            if isinstance(iq, list):
                scores = [m.get("score", 0) for m in iq if isinstance(m, dict) and m.get("score")]
                if scores:
                    iq_score = round(sum(scores) / len(scores), 1)
            elif isinstance(iq, dict):
                iq_score = iq.get("score")
        item.pop("iq_results", None)
        item["iq_score"] = iq_score
        cat = item.get("category", "")
        night_type, night_icon = NIGHT_TYPE_MAP.get(cat, ("Explorar Noturno", "visibility"))
        item["night_type"] = night_type
        item["night_icon"] = night_icon
        result.append(item)

    return {"items": result, "total": len(result)}


@heritage_router.get("/heritage/top-scored")
async def get_top_scored_items(limit_per_cat: int = 1):
    """Get top IQ-scored POI per category for landing page 'Descobertas Raras'"""
    pipeline = [
        {"$match": {
            "location.lat": {"$exists": True, "$ne": None},
            "image_url": {"$exists": True, "$ne": None, "$ne": ""},
        }},
        {"$addFields": {
            "iq_score_computed": {
                "$cond": {
                    "if": {"$isArray": "$iq_results"},
                    "then": {"$avg": "$iq_results.score"},
                    "else": {"$ifNull": ["$iq_results.score", 0]}
                }
            }
        }},
        {"$sort": {"iq_score_computed": -1}},
        {"$group": {
            "_id": "$category",
            "top_item": {"$first": "$$ROOT"}
        }},
        {"$replaceRoot": {"newRoot": "$top_item"}},
        {"$sort": {"iq_score_computed": -1}},
        {"$limit": 12},
        {"$project": {
            "_id": 0, "id": 1, "name": 1, "description": 1, "category": 1,
            "region": 1, "location": 1, "image_url": 1, "tags": 1,
            "iq_score_computed": 1,
        }},
    ]
    items = await _db_holder.db.heritage_items.aggregate(pipeline).to_list(12)

    result = []
    for item in items:
        cat_id = item.get("category", "")
        sub = SUBCATEGORY_MAP.get(cat_id, {})
        main_cat = MAIN_CATEGORY_MAP.get(sub.get("main_category", ""), {})
        item["category_name"] = sub.get("name", cat_id)
        item["main_category_name"] = main_cat.get("name", "")
        item["iq_score"] = round(item.pop("iq_score_computed", 0) or 0, 1)
        result.append(item)

    return result


@heritage_router.get("/heritage/stories")
async def get_stories():
    """Get curated stories for landing page 'Histórias que Inspiram'.

    Returns POIs that have rich descriptions and images, suitable for
    editorial storytelling. Each story links to a real heritage item.
    """
    # Select POIs with long descriptions and images — good story candidates
    pipeline = [
        {"$match": {
            "image_url": {"$exists": True, "$ne": None, "$ne": ""},
            "description": {"$exists": True},
            "$expr": {"$gte": [{"$strLenCP": {"$ifNull": ["$description", ""]}}, 80]},
        }},
        {"$addFields": {
            "desc_len": {"$strLenCP": "$description"},
            "iq_score_computed": {
                "$cond": {
                    "if": {"$isArray": "$iq_results"},
                    "then": {"$avg": "$iq_results.score"},
                    "else": {"$ifNull": ["$iq_results.score", 0]}
                }
            }
        }},
        {"$sort": {"iq_score_computed": -1, "desc_len": -1}},
        {"$limit": 8},
        {"$project": {
            "_id": 0, "id": 1, "name": 1, "description": 1, "category": 1,
            "region": 1, "image_url": 1, "tags": 1, "iq_score_computed": 1,
        }},
    ]
    items = await _db_holder.db.heritage_items.aggregate(pipeline).to_list(8)

    stories = []
    for item in items:
        desc = item.get("description", "")
        # Estimate read time: ~200 words/min in Portuguese
        word_count = len(desc.split())
        read_min = max(2, round(word_count / 200))
        cat_id = item.get("category", "")
        sub = SUBCATEGORY_MAP.get(cat_id, {})
        stories.append({
            "id": item["id"],
            "title": item["name"],
            "description": desc[:200] + ("..." if len(desc) > 200 else ""),
            "full_description": desc,
            "region": item.get("region", ""),
            "category": cat_id,
            "category_name": sub.get("name", cat_id),
            "image_url": item.get("image_url"),
            "tags": item.get("tags", []),
            "read_time": f"{read_min} min",
            "iq_score": round(item.get("iq_score_computed", 0) or 0, 1),
        })

    return stories


# ========================
# ACCESSIBILITY - TURISMO INCLUSIVO
# ========================

ACCESSIBILITY_FILTERS = {
    "wheelchair": "wheelchair_accessible",
    "reduced_mobility": "reduced_mobility",
    "visual": "visual_impairment",
    "hearing": "hearing_impairment",
    "pet_friendly": "pet_friendly",
    "child_friendly": "child_friendly",
    "senior_friendly": "senior_friendly",
    "parking": "parking_available",
    "public_transport": "public_transport",
    "wc_accessible": "toilet_accessible",
}


@heritage_router.get("/accessibility/filters")
async def get_accessibility_filters():
    """Get available accessibility filter options"""
    return {
        "filters": [
            {"id": "wheelchair", "name": "Acessivel a cadeira de rodas", "icon": "accessible"},
            {"id": "reduced_mobility", "name": "Mobilidade reduzida", "icon": "elderly"},
            {"id": "visual", "name": "Apoio visual (audioguias)", "icon": "visibility"},
            {"id": "hearing", "name": "Apoio auditivo (legendas)", "icon": "hearing"},
            {"id": "pet_friendly", "name": "Animais de estimacao", "icon": "pets"},
            {"id": "child_friendly", "name": "Adequado para criancas", "icon": "child-care"},
            {"id": "senior_friendly", "name": "Adequado para idosos", "icon": "elderly-woman"},
            {"id": "parking", "name": "Estacionamento disponivel", "icon": "local-parking"},
            {"id": "public_transport", "name": "Transportes publicos", "icon": "directions-bus"},
            {"id": "wc_accessible", "name": "WC acessivel", "icon": "wc"},
        ],
        "source": "Turismo de Portugal - All for All"
    }


@heritage_router.get("/heritage/accessible")
async def get_accessible_heritage(
    filters: Optional[str] = None,
    region: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50
):
    """Get heritage items filtered by accessibility features"""
    query = {}
    if region:
        query["region"] = region
    if category:
        query["category"] = category

    if filters:
        filter_list = filters.split(",")
        for filter_id in filter_list:
            if filter_id in ACCESSIBILITY_FILTERS:
                field = f"accessibility.{ACCESSIBILITY_FILTERS[filter_id]}"
                query[field] = True

    items = await _db_holder.db["heritage_items"].find(query).limit(limit).to_list(length=limit)

    for item in items:
        item["_id"] = str(item.get("_id", ""))

    return {
        "items": items,
        "total": len(items),
        "filters_applied": filters.split(",") if filters else [],
        "note": "Dados de acessibilidade baseados em Turismo de Portugal - All for All"
    }


@heritage_router.patch("/heritage/{item_id}/accessibility")
async def update_item_accessibility(
    item_id: str,
    accessibility: AccessibilityInfo,
):
    """Update accessibility information for an item"""
    result = await _db_holder.db["heritage_items"].update_one(
        {"id": item_id},
        {"$set": {"accessibility": accessibility.dict()}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")

    return {"message": "Accessibility information updated", "item_id": item_id}
