"""
Seasonal Triggers API — Portugal Vivo
=======================================
Liga eventos culturais próximos (Agenda Viral e outros) a POIs relacionados,
gerando flags de enriquecimento sazonal e sugestões de draft via IA.

Lógica de matching (por ordem de prioridade):
  1. Directo   — evento tem campo `poi_id` explícito
  2. Por nome  — tokens do nome do evento aparecem no nome/descrição do POI
  3. Por local — evento.location ou evento.concelho == poi.concelho
  4. Por região — fallback: evento.region == poi.region (cria flag genérica)

Um flag sazonal tem lifecycle:
  pending   → admin/parceiro revê e decide enriquecer ou skip
  enriched  → LLM gerou um draft com contexto sazonal
  resolved  → draft foi publicado
  skipped   → não relevante para este POI

Cron típico: `POST /seasonal/run-daily` chamado todos os dias às 06:00 UTC.

Collections:
  seasonal_flags  — flags activos
  events          — eventos (Agenda Viral)
  heritage_items  — POIs
  content_drafts  — drafts gerados (pipeline toolkit)

Rotas:
  POST  /seasonal/run-daily              — trigger diário (admin/cron)
  GET   /seasonal/flags                  — listar flags activos
  GET   /seasonal/flags/{poi_id}         — flags de um POI
  POST  /seasonal/flags/{flag_id}/enrich — gerar draft sazonal via LLM
  POST  /seasonal/flags/{flag_id}/resolve — marcar como resolvido
  POST  /seasonal/flags/{flag_id}/skip   — saltar este flag
"""

import logging
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ─── Router ──────────────────────────────────────────────────────────────────

seasonal_router = APIRouter(prefix="/seasonal", tags=["Seasonal Triggers"])

# ─── DB / Auth / LLM injection ───────────────────────────────────────────────

_db = None
_require_auth = None
_require_admin = None
_llm_key: Optional[str] = None


def set_seasonal_db(database) -> None:
    global _db
    _db = database


def set_seasonal_auth(require_auth, require_admin) -> None:
    global _require_auth, _require_admin
    _require_auth = require_auth
    _require_admin = require_admin


def set_seasonal_llm_key(key: str) -> None:
    global _llm_key
    _llm_key = key


# ─── LLM helper ──────────────────────────────────────────────────────────────

async def _call_llm(system: str, user: str, max_tokens: int = 600) -> str:
    if not _llm_key:
        return ""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = (
            LlmChat(
                api_key=_llm_key,
                session_id=f"seasonal-{uuid.uuid4().hex[:8]}",
                system_message=system,
            )
            .with_model("openai", "gpt-4o-mini")
            .with_max_tokens(max_tokens)
        )
        resp = await chat.send_message(UserMessage(content=user))
        return resp.strip() if resp else ""
    except Exception as exc:
        logger.warning("[seasonal] LLM call failed: %s", exc)
        return ""


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _tokenize(text: str) -> set:
    """Tokens normalizados (minúsculas, sem acentos, ≥4 chars)."""
    text = text.lower()
    # remover acentos básicos
    for a, b in [("ã", "a"), ("â", "a"), ("á", "a"), ("à", "a"),
                  ("é", "e"), ("ê", "e"), ("í", "i"), ("ó", "o"),
                  ("ô", "o"), ("ú", "u"), ("ç", "c"), ("õ", "o")]:
        text = text.replace(a, b)
    return {t for t in re.split(r"\W+", text) if len(t) >= 4}


def _match_score(event: Dict, poi: Dict) -> int:
    """
    Devolve 0 (sem match), 1 (region), 2 (location/concelho), 3 (nome).
    Quanto mais alto, mais forte o match.
    """
    # 1. Match directo por poi_id
    if str(event.get("poi_id", "")).strip() == str(poi.get("id", "")).strip():
        return 10

    # 2. Match por nome (tokens)
    ev_tokens = _tokenize(event.get("name", "") + " " + event.get("location", ""))
    poi_tokens = _tokenize(poi.get("name", "") + " " + poi.get("description", "")[:200])
    overlap = ev_tokens & poi_tokens
    if len(overlap) >= 2:
        return 3

    # 3. Match por concelho
    ev_concelho = (event.get("concelho") or event.get("location") or "").lower()
    poi_concelho = (poi.get("concelho") or "").lower()
    if ev_concelho and poi_concelho and ev_concelho == poi_concelho:
        return 2

    # 4. Match por região
    if event.get("region") and event.get("region") == poi.get("region"):
        return 1

    return 0


async def _parse_event_date(event: Dict) -> Optional[datetime]:
    """Tenta extrair datetime de event.date (pode ser str ISO, int epoch, None)."""
    raw = event.get("date") or event.get("start_date")
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw.replace(tzinfo=timezone.utc) if raw.tzinfo is None else raw
    if isinstance(raw, str):
        for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y", "%Y-%m"):
            try:
                dt = datetime.strptime(raw[:len(fmt) + 2], fmt)
                return dt.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
    return None


