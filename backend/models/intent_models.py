"""
Intent-Based Navigation Models
Sistema de navegação por intenção do utilizador
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid


# ========================
# ENUMS - User Journey Phases
# ========================

class JourneyPhase(str, Enum):
    """Fases da jornada do utilizador"""
    DREAM = "dream"           # Sonho e inspiração -> Tab Descobrir
    RESEARCH = "research"     # Pesquisa e decisão -> Tab Explorar
    EXPERIENCE = "experience" # Vivência imediata -> Tab Experienciar
    PLAN = "plan"            # Planificação detalhada -> Tab Planear
    REFLECT = "reflect"      # Gestão de identidade -> Tab Perfil


class TravelerProfile(str, Enum):
    """12 Tipologias de Viajante"""
    EXPLORER = "explorer"           # Explorador aventureiro
    CULTURE_SEEKER = "culture_seeker"  # Amante da cultura
    GASTRONOME = "gastronome"       # Gastrónomo
    NATURE_LOVER = "nature_lover"   # Amante da natureza
    WELLNESS_SEEKER = "wellness_seeker"  # Buscador de bem-estar
    FAMILY_TRAVELER = "family_traveler"  # Viajante familiar
    ROMANTIC = "romantic"           # Romântico
    PHOTOGRAPHER = "photographer"   # Fotógrafo
    HISTORIAN = "historian"         # Historiador
    SPIRITUAL = "spiritual"         # Espiritual/Peregrino
    ADVENTURE_SEEKER = "adventure_seeker"  # Buscador de aventura
    LOCAL_EXPLORER = "local_explorer"  # Explorador local


class ThematicAxis(str, Enum):
    """Eixos Temáticos Verticais (5-7 Categorias)"""
    NATURE_ADVENTURE = "nature_adventure"    # Natureza & Aventura
    CULTURE_HERITAGE = "culture_heritage"    # Cultura & Património
    GASTRONOMY_WINES = "gastronomy_wines"    # Gastronomia & Vinhos
    WELLNESS_THERMAL = "wellness_thermal"    # Bem-Estar & Termalismo
    URBAN_SHOPPING = "urban_shopping"        # Urbano & Compras
    COASTAL_NAUTICAL = "coastal_nautical"    # Litoral & Náutica
    RELIGIOUS = "religious"                  # Turismo Religioso


class Region(str, Enum):
    """Eixos Geográficos Horizontais (7 Regiões)"""
    NORTE = "norte"
    CENTRO = "centro"
    LISBOA = "lisboa"
    ALENTEJO = "alentejo"
    ALGARVE = "algarve"
    ACORES = "acores"
    MADEIRA = "madeira"


# ========================
# USER PREFERENCES MODEL
# ========================

class UserPreferences(BaseModel):
    """Preferências expandidas do utilizador"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str

    # Perfis de Viajante (pode ter múltiplos com pesos)
    traveler_profiles: Dict[str, float] = {}  # profile -> weight (0-1)
    primary_profile: Optional[TravelerProfile] = None

    # Preferências Temáticas
    favorite_themes: List[ThematicAxis] = []
    avoided_themes: List[ThematicAxis] = []

    # Preferências Geográficas
    favorite_regions: List[Region] = []
    home_region: Optional[Region] = None

    # Preferências de Experiência
    preferred_pace: str = "moderate"  # slow, moderate, fast
    budget_level: str = "medium"  # budget, medium, premium, luxury
    accessibility_needs: List[str] = []

    # Preferências de Mobilidade
    has_car: bool = True
    preferred_transport: List[str] = ["car", "train", "bus"]
    max_walking_distance_km: float = 5.0

    # Preferências de Grupo
    typical_group_size: int = 2
    traveling_with_children: bool = False
    traveling_with_pets: bool = False
    traveling_with_elderly: bool = False

    # Interesses Específicos
    dietary_restrictions: List[str] = []  # vegetarian, vegan, gluten-free
    interests: List[str] = []  # wine, history, photography, hiking

    # Configurações de Notificação
    notifications_enabled: bool = True
    geofence_alerts: bool = True
    event_reminders: bool = True

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    onboarding_completed: bool = False


# ========================
# RECOMMENDATION MODELS
# ========================

