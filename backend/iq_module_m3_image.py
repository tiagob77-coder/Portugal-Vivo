"""
IQ Engine - Módulo 3: IQA (Image Quality Assessment)
Validar clareza, relevância e existência de URLs de imagem.

v2 scoring model:
  clarity_score     0-40  (size, format, accessibility proxy)
  no_promo_score    0-30  (absence of promo/watermark/stock indicators in URL)
  category_relevance 0-30 (filename + host relevance to POI category/name)

Source priority: owner > curated > external > unknown
"""
import re
from typing import Dict, Optional
import logging
import httpx
from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData,
    SourceType,
)

logger = logging.getLogger(__name__)

# Hosts/patterns that indicate high-trust owner or curated sources
_OWNER_HOSTS = ["visitportugal.com", "portugal.travel", "patrimoniocultural.gov.pt",
                 "dgpc.pt", "ipma.pt", "icnf.pt"]
_CURATED_HOSTS = ["cloudinary.com", "unsplash.com", "pexels.com", "wikimedia.org",
                   "wikipedia.org", "commons.wikimedia"]
# Promo / watermark / stock indicators in URL path or filename
_PROMO_SIGNALS = ["stock", "getty", "shutterstock", "adobe", "dreamstime",
                   "watermark", "preview", "thumb", "placeholder", "banner",
                   "advertisement", "promo", "sponsored"]


