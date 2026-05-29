#!/usr/bin/env bash
# Idempotent Shopify CLI setup for Claude Code (web) sessions.
# Wired to run on SessionStart via .claude/settings.json so the CLI is "always" available.
#
# Requires (configured as ENVIRONMENT secrets/variables — see README/SETUP):
#   SHOPIFY_CLI_THEME_TOKEN  Theme Access token (Shopify admin → "Theme Access" app)
#   SHOPIFY_FLAG_STORE       e.g. tiptop360.myshopify.com
#
# Requires (configured in the ENVIRONMENT's network policy):
#   Outbound access to: accounts.shopify.com, *.myshopify.com, cdn.shopify.com
#
# This script never prints secret values.
set -uo pipefail

echo "[shopify-cli-setup] starting…"

# 1) Install the Shopify CLI if it isn't present (ephemeral containers reinstall per session).
if ! command -v shopify >/dev/null 2>&1; then
  echo "[shopify-cli-setup] installing @shopify/cli…"
  npm install -g @shopify/cli >/dev/null 2>&1 \
    && echo "[shopify-cli-setup] installed: $(shopify version 2>/dev/null)" \
    || echo "[shopify-cli-setup] WARN: install failed (registry reachable?)"
else
  echo "[shopify-cli-setup] already installed: $(shopify version 2>/dev/null)"
fi

# 2) Report credential/config readiness (no values printed).
[ -n "${SHOPIFY_CLI_THEME_TOKEN:-}" ] \
  && echo "[shopify-cli-setup] SHOPIFY_CLI_THEME_TOKEN: set" \
  || echo "[shopify-cli-setup] SHOPIFY_CLI_THEME_TOKEN: MISSING (add as env secret)"
[ -n "${SHOPIFY_FLAG_STORE:-}" ] \
  && echo "[shopify-cli-setup] SHOPIFY_FLAG_STORE: ${SHOPIFY_FLAG_STORE}" \
  || echo "[shopify-cli-setup] SHOPIFY_FLAG_STORE: MISSING (add as env variable, e.g. tiptop360.myshopify.com)"

# 3) Connectivity probe — Shopify must be allowed by the network policy.
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 https://accounts.shopify.com 2>/dev/null || echo "ERR")
if [ "$code" = "403" ] || [ "$code" = "ERR" ]; then
  echo "[shopify-cli-setup] WARN: Shopify unreachable (got '$code'). The environment network policy"
  echo "                    must allow accounts.shopify.com / *.myshopify.com or 'theme push' will fail."
else
  echo "[shopify-cli-setup] Shopify reachable (accounts.shopify.com -> $code)."
fi

echo "[shopify-cli-setup] done."
