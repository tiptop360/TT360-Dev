# TipTop360 — Master Strategy & AI Agent Prompt

**Project:** tiptop360.com Shopify optimization
**Store:** zrhgzw-xt.myshopify.com
**Live theme:** TT360 | live — #145753800819
**Staging theme:** TT360 | Dev — #145784406131
**Owner:** Rabih Arabi
**Stack:** Shopify + OAuth Custom App + Node.js Optimizer + Anthropic Claude API + Pydantic AI + Cloudflare CDN

---

# Part 1 — Reusable AI Agent System Prompt

Copy this whole block when starting any future Claude session about TipTop360. It loads context instantly and locks behavior.

```
ROLE: You are an elite Shopify SEO/CRO/GEO/Performance engineer working on tiptop360.com (UAE kids/family e-commerce). The owner (Rabih Arabi) is technical, time-constrained, and Mac/terminal-comfortable but has limited tolerance for slow iteration.

PROJECT FACTS (always assume true unless told otherwise):
- Domain: tiptop360.com (Cloudflare-fronted)
- Shopify store: zrhgzw-xt.myshopify.com
- Live theme: #145753800819 ("TT360 | live") — MAIN
- Staging theme: #145784406131 ("TT360 | Dev") — push here first, validate, then promote to live
- Backup theme: #143636463731 ("TipTop360 | Live") — legacy unpublished rollback target
- Project dir: /Users/rabiharabi/tiptop360-optimizer/
- Node project (ES module — uses `"type":"module"` in package.json, so any inline scripts run as .cjs)
- 19 products, all with: SEO titles, meta descriptions, FAQ metafields, alt text 100% covered
- OAuth client_credentials flow used (no static SHOPIFY_ACCESS_TOKEN — exchange CLIENT_ID + CLIENT_SECRET → access_token at /admin/oauth/access_token)
- 70%+ traffic is mobile, UAE-based
- COD is a critical conversion driver — always preserve trust badges

CORE BEHAVIORAL RULES:
1. Token efficiency. User has explicitly demanded 90% token reduction. Replies must be terse, dense, no preamble, no fluff.
2. Bulk over iteration. Diagnose all issues at once with one script, then issue ONE fix script. Never 5 small back-and-forths.
3. Validate before push. Every theme push runs to duplicate first. Never `--allow-live` without explicit user approval.
4. Markdown corruption awareness. Pasting code into terminal sometimes converts dot-separated identifiers (e.g. `product.metafields.reviews.rating_count`) into Markdown links like `[product.metafields.reviews](http://product.metafields.reviews).rating_count`. ALWAYS prefer writing files via `cat > file << 'EOF' ... EOF` heredoc OR via `node -e` with proper escaping. After any heredoc-written Liquid file, run: `grep -c '\](http' filepath` — must return 0.
5. Cache awareness. tiptop360.com sits behind Cloudflare. Theme pushes show on `https://zrhgzw-xt.myshopify.com` immediately, but `tiptop360.com` lags 4-24h until Cloudflare cache expires. Always test BOTH URLs before declaring something broken. Use the Cloudflare API to purge when needed.
6. Backup before edit. Always `cp file file.bak` before any sed.
7. zsh quirks. Inline `node -e "..."` fails when content contains `!` (history expansion). Always write scripts to .cjs files in project root, not /tmp.
8. ES module vs CommonJS. Project package.json has `"type":"module"`. Use .cjs extension for require()-based scripts.

TOOL CONSTRAINTS:
- VS Code CLI not installed (no `code` command). Use sed for surgical edits.
- node-fetch v2 used (CommonJS-compatible) — import via `const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));`
- Anthropic SDK installed: `@anthropic-ai/sdk`
- Shopify CLI installed: `shopify theme push --store zrhgzw-xt.myshopify.com --theme 145784406131 --path ./theme-files --only <files>` (staging — TT360 | Dev). For live `--theme 145753800819 --allow-live` (TT360 | live).

STANDARD VALIDATION SEQUENCE (run after every push):
1. `grep -c '\](http' <touched files>` — must be 0 (no markdown corruption)
2. Pull live file from Shopify, diff against local — must MATCH
3. curl public URL with `?x=$RANDOM` cache-buster — confirm change visible
4. If public URL doesn't show change after 30s → Cloudflare cache → API purge

KNOWN PROJECT STATE (as of last session 2026-04-27):
- ✅ Schema live: Product, Organization, WebSite, Brand, Offer, FAQPage (per-product), ContactPoint
- ✅ H1 fix shipped (logo unwrapped from <h1>)
- ✅ Security headers: Referrer-Policy + Permissions-Policy added to theme.liquid
- ✅ Malware removed (githubfix.myshopify.com / component-3.0.96.js / fv-loading-icon injection in social-meta-tags.liquid)
- ✅ Trusted-shop image lazy-loaded with srcset across 5 templates
- ⚠️ AggregateRating schema not rendering despite metafield definitions being PUBLIC_READ — likely 24h propagation delay, retry next session
- ⏳ Cloudflare cache purge required after each push or wait 4-24h
- ⏳ Pending: 5 SEO blog posts, internal linking, Microsoft Clarity, GSC sitemap submission, performance round 2 (LCP <2.5s target)

OUTPUT FORMAT:
- Use minimal Markdown. Tables over paragraphs. Code blocks for ALL terminal commands.
- Never repeat instructions in subsequent replies. Assume context loaded.
- When user pastes terminal output, read it carefully — they expect quick diagnosis.
- If user says "stop iterating" or "bulk fix" — write ONE comprehensive script, not 3 small ones.
```

---

# Part 2 — Master Strategy (11 Phases)

## Operating Principles (apply to every phase)

1. Never push to live theme directly — duplicate → validate → publish
2. Always backup before edit (`*.bak` for theme files, `changes.json` for API changes)
3. Validate with Pydantic before Shopify API call
4. Regression-test before publish (homepage + 3 products + cart)
5. Cache the system prompt (`cache_control: ephemeral`) — saves 90% input token cost
6. Rate-limit: 1.5s between Shopify calls, 1s between Anthropic calls
7. Mobile-first — UAE traffic is 70%+ mobile
8. Surgical edits only — no bulk regex on Liquid
9. Cloudflare cache purge after every theme push to live
10. Token budget: max 1,200 output tokens per Anthropic call

---

## Phase 0 — Pre-Flight & Validation Framework

```bash
cd /Users/rabiharabi/tiptop360-optimizer
node optimizer.js audit
shopify theme pull --store zrhgzw-xt.myshopify.com --theme 145784406131 --path ./theme-files-clean-$(date +%Y%m%d)
node -v && shopify version
cat .env | grep -c "ANTHROPIC_API_KEY"  # must be 1
```

---

## Phase 1 — Pydantic AI Validation Setup

```bash
pip install pydantic pydantic-ai anthropic --break-system-packages
mkdir -p validators
```

Create `validators/pydantic_validator.py` with strict models:

- `MetaDescription`: 120-160 chars, contains primary_keyword, max 2 emojis
- `TitleTag`: 30-60 chars, must include "TipTop360"
- `FAQItem`: question 10-200 chars, ends with "?", answer 20-1500 chars
- `FAQSchema`: 3-10 FAQs per product
- `ProductDescription`: 2500-8000 chars, must have Why/FAQ/UAE/delivery sections
- `BlogPost`: 1200+ words, 4+ H2s, 2+ related products, 40-70 char title

Wire into optimizer.js — every AI output gets validated before Shopify API call.

---

## Phase 2 — Shopify Backend Cleanup

```bash
node optimizer.js scan-unused-files
node optimizer.js scan-metafields --dedupe
node optimizer.js cleanup-metafields --execute
node optimizer.js scan-tags --unused
node optimizer.js audit-redirects
```

Manual: Remove apps unused 30+ days. Each app injects scripts on every page load.

---

## Phase 3 — Technical SEO

```bash
node optimizer.js audit-canonicals
node optimizer.js audit-schema --type=Product
node optimizer.js fix-schema --type=Product --execute
node optimizer.js apply faq-schema --execute
node optimizer.js audit-alt-text
node optimizer.js fix-alt-text --execute
```

Manual: Submit sitemap to Google Search Console + Bing Webmaster.

Validate via Google Rich Results Test on top 5 products: https://search.google.com/test/rich-results

---

## Phase 4 — On-Page SEO

```bash
node optimizer.js audit-titles
node optimizer.js audit-metas
node optimizer.js preview-description toothbrush
open preview-toothbrush.html
node optimizer.js apply descriptions
node optimizer.js audit-headings
node optimizer.js audit-internal-links
node optimizer.js suggest-internal-links
node optimizer.js audit-handles
```

5 SEO blog posts (1500+ words each):
```bash
node optimizer.js generate-blog --topic="Best Kids Electric Toothbrush UAE 2026"
node optimizer.js publish-blog --file=blog-drafts/best-kids-electric-toothbrush-uae-2026.md
```

---

## Phase 5 — GEO / AEO Optimization

```bash
node optimizer.js generate-llms-txt
node optimizer.js add-author-schema --pages=blog
node optimizer.js rewrite-for-aeo --target=top-3-products
node optimizer.js audit-nap
```

Manual:
- Google Business Profile (https://business.google.com)
- UAE directories: Yellowpages.ae, Connect.ae, Dubaini.com, UAE-listings.com, yelu.ae
- WhatsApp Business Catalog (add 19 products)

---

## Phase 6 — CRO Optimization

```bash
node optimizer.js audit-trust
node optimizer.js audit-atf --top=5
node optimizer.js audit-reviews
node optimizer.js audit-sticky-atc
node optimizer.js audit-forms
```

Manual setups:
- **Klaviyo** — cart abandonment 3-email series
- **ReConvert** — post-purchase upsell (15% off, 10 min validity)
- **Privy** — exit-intent popup (10% off for email)

---

## Phase 7 — Performance

```bash
node optimizer.js perf-baseline
node optimizer.js audit-lazy-loading
node optimizer.js audit-render-blocking
node optimizer.js fix-render-blocking --execute
node optimizer.js audit-fonts
node optimizer.js fix-font-display --execute
node optimizer.js inline-critical-css
node optimizer.js audit-image-formats
node optimizer.js audit-third-party
node optimizer.js perf-compare --baseline=audits/perf-baseline.json
```

Targets: Mobile PageSpeed 75+, LCP <2.5s, CLS <0.1, TBT <200ms.

---

## Phase 8 — Mobile UX

```bash
node optimizer.js audit-tap-targets
grep "viewport" theme-files/layout/theme.liquid  # must have width=device-width, scale=5
node optimizer.js audit-mobile-images
```

Manual: Real-device test on iPhone + Android. Walk full purchase flow.

---

## Phase 9 — Measurement & Monitoring

- **Microsoft Clarity** (free) — heatmaps, session recordings, rage-click detection
  Setup: clarity.microsoft.com → New project → paste tracking script before `</head>`
- **GSC + Bing Webmaster** — weekly check (10 min)
- **Conversion rate tracking** — Shopify Admin → Analytics
- **Uptime monitoring** — cron + curl
- **Daily audit cron**:
  ```bash
  echo '0 9 * * * cd /Users/rabiharabi/tiptop360-optimizer && node optimizer.js audit --quiet --alert-on-regression' | crontab -
  ```

---

## Phase 10 — Maintenance Loop

Weekly (15 min):
```bash
node optimizer.js audit-weekly
```

Monthly (1 hour):
```bash
node optimizer.js audit-full
node optimizer.js perf-compare --baseline=audits/perf-baseline.json
node optimizer.js generate-monthly-report
```

New product onboarding:
```bash
node optimizer.js onboard-new-product --handle=<new-handle>
```

Quarterly content refresh:
```bash
node optimizer.js refresh-stale-content --threshold=90d
```

---

# Part 3 — Standard Operating Procedures (SOPs)

## SOP 1 — Edit a Liquid file safely

```bash
# 1. Backup
cp theme-files/<path> theme-files/<path>.bak

# 2. Edit (use sed OR node-write to avoid clipboard markdown corruption)
sed -i '' 's|OLD|NEW|g' theme-files/<path>
# OR
node -e "const fs=require('fs'); const c=fs.readFileSync('theme-files/<path>','utf8'); fs.writeFileSync('theme-files/<path>', c.replace(/OLD/g,'NEW'));"

# 3. Verify no markdown corruption
grep -c '\](http' theme-files/<path>  # must be 0

# 4a. Push to staging first (TT360 | Dev — no --allow-live needed)
shopify theme push --store zrhgzw-xt.myshopify.com --theme 145784406131 --path ./theme-files --only <path>

# 4b. Once staging QA passes, promote to live (TT360 | live)
shopify theme push --store zrhgzw-xt.myshopify.com --theme 145753800819 --path ./theme-files --only <path> --allow-live

# 5. Verify pushed file matches local
mkdir -p /tmp/v
shopify theme pull --store zrhgzw-xt.myshopify.com --theme 145753800819 --only <path> --path /tmp/v
diff theme-files/<path> /tmp/v/<path>

# 6. Purge Cloudflare
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/purge_cache" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# 7. Verify on public URL
sleep 30
curl -s "https://tiptop360.com/?x=$RANDOM" | grep <expected_marker>
```

## SOP 2 — Use OAuth client_credentials in Node script

```javascript
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;

async function getToken() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });
  return (await r.json()).access_token;
}
```

Save script as `.cjs` (project uses ES modules). Run from project root (needs node_modules).

## SOP 3 — Cloudflare cache purge

> Full Cloudflare + Klaviyo strategy (branded sending domain, DMARC, cache rules, WAF): see **docs/CLOUDFLARE_KLAVIYO_STRATEGY.md**. DNS automation: `npm run cf:dns:plan` / `cf:dns:apply` / `cf:dns:verify`.

```bash
echo -n "Cloudflare API Token: "
read CF_TOKEN
echo -n "Zone ID: "
read CF_ZONE
echo "CF_TOKEN=$CF_TOKEN" >> .env
echo "CF_ZONE=$CF_ZONE" >> .env

curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/purge_cache" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

API token: dash.cloudflare.com → My Profile → API Tokens → Create Token (permissions: Zone → Cache Purge → Purge).
Zone ID: dash.cloudflare.com → tiptop360.com → right sidebar.

## SOP 4 — Detect & remove malware injection

```bash
# Scan
grep -rln "endcomment %}.*<style\|endcomment %}.*<script\|fv-loading-icon\|mainBodyContainer\|component-[0-9]\.[0-9]" theme-files/ 2>/dev/null | grep -v "\.bak\|MALWARE\|\.min\."
grep -rln "data:text/css;base64" theme-files/ 2>/dev/null | grep -v "\.bak\|MALWARE\|\.min\."
grep -rEln "[a-z]+\.myshopify\.com" theme-files/ 2>/dev/null | grep -v "zrhgzw-xt\|\.bak\|MALWARE\|\.min\."

# If found, backup + clean
cp <infected-file> <infected-file>.MALWARE.bak
# Manually rewrite via node -e (NOT clipboard) to avoid re-injection of markdown corruption

# Push + Cloudflare purge + verify
```

## SOP 5 — Bulk-fix images across templates

```bash
cat > fix-imgs.cjs << 'FIXEOF'
const fs = require('fs');
const files = ['theme-files/templates/index.json', /* etc */];
const oldImg = '<img src="..." style="width: 100%;...">';
const newImg = '<img src="..." srcset="..." loading="lazy" decoding="async" width="600" height="600" sizes="(max-width: 768px) 90vw, 600px" style="...max-width: 600px;...">';

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.split(oldImg).join(newImg);
  fs.writeFileSync(f, c);
});
FIXEOF
node fix-imgs.cjs
```

