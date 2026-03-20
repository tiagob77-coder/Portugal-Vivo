"""
IQ Engine - Modules M13-M19: Intelligent Route Planning
M13: Time-based Routing (estimativa de duração de visita)
M14: Difficulty Assessment (acessibilidade e dificuldade)
M15: Profile Matching (adequação a perfis de visitante)
M16: Weather Dependency (sensibilidade meteorológica)
M17: Time of Day (melhor hora de visita)
M18: Multi-day Suitability (aptidão para itinerários multi-dia)
M19: Route Connectivity (conectividade geográfica e temática)

v2 additions:
  - Context vector (RouteContextProfile) consumed by M13, M14, M15, M19
  - Micro-route flag in M13: POI fits in <2h walk-only route
  - Solar orientation in M19: sunrise/sunset suitability for outdoor POIs
"""
import math
from datetime import datetime, timezone
from typing import List, Optional
from iq_engine_base import (
    IQModule, ModuleType, ProcessingResult, ProcessingStatus, POIProcessingData,
    RouteContextProfile,
)


def _get_coords(data: POIProcessingData) -> Optional[tuple]:
    """Extract lat/lng from POI location data"""
    loc = data.location
    if not loc:
        return None
    if isinstance(loc, dict):
        if 'coordinates' in loc:
            coords = loc['coordinates']
            if isinstance(coords, list) and len(coords) >= 2:
                return (coords[1], coords[0])  # GeoJSON: [lng, lat]
        if 'lat' in loc and 'lng' in loc:
            return (loc['lat'], loc['lng'])
    return None


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    """Calculate distance between two points in km"""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


# ==============================================================
# M13 - TIME-BASED ROUTING
# ==============================================================
class TimeRoutingModule(IQModule):
    """M13 - Estimates visit duration and time-based route suitability"""

    # Average visit times by category (minutes)
    VISIT_TIMES = {
        "festas_romarias": 30, "musica_tradicional": 20,
        "restaurantes_gastronomia": 90, "tabernas_historicas": 60,
        "museus": 60, "arte_urbana": 45,
        "castelos": 45, "arqueologia_geologia": 40,
        "aventura_natureza": 60, "natureza_especializada": 90, "percursos_pedestres": 120,
        "praias_fluviais": 120, "termas_banhos": 90, "surf": 120,
        "festas_romarias": 180, "produtores_dop": 60,
        "oficios_artesanato": 40, "barragens_albufeiras": 60,
        "miradouros": 20, "cascatas_pocos": 45,
        "ecovias_passadicos": 90, "moinhos_azenhas": 30,
        "rotas_tematicas": 60, "mercados_feiras": 60,
        "alojamentos_rurais": 30, "flora_autoctone": 40,
        "fauna_autoctone": 45,
    }

    TIME_SLOTS = {
        "rapida_1h": {"max_minutes": 60, "max_pois": 3},
        "passeio_2h": {"max_minutes": 120, "max_pois": 5},
        "meio_dia": {"max_minutes": 240, "max_pois": 8},
        "dia_inteiro": {"max_minutes": 480, "max_pois": 12},
    }

    def __init__(self):
        super().__init__(ModuleType.TIME_ROUTING)

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        category = (data.category or "").lower()
        desc_len = len(data.description or "")
        context: Optional[RouteContextProfile] = data.route_context

        # Estimate visit time
        base_time = self.VISIT_TIMES.get(category, 30)

        # Adjust based on description richness
        if desc_len > 300:
            base_time = int(base_time * 1.3)
        elif desc_len < 50:
            base_time = int(base_time * 0.8)

        # Context: if max_route_hours is very short, prefer shorter POIs
        if context and context.max_route_hours and context.max_route_hours <= 2:
            # Micro-route context — penalise POIs > 60 min
            if base_time > 60:
                base_time = 60

        # Determine suitable time slots
        suitable_slots = []
        for slot_id, slot_config in self.TIME_SLOTS.items():
            if base_time <= slot_config["max_minutes"] * 0.8:
                suitable_slots.append(slot_id)

        # ── Micro-route flag (< 2h walk-only) ─────────────────────────────────
        fits_micro_route = base_time <= 90  # single POI takes ≤ 90 min

        versatility = len(suitable_slots) / len(self.TIME_SLOTS)
        score = 40 + versatility * 40 + (20 if base_time <= 60 else 10 if base_time <= 120 else 0)

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=round(min(score, 100), 1),
            confidence=0.7,
            data={
                "estimated_visit_minutes": base_time,
                "visit_time_label": f"{base_time} min",
                "suitable_time_slots": suitable_slots,
                "time_flexibility": round(versatility * 100, 1),
                "travel_buffer_minutes": 15,
                "fits_micro_route": fits_micro_route,  # v2
            },
            issues=[],
            warnings=["Tempo estimado via categoria - dados de horário melhoram precisão"] if base_time == 30 else []
        )


