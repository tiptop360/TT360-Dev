# TipTop360 — Execution Plan (Live Tracker)

**Branch:** `claude/hopeful-brown-6oflm`
**Staging theme:** TT360 | Dev — `#145784406131`
**Live theme:** TT360 | live — `#145753800819`
**Gate:** Per-area pause for explicit "publish live" approval before promotion.

---

## Live Status

- **Mode change:** batch mode per your request — all code areas pushed to the branch in one go; you push to stage and preview everything together, then publish manually.
- **Areas with code shipped to branch:** 1, 2, 3, 4, 5, 6.
- **Areas still owner-driven (no code):** 7 (GBP, GSC, Bing, Clarity if you give the ID).
- **Last commit:** `141702a` — Area 3: smart Estimated Delivery widget added.
- **Validation run 2026-05-28:** all 6 areas re-verified on branch `claude/hopeful-brown-6oflm`:
  - 0 markdown-corruption hits across the 11 touched files (the 3 hits in `product-template-1.liquid` are pre-existing Shopify help-text URLs inside section schema `info` fields, untouched by this work).
  - All section JSON schemas parse (`collection-seo-content`, `pnewsletter`, `aivox-pdp`, `gymbag-pdp`).
  - `templates/collection.json` and `templates/collection.kids-collection.json` parse and both reference `collection-seo-content` in their `order` array, positioned after `product-grid`.
  - `layout/theme.liquid` LocalBusiness JSON-LD parses; `parentOrganization` correctly links to `#organization`.
  - GTM defer wired: `setTimeout(loadGtag, 3500)` at line 259; `dataLayer` + `gtag('config', ...)` queued early at lines 245-248.
  - `<html>` tag derives `dir` from `request.locale.iso_code` (rtl when `'ar'`, else ltr).
  - All 3 PDP variants render the 3 unified snippets: `tt360-payment-icons`, `tt360-delivery-countdown`, `tt360-estimated-delivery`.
  - `tt360-rtl.css` loaded from `snippets/header-css.liquid` after main CSS.
  - No malware patterns (`fv-loading-icon`, `component-3.0`, `githubfix`) anywhere in `theme-files/`.

---

## Done So Far

- [x] Audited every brief task vs real theme state (3 Explore agents).
- [x] Plan file: `/root/.claude/plans/root-claude-uploads-5f883c76-e2fe-4b2a-zazzy-koala.md`.
- [x] Live tracker: `EXECUTION_PLAN.md`.
- [x] Decisions locked: staging = #145784406131; Arabic already enabled; `kids-collection-uae` still live (Task 11 dropped).
- [x] **Area 1 — SEO/GEO:** LocalBusiness JSON-LD added to `@graph` in `layout/theme.liquid` (homepage-only, parent-linked to `#organization`). JSON-LD parses on both Liquid branches. — commit `5c34c42`.
- [x] **Area 2 — Performance:** GTM loader wrapped in `setTimeout(3500)` + first-interaction (scroll/move/touch/key) trigger; dataLayer + gtag init kept outside the timeout so events queue immediately. Also: `<html dir>` now derived from `request.locale.iso_code` so RTL CSS activates on Arabic locale. — commit `3e728c7`.
- [x] **Area 3 — PDP unification:** new `snippets/tt360-payment-icons.liquid` + `snippets/tt360-delivery-countdown.liquid`. Rendered in `aivox-pdp.liquid` and `gymbag-pdp.liquid` (both were missing payment + delivery cutoff). `product-template-1.liquid` left alone — already has both via existing block types. — commit `91bd6b9`.
- [x] **Area 3 (follow-up) — Smart Estimated Delivery widget:** new `snippets/tt360-estimated-delivery.liquid`. Replaces the app-injected "Estimated Delivery: range" line with a JS-computed single date. Rules: Mon-Sat delivery (no Sunday), 20:00 cutoff. Rendered on all 3 PDPs above their cutoff countdown. Verified across the full week. — commit `141702a`. **Merchant follow-up:** disable the existing Estimated Delivery app after QA so there is only one widget.
- [x] **Area 4 — Collection SEO:** new `sections/collection-seo-content.liquid` (heading + intro + 5 bullets + 3 FAQs + FAQPage JSON-LD). Wired into `templates/collection.json` (default) and `templates/collection.kids-collection.json` (with kid-specific heading override) — both positioned right after the main product grid. — commit `1da04e9`.
- [x] **Area 5 — Popup CRO:** `sections/pnewsletter.liquid` now triggers on 60% scroll OR 45s idle (whichever first), with two new merchant-tunable settings (`pnewletter_scroll_pct`, `pnewletter_idle_seconds`). Existing 7-day cookie cap preserved. WhatsApp alternate CTA added inside the modal pointing at `+971 58 515 6033`. — commit `3f6c793`.
- [x] **Area 6 — Arabic/RTL:** new `assets/tt360-rtl.css`, loaded from `header-css.liquid` right after `theme.aio.min.css`. Scoped to `html[dir="rtl"]` so LTR is untouched. Covers all unified snippets, popup, collection SEO block, nav, drawer, breadcrumbs, footer, and directional icons. — commit `9bf1a25`.
- [x] All 11 edited files validated: 0 markdown-corruption hits, all JSON / JSON-LD / Liquid schemas parse.