---

# Part 4 — Master Validation Loop

Run after EVERY change. Save as `validation_loop.sh`:

```bash
#!/bin/bash
set -e

# 1. Pydantic
python validators/pydantic_validator.py meta_description audits/latest-metas.json
python validators/pydantic_validator.py title_tag audits/latest-titles.json
python validators/pydantic_validator.py product_description audits/latest-descriptions.json
python validators/pydantic_validator.py faq_schema audits/latest-faqs.json

# 2. Theme check
shopify theme check --path ./theme-files

# 3. Liquid check
node optimizer.js validate-liquid

# 4. No markdown corruption
! grep -rln '\](http' theme-files/snippets/ theme-files/sections/ theme-files/layout/ 2>/dev/null

# 5. No malware patterns
! grep -rln "fv-loading-icon\|component-3\.0\|githubfix" theme-files/ 2>/dev/null | grep -v "\.bak"

# 6. Schema check
node optimizer.js validate-schemas

# 7. Sitemap reachability
curl -sf https://tiptop360.com/sitemap.xml > /dev/null

echo "✅ All validations passed"
```

---

# Part 5 — Regression Test Suite

Save as `regression_test.sh`:

```bash
#!/bin/bash
set -e
URL="https://tiptop360.com"
P="$URL/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift"

# Homepage
curl -sf "$URL/" > /tmp/h.html
grep -q "TipTop360" /tmp/h.html || { echo "❌ Brand missing"; exit 1; }
[ "$(grep -c '<h1\b' /tmp/h.html)" = "1" ] || { echo "❌ H1 count != 1"; exit 1; }
grep -q "Referrer-Policy" /tmp/h.html || { echo "❌ Referrer-Policy missing"; exit 1; }
! grep -q "fv-loading-icon\|component-3\.0\|githubfix" /tmp/h.html || { echo "❌ Malware detected"; exit 1; }

# Product
curl -sf "$P" > /tmp/p.html
grep -q "Add to Cart\|Add to cart" /tmp/p.html || { echo "❌ ATC missing"; exit 1; }
grep -q '"@type":"FAQPage"' /tmp/p.html || { echo "❌ FAQPage missing"; exit 1; }
grep -q '"@type":"Product"' /tmp/p.html || { echo "❌ Product schema missing"; exit 1; }
grep -q '"@type":"Organization"' /tmp/p.html || { echo "❌ Org schema missing"; exit 1; }

# Infrastructure
curl -sf "$URL/sitemap.xml" > /dev/null || exit 1
curl -sf "$URL/robots.txt" | grep -q "Sitemap" || exit 1
! grep -i "Liquid error" /tmp/h.html /tmp/p.html

echo "✅ All regression tests passed"
```

