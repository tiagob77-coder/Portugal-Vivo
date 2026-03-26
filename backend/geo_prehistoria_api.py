"""
Geo-Pré-História API — Geossítios, Megalitos, Arte Rupestre, Astronomia
MongoDB Atlas (Motor async) · FastAPI
"""
from __future__ import annotations
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

geo_prehistoria_router = APIRouter(prefix="/geo-prehistoria", tags=["GeoPrehistoria"])
_db = None

def set_geo_prehistoria_db(database) -> None:
    global _db
    _db = database

# ─── Seed data ────────────────────────────────────────────────────────────────

SEED_SITES: List[Dict[str, Any]] = [
    {"_id":"gp_001","name":"Cromeleque dos Almendres","category":"megalito","subcategory":"cromeleque","period":"Neolitico","region":"Alentejo","municipality":"Évora","lat":38.5588,"lng":-8.0740,"description_short":"Maior conjunto megalítico da Península Ibérica: 95 menires em elipse, c. 6000 a.C.","description_long":"O Cromeleque dos Almendres é o maior recinto megalítico da Península Ibérica, com 95 menires dispostos em elipse dupla. Alinhado com o nascer do sol no solstício de verão e equinócios, terá servido como observatório e local de culto neolítico. A 2 km encontra-se o Menir dos Almendres, solitário sentinela com gravuras de báculo e ziguezague.","motifs_findings":["báculo","ziguezague","círculos","covinhas"],"age_years":8000,"orientation":67.5,"astronomical_type":"solsticio","alignment_azimuth":67.5,"celestial_event":{"solstice":"summer","description":"Nascer do sol alinha com o eixo maior no solstício de verão"},"iq_score":98},
    {"_id":"gp_002","name":"Anta Grande do Zambujeiro","category":"megalito","subcategory":"dolmen","period":"Neolitico","region":"Alentejo","municipality":"Évora","lat":38.5241,"lng":-8.1233,"description_short":"Maior anta de Portugal: câmara com 6m de altura, c. 4000 a.C.","description_long":"A Anta Grande do Zambujeiro é o maior dólmen de Portugal e um dos maiores da Europa. A câmara funerária atinge 6 metros de altura, com esteios de granito de dimensões excepcionais. Orientada para o nascer do sol equinócio, integra o conjunto megalítico alentejano de excepcional densidade.","motifs_findings":["esteios gravados","ocre vermelho"],"age_years":6000,"orientation":90.0,"astronomical_type":"equinocio","alignment_azimuth":90.0,"iq_score":96},
    {"_id":"gp_003","name":"Arte Rupestre do Vale do Côa","category":"rupestre","subcategory":"gravura_paleolitica","period":"Paleolitico","region":"Trás-os-Montes","municipality":"Vila Nova de Foz Côa","lat":41.0756,"lng":-7.1014,"description_short":"Maior conjunto de arte paleolítica ao ar livre do mundo, 25.000–10.000 a.C. Património Mundial UNESCO.","description_long":"O Parque Arqueológico do Vale do Côa preserva o maior conjunto de arte rupestre paleolítica ao ar livre do mundo. As gravuras representam auroques, cavalos, cervídeos e figuras humanas, executadas entre 25.000 e 10.000 a.C. junto ao Rio Côa. Classificado como Património Mundial pela UNESCO em 1998.","motifs_findings":["auroques","cavalos","cervídeos","figuras humanas","peixe"],"age_years":25000,"iq_score":99},
    {"_id":"gp_004","name":"Cromeleque de Xerez","category":"megalito","subcategory":"cromeleque","period":"Neolitico","region":"Alentejo","municipality":"Beja","lat":37.8932,"lng":-7.4821,"description_short":"Recinto megalítico com 47 menires, alinhado com equinócios, submerso parcialmente pela albufeira.","motifs_findings":["covinhas","sulcos"],"age_years":6500,"orientation":90.0,"astronomical_type":"equinocio","alignment_azimuth":90.0,"iq_score":88},
    {"_id":"gp_005","name":"Citânia de Briteiros","category":"arqueologico","subcategory":"castro","period":"Ferro","region":"Minho","municipality":"Guimarães","lat":41.5598,"lng":-8.3841,"description_short":"Grande castro proto-histórico (séc. IV a.C.–II d.C.) com ~150 estruturas circulares em granito.","description_long":"A Citânia de Briteiros é o maior castro do noroeste peninsular, ocupado desde o séc. IV a.C. até ao séc. II d.C. Conserva mais de 150 estruturas habitacionais circulares em granito, muralhas, calçadas e uma pedra de sacrifícios. Escavada por Francisco Martins Sarmento a partir de 1875.","motifs_findings":["pedra formosa","decoração geométrica","inscrições latinas"],"age_years":2400,"iq_score":95},
    {"_id":"gp_006","name":"Arte Rupestre do Rio Tejo — Vila Velha de Ródão","category":"rupestre","subcategory":"gravura_rupestre","period":"Paleolitico","region":"Beira Interior","municipality":"Vila Velha de Ródão","lat":39.6558,"lng":-7.6741,"description_short":"Gravuras rupestres paleolíticas e neolíticas nas Portas de Ródão, afluentes do Tejo.","motifs_findings":["veados","auroques","cavalos","figuras esquemáticas"],"age_years":20000,"iq_score":90},
    {"_id":"gp_007","name":"Castelo Velho de Freixo de Numão","category":"santuario","subcategory":"recinto_calcolítico","period":"Calcolitico","region":"Trás-os-Montes","municipality":"Vila Nova de Foz Côa","lat":41.1543,"lng":-7.2234,"description_short":"Recinto calcolítico com funções rituais e simbólicas, c. 3000–2000 a.C.","motifs_findings":["ídolos","cerâmica campaniforme","ossos humanos"],"age_years":4500,"iq_score":87},
    {"_id":"gp_008","name":"Mamoa da Facha","category":"megalito","subcategory":"mamoa","period":"Neolitico","region":"Minho","municipality":"Ponte de Lima","lat":41.7321,"lng":-8.5892,"description_short":"Mamoa funerária neolítica bem conservada no Alto Minho.","motifs_findings":["corredor coberto","câmara circular"],"age_years":5500,"iq_score":82},
    {"_id":"gp_009","name":"Arte Rupestre de Chãs de Égua","category":"rupestre","subcategory":"gravura_rupestre","period":"Neolitico","region":"Centro","municipality":"Arganil","lat":40.1423,"lng":-7.9812,"description_short":"Gravuras esquemáticas com possíveis orientações solares, neolítico.","motifs_findings":["círculos solares","espirais","covinhas"],"age_years":5000,"astronomical_type":"solar","alignment_azimuth":113.0,"iq_score":80},
    {"_id":"gp_010","name":"Geossítio de Penedo Gordo","category":"geositio","subcategory":"afloramento_granitico","period":"Calcolitico","region":"Centro","municipality":"Viseu","lat":40.6621,"lng":-7.9134,"description_short":"Afloramento granítico com covinhas rituais e vista privilegiada sobre o vale do Mondego.","motifs_findings":["covinhas","sulcos lineares"],"age_years":4000,"iq_score":78},
    {"_id":"gp_011","name":"Dólmen de Antelas","category":"megalito","subcategory":"dolmen","period":"Neolitico","region":"Centro","municipality":"Oliveira de Frades","lat":40.7321,"lng":-8.1654,"description_short":"Dólmen de câmara poligonal com corredor, espólio neolítico rico em cerâmica e sílex.","motifs_findings":["cerâmica","pontas de seta","contas de colar"],"age_years":5800,"iq_score":84},
    {"_id":"gp_012","name":"Menhir de Bulhoa","category":"megalito","subcategory":"menir","period":"Neolitico","region":"Alentejo","municipality":"Reguengos de Monsaraz","lat":38.4192,"lng":-7.5321,"description_short":"Menir isolado de 3.5m, com gravuras de báculo e orientação astronómica documentada.","motifs_findings":["báculo","serpentiforme"],"age_years":6000,"orientation":62.0,"astronomical_type":"solar","alignment_azimuth":62.0,"iq_score":85},
]

