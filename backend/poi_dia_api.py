"""
POI do Dia - Daily highlight POI based on IQ Engine scores
Rotates categories daily to showcase different types of heritage.
"""
from datetime import datetime, timezone
from fastapi import APIRouter
from shared_utils import DatabaseHolder

poi_dia_router = APIRouter(prefix="/poi-do-dia", tags=["POI do Dia"])

_db_holder = DatabaseHolder("poi_dia")
set_poi_dia_db = _db_holder.set


CATEGORY_ROTATION = [
    "arte_urbana", "percursos_pedestres", "restaurantes_gastronomia", "miradouros",
    "produtores_dop", "arqueologia_geologia", "aventura_natureza", "tabernas_historicas",
    "festas_romarias", "fauna_autoctone", "termas_banhos", "natureza_especializada",
    "cascatas_pocos", "praias_fluviais", "alojamentos_rurais", "oficios_artesanato",
    "castelos", "rotas_tematicas", "museus", "ecovias_passadicos",
    "surf", "musica_tradicional", "mercados_feiras",
]

CATEGORY_LABELS = {
    "arte_urbana": "Arte & Cultura",
    "percursos_pedestres": "Percursos & Trilhos",
    "restaurantes_gastronomia": "Gastronomia",
    "miradouros": "Miradouros",
    "produtores_dop": "Produtos & Mercados",
    "arqueologia_geologia": "Arqueologia & Monumentos",
    "aventura_natureza": "Aventura & Natureza",
    "tabernas_historicas": "Tabernas Históricas",
    "festas_romarias": "Festas & Romarias",
    "fauna_autoctone": "Fauna & Flora",
    "termas_banhos": "Termas & Bem-estar",
    "natureza_especializada": "Áreas Protegidas",
    "cascatas_pocos": "Cascatas & Poços",
    "praias_fluviais": "Praias Fluviais",
    "alojamentos_rurais": "Alojamentos Rurais",
    "oficios_artesanato": "Saberes & Artesanato",
    "castelos": "Castelos & Fortalezas",
    "rotas_tematicas": "Rotas Temáticas",
    "museus": "Museus",
    "ecovias_passadicos": "Ecovias & Passadiços",
    "surf": "Surf",
    "musica_tradicional": "Música Tradicional",
    "mercados_feiras": "Mercados & Feiras",
}

CATEGORY_ICONS = {
    "arte_urbana": "palette", "percursos_pedestres": "hiking",
    "restaurantes_gastronomia": "restaurant", "miradouros": "landscape",
    "produtores_dop": "storefront", "arqueologia_geologia": "account-balance",
    "aventura_natureza": "terrain", "tabernas_historicas": "local-bar",
    "festas_romarias": "celebration", "fauna_autoctone": "pets",
    "termas_banhos": "hot-tub", "natureza_especializada": "park",
    "cascatas_pocos": "water", "praias_fluviais": "pool",
    "alojamentos_rurais": "cottage", "oficios_artesanato": "construction",
    "castelos": "castle", "rotas_tematicas": "map",
    "museus": "museum", "ecovias_passadicos": "directions-walk",
    "surf": "surfing", "musica_tradicional": "music-note",
    "mercados_feiras": "storefront",
}


@poi_dia_router.get("")
async def get_poi_do_dia():
    """Get today's highlighted POI - rotates category daily"""
    db = _db_holder.db

    today = datetime.now(timezone.utc)
    day_of_year = today.timetuple().tm_yday
    cat_index = day_of_year % len(CATEGORY_ROTATION)
    category = CATEGORY_ROTATION[cat_index]

    # Get the highest IQ scored POI in this category
    poi = await db.heritage_items.find_one(
        {"category": category, "iq_score": {"$exists": True, "$gt": 0}},
        {"_id": 0, "id": 1, "name": 1, "description": 1, "category": 1,
         "region": 1, "location": 1, "address": 1, "image_url": 1,
         "iq_score": 1, "tags": 1, "metadata": 1, "subcategory": 1},
        sort=[("iq_score", -1)]
    )

    # Fallback: try next categories if this one has no IQ-scored POIs
    if not poi:
        for offset in range(1, len(CATEGORY_ROTATION)):
            fallback_cat = CATEGORY_ROTATION[(cat_index + offset) % len(CATEGORY_ROTATION)]
            poi = await db.heritage_items.find_one(
                {"category": fallback_cat, "iq_score": {"$exists": True, "$gt": 0}},
                {"_id": 0, "id": 1, "name": 1, "description": 1, "category": 1,
                 "region": 1, "location": 1, "address": 1, "image_url": 1,
                 "iq_score": 1, "tags": 1, "metadata": 1, "subcategory": 1},
                sort=[("iq_score", -1)]
            )
            if poi:
                category = fallback_cat
                break

    if not poi:
        return {"has_poi": False, "message": "Nenhum POI disponível"}

    # Get runner-up for "next" hint
    runner_up_cat = CATEGORY_ROTATION[(cat_index + 1) % len(CATEGORY_ROTATION)]

    return {
        "has_poi": True,
        "date": today.strftime("%Y-%m-%d"),
        "category": category,
        "category_label": CATEGORY_LABELS.get(category, category),
        "category_icon": CATEGORY_ICONS.get(category, "place"),
        "tomorrow_category": CATEGORY_LABELS.get(runner_up_cat, runner_up_cat),
        "poi": {
            "id": poi["id"],
            "name": poi["name"],
            "description": poi.get("description", ""),
            "category": poi.get("category", ""),
            "subcategory": poi.get("subcategory", ""),
            "region": poi.get("region", ""),
            "address": poi.get("address", ""),
            "location": poi.get("location", {}),
            "image_url": poi.get("image_url"),
            "iq_score": poi.get("iq_score", 0),
            "rarity": poi.get("metadata", {}).get("rarity", ""),
            "website": poi.get("metadata", {}).get("website", ""),
        },
    }
