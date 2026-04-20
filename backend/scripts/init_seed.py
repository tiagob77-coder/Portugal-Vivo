#!/usr/bin/env python3
"""
init_seed.py — Script de inicialização idempotente da base de dados.

Corre automaticamente no startup (ver docker-compose.yml command) ou manualmente:
  cd backend && python scripts/init_seed.py

Ordem de execução:
  1. seed_data.py          — Lendas, festas, categorias base
  2. seed_routes.py        — Rotas temáticas iniciais
  3. seed_encyclopedia.py  — Artigos da enciclopédia
  4. seed_calendar.py      — Eventos de calendário
  5. seed_additional.py    — POIs adicionais
  6. seed_empty_categories.py — Categorias vazias (garante consistência)
  7. seed_editorial_collections.py — 3 coleções editoriais iniciais

Cada script é idempotente — usa upsert ou verifica existência antes de inserir.
"""
import asyncio
import importlib
import logging
import os
import sys
import time

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("init_seed")

# Garante que o diretório backend está no path
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

SEED_MODULES = [
    ("seed_data",                   "seed"),
    ("seed_routes",                 "seed"),
    ("seed_encyclopedia",           "seed"),
    ("seed_calendar",               "seed"),
    ("seed_additional",             "seed"),
    ("seed_empty_categories",       "seed"),
    ("seed_editorial_collections",  "seed"),
]


async def wait_for_mongo(max_retries: int = 10, delay: float = 3.0) -> bool:
    """Aguarda MongoDB ficar disponível antes de correr os seeds."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(os.path.join(_backend_dir, ".env"))
    url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")

    for attempt in range(1, max_retries + 1):
        try:
            c = AsyncIOMotorClient(url, serverSelectionTimeoutMS=2000)
            await c.admin.command("ping")
            c.close()
            logger.info("MongoDB disponível após %d tentativa(s).", attempt)
            return True
        except Exception:
            logger.info("MongoDB indisponível (tentativa %d/%d) — aguardando %.0fs...",
                        attempt, max_retries, delay)
            await asyncio.sleep(delay)
    return False


async def run_seeds():
    if not await wait_for_mongo():
        logger.error("MongoDB não disponível após várias tentativas. A abortar seed.")
        sys.exit(1)

    for module_name, fn_name in SEED_MODULES:
        try:
            mod = importlib.import_module(module_name)
            fn = getattr(mod, fn_name)
            logger.info("▶ %s.%s() ...", module_name, fn_name)
            t0 = time.monotonic()
            await fn()
            elapsed = time.monotonic() - t0
            logger.info("  ✓ %s concluído em %.1fs", module_name, elapsed)
        except Exception as exc:
            logger.warning("  ⚠ %s falhou (não crítico): %s", module_name, exc)

    logger.info("Seed completo.")


if __name__ == "__main__":
    asyncio.run(run_seeds())
