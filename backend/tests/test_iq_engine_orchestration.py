"""Tests for IQEngine orchestration in iq_engine_base — registration,
single-POI processing with module filtering, and batch processing with
concurrency. Uses lightweight fake IQModule subclasses (no DB, no LLM).

The internal "M7 score wins over mean" rule at iq_engine_base.py:255-265
is only logged (not returned), so it's not asserted here — only the
behaviors observable via the public return values."""
import asyncio
import logging

import pytest

from iq_engine_base import (
    IQEngine,
    IQModule,
    ModuleType,
    POIProcessingData,
    ProcessingResult,
    ProcessingStatus,
    get_iq_engine,
)


# ── Fakes ────────────────────────────────────────────────────────────────────


class _FakeModule(IQModule):
    """Test double that returns a canned ProcessingResult. Tracks call
    count so tests can assert which modules ran."""

    def __init__(self, module_type: ModuleType, score: float | None = 50.0):
        super().__init__(module_type)
        self._score = score
        self.calls = 0

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        self.calls += 1
        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=self._score,
            data={"name": data.name},
        )


class _SlowModule(IQModule):
    """Sleeps a configurable duration so we can probe concurrency."""

    def __init__(self, module_type: ModuleType, sleep_s: float):
        super().__init__(module_type)
        self._sleep = sleep_s

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        await asyncio.sleep(self._sleep)
        return ProcessingResult(
            module=self.module_type,
            status=ProcessingStatus.COMPLETED,
            score=50.0,
        )


class _RaisingModule(IQModule):
    """Raises an exception inside _process_impl so we can verify the
    process() wrapper turns it into a FAILED result instead of bubbling."""

    async def _process_impl(self, data: POIProcessingData) -> ProcessingResult:
        raise RuntimeError("boom")


def _poi(name: str = "Test POI", _id: str = "p1") -> POIProcessingData:
    return POIProcessingData(id=_id, name=name, description="x")


# ── register_module ─────────────────────────────────────────────────────────


def test_register_module_stores_by_type():
    engine = IQEngine()
    m = _FakeModule(ModuleType.SEMANTIC_VALIDATION)
    engine.register_module(m)
    assert engine.modules[ModuleType.SEMANTIC_VALIDATION] is m


def test_register_module_overwrites_existing_for_same_type():
    engine = IQEngine()
    first = _FakeModule(ModuleType.POI_SCORING, score=10)
    second = _FakeModule(ModuleType.POI_SCORING, score=99)
    engine.register_module(first)
    engine.register_module(second)
    # The latest registration wins.
    assert engine.modules[ModuleType.POI_SCORING] is second


def test_engine_starts_empty():
    assert IQEngine().modules == {}


# ── process_poi: module selection ────────────────────────────────────────────


async def test_process_poi_runs_all_modules_when_none_specified():
    engine = IQEngine()
    m1 = _FakeModule(ModuleType.SEMANTIC_VALIDATION)
    m2 = _FakeModule(ModuleType.POI_SCORING)
    engine.register_module(m1)
    engine.register_module(m2)
    results = await engine.process_poi(_poi())
    assert len(results) == 2
    assert m1.calls == 1
    assert m2.calls == 1


async def test_process_poi_runs_only_requested_modules():
    engine = IQEngine()
    m1 = _FakeModule(ModuleType.SEMANTIC_VALIDATION)
    m2 = _FakeModule(ModuleType.POI_SCORING)
    engine.register_module(m1)
    engine.register_module(m2)
    results = await engine.process_poi(
        _poi(), modules=[ModuleType.POI_SCORING]
    )
    assert len(results) == 1
    assert m1.calls == 0
    assert m2.calls == 1
    assert results[0].module == ModuleType.POI_SCORING


async def test_process_poi_skips_unregistered_modules_silently():
    engine = IQEngine()
    engine.register_module(_FakeModule(ModuleType.SEMANTIC_VALIDATION))
    # Request a module that isn't registered — must not raise.
    results = await engine.process_poi(
        _poi(),
        modules=[ModuleType.SEMANTIC_VALIDATION, ModuleType.IMAGE_QUALITY],
    )
    # Only the registered one yields a result; the missing one is
    # filtered out (returns None from _run_module).
    assert len(results) == 1
    assert results[0].module == ModuleType.SEMANTIC_VALIDATION


async def test_process_poi_empty_engine_returns_empty_list():
    results = await IQEngine().process_poi(_poi())
    assert results == []


