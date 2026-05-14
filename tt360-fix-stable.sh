#!/usr/bin/env bash
# tt360-fix-stable.sh
# Runs from the project root: /Users/rabiharabi/tiptop360-optimizer
# Usage:
#   bash tt360-fix-stable.sh scan         # find broken timer files (no changes)
#   bash tt360-fix-stable.sh fix          # back up, replace, validate, push to LIVE theme
#   bash tt360-fix-stable.sh fix-dup      # same but pushes to DUPLICATE theme #145031200883 (safer)
#   bash tt360-fix-stable.sh verify       # post-deploy curl check

set -euo pipefail

# --- Config -----------------------------------------------------------------
STORE="${SHOPIFY_STORE:-zrhgzw-xt.myshopify.com}"
LIVE_THEME="143636463731"
DUP_THEME="145031200883"
SNIPPET_NAME="tt360-countdown.liquid"
THEME_DIR="theme-files"
SNIPPET_TARGET="${THEME_DIR}/snippets/${SNIPPET_NAME}"
TS="$(date +%Y%m%d-%H%M%S)"

CMD="${1:-scan}"

# --- Sanity checks ----------------------------------------------------------
if [[ ! -d "${THEME_DIR}" ]]; then
  echo "ERROR: ${THEME_DIR}/ not found. Run from project root." >&2
  exit 1
fi


# --- Locate broken timer ----------------------------------------------------
# Heuristic: files that contain BOTH the static-zero markup AND the
# expired-fallback string. Real working timer never ships both as static text.
find_broken() {
  grep -rln 'This offer has ended' "${THEME_DIR}/snippets/" "${THEME_DIR}/sections/" 2>/dev/null \
    | grep -v '\.bak' \
    | while read -r f; do
        if grep -q 'Days' "$f" && grep -q 'Hours' "$f" && grep -q 'Minutes' "$f"; then
          echo "$f"
        fi
      done
}

# --- The clean snippet body --------------------------------------------------
# This is the byte-for-byte content that will land at SNIPPET_TARGET.
# If you received a separate tt360-countdown.liquid file, copy it here OR
# place it next to this script and uncomment the read-from-file branch below.
write_clean_snippet() {
  local out="$1"
  if [[ -f "./${SNIPPET_NAME}" ]]; then
    cp "./${SNIPPET_NAME}" "$out"
    echo "Copied clean snippet from ./${SNIPPET_NAME}"
  else
    echo "ERROR: ./${SNIPPET_NAME} not found in current dir." >&2
    echo "Place tt360-countdown.liquid alongside this script and re-run." >&2
    exit 1
  fi
}

# --- Liquid balance + corruption checks -------------------------------------
validate_liquid() {
  local f="$1"
  python3 - "$f" <<'PY'
import sys, re
path = sys.argv[1]
src = open(path).read()
opens  = len(re.findall(r'\{%-?\s*(if|for|unless|case|capture|comment|paginate|tablerow|raw|schema|stylesheet|javascript|form)\b', src))
closes = len(re.findall(r'\{%-?\s*(endif|endfor|endunless|endcase|endcapture|endcomment|endpaginate|endtablerow|endraw|endschema|endstylesheet|endjavascript|endform)\b', src))
if opens != closes:
    sys.exit(f"FAIL Liquid balance: opens={opens} closes={closes}")
# Markdown-corruption fingerprint (Liquid identifiers only, NOT Shopify schema URLs)
corruption = re.findall(r'\[[a-z_]+\.[a-z_]+(?:\.[a-z_]+)*\]\(http://[a-z_]+\.[a-z_]+', src)
if corruption:
    sys.exit(f"FAIL markdown corruption: {corruption[:3]}")
print("OK liquid validate")
PY
}

# --- Commands ---------------------------------------------------------------
cmd_scan() {
  echo "Scanning ${THEME_DIR} for broken timer pattern..."
  local files
  files="$(find_broken || true)"
  if [[ -z "${files}" ]]; then
    echo "No file matched. Either timer is OK or pattern is unusual."
    echo "Manual check: grep -rln 'Sale ends in' ${THEME_DIR}/"
    exit 0
  fi
  echo
  echo "Files containing the broken-timer fingerprint:"
  echo "${files}"
  echo
  echo "Next: bash $(basename "$0") fix-dup    # pushes to duplicate theme #${DUP_THEME}"
  echo "Or:   bash $(basename "$0") fix         # pushes to LIVE theme #${LIVE_THEME}"
}