class RecommendationSource(str, Enum):
    """Fonte da recomendação (Sistema Híbrido)"""
    ALGORITHM = "algorithm"      # 40-50% - Personalização algorítmica
    EDITORIAL = "editorial"      # 30-35% - Curadoria editorial
    COMMUNITY = "community"      # 15-25% - Descoberta comunitária


class Recommendation(BaseModel):
    """Modelo de Recomendação Híbrida"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Conteúdo recomendado
    content_type: str  # heritage_item, route, event, experience
    content_id: str
    content_name: str
    content_description: str
    content_image: Optional[str] = None

    # Fonte e Peso
    source: RecommendationSource
    source_weight: float  # Peso da fonte no cálculo final

    # Scores
    relevance_score: float = 0.0  # 0-1, calculado pelo algoritmo
    editorial_score: float = 0.0  # 0-1, definido por editores
    community_score: float = 0.0  # 0-1, baseado em interações
    final_score: float = 0.0  # Combinação ponderada

    # Contexto
    context_reason: str  # "Based on your interest in...", "Popular in your region..."
    journey_phase: JourneyPhase
    thematic_axis: Optional[ThematicAxis] = None
    region: Optional[Region] = None

    # Temporalidade
    is_seasonal: bool = False
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None

    # Engagement
    impressions: int = 0
    clicks: int = 0
    saves: int = 0

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None  # user_id for editorial


class EditorialCuration(BaseModel):
    """Curadoria Editorial"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    title: str
    description: str
    curator_id: str  # Editor/Curator user_id
    curator_name: str
    curator_role: str  # "local_journalist", "travel_blogger", "professional_guide"

    # Conteúdos curados
    items: List[str] = []  # content_ids

    # Contexto
    theme: Optional[ThematicAxis] = None
    region: Optional[Region] = None
    season: Optional[str] = None  # spring, summer, autumn, winter

    # Status
    status: str = "draft"  # draft, pending_review, published, archived
    featured: bool = False
    priority: int = 0  # Higher = more prominent

    # Engagement
    views: int = 0
    likes: int = 0
    shares: int = 0

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    published_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class CommunityDiscovery(BaseModel):
    """Descoberta Comunitária"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    content_type: str
    content_id: str

    # Métricas de Descoberta
    discovery_velocity: float = 0.0  # Taxa de crescimento de interesse
    trending_score: float = 0.0
    novelty_score: float = 0.0  # Quão novo é para o utilizador

    # Validação Social
    verified_visits: int = 0
    user_ratings: List[float] = []
    average_rating: float = 0.0
    review_count: int = 0

    # Sinais de Comportamento
    time_spent_avg: float = 0.0  # Tempo médio de visualização
    save_rate: float = 0.0
    share_rate: float = 0.0
    return_rate: float = 0.0  # Quantos voltam a ver

    # Metadata
    first_discovered: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_interaction: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ========================
# DISCOVERY FEED MODELS (Tab Descobrir)
# ========================

class DiscoverySection(str, Enum):
    """Secções do Feed Descobrir"""
    FOR_YOU = "for_you"          # Personalização algorítmica
    NOW = "now"                  # Temporalidade imediata
    NEARBY = "nearby"            # Geolocalização
    TRENDING = "trending"        # Popularidade emergente
    SEASONAL = "seasonal"        # Conteúdo sazonal
    EDITORIAL_PICKS = "editorial_picks"  # Escolhas da curadoria


class DiscoveryFeedItem(BaseModel):
    """Item do Feed de Descoberta"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    section: DiscoverySection
    content_type: str
    content_id: str
    content_data: Dict[str, Any]  # Dados completos do conteúdo

    # Posicionamento
    position: int
    section_position: int

    # Scores
    relevance_score: float = 0.0

    # Contexto
    reason: str  # "Because you liked...", "Popular now..."

    # Metadata
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None


# ========================
# EXPERIENCE MODELS (Tab Experienciar)
# ========================

