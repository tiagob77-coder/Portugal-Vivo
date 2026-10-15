"""
Audio Guide Service - Text-to-Speech for Heritage Sites
Uses OpenAI TTS (direct, or the legacy Emergent proxy).
"""
import os
import logging
import hashlib
import base64
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

from shared_utils import CONTENT_LANGUAGES, find_translation, normalize_language

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

# Spoken greeting and the line that closes a narration cut at the TTS limit.
INTROS = {
    "pt": "Bem-vindo a {name}. ",
    "en": "Welcome to {name}. ",
    "es": "Bienvenido a {name}. ",
    "fr": "Bienvenue à {name}. ",
}
TRUNCATION_TAILS = {
    "pt": "... Continue a explorar para descobrir mais.",
    "en": "... Keep exploring to discover more.",
    "es": "... Sigue explorando para descubrir más.",
    "fr": "... Continuez à explorer pour en découvrir davantage.",
}

# Accent guidance for gpt-4o-mini-tts. It goes in the request's
# `instructions` field: anything put in the input text is read out loud.
VOICE_INSTRUCTIONS = {
    "pt": "Speak European Portuguese from Portugal with a Lisbon accent. Never use Brazilian pronunciation.",
    "en": "Speak clear, neutral English. Pronounce Portuguese place names the Portuguese way.",
    "es": "Speak Castilian Spanish from Spain. Pronounce Portuguese place names the Portuguese way.",
    "fr": "Speak French from France. Pronounce Portuguese place names the Portuguese way.",
}
PACE_INSTRUCTIONS = {
    "slow": " Speak at a slightly slower, unhurried pace.",
    "fast": " Speak at a slightly brisker pace.",
}

# The only model that follows `instructions`; tts-1 / tts-1-hd ignore them.
INSTRUCTED_TTS_MODEL = "gpt-4o-mini-tts"


# Shorter texts make no sense as a guide; the sheet has no real content yet.
MIN_AUDIO_TEXT = 20


async def localized_narration(db, item: dict, language: Optional[str]) -> Dict[str, str]:
    """Text, POI name and language to narrate ``item`` in ``language``.

    Portuguese reads the AI narrative, then the description. Other languages
    read the translated sheet (poi_translations) the same way and fall back to
    Portuguese while the sheet has not been translated yet, so the guide never
    goes silent.
    """
    language = normalize_language(language)
    translation = await find_translation(db, item.get("id"), language) or {}
    text = (translation.get("ai_narrative") or translation.get("description") or "").strip()
    if len(text) >= MIN_AUDIO_TEXT:
        return {"text": text, "name": translation.get("name") or item.get("name", ""), "language": language}
    text = item.get("ai_narrative") or item.get("description") or item.get("name") or ""
    return {"text": text, "name": item.get("name", ""), "language": "pt"}