---

# Part 6 — Rollback Playbook

## Scenario A — Visual break

```bash
cp -r ./theme-files-clean-YYYYMMDD/* ./theme-files/
shopify theme push --store zrhgzw-xt.myshopify.com --theme 145753800819 --path ./theme-files --allow-live
```

## Scenario B — Bad AI-generated content

```bash
node optimizer.js revert-descriptions --to=changes.json
node optimizer.js revert-metas --to=changes.json
node optimizer.js revert-titles --to=changes.json
```

## Scenario C — Site down (nuclear)

Shopify Admin → Themes → "TipTop360 | Live" #143636463731 (legacy backup) → Actions → **Publish**. If unavailable, fall back to most recent known-good staging snapshot from "TT360 | Dev" #145784406131.

## Scenario D — Malware re-detected

```bash
git diff HEAD~1 theme-files/  # see what changed
# Identify infected files, restore from .bak or theme-files-clean-YYYYMMDD/
```

---

# Part 7 — Cost Optimization Rules

## Anthropic API

- **Haiku 4.5** for: routing, classification, validation, simple rewrites
- **Sonnet 4.7** for: product descriptions, blog posts, FAQ generation
- **Opus**: never use (too expensive vs quality gain)
- Cache system prompt in EVERY call: `cache_control: ephemeral`
- Stop sequences: `["</json>", "END"]` to cut off early
- `max_tokens: 1200` (long-form blog: 2400)
- `temperature: 0` (blog content: 0.3)

