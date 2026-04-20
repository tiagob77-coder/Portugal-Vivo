"""
CP Service - Comboios de Portugal Live Data Integration
Fetches real-time train data from CP's public endpoints with caching and static fallback.

CP public endpoints used:
- Station search and timetable queries via cp.pt internal API
- Service status and disruption alerts
"""
import httpx
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

logger = logging.getLogger(__name__)

# CP internal API endpoints (used by cp.pt website)
CP_BASE_URL = "https://www.cp.pt"
CP_API_STATIONS = f"{CP_BASE_URL}/sites/passageiros/pt/consultar-horarios/Pesquisar"
CP_API_TIMETABLE = f"{CP_BASE_URL}/sites/passageiros/pt/consultar-horarios/HorariosResultado"
CP_API_STATUS = f"{CP_BASE_URL}/sites/passageiros/pt/informacoes-ao-cliente"

# Infraestruturas de Portugal open data
IP_API_BASE = "https://servicos.infraestruturasdeportugal.pt/negocios-e-servicos/horarios-702702"

# Cache TTL
STATIONS_CACHE_TTL = timedelta(hours=24)
TIMETABLE_CACHE_TTL = timedelta(minutes=15)
STATUS_CACHE_TTL = timedelta(minutes=5)
DEPARTURES_CACHE_TTL = timedelta(minutes=3)

# Request config
REQUEST_TIMEOUT = 10.0
MAX_RETRIES = 2

# CP station codes mapping (NodeID used by CP's internal API)
CP_STATION_CODES: Dict[str, int] = {
    "lisboa_santa_apolonia": 94_001,
    "lisboa_oriente": 94_015,
    "porto_campanha": 94_008,
    "porto_sao_bento": 94_007,
    "coimbra_b": 94_019,
    "coimbra": 94_029,
    "aveiro": 94_024,
    "braga": 94_054,
    "guimaraes": 94_056,
    "faro": 94_041,
    "lagos": 94_044,
    "evora": 94_036,
    "beja": 94_037,
    "tunes": 94_042,
    "entroncamento": 94_018,
    "santarem": 94_017,
    "leiria": 94_075,
    "viana_castelo": 94_059,
    "valenca": 94_060,
    "regua": 94_051,
    "pocinho": 94_053,
    "tomar": 94_031,
    "castelo_branco": 94_033,
    "guarda": 94_023,
    "sintra": 94_010,
    "cascais": 94_012,
    "setubal": 94_014,
    "albufeira": 94_043,
    "portimao": 94_045,
}

# Service type mapping
SERVICE_TYPES = {
    "AP": "Alfa Pendular",
    "IC": "Intercidades",
    "IR": "Inter-Regional",
    "R": "Regional",
    "U": "Urbano",
    "S": "Suburbano",
}


class CPCache:
    """Simple in-memory cache with TTL."""

    def __init__(self):
        self._store: Dict[str, Any] = {}
        self._expiry: Dict[str, datetime] = {}

    def get(self, key: str) -> Optional[Any]:
        if key in self._store:
            if datetime.now(timezone.utc) < self._expiry[key]:
                return self._store[key]
            del self._store[key]
            del self._expiry[key]
        return None

    def set(self, key: str, value: Any, ttl: timedelta):
        self._store[key] = value
        self._expiry[key] = datetime.now(timezone.utc) + ttl

    def clear(self):
        self._store.clear()
        self._expiry.clear()


_cache = CPCache()


async def _http_get(url: str, params: Optional[Dict] = None, headers: Optional[Dict] = None) -> Optional[Dict]:
    """Make an HTTP GET request with retries."""
    default_headers = {
        "User-Agent": "PortugalVivo/1.0 (heritage-explorer)",
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.5",
    }
    if headers:
        default_headers.update(headers)

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(
                timeout=REQUEST_TIMEOUT,
                follow_redirects=True,
            ) as client:
                resp = await client.get(url, params=params, headers=default_headers)
                if resp.status_code == 200:
                    try:
                        return resp.json()
                    except Exception:
                        return {"html": resp.text}
                logger.warning("CP API returned %d for %s", resp.status_code, url)
                return None
        except (httpx.TimeoutException, httpx.ConnectError, httpx.HTTPError) as e:
            if attempt < MAX_RETRIES:
                await asyncio.sleep(1 * (attempt + 1))
                continue
            logger.warning("CP API request failed after %d retries: %s", MAX_RETRIES + 1, e)
            return None
    return None


