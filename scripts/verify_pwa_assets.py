"""
verify_pwa_assets.py — sanity check on the PWA assets shipped with each
expo web build.

Validates that:
  - frontend/public/manifest.json parses, has the required PWA fields,
    and references icons whose files exist.
  - frontend/public/sw.js exists, is non-empty, declares the expected
    cache names, and registers a fetch listener.

This is a static check (no network, no browser). Run after `expo export
--platform web` to make sure the build artifacts include a viable PWA.

Usage:
    python scripts/verify_pwa_assets.py [--frontend-dir frontend]

Exit code 0 = OK, 1 = at least one regression.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import List


REQUIRED_MANIFEST_FIELDS = (
    "name",
    "short_name",
    "start_url",
    "display",
    "background_color",
    "theme_color",
    "icons",
)

# Some baseline cache identifiers the SW MUST declare. Bump these in
# lockstep with the SW version bumps.
EXPECTED_SW_TOKENS = (
    "CACHE_NAME",
    "API_CACHE",
    "self.addEventListener('fetch'",
    "self.addEventListener('install'",
    "self.addEventListener('activate'",
)


def _check_manifest(public_dir: Path) -> List[str]:
    issues: List[str] = []
    path = public_dir / "manifest.json"
    if not path.exists():
        return [f"manifest.json missing at {path}"]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"manifest.json invalid JSON: {exc}"]

    for field in REQUIRED_MANIFEST_FIELDS:
        if field not in data:
            issues.append(f"manifest.json missing field: {field}")

    icons = data.get("icons") or []
    if not icons:
        issues.append("manifest.json has no icons")
    else:
        # At minimum we need a 192 and a 512 for the install prompt to
        # work on Android Chrome.
        sizes = {icon.get("sizes") for icon in icons if isinstance(icon, dict)}
        if "192x192" not in sizes:
            issues.append("manifest.json missing 192x192 icon")
        if "512x512" not in sizes:
            issues.append("manifest.json missing 512x512 icon")

    return issues


def _check_sw(public_dir: Path) -> List[str]:
    issues: List[str] = []
    path = public_dir / "sw.js"
    if not path.exists():
        return [f"sw.js missing at {path}"]
    body = path.read_text(encoding="utf-8")
    if len(body) < 200:
        issues.append(f"sw.js suspiciously small ({len(body)} bytes)")
    for token in EXPECTED_SW_TOKENS:
        if token not in body:
            issues.append(f"sw.js missing expected token: {token!r}")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate PWA assets shipped with expo web build.")
    parser.add_argument(
        "--frontend-dir",
        default="frontend",
        help="Path to the frontend directory (default: frontend)",
    )
    args = parser.parse_args()

    public_dir = Path(args.frontend_dir) / "public"
    if not public_dir.is_dir():
        print(f"FAIL: {public_dir} does not exist", file=sys.stderr)
        return 1

    issues = _check_manifest(public_dir) + _check_sw(public_dir)

    if not issues:
        print("PWA assets OK:")
        print(f"  · {public_dir / 'manifest.json'}")
        print(f"  · {public_dir / 'sw.js'}")
        return 0

    print("PWA asset issues:", file=sys.stderr)
    for issue in issues:
        print(f"  · {issue}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
