"""
IQ Engine - Módulo 3: IQA (Image Quality Assessment)
Validar clareza, relevância e existência de URLs de imagem
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
    POIProcessingData
)

logger = logging.getLogger(__name__)

class ImageQualityModule(IQModule):
    """
    Módulo 3: Image Quality Assessment (IQA)
    
    Valida:
    - Existência de URL de imagem
    - Acessibilidade da imagem (HTTP 200)
    - Formato válido (jpg, png, webp)
    - Tamanho adequado (não muito pequeno)
    - Relevância (por nome de arquivo e metadados)
    """

    def __init__(self):
        super().__init__(ModuleType.IMAGE_QUALITY)
        self.valid_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        self.min_size = 50000  # 50KB minimum
        self.max_size = 10000000  # 10MB maximum

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """Assess image quality"""

        issues = []
        warnings = []
        image_data = {}
        score = 0

        # Check if image URL exists
        if not data.image_url:
            issues.append("Nenhuma URL de imagem fornecida")
            return ProcessingResult(
                module=self.module_type,
                status=ProcessingStatus.REQUIRES_REVIEW,
                score=0,
                confidence=1.0,
                data={"has_image": False},
                issues=issues
            )

        image_url = data.image_url
        image_data["url"] = image_url
        image_data["has_image"] = True
        score += 20  # Has image URL

        # Validate URL format
        url_valid = self._validate_url_format(image_url)
        image_data["url_format_valid"] = url_valid

        if not url_valid:
            issues.append("Formato de URL inválido")
            score += 10  # Some credit for having URL
        else:
            score += 20  # Valid URL format

        # Check file extension
        extension = self._get_extension(image_url)
        image_data["extension"] = extension

        if extension and extension.lower() in self.valid_extensions:
            image_data["valid_extension"] = True
            score += 15
        else:
            warnings.append(f"Extensão de imagem não reconhecida: {extension}")
            image_data["valid_extension"] = False

        # Try to fetch image metadata (HEAD request)
        fetch_result = await self._fetch_image_metadata(image_url)
        image_data.update(fetch_result)

        if fetch_result.get("accessible"):
            score += 25  # Image is accessible

            # Check size
            size = fetch_result.get("size")
            if size:
                if size < self.min_size:
                    warnings.append(f"Imagem muito pequena ({size} bytes)")
                    score += 5
                elif size > self.max_size:
                    warnings.append(f"Imagem muito grande ({size} bytes)")
                    score += 10
                else:
                    score += 20  # Good size
        else:
            issues.append(f"Imagem não acessível: {fetch_result.get('error')}")

        # Assess filename relevance
        relevance = self._assess_filename_relevance(image_url, data.name)
        image_data["filename_relevance"] = relevance

        if relevance > 0.5:
            score += 10

        # Overall confidence
        confidence = 1.0 if fetch_result.get("accessible") else 0.5

        # Determine status
        if score >= 80 and not issues:
            status = ProcessingStatus.COMPLETED
        elif score >= 50:
            status = ProcessingStatus.REQUIRES_REVIEW
        else:
            status = ProcessingStatus.FAILED

        return ProcessingResult(
            module=self.module_type,
            status=status,
            score=score,
            confidence=confidence,
            data=image_data,
            issues=issues,
            warnings=warnings
        )

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
