"""
Shared Constants - Single source of truth for CATEGORIES, REGIONS, BADGES, and other shared data.
All modules should import from here instead of defining their own copies.

Taxonomy: 6 Main Categories > 44 Subcategories (folhas) > ~6.271 POI
Portugal Vivo - 7 de marco de 2026
"""
import re


def sanitize_regex(user_input: str) -> str:
    """Escape regex special characters from user input to prevent ReDoS/injection."""
    return re.escape(user_input)


# =============================================================================
# MAIN CATEGORIES (6 thematic pillars)
# =============================================================================
MAIN_CATEGORIES = [
    {
        "id": "territorio_natureza",
        "name": "Territorio & Natureza",
        "icon": "terrain",
        "color": "#4CAF50",
        "description": "Paisagens, fauna, flora, geologia e geodiversidade de Portugal",
        "poi_target": 2020,
    },
    {
        "id": "historia_patrimonio",
        "name": "Historia & Patrimonio",
        "icon": "account-balance",
        "color": "#FFB300",
        "description": "Castelos, palacios, museus, arqueologia e patrimonio ferroviario",
        "poi_target": 1107,
    },
    {
        "id": "gastronomia_produtos",
        "name": "Gastronomia & Produtos Regionais",
        "icon": "restaurant",
        "color": "#E53935",
        "description": "Restaurantes, tabernas, mercados, produtores DOP e enoturismo",
        "poi_target": 1331,
    },
    {
        "id": "cultura_viva",
        "name": "Cultura Viva",
        "icon": "celebration",
        "color": "#8E24AA",
        "description": "Musica, festas populares, romarias, festivais e tradicoes",
        "poi_target": 419,
    },
    {
        "id": "praias_mar",
        "name": "Praias & Mar",
        "icon": "beach-access",
        "color": "#00BCD4",
        "description": "Surf, praias fluviais, costa atlantica e actividades aquaticas",
        "poi_target": 658,
    },
    {
        "id": "experiencias_rotas",
        "name": "Experiencias & Rotas Tematicas",
        "icon": "hiking",
        "color": "#66BB6A",
        "description": "Rotas, expedicoes, alojamentos, campismo e agentes turisticos",
        "poi_target": 841,
    },
]

MAIN_CATEGORY_IDS = [c["id"] for c in MAIN_CATEGORIES]
MAIN_CATEGORY_MAP = {c["id"]: c for c in MAIN_CATEGORIES}


