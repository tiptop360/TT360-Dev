# Cloudflare Strategy for TipTop360 — Klaviyo-Optimized

> **Owner:** TipTop360 ops · **Domain:** `tiptop360.com` · **Platform:** Shopify (`tiptop360.myshopify.com`) behind Cloudflare
> **Status:** Strategy + runbook. Apply with `scripts/cf-dns-apply.mjs`, verify with `scripts/cf-dns-verify.mjs`.

This document turns Cloudflare from a "cache layer that causes lag" into a deliverability, performance, and security asset — with the **Klaviyo branded sending domain (`send.tiptop360.com`) as the headline win**.

---

## 0. The #1 governing rule (read this first)

> **Every email / Klaviyo CNAME must be DNS-only ("grey cloud"), NEVER proxied ("orange cloud").**

Records for DKIM, the return-path/bounce host, and the branded click-tracking domain must resolve **directly to Klaviyo**, not through Cloudflare's proxy IPs. If you leave the orange cloud on, Klaviyo's domain verification fails and your email authentication breaks. The apply script (`scripts/cf-dns-apply.mjs`) **refuses** to set `proxied: true` on any email/Klaviyo record, and the verify script flags any that resolve to Cloudflare IPs.

Proxy summary:

| Record kind | Proxy (Cloudflare cloud) |
|---|---|
| Apex `tiptop360.com` / `www` → Shopify | **Orange (proxied)** — for cache, WAF, bots |
| `send.tiptop360.com` + DKIM + return-path | **Grey (DNS-only)** |
| Branded click-tracking host → Klaviyo | **Grey (DNS-only)** |
| `_dmarc` / SPF / DKIM TXT records | TXT records are never proxied (N/A) |

---

## 1. Architecture

```
 Web traffic:
   Visitor ──▶ Cloudflare (orange, proxied) ──▶ Shopify (tiptop360.myshopify.com)
                 │  cache rules / WAF / bots / SSL Full(Strict)

 Email (the Klaviyo win):
   Klaviyo ──▶ send.tiptop360.com (grey, DNS-only) ──▶ Inbox
                 │  DKIM signed · return-path aligned · DMARC passes
   Clicks  ──▶ tracking.tiptop360.com (grey) ──▶ Klaviyo link tracking
```

