"""
Pydantic models extracted from server.py - shared across all API modules.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import re


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime
    favorites: List[str] = []


class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime


class SessionDataResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str


class Location(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class AccessibilityInfo(BaseModel):
    """Informacoes de acessibilidade para turismo inclusivo"""
    wheelchair_accessible: bool = False
    reduced_mobility: bool = False
    visual_impairment: bool = False
    hearing_impairment: bool = False
    pet_friendly: bool = False
    child_friendly: bool = False
    senior_friendly: bool = False
    parking_available: bool = False
    public_transport: bool = False
    toilet_accessible: bool = False
    braille_available: bool = False
    sign_language: bool = False
    notes: Optional[str] = None


class HeritageItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    category: str
    subcategory: Optional[str] = None
    region: str
    # CAOP administrative hierarchy (DGT / GeoAPI.pt)
    distrito: Optional[str] = None    # e.g. "Braga"
    concelho: Optional[str] = None    # e.g. "Guimarães"
    freguesia: Optional[str] = None   # e.g. "Oliveira, São Paio e São Sebastião"
    nuts_iii: Optional[str] = None    # e.g. "Ave"
    codigo_postal: Optional[str] = None
    # CAOP stable codes (set by geo_validator after point-in-polygon check)
    freguesia_code: Optional[str] = None   # DTMNFR — 6-digit INE parish code
    concelho_code: Optional[str] = None    # 4-digit INE municipality code
    distrito_code: Optional[str] = None    # 2-digit INE district code
    nuts3_code: Optional[str] = None       # e.g. "PT112"
    nuts2_code: Optional[str] = None       # e.g. "PT11"
    nuts1_code: Optional[str] = None       # "PT1" | "PT2" | "PT3"
    caop_validated: bool = False
    caop_validated_at: Optional[datetime] = None
    protected_area: List[str] = []         # e.g. ["Rede Natura 2000", "PNPG"]
    habitat_type: List[str] = []
    location: Optional[Location] = None
    address: Optional[str] = None
    image_url: Optional[str] = None
    tags: List[str] = []
    related_items: List[str] = []
    metadata: Optional[Dict[str, Any]] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HeritageItemCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=300)
    description: str = Field(..., min_length=10, max_length=10000)
    category: str = Field(..., min_length=1, max_length=50)
    subcategory: Optional[str] = Field(None, max_length=50)
    region: str = Field(..., min_length=1, max_length=50)
    location: Optional[Location] = None
    address: Optional[str] = Field(None, max_length=500)
    image_url: Optional[str] = Field(None, max_length=2000)
    tags: List[str] = Field(default=[], max_length=30)
    related_items: List[str] = Field(default=[], max_length=50)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r'^https?://', v):
            raise ValueError("image_url must be a valid HTTP(S) URL")
        return v

    @field_validator("category")
    @classmethod
    def normalize_category(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("region")
    @classmethod
    def normalize_region(cls, v: str) -> str:
        return v.strip().lower()


class RouteItem(BaseModel):
    """Item within a route - can be a string ID or an object with details"""
    id: str
    name: Optional[str] = None
    category: Optional[str] = None
    region: Optional[str] = None


class Route(BaseModel):
    model_config = {"extra": "ignore"}

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    category: Optional[str] = None
    theme: Optional[str] = None
    region: Optional[str] = None
    items: List[Any] = Field(default_factory=list, max_length=500)
    duration_hours: Optional[float] = None
    duration_days: Optional[int] = None
    distance_km: Optional[float] = None
    difficulty: Optional[str] = None
    icon: Optional[str] = None
    tags: List[str] = []
    image_url: Optional[str] = None
    external_url: Optional[str] = None
    highlights: List[str] = []
    subtitle: Optional[str] = None
    best_season: Optional[str] = None
    audience: List[str] = []
    rating: Optional[float] = None
    created_at: Optional[datetime] = Field(default_factory=lambda: datetime.now(timezone.utc))


class RouteCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=300)
    description: str = Field(..., min_length=10, max_length=5000)
    category: str = Field(..., max_length=50)
    region: Optional[str] = Field(None, max_length=50)
    items: List[str] = Field(default=[], max_length=100)
    duration_hours: Optional[float] = Field(None, ge=0, le=168)
    distance_km: Optional[float] = Field(None, ge=0, le=5000)
    difficulty: Optional[str] = Field(None, max_length=30)
    tags: List[str] = Field(default=[], max_length=30)


class UserContribution(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    heritage_item_id: Optional[str] = None
    type: str
    content: str
    status: str = 'pending'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NarrativeRequest(BaseModel):
    item_id: str = Field(..., max_length=100)
    style: str = Field("storytelling", max_length=30)


class RoutePlanRequest(BaseModel):
    origin: str = Field(..., min_length=2, max_length=200)
    destination: str = Field(..., min_length=2, max_length=200)
    origin_coords: Optional[Location] = None
    destination_coords: Optional[Location] = None
    categories: List[str] = Field(default=[], max_length=20)
    max_detour_km: float = Field(50, ge=1, le=200)
    max_stops: int = Field(10, ge=1, le=30)
    use_real_directions: bool = True


class RouteStep(BaseModel):
    instruction: str
    distance_km: float
    duration_minutes: float


class RoutePlanResponse(BaseModel):
    origin: str
    destination: str
    total_distance_km: float
    estimated_duration_hours: float
    suggested_stops: List[HeritageItem]
    highlights: List[Dict[str, Any]]
    route_description: str
    polyline: Optional[str] = None
    route_steps: List[RouteStep] = []
    real_route: bool = False
    via_roads: List[str] = []


class NearbyPOIRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_km: float = Field(25, ge=0.1, le=200)
    categories: List[str] = Field(default=[], max_length=20)
    limit: int = Field(20, ge=1, le=200)


class NearbyPOIResponse(BaseModel):
    user_location: Location
    pois: List[Dict[str, Any]]
    total_found: int
    style: str = 'storytelling'
    language: str = 'pt'


class NarrativeResponse(BaseModel):
    narrative: str
    item_name: str
    generated_at: datetime


class EncyclopediaArticle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    slug: str
    universe: str
    summary: str
    content: str
    region: Optional[str] = None
    location: Optional[Location] = None
    image_url: Optional[str] = None
    gallery: List[str] = Field(default_factory=list, max_length=100)
    related_articles: List[str] = Field(default_factory=list, max_length=50)
    related_items: List[str] = Field(default_factory=list, max_length=50)
    tags: List[str] = Field(default_factory=list, max_length=50)
    sources: List[str] = Field(default_factory=list, max_length=50)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    author: Optional[str] = None
    views: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class EncyclopediaArticleCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    slug: str = Field(..., min_length=1, max_length=200)
    universe: str = Field(..., min_length=1, max_length=50)
    summary: str = Field(..., min_length=1, max_length=2000)
    content: str = Field(..., min_length=1)
    region: Optional[str] = Field(None, max_length=50)
    location: Optional[Location] = None
    image_url: Optional[str] = Field(None, max_length=2000)
    gallery: List[str] = Field(default_factory=list, max_length=100)
    related_articles: List[str] = Field(default_factory=list, max_length=50)
    related_items: List[str] = Field(default_factory=list, max_length=50)
    tags: List[str] = Field(default_factory=list, max_length=50)
    sources: List[str] = Field(default_factory=list, max_length=50)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r'^https?://', v):
            raise ValueError("image_url must be a valid HTTP(S) URL")
        return v


class UserBadge(BaseModel):
    badge_id: str
    level: str
    unlocked_at: datetime
    visits_count: int
    points_earned: int
