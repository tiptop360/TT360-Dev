#!/bin/bash
set -e
cd /Users/rabiharabi/tiptop360-optimizer

echo "=== AUDIT ==="
echo "@font-face blocks:"
grep -rln "@font-face" theme-files/assets/*.css.liquid theme-files/assets/*.scss.liquid 2>/dev/null | head -5
echo ""
echo "@font-face WITHOUT font-display:"
for f in theme-files/assets/*.css.liquid theme-files/assets/*.scss.liquid; do
  [ -f "$f" ] && awk '/@font-face/,/}/' "$f" | grep -q "font-display" || echo "  MISSING in: $f"
done
echo ""
echo "Preconnect count in theme.liquid:"
grep -c "rel=\"preconnect\"\|rel='preconnect'" theme-files/layout/theme.liquid
echo ""
echo "Render-blocking <script> tags (no defer/async) in head:"
awk '/<head>/,/<\/head>/' theme-files/layout/theme.liquid | grep -c "<script src" || echo "0"
echo ""
echo "Images without loading=\"lazy\":"
grep -rln "<img" theme-files/sections theme-files/snippets 2>/dev/null | head -3