# =============================================================================
# SUBCATEGORIES (44 folhas) - grouped by main category
# =============================================================================
SUBCATEGORIES = [
    # -------------------------------------------------------------------------
    # 1. TERRITORIO & NATUREZA (14 folhas, 2020 POI)
    # -------------------------------------------------------------------------
    {"id": "percursos_pedestres", "name": "Percursos Pedestres", "icon": "hiking", "color": "#84CC16", "main_category": "territorio_natureza", "theme": "Natureza & Desporto", "poi_target": 349},
    {"id": "aventura_natureza", "name": "Aventura e Natureza", "icon": "sports-kabaddi", "color": "#DC2626", "main_category": "territorio_natureza", "theme": "Natureza & Desporto", "poi_target": 175},
    {"id": "natureza_especializada", "name": "Natureza Especializada", "icon": "science", "color": "#7C3AED", "main_category": "territorio_natureza", "theme": "Natureza & Ciencia", "poi_target": 110},
    {"id": "fauna_autoctone", "name": "Fauna Autoctone", "icon": "pets", "color": "#65A30D", "main_category": "territorio_natureza", "theme": "Natureza & Biodiversidade", "poi_target": 103},
    {"id": "flora_autoctone", "name": "Flora Autoctone", "icon": "eco", "color": "#22C55E", "main_category": "territorio_natureza", "theme": "Natureza & Biodiversidade", "poi_target": 113},
    {"id": "flora_botanica", "name": "Flora Botanica", "icon": "local-florist", "color": "#A3E635", "main_category": "territorio_natureza", "theme": "Natureza & Biodiversidade", "poi_target": 101},
    {"id": "biodiversidade_avistamentos", "name": "Biodiversidade | Avistamentos", "icon": "visibility", "color": "#10B981", "main_category": "territorio_natureza", "theme": "Natureza & Ciencia", "poi_target": 34},
    {"id": "miradouros", "name": "Miradouros Portugal", "icon": "visibility", "color": "#0284C7", "main_category": "territorio_natureza", "theme": "Natureza & Paisagem", "poi_target": 293},
    {"id": "barragens_albufeiras", "name": "Barragens e Albufeiras", "icon": "water", "color": "#3B82F6", "main_category": "territorio_natureza", "theme": "Natureza & Agua", "poi_target": 35},
    {"id": "cascatas_pocos", "name": "Cascatas e Pocos Naturais", "icon": "water-drop", "color": "#0891B2", "main_category": "territorio_natureza", "theme": "Natureza & Agua", "poi_target": 100},
    {"id": "praias_fluviais", "name": "Praias Fluviais", "icon": "waves", "color": "#0EA5E9", "main_category": "territorio_natureza", "theme": "Natureza & Agua", "poi_target": 179},
    {"id": "arqueologia_geologia", "name": "Arqueologia, Geologia e Mineral", "icon": "hexagon", "color": "#78716C", "main_category": "territorio_natureza", "theme": "Ciencia & Geodiversidade", "poi_target": 90},
    {"id": "moinhos_azenhas", "name": "Moinhos e Azenhas", "icon": "settings", "color": "#78716C", "main_category": "territorio_natureza", "theme": "Patrimonio & Natureza", "poi_target": 50},
    {"id": "ecovias_passadicos", "name": "Ecovias e Passadicos", "icon": "directions-walk", "color": "#84CC16", "main_category": "territorio_natureza", "theme": "Natureza & Desporto", "poi_target": 288},

    # -------------------------------------------------------------------------
    # 2. HISTORIA & PATRIMONIO (7 folhas, 1107 POI)
    # -------------------------------------------------------------------------
    {"id": "castelos", "name": "Castelos", "icon": "castle", "color": "#92400E", "main_category": "historia_patrimonio", "theme": "Patrimonio Historico", "poi_target": 118},
    {"id": "palacios_solares", "name": "Palacios e Solares", "icon": "villa", "color": "#D97706", "main_category": "historia_patrimonio", "theme": "Patrimonio Historico", "poi_target": 192},
    {"id": "museus", "name": "Museus", "icon": "museum", "color": "#F59E0B", "main_category": "historia_patrimonio", "theme": "Cultura & Patrimonio", "poi_target": 399},
    {"id": "oficios_artesanato", "name": "Oficios e Artesanato", "icon": "construction", "color": "#10B981", "main_category": "historia_patrimonio", "theme": "Cultura & Patrimonio", "poi_target": 50},
    {"id": "termas_banhos", "name": "Termas e Banhos", "icon": "hot-tub", "color": "#06B6D4", "main_category": "historia_patrimonio", "theme": "Saude & Bem-Estar", "poi_target": 88},
    {"id": "patrimonio_ferroviario", "name": "Patrimonio Ferroviario", "icon": "train", "color": "#6366F1", "main_category": "historia_patrimonio", "theme": "Patrimonio & Transportes", "poi_target": 212},
    {"id": "arte_urbana", "name": "Arte Urbana e Intervencao", "icon": "palette", "color": "#E11D48", "main_category": "historia_patrimonio", "theme": "Cultura & Arte", "poi_target": 48},

    # -------------------------------------------------------------------------
    # 3. GASTRONOMIA & PRODUTOS REGIONAIS (7 folhas, 1331 POI)
    # -------------------------------------------------------------------------
    {"id": "restaurantes_gastronomia", "name": "Restaurantes e Gastronomia", "icon": "restaurant", "color": "#EF4444", "main_category": "gastronomia_produtos", "theme": "Gastronomia", "poi_target": 292},
    {"id": "tabernas_historicas", "name": "Tabernas Historicas", "icon": "local-bar", "color": "#B45309", "main_category": "gastronomia_produtos", "theme": "Gastronomia", "poi_target": 133},
    {"id": "mercados_feiras", "name": "Mercados e Feiras", "icon": "storefront", "color": "#F97316", "main_category": "gastronomia_produtos", "theme": "Gastronomia & Comercio", "poi_target": 240},
    {"id": "produtores_dop", "name": "Produtores DOP e Locais", "icon": "verified", "color": "#F97316", "main_category": "gastronomia_produtos", "theme": "Gastronomia & Producao", "poi_target": 176},
    {"id": "agroturismo_enoturismo", "name": "Agroturismo e Enoturismo", "icon": "wine-bar", "color": "#7C2D12", "main_category": "gastronomia_produtos", "theme": "Gastronomia & Turismo", "poi_target": 189},
    {"id": "pratos_tipicos", "name": "Pratos Tipicos", "icon": "lunch-dining", "color": "#EF4444", "main_category": "gastronomia_produtos", "theme": "Gastronomia Regional", "poi_target": 140},
    {"id": "docaria_regional", "name": "Docaria Regional", "icon": "cake", "color": "#EC4899", "main_category": "gastronomia_produtos", "theme": "Gastronomia Regional", "poi_target": 161},

    # -------------------------------------------------------------------------
    # 4. CULTURA VIVA (3 folhas, 419 POI)
    # -------------------------------------------------------------------------
    {"id": "musica_tradicional", "name": "Musica Tradicional", "icon": "music-note", "color": "#8B5CF6", "main_category": "cultura_viva", "theme": "Cultura & Musica", "poi_target": 208},
    {"id": "festivais_musica", "name": "Festivais de Musica", "icon": "festival", "color": "#D946EF", "main_category": "cultura_viva", "theme": "Cultura & Eventos", "poi_target": 60},
    {"id": "festas_romarias", "name": "Festas e Romarias", "icon": "celebration", "color": "#F59E0B", "main_category": "cultura_viva", "theme": "Cultura & Tradicao", "poi_target": 151},

    # -------------------------------------------------------------------------
    # 5. PRAIAS & MAR (3 folhas, 658 POI)
    # -------------------------------------------------------------------------
    {"id": "surf", "name": "Surf", "icon": "surfing", "color": "#0EA5E9", "main_category": "praias_mar", "theme": "Desporto & Mar", "poi_target": 36},
    {"id": "praias_fluviais_mar", "name": "Praias Fluviais", "icon": "waves", "color": "#06B6D4", "main_category": "praias_mar", "theme": "Natureza & Agua", "poi_target": 179},
    {"id": "praias_bandeira_azul", "name": "Praias Bandeira Azul", "icon": "beach-access", "color": "#2563EB", "main_category": "praias_mar", "theme": "Natureza & Praia", "poi_target": 443},

    # -------------------------------------------------------------------------
    # 6. EXPERIENCIAS & ROTAS TEMATICAS (10 folhas, 841 POI)
    # -------------------------------------------------------------------------
    {"id": "rotas_tematicas", "name": "Rotas Tematicas", "icon": "route", "color": "#EC4899", "main_category": "experiencias_rotas", "theme": "Rotas & Itinerarios", "poi_target": 177},
    {"id": "grande_expedicao", "name": "Grande Expedicao 2026", "icon": "explore", "color": "#F59E0B", "main_category": "experiencias_rotas", "theme": "Rotas & Itinerarios", "poi_target": 27},
    {"id": "perolas_portugal", "name": "Perolas de Portugal", "icon": "diamond", "color": "#D946EF", "main_category": "experiencias_rotas", "theme": "Destaque Editorial", "poi_target": 49},
    {"id": "alojamentos_rurais", "name": "Alojamentos Rurais", "icon": "cottage", "color": "#92400E", "main_category": "experiencias_rotas", "theme": "Alojamento", "poi_target": 136, "coming_soon": True},
    {"id": "parques_campismo", "name": "Parques de Campismo", "icon": "camping", "color": "#22C55E", "main_category": "experiencias_rotas", "theme": "Alojamento", "poi_target": 82},
    {"id": "pousadas_juventude", "name": "Pousadas de Juventude", "icon": "hotel", "color": "#3B82F6", "main_category": "experiencias_rotas", "theme": "Alojamento", "poi_target": 54},
    {"id": "agentes_turisticos", "name": "Agentes Turisticos", "icon": "support-agent", "color": "#14B8A6", "main_category": "experiencias_rotas", "theme": "Servicos Turisticos", "poi_target": 115, "coming_soon": True},
    {"id": "entidades_operadores", "name": "Entidades e Operadores", "icon": "business", "color": "#6366F1", "main_category": "experiencias_rotas", "theme": "Servicos Turisticos", "poi_target": 64, "coming_soon": True},
    {"id": "guia_viajante", "name": "Guia do Viajante", "icon": "menu-book", "color": "#F97316", "main_category": "experiencias_rotas", "theme": "Informacao Pratica", "poi_target": 73},
    {"id": "transportes", "name": "Transportes", "icon": "directions-bus", "color": "#78716C", "main_category": "experiencias_rotas", "theme": "Informacao Pratica", "poi_target": 64},
]

