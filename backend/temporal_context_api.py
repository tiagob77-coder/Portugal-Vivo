"""
Portugal Vivo — Temporal Context Orchestrator
=============================================
Enriquece qualquer entidade com contexto temporal automático:
  • Estação actual + janela óptima
  • Fase da lua (astro-turismo, marés, pesca)
  • Festivais nos próximos N dias
  • Janela de floração (flora)
  • Janela de migração/avistamento (fauna)
  • Maré favorável (costa/surf)
  • Clima provável por região/mês

Endpoints:
  GET /api/temporal/context                   — contexto actual completo
  GET /api/temporal/enrich?module=X&id=Y      — enriquecer entidade específica
  GET /api/temporal/calendar?months=3         — calendário cultural próximos meses
  GET /api/temporal/best-time?region=X        — melhores meses para visitar região
"""
from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Query

temporal_router = APIRouter(prefix="/temporal", tags=["Temporal Context"])
_db = None


def set_temporal_db(database) -> None:
    global _db
    _db = database


# ─── Static knowledge tables ──────────────────────────────────────────────────

SEASONS: dict[int, dict] = {
    # month → season info
    12: {"id": "inverno",    "label": "Inverno",         "emoji": "❄️",  "months": [12, 1, 2]},
    1:  {"id": "inverno",    "label": "Inverno",         "emoji": "❄️",  "months": [12, 1, 2]},
    2:  {"id": "inverno",    "label": "Inverno",         "emoji": "❄️",  "months": [12, 1, 2]},
    3:  {"id": "primavera",  "label": "Primavera",       "emoji": "🌸",  "months": [3, 4, 5]},
    4:  {"id": "primavera",  "label": "Primavera",       "emoji": "🌸",  "months": [3, 4, 5]},
    5:  {"id": "primavera",  "label": "Primavera",       "emoji": "🌸",  "months": [3, 4, 5]},
    6:  {"id": "verao",      "label": "Verão",           "emoji": "☀️",  "months": [6, 7, 8]},
    7:  {"id": "verao",      "label": "Verão",           "emoji": "☀️",  "months": [6, 7, 8]},
    8:  {"id": "verao",      "label": "Verão",           "emoji": "☀️",  "months": [6, 7, 8]},
    9:  {"id": "outono",     "label": "Outono",          "emoji": "🍂",  "months": [9, 10, 11]},
    10: {"id": "outono",     "label": "Outono",          "emoji": "🍂",  "months": [9, 10, 11]},
    11: {"id": "outono",     "label": "Outono",          "emoji": "🍂",  "months": [9, 10, 11]},
}

FLORA_BLOOM: dict[str, dict] = {
    "amendoeira":       {"months": [1, 2, 3],      "region": "Algarve",    "label": "Amendoeiras em flor"},
    "lavanda":          {"months": [5, 6, 7],      "region": "Alentejo",   "label": "Lavanda em flor"},
    "sobreiro":         {"months": [4, 5, 6],      "region": "Alentejo",   "label": "Descortiçamento do sobreiro"},
    "vinha_madura":     {"months": [8, 9, 10],     "region": "Douro",      "label": "Vindima no Douro"},
    "mimosa":           {"months": [1, 2, 3],      "region": "Minho",      "label": "Mimosas em flor"},
    "heather":          {"months": [7, 8, 9],      "region": "Serra da Estrela", "label": "Urze em flor"},
    "lirio_de_agua":    {"months": [5, 6, 7],      "region": "Alentejo",   "label": "Lírios-de-água"},
}

FAUNA_WINDOWS: dict[str, dict] = {
    "cegonha_branca":   {"months": [3, 4, 5, 6, 7, 8], "label": "Cegonha-branca — reprodução",       "region": "Alentejo"},
    "golfinhos":        {"months": [4, 5, 6, 7, 8, 9], "label": "Golfinhos — avistamentos costeiros",  "region": "Algarve"},
    "lince_iberico":    {"months": [1, 2, 3, 10, 11, 12], "label": "Lince-ibérico — período activo", "region": "Alentejo"},
    "borboletas":       {"months": [5, 6, 7, 8],      "label": "Borboletas migratórias",             "region": "Algarve"},
    "aves_invernantes": {"months": [10, 11, 12, 1, 2], "label": "Aves invernantes (patos, garças)",   "region": "Tejo"},
    "baleia_fin":       {"months": [3, 4, 5],          "label": "Baleia-comum — passagem",            "region": "Açores"},
    "tartaruga_verde":  {"months": [6, 7, 8, 9],       "label": "Tartaruga-verde — postura",          "region": "Algarve"},
}