# ─── Motor de matching ────────────────────────────────────────────────────────

async def _run_matching(horizon_days: int = 30) -> Dict[str, int]:
    """
    Corre o matching eventos↔POIs e cria/actualiza flags na collection seasonal_flags.
    Devolve estatísticas: {created, updated, skipped}.
    """
    if _db is None:
        return {"created": 0, "updated": 0, "skipped": 0}

    now = _now()
    horizon = now + timedelta(days=horizon_days)

    # Puxar eventos (todos — filtragem de data em Python pois o campo pode ser string)
    events_cursor = _db["events"].find({}, {
        "id": 1, "name": 1, "region": 1, "location": 1, "concelho": 1,
        "date": 1, "start_date": 1, "type": 1, "poi_id": 1, "_id": 0,
    })
    all_events = await events_cursor.to_list(length=5000)

    # Filtrar eventos com data nos próximos horizon_days
    upcoming = []
    for ev in all_events:
        dt = await _parse_event_date(ev)
        if dt and now <= dt <= horizon:
            ev["_parsed_date"] = dt
            upcoming.append(ev)

    if not upcoming:
        logger.info("[seasonal] Sem eventos nos próximos %d dias", horizon_days)
        return {"created": 0, "updated": 0, "skipped": 0}

    logger.info("[seasonal] %d eventos nos próximos %d dias", len(upcoming), horizon_days)

    # Puxar POIs relevantes pelas regiões dos eventos
    regions = list({ev.get("region", "") for ev in upcoming if ev.get("region")})
    poi_cursor = _db["heritage_items"].find(
        {"region": {"$in": regions}} if regions else {},
        {"id": 1, "name": 1, "description": 1, "category": 1, "region": 1,
         "concelho": 1, "last_edited_at": 1, "_id": 0},
    )
    pois = await poi_cursor.to_list(length=10000)

    created = updated = skipped = 0

    for event in upcoming:
        for poi in pois:
            score = _match_score(event, poi)
            if score == 0:
                continue

            # Verificar se já existe flag para este par
            flag_id_key = f"{event.get('id', '')}_{poi.get('id', '')}"
            existing = await _db["seasonal_flags"].find_one({
                "event_id": event.get("id", ""),
                "poi_id": poi.get("id", ""),
            })

            # Calcular datas de activação/reversão
            event_date = event.get("_parsed_date", now + timedelta(days=14))
            active_from = event_date - timedelta(days=14)
            revert_after = event_date + timedelta(days=7)

            if existing:
                if existing.get("status") in ("skipped", "resolved"):
                    skipped += 1
                    continue
                # Actualizar datas se necessário
                await _db["seasonal_flags"].update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"active_from": active_from, "revert_after": revert_after, "updated_at": now}},
                )
                updated += 1
            else:
                flag = {
                    "flag_id": uuid.uuid4().hex,
                    "poi_id": poi.get("id", ""),
                    "poi_name": poi.get("name", ""),
                    "poi_region": poi.get("region", ""),
                    "poi_category": poi.get("category", ""),
                    "event_id": event.get("id", ""),
                    "event_name": event.get("name", ""),
                    "event_date": event_date,
                    "event_type": event.get("type", ""),
                    "match_score": score,
                    "active_from": active_from,
                    "revert_after": revert_after,
                    "status": "pending",
                    "draft_id": None,
                    "created_at": now,
                    "updated_at": now,
                }
                await _db["seasonal_flags"].insert_one(flag)
                created += 1

    logger.info("[seasonal] created=%d updated=%d skipped=%d", created, updated, skipped)
    return {"created": created, "updated": updated, "skipped": skipped}


# ─── Endpoints ───────────────────────────────────────────────────────────────

@seasonal_router.post("/run-daily")
async def run_daily(horizon_days: int = Query(30, ge=7, le=60)):
    """
    Trigger diário do matching eventos↔POIs.
    Chamar via cron às 06:00 UTC ou manualmente pelo admin.
    """
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    stats = await _run_matching(horizon_days=horizon_days)
    return {
        "status": "ok",
        "horizon_days": horizon_days,
        "run_at": _now().isoformat(),
        **stats,
    }


@seasonal_router.get("/flags")
async def list_flags(
    status: Optional[str] = Query(None, description="pending | enriched | resolved | skipped"),
    region: Optional[str] = Query(None),
    poi_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
):
    """Lista de flags sazonais activos, ordenados por data de evento."""
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["pending", "enriched"]}
    if region:
        query["poi_region"] = region
    if poi_id:
        query["poi_id"] = poi_id

    total = await _db["seasonal_flags"].count_documents(query)
    skip = (page - 1) * page_size

    cursor = (
        _db["seasonal_flags"]
        .find(query, {"_id": 0})
        .sort("event_date", 1)
        .skip(skip)
        .limit(page_size)
    )
    flags = await cursor.to_list(length=page_size)
    return {"flags": flags, "total": total, "page": page, "page_size": page_size}


