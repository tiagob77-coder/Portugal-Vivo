"""
Community Encounters API
Artesãos, músicos, pescadores, agricultores — experiências de contacto real com comunidades locais.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging

from shared_utils import DatabaseHolder

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/encounters", tags=["Community Encounters"])

_db_holder = DatabaseHolder("encounters")
set_encounters_db = _db_holder.set

ENCOUNTER_TYPES = [
    "artesao", "musico", "pescador", "agricultor",
    "guia", "cozinheiro", "contador_historias", "viticultor", "oleiro",
]

TYPE_LABELS = {
    "artesao": "Artesão",
    "musico": "Músico",
    "pescador": "Pescador",
    "agricultor": "Agricultor",
    "guia": "Guia Local",
    "cozinheiro": "Cozinheiro / Chef",
    "contador_historias": "Contador de Histórias",
    "viticultor": "Viticultor",
    "oleiro": "Oleiro",
}

TYPE_ICONS = {
    "artesao": "handyman",
    "musico": "music-note",
    "pescador": "set-meal",
    "agricultor": "agriculture",
    "guia": "tour",
    "cozinheiro": "restaurant",
    "contador_historias": "auto-stories",
    "viticultor": "wine-bar",
    "oleiro": "sports-handball",
}


class EncounterCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    encounter_type: str
    description: str = Field(..., min_length=20)
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    availability: str = Field(..., description="e.g. 'Segunda a Sexta, 9h-18h'")
    languages: List[str] = ["pt"]
    poi_ids: List[str] = []
    region: str
    concelho: Optional[str] = None
    photo_url: Optional[str] = None
    booking_required: bool = False
    price_info: Optional[str] = None  # "Gratuito", "€15/pessoa", etc.
    lat: Optional[float] = None
    lng: Optional[float] = None


@router.get("", summary="Listar encontros com comunidades")
async def list_encounters(
    region: Optional[str] = None,
    encounter_type: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
):
    db = _db_holder.db
    query: dict = {"approved": True}
    if region:
        query["region"] = region
    if encounter_type:
        query["encounter_type"] = encounter_type
    items = await db.community_encounters.find(query, {"_id": 0}).limit(limit).to_list(limit)
    # Enrich with labels/icons
    for item in items:
        item["type_label"] = TYPE_LABELS.get(item.get("encounter_type", ""), item.get("encounter_type", ""))
        item["type_icon"] = TYPE_ICONS.get(item.get("encounter_type", ""), "person")
    return {"encounters": items, "total": len(items), "types": ENCOUNTER_TYPES}


@router.get("/types", summary="Tipos de encontros disponíveis")
async def get_encounter_types():
    return [
        {"id": t, "label": TYPE_LABELS[t], "icon": TYPE_ICONS[t]}
        for t in ENCOUNTER_TYPES
    ]


@router.get("/{encounter_id}", summary="Detalhe de um encontro")
async def get_encounter(encounter_id: str):
    db = _db_holder.db
    item = await db.community_encounters.find_one({"id": encounter_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Encontro não encontrado")
    item["type_label"] = TYPE_LABELS.get(item.get("encounter_type", ""), "")
    item["type_icon"] = TYPE_ICONS.get(item.get("encounter_type", ""), "person")
    return item


@router.post("", summary="Registar novo encontro (pendente aprovação)")
async def create_encounter(data: EncounterCreate):
    db = _db_holder.db
    if data.encounter_type not in ENCOUNTER_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo inválido. Opções: {ENCOUNTER_TYPES}")
    doc = {
        "id": str(uuid.uuid4()),
        **data.dict(),
        "approved": False,
        "type_label": TYPE_LABELS.get(data.encounter_type, data.encounter_type),
        "type_icon": TYPE_ICONS.get(data.encounter_type, "person"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.community_encounters.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "message": "Encontro submetido. Será analisado em 48h.", "encounter": doc}


@router.patch("/{encounter_id}/approve", summary="Aprovar encontro (admin)")
async def approve_encounter(encounter_id: str):
    db = _db_holder.db
    result = await db.community_encounters.update_one(
        {"id": encounter_id},
        {"$set": {"approved": True, "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Encontro não encontrado")
    return {"success": True}
