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

### F2 — ~169 KB of render-blocking inline CSS in `<head>` — RECOMMENDED (needs QA)
**Severity:** Performance (highest impact) · **Risk:** high · **Status:** not applied — staged follow-up.

`snippets/header-css.liquid` inlines ~169 KB of CSS in a single `<style>` block (lines 1–44)
while `theme.aio.min.css` (230 KB) is *also* loaded (async-preloaded). The stylesheet is
effectively shipped twice, the inline copy blocking first render on every page. Proper fix:
reduce the inline block to a true above-the-fold critical subset and rely on the async sheet.
**Must be done on a preview theme with browser QA** (FOUC / layout-shift risk) — do not push blind.

### F3 — Repo source-of-truth is broken (pipeline would regress live) — see warning below
**Severity:** Repo integrity · **Risk:** none to live (repo/docs only).

Neither `theme-files/` nor `theme-files-clean/` matches the live theme (40+ files diverge):
- live `layout/theme.liquid` matches **`theme-files/`**
- live `assets/theme.s.min.js` matches **`theme-files-clean/`** (the mobile fixes)

The documented release pipeline (`scripts/theme-release.mjs` → `npm run theme:push:staging`)
deploys from **`theme-files/`**, which is **missing the mobile fixes that are live**.

> ⚠️ **DO NOT run `npm run theme:push:staging` / publish from `theme-files/` as-is — it will
> regress the live mobile bug fixes.** Re-pull the live theme into a single clean source tree
> first to re-establish a trustworthy source of truth.

Also: theme IDs in `EXECUTION_PLAN.md` (`#145753800819`, `#143636463731`, dev `#145784406131`)
are **stale**. Current live = **`145821040755`**.

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
