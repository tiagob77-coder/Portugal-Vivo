"""
IQ Engine - Módulo 1: Validação Semântica
Atribuição automática de categorias com score de confiança usando IA
"""
from typing import Dict, List, Tuple
import os
import hashlib
import logging
from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData
)

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

VALID_CATEGORY_IDS = [
    "arte_urbana", "percursos_pedestres", "restaurantes_gastronomia", "miradouros",
    "produtores_dop", "arqueologia_geologia", "aventura_natureza", "tabernas_historicas",
    "festas_romarias", "fauna_autoctone", "termas_banhos", "natureza_especializada",
    "cascatas_pocos", "praias_fluviais", "alojamentos_rurais", "oficios_artesanato",
    "castelos", "rotas_tematicas", "museus", "ecovias_passadicos",
    "surf", "musica_tradicional", "mercados_feiras", "moinhos_azenhas",
    "barragens_albufeiras", "flora_autoctone",
]

_ai_classify_cache: Dict[str, Dict] = {}

# ──────────────────────────────────────────
# MULTI-LABEL: secondary categories
# A POI may have 1 primary + up to 2 secondary PV labels.
# ──────────────────────────────────────────
SECONDARY_ELIGIBLE: Dict[str, List[str]] = {
    # If primary is X, these categories can be secondary
    "miradouros":        ["aventura_natureza", "percursos_pedestres", "natureza_especializada"],
    "surf":              ["aventura_natureza", "praias_fluviais"],
    "termas_banhos":     ["natureza_especializada", "aventura_natureza"],
    "percursos_pedestres": ["aventura_natureza", "cascatas_pocos", "natureza_especializada"],
    "castelos":          ["museus", "arqueologia_geologia"],
    "museus":            ["arte_urbana", "arqueologia_geologia"],
    "praias_fluviais":   ["aventura_natureza", "natureza_especializada"],
    "aventura_natureza": ["percursos_pedestres", "praias_fluviais", "surf"],
}

# ──────────────────────────────────────────
# HARD RULES
# Dict of (primary_category, condition) → required_data_field or warning
# "condition" is a secondary category or keyword that triggers the rule.
# ──────────────────────────────────────────
HARD_RULES: List[Dict] = [
    {
        "primary": "miradouros",
        "trigger_keyword": "astroturismo",
        "required_field": "sky_quality_data",
        "message": "Miradouro de astroturismo requer dados de qualidade do céu (Bortle scale / SQM)",
    },
    {
        "primary": "surf",
        "trigger_keyword": None,  # always
        "required_field": "transport_access",
        "message": "POI de Surf deve incluir acesso por transporte (estacionamento / transportes públicos)",
    },
    {
        "primary": "praias_fluviais",
        "trigger_keyword": "bandeira azul",
        "required_field": "water_quality_certification",
        "message": "Praia com Bandeira Azul requer certificação de qualidade da água",
    },
    {
        "primary": "termas_banhos",
        "trigger_keyword": None,
        "required_field": "reserva_obrigatoria",
        "message": "Termas/Spa geralmente requerem reserva — verificar campo reserva_obrigatoria",
    },
    {
        "primary": "percursos_pedestres",
        "trigger_keyword": "pr ",  # PR routes (Pequena Rota)
        "required_field": "distance_km",
        "message": "Percurso com código PR deve incluir distância em km",
    },
]

# Categorias PV (Portugal Vivo) - new subcategory IDs
PV_CATEGORIES = {
    "musica_tradicional": ["lenda", "mito", "história", "narrativa", "conto", "moura", "encantada",
                           "comunidade", "memória", "social", "coletivo", "música", "fado", "folclore"],
    "festas_romarias": ["festa", "festival", "celebração", "romaria", "procissão", "tradição",
                        "religioso", "igreja", "mosteiro", "capela", "santuário", "convento"],
    "oficios_artesanato": ["ofício", "artesanato", "saber", "técnica", "artesão", "tradicional"],
    "restaurantes_gastronomia": ["gastronomi", "comida", "prato", "receita", "culinária", "sabor", "restaurante"],
    "produtores_dop": ["produto", "dop", "igp", "regional", "certificado", "queijo", "vinho"],
    "termas_banhos": ["terma", "spa", "balneário", "thermal", "banho"],
    "natureza_especializada": ["parque", "reserva", "protegida", "natural", "conservação", "biodiversidade"],
    "barragens_albufeiras": ["rio", "ribeira", "fluvial", "nascente", "curso de água", "barragem", "albufeira"],
    "arqueologia_geologia": ["arqueológi", "romano", "castro", "vestígio", "sítio arqueológico",
                             "pedra", "mineral", "rocha", "geologia", "cristal", "minério"],
    "rotas_tematicas": ["aldeia", "histórica", "vila", "povoação", "rota", "caminho", "itinerário", "percurso temático"],
    "percursos_pedestres": ["percurso", "trilho", "caminhada", "pedestr", "hiking"],
    "praias_fluviais": ["piscina natural", "praia fluvial", "praia rio", "piscina fluvial"],
    "flora_autoctone": ["cogumelo", "fungo", "micológico", "boleto", "planta", "flora"],
    "fauna_autoctone": ["fauna", "animal", "espécie", "ave", "lobo", "lince"],
    "arte_urbana": ["arte", "pintura", "escultura", "arquitetura", "artístico", "mural", "graffiti"],
    "miradouros": ["miradouro", "vista", "panorâmica", "observação", "belvedere"],
    "cascatas_pocos": ["cascata", "queda", "cachoeira", "salto", "poço"],
    "tabernas_historicas": ["tasca", "taberna", "bar", "petisco"],
    "ecovias_passadicos": ["baloiço", "swing", "panorâmico", "passadiço", "ecovia"],
    "moinhos_azenhas": ["moinho", "azenha", "engenho", "vento"],
    "aventura_natureza": ["aventura", "radical", "desporto", "escalada", "slide"],
    "castelos": ["castelo", "fortaleza", "muralha", "torre", "medieval"],
    "museus": ["museu", "exposição", "galeria", "acervo"],
    "surf": ["surf", "onda", "bodyboard", "praia"],
    "mercados_feiras": ["mercado", "feira", "bazar", "artesanal"],
    "alojamentos_rurais": ["alojamento", "turismo rural", "casa de campo", "agroturismo"],
}

