#!/bin/bash
# TipTop360 — Claude Code on the web SessionStart hook.
# Installs the deploy toolchain (project deps, Shopify CLI, Playwright Chromium)
# and validates the bespoke PDP source, so changes can be tested + deployed to
# the live store within a session. Idempotent and non-interactive. Never hard-
# fails the session: optional installs warn instead of aborting.

set -uo pipefail

# Web sessions only — local runs already have the dev's own tooling.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  echo "session-start: local session, skipping remote toolchain install"
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"
echo "== TipTop360 session setup =="

# 1. Project dependencies (dotenv, node-fetch) — required by deploy-*.cjs.
if [ -f package.json ]; then
  echo "-- npm install"
  npm install --no-audit --no-fund || echo "WARN: npm install failed"
fi

# 2. Shopify CLI — required by deploy-{gymbag,aivox}-pdp.cjs ('shopify theme push').
if command -v shopify >/dev/null 2>&1; then
  echo "-- shopify CLI present ($(shopify version 2>/dev/null | head -n1))"
else
  echo "-- installing @shopify/cli (global)"
  if npm install -g @shopify/cli >/dev/null 2>&1; then
    echo "   shopify CLI installed"
  else
    echo "WARN: shopify CLI install failed (network policy may block npm/install)"
  fi
fi

# 3. Playwright Chromium — for browser-testing the preview/live PDP.
if command -v playwright >/dev/null 2>&1; then
  if [ -d "${HOME}/.cache/ms-playwright" ] && ls "${HOME}/.cache/ms-playwright" 2>/dev/null | grep -qi chromium; then
    echo "-- chromium already cached"
  else
    echo "-- playwright install chromium"
    playwright install chromium >/dev/null 2>&1 && echo "   chromium installed" || echo "WARN: chromium install failed"
  fi
fi

# 4. Validate bespoke PDP source (Liquid balance, JSON-LD, schema JSON, content integrity).
if [ -f scripts/validate-pdp.cjs ]; then
  echo "-- validating PDP source"
  node scripts/validate-pdp.cjs || echo "WARN: PDP validation reported issues (see above)"
fi

# 5. Credentials are user-provided secrets (never committed). Report what's present.
echo "-- deploy credentials:"
if [ -n "${SHOPIFY_STORE:-}" ]; then echo "   SHOPIFY_STORE set (${SHOPIFY_STORE})"; else echo "   MISSING SHOPIFY_STORE — add as an environment secret to enable deploy"; fi
if [ -n "${SHOPIFY_CLI_THEME_TOKEN:-}" ] || [ -n "${SHOPIFY_ACCESS_TOKEN:-}" ]; then echo "   Shopify token set"; else echo "   MISSING Shopify token (SHOPIFY_CLI_THEME_TOKEN or SHOPIFY_ACCESS_TOKEN)"; fi

echo "== setup complete =="
exit 0