# ==============================================================
# M14 - DIFFICULTY ASSESSMENT
# ==============================================================
class DifficultyRoutingModule(IQModule):
    """M14 - Evaluates physical difficulty and accessibility"""

    DIFFICULTY_KEYWORDS = {
        "facil": ["centro", "cidade", "urbano", "museu", "restaurante", "café", "loja", "acessível"],
        "moderado": ["jardim", "parque", "praia", "miradouro", "castelo", "ruínas"],
        "dificil": ["serra", "montanha", "trilho", "cascata", "floresta", "escalada", "caminhada"],
        "expert": ["alpinismo", "rapel", "canyoning", "vertical", "radical"],
    }

    ACCESSIBILITY_KEYWORDS = {
        "wheelchair": ["acessível", "rampa", "elevador", "plano", "centro"],
        "elderly": ["fácil", "plano", "centro", "museu", "restaurante", "jardim"],
        "children": ["parque", "praia", "jardim", "museu", "interativo"],
        "mobility": ["escadas", "íngreme", "trilho", "montanha"],
    }

    def __init__(self):
        super().__init__(ModuleType.DIFFICULTY_ROUTING)

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        text = f"{data.name} {data.description} {data.category or ''}".lower()
        context: Optional[RouteContextProfile] = data.route_context

        # Determine difficulty level
        difficulty_scores = {}
        for level, keywords in self.DIFFICULTY_KEYWORDS.items():
            matches = sum(1 for kw in keywords if kw in text)
            difficulty_scores[level] = matches

        max_diff = max(difficulty_scores, key=difficulty_scores.get)
        if difficulty_scores[max_diff] == 0:
            max_diff = "moderado"

        difficulty_levels = {"facil": 1, "moderado": 2, "dificil": 3, "expert": 4}
        difficulty_num = difficulty_levels[max_diff]

        accessibility = {}
        for access_type, keywords in self.ACCESSIBILITY_KEYWORDS.items():
            matches = sum(1 for kw in keywords if kw in text)
            accessibility[access_type] = matches > 0

        wheelchair_score = 80 if accessibility.get("wheelchair") else (40 if max_diff == "facil" else 20)

        # Context: if wheelchair constraint present, downgrade score for hard POIs
        context_penalty = 0
        context_notes = []
        if context and "wheelchair" in (context.mobility_constraints or []):
            if wheelchair_score < 60:
                context_penalty = 30
                context_notes.append("POI pode não ser adequado para cadeira de rodas")

        score = 100 - (difficulty_num - 1) * 15
        if wheelchair_score >= 60:
            score += 10
        score = max(0, score - context_penalty)

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=round(min(score, 100), 1),
            confidence=0.6,
            data={
                "difficulty_level": max_diff,
                "difficulty_numeric": difficulty_num,
                "difficulty_label": {"facil": "Fácil", "moderado": "Moderado",
                                      "dificil": "Difícil", "expert": "Especialista"}[max_diff],
                "wheelchair_accessible": wheelchair_score >= 60,
                "wheelchair_score": wheelchair_score,
                "suitable_for_elderly": accessibility.get("elderly", False),
                "suitable_for_children": accessibility.get("children", False),
                "requires_mobility": accessibility.get("mobility", False),
                "context_notes": context_notes,
            },
            issues=[],
            warnings=(
                ["Nível de dificuldade inferido - dados explícitos melhoram precisão"]
                + context_notes
            ),
        )


