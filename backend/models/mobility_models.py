"""
Mobility Data Models
Modelos para integração com APIs de Mobilidade portuguesas
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from enum import Enum
import uuid


# ========================
# TRANSPORT TYPES
# ========================

class TransportMode(str, Enum):
    """Modos de Transporte"""
    TRAIN = "train"           # CP Comboios
    METRO = "metro"           # Metro Lisboa/Porto
    BUS = "bus"               # Carris Metropolitana, outros
    FERRY = "ferry"           # Transtejo, Soflusa
    TRAM = "tram"             # Elétricos de Lisboa
    BIKE = "bike"             # Bicicletas partilhadas
    SCOOTER = "scooter"       # Trotinetes elétricas
    WALKING = "walking"       # A pé
    CAR = "car"               # Carro
    RIDESHARE = "rideshare"   # Uber, Bolt


class TransportOperator(str, Enum):
    """Operadores de Transporte"""
    # Comboios
    CP = "cp"  # Comboios de Portugal

    # Metro
    METRO_LISBOA = "metro_lisboa"
    METRO_PORTO = "metro_porto"

    # Autocarros
    CARRIS_METROPOLITANA = "carris_metropolitana"  # AML (área metropolitana Lisboa)
    CARRIS = "carris"  # Lisboa cidade
    STCP = "stcp"  # Porto

    # Ferries
    TRANSTEJO = "transtejo"
    SOFLUSA = "soflusa"

    # Outros
    GIRA = "gira"  # Bicicletas Lisboa
    BOLT = "bolt"
    UBER = "uber"


# ========================
# STOP/STATION MODELS
# ========================

class TransportStop(BaseModel):
    """Paragem/Estação de Transporte"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Identificação
    external_id: str  # ID do operador
    operator: TransportOperator
    name: str

    # Localização
    lat: float
    lng: float

    # Tipo
    transport_modes: List[TransportMode] = []

    # Informação Adicional
    accessibility: Dict[str, bool] = {}  # wheelchair, elevator, tactile
    facilities: List[str] = []  # wc, cafe, parking

    # Linhas que servem esta paragem
    lines: List[str] = []

    # Metadata
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StopDeparture(BaseModel):
    """Partida de uma Paragem"""
    stop_id: str
    line_id: str
    line_name: str

    destination: str

    # Horários
    scheduled_time: datetime
    estimated_time: Optional[datetime] = None  # Tempo real estimado

    # Status
    is_realtime: bool = False
    delay_minutes: int = 0
    status: str = "on_time"  # on_time, delayed, cancelled

    # Veículo
    vehicle_id: Optional[str] = None
    vehicle_occupancy: Optional[str] = None  # empty, low, medium, high, full


# ========================
# ROUTE/LINE MODELS
# ========================

