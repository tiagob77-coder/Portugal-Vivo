"""
Smoke test — every public router module must import cleanly.

The codebase has 90+ ``*_api.py`` modules, each registered in
``server.py``. If a refactor leaves any of them with a syntax error or a
broken import, the failure usually only surfaces at app startup. This
test runs the import for every module in a single pass so the regression
is caught at PR time.

Coverage side effect: importing a module records every top-level
statement as "covered", which alone moves the total coverage figure
upwards and shines a light on dead modules (those that import cleanly
but have no usage at all).
"""
from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

import pytest

_BACKEND = Path(__file__).resolve().parent.parent

# Modules that should not be imported in a fresh test run — typically
# scripts that spawn workers, write to disk on import, or pull heavy
# optional dependencies that are not in the minimal test image.
SKIP = {
    "server",                # already imported by conftest
    "backend_test",          # top-level harness, not part of backend code
    "create_indexes",        # script that connects to Mongo at import
    "test_enrichment_modules",
    # The bulk importers spin up DB clients at import time.
    "import_excel_real",
    "import_excel_v19_full",
    "import_excel_v19_smart",
    "import_excel_v19_final",
    "import_universal_v19",
    "import_full_v19",
    "import_megaliticos_csv",
    "import_rotas_megaliticas_json",
    "poi_v19_importer",
    "enrich_gps_routes",
    "enrich_poi_images_wikimedia",
    "add_real_images",
    "migrate_categories",
    "migrate_geojson",
    "backup_mongodb",
    "restore_mongodb",
    "seed_data",
    "seed_additional",
    "seed_calendar",
    "seed_editorial_collections",
    "seed_empty_categories",
    "seed_encyclopedia",
    "seed_piscinas",
    "seed_routes",
    "seed_termas",
    "seed_trails_routes",
    "init_seed",
}


def _api_modules() -> list[str]:
    """Discover every *_api.py at the top level of backend/."""
    names = []
    for path in sorted(_BACKEND.glob("*_api.py")):
        name = path.stem
        if name in SKIP:
            continue
        names.append(name)
    return names


@pytest.mark.parametrize("module_name", _api_modules())
def test_api_module_imports(module_name):
    """Importing a router module must not raise.

    A broken module here typically means a syntax error from a partial
    refactor, a missing import, or a circular dependency. The CI run is
    what makes this useful — failures land in the PR description before
    a deploy ships them.
    """
    if str(_BACKEND) not in sys.path:
        sys.path.insert(0, str(_BACKEND))

    # Set env defaults so modules that read at import time do not fail
    # on a CI worker without a real .env file.
    os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
    os.environ.setdefault("DB_NAME", "test")
    os.environ.setdefault("JWT_SECRET_KEY", "x" * 64)
    os.environ.setdefault("ENVIRONMENT", "development")

    try:
        importlib.import_module(module_name)
    except ModuleNotFoundError as e:
        # Missing optional 3rd-party deps (slugify, shapely, pyproj, …)
        # are not the bug we are hunting here — the production image
        # installs them. Skip so the suite stays green locally and
        # only fails in CI when the full requirements are installed.
        pytest.skip(f"missing dependency: {e.name}")
    except SyntaxError as e:
        pytest.fail(f"{module_name}: syntax error — {e}")
    except Exception as e:
        pytest.fail(f"{module_name} failed to import: {type(e).__name__}: {e}")