# ==============================================================
# M15 - PROFILE MATCHING
# ==============================================================
class ProfileRoutingModule(IQModule):
    """M15 - Evaluates POI suitability for different visitor profiles"""

    PROFILES = {
        "familia": {
            "name": "Família com Crianças",
            "positive": ["parque", "praia", "jardim", "museu", "interativo", "natureza", "animais",
                        "piscina", "recreativo", "infantil", "diversão"],
            "negative": ["bar", "noturno", "álcool", "radical", "perigoso"],
            "preferred_categories": ["aventura_natureza", "praias_fluviais", "museus"],
        },
        "casal": {
            "name": "Casal / Romântico",
            "positive": ["miradouro", "jardim", "palácio", "restaurante", "praia", "romântico",
                        "vista", "panorâmica", "charme", "boutique", "spa"],
            "negative": ["infantil", "parque infantil"],
            "preferred_categories": ["restaurantes_gastronomia", "produtores_dop", "termas_banhos", "aventura_natureza"],
        },
        "solo": {
            "name": "Viajante Solo",
            "positive": ["museu", "café", "trilho", "centro", "histórico", "cultural",
                        "fotografia", "aventura", "hostel"],
            "negative": [],
            "preferred_categories": ["arte_urbana", "museus", "percursos_pedestres", "restaurantes_gastronomia"],
        },
        "senior": {
            "name": "Seniores",
            "positive": ["termas", "jardim", "museu", "restaurante", "acessível", "tranquilo",
                        "patrimonio", "histórico", "religioso", "café"],
            "negative": ["escalada", "radical", "rapel", "canyoning"],
            "preferred_categories": ["festas_romarias", "termas_banhos", "restaurantes_gastronomia", "museus"],
        },
        "grupo": {
            "name": "Grupo / Excursão",
            "positive": ["museu", "monumento", "castelo", "parque", "restaurante", "festival",
                        "adega", "grupo", "visita guiada", "workshop"],
            "negative": [],
            "preferred_categories": ["produtores_dop", "castelos", "arqueologia_geologia", "festas_romarias"],
        },
        "aventureiro": {
            "name": "Aventureiro",
            "positive": ["trilho", "serra", "radical", "escalada", "rapel", "canyoning", "surf",
                        "montanha", "cascata", "rio", "btt", "kayak"],
            "negative": ["museu", "centro comercial"],
            "preferred_categories": ["aventura_natureza", "percursos_pedestres", "natureza_especializada", "praias_fluviais"],
        },
    }

    def __init__(self):
        super().__init__(ModuleType.PROFILE_ROUTING)

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        text = f"{data.name} {data.description} {' '.join(data.tags)}".lower()
        category = (data.category or "").lower()
        context: Optional[RouteContextProfile] = data.route_context

        profile_scores = {}
        best_profile = None
        best_score = 0

        for profile_id, config in self.PROFILES.items():
            score = 0

            if category in config["preferred_categories"]:
                score += 40

            pos_matches = sum(1 for kw in config["positive"] if kw in text)
            score += min(pos_matches * 8, 40)

            neg_matches = sum(1 for kw in config["negative"] if kw in text)
            score -= neg_matches * 15

            score = max(0, min(score, 100))

            # Context boost: if request targets this profile, boost its score
            if context and context.visitor_profile == profile_id:
                score = min(100, score * 1.2)

            profile_scores[profile_id] = {
                "score": round(score, 1),
                "profile_name": config["name"],
            }

            if score > best_score:
                best_score = score
                best_profile = profile_id

        scores = [v["score"] for v in profile_scores.values()]
        avg_score = sum(scores) / len(scores) if scores else 0
        suitable_count = sum(1 for s in scores if s >= 40)

        overall = avg_score * 0.5 + (suitable_count / len(self.PROFILES)) * 50

        # If context specifies a profile, overall reflects that profile score
        if context and context.visitor_profile and context.visitor_profile in profile_scores:
            targeted_score = profile_scores[context.visitor_profile]["score"]
            overall = targeted_score * 0.7 + overall * 0.3

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=round(min(overall, 100), 1),
            confidence=0.65,
            data={
                "best_profile": best_profile,
                "best_profile_name": self.PROFILES[best_profile]["name"] if best_profile else None,
                "best_profile_score": round(best_score, 1),
                "suitable_profiles": [pid for pid, ps in profile_scores.items() if ps["score"] >= 40],
                "profile_count": suitable_count,
                "context_profile": context.visitor_profile if context else None,
                "profiles": {k: v["score"] for k, v in sorted(
                    profile_scores.items(), key=lambda x: x[1]["score"], reverse=True
                )},
            },
            issues=[],
            warnings=[]
        )


