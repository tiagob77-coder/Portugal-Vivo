"""
Municipal (B2G) API — Portugal Vivo
====================================
Everything a municipality pays for in docs/pitch-municipios.md:

  * plans with quotas (curated POIs, featured audio guides)
  * an impact dashboard fed by anonymous app events (views, audio plays,
    route starts, QR scans, visitor origin)
  * a monthly PDF impact report
  * a public municipal profile page with the municipality's branding

Visitor origin comes from a GeoIP country header set by the edge proxy
(CF-IPCountry / X-Country-Code) and falls back to the device language region
("en-GB" → GB). Events carry no user id and no IP; the client session id is
hashed before storage and events expire after IMPACT_RETENTION_DAYS (RGPD:
anonymous statistics, data minimisation).

Routes:
  GET    /municipal/plans                                 plan catalogue (public)
  GET    /municipal/me/subscription                       plan, status and quota usage (tenant)
  GET    /municipal/me/impact                             impact dashboard (tenant)
  GET    /municipal/me/reports/{period}.pdf               monthly PDF report (tenant)
  GET    /municipal/me/profile                            own public profile (tenant)
  PUT    /municipal/me/profile                            edit public profile (municipio)
  GET    /municipal/me/audio-guides                       featured audio guides + quota (tenant)
  POST   /municipal/me/audio-guides/{poi_id}              feature a POI audio guide (tenant write)
  DELETE /municipal/me/audio-guides/{poi_id}              un-feature (tenant write)
  GET    /admin/municipal/subscriptions                   list subscriptions (admin)
  PUT    /admin/municipal/subscriptions/{municipality_id} create / update subscription (admin)
  POST   /impact/events                                   anonymous impact events (public)
  GET    /municipios                                      partner municipalities (public)
  GET    /municipios/{slug}                               public municipal profile (public)

Admins (admin_global) may pass ``?municipality_id=`` to every /municipal/me route.
"""
from __future__ import annotations

import hashlib
import io
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Literal, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field, field_validator

from auth_api import require_admin
from dependencies import get_db
from models.api_models import User
from tenant_middleware import TenantContext, TenantRole, require_tenant_read, require_tenant_write
from territory import (
    PUBLISHED_POI_FILTER,
    municipality_slug,
    resolve_poi_municipality,
    territory_filter,
)

logger = logging.getLogger(__name__)

municipal_router = APIRouter(prefix="/municipal", tags=["Municipal (B2G)"])
municipal_admin_router = APIRouter(prefix="/admin/municipal", tags=["Municipal (B2G) — Admin"])
impact_router = APIRouter(prefix="/impact", tags=["Municipal (B2G)"])
municipios_public_router = APIRouter(prefix="/municipios", tags=["Municipal (B2G)"])

IMPACT_RETENTION_DAYS = 400

# ─── Plans (docs/pitch-municipios.md + plano de negócios) ─────────────────────

MUNICIPAL_PLANS: Dict[str, Dict[str, Any]] = {
    "essencial": {
        "name": "Essencial",
        "audience": "Até 20 mil habitantes / territórios de baixa densidade",
        "price_eur_year": 2900,
        "max_pois": 80,
        "max_audio_guides": 10,
        "white_label": False,
    },
    "territorio": {
        "name": "Território",
        "audience": "20 a 100 mil habitantes",
        "price_eur_year": 4900,
        "max_pois": 150,
        "max_audio_guides": 20,
        "white_label": False,
    },
    "destino": {
        "name": "Destino",
        "audience": "Mais de 100 mil habitantes ou marca própria",
        "price_eur_year": 9900,
        "max_pois": None,
        "max_audio_guides": 40,
        "white_label": True,
    },
}
SETUP_FEE_EUR = 2500
ACTIVE_STATUSES = {"pilot", "active"}

PlanId = Literal["essencial", "territorio", "destino"]

# ─── Impact event taxonomy ────────────────────────────────────────────────────

IMPACT_EVENT_TYPES = {
    "poi_view",        # POI detail opened
    "audio_play",      # audio guide started
    "audio_complete",  # audio guide listened to the end
    "route_view",      # route detail opened
    "route_start",     # navigation started on a route / trail
    "directions",      # "Como chegar" tapped
    "share",           # POI or route shared
    "favorite",        # POI saved
    "qr_scan",         # app opened from a municipal QR code
    "profile_view",    # municipal public profile opened
}

_COUNTRY_HEADERS = ("cf-ipcountry", "x-country-code", "x-geo-country")
_COUNTRY_RE = re.compile(r"^[A-Z]{2}$")

MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
             "agosto", "setembro", "outubro", "novembro", "dezembro"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _is_active(sub: Optional[Dict[str, Any]], now: Optional[datetime] = None) -> bool:
    if not sub or sub.get("status") not in ACTIVE_STATUSES:
        return False
    ends = _as_utc(sub.get("ends_at"))
    return ends is None or ends > (now or _now())


