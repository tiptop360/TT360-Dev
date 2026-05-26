# 🚨 FIRST RUN CHECKLIST — Read Before You Run Anything

This file exists because **the order of operations matters**. Skipping a step here can mean a broken store. Follow this in sequence — it takes 15 minutes total and protects your live site.

---

## ⛔ Things You Must NOT Do

| ❌ Don't | ✅ Do This Instead |
|---|---|
| Run the optimizer on your **live theme** without backing up first | Always run `node optimizer.js backup` first |
| Share your Shopify access token with anyone | Treat it like a password — never paste it in messages, screenshots, or git |
| Skip the `test-connection` command | Run it first — it's read-only and catches every config issue |
| Apply ALL fixes at once on first run | Apply one at a time, check the result, then move to the next |
| Edit your live theme during optimizer runs | The optimizer is making edits — let it finish before manual changes |

---

## ✅ The Correct First-Run Sequence

### Phase A — Setup (one-time, ~10 min)

- [ ] **A1.** Unzip the project somewhere you'll remember (Desktop is fine)
- [ ] **A2.** Open a terminal in the unzipped folder
- [ ] **A3.** Run `node --version` — must be 18 or higher
- [ ] **A4.** Run `npm install` — installs the 2 dependencies
- [ ] **A5.** **In Shopify Admin** → Settings → Apps and sales channels → Develop apps → Create app named `TipTop360 Optimizer`
- [ ] **A6.** **Configure Admin API scopes** — check these:
  - `read_themes`, `write_themes`
  - `read_products`, `write_products`
  - `read_content`, `write_content`
- [ ] **A7.** **Save** → **Install app** → **Reveal token once** — copy it immediately (Shopify never shows it again)
- [ ] **A8.** **Get Anthropic API key** from console.anthropic.com → API Keys → Create Key
- [ ] **A9.** Copy `.env.example` to `.env` (Mac/Linux: `cp .env.example .env`, Windows: `copy .env.example .env`)
- [ ] **A10.** Open `.env` in any editor — paste your tokens

### Phase B — Critical Safety (must do, ~2 min)

- [ ] **B1.** **In Shopify Admin** → Online Store → Themes → click ... next to your live theme → **Duplicate**
- [ ] **B2.** Rename the duplicate "TipTop360 — Optimizer Test"
- [ ] **B3.** ⚠️ Decide: do you want the optimizer to work on the **live theme** or the **duplicate**?
  - **For maximum safety:** Make the duplicate active first (Actions → Publish), keep original as backup
  - **For most users:** Stay on live theme — the optimizer backs everything up before any change anyway

### Phase C — Verification (run these in order, ~3 min)

- [ ] **C1.** `node optimizer.js test-connection` — verifies API access (READ-ONLY, totally safe)
- [ ] **C2.** `node optimizer.js audit` — shows what's already on your store
- [ ] **C3.** `node optimizer.js keywords` — shows your approved keyword strategy
- [ ] **C4.** `node optimizer.js dry-run` — previews ALL changes WITHOUT applying them

**If any of C1–C4 produces an error, STOP and read the error message. Don't proceed to Phase D.**

### Phase D — Backup (mandatory, ~1 min)

- [ ] **D1.** `node optimizer.js backup` — saves every theme file before any change

### Phase E — Apply Fixes (one at a time, ~5 min total)

Apply in this order. After EACH fix, open your store in a browser and visually check it before moving on:

- [ ] **E1.** `node optimizer.js apply schema`        — Schema markup (invisible to users, validates with Google)
- [ ] **E2.** `node optimizer.js apply meta`          — AI meta descriptions + title tags
- [ ] **E3.** `node optimizer.js apply timer`         — Fixes broken countdown
- [ ] **E4.** `node optimizer.js apply sticky-atc`    — Sticky Add to Cart bar (check on mobile)
- [ ] **E5.** `node optimizer.js apply whatsapp`      — Floating WhatsApp button (check it opens chat)
- [ ] **E6.** `node optimizer.js apply trust`         — Trust badges (check colors look right)
- [ ] **E7.** `node optimizer.js apply images`        — Responsive images
- [ ] **E8.** `node optimizer.js apply cart`          — Cart upsell + free shipping bar
- [ ] **E9.** `node optimizer.js apply variants`      — Age group variant tooltips

### Phase F — Validation (after all fixes, ~5 min)

- [ ] **F1.** Visit your store homepage on mobile — check WhatsApp button + sticky ATC don't overlap
- [ ] **F2.** Visit a product page — check schema with Google Rich Results Test (search.google.com/test/rich-results)
- [ ] **F3.** Add a product to cart — verify free shipping bar + cross-sell appear
- [ ] **F4.** Check 3 product pages have new meta descriptions in Shopify Admin → Products → SEO
- [ ] **F5.** Test on iPhone Safari and Android Chrome — most UAE traffic is mobile

---

## 🆘 Emergency: Something Looks Broken

If anything looks wrong after a fix:

```bash
node optimizer.js status              # see what's been applied
node optimizer.js revert fix-XX-name  # revert one fix
node optimizer.js revert-all          # restore everything
```

Every change is reversible. There is no situation where you've "permanently broken" anything.

---

## 💡 Expert Suggestions (My Strong Recommendations)

**1. Install Microsoft Clarity (free, 5 min)**
Once fixes are live, you'll want to SEE how users interact with the new sticky ATC, cart upsell, and WhatsApp button. Clarity gives you free session recordings + heatmaps. Without it, you're optimizing blind.
→ clarity.microsoft.com → Add tracking script to theme.liquid

**2. Submit your sitemap to Google Search Console**
Even with perfect on-page SEO, Google needs to know about your pages. After fixes are live:
→ search.google.com/search-console → Sitemaps → submit `https://tiptop360.com/sitemap.xml`

**3. After 7 days, run the audit again**
Track score improvement. The optimizer's `audit` command is your built-in scorecard.

**4. Re-run `apply meta` quarterly**
Search trends shift. Refreshed meta descriptions every 3 months = fresh keyword targeting.

**5. Post-purchase upsell still needs an app**
The optimizer can't add a thank-you page upsell — that requires Shopify Checkout Extensions or an app like ReConvert (free up to 50 orders/month). Highly recommended.

---

## ⚙️ Quick Reference — All Commands

| Command | What it does | Safe? |
|---|---|---|
| `node optimizer.js test-connection` | Verify API access | ✅ Read-only |
| `node optimizer.js audit` | Score current state | ✅ Read-only |
| `node optimizer.js keywords` | Show keyword strategy | ✅ Read-only |
| `node optimizer.js dry-run` | Preview all changes | ✅ Read-only |
| `node optimizer.js backup` | Backup theme files | ✅ Read-only on store |
| `node optimizer.js menu` | Interactive menu | ⚠️ Asks before changes |
| `node optimizer.js apply <fix>` | Apply specific fix | ⚠️ Asks before changes |
| `node optimizer.js status` | Show applied fixes | ✅ Read-only |
| `node optimizer.js revert <fix>` | Undo specific fix | ⚠️ Asks before reverting |
| `node optimizer.js revert-all` | Undo everything | ⚠️ Asks before reverting |

When in doubt: run `test-connection` first. It can never break anything and tells you what's wrong if anything is.
