"""
Agenda Viral API - Cultural events, festivals, and expedition data for Portugal.
Now with dynamic public data sources and ticket links (Ticketline integration).
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from shared_constants import sanitize_regex
from shared_utils import DatabaseHolder
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

agenda_router = APIRouter(prefix="/agenda", tags=["Agenda Viral"])

_db_holder = DatabaseHolder("agenda")
set_agenda_db = _db_holder.set

# Ticketline base URL for ticket purchases
TICKETLINE_SEARCH_URL = "https://ticketline.sapo.pt/pesquisa?q="
TICKETLINE_BASE = "https://ticketline.sapo.pt"

# Known event-to-ticketline mappings for direct links
TICKET_LINKS = {
    "nos-alive": "https://ticketline.sapo.pt/evento/nos-alive",
    "rock-in-rio": "https://ticketline.sapo.pt/evento/rock-in-rio-lisboa",
    "super-bock-super-rock": "https://ticketline.sapo.pt/evento/super-bock-super-rock",
    "meo-sudoeste": "https://ticketline.sapo.pt/evento/meo-sudoeste",
    "festival-sudoeste": "https://ticketline.sapo.pt/evento/meo-sudoeste",
    "vodafone-paredes": "https://ticketline.sapo.pt/evento/vodafone-paredes-de-coura",
    "paredes-coura": "https://ticketline.sapo.pt/evento/vodafone-paredes-de-coura",
    "bons-sons": "https://ticketline.sapo.pt/evento/bons-sons",
    "vilar-mouros": "https://ticketline.sapo.pt/evento/vilar-de-mouros",
    "festival-crato": "https://ticketline.sapo.pt/evento/festival-do-crato",
    "festa-avante": "https://ticketline.sapo.pt/evento/festa-do-avante",
    "medieval-obidos": "https://ticketline.sapo.pt/evento/mercado-medieval-obidos",
    "chocolate-obidos": "https://ticketline.sapo.pt/evento/festival-chocolate-obidos",
    "queima-fitas": "https://ticketline.sapo.pt/evento/queima-das-fitas",
    "rally-portugal": "https://ticketline.sapo.pt/evento/rally-de-portugal",
    "ovibeja": "https://ticketline.sapo.pt/evento/ovibeja",
    "feira-medieval-silves": "https://ticketline.sapo.pt/evento/feira-medieval-silves",
    "fair-medieval-silves": "https://ticketline.sapo.pt/evento/feira-medieval-silves",
}


def _get_ticket_url(event_id: str, event_name: str) -> Optional[str]:
    """Get ticket URL for an event. Returns Ticketline direct or search link."""
    # Check direct mappings first (strip year suffix)
    base_id = "-".join(event_id.split("-")[:-1]) if event_id[-4:].isdigit() else event_id
    for key, url in TICKET_LINKS.items():
        if key in base_id:
            return url

    # For festivals with price info, generate a search link
    return None


def _enrich_with_ticket(event: dict) -> dict:
    """Add ticket_url to event if available."""
    evt = dict(event)
    ticket_url = _get_ticket_url(evt.get("id", ""), evt.get("name", ""))

    if ticket_url:
        evt["ticket_url"] = ticket_url
        evt["has_tickets"] = True
    elif evt.get("price"):
        # Has price but no direct link - provide search
        name_query = evt["name"].replace(" ", "+")
        evt["ticket_url"] = f"{TICKETLINE_SEARCH_URL}{name_query}"
        evt["has_tickets"] = True
    else:
        evt["has_tickets"] = False

    return evt


MONTH_MAP = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "março": 3, "abril": 4,
    "maio": 5, "junho": 6, "julho": 7, "agosto": 8,
    "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
}


def detect_month(date_text: str) -> list:
    """Detect months from Portuguese date text."""
    if not date_text:
        return []
    text = date_text.lower()
    months = []
    for name, num in MONTH_MAP.items():
        if name in text:
            months.append(num)
    return sorted(set(months))


@agenda_router.get("/events")
async def get_events(
    type: Optional[str] = Query(None, description="festa or festival"),
    region: Optional[str] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    rarity: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=200),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = {}
    if type:
        query["type"] = type
    if region:
        query["region"] = {"$regex": sanitize_regex(region), "$options": "i"}
    if rarity:
        query["rarity"] = rarity
    if search:
        safe_search = sanitize_regex(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"description": {"$regex": safe_search, "$options": "i"}},
            {"concelho": {"$regex": safe_search, "$options": "i"}},
        ]

    all_events = await _db_holder.db.events.find(query, {"_id": 0}).skip(offset).limit(limit).to_list(limit)

    # Filter by month if specified (using month field or date_text parsing)
    if month:
        all_events = [
            e for e in all_events
            if e.get("month") == month or month in detect_month(e.get("date_text", ""))
        ]

    # Enrich with ticket info
    all_events = [_enrich_with_ticket(e) for e in all_events]

    return {"events": all_events, "total": len(all_events)}


@agenda_router.get("/calendar")
async def get_calendar():
    """Get events grouped by month for calendar view."""
    events = await _db_holder.db.events.find({}, {"_id": 0}).to_list(5000)

    calendar = {}
    for i in range(1, 13):
        calendar[i] = {"festas": 0, "festivais": 0, "events": []}

    for evt in events:
        # Use month field if available, otherwise parse date_text
        months = [evt["month"]] if evt.get("month") else detect_month(evt.get("date_text", ""))
        for m in months:
            if m in calendar:
                if evt.get("type") == "festa":
                    calendar[m]["festas"] += 1
                else:
                    calendar[m]["festivais"] += 1
                calendar[m]["events"].append({
                    "id": evt.get("id"),
                    "name": evt.get("name"),
                    "type": evt.get("type"),
                    "region": evt.get("region", ""),
                    "rarity": evt.get("rarity", "comum"),
                    "date_text": evt.get("date_text", ""),
                    "source": evt.get("source", "curated"),
                    "has_tickets": bool(evt.get("price") or _get_ticket_url(evt.get("id", ""), evt.get("name", ""))),
                })

    month_names = [
        "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]
    result = []
    for i in range(1, 13):
        total = calendar[i]["festas"] + calendar[i]["festivais"]
        result.append({
            "month": i,
            "name": month_names[i],
            "total": total,
            "festas": calendar[i]["festas"],
            "festivais": calendar[i]["festivais"],
            "events": calendar[i]["events"][:10],
        })

    return {"months": result, "total_events": len(events)}


@agenda_router.get("/stats")
async def get_agenda_stats():
    """Get event statistics including source breakdown."""
    pipeline_type = [{"$group": {"_id": "$type", "count": {"$sum": 1}}}]
    pipeline_region = [{"$group": {"_id": "$region", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    pipeline_rarity = [{"$group": {"_id": "$rarity", "count": {"$sum": 1}}}]
    pipeline_source = [{"$group": {"_id": "$source", "count": {"$sum": 1}}}]

    by_type = {r["_id"]: r["count"] for r in await _db_holder.db.events.aggregate(pipeline_type).to_list(10)}
    by_region = [{"region": r["_id"], "count": r["count"]} for r in await _db_holder.db.events.aggregate(pipeline_region).to_list(50)]
    by_rarity = {r["_id"]: r["count"] for r in await _db_holder.db.events.aggregate(pipeline_rarity).to_list(10)}
    by_source = {r["_id"]: r["count"] for r in await _db_holder.db.events.aggregate(pipeline_source).to_list(10)}

    total = await _db_holder.db.events.count_documents({})
    with_tickets = await _db_holder.db.events.count_documents({"$or": [{"price": {"$exists": True}}, {"has_tickets": True}]})

    return {
        "total": total,
        "festas": by_type.get("festa", 0),
        "festivais": by_type.get("festival", 0),
        "by_region": by_region,
        "by_rarity": by_rarity,
        "by_source": by_source,
        "with_tickets": with_tickets,
        "last_sync": await _get_last_sync_time(),
    }


GRANDE_EXPEDICAO_STAGES = [
    {"id": "ge-01", "phase": "Fase 1", "stage": 1, "main_location": "Trás-os-Montes",
     "highlights": ["Início da EN2", "Termas de Vidago", "Pedras Salgadas", "Chaves"],
     "name": "Chaves (KM 0 EN2)", "days": 1, "distance": "~80km",
     "routes": ["Rota 21 (EN2)", "Rota 55 (Termas Norte)"]},
    {"id": "ge-02", "phase": "Fase 1", "stage": 2, "main_location": "Minho/Norte",
     "highlights": ["Espigueiros de Soajo", "Castro Laboreiro", "Rota do Alvarinho em Melgaço"],
     "name": "Parque Nacional Peneda-Gerês", "days": 2, "distance": "~150km",
     "routes": ["Rota 54 (Granito Gerês)", "Rota 12 (Vinho Verde)"]},
    {"id": "ge-03", "phase": "Fase 1", "stage": 3, "main_location": "Norte",
     "highlights": ["Igrejas românicas", "Passadiços do Paiva", "Ponte 516 Arouca"],
     "name": "Vale do Sousa e Tâmega", "days": 2, "distance": "~120km",
     "routes": ["Rota 2 (Românico)", "Rota 53 (Arouca Geopark)"]},
    {"id": "ge-04", "phase": "Fase 2", "stage": 4, "main_location": "Douro Vinhateiro",
     "highlights": ["EN222 entre Régua e Pinhão", "Provas de vinho"],
     "name": "Peso da Régua / Pinhão", "days": 2, "distance": "~100km",
     "routes": ["Rota 11 (Vinho Porto)", "Rota 22 (EN222)"]},
    {"id": "ge-05", "phase": "Fase 2", "stage": 5, "main_location": "Douro Interior",
     "highlights": ["Gravuras rupestres UNESCO", "Miradouros sobre o Douro Internacional"],
     "name": "Vale do Côa", "days": 2, "distance": "~130km",
     "routes": ["Rota 30 (GR45 Côa)", "Rota 25 (Douro Internacional)"]},
    {"id": "ge-06", "phase": "Fase 2", "stage": 6, "main_location": "Centro-Norte",
     "highlights": ["Ponto mais alto de Portugal", "Queijo da Serra DOP", "Vale Glaciário do Zêzere"],
     "name": "Serra da Estrela", "days": 2, "distance": "~80km",
     "routes": ["Rota 28 (EN338 Estrela)", "Rota 17 (Queijos)"]},
    {"id": "ge-07", "phase": "Fase 3", "stage": 7, "main_location": "Beira Interior",
     "highlights": ["Piódão", "Sortelha", "Monsanto", "Idanha-a-Velha"],
     "name": "Aldeias Históricas", "days": 2, "distance": "~200km",
     "routes": ["Rota 1 (Aldeias Históricas)", "Rota 6 (Judiarias)"]},
    {"id": "ge-08", "phase": "Fase 3", "stage": 8, "main_location": "Médio Tejo / Centro",
     "highlights": ["Convento de Cristo", "Mosteiro da Batalha", "Mosteiro de Alcobaça"],
     "name": "Tomar e Batalha", "days": 2, "distance": "~120km",
     "routes": ["Rota 3 (Templários)", "Rota 5 (UNESCO)", "Rota 9 (Cister)"]},
    {"id": "ge-09", "phase": "Fase 3", "stage": 9, "main_location": "Litoral Centro",
     "highlights": ["Ondas gigantes da Nazaré", "Peniche", "Óbidos"],
     "name": "Nazaré e Costa de Prata", "days": 1, "distance": "~80km",
     "routes": ["Rota 24 (Atlântica)", "Rota 29 (Costa de Prata)"]},
    {"id": "ge-10", "phase": "Fase 4", "stage": 10, "main_location": "Alentejo Central",
     "highlights": ["Cromeleque dos Almendres", "Adegas contemporâneas", "Gastronomia alentejana"],
     "name": "Évora e Megalitismo", "days": 2, "distance": "~100km",
     "routes": ["Rota 13 (Vinhos Alentejo)", "Rota 7 (Al-Mutamid)"]},
    {"id": "ge-11", "phase": "Fase 4", "stage": 11, "main_location": "Alentejo",
     "highlights": ["Bonecos de barro UNESCO", "Mantas alentejanas", "Castelo de Estremoz"],
     "name": "Estremoz e Reguengos", "days": 1, "distance": "~80km",
     "routes": ["Rota 49 (Bonecos Estremoz)", "Rota 48 (Mantas Reguengos)"]},
    {"id": "ge-12", "phase": "Fase 4", "stage": 12, "main_location": "Alentejo Oriental",
     "highlights": ["Dark Sky Reserve", "Maior lago artificial da Europa", "Pôr do sol sobre o Alqueva"],
     "name": "Monsaraz e Alqueva", "days": 2, "distance": "~60km",
     "routes": ["Rota 51 (Aldeias Alqueva)", "Dark Sky"]},
    {"id": "ge-13", "phase": "Fase 4", "stage": 13, "main_location": "Baixo Alentejo",
     "highlights": ["A Villa Museu", "Pulo do Lobo", "Costa alentejana selvagem"],
     "name": "Mértola e Baixo Alentejo", "days": 1, "distance": "~120km",
     "routes": ["Rota 7 (Al-Mutamid fim)", "Rota 56 (Lixo Zero)"]},
    {"id": "ge-14", "phase": "Fase 5", "stage": 14, "main_location": "Algarve Barlavento",
     "highlights": ["Cabo de S. Vicente", "Praias selvagens", "Via Algarviana"],
     "name": "Sagres e Costa Vicentina", "days": 2, "distance": "~150km",
     "routes": ["Rota 23 (Costa Vicentina)", "Rota 26 (Via Algarviana)"]},
    {"id": "ge-15", "phase": "Fase 5", "stage": 15, "main_location": "Algarve",
     "highlights": ["Ruínas romanas", "Banhos islâmicos", "Mina de sal visitável"],
     "name": "Lagos, Silves e Algarve Interior", "days": 2, "distance": "~120km",
     "routes": ["Rota 8 (Omíada)", "Rota 18 (Cortiça São Brás)"]},
    {"id": "ge-16", "phase": "Fase 5", "stage": 16, "main_location": "Algarve Oriental",
     "highlights": ["Salinas de Tavira", "Gastronomia UNESCO", "Tirolina transfronteiriça em Alcoutim"],
     "name": "Tavira e Sotavento", "days": 2, "distance": "~100km",
     "routes": ["Rota 52 (Dieta Mediterrânica)", "Rota 20 (Atum)", "Rota 60 (Contrabando)"]},
    {"id": "ge-17", "phase": "Fase 6", "stage": 17, "main_location": "Madeira",
     "highlights": ["Floresta Laurissilva", "Levadas", "Cabo Girão", "Blandy's Wine Lodge"],
     "name": "Ilha da Madeira", "days": 4, "distance": "~200km (levadas)",
     "routes": ["Rota 16 (Vinho Madeira)", "Rota 31 (Levadas)"]},
    {"id": "ge-18", "phase": "Fase 6", "stage": 18, "main_location": "Açores",
     "highlights": ["Lagoas azul e verde", "Termas na floresta", "Lagoa do Fogo"],
     "name": "São Miguel, Açores", "days": 4, "distance": "~180km",
     "routes": ["Rota 35 (Sete Cidades)", "Rota 38 (Caldeira Velha)"]},
]


async def seed_grande_expedicao(database):
    """Seed the grande_expedicao collection if empty."""
    count = await database.grande_expedicao.count_documents({})
    if count == 0:
        await database.grande_expedicao.insert_many(GRANDE_EXPEDICAO_STAGES)
        logger.info("Seeded %d Grande Expedição stages", len(GRANDE_EXPEDICAO_STAGES))


@agenda_router.get("/expedicao")
async def get_grande_expedicao():
    """Get the Grande Expedição 2026 stages."""
    stages = await _db_holder.db.grande_expedicao.find({}, {"_id": 0}).to_list(100)
    if not stages:
        await seed_grande_expedicao(_db_holder.db)
        stages = await _db_holder.db.grande_expedicao.find({}, {"_id": 0}).to_list(100)
    return {"stages": stages, "total": len(stages)}


@agenda_router.post("/sync")
async def sync_public_events():
    """Manually trigger sync of public events from external sources."""
    from services.public_events_service import public_events_service
    public_events_service.set_db(_db_holder.db)
    count = await public_events_service.sync_to_events_collection()
    return {"synced": count, "timestamp": datetime.now(timezone.utc).isoformat()}


@agenda_router.get("/event/{event_id}")
async def get_event_detail(event_id: str):
    """Get detailed info for a single event, including ticket link."""
    event = await _db_holder.db.events.find_one({"id": event_id}, {"_id": 0})
    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return _enrich_with_ticket(event)


async def _get_last_sync_time() -> Optional[str]:
    """Get timestamp of last event sync."""
    try:
        cache = await _db_holder.db.events_cache.find_one({"_id": "public_events"})
        if cache:
            return cache.get("cached_at", "").isoformat() if cache.get("cached_at") else None
    except Exception:
        pass
    return None