SUBCATEGORY_IDS = [s["id"] for s in SUBCATEGORIES]
SUBCATEGORY_MAP = {s["id"]: s for s in SUBCATEGORIES}

# Group subcategories by main category
SUBCATEGORIES_BY_MAIN = {}
for _sub in SUBCATEGORIES:
    SUBCATEGORIES_BY_MAIN.setdefault(_sub["main_category"], []).append(_sub)


# =============================================================================
# BACKWARD COMPATIBILITY - flat CATEGORIES list (old 26 IDs -> new subcategory IDs)
# =============================================================================
OLD_TO_NEW_CATEGORY = {
    # Old ID -> New subcategory ID
    "lendas": "musica_tradicional",       # cultural content -> cultura_viva
    "festas": "festas_romarias",
    "saberes": "oficios_artesanato",
    "crencas": "musica_tradicional",       # cultural content -> cultura_viva
    "gastronomia": "restaurantes_gastronomia",
    "produtos": "produtores_dop",
    "termas": "termas_banhos",
    "areas_protegidas": "natureza_especializada",
    "rios": "barragens_albufeiras",
    "minerais": "arqueologia_geologia",
    "aldeias": "rotas_tematicas",
    "percursos": "percursos_pedestres",
    "rotas": "rotas_tematicas",
    "piscinas": "praias_fluviais",
    "cogumelos": "flora_autoctone",
    "arqueologia": "arqueologia_geologia",
    "fauna": "fauna_autoctone",
    "arte": "arte_urbana",
    "religioso": "festas_romarias",
    "comunidade": "musica_tradicional",
    "miradouros": "miradouros",
    "cascatas": "cascatas_pocos",
    "tascas": "tabernas_historicas",
    "baloicos": "ecovias_passadicos",
    "moinhos": "moinhos_azenhas",
    "aventura": "aventura_natureza",
}