SEED_ROUTES: List[Dict[str, Any]] = [
    {"_id":"gpr_001","name":"Rota Megalítica Alentejana","category":"megalitismo","region":"Alentejo","distance_km":45,"duration_hours":6,"sites":["gp_001","gp_002","gp_004","gp_012"],"description":"Do Cromeleque dos Almendres ao Zambujeiro, percorrendo o coração do megalitismo alentejano com paragem nos principais cromeleques e antas.","highlights":["Cromeleque Almendres ao pôr do sol","Anta do Zambujeiro ao amanhecer","Cromeleque de Xerez"],"tags":["megalitos","astronomia","neolítico"],"iq_score":96},
    {"_id":"gpr_002","name":"Arte Rupestre Côa + Geossítios","category":"rupestre_geossitios","region":"Trás-os-Montes","distance_km":60,"duration_hours":8,"sites":["gp_003","gp_007","gp_010"],"description":"Visita ao Parque Arqueológico do Vale do Côa e sítios calcolíticos circundantes.","highlights":["Penascosa ao pôr do sol","Canada do Inferno","Castelo Velho de Freixo"],"tags":["rupestre","paleolítico","UNESCO"],"iq_score":98},
    {"_id":"gpr_003","name":"Astronomia Pré-Histórica — Alinhamentos Sagrados","category":"astronomia","region":"Alentejo","distance_km":50,"duration_hours":7,"sites":["gp_001","gp_002","gp_004","gp_012"],"description":"Rota dedicada aos alinhamentos astronómicos: solstícios, equinócios e orientações solares/lunares nos monumentos megalíticos alentejanos.","highlights":["Solstício de verão em Almendres","Equinócio em Xerez","Menir de Bulhoa"],"tags":["astronomia","solstício","equinócio","megalitos"],"iq_score":94},
    {"_id":"gpr_004","name":"Rupestre e Megalitismo do Alto Minho","category":"rupestre_megalitismo","region":"Minho","distance_km":80,"duration_hours":10,"sites":["gp_005","gp_008"],"description":"Norte de Portugal: castros proto-históricos, mamoas neolíticas e arte rupestre nos vales do Lima e Cávado.","highlights":["Citânia de Briteiros","Mamoas do Alto Minho"],"tags":["minho","castro","neolítico","Ferro"],"iq_score":89},
]

