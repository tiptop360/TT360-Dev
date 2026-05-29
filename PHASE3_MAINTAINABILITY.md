# Phase 3 — Maintainability (analysis + plan)

Computed against the verified production mirror in `theme-files/` (605 files).

## Built now (safe, no preview required)
### Dead-asset CI guardrail ✅
- `validators/theme-asset-audit.mjs` (+ `npm run theme:audit-assets`) and
  `.github/workflows/theme-asset-audit.yml`.
- **Hard-fails** if any backup/duplicate-pattern filename (`-backup`, `.aio.min-backup`,
  `copy`, …) reappears — the exact rot the repo had (171 backup variants). Currently passes
  (production is clean of those).
- **Reports** unreferenced css/js (authoritative quoted-reference detection): currently the
  **41** Phase 1 dead assets. `--strict` makes these fail CI too — flip that on after the
  Phase 1 cleanup is applied. `details-modal.js` is allowlisted (defines `<details-modal>`).

## Findings — to execute incrementally WITH preview (not blind)
> These change rendered output on live-store code. Since this environment can't preview/test
> a theme, each item below should be done one at a time and previewed on an unpublished theme
> before publishing. They are scoped here so they can be pushed via the same flow as Phase 1.

### A. Exact-duplicate section file (high confidence)
- `sections/abuilds-ugc.liquid` and `sections/video-ugc-ab.liquid` are **byte-identical**
  (md5 `032bf5c2…`, 61,940 B each). Neither is referenced in any `templates/*.json`.
- **Action:** verify in the theme editor which (if either) is in use, then delete the unused
  one (or consolidate to a single section + an alias). ~62 KB removed.

### B. Monolithic sections (15 files > 40 KB)
| File | Size | Inline `<style>` | Inline `<script>` |
|---|---|---|---|
| `tt360-product-body.liquid` | 146 KB | 1 | 9 |
| `product-template-1.liquid` | 94 KB | **40** | 9 |
| `tt360-homepage-body.liquid` | 68 KB | 2 | 2 |
| `gymbag-pdp.liquid` | 65 KB | 1 | 6 |
| `tt360-about-page.liquid` | 65 KB | — | — |
| `slideshow-1.liquid` | 63 KB | 6 | 0 |
| `video-ugc-ab` / `abuilds-ugc` | 62 KB | 21 | 1 |
| `tt360-upsell-product-body.liquid` | 60 KB | — | — |
| `tt360-faq-page.liquid` | 55 KB | — | — |
| `slideshow-3.liquid` | 53 KB | — | — |
| `advanced-content.liquid` | 52 KB | — | — |
| `header.liquid` | 42 KB | — | — |

- **`product-template-1.liquid` has 40 separate inline `<style>` blocks** — the prime candidate:
  consolidate into one `{% style %}` block (or a section stylesheet), and extract repeated
  markup (gallery, variant picker, trust badges) into `snippets/` rendered with `{% render %}`.
- **PDP bodies** (`tt360-product-body` 146 KB, `gymbag-pdp`, `tt360-upsell-product-body`) likely
  share large overlapping markup/JS — extract the common parts into shared snippets to cut
  duplication and per-page weight.

### C. Inline JS/CSS consolidation (theme-wide)
- Inline `<script>` and `<style>` are scattered across many sections. Where the same block
  recurs verbatim, move it to a snippet/asset and `{% render %}` / load once. This overlaps
  with Phase 2 (the 189 KB `header-css.liquid`).

## Suggested order (each previewed before publish)
1. Delete the duplicate UGC section (A) — biggest win for least risk.
2. Consolidate `product-template-1.liquid`'s 40 `<style>` blocks (B) — verify PDP renders identically.
3. Extract shared PDP markup/JS into snippets (B/C) — one section at a time.
4. After Phase 1 cleanup lands, flip the CI guardrail to `--strict`.
