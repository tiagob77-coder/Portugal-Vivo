from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Keys
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY', '')

# Create the main app
app = FastAPI(title="Património Vivo de Portugal API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ========================
# MODELS
# ========================

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
    lat: float
    lng: float

class HeritageItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    category: str  # One of the 20 layers
    subcategory: Optional[str] = None
    region: str  # NUTS II region
    location: Optional[Location] = None
    address: Optional[str] = None
    image_url: Optional[str] = None
    tags: List[str] = []
    related_items: List[str] = []
    metadata: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HeritageItemCreate(BaseModel):
    name: str
    description: str
    category: str
    subcategory: Optional[str] = None
    region: str
    location: Optional[Location] = None
    address: Optional[str] = None
    image_url: Optional[str] = None
    tags: List[str] = []
    related_items: List[str] = []
    metadata: Dict[str, Any] = {}

class Route(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    category: str  # Type of route (wine, bread, cultural, etc.)
    region: Optional[str] = None
    items: List[str] = []  # Heritage item IDs
    duration_hours: Optional[float] = None
    distance_km: Optional[float] = None
    difficulty: Optional[str] = None
    tags: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RouteCreate(BaseModel):
    name: str
    description: str
    category: str
    region: Optional[str] = None
    items: List[str] = []
    duration_hours: Optional[float] = None
    distance_km: Optional[float] = None
    difficulty: Optional[str] = None
    tags: List[str] = []

class UserContribution(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    heritage_item_id: Optional[str] = None
    type: str  # 'story', 'photo', 'correction', 'new_item'
    content: str
    status: str = 'pending'  # 'pending', 'approved', 'rejected'
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NarrativeRequest(BaseModel):
    item_id: str
    style: str = 'storytelling'  # 'storytelling', 'educational', 'brief'
    language: str = 'pt'

class NarrativeResponse(BaseModel):
    narrative: str
    item_name: str
    generated_at: datetime

# Categories (20 layers)
CATEGORIES = [
    {"id": "lendas", "name": "Lendas & Mitos", "icon": "auto-stories", "color": "#8B5CF6"},
    {"id": "festas", "name": "Festas e Tradições", "icon": "celebration", "color": "#F59E0B"},
    {"id": "saberes", "name": "Saberes & Ofícios", "icon": "construction", "color": "#10B981"},
    {"id": "crencas", "name": "Crenças e Oculto", "icon": "nightlight", "color": "#6366F1"},
    {"id": "gastronomia", "name": "Gastronomia", "icon": "restaurant", "color": "#EF4444"},
    {"id": "produtos", "name": "Produtos DOP/IGP", "icon": "storefront", "color": "#F97316"},
    {"id": "termas", "name": "Termas e Praias", "icon": "pool", "color": "#06B6D4"},
    {"id": "florestas", "name": "Matas e Florestas", "icon": "forest", "color": "#22C55E"},
    {"id": "rios", "name": "Rios e Ribeiras", "icon": "water", "color": "#3B82F6"},
    {"id": "minerais", "name": "Pedras e Minerais", "icon": "hexagon", "color": "#A855F7"},
    {"id": "aldeias", "name": "Aldeias Históricas", "icon": "home-work", "color": "#D97706"},
    {"id": "percursos", "name": "Percursos Pedestres", "icon": "hiking", "color": "#84CC16"},
    {"id": "rotas", "name": "Rotas Temáticas", "icon": "route", "color": "#EC4899"},
    {"id": "piscinas", "name": "Piscinas Naturais", "icon": "waves", "color": "#0EA5E9"},
    {"id": "cogumelos", "name": "Cogumelos", "icon": "eco", "color": "#A3E635"},
    {"id": "arqueologia", "name": "Arqueologia", "icon": "account-balance", "color": "#78716C"},
    {"id": "fauna", "name": "Fauna e Flora", "icon": "pets", "color": "#65A30D"},
    {"id": "arte", "name": "Arte Portuguesa", "icon": "palette", "color": "#E11D48"},
    {"id": "religioso", "name": "Turismo Religioso", "icon": "church", "color": "#7C3AED"},
    {"id": "comunidade", "name": "Narrativas Comunitárias", "icon": "groups", "color": "#14B8A6"},
]

REGIONS = [
    {"id": "norte", "name": "Norte", "color": "#3B82F6"},
    {"id": "centro", "name": "Centro", "color": "#22C55E"},
    {"id": "lisboa", "name": "Lisboa e Vale do Tejo", "color": "#F59E0B"},
    {"id": "alentejo", "name": "Alentejo", "color": "#EF4444"},
    {"id": "algarve", "name": "Algarve", "color": "#06B6D4"},
    {"id": "acores", "name": "Açores", "color": "#8B5CF6"},
    {"id": "madeira", "name": "Madeira", "color": "#EC4899"},
]

# ========================
# AUTH HELPERS
# ========================

async def get_current_user(request: Request) -> Optional[User]:
    """Get current user from session token"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        return None
    
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        return None
    
    # Check expiration with timezone awareness
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        return None
    
    user_doc = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    if user_doc:
        return User(**user_doc)
    return None

async def require_auth(request: Request) -> User:
    """Require authentication"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ========================
# AUTH ENDPOINTS
# ========================

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Exchange with Emergent Auth
    async with httpx.AsyncClient() as http_client:
        try:
            auth_response = await http_client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            user_data = auth_response.json()
        except Exception as e:
            logger.error(f"Auth error: {e}")
            raise HTTPException(status_code=401, detail="Authentication failed")
    
    # Create or get user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing_user = await db.users.find_one(
        {"email": user_data["email"]},
        {"_id": 0}
    )
    
    if existing_user:
        user_id = existing_user["user_id"]
    else:
        await db.users.insert_one({
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "created_at": datetime.now(timezone.utc),
            "favorites": []
        })
    
    # Create session
    session_token = user_data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return User(**user_doc)

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(require_auth)):
    """Get current user"""
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ========================
# HERITAGE ENDPOINTS
# ========================

@api_router.get("/categories")
async def get_categories():
    """Get all heritage categories"""
    return CATEGORIES

@api_router.get("/regions")
async def get_regions():
    """Get all regions"""
    return REGIONS

@api_router.get("/heritage", response_model=List[HeritageItem])
async def get_heritage_items(
    category: Optional[str] = None,
    region: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get heritage items with filters"""
    query = {}
    
    if category:
        query["category"] = category
    if region:
        query["region"] = region
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}}
        ]
    
    items = await db.heritage_items.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    return [HeritageItem(**item) for item in items]

@api_router.get("/heritage/{item_id}", response_model=HeritageItem)
async def get_heritage_item(item_id: str):
    """Get a single heritage item"""
    item = await db.heritage_items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return HeritageItem(**item)

@api_router.get("/heritage/category/{category}", response_model=List[HeritageItem])
async def get_heritage_by_category(category: str, limit: int = 100):
    """Get heritage items by category"""
    items = await db.heritage_items.find({"category": category}, {"_id": 0}).limit(limit).to_list(limit)
    return [HeritageItem(**item) for item in items]

@api_router.get("/heritage/region/{region}", response_model=List[HeritageItem])
async def get_heritage_by_region(region: str, limit: int = 100):
    """Get heritage items by region"""
    items = await db.heritage_items.find({"region": region}, {"_id": 0}).limit(limit).to_list(limit)
    return [HeritageItem(**item) for item in items]

@api_router.get("/map/items")
async def get_map_items(
    categories: Optional[str] = None,
    region: Optional[str] = None
):
    """Get heritage items for map display (only items with location)"""
    query = {"location": {"$ne": None}}
    
    if categories:
        cat_list = categories.split(",")
        query["category"] = {"$in": cat_list}
    if region:
        query["region"] = region
    
    items = await db.heritage_items.find(query, {"_id": 0}).to_list(1000)
    return [HeritageItem(**item) for item in items]

# ========================
# ROUTES ENDPOINTS
# ========================

@api_router.get("/routes", response_model=List[Route])
async def get_routes(
    category: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = 50
):
    """Get thematic routes"""
    query = {}
    if category:
        query["category"] = category
    if region:
        query["region"] = region
    
    routes = await db.routes.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return [Route(**route) for route in routes]

@api_router.get("/routes/{route_id}", response_model=Route)
async def get_route(route_id: str):
    """Get a single route"""
    route = await db.routes.find_one({"id": route_id}, {"_id": 0})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return Route(**route)

@api_router.get("/routes/{route_id}/items", response_model=List[HeritageItem])
async def get_route_items(route_id: str):
    """Get all items in a route"""
    route = await db.routes.find_one({"id": route_id}, {"_id": 0})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    items = await db.heritage_items.find(
        {"id": {"$in": route.get("items", [])}},
        {"_id": 0}
    ).to_list(100)
    return [HeritageItem(**item) for item in items]

# ========================
# USER ENDPOINTS
# ========================

@api_router.get("/favorites", response_model=List[HeritageItem])
async def get_favorites(current_user: User = Depends(require_auth)):
    """Get user's favorite items"""
    items = await db.heritage_items.find(
        {"id": {"$in": current_user.favorites}},
        {"_id": 0}
    ).to_list(100)
    return [HeritageItem(**item) for item in items]

@api_router.post("/favorites/{item_id}")
async def add_favorite(item_id: str, current_user: User = Depends(require_auth)):
    """Add item to favorites"""
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$addToSet": {"favorites": item_id}}
    )
    return {"message": "Added to favorites"}

@api_router.delete("/favorites/{item_id}")
async def remove_favorite(item_id: str, current_user: User = Depends(require_auth)):
    """Remove item from favorites"""
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$pull": {"favorites": item_id}}
    )
    return {"message": "Removed from favorites"}