# ==============================================================
# M16 - WEATHER DEPENDENCY
# ==============================================================
class WeatherRoutingModule(IQModule):
    """M16 - Assesses weather sensitivity and year-round accessibility"""

    INDOOR_KEYWORDS = ["museu", "galeria", "teatro", "restaurante", "café", "mercado", "centro comercial",
                       "biblioteca", "igreja", "catedral", "convento", "palácio", "termas", "spa"]
    OUTDOOR_KEYWORDS = ["praia", "trilho", "parque", "jardim", "miradouro", "serra", "rio", "lago",
                        "cascata", "piscina", "montanha", "floresta", "ruínas"]
    SEASONAL_KEYWORDS = {
        "verao": ["praia", "piscina", "rio", "festival", "gelado"],
        "inverno": ["termas", "spa", "museu", "restaurante", "neve"],
        "primavera": ["jardim", "flora", "floração", "trilho", "natureza"],
        "outono": ["vindima", "vinho", "castanha", "floresta"],
    }

    def __init__(self):
        super().__init__(ModuleType.WEATHER_ROUTING)

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        text = f"{data.name} {data.description} {data.category or ''}".lower()

        indoor_count = sum(1 for kw in self.INDOOR_KEYWORDS if kw in text)
        outdoor_count = sum(1 for kw in self.OUTDOOR_KEYWORDS if kw in text)

        # Determine environment type
        if indoor_count > outdoor_count:
            env_type = "interior"
            weather_sensitivity = "baixa"
        elif outdoor_count > indoor_count:
            env_type = "exterior"
            weather_sensitivity = "alta"
        else:
            env_type = "misto"
            weather_sensitivity = "média"

        # Seasonal suitability
        seasonal_scores = {}
        for season, keywords in self.SEASONAL_KEYWORDS.items():
            matches = sum(1 for kw in keywords if kw in text)
            seasonal_scores[season] = min(matches * 30 + 30, 100)

        # Indoor places are always suitable (rain or shine)
        best_seasons = [s for s, score in seasonal_scores.items() if score >= 60]
        year_round = env_type == "interior" or len(best_seasons) >= 3

        # Score: year-round accessible = higher score
        if year_round:
            score = 85
        elif env_type == "misto":
            score = 65
        else:
            score = 40 + len(best_seasons) * 10

        # Rain plan
        rain_friendly = env_type == "interior"

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=round(min(score, 100), 1),
            confidence=0.6,
            data={
                "environment_type": env_type,
                "weather_sensitivity": weather_sensitivity,
                "year_round_accessible": year_round,
                "rain_friendly": rain_friendly,
                "best_seasons": best_seasons if best_seasons else ["todas"],
                "seasonal_scores": seasonal_scores,
            },
            issues=[],
            warnings=["Recomenda-se alternativa indoor em caso de chuva"] if env_type == "exterior" else []
        )


# ==============================================================
# M17 - TIME OF DAY
# ==============================================================
class TimeOfDayRoutingModule(IQModule):
    """M17 - Determines optimal visiting time of day"""

    TIME_PREFERENCES = {
        "manha": {
            "label": "Manhã (8h-12h)",
            "keywords": ["mercado", "padaria", "parque", "trilho", "natureza", "pastelaria", "café"],
            "categories": ["aventura_natureza", "percursos_pedestres", "praias_fluviais"],
        },
        "almoco": {
            "label": "Almoço (12h-14h)",
            "keywords": ["restaurante", "tasca", "taberna", "gastronomia", "mercado"],
            "categories": ["restaurantes_gastronomia", "tabernas_historicas"],
        },
        "tarde": {
            "label": "Tarde (14h-18h)",
            "keywords": ["museu", "castelo", "palácio", "jardim", "loja", "galeria", "monumento"],
            "categories": ["museus", "arte_urbana", "castelos", "arqueologia_geologia"],
        },
        "fim_tarde": {
            "label": "Fim de Tarde (18h-20h)",
            "keywords": ["miradouro", "praia", "jardim", "vista", "panorâmica", "pôr do sol"],
            "categories": ["aventura_natureza", "praias_fluviais", "miradouros"],
        },
        "noite": {
            "label": "Noite (20h+)",
            "keywords": ["restaurante", "bar", "festival", "espetáculo", "noturno", "fado"],
            "categories": ["festas_romarias", "restaurantes_gastronomia"],
        },
    }

    def __init__(self):
        super().__init__(ModuleType.TIME_OF_DAY_ROUTING)

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        text = f"{data.name} {data.description}".lower()
        category = (data.category or "").lower()

        time_scores = {}
        for time_id, config in self.TIME_PREFERENCES.items():
            score = 0
            if category in config["categories"]:
                score += 50
            matches = sum(1 for kw in config["keywords"] if kw in text)
            score += min(matches * 15, 50)
            time_scores[time_id] = min(score, 100)

        # Best time
        best_time = max(time_scores, key=time_scores.get)
        best_score = time_scores[best_time]

        suitable_times = [t for t, s in time_scores.items() if s >= 30]
        if not suitable_times:
            suitable_times = ["manha", "tarde"]  # Default

        # Flexibility score
        flexibility = len(suitable_times) / len(self.TIME_PREFERENCES)
        overall = best_score * 0.6 + flexibility * 40

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=round(min(overall, 100), 1),
            confidence=0.6,
            data={
                "best_time": best_time,
                "best_time_label": self.TIME_PREFERENCES[best_time]["label"],
                "best_time_score": round(best_score, 1),
                "suitable_times": suitable_times,
                "time_flexibility": round(flexibility * 100, 1),
                "all_times": time_scores,
            },
            issues=[],
            warnings=[]
        )