# Legacy flat CATEGORIES list - all 44 subcategories as flat categories
# This keeps backward compatibility for existing code that imports CATEGORIES
CATEGORIES = [
    {"id": s["id"], "name": s["name"], "icon": s["icon"], "color": s["color"], **({"coming_soon": True} if s.get("coming_soon") else {})}
    for s in SUBCATEGORIES
]

CATEGORY_IDS = [c["id"] for c in CATEGORIES]
CATEGORY_MAP = {c["id"]: c for c in CATEGORIES}


# =============================================================================
# REGIONS (NUTS II)
# =============================================================================
REGIONS = [
    {"id": "norte", "name": "Norte", "color": "#3B82F6"},
    {"id": "centro", "name": "Centro", "color": "#22C55E"},
    {"id": "lisboa", "name": "Lisboa e Vale do Tejo", "color": "#F59E0B"},
    {"id": "alentejo", "name": "Alentejo", "color": "#EF4444"},
    {"id": "algarve", "name": "Algarve", "color": "#06B6D4"},
    {"id": "acores", "name": "Acores", "color": "#8B5CF6"},
    {"id": "madeira", "name": "Madeira", "color": "#EC4899"},
]

REGION_IDS = [r["id"] for r in REGIONS]
REGION_MAP = {r["id"]: r for r in REGIONS}