cmd_fix() {
  local target_theme="$1"
  echo "==> Fix mode. Target theme: #${target_theme}"
  if ! command -v shopify >/dev/null 2>&1; then
    echo "ERROR: shopify CLI not in PATH. Install: brew install Shopify/shopify/shopify-cli" >&2
    exit 1
  fi

  # 1. Locate broken files
  local broken
  broken="$(find_broken || true)"
  if [[ -z "${broken}" ]]; then
    echo "No broken-timer file found. Nothing to fix."
    exit 0
  fi
  echo "Files to neutralize (replace inline timer with render of clean snippet):"
  echo "${broken}"

  # 2. Write the clean snippet to its canonical location
  echo
  echo "==> Writing clean snippet -> ${SNIPPET_TARGET}"
  mkdir -p "${THEME_DIR}/snippets"
  if [[ -f "${SNIPPET_TARGET}" ]]; then
    cp "${SNIPPET_TARGET}" "${SNIPPET_TARGET}.PRE-${TS}.bak"
    echo "Backed up existing -> ${SNIPPET_TARGET}.PRE-${TS}.bak"
  fi
  write_clean_snippet "${SNIPPET_TARGET}"
  validate_liquid "${SNIPPET_TARGET}"

  # 3. For each broken file: back up, then replace the inline countdown block
  #    with a render call. We use a Python helper because sed across multiline
  #    Liquid blocks is fragile.
  local files_to_push=("${SNIPPET_TARGET}")
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    cp "$f" "$f.PRE-${TS}.bak"
    echo "Backed up: $f -> $f.PRE-${TS}.bak"
    cp "$f" "$f.before-${TS}"
    python3 - "$f" <<'PY'
import sys, re
path = sys.argv[1]
src = open(path).read()

# Strategy: find the smallest enclosing block that contains BOTH
# "Limited time offer" / "Sale ends in" AND "This offer has ended".
# Replace it with: {%- render 'tt360-countdown', product: product -%}
# We anchor on a heading or the literal "Sale ends in" line, take from there
# to (and including) the line that contains "This offer has ended", plus any
# trailing closing tags on the same logical block.

pat = re.compile(
    r'(?s)'
    r'(?:<[^>]*>\s*)?'                       # optional opening tag wrapper
    r'(?:Limited time offer|Sale ends in)'   # active marker
    r'.*?'
    r'This offer has ended'
    r'.*?'
    r'(?:</[^>]+>\s*){0,4}'                  # up to 4 closing tags after
)
m = pat.search(src)
if not m:
    print("WARN: could not auto-locate timer block; manual edit needed in", path)
    sys.exit(0)

start, end = m.span()
# Try to expand backward to include any wrapping <div> / <section> on the
# same line as "Limited time offer" (heuristic; conservative — only one tag).
backtrack = src.rfind('<', 0, start)
if backtrack != -1 and start - backtrack < 200:
    start = backtrack

replacement = "{%- render 'tt360-countdown', product: product -%}"
new_src = src[:start] + replacement + src[end:]
open(path, 'w').write(new_src)
print(f"Replaced inline timer -> render call in {path}")
PY
    validate_liquid "$f"
    echo
    echo "--- Diff for $f (- removed / + added) ---"
    diff -u "$f.before-${TS}" "$f" || true
    rm -f "$f.before-${TS}"
    echo
    files_to_push+=("$f")
  done <<< "${broken}"

  # 3b. Hard gate before pushing to LIVE
  if [[ "${target_theme}" == "${LIVE_THEME}" ]]; then
    echo
    read -r -p "Push these changes to LIVE theme #${LIVE_THEME}? (yes/no) " ANSWER
    if [[ "${ANSWER}" != "yes" ]]; then
      echo "Aborted. .bak files preserved."
      exit 0
    fi
  fi

  # 4. Push only the changed files
  echo
  echo "==> Pushing to theme #${target_theme}"
  local push_args=()
  for f in "${files_to_push[@]}"; do
    push_args+=(--only "${f#${THEME_DIR}/}")
  done
  if [[ "${target_theme}" == "${LIVE_THEME}" ]]; then
    shopify theme push --store "${STORE}" --theme "${target_theme}" --path "./${THEME_DIR}" "${push_args[@]}" --allow-live
  else
    shopify theme push --store "${STORE}" --theme "${target_theme}" --path "./${THEME_DIR}" "${push_args[@]}"
  fi

  echo
  echo "==> Push complete. Wait 30s then run: bash $(basename "$0") verify"
}

cmd_verify() {
  echo "==> Verifying countdown on live PDPs"
  for url in \
    "https://tiptop360.com/products/ai-voice-recorder?x=$RANDOM" \
    "https://tiptop360.com/products/magnetic-gym-bag-uae?x=$RANDOM"; do
    echo
    echo "URL: $url"
    local body
    body="$(curl -sS -A 'Mozilla/5.0' "$url")"
    if echo "$body" | grep -q 'data-tt-countdown'; then
      echo "  ✅ tt360-countdown rendered"
    else
      echo "  ❌ tt360-countdown NOT found"
    fi
    if echo "$body" | grep -q 'This offer has ended' && echo "$body" | grep -q 'data-tt-ended'; then
      # presence is fine if data-tt-ended carries the [hidden] attr
      if echo "$body" | grep -qE 'data-tt-ended[^>]*hidden'; then
        echo "  ✅ ended-state present but hidden (correct)"
      else
        echo "  ⚠️  ended-state visible without hidden attr — investigate"
      fi
    fi
    # Detect the legacy double-state bug
    if echo "$body" | grep -q 'This offer has ended' && ! echo "$body" | grep -q 'data-tt-countdown'; then
      echo "  ❌ legacy timer still present (no data-tt-countdown attr)"
    fi
  done
}

case "${CMD}" in
  scan)     cmd_scan ;;
  fix)      cmd_fix "${LIVE_THEME}" ;;
  fix-dup)  cmd_fix "${DUP_THEME}" ;;
  verify)   cmd_verify ;;
  *)        echo "Usage: $0 {scan|fix|fix-dup|verify}"; exit 1 ;;
esac
