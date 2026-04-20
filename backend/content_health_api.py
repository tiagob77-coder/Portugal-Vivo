"""
Content Health API — Portugal Vivo
===================================
Calcula um health score (0–100) por POI com base em 5 dimensões:

  image_score         (0–20)  tem imagem válida?
  description_freshness (0–25)  última edição há quantos dias?
  narrative_depth     (0–25)  micro_pitch / descricao_curta / local_story?
  iq_component        (0–20)  pontuação do IQ Engine (já calculada)
  seasonal_freshness  (0–10)  evento próximo mas POI não actualizado?

Tiers de saúde:
  healthy      ≥ 75
  attention    50–74
  stale        25–49
  critical     < 25

Rotas:
  GET  /content-health/score/{poi_id}    — score de um POI
  GET  /content-health/stale             — fila de POIs por trabalhar (paginada)
  GET  /content-health/summary           — distribuição agregada
  POST /content-health/recompute         — recomputar e guardar scores (admin)
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ─── Router ──────────────────────────────────────────────────────────────────

health_router = APIRouter(prefix="/content-health", tags=["Content Health"])

# ─── DB injection ────────────────────────────────────────────────────────────

_db = None
_require_auth = None
_require_admin = None


def set_content_health_db(database) -> None:
    global _db
    _db = database


def set_content_health_auth(require_auth, require_admin) -> None:
    global _require_auth, _require_admin
    _require_auth = require_auth
    _require_admin = require_admin


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _days_since(dt: Optional[datetime]) -> Optional[int]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (_now() - dt).days


def _compute_image_score(item: Dict[str, Any]) -> int:
    """0–20: tem image_url populada e não vazia."""
    url = item.get("image_url") or ""
    url = url.strip()
    if not url:
        return 0
    # URL parece válida (começa com http e tem extensão de imagem ou CDN)
    if url.startswith("http") and len(url) > 15:
        return 20
    return 5


def _compute_description_freshness(item: Dict[str, Any]) -> int:
    """0–25: frescura da descrição baseada em last_edited_at ou created_at."""
    last_edited = item.get("last_edited_at")
    created_at = item.get("created_at")

    # Preferir last_edited_at; fallback para created_at
    ref_date = last_edited or created_at
    days = _days_since(ref_date)

    if days is None:
        return 3   # sem data — muito antigo / seed puro
    if last_edited is None:
        # Só tem created_at → nunca foi editado após seed
        return 5
    if days < 30:
        return 25
    if days < 90:
        return 18
    if days < 180:
        return 12
    if days < 365:
        return 8
    return 5


def _compute_narrative_depth(item: Dict[str, Any]) -> int:
    """0–25: riqueza narrativa (micro_pitch, descricao_curta, local_story)."""
    score = 0
    micro_pitch = (item.get("micro_pitch") or "").strip()
    descricao_curta = (item.get("descricao_curta") or "").strip()
    description = (item.get("description") or "").strip()
    local_story = (item.get("local_story") or item.get("historia_local") or "").strip()

    if micro_pitch:
        score += 8
    if descricao_curta:
        score += 7
    if len(description) > 300:
        score += 5
    if local_story:
        score += 5

    return min(score, 25)


def _compute_iq_component(item: Dict[str, Any]) -> int:
    """0–20: converte iq_results (0–100) em componente do health score."""
    iq_results = item.get("iq_results")
    if not iq_results:
        return 2

    if isinstance(iq_results, list):
        scores = [r.get("score", 0) for r in iq_results if isinstance(r, dict)]
        iq = sum(scores) / len(scores) if scores else 0
    elif isinstance(iq_results, dict):
        iq = iq_results.get("score", 0)
    else:
        iq = 0

    if iq >= 80:
        return 20
    if iq >= 60:
        return 15
    if iq >= 40:
        return 10
    if iq >= 20:
        return 5
    return 2


async def _compute_seasonal_freshness(item: Dict[str, Any]) -> int:
    """0–10: tem evento próximo (≤30 dias)? Foi o POI actualizado recentemente?"""
    if _db is None:
        return 7

    poi_id = item.get("id") or item.get("_id")
    region = item.get("region", "")
    now = _now()
    horizon = now + timedelta(days=30)

    # Procurar eventos com poi_id directo ou na mesma região
    try:
        events_col = _db["events"]
        query = {
            "$or": [
                {"poi_id": str(poi_id)},
                {"region": region},
            ]
        }
        # Filtrar por data — o campo 'date' pode ser string; tentamos ambos
        upcoming = await events_col.find_one(query)
    except Exception:
        upcoming = None

    if not upcoming:
        return 7   # sem eventos → neutro

    # Há evento próximo — foi o POI actualizado nos últimos 14 dias?
    last_edited = item.get("last_edited_at")
    days = _days_since(last_edited)
    if days is not None and days <= 14:
        return 10  # actualizado e tem evento — excelente
    return 3       # tem evento mas POI não foi actualizado — penalizar


def _tier(score: int) -> str:
    if score >= 75:
        return "healthy"
    if score >= 50:
        return "attention"
    if score >= 25:
        return "stale"
    return "critical"


async def _score_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Calcula o health score completo de um item."""
    image = _compute_image_score(item)
    freshness = _compute_description_freshness(item)
    narrative = _compute_narrative_depth(item)
    iq = _compute_iq_component(item)
    seasonal = await _compute_seasonal_freshness(item)

    total = image + freshness + narrative + iq + seasonal

    return {
        "poi_id": str(item.get("id") or item.get("_id", "")),
        "name": item.get("name", ""),
        "category": item.get("category", ""),
        "region": item.get("region", ""),
        "concelho": item.get("concelho", ""),
        "score": total,
        "tier": _tier(total),
        "breakdown": {
            "image_score": image,
            "description_freshness": freshness,
            "narrative_depth": narrative,
            "iq_component": iq,
            "seasonal_freshness": seasonal,
        },
        "flags": _build_flags(item, image, freshness, narrative, iq, seasonal),
        "computed_at": _now().isoformat(),
    }


