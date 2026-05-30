# Deploying theme changes via staged upload + themeCreate

This is the method that shipped the Phase 1 cleanup. It imports a **complete cleaned theme ZIP**
as a new unpublished theme, so it needs **no `themeFilesDelete`** (which is blocked) — files simply
aren't in the ZIP. It works in the restricted web sandbox because:
- the Shopify GraphQL calls go through the **MCP** (the sandbox can't reach Shopify directly), and
- the ZIP upload goes to **`storage.googleapis.com`**, which the sandbox network policy *does* allow.

## A) In the web sandbox (agent, via MCP) — the path that works here
1. Build the cleaned ZIP:
   ```bash
   npm run theme:build-zip        # -> dist/theme-clean.zip (theme-files/ minus the 41 dead assets)
   ```
2. `stagedUploadsCreate` (MCP `graphql_mutation`) with
   `{resource: FILE, filename: "theme-clean.zip", mimeType: "application/zip", httpMethod: POST, fileSize: <bytes>}`
   → returns `url`, `resourceUrl`, and signed `parameters`.
3. Upload the ZIP to `url` with the parameters (file field last):
   ```bash
   curl -X POST "<url>" -F Content-Type=application/zip -F success_action_status=201 \
     -F acl=private -F key=<key> -F x-goog-date=<…> -F x-goog-credential=<…> \
     -F x-goog-algorithm=<…> -F x-goog-signature=<…> -F policy=<…> \
     -F "file=@dist/theme-clean.zip"
   # expect HTTP 201
   ```
4. `themeCreate` (MCP `graphql_mutation`) with `{source: <resourceUrl>, name, role: UNPUBLISHED}`.
5. Poll `theme(id){processing}` until false; verify assets (dead absent, `details-modal.js` present).
6. **Preview, then publish manually** (publishing is intentionally not automated).

> Blocked via MCP (do not attempt): `themeFilesDelete`, `themePublish`, `themeDelete`.
> Allowed via MCP: `stagedUploadsCreate`, `themeCreate`, `themeDuplicate`, `themeFilesUpsert/Copy`.

## B) Outside the sandbox (CI / a machine with Shopify access) — scripted
Needs network to `*.myshopify.com` + `storage.googleapis.com` and an Admin token (`write_themes`):
```bash
SHOPIFY_FLAG_STORE=tiptop360.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_xxx \
  npm run theme:deploy-clean -- "TT360 | Clean (auto)"
```
`scripts/deploy-clean-theme.mjs` runs the same 4 steps against the Admin GraphQL API.

## C) Standard CLI alternative (updates an existing theme in place)
Once `SHOPIFY_CLI_THEME_TOKEN` + `SHOPIFY_FLAG_STORE` and Shopify network access are configured
(see `SHOPIFY_CLI_SETUP.md`), `npm run theme:apply-phase1` does `shopify theme push` to a theme.

## Reference — themes touched during Phase 1
| Theme | id | notes |
|---|---|---|
| `TT360 | Phase1 Clean (auto)` | 145821040755 | cleaned result (564 files), ready to publish |
| `TT360 | Live` | 145817043059 | currently MAIN/live (still has the 41 dead files) |