def _plan_public(plan_id: str) -> Dict[str, Any]:
    return {"id": plan_id, **MUNICIPAL_PLANS[plan_id], "setup_fee_eur": SETUP_FEE_EUR}


# ─── Scope helpers ────────────────────────────────────────────────────────────

def _scope(tenant: TenantContext, municipality_id: Optional[str]) -> str:
    """Municipality slug the caller acts on. Admins choose; tenants are pinned."""
    if tenant.is_admin_global:
        if not municipality_id:
            raise HTTPException(status_code=400, detail="municipality_id obrigatório para administradores")
        return municipality_slug(municipality_id)
    if not tenant.municipality_id:
        raise HTTPException(status_code=403, detail="Utilizador sem município associado")
    if municipality_id and municipality_slug(municipality_id) != municipality_slug(tenant.municipality_id):
        raise HTTPException(status_code=403, detail="Sem acesso a outro município")
    return municipality_slug(tenant.municipality_id)


async def get_subscription(db: AsyncIOMotorDatabase, municipality: str) -> Optional[Dict[str, Any]]:
    return await db.municipal_subscriptions.find_one({"municipality_id": municipality}, {"_id": 0})


async def _territory(db: AsyncIOMotorDatabase, municipality: str) -> Dict[str, Any]:
    sub = await get_subscription(db, municipality) or {}
    names = list(sub.get("concelhos") or [])
    profile = await db.municipal_profiles.find_one({"municipality_id": municipality}, {"display_name": 1, "_id": 0})
    if profile and profile.get("display_name"):
        names.append(profile["display_name"])
    return territory_filter([municipality, *(sub.get("municipality_aliases") or [])], names)


async def _require_active(db: AsyncIOMotorDatabase, municipality: str, tenant: TenantContext) -> Dict[str, Any]:
    sub = await get_subscription(db, municipality)
    if not _is_active(sub) and not tenant.is_admin_global:
        raise HTTPException(
            status_code=402,
            detail="Funcionalidade incluída nos planos municipais. Contacte a equipa Portugal Vivo para ativar o piloto.",
        )
    return sub or {}


async def _poi_usage(db: AsyncIOMotorDatabase, municipality: str, raw_id: Optional[str] = None) -> Tuple[int, int]:
    """(curated POIs managed by the municipality, featured audio guides)."""
    ids = {municipality, municipality.replace("-", "_")} | ({raw_id} if raw_id else set())
    curated = await db.heritage_items.count_documents({"municipality_id": {"$in": sorted(ids)}})
    audio = await db.heritage_items.count_documents({"audio_featured_by": municipality})
    return curated, audio


async def enforce_poi_quota(db: AsyncIOMotorDatabase, municipality_id: str, new_pois: int) -> None:
    """Refuse an import that would exceed the municipality's curated-POI quota.

    Called by excel_import_api before writing. Raises 402 when the
    municipality has no active plan and 403 when the quota would overflow.
    """
    if new_pois <= 0:
        return
    municipality = municipality_slug(municipality_id)
    sub = await get_subscription(db, municipality)
    if not _is_active(sub):
        raise HTTPException(
            status_code=402,
            detail="Município sem plano ativo — a importação de POIs faz parte dos planos municipais.",
        )
    max_pois = MUNICIPAL_PLANS.get(sub.get("plan"), {}).get("max_pois")
    if max_pois is None:
        return
    curated, _ = await _poi_usage(db, municipality, municipality_id)
    if curated + new_pois > max_pois:
        raise HTTPException(
            status_code=403,
            detail=f"Quota do plano {MUNICIPAL_PLANS[sub['plan']]['name']} excedida: "
                   f"{curated} de {max_pois} POIs usados, importação traria mais {new_pois}.",
        )


# ─── Public catalogue ─────────────────────────────────────────────────────────

@municipal_router.get("/plans")
async def list_municipal_plans():
    """Escalões de preço municipais (valores anuais sem IVA)."""
    return {
        "plans": [_plan_public(p) for p in MUNICIPAL_PLANS],
        "setup_fee_eur": SETUP_FEE_EUR,
        "pilot_months": 3,
        "currency": "EUR",
        "vat_included": False,
        "notes": "Todos os escalões ficam abaixo do limiar de ajuste direto aplicável; "
                 "elegível como plataforma tecnológica em candidaturas municipais (ex.: Crescer com o Turismo).",
    }


# ─── Subscription (tenant + admin) ────────────────────────────────────────────