SURF_SEASONS: dict[str, str] = {
    "inverno":   "Ondas grandes (2–4 m) — Nazaré, Peniche. Ideal para experientes.",
    "primavera": "Ondas moderadas (1–2 m) — excelente para iniciantes. Algarve e Cascais.",
    "verao":     "Mar calmo — snorkeling, mergulho, SUP. Menos vento em Agosto.",
    "outono":    "Temporada de surf — ondas regulares 1.5–3 m em todo o litoral.",
}

ASTRO_NOTES: dict[str, str] = {
    "inverno":   "Céu mais limpo — Via Láctea visível nas Aldeias do Xisto e Alqueva.",
    "primavera": "Constelação de Orion a desaparecer — surgem Escorpião e Sagitário.",
    "verao":     "Perseidas em Agosto — melhor noite de estrelas cadentes do ano.",
    "outono":    "Céu estável — observação de Marte e Júpiter com boa visibilidade.",
}

REGION_MONTHS: dict[str, list[int]] = {
    "Minho":          [5, 6, 7, 8, 9],
    "Porto":          [5, 6, 7, 8, 9],
    "Douro":          [8, 9, 10],
    "Trás-os-Montes": [5, 6, 7, 8],
    "Beira Interior": [4, 5, 6, 9, 10],
    "Lisboa":         [3, 4, 5, 6, 9, 10],
    "Alentejo":       [3, 4, 5, 9, 10, 11],
    "Algarve":        [3, 4, 5, 6, 9, 10],
    "Açores":         [5, 6, 7, 8, 9],
    "Madeira":        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
}

MONTH_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
            "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]


# ─── Moon phase ───────────────────────────────────────────────────────────────

def _moon_phase(dt: datetime) -> dict:
    """Approximate moon phase (0=new, 0.5=full)."""
    # Reference new moon: 2000-01-06 18:14 UTC
    ref = datetime(2000, 1, 6, 18, 14, tzinfo=timezone.utc)
    cycle = 29.53058867
    elapsed = (dt - ref).total_seconds() / 86400
    phase_frac = (elapsed % cycle) / cycle

    if phase_frac < 0.03 or phase_frac > 0.97:
        name, emoji = "Lua Nova", "🌑"
    elif phase_frac < 0.22:
        name, emoji = "Quarto Crescente", "🌒"
    elif phase_frac < 0.28:
        name, emoji = "Quarto Crescente", "🌓"
    elif phase_frac < 0.47:
        name, emoji = "Lua Cheia", "🌔"
    elif phase_frac < 0.53:
        name, emoji = "Lua Cheia", "🌕"
    elif phase_frac < 0.72:
        name, emoji = "Quarto Minguante", "🌖"
    elif phase_frac < 0.78:
        name, emoji = "Quarto Minguante", "🌗"
    else:
        name, emoji = "Lua Nova (quase)", "🌘"

    good_for_astro = 0.45 < phase_frac < 0.55
    good_for_fishing = phase_frac < 0.1 or phase_frac > 0.9 or (0.45 < phase_frac < 0.55)

    return {
        "phase":          round(phase_frac, 3),
        "name":           name,
        "emoji":          emoji,
        "good_for_astro": good_for_astro,
        "good_for_fishing": good_for_fishing,
    }


# ─── Active flora/fauna windows ───────────────────────────────────────────────

def _active_flora(month: int, region: Optional[str] = None) -> list[dict]:
    out = []
    for key, info in FLORA_BLOOM.items():
        if month in info["months"]:
            if region and info["region"].lower() not in region.lower() and region.lower() not in info["region"].lower():
                continue
            out.append({"slug": key, "label": info["label"], "region": info["region"]})
    return out


def _active_fauna(month: int, region: Optional[str] = None) -> list[dict]:
    out = []
    for key, info in FAUNA_WINDOWS.items():
        if month in info["months"]:
            if region and info["region"].lower() not in region.lower() and region.lower() not in info["region"].lower():
                continue
            out.append({"slug": key, "label": info["label"], "region": info["region"]})
    return out


# ─── Upcoming events from DB ──────────────────────────────────────────────────

