# Shopify CLI in Claude Code (web) — persistent setup

The Shopify CLI is installed automatically on every session via a **SessionStart hook**
(`.claude/settings.json` → `scripts/setup-shopify-cli.sh`). The script is idempotent: it installs
`@shopify/cli` if missing, reports credential readiness, and probes Shopify connectivity.

For the CLI to actually push/pull themes, **two prerequisites must be configured on the environment**
(neither can be set from inside a session — they are environment-level config):

## 1. Network policy must allow Shopify
Current status: **BLOCKED**. The sandbox proxy denies Shopify hosts:
```
$ curl -I https://accounts.shopify.com
HTTP/2 403
x-deny-reason: host_not_allowed
```
When creating/configuring the Claude Code environment, choose a network policy that allows outbound to:
- `accounts.shopify.com`
- `*.myshopify.com` (e.g. `tiptop360.myshopify.com`)
- `cdn.shopify.com`

Docs: https://code.claude.com/docs/en/claude-code-on-the-web (network policies).

## 2. Credentials as environment secrets/variables
Generate a **Theme Access token**: Shopify admin → install the **Theme Access** app → create a
password for the user who should own theme changes. Then add to the environment:
- `SHOPIFY_CLI_THEME_TOKEN` = the Theme Access token  *(secret)*
- `SHOPIFY_FLAG_STORE` = `tiptop360.myshopify.com`  *(variable)*

The CLI reads these automatically (no interactive `shopify auth login`, which needs a browser).

## Once both are in place — usage
```bash
# List themes (sanity check auth + connectivity)
shopify theme list

# Pull live theme into the repo mirror
shopify theme pull --theme <THEME_ID> --path theme-files

# Push only specific files to a theme (e.g. the Phase 1 dead-asset cleanup)
shopify theme push --theme <UNPUBLISHED_THEME_ID> --path theme-files

# Theme IDs (from the store):
#   Production (MAIN, live) : 145790435443
#   Phase1 Cleanup (copy)   : 145817043059
```
> The CLI deletes files on push only when they're absent from `--path`. To remove the 41 dead assets
> (see `PHASE1_PRODUCTION_DEAD_ASSETS.md`), delete them from `theme-files/` first, then
> `shopify theme push` to an unpublished theme, preview, and publish.

Publishing the live theme is intentionally a manual/explicit step — keep it human-approved.
