#!/usr/bin/env bash
# tt360-remove-timer.sh
# Removes the broken countdown timer from AiVox and GymBag PDPs.
# Run from /Users/rabiharabi/tiptop360-optimizer
#
# Strategy (in order of cleanliness):
#   A) JSON template removal — if timer is added as a section in product.*.json
#   B) Liquid block comment-out — if timer is hardcoded inline in a section file
#   C) Manual Theme Editor — if timer comes from an app embed (script will tell you)
#
# Usage:
#   bash tt360-remove-timer.sh scan        # report only, no changes
#   bash tt360-remove-timer.sh remove-dup  # apply + push to duplicate theme
#   bash tt360-remove-timer.sh remove      # apply + push to LIVE theme (asks confirm)
#   bash tt360-remove-timer.sh restore     # restore most recent .bak files
#   bash tt360-remove-timer.sh verify      # curl both PDPs, confirm timer absent

set -euo pipefail

STORE="${SHOPIFY_STORE:-zrhgzw-xt.myshopify.com}"
LIVE_THEME="143636463731"
DUP_THEME="145031200883"
THEME_DIR="theme-files"
TS="$(date +%Y%m%d-%H%M%S)"
CMD="${1:-scan}"

if [[ ! -d "${THEME_DIR}" ]]; then
  echo "ERROR: ${THEME_DIR}/ not found. Run from project root." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# DETECTION
# ---------------------------------------------------------------------------

# Patterns the timer section TYPE might match in section JSON
TYPE_PATTERN='timer|countdown|urgency|limited.time|sale.ends|offer.ends|ends.in|count.down'

# Patterns the rendered HTML uses (helps locate hardcoded liquid)
TEXT_PATTERNS=(
  'Limited time offer'
  'Sale ends in'
  'Hurry!'
  'offer has ended'
  'This offer'
)

# Find timer sections in product.*.json templates
find_timer_in_json() {
  python3 - "${THEME_DIR}" "${TYPE_PATTERN}" <<'PY'
import json, re, sys
from pathlib import Path
root = Path(sys.argv[1]) / "templates"
pat = re.compile(sys.argv[2], re.I)
if not root.is_dir():
    sys.exit(0)
for tpl in sorted(root.glob("product*.json")):
    try:
        data = json.loads(tpl.read_text())
    except Exception as e:
        print(f"WARN: {tpl} not parseable ({e})", file=sys.stderr)
        continue
    secs = data.get("sections", {})
    hits = []
    for sec_id, sec in secs.items():
        stype = sec.get("type", "") if isinstance(sec, dict) else ""
        if pat.search(stype):
            hits.append((sec_id, stype))
    if hits:
        for sec_id, stype in hits:
            print(f"{tpl}\t{sec_id}\t{stype}")
PY
}

# Find timer markup hardcoded in section/snippet liquid files
# Excludes .bak, .before-*, .PRE-* (transient files from prior runs)
# Excludes files already containing the TT360 TIMER REMOVED marker (idempotent)
find_timer_in_liquid() {
  local files=()
  for needle in "${TEXT_PATTERNS[@]}"; do
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      [[ "$f" == *.bak ]] && continue
      [[ "$f" == *.before-* ]] && continue
      [[ "$f" == *.PRE-* ]] && continue
      # Skip already-neutralized files
      if grep -q 'TT360 TIMER REMOVED' "$f" 2>/dev/null; then continue; fi
      files+=("$f")
    done < <(grep -rln -F "$needle" "${THEME_DIR}/sections/" "${THEME_DIR}/snippets/" 2>/dev/null || true)
  done
  printf '%s\n' "${files[@]}" | sort -u | grep -v '^$' || true
}

# ---------------------------------------------------------------------------
# REMOVAL
# ---------------------------------------------------------------------------

