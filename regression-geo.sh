#!/opt/homebrew/bin/bash
# regression-geo.sh — TipTop360 Phase 5 GEO Regression Suite
#
# Extends regression_test.sh (9 pages, 64/64) with:
#   - llms.txt as 10th critical URL (structural + content)
#   - GEO signal spot-checks on top 3 product pages
#   - Schema signal checks (ld+json present)
#   - Author schema check on blog posts
#   - NAP consistency check (name, address, phone)
#
# Usage:
#   bash regression-geo.sh                    # full suite
#   bash regression-geo.sh --llms-only        # only llms.txt checks
#   bash regression-geo.sh --geo-only         # only page GEO checks
#   bash regression-geo.sh --quiet            # suppress passing lines
#
# Exit: 0 = all pass, 1 = any failure
# ─────────────────────────────────────────────────────────────────────────────

set -e

BASE_URL="https://tiptop360.com"
STORE_URL="https://zrhgzw-xt.myshopify.com"
LLMS_URL="${BASE_URL}/llms.txt"
QUIET=${QUIET:-0}
[[ "${*:-}" =~ "--quiet" ]] && QUIET=1

LLMS_ONLY=0; [[ "${*:-}" =~ "--llms-only" ]] && LLMS_ONLY=1
GEO_ONLY=0;  [[ "${*}" =~ "--geo-only"  ]] && GEO_ONLY=1

PASS=0; FAIL=0; WARN=0
FAILURES=()

