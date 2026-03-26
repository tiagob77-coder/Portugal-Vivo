"""
Economy API — Mercados e Economia Local
MongoDB Atlas (Motor async) · FastAPI
"""

from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

economy_router = APIRouter(prefix="/economy", tags=["Economy"])

_db = None


def set_economy_db(database) -> None:
    global _db
    _db = database


# ─── Seed data (fallback when collection is empty) ───────────────────────────

SEED_MARKETS: List[Dict[str, Any]] = [
    {
        "_id": "mkt_001",
        "name": "Mercado do Bolhão",
        "category": "mercado_municipal",
        "region": "Porto",
        "municipality": "Porto",
        "lat": 41.1496,
        "lng": -8.6093,
        "description": "Mercado histórico do Porto, renovado em 2022, com produtos frescos e tradicionais.",
        "horario": "Seg-Sáb 08h-20h",
        "produtos": ["peixe fresco", "legumes", "frutas", "flores", "charcutaria"],
        "tags": ["histórico", "renovado", "turismo"],
        "iq_score": 92,
        "rating": 4.7,
        "fotos": [],
    },
    {
        "_id": "mkt_002",
        "name": "Mercado da Ribeira",
        "category": "mercado_municipal",
        "region": "Lisboa",
        "municipality": "Lisboa",
        "lat": 38.7071,
        "lng": -9.1453,
        "description": "Mercado histórico de Lisboa junto ao Tejo, com oferta gastronómica diversificada.",
        "horario": "Diário 10h-00h",
        "produtos": ["gastronomia", "vinhos", "queijos", "petiscos"],
        "tags": ["histórico", "gastronómico", "noturno"],
        "iq_score": 88,
        "rating": 4.5,
        "fotos": [],
    },
    {
        "_id": "mkt_003",
        "name": "Feira de Barcelos",
        "category": "feira",
        "region": "Minho",
        "municipality": "Barcelos",
        "lat": 41.5348,
        "lng": -8.6180,
        "description": "Maior feira semanal de Portugal, às quintas-feiras, famosa pelo galo de Barcelos.",
        "horario": "Qui 07h-17h",
        "produtos": ["artesanato", "cerâmica", "gastronomia", "animais", "têxteis"],
        "tags": ["feira", "artesanato", "semanal", "maior"],
        "iq_score": 95,
        "rating": 4.8,
        "fotos": [],
    },
    {
        "_id": "mkt_004",
        "name": "Mercado Municipal de Loulé",
        "category": "mercado_municipal",
        "region": "Algarve",
        "municipality": "Loulé",
        "lat": 37.1440,
        "lng": -8.0235,
        "description": "Mercado árabe-mourisca com produtos do Algarve: amêndoa, figos, alfarroba.",
        "horario": "Seg-Sáb 07h-14h",
        "produtos": ["frutos secos", "especiarias", "peixe", "mel", "queijo"],
        "tags": ["árabe", "histórico", "algarve"],
        "iq_score": 90,
        "rating": 4.6,
        "fotos": [],
    },
    {
        "_id": "mkt_005",
        "name": "Mercado da Graça",
        "category": "mercado_municipal",
        "region": "Alentejo",
        "municipality": "Évora",
        "lat": 38.5742,
        "lng": -7.9077,
        "description": "Mercado de produtos alentejanos: azeite, enchidos, vinhos e queijos.",
        "horario": "Seg-Sáb 07h-13h",
        "produtos": ["enchidos", "azeite", "vinhos", "queijos", "legumes"],
        "tags": ["alentejo", "produtos regionais"],
        "iq_score": 85,
        "rating": 4.3,
        "fotos": [],
    },
]

