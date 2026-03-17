"""
IQ Engine - Módulo 4: Slug Generator
Geração de slugs únicos e normalizados
"""
import logging
from slugify import slugify as make_slug
from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData
)

logger = logging.getLogger(__name__)

class SlugGeneratorModule(IQModule):
    """
    Módulo 4: Slug Generator
    
    Gera slugs únicos e normalizados:
    - Remove acentos
    - Lowercase
    - Replace espaços por hífens
    - Remove caracteres especiais
    - Adiciona sufixo único se necessário
    """

    def __init__(self):
        super().__init__(ModuleType.SLUG_GENERATOR)
        self.seen_slugs = set()  # Track generated slugs to ensure uniqueness

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """Generate normalized slug"""

        issues = []
        warnings = []

        # Generate base slug from name
        base_slug = make_slug(data.name, separator='-', lowercase=True)

        if not base_slug:
            issues.append("Nome inválido para geração de slug")
            return ProcessingResult(
                module=self.module_type,
                status=ProcessingStatus.FAILED,
                score=0,
                confidence=0.0,
                data={"slug": None},
                issues=issues
            )

        # Check length
        if len(base_slug) > 100:
            base_slug = base_slug[:100]
            warnings.append("Slug truncado para 100 caracteres")

        if len(base_slug) < 5:
            warnings.append(f"Slug muito curto ({len(base_slug)} chars)")

        # Generate unique slug
        final_slug = base_slug
        counter = 1
        while final_slug in self.seen_slugs:
            final_slug = f"{base_slug}-{counter}"
            counter += 1

        self.seen_slugs.add(final_slug)

        # Quality checks
        quality_score = 100

        # Penalize very long slugs
        if len(final_slug) > 50:
            quality_score -= 10

        # Penalize slugs with numbers (less readable)
        if any(char.isdigit() for char in final_slug):
            quality_score -= 5

        # Reward descriptive slugs (3+ words)
        word_count = final_slug.count('-') + 1
        if word_count >= 3:
            quality_score = min(100, quality_score + 5)

        # Generate alternative slugs
        alternatives = self._generate_alternatives(data.name)

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=quality_score,
            confidence=1.0,
            data={
                "slug": final_slug,
                "length": len(final_slug),
                "word_count": word_count,
                "alternatives": alternatives[:3],
                "original_name": data.name
            },
            issues=issues,
            warnings=warnings
        )

    def _generate_alternatives(self, name: str) -> list:
        """Generate alternative slug variations"""
        alternatives = []

        # Short version (first 3 words)
        words = name.split()[:3]
        if len(words) >= 2:
            short = make_slug(' '.join(words))
            if short:
                alternatives.append(short)

        # With category prefix (if available)
        # This would be done with full context in real implementation

        # Abbreviated version
        initials = ''.join([w[0] for w in name.split() if w])
        if len(initials) >= 2:
            alternatives.append(initials.lower())

        return alternatives