# =============================================================================
# ENCYCLOPEDIA UNIVERSES (aligned with 6 main categories)
# =============================================================================
ENCYCLOPEDIA_UNIVERSES = [
    {
        "id": "territorio_natureza",
        "name": "Territorio & Natureza",
        "description": "Paisagens, fauna, flora, geologia e geodiversidade de Portugal",
        "seo_description": "Descubra a beleza natural de Portugal. Explore paisagens deslumbrantes, parques naturais, rios e reservas que definem a biodiversidade e o ecossistema unico de norte a sul do pais.",
        "icon": "terrain",
        "color": "#4CAF50",
        "categories": [s["id"] for s in SUBCATEGORIES_BY_MAIN.get("territorio_natureza", [])]
    },
    {
        "id": "historia_patrimonio",
        "name": "Historia & Patrimonio",
        "description": "Castelos, palacios, museus, arqueologia e patrimonio ferroviario",
        "seo_description": "Uma viagem no tempo pelo vasto patrimonio de Portugal. Explore monumentos iconicos, aldeias historicas e vestigios arqueologicos que contam a historia e a identidade da nossa nacao.",
        "icon": "account-balance",
        "color": "#FFB300",
        "categories": [s["id"] for s in SUBCATEGORIES_BY_MAIN.get("historia_patrimonio", [])]
    },
    {
        "id": "gastronomia_produtos",
        "name": "Gastronomia & Produtos Regionais",
        "description": "Sabores autenticos, vinhos e produtos DOP",
        "seo_description": "Saboreie a autenticidade da cozinha portuguesa. Descubra vinhos premiados, produtos DOP e as tabernas mais tradicionais que celebram os sabores e saberes locais.",
        "icon": "restaurant",
        "color": "#E53935",
        "categories": [s["id"] for s in SUBCATEGORIES_BY_MAIN.get("gastronomia_produtos", [])]
    },
    {
        "id": "cultura_viva",
        "name": "Cultura Viva",
        "description": "Musica, festas populares, romarias, festivais e tradicoes",
        "seo_description": "Mergulhe na alma de Portugal. Conheca as festas populares, tradicoes ancestrais, lendas e os saberes que mantem viva a nossa identidade cultural e artistica.",
        "icon": "celebration",
        "color": "#8E24AA",
        "categories": [s["id"] for s in SUBCATEGORIES_BY_MAIN.get("cultura_viva", [])]
    },
    {
        "id": "praias_mar",
        "name": "Praias & Mar",
        "description": "Surf, praias fluviais, costa atlantica e actividades aquaticas",
        "seo_description": "Costa, sol e mar. Explore as melhores praias de Portugal, desfrute de aguas serenas em praias fluviais e aventure-se em desportos nauticos de norte a sul.",
        "icon": "beach-access",
        "color": "#00BCD4",
        "categories": [s["id"] for s in SUBCATEGORIES_BY_MAIN.get("praias_mar", [])]
    },
    {
        "id": "experiencias_rotas",
        "name": "Experiencias & Rotas Tematicas",
        "description": "Rotas, expedicoes, alojamentos, campismo e agentes turisticos",
        "seo_description": "Aventure-se por Portugal. Explore percursos pedestres, rotas tematicas e experiencias unicas de turismo ativo para um roteiro inesquecivel.",
        "icon": "hiking",
        "color": "#66BB6A",
        "categories": [s["id"] for s in SUBCATEGORIES_BY_MAIN.get("experiencias_rotas", [])]
    }
]

ENCYCLOPEDIA_UNIVERSE_MAP = {u["id"]: u for u in ENCYCLOPEDIA_UNIVERSES}


