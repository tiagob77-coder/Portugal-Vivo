"""
Seed Trails and Cultural Routes from existing POIs.

Trail stats are derived deterministically: when a "percurso pedestre" POI name
matches a curated AllTrails reference trail (data/alltrails_pt.json) its real
difficulty / distance / elevation / route type are used; otherwise a stable
hash-based estimate is applied (flagged ``stats_estimated``). Difficulty always
uses the canonical unaccented enum so the map difficulty filter works.
"""
import asyncio
import hashlib
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from trails_quality import (
    normalize_difficulty,
    normalize_route_type,
    naismith_hours,
    difficulty_color,
    difficulty_from_elevation,
    featured_trails,
    load_alltrails_reference,
)

load_dotenv()


def _strip(text: str) -> str:
    import unicodedata
    return "".join(
        c for c in unicodedata.normalize("NFKD", (text or "").lower())
        if not unicodedata.combining(c)
    ).strip()


def _stable_unit(seed: str) -> float:
    """Deterministic float in [0, 1) from a string (replaces random for repeatable seeds)."""
    digest = hashlib.md5(seed.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def _build_alltrails_index() -> dict:
    """Index curated AllTrails reference trails by normalised name for matching."""
    index = {}
    for rec in load_alltrails_reference():
        index[_strip(rec.get("name", ""))] = rec
    return index


def _match_alltrails(name: str, index: dict) -> dict | None:
    """Find a curated AllTrails trail whose name matches the POI name."""
    key = _strip(name)
    if not key:
        return None
    if key in index:
        return index[key]
    for ref_key, rec in index.items():
        if key in ref_key or ref_key in key:
            return rec
    return None

# Cultural Routes (Rotas Temáticas) definitions
CULTURAL_ROUTES = [
    {
        "id": "rota-vinhos-douro",
        "name": "Rota dos Vinhos do Douro",
        "description": "Percurso pelas quintas e adegas do Alto Douro Vinhateiro, Património Mundial UNESCO",
        "region": "Norte",
        "difficulty": "fácil",
        "duration_days": 3,
        "distance_km": 180,
        "theme": "gastronomia",
        "highlights": ["Quinta do Crasto", "Pinhão", "Régua", "Lamego"],
        "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
        "featured": True
    },
    {
        "id": "rota-romanico",
        "name": "Rota do Românico",
        "description": "Descoberta das igrejas e mosteiros românicos do Norte de Portugal",
        "region": "Norte",
        "difficulty": "moderado",
        "duration_days": 4,
        "distance_km": 250,
        "theme": "patrimonio",
        "highlights": ["Mosteiro de Paço de Sousa", "Igreja de Rates", "Mosteiro de Travanca"],
        "image_url": "https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=800",
        "featured": True
    },
    {
        "id": "rota-aldeias-historicas",
        "name": "Rota das Aldeias Históricas",
        "description": "Viagem pelas 12 Aldeias Históricas de Portugal na Serra da Estrela e Beira Interior",
        "region": "Centro",
        "difficulty": "moderado",
        "duration_days": 5,
        "distance_km": 350,
        "theme": "patrimonio",
        "highlights": ["Monsanto", "Sortelha", "Belmonte", "Piódão", "Linhares da Beira"],
        "image_url": "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800",
        "featured": True
    },
    {
        "id": "rota-en2",
        "name": "EN2 - Estrada Nacional 2",
        "description": "A mítica estrada que liga Chaves a Faro, atravessando Portugal de Norte a Sul",
        "region": "Nacional",
        "difficulty": "difícil",
        "duration_days": 7,
        "distance_km": 739,
        "theme": "aventura",
        "highlights": ["Chaves", "Vila Real", "Viseu", "Coimbra", "Almodôvar", "Faro"],
        "image_url": "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
        "featured": True
    },
    {
        "id": "rota-costa-vicentina",
        "name": "Rota Vicentina",
        "description": "Trilhos costeiros no Parque Natural do Sudoeste Alentejano e Costa Vicentina",
        "region": "Alentejo",
        "difficulty": "moderado",
        "duration_days": 6,
        "distance_km": 450,
        "theme": "natureza",
        "highlights": ["Zambujeira do Mar", "Aljezur", "Sagres", "Odeceixe"],
        "image_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
        "featured": True
    },
    {
        "id": "rota-templarios",
        "name": "Rota dos Templários",
        "description": "Nas pegadas da Ordem do Templo pelos castelos e conventos medievais",
        "region": "Centro",
        "difficulty": "moderado",
        "duration_days": 3,
        "distance_km": 200,
        "theme": "patrimonio",
        "highlights": ["Tomar", "Castelo de Almourol", "Convento de Cristo"],
        "image_url": "https://images.unsplash.com/photo-1568454537842-d933259bb258?w=800",
        "featured": True
    },
    {
        "id": "rota-levadas-madeira",
        "name": "Rota das Levadas da Madeira",
        "description": "Percursos únicos ao longo dos canais de irrigação centenários da ilha",
        "region": "Madeira",
        "difficulty": "moderado",
        "duration_days": 5,
        "distance_km": 80,
        "theme": "natureza",
        "highlights": ["25 Fontes", "Caldeirão Verde", "Pico do Arieiro"],
        "image_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
        "featured": False
    },
    {
        "id": "rota-gastronomia-alentejo",
        "name": "Rota Gastronómica do Alentejo",
        "description": "Sabores autênticos do Alentejo: porco preto, azeite, vinho e doçaria conventual",
        "region": "Alentejo",
        "difficulty": "fácil",
        "duration_days": 4,
        "distance_km": 300,
        "theme": "gastronomia",
        "highlights": ["Évora", "Estremoz", "Marvão", "Elvas"],
        "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
        "featured": False
    }
]


async def seed_all():
    mongo_url = os.getenv('MONGO_URL')
    client = AsyncIOMotorClient(mongo_url)
    db = client['portugal_vivo']
    
    # 1. Seed Cultural Routes
    existing_routes = await db.cultural_routes.count_documents({})
    if existing_routes == 0:
        await db.cultural_routes.insert_many(CULTURAL_ROUTES)
        print(f"✅ Inserted {len(CULTURAL_ROUTES)} cultural routes")
    else:
        print(f"ℹ️ Cultural routes already exist: {existing_routes}")
    
    # 2. Seed Trails from Percursos Pedestres
    existing_trails = await db.trails.count_documents({})
    if existing_trails == 0:
        # Get percursos pedestres with location
        percursos = await db.heritage_items.find({
            "category": "percursos_pedestres",
            "location.lat": {"$exists": True, "$ne": None}
        }).to_list(500)
        
        at_index = _build_alltrails_index()
        trails_to_insert = []
        for p in percursos:
            name = p.get("name", "")
            loc = p.get("location", {}) or {}
            point = {"lat": loc.get("lat"), "lng": loc.get("lng"), "ele": loc.get("ele")}
            has_point = point["lat"] is not None and point["lng"] is not None

            ref = _match_alltrails(name, at_index)
            if ref:
                distance_km = round(float(ref.get("distance_km") or 0), 1)
                elevation_gain = int(round(float(ref.get("elevation_gain_m") or 0)))
                difficulty = normalize_difficulty(ref.get("difficulty"), elevation_gain)
                trail_type = normalize_route_type(ref.get("route_type"))
                rating = ref.get("rating")
                external_url = ref.get("url", "")
                stats_estimated = False
            else:
                # Deterministic estimate (stable across re-seeds) — flagged, not random.
                is_gr = "GR" in name.upper()
                u = _stable_unit(p.get("id", name))
                distance_km = round((15 + u * 35) if is_gr else (3 + u * 12), 1)
                elevation_gain = int(round(100 + u * 700))
                difficulty = difficulty_from_elevation(elevation_gain)
                trail_type = "linear" if is_gr else "circular"
                rating = None
                external_url = ""
                stats_estimated = True

            trail = {
                "id": p["id"],
                "name": name,
                "description": p.get("description", ""),
                "municipality_id": p.get("concelho", p.get("region", "")).lower().replace(" ", "_"),
                "region": p.get("region", "Norte"),
                "difficulty": difficulty,
                "distance_km": distance_km,
                "elevation_gain": elevation_gain,
                "estimated_hours": naismith_hours(distance_km, elevation_gain),
                "trail_type": trail_type,
                "color": difficulty_color(difficulty),
                "start_point": loc,
                "points": [point] if has_point else [],  # single trailhead — backfill geometry
                "image_url": p.get("image_url", ""),
                "tags": p.get("tags", []),
                "rating": rating,
                "external_url": external_url,
                "source": "alltrails+heritage" if ref else "heritage",
                "stats_estimated": stats_estimated,
                "needs_geometry": True,  # only a trailhead point until GPX/OSM backfill
                "featured": bool(ref),
            }
            trails_to_insert.append(trail)

        if trails_to_insert:
            await db.trails.insert_many(trails_to_insert)
            matched = sum(1 for t in trails_to_insert if not t["stats_estimated"])
            print(f"✅ Inserted {len(trails_to_insert)} trails from percursos pedestres "
                  f"({matched} enriched with real AllTrails stats)")
    else:
        print(f"ℹ️ Trails already exist: {existing_trails}")

    # 2b. Upsert curated AllTrails featured trails (real stats; geometry to backfill)
    featured = featured_trails()
    for ft in featured:
        doc = {**ft, "featured": True, "needs_geometry": True}
        await db.trails.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    print(f"✅ Upserted {len(featured)} AllTrails featured trails")
    
    # 3. Verify Grande Expedição
    exp_count = await db.grande_expedicao.count_documents({})
    print(f"ℹ️ Grande Expedição stages: {exp_count}")
    
    # Summary
    print("\n📊 Final counts:")
    print(f"  - Cultural Routes: {await db.cultural_routes.count_documents({})}")
    print(f"  - Trails: {await db.trails.count_documents({})}")
    print(f"  - Grande Expedição: {await db.grande_expedicao.count_documents({})}")


if __name__ == "__main__":
    asyncio.run(seed_all())