# ========================
# AI NARRATIVE ENDPOINTS
# ========================

@api_router.post("/narrative", response_model=NarrativeResponse)
async def generate_narrative(request: NarrativeRequest):
    """Generate AI narrative for a heritage item"""
    item = await db.heritage_items.find_one({"id": request.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        style_prompts = {
            "storytelling": "Conta esta história de forma envolvente e mística, como um contador de histórias tradicional português. Usa linguagem poética e evocativa.",
            "educational": "Explica este elemento do património de forma educativa e informativa, incluindo contexto histórico e cultural.",
            "brief": "Resume este elemento do património de forma concisa e clara, destacando os pontos principais."
        }
        
        system_message = f"""És um especialista em património cultural português. 
        A tua tarefa é criar narrativas sobre o património imaterial de Portugal.
        {style_prompts.get(request.style, style_prompts['storytelling'])}
        Responde sempre em português de Portugal."""
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"narrative_{request.item_id}",
            system_message=system_message
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(
            text=f"""Cria uma narrativa sobre: {item['name']}
            
            Descrição: {item['description']}
            Categoria: {item['category']}
            Região: {item['region']}
            
            Informações adicionais: {item.get('metadata', {})}"""
        )
        
        response = await chat.send_message(user_message)
        
        return NarrativeResponse(
            narrative=response,
            item_name=item['name'],
            generated_at=datetime.now(timezone.utc)
        )
    except Exception as e:
        logger.error(f"AI generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate narrative")

# ========================
# COMMUNITY CONTRIBUTIONS
# ========================

class ContributionCreate(BaseModel):
    heritage_item_id: Optional[str] = None
    type: str  # 'story', 'photo', 'correction', 'new_item'
    title: str
    content: str
    location: Optional[Location] = None
    category: Optional[str] = None
    region: Optional[str] = None

class Contribution(BaseModel):
    id: str
    user_id: str
    user_name: str
    heritage_item_id: Optional[str] = None
    type: str
    title: str
    content: str
    location: Optional[Location] = None
    category: Optional[str] = None
    region: Optional[str] = None
    status: str = 'pending'
    votes: int = 0
    created_at: datetime

@api_router.post("/contributions", response_model=Contribution)
async def create_contribution(
    contribution: ContributionCreate,
    current_user: User = Depends(require_auth)
):
    """Create a new community contribution"""
    new_contribution = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "user_name": current_user.name,
        "heritage_item_id": contribution.heritage_item_id,
        "type": contribution.type,
        "title": contribution.title,
        "content": contribution.content,
        "location": contribution.location.dict() if contribution.location else None,
        "category": contribution.category,
        "region": contribution.region,
        "status": "pending",
        "votes": 0,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.contributions.insert_one(new_contribution)
    return Contribution(**new_contribution)

@api_router.get("/contributions", response_model=List[Contribution])
async def get_contributions(
    status: Optional[str] = None,
    type: Optional[str] = None,
    region: Optional[str] = None,
    limit: int = 50
):
    """Get community contributions"""
    query = {}
    if status:
        query["status"] = status
    if type:
        query["type"] = type
    if region:
        query["region"] = region
    
    contributions = await db.contributions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return [Contribution(**c) for c in contributions]

@api_router.get("/contributions/approved", response_model=List[Contribution])
async def get_approved_contributions(limit: int = 50):
    """Get approved community contributions"""
    contributions = await db.contributions.find(
        {"status": "approved"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return [Contribution(**c) for c in contributions]

@api_router.get("/contributions/my", response_model=List[Contribution])
async def get_my_contributions(current_user: User = Depends(require_auth)):
    """Get current user's contributions"""
    contributions = await db.contributions.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [Contribution(**c) for c in contributions]

@api_router.post("/contributions/{contribution_id}/vote")
async def vote_contribution(
    contribution_id: str,
    current_user: User = Depends(require_auth)
):
    """Vote for a contribution"""
    result = await db.contributions.update_one(
        {"id": contribution_id},
        {"$inc": {"votes": 1}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Contribution not found")
    return {"message": "Vote recorded"}

# ========================
# IMAGE GALLERY
# ========================

@api_router.get("/gallery/{category}")
async def get_gallery(category: str, limit: int = 20):
    """Get images for a category"""
    items = await db.heritage_items.find(
        {"category": category, "image_url": {"$ne": None}},
        {"_id": 0, "id": 1, "name": 1, "image_url": 1, "region": 1}
    ).limit(limit).to_list(limit)
    return items

# ========================
# STATISTICS
# ========================

@api_router.get("/stats")
async def get_stats():
    """Get heritage statistics"""
    total_items = await db.heritage_items.count_documents({})
    total_routes = await db.routes.count_documents({})
    total_users = await db.users.count_documents({})
    
    # Count by category
    categories_stats = []
    for cat in CATEGORIES:
        count = await db.heritage_items.count_documents({"category": cat["id"]})
        categories_stats.append({"id": cat["id"], "name": cat["name"], "count": count})
    
    # Count by region
    regions_stats = []
    for reg in REGIONS:
        count = await db.heritage_items.count_documents({"region": reg["id"]})
        regions_stats.append({"id": reg["id"], "name": reg["name"], "count": count})
    
    return {
        "total_items": total_items,
        "total_routes": total_routes,
        "total_users": total_users,
        "categories": categories_stats,
        "regions": regions_stats
    }

# ========================
# GAMIFICATION - BADGES & ACHIEVEMENTS
# ========================

BADGES = [
    {"id": "explorer", "name": "Explorador", "description": "Visitou 10 pontos de património", "icon": "explore", "color": "#3B82F6", "requirement": 10, "type": "visits"},
    {"id": "legend_hunter", "name": "Caçador de Lendas", "description": "Descobriu 5 lendas portuguesas", "icon": "auto-stories", "color": "#8B5CF6", "requirement": 5, "type": "category_lendas"},
    {"id": "gastronome", "name": "Gastrónomo", "description": "Explorou 10 pratos típicos", "icon": "restaurant", "color": "#EF4444", "requirement": 10, "type": "category_gastronomia"},
    {"id": "pilgrim", "name": "Peregrino Cultural", "description": "Completou 3 rotas temáticas", "icon": "hiking", "color": "#22C55E", "requirement": 3, "type": "routes"},
    {"id": "storyteller", "name": "Contador de Histórias", "description": "Contribuiu com 5 histórias aprovadas", "icon": "record-voice-over", "color": "#F59E0B", "requirement": 5, "type": "contributions"},
    {"id": "guardian", "name": "Guardião do Património", "description": "50 itens nos favoritos", "icon": "favorite", "color": "#EC4899", "requirement": 50, "type": "favorites"},
    {"id": "north_expert", "name": "Especialista do Norte", "description": "Visitou 20 locais do Norte", "icon": "landscape", "color": "#06B6D4", "requirement": 20, "type": "region_norte"},
    {"id": "island_lover", "name": "Amante das Ilhas", "description": "Explorou Açores e Madeira", "icon": "waves", "color": "#14B8A6", "requirement": 10, "type": "islands"},
    {"id": "nature_walker", "name": "Caminhante da Natureza", "description": "Descobriu 10 percursos pedestres", "icon": "forest", "color": "#84CC16", "requirement": 10, "type": "category_percursos"},
    {"id": "historian", "name": "Historiador", "description": "Visitou 10 aldeias históricas", "icon": "home-work", "color": "#D97706", "requirement": 10, "type": "category_aldeias"},
]

class UserProgress(BaseModel):
    user_id: str
    visits: List[str] = []  # Heritage item IDs visited
    routes_completed: List[str] = []
    contributions_approved: int = 0
    badges_earned: List[str] = []
    total_points: int = 0
    level: int = 1
    created_at: datetime
    updated_at: datetime

@api_router.get("/badges")
async def get_badges():
    """Get all available badges"""
    return BADGES

@api_router.get("/gamification/progress")
async def get_user_progress(current_user: User = Depends(require_auth)):
    """Get user's gamification progress"""
    progress = await db.user_progress.find_one(
        {"user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not progress:
        # Create initial progress
        progress = {
            "user_id": current_user.user_id,
            "visits": [],
            "routes_completed": [],
            "contributions_approved": 0,
            "badges_earned": [],
            "total_points": 0,
            "level": 1,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        await db.user_progress.insert_one(progress)
    
    # Calculate badges
    earned_badges = []
    favorites_count = len(current_user.favorites)
    visits_count = len(progress.get("visits", []))
    
    for badge in BADGES:
        badge_id = badge["id"]
        if badge_id in progress.get("badges_earned", []):
            earned_badges.append({**badge, "earned": True, "progress": 100})
            continue
            
        # Calculate progress for each badge type
        current_progress = 0
        if badge["type"] == "visits":
            current_progress = visits_count
        elif badge["type"] == "favorites":
            current_progress = favorites_count
        elif badge["type"] == "routes":
            current_progress = len(progress.get("routes_completed", []))
        elif badge["type"] == "contributions":
            current_progress = progress.get("contributions_approved", 0)
        elif badge["type"].startswith("category_"):
            category = badge["type"].replace("category_", "")
            # Count visits in category
            items_in_cat = await db.heritage_items.find(
                {"id": {"$in": progress.get("visits", [])}, "category": category}
            ).to_list(100)
            current_progress = len(items_in_cat)
        elif badge["type"].startswith("region_"):
            region = badge["type"].replace("region_", "")
            items_in_region = await db.heritage_items.find(
                {"id": {"$in": progress.get("visits", [])}, "region": region}
            ).to_list(100)
            current_progress = len(items_in_region)
        elif badge["type"] == "islands":
            items_islands = await db.heritage_items.find(
                {"id": {"$in": progress.get("visits", [])}, "region": {"$in": ["acores", "madeira"]}}
            ).to_list(100)
            current_progress = len(items_islands)
        
        progress_percent = min(100, int((current_progress / badge["requirement"]) * 100))
        earned_badges.append({
            **badge, 
            "earned": current_progress >= badge["requirement"],
            "progress": progress_percent,
            "current": current_progress
        })
    
    return {
        "user_id": current_user.user_id,
        "visits_count": visits_count,
        "favorites_count": favorites_count,
        "routes_completed": len(progress.get("routes_completed", [])),
        "contributions_approved": progress.get("contributions_approved", 0),
        "total_points": progress.get("total_points", 0),
        "level": progress.get("level", 1),
        "badges": earned_badges
    }

@api_router.post("/gamification/visit/{item_id}")
async def record_visit(item_id: str, current_user: User = Depends(require_auth)):
    """Record a visit to a heritage item"""
    # Verify item exists
    item = await db.heritage_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Update user progress
    result = await db.user_progress.update_one(
        {"user_id": current_user.user_id},
        {
            "$addToSet": {"visits": item_id},
            "$inc": {"total_points": 10},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        },
        upsert=True
    )
    
    return {"message": "Visit recorded", "points_earned": 10}

@api_router.post("/gamification/complete-route/{route_id}")
async def complete_route(route_id: str, current_user: User = Depends(require_auth)):
    """Mark a route as completed"""
    route = await db.routes.find_one({"id": route_id})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    await db.user_progress.update_one(
        {"user_id": current_user.user_id},
        {
            "$addToSet": {"routes_completed": route_id},
            "$inc": {"total_points": 50},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        },
        upsert=True
    )
    
    return {"message": "Route completed", "points_earned": 50}

@api_router.get("/leaderboard")
async def get_leaderboard(limit: int = 10):
    """Get top users by points"""
    leaderboard = await db.user_progress.find(
        {},
        {"_id": 0, "user_id": 1, "total_points": 1, "level": 1, "badges_earned": 1}
    ).sort("total_points", -1).limit(limit).to_list(limit)
    
    # Enrich with user names
    result = []
    for entry in leaderboard:
        user = await db.users.find_one({"user_id": entry["user_id"]}, {"_id": 0, "name": 1, "picture": 1})
        if user:
            result.append({
                **entry,
                "name": user.get("name", "Utilizador"),
                "picture": user.get("picture"),
                "badges_count": len(entry.get("badges_earned", []))
            })
    
    return result

# ========================
# CALENDAR - EVENTS & FESTIVALS
# ========================

CALENDAR_EVENTS = [
    # Janeiro
    {"id": "janeiras", "name": "Janeiras e Reis", "date_start": "01-06", "date_end": "01-06", "category": "festas", "region": "norte", "description": "Cantos de porta em porta celebrando os Reis"},
    
    # Fevereiro
    {"id": "caretos", "name": "Caretos de Podence", "date_start": "02-01", "date_end": "02-28", "category": "festas", "region": "norte", "description": "Carnaval tradicional com máscaras ancestrais"},
    {"id": "carnaval_loule", "name": "Carnaval de Loulé", "date_start": "02-15", "date_end": "02-20", "category": "festas", "region": "algarve", "description": "Um dos carnavais mais antigos do Algarve"},
    
    # Março/Abril
    {"id": "semana_santa", "name": "Semana Santa de Braga", "date_start": "03-20", "date_end": "04-20", "category": "religioso", "region": "norte", "description": "Procissões e celebrações da Páscoa"},
    
    # Abril
    {"id": "festa_flor", "name": "Festa da Flor", "date_start": "04-15", "date_end": "04-30", "category": "festas", "region": "madeira", "description": "Desfile alegórico e mural de flores"},
    
    # Maio
    {"id": "queima_fitas", "name": "Queima das Fitas", "date_start": "05-01", "date_end": "05-15", "category": "festas", "region": "centro", "description": "Tradição académica de Coimbra"},
    {"id": "santo_cristo", "name": "Senhor Santo Cristo", "date_start": "05-15", "date_end": "05-20", "category": "religioso", "region": "acores", "description": "A maior romaria açoriana"},
    {"id": "fatima_maio", "name": "Peregrinação a Fátima", "date_start": "05-12", "date_end": "05-13", "category": "religioso", "region": "centro", "description": "Aniversário das aparições"},
    
    # Junho
    {"id": "santos_populares", "name": "Santos Populares", "date_start": "06-12", "date_end": "06-29", "category": "festas", "region": "lisboa", "description": "Santo António, São João e São Pedro"},
    {"id": "sao_joao", "name": "São João do Porto", "date_start": "06-23", "date_end": "06-24", "category": "festas", "region": "norte", "description": "A maior festa popular do Norte"},
    {"id": "sao_pedro", "name": "Festas de São Pedro", "date_start": "06-28", "date_end": "06-29", "category": "festas", "region": "centro", "description": "Celebrações em honra de São Pedro"},
    
    # Julho
    {"id": "tabuleiros", "name": "Festa dos Tabuleiros", "date_start": "07-01", "date_end": "07-15", "category": "festas", "region": "centro", "description": "Cortejo quadrienal em Tomar (anos pares)"},
    {"id": "medieval_obidos", "name": "Feira Medieval de Óbidos", "date_start": "07-10", "date_end": "07-30", "category": "festas", "region": "centro", "description": "Recriação histórica medieval"},
    
    # Agosto
    {"id": "agonia", "name": "Romaria d'Agonia", "date_start": "08-15", "date_end": "08-20", "category": "festas", "region": "norte", "description": "Trajes tradicionais e tapetes floridos em Viana"},
    {"id": "vindimas", "name": "Festa das Vindimas", "date_start": "08-25", "date_end": "09-15", "category": "festas", "region": "norte", "description": "Colheita das uvas no Douro"},
    {"id": "feira_mateus", "name": "Feira de São Mateus", "date_start": "08-15", "date_end": "09-21", "category": "festas", "region": "centro", "description": "Uma das mais antigas feiras de Portugal"},
    
    # Setembro
    {"id": "romaria_nazare", "name": "Romaria da Nazaré", "date_start": "09-08", "date_end": "09-15", "category": "religioso", "region": "centro", "description": "Festas em honra de Nossa Senhora"},
    {"id": "cereja", "name": "Festa da Cereja", "date_start": "09-01", "date_end": "09-10", "category": "festas", "region": "centro", "description": "Celebração do fruto no Fundão"},
    
    # Outubro
    {"id": "fatima_outubro", "name": "Peregrinação a Fátima", "date_start": "10-12", "date_end": "10-13", "category": "religioso", "region": "centro", "description": "Última aparição de Nossa Senhora"},
    {"id": "castanhas", "name": "Magusto e Castanhas", "date_start": "10-25", "date_end": "11-15", "category": "festas", "region": "norte", "description": "Época das castanhas assadas"},
    
    # Novembro
    {"id": "sao_martinho", "name": "São Martinho", "date_start": "11-11", "date_end": "11-11", "category": "festas", "region": "norte", "description": "Magusto, jeropiga e castanhas"},
    
    # Dezembro
    {"id": "natal", "name": "Tradições de Natal", "date_start": "12-01", "date_end": "12-31", "category": "festas", "region": "norte", "description": "Presépios, consoada e tradições natalícias"},
    {"id": "madeira_natal", "name": "Natal e Fim de Ano na Madeira", "date_start": "12-15", "date_end": "12-31", "category": "festas", "region": "madeira", "description": "Fogos de artifício espetaculares"},
]

@api_router.get("/calendar")
async def get_calendar_events(month: Optional[int] = None):
    """Get calendar events, optionally filtered by month"""
    events = CALENDAR_EVENTS.copy()
    
    if month:
        month_str = f"{month:02d}"
        events = [e for e in events if e["date_start"].startswith(month_str) or e["date_end"].startswith(month_str)]
    
    return events

@api_router.get("/calendar/upcoming")
async def get_upcoming_events(limit: int = 5):
    """Get upcoming events based on current date"""
    today = datetime.now(timezone.utc)
    current_month = today.month
    current_day = today.day
    current_date_str = f"{current_month:02d}-{current_day:02d}"
    
    upcoming = []
    for event in CALENDAR_EVENTS:
        # Simple comparison - event starts after today
        if event["date_start"] >= current_date_str or event["date_end"] >= current_date_str:
            upcoming.append(event)
        # Also include events that wrap around the year
        elif current_month >= 11 and event["date_start"].startswith("01"):
            upcoming.append(event)
    
    # Sort by start date
    upcoming.sort(key=lambda x: x["date_start"])
    return upcoming[:limit]

@api_router.get("/calendar/month/{month}")
async def get_events_by_month(month: int):
    """Get events for a specific month"""
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be between 1 and 12")
    
    month_str = f"{month:02d}"
    events = [e for e in CALENDAR_EVENTS if e["date_start"].startswith(month_str)]
    return events

# ========================
# HEALTH CHECK
# ========================

@api_router.get("/")
async def root():
    return {"message": "Património Vivo de Portugal API", "status": "online"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