class TransportLine(BaseModel):
    """Linha de Transporte"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Identificação
    external_id: str
    operator: TransportOperator
    mode: TransportMode

    # Nome e cor
    short_name: str  # "1", "A", "15E"
    long_name: str  # "Linha Azul", "Elétrico 15"
    color: str = "#000000"

    # Trajeto
    origin: str
    destination: str
    stops: List[str] = []  # stop_ids ordenados

    # Horários
    frequency_minutes: Optional[int] = None  # Frequência média
    first_departure: Optional[str] = None  # "05:30"
    last_departure: Optional[str] = None  # "00:30"

    # GTFS
    gtfs_route_id: Optional[str] = None
    shape_polyline: Optional[str] = None  # Encoded polyline

    # Metadata
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ========================
# VEHICLE MODELS
# ========================

class VehiclePosition(BaseModel):
    """Posição de Veículo em Tempo Real"""
    vehicle_id: str
    operator: TransportOperator

    # Posição
    lat: float
    lng: float
    bearing: Optional[float] = None  # Direção em graus
    speed_kmh: Optional[float] = None

    # Viagem atual
    line_id: Optional[str] = None
    trip_id: Optional[str] = None
    current_stop_id: Optional[str] = None
    next_stop_id: Optional[str] = None

    # Status
    occupancy: Optional[str] = None
    status: str = "in_service"  # in_service, not_in_service

    # Timestamp
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ========================
# JOURNEY PLANNING
# ========================

class JourneyLeg(BaseModel):
    """Segmento de uma Viagem"""
    mode: TransportMode
    operator: Optional[TransportOperator] = None
    line_id: Optional[str] = None
    line_name: Optional[str] = None

    # Origem
    origin_name: str
    origin_coords: Dict[str, float]
    origin_stop_id: Optional[str] = None

    # Destino
    destination_name: str
    destination_coords: Dict[str, float]
    destination_stop_id: Optional[str] = None

    # Horários
    departure_time: datetime
    arrival_time: datetime
    duration_minutes: int

    # Distância
    distance_meters: int

    # Instruções
    instructions: str = ""

    # Paragens intermédias
    intermediate_stops: List[str] = []


class JourneyPlan(BaseModel):
    """Plano de Viagem Multimodal"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    # Origem e Destino
    origin: Dict[str, Any]  # name, coords
    destination: Dict[str, Any]

    # Horários
    departure_time: datetime
    arrival_time: datetime
    total_duration_minutes: int

    # Segmentos
    legs: List[JourneyLeg] = []

    # Totais
    total_distance_meters: int = 0
    total_walking_meters: int = 0
    num_transfers: int = 0

    # Custo
    estimated_cost_eur: float = 0.0

    # Alternativas
    is_fastest: bool = False
    is_cheapest: bool = False
    is_least_walking: bool = False

    # Metadata
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ========================
# MARITIME DATA (Instituto Hidrográfico)
# ========================

class TideStation(BaseModel):
    """Estação Maregráfica"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    name: str
    code: str  # Código IH

    lat: float
    lng: float

    # Porto de referência
    reference_port: Optional[str] = None
    timezone: str = "Europe/Lisbon"

    # Metadata
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TidePrediction(BaseModel):
    """Previsão de Maré"""
    station_id: str
    station_name: str

    # Tipo
    tide_type: str  # high, low

    # Horário e Altura
    datetime: datetime
    height_meters: float

    # Coeficiente
    coefficient: Optional[int] = None  # 20-120, maior = maior amplitude

    # Fase da Lua
    moon_phase: Optional[str] = None


class TideConditions(BaseModel):
    """Condições de Maré Atuais"""
    station_id: str
    station_name: str

    # Estado atual
    current_height_meters: float
    current_state: str  # rising, falling, high, low

    # Próximas marés
    next_high_tide: Optional[TidePrediction] = None
    next_low_tide: Optional[TidePrediction] = None

    # Informação adicional
    tidal_range_today: float  # Amplitude do dia
    spring_or_neap: Optional[str] = None  # spring (viva), neap (morta)

    # Timestamp
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ========================
# WAVE DATA
# ========================

class WaveStation(BaseModel):
    """Boia de Ondulação"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    name: str
    code: str

    lat: float
    lng: float

    # Tipo
    station_type: str  # buoy, coastal

    # Metadata
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WaveConditions(BaseModel):
    """Condições de Ondulação"""
    station_id: str
    station_name: str

    # Ondulação
    wave_height_meters: float
    wave_period_seconds: float
    wave_direction_degrees: float  # De onde vêm as ondas
    wave_direction_cardinal: str  # N, NE, E, etc.

    # Vento
    wind_speed_kmh: Optional[float] = None
    wind_direction: Optional[str] = None

    # Qualidade para surf
    surf_quality: Optional[str] = None  # flat, poor, fair, good, excellent

    # Temperatura
    water_temp_celsius: Optional[float] = None

    # Timestamp
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ========================
# OCCUPANCY/CROWD DATA
# ========================

class OccupancyLevel(str, Enum):
    """Níveis de Ocupação"""
    EMPTY = "empty"       # < 10%
    LOW = "low"           # 10-30%
    MODERATE = "moderate" # 30-60%
    HIGH = "high"         # 60-85%
    VERY_HIGH = "very_high"  # 85-95%
    FULL = "full"         # > 95%


