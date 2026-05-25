"""Pure-function tests for workflow_chains: select_chain, expand_chain_to_actions,
public_catalog. These drive the Smart Orchestrator that fires multi-step
chains (highlight POI → preload images → suggest trail nearby) when high-level
intents trigger. A regression silently breaks every multi-step recommendation."""
import pytest

from workflow_chains import (
    WORKFLOW_CHAINS,
    expand_chain_to_actions,
    public_catalog,
    select_chain,
)


# ── select_chain ─────────────────────────────────────────────────────────────

def test_select_chain_no_match_returns_none():
    assert select_chain("xpto", ["heritage", "trails"]) is None


def test_select_chain_returns_chain_when_trigger_and_modules_match():
    out = select_chain("location.changed", ["heritage", "trails"])
    assert out is not None
    assert out["id"] == "discover_nearby"


def test_select_chain_missing_one_module_returns_none():
    # discover_nearby needs heritage AND trails. Drop trails → no match.
    assert select_chain("location.changed", ["heritage"]) is None


def test_select_chain_extra_active_modules_dont_break_match():
    # Extra modules are fine — chain just needs its subset to be active.
    out = select_chain("location.changed", ["heritage", "trails", "weather", "x"])
    assert out is not None and out["id"] == "discover_nearby"


def test_select_chain_trigger_substring_match():
    # `chain["trigger"] in context_label` — substring suffices.
    out = select_chain(
        "event:morning_aventureiro:user42",
        ["weather", "safety", "trails"],
    )
    assert out is not None and out["id"] == "morning_explorer"


def test_select_chain_empty_active_modules_no_match():
    assert select_chain("location.changed", []) is None


def test_select_chain_morning_explorer_full():
    out = select_chain("morning_aventureiro", ["weather", "safety", "trails"])
    assert out["id"] == "morning_explorer"


def test_select_chain_lunch_local():
    out = select_chain("afternoon_gastronomo", ["gastronomy", "economy"])
    assert out["id"] == "lunch_local"


def test_select_chain_evening_culture():
    out = select_chain("evening_cultural", ["events", "encyclopedia"])
    assert out["id"] == "evening_culture"


def test_select_chain_beach_summer():
    out = select_chain("summer_beach", ["beaches", "surf", "marine_bio"])
    assert out["id"] == "beach_summer"


def test_select_chain_prefers_chain_with_most_steps(monkeypatch):
    # Inject two chains with the same trigger; the one with more steps wins.
    fake = {
        "small": {
            "id": "small", "name": "S", "description": "", "trigger": "tt",
            "steps": [{"id": "a", "module": "m", "action_type": "x",
                       "priority": 1, "depends_on": []}],
        },
        "big": {
            "id": "big", "name": "B", "description": "", "trigger": "tt",
            "steps": [
                {"id": "a", "module": "m", "action_type": "x",
                 "priority": 1, "depends_on": []},
                {"id": "b", "module": "m", "action_type": "x",
                 "priority": 1, "depends_on": []},
            ],
        },
    }
    monkeypatch.setattr("workflow_chains.WORKFLOW_CHAINS", fake)
    out = select_chain("tt", ["m"])
    assert out["id"] == "big"


# ── expand_chain_to_actions ──────────────────────────────────────────────────

def test_expand_chain_returns_one_dict_per_step():
    chain = WORKFLOW_CHAINS["lunch_local"]  # 2 steps
    out = expand_chain_to_actions(chain)
    assert len(out) == 2


def test_expand_chain_each_action_has_all_keys():
    chain = WORKFLOW_CHAINS["discover_nearby"]
    out = expand_chain_to_actions(chain)
    expected = {"type", "priority", "title", "subtitle", "icon",
                "route", "module", "data"}
    for action in out:
        assert set(action.keys()) == expected


def test_expand_chain_respects_depends_on_ordering():
    # discover_nearby: highlight_poi → preload_images + suggest_trail.
    # preload_images and suggest_trail both depend on highlight_poi,
    # so highlight_poi must come first in output.
    chain = WORKFLOW_CHAINS["discover_nearby"]
    out = expand_chain_to_actions(chain)
    step_ids = [a["data"]["step_id"] for a in out]
    hp_idx = step_ids.index("highlight_poi")
    assert step_ids.index("preload_images") > hp_idx
    assert step_ids.index("suggest_trail") > hp_idx


