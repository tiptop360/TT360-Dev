# TipTop360 — Hero Products Execution Plan

**Status:** PLAN ONLY — nothing executed. Solid, end-to-end fix list for review/sign-off before any change ships.
**Store:** zrhgzw-xt.myshopify.com · **Live theme:** #145031200883 · **Backup theme:** #143636463731
**Hero products:** AIVOX (drawing robot) · GymBag (magnetic gym bag)
**Baseline (repo audit):** Overall **3.3/10** — SEO 4 · GEO 2 · CRO 3 · Mobile 5 · UX 3 · Keywords 3

---

## 0. Guardrails (apply to EVERY task — non-negotiable)

- [ ] **Backup before edit** — `cp <file> <file>.bak` (theme) / snapshot `changes.json` (API) before any write
- [ ] **Validate before push** — push to a *duplicate/staging* theme first; pull live → diff → must MATCH
- [ ] **Never `--allow-live` without explicit owner approval** for each push
- [ ] **No markdown corruption** — after any heredoc/clipboard write run `grep -c '\](http' <file>` → must be `0`
- [ ] **No fabricated proof** — never invent reviews, ratings, or specs (see PHASE2_PLAN H-1); real UGC only
- [ ] **Mobile-first** — 70%+ traffic is UAE mobile; verify every change on a phone viewport
- [ ] **Cloudflare lag** — test BOTH `zrhgzw-xt.myshopify.com` AND `tiptop360.com`; purge CF cache after live push
- [ ] **Surgical edits only** — no bulk regex on Liquid; one diagnostic pass, one fix script
- [ ] **Rollback ready** — clean theme backup dated; nuclear = republish backup theme #143636463731

---

## 1. Track A — HERO PRODUCT PDPs (highest priority)

### A1. AIVOX PDP (`aivox-pdp.liquid`)
- [ ] Audit current live state: H1 count (must be 1), schema present, countdown behaviour, lightbox, qty selector, scroll-jump
- [ ] Verify Product + Offer + FAQPage JSON-LD valid (Google Rich Results Test) and matches visible copy
- [ ] Confirm price/availability/currency (AED) in Offer schema are correct and dynamic, not hardcoded
- [ ] Copy: clear benefit-led H1, "Why / How it works / FAQ / UAE delivery" sections, fact-first quotable lines
- [ ] CRO: sticky Add-to-Cart on mobile, trust pills (COD · next-day UAE · 14-day damaged/faulty return) wrap cleanly
- [ ] Remove/replace any "limited time" urgency that reads cheap; keep countdown only if genuine
- [ ] Performance: hero image preload + correct LCP target, below-fold images lazy + width/height (CLS)
- [ ] Regression: ATC works, no Liquid errors, no scroll-jump, lightbox + qty functional on mobile + desktop

### A2. GymBag PDP (`gymbag-full-rebuild.cjs` / `deploy-gymbag-pdp.cjs`)
- [ ] Same PDP checklist as A1 (H1, schema, copy sections, sticky ATC, trust pills, perf, regression)
- [ ] Reconcile PHASE2_PLAN items: M-2 price framing ✅, M-4 return mechanics ✅, H-2 magnet-safety ✅ already live — verify still present
- [ ] **H-1 social proof — OPEN:** do NOT publish invented reviews. Pick a legitimate path:
  - [ ] Klaviyo post-delivery review request (tools connected) — draft + owner approval to send
  - [ ] Format real WhatsApp/DM quotes (with permission) into review cards
  - [ ] Install Judge.me/Loox free tier for verified-buyer collection
  - [ ] Add hold-strength demo clip (no testimonial needed) — needs owner asset
- [ ] Confirm capacity/spec copy is honest (no neodymium claim, no warranty implied)

### A3. Cross-PDP consistency
- [ ] Shared snippets (countdown, FAQ schema, lightbox, qty) behave identically on both heroes
- [ ] Both PDPs pass `regression-geo.sh` / `final-test.cjs` checks

---

## 2. Track B — Homepage & Landing (audit: UX 3/10, CRO 3/10)

- [ ] Exactly one H1: keyword-led (e.g. "Premium Kids Products & Toys — Fast UAE Delivery")
- [ ] Meta description with target keywords + CTA (120–160 chars)
- [ ] Above-the-fold CTA ("Shop Bestsellers" / "Explore Collections") + visible category nav
- [ ] Trust badges below fold: secure payment · 1–3 day delivery · easy returns
- [ ] Fix visual hierarchy: tone down orange "LIMITED TIME" banner fighting the hero
- [ ] Homepage `FAQPage` schema grounded in real store facts (verified policy only)
- [ ] H2/H3 hierarchy for value props + product/collection blocks

---

## 3. Track C — Technical SEO / Schema (audit: SEO 4/10)

- [ ] Audit canonicals across templates (`node optimizer.js audit-canonicals`)
- [ ] One clean Organization + one WebSite node in `theme.liquid` `@graph` — no duplicates
- [ ] Product schema on all ~19 products: price, availability, currency, brand, image
- [ ] FAQPage schema per product (verify rendering, not just metafield definition)
- [ ] AggregateRating: resolve Judge.me propagation OR render manually from real review data (never fabricate)
- [ ] 100% image alt-text coverage; fix known "gids" typo (SESSION_CONTEXT)
- [ ] Internal linking between related products/collections (`suggest-internal-links`)
- [ ] Submit sitemap to GSC + Bing; validate top 5 products in Rich Results Test

