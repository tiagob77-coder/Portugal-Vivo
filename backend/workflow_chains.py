"""
workflow_chains.py — Workflow chain definitions for the Smart Orchestrator.

A "chain" is an ordered sequence of SmartActions that should fire together
when a high-level user intent is detected. The orchestrator emits the full
chain so the frontend can run them sequentially (e.g. highlight POI →
preload images → suggest nearby route → invite to plan trip).

Each chain step has:
  - id: unique within the chain
  - module: producing module (must exist in MODULE_REGISTRY)
  - action_type: navigate | notify | preload | highlight | suggest
  - depends_on: list of step ids that must run first
  - title / subtitle / icon / route / data: same as SmartAction

Chains are pure data — runtime selection lives in the orchestrator.
"""
from typing import Dict, List, TypedDict, Optional


class ChainStep(TypedDict, total=False):
    id: str
    module: str
    action_type: str
    priority: int
    depends_on: List[str]
    title: str
    subtitle: Optional[str]
    icon: Optional[str]
    route: Optional[str]
    data: Optional[Dict]


class WorkflowChain(TypedDict):
    id: str
    name: str
    description: str
    trigger: str  # context label or event id that activates the chain
    steps: List[ChainStep]


# ─── Chains ───────────────────────────────────────────────────────────────────

WORKFLOW_CHAINS: Dict[str, WorkflowChain] = {
    "discover_nearby": {
        "id": "discover_nearby",
        "name": "Descobrir Perto",
        "description": "Highlight nearest POI, preload its images, suggest a trail nearby.",
        "trigger": "location.changed",
        "steps": [
            {
                "id": "highlight_poi",
                "module": "heritage",
                "action_type": "highlight",
                "priority": 9,
                "depends_on": [],
                "title": "Local próximo",
                "icon": "place",
            },
            {
                "id": "preload_images",
                "module": "heritage",
                "action_type": "preload",
                "priority": 8,
                "depends_on": ["highlight_poi"],
                "title": "Pré-carregar imagens",
                "icon": "image",
                "data": {"target": "heritage_images"},
            },
            {
                "id": "suggest_trail",
                "module": "trails",
                "action_type": "suggest",
                "priority": 7,
                "depends_on": ["highlight_poi"],
                "title": "Trilho recomendado",
                "icon": "terrain",
            },
        ],
    },
    "morning_explorer": {
        "id": "morning_explorer",
        "name": "Explorador Matinal",
        "description": "Manhã + perfil aventureiro: trilho + meteorologia + segurança.",
        "trigger": "morning_aventureiro",
        "steps": [
            {
                "id": "weather_brief",
                "module": "weather",
                "action_type": "preload",
                "priority": 8,
                "depends_on": [],
                "title": "Briefing meteorológico",
                "icon": "cloud",
            },
            {
                "id": "safety_check",
                "module": "safety",
                "action_type": "preload",
                "priority": 9,
                "depends_on": [],
                "title": "Verificar alertas",
                "icon": "warning",
            },
            {
                "id": "trail_pick",
                "module": "trails",
                "action_type": "suggest",
                "priority": 7,
                "depends_on": ["weather_brief", "safety_check"],
                "title": "Trilho do dia",
                "icon": "terrain",
                "route": "/trails",
            },
        ],
    },
    "lunch_local": {
        "id": "lunch_local",
        "name": "Almoço Local",
        "description": "Hora de almoço: gastronomia local + mercados + tasca tradicional.",
        "trigger": "afternoon_gastronomo",
        "steps": [
            {
                "id": "nearby_dishes",
                "module": "gastronomy",
                "action_type": "preload",
                "priority": 8,
                "depends_on": [],
                "title": "Pratos perto",
                "icon": "restaurant",
                "route": "/gastronomia",
            },
            {
                "id": "market_suggest",
                "module": "economy",
                "action_type": "suggest",
                "priority": 6,
                "depends_on": ["nearby_dishes"],
                "title": "Mercado local",
                "icon": "storefront",
                "route": "/economia",
            },
        ],
    },
    "evening_culture": {
        "id": "evening_culture",
        "name": "Tarde Cultural",
        "description": "Final do dia + perfil cultural: enciclopédia + eventos + património.",
        "trigger": "evening_cultural",
        "steps": [
            {
                "id": "events_today",
                "module": "events",
                "action_type": "preload",
                "priority": 7,
                "depends_on": [],
                "title": "Eventos hoje",
                "icon": "event",
            },
            {
                "id": "encyclopedia_read",
                "module": "encyclopedia",
                "action_type": "suggest",
                "priority": 5,
                "depends_on": [],
                "title": "Ler na Enciclopédia",
                "icon": "auto-stories",
                "route": "/encyclopedia",
            },
        ],
    },
    "beach_summer": {
        "id": "beach_summer",
        "name": "Praia de Verão",
        "description": "Verão + costa: condições da praia + biodiversidade marinha + surf.",
        "trigger": "summer_beach",
        "steps": [
            {
                "id": "coastal_data",
                "module": "beaches",
                "action_type": "preload",
                "priority": 8,
                "depends_on": [],
                "title": "Condições do mar",
                "icon": "waves",
                "route": "/costa",
            },
            {
                "id": "surf_check",
                "module": "surf",
                "action_type": "suggest",
                "priority": 6,
                "depends_on": ["coastal_data"],
                "title": "Webcams de surf",
                "icon": "surfing",
                "route": "/beachcams",
            },
            {
                "id": "marine_species",
                "module": "marine_bio",
                "action_type": "suggest",
                "priority": 5,
                "depends_on": ["coastal_data"],
                "title": "Espécies marinhas",
                "icon": "water",
                "route": "/biodiversidade",
            },
        ],
    },
}