remove_section_from_json() {
  local tpl="$1" sec_id="$2"
  cp "$tpl" "$tpl.PRE-${TS}.bak"
  python3 - "$tpl" "$sec_id" <<'PY'
import json, sys
tpl, sec_id = sys.argv[1], sys.argv[2]
data = json.loads(open(tpl).read())
secs = data.get("sections", {})
if sec_id in secs:
    del secs[sec_id]
order = data.get("order", [])
data["order"] = [s for s in order if s != sec_id]
open(tpl, "w").write(json.dumps(data, indent=2))
print(f"  Removed section '{sec_id}' from {tpl}")
PY
}

# Decide if a file is a "dedicated timer file" (timer is its sole purpose)
# vs a "multi-purpose file with inline timer" (timer is one block among many).
#
# Primary signal: filename. Files whose NAME indicates timer/countdown purpose
# are dedicated. Files named like *-pdp.liquid, main-*.liquid, product-*.liquid
# are NEVER dedicated regardless of size.
#
# Secondary signal (only if filename is ambiguous): tiny file with very high
# concentration of timer keywords.
#
# Returns 0 (true) if dedicated, 1 (false) otherwise.
is_dedicated_timer_file() {
  local f="$1"
  local base
  base="$(basename "$f")"

  # Negative-list: NEVER classify these as dedicated, even if they're short
  case "$base" in
    *-pdp.liquid|*pdp*.liquid|main-*.liquid|product-*.liquid|product.liquid|theme.liquid)
      return 1 ;;
  esac

  # Positive-list: filename clearly indicates timer-only purpose
  case "$base" in
    *countdown*|*timer*|*urgency*|*limited-time*|*sale-ends*|*offer-ends*)
      return 0 ;;
  esac

  # Fallback heuristic for ambiguous filenames: very small + high concentration
  python3 - "$f" <<'PY'
import sys, re
p = sys.argv[1]
src = open(p).read()
size = len(src)
if size > 1500:
    sys.exit(1)
keywords = ['Limited time offer', 'Sale ends in', 'Hurry!', 'offer has ended']
hits = sum(len(re.findall(re.escape(k), src, re.I)) for k in keywords)
if hits >= 3 and size < 1500:
    sys.exit(0)
sys.exit(1)
PY
}

# Wrap the entire file body (excluding any {% schema %} block at the bottom)
# in a Liquid {% comment %} ... {% endcomment %}. This is safe because Shopify
# parses {% schema %} independently of rendered output.
neutralize_dedicated_file() {
  local f="$1"
  cp "$f" "$f.PRE-${TS}.bak"
  python3 - "$f" <<'PY'
import re, sys
path = sys.argv[1]
src = open(path).read()
# Locate {% schema %} block (Shopify section schema, must be preserved)
schema_match = re.search(r'\{%-?\s*schema\s*-?%\}.*?\{%-?\s*endschema\s*-?%\}', src, re.S)
if schema_match:
    body = src[:schema_match.start()].rstrip()
    schema = src[schema_match.start():]
else:
    body = src.rstrip()
    schema = ''
new_src = (
    "{%- comment -%} TT360 TIMER REMOVED " + path + " on " +
    __import__('time').strftime('%Y-%m-%d') + " {%- endcomment -%}\n" +
    "{%- comment -%}\n" + body + "\n{%- endcomment -%}\n" +
    (schema if schema else '')
)
open(path, 'w').write(new_src)
print(f"  Wrapped entire body of {path} in a Liquid comment (schema preserved if present)")
PY
}

# Print instructions for files where the timer is inline among other content
# (do not auto-edit — risk of breaking sibling content).
print_inline_instructions() {
  local f="$1"
  echo "  ⚠️  ${f} contains the timer but also other content."
  echo "      Manual edit required. Open the file and find these lines:"
  grep -n -E 'Limited time offer|Sale ends in|Hurry!|offer has ended' "$f" | sed 's/^/        /'
  echo "      Wrap the timer block (and its surrounding container element)"
  echo "      with Liquid comments:"
  echo "          {%- comment -%}"
  echo "          ...timer markup...                    "
  echo "          {%- endcomment -%}"
  echo "      Then re-run: bash $(basename "$0") remove-dup"
}

