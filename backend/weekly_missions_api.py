"""
Weekly Missions API — Portugal Vivo
======================================
Sistema de missões semanais de gamificação.
Missões têm prazo (segunda a domingo) e recompensam XP e badges.

Tipos de missão:
  visit_pois       — visitar N POIs únicos (check-in por GPS)
  checkin_region   — fazer check-in numa região específica
  submit_curiosity — submeter N curiosidades pela comunidade
  upload_photo     — carregar N fotos de POIs
  explore_category — visitar N POIs de uma categoria

Collections:
  missions              — pool de missões disponíveis
  user_mission_progress — progresso de cada user em cada missão
  gamification_profiles — actualizar XP quando missão é reclamada

Rotas:
  GET  /missions/active             — missões activas desta semana
  GET  /missions/my                 — missões + progresso do user autenticado
  POST /missions/{id}/claim         — reclamar recompensa (missão completa)
  POST /missions/generate-weekly    — gerar missões da semana (admin/cron)
  POST /missions/{id}/progress      — actualizar progresso (chamado internamente)
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ─── Router ──────────────────────────────────────────────────────────────────

missions_router = APIRouter(prefix="/missions", tags=["Weekly Missions"])

# ─── DB / Auth injection ─────────────────────────────────────────────────────

_db = None
_require_auth = None
_require_admin = None


def set_missions_db(database) -> None:
    global _db
    _db = database


def set_missions_auth(require_auth, require_admin) -> None:
    global _require_auth, _require_admin
    _require_auth = require_auth
    _require_admin = require_admin


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _week_bounds() -> tuple[datetime, datetime]:
    """Segunda-feira a domingo da semana actual (UTC)."""
    now = _now()
    monday = now - timedelta(days=now.weekday())
    week_start = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    return week_start, week_end


def _next_week_bounds() -> tuple[datetime, datetime]:
    start, end = _week_bounds()
    return end, end + timedelta(days=7)


# ─── Templates de missões semanais ───────────────────────────────────────────

WEEKLY_TEMPLATES = [
    {
        "title": "Explorador da Semana",
        "description": "Faz check-in em 5 POIs diferentes até domingo.",
        "icon": "explore",
        "type": "visit_pois",
        "target_value": 5,
        "reward_xp": 150,
        "reward_badge": "explorer_weekly",
    },
    {
        "title": "Memória Viva",
        "description": "Partilha 2 curiosidades locais com a comunidade.",
        "icon": "lightbulb",
        "type": "submit_curiosity",
        "target_value": 2,
        "reward_xp": 100,
        "reward_badge": None,
    },
    {
        "title": "Olhar Fotográfico",
        "description": "Carrega 3 fotografias de locais que visitaste.",
        "icon": "photo-camera",
        "type": "upload_photo",
        "target_value": 3,
        "reward_xp": 80,
        "reward_badge": None,
    },
    {
        "title": "Raízes Históricas",
        "description": "Visita 3 monumentos ou locais de arqueologia.",
        "icon": "account-balance",
        "type": "explore_category",
        "target_value": 3,
        "reward_xp": 120,
        "reward_badge": None,
        "category_filter": "arqueologia",
    },
    {
        "title": "Rota da Natureza",
        "description": "Completa check-in em 2 locais de natureza ou trilhos.",
        "icon": "forest",
        "type": "explore_category",
        "target_value": 2,
        "reward_xp": 90,
        "reward_badge": None,
        "category_filter": "natureza",
    },
    {
        "title": "Gourmet Local",
        "description": "Faz check-in em 2 locais de gastronomia ou adegas.",
        "icon": "restaurant",
        "type": "explore_category",
        "target_value": 2,
        "reward_xp": 80,
        "reward_badge": None,
        "category_filter": "gastronomia",
    },
]

# Missão especial rotativa (por semana do ano)
ROTATING_MISSIONS = [
    {
        "title": "Missão Secreta: Aldeias Perdidas",
        "description": "Encontra 2 aldeias históricas nesta semana.",
        "icon": "home-work",
        "type": "explore_category",
        "target_value": 2,
        "reward_xp": 200,
        "reward_badge": "secret_mission",
        "category_filter": "aldeias",
    },
    {
        "title": "Missão Secreta: Guardiões da Costa",
        "description": "Visita 3 praias ou locais de surf.",
        "icon": "beach-access",
        "type": "explore_category",
        "target_value": 3,
        "reward_xp": 200,
        "reward_badge": "secret_mission",
        "category_filter": "praias",
    },
    {
        "title": "Missão Secreta: Fé e Tradição",
        "description": "Faz check-in em 2 locais religiosos ou espirituais.",
        "icon": "church",
        "type": "explore_category",
        "target_value": 2,
        "reward_xp": 200,
        "reward_badge": "secret_mission",
        "category_filter": "religioso",
    },
    {
        "title": "Missão Secreta: Castelos de Portugal",
        "description": "Explora 2 castelos ou fortalezas históricas.",
        "icon": "fort",
        "type": "explore_category",
        "target_value": 2,
        "reward_xp": 200,
        "reward_badge": "secret_mission",
        "category_filter": "castelos",
    },
]


# ─── Modelos ─────────────────────────────────────────────────────────────────

class MissionProgressUpdate(BaseModel):
    delta: int = Field(1, ge=1, description="Valor a adicionar ao progresso")


class ClaimRequest(BaseModel):
    pass  # sem payload — só verificar elegibilidade


# ─── Gerar missões da semana ──────────────────────────────────────────────────

async def _generate_missions_for_week(week_start: datetime, week_end: datetime) -> List[str]:
    """
    Cria 4–5 missões para a semana indicada.
    Rota internamente para variar as missões semana a semana.
    """
    if _db is None:
        return []

    # Verificar se já existem para esta semana
    existing = await _db["missions"].count_documents({"active_from": week_start})
    if existing > 0:
        logger.info("[missions] Semana %s já tem %d missões", week_start.date(), existing)
        return []

    week_num = week_start.isocalendar()[1]  # número da semana ISO

    # Seleccionar 4 missões regulares (rotação)
    selected = WEEKLY_TEMPLATES[week_num % len(WEEKLY_TEMPLATES):] + WEEKLY_TEMPLATES[:week_num % len(WEEKLY_TEMPLATES)]
    selected = selected[:4]

    # Adicionar missão secreta rotativa
    secret = ROTATING_MISSIONS[week_num % len(ROTATING_MISSIONS)]
    selected = [*selected, secret]

    mission_ids = []
    for tmpl in selected:
        mission_id = uuid.uuid4().hex
        doc = {
            "mission_id": mission_id,
            "title": tmpl["title"],
            "description": tmpl["description"],
            "icon": tmpl["icon"],
            "type": tmpl["type"],
            "target_value": tmpl["target_value"],
            "reward_xp": tmpl["reward_xp"],
            "reward_badge": tmpl.get("reward_badge"),
            "category_filter": tmpl.get("category_filter"),
            "region_filter": tmpl.get("region_filter"),
            "active_from": week_start,
            "expires_at": week_end,
            "created_at": _now(),
            "is_secret": "Secreta" in tmpl["title"],
        }
        await _db["missions"].insert_one(doc)
        mission_ids.append(mission_id)

    logger.info("[missions] Geradas %d missões para semana %s", len(selected), week_start.date())
    return mission_ids


# ─── Endpoints ───────────────────────────────────────────────────────────────

@missions_router.get("/active")
async def get_active_missions(
    include_secret: bool = Query(True),
):
    """Missões activas para a semana corrente (sem necessidade de auth)."""
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    week_start, week_end = _week_bounds()

    # Gerar se ainda não existem
    count = await _db["missions"].count_documents({
        "active_from": {"$lte": _now()},
        "expires_at": {"$gte": _now()},
    })
    if count == 0:
        await _generate_missions_for_week(week_start, week_end)

    query: Dict[str, Any] = {
        "active_from": {"$lte": _now()},
        "expires_at": {"$gte": _now()},
    }
    if not include_secret:
        query["is_secret"] = {"$ne": True}

    cursor = _db["missions"].find(query, {"_id": 0}).sort("reward_xp", -1)
    missions = await cursor.to_list(length=10)

    # Adicionar dias restantes
    for m in missions:
        expires = m.get("expires_at")
        if expires:
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            m["days_remaining"] = max(0, (expires - _now()).days)

    return {"missions": missions, "week_start": week_start.isoformat(), "week_end": week_end.isoformat()}


@missions_router.get("/my")
async def get_my_missions(current_user: dict = Depends(lambda: {"user_id": "anon"})):
    """Missões da semana + progresso do utilizador autenticado."""
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    user_id = current_user.get("user_id", "anon")

    # Missões activas
    active = await get_active_missions()
    missions = active["missions"]

    # Progresso do user
    mission_ids = [m["mission_id"] for m in missions]
    progress_cursor = _db["user_mission_progress"].find({
        "user_id": user_id,
        "mission_id": {"$in": mission_ids},
    }, {"_id": 0})
    progress_list = await progress_cursor.to_list(length=20)
    progress_map = {p["mission_id"]: p for p in progress_list}

    # Enriquecer missões com progresso do user
    for m in missions:
        prog = progress_map.get(m["mission_id"], {})
        m["progress"] = prog.get("current_value", 0)
        m["completed"] = prog.get("completed", False)
        m["claimed"] = prog.get("claimed", False)

    return {"missions": missions, "user_id": user_id}


@missions_router.post("/{mission_id}/claim")
async def claim_mission(
    mission_id: str,
    current_user: dict = Depends(lambda: {"user_id": "anon"}),
):
    """Reclamar recompensa de missão concluída."""
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    user_id = current_user.get("user_id", "anon")

    # Verificar missão existe e está activa
    mission = await _db["missions"].find_one({
        "mission_id": mission_id,
        "expires_at": {"$gte": _now()},
    })
    if not mission:
        raise HTTPException(404, "Missão não encontrada ou expirada")

    # Verificar progresso
    prog = await _db["user_mission_progress"].find_one(
        {"user_id": user_id, "mission_id": mission_id}
    )
    if not prog:
        raise HTTPException(400, "Sem progresso registado nesta missão")
    if not prog.get("completed"):
        raise HTTPException(400, f"Missão incompleta ({prog.get('current_value',0)}/{mission['target_value']})")
    if prog.get("claimed"):
        raise HTTPException(409, "Recompensa já reclamada")

    # Marcar como reclamada
    await _db["user_mission_progress"].update_one(
        {"user_id": user_id, "mission_id": mission_id},
        {"$set": {"claimed": True, "claimed_at": _now()}},
    )

    # Atribuir XP ao perfil de gamificação
    xp_reward = mission.get("reward_xp", 0)
    await _db["gamification_profiles"].update_one(
        {"user_id": user_id},
        {"$inc": {"xp": xp_reward, "missions_completed": 1}},
        upsert=True,
    )

    badge = mission.get("reward_badge")
    if badge:
        await _db["gamification_profiles"].update_one(
            {"user_id": user_id},
            {"$addToSet": {"badges": {"id": badge, "earned_at": _now().isoformat()}}},
        )

    logger.info("[missions] User %s reclamou missão %s (+%d XP)", user_id, mission_id, xp_reward)
    return {
        "mission_id": mission_id,
        "claimed": True,
        "xp_earned": xp_reward,
        "badge_earned": badge,
        "message": f"Parabéns! Ganhou {xp_reward} XP{f' e o badge {badge}' if badge else ''}.",
    }


@missions_router.post("/{mission_id}/progress")
async def update_mission_progress(
    mission_id: str,
    payload: MissionProgressUpdate,
    current_user: dict = Depends(lambda: {"user_id": "anon"}),
):
    """
    Actualizar o progresso de um user numa missão.
    Chamado internamente por outros endpoints (check-in, upload, etc.)
    """
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    user_id = current_user.get("user_id", "anon")

    mission = await _db["missions"].find_one(
        {"mission_id": mission_id, "expires_at": {"$gte": _now()}},
        {"target_value": 1, "_id": 0},
    )
    if not mission:
        raise HTTPException(404, "Missão não encontrada")

    target = mission["target_value"]

    # Upsert progresso
    result = await _db["user_mission_progress"].find_one_and_update(
        {"user_id": user_id, "mission_id": mission_id},
        {
            "$inc": {"current_value": payload.delta},
            "$setOnInsert": {"user_id": user_id, "mission_id": mission_id, "claimed": False, "created_at": _now()},
            "$set": {"last_updated": _now()},
        },
        upsert=True,
        return_document=True,
    )

    new_value = result.get("current_value", 0) if result else payload.delta
    completed = new_value >= target

    if completed:
        await _db["user_mission_progress"].update_one(
            {"user_id": user_id, "mission_id": mission_id},
            {"$set": {"completed": True, "completed_at": _now()}},
        )

    return {
        "mission_id": mission_id,
        "current_value": new_value,
        "target_value": target,
        "completed": completed,
        "just_completed": completed and new_value - payload.delta < target,
    }


@missions_router.post("/generate-weekly")
async def generate_weekly_missions(
    for_next_week: bool = Query(False, description="Gerar para a próxima semana (em vez da corrente)"),
    current_user: dict = Depends(lambda: {"user_id": "anon"}),
):
    """Gerar missões para a semana (admin/cron — chamado à segunda-feira às 00:05 UTC)."""
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    if for_next_week:
        week_start, week_end = _next_week_bounds()
    else:
        week_start, week_end = _week_bounds()

    mission_ids = await _generate_missions_for_week(week_start, week_end)
    return {
        "generated": len(mission_ids),
        "mission_ids": mission_ids,
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
    }


@missions_router.get("/leaderboard/weekly")
async def weekly_missions_leaderboard():
    """Top 10 users por missões concluídas nesta semana."""
    if _db is None:
        raise HTTPException(503, "DB não disponível")

    week_start, _ = _week_bounds()

    pipeline = [
        {"$match": {"completed": True, "completed_at": {"$gte": week_start}}},
        {"$group": {"_id": "$user_id", "missions_done": {"$sum": 1}}},
        {"$sort": {"missions_done": -1}},
        {"$limit": 10},
        {"$project": {"_id": 0, "user_id": "$_id", "missions_done": 1}},
    ]

    cursor = _db["user_mission_progress"].aggregate(pipeline)
    leaders = await cursor.to_list(length=10)
    return {"leaderboard": leaders, "week": week_start.isoformat()}
