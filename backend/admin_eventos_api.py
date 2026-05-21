"""
admin_eventos_api.py — CRUD de eventos para o painel municipal
"""
import uuid
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from dependencies import get_db
from tenant_middleware import TenantContext, require_tenant_write, require_tenant_delete

router = APIRouter(prefix="/admin/eventos", tags=["Admin Eventos"])


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
