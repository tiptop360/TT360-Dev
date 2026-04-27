# TipTop360 Optimizer — Setup & Connection Guide

## What This Does
Automates all SEO + CRO fixes for your Shopify store via the Admin API.
Every change is backed up before applying. Every change can be reverted.

---

## Step 1 — Install Node dependencies

```bash
cd tiptop360-optimizer
npm install
```

---

## Step 2 — Connect to Your Shopify Store

### 2a. Create a Shopify Custom App

1. Go to **Shopify Admin** → `Settings` (bottom left)
2. Click **Apps and sales channels**
3. Click **Develop apps** (top right)
4. Click **Allow custom app development** if prompted
5. Click **Create an app**
6. Name it: `TipTop360 Optimizer`
7. Click **Configure Admin API scopes**

### 2b. Set the Required API Scopes

Check these boxes:

**Products**
- ✅ `read_products`
- ✅ `write_products`

**Themes**
- ✅ `read_themes`
- ✅ `write_themes`

**Content**
- ✅ `read_content`
- ✅ `write_content`

**Script tags**
- ✅ `read_script_tags`
- ✅ `write_script_tags`

**Navigation**
- ✅ `read_online_store_pages`
- ✅ `write_online_store_pages`

Click **Save** then click **Install app**.

### 2c. Get Your Access Token

After installing, click **Reveal token once**.

⚠️ **Copy it immediately** — Shopify only shows it once.

Your token looks like: `shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Step 3 — Configure Your .env File

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
SHOPIFY_STORE=tiptop360.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_token_here
ANTHROPIC_API_KEY=sk-ant-your_key_here
WHATSAPP_NUMBER=971585156033
STORE_NAME=TipTop360
STORE_URL=https://tiptop360.com
```

**Where to find your Anthropic API key:**
→ https://console.anthropic.com → API Keys → Create Key

---

## Step 4 — Test the Connection

```bash
node optimizer.js audit
```

You should see your active theme name and product count.
If you get an error, double-check your `.env` credentials.

---

## Step 5 — Run the Optimizer

### Interactive menu (recommended)
```bash
node optimizer.js menu
```

### Always backup first (option 1 in menu)
```bash
node optimizer.js backup
```

### Preview everything without changing anything
```bash
node optimizer.js dry-run
```

### Apply everything automatically
From the menu, choose `ALL`

### Apply one specific fix
```bash
node optimizer.js apply schema
node optimizer.js apply sticky-atc
node optimizer.js apply whatsapp
node optimizer.js apply timer
node optimizer.js apply trust
node optimizer.js apply images
node optimizer.js apply meta
node optimizer.js apply cart
node optimizer.js apply variants
```

---

## Reverting Changes

### See what's been applied
```bash
node optimizer.js status
```

### Revert one fix
```bash
node optimizer.js revert fix-01-schema
node optimizer.js revert fix-02-sticky-atc
node optimizer.js revert fix-03-whatsapp
# etc.
```

### Revert everything (full restore)
```bash
node optimizer.js revert-all
```

---

## Fix Reference

| Fix ID             | What it does                                      | API used        |
|--------------------|---------------------------------------------------|-----------------|
| fix-01-schema      | Injects JSON-LD product + org schema              | Theme Assets    |
| fix-02-sticky-atc  | Sticky Add to Cart bar (mobile)                   | Theme Assets    |
| fix-03-whatsapp    | Floating WhatsApp CTA button                      | Theme Assets    |
| fix-04-timer       | Fixes broken countdown → evergreen timer          | Theme Assets    |
| fix-05-trust       | Trust badge bar (BPA-free, Dubai, COD, etc.)      | Theme Assets    |
| fix-06-images      | Responsive image sizes (Core Web Vitals)          | Theme Assets    |
| fix-07-meta        | AI-generated meta descriptions for all products   | Products API    |
| fix-09-cart        | Cart cross-sell + free shipping progress bar      | Theme Assets    |
| fix-10-variants    | Age group variant explanation tooltips            | Theme Assets    |

---

## Apps to Install Separately (no-code)

These two CRO fixes require Shopify apps (free tiers available):

**Post-purchase upsell (Fix 10)**
→ Install: **ReConvert** (reconvert.com) — free for under 50 orders/month
→ Setup: Create a thank-you page offer for foam toothpaste after toothbrush purchase

**Exit-intent popup (Fix 11)**
→ Install: **Klaviyo** (already connected) → Use their built-in popup builder
→ Setup: 10% off popup, trigger on exit intent, connect to welcome flow

---

## Safety Notes

- ✅ Every theme file is backed up before editing
- ✅ Every change is logged in `changes.json`
- ✅ All changes are reversible via `revert` commands
- ✅ Asks for confirmation before any theme change
- ✅ Dry-run mode shows changes without applying
- ⚠️  Never share your `.env` file or access token
- ⚠️  Add `.env` to your `.gitignore` if using git

---

## Troubleshooting

**"403 Forbidden" error**
→ Your token is missing a required API scope. Re-check Step 2b.

**"422 Unprocessable Entity" on theme edit**
→ The theme file structure differs from expected. Run `node optimizer.js audit` and check which files exist.

**"Rate limited" errors**
→ The script handles this automatically with retries. If it persists, add `SHOPIFY_DELAY=2000` to `.env`.

**AI meta descriptions not generating**
→ Check `ANTHROPIC_API_KEY` is set correctly in `.env`.

**Auto-injection says "manual step required"**
→ Your theme uses a non-standard structure. The snippet is created — just paste the `{% render %}` tag shown into your theme editor at the right location.
