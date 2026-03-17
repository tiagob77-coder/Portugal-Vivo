"""
Audio Guide Service - Text-to-Speech for Heritage Sites
Uses OpenAI TTS via Emergent Integrations
"""
import os
import logging
import hashlib
import base64
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Voice options for different content types
VOICE_PROFILES = {
    "default": "nova",           # Energetic, upbeat - good for general content
    "historical": "fable",       # Expressive, storytelling - good for legends and history
    "religious": "sage",         # Wise, measured - good for religious sites
    "nature": "coral",           # Warm, friendly - good for nature content
    "gastronomia": "shimmer",    # Bright, cheerful - good for food/wine
    "adventure": "echo",         # Smooth, calm - good for adventure/outdoor
}

# Speed settings
SPEED_PROFILES = {
    "normal": 1.0,
    "slow": 0.85,      # For complex historical content
    "fast": 1.15,      # For quick facts
}


class AudioGuideService:
    """Service for generating audio guides using OpenAI TTS"""

    def __init__(self):
        self.api_key = os.getenv("EMERGENT_LLM_KEY")
        self._tts_client = None
        self._cache_dir = Path("/tmp/audio_guides")
        self._cache_dir.mkdir(exist_ok=True)

        if not self.api_key:
            logger.warning("EMERGENT_LLM_KEY not found - TTS will not be available")

    async def _get_tts_client(self):
        """Lazy initialization of TTS client"""
        if self._tts_client is None:
            try:
                from emergentintegrations.llm.openai import OpenAITextToSpeech
                self._tts_client = OpenAITextToSpeech(api_key=self.api_key)
            except ImportError:
                logger.error("emergentintegrations not installed")
                raise ImportError("emergentintegrations library not available")
        return self._tts_client

    def _get_cache_key(self, text: str, voice: str, speed: float) -> str:
        """Generate cache key for audio"""
        content = f"{text}:{voice}:{speed}"
        return hashlib.md5(content.encode()).hexdigest()

    def _get_cached_audio(self, cache_key: str) -> Optional[bytes]:
        """Check if audio is cached"""
        cache_path = self._cache_dir / f"{cache_key}.mp3"
        if cache_path.exists():
            logger.info(f"Audio cache hit: {cache_key}")
            return cache_path.read_bytes()
        return None

    def _cache_audio(self, cache_key: str, audio_bytes: bytes) -> None:
        """Save audio to cache"""
        cache_path = self._cache_dir / f"{cache_key}.mp3"
        cache_path.write_bytes(audio_bytes)
        logger.info(f"Audio cached: {cache_key}")

    def _select_voice(self, category: Optional[str], content_type: Optional[str]) -> str:
        """Select appropriate voice based on content"""
        if category in VOICE_PROFILES:
            return VOICE_PROFILES[category]
        if content_type in VOICE_PROFILES:
            return VOICE_PROFILES[content_type]
        return VOICE_PROFILES["default"]

    def _prepare_text_for_tts(self, text: str, poi_name: str) -> str:
        """Prepare text for TTS with natural pauses and structure"""
        # Add introduction
        intro = f"Bem-vindo a {poi_name}. "

        # Clean up text
        cleaned = text.strip()

        # Add natural pauses (... becomes slight pause)
        cleaned = cleaned.replace("...", ". ")

        # Limit to 4000 chars (API limit is 4096)
        if len(intro + cleaned) > 4000:
            cleaned = cleaned[:4000 - len(intro) - 50] + "... Continue a explorar para descobrir mais."

        return intro + cleaned

    async def generate_audio_guide(
        self,
        text: str,
        poi_name: str,
        poi_id: str,
        category: Optional[str] = None,
        language: str = "pt",
        use_hd: bool = False,
        speed: str = "normal"
    ) -> Dict[str, Any]:
        """
        Generate audio guide for a POI
        
        Args:
            text: The narrative text to convert to speech
            poi_name: Name of the point of interest
            poi_id: ID of the POI (for caching)
            category: Category of POI (affects voice selection)
            language: Language code (pt, en, es, fr)
            use_hd: Use high-definition TTS model
            speed: Speed profile (normal, slow, fast)
        
        Returns:
            Dict with audio_url, audio_base64, duration_estimate, voice, etc.
        """
        if not self.api_key:
            return {
                "success": False,
                "error": "TTS service not configured",
                "audio_available": False
            }

        try:
            # Select voice and speed
            voice = self._select_voice(category, None)
            speed_value = SPEED_PROFILES.get(speed, 1.0)

            # Prepare text
            prepared_text = self._prepare_text_for_tts(text, poi_name)

            # Check cache
            cache_key = self._get_cache_key(prepared_text, voice, speed_value)
            cached_audio = self._get_cached_audio(cache_key)

            if cached_audio:
                audio_base64 = base64.b64encode(cached_audio).decode('utf-8')
                return {
                    "success": True,
                    "audio_base64": audio_base64,
                    "audio_format": "mp3",
                    "voice": voice,
                    "speed": speed_value,
                    "model": "tts-1-hd" if use_hd else "tts-1",
                    "cached": True,
                    "duration_estimate_seconds": len(prepared_text) / 15,  # Rough estimate
                    "poi_id": poi_id,
                    "poi_name": poi_name,
                    "language": language
                }

            # Generate new audio
            tts = await self._get_tts_client()

            model = "tts-1-hd" if use_hd else "tts-1"

            audio_bytes = await tts.generate_speech(
                text=prepared_text,
                model=model,
                voice=voice,
                speed=speed_value,
                response_format="mp3"
            )

            # Cache the audio
            self._cache_audio(cache_key, audio_bytes)

            # Convert to base64 for response
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')

            # Estimate duration (rough: ~150 words per minute at normal speed)
            word_count = len(prepared_text.split())
            duration_estimate = (word_count / 150) * 60 / speed_value

            logger.info(f"Generated audio guide for {poi_name} ({len(audio_bytes)} bytes)")

            return {
                "success": True,
                "audio_base64": audio_base64,
                "audio_format": "mp3",
                "voice": voice,
                "speed": speed_value,
                "model": model,
                "cached": False,
                "duration_estimate_seconds": round(duration_estimate, 1),
                "text_length": len(prepared_text),
                "poi_id": poi_id,
                "poi_name": poi_name,
                "language": language,
                "generated_at": datetime.now(timezone.utc).isoformat()
            }

        except ImportError as e:
            logger.error(f"TTS library not available: {e}")
            return {
                "success": False,
                "error": "TTS library not installed",
                "audio_available": False
            }
        except Exception as e:
            logger.error(f"TTS generation error: {e}")
            return {
                "success": False,
                "error": str(e),
                "audio_available": False
            }

    async def get_available_voices(self) -> Dict[str, Any]:
        """Get list of available voices with descriptions"""
        return {
            "voices": [
                {"id": "nova", "name": "Nova", "description": "Energética e animada", "best_for": ["geral", "aventura"]},
                {"id": "fable", "name": "Fable", "description": "Expressiva, contadora de histórias", "best_for": ["histórico", "lendas"]},
                {"id": "sage", "name": "Sage", "description": "Sábia e ponderada", "best_for": ["religioso", "cultural"]},
                {"id": "coral", "name": "Coral", "description": "Calorosa e amigável", "best_for": ["natureza", "aldeias"]},
                {"id": "shimmer", "name": "Shimmer", "description": "Brilhante e alegre", "best_for": ["gastronomia", "festas"]},
                {"id": "echo", "name": "Echo", "description": "Suave e calma", "best_for": ["termas", "bem-estar"]},
                {"id": "alloy", "name": "Alloy", "description": "Neutra e equilibrada", "best_for": ["informativo"]},
                {"id": "onyx", "name": "Onyx", "description": "Profunda e autoritária", "best_for": ["monumentos"]},
                {"id": "ash", "name": "Ash", "description": "Clara e articulada", "best_for": ["educativo"]},
            ],
            "models": [
                {"id": "tts-1", "name": "Standard", "description": "Rápido e eficiente"},
                {"id": "tts-1-hd", "name": "HD", "description": "Alta qualidade de áudio"}
            ],
            "speeds": [
                {"id": "slow", "value": 0.85, "description": "Lento - para conteúdo complexo"},
                {"id": "normal", "value": 1.0, "description": "Normal"},
                {"id": "fast", "value": 1.15, "description": "Rápido - para factos breves"}
            ],
            "supported_languages": ["pt", "en", "es", "fr", "de", "it"]
        }


# Global instance
audio_guide_service = AudioGuideService()
