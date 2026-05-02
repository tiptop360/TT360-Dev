#!/bin/bash
# geo-validation-loop.sh — TipTop360 Phase 5 Master Orchestrator
#
# Runs the full GEO/AEO validation pipeline in sequence:
#   Step 1 — Pydantic: structure + entity checks (Python, no API cost)
#   Step 2 — Node: 3-layer validation loop (structural + Pydantic + Claude AI)
#   Step 3 — Regression: extended 64/64 suite + llms.txt + GEO signals
#   Step 4 — Log result + alert on failure
#
# Usage:
#   bash geo-validation-loop.sh               # full pipeline
#   bash geo-validation-loop.sh --skip-ai     # skip Claude API scoring (free)
#   bash geo-validation-loop.sh --ci          # CI mode: no color, exit 1 on any warn
#
# Exit: 0 = pipeline green, 1 = any failure
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT="/Users/rabiharabi/tiptop360-optimizer"
LOG_DIR="${PROJECT}/audits/geo-logs"
TS=$(date +%Y%m%d-%H%M%S)
LOG="${LOG_DIR}/geo-run-${TS}.log"
SKIP_AI=""; [[ "${*:-}" =~ "--skip-ai" ]] && SKIP_AI="--skip-ai"
CI_MODE=0; [[ "${*}" =~ "--ci"     ]] && CI_MODE=1

PASS_COUNT=0; FAIL_COUNT=0
STEP_RESULTS=()

mkdir -p "$LOG_DIR"

# ── Helpers ───────────────────────────────────────────────────────────────────
_step() {
  echo
  echo "┌─────────────────────────────────────────────────────────┐"
  printf  "│  Step %s: %-50s│\n" "$1" "$2"
  echo "└─────────────────────────────────────────────────────────┘"
}

_pass_step() {
  PASS_COUNT=$((PASS_COUNT+1))
  STEP_RESULTS+=("✅ Step $1: $2")
}

_fail_step() {
  FAIL_COUNT=$((FAIL_COUNT+1))
  STEP_RESULTS+=("❌ Step $1: $2")
  echo "  ❌ Step $1 FAILED: $2"
}

log_and_run() {
  # Runs command, tees to log file, returns exit code
  "$@" 2>&1 | tee -a "$LOG"
  return "${PIPESTATUS[0]}"
}

# ─────────────────────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   TipTop360 — GEO/AEO Validation Pipeline               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo "  Project : $PROJECT"
echo "  Log     : $LOG"
echo "  Mode    : ${SKIP_AI:-full (all 3 layers)}"
echo "  Time    : $TS"
echo "" | tee -a "$LOG"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Pydantic validator (standalone, no API)
# ─────────────────────────────────────────────────────────────────────────────
_step 1 "Pydantic: llms.txt structure + entity validation"

cd "$PROJECT"

if python3 validators/llms_txt_validator.py \
    --url "https://tiptop360.com/llms.txt" \
    --no-url-check 2>&1 | tee -a "$LOG"; then
  _pass_step 1 "Pydantic validation PASS"
else
  _fail_step 1 "Pydantic validation FAIL — fix structure before proceeding"
  [[ $CI_MODE -eq 1 ]] && exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Node 3-layer validation loop
# ─────────────────────────────────────────────────────────────────────────────
_step 2 "Node.js: 3-layer validation loop"

if node validate-llms-txt.cjs $SKIP_AI --fix-hints 2>&1 | tee -a "$LOG"; then
  _pass_step 2 "Validation loop PASS"
else
  _fail_step 2 "Validation loop FAIL — see log for layer breakdown"
  [[ $CI_MODE -eq 1 ]] && exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — GEO regression (extended 64/64 + llms.txt)
# ─────────────────────────────────────────────────────────────────────────────
_step 3 "GEO Regression: 9 pages + llms.txt + schema + NAP"

if bash regression-geo.sh 2>&1 | tee -a "$LOG"; then
  _pass_step 3 "All regression checks PASS"
else
  _fail_step 3 "Regression FAIL — do NOT mark Phase 5 complete"
  [[ $CI_MODE -eq 1 ]] && exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Summary + alert
# ─────────────────────────────────────────────────────────────────────────────
echo
echo "┌─────────────────────────────────────────────────────────┐"
echo "│  Pipeline Summary                                        │"
echo "└─────────────────────────────────────────────────────────┘"
for r in "${STEP_RESULTS[@]}"; do echo "  $r"; done
echo "  Pass: $PASS_COUNT / $((PASS_COUNT+FAIL_COUNT))"
echo "  Log : $LOG"

# Save JSON summary for monitoring
SUMMARY_JSON="${LOG_DIR}/latest.json"
cat > "$SUMMARY_JSON" <<EOF
{
  "timestamp": "${TS}",
  "pass": ${PASS_COUNT},
  "fail": ${FAIL_COUNT},
  "status": "$([ $FAIL_COUNT -eq 0 ] && echo PASS || echo FAIL)",
  "log": "${LOG}"
}
EOF

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo
  echo "  ❌ PIPELINE FAILED ($FAIL_COUNT step(s)) — Phase 5 NOT complete"
  echo

  # ── Alert stub (uncomment + fill in your endpoint) ────────────────────────
  # WhatsApp alert via Twilio / your own WA Business API:
  # curl -s -X POST "https://api.twilio.com/..." \
  #   -d "To=whatsapp:+971585156033" \
  #   -d "From=whatsapp:+14155238886" \
  #   -d "Body=🚨 TipTop360 GEO validation FAILED at ${TS} — check ${LOG}" \
  #   -u "$TWILIO_SID:$TWILIO_AUTH" > /dev/null

  exit 1
else
  echo
  echo "  ✅ PIPELINE GREEN — Phase 5 GEO validation complete"
  echo "  → Safe to commit Phase 5 in TIPTOP360_IMPLEMENTATION.md"
  echo "  → Next: run Author schema (node optimizer.js add-author-schema --pages=blog)"
  echo
  exit 0
fi