@municipal_router.get("/me/subscription")
async def get_my_subscription(
    municipality_id: Optional[str] = Query(None),
    tenant: TenantContext = Depends(require_tenant_read),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Plano, estado e consumo das quotas do município."""
    municipality = _scope(tenant, municipality_id)
    sub = await get_subscription(db, municipality)
    curated, audio = await _poi_usage(db, municipality)
    territory_total = await db.heritage_items.count_documents(await _territory(db, municipality))
    plan = MUNICIPAL_PLANS.get((sub or {}).get("plan"))
    return {
        "municipality_id": municipality,
        "subscription": sub,
        "active": _is_active(sub),
        "plan": _plan_public(sub["plan"]) if plan else None,
        "usage": {
            "curated_pois": curated,
            "max_pois": plan["max_pois"] if plan else None,
            "featured_audio_guides": audio,
            "max_audio_guides": plan["max_audio_guides"] if plan else None,
            "territory_pois_total": territory_total,
        },
    }


class SubscriptionUpsert(BaseModel):
    plan: PlanId
    status: Literal["pilot", "active", "suspended", "expired"] = "pilot"
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    concelhos: List[str] = Field(default_factory=list, max_length=20,
                                 description="Nomes oficiais dos concelhos abrangidos")
    municipality_aliases: List[str] = Field(default_factory=list, max_length=10,
                                            description="Outros municipality_id já usados nos POIs")
    contract_ref: Optional[str] = Field(None, max_length=120)
    notes: Optional[str] = Field(None, max_length=2000)


@municipal_admin_router.get("/subscriptions")
async def list_subscriptions(
    _admin: User = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Contratos municipais com receita anual em preço de tabela."""
    subs = await db.municipal_subscriptions.find({}, {"_id": 0}).sort("municipality_id", 1).to_list(1000)
    now = _now()
    arr = sum(MUNICIPAL_PLANS[s["plan"]]["price_eur_year"] for s in subs
              if s.get("status") == "active" and _is_active(s, now) and s.get("plan") in MUNICIPAL_PLANS)
    return {
        "subscriptions": subs,
        "total": len(subs),
        "active": sum(1 for s in subs if _is_active(s, now)),
        "arr_eur_list_price": arr,
    }


@municipal_admin_router.put("/subscriptions/{municipality_id}")
async def upsert_subscription(
    municipality_id: str,
    payload: SubscriptionUpsert,
    admin: User = Depends(require_admin),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Criar ou atualizar o contrato de um município. Piloto = 3 meses por omissão."""
    municipality = municipality_slug(municipality_id)
    if not municipality:
        raise HTTPException(status_code=422, detail="municipality_id inválido")
    now = _now()
    starts = _as_utc(payload.starts_at) or now
    ends = _as_utc(payload.ends_at)
    if ends is None:
        ends = starts + (timedelta(days=92) if payload.status == "pilot" else timedelta(days=365))
    if ends <= starts:
        raise HTTPException(status_code=422, detail="ends_at tem de ser posterior a starts_at")
    doc = {
        **payload.model_dump(exclude={"starts_at", "ends_at"}),
        "municipality_id": municipality,
        "starts_at": starts,
        "ends_at": ends,
        "updated_at": now,
        "updated_by": admin.user_id,
    }
    await db.municipal_subscriptions.update_one(
        {"municipality_id": municipality},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    logger.info("[municipal] Subscrição %s → %s (%s)", municipality, payload.plan, payload.status)
    return await get_subscription(db, municipality)


# ─── Impact events (public, anonymous) ────────────────────────────────────────

class ImpactEvent(BaseModel):
    event_type: str
    poi_id: Optional[str] = Field(None, max_length=120)
    route_id: Optional[str] = Field(None, max_length=120)
    municipality: Optional[str] = Field(None, max_length=120, description="Para profile_view / qr_scan")
    session_id: str = Field(..., min_length=8, max_length=64)
    platform: Optional[Literal["ios", "android", "web"]] = None
    locale: Optional[str] = Field(None, max_length=20)
    source: Optional[str] = Field(None, max_length=30, description="qr | share_link | map | feed | search …")

    @field_validator("event_type")
    @classmethod
    def _known_type(cls, v: str) -> str:
        if v not in IMPACT_EVENT_TYPES:
            raise ValueError(f"event_type desconhecido: {v}")
        return v


class ImpactBatch(BaseModel):
    events: List[ImpactEvent] = Field(..., min_length=1, max_length=50)


def _country_from(request: Request, locale: Optional[str]) -> Tuple[str, str]:
    for header in _COUNTRY_HEADERS:
        value = (request.headers.get(header) or "").strip().upper()
        if _COUNTRY_RE.match(value) and value not in ("XX", "T1"):
            return value, "geoip"
    if locale:
        parts = re.split(r"[-_]", locale)
        if len(parts) >= 2 and _COUNTRY_RE.match(parts[1].upper()):
            return parts[1].upper(), "locale"
    return "ZZ", "unknown"


def _session_hash(session_id: str) -> str:
    return hashlib.sha256(f"pv-impact:{session_id}".encode("utf-8")).hexdigest()[:20]


@impact_router.post("/events", status_code=202)
async def ingest_impact_events(
    batch: ImpactBatch,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Eventos anónimos de utilização (sem utilizador, sem IP) para o painel de impacto municipal."""
    poi_ids = {e.poi_id for e in batch.events if e.poi_id}
    route_ids = {e.route_id for e in batch.events if e.route_id}

    poi_mun: Dict[str, Optional[str]] = {}
    if poi_ids:
        async for p in db.heritage_items.find(
            {"id": {"$in": sorted(poi_ids)}}, {"_id": 0, "id": 1, "municipality_id": 1, "concelho": 1}
        ):
            poi_mun[p["id"]] = resolve_poi_municipality(p)

    route_mun: Dict[str, Optional[str]] = {}
    if route_ids:
        routes = await db.routes.find(
            {"id": {"$in": sorted(route_ids)}},
            {"_id": 0, "id": 1, "municipality_id": 1, "concelho": 1, "items": 1},
        ).to_list(len(route_ids))
        first_items = {r["id"]: (r.get("items") or [None])[0] for r in routes}
        missing = [i for i in first_items.values() if i and i not in poi_mun]
        if missing:
            async for p in db.heritage_items.find(
                {"id": {"$in": missing}}, {"_id": 0, "id": 1, "municipality_id": 1, "concelho": 1}
            ):
                poi_mun[p["id"]] = resolve_poi_municipality(p)
        for r in routes:
            route_mun[r["id"]] = resolve_poi_municipality(r) or poi_mun.get(first_items.get(r["id"]))
        # Trails (app/trail/[id].tsx) live in their own collection and send route_id = trail id
        unresolved = sorted(route_ids - set(route_mun))
        if unresolved:
            async for t in db.trails.find(
                {"id": {"$in": unresolved}}, {"_id": 0, "id": 1, "municipality_id": 1, "concelho": 1}
            ):
                route_mun[t["id"]] = resolve_poi_municipality(t)

    now = _now()
    docs = []
    for e in batch.events:
        municipality = (
            (poi_mun.get(e.poi_id) if e.poi_id else None)
            or (route_mun.get(e.route_id) if e.route_id else None)
            or (municipality_slug(e.municipality) if e.municipality else None)
        )
        country, origin_source = _country_from(request, e.locale)
        docs.append({
            "event_type": e.event_type,
            "poi_id": e.poi_id,
            "route_id": e.route_id,
            "municipality_id": municipality,
            "session": _session_hash(e.session_id),
            "platform": e.platform,
            "country": country,
            "origin_source": origin_source,
            "source": e.source,
            "ts": now,
        })
    await db.impact_events.insert_many(docs)
    return {"accepted": len(docs), "attributed": sum(1 for d in docs if d["municipality_id"])}


# ─── Impact dashboard ─────────────────────────────────────────────────────────

def _parse_day(value: Optional[str], default: datetime) -> datetime:
    if not value:
        return default
    try:
        return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=422, detail="Datas no formato AAAA-MM-DD")


def _month_range(period: str) -> Tuple[datetime, datetime]:
    try:
        start = datetime.strptime(period, "%Y-%m").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=422, detail="Período no formato AAAA-MM")
    end = (start + timedelta(days=32)).replace(day=1)
    return start, end


