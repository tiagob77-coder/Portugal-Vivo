"""
Translate the POI sheets (heritage_items) into English, Spanish and French.

Fills `poi_translations`, which /api/heritage/{id}/localized merges into the
POI sheet. One LLM call per POI covers every missing language.

Idempotent: translations made from the current source text and manual ones
are skipped, so a run that stops (time budget, quota) can simply be re-run.

Run (from backend/, with MONGO_URL, DB_NAME and OPENAI_API_KEY set):
    python scripts/translate_pois.py --dry-run
    python scripts/translate_pois.py
    python scripts/translate_pois.py --languages en --limit 50
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from typing import Any, Dict, List

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_THIS_DIR)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

import llm_client  # noqa: E402
from services import translation_service as ts  # noqa: E402

CHUNK_SIZE = 100
# A chunk where every POI failed means the LLM is unusable (bad key, no
# quota); stop instead of burning through the rest of the catalogue.
MIN_FAILED_TO_ABORT = 10
MAX_ERROR_RATE = 0.05


def _parse_args(argv: List[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--languages", nargs="+", default=sorted(ts.SUPPORTED_LANGUAGES),
                        choices=sorted(ts.SUPPORTED_LANGUAGES))
    parser.add_argument("--limit", type=int, default=0, help="max POIs to translate (0 = all)")
    parser.add_argument("--category", help="only POIs of this category")
    parser.add_argument("--region", help="only POIs of this region")
    parser.add_argument("--concurrency", type=int, default=12, help="POIs translated in parallel")
    parser.add_argument("--rpm", type=int, default=120, help="max LLM calls per minute")
    parser.add_argument("--max-minutes", type=float, default=330, help="stop cleanly after this long")
    parser.add_argument("--dry-run", action="store_true", help="count what is missing, translate nothing")
    args = parser.parse_args(argv)
    if args.concurrency < 1 or args.rpm < 1 or args.limit < 0:
        parser.error("--concurrency and --rpm must be >= 1, --limit >= 0")
    return args


async def _coverage(db, languages: List[str]) -> Dict[str, Dict[str, Any]]:
    total = await db.heritage_items.count_documents({})
    coverage = {}
    for lang in languages:
        done = await db.poi_translations.count_documents({"language": lang})
        coverage[lang] = {"translated": done, "total": total,
                          "pct": round(done / total * 100, 1) if total else 0.0}
    return coverage


def _write_step_summary(stats: Dict[str, Any], coverage: Dict[str, Dict[str, Any]]) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    lines = ["## POI translations", "", f"Outcome: **{stats['outcome']}**", "",
             "| | |", "|---|---|"]
    lines += [f"| {key} | {value} |" for key, value in stats.items() if key != "outcome"]
    lines += ["", "| Language | Translated | Total | Coverage |", "|---|---|---|---|"]
    lines += [f"| {lang} | {c['translated']} | {c['total']} | {c['pct']}% |" for lang, c in coverage.items()]
    with open(path, "a", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


async def run(args: argparse.Namespace) -> int:
    mongo_url = "".join(os.environ.get("MONGO_URL", "").split())
    db_name = os.environ.get("DB_NAME", "portugal_vivo").strip()
    if not mongo_url:
        print("MONGO_URL is not set.", file=sys.stderr)
        return 2
    if not args.dry_run and not llm_client.is_configured():
        print("No LLM key: set OPENAI_API_KEY (or EMERGENT_LLM_KEY).", file=sys.stderr)
        return 2

    ts.MAX_CALLS_PER_MINUTE = args.rpm
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=20000)
    db = client[db_name]
    service = ts.TranslationService(db)

    query: Dict[str, Any] = {}
    if args.category:
        query["category"] = args.category
    if args.region:
        query["region"] = args.region
    projection = {"_id": 0, "id": 1, **{field: 1 for field in ts.TRANSLATABLE_FIELDS}}

    total = await db.heritage_items.count_documents(query)
    print(f"{total} POIs in scope · languages: {' '.join(args.languages)} · "
          f"{'dry run' if args.dry_run else f'{args.concurrency} in parallel, {args.rpm} calls/min'}")

    started = time.monotonic()
    deadline = started + args.max_minutes * 60
    stats: Dict[str, Any] = {"outcome": "completed", "pois_checked": 0, "pois_to_translate": 0,
                             "translations_missing": 0, "translated": 0, "errors": 0, "tokens_estimated": 0}
    semaphore = asyncio.Semaphore(args.concurrency)

    async def translate(item: dict, languages: List[str]) -> Dict[str, Any] | None:
        async with semaphore:
            if time.monotonic() > deadline:
                return None
            return await service.translate_item(item, languages)

    last_id = None
    while True:
        chunk_query = dict(query)
        if last_id is not None:
            chunk_query["id"] = {"$gt": last_id}
        items = await db.heritage_items.find(chunk_query, projection).sort("id", 1).limit(CHUNK_SIZE).to_list(CHUNK_SIZE)
        items = [item for item in items if item.get("id")]
        if not items:
            break
        last_id = items[-1]["id"]

        pending = await service.pending_languages(items, args.languages)
        todo = [item for item in items if pending[item["id"]]]
        if args.limit:
            todo = todo[: max(0, args.limit - stats["pois_to_translate"])]
        stats["pois_checked"] += len(items)
        stats["pois_to_translate"] += len(todo)
        stats["translations_missing"] += sum(len(pending[item["id"]]) for item in todo)

        if not args.dry_run and todo:
            results = await asyncio.gather(*(translate(item, pending[item["id"]]) for item in todo))
            chunk_ok = chunk_failed = 0
            for result in results:
                if result is None:
                    continue
                statuses = [r.get("status") for r in result["results"].values()]
                stats["translated"] += statuses.count("translated")
                stats["errors"] += statuses.count("error")
                stats["tokens_estimated"] += result.get("total_tokens_estimated", 0)
                if "translated" in statuses:
                    chunk_ok += 1
                else:
                    chunk_failed += 1
            elapsed = (time.monotonic() - started) / 60
            print(f"[{elapsed:5.1f} min] {stats['pois_checked']}/{total} POIs checked · "
                  f"{stats['translated']} translations · {stats['errors']} errors", flush=True)
            if chunk_ok == 0 and chunk_failed >= MIN_FAILED_TO_ABORT:
                stats["outcome"] = "aborted: every LLM call in the last batch failed"
                break
            if time.monotonic() > deadline:
                stats["outcome"] = "time budget reached — run again to continue"
                break

        if args.limit and stats["pois_to_translate"] >= args.limit:
            break

    if args.dry_run:
        stats["outcome"] = "dry run"
        stats["estimated_llm_calls"] = stats["pois_to_translate"]

    coverage = await _coverage(db, args.languages)
    client.close()
    print(json.dumps({"stats": stats, "coverage": coverage}, indent=2, ensure_ascii=False))
    _write_step_summary(stats, coverage)

    attempted = stats["translated"] + stats["errors"]
    if stats["outcome"].startswith("aborted"):
        return 1
    if attempted and stats["errors"] / attempted > MAX_ERROR_RATE:
        print(f"Error rate above {MAX_ERROR_RATE:.0%}.", file=sys.stderr)
        return 1
    return 0


def main(argv: List[str] | None = None) -> int:
    return asyncio.run(run(_parse_args(argv)))


if __name__ == "__main__":
    sys.exit(main())
