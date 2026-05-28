# TipTop360 — Execution Plan (Live Tracker)

**Branch:** `claude/gracious-knuth-LCmh0`
**Staging theme:** TT360 | Dev — `#145464754291`
**Live theme:** `#145270210675`
**Gate:** Per-area pause for explicit "publish live" approval before promotion.

---

## Live Status

- **Current area:** Area 1 — code complete on branch, awaiting user staging push + preview QA + publish approval.
- **Last commit:** `5c34c42` — Area 1: add LocalBusiness JSON-LD.
- **Next area (locked until Area 1 published live):** Area 2 — Performance (GTM defer + LCP preload verify).

---

## Done So Far

- [x] Audit: mapped every brief task vs real theme state (3 Explore agents).
- [x] Plan file written: `/root/.claude/plans/root-claude-uploads-5f883c76-e2fe-4b2a-zazzy-koala.md`.
- [x] Decisions locked: staging = TT360 Staging #145464754291; per-area publish gate; Arabic already enabled.
- [x] Confirmed `kids-collection-uae` is still the live handle → Task 11 dropped from scope.
- [x] **Area 1 code:** LocalBusiness JSON-LD added to `theme-files/layout/theme.liquid` `@graph` (homepage-only, parent-linked to existing `#organization`).
- [x] **Area 1 local validation:** 0 markdown-corruption hits; JSON-LD parses on both index (5 nodes) and non-index (2 nodes) branches.
- [x] **Area 1 commit + push:** `5c34c42` on `claude/gracious-knuth-LCmh0` pushed to origin.

---

## Still Open Right Now

- [ ] **You (Mac):** `git pull` → `npm run theme:push:staging` → preview `?preview_theme_id=145464754291` → Rich Results Test on preview URL → tell me result.
- [ ] **You (Mac):** view source on staging → grep for `hreflang` → report whether Shopify auto-emits alternates (decides whether Area 1 needs a manual hreflang block).
- [ ] **You (Mac):** `curl -I https://tiptop360.com/llms.txt` → report status code (decides whether we publish the file).
- [ ] **You:** reply **"publish area 1 live"** to authorise promotion; I'll respond with the exact publish + Cloudflare purge command sequence.

---

# Areas (in execution order)

## Area 1 — SEO/GEO Schema & Foundations
*Lowest visual risk, biggest indexing impact.*

**Done**
- [x] LocalBusiness JSON-LD node added to existing `@graph` in `layout/theme.liquid` (homepage-only).
- [x] Confirmed Organization, WebSite, WebPage, FAQPage already present; LocalBusiness now sits beside them.
- [x] Confirmed `kids-collection-uae` handle is still live → no internal link rewrites needed.

**Open**
- [ ] Stage push + Rich Results Test on staging preview URL.
- [ ] View-source on staging: confirm whether Shopify already emits `hreflang` alternates. If not → add manual `<link rel="alternate" hreflang>` block to `<head>` in `theme.liquid`.
- [ ] `curl https://tiptop360.com/llms.txt` — if 404, publish the llms.txt file (source at `validators/llms_txt_validator.py` reference, or regenerate via optimizer).
- [ ] Re-check AggregateRating render on a PDP (Judge.me 24h propagation — no code unless still failing 48h+ after metafield publish).
- [ ] Promote to live + Cloudflare purge + sanity check.

---

## Area 2 — Performance (GTM defer + LCP preload audit)
*Small surface, measurable win.*

**Done**
- [x] Audited current state: `theme.liquid:38-43,220` has product + homepage LCP preload. GTM (`theme.liquid:203-209`) loads via `async` but is *not* `setTimeout`-deferred.

**Open**
- [ ] Wrap GTM loader in `setTimeout(..., 3500)` while keeping `window.dataLayer` init + `gtag()` shim outside the timeout so events queue immediately.
- [ ] Verify LCP preload on `theme.liquid:38-43` still targets the real product LCP image (Chrome DevTools Performance → LCP element on `?preview_theme_id=…`).
- [ ] Verify homepage LCP preload (`theme.liquid:217-225`) still references the correct top-of-fold image after any recent homepage section reorder.
- [ ] Audit `lazy-image.liquid` usage: confirm first hero / first collection grid image has `fetchpriority="high"` and `loading="eager"`; remainder lazy.
- [ ] Add Microsoft Clarity `<script>` before `</head>` (folded into this area to share the same deploy push).
- [ ] PSI mobile baseline before vs after on homepage + 1 PDP — must not regress.
- [ ] Stage push → preview → commit → await publish approval.

---

## Area 3 — PDP CRO Unification (Sticky ATC + Payment + Countdown + Trust)
*Three PDP templates today; design + behaviour drift between them.*

**Done**
- [x] Audited: sticky ATC exists in `aivox-pdp.liquid`, `gymbag-pdp.liquid`, and reusable `snippets/sticky-cart.liquid`. Payment icons via `payment_type_svg_tag` only in `product-template-1.liquid:567-571`. Countdown only in `product-template-1.liquid` (metafield-driven). Trust badges duplicated across all three PDPs with different markup.

