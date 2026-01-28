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
    {"id": "lendas", "name": "Lendas & Mitos", "icon": "dragon", "color": "#8B5CF6"},
    {"id": "festas", "name": "Festas e Tradições", "icon": "festival", "color": "#F59E0B"},
    {"id": "saberes", "name": "Saberes & Ofícios", "icon": "hammer", "color": "#10B981"},
    {"id": "crencas", "name": "Crenças e Oculto", "icon": "moon", "color": "#6366F1"},
    {"id": "gastronomia", "name": "Gastronomia", "icon": "restaurant", "color": "#EF4444"},
    {"id": "produtos", "name": "Produtos DOP/IGP", "icon": "local-grocery-store", "color": "#F97316"},
    {"id": "termas", "name": "Termas e Praias", "icon": "water", "color": "#06B6D4"},
    {"id": "florestas", "name": "Matas e Florestas", "icon": "forest", "color": "#22C55E"},
    {"id": "rios", "name": "Rios e Ribeiras", "icon": "waves", "color": "#3B82F6"},
    {"id": "minerais", "name": "Pedras e Minerais", "icon": "diamond", "color": "#A855F7"},
    {"id": "aldeias", "name": "Aldeias Históricas", "icon": "home", "color": "#D97706"},
    {"id": "percursos", "name": "Percursos Pedestres", "icon": "hiking", "color": "#84CC16"},
    {"id": "rotas", "name": "Rotas Temáticas", "icon": "route", "color": "#EC4899"},
    {"id": "piscinas", "name": "Piscinas Naturais", "icon": "pool", "color": "#0EA5E9"},
    {"id": "cogumelos", "name": "Cogumelos", "icon": "spa", "color": "#A3E635"},
    {"id": "arqueologia", "name": "Arqueologia", "icon": "architecture", "color": "#78716C"},
    {"id": "fauna", "name": "Fauna e Flora", "icon": "pets", "color": "#65A30D"},
    {"id": "arte", "name": "Arte Portuguesa", "icon": "palette", "color": "#E11D48"},
    {"id": "religioso", "name": "Turismo Religioso", "icon": "church", "color": "#7C3AED"},
    {"id": "comunidade", "name": "Narrativas Comunitárias", "icon": "people", "color": "#14B8A6"},
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
