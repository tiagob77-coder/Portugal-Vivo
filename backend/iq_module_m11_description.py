"""
IQ Engine - Módulo 11: Description Generation
Geração de descrições evocativas via RAG (Retrieval-Augmented Generation).

v2: dual output
  micro_pitch     ≤ 160 chars — ultra-short teaser for cards / push notifications
  descricao_curta ≤ 300 chars — standard description for detail pages
"""
from typing import Optional
import logging
import os
import httpx
from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData
)

logger = logging.getLogger(__name__)

class DescriptionGenerationModule(IQModule):
    """
    Módulo 11: Description Generation
    
    Gera ou melhora descrições de POIs usando:
    - RAG (Retrieval-Augmented Generation)
    - LLM para textos evocativos
    - Templates para categorias específicas
    
    Requisitos:
    - Descrições devem ter ≤ 300 caracteres
    - Tom evocativo e convidativo
    - Incluir informações-chave
    - Adaptado à categoria do POI
    """

    def __init__(self, llm_api_key: Optional[str] = None):
        super().__init__(ModuleType.DESCRIPTION_GENERATION)
        self.llm_api_key = llm_api_key or os.environ.get('EMERGENT_LLM_KEY')
        self.emergent_api_url = "https://llm.lil.re.emergentmethods.ai/v1/chat/completions"

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """Generate or improve POI description"""

        original_desc = data.description or ""
        generated_desc = None
        method_used = None

        # Assess if description needs improvement
        needs_improvement, reason = self._needs_improvement(data)

        if not needs_improvement:
            # Description is already good — still generate micro_pitch
            micro_pitch = self._make_micro_pitch(original_desc)
            return ProcessingResult(
                module=self.module_type,
                status=ProcessingStatus.COMPLETED,
                score=90,
                confidence=1.0,
                data={
                    "original_description": original_desc,
                    "needs_improvement": False,
                    "reason": "Descrição já é adequada",
                    "original_length": len(original_desc),
                    "descricao_curta": original_desc[:300],
                    "micro_pitch": micro_pitch,
                },
                issues=[],
                warnings=[]
            )

        # Try LLM generation
        if self.llm_api_key:
            generated_desc = await self._generate_with_llm(data)
            if generated_desc:
                method_used = "llm_generation"

        # Fallback: Template-based generation
        if not generated_desc:
            generated_desc = self._generate_with_template(data)
            method_used = "template_generation"

        # Fallback: Improve existing
        if not generated_desc and original_desc:
            generated_desc = self._improve_existing(data)
            method_used = "text_improvement"

        # ── Dual output ────────────────────────────────────────────────────────
        descricao_curta = generated_desc[:300] if generated_desc else ""
        micro_pitch = self._make_micro_pitch(descricao_curta or original_desc)

        # Calculate score
        score = self._calculate_quality_score(descricao_curta, data) if descricao_curta else 0

        issues = []
        warnings = []

        if not descricao_curta:
            issues.append("Não foi possível gerar descrição")
            status = ProcessingStatus.FAILED
        elif score < 60:
            warnings.append("Qualidade da descrição gerada é média")
            status = ProcessingStatus.REQUIRES_REVIEW
        else:
            status = ProcessingStatus.COMPLETED

        return ProcessingResult(
            module=self.module_type,
            status=status,
            score=score,
            confidence=0.9 if method_used == "llm_generation" else 0.7,
            data={
                "original_description": original_desc,
                "generated_description": descricao_curta,
                "descricao_curta": descricao_curta,          # ≤ 300 chars
                "micro_pitch": micro_pitch,                  # ≤ 160 chars
                "method_used": method_used,
                "original_length": len(original_desc),
                "generated_length": len(descricao_curta) if descricao_curta else 0,
                "improvement_reason": reason,
                "within_limit": len(descricao_curta) <= 300 if descricao_curta else False,
            },
            issues=issues,
            warnings=warnings
        )

    def _make_micro_pitch(self, text: str) -> str:
        """
        Generate a micro_pitch (≤ 160 chars) from an existing description.
        Picks the first sentence; if too long, truncates at last word boundary.
        """
        if not text:
            return ""
        # First sentence
        import re
        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        pitch = sentences[0] if sentences else text
        if len(pitch) <= 160:
            return pitch
        # Truncate at last word boundary within 157 chars
        truncated = pitch[:157]
        last_space = truncated.rfind(" ")
        if last_space > 100:
            truncated = truncated[:last_space]
        return truncated + "…"

    def _needs_improvement(self, data: POIProcessingData) -> tuple:
        """Check if description needs improvement"""
        desc = data.description

        if not desc:
            return True, "Sem descrição"

        desc = desc.strip()
        length = len(desc)

        if length < 50:
            return True, "Descrição muito curta"

        if length > 500:
            return True, "Descrição muito longa (>500 chars)"

        # Check if too generic
        generic_phrases = [
            'ponto de interesse',
            'local bonito',
            'vale a pena visitar',
            'interessante'
        ]

        if any(phrase in desc.lower() for phrase in generic_phrases) and length < 100:
            return True, "Descrição demasiado genérica"

        # Check if lacks category-specific info
        if data.category:
            category_keywords = {
                'festas_romarias': ['igreja', 'capela', 'mosteiro', 'fé', 'religioso', 'santo', 'festa', 'romaria'],
                'restaurantes_gastronomia': ['sabor', 'prato', 'gastronomia', 'cozinha', 'receita', 'restaurante'],
                'aventura_natureza': ['natural', 'paisagem', 'ambiente', 'flora', 'fauna', 'trilho'],
                'arte_urbana': ['cultural', 'histórico', 'tradição', 'património', 'arte', 'mural'],
                'museus': ['museu', 'exposição', 'galeria', 'acervo'],
                'castelos': ['castelo', 'fortaleza', 'muralha', 'medieval'],
                'termas_banhos': ['terma', 'spa', 'banho', 'thermal'],
                'percursos_pedestres': ['percurso', 'trilho', 'caminhada', 'hiking'],
            }

            keywords = category_keywords.get(data.category, [])
            if keywords and not any(kw in desc.lower() for kw in keywords):
                return True, f"Faltam palavras-chave da categoria {data.category}"

        return False, None

    async def _generate_with_llm(self, data: POIProcessingData) -> Optional[str]:
        """Generate description using LLM"""
        try:
            # Prepare context
            context = f"""
Nome: {data.name}
Categoria: {data.category or 'desconhecida'}
Região: {data.region or 'Portugal'}
Tags: {', '.join(data.tags) if data.tags else 'nenhuma'}
"""

            if data.description:
                context += f"\nDescrição existente: {data.description[:200]}"

            # Prepare prompt
            prompt = f"""Cria uma descrição evocativa e convidativa para este ponto de interesse em Portugal.

{context}

Requisitos:
- Máximo 300 caracteres
- Tom evocativo e apelativo
- Incluir aspetos únicos e interessantes
- Adequado à categoria {data.category or 'património'}
- Em português de Portugal

Descrição:"""

            # Call LLM API
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.emergent_api_url,
                    headers={
                        "Authorization": f"Bearer {self.llm_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": "És um escritor especializado em turismo e património cultural português."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": 150,
                        "temperature": 0.7
                    }
                )

                if response.status_code == 200:
                    result = response.json()
                    generated = result["choices"][0]["message"]["content"].strip()

                    # Ensure within limit
                    if len(generated) > 300:
                        generated = generated[:297] + "..."

                    return generated

        except Exception as e:
            logger.warning(f"LLM generation failed: {e}")

        return None

    def _generate_with_template(self, data: POIProcessingData) -> str:
        """Generate description using category templates"""

        templates = {
            "festas_romarias": [
                f"{data.name} é um {self._get_article(data.name)} local de fé e contemplação. "
                f"Com a sua arquitetura {self._guess_style(data)} e atmosfera serena, "
                f"convida à reflexão e descoberta espiritual.",

                f"Descubra {data.name}, {self._get_article(data.name)} espaço sagrado que "
                f"marca a paisagem cultural portuguesa. Um local de história, arte e devoção "
                f"que merece ser visitado."
            ],
            "aventura_natureza": [
                f"{data.name} oferece uma experiência única em contacto com a natureza. "
                f"Paisagens {self._guess_landscape(data)} e biodiversidade rica fazem deste local "
                f"um refúgio natural imperdível.",

                f"Explore {data.name} e deixe-se envolver pela beleza natural. "
                f"Um espaço de tranquilidade onde a natureza se revela em todo o seu esplendor."
            ],
            "restaurantes_gastronomia": [
                f"{data.name} celebra os sabores autênticos da gastronomia portuguesa. "
                f"Experiência culinária que honra as tradições e encanta os paladares mais exigentes.",

                f"Em {data.name}, cada prato conta uma história. Sabores tradicionais, "
                f"ingredientes locais e receitas transmitidas de geração em geração."
            ],
            "default": [
                f"{data.name} é um ponto de interesse que merece a sua visita. "
                f"Localizado em {data.region or 'Portugal'}, oferece uma experiência única "
                f"de descoberta do património português.",

                f"Descubra {data.name}, um local especial que revela a riqueza cultural "
                f"e histórica de {data.region or 'Portugal'}. Uma visita memorável aguarda-o."
            ]
        }

        category = data.category if data.category in templates else "default"
        template_list = templates[category]

        # Choose template based on name length (simple heuristic)
        template_idx = 0 if len(data.name) < 30 else 1
        description = template_list[template_idx % len(template_list)]

        # Ensure within limit
        if len(description) > 300:
            description = description[:297] + "..."

        return description

    def _improve_existing(self, data: POIProcessingData) -> str:
        """Improve existing description"""
        desc = data.description.strip()

        # If too long, summarize
        if len(desc) > 300:
            # Simple summarization: keep first sentences
            sentences = desc.split('.')
            summary = sentences[0]

            for sentence in sentences[1:]:
                if len(summary) + len(sentence) + 1 <= 297:
                    summary += "." + sentence
                else:
                    break

            return summary.strip() + "..."

        # If too short, add category context
        if len(desc) < 100 and data.category:
            category_additions = {
                "festas_romarias": " Um local de fé e contemplação.",
                "aventura_natureza": " Espaço natural de beleza única.",
                "restaurantes_gastronomia": " Experiência gastronómica autêntica.",
                "arte_urbana": " Riqueza cultural e histórica.",
                "museus": " Riqueza cultural e histórica.",
            }

            addition = category_additions.get(data.category, " Local de interesse turístico.")
            desc += addition

        return desc

    def _get_article(self, name: str) -> str:
        """Get appropriate article (um/uma)"""
        feminine_endings = ['a', 'ade', 'ção', 'gem', 'ice']
        name_lower = name.lower()

        if any(name_lower.endswith(ending) for ending in feminine_endings):
            return "uma"
        return "um"

    def _guess_style(self, data: POIProcessingData) -> str:
        """Guess architectural style from tags/description"""
        text = f"{' '.join(data.tags)} {data.description or ''}".lower()

        if 'barroco' in text or 'barr' in text:
            return "barroca"
        elif 'gótico' in text or 'gót' in text:
            return "gótica"
        elif 'românico' in text or 'roman' in text:
            return "românica"
        elif 'manuelino' in text:
            return "manuelina"
        else:
            return "notável"

    def _guess_landscape(self, data: POIProcessingData) -> str:
        """Guess landscape type"""
        text = f"{' '.join(data.tags)} {data.description or ''}".lower()

        if 'montanha' in text or 'serra' in text:
            return "montanhosas"
        elif 'rio' in text or 'ribeira' in text:
            return "fluviais"
        elif 'praia' in text or 'costa' in text:
            return "costeiras"
        elif 'floresta' in text or 'bosque' in text:
            return "florestais"
        else:
            return "deslumbrantes"

    def _calculate_quality_score(self, description: str, data: POIProcessingData) -> float:
        """Calculate quality score of generated description"""
        if not description:
            return 0

        score = 50  # Base score

        # Length check (optimal: 150-300 chars)
        length = len(description)
        if 150 <= length <= 300:
            score += 20
        elif 100 <= length < 150:
            score += 15
        elif length > 300:
            score += 5

        # Check for evocative words
        evocative_words = [
            'descobr', 'explor', 'únique', 'especial', 'autêntic',
            'tradicion', 'históric', 'cultura', 'beleza', 'encant',
            'deslumbrant', 'memorável', 'imperdível'
        ]

        word_count = sum(1 for word in evocative_words if word in description.lower())
        score += min(15, word_count * 3)

        # Check if mentions category-relevant terms
        if data.category:
            if data.category in description.lower():
                score += 10

        # Penalty for generic phrases
        generic_phrases = ['ponto de interesse', 'vale a pena', 'interessante']
        if any(phrase in description.lower() for phrase in generic_phrases):
            score -= 10

        return max(0, min(100, score))
