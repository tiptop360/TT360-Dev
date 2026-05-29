# Phase 1 — Production Dead-Asset Audit (verified against the LIVE theme)

**Date:** 2026-05-29
**Store:** TipTop360 (tiptop360.com)
**Source of truth:** the live **"TT360 | Production"** theme (analyzed via an unpublished duplicate,
theme id `145817043059`).

> The repo's `theme-files/` has now been **reconciled to a faithful 605-file mirror of production**
> (see `RECONCILE` commit). This audit was computed against that complete file set with local grep,
> which **supersedes** an earlier distributed API scan that under-paginated and missed ~30 snippets.

## Method
1. Duplicated live "TT360 | Production" (unpublished, zero customer impact).
2. Pulled **all 605 theme files** to disk and verified 1:1 against the live filename list (0 missing / 0 extra).
3. Grepped **every** Liquid/JSON file **and** every CSS/JS asset body for references to each asset.
4. Confirmed there is **no dynamic asset-name construction** (all `asset_url` calls use static literals).
5. Cross-checked custom-element definitions in the loaded JS bundles.

## Result: 41 dead CSS/JS assets (path = `assets/<name>`)

**Superseded duplicate variants** (the loaded `.aio.min.css` / `.s.min.js` twin is kept):
```
beerslider.css                  beerslider.js
cart-draw.css                   component-card.css
component-deferred-media.css    component-facets.css
component-loading-overlay.css   component-model-viewer-ui.css
component-pagination.css        component-pickup-availability.css
component-predictive-search.css component-product-model.css
component-rte.css               component-search.css
component-show-more.css         facets.js
gift-card.js                    global.js
pickup-availability.js          predictive-search.js
product-model.js                product-template.css
shipping_rate.js                show-more.js
slide-menu.css                  template-collection.css
tiny-img-link-preloader.js      vendor.js
theme.js                        theme.css
theme.s.min.css                 photoswipe.css
photoswipe.s.min.css
```

**Liquid-compiled CSS duplicates** (served at the `.css` name, which nothing references):
```
photoswipe.css.liquid           photoswipe.s.min.css.liquid
theme.css.liquid                theme.s.min.css.liquid
```

**Standalone — zero references anywhere:**
```
tt360-aos.css
tt360-bootstrap-deferred.css
tt360-cart-drawer.css            (the cart-drawer snippet inlines its CSS instead)
tt360-theme.css
```

## ⚠️ Corrections vs. the first draft of this audit
- **`details-modal.js` — DO NOT DELETE (reclassified to KEEP).** It defines the `<details-modal>`
  custom element used in `snippets/header-search.liquid` (header search), and that class exists in
  **no** loaded bundle (`theme.s.min.js` / `global.s.min.js` / `vendor.s.min.js` have 0 occurrences).
  Deleting it would break the header search.
  - **Latent bug to investigate (Phase 2):** `details-modal.js` does not appear to be loaded via
    `asset_url`/`<script>` anywhere in the theme, yet `<details-modal>` is used — the header search
    may currently be relying on it being absent/degraded. Worth confirming on production.
- **`theme.js` — confirmed DEAD.** Its only textual matches are a Liquid comment and the CSS selector
  `.btn-theme.js-grid-cart`; it is never `asset_url`-loaded. (Kept assets are `theme.aio.min.css` for
  CSS and `theme.s.min.js` for JS.)

## How to apply (Shopify admin)
Automated deletion/publishing is blocked by the Shopify MCP safety policy, and no CLI credentials
exist in the dev environment, so removal is done in admin:

1. Online Store → Themes → **TT360 | Phase1 Cleanup** (the duplicate) → **Edit code**.
2. Delete the 41 files listed above from the Assets folder.
3. **Preview** and click through: home, a product (PDP), a collection (with filters), search
   (confirm the **header search icon** still works — that exercises `<details-modal>`), the cart
   drawer, and the gift-card page.
4. If all good, **Publish** the duplicate — or apply the same 41 deletions directly on
   "TT360 | Production". Then delete the temporary duplicate.

> Note: these 41 files are still present in the repo mirror (`theme-files/`) because the mirror
> faithfully matches current production. Remove them from the repo in the same change you apply to
> production, so the two stay in sync.