# =============================================================================
# UNIVERSE BADGES - tier-based progression linked to encyclopedia universes
# =============================================================================
UNIVERSE_BADGES = [
    {
        "id": "explorador_natureza",
        "name": "Explorador da Natureza",
        "description": "Visite locais de natureza em Portugal",
        "icon": "terrain",
        "color": "#22C55E",
        "universe": "territorio_natureza",
        "tiers": [
            {"level": "bronze", "visits": 5, "points": 50},
            {"level": "prata", "visits": 15, "points": 150},
            {"level": "ouro", "visits": 30, "points": 300},
            {"level": "platina", "visits": 50, "points": 500}
        ]
    },
    {
        "id": "guardiao_patrimonio",
        "name": "Guardiao do Patrimonio",
        "description": "Descubra o patrimonio historico portugues",
        "icon": "account-balance",
        "color": "#F59E0B",
        "universe": "historia_patrimonio",
        "tiers": [
            {"level": "bronze", "visits": 5, "points": 50},
            {"level": "prata", "visits": 15, "points": 150},
            {"level": "ouro", "visits": 30, "points": 300},
            {"level": "platina", "visits": 50, "points": 500}
        ]
    },
    {
        "id": "mestre_gastronomia",
        "name": "Mestre da Gastronomia",
        "description": "Saboreie a gastronomia portuguesa",
        "icon": "restaurant",
        "color": "#EF4444",
        "universe": "gastronomia_produtos",
        "tiers": [
            {"level": "bronze", "visits": 5, "points": 50},
            {"level": "prata", "visits": 15, "points": 150},
            {"level": "ouro", "visits": 30, "points": 300},
            {"level": "platina", "visits": 50, "points": 500}
        ]
    },
    {
        "id": "alma_cultura",
        "name": "Alma da Cultura",
        "description": "Participe nas tradicoes e festas",
        "icon": "celebration",
        "color": "#8B5CF6",
        "universe": "cultura_viva",
        "tiers": [
            {"level": "bronze", "visits": 5, "points": 50},
            {"level": "prata", "visits": 15, "points": 150},
            {"level": "ouro", "visits": 30, "points": 300},
            {"level": "platina", "visits": 50, "points": 500}
        ]
    },
    {
        "id": "filho_mar",
        "name": "Filho do Mar",
        "description": "Explore as costas e praias",
        "icon": "beach-access",
        "color": "#06B6D4",
        "universe": "praias_mar",
        "tiers": [
            {"level": "bronze", "visits": 5, "points": 50},
            {"level": "prata", "visits": 15, "points": 150},
            {"level": "ouro", "visits": 30, "points": 300},
            {"level": "platina", "visits": 50, "points": 500}
        ]
    },
    {
        "id": "aventureiro",
        "name": "Aventureiro",
        "description": "Complete percursos e rotas tematicas",
        "icon": "hiking",
        "color": "#84CC16",
        "universe": "experiencias_rotas",
        "tiers": [
            {"level": "bronze", "visits": 5, "points": 50},
            {"level": "prata", "visits": 15, "points": 150},
            {"level": "ouro", "visits": 30, "points": 300},
            {"level": "platina", "visits": 50, "points": 500}
        ]
    },
    {
        "id": "primeiro_passo",
        "name": "Primeiro Passo",
        "description": "Visite o seu primeiro local",
        "icon": "flag",
        "color": "#F59E0B",
        "universe": None,
        "tiers": [{"level": "unico", "visits": 1, "points": 25}]
    },
    {
        "id": "coleccionador",
        "name": "Coleccionador",
        "description": "Visite 100 locais diferentes",
        "icon": "collections",
        "color": "#D946EF",
        "universe": None,
        "tiers": [
            {"level": "bronze", "visits": 25, "points": 100},
            {"level": "prata", "visits": 50, "points": 250},
            {"level": "ouro", "visits": 100, "points": 500},
            {"level": "platina", "visits": 200, "points": 1000}
        ]
    },
    {
        "id": "explorador_regioes",
        "name": "Explorador de Regioes",
        "description": "Visite locais em todas as regioes",
        "icon": "public",
        "color": "#14B8A6",
        "universe": None,
        "tiers": [
            {"level": "bronze", "visits": 3, "points": 75},
            {"level": "prata", "visits": 5, "points": 150},
            {"level": "ouro", "visits": 7, "points": 300}
        ]
    }
]


