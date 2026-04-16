"""
module_registry.py — Formal Module Registry for the Smart Orchestrator.

Single source of truth for every module the app exposes. Each entry carries
metadata that the orchestrator uses to:
  - decide whether to activate the module (rule)
  - resolve dependencies (e.g. trails depend on map + heritage)
  - prioritise actions (priority)
  - know which client events should invalidate the module (triggers)
  - signal premium / authentication requirements (permissions)
  - support workflow chains (see workflow_chains.py)

Why a registry instead of inline lambdas?
  - Discoverable & introspectable from the API (/orchestrator/modules)
  - Frontend can render module catalogues (settings, debug screen)
  - Workflows can declare module dependencies safely
  - New modules drop-in without touching the orchestrator

Pure data — no DB calls, no I/O.
"""
from typing import Callable, Dict, List, Optional, TypedDict


# ─── Types ────────────────────────────────────────────────────────────────────

class ModuleMeta(TypedDict, total=False):
    id: str
    name: str
    icon: str  # MaterialIcons name
    route: Optional[str]  # primary entry route
    state: str  # always | contextual | premium | auth_required
    priority: int  # 1..10 — higher wins when actions compete
    dependencies: List[str]  # other module ids this one needs
    triggers: List[str]  # client events that should re-evaluate this module
    permissions: List[str]  # location | auth | premium | notifications
    rule: Callable[..., bool]  # (ctx, hour, month) -> bool


# ─── Registry ─────────────────────────────────────────────────────────────────
# Order is significant — earlier entries evaluated first when priorities tie.

