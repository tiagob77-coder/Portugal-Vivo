"""
Protected areas & habitats lookup — Rede Natura 2000, RNAP (ICNF), biodiversity.

Same pattern as CAOP lookup: loads polygons from MongoDB into a shapely
STRtree, serves synchronous point-in-polygon queries.

Collections:
  - protected_areas  (Rede Natura 2000 ZPE/ZEC, PN, PNR, RN, etc.)
  - habitats         (habitat types from Directiva Habitats / ICNF)

Each document shape (matches CAOP conventions):
  { code, name, category, geometry, centroid, bbox, area_km2, source }

Source files (.gpkg) should be placed in backend/data/protected_areas/ and
ingested with scripts/ingest_protected_areas.py.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional

from shapely.geometry import Point, shape
from shapely.strtree import STRtree

log = logging.getLogger(__name__)


@dataclass
class _Layer:
    kind: str
    tree: Optional[STRtree] = None
    geoms: list = field(default_factory=list)
    docs: list[dict] = field(default_factory=list)
    loaded: bool = False


class ProtectedAreasLookup:
    def __init__(self) -> None:
        self._protected = _Layer("protected_area")
        self._habitats = _Layer("habitat")
        self._lock = asyncio.Lock()

    async def load(self, db) -> dict[str, int]:
        async with self._lock:
            counts = {}
            counts["protected_areas"] = await self._load(
                db, "protected_areas", self._protected
            )
            counts["habitats"] = await self._load(db, "habitats", self._habitats)
            log.info("ProtectedAreasLookup loaded: %s", counts)
            return counts

    async def ensure_loaded(self, db) -> None:
        if not self._protected.loaded:
            await self.load(db)

    async def _load(self, db, coll: str, layer: _Layer) -> int:
        geoms, docs = [], []
        async for d in db[coll].find({}, {"_id": 0}):
            g_raw = d.get("geometry")
            if not g_raw:
                continue
            try:
                g = shape(g_raw)
                if not g.is_empty:
                    geoms.append(g)
                    docs.append(d)
            except Exception as e:
                log.warning("Invalid geometry in %s: %s", coll, e)
        layer.geoms = geoms
        layer.docs = docs
        layer.tree = STRtree(geoms) if geoms else None
        layer.loaded = True
        return len(geoms)

    @property
    def is_ready(self) -> bool:
        return self._protected.loaded

    def stats(self) -> dict[str, int]:
        return {
            "protected_areas": len(self._protected.docs),
            "habitats": len(self._habitats.docs),
        }

    # ─── Queries ─────────────────────────────────────────────────────

    def find_protected(self, lat: float, lng: float) -> list[dict]:
        return self._find_all(self._protected, lat, lng)

    def find_habitats(self, lat: float, lng: float) -> list[dict]:
        return self._find_all(self._habitats, lat, lng)

    def _find_all(self, layer: _Layer, lat: float, lng: float) -> list[dict]:
        if not layer.tree:
            return []
        pt = Point(lng, lat)
        idxs = layer.tree.query(pt, predicate="intersects")
        hits = []
        for idx in idxs:
            g = layer.geoms[int(idx)]
            if g.contains(pt):
                doc = layer.docs[int(idx)]
                hits.append({
                    "code": doc.get("code"),
                    "name": doc.get("name"),
                    "category": doc.get("category"),
                    "source": doc.get("source"),
                })
        return hits


protected_areas = ProtectedAreasLookup()

__all__ = ["ProtectedAreasLookup", "protected_areas"]