async def test_process_poi_passes_data_to_modules():
    engine = IQEngine()
    m = _FakeModule(ModuleType.SEMANTIC_VALIDATION)
    engine.register_module(m)
    poi = _poi(name="Castelo de São Jorge")
    results = await engine.process_poi(poi)
    assert results[0].data["name"] == "Castelo de São Jorge"


async def test_process_poi_handles_module_exception_as_failed_result():
    # The base IQModule.process() wraps _process_impl in try/except and
    # returns a FAILED ProcessingResult instead of bubbling — so a
    # broken module does NOT take down the whole pipeline.
    engine = IQEngine()
    engine.register_module(_RaisingModule(ModuleType.SEMANTIC_VALIDATION))
    engine.register_module(_FakeModule(ModuleType.POI_SCORING))
    results = await engine.process_poi(_poi())
    assert len(results) == 2
    failed = [r for r in results if r.module == ModuleType.SEMANTIC_VALIDATION][0]
    assert failed.status == ProcessingStatus.FAILED
    assert "boom" in failed.issues[0]
    ok = [r for r in results if r.module == ModuleType.POI_SCORING][0]
    assert ok.status == ProcessingStatus.COMPLETED


# ── process_poi: execution_time + module fields populated by wrapper ─────────


async def test_process_poi_populates_execution_time_and_module():
    engine = IQEngine()
    engine.register_module(_FakeModule(ModuleType.SEMANTIC_VALIDATION))
    results = await engine.process_poi(_poi())
    r = results[0]
    # base IQModule.process() sets these after _process_impl runs.
    assert r.execution_time_ms >= 0
    assert r.module == ModuleType.SEMANTIC_VALIDATION


# ── process_poi: concurrency ─────────────────────────────────────────────────


async def test_process_poi_runs_modules_concurrently():
    # 3 modules × 50ms each — if serial, total ≥ 150ms; if concurrent
    # via asyncio.gather, ≤ ~80ms. Give a generous upper bound to
    # account for test-runner overhead.
    engine = IQEngine()
    engine.register_module(_SlowModule(ModuleType.SEMANTIC_VALIDATION, 0.05))
    engine.register_module(_SlowModule(ModuleType.COGNITIVE_INFERENCE, 0.05))
    engine.register_module(_SlowModule(ModuleType.IMAGE_QUALITY, 0.05))

    import time
    start = time.monotonic()
    results = await engine.process_poi(_poi())
    elapsed = time.monotonic() - start

    assert len(results) == 3
    # Concurrent: ~50ms; serial: ~150ms. 120ms is a comfortable cutoff.
    assert elapsed < 0.12, f"Expected concurrent, took {elapsed:.3f}s"


# ── process_batch ────────────────────────────────────────────────────────────


async def test_process_batch_returns_dict_keyed_by_poi_id():
    engine = IQEngine()
    engine.register_module(_FakeModule(ModuleType.POI_SCORING))
    pois = [_poi(_id="a"), _poi(_id="b"), _poi(_id="c")]
    out = await engine.process_batch(pois)
    assert set(out.keys()) == {"a", "b", "c"}


async def test_process_batch_each_poi_gets_results_list():
    engine = IQEngine()
    engine.register_module(_FakeModule(ModuleType.POI_SCORING))
    engine.register_module(_FakeModule(ModuleType.SEMANTIC_VALIDATION))
    out = await engine.process_batch([_poi(_id="x")])
    assert len(out["x"]) == 2


async def test_process_batch_empty_input_returns_empty_dict():
    engine = IQEngine()
    engine.register_module(_FakeModule(ModuleType.POI_SCORING))
    out = await engine.process_batch([])
    assert out == {}


async def test_process_batch_respects_concurrency_limit():
    # 5 POIs × 80ms each, concurrency=2 → at least 3 waves → ~240ms.
    # Full concurrency would be ~80ms; serial would be ~400ms.
    engine = IQEngine()
    engine.register_module(_SlowModule(ModuleType.POI_SCORING, 0.08))
    pois = [_poi(_id=str(i)) for i in range(5)]

    import time
    start = time.monotonic()
    out = await engine.process_batch(pois, concurrency=2)
    elapsed = time.monotonic() - start

    assert len(out) == 5
    # With concurrency=2: ceil(5/2) = 3 waves × 80ms = 240ms minimum.
    # Allow a generous window to absorb scheduler overhead.
    assert 0.15 < elapsed < 0.45, f"Concurrency-2 took {elapsed:.3f}s"


# ── get_iq_engine singleton ─────────────────────────────────────────────────


def test_get_iq_engine_returns_singleton_instance():
    e1 = get_iq_engine()
    e2 = get_iq_engine()
    assert e1 is e2
    assert isinstance(e1, IQEngine)
