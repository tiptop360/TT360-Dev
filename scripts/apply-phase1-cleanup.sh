#!/usr/bin/env bash
# Apply Phase 1 cleanup: remove the 41 verified-dead assets and push to a theme.
#
# Requires CLI access to be enabled first (see SHOPIFY_CLI_SETUP.md):
#   - network policy allowing accounts.shopify.com / *.myshopify.com / cdn.shopify.com
#   - SHOPIFY_CLI_THEME_TOKEN  (Theme Access token, secret)
#   - SHOPIFY_FLAG_STORE       (e.g. tiptop360.myshopify.com)
#
# Usage:
#   bash scripts/apply-phase1-cleanup.sh [THEME_ID]
# THEME_ID defaults to "Copy of TT360 | Live" (145820614771). Override to target a different theme.
#
# It builds a clean copy of theme-files/ (minus the 41 dead files) and does a full
# `shopify theme push` of that copy, so the dead files are removed on the target theme
# while the repo's theme-files/ mirror stays untouched.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_DIR/theme-files"
BUILD="$REPO_DIR/.phase1-build"
THEME_ID="${1:-145820614771}"   # Copy of TT360 | Live

DEAD_ASSETS=(
  beerslider.css beerslider.js cart-draw.css
  component-card.css component-deferred-media.css component-facets.css
  component-loading-overlay.css component-model-viewer-ui.css component-pagination.css
  component-pickup-availability.css component-predictive-search.css component-product-model.css
  component-rte.css component-search.css component-show-more.css
  facets.js gift-card.js global.js
  photoswipe.css photoswipe.css.liquid photoswipe.s.min.css photoswipe.s.min.css.liquid
  pickup-availability.js predictive-search.js product-model.js product-template.css
  shipping_rate.js show-more.js slide-menu.css template-collection.css
  theme.css theme.css.liquid theme.js theme.s.min.css theme.s.min.css.liquid
  tiny-img-link-preloader.js
  tt360-aos.css tt360-bootstrap-deferred.css tt360-cart-drawer.css tt360-theme.css
  vendor.js
)
# NOTE: details-modal.js is intentionally NOT in this list — it defines the <details-modal>
# element used by header search and must be kept (see PHASE1_PRODUCTION_DEAD_ASSETS.md).

command -v shopify >/dev/null 2>&1 || { echo "ERROR: shopify CLI not installed (run scripts/setup-shopify-cli.sh)"; exit 1; }
[ -n "${SHOPIFY_CLI_THEME_TOKEN:-}" ] || { echo "ERROR: SHOPIFY_CLI_THEME_TOKEN not set"; exit 1; }
[ -n "${SHOPIFY_FLAG_STORE:-}" ]      || { echo "ERROR: SHOPIFY_FLAG_STORE not set"; exit 1; }
[ -d "$SRC" ] || { echo "ERROR: $SRC not found"; exit 1; }

echo "Building clean copy in $BUILD …"
rm -rf "$BUILD"; cp -a "$SRC" "$BUILD"

removed=0
for f in "${DEAD_ASSETS[@]}"; do
  if [ -f "$BUILD/assets/$f" ]; then rm -f "$BUILD/assets/$f"; removed=$((removed+1)); fi
done
echo "Removed $removed/${#DEAD_ASSETS[@]} dead assets from build copy."
echo "Build asset count: $(find "$BUILD/assets" -type f | wc -l)  (mirror: $(find "$SRC/assets" -type f | wc -l))"

echo "Pushing to theme $THEME_ID on $SHOPIFY_FLAG_STORE …"
shopify theme push --path "$BUILD" --theme "$THEME_ID" --store "$SHOPIFY_FLAG_STORE"

echo "Done. Preview the theme, verify header search / PDP / collection filters, then publish manually."
rm -rf "$BUILD"
