"""
IQ Engine - Module M12: Thematic Routing Analysis
Analisa a afinidade temática de um POI para geração de rotas por tema.

v2 additions:
  - Lightweight ontology: Surf ⊂ Aventura (inherited parent theme scores)
  - Narrative arc classification: intro / climax / closure role for route building
"""
from iq_engine_base import (
    IQModule, ModuleType, ProcessingResult, ProcessingStatus, POIProcessingData
)

# ──────────────────────────────────────────
# LIGHTWEIGHT ONTOLOGY
# child_theme → parent_theme
# Child themes inherit 40% of their parent's score (avoids double-counting)
# ──────────────────────────────────────────
THEME_ONTOLOGY: dict = {
    "surf":        "aventura",     # Surf ⊂ Aventura
    "arquitetura": "historico",    # Arquitectura ⊂ Histórico
    "romantico":   "natureza",     # Romântico partially inherits natureza
}

# Inheritance weight: child gets this fraction of parent's keyword score added
_INHERIT_WEIGHT = 0.40

# ──────────────────────────────────────────
# NARRATIVE ARC ROLES
# POI role within a multi-POI route narrative
# ──────────────────────────────────────────
NARRATIVE_INTRO_SIGNALS = [
    "entrada", "início", "partida", "ponto de partida", "começo",
    "receção", "boas-vindas", "miradouro", "panorâmica",
    "museu", "centro de interpretação", "visitor center",
]
NARRATIVE_CLIMAX_SIGNALS = [
    "castelo", "palácio", "catedral", "santuário", "monumento", "ruínas",
    "cascata", "cume", "pico", "summit", "topo", "vistas espetaculares",
    "patrimônio mundial", "unesco", "único", "imperdível", "icónico",
]
NARRATIVE_CLOSURE_SIGNALS = [
    "restaurante", "tasca", "taberna", "mercado", "adega", "queijaria",
    "miradouro do por do sol", "pôr do sol", "praia", "termais", "spa",
    "artes e ofícios", "loja", "mercado local",
]

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
    },
    "surf": {
        "name": "Rota de Surf & Desportos de Onda",
        "keywords": ["surf", "onda", "bodyboard", "longboard", "escola de surf",
                     "prancha", "fato de banho", "wipeout", "pico de surf", "break"],
        "categories": ["surf"],
        "weight": 1.0
    },
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

            keyword_score = min(len(matched_keywords) * 5, 40)
            score = min(50 if category in theme_config["categories"] else 0, 50) + keyword_score
            score = min(score * theme_config["weight"], 100)

            theme_scores[theme_id] = {
                "score": round(score, 1),
                "matched_keywords": matched_keywords[:5],
                "theme_name": theme_config["name"],
            }

        # ── Ontology inheritance: child inherits from parent ───────────────────
        for child_theme, parent_theme in THEME_ONTOLOGY.items():
            if child_theme in theme_scores and parent_theme in theme_scores:
                child_score = theme_scores[child_theme]["score"]
                parent_score = theme_scores[parent_theme]["score"]
                # Child score boosts parent
                inherited = child_score * _INHERIT_WEIGHT
                new_parent = min(100, parent_score + inherited)
                theme_scores[parent_theme]["score"] = round(new_parent, 1)
                theme_scores[parent_theme]["inherited_from"] = child_theme

        # Classify primary / secondary
        for theme_id, ts in theme_scores.items():
            if ts["score"] >= 50:
                primary_themes.append(theme_id)
            elif ts["score"] >= 25:
                secondary_themes.append(theme_id)

        sorted_themes = sorted(theme_scores.items(), key=lambda x: x[1]["score"], reverse=True)
        top_theme = sorted_themes[0] if sorted_themes else None

        # ── Narrative arc classification ───────────────────────────────────────
        narrative_role = self._classify_narrative_role(text_corpus, category)

        # Overall score
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
                "narrative_role": narrative_role,  # "intro" | "climax" | "closure" | "flexible"
            },
            issues=[],
            warnings=suggestions,
        )

    def _classify_narrative_role(self, text: str, category: str) -> str:
        """
        Classify the POI's role in a narrative route arc.
        Returns one of: "intro" | "climax" | "closure" | "flexible"
        """
        intro_score = sum(1 for s in NARRATIVE_INTRO_SIGNALS if s in text)
        climax_score = sum(1 for s in NARRATIVE_CLIMAX_SIGNALS if s in text)
        closure_score = sum(1 for s in NARRATIVE_CLOSURE_SIGNALS if s in text)

        max_score = max(intro_score, climax_score, closure_score)
        if max_score == 0:
            return "flexible"

        if climax_score == max_score:
            return "climax"
        if closure_score == max_score:
            return "closure"
        return "intro"
