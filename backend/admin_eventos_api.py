"""
admin_eventos_api.py — CRUD de eventos para o painel municipal
"""
import re
import uuid
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from dependencies import get_db
from tenant_middleware import TenantContext, require_tenant_write, require_tenant_delete

router = APIRouter(prefix="/admin/eventos", tags=["Admin Eventos"])

# Map the municipal `category` to the `type` the public agenda understands
# (see EVENT_CATEGORIES in frontend app/(tabs)/eventos.tsx).
_CAT_TO_TYPE = {
    "religioso": "religioso",
    "gastronómico": "gastronomia", "gastronomico": "gastronomia",
    "natureza": "natureza",
    "cultural": "cultural", "histórico": "cultural", "historico": "cultural",
    "musical": "festival",
    "desportivo": "festa", "artesanato": "festa", "outro": "festa",
}


def _parse_date(value) -> tuple[Optional[int], Optional[int]]:
    """Extract (month, day) from 'YYYY-MM-DD' or 'DD/MM/YYYY' strings."""
    if not value:
        return None, None
    s = str(value).strip()
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        return int(m.group(2)), int(m.group(3))
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})", s)
    if m:
        return int(m.group(2)), int(m.group(1))
    return None, None


def _agenda_fields(doc: dict) -> dict:
    """Derive agenda/calendar-readable fields from the municipal schema so an
    event created in the admin panel surfaces in the public Eventos tab. The
    agenda reads `name`/`type`/`month`/`day_start`/`day_end`/`concelho`, while
    the municipal form stores `title`/`category`/`start_date`/`location`."""
    out: dict = {}
    if doc.get("title") is not None:
        out["name"] = doc["title"]
    out["type"] = _CAT_TO_TYPE.get((doc.get("category") or "").strip().lower(), "festa")
    month, day_start = _parse_date(doc.get("start_date"))
    _, day_end = _parse_date(doc.get("end_date"))
    if month:
        out["month"] = month
        out["day_start"] = day_start or 1
        out["day_end"] = day_end or day_start or 1
    out["date_text"] = doc.get("start_date") or ""
    if doc.get("location"):
        out["concelho"] = doc["location"]
    out["rarity"] = "comum"
    return out


class EventoCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    image_url: Optional[str] = None


class EventoUpdate(EventoCreate):
    title: Optional[str] = None  # type: ignore[assignment]
    is_published: Optional[bool] = None


def _event_filter(tenant: TenantContext) -> dict:
    """Filtra por município excepto para admin_global."""
    if tenant.is_admin_global:
        return {}
    return {"municipality_id": tenant.municipality_id}


@router.get("")
async def list_eventos(
    tenant: TenantContext = Depends(require_tenant_write),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    flt = _event_filter(tenant)
    cursor = db.events.find(flt, {"_id": 0}).sort("start_date", -1).limit(200)
    eventos = [e async for e in cursor]
    return {"eventos": eventos, "total": len(eventos)}


@router.post("", status_code=201)
async def create_evento(
    body: EventoCreate,
    tenant: TenantContext = Depends(require_tenant_write),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = body.model_dump(exclude_none=True)
    doc.update({
        "id": str(uuid.uuid4()),
        "municipality_id": tenant.municipality_id,
        "created_by": tenant.user_id,
        "created_at": datetime.datetime.utcnow().isoformat(),
        "is_published": False,
        "source": "municipio",
    })
    doc.update(_agenda_fields(doc))
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/{evento_id}")
async def update_evento(
    evento_id: str,
    body: EventoUpdate,
    tenant: TenantContext = Depends(require_tenant_write),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    existing = await db.events.find_one({"id": evento_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    if not tenant.is_admin_global and existing.get("municipality_id") != tenant.municipality_id:
        raise HTTPException(status_code=403, detail="Sem permissão")

    update = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    update["updated_at"] = datetime.datetime.utcnow().isoformat()

    # Recompute agenda fields from the merged view so title/category/date edits
    # stay in sync with what the public Eventos tab reads.
    update.update(_agenda_fields({**existing, **update}))

    await db.events.update_one({"id": evento_id}, {"$set": update})
    return {**existing, **update}


@router.delete("/{evento_id}")
async def delete_evento(
    evento_id: str,
    tenant: TenantContext = Depends(require_tenant_delete),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    existing = await db.events.find_one({"id": evento_id}, {"municipality_id": 1})
    if not existing:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    if not tenant.is_admin_global and existing.get("municipality_id") != tenant.municipality_id:
        raise HTTPException(status_code=403, detail="Sem permissão")

    await db.events.delete_one({"id": evento_id})
    return {"success": True}