async def compute_impact(db: AsyncIOMotorDatabase, municipality: str, start: datetime, end: datetime) -> Dict[str, Any]:
    """Aggregate impact events of one municipality in [start, end)."""
    match = {"municipality_id": municipality, "ts": {"$gte": start, "$lt": end}}

    by_type = {d["_id"]: d["n"] async for d in db.impact_events.aggregate([
        {"$match": match}, {"$group": {"_id": "$event_type", "n": {"$sum": 1}}},
    ])}
    unique_sessions = 0
    async for d in db.impact_events.aggregate([
        {"$match": match}, {"$group": {"_id": "$session"}}, {"$group": {"_id": None, "n": {"$sum": 1}}},
    ]):
        unique_sessions = d["n"]

    origin = [{"country": d["_id"], "sessions": d["n"]} async for d in db.impact_events.aggregate([
        {"$match": match},
        {"$group": {"_id": {"c": "$country", "s": "$session"}}},
        {"$group": {"_id": "$_id.c", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
    ])]
    known = sum(o["sessions"] for o in origin if o["country"] != "ZZ")
    national = sum(o["sessions"] for o in origin if o["country"] == "PT")
    for o in origin:
        o["pct"] = round(o["sessions"] / unique_sessions * 100, 1) if unique_sessions else 0.0

    top_pois = [d async for d in db.impact_events.aggregate([
        {"$match": {**match, "poi_id": {"$ne": None}}},
        {"$group": {
            "_id": "$poi_id",
            "views": {"$sum": {"$cond": [{"$eq": ["$event_type", "poi_view"]}, 1, 0]}},
            "audio_plays": {"$sum": {"$cond": [{"$eq": ["$event_type", "audio_play"]}, 1, 0]}},
            "interactions": {"$sum": 1},
        }},
        {"$sort": {"views": -1, "interactions": -1}},
        {"$limit": 10},
    ])]
    names = {p["id"]: p.get("name") async for p in db.heritage_items.find(
        {"id": {"$in": [t["_id"] for t in top_pois]}}, {"_id": 0, "id": 1, "name": 1})}
    top_pois = [{"poi_id": t["_id"], "name": names.get(t["_id"], t["_id"]), "views": t["views"],
                 "audio_plays": t["audio_plays"], "interactions": t["interactions"]} for t in top_pois]

    top_routes = [d async for d in db.impact_events.aggregate([
        {"$match": {**match, "route_id": {"$ne": None}}},
        {"$group": {
            "_id": "$route_id",
            "views": {"$sum": {"$cond": [{"$eq": ["$event_type", "route_view"]}, 1, 0]}},
            "starts": {"$sum": {"$cond": [{"$eq": ["$event_type", "route_start"]}, 1, 0]}},
        }},
        {"$sort": {"starts": -1, "views": -1}},
        {"$limit": 10},
    ])]
    top_ids = [t["_id"] for t in top_routes]
    route_names = {r["id"]: r.get("name") async for r in db.trails.find(
        {"id": {"$in": top_ids}}, {"_id": 0, "id": 1, "name": 1})}
    route_names.update({r["id"]: r.get("name") async for r in db.routes.find(
        {"id": {"$in": top_ids}}, {"_id": 0, "id": 1, "name": 1})})
    top_routes = [{"route_id": t["_id"], "name": route_names.get(t["_id"], t["_id"]),
                   "views": t["views"], "starts": t["starts"]} for t in top_routes]

    daily: Dict[str, Dict[str, int]] = {}
    async for d in db.impact_events.aggregate([
        {"$match": match},
        {"$group": {
            "_id": {"y": {"$year": "$ts"}, "m": {"$month": "$ts"}, "d": {"$dayOfMonth": "$ts"}, "t": "$event_type"},
            "n": {"$sum": 1},
        }},
    ]):
        key = f"{d['_id']['y']:04d}-{d['_id']['m']:02d}-{d['_id']['d']:02d}"
        daily.setdefault(key, {})[d["_id"]["t"]] = d["n"]

    platforms = {(d["_id"] or "desconhecida"): d["n"] async for d in db.impact_events.aggregate([
        {"$match": match}, {"$group": {"_id": "$platform", "n": {"$sum": 1}}},
    ])}

    return {
        "municipality_id": municipality,
        "from": start.date().isoformat(),
        "to": (end - timedelta(days=1)).date().isoformat(),
        "totals": {
            "poi_views": by_type.get("poi_view", 0),
            "audio_plays": by_type.get("audio_play", 0),
            "audio_completes": by_type.get("audio_complete", 0),
            "route_views": by_type.get("route_view", 0),
            "route_starts": by_type.get("route_start", 0),
            "directions": by_type.get("directions", 0),
            "shares": by_type.get("share", 0),
            "favorites": by_type.get("favorite", 0),
            "qr_scans": by_type.get("qr_scan", 0),
            "profile_views": by_type.get("profile_view", 0),
            "unique_visitors": unique_sessions,
        },
        "origin": origin,
        "national_vs_international": {
            "national_sessions": national,
            "international_sessions": known - national,
            "unknown_sessions": unique_sessions - known,
            "international_pct": round((known - national) / known * 100, 1) if known else 0.0,
        },
        "top_pois": top_pois,
        "top_routes": top_routes,
        "daily": [{"date": k, **v} for k, v in sorted(daily.items())],
        "platforms": platforms,
        "methodology": "Eventos anónimos da app (sem identificação de utilizadores). Visitantes únicos = sessões "
                       "distintas. Origem por GeoIP do proxy quando disponível; caso contrário, pela região "
                       "da língua do dispositivo.",
    }


@municipal_router.get("/me/impact")
async def get_my_impact(
    municipality_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, alias="from", description="AAAA-MM-DD (inclusive)"),
    date_to: Optional[str] = Query(None, alias="to", description="AAAA-MM-DD (inclusive)"),
    tenant: TenantContext = Depends(require_tenant_read),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Painel de impacto: visitas por POI, origem dos visitantes, rotas mais usadas (por omissão, 30 dias)."""
    municipality = _scope(tenant, municipality_id)
    await _require_active(db, municipality, tenant)
    today = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    end = _parse_day(date_to, today) + timedelta(days=1)
    start = _parse_day(date_from, end - timedelta(days=30))
    if start >= end or (end - start).days > 366:
        raise HTTPException(status_code=422, detail="Intervalo inválido (máximo 366 dias)")
    return await compute_impact(db, municipality, start, end)


# ─── Monthly PDF report ───────────────────────────────────────────────────────

async def _content_health(db: AsyncIOMotorDatabase, territory: Dict[str, Any]) -> Dict[str, Any]:
    total = await db.heritage_items.count_documents(territory)
    with_image = await db.heritage_items.count_documents(
        {"$and": [territory, {"image_url": {"$regex": "^http"}}]})
    with_narrative = await db.heritage_items.count_documents(
        {"$and": [territory, {"micro_pitch": {"$exists": True, "$nin": ["", None]}}]})
    return {
        "pois": total,
        "with_image_pct": round(with_image / total * 100, 1) if total else 0.0,
        "with_narrative_pct": round(with_narrative / total * 100, 1) if total else 0.0,
    }


def render_impact_pdf(display_name: str, period: str, impact: Dict[str, Any],
                      health: Dict[str, Any], sub: Dict[str, Any]) -> bytes:
    """Monthly impact report as PDF bytes (reportlab)."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    year, month = (int(x) for x in period.split("-"))
    month_label = f"{MONTHS_PT[month - 1]} de {year}"
    accent = colors.HexColor("#2E5E4E")
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], textColor=accent, fontSize=18, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=accent, spaceBefore=10)
    small = ParagraphStyle("small", parent=styles["BodyText"], fontSize=8, textColor=colors.grey)

    def table(rows: List[List[Any]], widths: List[float]) -> Table:
        t = Table(rows, colWidths=widths)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), accent),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F2F2F2")]),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#BFBFBF")),
        ]))
        return t

    def with_fallback(header: List[str], rows: List[List[Any]]) -> List[List[Any]]:
        return [header] + (rows or [["Sem dados no período"] + [""] * (len(header) - 1)])

    totals = impact["totals"]
    nvi = impact["national_vs_international"]
    plan = MUNICIPAL_PLANS.get(sub.get("plan"), {})
    story: List[Any] = [
        Paragraph(f"Relatório de Impacto — {display_name}", h1),
        Paragraph(f"Portugal Vivo · {month_label}", styles["Heading3"]),
        Spacer(1, 0.3 * cm),
        Paragraph("Resumo do mês", h2),
        table([
            ["Indicador", "Valor"],
            ["Visitantes únicos", f"{totals['unique_visitors']:,}".replace(",", " ")],
            ["Visualizações de POIs", f"{totals['poi_views']:,}".replace(",", " ")],
            ["Áudio-guias ouvidos", f"{totals['audio_plays']:,}".replace(",", " ")],
            ["Rotas iniciadas", f"{totals['route_starts']:,}".replace(",", " ")],
            ["Pedidos de direções", f"{totals['directions']:,}".replace(",", " ")],
            ["Leituras de QR code", f"{totals['qr_scans']:,}".replace(",", " ")],
            ["Partilhas", f"{totals['shares']:,}".replace(",", " ")],
            ["Visitantes internacionais (origem conhecida)", f"{nvi['international_pct']} %"],
        ], [11 * cm, 5 * cm]),
        Paragraph("POIs mais visitados", h2),
        table(with_fallback(["POI", "Visualizações", "Áudio"],
                            [[p["name"][:60], p["views"], p["audio_plays"]] for p in impact["top_pois"]]),
              [10 * cm, 3 * cm, 3 * cm]),
        Paragraph("Origem dos visitantes", h2),
        table(with_fallback(["País", "Visitantes", "%"],
                            [["Desconhecida" if o["country"] == "ZZ" else o["country"], o["sessions"], f"{o['pct']} %"]
                             for o in impact["origin"][:10]]),
              [10 * cm, 3 * cm, 3 * cm]),
        Paragraph("Rotas mais usadas", h2),
        table(with_fallback(["Rota", "Inícios", "Visualizações"],
                            [[r["name"][:60], r["starts"], r["views"]] for r in impact["top_routes"]]),
              [10 * cm, 3 * cm, 3 * cm]),
        Paragraph("Qualidade do conteúdo no território", h2),
        table([
            ["Indicador", "Valor"],
            ["POIs no território", health["pois"]],
            ["POIs com imagem", f"{health['with_image_pct']} %"],
            ["POIs com narrativa", f"{health['with_narrative_pct']} %"],
            ["Plano", plan.get("name", "—")],
        ], [11 * cm, 5 * cm]),
        Spacer(1, 0.5 * cm),
        Paragraph(impact["methodology"], small),
        Paragraph(f"Gerado em {_now().strftime('%Y-%m-%d %H:%M')} UTC.", small),
    ]
    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, title=f"Relatório de Impacto {display_name} {period}",
                      author="Portugal Vivo", leftMargin=2 * cm, rightMargin=2 * cm,
                      topMargin=1.8 * cm, bottomMargin=1.8 * cm).build(story)
    return buf.getvalue()


