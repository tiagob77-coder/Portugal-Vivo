"""
Unit tests for scripts/backfill_name_normalised.

Uses a minimal Motor-shaped stub that supports the subset of operations
the backfill touches: count_documents, an async-iterable find cursor,
and bulk_write with UpdateOne.
"""
from __future__ import annotations

from typing import Any, Dict, List

import pytest

from scripts.backfill_name_normalised import backfill


class _FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def __aiter__(self):
        self._idx = 0
        return self

    async def __anext__(self):
        if self._idx >= len(self._docs):
            raise StopAsyncIteration
        doc = self._docs[self._idx]
        self._idx += 1
        return doc


class _BulkResult:
    def __init__(self, modified_count: int):
        self.modified_count = modified_count


class _FakeCollection:
    def __init__(self, docs: List[Dict[str, Any]]):
        self._docs = docs
        self.bulk_calls: List[int] = []

    async def count_documents(self, query):
        return len(self._docs)

    def find(self, query, projection=None):
        return _FakeCursor(list(self._docs))

    async def bulk_write(self, ops, ordered=False):
        # Apply every UpdateOne to the in-memory store so subsequent
        # assertions can inspect the result.
        applied = 0
        for op in ops:
            filter_ = op._filter if hasattr(op, "_filter") else op["filter"]
            update = op._doc if hasattr(op, "_doc") else op["update"]
            for doc in self._docs:
                if all(doc.get(k) == v for k, v in filter_.items()):
                    doc.update(update.get("$set", {}))
                    applied += 1
                    break
        self.bulk_calls.append(applied)
        return _BulkResult(applied)


class _FakeDB:
    def __init__(self, docs):
        self.heritage_items = _FakeCollection(docs)


@pytest.mark.asyncio
async def test_backfill_populates_missing_name_normalised():
    docs = [
        {"_id": 1, "name": "Castelo de Guimarães"},
        {"_id": 2, "name": "Praia da Falésia", "name_normalised": "stale value"},
        {"_id": 3, "name": "Já normalizado", "name_normalised": "ja normalizado"},
        {"_id": 4, "name": ""},  # skipped
        {"_id": 5},  # no name at all — skipped
    ]
    db = _FakeDB(docs)
    summary = await backfill(db, batch_size=10)

    assert summary["scanned"] == 5
    assert summary["updated"] == 2  # docs 1 and 2
    assert summary["skipped_no_name"] == 2
    assert docs[0]["name_normalised"] == "castelo de guimaraes"
    assert docs[1]["name_normalised"] == "praia da falesia"
    # Correct doc not re-written
    assert docs[2]["name_normalised"] == "ja normalizado"


@pytest.mark.asyncio
async def test_backfill_dry_run_does_not_write():
    docs = [{"_id": 1, "name": "Igreja"}]
    db = _FakeDB(docs)
    summary = await backfill(db, batch_size=10, dry_run=True)

    assert summary["updated"] == 1
    assert summary["dry_run"] is True
    assert "name_normalised" not in docs[0]
    assert db.heritage_items.bulk_calls == []


@pytest.mark.asyncio
async def test_backfill_respects_batch_size():
    docs = [{"_id": i, "name": f"POI-{i}"} for i in range(25)]
    db = _FakeDB(docs)
    await backfill(db, batch_size=10)

    # 25 items / 10 per batch → 3 bulk_write calls (10, 10, 5)
    assert db.heritage_items.bulk_calls == [10, 10, 5]