def select_chain(context_label: str, active_modules: List[str]) -> Optional[WorkflowChain]:
    """
    Pick the best matching chain for the given context label, requiring all
    chain modules to be active. Returns None if nothing fits.
    """
    candidates = []
    for chain in WORKFLOW_CHAINS.values():
        if chain["trigger"] in context_label:
            mods_needed = {step["module"] for step in chain["steps"]}
            if mods_needed.issubset(set(active_modules)):
                candidates.append(chain)
    if not candidates:
        return None
    # Prefer chain with most steps (richest workflow)
    return max(candidates, key=lambda c: len(c["steps"]))


def expand_chain_to_actions(chain: WorkflowChain, base_data: Optional[Dict] = None) -> List[Dict]:
    """
    Convert a chain into ordered SmartAction-like dicts respecting dependencies.
    Topological sort by depends_on, ties broken by priority desc.
    """
    steps_by_id = {s["id"]: s for s in chain["steps"]}
    visited: Dict[str, bool] = {}
    out: List[Dict] = []

    def visit(sid: str):
        if visited.get(sid):
            return
        visited[sid] = True
        step = steps_by_id[sid]
        for dep in step.get("depends_on", []):
            if dep in steps_by_id:
                visit(dep)
        out.append({
            "type": step.get("action_type", "suggest"),
            "priority": step.get("priority", 5),
            "title": step.get("title", ""),
            "subtitle": step.get("subtitle"),
            "icon": step.get("icon"),
            "route": step.get("route"),
            "module": step["module"],
            "data": {
                **(base_data or {}),
                **(step.get("data") or {}),
                "chain_id": chain["id"],
                "step_id": sid,
            },
        })

    # Visit in priority order so highest-priority roots come first
    roots = sorted(chain["steps"], key=lambda s: -s.get("priority", 5))
    for s in roots:
        visit(s["id"])
    return out


def public_catalog() -> List[Dict]:
    """Serialisable chain catalog for /orchestrator/chains."""
    return [
        {
            "id": c["id"],
            "name": c["name"],
            "description": c["description"],
            "trigger": c["trigger"],
            "step_count": len(c["steps"]),
            "modules": list({s["module"] for s in c["steps"]}),
        }
        for c in WORKFLOW_CHAINS.values()
    ]
