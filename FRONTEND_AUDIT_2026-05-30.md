# TT360 Frontend Audit — 2026-05-30

Audited against the current **official Shopify theme best practices** (Online Store 2.0,
Theme Check, Web Performance / Core Web Vitals, accessibility/WCAG).

- **Live theme:** `TT360 | Production` — `gid://shopify/OnlineStoreTheme/145821040755` (role MAIN)
- **Preview/fix copy:** `TT360 | Frontend Fix 2026-05-30 (preview)` — `145829265523` (UNPUBLISHED)
- **Preview URL:** https://tiptop360.com?preview_theme_id=145829265523
- **Auditor:** Claude Code (Admin API, read + unpublished-theme writes). Publishing is performed
  manually by the operator in Shopify Admin (Admin-API publish is blocked for safety).

> **Validation note:** the live storefront returns HTTP 403 to automated requests
> (Cloudflare bot protection), so Lighthouse / rendered visual QA cannot be run from the
> automation container. Code-level audit was done via the Admin API + static analysis;
> **visual/CWV QA must be done by a human on the preview URL before publishing.**

---

## ✅ Already in place and confirmed live (good)

- `<head>`: preconnect/dns-prefetch, canonical, robots noindex logic, **LCP image preload**
  (product + homepage), favicon, social meta tags.
- **Deferred GTM + Google Ads + Clarity** loader (`setTimeout 3500` + first-interaction wake);
  `dataLayer`/`gtag` queued early.
- Complete `@graph` JSON-LD: Organization/OnlineStore, WebSite, WebPage, FAQPage, **LocalBusiness**.
- All JS `defer`-loaded; **jQuery duplication already removed**; `theme.aio.min.css` loaded
  **async** via `stylesheet_tag: preload: true`; predictive-search CSS async (`media=print` swap).
- Internationalization done correctly (strings via `locales`, not hardcoded).
- Footer accordion has **keyboard + `aria-expanded`** accessibility; `mobile-first-css.liquid`
  ships mobile readability, tap-target (≥48px), focus-ring and WCAG contrast fixes.
- RTL (`<html dir>` + `tt360-rtl.css`), collection-SEO section, PDP payment/delivery snippets — live.
- **Recent mobile fixes verified live** (`theme.s.min.js` byte-identical to the fixed version):
  mobile search crash, cart-qty `unbind` bug, gift-item deletion, and touch-target CSS.

---

## 🔧 Findings

### F1 — Duplicate execution of `vendor.s.min.js` (296 KB) + `global.s.min.js` — APPLIED to preview
**Severity:** Performance (high value) · **Risk:** low · **Status:** fixed on preview copy.

Both `snippets/header-js.liquid` (rendered at body end) **and** `layout/theme.liquid` loaded
`vendor.s.min.js` and `global.s.min.js`. Identical `src` ⇒ fetched once but **executed twice**
(wasted main-thread time / TBT, risk of double-init). Fix: removed the duplicate pair from
`layout/theme.liquid`; kept `lazysizes.min.js` (only loaded there). `header-js.liquid` still loads
both, earlier in document order, so load order is preserved.

### F2 — 169 KB Bootstrap framework inlined render-blocking in `<head>` — APPLIED to preview
**Severity:** Performance (highest impact) · **Risk:** medium (needs browser QA) · **Status:** applied to preview copy.

`snippets/header-css.liquid` inlined ~169 KB of CSS in a single render-blocking `<style>` block
on **every** page. Verification showed this is **not** a duplicate of `theme.aio.min.css`
(0% rule overlap, ~6% selector overlap) — it is the **entire Bootstrap framework**
(`.col-*`, `.offset-md-*`, `.custom-control-*`, `.btn-*`, `.d-xl-*`, grid/utilities). HTML
responses are not cacheable, so this 169 KB was re-sent and re-parsed on every navigation.