# ==============================================================
# M18 - MULTI-DAY SUITABILITY
# ==============================================================
class MultiDayRoutingModule(IQModule):
    """M18 - Evaluates POI's suitability for multi-day itineraries"""

    # Must-see POIs score higher in multi-day planning
    MUST_SEE_KEYWORDS = ["patrimonio", "mundial", "unesco", "nacional", "principal", "emblemático",
                         "famoso", "imperdível", "destaque", "único", "icónico", "histórico"]

    def __init__(self):
        super().__init__(ModuleType.MULTI_DAY_ROUTING)

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        text = f"{data.name} {data.description}".lower()
        coords = _get_coords(data)

        # Must-see score
        must_see_matches = sum(1 for kw in self.MUST_SEE_KEYWORDS if kw in text)
        must_see_score = min(must_see_matches * 15, 60)

        # Description richness (rich POIs are more important)
        desc_len = len(data.description or "")
        richness_score = min(desc_len / 10, 20)

        # Geographic position (having coords is essential for multi-day planning)
        geo_score = 20 if coords else 0

        # Priority level
        total = must_see_score + richness_score + geo_score
        if total >= 70:
            priority = "alta"
            day_position = "destaque_do_dia"
        elif total >= 40:
            priority = "média"
            day_position = "complementar"
        else:
            priority = "baixa"
            day_position = "opcional"

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=round(min(total, 100), 1),
            confidence=0.65,
            data={
                "priority_level": priority,
                "day_position": day_position,
                "must_see_score": round(must_see_score, 1),
                "richness_score": round(richness_score, 1),
                "has_coordinates": coords is not None,
                "suggested_day_allocation": "manhã" if must_see_score >= 40 else "flexível",
                "region": data.region or "desconhecida",
            },
            issues=[] if coords else ["Sem coordenadas GPS - essencial para planeamento multi-dia"],
            warnings=[]
        )