@municipal_router.get("/me/reports/{period}.pdf")
async def get_monthly_report(
    period: str,
    municipality_id: Optional[str] = Query(None),
    tenant: TenantContext = Depends(require_tenant_read),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Relatório mensal de impacto em PDF (para relatórios de atividade e candidaturas)."""
    municipality = _scope(tenant, municipality_id)
    sub = await _require_active(db, municipality, tenant)
    start, end = _month_range(period)
    if start > _now():
        raise HTTPException(status_code=422, detail="Período futuro")
    impact = await compute_impact(db, municipality, start, end)
    health = await _content_health(db, await _territory(db, municipality))
    profile = await db.municipal_profiles.find_one({"municipality_id": municipality}, {"display_name": 1, "_id": 0})
    display = (profile or {}).get("display_name") or municipality.replace("-", " ").title()
    pdf = render_impact_pdf(display, period, impact, health, sub)
    filename = f"portugal-vivo-impacto-{municipality}-{period}.pdf"
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ─── Featured audio guides (quota) ────────────────────────────────────────────

@municipal_router.get("/me/audio-guides")
async def list_featured_audio_guides(
    municipality_id: Optional[str] = Query(None),
    tenant: TenantContext = Depends(require_tenant_read),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Áudio-guias em destaque do município e quota do plano."""
    municipality = _scope(tenant, municipality_id)
    sub = await get_subscription(db, municipality) or {}
    items = await db.heritage_items.find(
        {"audio_featured_by": municipality},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "audio_featured_at": 1},
    ).to_list(200)
    return {"items": items, "used": len(items),
            "max": MUNICIPAL_PLANS.get(sub.get("plan"), {}).get("max_audio_guides")}