# =============================================================================
# GAMIFICATION BADGES - threshold-based check-in proximity badges
# =============================================================================
GAMIFICATION_BADGES = [
    # Exploration badges
    {"id": "explorador_iniciante", "name": "Explorador Iniciante", "description": "Primeiro check-in realizado", "icon": "star", "color": "#F59E0B", "condition": "checkins >= 1", "threshold": 1, "type": "checkins"},
    {"id": "caminhante", "name": "Caminhante", "description": "10 check-ins realizados", "icon": "directions-walk", "color": "#22C55E", "condition": "checkins >= 10", "threshold": 10, "type": "checkins"},
    {"id": "aventureiro_checkin", "name": "Aventureiro", "description": "25 check-ins realizados", "icon": "hiking", "color": "#3B82F6", "condition": "checkins >= 25", "threshold": 25, "type": "checkins"},
    {"id": "explorador_master", "name": "Explorador Master", "description": "50 check-ins realizados", "icon": "military-tech", "color": "#8B5CF6", "condition": "checkins >= 50", "threshold": 50, "type": "checkins"},
    {"id": "lendario", "name": "Lendario", "description": "100 check-ins realizados", "icon": "emoji-events", "color": "#EF4444", "condition": "checkins >= 100", "threshold": 100, "type": "checkins"},

    # Region badges
    {"id": "mestre_norte", "name": "Mestre do Norte", "description": "10 check-ins na regiao Norte", "icon": "terrain", "color": "#059669", "threshold": 10, "type": "region", "region": "norte"},
    {"id": "mestre_centro", "name": "Mestre do Centro", "description": "10 check-ins na regiao Centro", "icon": "account-balance", "color": "#D97706", "threshold": 10, "type": "region", "region": "centro"},
    {"id": "mestre_lisboa", "name": "Mestre de Lisboa", "description": "10 check-ins em Lisboa", "icon": "location-city", "color": "#DC2626", "threshold": 10, "type": "region", "region": "lisboa"},
    {"id": "mestre_alentejo", "name": "Mestre do Alentejo", "description": "10 check-ins no Alentejo", "icon": "wb-sunny", "color": "#CA8A04", "threshold": 10, "type": "region", "region": "alentejo"},
    {"id": "mestre_algarve", "name": "Mestre do Algarve", "description": "10 check-ins no Algarve", "icon": "beach-access", "color": "#0EA5E9", "threshold": 10, "type": "region", "region": "algarve"},

    # Category badges (using new subcategory IDs)
    {"id": "gastronomo", "name": "Gastronomo", "description": "10 check-ins em Gastronomia", "icon": "restaurant", "color": "#EF4444", "threshold": 10, "type": "category", "category": "restaurantes_gastronomia"},
    {"id": "naturalista", "name": "Naturalista", "description": "10 check-ins em Natureza", "icon": "park", "color": "#22C55E", "threshold": 10, "type": "category", "category": "natureza_especializada"},
    {"id": "historiador", "name": "Historiador", "description": "10 check-ins em Arqueologia", "icon": "account-balance", "color": "#D97706", "threshold": 10, "type": "category", "category": "arqueologia_geologia"},
    {"id": "artista", "name": "Artista", "description": "10 check-ins em Arte", "icon": "palette", "color": "#8B5CF6", "threshold": 10, "type": "category", "category": "arte_urbana"},

    # Special badges
    {"id": "castelos_portugal", "name": "Conquistador de Castelos", "description": "Check-in em 5 castelos", "icon": "castle", "color": "#92400E", "threshold": 5, "type": "category", "category": "castelos"},
    {"id": "taberneiro", "name": "Taberneiro", "description": "5 tabernas historicas visitadas", "icon": "local-bar", "color": "#7C3AED", "threshold": 5, "type": "category", "category": "tabernas_historicas"},
    {"id": "termalista", "name": "Termalista", "description": "5 termas visitadas", "icon": "hot-tub", "color": "#0284C7", "threshold": 5, "type": "category", "category": "termas_banhos"},

    # Nature & Biodiversity badges
    {"id": "guardiao_natureza", "name": "Guardiao da Natureza", "description": "5 check-ins em areas protegidas", "icon": "park", "color": "#16A34A", "threshold": 5, "type": "category", "category": "natureza_especializada"},
    {"id": "biodiversidade", "name": "Explorador da Biodiversidade", "description": "Visitar 3 estacoes de biodiversidade", "icon": "biotech", "color": "#059669", "threshold": 3, "type": "category", "category": "biodiversidade_avistamentos"},
    {"id": "trilheiro", "name": "Trilheiro", "description": "10 check-ins em trilhos pedestres", "icon": "hiking", "color": "#D97706", "threshold": 10, "type": "category", "category": "percursos_pedestres"},
    {"id": "ciclista_verde", "name": "Ciclista Verde", "description": "5 check-ins em ecovias", "icon": "pedal-bike", "color": "#0D9488", "threshold": 5, "type": "category", "category": "ecovias_passadicos"},
    {"id": "observador_aves", "name": "Observador de Aves", "description": "Check-in em 3 locais de fauna", "icon": "flutter-dash", "color": "#7C3AED", "threshold": 3, "type": "category", "category": "fauna_autoctone"},
    {"id": "viajante_sustentavel", "name": "Viajante Sustentavel", "description": "10 viagens usando transportes publicos", "icon": "directions-transit", "color": "#2563EB", "threshold": 10, "type": "category", "category": "transportes"},
    {"id": "peregrino", "name": "Peregrino", "description": "Check-in em 5 pontos de rotas tematicas", "icon": "church", "color": "#CA8A04", "threshold": 5, "type": "category", "category": "rotas_tematicas"},
    {"id": "costa_atlantica", "name": "Atlantico", "description": "10 check-ins em praias", "icon": "waves", "color": "#0EA5E9", "threshold": 10, "type": "category", "category": "praias_bandeira_azul"},
]


