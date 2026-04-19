"""
Coastal Gastronomy API v2.0 — Atlas Nacional da Gastronomia
MongoDB Atlas (Motor async) · FastAPI
"""
from __future__ import annotations
import math, re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from models.api_models import User

gastronomy_router = APIRouter(prefix="/gastronomy", tags=["Gastronomy"])
_db = None
_llm_key: str = ""
_require_auth = None

def set_gastronomy_db(database) -> None:
    global _db; _db = database

def set_gastronomy_llm_key(key: str) -> None:
    global _llm_key; _llm_key = key

def set_gastronomy_auth(auth_fn) -> None:
    global _require_auth
    _require_auth = auth_fn

async def _auth_dep(request: Request) -> User:
    return await _require_auth(request)

# ─── Seed: Gastronomy Items ──────────────────────────────────────────────────

SEED_ITEMS: List[Dict[str, Any]] = [
    {"_id":"g_001","name":"Caldeirada de Peixe","type":"prato","category":"costeira",
     "region":"Costa Portuguesa","subregion":"Setúbal/Lisboa","seasonality":[1,2,3,4,5,6,7,8,9,10,11,12],
     "ingredients":["robalo","dourada","congro","batata","tomate","cebola","azeite","coentros"],
     "techniques":["estufado"],"dop_igp":False,"sustainability_score":72,"rarity_score":30,
     "authenticity_level":"nacional","description":"Prato de peixe cozinhado em camadas com legumes e azeite. Cada família tem a sua receita.",
     "cultural_context":"gastronomia costeira de subsistência, presente em toda a costa","health_profile":["rico_omega3"],
     "lat":38.5,"lng":-9.0,"iq_score":90},
    {"_id":"g_002","name":"Arroz de Lingueirão","type":"prato","category":"costeira",
     "region":"Algarve","subregion":"Ria Formosa","seasonality":[3,4,5,6,7,8],
     "ingredients":["lingueirão","arroz","alho","coentros","vinho branco","azeite"],
     "techniques":["guisado"],"dop_igp":False,"sustainability_score":55,"rarity_score":60,
     "authenticity_level":"regional","description":"Arroz cremoso com lingueirão da Ria Formosa. Sazonal e delicado.",
     "cultural_context":"gastronomia estuarina da Ria Formosa","health_profile":["baixo_colesterol","proteina"],
     "lat":37.0,"lng":-7.9,"iq_score":93},
    {"_id":"g_003","name":"Cataplana de Mariscos","type":"prato","category":"costeira",
     "region":"Algarve","subregion":"Lagos/Portimão","seasonality":[1,2,3,4,5,6,7,8,9,10,11,12],
     "ingredients":["amêijoa","mexilhão","gamba","chouriço","pimento","tomate","coentros"],
     "techniques":["cataplana"],"dop_igp":False,"sustainability_score":65,"rarity_score":40,
     "authenticity_level":"regional","description":"Cozinhado na cataplana, recipiente árabe de cobre. O prato mais emblemático do Algarve.",
     "cultural_context":"herança árabe-moura do Algarve","health_profile":["rico_omega3","proteina"],
     "lat":37.1,"lng":-8.6,"iq_score":97},
    {"_id":"g_004","name":"Polvo à Lagareiro","type":"prato","category":"costeira",
     "region":"Alentejo Litoral","subregion":"Costa Vicentina","seasonality":[1,2,3,4,5,6,7,8,9,10,11,12],
     "ingredients":["polvo","batata a murro","azeite","alho","sal grosso"],
     "techniques":["assado","forno"],"dop_igp":False,"sustainability_score":78,"rarity_score":35,
     "authenticity_level":"nacional","description":"Polvo assado no forno com batatas a murro regadas a azeite em abundância.",
     "cultural_context":"gastronomia costeira, muito presente em festivais de verão",
     "health_profile":["rico_omega3","baixo_colesterol"],"lat":37.4,"lng":-9.0,"iq_score":94},
    {"_id":"g_005","name":"Sardinhas Assadas","type":"prato","category":"costeira",
     "region":"Costa Portuguesa","subregion":"Lisboa/Centro","seasonality":[6,7,8,9],
     "ingredients":["sardinha","sal grosso","broa de milho","pimento assado"],
     "techniques":["grelhado"],"dop_igp":False,"sustainability_score":85,"rarity_score":20,
     "authenticity_level":"nacional","description":"O prato do Verão português. Na brasa, com broa e um copo de vinho verde.",
     "cultural_context":"festas populares, Santo António, São João, São Pedro",
     "health_profile":["rico_omega3","rico_calcio"],"lat":38.7,"lng":-9.1,"iq_score":99},
    {"_id":"g_006","name":"Amêijoas à Bulhão Pato","type":"prato","category":"costeira",
     "region":"Lisboa","subregion":"Costa de Lisboa","seasonality":[1,2,3,4,5,6,7,8,9,10,11,12],
     "ingredients":["amêijoa","alho","coentros","azeite","limão","vinho branco"],
     "techniques":["guisado"],"dop_igp":False,"sustainability_score":60,"rarity_score":25,
     "authenticity_level":"nacional","description":"Amêijoas abertas em alho, coentros e vinho branco. Nome do poeta Raimundo Bulhão Pato.",
     "cultural_context":"tapa portuguesa por excelência, presente em tascos de Lisboa",
     "health_profile":["rico_ferro","proteina"],"lat":38.7,"lng":-9.1,"iq_score":96},
    {"_id":"g_007","name":"Bacalhau à Brás","type":"prato","category":"nacional",
     "region":"Lisboa","subregion":"Bairro Alto","seasonality":[1,2,3,4,5,6,7,8,9,10,11,12],
     "ingredients":["bacalhau","batata palha","ovos","cebola","azeitona","salsa"],
     "techniques":["frito","mexido"],"dop_igp":False,"sustainability_score":50,"rarity_score":15,
     "authenticity_level":"nacional","description":"Uma das 1001 receitas de bacalhau. Desfiado com batata palha e ovos mexidos.",
     "cultural_context":"cultura do bacalhau em Portugal — identidade nacional",
     "health_profile":["proteina","calcio"],"lat":38.7,"lng":-9.1,"iq_score":92},
    {"_id":"g_008","name":"Caldo Verde","type":"sopa","category":"nacional",
     "region":"Minho","subregion":"Minho/Norte","seasonality":[1,2,3,4,5,6,7,8,9,10,11,12],
     "ingredients":["couve galega","batata","chouriço","azeite","alho"],
     "techniques":["cozido"],"dop_igp":False,"sustainability_score":90,"rarity_score":10,
     "authenticity_level":"nacional","description":"A sopa nacional. Couve galega em fios finos com chouriço e batata.",
     "cultural_context":"festa, funeral, casamento — o caldo verde está em todo o lado",
     "health_profile":["fibra","vitamina_c"],"lat":41.5,"lng":-8.5,"iq_score":95},
    {"_id":"g_009","name":"Queijo Serra da Estrela","type":"queijo","category":"nacional",
     "region":"Beiras","subregion":"Serra da Estrela","seasonality":[11,12,1,2,3],
     "ingredients":["leite de ovelha bordaleira","cardo","sal"],
     "techniques":["curado"],"dop_igp":True,"sustainability_score":88,"rarity_score":75,
     "authenticity_level":"regional","description":"O queijo de pasta mole mais famoso de Portugal. Curado com cardo. DOP.",
     "cultural_context":"pastor e ovelha bordaleira da Serra da Estrela — patrimônio vivo",
     "health_profile":["calcio","proteina"],"lat":40.3,"lng":-7.6,"iq_score":98},
    {"_id":"g_010","name":"Vinho Verde Alvarinho","type":"vinho","category":"nacional",
     "region":"Minho","subregion":"Monção e Melgaço","seasonality":[1,2,3,4,5,6,7,8,9,10,11,12],
     "ingredients":["uva alvarinho"],"techniques":["fermentado"],
     "dop_igp":True,"sustainability_score":80,"rarity_score":50,
     "authenticity_level":"regional","description":"O melhor alvarinho de Portugal. Fresco, cítrico e floral. DOC Vinho Verde.",
     "cultural_context":"sub-região Monção e Melgaço, rio Minho","health_profile":["antioxidantes"],
     "lat":41.9,"lng":-8.3,"iq_score":96},
    {"_id":"g_011","name":"Azeite DOP Alentejo","type":"azeite","category":"nacional",
     "region":"Alentejo","subregion":"Moura/Vidigueira","seasonality":[11,12,1,2],
     "ingredients":["azeitona galega","azeitona cordovil"],
     "techniques":["prensado a frio"],"dop_igp":True,"sustainability_score":92,"rarity_score":45,
     "authenticity_level":"regional","description":"Azeite virgem extra de qualidade superior, frutado verde intenso. DOP Alentejo.",
     "cultural_context":"olivicultura alentejana milenar","health_profile":["gorduras_saudaveis","antioxidantes"],
     "lat":38.1,"lng":-7.4,"iq_score":95},
    {"_id":"g_012","name":"Alheira de Mirandela","type":"enchido","category":"nacional",
     "region":"Trás-os-Montes","subregion":"Mirandela","seasonality":[10,11,12,1,2,3],
     "ingredients":["carne de aves","pão","gordura","alho","pimentão"],
     "techniques":["fumado"],"dop_igp":True,"sustainability_score":70,"rarity_score":65,
     "authenticity_level":"regional","description":"Criada pelos judeus sefarditas para simular chouriço sem carne de porco. IGP.",
     "cultural_context":"história sefardita de Mirandela — resistência cultural",
     "health_profile":["proteina"],"lat":41.5,"lng":-7.2,"iq_score":93},
    {"_id":"g_013","name":"Pastéis de Belém","type":"doce","category":"nacional",
     "region":"Lisboa","subregion":"Belém","seasonality":[1,2,3,4,5,6,7,8,9,10,11,12],
     "ingredients":["massa folhada","creme de ovos","açúcar","canela","limão"],
     "techniques":["forno"],"dop_igp":False,"sustainability_score":60,"rarity_score":20,
     "authenticity_level":"nacional","description":"O pastel de nata original. Receita secreta do Mosteiro dos Jerónimos desde 1837.",
     "cultural_context":"Mosteiro dos Jerónimos, Belém — patrimônio conventual","health_profile":[],
     "lat":38.7,"lng":-9.2,"iq_score":99},
    {"_id":"g_014","name":"Açorda de Mariscos","type":"sopa","category":"costeira",
     "region":"Alentejo Litoral","subregion":"Costa Alentejana","seasonality":[1,2,3,4,5,6,7,8,9,10,11,12],
     "ingredients":["pão alentejano","gamba","coentros","alho","ovo","azeite"],
     "techniques":["cozido"],"dop_igp":False,"sustainability_score":68,"rarity_score":55,
     "authenticity_level":"regional","description":"Sopa de pão alentejano com marisco. Reconfortante e saborosa.",
     "cultural_context":"gastronomia alentejana litoral — fusão terra-mar",
     "health_profile":["proteina","fibra"],"lat":37.9,"lng":-8.8,"iq_score":91},
]

