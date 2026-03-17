"""
Transport Guide API - Serves Portuguese transport operators and travel cards data
"""
from fastapi import APIRouter, Query
from typing import Optional
from shared_constants import sanitize_regex
from shared_utils import DatabaseHolder

transport_router = APIRouter(prefix="/transportes", tags=["Transportes"])

_db_holder = DatabaseHolder("transport")
set_transport_db = _db_holder.set


@transport_router.get("/operators")
async def get_operators(
    section: Optional[str] = Query(None, description="Filter by section: nacional, lisboa, porto, regional, aereo"),
    transport_type: Optional[str] = Query(None, description="Filter by transport type keyword"),
    search: Optional[str] = Query(None, description="Search by name or zone", max_length=200),
):
    query = {}
    if section:
        query["section"] = section
    if transport_type:
        query["transport_type"] = {"$regex": sanitize_regex(transport_type), "$options": "i"}
    if search:
        safe_search = sanitize_regex(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"geographic_zone": {"$regex": safe_search, "$options": "i"}},
            {"region": {"$regex": safe_search, "$options": "i"}},
        ]

    operators = await _db_holder.db.transport_operators.find(query, {"_id": 0}).to_list(500)
    sections_count = {}
    for op in operators:
        s = op.get("section", "")
        sections_count[s] = sections_count.get(s, 0) + 1

    return {
        "operators": operators,
        "total": len(operators),
        "by_section": sections_count,
    }


@transport_router.get("/cards")
async def get_cards(
    search: Optional[str] = Query(None, description="Search cards by name or city", max_length=200),
):
    query = {}
    if search:
        safe_search = sanitize_regex(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"city_zone": {"$regex": safe_search, "$options": "i"}},
        ]

    cards = await _db_holder.db.transport_cards.find(query, {"_id": 0}).to_list(200)
    return {"cards": cards, "total": len(cards)}


@transport_router.get("/sections")
async def get_sections():
    """Get all transport sections with counts"""
    pipeline = [
        {"$group": {"_id": "$section", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    results = await _db_holder.db.transport_operators.aggregate(pipeline).to_list(20)
    sections = [
        {
            "id": r["_id"],
            "label": {
                "nacional": "Nacional e Longo Curso",
                "lisboa": "Area Metropolitana de Lisboa",
                "porto": "Area Metropolitana do Porto",
                "regional": "Operadores Regionais",
                "aereo": "Transporte Aereo",
            }.get(r["_id"], r["_id"]),
            "count": r["count"],
            "icon": {
                "nacional": "train",
                "lisboa": "subway",
                "porto": "tram",
                "regional": "directions-bus",
                "aereo": "flight",
            }.get(r["_id"], "commute"),
        }
        for r in results
    ]
    return {"sections": sections, "total_operators": sum(s["count"] for s in sections)}
