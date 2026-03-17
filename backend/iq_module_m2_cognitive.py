"""
IQ Engine - Módulo 2: Inferência Cognitiva
Extração de metadados de textos longos para garantir coerência categorial
"""
import re
from typing import Dict, List, Optional
import logging
from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData
)

logger = logging.getLogger(__name__)

class CognitiveInferenceModule(IQModule):
    """
    Módulo 2: Inferência Cognitiva
    
    Extrai metadados estruturados de descrições textuais:
    - Duração estimada de visita
    - Dificuldade de acesso
    - Melhor época para visitar
    - Palavras-chave semânticas
    - Entidades nomeadas (locais, pessoas, eventos)
    """

    def __init__(self):
        super().__init__(ModuleType.COGNITIVE_INFERENCE)

        # Patterns for extraction
        self.duration_patterns = [
            (r"(\d+)\s*hora?s?", "hours"),
            (r"(\d+)\s*minutos?", "minutes"),
            (r"(\d+)\s*dias?", "days"),
            (r"meio\s*dia", "half_day"),
            (r"dia\s*inteiro", "full_day"),
        ]

        self.difficulty_keywords = {
            "facil": ["fácil", "simples", "acessível", "plano", "pavimentado"],
            "moderado": ["moderado", "algum esforço", "subida", "trilho"],
            "dificil": ["difícil", "exigente", "técnico", "escalada", "íngreme", "remoto"]
        }

        self.season_keywords = {
            "primavera": ["primavera", "março", "abril", "maio", "flores"],
            "verao": ["verão", "junho", "julho", "agosto", "praia", "calor"],
            "outono": ["outono", "setembro", "outubro", "novembro", "vindimas"],
            "inverno": ["inverno", "dezembro", "janeiro", "fevereiro", "neve", "frio"]
        }

        self.accessibility_keywords = [
            "cadeira de rodas", "mobilidade reduzida", "acessível",
            "rampa", "elevador", "piso plano"
        ]

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """Extract cognitive metadata from text"""

        text = f"{data.name}. {data.description}".lower()

        # Extract duration
        duration = self._extract_duration(text)

        # Infer difficulty
        difficulty = self._infer_difficulty(text)

        # Best seasons
        best_seasons = self._extract_seasons(text)

        # Check accessibility
        accessibility = self._check_accessibility(text)

        # Extract key phrases
        key_phrases = self._extract_key_phrases(data.description or "")

        # Extract entities (simple version)
        entities = self._extract_entities(text)

        # Score based on completeness
        completeness_score = 0
        if duration:
            completeness_score += 20
        if difficulty:
            completeness_score += 20
        if best_seasons:
            completeness_score += 20
        if key_phrases:
            completeness_score += 20
        if entities:
            completeness_score += 20

        # Warnings and issues
        warnings = []
        issues = []

        if not duration and "visita" in text:
            warnings.append("Duração de visita não especificada")

        if len(data.description or "") < 50:
            issues.append("Descrição muito curta para inferência adequada")

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED if completeness_score >= 60 else ProcessingStatus.REQUIRES_REVIEW,
            score=completeness_score,
            confidence=min(1.0, len(data.description or "") / 200),
            data={
                "duration": duration,
                "difficulty": difficulty,
                "best_seasons": best_seasons,
                "accessibility": accessibility,
                "key_phrases": key_phrases,
                "entities": entities,
                "text_length": len(data.description or ""),
                "completeness": completeness_score / 100
            },
            issues=issues,
            warnings=warnings
        )

    def _extract_duration(self, text: str) -> Optional[Dict[str, any]]:
        """Extract visit duration"""
        for pattern, unit in self.duration_patterns:
            match = re.search(pattern, text)
            if match:
                if unit == "half_day":
                    return {"value": 4, "unit": "hours", "text": "meio dia"}
                elif unit == "full_day":
                    return {"value": 8, "unit": "hours", "text": "dia inteiro"}
                else:
                    return {
                        "value": int(match.group(1)),
                        "unit": unit,
                        "text": match.group(0)
                    }
        return None

    def _infer_difficulty(self, text: str) -> Optional[Dict[str, any]]:
        """Infer access difficulty"""
        scores = {}

        for difficulty, keywords in self.difficulty_keywords.items():
            score = sum(1 for kw in keywords if kw in text)
            if score > 0:
                scores[difficulty] = score

        if not scores:
            return None

        best = max(scores.items(), key=lambda x: x[1])
        return {
            "level": best[0],
            "confidence": min(1.0, best[1] / 3)
        }

    def _extract_seasons(self, text: str) -> List[str]:
        """Extract best seasons to visit"""
        seasons = []

        for season, keywords in self.season_keywords.items():
            if any(kw in text for kw in keywords):
                seasons.append(season)

        return seasons

    def _check_accessibility(self, text: str) -> Dict[str, any]:
        """Check accessibility mentions"""
        accessible = any(kw in text for kw in self.accessibility_keywords)

        return {
            "mentioned": accessible,
            "keywords_found": [kw for kw in self.accessibility_keywords if kw in text]
        }

    def _extract_key_phrases(self, text: str) -> List[str]:
        """Extract important phrases (simple version)"""
        if not text or len(text) < 20:
            return []

        # Split into sentences
        sentences = re.split(r'[.!?]+', text)

        # Get first 3 sentences (simplified)
        key_phrases = [s.strip() for s in sentences[:3] if len(s.strip()) > 20]

        return key_phrases[:3]

    def _extract_entities(self, text: str) -> Dict[str, List[str]]:
        """
        Extract named entities (simplified version)
        In production, use spaCy or similar NLP library
        """
        entities = {
            "locations": [],
            "dates": [],
            "numbers": []
        }

        # Extract capitalized words (potential locations/names)
        # Simple heuristic: words starting with capital in middle of text
        words = text.split()
        potential_entities = [
            w for w in words
            if w and w[0].isupper() and len(w) > 3
        ]

        entities["locations"] = list(set(potential_entities[:5]))

        # Extract years
        years = re.findall(r'\b(1[5-9]\d{2}|20\d{2})\b', text)
        entities["dates"] = years

        # Extract numbers
        numbers = re.findall(r'\b\d+\b', text)
        entities["numbers"] = [n for n in numbers if int(n) < 10000][:5]

        return entities