@municipal_router.post("/me/audio-guides/{poi_id}", status_code=201)
async def feature_audio_guide(
    poi_id: str,
    municipality_id: Optional[str] = Query(None),
    tenant: TenantContext = Depends(require_tenant_write),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Marcar o áudio-guia de um POI do território como destaque (conta para a quota)."""
    municipality = _scope(tenant, municipality_id)
    sub = await _require_active(db, municipality, tenant)
    poi = await db.heritage_items.find_one(
        {"$and": [{"id": poi_id}, await _territory(db, municipality)]},
        {"_id": 0, "id": 1, "audio_featured_by": 1},
    )
    if not poi:
        raise HTTPException(status_code=404, detail="POI não encontrado no território")
    if poi.get("audio_featured_by") == municipality:
        return {"poi_id": poi_id, "featured": True}
    _, used = await _poi_usage(db, municipality)
    max_audio = MUNICIPAL_PLANS.get(sub.get("plan"), {}).get("max_audio_guides")
    if max_audio is not None and used >= max_audio:
        raise HTTPException(status_code=403, detail=f"Quota de áudio-guias esgotada ({used}/{max_audio}).")
    await db.heritage_items.update_one(
        {"id": poi_id},
        {"$set": {"audio_featured_by": municipality, "audio_featured_at": _now()}},
    )
    return {"poi_id": poi_id, "featured": True, "used": used + 1, "max": max_audio}


@municipal_router.delete("/me/audio-guides/{poi_id}", status_code=204)
async def unfeature_audio_guide(
    poi_id: str,
    municipality_id: Optional[str] = Query(None),
    tenant: TenantContext = Depends(require_tenant_write),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    municipality = _scope(tenant, municipality_id)
    await db.heritage_items.update_one(
        {"id": poi_id, "audio_featured_by": municipality},
        {"$unset": {"audio_featured_by": "", "audio_featured_at": ""}},
    )


# ─── Public municipal profile ─────────────────────────────────────────────────

_HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


class ProfileUpdate(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=80)
    tagline: Optional[str] = Field(None, max_length=140)
    description: Optional[str] = Field(None, max_length=3000)
    hero_image_url: Optional[str] = Field(None, max_length=500)
    logo_url: Optional[str] = Field(None, max_length=500)
    brand_color: Optional[str] = Field(None, description="#RRGGBB")
    website: Optional[str] = Field(None, max_length=300)
    contact_email: Optional[str] = Field(None, max_length=200)
    featured_poi_ids: List[str] = Field(default_factory=list, max_length=12)
    featured_route_ids: List[str] = Field(default_factory=list, max_length=6)

    @field_validator("brand_color")
    @classmethod
    def _color(cls, v: Optional[str]) -> Optional[str]:
        if v and not _HEX_COLOR.match(v):
            raise ValueError("brand_color deve ser #RRGGBB")
        return v

    @field_validator("hero_image_url", "logo_url", "website")
    @classmethod
    def _https(cls, v: Optional[str]) -> Optional[str]:
        if v and not v.startswith("https://"):
            raise ValueError("URLs têm de usar https://")
        return v


@municipal_router.get("/me/profile")
async def get_my_profile(
    municipality_id: Optional[str] = Query(None),
    tenant: TenantContext = Depends(require_tenant_read),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    municipality = _scope(tenant, municipality_id)
    profile = await db.municipal_profiles.find_one({"municipality_id": municipality}, {"_id": 0})
    return {"municipality_id": municipality, "profile": profile}


@municipal_router.put("/me/profile")
async def update_my_profile(
    payload: ProfileUpdate,
    municipality_id: Optional[str] = Query(None),
    tenant: TenantContext = Depends(require_tenant_write),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Editar o perfil público (só o papel 'municipio' ou administradores)."""
    if tenant.role not in (TenantRole.MUNICIPIO, TenantRole.ADMIN_GLOBAL):
        raise HTTPException(status_code=403, detail="Só o perfil 'municipio' pode editar a página pública")
    municipality = _scope(tenant, municipality_id)
    await _require_active(db, municipality, tenant)

    territory = await _territory(db, municipality)
    if payload.featured_poi_ids:
        found = await db.heritage_items.count_documents(
            {"$and": [{"id": {"$in": payload.featured_poi_ids}}, territory]})
        if found != len(set(payload.featured_poi_ids)):
            raise HTTPException(status_code=422, detail="Há POIs em destaque fora do território do município")

    doc = {**payload.model_dump(), "municipality_id": municipality, "updated_at": _now(),
           "updated_by": tenant.user_id}
    await db.municipal_profiles.update_one({"municipality_id": municipality}, {"$set": doc}, upsert=True)
    return await db.municipal_profiles.find_one({"municipality_id": municipality}, {"_id": 0})


async def _active_municipalities(db: AsyncIOMotorDatabase) -> Dict[str, Dict[str, Any]]:
    now = _now()
    subs = await db.municipal_subscriptions.find({"status": {"$in": sorted(ACTIVE_STATUSES)}}, {"_id": 0}).to_list(1000)
    return {s["municipality_id"]: s for s in subs if _is_active(s, now)}


@municipios_public_router.get("")
async def list_partner_municipalities(db: AsyncIOMotorDatabase = Depends(get_db)):
    """Municípios parceiros com página pública ativa."""
    active = await _active_municipalities(db)
    if not active:
        return {"municipalities": [], "total": 0}
    profiles = await db.municipal_profiles.find(
        {"municipality_id": {"$in": sorted(active)}},
        {"_id": 0, "municipality_id": 1, "display_name": 1, "tagline": 1, "hero_image_url": 1,
         "logo_url": 1, "brand_color": 1},
    ).sort("display_name", 1).to_list(500)
    for p in profiles:
        p["slug"] = p["municipality_id"]
    return {"municipalities": profiles, "total": len(profiles)}


@municipios_public_router.get("/{slug}")
async def get_public_profile(slug: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Página pública de um município parceiro (perfil, destaques e números do território)."""
    municipality = municipality_slug(slug)
    sub = await get_subscription(db, municipality)
    profile = await db.municipal_profiles.find_one({"municipality_id": municipality}, {"_id": 0, "updated_by": 0})
    if not profile or not _is_active(sub):
        raise HTTPException(status_code=404, detail="Município sem página no Portugal Vivo")

    territory = {"$and": [await _territory(db, municipality), PUBLISHED_POI_FILTER]}
    poi_count = await db.heritage_items.count_documents(territory)
    categories = [{"category": d["_id"], "count": d["n"]} async for d in db.heritage_items.aggregate([
        {"$match": territory}, {"$group": {"_id": "$category", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}}, {"$limit": 8},
    ])]
    poi_fields = {"_id": 0, "id": 1, "name": 1, "category": 1, "image_url": 1, "micro_pitch": 1, "location": 1}
    featured_ids = profile.get("featured_poi_ids") or []
    if featured_ids:
        featured = await db.heritage_items.find(
            {"$and": [{"id": {"$in": featured_ids}}, PUBLISHED_POI_FILTER]}, poi_fields).to_list(12)
        order = {pid: n for n, pid in enumerate(featured_ids)}
        featured.sort(key=lambda p: order.get(p["id"], 99))
    else:
        featured = await db.heritage_items.find(
            {"$and": [territory, {"image_url": {"$regex": "^http"}}]}, poi_fields).limit(6).to_list(6)
    routes = []
    if profile.get("featured_route_ids"):
        routes = await db.routes.find(
            {"id": {"$in": profile["featured_route_ids"]}},
            {"_id": 0, "id": 1, "name": 1, "description": 1, "image_url": 1, "duration_hours": 1},
        ).to_list(6)
    audio_count = await db.heritage_items.count_documents({"audio_featured_by": municipality})
    return {
        "slug": municipality,
        "profile": profile,
        "stats": {"pois": poi_count, "audio_guides": audio_count, "categories": categories},
        "featured_pois": featured,
        "featured_routes": routes,
        "plan_white_label": bool(MUNICIPAL_PLANS.get((sub or {}).get("plan"), {}).get("white_label")),
    }
