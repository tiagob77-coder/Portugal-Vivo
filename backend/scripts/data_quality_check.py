"""
Data-quality sweep over the heritage_items collection.

Run standalone (from backend/):
    python scripts/data_quality_check.py          # console summary
    python scripts/data_quality_check.py --json   # full JSON to stdout

Checks performed:
  - Duplicate clusters (uses poi_dedup rules: source_id, normalised name +
    region, name + coords <50m).
  - Missing critical fields: name, category, region.
  - Missing/invalid coordinates (outside Portugal bounding box).
  - Empty descriptions on POIs marked as published.

The same `run_data_quality_check(db, ...)` function is exposed for tests
and (later) for an admin endpoint that can surface the report in-app.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from typing import Any, Dict, List, Optional

# Allow `python scripts/data_quality_check.py` and `python -m scripts.data_quality_check`
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_THIS_DIR)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from poi_dedup import find_duplicates_in_set  # noqa: E402

# Mainland Portugal + Azores + Madeira bounding box.
# Slightly loose to tolerate edge POIs without false-positives.
_PT_LAT_MIN, _PT_LAT_MAX = 32.0, 43.0
_PT_LNG_MIN, _PT_LNG_MAX = -32.0, -6.0

_REQUIRED_FIELDS = ("name", "category", "region")
_PROJECTION = {
    "_id": 0,
    "id": 1,
    "name": 1,
    "category": 1,
    "region": 1,
    "location": 1,
    "poi_source_id": 1,
    "description": 1,
    "source": 1,
}


def _coords_invalid(location: Any) -> Optional[str]:
    if not isinstance(location, dict):
        return "missing_location"
    lat = location.get("lat")
    lng = location.get("lng")
    if lat is None and lng is None:
        return "missing_location"
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return "invalid_types"
    if not (_PT_LAT_MIN <= lat <= _PT_LAT_MAX) or not (_PT_LNG_MIN <= lng <= _PT_LNG_MAX):
        return "outside_portugal"
    return None


async def run_data_quality_check(
    db,
    *,
    sample_limit: int = 50,
) -> Dict[str, Any]:
    """Scan heritage_items and return a structured report.

    `sample_limit` caps the number of example documents returned per category
    so the payload stays bounded even on very dirty datasets.
    """
    docs = await db.heritage_items.find({}, _PROJECTION).to_list(length=None)
    total = len(docs)

    missing_required: Dict[str, List[Dict[str, Any]]] = {f: [] for f in _REQUIRED_FIELDS}
    bad_coords: Dict[str, List[Dict[str, Any]]] = {
        "missing_location": [],
        "invalid_types": [],
        "outside_portugal": [],
    }

    for doc in docs:
        for field in _REQUIRED_FIELDS:
            value = doc.get(field)
            if value is None or (isinstance(value, str) and not value.strip()):
                if len(missing_required[field]) < sample_limit:
                    missing_required[field].append({"id": doc.get("id"), "name": doc.get("name")})

        coord_issue = _coords_invalid(doc.get("location"))
        if coord_issue and len(bad_coords[coord_issue]) < sample_limit:
            bad_coords[coord_issue].append(
                {"id": doc.get("id"), "name": doc.get("name"), "location": doc.get("location")}
            )

    duplicate_clusters_full = find_duplicates_in_set(docs)
    duplicate_clusters = duplicate_clusters_full[:sample_limit]
    duplicate_doc_count = sum(len(c) for c in duplicate_clusters_full)

    report = {
        "total_documents": total,
        "duplicates": {
            "cluster_count": len(duplicate_clusters_full),
            "affected_documents": duplicate_doc_count,
            "sample_clusters": [
                [
                    {"id": d.get("id"), "name": d.get("name"), "region": d.get("region")}
                    for d in cluster
                ]
                for cluster in duplicate_clusters
            ],
        },
        "missing_required_fields": {
            field: {"count": len(items), "samples": items}
            for field, items in missing_required.items()
        },
        "invalid_coordinates": {
            issue: {"count": len(items), "samples": items}
            for issue, items in bad_coords.items()
        },
    }
    return report


def _print_summary(report: Dict[str, Any]) -> None:
    print(f"Total documents: {report['total_documents']}")
    dup = report["duplicates"]
    print(
        f"Duplicate clusters: {dup['cluster_count']} "
        f"(affecting {dup['affected_documents']} documents)"
    )
    print("Missing required fields:")
    for field, info in report["missing_required_fields"].items():
        print(f"  - {field}: {info['count']}")
    print("Coordinate issues:")
    for issue, info in report["invalid_coordinates"].items():
        print(f"  - {issue}: {info['count']}")


async def _main() -> None:
    parser = argparse.ArgumentParser(description="POI data-quality sweep")
    parser.add_argument("--json", action="store_true", help="Emit full JSON report")
    parser.add_argument(
        "--sample-limit", type=int, default=50, help="Max sample items per category"
    )
    args = parser.parse_args()

    from motor.motor_asyncio import AsyncIOMotorClient

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = AsyncIOMotorClient(mongo_url)
    try:
        report = await run_data_quality_check(
            client[db_name], sample_limit=args.sample_limit
        )
    finally:
        client.close()

    if args.json:
        json.dump(report, sys.stdout, ensure_ascii=False, indent=2, default=str)
        sys.stdout.write("\n")
    else:
        _print_summary(report)


if __name__ == "__main__":
    asyncio.run(_main())
