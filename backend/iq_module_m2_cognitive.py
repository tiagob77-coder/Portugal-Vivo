"""
IQ Engine - Módulo 2: Inferência Cognitiva
Extração de metadados de textos longos para garantir coerência categorial.

v2 additions:
  - best_season structured attribute
  - terrain_type inference
  - effort_level 0-5 scale
  - child_friendly / pet_friendly binary flags
  - image coherence cross-check (category vs image URL keywords)
"""
import re
from typing import Dict, List, Optional
import logging
from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData,
    TerrainType,
)

logger = logging.getLogger(__name__)


# Image URL keyword → category mismatch patterns
# If image URL contains any of these words but the POI category is unrelated,
# it may indicate a stock/promotional photo substitution.
_IMAGE_CATEGORY_MISMATCH: Dict[str, List[str]] = {
    "museus": ["praia", "surf", "cascata", "piscina", "trilho"],
    "surf": ["museu", "castelo", "palácio", "mosteiro"],
    "termas_banhos": ["cascata", "praia", "surf", "montanha"],
    "castelos": ["praia", "restaurante", "mercado"],
}


class CognitiveInferenceModule(IQModule):
    """
    Módulo 2: Inferência Cognitiva

    Extrai metadados estruturados de descrições textuais:
    - Duração estimada de visita
    - Dificuldade de acesso
    - Melhor época para visitar (best_season)
    - terrain_type, effort_level, child_friendly, pet_friendly
    - Image coherence cross-check
    - Palavras-chave semânticas / entidades nomeadas
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
            "primavera": ["primavera", "março", "abril", "maio", "flores", "floração"],
            "verao": ["verão", "junho", "julho", "agosto", "praia", "calor"],
            "outono": ["outono", "setembro", "outubro", "novembro", "vindimas", "colheita"],
            "inverno": ["inverno", "dezembro", "janeiro", "fevereiro", "neve", "frio"]
        }

        self.accessibility_keywords = [
            "cadeira de rodas", "mobilidade reduzida", "acessível",
            "rampa", "elevador", "piso plano"
        ]

        # Terrain type keywords
        self.terrain_keywords: Dict[str, List[str]] = {
            TerrainType.MOUNTAIN: ["montanha", "serra", "cume", "pico", "altitude", "alpino"],
            TerrainType.HILLY: ["subida", "descida", "colina", "vale", "encosta", "íngreme"],
            TerrainType.COASTAL: ["costa", "litoral", "oceano", "mar", "praia", "falésia", "cabo"],
            TerrainType.URBAN: ["cidade", "vila", "centro", "rua", "largo", "praça", "urbano"],
            TerrainType.FLAT: ["plano", "planície", "campo", "alentejo", "ribatejo", "pavimentado"],
        }

        # Child-friendly positive/negative signals
        self.child_positive = ["parque infantil", "bebés", "crianças", "familiar", "interativo",
                                "piscina", "praia", "jardim", "natureza", "animais"]
        self.child_negative = ["perigo", "escalada", "radical", "perigoso", "restrito", "adultos"]

        # Pet-friendly signals
        self.pet_positive = ["animais de estimação", "cães permitidos", "dog friendly",
                              "pet friendly", "cão", "passeio com cão"]
        self.pet_negative = ["proibido animais", "sem animais", "no pets", "animais não permitidos"]

        # Effort level keywords
        self.effort_keywords = {
            0: ["sem esforço", "totalmente plano", "cadeirante"],
            1: ["fácil", "plano", "pavimentado", "acessível"],
            2: ["moderado", "algum esforço", "subida suave"],
            3: ["esforço médio", "subida exigente", "percurso longo"],
            4: ["difícil", "íngreme", "técnico", "exigente"],
            5: ["extremo", "expert", "escalada", "alta montanha", "rapel"],
        }

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """Extract cognitive metadata from text (v2)."""

        text = f"{data.name}. {data.description}".lower()

        # ── Existing extractions ───────────────────────────────────────────────
        duration = self._extract_duration(text)
        difficulty = self._infer_difficulty(text)
        best_seasons = self._extract_seasons(text)
        accessibility = self._check_accessibility(text)
        key_phrases = self._extract_key_phrases(data.description or "")
        entities = self._extract_entities(text)

        # ── New structured attributes ──────────────────────────────────────────
        terrain_type = self._infer_terrain_type(text)
        effort_level = self._infer_effort_level(text)
        child_friendly = self._infer_child_friendly(text)
        pet_friendly = self._infer_pet_friendly(text)
        best_season = self._best_season_single(best_seasons)

        # ── Image coherence cross-check ────────────────────────────────────────
        image_incoherence = self._check_image_coherence(data)

        # ── Score based on completeness ────────────────────────────────────────
        completeness_score = 0
        if duration:
            completeness_score += 15
        if difficulty:
            completeness_score += 15
        if best_seasons:
            completeness_score += 15
        if key_phrases:
            completeness_score += 15
        if entities:
            completeness_score += 10
        if terrain_type:
            completeness_score += 10
        if child_friendly is not None:
            completeness_score += 10
        if effort_level > 0:
            completeness_score += 10

        # Warnings and issues
        warnings = []
        issues = []

        if not duration and "visita" in text:
            warnings.append("Duração de visita não especificada")

        if len(data.description or "") < 50:
            issues.append("Descrição muito curta para inferência adequada")

        if image_incoherence:
            warnings.append(f"Imagem possivelmente incoerente com categoria: {image_incoherence}")

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED if completeness_score >= 60 else ProcessingStatus.REQUIRES_REVIEW,
            score=completeness_score,
            confidence=min(1.0, len(data.description or "") / 200),
            data={
                "duration": duration,
                "difficulty": difficulty,
                "best_seasons": best_seasons,
                "best_season": best_season,          # single canonical value
                "terrain_type": terrain_type.value if terrain_type else None,
                "effort_level": effort_level,         # 0-5
                "child_friendly": child_friendly,
                "pet_friendly": pet_friendly,
                "accessibility": accessibility,
                "image_coherence_warning": image_incoherence,
                "key_phrases": key_phrases,
                "entities": entities,
                "text_length": len(data.description or ""),
                "completeness": completeness_score / 100
            },
            issues=issues,
            warnings=warnings
        )

    # ── New helpers (v2) ──────────────────────────────────────────────────────

    def _infer_terrain_type(self, text: str) -> Optional[TerrainType]:
        """Infer dominant terrain type from text."""
        scores: Dict[TerrainType, int] = {}
        for terrain, keywords in self.terrain_keywords.items():
            count = sum(1 for kw in keywords if kw in text)
            if count:
                scores[terrain] = count
        if not scores:
            return None
        return max(scores, key=scores.get)

    def _infer_effort_level(self, text: str) -> int:
        """Return effort level 0-5 based on keyword density."""
        for level in range(5, -1, -1):
            keywords = self.effort_keywords.get(level, [])
            if any(kw in text for kw in keywords):
                return level
        return 1  # default: easy

    def _infer_child_friendly(self, text: str) -> Optional[bool]:
        pos = sum(1 for kw in self.child_positive if kw in text)
        neg = sum(1 for kw in self.child_negative if kw in text)
        if pos == 0 and neg == 0:
            return None
        return pos > neg

    def _infer_pet_friendly(self, text: str) -> Optional[bool]:
        pos = sum(1 for kw in self.pet_positive if kw in text)
        neg = sum(1 for kw in self.pet_negative if kw in text)
        if pos == 0 and neg == 0:
            return None
        return pos > neg

    def _best_season_single(self, seasons: List[str]) -> Optional[str]:
        """Return a single canonical best season (or 'todo_o_ano' if all match)."""
        if not seasons:
            return None
        if len(seasons) >= 3:
            return "todo_o_ano"
        return seasons[0]

    def _check_image_coherence(self, data: POIProcessingData) -> Optional[str]:
        """
        Returns a warning string if the image URL contains keywords that are
        inconsistent with the POI category, or None if OK.
        """
        if not data.image_url or not data.category:
            return None
        url_lower = data.image_url.lower()
        mismatches = _IMAGE_CATEGORY_MISMATCH.get(data.category, [])
        found = [kw for kw in mismatches if kw in url_lower]
        if found:
            return f"URL contém '{', '.join(found)}' inconsistente com categoria '{data.category}'"
        return None

    # ── Existing helpers ──────────────────────────────────────────────────────

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
