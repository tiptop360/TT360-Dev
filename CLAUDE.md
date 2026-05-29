# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

TipTop360 (TT360) is a Shopify storefront plus an automation toolkit for SEO,
GEO/AEO, and CRO. This repo is the **source of truth for theme releases**.

- `theme-files/` — deployable Shopify theme source (Online Store 2.0). Edit here.
- `scripts/theme-release.mjs` — guarded Shopify CLI release workflow (staging → live).
- `optimizer.js` / `optimize-local.js` — Node automation engine (audit/apply/backup/revert).
- `*.cjs` deploy/fix/audit scripts — one-off task runners against the live store API.
- `validators/`, `*.cjs` validators — GEO/llms.txt and SEO regression checks.
- `releases/`, `docs/` — release notes and pipeline/checklist docs.
- `backups/`, `backup V2/`, `local-backups/`, `theme-backup/` — snapshots. **Do not edit; never treat as live source.**

Config lives in `.env` (copy from `.env.example`). Never commit `.env` or tokens.

## Shopify front-end coding guidelines

When writing or editing theme code (sections, snippets, blocks, assets), follow
these rules. The theme already uses `{% render %}` everywhere — keep it that way.

### Architecture & clean code
- **OS 2.0 first**: assume JSON templates. Sections must be modular, autonomous, and reusable.
- **Snippets**: use `{% render 'snippet_name' %}`. **Never** use the deprecated `{% include %}`. Never leak variables into global scope.
- **BEM markup**: name CSS classes Block-Element-Modifier (e.g. `.card-grid__item--featured`). Keep HTML semantic.
- **Block-driven**: don't hardcode content structures. Expose customizable `blocks` in the section schema so merchants can reorder elements.

### Performance & Web Vitals
- **LCP / above-the-fold media**: use the native `image_tag` filter with explicit `widths`, `sizes`, `loading: 'eager'`, and `fetchpriority: 'high'`.
- **Below-the-fold images**: default to `loading: 'lazy'`.
- **Scoped CSS**: split stylesheets by component and load section CSS in-file via
  `{{ 'section-name.css' | asset_url | stylesheet_tag }}` to avoid blocking global paints.
- **Vanilla JS only**: no jQuery or external UI frameworks. Modern ES6+. Wrap behavior in native
  HTML5 Web Components (Custom Elements) for encapsulation. Load scripts with `defer="defer"`.

### Output format for new sections/snippets
When generating a section, structural snippet, or layout feature, present it as distinct blocks:
1. Filename + relative path (e.g. `sections/predictive-search.liquid`)
2. Liquid markup & HTML layout
3. Scoped CSS/SCSS (theme-check valid)
4. Encapsulated vanilla JS asset
5. Clean, fully configured `{% schema %}` JSON block

## Development workflow

Use the guarded pipeline (see `docs/THEME_RELEASE_PIPELINE.md`). Branch model:
`main` (production) ← `dev` (integration) ← `feature/*` / `hotfix/*`.

```bash
npm run theme:status          # local pipeline status
npm run theme:pull:staging    # pull latest staging theme into theme-files/
npm run theme:check           # theme-check validation
npm run theme:push:staging    # push to STAGING only
npm run theme:preview         # open staging preview
npm run theme:release-note -- "summary"
```

Automation engine:
```bash
npm run audit                 # node optimizer.js audit
npm run dry-run               # preview changes without writing
npm run backup                # snapshot before changes
npm run revert-all            # roll back optimizer changes
```

## Hard rules
- **Never push directly to the live theme** during normal work — staging only.
- Never set the staging theme ID equal to the live theme ID.
- Pull back any manual Shopify-editor change before starting new branch work.
- One feature branch and one release note entry per task.
- Publish only the theme that was preview-tested.
- Validate with `npm run theme:check` and the GEO/SEO validators before pushing.
- Do not commit secrets; `.env` stays local.