class AudioGuideService:
    """Service for generating audio guides using OpenAI TTS"""

    def __init__(self):
        # Mirror llm_client's auto-select: prefer direct OpenAI, fall back to
        # the Emergent proxy (legacy), else no remote provider at all. This
        # keeps the audio guide aligned with the rest of the app instead of
        # hard-requiring EMERGENT_LLM_KEY.
        self.openai_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.emergent_key = os.getenv("EMERGENT_LLM_KEY", "").strip()
        forced = os.getenv("LLM_PROVIDER", "").strip().lower()
        if forced == "openai":
            self.provider = "openai" if self.openai_key else None
        elif forced == "emergent":
            self.provider = "emergent" if self.emergent_key else None
        elif self.openai_key:
            self.provider = "openai"
        elif self.emergent_key:
            self.provider = "emergent"
        else:
            self.provider = None

        # Persist the cache outside /tmp when AUDIO_CACHE_DIR points at a volume
        # (docker-compose mounts one); an unusable dir must not stop the app.
        self._cache_dir = Path(os.getenv("AUDIO_CACHE_DIR", "/tmp/audio_guides"))
        try:
            self._cache_dir.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            logger.warning("Audio cache dir %s unusable (%s); using /tmp/audio_guides", self._cache_dir, exc)
            self._cache_dir = Path("/tmp/audio_guides")
            self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._tts_client = None

        if not self.provider:
            logger.warning(
                "No TTS provider configured (OPENAI_API_KEY / EMERGENT_LLM_KEY); "
                "audio guides fall back to on-device speech"
            )

    async def _get_emergent_client(self):
        """Lazy init of the Emergent TTS client (legacy path)."""
        if self._tts_client is None:
            from emergentintegrations.llm.openai import OpenAITextToSpeech
            self._tts_client = OpenAITextToSpeech(api_key=self.emergent_key)
        return self._tts_client

    def _select_model(self, use_hd: bool) -> str:
        """gpt-4o-mini-tts takes accent instructions; the Emergent proxy and HD keep tts-1."""
        if use_hd:
            return "tts-1-hd"
        return INSTRUCTED_TTS_MODEL if self.provider == "openai" else "tts-1"

    @staticmethod
    def _voice_instructions(language: str, speed: str) -> str:
        return VOICE_INSTRUCTIONS[language] + PACE_INSTRUCTIONS.get(speed, "")

    async def _synthesize(self, text: str, model: str, voice: str, speed: float,
                          instructions: Optional[str] = None) -> bytes:
        """Synthesize mp3 speech bytes using the active provider."""
        if self.provider == "openai":
            return await self._synthesize_openai(text, model, voice, speed, instructions)
        client = await self._get_emergent_client()
        return await client.generate_speech(
            text=text, model=model, voice=voice, speed=speed, response_format="mp3",
        )

    async def _synthesize_openai(self, text: str, model: str, voice: str, speed: float,
                                 instructions: Optional[str] = None) -> bytes:
        """Call OpenAI's /v1/audio/speech directly — no extra dependency needed."""
        import httpx

        payload = {
            "model": model,
            "voice": voice,
            "input": text,
            "speed": speed,
            "response_format": "mp3",
        }
        if instructions and model == INSTRUCTED_TTS_MODEL:
            payload["instructions"] = instructions

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/speech",
                headers={
                    "Authorization": f"Bearer {self.openai_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        resp.raise_for_status()
        return resp.content

    def _get_cache_key(self, text: str, voice: str, speed: float, model: str, language: str) -> str:
        """Generate cache key for audio"""
        content = f"{model}:{language}:{text}:{voice}:{speed}"
        return hashlib.md5(content.encode()).hexdigest()

    def _get_cached_audio(self, cache_key: str) -> Optional[bytes]:
        """Check if audio is cached"""
        cache_path = self._cache_dir / f"{cache_key}.mp3"
        if cache_path.exists():
            logger.info(f"Audio cache hit: {cache_key}")
            return cache_path.read_bytes()
        return None

    def _cache_audio(self, cache_key: str, audio_bytes: bytes) -> None:
        """Save audio to cache; a full or read-only disk only costs the cache."""
        cache_path = self._cache_dir / f"{cache_key}.mp3"
        try:
            cache_path.write_bytes(audio_bytes)
        except OSError as exc:
            logger.warning("Could not cache audio %s: %s", cache_key, exc)
            return
        logger.info(f"Audio cached: {cache_key}")

    def _select_voice(self, category: Optional[str], content_type: Optional[str]) -> str:
        """Select appropriate voice based on content"""
        if category in VOICE_PROFILES:
            return VOICE_PROFILES[category]
        if content_type in VOICE_PROFILES:
            return VOICE_PROFILES[content_type]
        return VOICE_PROFILES["default"]

    def _prepare_text_for_tts(self, text: str, poi_name: str, language: str = "pt") -> str:
        """Greeting in the narration's language, natural pauses, cut to the TTS limit.

        Everything returned here is read out loud, so accent guidance goes in
        the request's `instructions` field instead (see VOICE_INSTRUCTIONS).
        """
        language = normalize_language(language)
        intro = INTROS[language].format(name=poi_name)
        cleaned = text.strip().replace("...", ". ")

        # Limit to 4000 chars (API limit is 4096)
        if len(intro) + len(cleaned) > 4000:
            tail = TRUNCATION_TAILS[language]
            cleaned = cleaned[:4000 - len(intro) - len(tail)] + tail
        return intro + cleaned

    def _device_text(self, text: str, poi_name: str, language: str = "pt") -> str:
        """Plain narration text for on-device TTS — no engine hints, trimmed."""
        intro = INTROS[normalize_language(language)].format(name=poi_name)
        cleaned = text.strip().replace("...", ". ")
        return (intro + cleaned)[:1500]

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
        # Voice/speed and a device-fallback payload are computed up front so we
        # can always return readable text for on-device TTS — the client never
        # shows a dead "Ouvir" button.
        language = normalize_language(language)
        voice = self._select_voice(category, None)
        speed_value = SPEED_PROFILES.get(speed, 1.0)
        device_text = self._device_text(text, poi_name, language)

        def _device_fallback(reason: str) -> Dict[str, Any]:
            return {
                "success": False,
                "audio_available": False,
                "fallback": "device",
                "tts_provider": None,
                "text": device_text,
                "voice": voice,
                "language": language,
                "poi_id": poi_id,
                "poi_name": poi_name,
                "error": reason,
            }

        if not self.provider:
            return _device_fallback("TTS remoto não configurado; usar voz do dispositivo")

        try:
            prepared_text = self._prepare_text_for_tts(text, poi_name, language)
            model = self._select_model(use_hd)

            # Check cache
            cache_key = self._get_cache_key(prepared_text, voice, speed_value, model, language)
            cached_audio = self._get_cached_audio(cache_key)

            if cached_audio:
                audio_base64 = base64.b64encode(cached_audio).decode('utf-8')
                return {
                    "success": True,
                    "audio_base64": audio_base64,
                    "audio_format": "mp3",
                    "voice": voice,
                    "speed": speed_value,
                    "model": model,
                    "cached": True,
                    "tts_provider": self.provider,
                    "duration_estimate_seconds": len(prepared_text) / 15,  # Rough estimate
                    "poi_id": poi_id,
                    "poi_name": poi_name,
                    "language": language
                }

            audio_bytes = await self._synthesize(
                prepared_text, model, voice, speed_value,
                instructions=self._voice_instructions(language, speed),
            )

            # Cache the audio
            self._cache_audio(cache_key, audio_bytes)

            # Convert to base64 for response
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')

            # Estimate duration (rough: ~150 words per minute at normal speed)
            word_count = len(prepared_text.split())
            duration_estimate = (word_count / 150) * 60 / speed_value

            logger.info(f"Generated audio guide for {poi_name} ({len(audio_bytes)} bytes, provider={self.provider})")

            return {
                "success": True,
                "audio_base64": audio_base64,
                "audio_format": "mp3",
                "voice": voice,
                "speed": speed_value,
                "model": model,
                "cached": False,
                "tts_provider": self.provider,
                "duration_estimate_seconds": round(duration_estimate, 1),
                "text_length": len(prepared_text),
                "poi_id": poi_id,
                "poi_name": poi_name,
                "language": language,
                "generated_at": datetime.now(timezone.utc).isoformat()
            }

        except ImportError as e:
            logger.error(f"TTS library not available ({e}); falling back to on-device speech")
            return _device_fallback("Biblioteca TTS indisponível; usar voz do dispositivo")
        except Exception as e:
            logger.error(f"TTS generation error ({e}); falling back to on-device speech")
            return _device_fallback("Falha no TTS remoto; usar voz do dispositivo")

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
                {"id": INSTRUCTED_TTS_MODEL, "name": "Natural", "description": "Sotaque certo em cada língua (predefinido)"},
                {"id": "tts-1", "name": "Standard", "description": "Rápido e eficiente"},
                {"id": "tts-1-hd", "name": "HD", "description": "Alta qualidade de áudio"}
            ],
            "speeds": [
                {"id": "slow", "value": 0.85, "description": "Lento - para conteúdo complexo"},
                {"id": "normal", "value": 1.0, "description": "Normal"},
                {"id": "fast", "value": 1.15, "description": "Rápido - para factos breves"}
            ],
            "supported_languages": list(CONTENT_LANGUAGES)
        }


# Global instance
audio_guide_service = AudioGuideService()