@seasonal_router.get("/flags/{poi_id}")
async def get_poi_flags(poi_id: str):
    """Flags sazonais para um POI específico."""
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    cursor = _db["seasonal_flags"].find(
        {"poi_id": poi_id},
        {"_id": 0},
    ).sort("event_date", 1)
    flags = await cursor.to_list(length=50)
    return {"poi_id": poi_id, "flags": flags}


@seasonal_router.post("/flags/{flag_id}/enrich")
async def enrich_flag(flag_id: str):
    """
    Gera um draft sazonal para o POI via LLM e cria-o na collection content_drafts.
    O draft fica com status 'draft' pronto para entrar no pipeline toolkit.
    """
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    flag = await _db["seasonal_flags"].find_one({"flag_id": flag_id})
    if not flag:
        raise HTTPException(404, f"Flag {flag_id} não encontrado")

    if flag.get("status") in ("resolved", "skipped"):
        raise HTTPException(400, f"Flag já está em estado '{flag['status']}'")

    # Puxar detalhe do POI
    poi = await _db["heritage_items"].find_one(
        {"id": flag["poi_id"]},
        {"name": 1, "description": 1, "category": 1, "region": 1, "_id": 0},
    )
    poi_desc = (poi.get("description", "") if poi else "")[:500] if poi else ""
    poi_name = flag.get("poi_name", flag["poi_id"])
    event_name = flag.get("event_name", "")
    event_date = flag.get("event_date")
    event_date_str = event_date.strftime("%d de %B de %Y") if isinstance(event_date, datetime) else str(event_date)

    system = (
        "És um editor cultural português especialista em narrativas de património. "
        "Escreves em português europeu, com linguagem precisa e sentido de lugar. "
        "Nunca usas superlativos vazios. O texto deve ser factual e evocativo."
    )
    user = (
        f"Escreve um parágrafo de enriquecimento sazonal (60–100 palavras) para o seguinte POI:\n\n"
        f"POI: {poi_name}\n"
        f"Descrição actual: {poi_desc}\n\n"
        f"Contexto sazonal: O evento '{event_name}' acontece a {event_date_str} nesta região.\n\n"
        f"O parágrafo deve mencionar o evento de forma natural, ligando-o ao carácter histórico ou cultural "
        f"do local. Não uses frases como 'não percas' ou 'é imperdível'."
    )

    enriched_text = await _call_llm(system, user, max_tokens=300)

    # Criar draft no pipeline toolkit
    draft_id = uuid.uuid4().hex
    draft = {
        "draft_id": draft_id,
        "author_id": "seasonal_bot",
        "author_name": "Seasonal Trigger Bot",
        "source": "seasonal_trigger",
        "target_type": "poi",
        "target_id": flag["poi_id"],
        "target_depth": "snackable",
        "field_to_update": "descricao_curta",
        "title": f"{poi_name} — {event_name}",
        "body_original": enriched_text or f"[Enriquecimento sazonal para {event_name}]",
        "body_current": enriched_text or f"[Enriquecimento sazonal para {event_name}]",
        "body_enriched": None,
        "category": poi.get("category", "") if poi else "",
        "region": flag.get("poi_region", ""),
        "tags": ["sazonal", event_name.lower()[:30]],
        "notes_for_editor": f"Gerado automaticamente para o evento '{event_name}' ({event_date_str}).",
        "status": "draft",
        "review_result": None,
        "enrichment_meta": {"seasonal_flag_id": flag_id, "event_name": event_name},
        "created_at": _now(),
        "updated_at": _now(),
        "published_at": None,
    }
    await _db["content_drafts"].insert_one(draft)

    # Actualizar flag
    await _db["seasonal_flags"].update_one(
        {"flag_id": flag_id},
        {"$set": {"status": "enriched", "draft_id": draft_id, "updated_at": _now()}},
    )

    return {
        "flag_id": flag_id,
        "draft_id": draft_id,
        "status": "enriched",
        "message": "Draft sazonal criado. Pode rever em GET /api/toolkit/draft/{draft_id}",
        "preview": (enriched_text or "")[:200],
    }


@seasonal_router.post("/flags/{flag_id}/resolve")
async def resolve_flag(flag_id: str):
    """Marcar flag como resolvido (draft publicado manualmente)."""
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    result = await _db["seasonal_flags"].update_one(
        {"flag_id": flag_id},
        {"$set": {"status": "resolved", "updated_at": _now()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, f"Flag {flag_id} não encontrado")
    return {"flag_id": flag_id, "status": "resolved"}


@seasonal_router.post("/flags/{flag_id}/skip")
async def skip_flag(flag_id: str):
    """Saltar este flag — POI não é relevante para este evento."""
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    result = await _db["seasonal_flags"].update_one(
        {"flag_id": flag_id},
        {"$set": {"status": "skipped", "updated_at": _now()}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, f"Flag {flag_id} não encontrado")
    return {"flag_id": flag_id, "status": "skipped"}