MODULE_REGISTRY: Dict[str, ModuleMeta] = {
    "safety": {
        "id": "safety",
        "name": "Segurança",
        "icon": "warning",
        "route": "/(tabs)/mapa",
        "state": "always",
        "priority": 10,
        "dependencies": [],
        "triggers": ["context.invalidate"],
        "permissions": [],
        "rule": lambda ctx, h, m: True,
    },
    "weather": {
        "id": "weather",
        "name": "Meteorologia",
        "icon": "cloud",
        "route": None,
        "state": "always",
        "priority": 8,
        "dependencies": [],
        "triggers": ["location.changed"],
        "permissions": ["location"],
        "rule": lambda ctx, h, m: True,
    },
    "heritage": {
        "id": "heritage",
        "name": "Património",
        "icon": "account-balance",
        "route": "/(tabs)/descobrir",
        "state": "always",
        "priority": 9,
        "dependencies": [],
        "triggers": ["location.changed", "preferences.updated"],
        "permissions": [],
        "rule": lambda ctx, h, m: True,
    },
    "map": {
        "id": "map",
        "name": "Mapa",
        "icon": "map",
        "route": "/(tabs)/mapa",
        "state": "always",
        "priority": 7,
        "dependencies": ["heritage"],
        "triggers": ["location.changed", "tab.changed"],
        "permissions": ["location"],
        "rule": lambda ctx, h, m: True,
    },
    "gastronomy": {
        "id": "gastronomy",
        "name": "Gastronomia",
        "icon": "restaurant",
        "route": "/gastronomia",
        "state": "contextual",
        "priority": 6,
        "dependencies": ["heritage"],
        "triggers": ["location.changed", "preferences.updated"],
        "permissions": [],
        "rule": lambda ctx, h, m: h >= 11 or ctx.traveler_profile == "gastronomo",
    },
    "beaches": {
        "id": "beaches",
        "name": "Praias",
        "icon": "beach-access",
        "route": "/costa",
        "state": "contextual",
        "priority": 6,
        "dependencies": ["map"],
        "triggers": ["location.changed"],
        "permissions": ["location"],
        "rule": lambda ctx, h, m: m in (5, 6, 7, 8, 9) or (ctx.lat is not None and ctx.lat < 39),
    },
    "surf": {
        "id": "surf",
        "name": "Surf",
        "icon": "surfing",
        "route": "/beachcams",
        "state": "contextual",
        "priority": 5,
        "dependencies": ["beaches"],
        "triggers": ["location.changed"],
        "permissions": ["location"],
        "rule": lambda ctx, h, m: m in (4, 5, 6, 7, 8, 9, 10),
    },
    "trails": {
        "id": "trails",
        "name": "Trilhos",
        "icon": "terrain",
        "route": "/trails",
        "state": "contextual",
        "priority": 7,
        "dependencies": ["map", "heritage"],
        "triggers": ["location.changed", "preferences.updated"],
        "permissions": ["location"],
        "rule": lambda ctx, h, m: h < 16 or ctx.traveler_profile == "aventureiro",
    },
    "flora_fauna": {
        "id": "flora_fauna",
        "name": "Flora & Fauna",
        "icon": "local-florist",
        "route": "/flora",
        "state": "contextual",
        "priority": 5,
        "dependencies": [],
        "triggers": ["location.changed"],
        "permissions": [],
        "rule": lambda ctx, h, m: 6 <= h <= 19,
    },
    "marine_bio": {
        "id": "marine_bio",
        "name": "Biodiversidade Marinha",
        "icon": "water",
        "route": "/biodiversidade",
        "state": "contextual",
        "priority": 4,
        "dependencies": ["beaches"],
        "triggers": ["location.changed"],
        "permissions": ["location"],
        "rule": lambda ctx, h, m: ctx.lat is not None and ctx.lat < 39.5,
    },
    "events": {
        "id": "events",
        "name": "Eventos",
        "icon": "event",
        "route": "/eventos",
        "state": "always",
        "priority": 7,
        "dependencies": [],
        "triggers": ["context.invalidate"],
        "permissions": [],
        "rule": lambda ctx, h, m: True,
    },
    "nightlife": {
        "id": "nightlife",
        "name": "Vida Nocturna",
        "icon": "nightlife",
        "route": "/(tabs)/mapa",
        "state": "contextual",
        "priority": 5,
        "dependencies": ["map"],
        "triggers": ["tab.changed"],
        "permissions": [],
        "rule": lambda ctx, h, m: h >= 18 or h <= 2,
    },
    "transport": {
        "id": "transport",
        "name": "Transportes",
        "icon": "directions-bus",
        "route": "/comboios",
        "state": "always",
        "priority": 6,
        "dependencies": [],
        "triggers": ["location.changed"],
        "permissions": [],
        "rule": lambda ctx, h, m: True,
    },
    "gamification": {
        "id": "gamification",
        "name": "Conquistas",
        "icon": "emoji-events",
        "route": "/gamification",
        "state": "auth_required",
        "priority": 4,
        "dependencies": [],
        "triggers": ["visit.recorded", "route.completed", "user.login"],
        "permissions": ["auth"],
        "rule": lambda ctx, h, m: ctx.user_id is not None,
    },
    "premium": {
        "id": "premium",
        "name": "Premium",
        "icon": "stars",
        "route": "/premium",
        "state": "premium",
        "priority": 3,
        "dependencies": [],
        "triggers": ["user.login"],
        "permissions": ["premium"],
        "rule": lambda ctx, h, m: ctx.is_premium,
    },
    "encyclopedia": {
        "id": "encyclopedia",
        "name": "Enciclopédia",
        "icon": "auto-stories",
        "route": "/encyclopedia",
        "state": "contextual",
        "priority": 4,
        "dependencies": [],
        "triggers": ["preferences.updated"],
        "permissions": [],
        "rule": lambda ctx, h, m: ctx.traveler_profile in ("cultural", None),
    },
    "economy": {
        "id": "economy",
        "name": "Economia Local",
        "icon": "storefront",
        "route": "/economia",
        "state": "contextual",
        "priority": 4,
        "dependencies": [],
        "triggers": ["location.changed"],
        "permissions": [],
        "rule": lambda ctx, h, m: ctx.traveler_profile == "cultural",
    },
    "cultural_routes": {
        "id": "cultural_routes",
        "name": "Rotas Culturais",
        "icon": "explore",
        "route": "/rotas-culturais",
        "state": "contextual",
        "priority": 8,   # High — flagship module
        "dependencies": ["heritage", "map"],
        "triggers": ["location.changed", "preferences.updated", "month.changed"],
        "permissions": [],
        # Active whenever: cultural/aventureiro profile, near a UNESCO stop (heuristic:
        # always shown as it's a top-level discovery module), or visiting via deep-link.
        "rule": lambda ctx, h, m: (
            ctx.traveler_profile in ("cultural", "aventureiro", None)
            or ctx.active_tab in ("descobrir", "experienciar")
            or m in (3, 4, 5, 6, 9, 10)   # Spring + Autumn peak season
        ),
    },
}


def get_module(module_id: str) -> Optional[ModuleMeta]:
    """Lookup a module by id, returning None if unknown."""
    return MODULE_REGISTRY.get(module_id)


def evaluate_modules(ctx, hour: int, month: int) -> List[str]:
    """Return the list of module ids whose rule matches the current context."""
    return [
        mid for mid, meta in MODULE_REGISTRY.items()
        if meta["rule"](ctx, hour, month)
    ]


def resolve_dependencies(module_ids: List[str]) -> List[str]:
    """
    Expand a module set with all its (transitive) dependencies.
    Order preserved; duplicates removed; unknown modules ignored.
    """
    seen: Dict[str, bool] = {}
    out: List[str] = []

    def visit(mid: str):
        if mid in seen or mid not in MODULE_REGISTRY:
            return
        seen[mid] = True
        for dep in MODULE_REGISTRY[mid]["dependencies"]:
            visit(dep)
        out.append(mid)

    for m in module_ids:
        visit(m)
    return out


def modules_for_event(event: str) -> List[str]:
    """Modules that subscribe to a given client-side event."""
    return [
        mid for mid, meta in MODULE_REGISTRY.items()
        if event in meta.get("triggers", [])
    ]


def public_catalog() -> List[Dict]:
    """Serialisable catalog (for /orchestrator/modules), strips lambdas."""
    return [
        {k: v for k, v in meta.items() if k != "rule"}
        for meta in MODULE_REGISTRY.values()
    ]