## Estimated total cost for full 19-product implementation

- System prompt cached: ~5k tokens, then 90% off subsequent calls
- Per-product gen: ~800 in + 1k out tokens
- **Total: <$5 USD for full site**
- Daily monitoring audit: <$0.10 USD

---

# Part 8 — Phase Completion Tracker

- [x] Phase 0 — Pre-flight
- [x] Phase 1 — Pydantic AI validation (designed, integration pending)
- [ ] Phase 2 — Shopify backend cleanup
- [x] Phase 3 — Technical SEO (mostly done — Schema, Alt, Sitemap)
- [x] Phase 4 — On-page SEO (titles, metas, FAQ done — blog posts pending)
- [ ] Phase 5 — GEO/AEO
- [ ] Phase 6 — CRO
- [/] Phase 7 — Performance (malware removed, image lazy-load done — round 2 pending)
- [ ] Phase 8 — Mobile UX
- [ ] Phase 9 — Measurement & monitoring (Clarity setup pending)
- [ ] Phase 10 — Maintenance loop (cron not set yet)

---

# Part 9 — Next Session Pickup Plan

## Priority 1 — Verify production after Cloudflare purge
```bash
node final-test.cjs
```
All 18 checks should pass. If not, investigate per check.

## Priority 2 — AggregateRating schema
Wait 24h after metafield definition update for Shopify to propagate. If still not rendering:
- Option A: Install Judge.me app blocks (handles automatically)
- Option B: Install Loox.io (also injects natively)
- Option C: Read review widget HTML, extract rating, render manually via Liquid `parse_json`

## Priority 3 — PageSpeed re-test
Now malware removed + images lazy-loaded:
```bash
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Ftiptop360.com&strategy=mobile&category=performance&key=$PSI_KEY" > /tmp/psi.json
```
Target: Performance >75, LCP <2.5s, TBT <200ms.

## Priority 4 — Microsoft Clarity setup (5 min)
clarity.microsoft.com → New project → paste tracking script before `</head>` in theme.liquid → push.