# Subcategorias PS (Portugal Secreto)
PS_SUBCATEGORIES = {
    "miradouros_secretos": ["escondido", "secreto", "pouco conhecido", "remoto"],
    "praias_selvagens": ["selvagem", "virgem", "deserta", "isolada"],
    "trilhos_ocultos": ["oculto", "esquecido", "raro", "secreto"],
    "lugares_misticos": ["místico", "energético", "espiritual", "mágico"],
    "patrimonio_esquecido": ["abandona", "ruína", "esquecido", "desconhecido"]
}

class SemanticValidationModule(IQModule):
    """
    Módulo 1: Validação Semântica
    
    Atribui automaticamente categorias PV e subcategorias PS
    com score de confiança baseado em análise de texto
    """

    def __init__(self, use_ai: bool = True):
        super().__init__(ModuleType.SEMANTIC_VALIDATION)
        self.use_ai = use_ai

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """
        Process POI for semantic validation.

        Returns ProcessingResult with:
          score             — category confidence 0-100
          data.suggested_category      — primary PV category
          data.secondary_categories    — up to 2 secondary PV categories
          data.hard_rule_violations    — list of hard-rule warning dicts
          data.all_category_scores     — top-5 scored categories
        """
        # Combine text for analysis
        text = f"{data.name} {data.description}".lower()
        if data.tags:
            text += " " + " ".join(data.tags).lower()

        # Rule-based classification
        category_scores = self._score_categories(text)
        subcategory_scores = self._score_subcategories(text)

        # Get best matches
        best_category, category_confidence = self._get_best_match(category_scores)
        best_subcategory, subcategory_confidence = self._get_best_match(subcategory_scores)

        # ── Multi-label: up to 2 secondary categories ──────────────────────────
        secondary_categories = self._get_secondary_categories(
            best_category, category_scores, category_confidence
        )

        # Validate existing category
        issues = []
        warnings = []

        if data.category and data.category != best_category:
            if category_confidence > 0.7:
                warnings.append(
                    f"Categoria atual '{data.category}' difere da sugerida '{best_category}' "
                    f"(confiança: {category_confidence:.0%})"
                )

        if not data.category:
            issues.append("Categoria não definida")

        # AI classification (if enabled and API available)
        ai_result = None
        if self.use_ai and category_confidence < 0.8:
            ai_result = await self._ai_classify(data)
            if ai_result:
                best_category = ai_result.get("category", best_category)
                category_confidence = max(category_confidence, ai_result.get("confidence", 0))

        # ── Hard rules check ───────────────────────────────────────────────────
        hard_rule_violations = self._check_hard_rules(best_category, text, data)
        for violation in hard_rule_violations:
            warnings.append(violation["message"])

        # ── Score formula ──────────────────────────────────────────────────────
        completeness = 0
        if data.category:
            completeness += 0.5
        if data.description and len(data.description) > 50:
            completeness += 0.3
        if data.tags:
            completeness += 0.2

        secondary_bonus = 0.1 if secondary_categories else 0

        overall_score = (
            category_confidence * 0.6 +
            (subcategory_confidence if best_subcategory else 0) * 0.1 +
            secondary_bonus +
            completeness * 0.2
        ) * 100

        # Determine status
        if overall_score >= 80:
            status = ProcessingStatus.COMPLETED
        elif overall_score >= 60:
            status = ProcessingStatus.REQUIRES_REVIEW
            warnings.append("Score médio, recomenda-se revisão manual")
        else:
            status = ProcessingStatus.REQUIRES_REVIEW
            issues.append("Score baixo, categorização incerta")

        return ProcessingResult(
            module=self.module_type,
            status=status,
            score=overall_score,
            confidence=category_confidence,
            data={
                "suggested_category": best_category,
                "category_confidence": category_confidence,
                "secondary_categories": secondary_categories,
                "suggested_subcategory": best_subcategory,
                "subcategory_confidence": subcategory_confidence,
                "keywords_found": self._extract_keywords(text, best_category),
                "ai_classification": ai_result,
                "hard_rule_violations": hard_rule_violations,
                "all_category_scores": dict(sorted(
                    category_scores.items(),
                    key=lambda x: x[1],
                    reverse=True
                )[:5])
            },
            issues=issues,
            warnings=warnings
        )

    def _score_categories(self, text: str) -> Dict[str, float]:
        """Score all categories based on keyword matching"""
        scores = {}

        for category, keywords in PV_CATEGORIES.items():
            score = 0
            matches = 0

            for keyword in keywords:
                if keyword in text:
                    score += 1
                    matches += 1

            # Normalize score
            if matches > 0:
                scores[category] = min(1.0, score / len(keywords) * 3)

        return scores

    def _score_subcategories(self, text: str) -> Dict[str, float]:
        """Score subcategories"""
        scores = {}

        for subcategory, keywords in PS_SUBCATEGORIES.items():
            score = 0

            for keyword in keywords:
                if keyword in text:
                    score += 1

            if score > 0:
                scores[subcategory] = min(1.0, score / len(keywords) * 2)

        return scores

    def _get_best_match(self, scores: Dict[str, float]) -> Tuple[str, float]:
        """Get best matching category/subcategory"""
        if not scores:
            return None, 0.0

        best = max(scores.items(), key=lambda x: x[1])
        return best[0], best[1]

    def _get_secondary_categories(
        self,
        primary: Optional[str],
        scores: Dict[str, float],
        primary_confidence: float,
    ) -> List[str]:
        """
        Return up to 2 secondary PV categories that:
        - Are eligible given the primary (see SECONDARY_ELIGIBLE)
        - Have keyword-match score ≥ 0.2
        - Are not the same as the primary
        """
        if not primary or primary_confidence < 0.4:
            return []

        eligible = SECONDARY_ELIGIBLE.get(primary, [])
        if not eligible:
            # Fallback: top-2 other scored categories
            eligible = [c for c in scores if c != primary]

        secondary = []
        for cat in eligible:
            if cat != primary and scores.get(cat, 0) >= 0.2:
                secondary.append(cat)
            if len(secondary) >= 2:
                break

        return secondary

    def _check_hard_rules(
        self,
        primary_category: Optional[str],
        text: str,
        data: POIProcessingData,
    ) -> List[Dict]:
        """Return list of triggered hard-rule violation dicts."""
        violations = []
        for rule in HARD_RULES:
            if rule["primary"] != primary_category:
                continue
            trigger = rule.get("trigger_keyword")
            if trigger and trigger not in text:
                continue
            # Rule is triggered — check if the required field exists
            field = rule["required_field"]
            value = data.metadata.get(field)
            if not value:
                violations.append({
                    "rule": f"{rule['primary']}:{field}",
                    "required_field": field,
                    "message": rule["message"],
                })
        return violations

    def _extract_keywords(self, text: str, category: str) -> List[str]:
        """Extract matching keywords for a category"""
        if not category or category not in PV_CATEGORIES:
            return []

        found = []
        for keyword in PV_CATEGORIES[category]:
            if keyword in text:
                found.append(keyword)

        return found[:5]  # Top 5

    async def _ai_classify(self, data: POIProcessingData) -> Dict:
        """
        Use Emergent LLM to classify a POI into one of the 26 categories.
        Returns {"category": str, "confidence": float} or None.
        """
        if not EMERGENT_LLM_KEY:
            return None

        name = data.name or ""
        description = data.description or ""
        if not name and not description:
            return None

        cache_key = hashlib.md5(f"{name}|{description}".encode()).hexdigest()
        if cache_key in _ai_classify_cache:
            return _ai_classify_cache[cache_key]

        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage

            categories_list = ", ".join(VALID_CATEGORY_IDS)

            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"classify_{cache_key}",
                system_message=(
                    "És um classificador de pontos de interesse do património português. "
                    "Responde APENAS com o ID da categoria, sem explicação."
                )
            ).with_model("openai", "gpt-4o")

            msg = UserMessage(
                text=(
                    f"Classifica este POI numa das categorias: {categories_list}\n\n"
                    f"Nome: {name}\nDescrição: {description}\n\n"
                    "Responde só com o ID da categoria."
                )
            )

            response = await chat.send_message(msg)
            raw = str(response).strip().lower().replace('"', '').replace("'", "")

            if raw in VALID_CATEGORY_IDS:
                result = {"category": raw, "confidence": 0.85}
                _ai_classify_cache[cache_key] = result
                return result

            self.logger.warning(f"LLM returned invalid category '{raw}'")
            return None
        except Exception as e:
            self.logger.warning(f"AI classification failed: {e}")
            return None
