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
        Process POI for semantic validation
        
        Returns:
            ProcessingResult with:
            - score: confidence score (0-100)
            - data: {
                "suggested_category": str,
                "category_confidence": float,
                "suggested_subcategory": str,
                "subcategory_confidence": float,
                "keywords_found": list,
                "ai_classification": dict (if use_ai)
              }
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

        # Calculate overall score
        # Score formula: category confidence (60%) + has subcategory (20%) + completeness (20%)
        completeness = 0
        if data.category:
            completeness += 0.5
        if data.description and len(data.description) > 50:
            completeness += 0.3
        if data.tags:
            completeness += 0.2

        overall_score = (
            category_confidence * 0.6 +
            (subcategory_confidence if best_subcategory else 0) * 0.2 +
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
                "suggested_subcategory": best_subcategory,
                "subcategory_confidence": subcategory_confidence,
                "keywords_found": self._extract_keywords(text, best_category),
                "ai_classification": ai_result,
                "all_category_scores": dict(sorted(
                    category_scores.items(),
                    key=lambda x: x[1],
                    reverse=True
                )[:5])  # Top 5
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