## Priority 5 — GSC + Bing sitemap submission (5 min, manual)
- search.google.com/search-console → tiptop360.com → Sitemaps → submit `sitemap.xml`
- bing.com/webmasters → Import from GSC

## Priority 6 — 5 SEO blog posts (1 hour)
Topics:
1. "Best Kids Electric Toothbrush UAE 2026"
2. "How to Choose Safe Toys for Toddlers in UAE"
3. "Top 10 Educational Gifts for Kids in Dubai"
4. "Sustainable Kids Products: A Parent's Guide"
5. "School Supplies Checklist UAE 2026"

Generate with Sonnet, validate with Pydantic `BlogPost` model, publish.

## Priority 7 — Internal linking optimization
```bash
node optimizer.js suggest-internal-links
```

## Priority 8 — Performance round 2
Address remaining LCP killers (post-malware):
- Defer 3rd-party scripts (jQuery, Klaviyo, GTM)
- Inline critical CSS
- Hero image preload optimization
- Reduce unused CSS (66 KiB savings identified)

---

# Part 10 — Critical Files Reference

| File | Purpose |
|---|---|
| `optimizer.js` | Main CLI menu + OAuth flow |
| `optimize-local.js` | Local dev counterpart |
| `keywords.js` | 19 product keyword mappings |
| `shopify.app.toml` | Custom app config (6 scopes) |
| `.env` | SHOPIFY_STORE, CLIENT_ID, CLIENT_SECRET, ANTHROPIC_API_KEY, CF_TOKEN, CF_ZONE |
| `theme-files/` | Theme source (synced with TT360 | Dev #145784406131 staging, promoted to TT360 | live #145753800819) |
| `theme-files-clean-YYYYMMDD/` | Date-stamped clean backups |
| `local-backups/` | Per-fix change logs |
| `validators/pydantic_validator.py` | All AI output validation |
| `alt-audit.cjs` | Audit product image alt text |
| `find-reviews.cjs` | Enumerate product metafields |
| `bulk-fix.cjs` | Storefront access on metafield definitions |
| `full-audit.cjs` | Full SEO audit report |
| `final-test.cjs` | Regression validation runner |
| `fix-imgs.cjs` | Bulk image lazy-load injection |

---

# Part 11 — Common Pitfalls (Hard-Won Lessons)

1. **Markdown corruption on paste.** Pasting `product.metafields.foo.bar` sometimes becomes `[product.metafields.foo](http://product.metafields.foo).bar` — breaks Liquid silently. Always check `grep -c '\](http' file` after editing.

2. **zsh history expansion.** `node -e "..."` with `!` in code → `zsh: event not found`. Always write to `.cjs` file in project root.

3. **/tmp lacks node_modules.** Scripts using `require('dotenv')` fail in /tmp. Always run from project root.

4. **Project uses ES modules.** `.js` files require `import`. Use `.cjs` extension for CommonJS scripts.

5. **No SHOPIFY_ACCESS_TOKEN in .env.** Project uses OAuth client_credentials flow — exchange CLIENT_ID + CLIENT_SECRET → access_token at runtime.

6. **Cloudflare cache lag.** Theme push goes live in Shopify immediately, but tiptop360.com lags 4-24h. Always test BOTH `https://zrhgzw-xt.myshopify.com` AND `https://tiptop360.com` before declaring broken. Use Cloudflare API to purge.

7. **Shopify edge cache.** Even direct Shopify URL caches at edge. Sometimes needs Admin → Theme info → Save to force invalidation.

8. **Storefront metafield access.** Even with definition `PUBLIC_READ`, classic JSON-typed metafields (Judge.me legacy) sometimes lag 24h before Liquid sees them.

9. **`<meta>` tags in body.** Shopify HTML sanitizer strips `<meta>` tags rendered outside `<head>` — use `<script>` for debug markers in body context.

10. **Theme.liquid render order.** `{%- render 'product-schema-extra' -%}` inside `{% unless product == empty %}` runs late (after main product content). Schema works regardless, but place at top of body for predictability.

11. **`code` command not installed.** No VS Code CLI. Use sed for surgical edits.

12. **`git` not installed.** No version control. Manual `*.bak` backups + Shopify theme history are the rollback options.

---

**End of Master Strategy Document.**

Save this file to `/Users/rabiharabi/tiptop360-optimizer/STRATEGY.md` for reference in every future session.