async def _http_post(url: str, data: Optional[Dict] = None, headers: Optional[Dict] = None) -> Optional[Dict]:
    """Make an HTTP POST request with retries."""
    default_headers = {
        "User-Agent": "PortugalVivo/1.0 (heritage-explorer)",
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    if headers:
        default_headers.update(headers)

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(
                timeout=REQUEST_TIMEOUT,
                follow_redirects=True,
            ) as client:
                resp = await client.post(url, data=data, headers=default_headers)
                if resp.status_code == 200:
                    try:
                        return resp.json()
                    except Exception:
                        return {"html": resp.text}
                logger.warning("CP API POST returned %d for %s", resp.status_code, url)
                return None
        except (httpx.TimeoutException, httpx.ConnectError, httpx.HTTPError) as e:
            if attempt < MAX_RETRIES:
                await asyncio.sleep(1 * (attempt + 1))
                continue
            logger.warning("CP API POST failed after %d retries: %s", MAX_RETRIES + 1, e)
            return None
    return None


def _get_station_code(station_id: str) -> Optional[int]:
    """Get CP internal station code from station ID."""
    return CP_STATION_CODES.get(station_id)


def _format_departure(raw: Dict, station_name: str) -> Dict:
    """Format a raw departure record into our API format."""
    return {
        "train_number": raw.get("trainNumber", raw.get("comboio", "")),
        "service": raw.get("serviceType", raw.get("tipo", "Regional")),
        "service_name": SERVICE_TYPES.get(raw.get("serviceType", ""), raw.get("tipo", "Regional")),
        "destination": raw.get("destination", raw.get("destino", "")),
        "scheduled_time": raw.get("scheduledTime", raw.get("hora_prevista", "")),
        "estimated_time": raw.get("estimatedTime", raw.get("hora_estimada", "")),
        "platform": raw.get("platform", raw.get("plataforma", "")),
        "delay_minutes": raw.get("delay", raw.get("atraso", 0)),
        "status": raw.get("status", raw.get("estado", "on_time")),
        "station": station_name,
        "is_realtime": True,
    }


def _generate_live_departures(station_id: str, station_name: str) -> List[Dict]:
    """
    Generate realistic departure data based on our static route data.
    Used as a fallback when CP's live API is unavailable.
    Produces time-aware departures based on current time.
    """
    from cp_api import CP_ROUTES, CP_STATIONS

    now = datetime.now(timezone.utc) + timedelta(hours=1)  # Portugal is UTC+0/+1
    departures = []

    for route in CP_ROUTES:
        # Check if this station is origin, destination, or a stop on this route
        is_origin = station_name.lower() in route["origin"].lower()
        is_stop = any(station_name.lower() in s.lower() for s in route.get("stops", []))
        is_dest = station_name.lower() in route["destination"].lower()

        # Also check by city name from station data
        station_data = next((s for s in CP_STATIONS if s["id"] == station_id), None)
        city = station_data["city"].lower() if station_data else ""
        if city:
            is_origin = is_origin or city in route["origin"].lower()
            is_stop = is_stop or any(city in s.lower() for s in route.get("stops", []))
            is_dest = is_dest or city in route["destination"].lower()

        if not (is_origin or is_stop):
            continue

        for dep_str in route.get("departures", []):
            if "cada" in dep_str.lower():
                # Recurring schedule like "05:30-00:30 (cada 20 min)"
                # Generate next 3 departures from current time
                import re
                freq_match = re.search(r"cada\s+(\d+)", dep_str)
                freq = int(freq_match.group(1)) if freq_match else 20
                base = now.replace(second=0, microsecond=0)
                mins = base.minute
                next_min = mins - (mins % freq) + freq
                for i in range(3):
                    dep_time = base.replace(minute=0) + timedelta(minutes=next_min + i * freq)
                    if dep_time > now:
                        departures.append({
                            "train_number": f"{route['service'][:2].upper()}{dep_time.hour:02d}{dep_time.minute:02d}",
                            "service": route["service"].split()[0] if " " in route["service"] else route["service"],
                            "service_name": route["service"],
                            "destination": route["destination"] if not is_dest else route["origin"],
                            "scheduled_time": dep_time.strftime("%H:%M"),
                            "estimated_time": dep_time.strftime("%H:%M"),
                            "platform": "",
                            "delay_minutes": 0,
                            "status": "on_time",
                            "station": station_name,
                            "is_realtime": False,
                            "route_id": route["id"],
                            "route_name": route["name"],
                        })
            else:
                try:
                    parts = dep_str.split(":")
                    dep_hour, dep_min = int(parts[0]), int(parts[1])
                    dep_time = now.replace(hour=dep_hour, minute=dep_min, second=0, microsecond=0)

                    # If this station is a stop (not origin), add estimated offset
                    if is_stop and not is_origin:
                        stops = route.get("stops", [])
                        total_stops = len(stops) + 1  # +1 for destination
                        try:
                            stop_idx = next(
                                i for i, s in enumerate(stops)
                                if city in s.lower() or station_name.lower() in s.lower()
                            )
                            offset_min = int(route["duration_min"] * (stop_idx + 1) / total_stops)
                            dep_time += timedelta(minutes=offset_min)
                        except StopIteration:
                            pass

                    # Only show upcoming departures (within next 4 hours)
                    if dep_time < now:
                        dep_time += timedelta(days=1)
                    if dep_time > now + timedelta(hours=4):
                        continue

                    departures.append({
                        "train_number": f"{route['service'][:2].upper()}{dep_hour:02d}{dep_min:02d}",
                        "service": route["service"].split()[0] if " " in route["service"] else route["service"],
                        "service_name": route["service"],
                        "destination": route["destination"] if not is_dest else route["origin"],
                        "scheduled_time": dep_time.strftime("%H:%M"),
                        "estimated_time": dep_time.strftime("%H:%M"),
                        "platform": "",
                        "delay_minutes": 0,
                        "status": "on_time",
                        "station": station_name,
                        "is_realtime": False,
                        "route_id": route["id"],
                        "route_name": route["name"],
                    })
                except (ValueError, IndexError):
                    continue

    # Sort by scheduled time
    departures.sort(key=lambda d: d["scheduled_time"])
    return departures[:20]  # Max 20 departures


async def get_live_departures(station_id: str) -> Dict:
    """
    Get live departures from a CP station.
    Tries the live CP API first, falls back to schedule-based data.
    """
    from cp_api import CP_STATIONS

    station = next((s for s in CP_STATIONS if s["id"] == station_id), None)
    if not station:
        return {"error": "station_not_found", "station_id": station_id}

    cache_key = f"departures:{station_id}"
    cached = _cache.get(cache_key)
    if cached:
        return cached

    station_code = _get_station_code(station_id)
    departures = []
    source = "static_schedule"

    # Try CP live API
    if station_code:
        try:
            result = await _http_post(
                CP_API_TIMETABLE,
                data={
                    "StationNodeID": station_code,
                    "Date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    "TimeStart": datetime.now(timezone.utc).strftime("%H:%M"),
                    "TimeEnd": "23:59",
                },
            )
            if result and "html" not in result:
                raw_departures = result.get("departures", result.get("partidas", []))
                if raw_departures:
                    departures = [_format_departure(d, station["name"]) for d in raw_departures]
                    source = "cp_live"
        except Exception as e:
            logger.debug("CP live API unavailable for %s: %s", station_id, e)

    # Fallback to schedule-based departures
    if not departures:
        departures = _generate_live_departures(station_id, station["name"])
        source = "static_schedule"

    response = {
        "station": station,
        "departures": departures,
        "total": len(departures),
        "source": source,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "note": "Dados em tempo real quando disponiveis. Consulte cp.pt para confirmacao."
            if source == "cp_live"
            else "Horarios baseados em dados estaticos. Consulte cp.pt para horarios atualizados.",
    }

    _cache.set(cache_key, response, DEPARTURES_CACHE_TTL)
    return response


async def get_service_status() -> Dict:
    """
    Get CP service status and disruptions.
    Tries to fetch from CP's status page, falls back to default status.
    """
    cache_key = "service_status"
    cached = _cache.get(cache_key)
    if cached:
        return cached

    disruptions = []
    source = "default"

    # Try fetching CP status page
    try:
        result = await _http_get(CP_API_STATUS)
        if result and "html" in result:
            # Parse disruption info from status page HTML
            html = result["html"]
            # Look for common disruption patterns in Portuguese
            import re
            alerts = re.findall(
                r'<div[^>]*class="[^"]*alerta[^"]*"[^>]*>(.*?)</div>',
                html,
                re.DOTALL | re.IGNORECASE,
            )
            for alert_html in alerts:
                text = re.sub(r"<[^>]+>", " ", alert_html).strip()
                text = re.sub(r"\s+", " ", text)
                if text and len(text) > 10:
                    disruptions.append({
                        "type": "alert",
                        "message": text,
                        "severity": "info",
                        "source": "cp.pt",
                    })
            if alerts:
                source = "cp_live"
    except Exception as e:
        logger.debug("CP status page unavailable: %s", e)

    # Build service lines status
    lines_status = [
        {"line": "Linha do Norte", "status": "normal", "routes": ["Lisboa-Porto"]},
        {"line": "Linha do Douro", "status": "normal", "routes": ["Porto-Pocinho"]},
        {"line": "Linha do Algarve", "status": "normal", "routes": ["Faro-Lagos"]},
        {"line": "Linha do Minho", "status": "normal", "routes": ["Porto-Valença"]},
        {"line": "Linha da Beira Alta", "status": "normal", "routes": ["Coimbra-Guarda"]},
        {"line": "Linha da Beira Baixa", "status": "normal", "routes": ["Entroncamento-Castelo Branco"]},
        {"line": "Linha do Alentejo", "status": "normal", "routes": ["Lisboa-Évora", "Lisboa-Beja"]},
        {"line": "Linha de Sintra", "status": "normal", "routes": ["Lisboa-Sintra"]},
        {"line": "Linha de Cascais", "status": "normal", "routes": ["Lisboa-Cascais"]},
        {"line": "Linha do Oeste", "status": "normal", "routes": ["Lisboa-Leiria"]},
    ]

    services_status = [
        {"service": "Alfa Pendular", "status": "normal"},
        {"service": "Intercidades", "status": "normal"},
        {"service": "Regional", "status": "normal"},
        {"service": "Urbano de Lisboa", "status": "normal"},
        {"service": "Urbano do Porto", "status": "normal"},
    ]

    response = {
        "overall_status": "normal" if not disruptions else "disrupted",
        "lines": lines_status,
        "services": services_status,
        "disruptions": disruptions,
        "total_disruptions": len(disruptions),
        "source": source,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "note": "Estado atualizado via cp.pt" if source == "cp_live"
            else "Informacao de estado padrao. Consulte cp.pt para alertas em tempo real.",
    }

    _cache.set(cache_key, response, STATUS_CACHE_TTL)
    return response


async def search_timetable(
    origin_id: str,
    destination_id: str,
    date: Optional[str] = None,
    time_start: Optional[str] = None,
) -> Dict:
    """
    Search for train connections between two stations via CP's API.
    Falls back to static route matching.
    """
    from cp_api import CP_STATIONS, CP_ROUTES

    origin = next((s for s in CP_STATIONS if s["id"] == origin_id), None)
    destination = next((s for s in CP_STATIONS if s["id"] == destination_id), None)

    if not origin:
        return {"error": "origin_not_found", "station_id": origin_id}
    if not destination:
        return {"error": "destination_not_found", "station_id": destination_id}

    search_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    search_time = time_start or datetime.now(timezone.utc).strftime("%H:%M")

    cache_key = f"timetable:{origin_id}:{destination_id}:{search_date}:{search_time}"
    cached = _cache.get(cache_key)
    if cached:
        return cached

    origin_code = _get_station_code(origin_id)
    dest_code = _get_station_code(destination_id)
    connections = []
    source = "static_schedule"

    # Try CP live timetable search
    if origin_code and dest_code:
        try:
            result = await _http_post(
                CP_API_TIMETABLE,
                data={
                    "StationOrigNodeID": origin_code,
                    "StationDestNodeID": dest_code,
                    "Date": search_date,
                    "TimeStart": search_time,
                    "TimeEnd": "23:59",
                },
            )
            if result and "html" not in result:
                raw_conns = result.get("connections", result.get("ligacoes", []))
                if raw_conns:
                    for c in raw_conns:
                        connections.append({
                            "train_number": c.get("trainNumber", c.get("comboio", "")),
                            "service": c.get("serviceType", c.get("tipo", "")),
                            "departure_time": c.get("departureTime", c.get("hora_partida", "")),
                            "arrival_time": c.get("arrivalTime", c.get("hora_chegada", "")),
                            "duration_min": c.get("duration", c.get("duracao", 0)),
                            "price_2class": c.get("price2", c.get("preco_2", 0)),
                            "price_1class": c.get("price1", c.get("preco_1", 0)),
                            "changes": c.get("changes", c.get("transbordos", 0)),
                            "is_realtime": True,
                        })
                    source = "cp_live"
        except Exception as e:
            logger.debug("CP timetable API unavailable: %s", e)

    # Fallback: match from static routes
    if not connections:
        o_city = origin["city"].lower()
        d_city = destination["city"].lower()

        for route in CP_ROUTES:
            origin_match = o_city in route["origin"].lower() or any(
                o_city in s.lower() for s in route.get("stops", [])
            )
            dest_match = d_city in route["destination"].lower() or any(
                d_city in s.lower() for s in route.get("stops", [])
            )

            if origin_match and dest_match:
                for dep_str in route.get("departures", []):
                    if "cada" in dep_str.lower():
                        continue
                    try:
                        parts = dep_str.split(":")
                        dep_hour, dep_min = int(parts[0]), int(parts[1])
                        if f"{dep_hour:02d}:{dep_min:02d}" >= search_time:
                            arr_hour = dep_hour + route["duration_min"] // 60
                            arr_min = dep_min + route["duration_min"] % 60
                            if arr_min >= 60:
                                arr_hour += 1
                                arr_min -= 60
                            connections.append({
                                "train_number": f"{route['service'][:2].upper()}{dep_hour:02d}{dep_min:02d}",
                                "service": route["service"],
                                "departure_time": f"{dep_hour:02d}:{dep_min:02d}",
                                "arrival_time": f"{arr_hour:02d}:{arr_min:02d}",
                                "duration_min": route["duration_min"],
                                "price_2class": route.get("price_2class", 0),
                                "price_1class": route.get("price_1class", 0),
                                "changes": 0,
                                "route_id": route["id"],
                                "route_name": route["name"],
                                "is_realtime": False,
                            })
                    except (ValueError, IndexError):
                        continue

    connections.sort(key=lambda c: c.get("departure_time", ""))

    response = {
        "origin": origin,
        "destination": destination,
        "date": search_date,
        "connections": connections,
        "total": len(connections),
        "source": source,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "note": "Horarios em tempo real via cp.pt" if source == "cp_live"
            else "Horarios estimados baseados em dados estaticos. Consulte cp.pt para confirmacao.",
    }

    _cache.set(cache_key, response, TIMETABLE_CACHE_TTL)
    return response


def clear_cache():
    """Clear all cached CP data."""
    _cache.clear()