# ── Helpers ───────────────────────────────────────────────────────────────────
_pass() { PASS=$((PASS+1)); [[ $QUIET -eq 0 ]] && echo "  ✅ $1"; }
_warn() { WARN=$((WARN+1)); echo "  ⚠️  WARN: $1"; }
_fail() { FAIL=$((FAIL+1)); FAILURES+=("$1"); echo "  ❌ FAIL: $1"; }
_head() { echo; echo "━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

fetch() {
  # Usage: fetch <url> [--follow]
  local url="$1"
  local extra="${2:-}"
  if [[ $extra == "--follow" ]]; then
    curl -sf -L --max-time 10 --user-agent "TipTop360-Regression/1.0" "$url"
  else
    curl -sf --max-time 10 --user-agent "TipTop360-Regression/1.0" "$url"
  fi
}

http_status() {
  curl -o /dev/null -s -w "%{http_code}" --max-time 10 \
    --user-agent "TipTop360-Regression/1.0" "$1"
}

# ─────────────────────────────────────────────────────────────────────────────
# BLOCK A — Original 9-Page Regression (pass-through from regression_test.sh)
# ─────────────────────────────────────────────────────────────────────────────
if [[ $LLMS_ONLY -eq 0 ]]; then
  _head "A: Core Pages (original 64/64 suite)"

  declare -A PAGES=(
    ["Homepage"]="/"
    ["KidsCollection"]="/collections/kids-collection-uae"
    ["Toothbrush"]="/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift"
    ["AiVox"]="/products/ai-voice-recorder"
    ["GymBag"]="/products/magnetic-gym-bag-uae-gymgear-tiptop360"
    ["ColorPencils"]="/products/color-pencils"
    ["About"]="/pages/about-tiptop360"
    ["Cart"]="/cart"
    ["Sitemap"]="/sitemap.xml"
  )

  for name in "${!PAGES[@]}"; do
    path="${PAGES[$name]}"
    url="${BASE_URL}${path}?x=$RANDOM"

    # 200 status
    status=$(http_status "$url")
    if [[ "$status" != "200" ]] && [[ "$status" != "301" ]] && [[ "$status" != "302" ]]; then
      _fail "$name: HTTP $status (expected 200)"
      continue
    fi

    html=$(fetch "$url" 2>/dev/null || true)

    # Liquid errors
    if echo "$html" | grep -q "Liquid error"; then
      _fail "$name: Liquid render error found"
    else
      _pass "$name: HTTP 200, no Liquid errors"
    fi

    # Malware patterns
    if echo "$html" | grep -qE "fv-loading-icon|component-3\.0|githubfix|data:text/css;base64"; then
      _fail "$name: Malware pattern detected"
    else
      _pass "$name: Clean (no malware)"
    fi
  done
fi

# ─────────────────────────────────────────────────────────────────────────────
# BLOCK B — llms.txt (new 10th critical URL)
# ─────────────────────────────────────────────────────────────────────────────
if [[ $GEO_ONLY -eq 0 ]]; then
  _head "B: llms.txt (10th Critical URL)"

  status=$(http_status "$LLMS_URL")
  if [[ "$status" != "200" ]] && [[ "$status" != "301" ]] && [[ "$status" != "302" ]]; then
    _fail "llms.txt: HTTP $status — app may not have published it"
  else
    _pass "llms.txt: HTTP 200"
    LLMS=$(fetch "$LLMS_URL" --follow 2>/dev/null || true)
    LLMS_BYTES=${#LLMS}

    # Size
    if [[ $LLMS_BYTES -lt 500 ]]; then
      _fail "llms.txt: Too small ($LLMS_BYTES bytes) — empty file"
    elif [[ $LLMS_BYTES -gt 100000 ]]; then
      _fail "llms.txt: Too large ($LLMS_BYTES bytes) — exceeds 100KB limit"
    else
      _pass "llms.txt: Size OK ($LLMS_BYTES bytes)"
    fi

    # Title line
    if echo "$LLMS" | grep -qE "^# .*(TipTop360|tiptop360)"; then
      _pass "llms.txt: Brand title present"
    else
      _fail "llms.txt: Missing '# TipTop360' title line"
    fi

    # Description line
    if echo "$LLMS" | grep -qE "^> .{80,}"; then
      _pass "llms.txt: Description ≥80 chars present"
    else
      _warn "llms.txt: Description missing or too short (< 80 chars)"
    fi

    # Sections
    SECTION_COUNT=$(echo "$LLMS" | grep -cE "^## " || true)
    if [[ $SECTION_COUNT -ge 2 ]]; then
      _pass "llms.txt: $SECTION_COUNT sections found"
    else
      _fail "llms.txt: Only $SECTION_COUNT section(s) — need ≥2"
    fi

    # Required entity signals
    for signal in "TipTop360" "UAE" "Dubai" "delivery" "tiptop360.com"; do
      if echo "$LLMS" | grep -qi "$signal"; then
        _pass "llms.txt: Entity '$signal' present"
      else
        _fail "llms.txt: Required entity '$signal' MISSING"
      fi
    done

    # Required product handles
    for handle in \
      "kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift" \
      "ai-voice-recorder"; do
      if echo "$LLMS" | grep -q "$handle"; then
        _pass "llms.txt: Handle '$handle' present"
      else
        _fail "llms.txt: Priority handle MISSING: $handle"
      fi
    done

    # Internal URL count
    IURL_COUNT=$(echo "$LLMS" | grep -oE "\(https://tiptop360\.com[^)]+\)" | wc -l | tr -d ' ')
    if [[ $IURL_COUNT -ge 5 ]]; then
      _pass "llms.txt: $IURL_COUNT internal URLs"
    else
      _warn "llms.txt: Only $IURL_COUNT internal URLs — recommend ≥10"
    fi

    # No Liquid errors in file
    if echo "$LLMS" | grep -q "Liquid error"; then
      _fail "llms.txt: Liquid render error in content"
    else
      _pass "llms.txt: No Liquid errors"
    fi

    # Spot-check first 3 internal URLs are reachable
    FIRST_URLS=$(echo "$LLMS" | grep -oE "https://tiptop360\.com/[^)]+" | head -3)
    while IFS= read -r u; do
      if [[ -z "$u" ]]; then continue; fi
      s=$(http_status "$u")
      if [[ "$s" == "200" ]] || [[ "$s" == "301" ]] || [[ "$s" == "302" ]]; then
        _pass "llms.txt URL reachable: $u ($s)"
      else
        _fail "llms.txt URL broken: $u (HTTP $s)"
      fi
    done <<< "$FIRST_URLS"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# BLOCK C — GEO Signal Checks (top 3 product pages)
# ─────────────────────────────────────────────────────────────────────────────
if [[ $LLMS_ONLY -eq 0 ]]; then
  _head "C: GEO Signal Checks (top 3 product PDPs)"

  declare -A GEO_PAGES=(
    ["Toothbrush"]="/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift"
    ["AiVox"]="/products/ai-voice-recorder"
    ["GymBag"]="/products/magnetic-gym-bag-uae-gymgear-tiptop360"
  )

  for name in "${!GEO_PAGES[@]}"; do
    path="${GEO_PAGES[$name]}"
    url="${BASE_URL}${path}?x=$RANDOM"
    html=$(fetch "$url" 2>/dev/null || true)

    # Schema: ld+json present
    if echo "$html" | grep -q "application/ld+json"; then
      _pass "$name: JSON-LD schema present"
    else
      _fail "$name: No JSON-LD schema found"
    fi

    # UAE geo signal in body
    if echo "$html" | grep -qi "UAE\|Dubai\|Emirates"; then
      _pass "$name: UAE geo signal in body"
    else
      _warn "$name: No UAE geo signal in body"
    fi

    # Trust band CSS class
    if echo "$html" | grep -q "cro-trust-band"; then
      _pass "$name: Trust band live"
    else
      _fail "$name: Trust band CSS class missing"
    fi

    # Risk reversal
    if echo "$html" | grep -q "cro-risk-reversal"; then
      _pass "$name: Risk reversal live"
    else
      _fail "$name: Risk reversal CSS class missing"
    fi

    # Rating badge
    if echo "$html" | grep -q "cro-rating-badge\|judgeme\|reviews\.rating"; then
      _pass "$name: Rating signal present"
    else
      _warn "$name: No rating badge signal found"
    fi
  done

  # ─────────────────────────────────────────────────────────────────────────
  # BLOCK D — Schema Spot-Checks
  # ─────────────────────────────────────────────────────────────────────────
  _head "D: Schema Spot-Checks"

  TB_URL="${BASE_URL}/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=$RANDOM"
  TB_HTML=$(fetch "$TB_URL" 2>/dev/null || true)

  # Product schema type
  if echo "$TB_HTML" | grep -q '"@type":"Product"\|"@type": "Product"'; then
    _pass "Toothbrush: Product schema type present"
  else
    _warn "Toothbrush: Product @type not confirmed — verify JSON-LD manually"
  fi

  # FAQPage schema
  if echo "$TB_HTML" | grep -q '"@type":"FAQPage"\|"@type": "FAQPage"'; then
    _pass "Toothbrush: FAQPage schema present"
  else
    _warn "Toothbrush: FAQPage schema not found — run: node optimizer.js apply faq-schema --execute"
  fi

  # AggregateRating
  if echo "$TB_HTML" | grep -q '"AggregateRating"\|"aggregateRating"'; then
    _pass "Toothbrush: AggregateRating schema present"
  else
    _warn "Toothbrush: AggregateRating not found — Judge.me propagation may lag 24h"
  fi

  # Organization schema on homepage
  HP_HTML=$(fetch "${BASE_URL}/?x=$RANDOM" 2>/dev/null || true)
  if echo "$HP_HTML" | grep -q '"@type":"Organization"\|"@type": "Organization"'; then
    _pass "Homepage: Organization schema present"
  else
    _warn "Homepage: Organization schema not confirmed"
  fi

  # Sitemap reachable
  if fetch "${BASE_URL}/sitemap.xml" > /dev/null 2>&1; then
    _pass "Sitemap: reachable"
  else
    _fail "Sitemap: not reachable"
  fi

  # ─────────────────────────────────────────────────────────────────────────
  # BLOCK E — NAP Consistency
  # ─────────────────────────────────────────────────────────────────────────
  _head "E: NAP Consistency (Name + Phone)"

  ABOUT_HTML=$(fetch "${BASE_URL}/pages/about-tiptop360?x=$RANDOM" 2>/dev/null || true)

  if echo "$ABOUT_HTML" | grep -q "TipTop360\|Tiptop360"; then
    _pass "About page: Brand name present"
  else
    _warn "About page: Brand name not found in body"
  fi

  if echo "$ABOUT_HTML" | grep -q "971\|+971"; then
    _pass "About page: Phone number (+971) present"
  else
    _warn "About page: UAE phone number not found — NAP consistency risk"
  fi

  if echo "$ABOUT_HTML" | grep -qi "UAE\|Dubai\|Emirates\|Ras Al Khaimah\|RAK"; then
    _pass "About page: Location signal present"
  else
    _warn "About page: No location signal — affects Local SEO"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# FINAL SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
echo
echo "━━━ Regression Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PASS  : $PASS"
echo "  WARN  : $WARN"
echo "  FAIL  : $FAIL"

if [[ $FAIL -gt 0 ]]; then
  echo
  echo "  Failed checks:"
  for f in "${FAILURES[@]}"; do
    echo "    ❌ $f"
  done
  echo
  echo "  ❌ REGRESSION FAILED — do not mark Phase 5 complete"
  exit 1
else
  echo
  if [[ $WARN -gt 0 ]]; then
    echo "  ✅ ALL CHECKS PASSED ($WARN warning(s) — review above)"
  else
    echo "  ✅ ALL CHECKS PASSED — Phase 5 GEO regression clean"
  fi
  exit 0
fi