---

## Still Open Right Now

- [ ] **You (Mac):** `git fetch origin && git checkout claude/hopeful-brown-6oflm && git pull` to get all 6 area commits.
- [ ] **You (Mac):** `npm run theme:push:staging` (pushes everything to TT360 | Dev #145784406131).
- [ ] **You (Mac):** preview `https://tiptop360.com?preview_theme_id=145784406131` and walk the QA checklist in each area section below.
- [x] ~~Shopify Admin: create `custom.age_range` metafield definition~~ — **done 2026-05-28 via Shopify Admin API** (`gid://shopify/MetafieldDefinition/183661658227`). Pinned at position 11, type `single_line_text_field`, validations `choices=["2-6 years","7-12 years","All ages"]`, smartCollectionCondition + adminFilterable enabled. **Storefront access defaulted to NONE** (the app's scope blocked setting `PUBLIC_READ` at creation time). Search & Discovery filtering works without storefront access; if you ALSO want to read the value in Liquid for on-PDP display, upgrade in Settings → Custom data → Products → Age Range → Storefronts → Read.
- [x] ~~Shopify Admin: publish `llms.txt` if `curl -I https://tiptop360.com/llms.txt` returns 404~~ — **already live** (verified 2026-05-28). Shopify page `gid://shopify/Page/122160054387` (handle `llms-txt`, last updated 2026-05-27) holds the full content; URL redirect `gid://shopify/UrlRedirect/435000737907` maps `/llms.txt → /pages/llms-txt`. The page falls back to default `templates/page.liquid` (no `page.text.liquid` exists in either theme) so it renders with theme chrome around the `<pre>` body — fine for AI crawlers. Optional optimization: create a `templates/page.llms-txt.liquid` with `{% layout none %}{{ page.content }}` and switch the page's `templateSuffix` from `text` to `llms-txt` to strip the chrome — but not blocking.
- [ ] **You (Shopify Admin):** enable Search & Discovery → Filters → Age (sources from `custom.age_range`). Once enabled, `main-collection-template.liquid`'s `collection.filters` loop renders the chip automatically.
- [ ] **You:** view-source on staging → grep for `hreflang` → tell me whether Shopify auto-emits alternates (decides if Area 1 needs a manual block). If alternates ARE missing, ping me and I'll add the `<head>` block.
- [ ] **You:** when staging QA passes, `npm run theme:publish:staging` to promote, then Cloudflare cache purge (see SOP 3 in `STRATEGY.md`).
- [ ] **You:** Area 7 external — GBP, GSC sitemap, Bing import, Microsoft Clarity script (give me the project ID and I'll fold the `<script>` into theme.liquid).

---

# Areas (in execution order)

## Area 1 — SEO/GEO Schema & Foundations
*Lowest visual risk, biggest indexing impact.*

**Done**
- [x] LocalBusiness JSON-LD node added to existing `@graph` in `layout/theme.liquid` (homepage-only).
- [x] LocalBusiness linked to `#organization` via `parentOrganization` — single clean entity graph.
- [x] Confirmed `kids-collection-uae` handle is still live → no internal link rewrites needed.
- [x] Validated: JSON-LD parses on both index (5 nodes) and non-index (2 nodes) branches.

**Open**
- [ ] Stage push + Rich Results Test on staging preview URL → expect 5 schemas detected.
- [ ] View-source on staging: confirm whether Shopify already emits `hreflang` alternates. If not → ping me to add manual `<link rel="alternate" hreflang>` block to `<head>`.
- [x] ~~`curl -I https://tiptop360.com/llms.txt` → publish if 404~~ — already live as a Shopify page + URL redirect (verified via Admin API 2026-05-28, see top-level "Still Open" note).
- [ ] Re-check AggregateRating render on a PDP (Judge.me 24h propagation per `SESSION_CONTEXT.md`).

---

## Area 2 — Performance (GTM defer + LCP preload audit)
*Small surface, measurable win.*

**Done**
- [x] GTM loader replaced with deferred loader (`setTimeout(3500)` + first-interaction wake) in `theme.liquid:243-263`. dataLayer / gtag init stay early so events still queue.
- [x] `<html dir>` derived from `request.locale.iso_code` so RTL CSS activates on Arabic locale automatically.

**Open**
- [ ] PSI mobile run on staging homepage + 1 PDP → confirm score does NOT regress.
- [ ] DevTools Network on staging: confirm `gtag/js?id=GT-NC6ZVVHK` request fires ~3.5s in OR on first scroll, not in initial waterfall.
- [ ] Visual LCP sanity: Performance tab → LCP element → URL matches `theme.liquid:38-43` (product) and `:217-225` (homepage) preload.
- [ ] If wanted: send the Microsoft Clarity project ID and I'll add the tracker script before `</head>`.

---

## Area 3 — PDP CRO Unification (Sticky ATC + Payment + Countdown + Trust)
*Three PDP templates today; design + behaviour drift between them.*

**Done**
- [x] Created `snippets/tt360-payment-icons.liquid` (Shopify payment icons + UAE Cash on Delivery pill, unified brand styling).
- [x] Created `snippets/tt360-delivery-countdown.liquid` ("Order within Xh Ym for next-day delivery", configurable cutoff per render, JS updates each minute).
- [x] Rendered both snippets in `sections/aivox-pdp.liquid` and `sections/gymbag-pdp.liquid` near ATC.
- [x] `product-template-1.liquid` left untouched — already has both via existing block types and inline `payment_type_svg_tag` (`:567-571`) + `product-countdown` snippet (`:630`).
- [x] Sticky ATC: all three PDPs already had their own (aivox + gymbag use bespoke landing-page sticky bars by design; `product-template-1.liquid` renders the shared `sticky-cart` snippet at `:678`).
- [x] Trust badges left in place per PDP (each PDP has its own brand-styled pills) — unified visually via the global RTL block + brand colour reuse.

**Open**
- [ ] Mobile QA on staging: open one product on each of the three PDP variants. Confirm payment icons row + delivery countdown badge appear consistently near ATC; click ATC works; no console errors.
- [ ] If you want stricter design unification (single shared sticky/trust snippet across all PDPs): say the word and I'll do the deeper refactor in a follow-up commit — needs visual review on a real product since aivox/gymbag layouts are bespoke.

---

## Area 4 — Collection Page SEO Content + Metafield Filtering
*Brief Task 2 + Task 4 combined. Lowest-coverage area today.*

**Done**
- [x] Created `sections/collection-seo-content.liquid` (heading + intro richtext + 5 bullets + 3 FAQs + FAQPage JSON-LD). Brand colours `#12395e` heading / `#00A86B` check marks.
- [x] Wired into `templates/collection.json` (default, no override) and `templates/collection.kids-collection.json` (kids-specific heading override) — both positioned right after the main product grid.

**Open**
- [x] ~~Create `custom.age_range` product metafield definition~~ — **done 2026-05-28 via Admin API** (definition id `gid://shopify/MetafieldDefinition/183661658227`, choices `2-6 years / 7-12 years / All ages`, adminFilterable + smartCollectionCondition both enabled, pinned).
- [ ] **You (Shopify Admin):** Search & Discovery → Filters → add Age filter sourced from `custom.age_range`. Once enabled, `main-collection-template.liquid`'s generic `collection.filters` loop will render the chip automatically.
- [ ] **You (Shopify Admin, optional):** upgrade storefront access on `custom.age_range` to `Read` (Settings → Custom data → Products → Age Range → Storefronts) if you want to render the value in PDP Liquid. Filter functionality already works without this.
- [x] ~~Assign an age range to each kids product~~ — **done 2026-05-28 via `metafieldsSet`**, 15/15 succeeded. Final distribution after spot-check: All ages (12), 2-6 years (1: kids-wax-crayons-uae — chunky toddler grip), 7-12 years (2: kids-drawing-robot — STEM templates need 6+ skill; kids-dual-tip-markers-uae — 5+ with choking risk under-5). Skipped 4 non-kids: ai-voice-recorder, magnetic-gym-bag-uae, digital-gift-card-uae, gift-wrap-1. Spot-fix any wrong call: Products → product → Metafields → Age Range.
- [ ] Preview a kids collection on staging → SEO content + FAQ visible below grid; FAQ JSON-LD validates in Rich Results Test.
- [ ] (Optional) add the section to other actively-used collection templates beyond the two defaults (e.g. `collection.smart-ai-gadgets.json`) once the kids one is validated.

---

## Area 5 — Email Popup CRO
*Native theme popup only (not Klaviyo/Privy apps).*

**Done**
- [x] Bundled `theme.js` setTimeout-based open neutralised by overriding `data-delay` to 3600s.
- [x] Added inline trigger: opens modal at configurable scroll depth (`pnewletter_scroll_pct`, default 60%) OR after configurable idle (`pnewletter_idle_seconds`, default 45s).
- [x] Existing `cookiesNewsletter` cookie respected → 7-day "show again" cap preserved.
- [x] WhatsApp alternate CTA added inside the modal (`wa.me/971585156033`).
- [x] Two new merchant-tunable section settings exposed in theme editor.

**Open**
- [ ] Incognito QA on staging: no popup on page load; appears at 60% scroll; idle 45s on a short page also triggers; close → no re-show for 7 days; WhatsApp link opens with prefilled chat.

---

## Area 6 — Arabic / RTL (do last among code areas — largest surface)
*Arabic confirmed already enabled in Admin and on UAE market.*

**Done**
- [x] New asset `assets/tt360-rtl.css`, loaded from `snippets/header-css.liquid` right after `theme.aio.min.css`.
- [x] Scoped to `html[dir="rtl"]` so LTR is untouched. Covers: layout containers, forms, sticky/payment/trust/countdown snippets, collection SEO content, popup, nav, drawer, breadcrumbs, footer, directional icons (`scaleX(-1)`).
- [x] `<html>` tag now emits `dir="rtl"` when `request.locale.iso_code == 'ar'` (set in Area 2 commit `3e728c7`).

**Open**
- [ ] Visit `?locale=ar` on staging across homepage / PDP / collection / cart → confirm no broken layout, no horizontal scroll, expected text alignment.
- [ ] View source on `?locale=ar`: confirm exactly one set of `hreflang` alternates (no duplicates from Shopify auto + manual). If alternates are MISSING entirely, ping me to add the manual block.
- [ ] **Owner content task (no code):** translate top 3 products (U-shaped toothbrush, drawing robot, foam toothpaste) — title, description, SEO title, SEO description, image alt text.

---

## Area 7 — External / Manual (parallel after Area 1 ships)
*No theme code, owner-driven.*

**Done**
- [x] (none yet — gated on Area 1 going live so LocalBusiness schema is in place first)

**Open**
- [ ] **You:** create / claim Google Business Profile at `business.google.com/create` — name TipTop360, category Toy Store + Baby Store + Online Shop, RAK Free Zone address, service area = all 7 Emirates, phone `+971 585 156 033`, URL `https://tiptop360.com`.
- [ ] **You:** GBP — add top 8 products, services (Free Next-Day Delivery, COD, Returns, Dubai Municipality), 5+ photos, attributes (Online appointments, Delivery).
- [ ] **You:** GSC → Sitemaps → submit `sitemap.xml`. Bing Webmaster → Import from GSC.
- [ ] **You:** post-delivery WhatsApp template asking for Google review; target 10 reviews in first month.

---

## Out of Scope (explicit)

- Replacing the popup app (Klaviyo / Privy) — only the native `pnewsletter.liquid` is touched in Area 5.
- New blog content (5 SEO posts pending in `STRATEGY.md` Phase 4) — separate workstream.
- Judge.me / Loox install for AggregateRating — separate decision.
- Full Arabic translation of all 19 products beyond the top 3 — owner content work.
- Brief Task 11 (`kids-collection-uae` 301 redirect cleanup) — handle still live, premise doesn't apply.

---

## Per-Area Deploy Commands (run on your Mac, not in this container)

```bash
# 1. Get the latest code I pushed
git fetch origin && git checkout claude/hopeful-brown-6oflm && git pull

# 2. Push to staging (TT360 | Dev #145784406131)
npm run theme:push:staging

# 3. Preview
#    https://tiptop360.com?preview_theme_id=145784406131

# 4. Per-area QA (per the "Open" checklist for that area)

# 5. When QA passes, reply "publish area N live" and I'll give you the exact
#    `npm run theme:publish:staging` + Cloudflare purge sequence.
```

---

## Rollback (any area, any time)

```
Shopify Admin → Online Store → Themes
  → TipTop360 | Live #143636463731  (or current production backup)
  → Actions → Publish
```

Reverts the storefront in seconds. The broken theme stays for debugging.