---

## 4. Track D — GEO / AEO (audit: GEO 2/10 — biggest gap)

- [ ] `llms.txt` live + valid (Pydantic) — confirm current 130-URL version still serving
- [ ] Author schema on blog posts (`add-author-schema --pages=blog`)
- [ ] AEO rewrite of top-3 products: fact-first, quotable answers matching schema + visible copy
- [ ] NAP consistency audit (`audit-nap`) against `NAP_SUBMISSIONS.md`
- [ ] E-E-A-T: real About Us depth (founder story, UAE trust signals) — no invented press/endorsements

---

## 5. Track E — CRO / Trust (audit: CRO 3/10 — Critical)

- [ ] Sticky ATC sitewide on PDPs (flagged biggest CRO win in SESSION_CONTEXT)
- [ ] Trust block standardised: COD · payment security · delivery window · return policy
- [ ] Exit-intent / email capture (Privy or native) — 10% offer, honest terms
- [ ] Cart abandonment 3-email series (Klaviyo — connected)
- [ ] Post-purchase upsell (ReConvert) — optional, after core CRO

---

## 6. Track F — Performance / Core Web Vitals (audit: Mobile load Critical)

- [ ] Perf baseline capture (PageSpeed mobile) for homepage + both hero PDPs
- [ ] Compress all hero images < 200KB; serve responsive `srcset` + width/height
- [ ] LCP preload targets the *actual* LCP image; below-fold = lazy
- [ ] Defer 3rd-party JS (jQuery, Klaviyo, GTM); remove duplicate vendor scripts
- [ ] Inline critical CSS; cut identified unused CSS (~66 KiB)
- [ ] **Targets:** Mobile PageSpeed 75+ · LCP < 2.5s · CLS < 0.1 · TBT < 200ms

---

## 7. Track G — Mobile UX (audit: Mobile 5/10)

- [ ] Tap targets ≥ 48px (badges, qty, ATC)
- [ ] Body text ≥ 16px on mobile
- [ ] Real-device walk of full purchase flow (iPhone + Android)
- [ ] Confirm no horizontal scroll / overflow on hero PDPs

---

## 8. Track H — Measurement & Monitoring

- [ ] Microsoft Clarity installed (heatmaps, rage-click) before `</head>`
- [ ] GA4 + Shopify Analytics conversion tracking verified (see GTM_FIX.md)
- [ ] GSC + Bing weekly check cadence
- [ ] Daily audit cron (`optimizer.js audit --alert-on-regression`)

---

## 9. Track I — Content / Blog (medium-term)

- [ ] 5 SEO posts (1500+ words, validated by Pydantic BlogPost): kids toothbrush, safe toys, educational gifts, sustainable products, school supplies — all UAE-framed
- [ ] Internal-link each post to relevant hero/collection pages

---

## 10. Track J — Off-site / Directories (manual)

- [ ] Google Business Profile
- [ ] UAE directories: Yellowpages.ae, Connect.ae, Dubaini.com, yelu.ae (consistent NAP)
- [ ] WhatsApp Business Catalog (all products)

---

## 11. Sequenced Execution Order (recommended)

1. **Phase 1 — Stabilise heroes:** Track A audit + schema/regression on AIVOX + GymBag (no copy risk)
2. **Phase 2 — Hero CRO + copy:** sticky ATC, trust pills, honest copy, GymBag H-1 review path (owner input)
3. **Phase 3 — Homepage:** H1, meta, CTA, FAQ schema, hierarchy (Track B)
4. **Phase 4 — Site-wide SEO/Schema:** Track C across 19 products
5. **Phase 5 — Performance:** Track F (heroes first, then site)
6. **Phase 6 — GEO/AEO + Mobile:** Tracks D + G
7. **Phase 7 — Measurement live:** Track H
8. **Phase 8 — Content + off-site:** Tracks I + J

---

## 12. Validation Gate (run after every change — from STRATEGY §Validation Loop)

- [ ] `grep -rln '\](http' theme-files/` → none (markdown corruption)
- [ ] `grep -rln "fv-loading-icon\|component-3\.0\|githubfix" theme-files/` → none (malware)
- [ ] `shopify theme check --path ./theme-files` → clean
- [ ] `bash regression-geo.sh` / `node final-test.cjs` → all checks pass
- [ ] Schema valid (Rich Results) · sitemap reachable · ONE H1 per page
- [ ] Public URL shows change (cache-buster) on both Shopify + tiptop360.com after CF purge

---

## 13. Open Inputs Needed From Owner (blockers)

- [ ] GymBag **real reviews** — choose legitimate path (Klaviyo / real quotes / widget / demo clip)
- [ ] Hold-strength demo clip + flat-lay "what fits" asset (GymBag)
- [ ] Approval to push each change to **live** theme (`--allow-live`)
- [ ] Cloudflare token/zone confirmation for cache purge (if not in `.env`)

---

## 14. Rollback Playbook (if anything breaks)

- **Visual break:** restore dated `theme-files-clean-*` → push
- **Bad AI copy:** `optimizer.js revert-descriptions/metas/titles --to=changes.json`
- **Site down (nuclear):** Admin → publish backup theme #143636463731
- **Malware re-detected:** `git diff HEAD~1 theme-files/` → restore `.bak`
