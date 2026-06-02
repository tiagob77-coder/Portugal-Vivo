"""
Offline geocoder for POIs that the v19 Excel left without coordinates.

Matches each POI in `poi_gps_v19_missing.json` against a curated table of
Portuguese centroids (`data/pt_centroids.json`) using the locality,
municipality (concelho), and district fields in this priority order, then
falls back to the region. Resulting coords are *approximate* (the
municipality / island centre) and are flagged accordingly so the frontend
can render them as such if it wants to.

Output: appended into `data/poi_gps_v19.json`.

Usage:
    python geocode_offline_pois.py
    python geocode_offline_pois.py --limit 200
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import unicodedata
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

DEFAULT_MISSING = Path(__file__).parent / "data" / "poi_gps_v19_missing.json"
DEFAULT_OUT = Path(__file__).parent / "data" / "poi_gps_v19.json"
DEFAULT_CENTROIDS = Path(__file__).parent / "data" / "pt_centroids.json"

_WS_RE = re.compile(r"\s+")
_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)


def normalise(s: Optional[str]) -> str:
    if not s:
        return ""
    nfkd = unicodedata.normalize("NFKD", str(s))
    no_acc = "".join(c for c in nfkd if not unicodedata.combining(c))
    no_punct = _PUNCT_RE.sub(" ", no_acc.lower())
    return _WS_RE.sub(" ", no_punct).strip()


def load_centroids(path: Path) -> dict:
    """Flatten the per-region centroid tree into a single name → entry map."""
    raw = json.loads(path.read_text())
    flat: dict[str, dict] = {}
    for region_key, entries in raw.items():
        if region_key.startswith("_"):
            continue
        if not isinstance(entries, dict):
            continue
        for name, entry in entries.items():
            flat[normalise(name)] = entry
    return flat


def _candidate_keys(text: Optional[str]) -> list[str]:
    """Generate normalised lookup keys from a free-form locality string."""
    if not text:
        return []
    n = normalise(text)
    keys = [n]
    # Split on common separators (parens are already stripped by normalise).
    for sep in ("—", "/", "·", ","):
        for chunk in n.split(sep):
            chunk = chunk.strip()
            if chunk and chunk != n:
                keys.append(chunk)
    # Common multi-word containers ('norte (porto e norte)' → 'norte').
    # We split on whitespace and try each token + adjacent pairs.
    tokens = n.split()
    for tok in tokens:
        if len(tok) >= 3 and tok not in keys:
            keys.append(tok)
    for i in range(len(tokens) - 1):
        bigram = f"{tokens[i]} {tokens[i + 1]}"
        if bigram not in keys:
            keys.append(bigram)
    # Strip leading articles ('vila de ', 'praia de ').
    cleaned = re.sub(r"^(?:praia de|vila de|porto de|cabo de|ilha de|ilha do|ilha da)\s+", "", n)
    if cleaned and cleaned != n:
        keys.append(cleaned)
    # Common abbreviations in the Excel ('V. F. Xira' → 'vila franca de xira').
    abbreviations = {
        "v f xira": "vila franca de xira",
        "v n milfontes": "vila nova de milfontes",
        "v r sto antonio": "vila real de santo antonio",
        "vrsa": "vila real de santo antonio",
        "v n gaia": "vila nova de gaia",
        "v n famalicao": "vila nova de famalicao",
        "gaia": "vila nova de gaia",
        "foz do douro": "porto",
        "moreira conegos": "guimaraes",
    }
    if n in abbreviations:
        keys.append(abbreviations[n])
    # Deduplicate, preserve order.
    seen, out = set(), []
    for k in keys:
        if k and k not in seen:
            seen.add(k)
            out.append(k)
    return out


_PT_POSTCODE_RE = re.compile(r"\b\d{4}(?:-\d{3})?\b")


def _address_locality_candidates(address: Optional[str]) -> list[str]:
    """Pull plausible locality keys out of a free-form address.

    Targets the trailing token after the last comma — e.g. for
    "Av. Horta d'El Rei, Tomar" returns ['tomar']; for
    "R. Dom João de Castro 210, 4150-417 Porto" returns ['porto'].
    """
    if not address:
        return []
    s = address.strip()
    candidates: list[str] = []
    parts = [p.strip() for p in s.split(",") if p.strip()]
    if not parts:
        return []
    for tail in parts[::-1]:
        # Strip postal code if present, then keep the remainder.
        cleaned = _PT_POSTCODE_RE.sub("", tail).strip()
        if cleaned:
            candidates.extend(_candidate_keys(cleaned))
        # Also try the tail as-is.
        candidates.extend(_candidate_keys(tail))
    # Last word of the whole address as a final hail mary.
    last_word = re.sub(r"[^\w\s]", " ", s).split()
    if last_word:
        candidates.extend(_candidate_keys(last_word[-1]))
    seen, out = set(), []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def lookup(poi: dict, centroids: dict) -> Optional[dict]:
    """Find the best centroid for this POI. Returns the centroid entry or None.

    Priority: localidade > concelho > distrito > address tail > region.
    The region constraint filters out ambiguous names (e.g. 'lagoa' in
    Algarve vs Açores).
    """
    poi_region = (poi.get("region") or "").lower()

    for field in ("localidade", "concelho", "distrito"):
        for key in _candidate_keys(poi.get(field)):
            entry = centroids.get(key)
            if entry and (not poi_region or entry.get("region") == poi_region or entry["type"] == "regiao"):
                return entry
            # Ambiguity: try '<name> <region>' (e.g. 'calheta madeira').
            if poi_region:
                entry2 = centroids.get(f"{key} {poi_region}")
                if entry2:
                    return entry2

    # Address tail (catches sheets that didn't fill concelho/localidade).
    for key in _address_locality_candidates(poi.get("address")):
        entry = centroids.get(key)
        if entry and (not poi_region or entry.get("region") == poi_region or entry["type"] == "regiao"):
            return entry

    # Last resort: region centroid.
    for key in _candidate_keys(poi.get("region")):
        entry = centroids.get(key)
        if entry:
            return entry
    return None


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--missing", type=Path, default=DEFAULT_MISSING)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--centroids", type=Path, default=DEFAULT_CENTROIDS)
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--dry-run", action="store_true",
                   help="Report matches without writing to the output file.")
    args = p.parse_args()

    if not args.missing.exists():
        log.error(f"Missing JSON not found: {args.missing}")
        return 1
    if not args.centroids.exists():
        log.error(f"Centroids table not found: {args.centroids}")
        return 1

    centroids = load_centroids(args.centroids)
    log.info(f"📍 Loaded {len(centroids)} centroids")

    missing = json.loads(args.missing.read_text())
    pois = missing["pois"]
    if args.limit > 0:
        pois = pois[: args.limit]

    log.info(f"📥 {len(pois)} POIs to geocode")

    matched: list[dict] = []
    still_missing: list[dict] = []
    hits_by_field = {"localidade": 0, "concelho": 0, "distrito": 0, "region": 0}

    for poi in pois:
        entry = lookup(poi, centroids)
        if entry:
            poi_out = dict(poi)
            poi_out["location"] = {"lat": entry["lat"], "lng": entry["lng"]}
            poi_out["coord_source"] = f"centroid_{entry['type']}"
            poi_out["coord_approximate"] = True
            matched.append(poi_out)
            # Track which field led to the match (best-effort).
            for field in ("localidade", "concelho", "distrito", "region"):
                if any(k in centroids and centroids[k] is entry
                       for k in _candidate_keys(poi.get(field))):
                    hits_by_field[field] += 1
                    break
        else:
            still_missing.append(poi)

    log.info("\n" + "=" * 60)
    log.info("📊 OFFLINE GEOCODING")
    log.info("=" * 60)
    log.info(f"  Input:                {len(pois)}")
    log.info(f"  Matched:              {len(matched)} ({100 * len(matched) / max(1, len(pois)):.1f}%)")
    log.info(f"  Still missing:        {len(still_missing)}")
    log.info("  Hit source breakdown:")
    for k, v in hits_by_field.items():
        log.info(f"    {k:<12} {v}")

    if args.dry_run:
        log.info("\nℹ️  Dry-run: no files written.")
        return 0

    # Append matched POIs into the output JSON, dedup by name_normalised + region.
    out_payload = json.loads(args.out.read_text()) if args.out.exists() else {"pois": []}
    existing_keys = {
        (p["name_normalised"], p.get("region", "")) for p in out_payload.get("pois", [])
    }
    appended = 0
    for poi in matched:
        k = (poi["name_normalised"], poi.get("region", ""))
        if k in existing_keys:
            continue
        out_payload["pois"].append(poi)
        existing_keys.add(k)
        appended += 1
    out_payload.setdefault("totals", {})
    out_payload["totals"]["geocoded_offline"] = out_payload["totals"].get("geocoded_offline", 0) + appended
    args.out.write_text(json.dumps(out_payload, ensure_ascii=False, indent=2))
    log.info(f"\n💾 Appended {appended} POIs to {args.out.name}")

    # Re-write the missing file so subsequent online geocoding only sees the
    # truly unresolved cases.
    args.missing.write_text(json.dumps(
        {
            "version": missing.get("version", "v19"),
            "generated_at": missing.get("generated_at"),
            "total_missing": len(still_missing),
            "pois": still_missing,
        },
        ensure_ascii=False, indent=2,
    ))
    log.info(f"💾 Refreshed {args.missing.name}: {len(still_missing)} remaining")
    return 0


if __name__ == "__main__":
    sys.exit(main())