# =============================================================================
# DASHBOARD BADGES - visit-count progression badges for user dashboard
# =============================================================================
DASHBOARD_BADGES = [
    {"id": "first_visit", "name": "Primeiro Passo", "description": "Visitou o primeiro ponto de interesse", "icon": "flag", "color": "#22C55E", "points": 10, "requirement": 1, "type": "visits"},
    {"id": "explorer_10", "name": "Explorador", "description": "Visitou 10 pontos de interesse", "icon": "explore", "color": "#3B82F6", "points": 50, "requirement": 10, "type": "visits"},
    {"id": "explorer_50", "name": "Aventureiro", "description": "Visitou 50 pontos de interesse", "icon": "hiking", "color": "#8B5CF6", "points": 200, "requirement": 50, "type": "visits"},
    {"id": "explorer_100", "name": "Descobridor", "description": "Visitou 100 pontos de interesse", "icon": "public", "color": "#F59E0B", "points": 500, "requirement": 100, "type": "visits"},
    {"id": "termas_master", "name": "Mestre das Águas", "description": "Visitou 10 termas diferentes", "icon": "hot-tub", "color": "#06B6D4", "points": 100, "requirement": 10, "type": "category_termas_banhos"},
    {"id": "praia_lover", "name": "Amante das Praias", "description": "Visitou 15 praias fluviais", "icon": "pool", "color": "#0EA5E9", "points": 100, "requirement": 15, "type": "category_praias_fluviais"},
    {"id": "miradouro_hunter", "name": "Caçador de Vistas", "description": "Visitou 10 miradouros", "icon": "landscape", "color": "#6366F1", "points": 100, "requirement": 10, "type": "category_miradouros"},
    {"id": "gastronome", "name": "Gastrónomo", "description": "Visitou 10 locais gastronómicos", "icon": "restaurant", "color": "#EF4444", "points": 100, "requirement": 10, "type": "category_restaurantes_gastronomia"},
    {"id": "history_buff", "name": "Amante da História", "description": "Visitou 10 locais históricos", "icon": "account-balance", "color": "#7C3AED", "points": 100, "requirement": 10, "type": "category_castelos"},
    {"id": "all_regions", "name": "Portugal Inteiro", "description": "Visitou todas as 7 regiões", "icon": "map", "color": "#EC4899", "points": 300, "requirement": 7, "type": "regions"},
    {"id": "streak_7", "name": "Explorador Semanal", "description": "7 dias seguidos de visitas", "icon": "local-fire-department", "color": "#F59E0B", "points": 75, "requirement": 7, "type": "streak"},
    {"id": "streak_30", "name": "Explorador Mensal", "description": "30 dias seguidos de visitas", "icon": "whatshot", "color": "#EF4444", "points": 300, "requirement": 30, "type": "streak"},
]


# =============================================================================
# LEVEL DEFINITIONS - XP-based user level progression
# =============================================================================
LEVEL_DEFINITIONS = [
    {"level": 1, "name": "Curioso", "min_points": 0, "icon": "emoji-objects"},
    {"level": 2, "name": "Explorador", "min_points": 100, "icon": "explore"},
    {"level": 3, "name": "Aventureiro", "min_points": 300, "icon": "hiking"},
    {"level": 4, "name": "Descobridor", "min_points": 600, "icon": "travel-explore"},
    {"level": 5, "name": "Conhecedor", "min_points": 1000, "icon": "auto-awesome"},
    {"level": 6, "name": "Mestre", "min_points": 1500, "icon": "workspace-premium"},
    {"level": 7, "name": "Guardião", "min_points": 2500, "icon": "shield"},
    {"level": 8, "name": "Embaixador", "min_points": 4000, "icon": "military-tech"},
    {"level": 9, "name": "Lenda", "min_points": 6000, "icon": "stars"},
    {"level": 10, "name": "Imortal", "min_points": 10000, "icon": "diamond"},
]