ASTRO_EVENTS = [
    {"event":"solsticio_verao","date":"2026-06-21","azimuth_sunrise":61.5,"description":"Solstício de Verão — nascer do sol a NE (azimute ~62°). Almendres, Bulhoa e outros menires orientados para este momento."},
    {"event":"solsticio_inverno","date":"2026-12-21","azimuth_sunrise":118.5,"description":"Solstício de Inverno — nascer do sol a SE (azimute ~119°). Muitas antas alentejanas apontam para este evento."},
    {"event":"equinócio_primavera","date":"2026-03-20","azimuth_sunrise":90.0,"description":"Equinócio de Primavera — nascer do sol exatamente a Este (azimute 90°). Zambujeiro e Xerez alinham com este momento."},
    {"event":"equinócio_outono","date":"2026-09-22","azimuth_sunrise":90.0,"description":"Equinócio de Outono — nascer do sol a Este (azimute 90°)."},
]

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _haversine(lat1, lng1, lat2, lng2):
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def _solar_azimuth_sunrise(lat_deg: float, day_of_year: int) -> float:
    """Approximate azimuth of sunrise for a given latitude and day."""
    decl = math.radians(-23.45 * math.cos(math.radians(360/365*(day_of_year+10))))
    lat = math.radians(lat_deg)
    cos_az = math.sin(decl) / math.cos(lat)
    cos_az = max(-1.0, min(1.0, cos_az))
    return round(math.degrees(math.acos(cos_az)), 1)

