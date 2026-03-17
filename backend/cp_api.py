"""
CP Comboios de Portugal - Train Data API
Real station data, routes, and live departure/status integration.
Tries CP's live API first, falls back to static schedule data.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from shared_constants import sanitize_regex

cp_router = APIRouter(prefix="/cp", tags=["CP Comboios"])

# Real CP stations with coordinates
CP_STATIONS = [
    {"id": "lisboa_santa_apolonia", "name": "Lisboa Santa Apolonia", "city": "Lisboa", "lat": 38.7138, "lng": -9.1227, "lines": ["Linha do Norte", "Linha da Beira Baixa"]},
    {"id": "lisboa_oriente", "name": "Lisboa Oriente", "city": "Lisboa", "lat": 38.7681, "lng": -9.0988, "lines": ["Linha do Norte", "Linha de Sintra"]},
    {"id": "porto_campanha", "name": "Porto Campanha", "city": "Porto", "lat": 41.1487, "lng": -8.5856, "lines": ["Linha do Norte", "Linha do Douro", "Linha do Minho"]},
    {"id": "porto_sao_bento", "name": "Porto Sao Bento", "city": "Porto", "lat": 41.1456, "lng": -8.6109, "lines": ["Linha do Douro", "Linha do Minho"]},
    {"id": "coimbra_b", "name": "Coimbra-B", "city": "Coimbra", "lat": 40.2225, "lng": -8.4371, "lines": ["Linha do Norte", "Linha da Beira Alta"]},
    {"id": "coimbra", "name": "Coimbra", "city": "Coimbra", "lat": 40.2088, "lng": -8.4304, "lines": ["Ramal de Coimbra"]},
    {"id": "aveiro", "name": "Aveiro", "city": "Aveiro", "lat": 40.6439, "lng": -8.6453, "lines": ["Linha do Norte", "Linha do Vouga"]},
    {"id": "braga", "name": "Braga", "city": "Braga", "lat": 41.5497, "lng": -8.4317, "lines": ["Linha de Braga"]},
    {"id": "guimaraes", "name": "Guimaraes", "city": "Guimaraes", "lat": 41.4431, "lng": -8.2903, "lines": ["Linha de Guimaraes"]},
    {"id": "faro", "name": "Faro", "city": "Faro", "lat": 37.0189, "lng": -7.9352, "lines": ["Linha do Algarve"]},
    {"id": "lagos", "name": "Lagos", "city": "Lagos", "lat": 37.1046, "lng": -8.6783, "lines": ["Linha do Algarve"]},
    {"id": "evora", "name": "Evora", "city": "Evora", "lat": 38.5717, "lng": -7.9063, "lines": ["Linha do Alentejo"]},
    {"id": "beja", "name": "Beja", "city": "Beja", "lat": 38.0146, "lng": -7.8632, "lines": ["Linha do Alentejo"]},
    {"id": "tunes", "name": "Tunes", "city": "Silves", "lat": 37.1522, "lng": -8.2194, "lines": ["Linha do Algarve", "Ramal de Lagos"]},
    {"id": "entroncamento", "name": "Entroncamento", "city": "Entroncamento", "lat": 39.4637, "lng": -8.4686, "lines": ["Linha do Norte", "Linha da Beira Baixa"]},
    {"id": "santarem", "name": "Santarem", "city": "Santarem", "lat": 39.2369, "lng": -8.6819, "lines": ["Linha do Norte"]},
    {"id": "leiria", "name": "Leiria", "city": "Leiria", "lat": 39.7433, "lng": -8.8069, "lines": ["Linha do Oeste"]},
    {"id": "viseu", "name": "Viseu", "city": "Viseu", "lat": 40.6571, "lng": -7.9117, "lines": []},
    {"id": "viana_castelo", "name": "Viana do Castelo", "city": "Viana do Castelo", "lat": 41.6939, "lng": -8.8296, "lines": ["Linha do Minho"]},
    {"id": "valenca", "name": "Valenca", "city": "Valenca", "lat": 42.0267, "lng": -8.6429, "lines": ["Linha do Minho"]},
    {"id": "regua", "name": "Peso da Regua", "city": "Peso da Regua", "lat": 41.1621, "lng": -7.7895, "lines": ["Linha do Douro"]},
    {"id": "pocinho", "name": "Pocinho", "city": "Vila Nova de Foz Coa", "lat": 41.0833, "lng": -7.1167, "lines": ["Linha do Douro"]},
    {"id": "tomar", "name": "Tomar", "city": "Tomar", "lat": 39.6022, "lng": -8.4108, "lines": ["Ramal de Tomar"]},
    {"id": "castelo_branco", "name": "Castelo Branco", "city": "Castelo Branco", "lat": 39.8183, "lng": -7.4908, "lines": ["Linha da Beira Baixa"]},
    {"id": "guarda", "name": "Guarda", "city": "Guarda", "lat": 40.5375, "lng": -7.2672, "lines": ["Linha da Beira Alta"]},
    {"id": "sintra", "name": "Sintra", "city": "Sintra", "lat": 38.7986, "lng": -9.3811, "lines": ["Linha de Sintra"]},
    {"id": "cascais", "name": "Cascais", "city": "Cascais", "lat": 38.6966, "lng": -9.4209, "lines": ["Linha de Cascais"]},
    {"id": "setubal", "name": "Setubal", "city": "Setubal", "lat": 38.5244, "lng": -8.8882, "lines": ["Linha do Sado"]},
    {"id": "albufeira", "name": "Albufeira-Ferreiras", "city": "Albufeira", "lat": 37.1016, "lng": -8.2481, "lines": ["Linha do Algarve"]},
    {"id": "portimao", "name": "Portimao", "city": "Portimao", "lat": 37.1355, "lng": -8.5361, "lines": ["Ramal de Lagos"]},
]

# Common CP routes with real estimated times and prices
CP_ROUTES = [
    {
        "id": "lisboa_porto_ap",
        "name": "Lisboa - Porto (Alfa Pendular)",
        "service": "Alfa Pendular",
        "origin": "Lisboa Santa Apolonia",
        "destination": "Porto Campanha",
        "duration_min": 155,
        "price_2class": 25.10,
        "price_1class": 35.50,
        "price_confort": 42.00,
        "frequency": "Horario (6h-21h)",
        "stops": ["Lisboa Oriente", "Santarem", "Entroncamento", "Coimbra-B", "Aveiro", "Gaia"],
        "departures": ["06:03", "07:03", "08:03", "09:03", "10:03", "11:03", "12:03", "13:03", "14:03", "15:03", "16:03", "17:03", "18:03", "19:03", "20:03", "21:03"],
    },
    {
        "id": "lisboa_porto_ic",
        "name": "Lisboa - Porto (Intercidades)",
        "service": "Intercidades",
        "origin": "Lisboa Santa Apolonia",
        "destination": "Porto Campanha",
        "duration_min": 195,
        "price_2class": 19.50,
        "price_1class": 28.70,
        "frequency": "Horario",
        "stops": ["Lisboa Oriente", "Santarem", "Entroncamento", "Coimbra-B", "Aveiro"],
        "departures": ["06:30", "08:30", "10:30", "12:30", "14:30", "16:30", "18:30", "20:30"],
    },
    {
        "id": "lisboa_faro_ic",
        "name": "Lisboa - Faro (Intercidades)",
        "service": "Intercidades",
        "origin": "Lisboa Oriente",
        "destination": "Faro",
        "duration_min": 180,
        "price_2class": 22.75,
        "price_1class": 32.10,
        "frequency": "5-6 comboios/dia",
        "stops": ["Setubal", "Grandola", "Beja", "Tunes", "Albufeira"],
        "departures": ["07:01", "09:01", "11:01", "14:01", "17:01", "19:31"],
    },
    {
        "id": "lisboa_evora_ic",
        "name": "Lisboa - Evora (Intercidades)",
        "service": "Intercidades",
        "origin": "Lisboa Oriente",
        "destination": "Evora",
        "duration_min": 95,
        "price_2class": 12.50,
        "price_1class": 18.20,
        "frequency": "4 comboios/dia",
        "stops": ["Pinhal Novo", "Vendas Novas", "Casa Branca"],
        "departures": ["08:12", "12:12", "16:12", "18:42"],
    },
    {
        "id": "porto_braga_urb",
        "name": "Porto - Braga (Urbano)",
        "service": "Urbano do Porto",
        "origin": "Porto Sao Bento",
        "destination": "Braga",
        "duration_min": 65,
        "price_2class": 3.25,
        "frequency": "Cada 30 min (ponta), 60 min (fora ponta)",
        "stops": ["Porto Campanha", "Lousado", "Famalicao", "Nine"],
        "departures": ["06:15", "06:45", "07:15", "07:45", "08:15", "09:15", "10:15", "11:15", "12:15", "13:15", "14:15", "15:15", "16:15", "16:45", "17:15", "17:45", "18:15", "18:45", "19:15", "20:15", "21:15"],
    },
    {
        "id": "porto_guimaraes_urb",
        "name": "Porto - Guimaraes (Urbano)",
        "service": "Urbano do Porto",
        "origin": "Porto Sao Bento",
        "destination": "Guimaraes",
        "duration_min": 75,
        "price_2class": 3.25,
        "frequency": "Cada 60 min",
        "stops": ["Porto Campanha", "Lousado"],
        "departures": ["06:30", "07:30", "08:30", "09:30", "10:30", "11:30", "12:30", "13:30", "14:30", "15:30", "16:30", "17:30", "18:30", "19:30", "20:30"],
    },
    {
        "id": "porto_douro_regional",
        "name": "Porto - Pocinho (Linha do Douro)",
        "service": "Regional",
        "origin": "Porto Sao Bento",
        "destination": "Pocinho",
        "duration_min": 210,
        "price_2class": 13.10,
        "frequency": "3-4 comboios/dia",
        "stops": ["Caide", "Marco de Canaveses", "Livração", "Peso da Regua", "Pinhao"],
        "departures": ["08:20", "12:50", "15:20", "18:20"],
        "scenic": True,
        "notes": "Um dos percursos ferroviarios mais bonitos da Europa, ao longo do Vale do Douro",
    },
    {
        "id": "porto_viana_regional",
        "name": "Porto - Viana do Castelo (Regional)",
        "service": "Regional",
        "origin": "Porto Sao Bento",
        "destination": "Viana do Castelo",
        "duration_min": 110,
        "price_2class": 6.70,
        "frequency": "6 comboios/dia",
        "stops": ["Porto Campanha", "Nine", "Barcelos"],
        "departures": ["07:30", "09:30", "11:30", "14:30", "17:30", "19:30"],
    },
    {
        "id": "lisboa_sintra_urb",
        "name": "Lisboa - Sintra (Urbano)",
        "service": "Urbano de Lisboa",
        "origin": "Lisboa Rossio",
        "destination": "Sintra",
        "duration_min": 40,
        "price_2class": 2.25,
        "frequency": "Cada 20 min",
        "stops": ["Queluz-Belas", "Agualva-Cacem", "Alcabideche"],
        "departures": ["05:30-00:30 (cada 20 min)"],
    },
    {
        "id": "lisboa_cascais_urb",
        "name": "Lisboa - Cascais (Urbano)",
        "service": "Urbano de Lisboa",
        "origin": "Lisboa Cais do Sodre",
        "destination": "Cascais",
        "duration_min": 33,
        "price_2class": 2.25,
        "frequency": "Cada 20 min",
        "stops": ["Santos", "Belem", "Oeiras", "Carcavelos", "Estoril"],
        "departures": ["05:30-01:30 (cada 20 min)"],
        "scenic": True,
        "notes": "Percurso ao longo da costa, com vistas para o Tejo e o Atlantico",
    },
    {
        "id": "faro_lagos_regional",
        "name": "Faro - Lagos (Regional)",
        "service": "Regional",
        "origin": "Faro",
        "destination": "Lagos",
        "duration_min": 105,
        "price_2class": 7.60,
        "frequency": "5-6 comboios/dia",
        "stops": ["Loule", "Albufeira-Ferreiras", "Tunes", "Silves", "Portimao"],
        "departures": ["07:00", "09:40", "12:10", "14:40", "17:10", "19:40"],
    },
    {
        "id": "coimbra_guarda_ic",
        "name": "Coimbra - Guarda (Intercidades)",
        "service": "Intercidades",
        "origin": "Coimbra-B",
        "destination": "Guarda",
        "duration_min": 150,
        "price_2class": 15.80,
        "frequency": "2 comboios/dia",
        "stops": ["Mangualde", "Nelas", "Viseu"],
        "departures": ["08:00", "17:00"],
    },
]

# Travel cards info
CP_TRAVEL_CARDS = [
    {"name": "CP Card", "description": "Cartao de desconto 25% em todos os comboios CP", "price": "49/ano", "discount": "25%"},
    {"name": "CP Card Jovem", "description": "Desconto 25% para jovens ate 25 anos", "price": "30/ano", "discount": "25%"},
    {"name": "CP Card Senior", "description": "Desconto 25% para maiores de 65 anos", "price": "30/ano", "discount": "25%"},
    {"name": "Navegante Metropolitano", "description": "Passe mensal Lisboa + comboios suburbanos", "price": "40/mes", "zone": "Area Metropolitana de Lisboa"},
    {"name": "Andante", "description": "Passe mensal Porto + comboios suburbanos", "price": "40/mes", "zone": "Area Metropolitana do Porto"},
    {"name": "Intra-rail Portugal", "description": "Viagens ilimitadas por 3/5/7 dias", "price": "desde 59", "validity": "3-7 dias"},
]


@cp_router.get("/stations")
async def get_stations(
    search: Optional[str] = Query(None, max_length=200),
    line: Optional[str] = Query(None),
):
    """Get CP train stations"""
    results = CP_STATIONS
    if search:
        s = search.lower()
        results = [st for st in results if s in st["name"].lower() or s in st["city"].lower()]
    if line:
        l = line.lower()
        results = [st for st in results if any(l in ln.lower() for ln in st["lines"])]
    return {"stations": results, "total": len(results)}


@cp_router.get("/routes")
async def get_routes(
    origin: Optional[str] = Query(None),
    destination: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    scenic: Optional[bool] = Query(None),
):
    """Get CP train routes with schedules and prices"""
    results = CP_ROUTES
    if origin:
        o = origin.lower()
        results = [r for r in results if o in r["origin"].lower()]
    if destination:
        d = destination.lower()
        results = [r for r in results if d in r["destination"].lower()]
    if service:
        s = service.lower()
        results = [r for r in results if s in r["service"].lower()]
    if scenic is not None:
        results = [r for r in results if r.get("scenic") == scenic]
    return {"routes": results, "total": len(results)}


@cp_router.get("/route/{route_id}")
async def get_route_detail(route_id: str):
    """Get detailed route information"""
    route = next((r for r in CP_ROUTES if r["id"] == route_id), None)
    if not route:
        raise HTTPException(status_code=404, detail="Rota nao encontrada")
    return route


@cp_router.get("/cards")
async def get_travel_cards():
    """Get CP travel/discount cards information"""
    return {"cards": CP_TRAVEL_CARDS, "total": len(CP_TRAVEL_CARDS)}


@cp_router.get("/search")
async def search_connections(
    origin: str = Query(..., min_length=2),
    destination: str = Query(..., min_length=2),
):
    """Search for train connections between two cities"""
    o = origin.lower()
    d = destination.lower()

    # Find direct routes
    direct = [r for r in CP_ROUTES if o in r["origin"].lower() and d in r["destination"].lower()]

    # Find reverse routes
    reverse = [r for r in CP_ROUTES if d in r["origin"].lower() and o in r["destination"].lower()]

    # Find routes where both cities are stops
    via_stops = []
    for r in CP_ROUTES:
        stops_lower = [s.lower() for s in r.get("stops", [])]
        origin_in = o in r["origin"].lower() or any(o in s for s in stops_lower)
        dest_in = d in r["destination"].lower() or any(d in s for s in stops_lower)
        if origin_in and dest_in and r not in direct:
            via_stops.append(r)

    return {
        "origin": origin,
        "destination": destination,
        "direct_routes": direct,
        "reverse_routes": reverse,
        "via_routes": via_stops,
        "total": len(direct) + len(reverse) + len(via_stops),
        "note": "Horarios estimados. Consulte cp.pt para horarios atualizados.",
    }


# =====================================================================
# Live Data Endpoints (CP API integration with static fallback)
# =====================================================================

@cp_router.get("/live/departures/{station_id}")
async def get_live_departures(station_id: str):
    """
    Get live departures from a CP station.
    Tries CP's real-time API first, falls back to schedule-based data.
    Returns upcoming departures with train number, service, time, and status.
    """
    from services.cp_service import get_live_departures as fetch_departures

    station = next((s for s in CP_STATIONS if s["id"] == station_id), None)
    if not station:
        raise HTTPException(status_code=404, detail="Estacao nao encontrada")

    result = await fetch_departures(station_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@cp_router.get("/live/status")
async def get_service_status():
    """
    Get CP service status and disruptions.
    Returns line status, service status, and any active disruptions.
    """
    from services.cp_service import get_service_status as fetch_status

    return await fetch_status()


@cp_router.get("/live/timetable")
async def get_live_timetable(
    origin: str = Query(..., min_length=2, description="ID da estacao de origem"),
    destination: str = Query(..., min_length=2, description="ID da estacao de destino"),
    date: Optional[str] = Query(None, description="Data (YYYY-MM-DD), default hoje"),
    time: Optional[str] = Query(None, description="Hora inicio (HH:MM), default agora"),
):
    """
    Search live timetable between two stations.
    Tries CP's real-time API, falls back to static route matching.
    Returns connections with departure/arrival times and prices.
    """
    from services.cp_service import search_timetable

    result = await search_timetable(origin, destination, date, time)
    if "error" in result:
        detail_map = {
            "origin_not_found": "Estacao de origem nao encontrada",
            "destination_not_found": "Estacao de destino nao encontrada",
        }
        raise HTTPException(
            status_code=404,
            detail=detail_map.get(result["error"], result["error"]),
        )
    return result