SEED_ARTISANS: List[Dict[str, Any]] = [
    {
        "_id": "art_001",
        "name": "Olaria do Gonçalves",
        "category": "olaria",
        "region": "Minho",
        "municipality": "Barcelos",
        "lat": 41.5329,
        "lng": -8.6193,
        "description": "Olaria tradicional com mais de 3 gerações, especialistas no Galo de Barcelos.",
        "oficio": "Cerâmica e olaria",
        "certificacoes": ["Artesão Certificado CRAT"],
        "contato": "olariadogoncalves@example.com",
        "iq_score": 91,
        "rating": 4.8,
    },
    {
        "_id": "art_002",
        "name": "Rendas de Bilros da Avó",
        "category": "rendas",
        "region": "Centro",
        "municipality": "Peniche",
        "lat": 39.3563,
        "lng": -9.3827,
        "description": "Artesã especializada em rendas de bilros de Peniche, técnica UNESCO.",
        "oficio": "Rendas e bordados",
        "certificacoes": ["Património Cultural Imaterial"],
        "contato": "rendas.peniche@example.com",
        "iq_score": 94,
        "rating": 4.9,
    },
    {
        "_id": "art_003",
        "name": "Filigrana Travassos",
        "category": "ourivesaria",
        "region": "Norte",
        "municipality": "Gondomar",
        "lat": 41.1392,
        "lng": -8.5253,
        "description": "Mestre em filigrana portuguesa, ouro e prata com padrões do séc. XVIII.",
        "oficio": "Ourivesaria e filigrana",
        "certificacoes": ["Artesão Mestre", "DOP Filigrana"],
        "contato": "filigrana.travassos@example.com",
        "iq_score": 96,
        "rating": 4.9,
    },
    {
        "_id": "art_004",
        "name": "Tapetes de Arraiolos — Casa Velha",
        "category": "tapetes",
        "region": "Alentejo",
        "municipality": "Arraiolos",
        "lat": 38.7252,
        "lng": -7.9852,
        "description": "Tapetes de Arraiolos feitos à mão com lã merino e padrões tradicionais.",
        "oficio": "Tapeçaria",
        "certificacoes": ["IGP Tapetes de Arraiolos"],
        "contato": "tapetes.arraiolos@example.com",
        "iq_score": 93,
        "rating": 4.7,
    },
]

SEED_PRODUCTS: List[Dict[str, Any]] = [
    {
        "_id": "prod_001",
        "name": "Azeite Virgem Extra do Alentejo",
        "category": "azeite",
        "denomination": "DOP",
        "region": "Alentejo",
        "producer": "Cooperativa Azeite Sul",
        "lat": 38.5742,
        "lng": -7.9077,
        "description": "Azeite de qualidade superior produzido com azeitonas galega e cordovil.",
        "sabor": "Frutado, amargo, picante",
        "usos": ["culinária", "conservas", "cosmética natural"],
        "preco_medio": "€8–€15/500ml",
        "iq_score": 93,
        "certificacao": "DOP Azeite do Alentejo",
    },
    {
        "_id": "prod_002",
        "name": "Queijo Serra da Estrela",
        "category": "queijo",
        "denomination": "DOP",
        "region": "Centro",
        "producer": "Quinta da Serra",
        "lat": 40.3240,
        "lng": -7.6114,
        "description": "Queijo de ovelha bordaleira maturado, cremoso e intenso.",
        "sabor": "Intenso, cremoso, ligeiramente picante",
        "usos": ["tábua de queijos", "acompanhamento vinho"],
        "preco_medio": "€12–€25/kg",
        "iq_score": 98,
        "certificacao": "DOP Serra da Estrela",
    },
    {
        "_id": "prod_003",
        "name": "Vinho Verde Alvarinho",
        "category": "vinho",
        "denomination": "DOC",
        "region": "Minho",
        "producer": "Quinta do Soalheiro",
        "lat": 41.9237,
        "lng": -8.3421,
        "description": "Alvarinho de excelência da sub-região de Monção e Melgaço.",
        "sabor": "Fresco, cítrico, floral",
        "usos": ["aperitivo", "peixe", "marisco"],
        "preco_medio": "€8–€20/garrafa",
        "iq_score": 95,
        "certificacao": "DOC Vinho Verde — Alvarinho",
    },
    {
        "_id": "prod_004",
        "name": "Mel de Urze do Minho",
        "category": "mel",
        "denomination": "IGP",
        "region": "Minho",
        "producer": "Apicultores do Minho",
        "lat": 41.6932,
        "lng": -8.0421,
        "description": "Mel escuro produzido pelas abelhas ibéricas nos melões de urze.",
        "sabor": "Intenso, ligeiramente amargo",
        "usos": ["sobremesas", "infusões", "queijos"],
        "preco_medio": "€6–€12/250g",
        "iq_score": 87,
        "certificacao": "IGP Mel de Barroso",
    },
    {
        "_id": "prod_005",
        "name": "Chouriço de Vinhais",
        "category": "enchidos",
        "denomination": "IGP",
        "region": "Trás-os-Montes",
        "producer": "Charcutaria Vinhais",
        "lat": 41.8392,
        "lng": -7.0011,
        "description": "Enchido fumado com carne de porco bísaro e pimentão.",
        "sabor": "Defumado, picante, intenso",
        "usos": ["cozidos", "petiscos", "entremeada"],
        "preco_medio": "€8–€16/500g",
        "iq_score": 90,
        "certificacao": "IGP Chouriço de Vinhais",
    },
]