**Prerequisite:** Cloudflare must be the *authoritative DNS* for `tiptop360.com` (the domain's nameservers point at Cloudflare). Confirm in Cloudflare dashboard → the zone shows **Active**, and at your registrar the nameservers are the two `*.ns.cloudflare.com` Cloudflare assigned. If DNS still lives at the registrar, move it to Cloudflare first — none of the records below take effect otherwise.

---

## 2. Klaviyo branded sending domain — `send.tiptop360.com` *(headline)*

### Why this is the biggest lever
By default Klaviyo sends from a shared domain and recipients see "via klaviyomail.com". A **branded/dedicated sending domain** means:
- Email is **DKIM-signed as `tiptop360.com`** → authentication *aligns* with your From address.
- The **return-path (bounce) domain aligns** → SPF aligns too.
- Aligned SPF **or** DKIM is exactly what **DMARC** needs to pass (Section 3).
- Inbox providers attribute your sending reputation to *your* domain, not a shared pool → better placement, fewer Promotions/Spam landings, higher open & click rates on every flow you already run (newsletter, abandoned cart, post-delivery review).

### Dedicated vs shared — which to pick
- **Shared sending domain (Klaviyo default branded option):** fine below ~**5,000–10,000 sends/month** or inconsistent volume. Still gives you DKIM/return-path alignment under `tiptop360.com`. **Start here unless you already send high volume.**
- **Dedicated sending domain / dedicated IP:** worth it at **sustained high volume** (roughly **100k+ emails/month** for a dedicated IP). Requires deliberate warm-up. Don't take a dedicated IP at low volume — an under-warmed dedicated IP *hurts* deliverability.

### How to generate the records

#### Option A — Automated (browser agent, recommended — eliminates copy-paste errors)
`scripts/klaviyo-cf-automation.mjs` drives the whole flow so no DNS value is ever typed by hand.

It can apply the records two ways:
- **`--cf-mode api`** *(default, most reliable):* Playwright scrapes Klaviyo's records, then the Cloudflare **API** writes them (with the grey-cloud guard). Fewer moving parts.
- **`--cf-mode ui`** *(full browser automation):* Playwright also drives the **Cloudflare dashboard** to create each record, explicitly setting email records to DNS-only. End-to-end browser, but more brittle (dashboard markup + bot checks) — use when you specifically want zero API tokens.

**Local first-time setup:**
```bash
npm install
npx playwright install chromium
cp scripts/cf-dns.config.example.json scripts/cf-dns.config.json   # SPF/DMARC defaults
# for --cf-mode api: set CF_ZONE and CF_API_TOKEN (Zone->DNS->Edit) in .env
npm run klaviyo:login        # headed browser, sign in to Klaviyo + 2FA once (session saved)
npm run cf:login             # only needed for --cf-mode ui: sign in to Cloudflare once
npm run klaviyo:run          # scrape -> apply -> wait -> verify   (add: -- --cf-mode ui)
```
- Every step writes a screenshot/HTML to `.klaviyo-automation/` as an audit trail.
- If a dashboard's markup shifted, copy `scripts/klaviyo-automation.config.example.json` → `klaviyo-automation.config.json` and adjust URLs/selectors.
- Granular: `npm run klaviyo:extract`, `npm run cf:dns:apply` (api) or `npm run cf:ui:apply` (ui), `npm run klaviyo:verify`. Preview with `npm run klaviyo:run -- --no-apply`.

**CI (headless, non-interactive):** see `.github/workflows/klaviyo-sending-domain.yml`. Log in once locally, export the sessions as base64 (`npm run session:b64 -- klaviyo`, `npm run session:b64 -- cloudflare`), store them plus `CF_ZONE`/`CF_API_TOKEN` as repo secrets, then trigger the workflow. Note: dashboard sessions are short-lived and IP-bound, so CI runs may need a fresh exported session periodically.

#### Option B — Manual
1. Klaviyo → **Settings → Domains & hosting** (a.k.a. *Domains*).
2. Click **Add a sending domain** / **Set up dedicated sending domain** and enter `send.tiptop360.com`.
3. Klaviyo displays a set of **CNAME records** with exact targets. **These targets are unique to your account — copy them.**
4. Paste each into `scripts/cf-dns.config.json` (copy from `cf-dns.config.example.json`), then run `npm run cf:dns:apply`.
5. Return to Klaviyo and click **Verify**. DNS can take minutes to a few hours to propagate.

### Records to add (all CNAME, **grey cloud / DNS-only**)
> Exact target hostnames come from the Klaviyo wizard. Names below are the typical Klaviyo pattern — match what your wizard shows.

| Name | Type | Value (from Klaviyo) | Proxy | Purpose |
|---|---|---|---|---|
| `kl._domainkey.send` | CNAME | `dkim2.klaviyomail.com` (example) | **DNS-only** | DKIM signing key |
| `kl2._domainkey.send` | CNAME | `dkim3.klaviyomail.com` (example) | **DNS-only** | DKIM second selector (if shown) |
| `send` | CNAME | `bounce.klaviyomail.com` (example) | **DNS-only** | Return-path / bounce alignment |
| `tracking` | CNAME | `clicks.klaviyomail.com` (example) | **DNS-only** | Branded click/link-tracking domain |

> The branded **click-tracking** domain is configured under Klaviyo → Settings → Domains → *Link tracking / web tracking*. Branding it (rather than using `*.klclick.com`) keeps every link in your emails on a `tiptop360.com` subdomain — better trust and consistency. **It must also be grey-cloud.**

### Deliverability hygiene checklist (this is what makes the branded domain pay off)
- [ ] **Double opt-in** (or strong single opt-in with confirmation) on all Klaviyo signup forms — protects list quality.
- [ ] **Domain warm-up** if dedicated: ramp volume gradually over 2–4 weeks, starting with your most-engaged subscribers.
- [ ] **Sunset / suppression flow:** stop emailing profiles with no engagement in ~90–120 days; let them re-opt-in.
- [ ] **Smart Sending** enabled to avoid over-mailing.
- [ ] **Honor suppressions/bounces** automatically (Klaviyo does this — don't re-import bounced addresses).
- [ ] Keep **spam-complaint rate < 0.1%** and **bounce rate < 2%**.
- [ ] Add an unmistakable **unsubscribe link** + physical address in the footer (also required for DMARC/CAN-SPAM/GDPR alignment).

---

## 3. SPF / DKIM / DMARC for the whole domain

Authentication is only useful if it **aligns** with the From domain — which is why Section 2 (branded sending domain) comes first.

### SPF
- Maintain **one** SPF `TXT` record per sending host. Merge every legitimate sender into it.
- Watch the **10-DNS-lookup limit** — each `include:` counts. If you exceed it, SPF fails. Flatten or remove unused includes.

```
# At the sending domain/host (e.g. send.tiptop360.com if Klaviyo asks, or root if you send root mail)
v=spf1 include:_spf.klaviyo.com include:shops.shopify.com ~all
```
> Use the exact `include:` values Klaviyo and Shopify give you. Keep it to a single `v=spf1 ... all` string. `~all` (softfail) during rollout; tighten to `-all` once stable.

### DKIM
- Klaviyo selectors: the `*._domainkey.send` CNAMEs from Section 2.
- Shopify / any transactional sender: add their DKIM selector(s) too if you send mail through them.

### DMARC — staged enforcement
Add **one** TXT record at `_dmarc.tiptop360.com` and walk it through three stages. Point `rua=` at a mailbox you control (or a DMARC report service).

**Stage 1 — Monitor (deploy now, run 2–4 weeks):**
```
v=DMARC1; p=none; rua=mailto:dmarc@tiptop360.com; fo=1; adkim=r; aspf=r
```

**Stage 2 — Quarantine (after reports show Klaviyo + Shopify mail passing & aligned):**
```
v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@tiptop360.com; adkim=r; aspf=r
```

**Stage 3 — Reject (after ~2–4 more weeks clean):**
```
v=DMARC1; p=reject; pct=100; rua=mailto:dmarc@tiptop360.com; adkim=s; aspf=s
```

**Go/no-go between stages:** only advance when DMARC aggregate reports show **100% of legitimate mail (Klaviyo, Shopify, any transactional sender) passing DKIM and/or SPF *with alignment*** for the full window. Tighten `adkim`/`aspf` from relaxed (`r`) to strict (`s`) only at the reject stage.

---

## 4. Cloudflare ↔ Shopify performance (kill the 4–24h lag)

**Root cause:** Cloudflare proxies the apex and caches HTML for a Shopify backend that already manages its own caching. Theme pushes go live on Shopify instantly but the public site serves stale cached HTML for hours.

### 4.1 Cache Rules (Cloudflare → Caching → Cache Rules)
Create two rules:

**Rule A — Bypass cache for dynamic/HTML & Shopify endpoints**
- *When incoming requests match:*
  - URI path is in `/cart`, `/checkout`, `/account`, `/cart.js`, `/cart/*`, `/apps/*`, `/wpm@*`, `/.well-known/shopify/monorail/*`
  - **OR** request method is `POST`
  - **OR** response/content type is `text/html` (set **Edge TTL** very low instead if your plan can't match HTML — see Rule C)
- *Then:* **Bypass cache.**

**Rule B — Long cache for fingerprinted static assets**
- *When:* URI path starts with `/cdn/` **OR** path matches `*.css`, `*.js`, `*.woff2`, `*.woff`, `*.png`, `*.jpg`, `*.webp`, `*.svg`, `*.gif`, `*.ico`
- *Then:* **Eligible for cache**, Edge TTL **30 days**, "Respect origin" off (override), Browser TTL **1 day**.

**Rule C — (fallback if you must cache HTML) short TTL**
- For HTML, set Edge TTL to **2 minutes** and rely on the purge SOP (4.3) for instant updates.

> Net effect: assets stay fast and cached; pages reflect theme pushes immediately (after purge), eliminating the "is it broken or just cached?" guessing in `STRATEGY.md`.

### 4.2 SSL/TLS & speed settings
- **SSL/TLS mode: Full (Strict).** Shopify presents a valid certificate. **Never use Flexible** — it causes redirect loops and an insecure Cloudflare→Shopify hop.
- **Always Use HTTPS:** on.
- **Auto Minify:** OFF (Shopify already minifies; Cloudflare minify can break Liquid/inline JSON).
- **Brotli:** on. **Early Hints:** optional on. **HTTP/3 (QUIC):** on.
- **Rocket Loader:** OFF (frequently breaks Klaviyo onsite JS and Shopify scripts).

### 4.3 Purge on every theme push (tighten existing SOP)
Keep using the existing purge SOP (`STRATEGY.md` SOP 3). Make it mandatory after each `theme:publish`:
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```
> Prefer targeted purge (`{"files":[...]}`) for big sites; `purge_everything` is fine at TipTop360's scale.

### 4.4 Proxy decision
Keep the **apex + www proxied (orange)** to get cache/WAF/bot value. Keep **all email/Klaviyo subdomains grey** (Section 0). This split is the whole game.

---

## 5. Security / WAF / bots

> **Tie-in:** form spam and bot signups poison your Klaviyo list, which drags down deliverability. Edge security here directly protects the Section 2 investment.

- **WAF Managed Rules:** enable Cloudflare Managed Ruleset (and OWASP Core Ruleset on paid plans) in *Default/Medium* sensitivity. Watch for false positives on `/admin` and checkout.
- **Rate limiting:** add rules on abuse-prone endpoints:
  - Klaviyo/newsletter signup POST endpoints → e.g. 5 req/min per IP, then challenge.
  - `/account/login`, `/account/register` → throttle credential stuffing.
- **Bot protection:** enable **Bot Fight Mode** (free) or **Super Bot Fight Mode** (Pro+). **Allowlist** verified bots: Klaviyo, Shopify, Googlebot/Bingbot, GTM, payment providers, and your own IPs/monitoring.
- **Custom firewall rules:** challenge or block traffic from high-risk ASNs/geos that don't fit your market (UAE-focused store) *if* analytics show abuse; start in *Log/Challenge* mode, not *Block*, to avoid losing real customers.
- **Turnstile:** add to any *custom* (non-Klaviyo-hosted) forms. Klaviyo's own hosted forms already include their bot protection — don't double up.
- **Scrape Shield / Email Obfuscation:** on — but verify it does **not** rewrite Klaviyo onsite/tracking scripts. Test signup + email links after enabling.

---

## 6. DNS hygiene & source of truth

- `scripts/cf-dns.config.json` (git-ignored) is the **declarative source of truth** for managed records. Keep it current; all DNS changes flow through it + the apply script.
- Keep the table below updated as a human-readable inventory (sanitized — no secrets, targets templated):

| Name | Type | Value (sanitized) | Proxy | Owner | Purpose |
|---|---|---|---|---|---|
| `tiptop360.com` | A/CNAME | Shopify | Orange | Shopify | Storefront |
| `www` | CNAME | `shops.myshopify.com` | Orange | Shopify | Storefront |
| `send` | CNAME | Klaviyo bounce | Grey | Klaviyo | Return-path |
| `kl._domainkey.send` | CNAME | Klaviyo DKIM | Grey | Klaviyo | DKIM |
| `tracking` | CNAME | Klaviyo clicks | Grey | Klaviyo | Click tracking |
| `_dmarc` | TXT | DMARC policy | n/a | Ops | DMARC |
| (root or send) | TXT | SPF | n/a | Ops | SPF |

- **Change management:** every record change is made in `cf-dns.config.json`, applied via `npm run cf:dns:apply`, then verified via `npm run cf:dns:verify`, and reflected in this table.

---

## 7. Rollout plan (ordered, low-risk)

1. **Confirm Cloudflare is authoritative DNS** for `tiptop360.com` (Section 1).
2. **Klaviyo branded sending domain:** generate records in Klaviyo → paste into `cf-dns.config.json` → `npm run cf:dns:apply` → **Verify** in Klaviyo. *(grey cloud)*
3. **SPF + DKIM:** merge SPF, confirm all DKIM selectors present.
4. **DMARC `p=none`:** deploy, collect aggregate reports **2–4 weeks**.
5. **Performance:** apply Cache Rules + SSL Full(Strict) + speed toggles. Verify with a theme push + purge.
6. **Security:** WAF managed rules, rate limits, bot mode, with allowlists. Start in Log/Challenge, escalate to Block after observing.
7. **DMARC `p=quarantine` → `p=reject`** once reports are clean (Section 3 go/no-go).

---

## 8. Verification

### DNS / email auth
```bash
npm run cf:dns:verify          # automated check of all managed records + proxy status + SPF lookups + DMARC
```
Manual spot checks:
```bash
dig +short CNAME kl._domainkey.send.tiptop360.com    # → a klaviyomail.com target (NOT a Cloudflare IP)
dig +short TXT  _dmarc.tiptop360.com                 # → v=DMARC1; p=...
dig +short TXT  send.tiptop360.com                   # → v=spf1 ... (if SPF lives here)
```
- Klaviyo → Settings → Domains shows the sending domain **Verified / Authenticated**.
- Send a Klaviyo test campaign to **https://www.mail-tester.com** → target **≥ 9/10**, with **SPF, DKIM, DMARC all passing and aligned** to `tiptop360.com`.
- Enroll the domain in **Google Postmaster Tools** to monitor reputation over time.

### Performance
```bash
# HTML should NOT be a long-cached HIT; assets SHOULD be cached
curl -sI https://tiptop360.com/            | grep -i 'cf-cache-status\|cache-control'   # expect DYNAMIC/BYPASS
curl -sI https://tiptop360.com/cdn/...      | grep -i 'cf-cache-status'                  # expect HIT
```
Push a trivial theme change → run the purge → confirm `tiptop360.com` reflects it in **seconds, not 4–24h**.

### Security
- Trigger a rate-limit rule (rapid repeated signup POSTs) → confirm challenge/block in Cloudflare → Security → Events.
- Confirm legitimate signup + checkout + Klaviyo onsite popup still work end-to-end (no WAF false positives).

---

## 9. Operational notes
- Exact DKIM/return-path/tracking targets are emitted by **Klaviyo's wizard at setup time** and are account-specific — paste them into `cf-dns.config.json`.
- Cloudflare credentials (`CF_ZONE`, `CF_API_TOKEN`) are the same ones the existing purge SOP uses. The API token needs **Zone → DNS → Edit** (in addition to Cache Purge) for the apply script.
- Never commit `cf-dns.config.json` (it's git-ignored) — it can contain account-specific targets.

---
*See also: `STRATEGY.md` (Cloudflare cache SOPs), `scripts/cf-dns-apply.mjs`, `scripts/cf-dns-verify.mjs`, `scripts/cf-dns.config.example.json`.*
