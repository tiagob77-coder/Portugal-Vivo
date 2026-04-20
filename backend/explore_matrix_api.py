"""
Explore Matrix API - Thematic matrix and exploration endpoints (Tab Explorar).
Extracted from server.py.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone
import logging

from shared_constants import REGIONS
from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

router = APIRouter()

_db_holder = DatabaseHolder("explore_matrix")
set_explore_matrix_db = _db_holder.set

THEMATIC_AXES = [
    {"id": "nature_adventure", "name": "Natureza & Aventura", "icon": "terrain", "categories": ["percursos_pedestres", "percursos", "aventura_natureza", "aventura", "miradouros", "cascatas_pocos", "cascatas", "ecovias_passadicos", "natureza_especializada", "areas_protegidas", "fauna_autoctone", "fauna", "flora_autoctone", "flora_botanica", "barragens_albufeiras", "rios", "moinhos_azenhas", "moinhos"]},
    {"id": "culture_heritage", "name": "Cultura & Patrimonio", "icon": "account-balance", "categories": ["castelos", "palacios_solares", "museus", "oficios_artesanato", "saberes", "arte_urbana", "arte", "patrimonio_ferroviario", "arqueologia_geologia", "arqueologia", "aldeias", "lendas", "festas_romarias", "festas"]},
    {"id": "gastronomy_wines", "name": "Gastronomia & Vinhos", "icon": "restaurant", "categories": ["restaurantes_gastronomia", "gastronomia", "tabernas_historicas", "tascas", "mercados_feiras", "produtores_dop", "produtos", "agroturismo_enoturismo", "pratos_tipicos", "docaria_regional"]},
    {"id": "wellness_thermal", "name": "Bem-Estar & Termalismo", "icon": "spa", "categories": ["termas_banhos", "termas"]},
    {"id": "coastal_nautical", "name": "Litoral & Nautica", "icon": "beach-access", "categories": ["surf", "praias_fluviais", "praias_fluviais_mar", "praias_bandeira_azul", "piscinas"]},
    {"id": "culture_viva", "name": "Cultura Viva", "icon": "celebration", "categories": ["musica_tradicional", "festivais_musica", "festas_romarias", "festas", "comunidade", "crencas", "religioso"]},
    {"id": "experiences_routes", "name": "Experiencias & Rotas", "icon": "hiking", "categories": ["rotas_tematicas", "rotas", "grande_expedicao", "perolas_portugal", "alojamentos_rurais", "parques_campismo", "pousadas_juventude", "agentes_turisticos", "entidades_operadores", "guia_viajante", "transportes"]},
]

@router.get("/explore/matrix")
async def get_thematic_matrix():
    """Get thematic x geographic matrix for exploration"""
    db = _db_holder.db
    matrix = []

    for theme in THEMATIC_AXES:
        theme_data = {
            "theme": theme,
            "regions": []
        }

        for region in REGIONS:
            count = await db.heritage_items.count_documents({
                "category": {"$in": theme["categories"]},
                "region": region["id"]
            })

            # Get top 3 items for this cell
            top_items = await db.heritage_items.find(
                {"category": {"$in": theme["categories"]}, "region": region["id"]},
                {"_id": 0, "id": 1, "name": 1, "image_url": 1}
            ).limit(3).to_list(3)

            theme_data["regions"].append({
                "region": region,
                "count": count,
                "top_items": top_items
            })

        matrix.append(theme_data)

    return {
        "matrix": matrix,
        "themes": THEMATIC_AXES,
        "regions": REGIONS
    }

@router.get("/explore/theme/{theme_id}")
async def explore_by_theme(theme_id: str, region: Optional[str] = None, limit: int = 50):
    """Explore items by thematic axis"""
    from shared_utils import clamp_pagination
    db = _db_holder.db
    _, limit = clamp_pagination(0, limit, max_limit=200)
    theme = next((t for t in THEMATIC_AXES if t["id"] == theme_id), None)
    if not theme:
        raise HTTPException(status_code=404, detail="Theme not found")

    query = {"category": {"$in": theme["categories"]}}
    if region:
        query["region"] = region

    items = await db.heritage_items.find(query, {"_id": 0}).limit(limit).to_list(limit)

    # Group by region
    by_region = {}
    for item in items:
        r = item.get("region", "unknown")
        if r not in by_region:
            by_region[r] = []
        by_region[r].append(item)

    return {
        "theme": theme,
        "total_items": len(items),
        "items": items,
        "by_region": by_region
    }

@router.get("/explore/region/{region_id}")
async def explore_by_region(region_id: str, theme: Optional[str] = None, limit: int = 50):
    """Explore items by region"""
    from shared_utils import clamp_pagination
    db = _db_holder.db
    _, limit = clamp_pagination(0, limit, max_limit=200)
    region = next((r for r in REGIONS if r["id"] == region_id), None)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    query = {"region": region_id}
    if theme:
        theme_obj = next((t for t in THEMATIC_AXES if t["id"] == theme), None)
        if theme_obj:
            query["category"] = {"$in": theme_obj["categories"]}

    items = await db.heritage_items.find(query, {"_id": 0}).limit(limit).to_list(limit)

    # Group by theme
    by_theme = {}
    for item in items:
        cat = item.get("category", "unknown")
        theme_id = None
        for t in THEMATIC_AXES:
            if cat in t["categories"]:
                theme_id = t["id"]
                break

        if theme_id:
            if theme_id not in by_theme:
                by_theme[theme_id] = []
            by_theme[theme_id].append(item)

    return {
        "region": region,
        "total_items": len(items),
        "items": items,
        "by_theme": by_theme
    }