SEED_COASTAL_SPECIES: List[Dict[str, Any]] = [
    {"_id":"cs_001","name":"Sardinha","scientific_name":"Sardina pilchardus",
     "best_months":[6,7,8,9],"forbidden_months":[3,4,5],"fishing_method":"cerco",
     "sustainability_score":75,"traditional_recipes":["g_005"],"lat":38.5,"lng":-9.0,
     "description":"Pelágico pequeno, ícone do verão português. Defeso de Março a Maio."},
    {"_id":"cs_002","name":"Bacalhau","scientific_name":"Gadus morhua",
     "best_months":[1,2,3,4,5,6,7,8,9,10,11,12],"forbidden_months":[],
     "fishing_method":"palangre","sustainability_score":40,"traditional_recipes":["g_007"],
     "lat":38.7,"lng":-9.1,"description":"Seco e salgado. Diz-se que há 1001 receitas de bacalhau em Portugal."},
    {"_id":"cs_003","name":"Polvo","scientific_name":"Octopus vulgaris",
     "best_months":[1,2,3,4,5,6,7,8,9,10,11,12],"forbidden_months":[],
     "fishing_method":"nassas","sustainability_score":80,"traditional_recipes":["g_004"],
     "lat":37.1,"lng":-8.5,"description":"Capturado com nassas ao longo de toda a costa."},
    {"_id":"cs_004","name":"Amêijoa-boa","scientific_name":"Ruditapes decussatus",
     "best_months":[1,2,3,4,5,9,10,11,12],"forbidden_months":[6,7,8],
     "fishing_method":"apanha manual","sustainability_score":70,"traditional_recipes":["g_006"],
     "lat":37.0,"lng":-7.9,"description":"Bivalve da Ria Formosa e estuários. Apanha manual regulada."},
    {"_id":"cs_005","name":"Lingueirão","scientific_name":"Solen marginatus",
     "best_months":[3,4,5,6,7,8],"forbidden_months":[9,10,11,12,1,2],
     "fishing_method":"apanha manual","sustainability_score":60,"traditional_recipes":["g_002"],
     "lat":37.0,"lng":-7.9,"description":"Bivalve sazonal da Ria Formosa. Apanhado manualmente na maré baixa."},
]