async def _upcoming_events(months_ahead: int = 3, region: Optional[str] = None) -> list[dict]:
    if _db is None:
        return []
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=months_ahead * 30)
    try:
        query: dict[str, Any] = {}
        if region:
            query["region"] = {"$regex": region, "$options": "i"}
        docs = await _db["events"].find(query).limit(100).to_list(100)
        results = []
        for d in docs:
            name = d.get("name") or d.get("title") or ""
            date_str = d.get("date") or d.get("start_date") or ""
            results.append({
                "name":   name,
                "date":   date_str,
                "region": d.get("region") or d.get("municipality") or "",
                "type":   d.get("type") or d.get("category") or "festival",
            })
        return results[:20]
    except Exception:
        return []


async def _upcoming_cultural_routes(month: int) -> list[dict]:
    if _db is None:
        return []
    try:
        docs = await _db["cultural_routes"].find(
            {"best_months": month}
        ).limit(8).to_list(8)
        return [{"name": d.get("name", ""), "region": d.get("region", ""), "family": d.get("family", "")} for d in docs]
    except Exception:
        return []


# ─── Endpoints ────────────────────────────────────────────────────────────────

@temporal_router.get("/context", summary="Current temporal context for Portugal")
async def temporal_context(
    region: Optional[str] = Query(None, description="Filter by region (e.g. Alentejo)"),
    lat:    Optional[float] = Query(None),
    lng:    Optional[float] = Query(None),
):
    """
    Returns the full temporal context for the current date:
    season, moon phase, active flora/fauna windows, surf conditions,
    astro notes, upcoming festivals.
    """
    now = datetime.now(timezone.utc)
    month = now.month
    season = SEASONS[month]

    moon = _moon_phase(now)
    flora = _active_flora(month, region)
    fauna = _active_fauna(month, region)
    events = await _upcoming_events(3, region)
    routes = await _upcoming_cultural_routes(month)

    days_into_season = (month - season["months"][0]) % 3 * 30 + now.day
    days_left_season = (season["months"][-1] + 1 - month) * 30 - now.day
    if days_left_season < 0:
        days_left_season = 0

    return {
        "timestamp":    now.isoformat(),
        "month":        month,
        "month_pt":     MONTH_PT[month - 1],
        "season":       season,
        "days_left_in_season": days_left_season,
        "moon":         moon,
        "flora_active": flora,
        "fauna_active": fauna,
        "surf":         {"season": season["id"], "note": SURF_SEASONS.get(season["id"], "")},
        "astro":        {"season": season["id"], "note": ASTRO_NOTES.get(season["id"], "")},
        "upcoming_events":  events,
        "cultural_routes_in_season": routes,
        "tags": _build_context_tags(season["id"], moon, flora, fauna),
    }


@temporal_router.get("/enrich", summary="Enrich an entity with temporal relevance score")
async def enrich_entity(
    module:  str = Query(..., description="Module: cultural_route|heritage|flora|fauna|trail|gastronomy"),
    entity_id: str = Query(..., description="Entity ID or name"),
    region:  Optional[str] = Query(None),
):
    """
    Returns temporal relevance for a given entity:
    whether this is the best time to visit, upcoming related events,
    active flora/fauna nearby, moon conditions.
    """
    now = datetime.now(timezone.utc)
    month = now.month
    season = SEASONS[month]
    moon = _moon_phase(now)

    # Fetch entity best_months from DB
    best_months: list[int] = []
    entity_name = entity_id
    if _db is not None:
        col_map = {
            "cultural_route": "cultural_routes",
            "heritage":       "heritage_items",
            "flora":          "flora_fauna",
            "fauna":          "flora_fauna",
            "trail":          "trails",
            "gastronomy":     "coastal_gastronomy",
        }
        col = col_map.get(module)
        if col:
            try:
                doc = await _db[col].find_one({"$or": [{"id": entity_id}, {"name": {"$regex": entity_id, "$options": "i"}}]})
                if doc:
                    best_months = doc.get("best_months") or doc.get("bloom_months") or []
                    entity_name = doc.get("name") or doc.get("common_name") or entity_id
                    if not region:
                        region = doc.get("region") or doc.get("habitat")
            except Exception:
                pass

    in_season = month in best_months if best_months else None
    relevance = 1.0 if in_season else (0.5 if in_season is None else 0.2)

    flora = _active_flora(month, region)
    fauna = _active_fauna(month, region)
    events = await _upcoming_events(2, region)

    next_best: Optional[str] = None
    if not in_season and best_months:
        future = [m for m in best_months if m > month]
        nb_m = future[0] if future else best_months[0]
        next_best = MONTH_PT[nb_m - 1]

    return {
        "entity_id":       entity_id,
        "entity_name":     entity_name,
        "module":          module,
        "month":           month,
        "season":          season,
        "in_season":       in_season,
        "temporal_relevance": round(relevance, 2),
        "best_months":     [MONTH_SHORT[m - 1] for m in best_months],
        "next_best_month": next_best,
        "moon":            moon,
        "flora_nearby":    flora[:3],
        "fauna_nearby":    fauna[:3],
        "upcoming_events": events[:5],
        "visit_tip":       _visit_tip(in_season, season["id"], module),
    }