# ---------------------------------------------------------------------------
# VALIDATION
# ---------------------------------------------------------------------------

validate_json() {
  local f="$1"
  python3 -c "import json,sys; json.load(open('$f'))" \
    || { echo "FAIL JSON syntax: $f"; return 1; }
  echo "  OK json: $f"
}

validate_liquid() {
  local f="$1"
  python3 - "$f" <<'PY'
import sys, re
src = open(sys.argv[1]).read()
opens = len(re.findall(r'\{%-?\s*(if|for|unless|case|capture|comment|raw|schema|stylesheet|javascript|form|paginate|tablerow)\b', src))
closes = len(re.findall(r'\{%-?\s*(endif|endfor|endunless|endcase|endcapture|endcomment|endraw|endschema|endstylesheet|endjavascript|endform|endpaginate|endtablerow)\b', src))
if opens != closes:
    sys.exit(f"FAIL Liquid balance in {sys.argv[1]}: opens={opens} closes={closes}")
print(f"  OK liquid: {sys.argv[1]}")
PY
}

# ---------------------------------------------------------------------------
# COMMANDS
# ---------------------------------------------------------------------------

cmd_scan() {
  echo "=== A) Timer sections found in JSON templates ==="
  local json_hits
  json_hits="$(find_timer_in_json || true)"
  if [[ -n "${json_hits}" ]]; then
    echo "${json_hits}" | awk -F'\t' '{ printf "  %s\n     section_id=%s  type=%s\n", $1, $2, $3 }'
  else
    echo "  (none — timer is NOT a JSON template section)"
  fi

  echo
  echo "=== B) Timer markup found in section/snippet liquid files ==="
  local liq_hits
  liq_hits="$(find_timer_in_liquid)"
  if [[ -n "${liq_hits}" ]]; then
    while IFS= read -r f; do
      echo "  ${f}"
      grep -nE 'Limited time offer|Sale ends in|Hurry!|offer has ended' "$f" | head -3 | sed 's/^/      /'
    done <<< "${liq_hits}"
  else
    echo "  (none)"
  fi

  echo
  echo "=== C) If both A and B are empty ==="
  echo "  The timer is rendered by an APP embed. Remove via:"
  echo "  Shopify Admin -> Online Store -> Themes -> Customize -> App embeds"
  echo "  panel (left side) -> toggle off the countdown/timer/urgency app."
  echo
  echo "Next:"
  echo "  bash $(basename "$0") remove-dup    # apply + push to DUPLICATE theme #${DUP_THEME}"
  echo "  bash $(basename "$0") remove        # apply + push to LIVE theme #${LIVE_THEME}"
}