SEED_ROUTES: List[Dict[str, Any]] = [
    {"_id":"gr_001","name":"Rota da Cataplana Algarvia","type":"costeira","region":"Algarve",
     "duration_hours":6,"difficulty":"facil","theme_tags":["marisco","cataplana","algarve"],
     "stops":["Olhão","Portimão","Lagos","Sagres"],"recommended_seasons":["primavera","verao"],
     "description":"Pelos melhores restaurantes de cataplana do Algarve, da Ria Formosa ao Algarve Vicentino.",
     "iq_score":96},
    {"_id":"gr_002","name":"Rota dos Sabores do Alentejo","type":"nacional","region":"Alentejo",
     "duration_hours":8,"difficulty":"facil","theme_tags":["azeite","vinho","queijo","enchidos"],
     "stops":["Évora","Estremoz","Moura","Vidigueira"],"recommended_seasons":["outono","inverno"],
     "description":"Azeites DOP, vinhos premiados, queijos de ovelha e enchidos fumados no coração do Alentejo.",
     "iq_score":95},
    {"_id":"gr_003","name":"Rota das Sardinhas Assadas","type":"costeira","region":"Costa Atlântica",
     "duration_hours":4,"difficulty":"facil","theme_tags":["sardinha","festa","verão","brasa"],
     "stops":["Sesimbra","Setúbal","Nazaré","Peniche"],"recommended_seasons":["verao"],
     "description":"Pelos melhores locais de sardinhas assadas na brasa do litoral atlântico.",
     "iq_score":92},
    {"_id":"gr_004","name":"Rota do Bacalhau","type":"produto","region":"Norte/Lisboa",
     "duration_hours":6,"difficulty":"facil","theme_tags":["bacalhau","Ílhavo","Lisboa"],
     "stops":["Ílhavo","Aveiro","Lisboa","Setúbal"],"recommended_seasons":["outono","inverno","primavera"],
     "description":"Das lotas e museus de bacalhau de Ílhavo às tascas de Lisboa.",
     "iq_score":88},
    {"_id":"gr_005","name":"Rota da Doçaria Conventual","type":"nacional","region":"Portugal",
     "duration_hours":8,"difficulty":"facil","theme_tags":["doce","conventual","história"],
     "stops":["Belém","Sintra","Évora","Alcobaça"],"recommended_seasons":["primavera","outono"],
     "description":"Pastéis de Belém, travesseiros de Sintra, queijadas de Évora, pastéis de Alcobaça.",
     "iq_score":94},
]

