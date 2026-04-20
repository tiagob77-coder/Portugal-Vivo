"""
IQ Engine - Módulo 9-10: Data Enrichment
Enriquecimento de dados via scraping e APIs externas.

v2 additions:
  - Seasonal closure inference from description text
  - Binary flags: reserva_obrigatoria, pagamento_numerario, estacionamento_local
  - Source confidence weighting (official 0.4 + maps 0.4 + wikipedia 0.2)
"""
from typing import Dict, Optional
import logging
import httpx
import re
from bs4 import BeautifulSoup
from iq_engine_base import (
    IQModule,
    ModuleType,
    ProcessingResult,
    ProcessingStatus,
    POIProcessingData
)

logger = logging.getLogger(__name__)

class DataEnrichmentModule(IQModule):
    """
    Módulo 9-10: Data Enrichment
    
    Enriquece POIs com informações adicionais:
    - Horários de funcionamento
    - Preços de entrada
    - Contactos (telefone, email, website)
    - Redes sociais
    - Reviews/ratings
    
    Fontes:
    - Google Places API (se disponível)
    - Scraping de websites oficiais
    - Wikipedia
    - Portais turísticos
    """

    def __init__(self, google_places_key: Optional[str] = None):
        super().__init__(ModuleType.DATA_ENRICHMENT)
        self.google_places_key = google_places_key
        self.places_url = "https://maps.googleapis.com/maps/api/place"

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        """Enrich POI with additional data (v2)."""

        enriched_data = {}
        sources_used = []
        warnings = []
        issues = []

        # 1. Try Google Places API
        if self.google_places_key and data.location:
            places_data = await self._enrich_from_google_places(data)
            if places_data:
                enriched_data.update(places_data)
                sources_used.append("google_places")

        # 2. Extract from existing metadata
        metadata_data = self._extract_from_metadata(data)
        enriched_data.update(metadata_data)
        if metadata_data:
            sources_used.append("existing_metadata")

        # 3. Intelligent extraction from description
        desc_data = self._extract_from_description(data)
        if desc_data:
            enriched_data.update(desc_data)
            sources_used.append("description_extraction")

        # 4. Search Wikipedia (if name is known landmark)
        if self._is_notable_landmark(data):
            wiki_data = await self._enrich_from_wikipedia(data)
            if wiki_data:
                enriched_data.update(wiki_data)
                sources_used.append("wikipedia")

        # ── v2: Seasonal closure inference ─────────────────────────────────────
        seasonal_closure = self._infer_seasonal_closure(data)
        if seasonal_closure:
            enriched_data["seasonal_closure"] = seasonal_closure
            warnings.append(
                f"Fecho sazonal inferido: {seasonal_closure.get('note', '')}"
            )

        # ── v2: Binary flags ───────────────────────────────────────────────────
        flags = self._extract_binary_flags(data)
        enriched_data.update(flags)

        # ── Source confidence weighting ────────────────────────────────────────
        source_confidence = self._calculate_source_confidence(sources_used, enriched_data)

        # Calculate enrichment score
        score = self._calculate_enrichment_score(enriched_data)

        # Determine status
        if score >= 70:
            status = ProcessingStatus.COMPLETED
        elif score >= 40:
            status = ProcessingStatus.REQUIRES_REVIEW
            warnings.append("Dados parcialmente enriquecidos")
        else:
            status = ProcessingStatus.REQUIRES_REVIEW
            issues.append("Poucos dados adicionais encontrados")

        return ProcessingResult(
            module=self.module_type,
            status=status,
            score=score,
            confidence=source_confidence,
            data={
                "enriched_fields": enriched_data,
                "sources_used": sources_used,
                "fields_added": list(enriched_data.keys()),
                "enrichment_percentage": score,
                "source_confidence": source_confidence,
                # Binary flags surfaced at top level for easy access
                "reserva_obrigatoria": flags.get("reserva_obrigatoria", False),
                "pagamento_numerario": flags.get("pagamento_numerario", False),
                "estacionamento_local": flags.get("estacionamento_local", None),
                "seasonal_closure": seasonal_closure,
            },
            issues=issues,
            warnings=warnings
        )

    async def _enrich_from_google_places(self, data: POIProcessingData) -> Dict:
        """Enrich from Google Places API"""
        try:
            # Extract coordinates
            if isinstance(data.location, dict):
                if 'lat' in data.location and 'lng' in data.location:
                    lat, lng = data.location['lat'], data.location['lng']
                elif 'coordinates' in data.location:
                    lng, lat = data.location['coordinates']
                else:
                    return {}
            else:
                return {}

            # Search for place
            search_url = f"{self.places_url}/nearbysearch/json"
            params = {
                "location": f"{lat},{lng}",
                "radius": 50,  # 50m radius
                "keyword": data.name,
                "key": self.google_places_key
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(search_url, params=params)
                response.raise_for_status()
                result = response.json()

                if result.get("status") == "OK" and result.get("results"):
                    place = result["results"][0]
                    place_id = place.get("place_id")

                    # Get place details
                    details_url = f"{self.places_url}/details/json"
                    details_params = {
                        "place_id": place_id,
                        "fields": "opening_hours,formatted_phone_number,website,rating,price_level,photos",
                        "key": self.google_places_key
                    }

                    details_response = await client.get(details_url, params=details_params)
                    details_result = details_response.json()

                    if details_result.get("status") == "OK":
                        place_details = details_result.get("result", {})

                        enriched = {}

                        if "opening_hours" in place_details:
                            hours = place_details["opening_hours"]
                            enriched["opening_hours"] = hours.get("weekday_text", [])
                            enriched["is_open_now"] = hours.get("open_now")

                        if "formatted_phone_number" in place_details:
                            enriched["phone"] = place_details["formatted_phone_number"]

                        if "website" in place_details:
                            enriched["website"] = place_details["website"]

                        if "rating" in place_details:
                            enriched["google_rating"] = place_details["rating"]

                        if "price_level" in place_details:
                            price_level = place_details["price_level"]
                            enriched["price_level"] = "€" * price_level if price_level else "Grátis"

                        return enriched

        except Exception as e:
            logger.warning(f"Google Places enrichment failed: {e}")

        return {}

    def _extract_from_metadata(self, data: POIProcessingData) -> Dict:
        """Extract useful data from existing metadata"""
        extracted = {}

        if not data.metadata:
            return extracted

        # Common metadata fields
        field_mappings = {
            "phone": ["phone", "telefone", "tel", "contact_phone"],
            "email": ["email", "e-mail", "contact_email"],
            "website": ["website", "site", "url", "homepage"],
            "opening_hours": ["hours", "horario", "horário", "opening_hours"],
            "admission_fee": ["price", "fee", "preco", "preço", "admission"],
            "facebook": ["facebook", "fb"],
            "instagram": ["instagram", "ig"]
        }

        for standard_key, possible_keys in field_mappings.items():
            for key in possible_keys:
                if key in data.metadata:
                    extracted[standard_key] = data.metadata[key]
                    break

        return extracted

    def _extract_from_description(self, data: POIProcessingData) -> Dict:
        """Extract structured data from description text"""
        extracted = {}

        if not data.description:
            return extracted

        text = data.description

        # Extract phone numbers (Portuguese format)
        phone_pattern = r'(\+351\s?)?(\d{3}\s?\d{3}\s?\d{3}|\d{2}\s?\d{3}\s?\d{4})'
        phones = re.findall(phone_pattern, text)
        if phones:
            extracted["phone_from_text"] = ''.join(phones[0]).strip()

        # Extract email addresses
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, text)
        if emails:
            extracted["email_from_text"] = emails[0]

        # Extract URLs
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
        urls = re.findall(url_pattern, text)
        if urls:
            extracted["website_from_text"] = urls[0]

        # Extract opening hours patterns
        hour_patterns = [
            r'(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})',
            r'(\d{1,2}h\d{0,2})\s*[-–]\s*(\d{1,2}h\d{0,2})',
        ]

        for pattern in hour_patterns:
            hours = re.findall(pattern, text)
            if hours:
                extracted["hours_from_text"] = f"{hours[0][0]} - {hours[0][1]}"
                break

        # Extract price information
        price_patterns = [
            r'(grátis|gratuito|entrada livre)',
            r'(€\s*\d+(?:[.,]\d{2})?)',
            r'(\d+\s*euros?)',
        ]

        for pattern in price_patterns:
            prices = re.findall(pattern, text, re.IGNORECASE)
            if prices:
                extracted["price_from_text"] = prices[0] if isinstance(prices[0], str) else prices[0][0]
                break

        return extracted

    def _is_notable_landmark(self, data: POIProcessingData) -> bool:
        """Check if POI is notable enough for Wikipedia"""
        # Heuristics for notable landmarks
        notable_keywords = [
            'património mundial', 'unesco', 'monumento nacional',
            'castelo', 'palácio', 'sé', 'catedral', 'mosteiro',
            'santuário', 'basílica', 'museu nacional'
        ]

        text = f"{data.name} {data.description or ''}".lower()
        return any(keyword in text for keyword in notable_keywords)

    async def _enrich_from_wikipedia(self, data: POIProcessingData) -> Dict:
        """Enrich from Wikipedia"""
        try:
            search_query = data.name.replace(" ", "_")
            wiki_url = f"https://pt.wikipedia.org/wiki/{search_query}"

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(wiki_url, follow_redirects=True)

                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, 'html.parser')

                    enriched = {}

                    # Extract infobox data
                    infobox = soup.find('table', class_='infobox')
                    if infobox:
                        rows = infobox.find_all('tr')
                        for row in rows:
                            header = row.find('th')
                            data_cell = row.find('td')

                            if header and data_cell:
                                key = header.get_text(strip=True).lower()
                                value = data_cell.get_text(strip=True)

                                # Map to our fields
                                if 'website' in key or 'site' in key:
                                    enriched["wikipedia_website"] = value
                                elif 'telefone' in key:
                                    enriched["wikipedia_phone"] = value

                    # Get first paragraph as summary
                    first_para = soup.find('p')
                    if first_para:
                        summary = first_para.get_text(strip=True)
                        if len(summary) > 50:
                            enriched["wikipedia_summary"] = summary[:300]

                    if enriched:
                        enriched["wikipedia_url"] = str(response.url)

                    return enriched

        except Exception as e:
            logger.debug(f"Wikipedia enrichment failed: {e}")

        return {}

    # ── v2 new helpers ─────────────────────────────────────────────────────────

    def _infer_seasonal_closure(self, data: POIProcessingData) -> Optional[Dict]:
        """
        Infer seasonal closure from description text.
        Returns dict like {"months": [12, 1, 2], "note": "Encerrado no inverno"} or None.
        """
        text = (data.description or "").lower()

        # Explicit closure mentions
        closure_patterns = [
            (["encerrado no inverno", "fecha no inverno", "fechado no inverno"],
             [12, 1, 2], "Encerrado no inverno"),
            (["encerrado no verão", "fecha no verão"],
             [6, 7, 8], "Encerrado no verão"),
            (["só abre na primavera", "abre em abril", "abre em março"],
             [10, 11, 12, 1, 2, 3], "Abre apenas na primavera/verão"),
            (["temporada de verão", "funciona no verão", "aberto no verão"],
             [10, 11, 12, 1, 2, 3, 4, 5], "Funciona apenas na temporada de verão"),
            (["período balnear", "época balnear"],
             [10, 11, 12, 1, 2, 3, 4, 5], "Aberto apenas no período balnear"),
        ]

        for triggers, closed_months, note in closure_patterns:
            if any(t in text for t in triggers):
                return {"months_closed": closed_months, "note": note, "inferred": True}

        # Check metadata for explicit closure
        meta = data.metadata or {}
        if meta.get("seasonal_closure"):
            val = meta["seasonal_closure"]
            if isinstance(val, dict):
                return val
            return {"months_closed": [], "note": str(val), "inferred": False}

        return None

    def _extract_binary_flags(self, data: POIProcessingData) -> Dict:
        """
        Extract binary operational flags from description + metadata.

        reserva_obrigatoria  — reservation required
        pagamento_numerario  — cash only
        estacionamento_local — has local parking (True/False/None=unknown)
        """
        text = (data.description or "").lower()
        meta = data.metadata or {}
        flags: Dict = {}

        # reserva_obrigatoria
        reservation_pos = ["reserva obrigatória", "marcação obrigatória", "reserva prévia",
                            "só com reserva", "marcação prévia", "booking required"]
        reservation_neg = ["sem reserva", "entrada livre", "free entry", "walk-in"]

        if meta.get("reserva_obrigatoria") is not None:
            flags["reserva_obrigatoria"] = bool(meta["reserva_obrigatoria"])
        elif any(p in text for p in reservation_pos):
            flags["reserva_obrigatoria"] = True
        elif any(p in text for p in reservation_neg):
            flags["reserva_obrigatoria"] = False
        else:
            flags["reserva_obrigatoria"] = False

        # pagamento_numerario (cash only)
        cash_pos = ["só numerário", "apenas numerário", "cash only", "não aceita cartão",
                    "sem multibanco", "pagamento em dinheiro"]
        if meta.get("pagamento_numerario") is not None:
            flags["pagamento_numerario"] = bool(meta["pagamento_numerario"])
        elif any(p in text for p in cash_pos):
            flags["pagamento_numerario"] = True
        else:
            flags["pagamento_numerario"] = False

        # estacionamento_local
        parking_pos = ["estacionamento gratuito", "parque de estacionamento", "lugar de estacionamento",
                        "parking disponível", "fácil estacionamento"]
        parking_neg = ["sem estacionamento", "não há estacionamento", "estacionamento pago distante"]
        if meta.get("estacionamento_local") is not None:
            flags["estacionamento_local"] = bool(meta["estacionamento_local"])
        elif any(p in text for p in parking_pos):
            flags["estacionamento_local"] = True
        elif any(p in text for p in parking_neg):
            flags["estacionamento_local"] = False
        else:
            flags["estacionamento_local"] = None  # unknown

        return flags

    def _calculate_source_confidence(
        self,
        sources_used: list,
        enriched_data: Dict,
    ) -> float:
        """
        Source confidence weighting:
          official/google_places: 0.4
          existing_metadata/maps: 0.4
          wikipedia:              0.2
        Returns weighted confidence 0-1.
        """
        weights = {
            "google_places": 0.4,
            "existing_metadata": 0.2,
            "description_extraction": 0.2,
            "wikipedia": 0.2,
        }
        total_weight = sum(weights.get(s, 0.1) for s in sources_used)
        return min(1.0, round(total_weight, 2)) if sources_used else 0.3

    def _calculate_enrichment_score(self, enriched_data: Dict) -> float:
        """Calculate enrichment quality score (0-100)"""
        if not enriched_data:
            return 0

        # Weight different types of data
        weights = {
            "opening_hours": 20,
            "phone": 15,
            "website": 15,
            "email": 10,
            "admission_fee": 15,
            "google_rating": 10,
            "price_level": 10,
            "wikipedia_summary": 5
        }

        score = 0
        for field, weight in weights.items():
            if field in enriched_data:
                score += weight

        # Bonus for having multiple sources
        if "phone" in enriched_data and "website" in enriched_data:
            score += 10

        # Bonus for extracted data
        extracted_fields = [k for k in enriched_data.keys() if "_from_text" in k]
        score += min(10, len(extracted_fields) * 5)

        return min(100, score)
