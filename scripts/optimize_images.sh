#!/usr/bin/env bash
# optimize_images.sh — shrink heavy app images so the bundle isn't bloated.
#
# Targets the three offenders surfaced by the mobile audit:
#   - Logo PortugalVivo.png  (2.1 MB → ~80 KB)
#   - adaptive-icon.png      (144 KB → ~50 KB)
#   - app-image.png          (148 KB → ~60 KB)
#
# Strategy:
#   1. Lossless first: pngquant (256 colors, quality 65-90).
#   2. If pngquant unavailable, fall back to ImageMagick `convert` with
#      a moderate quality cap.
#   3. Always keep originals at <name>.original.png so the fix is
#      reversible.
#
# Run from the repo root:
#     ./scripts/optimize_images.sh
#
# Optional: cwebp generates WebP siblings for the web bundle (Expo
# bundles PNG for iOS/Android and serves WebP on web when available).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS_DIR="$ROOT_DIR/frontend/assets/images"

if [ ! -d "$ASSETS_DIR" ]; then
  echo "FAIL: $ASSETS_DIR does not exist" >&2
  exit 1
fi

# Files to optimise. Add more here as the asset library grows.
TARGETS=(
  "Logo PortugalVivo.png"
  "adaptive-icon.png"
  "app-image.png"
  "icon.png"
  "splash-image.png"
)

have() { command -v "$1" >/dev/null 2>&1; }

if ! have pngquant && ! have convert && ! have magick; then
  cat <<EOF >&2
FAIL: no image optimiser found. Install one of:

  macOS  : brew install pngquant cwebp
  Ubuntu : sudo apt install -y pngquant webp imagemagick
  Win    : choco install pngquant imagemagick

then rerun this script.
EOF
  exit 1
fi

shrink_one() {
  local file="$1"
  local path="$ASSETS_DIR/$file"
  if [ ! -f "$path" ]; then
    echo "  skip (not found): $file"
    return
  fi

  local backup="${path%.png}.original.png"
  if [ ! -f "$backup" ]; then
    cp "$path" "$backup"
    echo "  backup: $backup"
  fi

  local before
  before=$(stat -c%s "$path" 2>/dev/null || stat -f%z "$path")

  if have pngquant; then
    pngquant --force --skip-if-larger --quality=65-90 --speed 1 \
      --output "$path" "$path" 2>/dev/null || true
  elif have magick; then
    magick "$path" -strip -quality 85 PNG8:"$path"
  elif have convert; then
    convert "$path" -strip -quality 85 PNG8:"$path"
  fi

  local after
  after=$(stat -c%s "$path" 2>/dev/null || stat -f%z "$path")
  local pct=$(( before > 0 ? (100 * (before - after)) / before : 0 ))
  printf "  %-30s  %7d → %7d bytes  (-%d%%)\n" "$file" "$before" "$after" "$pct"

  # Optional WebP for the web bundle.
  if have cwebp; then
    cwebp -quiet -q 80 "$path" -o "${path%.png}.webp"
  fi
}

echo "Optimising heavy images in $ASSETS_DIR"
echo "------------------------------------------------------------"
for f in "${TARGETS[@]}"; do
  shrink_one "$f"
done
echo "------------------------------------------------------------"
echo "Done. Originals preserved as <name>.original.png — keep until"
echo "the next git commit confirms the optimised versions look fine"
echo "in the app, then they can be removed."
