"""
Audit POI coordinate integrity in `poi_gps_v19.json`.

Reports the precision mix per sheet and per category and exits non-zero
when a configurable share of POIs falls below a minimum precision band.
Useful as a CI gate when iterating on the geocoder / centroid table.

Precision bands (see geocode_offline_pois.precision_for):
  precise        excel decimal coords
  municipality   concelho / cidade / parque / localidade centroid
  district       distrito / ilha / sub-region centroid
  region         NUTS II centroid (lowest precision)

Usage:
    python audit_poi_gps_integrity.py
    python audit_poi_gps_integrity.py --min-precise-pct 50 --max-region-pct 15
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from collections import Counter
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

DEFAULT_JSON = Path(__file__).parent / "data" / "poi_gps_v19.json"
DEFAULT_MISSING = Path(__file__).parent / "data" / "poi_gps_v19_missing.json"

BANDS = ("precise", "municipality", "district", "region")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--json", type=Path, default=DEFAULT_JSON)
    p.add_argument("--missing", type=Path, default=DEFAULT_MISSING)
    p.add_argument("--min-precise-pct", type=float, default=0,
                   help="Fail if precise share falls below this percentage.")
    p.add_argument("--max-region-pct", type=float, default=100,
                   help="Fail if region-only share exceeds this percentage.")
    args = p.parse_args()

    if not args.json.exists():
        log.error(f"JSON not found: {args.json}")
        return 1

    data = json.loads(args.json.read_text())
    pois = data["pois"]
    total = len(pois)
    if total == 0:
        log.error("Empty POI list — run extract_poi_gps_v19.py first.")
        return 1

    by_prec = Counter(p.get("coord_precision") or "unknown" for p in pois)
    missing = (
        json.loads(args.missing.read_text())["total_missing"]
        if args.missing.exists()
        else 0
    )

    log.info("=" * 60)
    log.info("📍 POI GPS INTEGRITY")
    log.info("=" * 60)
    log.info(f"  Total POIs with coords:  {total}")
    log.info(f"  Without coords:          {missing}")
    log.info(f"  Coverage:                {100 * total / (total + missing):.2f}%")
    log.info("")
    log.info("  Precision distribution:")
    for band in BANDS + ("unknown",):
        n = by_prec[band]
        if n == 0:
            continue
        log.info(f"    {band:<14} {n:>5} ({100 * n / total:.1f}%)")

    log.info("\n  Precision by sheet:")
    by_sheet: dict[str, Counter] = {}
    for p in pois:
        by_sheet.setdefault(p.get("sheet", "?"), Counter())[p.get("coord_precision") or "unknown"] += 1
    rows = sorted(by_sheet.items(), key=lambda kv: -sum(kv[1].values()))
    log.info(f"    {'Sheet':<35} {'Total':>6} {'Precise':>8} {'Mun':>5} {'Dist':>5} {'Reg':>5}")
    for sn, c in rows:
        tot = sum(c.values())
        log.info(
            f"    {sn[:34]:<35} {tot:>6} {c['precise']:>8} "
            f"{c['municipality']:>5} {c['district']:>5} {c['region']:>5}"
        )

    log.info("\n  Precision by category:")
    by_cat: dict[str, Counter] = {}
    for p in pois:
        by_cat.setdefault(p.get("category", "?"), Counter())[p.get("coord_precision") or "unknown"] += 1
    for cat, c in sorted(by_cat.items(), key=lambda kv: -sum(kv[1].values())):
        tot = sum(c.values())
        log.info(
            f"    {cat:<20} {tot:>5}   precise={c['precise']:<4} mun={c['municipality']:<4} "
            f"dist={c['district']:<4} reg={c['region']:<4}"
        )

    # Cluster check (POIs sharing exact coords — flags over-approximation).
    locations = Counter(
        (p["location"]["lat"], p["location"]["lng"]) for p in pois if p.get("location")
    )
    clusters = [n for n in locations.values() if n > 1]
    if clusters:
        log.info("\n  Coord-sharing clusters:")
        log.info(f"    POIs on shared coords:    {sum(clusters)}")
        log.info(f"    Distinct shared spots:    {len(clusters)}")
        log.info(f"    Largest cluster:          {max(clusters)} POIs")

    precise_pct = 100 * by_prec["precise"] / total
    region_pct = 100 * by_prec["region"] / total

    exit_code = 0
    if precise_pct < args.min_precise_pct:
        log.error(
            f"\n❌ precise share {precise_pct:.1f}% < threshold "
            f"{args.min_precise_pct}%"
        )
        exit_code = 2
    if region_pct > args.max_region_pct:
        log.error(
            f"\n❌ region-only share {region_pct:.1f}% > threshold "
            f"{args.max_region_pct}%"
        )
        exit_code = 2
    if exit_code == 0:
        log.info("\n✅ Integrity OK")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
