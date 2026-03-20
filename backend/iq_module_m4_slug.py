"""
IQ Engine - Módulo 4: Slug Generator
Geração de slugs únicos e normalizados.

v2 additions:
  - canonical_slug  — primary stable slug
  - aliases         — 2-3 alternative slugs (short, initials, region-prefixed)
  - checksum        — 4-6 char hash for fast dirty-check (id + name)
"""
import hashlib
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

        # Generate aliases (alternative slugs)
        aliases = self._generate_aliases(data)

        # Generate checksum (4-6 char, stable)
        checksum = self._generate_checksum(data.id, data.name)

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=quality_score,
            confidence=1.0,
            data={
                "slug": final_slug,
                "canonical_slug": final_slug,
                "aliases": aliases[:3],
                "checksum": checksum,
                "length": len(final_slug),
                "word_count": word_count,
                "original_name": data.name
            },
            issues=issues,
            warnings=warnings
        )

    def _generate_aliases(self, data: POIProcessingData) -> list:
        """
        Generate 2-3 alias slugs:
          1. Short version (first 3 words)
          2. Region-prefixed version (e.g., 'norte-castelo-de-guimaraes')
          3. Initials abbreviation
        """
        aliases = []

        name = data.name

        # 1. Short version (first 3 words)
        words = name.split()[:3]
        if len(words) >= 2:
            short = make_slug(' '.join(words))
            if short:
                aliases.append(short)

        # 2. Region-prefixed
        if data.region:
            region_slug = make_slug(data.region)
            full_slug = make_slug(name)
            region_prefixed = f"{region_slug}-{full_slug}"
            if region_prefixed not in aliases and len(region_prefixed) <= 80:
                aliases.append(region_prefixed[:80])

        # 3. Initials (fallback for short names)
        initials = "".join([w[0] for w in name.split() if w])
        if len(initials) >= 2:
            aliases.append(initials.lower())

        return aliases

    def _generate_checksum(self, poi_id: str, name: str) -> str:
        """
        Generate a stable 5-char base16 checksum from (id + name).
        Used for fast dirty-checking without re-running the full pipeline.
        """
        raw = f"{poi_id}|{name}".encode("utf-8")
        digest = hashlib.sha256(raw).hexdigest()
        return digest[:5].upper()  # e.g., "A3F2E"