def _build_flags(item, image, freshness, narrative, iq, seasonal) -> List[str]:
    """Lista de acções recomendadas."""
    flags = []
    if image == 0:
        flags.append("sem_imagem")
    if freshness <= 5:
        flags.append("descrição_desactualizada")
    if narrative < 8:
        flags.append("sem_narrativa")
    if iq <= 2:
        flags.append("sem_iq_score")
    if seasonal == 3:
        flags.append("evento_próximo_sem_actualização")
    return flags


# ─── Modelos de resposta ──────────────────────────────────────────────────────

class HealthScoreResponse(BaseModel):
    poi_id: str
    name: str
    category: str
    region: str
    concelho: str
    score: int
    tier: str
    breakdown: Dict[str, int]
    flags: List[str]
    computed_at: str


class StaleQueueResponse(BaseModel):
    items: List[HealthScoreResponse]
    total: int
    page: int
    page_size: int
    filters_applied: Dict[str, Any]


class HealthSummaryResponse(BaseModel):
    total_pois: int
    avg_score: float
    tiers: Dict[str, int]   # healthy / attention / stale / critical
    top_flags: Dict[str, int]
    last_computed: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@health_router.get("/score/{poi_id}", response_model=HealthScoreResponse)
async def get_poi_health_score(poi_id: str):
    """Health score de um POI específico."""
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    item = await _db["heritage_items"].find_one({"id": poi_id})
    if not item:
        raise HTTPException(404, f"POI {poi_id} não encontrado")

    return await _score_item(item)