**Open**
- [ ] Pick canonical: `snippets/sticky-cart.liquid` is the sticky ATC source of truth.
- [ ] Refactor `aivox-pdp.liquid` inline sticky bar → `{% render 'sticky-cart' %}`.
- [ ] Refactor `gymbag-pdp.liquid` inline sticky bar → `{% render 'sticky-cart' %}`.
- [ ] Confirm `product-template-1.liquid` renders `sticky-cart` snippet (add if missing).
- [ ] Create `snippets/payment-icons.liquid` (extract from `product-template-1.liquid:567-571`); render in all three PDPs below ATC.
- [ ] Create `snippets/delivery-countdown.liquid` (extract existing markup, keep `metafields.info.countdown` data source); render in all three PDPs above ATC.
- [ ] Create `snippets/trust-pills.liquid`; render in all three PDPs below payment icons.
- [ ] Move ad-hoc PDP `<style>` blocks for sticky/payment/trust into one block in `assets/theme.css` for visual consistency.
- [ ] Mobile QA on one product per PDP variant: identical look + position + behaviour for each unified block; ATC click adds to cart with no console errors.
- [ ] Stage push → preview → commit → await publish approval.

---

## Area 4 — Collection Page SEO Content + Metafield Filtering
*Brief Task 2 + Task 4 combined. Lowest-coverage area today.*

**Done**
- [x] Audited: no collection SEO content section exists. Current filters cover color/size/price (Shopify facets), no metafield-based age filter.

**Open**
- [ ] **You (Shopify Admin):** create `custom.age_range` product metafield definition (Single line text, choices: `2-6 years`, `7-12 years`, `All ages`).
- [ ] **You (Shopify Admin):** in Search & Discovery → Filters → add Age filter sourced from `custom.age_range`.
- [ ] Create `sections/collection-seo-content.liquid` — heading, intro richtext, up to 5 bullets, up to 3 FAQs, FAQPage JSON-LD at bottom. Brand colours `#1B3A5C` + `#FF7A3D`.
- [ ] Add section to `templates/collection.json` (default), `collection.kids-collection.json`, `collection.smart-ai-gadgets.json` — position: after the main grid.
- [ ] Verify `main-collection-template.liquid` renders metafield filters via the generic `collection.filters` loop. If gated, add a render branch for `filter.param_name == 'filter.p.m.custom.age_range'`.
- [ ] Preview a kids collection on staging → SEO content + FAQ visible; FAQ JSON-LD validates in Rich Results Test.
- [ ] Age filter renders, narrows products, chip + clear-all behave correctly.
- [ ] Stage push → preview → commit → await publish approval.

---

## Area 5 — Email Popup CRO
*Native theme popup only (not Klaviyo/Privy apps).*

**Done**
- [x] Audited: `sections/pnewsletter.liquid` triggers on time-delay only (`pnewletter_time_delay` setting, `pnewletter_time` cookie for 7-day cap). No scroll trigger, no WhatsApp alternate CTA.

**Open**
- [ ] Replace time-only trigger with scroll-60% trigger + 45s idle fallback; keep `pnewletter_time` cookie gate intact (7-day frequency cap preserved).
- [ ] Add WhatsApp alternate CTA inside popup body — `wa.me/971585156033?text=…` with the 10% discount prefill text. Match `+971 58 515 6033` already in homepage FAQ schema and `NAP_SUBMISSIONS.md`.
- [ ] Incognito QA on staging: no popup on load; appears at 60% scroll; idle 45s on a short page also triggers; close → no re-show for 7 days; WhatsApp link opens with prefilled message.
- [ ] Stage push → preview → commit → await publish approval.

---

## Area 6 — Arabic / RTL (do last among code areas — largest surface)
*Arabic confirmed already enabled in Admin and on UAE market.*

**Done**
- [x] Audited: hreflang appears only in language picker (`snippets/localization-language.liquid:39`). No `<head>` alternates from this theme. No RTL CSS in any asset.
- [x] Confirmed prerequisite: Arabic published in Settings → Languages and on UAE market.

**Open**
- [ ] Decision in Area 1: if Shopify auto-emits hreflang, do **not** add a manual block (avoids duplicates). If not, add the manual `<link rel="alternate" hreflang>` block in `theme.liquid` `<head>`.
- [ ] Add RTL CSS block to `assets/theme.css` (or main CSS), scoped to `html[dir="rtl"]`: `.page-width`, `.product__info-container`, `.collection-filters__list`, the unified sticky/payment/trust snippets from Area 3, `.icon-arrow` flip.
- [ ] `?locale=ar` staging QA: layout doesn't break on homepage / PDP / collection / cart; text flows right-to-left where flipped; no horizontal scroll.
- [ ] View source: confirm exactly one set of hreflang alternates (no duplicates from Shopify auto + manual).
- [ ] **Owner content task (out of code scope, flag only):** translate top 3 products (U-shaped toothbrush, drawing robot, foam toothpaste) — title, description, SEO title, SEO description, image alt text.
- [ ] Stage push → preview → commit → await publish approval.

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
git fetch origin && git checkout claude/gracious-knuth-LCmh0 && git pull

# 2. Push to staging (TT360 | Dev #145464754291)
npm run theme:push:staging

# 3. Preview
#    https://tiptop360.com?preview_theme_id=145464754291

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