SEED_FISHING: List[Dict[str, Any]] = [
    {
        "_id": "fish_001",
        "name": "Porto de Pesca de Sesimbra",
        "category": "porto_pesca",
        "region": "Setúbal",
        "municipality": "Sesimbra",
        "lat": 38.4437,
        "lng": -9.1026,
        "description": "Porto de pesca artesanal com lota diária e restaurantes de peixe fresco.",
        "especies": ["choco", "garoupa", "linguado", "robalo"],
        "tecnicas": ["linha", "palangre", "nassas"],
        "lota": "Diária 07h–09h",
        "iq_score": 89,
        "rating": 4.6,
    },
    {
        "_id": "fish_002",
        "name": "Comunidade Piscatória de Nazaré",
        "category": "comunidade_pesca",
        "region": "Centro",
        "municipality": "Nazaré",
        "lat": 39.6016,
        "lng": -9.0713,
        "description": "Pesca artesanal com arte xávega e tradição centenária das mulheres na praia.",
        "especies": ["sardinha", "carapau", "safio"],
        "tecnicas": ["arte xávega", "redes de tresmalho"],
        "lota": "Sáb 06h–08h (sazonal)",
        "iq_score": 94,
        "rating": 4.8,
    },
    {
        "_id": "fish_003",
        "name": "Armação de Pêra — Atum do Algarve",
        "category": "pesca_atum",
        "region": "Algarve",
        "municipality": "Silves",
        "lat": 37.1018,
        "lng": -8.3285,
        "description": "Antiga armação de pesca de atum com técnica árabe milenar.",
        "especies": ["atum rabilho", "atum voador"],
        "tecnicas": ["armação", "palangre de deriva"],
        "lota": "Jun–Set (temporada)",
        "iq_score": 91,
        "rating": 4.7,
    },
]

SEED_ROUTES: List[Dict[str, Any]] = [
    {
        "_id": "route_001",
        "name": "Rota do Peixe Fresco — Costa Atlântica",
        "category": "rota_peixe",
        "region": "Costa Atlântica",
        "distance_km": 120,
        "duration_days": 2,
        "description": "Da Nazaré a Sesimbra, descobrindo lotas, tasquinhas e tradições piscatórias.",
        "waypoints": ["Nazaré", "Peniche", "Cascais", "Setúbal", "Sesimbra"],
        "highlights": ["lota da Nazaré", "palhotas de Cascais", "mercado de Setúbal"],
        "iq_score": 88,
        "tags": ["peixe", "litoral", "gastronomia"],
    },
    {
        "_id": "route_002",
        "name": "Rota do Artesanato do Minho",
        "category": "rota_artesanato",
        "region": "Minho",
        "distance_km": 80,
        "duration_days": 1,
        "description": "Barcelos, Viana do Castelo e Ponte de Lima em busca de cerâmica, linho e filigrana.",
        "waypoints": ["Braga", "Barcelos", "Viana do Castelo", "Ponte de Lima"],
        "highlights": ["Feira de Barcelos", "Museu do Traje", "Ourivesaria Vianesa"],
        "iq_score": 92,
        "tags": ["artesanato", "minho", "cerâmica"],
    },
    {
        "_id": "route_003",
        "name": "Rota dos Sabores do Alentejo",
        "category": "rota_gastronomia",
        "region": "Alentejo",
        "distance_km": 200,
        "duration_days": 3,
        "description": "Évora, Estremoz e Marvão a descobrir azeites, vinhos, queijos e enchidos.",
        "waypoints": ["Évora", "Estremoz", "Portalegre", "Marvão"],
        "highlights": ["adegas da Vidigueira", "mercado de Estremoz", "queijos de Serpa"],
        "iq_score": 95,
        "tags": ["alentejo", "vinhos", "queijos", "azeite"],
    },
]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _serialize(doc: Dict) -> Dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id", doc.get("id", "")))
    return doc


