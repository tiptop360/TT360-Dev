#!/usr/bin/env bash
# Build a Shopify-importable theme ZIP from a source directory.
# The theme folders (assets/, config/, layout/, …) are placed at the ZIP root,
# which is what themeCreate / `shopify theme` expect.
#
# Usage:
#   scripts/build-theme-zip.sh [SRC_DIR] [OUT_ZIP] [--exclude-dead]
# Defaults: SRC_DIR=theme-files  OUT_ZIP=dist/theme.zip
#   --exclude-dead  omit the Phase 1 dead assets (see PHASE1_PRODUCTION_DEAD_ASSETS.md)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${1:-$REPO_DIR/theme-files}"
OUT="${2:-$REPO_DIR/dist/theme.zip}"
EXCLUDE_DEAD="${3:-}"

[ -d "$SRC" ] || { echo "ERROR: source dir $SRC not found"; exit 1; }
command -v zip >/dev/null || { echo "ERROR: zip not installed"; exit 1; }

DEAD_ASSETS=(
  beerslider.css beerslider.js cart-draw.css component-card.css component-deferred-media.css
  component-facets.css component-loading-overlay.css component-model-viewer-ui.css
  component-pagination.css component-pickup-availability.css component-predictive-search.css
  component-product-model.css component-rte.css component-search.css component-show-more.css
  facets.js gift-card.js global.js photoswipe.css photoswipe.css.liquid photoswipe.s.min.css
  photoswipe.s.min.css.liquid pickup-availability.js predictive-search.js product-model.js
  product-template.css shipping_rate.js show-more.js slide-menu.css template-collection.css
  theme.css theme.css.liquid theme.js theme.s.min.css theme.s.min.css.liquid
  tiny-img-link-preloader.js tt360-aos.css tt360-bootstrap-deferred.css tt360-cart-drawer.css
  tt360-theme.css vendor.js
)  # details-modal.js is NOT here — it is required (header search).

BUILD="$(mktemp -d)"
cp -a "$SRC/." "$BUILD/"

if [ "$EXCLUDE_DEAD" = "--exclude-dead" ]; then
  removed=0
  for f in "${DEAD_ASSETS[@]}"; do
    [ -f "$BUILD/assets/$f" ] && { rm -f "$BUILD/assets/$f"; removed=$((removed+1)); }
  done
  echo "Excluded $removed dead asset(s)."
fi

mkdir -p "$(dirname "$OUT")"; rm -f "$OUT"
OUT="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"   # absolutize before cd
( cd "$BUILD" && zip -r -q -X "$OUT" . )
rm -rf "$BUILD"
echo "Built $OUT  ($(unzip -l "$OUT" | tail -1 | awk '{print $2}') entries, $(du -h "$OUT" | cut -f1))"