**Fix applied:** extracted the block verbatim into a new cacheable asset
`assets/tt360-bootstrap.css` and replaced the inline block with
`{{ 'tt360-bootstrap.css' | asset_url | stylesheet_tag }}` in the same position (render-blocking,
so cascade and first-paint behavior are unchanged — Bootstrap still loads before the theme
styles, no FOUC/CLS introduced). Result: **−169 KB of HTML on every page** and the framework is
now browser-cached across pages/visits. CSS content is byte-identical. **Browser-QA the preview**
to confirm layout (grid, forms, buttons) renders identically before publishing.

### F3 — Repo source-of-truth is broken (pipeline would regress live) — see warning below
**Severity:** Repo integrity · **Risk:** none to live (repo/docs only).

Neither `theme-files/` nor `theme-files-clean/` matches the live theme (40+ files diverge):
- live `layout/theme.liquid` matches **`theme-files/`**
- live `assets/theme.s.min.js` matches **`theme-files-clean/`** (the mobile fixes)

The documented release pipeline (`scripts/theme-release.mjs` → `npm run theme:push:staging`)
deploys from **`theme-files/`**, which is **missing the mobile fixes that are live**.

**Reconcile status (2026-05-30):**
- Applied F1 + F2 + the missing live mobile fixes into `theme-files/` (committed).
- Partial mirror of the production copy (`145829265523`) into `theme-files/`: **48 divergent
  files pulled and md5-verified** (25 updated, 23 that were missing).
- **130 files still divergent** (mostly large JSON/locales up to 292 KB). A faithful pull of
  those through the Admin API isn't reliable (bodies return inline only); **finish with the
  Shopify CLI:** `shopify theme pull --theme 145829265523 --path theme-files` — the 48 verified
  files will simply re-match.
- Stale theme IDs in `EXECUTION_PLAN.md` corrected. Current live = **`145821040755`**.

> ⚠️ Until the CLI pull completes the remaining 130 files, **do not blind-push `theme-files/`
> to a theme.** The production change set is shipped via the verified copy, not this tree.

### Asset cleanup — 129 backup assets removed from repo
The reconcile found **200 files in `theme-files/` that do not exist on the live theme**. Of these,
**129 were `*-backup.*` asset duplicates** (`beerslider-backup.*`, `cart-draw-backup.*`,
`component-card-backup.*`, …) — pure repo cruft (the **live theme never had them**), unreferenced
by any Liquid/JSON. **Removed from the repo** (zero live impact). The remaining ~71 local-only
files (legacy `avada-seo-*`, `gp-*` snippets, `templates/metaobject/*`, etc.) are listed in
`/tmp/f3-reconcile-report.txt` and left for manual review.

## Regression results (2026-05-30)
Static validation of the reconciled `theme-files/` + production-artifact diff. **PASSED ✅**
- **121/121** JSON files valid (parsed as JSONC — Shopify allows comment headers).
- **160** section/block `{% schema %}` blocks valid (incl. `product-template-1` real schema:
  35 settings / 24 blocks).
- `theme.liquid` JSON-LD `@graph` braces balanced (44).
- All fix/feature markers present: F1 (no dup scripts), F2 (Bootstrap externalized + asset
  present + inline removed), Areas 1–6, Clarity, mobile fixes (`theme.s.min.js` == live-fixed,
  3× touch-action).
- **No malware patterns.**
- **Production artifact (copy vs live) differs in EXACTLY the intended files:** `theme.liquid`
  (F1), `header-css.liquid` (F2), `tt360-bootstrap.css` (added). Every other file
  (vendor, theme.s.min.js, settings_data, header-js, critical-css, …) is byte-identical by
  checksum. No unintended changes.

### F4 — Tech debt (not in this pass)
Heavy `!important` layering; `lazysizes` instead of native `loading="lazy"`; jQuery dependency.
Candidates for a future staged refactor with QA.

---

## Publish procedure (operator)

1. Open the preview URL and QA on desktop + mobile (home, collection, PDP, cart, search, `?locale=ar`).
2. Confirm console is clean and the mini-cart / search / footer still work.
3. In Shopify Admin → Online Store → Themes → **TT360 | Frontend Fix 2026-05-30 (preview)** →
   Actions → **Publish**.
4. Rollback if needed: republish **TT360 | Production** (`145821040755`) — kept untouched.