def test_expand_chain_roots_sorted_by_priority_descending():
    # morning_explorer has 2 roots: weather_brief (prio 8) and safety_check (prio 9).
    # safety_check comes first because higher priority root is visited first.
    chain = WORKFLOW_CHAINS["morning_explorer"]
    out = expand_chain_to_actions(chain)
    step_ids = [a["data"]["step_id"] for a in out]
    assert step_ids.index("safety_check") < step_ids.index("weather_brief")


def test_expand_chain_injects_chain_and_step_id_into_data():
    chain = WORKFLOW_CHAINS["lunch_local"]
    out = expand_chain_to_actions(chain)
    for a in out:
        assert a["data"]["chain_id"] == "lunch_local"
        assert "step_id" in a["data"]


def test_expand_chain_merges_base_data():
    chain = WORKFLOW_CHAINS["lunch_local"]
    out = expand_chain_to_actions(chain, base_data={"user_id": "u1"})
    for a in out:
        assert a["data"]["user_id"] == "u1"


def test_expand_chain_step_data_overrides_base_data():
    fake_chain = {
        "id": "test_chain", "name": "T", "description": "", "trigger": "t",
        "steps": [{
            "id": "s1", "module": "m", "action_type": "x",
            "priority": 5, "depends_on": [],
            "data": {"shared": "from_step"},
        }],
    }
    out = expand_chain_to_actions(fake_chain, base_data={"shared": "from_base"})
    assert out[0]["data"]["shared"] == "from_step"


def test_expand_chain_handles_no_base_data():
    chain = WORKFLOW_CHAINS["lunch_local"]
    out = expand_chain_to_actions(chain)  # base_data=None
    for a in out:
        assert "chain_id" in a["data"]


def test_expand_chain_does_not_revisit_steps():
    # Even if multiple steps share a dependency, it's only emitted once.
    chain = WORKFLOW_CHAINS["discover_nearby"]
    out = expand_chain_to_actions(chain)
    step_ids = [a["data"]["step_id"] for a in out]
    assert len(step_ids) == len(set(step_ids))


def test_expand_chain_action_type_falls_back_to_suggest():
    # Step missing action_type → falls back to "suggest".
    fake_chain = {
        "id": "c", "name": "", "description": "", "trigger": "t",
        "steps": [{"id": "s1", "module": "m", "priority": 5, "depends_on": []}],
    }
    out = expand_chain_to_actions(fake_chain)
    assert out[0]["type"] == "suggest"


def test_expand_chain_missing_dep_in_chain_is_skipped_silently():
    # If a step depends_on something not in steps_by_id, the visit just
    # skips it — no KeyError.
    fake_chain = {
        "id": "c", "name": "", "description": "", "trigger": "t",
        "steps": [{
            "id": "s1", "module": "m", "action_type": "x",
            "priority": 5, "depends_on": ["nonexistent"],
        }],
    }
    out = expand_chain_to_actions(fake_chain)
    assert len(out) == 1 and out[0]["data"]["step_id"] == "s1"


# ── public_catalog ───────────────────────────────────────────────────────────

def test_public_catalog_returns_one_entry_per_chain():
    cat = public_catalog()
    assert len(cat) == len(WORKFLOW_CHAINS)


def test_public_catalog_entries_have_expected_shape():
    cat = public_catalog()
    expected = {"id", "name", "description", "trigger", "step_count", "modules"}
    for entry in cat:
        assert set(entry.keys()) == expected


def test_public_catalog_modules_are_deduped():
    # discover_nearby uses heritage twice + trails once → 2 unique modules.
    cat = public_catalog()
    dn = next(c for c in cat if c["id"] == "discover_nearby")
    assert set(dn["modules"]) == {"heritage", "trails"}
    assert len(dn["modules"]) == 2


def test_public_catalog_step_count_matches():
    cat = public_catalog()
    for entry in cat:
        original = WORKFLOW_CHAINS[entry["id"]]
        assert entry["step_count"] == len(original["steps"])


def test_public_catalog_does_not_leak_step_internals():
    # The catalog is for the /orchestrator/chains endpoint — must not
    # expose action_type, depends_on, priority etc.
    cat = public_catalog()
    for entry in cat:
        assert "steps" not in entry
        assert "depends_on" not in entry
