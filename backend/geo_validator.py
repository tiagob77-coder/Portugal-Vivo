"""
Geo-validator — validates and auto-corrects POI coordinates against CAOP
administrative boundaries.

Pipeline per POI:
  1. Reject absurd coordinates (outside PT bounding envelope).
  2. Point-in-polygon against all CAOP freguesias via the in-memory STRtree.
  3. If outside every parish:
       - if within SNAP_TOLERANCE_M of the nearest parish → snap & log
       - else → flag as suspect
  4. If the POI declared a parish_code that doesn't match the resolved one,
     flag as `parish_mismatch`.
  5. Enrich document with municipality / nuts3 / nuts2 / nuts1 from CAOP.

All corrections are appended to the `geo_audit_log` collection.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional

from services.caop_lookup import lookup, ParishInfo
from services.protected_areas import protected_areas

log = logging.getLogger(__name__)


# ─── Configuration ────────────────────────────────────────────────────────────

# Bounding envelope for all Portuguese territory (including Madeira and Azores).
# lat 32.2 (Madeira south) → 42.2 (Minho north)
# lng -31.3 (Flores west) → -6.1 (east border)
PT_LAT_MIN, PT_LAT_MAX = 32.0, 42.5
PT_LNG_MIN, PT_LNG_MAX = -31.5, -6.0

# Mainland only (used to decide whether a point should snap to land).
MAINLAND_LAT_MIN, MAINLAND_LAT_MAX = 36.9, 42.2
MAINLAND_LNG_MIN, MAINLAND_LNG_MAX = -9.6, -6.1

# Snap threshold — if a POI is < 50m from a parish border, we move it inside.
SNAP_TOLERANCE_M = 50.0

# If a POI is between SNAP_TOLERANCE_M and SEA_TOLERANCE_M of the coast we
# treat it as a sea POI and try to snap it to land.
SEA_TOLERANCE_M = 2000.0


# ─── Result types ─────────────────────────────────────────────────────────────

VALID_STATUSES = {"ok", "snapped", "sea_snapped", "suspect", "invalid", "skipped"}


@dataclass
class ValidationResult:
    status: str  # one of VALID_STATUSES
    lat: Optional[float] = None
    lng: Optional[float] = None
    original_lat: Optional[float] = None
    original_lng: Optional[float] = None
    parish: Optional[ParishInfo] = None
    distance_to_border_m: float = 0.0
    corrections: list[str] = field(default_factory=list)
    reason: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "lat": self.lat,
            "lng": self.lng,
            "original_lat": self.original_lat,
            "original_lng": self.original_lng,
            "parish": self.parish.to_dict() if self.parish else None,
            "distance_to_border_m": round(self.distance_to_border_m, 2),
            "corrections": self.corrections,
            "reason": self.reason,
        }

    @property
    def was_modified(self) -> bool:
        return (
            self.original_lat is not None
            and self.original_lng is not None
            and (self.lat != self.original_lat or self.lng != self.original_lng)
        )


# ─── Public validator ─────────────────────────────────────────────────────────

def _in_envelope(lat: float, lng: float) -> bool:
    return (
        PT_LAT_MIN <= lat <= PT_LAT_MAX
        and PT_LNG_MIN <= lng <= PT_LNG_MAX
    )


def validate(
    lat: float,
    lng: float,
    declared_parish_code: Optional[str] = None,
) -> ValidationResult:
    """
    Validate a coordinate. Does NOT write to DB — caller decides whether to
    persist the result or the audit log entry.

    Safe to call if `lookup` has not been loaded yet: returns status=skipped.
    """
    # Sanity-check input
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return ValidationResult(status="invalid", reason="coords not numeric")

    if lat == 0 and lng == 0:
        return ValidationResult(status="invalid", reason="(0,0) sentinel")

    if not _in_envelope(lat, lng):
        return ValidationResult(
            status="invalid",
            reason=f"out of PT bounding envelope ({lat}, {lng})",
            original_lat=lat,
            original_lng=lng,
        )

    # Lookup may be empty if CAOP not ingested yet — we return "skipped" so
    # callers keep the original coordinates.
    if not lookup.is_ready:
        return ValidationResult(
            status="skipped",
            lat=lat,
            lng=lng,
            original_lat=lat,
            original_lng=lng,
            reason="CAOP lookup not loaded",
        )

    # Inside a parish?
    parish = lookup.find_parish(lat, lng)
    if parish is not None and parish.inside:
        result = ValidationResult(
            status="ok",
            lat=lat,
            lng=lng,
            original_lat=lat,
            original_lng=lng,
            parish=parish,
            distance_to_border_m=0.0,
        )
        _check_declared_parish_mismatch(result, declared_parish_code)
        return result

    # Outside — find the closest parish
    nearest = lookup.find_nearest_parish(lat, lng)
    if not nearest:
        return ValidationResult(
            status="suspect",
            lat=lat,
            lng=lng,
            original_lat=lat,
            original_lng=lng,
            reason="no parish nearby",
        )

    distance = nearest.distance_to_border_m

    # Very close to the border → snap silently
    if distance <= SNAP_TOLERANCE_M:
        snapped = lookup.nearest_land_point(lat, lng, max_km=0.1) or (lat, lng)
        return ValidationResult(
            status="snapped",
            lat=round(snapped[0], 7),
            lng=round(snapped[1], 7),
            original_lat=lat,
            original_lng=lng,
            parish=nearest,
            distance_to_border_m=distance,
            corrections=[f"snapped {distance:.1f} m to border of {nearest.parish_name}"],
        )

    # Within the sea tolerance → snap to land but mark as sea_snapped
    if distance <= SEA_TOLERANCE_M:
        snapped = lookup.nearest_land_point(lat, lng, max_km=SEA_TOLERANCE_M / 1000.0)
        if snapped:
            return ValidationResult(
                status="sea_snapped",
                lat=round(snapped[0], 7),
                lng=round(snapped[1], 7),
                original_lat=lat,
                original_lng=lng,
                parish=nearest,
                distance_to_border_m=distance,
                corrections=[
                    f"moved {distance:.0f} m inland to nearest coast of "
                    f"{nearest.parish_name}"
                ],
            )

    # Farther than the sea tolerance → suspect
    return ValidationResult(
        status="suspect",
        lat=lat,
        lng=lng,
        original_lat=lat,
        original_lng=lng,
        parish=nearest,
        distance_to_border_m=distance,
        reason=f"{distance:.0f} m from nearest parish {nearest.parish_name}",
    )


def _check_declared_parish_mismatch(
    result: ValidationResult,
    declared_parish_code: Optional[str],
) -> None:
    if not declared_parish_code or not result.parish:
        return
    if declared_parish_code.strip() and declared_parish_code != result.parish.parish_code:
        result.corrections.append(
            f"parish_mismatch: declared={declared_parish_code} "
            f"resolved={result.parish.parish_code}"
        )


# ─── Audit log helpers ────────────────────────────────────────────────────────

async def log_audit(
    db,
    *,
    poi_id: Optional[str],
    result: ValidationResult,
    actor: Optional[str] = None,
) -> None:
    """Persist a validation outcome. Safe to call for every POI."""
    if db is None:
        return
    entry = {
        "poi_id": poi_id,
        "status": result.status,
        "lat_before": result.original_lat,
        "lng_before": result.original_lng,
        "lat_after": result.lat,
        "lng_after": result.lng,
        "was_modified": result.was_modified,
        "parish_code": result.parish.parish_code if result.parish else None,
        "parish_name": result.parish.parish_name if result.parish else None,
        "municipality_code": result.parish.municipality_code if result.parish else None,
        "nuts3_code": result.parish.nuts3_code if result.parish else None,
        "distance_to_border_m": result.distance_to_border_m,
        "corrections": result.corrections,
        "reason": result.reason,
        "actor": actor,
    }
    try:
        from datetime import datetime, timezone
        entry["created_at"] = datetime.now(timezone.utc)
        await db["geo_audit_log"].insert_one(entry)
    except Exception as e:
        log.warning("Failed to write geo_audit_log: %s", e)


def enrich_poi(poi: dict) -> dict:
    """
    Validate + enrich a POI dict in place. Returns the updated dict.

    Used by importers / migration scripts. For single-point validation from
    the API use `validate()` directly.
    """
    loc = poi.get("location") or {}
    lat = loc.get("lat")
    lng = loc.get("lng")
    if lat is None or lng is None:
        coords = loc.get("coordinates")
        if isinstance(coords, (list, tuple)) and len(coords) >= 2:
            lng, lat = coords[0], coords[1]
    if lat is None or lng is None:
        return poi

    result = validate(lat, lng, declared_parish_code=poi.get("freguesia_code"))
    if result.status in ("snapped", "sea_snapped") and result.lat and result.lng:
        poi["location"] = {"lat": result.lat, "lng": result.lng}
    if result.parish and result.status in ("ok", "snapped", "sea_snapped"):
        poi["freguesia_code"] = result.parish.parish_code
        poi["concelho_code"] = result.parish.municipality_code
        poi["distrito_code"] = result.parish.district_code
        poi["nuts3_code"] = result.parish.nuts3_code
        poi["nuts2_code"] = result.parish.nuts2_code
        poi["nuts1_code"] = result.parish.nuts1_code
        poi["caop_validated"] = True
        # Enrich with protected areas & habitats if available
        if protected_areas.is_ready:
            pa = protected_areas.find_protected(result.lat or lat, result.lng or lng)
            hb = protected_areas.find_habitats(result.lat or lat, result.lng or lng)
            if pa:
                poi["protected_area"] = [p["name"] for p in pa]
            if hb:
                poi["habitat_type"] = [h["name"] for h in hb]
    return poi


__all__ = [
    "validate",
    "enrich_poi",
    "log_audit",
    "ValidationResult",
    "SNAP_TOLERANCE_M",
    "SEA_TOLERANCE_M",
    "PT_LAT_MIN",
    "PT_LAT_MAX",
    "PT_LNG_MIN",
    "PT_LNG_MAX",
]
