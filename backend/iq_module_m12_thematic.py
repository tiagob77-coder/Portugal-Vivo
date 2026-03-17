"""
IQ Engine - Module M12: Thematic Routing Analysis
Analisa a afinidade temática de um POI para geração de rotas por tema.

Temas suportados: Religioso, Gastronómico, Natureza, Cultural, Histórico,
Arquitectura, Arte, Aventura, Familiar, Romântico
"""
from iq_engine_base import (
    IQModule, ModuleType, ProcessingResult, ProcessingStatus, POIProcessingData
)

# Theme definitions with keywords and category mappings
THEMES = {
    "religioso": {
        "name": "Rota Religiosa & Espiritual",
        "keywords": ["igreja", "capela", "santuário", "mosteiro", "convento", "catedral",
                     "ermida", "templo", "santo", "santa", "bispo", "paróquia", "diocese",
                     "romaria", "peregrinação", "fé", "oração", "sagrado", "cruz", "altar"],
        "categories": ["festas_romarias"],
        "weight": 1.0
    },
    "gastronomico": {
        "name": "Rota Gastronómica",
        "keywords": ["restaurante", "tasca", "taberna", "mercado", "queijo", "vinho",
                     "pastelaria", "doce", "conventual", "padaria", "adega", "gastronomia",
                     "culinária", "receita", "sabor", "cozinha", "bacalhau", "presunto"],
        "categories": ["restaurantes_gastronomia", "tabernas_historicas", "produtores_dop"],
        "weight": 1.0
    },
    "natureza": {
        "name": "Rota da Natureza",
        "keywords": ["parque", "jardim", "floresta", "serra", "rio", "lago", "praia",
                     "cascata", "trilho", "montanha", "vale", "reserva", "natural", "fauna",
                     "flora", "paisagem", "miradouro", "piscina", "termas"],
        "categories": ["aventura_natureza", "natureza_especializada", "praias_fluviais", "termas_banhos", "cascatas_pocos"],
        "weight": 1.0
    },
    "historico": {
        "name": "Rota Histórica",
        "keywords": ["castelo", "muralha", "romano", "medieval", "século", "rei", "rainha",
                     "fortaleza", "torre", "palácio", "ruínas", "arqueologia", "antigo",
                     "guerra", "batalha", "conquista", "fundação", "patrimonio", "monumento"],
        "categories": ["castelos", "arqueologia_geologia", "museus"],
        "weight": 1.0
    },
    "cultural": {
        "name": "Rota Cultural",
        "keywords": ["museu", "teatro", "galeria", "biblioteca", "festival", "arte",
                     "exposição", "cultura", "tradição", "artesanato", "folclore", "dança",
                     "música", "cinema", "escultura", "pintura"],
        "categories": ["museus", "arte_urbana", "festas_romarias", "oficios_artesanato"],
        "weight": 1.0
    },
    "aventura": {
        "name": "Rota de Aventura",
        "keywords": ["trilho", "escalada", "rapel", "canoagem", "btt", "surf", "parapente",
                     "mergulho", "radical", "desporto", "caminhada", "trekking", "percurso",
                     "bicicleta", "kayak", "rafting"],
        "categories": ["aventura_natureza", "surf", "percursos_pedestres"],
        "weight": 0.8
    },
    "arquitetura": {
        "name": "Rota da Arquitectura",
        "keywords": ["barroco", "gótico", "manuelino", "românico", "renascença", "moderno",
                     "art deco", "azulejo", "fachada", "claustro", "abóbada", "portal",
                     "arco", "coluna", "torre", "ponte"],
        "categories": ["castelos", "arqueologia_geologia"],
        "weight": 0.8
    },
    "romantico": {
        "name": "Rota Romântica",
        "keywords": ["jardim", "miradouro", "palácio", "ponte", "rio", "pôr do sol",
                     "romântico", "beleza", "vista", "panorâmica", "encantador", "charme"],
        "categories": [],
        "weight": 0.6
    }
}


class ThematicRoutingModule(IQModule):
    """M12 - Thematic Routing Analysis"""

    def __init__(self):
        super().__init__(ModuleType.THEMATIC_ROUTING)

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        text_corpus = f"{data.name} {data.description} {' '.join(data.tags)}".lower()
        category = (data.category or "").lower()

        theme_scores = {}
        primary_themes = []
        secondary_themes = []

        for theme_id, theme_config in THEMES.items():
            score = 0.0
            matched_keywords = []

            # Category match (strongest signal)
            if category in theme_config["categories"]:
                score += 50

            # Keyword matching
            for keyword in theme_config["keywords"]:
                if keyword in text_corpus:
                    score += 5
                    matched_keywords.append(keyword)

            # Cap keyword contribution at 40
            keyword_score = min(len(matched_keywords) * 5, 40)
            score = min(50 if category in theme_config["categories"] else 0, 50) + keyword_score

            # Apply theme weight
            score = min(score * theme_config["weight"], 100)

            theme_scores[theme_id] = {
                "score": round(score, 1),
                "matched_keywords": matched_keywords[:5],
                "theme_name": theme_config["name"]
            }

            if score >= 50:
                primary_themes.append(theme_id)
            elif score >= 25:
                secondary_themes.append(theme_id)

        # Sort themes by score
        sorted_themes = sorted(theme_scores.items(), key=lambda x: x[1]["score"], reverse=True)
        top_theme = sorted_themes[0] if sorted_themes else None

        # Overall score: based on having clear thematic affinity
        max_theme_score = top_theme[1]["score"] if top_theme else 0
        theme_diversity = len(primary_themes) + len(secondary_themes) * 0.5
        overall_score = min(max_theme_score * 0.7 + theme_diversity * 10, 100)

        suggestions = []
        if not primary_themes:
            suggestions.append("POI não tem afinidade temática clara - adicionar tags/categorias")
        if max_theme_score < 30:
            suggestions.append("Descrição muito genérica - enriquecer com termos temáticos")

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=round(overall_score, 1),
            confidence=min(max_theme_score / 100, 1.0),
            data={
                "primary_themes": primary_themes,
                "secondary_themes": secondary_themes,
                "top_theme": top_theme[0] if top_theme else None,
                "top_theme_name": top_theme[1]["theme_name"] if top_theme else None,
                "top_theme_score": top_theme[1]["score"] if top_theme else 0,
                "theme_count": len(primary_themes),
                "all_themes": {k: v["score"] for k, v in sorted_themes[:5]},
            },
            issues=[],
            warnings=suggestions
        )