class ImageQualityModule(IQModule):
    """
    Módulo 3: Image Quality Assessment (IQA) v2

    Three scoring dimensions:
      clarity_score      — technical quality proxy (size, format, HTTP 200)
      no_promo_score     — absence of stock/watermark/promo indicators
      category_relevance — filename/host relevance to POI category and name

    Also classifies SourceType: owner > curated > external > unknown
    """

    def __init__(self):
        super().__init__(ModuleType.IMAGE_QUALITY)
        self.valid_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        self.min_size = 50000   # 50 KB minimum
        self.max_size = 10000000  # 10 MB maximum

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """Assess image quality (v2 three-dimension model)."""

        issues = []
        warnings = []

        if not data.image_url:
            issues.append("Nenhuma URL de imagem fornecida")
            return ProcessingResult(
                module=self.module_type,
                status=ProcessingStatus.REQUIRES_REVIEW,
                score=0,
                confidence=1.0,
                data={"has_image": False, "source_type": SourceType.UNKNOWN},
                issues=issues
            )

        image_url = data.image_url

        # ── Source type classification ─────────────────────────────────────────
        source_type = self._classify_source(image_url)

        # ── Dimension 1: Clarity (0-40) ────────────────────────────────────────
        clarity_score, clarity_details, fetch_result = await self._score_clarity(
            image_url, issues, warnings
        )

        # ── Dimension 2: No-promo / no-watermark (0-30) ────────────────────────
        no_promo_score, promo_signals_found = self._score_no_promo(image_url, source_type)
        if promo_signals_found:
            warnings.append(f"Imagem pode ser stock/promo: {', '.join(promo_signals_found)}")

        # ── Dimension 3: Category relevance (0-30) ─────────────────────────────
        cat_relevance_score, relevance_details = self._score_category_relevance(
            image_url, data
        )

        # ── Composite score (0-100) ────────────────────────────────────────────
        final_score = clarity_score + no_promo_score + cat_relevance_score

        # Source-type bonus: owner +5, curated +3
        if source_type == SourceType.OWNER:
            final_score = min(100, final_score + 5)
        elif source_type == SourceType.CURATED:
            final_score = min(100, final_score + 3)

        confidence = 1.0 if fetch_result.get("accessible") else 0.5

        if final_score >= 75 and not issues:
            status = ProcessingStatus.COMPLETED
        elif final_score >= 40:
            status = ProcessingStatus.REQUIRES_REVIEW
        else:
            status = ProcessingStatus.FAILED

        return ProcessingResult(
            module=self.module_type,
            status=status,
            score=round(final_score, 1),
            confidence=confidence,
            data={
                "has_image": True,
                "url": image_url,
                "source_type": source_type.value,
                "clarity_score": round(clarity_score, 1),
                "no_promo_score": round(no_promo_score, 1),
                "category_relevance_score": round(cat_relevance_score, 1),
                "promo_signals": promo_signals_found,
                "relevance_details": relevance_details,
                **clarity_details,
                **fetch_result,
            },
            issues=issues,
            warnings=warnings
        )

    # ── New v2 helpers ─────────────────────────────────────────────────────────

    def _classify_source(self, url: str) -> SourceType:
        """Classify image source type from URL host."""
        url_lower = url.lower()
        for host in _OWNER_HOSTS:
            if host in url_lower:
                return SourceType.OWNER
        for host in _CURATED_HOSTS:
            if host in url_lower:
                return SourceType.CURATED
        if url_lower.startswith("http"):
            return SourceType.EXTERNAL
        return SourceType.UNKNOWN

    async def _score_clarity(
        self, url: str, issues: list, warnings: list
    ):
        """
        Returns (clarity_score 0-40, clarity_details dict, fetch_result dict).
        Proxy for technical quality: valid format + accessible + reasonable size.
        """
        clarity = 0
        details = {}

        url_valid = self._validate_url_format(url)
        details["url_format_valid"] = url_valid
        if url_valid:
            clarity += 10
        else:
            issues.append("Formato de URL inválido")

        extension = self._get_extension(url)
        details["extension"] = extension
        if extension and extension.lower() in self.valid_extensions:
            details["valid_extension"] = True
            clarity += 10
        else:
            warnings.append(f"Extensão de imagem não reconhecida: {extension}")

        fetch_result = await self._fetch_image_metadata(url)
        if fetch_result.get("accessible"):
            clarity += 12
            size = fetch_result.get("size")
            if size:
                if size < self.min_size:
                    warnings.append(f"Imagem muito pequena ({size} bytes) — possível thumbnail")
                    clarity += 2
                elif size > self.max_size:
                    warnings.append(f"Imagem muito grande ({size} bytes)")
                    clarity += 6
                else:
                    clarity += 8  # good size
        else:
            issues.append(f"Imagem não acessível: {fetch_result.get('error')}")

        return min(clarity, 40), details, fetch_result

    def _score_no_promo(self, url: str, source_type: SourceType):
        """
        Returns (no_promo_score 0-30, list of found promo signals).
        Owner/curated sources get full score automatically.
        """
        if source_type in (SourceType.OWNER, SourceType.CURATED):
            return 30, []

        url_lower = url.lower()
        found = [sig for sig in _PROMO_SIGNALS if sig in url_lower]

        if not found:
            return 30, []
        elif len(found) == 1:
            return 15, found
        else:
            return 0, found

    def _score_category_relevance(self, url: str, data: POIProcessingData):
        """
        Returns (relevance_score 0-30, details dict).
        Checks filename word overlap with POI name + category keywords.
        """
        # Extract filename without extension
        filename = url.split("/")[-1].split("?")[0].lower()
        filename = re.sub(r"\.(jpg|jpeg|png|webp|gif|svg)$", "", filename)
        filename_words = set(re.split(r"[-_\s.]+", filename))

        # POI name words
        poi_words = set(re.split(r"[-_\s]+", (data.name or "").lower()))
        poi_words = {w for w in poi_words if len(w) > 3}  # skip short words

        name_overlap = len(poi_words & filename_words) / max(len(poi_words), 1)

        # Category keyword match
        from iq_module_m1_semantic import PV_CATEGORIES
        cat_keywords = set(PV_CATEGORIES.get(data.category or "", []))
        cat_overlap = len(cat_keywords & filename_words) / max(len(cat_keywords), 1)

        score = (name_overlap * 20 + cat_overlap * 10)

        return round(min(score, 30), 1), {
            "name_overlap": round(name_overlap, 2),
            "cat_overlap": round(cat_overlap, 2),
            "filename_words": list(filename_words)[:8],
        }

    # ── Existing helpers ───────────────────────────────────────────────────────

    def _validate_url_format(self, url: str) -> bool:
        """Validate URL format"""
        url_pattern = re.compile(
            r'^https?://'  # http:// or https://
            r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
            r'localhost|'  # localhost...
            r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
            r'(?::\d+)?'  # optional port
            r'(?:/?|[/?]\S+)$', re.IGNORECASE
        )
        return bool(url_pattern.match(url))

    def _get_extension(self, url: str) -> Optional[str]:
        """Extract file extension from URL"""
        # Remove query parameters
        url = url.split('?')[0]
        parts = url.split('.')
        if len(parts) > 1:
            return '.' + parts[-1].lower()
        return None

    async def _fetch_image_metadata(self, url: str) -> Dict:
        """Fetch image metadata via HEAD request"""
        result = {
            "accessible": False,
            "size": None,
            "content_type": None,
            "error": None
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.head(url, follow_redirects=True)

                if response.status_code == 200:
                    result["accessible"] = True
                    result["status_code"] = 200

                    # Get size
                    content_length = response.headers.get('content-length')
                    if content_length:
                        result["size"] = int(content_length)

                    # Get content type
                    content_type = response.headers.get('content-type')
                    result["content_type"] = content_type

                    # Validate content type
                    if content_type and not content_type.startswith('image/'):
                        result["error"] = f"Content-Type não é imagem: {content_type}"
                        result["accessible"] = False

                else:
                    result["error"] = f"HTTP {response.status_code}"
                    result["status_code"] = response.status_code

        except httpx.TimeoutException:
            result["error"] = "Timeout ao acessar imagem"
        except httpx.RequestError as e:
            result["error"] = f"Erro de rede: {str(e)}"
        except Exception as e:
            result["error"] = f"Erro desconhecido: {str(e)}"

        return result

    def _assess_filename_relevance(self, url: str, poi_name: str) -> float:
        """
        Assess if filename is relevant to POI
        Returns score 0-1
        """
        # Extract filename
        filename = url.split('/')[-1].split('?')[0].lower()
        filename = re.sub(r'\.(jpg|jpeg|png|webp|gif)$', '', filename)

        # Remove common separators
        filename_words = re.split(r'[-_\s]+', filename)

        # Tokenize POI name
        poi_words = re.split(r'[-_\s]+', poi_name.lower())

        # Calculate overlap
        matches = sum(1 for word in poi_words if word in filename_words)

        if not poi_words:
            return 0

        relevance = matches / len(poi_words)

        return min(1.0, relevance)
