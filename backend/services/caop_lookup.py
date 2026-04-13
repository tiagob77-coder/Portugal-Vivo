"""
CAOP lookup service — in-memory spatial index over administrative boundaries.

Loads freguesia / concelho / distrito polygons from MongoDB once, builds a
shapely STRtree per collection, and serves synchronous point-in-polygon and
nearest-polygon queries at microsecond latency.

Designed as a singleton. The FastAPI app calls `ensure_loaded(db)` on startup;
other modules import `lookup.find_parish(lat, lng)` directly.
"""
from __future__ import annotations

import asyncio
import logging
import math
from dataclasses import dataclass, field
from typing import Optional

from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.ops import nearest_points, transform as shp_transform
from shapely.strtree import STRtree

log = logging.getLogger(__name__)

# For distance-in-meters on a geographic geometry we reproject a small patch
# to EPSG:3763 (PT-TM06). Cheap enough for on-demand calls.
_T_4326_TO_3763 = Transformer.from_crs("EPSG:4326", "EPSG:3763", always_xy=True)


def _to_meters(geom):
    return shp_transform(
        lambda x, y, z=None: _T_4326_TO_3763.transform(x, y),
        geom,
    )


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@dataclass
class _Layer:
    """One administrative layer (parish / municipality / district)."""
    kind: str
    tree: Optional[STRtree] = None
    geoms: list = field(default_factory=list)
    docs: list[dict] = field(default_factory=list)
    loaded: bool = False


@dataclass
class ParishInfo:
    """Result of a successful point-in-polygon lookup."""
    parish_code: str
    parish_name: str
    municipality_code: str
    municipality_name: Optional[str]
    district_code: str
    district_name: Optional[str]
    nuts3_code: Optional[str]
    nuts2_code: Optional[str]
    nuts1_code: Optional[str]
    inside: bool
    distance_to_border_m: float

    def to_dict(self) -> dict:
        return {
            "parish_code": self.parish_code,
            "parish_name": self.parish_name,
            "municipality_code": self.municipality_code,
            "municipality_name": self.municipality_name,
            "district_code": self.district_code,
            "district_name": self.district_name,
            "nuts3_code": self.nuts3_code,
            "nuts2_code": self.nuts2_code,
            "nuts1_code": self.nuts1_code,
            "inside": self.inside,
            "distance_to_border_m": round(self.distance_to_border_m, 2),
        }


