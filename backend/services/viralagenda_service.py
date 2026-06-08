"""
Viral Agenda Service — Cultural events from viralagenda.com RSS
Feed: https://viralagenda.com/pt/rss
Cache TTL: 30 minutos (in-memory) + MongoDB persistence (fallback when RSS unavailable)
"""
import httpx
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import hashlib
import re

logger = logging.getLogger(__name__)

RSS_URL = "https://viralagenda.com/pt/rss"
CACHE_TTL = timedelta(minutes=30)
# When RSS is blocked/unavailable, retry less frequently to avoid hammering
BLOCKED_RETRY_TTL = timedelta(hours=2)
MONGO_COLLECTION = "viralagenda_cache"

# Portuguese month names for date parsing
_PT_MONTHS = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
    "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3,
    "abril": 4, "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
    "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}

# Region keywords → normalized region
_REGION_KEYWORDS = {
    "lisboa": "Lisboa", "lx": "Lisboa", "amadora": "Lisboa", "loures": "Lisboa",
    "sintra": "Lisboa", "cascais": "Lisboa", "setúbal": "Lisboa", "setubal": "Lisboa",
    "porto": "Norte", "braga": "Norte", "guimarães": "Norte", "viana": "Norte",
    "minho": "Norte", "bragança": "Norte", "chaves": "Norte", "douro": "Norte",
    "coimbra": "Centro", "aveiro": "Centro", "leiria": "Centro", "viseu": "Centro",
    "figueira": "Centro", "nazaré": "Centro", "óbidos": "Centro",
    "évora": "Alentejo", "beja": "Alentejo", "portalegre": "Alentejo",
    "faro": "Algarve", "lagos": "Algarve", "portimão": "Algarve", "albufeira": "Algarve",
    "silves": "Algarve", "tavira": "Algarve", "olhão": "Algarve",
    "açores": "Açores", "azores": "Açores", "ponta delgada": "Açores",
    "madeira": "Madeira", "funchal": "Madeira",
}

# Event type keywords → type classification
_TYPE_KEYWORDS = {
    "concerto": "concerto", "concert": "concerto", "música": "musica", "fado": "musica",
    "festival": "festival", "feira": "feira", "mercado": "feira",
    "exposição": "exposicao", "exposicao": "exposicao", "museu": "exposicao",
    "teatro": "teatro", "dança": "danca", "ballet": "danca",
    "cinema": "cinema", "filme": "cinema",
    "desporto": "desporto", "maratona": "desporto", "corrida": "desporto",
    "conferência": "conferencia", "congresso": "conferencia",
    "gastronomia": "gastronomia", "vinho": "gastronomia", "cerveja": "gastronomia",
    "romaria": "festa", "procissão": "festa", "festas": "festa",
}


