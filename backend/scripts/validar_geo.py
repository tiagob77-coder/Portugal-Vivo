#!/usr/bin/env python3
"""
validar_geo.py — Validação e enriquecimento de coordenadas GPS de POIs (P3 Skill)

Funcionalidades:
  1. Detecta POIs sem coordenadas (location: null)
  2. Detecta coordenadas suspeitas (fora de Portugal + ilhas)
  3. Geocodifica via Nominatim (OpenStreetMap) usando o campo `address`
  4. Actualiza a base de dados com as coordenadas corrigidas
  5. Gera relatório CSV com o resultado

Utilização:
  cd backend
  python scripts/validar_geo.py [--dry-run] [--limit N] [--fix] [--report output.csv]

Dependências: motor, httpx, python-dotenv
"""
import asyncio
import argparse
import csv
import logging
import os
import sys
import time
from typing import Optional

import httpx
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# ── Setup ──────────────────────────────────────────────────────────────────────
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_backend_dir, ".env"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("validar_geo")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("DB_NAME",   "portugal_vivo")

# Bounding box de Portugal continental + ilhas (lat, lng)
PT_BOUNDS = {
    "min_lat": 32.6,   # Madeira sul
    "max_lat": 42.2,   # Minho norte
    "min_lng": -31.3,  # Açores oeste (Flores)
    "max_lng": -6.0,   # Alentejo/Algarve este
}

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_DELAY = 1.1   # respeitar rate-limit de 1 req/s


# ── Helpers ────────────────────────────────────────────────────────────────────

def coords_in_portugal(lat: float, lng: float) -> bool:
    b = PT_BOUNDS
    return b["min_lat"] <= lat <= b["max_lat"] and b["min_lng"] <= lng <= b["max_lng"]


async def geocode(address: str, region: str = "", client: httpx.AsyncClient = None) -> Optional[dict]:
    """Geocodifica um endereço via Nominatim. Retorna {'lat': float, 'lng': float} ou None."""
    query = f"{address}, {region}, Portugal".strip(", ")
    try:
        resp = await client.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "pt"},
            headers={"User-Agent": "PortugalVivo/1.0 (geo-validator)"},
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            return {"lat": float(results[0]["lat"]), "lng": float(results[0]["lon"])}
    except Exception as exc:
        logger.warning("Geocoding failed for '%s': %s", query, exc)
    return None


# ── Main logic ─────────────────────────────────────────────────────────────────

async def run(dry_run: bool, limit: int, fix: bool, report_path: str):
    client_db = AsyncIOMotorClient(MONGO_URL)
    db = client_db[DB_NAME]

    stats = {"total": 0, "missing": 0, "suspect": 0, "fixed": 0, "failed": 0, "ok": 0}
    rows = []  # for CSV report

    cursor = db.heritage_items.find({}, {"_id": 0, "id": 1, "name": 1, "location": 1, "address": 1, "region": 1})
    if limit:
        cursor = cursor.limit(limit)

    pois = await cursor.to_list(limit or 100_000)
    stats["total"] = len(pois)

    issues = []
    for poi in pois:
        loc = poi.get("location")
        pid = poi.get("id", "?")
        name = poi.get("name", "?")

        if not loc or loc.get("lat") is None or loc.get("lng") is None:
            status = "MISSING"
            stats["missing"] += 1
            issues.append(poi)
        elif not coords_in_portugal(loc["lat"], loc["lng"]):
            status = "SUSPECT"
            stats["suspect"] += 1
            issues.append(poi)
        else:
            status = "OK"
            stats["ok"] += 1

        rows.append({"id": pid, "name": name, "status": status,
                     "lat": loc.get("lat") if loc else None,
                     "lng": loc.get("lng") if loc else None,
                     "address": poi.get("address", "")})

    logger.info("── Relatório de validação ──")
    logger.info("  Total POIs:    %d", stats["total"])
    logger.info("  OK:            %d", stats["ok"])
    logger.info("  Sem coords:    %d", stats["missing"])
    logger.info("  Suspeitos:     %d", stats["suspect"])

    if fix and issues:
        logger.info("Modo --fix activo: a geocodificar %d POIs...", len(issues))
        async with httpx.AsyncClient() as http:
            for poi in issues:
                address = poi.get("address", poi.get("name", ""))
                region  = poi.get("region", "")
                coords  = await geocode(address, region, http)
                time.sleep(NOMINATIM_DELAY)

                row = next((r for r in rows if r["id"] == poi.get("id")), None)
                if coords:
                    stats["fixed"] += 1
                    logger.info("  ✓ %s → lat=%.5f lng=%.5f", poi.get("name"), coords["lat"], coords["lng"])
                    if row:
                        row["lat"] = coords["lat"]
                        row["lng"] = coords["lng"]
                        row["status"] = "FIXED"
                    if not dry_run:
                        await db.heritage_items.update_one(
                            {"id": poi["id"]},
                            {"$set": {"location": coords}}
                        )
                else:
                    stats["failed"] += 1
                    logger.warning("  ✗ Não geocodificado: %s (%s)", poi.get("name"), address)
                    if row:
                        row["status"] = "FAILED"

        logger.info("Geocodificação: %d corrigidos, %d falhados", stats["fixed"], stats["failed"])

    if report_path:
        with open(report_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["id", "name", "status", "lat", "lng", "address"])
            writer.writeheader()
            writer.writerows(rows)
        logger.info("Relatório gravado em: %s", report_path)

    if dry_run:
        logger.info("Modo --dry-run: nenhuma alteração foi gravada na BD.")

    client_db.close()
    return stats


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Validação e enriquecimento de coordenadas GPS de POIs")
    parser.add_argument("--dry-run",  action="store_true", help="Não gravar alterações na BD")
    parser.add_argument("--fix",      action="store_true", help="Tentar geocodificar POIs sem/suspeitas coords")
    parser.add_argument("--limit",    type=int, default=0, help="Limitar número de POIs a processar")
    parser.add_argument("--report",   default="geo_report.csv", help="Caminho do relatório CSV de saída")
    args = parser.parse_args()

    stats = asyncio.run(run(
        dry_run=args.dry_run,
        limit=args.limit,
        fix=args.fix,
        report_path=args.report,
    ))

    issues = stats["missing"] + stats["suspect"]
    sys.exit(0 if issues == 0 else 1)


if __name__ == "__main__":
    main()