class CAOPLookup:
    """Singleton-style lookup over the three CAOP collections."""

    def __init__(self) -> None:
        self._parish = _Layer("parish")
        self._municipality = _Layer("municipality")
        self._district = _Layer("district")
        self._lock = asyncio.Lock()

    # ─── Lifecycle ────────────────────────────────────────────────────

    async def load(self, db) -> dict[str, int]:
        """(Re)load polygons from MongoDB into memory. Idempotent."""
        async with self._lock:
            counts = {}
            counts["parish"] = await self._load_layer(
                db, "caop_freguesias", self._parish
            )
            counts["municipality"] = await self._load_layer(
                db, "caop_concelhos", self._municipality
            )
            counts["district"] = await self._load_layer(
                db, "caop_distritos", self._district
            )
            log.info("CAOPLookup loaded: %s", counts)
            return counts

    async def ensure_loaded(self, db) -> None:
        if not self._parish.loaded:
            await self.load(db)

    async def _load_layer(self, db, coll: str, layer: _Layer) -> int:
        geoms = []
        docs = []
        # projection: omit large fields only when we don't need them
        cursor = db[coll].find({}, {"_id": 0})
        async for d in cursor:
            geom_raw = d.get("geometry")
            if not geom_raw:
                continue
            try:
                g = shape(geom_raw)
                if g.is_empty:
                    continue
                geoms.append(g)
                docs.append(d)
            except Exception as e:
                log.warning("Skipping invalid geometry in %s: %s", coll, e)
                continue
        layer.geoms = geoms
        layer.docs = docs
        layer.tree = STRtree(geoms) if geoms else None
        layer.loaded = True
        return len(geoms)

    @property
    def is_ready(self) -> bool:
        return self._parish.loaded and bool(self._parish.tree)

    def stats(self) -> dict[str, int]:
        return {
            "parishes": len(self._parish.docs),
            "municipalities": len(self._municipality.docs),
            "districts": len(self._district.docs),
        }

    # ─── Point queries ────────────────────────────────────────────────

    def find_parish(self, lat: float, lng: float) -> Optional[ParishInfo]:
        """Returns ParishInfo if the point is inside any parish, else None."""
        return self._find_in_layer(self._parish, lat, lng)

    def find_nearest_parish(self, lat: float, lng: float) -> Optional[ParishInfo]:
        """Nearest parish even if the point is outside (e.g. in the sea)."""
        return self._find_nearest_in_layer(self._parish, lat, lng)

    def find_municipality(self, lat: float, lng: float) -> Optional[dict]:
        info = self._find_in_layer(self._municipality, lat, lng)
        return info.to_dict() if info else None

    def find_district(self, lat: float, lng: float) -> Optional[dict]:
        info = self._find_in_layer(self._district, lat, lng)
        return info.to_dict() if info else None

    # ─── Internals ────────────────────────────────────────────────────

    def _info_from_doc(
        self, doc: dict, *, inside: bool, distance_m: float
    ) -> ParishInfo:
        return ParishInfo(
            parish_code=doc.get("code") or "",
            parish_name=doc.get("name") or doc.get("name_raw") or "",
            municipality_code=doc.get("municipality_code") or "",
            municipality_name=doc.get("municipality_name"),
            district_code=doc.get("district_code") or "",
            district_name=doc.get("district_name"),
            nuts3_code=doc.get("nuts3_code"),
            nuts2_code=doc.get("nuts2_code"),
            nuts1_code=doc.get("nuts1_code"),
            inside=inside,
            distance_to_border_m=distance_m,
        )

    def _find_in_layer(
        self, layer: _Layer, lat: float, lng: float
    ) -> Optional[ParishInfo]:
        if not layer.tree:
            return None
        pt = Point(lng, lat)
        candidates = layer.tree.query(pt, predicate="intersects")
        if len(candidates) == 0:
            return None
        # STRtree.query returns indices in shapely 2.x
        for idx in candidates:
            g = layer.geoms[int(idx)]
            if g.contains(pt):
                doc = layer.docs[int(idx)]
                return self._info_from_doc(doc, inside=True, distance_m=0.0)
        return None

    def _find_nearest_in_layer(
        self, layer: _Layer, lat: float, lng: float
    ) -> Optional[ParishInfo]:
        if not layer.tree:
            return None
        pt = Point(lng, lat)
        # 1) direct hit
        hit = self._find_in_layer(layer, lat, lng)
        if hit:
            return hit
        # 2) nearest — shapely 2.x: tree.nearest returns index
        idx = layer.tree.nearest(pt)
        if idx is None:
            return None
        g = layer.geoms[int(idx)]
        doc = layer.docs[int(idx)]
        # distance to border in meters via nearest_points
        try:
            np_geom, np_pt = nearest_points(g, pt)
            distance_m = _haversine_m(lat, lng, np_geom.y, np_geom.x)
        except Exception:
            distance_m = _haversine_m(
                lat, lng,
                doc.get("centroid", {}).get("lat", lat),
                doc.get("centroid", {}).get("lng", lng),
            )
        return self._info_from_doc(doc, inside=False, distance_m=distance_m)

    def nearest_land_point(
        self, lat: float, lng: float, max_km: float = 10.0
    ) -> Optional[tuple[float, float]]:
        """
        If the point is not on Portuguese land, return the nearest point on
        the coastline within max_km, else None.
        """
        nearest = self.find_nearest_parish(lat, lng)
        if nearest and nearest.inside:
            return (lat, lng)
        if not nearest:
            return None
        if nearest.distance_to_border_m / 1000.0 > max_km:
            return None
        # find the nearest point on the parish polygon
        if not self._parish.tree:
            return None
        pt = Point(lng, lat)
        idx = self._parish.tree.nearest(pt)
        if idx is None:
            return None
        g = self._parish.geoms[int(idx)]
        np_geom, _ = nearest_points(g, pt)
        return (np_geom.y, np_geom.x)


# Module-level singleton
lookup = CAOPLookup()

__all__ = ["CAOPLookup", "ParishInfo", "lookup"]