class ViralAgendaService:
    """
    Fetches and parses cultural events from viralagenda.com RSS feed.
    Returns events in the same schema used by agenda_api.py
    so they can be merged without frontend changes.

    Resilience layers:
    1. In-memory cache (30 min TTL on success, 2h TTL on failure to avoid hammering)
    2. MongoDB persistence (survives server restarts; used when RSS is unavailable)
    """

    def __init__(self):
        self._cache: Optional[List[Dict[str, Any]]] = None
        self._cache_ts: Optional[datetime] = None
        self._last_failed: Optional[datetime] = None
        self._db = None

    def set_db(self, db) -> None:
        self._db = db

    @property
    def available(self) -> bool:
        """True if the last RSS fetch succeeded."""
        return self._last_failed is None or (
            self._cache_ts is not None and self._cache_ts > self._last_failed
        )

    async def get_events(
        self,
        region: Optional[str] = None,
        event_type: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        events = await self._fetch_with_cache()
        if region:
            events = [e for e in events if e.get("region", "").lower() == region.lower()]
        if event_type:
            events = [e for e in events if e.get("type", "").lower() == event_type.lower()]
        return events[:limit]

    async def _fetch_with_cache(self) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)

        # Use in-memory cache if still fresh
        if self._cache is not None and self._cache_ts is not None:
            ttl = CACHE_TTL if self.available else BLOCKED_RETRY_TTL
            if now - self._cache_ts < ttl:
                return self._cache

        # Attempt RSS fetch
        events = await self._fetch_rss()

        if events:
            self._cache = events
            self._cache_ts = now
            self._last_failed = None
            logger.info(f"ViralAgenda: {len(events)} events cached from RSS")
            # Persist to MongoDB for future fallback
            await self._persist_to_mongo(events, now)
        else:
            self._last_failed = now
            # Try stale in-memory cache first
            if self._cache:
                logger.warning("ViralAgenda RSS unavailable, serving stale in-memory cache")
                return self._cache
            # Fall back to MongoDB persistence
            mongo_events = await self._load_from_mongo()
            if mongo_events:
                self._cache = mongo_events
                self._cache_ts = now
                logger.warning(
                    f"ViralAgenda RSS unavailable, serving {len(mongo_events)} events from MongoDB cache"
                )
            else:
                logger.warning("ViralAgenda RSS unavailable and no cache available")
                return []

        return self._cache or []

    async def _fetch_rss(self) -> List[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    RSS_URL,
                    headers={
                        "User-Agent": "Mozilla/5.0 (compatible; PortugalVivo/3.0; +https://portugalvivo.pt)",
                        "Accept": "application/rss+xml, application/xml, text/xml, */*",
                        "Accept-Language": "pt-PT,pt;q=0.9",
                    },
                    follow_redirects=True,
                )
                if resp.status_code == 403:
                    logger.warning(
                        "ViralAgenda RSS blocked (403) — IP not in allowlist. "
                        "Will use MongoDB cache as fallback."
                    )
                    return []
                if resp.status_code != 200:
                    logger.warning(f"ViralAgenda RSS returned {resp.status_code}")
                    return []
                return self._parse_rss(resp.text)
        except httpx.TimeoutException:
            logger.warning("ViralAgenda RSS timeout")
            return []
        except Exception as e:
            logger.error(f"ViralAgenda RSS error: {e}")
            return []

    async def _persist_to_mongo(self, events: List[Dict[str, Any]], ts: datetime) -> None:
        if self._db is None:
            return
        try:
            await self._db[MONGO_COLLECTION].replace_one(
                {"_id": "latest"},
                {"_id": "latest", "events": events, "cached_at": ts},
                upsert=True,
            )
        except Exception as e:
            logger.warning(f"ViralAgenda: failed to persist to MongoDB: {e}")

    async def _load_from_mongo(self) -> List[Dict[str, Any]]:
        if self._db is None:
            return []
        try:
            doc = await self._db[MONGO_COLLECTION].find_one({"_id": "latest"})
            if doc and doc.get("events"):
                age_hours = (datetime.now(timezone.utc) - doc["cached_at"]).total_seconds() / 3600
                logger.info(f"ViralAgenda: loaded {len(doc['events'])} events from MongoDB (age: {age_hours:.1f}h)")
                return doc["events"]
        except Exception as e:
            logger.warning(f"ViralAgenda: failed to load from MongoDB: {e}")
        return []

    def _parse_rss(self, xml_text: str) -> List[Dict[str, Any]]:
        events = []
        try:
            root = ET.fromstring(xml_text)
            channel = root.find("channel")
            if channel is None:
                return []

            items = channel.findall("item")
            for item in items:
                event = self._parse_item(item)
                if event:
                    events.append(event)
        except ET.ParseError as e:
            logger.error(f"RSS XML parse error: {e}")
        return events

    def _parse_item(self, item: ET.Element) -> Optional[Dict[str, Any]]:
        def text(tag: str) -> str:
            el = item.find(tag)
            return (el.text or "").strip() if el is not None else ""

        title = text("title")
        if not title:
            return None

        description = self._strip_html(text("description"))
        link = text("link")
        pub_date_str = text("pubDate")
        category = text("category")

        # Parse date
        pub_date = self._parse_rfc822(pub_date_str)
        month = pub_date.month if pub_date else datetime.now(timezone.utc).month
        day = pub_date.day if pub_date else 1

        # Stable ID from URL
        event_id = "va-" + hashlib.md5(link.encode()).hexdigest()[:10]

        # Detect region from title + description
        region = self._detect_region(f"{title} {description} {category}")

        # Detect type
        event_type = self._detect_type(f"{title} {description} {category}")

        return {
            "id": event_id,
            "name": title,
            "type": event_type,
            "description": description[:500] if description else "",
            "date_text": pub_date.strftime("%-d de %B de %Y") if pub_date else "",
            "month": month,
            "day_start": day,
            "day_end": day,
            "region": region,
            "concelho": "",
            "url": link,
            "source": "viralagenda",
            "rarity": "incomum",
            "ticket_url": link,
            "has_tickets": bool(link),
            "external": True,
        }

    @staticmethod
    def _parse_rfc822(date_str: str) -> Optional[datetime]:
        """Parse RFC 822 date from RSS (e.g. 'Mon, 15 Apr 2026 10:00:00 +0000')."""
        if not date_str:
            return None
        try:
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(date_str).replace(tzinfo=timezone.utc)
        except Exception:
            return None

    @staticmethod
    def _strip_html(text: str) -> str:
        """Remove HTML tags from RSS description."""
        return re.sub(r"<[^>]+>", " ", text).strip()

    @staticmethod
    def _detect_region(text: str) -> str:
        text_lower = text.lower()
        for keyword, region in _REGION_KEYWORDS.items():
            if keyword in text_lower:
                return region
        return "Nacional"

    @staticmethod
    def _detect_type(text: str) -> str:
        text_lower = text.lower()
        for keyword, etype in _TYPE_KEYWORDS.items():
            if keyword in text_lower:
                return etype
        return "evento"


# Global singleton
viralagenda_service = ViralAgendaService()