cmd_remove() {
  local target_theme="$1"
  if ! command -v shopify >/dev/null 2>&1; then
    echo "ERROR: shopify CLI not in PATH." >&2; exit 1
  fi

  # Always clean up transient .before-* files on exit
  trap 'find "${THEME_DIR}" -name "*.before-*" -delete 2>/dev/null || true' EXIT

  local changed=()

  echo "==> A) Removing timer sections from JSON templates"
  local json_hits
  json_hits="$(find_timer_in_json || true)"
  if [[ -n "${json_hits}" ]]; then
    while IFS=$'\t' read -r tpl sec_id stype; do
      [[ -z "${tpl}" ]] && continue
      echo "  -> ${tpl}: removing section_id=${sec_id} type=${stype}"
      remove_section_from_json "${tpl}" "${sec_id}"
      validate_json "${tpl}"
      changed+=("${tpl}")
    done <<< "${json_hits}"
  else
    echo "  (no JSON-template timer sections found)"
  fi

  echo
  echo "==> B) Removing dedicated timer files / flagging inline timers"
  local liq_hits
  liq_hits="$(find_timer_in_liquid)"
  if [[ -n "${liq_hits}" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      echo "  -> ${f}"
      if is_dedicated_timer_file "$f"; then
        echo "     (dedicated timer file detected — wrapping body in Liquid comment)"
        cp "$f" "$f.before-${TS}"
        neutralize_dedicated_file "$f"
        echo "     Diff:"
        ( diff -u "$f.before-${TS}" "$f" || true ) | head -30 | sed 's/^/       /'
        rm -f "$f.before-${TS}"
        validate_liquid "$f"
        changed+=("$f")
      else
        print_inline_instructions "$f"
      fi
    done <<< "${liq_hits}"
  else
    echo "  (no liquid files contain timer text)"
  fi

  if [[ ${#changed[@]} -eq 0 ]]; then
    echo
    echo "Nothing changed. Timer must be from an app embed. See scan output for next steps."
    exit 0
  fi

  echo
  echo "==> Files changed:"
  printf '  %s\n' "${changed[@]}"

  if [[ "${target_theme}" == "${LIVE_THEME}" ]]; then
    echo
    read -r -p "Push these changes to LIVE theme #${LIVE_THEME}? (yes/no) " ANSWER
    if [[ "${ANSWER}" != "yes" ]]; then
      echo "Aborted. .bak files preserved. Run 'restore' to undo."
      exit 0
    fi
  fi

  # Build push args — strip the theme-files/ prefix
  local push_args=()
  for f in "${changed[@]}"; do
    push_args+=(--only "${f#"${THEME_DIR}/"}")
  done

  echo
  echo "==> Pushing to theme #${target_theme}"
  if [[ "${target_theme}" == "${LIVE_THEME}" ]]; then
    shopify theme push --store "${STORE}" --theme "${target_theme}" --path "./${THEME_DIR}" "${push_args[@]}" --allow-live
  else
    shopify theme push --store "${STORE}" --theme "${target_theme}" --path "./${THEME_DIR}" "${push_args[@]}"
  fi

  echo
  echo "==> Done. Wait 30s then run: bash $(basename "$0") verify"
}

cmd_restore() {
  echo "Restoring most recent .bak files..."
  find "${THEME_DIR}" -name "*.PRE-*.bak" 2>/dev/null | while read -r bak; do
    orig="${bak%.PRE-*.bak}"
    cp "$bak" "$orig"
    echo "  Restored: $orig"
  done
  echo "Done. Re-push to apply restoration:"
  echo "  shopify theme push --store ${STORE} --theme ${DUP_THEME} --path ./${THEME_DIR}"
}

cmd_verify() {
  echo "==> Verifying timer absence on live PDPs"
  for url in \
    "https://tiptop360.com/products/ai-voice-recorder?x=$RANDOM" \
    "https://tiptop360.com/products/magnetic-gym-bag-uae?x=$RANDOM"; do
    echo
    echo "URL: $url"
    body="$(curl -sS -A 'Mozilla/5.0' "$url")"
    local pass=true
    for needle in 'Limited time offer' 'Sale ends in' 'offer has ended'; do
      if echo "$body" | grep -q -F "$needle"; then
        echo "  ❌ still contains: $needle"
        pass=false
      else
        echo "  ✅ absent: $needle"
      fi
    done
    if $pass; then echo "  RESULT: timer removed"; else echo "  RESULT: incomplete"; fi
  done
}

case "${CMD}" in
  scan)        cmd_scan ;;
  remove-dup)  cmd_remove "${DUP_THEME}" ;;
  remove)      cmd_remove "${LIVE_THEME}" ;;
  restore)     cmd_restore ;;
  verify)      cmd_verify ;;
  *)           echo "Usage: $0 {scan|remove-dup|remove|restore|verify}"; exit 1 ;;
esac