class LocationOccupancy(BaseModel):
    """Ocupação de um Local"""
    location_id: str
    location_name: str
    location_type: str  # beach, monument, restaurant, etc.

    # Nível atual
    current_level: OccupancyLevel
    current_percentage: int  # 0-100

    # Tendência
    trend: str  # increasing, stable, decreasing

    # Previsão
    predicted_peak_time: Optional[str] = None  # "15:00"
    predicted_best_time: Optional[str] = None  # "09:00-11:00"

    # Histórico
    typical_weekday: Dict[str, int] = {}  # hora -> percentagem típica
    typical_weekend: Dict[str, int] = {}

    # Fontes
    data_sources: List[str] = []  # google_popular_times, sensors, social_signals
    confidence: float = 0.0  # 0-1

    # Timestamp
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ========================
# SMART CITY DATA
# ========================

class SmartCityDataType(str, Enum):
    """Tipos de Dados de Cidade Inteligente"""
    PARKING = "parking"           # Estacionamento
    BIKE_SHARING = "bike_sharing" # Bicicletas partilhadas
    EV_CHARGING = "ev_charging"   # Carregadores elétricos
    WIFI_HOTSPOT = "wifi_hotspot" # WiFi público
    AIR_QUALITY = "air_quality"   # Qualidade do ar
    NOISE_LEVEL = "noise_level"   # Nível de ruído


class ParkingLot(BaseModel):
    """Parque de Estacionamento"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    name: str
    address: str

    lat: float
    lng: float

    # Capacidade
    total_spaces: int
    available_spaces: int

    # Tipo
    parking_type: str  # surface, underground, multi_storey
    is_covered: bool = False

    # Preços
    hourly_rate_eur: Optional[float] = None
    daily_max_eur: Optional[float] = None

    # Horário
    opening_hours: str = "24h"

    # Serviços
    has_ev_charging: bool = False
    has_disabled_spaces: bool = True

    # Status
    status: str = "open"  # open, closed, full

    # Timestamp
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BikeStation(BaseModel):
    """Estação de Bicicletas Partilhadas"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    operator: str  # GIRA, etc.
    name: str

    lat: float
    lng: float

    # Disponibilidade
    total_docks: int
    available_bikes: int
    available_docks: int

    # Tipos de bicicleta
    standard_bikes: int = 0
    electric_bikes: int = 0

    # Status
    status: str = "active"  # active, inactive, maintenance

    # Timestamp
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EVChargingStation(BaseModel):
    """Posto de Carregamento Elétrico"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    operator: str  # Mobi.e, Tesla, etc.
    name: str
    address: str

    lat: float
    lng: float

    # Pontos de carregamento
    total_points: int
    available_points: int

    # Tipos de fichas
    connector_types: List[str] = []  # type2, ccs, chademo
    max_power_kw: float = 0.0

    # Preço
    price_per_kwh: Optional[float] = None

    # Status
    status: str = "operational"

    # Timestamp
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ========================
# AGGREGATED MOBILITY DATA
# ========================

class MobilitySnapshot(BaseModel):
    """Snapshot de Mobilidade para uma Localização"""
    location: Dict[str, float]  # lat, lng
    radius_km: float

    # Transportes Próximos
    nearby_stops: List[TransportStop] = []
    next_departures: List[StopDeparture] = []

    # Marés (se costeiro)
    tide_conditions: Optional[TideConditions] = None

    # Ondas (se costeiro)
    wave_conditions: Optional[WaveConditions] = None

    # Ocupação
    occupancy: Optional[LocationOccupancy] = None

    # Smart City
    nearby_parking: List[ParkingLot] = []
    nearby_bikes: List[BikeStation] = []
    nearby_ev_charging: List[EVChargingStation] = []

    # Resumo
    transport_summary: str = ""  # "Metro a 500m, autocarro a 200m"
    accessibility_summary: str = ""

    # Metadata
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    valid_until: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