@temporal_router.get("/calendar", summary="Cultural calendar for next N months")
async def cultural_calendar(
    months: int = Query(3, ge=1, le=12, description="Months ahead"),
    region: Optional[str] = Query(None),
):
    """
    Returns a month-by-month cultural calendar with:
    festivals, routes in season, flora/fauna windows, moon highlights.
    """
    now = datetime.now(timezone.utc)
    calendar: list[dict] = []

    for i in range(months):
        m = ((now.month - 1 + i) % 12) + 1
        year = now.year + ((now.month - 1 + i) // 12)
        season = SEASONS[m]
        # Moon at start of month
        mid_month = datetime(year, m, 14, tzinfo=timezone.utc)
        moon = _moon_phase(mid_month)

        routes = await _upcoming_cultural_routes(m)
        flora = _active_flora(m, region)
        fauna = _active_fauna(m, region)
        events = await _upcoming_events(1, region)

        calendar.append({
            "month":         m,
            "month_pt":      MONTH_PT[m - 1],
            "year":          year,
            "season":        season,
            "moon_mid":      moon,
            "cultural_routes_in_season": routes,
            "flora_active":  flora,
            "fauna_active":  fauna,
            "events":        events[:6],
            "surf_note":     SURF_SEASONS.get(season["id"], ""),
            "astro_note":    ASTRO_NOTES.get(season["id"], ""),
        })

    return {
        "generated_at": now.isoformat(),
        "region":       region,
        "months_ahead": months,
        "calendar":     calendar,
    }


@temporal_router.get("/best-time", summary="Best months to visit a region")
async def best_time(
    region: str = Query(..., description="Portuguese region name"),
    interest: Optional[str] = Query(None, description="flora|fauna|surf|astro|culture|gastronomy"),
):
    """Returns the best months to visit a region based on interest."""
    best = REGION_MONTHS.get(region, [5, 6, 7, 8, 9])

    flora_hits: dict[int, list[str]] = {}
    fauna_hits: dict[int, list[str]] = {}
    for m in range(1, 13):
        fl = _active_flora(m, region)
        fa = _active_fauna(m, region)
        if fl:
            flora_hits[m] = [f["label"] for f in fl]
        if fa:
            fauna_hits[m] = [f["label"] for f in fa]

    return {
        "region":        region,
        "interest":      interest,
        "best_months":   [{"month": m, "label": MONTH_PT[m - 1]} for m in best],
        "flora_by_month": {MONTH_SHORT[m - 1]: v for m, v in flora_hits.items()},
        "fauna_by_month": {MONTH_SHORT[m - 1]: v for m, v in fauna_hits.items()},
        "surf_seasons":   SURF_SEASONS,
        "astro_seasons":  ASTRO_NOTES,
    }


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _build_context_tags(season: str, moon: dict, flora: list, fauna: list) -> list[str]:
    tags = [f"estação:{season}"]
    if moon["good_for_astro"]:
        tags.append("astro:lua_cheia")
    if moon["good_for_fishing"]:
        tags.append("pesca:óptima")
    for f in flora[:2]:
        tags.append(f"flora:{f['slug']}")
    for f in fauna[:2]:
        tags.append(f"fauna:{f['slug']}")
    return tags


def _visit_tip(in_season: Optional[bool], season_id: str, module: str) -> str:
    if in_season:
        return "Época ideal para visitar — condições óptimas agora."
    if in_season is False:
        tips = {
            "cultural_route": "Fora da época principal, mas rotas interiores funcionam todo o ano.",
            "flora":          "Fora da janela de floração — considere visitar na primavera.",
            "fauna":          "Espécie fora do período de avistamento activo.",
            "trail":          "Verifica condições — trilhos de altitude podem estar fechados.",
            "gastronomy":     "Produto fora da época — pode ter qualidade reduzida.",
        }
        return tips.get(module, "Fora da época recomendada para este módulo.")
    return "Sem restrição sazonal conhecida — pode visitar todo o ano."
