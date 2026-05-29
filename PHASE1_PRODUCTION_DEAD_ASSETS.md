# Phase 1 — Production Dead-Asset Audit (verified against the LIVE theme)

**Date:** 2026-05-29
**Store:** TipTop360 (tiptop360.com)
**Audited theme:** unpublished copy of **"TT360 | Production"** — `TT360 | Phase1 Cleanup (dead-asset removal)`, theme id `145817043059`.

> ⚠️ This audit was run against the **actual production theme's code**, not the repo.
> The repo (`theme-files/`) is a stale/partial snapshot and does **not** mirror production,
> so the repo's earlier 171-file cleanup does **not** apply to production.

## Method
1. Duplicated the live "TT360 | Production" theme (unpublished, zero customer impact).
2. Fetched the bodies of **all ~460 theme files** (layout, sections, snippets, blocks, templates, config)
   and grepped them against the **85 CSS/JS assets** present on production.
3. Confirmed there is **no dynamic asset-name construction** anywhere (all `asset_url` calls use
   static string literals), so the reference set is complete.
4. Cross-checked the **43 referenced (kept) asset bodies** for `@import` / JS dynamic loads of any
   dead file — none found.

## Result: 43 assets referenced (KEEP) · 42 assets dead (DELETE)

### DELETE — 42 verified-dead assets (path = `assets/<name>`)

**Superseded duplicate variants** (the loaded `.aio.min.css` / `.s.min.js` twin is kept):
```
beerslider.css                 beerslider.js
cart-draw.css                  component-card.css
component-deferred-media.css   component-facets.css
component-loading-overlay.css  component-model-viewer-ui.css
component-pagination.css       component-pickup-availability.css
component-predictive-search.css component-product-model.css
component-rte.css              component-search.css
component-show-more.css        facets.js
gift-card.js                   global.js
pickup-availability.js         predictive-search.js
product-model.js              product-template.css
shipping_rate.js              show-more.js
slide-menu.css                template-collection.css
tiny-img-link-preloader.js    vendor.js
photoswipe.css                photoswipe.css.liquid
photoswipe.s.min.css          photoswipe.s.min.css.liquid
theme.css                     theme.css.liquid
theme.js                      theme.s.min.css
theme.s.min.css.liquid
```

**Standalone — zero references anywhere in the theme:**
```
details-modal.js
tt360-aos.css
tt360-bootstrap-deferred.css
tt360-cart-drawer.css            (the cart-drawer snippet inlines its CSS instead)
tt360-theme.css
```

### KEEP — 43 referenced assets (do NOT delete)
```
ajaxinate.min.js                       beerslider.aio.min.css
beerslider.s.min.js                    cart-draw.aio.min.css
component-card.aio.min.css             component-deferred-media.aio.min.css
component-facets.aio.min.css           component-loading-overlay.aio.min.css
component-model-viewer-ui.aio.min.css  component-pagination.aio.min.css
component-pickup-availability.aio.min.css component-predictive-search.aio.min.css
component-product-model.aio.min.css    component-rte.aio.min.css
component-search.aio.min.css           component-show-more.aio.min.css
facets.s.min.js                        faq-optimized.css
gift-card.s.min.js                     global.s.min.js
lazysizes.min.js                       nouislider.min.css
nouislider.min.js                      photoswipe-ui-default.min.js
photoswipe.aio.min.css                 photoswipe.min.js
pickup-availability.s.min.js           predictive-search.s.min.js
product-model.s.min.js                 product-template.aio.min.css
shipping_rate.s.min.js                 show-more.s.min.js
slide-menu.aio.min.css                 swiper-bundle.min.js
template-collection.aio.min.css        theme.aio.min.css
theme.s.min.js                         tiny-img-link-preloader.s.min.js
tt360-lodash-shim.js                   tt360-pdp-below.css
tt360-rtl.css                          tt360-slick-shim.js
vendor.s.min.js
```
(Plus all fonts/images/svg and Shopify-platform assets, which were out of scope and untouched.)

## How to apply (Shopify admin)
Automated deletion is blocked by the Shopify MCP safety policy and no CLI credentials are available
in the dev environment, so deletion must be done in admin:

1. Online Store → Themes → on **TT360 | Phase1 Cleanup** (the duplicate) → **Edit code**.
2. Delete the 42 files listed above (Assets folder).
3. **Preview** the theme; click through home, a product (PDP), a collection (with filters),
   search, cart drawer, and the gift-card page.
4. If all good, **Publish** the duplicate — or delete the same 42 files directly on
   "TT360 | Production" and keep the current live theme.
5. Delete the temporary duplicate when finished.