class CalendarEvent(BaseModel):
    """Evento no Calendário do Utilizador"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str

    # Tipo de Evento
    event_type: str  # visit, reservation, festival, reminder

    # Conteúdo Relacionado
    content_type: Optional[str] = None
    content_id: Optional[str] = None
    content_name: str

    # Temporal
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    all_day: bool = False

    # Localização
    location_name: Optional[str] = None
    location_coords: Optional[Dict[str, float]] = None

    # Reserva (se aplicável)
    reservation_id: Optional[str] = None
    reservation_status: Optional[str] = None  # pending, confirmed, cancelled

    # Notificações
    reminder_minutes: List[int] = [60, 1440]  # 1h e 1 dia antes

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notes: str = ""


class ProactiveSuggestion(BaseModel):
    """Sugestão Proativa (IA Contextual)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str

    # Tipo de Sugestão
    suggestion_type: str  # fill_gap, optimize_route, nearby_opportunity

    # Contexto Temporal
    target_date: datetime
    time_slot_start: Optional[datetime] = None
    time_slot_end: Optional[datetime] = None

    # Conteúdo Sugerido
    suggested_items: List[Dict[str, Any]] = []

    # Razão
    reason: str
    confidence_score: float = 0.0

    # Status
    status: str = "pending"  # pending, accepted, dismissed

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ========================
# PLANNING MODELS (Tab Planear)
# ========================

class ItineraryItem(BaseModel):
    """Item de Itinerário"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Conteúdo
    content_type: str  # heritage_item, route, accommodation, restaurant
    content_id: str
    content_name: str
    content_data: Dict[str, Any] = {}

    # Temporal
    day_number: int
    order_in_day: int
    start_time: Optional[str] = None  # "09:00"
    duration_minutes: Optional[int] = None

    # Localização
    location: Optional[Dict[str, float]] = None

    # Custos
    estimated_cost: float = 0.0
    currency: str = "EUR"

    # Transporte para próximo item
    transport_to_next: Optional[str] = None  # car, train, walk
    transport_duration_minutes: Optional[int] = None

    # Notas
    notes: str = ""


class Itinerary(BaseModel):
    """Itinerário Completo"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str

    # Informações Básicas
    name: str
    description: str = ""

    # Datas
    start_date: datetime
    end_date: datetime
    total_days: int

    # Itens
    items: List[ItineraryItem] = []

    # Custos
    total_estimated_cost: float = 0.0
    budget_limit: Optional[float] = None

    # Regiões
    regions: List[Region] = []

    # Status
    status: str = "draft"  # draft, planned, in_progress, completed
    is_public: bool = False

    # Partilha
    shared_with: List[str] = []  # user_ids

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ========================
# REAL-TIME CONTEXT MODELS
# ========================

class RealTimeContext(BaseModel):
    """Contexto em Tempo Real para Filtros Transversais"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Localização do pedido
    location: Dict[str, float]  # lat, lng
    timestamp: datetime

    # Dados de Marés (se aplicável)
    tide_data: Optional[Dict[str, Any]] = None
    # {
    #   "high_tide_time": "14:30",
    #   "low_tide_time": "08:45",
    #   "current_level": "rising",
    #   "next_high_tide_hours": 3.5
    # }

    # Dados de Ondas (se aplicável)
    wave_data: Optional[Dict[str, Any]] = None
    # {
    #   "height_m": 1.5,
    #   "period_s": 12,
    #   "direction": "NW",
    #   "quality": "good"
    # }

    # Ocupação Estimada
    occupancy_data: Optional[Dict[str, Any]] = None
    # {
    #   "level": "moderate",
    #   "percentage": 45,
    #   "trend": "increasing",
    #   "best_time_today": "09:00-11:00"
    # }

    # Transporte Disponível
    transport_data: Optional[Dict[str, Any]] = None
    # {
    #   "nearest_station": "Estação X",
    #   "distance_km": 2.3,
    #   "next_departure": "15:45",
    #   "available_modes": ["train", "bus"]
    # }

    # Meteorologia
    weather_data: Optional[Dict[str, Any]] = None

    # Cache TTL
    valid_until: datetime


# ========================
# THEMATIC MATRIX MODELS (Tab Explorar)
# ========================

class MatrixCell(BaseModel):
    """Célula da Matriz Temática × Geográfica"""
    theme: ThematicAxis
    region: Region

    # Contagem de Conteúdos
    total_items: int = 0
    featured_items: List[str] = []  # Top 3 content_ids

    # Scores
    popularity_score: float = 0.0
    quality_score: float = 0.0
    novelty_score: float = 0.0

    # Metadata
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ThematicMatrix(BaseModel):
    """Matriz Completa de Exploração"""
    cells: List[MatrixCell] = []

    # Totais por Eixo
    totals_by_theme: Dict[str, int] = {}
    totals_by_region: Dict[str, int] = {}

    # Destaques
    featured_combinations: List[Dict[str, Any]] = []

    # Metadata
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    valid_until: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=1))