@health_router.get("/stale", response_model=StaleQueueResponse)
async def get_stale_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    tier: Optional[str] = Query(None, description="critical | stale | attention | healthy"),
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    flag: Optional[str] = Query(None, description="ex: sem_imagem, evento_próximo_sem_actualização"),
):
    """
    Lista de POIs ordenados por health score (mais baixo primeiro).
    Ideal para a fila de trabalho editorial.
    """
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    # Construir filtro MongoDB base
    mongo_filter: Dict[str, Any] = {}
    if region:
        mongo_filter["region"] = region
    if category:
        mongo_filter["category"] = category

    # Projecção: só os campos necessários para calcular o score
    projection = {
        "id": 1, "name": 1, "category": 1, "region": 1, "concelho": 1,
        "image_url": 1, "description": 1, "micro_pitch": 1, "descricao_curta": 1,
        "local_story": 1, "historia_local": 1,
        "created_at": 1, "last_edited_at": 1,
        "iq_results": 1,
        "_id": 0,
    }

    skip = (page - 1) * page_size
    total_count = await _db["heritage_items"].count_documents(mongo_filter)

    # Puxar um lote maior para poder ordenar por score (sem índice de score no Mongo)
    # Para grandes colecções usar /recompute que persiste scores
    batch_size = min(total_count, max(page_size * 10, 300))
    cursor = _db["heritage_items"].find(mongo_filter, projection).limit(batch_size)
    raw_items = await cursor.to_list(length=batch_size)

    # Calcular scores
    scored = []
    for item in raw_items:
        s = await _score_item(item)
        scored.append(s)

    # Filtrar por tier e flag
    if tier:
        scored = [s for s in scored if s["tier"] == tier]
    if flag:
        scored = [s for s in scored if flag in s["flags"]]

    # Ordenar por score ascendente (mais críticos primeiro)
    scored.sort(key=lambda x: x["score"])

    # Paginar
    page_items = scored[skip: skip + page_size]

    return {
        "items": page_items,
        "total": len(scored),
        "page": page,
        "page_size": page_size,
        "filters_applied": {
            "region": region,
            "category": category,
            "tier": tier,
            "flag": flag,
        },
    }


@health_router.get("/summary", response_model=HealthSummaryResponse)
async def get_health_summary(
    region: Optional[str] = Query(None),
):
    """Distribuição de saúde editorial agregada — para o dashboard de admin."""
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    mongo_filter: Dict[str, Any] = {}
    if region:
        mongo_filter["region"] = region

    projection = {
        "id": 1, "image_url": 1, "description": 1, "micro_pitch": 1,
        "descricao_curta": 1, "local_story": 1, "historia_local": 1,
        "created_at": 1, "last_edited_at": 1, "iq_results": 1,
        "region": 1, "category": 1, "concelho": 1,
        "_id": 0,
    }

    # Amostrar até 2000 itens para performance
    cursor = _db["heritage_items"].find(mongo_filter, projection).limit(2000)
    raw_items = await cursor.to_list(length=2000)

    tiers: Dict[str, int] = {"healthy": 0, "attention": 0, "stale": 0, "critical": 0}
    flag_counts: Dict[str, int] = {}
    total_score = 0

    for item in raw_items:
        s = await _score_item(item)
        tiers[s["tier"]] += 1
        total_score += s["score"]
        for f in s["flags"]:
            flag_counts[f] = flag_counts.get(f, 0) + 1

    n = len(raw_items)
    return {
        "total_pois": n,
        "avg_score": round(total_score / n, 1) if n > 0 else 0.0,
        "tiers": tiers,
        "top_flags": dict(sorted(flag_counts.items(), key=lambda x: -x[1])[:10]),
        "last_computed": _now().isoformat(),
    }


@health_router.post("/recompute")
async def recompute_scores(current_user: dict = Depends(lambda: None)):
    """
    Recomputa e persiste health scores em 'heritage_items' (campo content_health_score).
    Operação pesada — chamar em off-peak ou via cron.
    Admin apenas.
    """
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    projection = {
        "id": 1, "image_url": 1, "description": 1, "micro_pitch": 1,
        "descricao_curta": 1, "local_story": 1, "historia_local": 1,
        "created_at": 1, "last_edited_at": 1, "iq_results": 1,
        "region": 1, "category": 1, "concelho": 1,
        "_id": 0,
    }

    cursor = _db["heritage_items"].find({}, projection)
    items = await cursor.to_list(length=None)

    updated = 0
    for item in items:
        s = await _score_item(item)
        await _db["heritage_items"].update_one(
            {"id": item.get("id")},
            {"$set": {
                "content_health_score": s["score"],
                "content_health_tier": s["tier"],
                "content_health_flags": s["flags"],
                "content_health_computed_at": _now(),
            }},
        )
        updated += 1

    logger.info("[content_health] Recomputed %d POI scores", updated)
    return {"updated": updated, "computed_at": _now().isoformat()}