# ==============================================================
# M19 - ROUTE OPTIMIZER (Connectivity Analysis)
# ==============================================================
class RouteOptimizerModule(IQModule):
    """M19 - Analyzes route connectivity and optimization potential"""

    # Reference points for major Portuguese cities (lat, lng)
    CITY_CENTERS = {
        "braga": (41.5503, -8.4229),
        "porto": (41.1496, -8.6109),
        "lisboa": (38.7223, -9.1393),
        "coimbra": (40.2033, -8.4103),
        "evora": (38.5711, -7.9093),
        "faro": (37.0194, -7.9322),
        "aveiro": (40.6405, -8.6538),
        "viseu": (40.6566, -7.9125),
        "guimaraes": (41.4425, -8.2918),
        "leiria": (39.7437, -8.8071),
    }

    def __init__(self):
        super().__init__(ModuleType.ROUTE_OPTIMIZER)
        self.nearby_pois: List[POIProcessingData] = []

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        coords = _get_coords(data)
        context: Optional[RouteContextProfile] = data.route_context

        if not coords:
            return ProcessingResult(
                module=self.module_type,
                status=ProcessingStatus.COMPLETED,
                score=20.0,
                confidence=0.3,
                data={
                    "has_coordinates": False,
                    "connectivity_score": 0,
                    "nearest_city": None,
                },
                issues=["Sem coordenadas GPS - impossível calcular conectividade"],
                warnings=[]
            )

        lat, lng = coords

        # Find nearest city center
        nearest_city = None
        nearest_dist = float("inf")
        city_distances = {}

        for city, (clat, clng) in self.CITY_CENTERS.items():
            dist = _haversine_km(lat, lng, clat, clng)
            city_distances[city] = round(dist, 1)
            if dist < nearest_dist:
                nearest_dist = dist
                nearest_city = city

        sorted_cities = sorted(city_distances.items(), key=lambda x: x[1])[:3]

        if nearest_dist <= 5:
            proximity_score = 40
            accessibility = "urbano"
        elif nearest_dist <= 15:
            proximity_score = 30
            accessibility = "suburbano"
        elif nearest_dist <= 30:
            proximity_score = 20
            accessibility = "periurbano"
        else:
            proximity_score = 10
            accessibility = "rural"

        nearby_count = 0
        for poi in self.nearby_pois:
            poi_coords = _get_coords(poi)
            if poi_coords:
                dist = _haversine_km(lat, lng, poi_coords[0], poi_coords[1])
                if dist <= 5:
                    nearby_count += 1

        cluster_score = min(nearby_count * 10, 30)
        route_potential = proximity_score + cluster_score + 20

        # Walkability
        if nearest_dist <= 2:
            walkable = True
            transport = "a pé"
        elif nearest_dist <= 10:
            walkable = False
            transport = "transporte público/carro"
        else:
            walkable = False
            transport = "carro necessário"

        # Transport mode context override
        if context and context.transport_mode == "pe" and not walkable:
            route_potential = max(0, route_potential - 20)

        # ── Solar orientation (v2) ─────────────────────────────────────────────
        solar_info = self._solar_orientation(lat, lng, context)

        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=round(min(route_potential, 100), 1),
            confidence=0.75,
            data={
                "has_coordinates": True,
                "lat": lat,
                "lng": lng,
                "nearest_city": nearest_city,
                "nearest_city_distance_km": round(nearest_dist, 1),
                "accessibility_type": accessibility,
                "nearby_pois_5km": nearby_count,
                "cluster_score": cluster_score,
                "walkable_from_center": walkable,
                "transport_recommendation": transport,
                "closest_cities": dict(sorted_cities),
                "solar": solar_info,             # v2
            },
            issues=[],
            warnings=[]
        )

    def _solar_orientation(
        self,
        lat: float,
        lng: float,
        context: Optional[RouteContextProfile],
    ) -> dict:
        """
        Simple solar orientation helper.
        For outdoor POIs (miradouros, praias, trilhos):
          - morning sun faces east → good for east-facing viewpoints in the morning
          - golden hour (sunset) → west-facing

        Returns advisory dict without blocking score; consumed by route planner
        for scheduling.
        """
        hour = context.hour_of_day if context and context.hour_of_day is not None else None
        month = context.current_month if context and context.current_month else datetime.now(timezone.utc).month

        # Portugal is in the northern hemisphere → sun travels east→south→west
        # Simplified: for west-facing sites, recommend fim_tarde/pôr do sol
        # For east-facing, recommend manhã

        # Sun azimuth heuristic based on time of day
        if hour is None:
            sun_direction = "unknown"
            advisory = "Hora não especificada - verificar orientação solar no local"
        elif 6 <= hour < 10:
            sun_direction = "este"
            advisory = "Sol a nascer — bom para miradouros virados a este ou norte"
        elif 10 <= hour < 14:
            sun_direction = "sul"
            advisory = "Sol alto a sul — sombra curta; bom para trilhos"
        elif 14 <= hour < 18:
            sun_direction = "oeste-sul"
            advisory = "Sol descendo — bom para fotografia de paisagem"
        elif 18 <= hour <= 21:
            sun_direction = "oeste"
            advisory = "Hora dourada / pôr do sol — ideal para miradouros e praias"
        else:
            sun_direction = "noite"
            advisory = "Fora de horas de luz solar"

        # Summer days are longer in Portugal
        golden_hour_start = 20 if month in [6, 7, 8] else (18 if month in [4, 5, 9, 10] else 17)

        return {
            "current_sun_direction": sun_direction,
            "advisory": advisory,
            "golden_hour_start_local": f"{golden_hour_start}:00",
            "hemisphere": "north",
        }