def _serialize(doc: Dict) -> Dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id", doc.get("id", "")))
    return doc

async def _collection_or_seed(col: str, seed: List[Dict]) -> List[Dict]:
    if _db is None:
        return [dict(d) for d in seed]
    try:
        docs = await _db[col].find({}).to_list(1000)
        if docs:
            return [_serialize(d) for d in docs]
    except Exception:
        pass
    return [dict(d) for d in seed]

# ─── Endpoints ────────────────────────────────────────────────────────────────

@geo_prehistoria_router.get("/sites")
async def list_sites(
    category: Optional[str] = Query(None, description="geositio|megalito|rupestre|santuario|arqueologico"),
    period: Optional[str] = Query(None, description="Paleolitico|Neolitico|Calcolitico|Bronze|Ferro"),
    astronomical: Optional[bool] = Query(None, description="Apenas sítios com alinhamentos astronómicos"),
    region: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    items = await _collection_or_seed("prehistoria_sites", SEED_SITES)
    if category:
        items = [i for i in items if i.get("category") == category]
    if period:
        items = [i for i in items if i.get("period") == period]
    if astronomical is True:
        items = [i for i in items if i.get("astronomical_type")]
    if region:
        items = [i for i in items if region.lower() in i.get("region","").lower()]
    if search:
        s = search.lower()
        items = [i for i in items if s in i.get("name","").lower() or s in i.get("description_short","").lower()]
    total = len(items)
    return {"total": total, "offset": offset, "limit": limit, "results": items[offset:offset+limit]}


@geo_prehistoria_router.get("/sites/{site_id}")
async def get_site(site_id: str):
    items = await _collection_or_seed("prehistoria_sites", SEED_SITES)
    for item in items:
        if str(item.get("_id", item.get("id",""))) == site_id:
            return item
    raise HTTPException(404, "Sítio não encontrado")


@geo_prehistoria_router.get("/nearby")
async def nearby_sites(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(50.0, ge=1, le=500),
    category: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
):
    items = await _collection_or_seed("prehistoria_sites", SEED_SITES)
    if category:
        items = [i for i in items if i.get("category") == category]
    results = []
    for item in items:
        ilat, ilng = item.get("lat"), item.get("lng")
        if ilat is None or ilng is None:
            continue
        d = _haversine(lat, lng, ilat, ilng)
        if d <= radius_km:
            results.append({**item, "distance_km": round(d, 2)})
    results.sort(key=lambda x: x["distance_km"])
    return {"total": len(results), "results": results[:limit]}


@geo_prehistoria_router.get("/routes")
async def list_routes(
    category: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    max_hours: Optional[float] = Query(None),
):
    items = await _collection_or_seed("prehistoria_routes", SEED_ROUTES)
    if category:
        items = [i for i in items if i.get("category") == category]
    if region:
        items = [i for i in items if region.lower() in i.get("region","").lower()]
    if max_hours:
        items = [i for i in items if i.get("duration_hours", 999) <= max_hours]
    items.sort(key=lambda x: x.get("iq_score",0), reverse=True)
    return {"total": len(items), "results": items}


@geo_prehistoria_router.get("/astro/events")
async def astro_events(region: Optional[str] = Query(None)):
    """Próximos eventos astronómicos relevantes para sítios pré-históricos."""
    today = datetime.now(timezone.utc).date()
    upcoming = [e for e in ASTRO_EVENTS if e["date"] >= str(today)]
    return {"events": upcoming, "all": ASTRO_EVENTS}


@geo_prehistoria_router.get("/astro/simulate")
async def astro_simulate(
    lat: float = Query(..., description="Latitude do sítio"),
    day_of_year: int = Query(..., ge=1, le=366, description="Dia do ano (1=1Jan, 172=21Jun)"),
):
    """
    Calcula o azimute do nascer do sol para uma dada latitude e dia.
    Útil para validar alinhamentos megalíticos.
    """
    az = _solar_azimuth_sunrise(lat, day_of_year)
    # Day of year to approximate date
    dt = datetime(2026, 1, 1) + __import__("datetime").timedelta(days=day_of_year-1)
    events_near = []
    solstices = {172: "Solstício de Verão (21 Jun)", 355: "Solstício de Inverno (21 Dez)", 79: "Equinócio de Primavera (20 Mar)", 265: "Equinócio de Outono (22 Set)"}
    for d, name in solstices.items():
        if abs(day_of_year - d) <= 3:
            events_near.append(name)
    return {
        "lat": lat,
        "day_of_year": day_of_year,
        "approx_date": dt.strftime("%d %b"),
        "azimuth_sunrise": az,
        "azimuth_sunset": round(360 - az, 1),
        "nearby_events": events_near,
        "note": "Azimute aproximado (fórmula solar simplificada). Para precisão arqueológica use Skyfield.",
    }


@geo_prehistoria_router.get("/astro/alignments")
async def aligned_sites(
    event: str = Query(..., description="solsticio_verao|solsticio_inverno|equinocio_primavera|equinocio_outono"),
    tolerance_deg: float = Query(5.0, ge=1, le=30),
):
    """Sítios com alinhamento astronómico próximo do evento solicitado."""
    target_az = {"solsticio_verao": 62.0, "solsticio_inverno": 118.0, "equinocio_primavera": 90.0, "equinocio_outono": 90.0}.get(event)
    if target_az is None:
        raise HTTPException(400, "Evento inválido. Use: solsticio_verao|solsticio_inverno|equinocio_primavera|equinocio_outono")
    items = await _collection_or_seed("prehistoria_sites", SEED_SITES)
    aligned = []
    for item in items:
        az = item.get("alignment_azimuth")
        if az is not None and abs(az - target_az) <= tolerance_deg:
            diff = round(abs(az - target_az), 1)
            aligned.append({**item, "azimuth_diff_deg": diff})
    aligned.sort(key=lambda x: x["azimuth_diff_deg"])
    return {"event": event, "target_azimuth": target_az, "tolerance_deg": tolerance_deg, "total": len(aligned), "sites": aligned}


class RecommendRequest(BaseModel):
    lat: float
    lng: float
    radius_km: float = Field(default=100.0, ge=1, le=500)
    interests: List[str] = Field(default_factory=list)
    limit: int = Field(default=10, ge=1, le=50)


@geo_prehistoria_router.post("/recommendations")
async def recommendations(body: RecommendRequest):
    items = await _collection_or_seed("prehistoria_sites", SEED_SITES)
    scored = []
    for item in items:
        ilat, ilng = item.get("lat"), item.get("lng")
        if ilat is None or ilng is None:
            continue
        d = _haversine(body.lat, body.lng, ilat, ilng)
        if d > body.radius_km:
            continue
        prox = max(0.0, 1.0 - d / body.radius_km)
        iq = item.get("iq_score", 75) / 100.0
        score = 0.5 * prox + 0.5 * iq
        if body.interests:
            tags = [item.get("category",""), item.get("period",""), item.get("astronomical_type","")]
            if any(i.lower() in " ".join(tags).lower() for i in body.interests):
                score = min(1.0, score * 1.15)
        scored.append({**item, "distance_km": round(d,2), "score": round(score,3)})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return {"total": len(scored), "results": scored[:body.limit]}


@geo_prehistoria_router.get("/stats")
async def stats():
    items = await _collection_or_seed("prehistoria_sites", SEED_SITES)
    routes = await _collection_or_seed("prehistoria_routes", SEED_ROUTES)
    cats = {}
    for i in items:
        c = i.get("category","outro")
        cats[c] = cats.get(c, 0) + 1
    astro = sum(1 for i in items if i.get("astronomical_type"))
    return {"total_sites": len(items), "by_category": cats, "with_astronomy": astro, "routes": len(routes), "updated_at": datetime.now(timezone.utc).isoformat()}