SEED_PAIRINGS: Dict[str, Dict] = {
    "g_001": {"wine":"Vinho Verde Loureiro","olive_oil":"Azeite Ribatejo frutado leve","notes":"Peixe branco pede acidez fresca"},
    "g_002": {"wine":"Alvarinho Monção e Melgaço","olive_oil":"Azeite Alentejo virgem extra","notes":"Marisco fresco + acidez do alvarinho = equilíbrio perfeito"},
    "g_003": {"wine":"Vinho Branco Encruzado Dão","olive_oil":"Azeite Algarve","notes":"Cataplana pede corpo e minerais"},
    "g_004": {"wine":"Vinhos Verdes Loureiro","olive_oil":"Azeite DOP Alentejo abundante","notes":"Lagareiro = azeite generoso + acidez do verde"},
    "g_005": {"wine":"Vinho Verde Loureiro","olive_oil":None,"notes":"Sardinha na brasa + verde fresco é clássico absoluto"},
    "g_007": {"wine":"Vinho Verde Loureiro ou Branco Arinto","olive_oil":None,"notes":"Bacalhau à Brás pede branco fresco"},
    "g_009": {"wine":"Dão Reserva Encruzado","olive_oil":"Azeite Beiras","notes":"Queijo Serra pede vinho com corpo e acidez"},
    "g_010": {"wine":"Alvarinho (harmoniza com marisco)","olive_oil":None,"notes":"O próprio vinho é a harmonização"},
}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _haversine(lat1, lng1, lat2, lng2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    a = math.sin(math.radians(lat2-lat1)/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(math.radians(lng2-lng1)/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def _serialize(doc):
    doc = dict(doc); doc["id"] = str(doc.pop("_id", doc.get("id",""))); return doc

async def _col_or_seed(col, seed):
    if _db is None:
        return [dict(d) for d in seed]
    try:
        docs = await _db[col].find({}).to_list(500)
        if docs: return [_serialize(d) for d in docs]
    except Exception: pass
    return [dict(d) for d in seed]

def _current_month():
    return datetime.now(timezone.utc).month


# ─── Items ───────────────────────────────────────────────────────────────────

@gastronomy_router.get("/items")
async def list_items(
    type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    dop_igp: Optional[bool] = Query(None),
    sustainability_min: Optional[int] = Query(None, ge=0, le=100),
    rarity_min: Optional[int] = Query(None, ge=0, le=100),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    items = await _col_or_seed("gastronomy_items", SEED_ITEMS)
    if type: items = [i for i in items if i.get("type") == type]
    if category: items = [i for i in items if i.get("category") == category]
    if region: items = [i for i in items if region.lower() in i.get("region","").lower()]
    if month: items = [i for i in items if month in i.get("seasonality", [])]
    if dop_igp is not None: items = [i for i in items if i.get("dop_igp") == dop_igp]
    if sustainability_min: items = [i for i in items if i.get("sustainability_score",0) >= sustainability_min]
    if rarity_min: items = [i for i in items if i.get("rarity_score",0) >= rarity_min]
    if search:
        pat = re.compile(search, re.IGNORECASE)
        items = [i for i in items if pat.search(i.get("name","") + " " + i.get("description",""))]
    total = len(items)
    return {"total": total, "offset": offset, "limit": limit, "results": items[offset:offset+limit]}


@gastronomy_router.get("/items/seasonal")
async def seasonal_items(month: Optional[int] = Query(None)):
    m = month or _current_month()
    items = await _col_or_seed("gastronomy_items", SEED_ITEMS)
    results = [i for i in items if m in i.get("seasonality", list(range(1,13)))]
    return {"month": m, "total": len(results), "results": results}


@gastronomy_router.get("/items/nearby")
async def items_nearby(
    lat: float = Query(...), lng: float = Query(...),
    radius_km: float = Query(50.0, le=300.0),
    month: Optional[int] = Query(None),
):
    items = await _col_or_seed("gastronomy_items", SEED_ITEMS)
    m = month or _current_month()
    results = []
    for item in items:
        if not item.get("lat"): continue
        dist = _haversine(lat, lng, item["lat"], item["lng"])
        if dist <= radius_km and m in item.get("seasonality", list(range(1,13))):
            results.append({**item, "distance_km": round(dist,1)})
    results.sort(key=lambda x: x["distance_km"])
    return {"lat": lat, "lng": lng, "radius_km": radius_km, "month": m, "total": len(results), "results": results}


@gastronomy_router.get("/items/{item_id}")
async def get_item(item_id: str):
    items = await _col_or_seed("gastronomy_items", SEED_ITEMS)
    for i in items:
        if str(i.get("_id", i.get("id",""))) == item_id:
            return i
    raise HTTPException(404, "Item não encontrado")


# ─── Species ─────────────────────────────────────────────────────────────────

@gastronomy_router.get("/species")
async def list_species(season: Optional[str] = Query(None)):
    items = await _col_or_seed("coastal_species", SEED_COASTAL_SPECIES)
    m = _current_month()
    if season == "current":
        items = [i for i in items if m in i.get("best_months",[])]
    for item in items:
        item["in_season_now"] = m in item.get("best_months",[])
        item["forbidden_now"] = m in item.get("forbidden_months",[])
    return {"month": m, "total": len(items), "results": items}


# ─── Routes ──────────────────────────────────────────────────────────────────

@gastronomy_router.get("/routes")
async def list_routes(
    type: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    season: Optional[str] = Query(None),
):
    items = await _col_or_seed("gastronomy_routes", SEED_ROUTES)
    if type: items = [i for i in items if i.get("type") == type]
    if region: items = [i for i in items if region.lower() in i.get("region","").lower()]
    if season: items = [i for i in items if season.lower() in [s.lower() for s in i.get("recommended_seasons",[])]]
    items.sort(key=lambda x: x.get("iq_score",0), reverse=True)
    return {"total": len(items), "results": items}


# ─── Pairing (AI or static) ──────────────────────────────────────────────────

@gastronomy_router.get("/pairing/{item_id}")
async def get_pairing(
    item_id: str,
    current_user: User = Depends(_auth_dep),
):
    static = SEED_PAIRINGS.get(item_id)
    if static:
        return {"item_id": item_id, **static, "source": "curated"}
    items = await _col_or_seed("gastronomy_items", SEED_ITEMS)
    item = next((i for i in items if str(i.get("_id",i.get("id",""))) == item_id), None)
    if not item:
        raise HTTPException(404, "Item não encontrado")
    if not _llm_key:
        return {"item_id": item_id, "wine": "Vinho branco fresco", "olive_oil": "Azeite virgem extra", "notes": "Harmonização genérica", "source": "fallback"}
    prompt = f"""Sugere harmonização de vinho e azeite para o prato português: "{item['name']}" ({item.get('description','')}).
Responde em JSON: {{"wine": "nome do vinho/região", "olive_oil": "azeite ou null", "notes": "explicação breve"}}"""
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(
                "https://llm.lil.re.emergentmethods.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {_llm_key}", "Content-Type": "application/json"},
                json={"model":"gpt-4o-mini","messages":[{"role":"user","content":prompt}],
                      "temperature":0.4,"response_format":{"type":"json_object"}},
            )
        import json as _j
        return {**_j.loads(resp.json()["choices"][0]["message"]["content"]), "item_id": item_id, "source": "ai"}
    except Exception:
        return {"item_id": item_id, "wine": "Vinho branco fresco", "olive_oil": "Azeite virgem extra", "notes": "Harmonização genérica", "source": "fallback"}


# ─── Recommendations ─────────────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    lat: float; lng: float
    radius_km: float = Field(default=50.0, ge=1.0, le=300.0)
    context: str = Field(default="mar", description="mar | serra | cidade | interior")
    month: Optional[int] = None
    limit: int = Field(default=10, ge=1, le=50)

@gastronomy_router.post("/recommend")
async def recommend(body: RecommendRequest):
    items = await _col_or_seed("gastronomy_items", SEED_ITEMS)
    m = body.month or _current_month()
    results = []
    for item in items:
        if not item.get("lat"): continue
        if m not in item.get("seasonality", list(range(1,13))): continue
        dist = _haversine(body.lat, body.lng, item["lat"], item["lng"])
        if dist > body.radius_km: continue
        prox = max(0.0, 1.0 - dist/body.radius_km)
        iq = item.get("iq_score",75)/100.0
        score = 0.5*prox + 0.5*iq
        if body.context == "mar" and item.get("category") == "costeira":
            score = min(1.0, score * 1.15)
        results.append({**item, "distance_km": round(dist,1), "score": round(score,3)})
    results.sort(key=lambda x: x["score"], reverse=True)
    return {"lat":body.lat,"lng":body.lng,"month":m,"context":body.context,"total":len(results),"results":results[:body.limit]}


# ─── Stats ───────────────────────────────────────────────────────────────────

@gastronomy_router.get("/stats")
async def gastronomy_stats():
    items = await _col_or_seed("gastronomy_items", SEED_ITEMS)
    routes = await _col_or_seed("gastronomy_routes", SEED_ROUTES)
    by_type: Dict[str,int] = {}
    dop_count = sum(1 for i in items if i.get("dop_igp"))
    for i in items:
        t = i.get("type","?"); by_type[t] = by_type.get(t,0)+1
    m = _current_month()
    seasonal_now = sum(1 for i in items if m in i.get("seasonality", list(range(1,13))))
    return {"total_items":len(items),"by_type":by_type,"dop_igp_count":dop_count,
            "seasonal_now":seasonal_now,"routes_total":len(routes),
            "current_month":m,"updated_at":datetime.now(timezone.utc).isoformat()}
