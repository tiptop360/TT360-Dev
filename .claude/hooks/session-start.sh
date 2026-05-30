#!/bin/bash
# SessionStart hook for TT360-Dev
# Installs npm dependencies and the Playwright Chromium browser ("Agent Browser")
# so the audit / pagespeed / automation scripts can launch a browser.
#
# Why this is more than `npx playwright install`:
# In the Claude Code on the web sandbox the Playwright CDN (cdn.playwright.dev)
# is NOT on the network allowlist, so the normal browser download fails with
# "403 Host not in allowlist". Google's Chrome for Testing bucket
# (storage.googleapis.com/chrome-for-testing-public) IS reachable, so when the
# normal install fails we fall back to downloading the exact build Playwright
# wants from there and lay it out in the cache directory Playwright expects.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo "[session-start] Installing npm dependencies..."
npm install --no-audit --no-fund

# --- Install the Playwright browser ("Agent Browser") --------------------------
echo "[session-start] Ensuring Playwright Chromium is installed..."

# 1) Try the normal path first (works if the Playwright CDN is reachable).
if npx playwright install chromium >/dev/null 2>&1; then
  echo "[session-start] Playwright installed Chromium via the standard CDN."
else
  echo "[session-start] Standard Playwright download unavailable; using Chrome for Testing fallback."

  CFT_BUCKET="https://storage.googleapis.com/chrome-for-testing-public"
  DRY="$(npx playwright install --dry-run chromium 2>/dev/null)"

  # Parse the dry-run output into "version|install_dir|zip_name" lines, one per
  # downloadable Chromium artifact (chrome + headless shell). We read version and
  # zip name from the cdn.playwright.dev URL, and the destination from the
  # "Install location" line that precedes each "Download url" line.
  install_dir=""
  while IFS= read -r line; do
    case "$line" in
      *"Install location:"*)
        install_dir="$(printf '%s\n' "$line" | sed -E 's/.*Install location:[[:space:]]*//')"
        ;;
      *"Download url:"*"/cft/"*"chrome"*".zip"*)
        url="$(printf '%s\n' "$line" | sed -E 's/.*Download url:[[:space:]]*//')"
        # e.g. https://cdn.playwright.dev/builds/cft/148.0.7778.96/linux64/chrome-linux64.zip
        version="$(printf '%s\n' "$url" | sed -E 's#.*/cft/([^/]+)/.*#\1#')"
        zip_name="$(basename "$url")"

        exe_dir="${zip_name%.zip}"   # chrome-linux64 / chrome-headless-shell-linux64
        if [ -n "$install_dir" ] && [ ! -f "$install_dir/INSTALLATION_COMPLETE" ]; then
          echo "[session-start]   Fetching $zip_name ($version) -> $install_dir"
          tmp="$(mktemp -d)"
          curl -fsSL "$CFT_BUCKET/$version/linux64/$zip_name" -o "$tmp/b.zip"
          mkdir -p "$install_dir"
          unzip -q -o "$tmp/b.zip" -d "$install_dir"
          touch "$install_dir/INSTALLATION_COMPLETE"
          rm -rf "$tmp"
        else
          echo "[session-start]   $exe_dir already present, skipping."
        fi
        ;;
    esac
  done <<< "$DRY"
fi

echo "[session-start] Done."