async def _get_collection_or_seed(collection: str, seed: List[Dict]) -> List[Dict]:
    """Return docs from MongoDB collection; fall back to seed data if empty."""
    if _db is None:
        return seed
    try:
        docs = await _db[collection].find({}).to_list(500)
        if docs:
            return [_serialize(d) for d in docs]
    except Exception:
        pass
    return [dict(d) for d in seed]


# ─── Endpoints ───────────────────────────────────────────────────────────────

@economy_router.get("/markets")
async def get_markets(
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    """List local markets and fairs with optional filters."""
    items = await _get_collection_or_seed("local_markets", SEED_MARKETS)

    if region:
        items = [i for i in items if region.lower() in i.get("region", "").lower()]
    if category:
        items = [i for i in items if i.get("category") == category]
    if search:
        pat = re.compile(search, re.IGNORECASE)
        items = [i for i in items if pat.search(i.get("name", "") + " " + i.get("description", ""))]

    total = len(items)
    items = items[offset: offset + limit]
    return {"total": total, "offset": offset, "limit": limit, "results": items}


@economy_router.get("/markets/{market_id}")
async def get_market_detail(market_id: str):
    """Detailed view of a specific market."""
    items = await _get_collection_or_seed("local_markets", SEED_MARKETS)
    for item in items:
        if str(item.get("_id", item.get("id", ""))) == market_id:
            return item
    raise HTTPException(status_code=404, detail="Mercado não encontrado")


@economy_router.get("/artisans")
async def get_artisans(
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    """List artisans and traditional crafts."""
    items = await _get_collection_or_seed("artisans", SEED_ARTISANS)

    if region:
        items = [i for i in items if region.lower() in i.get("region", "").lower()]
    if category:
        items = [i for i in items if i.get("category") == category]
    if search:
        pat = re.compile(search, re.IGNORECASE)
        items = [i for i in items if pat.search(i.get("name", "") + " " + i.get("description", ""))]

    total = len(items)
    items = items[offset: offset + limit]
    return {"total": total, "offset": offset, "limit": limit, "results": items}


@economy_router.get("/products")
async def get_products(
    region: Optional[str] = Query(None),
    denomination: Optional[str] = Query(None, description="DOP, IGP ou DOC"),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    """List DOP/IGP/DOC certified regional products."""
    items = await _get_collection_or_seed("local_products", SEED_PRODUCTS)

    if region:
        items = [i for i in items if region.lower() in i.get("region", "").lower()]
    if denomination:
        items = [i for i in items if i.get("denomination", "").upper() == denomination.upper()]
    if category:
        items = [i for i in items if i.get("category") == category]
    if search:
        pat = re.compile(search, re.IGNORECASE)
        items = [i for i in items if pat.search(i.get("name", "") + " " + i.get("description", ""))]

    total = len(items)
    items = items[offset: offset + limit]
    return {"total": total, "offset": offset, "limit": limit, "results": items}


@economy_router.get("/fishing")
async def get_fishing(
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    """List artisanal fishing communities and ports."""
    items = await _get_collection_or_seed("fishing_economy", SEED_FISHING)

    if region:
        items = [i for i in items if region.lower() in i.get("region", "").lower()]
    if category:
        items = [i for i in items if i.get("category") == category]

    return {"total": len(items), "results": items[:limit]}


@economy_router.get("/routes")
async def get_routes(
    category: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    max_days: Optional[int] = Query(None),
    limit: int = Query(20, le=100),
):
    """List thematic economic routes (gastronomy, crafts, fish, wine)."""
    items = await _get_collection_or_seed("economic_zones", SEED_ROUTES)

    if category:
        items = [i for i in items if i.get("category") == category]
    if region:
        items = [i for i in items if region.lower() in i.get("region", "").lower()]
    if max_days:
        items = [i for i in items if i.get("duration_days", 999) <= max_days]

    items = sorted(items, key=lambda x: x.get("iq_score", 0), reverse=True)
    return {"total": len(items), "results": items[:limit]}


class RecommendRequest(BaseModel):
    lat: float
    lng: float
    radius_km: float = Field(default=25.0, ge=1.0, le=200.0)
    interests: List[str] = Field(default_factory=list)
    limit: int = Field(default=10, ge=1, le=50)


@economy_router.post("/recommendations")
async def get_economy_recommendations(body: RecommendRequest):
    """
    Personalised economy recommendations near a coordinate.
    Scores = 50% proximity + 50% IQ score.
    """
    all_items: List[Dict] = []

    markets = await _get_collection_or_seed("local_markets", SEED_MARKETS)
    for m in markets:
        m["_type"] = "mercado"
        all_items.append(m)

    artisans = await _get_collection_or_seed("artisans", SEED_ARTISANS)
    for a in artisans:
        a["_type"] = "artesao"
        all_items.append(a)

    products = await _get_collection_or_seed("local_products", SEED_PRODUCTS)
    for p in products:
        p["_type"] = "produto"
        all_items.append(p)

    fishing = await _get_collection_or_seed("fishing_economy", SEED_FISHING)
    for f in fishing:
        f["_type"] = "pesca"
        all_items.append(f)

    # Filter by radius
    scored = []
    for item in all_items:
        ilat = item.get("lat")
        ilng = item.get("lng")
        if ilat is None or ilng is None:
            continue
        dist = _haversine(body.lat, body.lng, ilat, ilng)
        if dist > body.radius_km:
            continue

        # Proximity score: 1.0 at dist=0, 0.0 at dist=radius_km
        prox_score = max(0.0, 1.0 - dist / body.radius_km)
        iq = item.get("iq_score", 75) / 100.0
        final_score = 0.5 * prox_score + 0.5 * iq

        # Interest boost (+10%)
        if body.interests:
            tags = item.get("tags", []) + [item.get("category", "")]
            if any(interest.lower() in " ".join(tags).lower() for interest in body.interests):
                final_score = min(1.0, final_score * 1.1)

        scored.append({**item, "distance_km": round(dist, 2), "score": round(final_score, 3)})

    scored.sort(key=lambda x: x["score"], reverse=True)
    return {
        "lat": body.lat,
        "lng": body.lng,
        "radius_km": body.radius_km,
        "total": len(scored),
        "results": scored[: body.limit],
    }


@economy_router.get("/stats")
async def get_economy_stats():
    """Quick stats summary: counts per category."""
    markets = await _get_collection_or_seed("local_markets", SEED_MARKETS)
    artisans = await _get_collection_or_seed("artisans", SEED_ARTISANS)
    products = await _get_collection_or_seed("local_products", SEED_PRODUCTS)
    fishing = await _get_collection_or_seed("fishing_economy", SEED_FISHING)
    routes = await _get_collection_or_seed("economic_zones", SEED_ROUTES)

    return {
        "mercados": len(markets),
        "artesaos": len(artisans),
        "produtos_dop_igp": len(products),
        "comunidades_pesca": len(fishing),
        "rotas_economicas": len(routes),
        "total": len(markets) + len(artisans) + len(products) + len(fishing) + len(routes),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
