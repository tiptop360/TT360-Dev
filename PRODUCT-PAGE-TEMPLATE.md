# TT360 Universal Product Page - Implementation Guide

**Section:** `shopify/sections/tt360-product-body.liquid`
**Template:** `templates/product.{handle}.json`
**Deploy script:** `tiptop360-optimizer/deploy-{product}.cjs`
**Reference:** `tiptop360-optimizer/deploy-drawing-robot.cjs`

---

## Features included

- Announcement bar (toggleable)
- Breadcrumb with JSON-LD BreadcrumbList schema
- Hero: image gallery (up to 7 images + lightbox) + info panel
- Variant colour picker (auto-hides when single variant)
- Buy More & Save 3-tier widget
- Add to Cart with live price update
- Cart drawer
  - Bottom sheet on mobile, right panel on desktop
  - Swipe-down to close on mobile
  - Item count badge in header
  - Free shipping progress bar (AED 200 threshold)
  - Added product: image + quantity stepper + live line total
  - Gift box card with product image
  - Smart recommendations (per-item quantity control + images)
- Gift box inline widget
- Social proof strip: rating, reviews, price, delivery
- "5 Reasons" highlight card grid - centered heading and subheading, fully dynamic
- How It Works step grid
- Video section (YouTube Shorts, YouTube watch, youtu.be, Vimeo, Shopify MP4)
- Customer review cards
- FAQ accordion (auto-included in FAQPage schema)
- Final CTA section
- Sticky mobile add-to-cart bar
- JSON-LD: Product + Offer + AggregateRating + FAQPage + BreadcrumbList
- SEO title + meta description injection
- Self-canonical tag

All content is editable from the Shopify Theme Editor. Nothing is hardcoded.

---

## Implementing a new product

### Step 1 - Duplicate the deploy script

```bash
cp tiptop360-optimizer/deploy-drawing-robot.cjs \
   tiptop360-optimizer/deploy-{product}.cjs
```

Edit the new file - update two lines:

```js
// Template upload path
await upload(token, 'templates/product.{handle}.json', templateContent);

// Preview URL log at the bottom
console.log(`https://${STORE}/products/{handle}?preview_theme_id=${THEME_ID_NUM}`);
```

### Step 2 - Edit TEMPLATE_JSON

`TEMPLATE_JSON` sets the initial content the Theme Editor loads for this product.
Replace every block's `settings` values with your product copy.
Never change a block's `type` field.

**Section settings to update:**

| Setting | What to change |
|---|---|
| `ann_text` | Announcement bar copy |
| `hero_badge2` | Top-right gallery badge, e.g. `#1 in UAE` |
| `collection_handle` | Your collection URL slug |
| `collection_name` | Your collection display name |
| `rating_value` | e.g. `4.9` |
| `review_count` | e.g. `200` |
| `review_label` | e.g. `Verified UAE reviews` |
| `feat_lbl` | Orange label above "5 Reasons" heading |
| `feat_title` | Main heading of "5 Reasons" section |
| `feat_sub` | Subheading - centered and dynamic |
| `steps_lbl` | Orange label above How It Works |
| `steps_title` | How It Works heading |
| `steps_sub` | How It Works subheading - centered and dynamic |
| `video_title` | Video section heading |
| `video_sub` | Video section subheading |
| `video_placeholder` | Shown until a video exists |
| `rev_title` | Reviews heading |
| `rev_sub` | Reviews subheading - centered and dynamic |
| `cta_title` | Final CTA heading |
| `cta_sub` | Price + delivery promise |
| `gift_bag_handle` | Shopify handle of your gift product |
| `gift_bag_price` | Display price in AED |

**Blocks to update (change `settings` only, never `type`):**

| Block type | Count | Purpose |
|---|---|---|
| `badge` | 3 max | Chips at top of info panel |
| `trust` | exactly 4 | Trust icons below ATC button |
| `highlight` | 3-4 | Cards in "5 Reasons" grid |
| `step` | 3-4 | How It Works steps |
| `review` | 3 | Customer review cards |
| `faq` | 5 standard | FAQ accordion items |

### Step 3 - Run first deploy

```bash
# First deploy only - resets template JSON to your content
node tiptop360-optimizer/deploy-{product}.cjs --template

# All subsequent deploys - section only, theme editor saves preserved
node tiptop360-optimizer/deploy-{product}.cjs
```

Always use `--template` on first deploy only.
Never use it again after that unless doing a full intentional reset.

### Step 4 - Assign template in Shopify Admin

**Admin > Products > [Product] > Theme template > product.{handle}**

### Step 5 - Upload images

**Admin > Products > [Product] > Media**

- Upload images in importance order (hero first)
- Alt text format: `[Product Name] - [key benefit], UAE`
- Example: `Kids Drawing Robot blue - screen-free STEM toy, UAE`
- Hero image uses `fetchpriority="high"` - Shopify auto-converts to WebP

### Step 6 - Video (optional)

**Option A - URL (supports Shorts):**
Theme Editor > Video Section > Video URL.
Accepts: `youtube.com/watch?v=...` `youtube.com/shorts/...` `youtu.be/...` `vimeo.com/...`

**Option B - Upload MP4:**
Admin > Products > Media > upload file.
Section auto-detects it. No URL needed.

### Step 7 - Theme Editor refinement

**Online Store > Themes > Customize > navigate to product page**

Every block and setting is editable. Saves are preserved between deploys.

### Step 8 - Preview URL

```
https://{store}.myshopify.com/products/{handle}?preview_theme_id=145270210675
```

Test mobile and desktop before publishing.

---

## All settings reference

### SEO

| ID | Notes |
|---|---|
| `seo_title` | Overrides `<title>`. Leave blank to auto-generate from product title. |
| `seo_description` | 140-160 chars. Leave blank to use product description excerpt. |

### Announcement Bar

| ID | Notes |
|---|---|
| `ann_enable` | Toggle. Default on. |
| `ann_text` | Supports HTML entities like `&nbsp;`. |

### Hero

| ID | Notes |
|---|---|
| `hero_badge2` | Top-right gallery badge. Keep under 20 chars. |
| `show_sold_out` | Show sold-out variants. Default off. |
| `collection_handle` | URL slug. Used in breadcrumb + schema. |
| `collection_name` | Display name. |

### Social Proof Strip

| ID | Default |
|---|---|
| `rating_value` | `4.9` |
| `proof_lbl_rating` | `Average rating` |
| `review_count` | `200` |
| `review_label` | `Verified UAE reviews` |
| `proof_num_delivery` | `Next Day` |
| `proof_lbl_shipping` | `Delivery across UAE` |
| `proof_lbl_free` | `Free next-day delivery` |

### Add to Cart

| ID | Default |
|---|---|
| `atc_text` | `Add to Cart` |
| `sticky_text` | `Add to Cart` |

### Buy More & Save

| ID | Default |
|---|---|
| `bms_enable` | `true` |
| `bms_qty2` | `2` |
| `bms_disc2` | `5` (percent) |
| `bms_qty3` | `3` |
| `bms_disc3` | `10` (percent) |

To make discounts apply at checkout:
Admin > Discounts > Create > Automatic discount > Amount off order > match qty thresholds.

### "5 Reasons" Section

| ID | Notes |
|---|---|
| `feat_lbl` | Orange uppercase label above heading |
| `feat_title` | Main heading |
| `feat_sub` | Subheading - always centered and dynamic |

Populated by `highlight` blocks.
Grid: 4-col desktop, 2-col tablet and mobile.
Heading, subheading, and label are all center-aligned via CSS.

### How It Works Section

| ID | Notes |
|---|---|
| `steps_lbl` | Orange uppercase label |
| `steps_title` | Main heading |
| `steps_sub` | Subheading - centered and dynamic |

Populated by `step` blocks.
Grid: 4-col desktop with connecting line, 2-col mobile.

### Video Section

| ID | Notes |
|---|---|
| `video_enable` | Toggle to show/hide section |
| `section_video` | Any YouTube or Vimeo URL (including Shorts) |
| `video_lbl` | Label |
| `video_title` | Heading |
| `video_sub` | Subheading |
| `video_placeholder` | Shown until video is available |

### Reviews Section

| ID | Notes |
|---|---|
| `rev_lbl` | Label |
| `rev_title` | Heading |
| `rev_sub` | Subheading - centered and dynamic |

### FAQ Section

| ID | Notes |
|---|---|
| `faq_lbl` | Label |
| `faq_title` | Heading |

### Gift Box Widget

| ID | Notes |
|---|---|
| `gift_bag_handle` | Must match a published product handle exactly |
| `gift_bag_title` | e.g. `Add Gift Box` |
| `gift_bag_sub` | e.g. `make it special` |
| `gift_bag_btn` | e.g. `+ Add` |
| `gift_bag_price` | Display only - must match actual product price |

Image is pulled server-side via `all_products[handle]`.
Variant ID is fetched at runtime via `/products/{handle}.js`.

### Cart Drawer Upsells

| ID | Notes |
|---|---|
| `upsell_1` | Fallback handle if recommendations API returns nothing |
| `upsell_2` | Fallback handle |
| `upsell_3` | Fallback handle |

Primary source: Shopify `/recommendations/products.json?intent=related`.
Fallback handles used on new stores with no purchase history.

### Final CTA

| ID | Notes |
|---|---|
| `cta_lbl` | Orange uppercase label |
| `cta_title` | Heading |
| `cta_sub` | Subheading - include price, delivery, COD, returns |
| `cta_btn` | Button text |
| `cta_trust_1` to `cta_trust_4` | Trust items below button |

---

## Block types

### `badge`

```json
{
  "type": "badge",
  "settings": { "text": "UAE Safety Certified", "style": "green" }
}
```

`style` options: `green`, `orange`, `navy`. Max 3 per section. Keep text under 30 chars.

---

### `trust`

```json
{
  "type": "trust",
  "settings": { "icon": "emoji", "label": "Free Next Day Delivery" }
}
```

Exactly 4 per section (schema-enforced).
Standard: Free Delivery, Cash on Delivery, 14-Day Returns, Secure Checkout.

---

### `highlight`

```json
{
  "type": "highlight",
  "settings": {
    "icon": "emoji",
    "title": "100+ Drawing Templates",
    "desc": "Progressive difficulty - never boring."
  }
}
```

Use 4. Each addresses one key buyer pain point.
Desktop: 4-col. Tablet: 2-col. Mobile: 2-col.
Label, heading, and subheading above the grid are always center-aligned.

---

### `step`

```json
{
  "type": "step",
  "settings": {
    "title": "Choose a Template",
    "desc": "Insert paper and pick one of 100+ pre-loaded drawing cards."
  }
}
```

Use 3-4. Each gets a numbered orange circle. Desktop: 4-col with connecting line.

---

### `review`

```json
{
  "type": "review",
  "settings": {
    "stars": 5,
    "text": "Review body here.",
    "name": "Fatima A.",
    "location": "Dubai - Product Name",
    "avatar_color": "#667eea",
    "verified": true
  }
}
```

Use exactly 3 - fills the desktop 3-col grid cleanly.
Real first name + UAE city. Distinct `avatar_color` across cards.
`verified: true` shows the green Verified badge.

---

### `faq`

```json
{
  "type": "faq",
  "settings": {
    "question": "Is it easy for young kids to use?",
    "answer": "<p>Yes, designed for ages 4+.</p>"
  }
}
```

`answer` accepts full HTML. Collapsed by default. All FAQ content goes into FAQPage schema.
Cover: age suitability, connectivity, battery, accessories, delivery.

---

## Cart drawer behaviour

The drawer slides up from the bottom on mobile (bottom sheet, 88vh, rounded top corners)
and slides in from the right on desktop (440px panel).

### Swipe to close (mobile)
Swipe down 80px or flick quickly. The handle bar at the top is the visual cue.

### Item count
Header badge updates live after every cart change.

### Free shipping bar
Shows progress toward AED 200 threshold.
Turns green with "Free delivery unlocked!" when met.
To change the threshold: find `FREE_SHIP_THRESHOLD` in the JS and set a new value
(Shopify stores prices in cents: AED 200 = `20000`).

### Added product
- Shows the product hero image currently visible in the gallery
- Quantity stepper: `-` / qty / `+`
- At qty 1 the minus becomes a trash icon - tap removes item from cart
- Line total updates live on every change via `/cart/change.js`

### Gift box
- Product image loaded from Shopify product data (not a hardcoded URL)
- Shows price and subtitle from theme settings
- Button turns green after successful add

### Smart recommendations
- Primary: `/recommendations/products.json?intent=related`
  - Learns from purchase co-occurrence, shared collections, tags, and descriptions
  - Filters out: current product, gift product, out-of-stock variants
- Fallback: `upsell_1/2/3` handles from theme settings
- Images: CDN-sized at 120x120 with skeleton shimmer loader, `onerror` fallback
- Each recommendation has its own independent quantity stepper
- Sale badge shown when compare-at price exists

### Order total
Updates live after every change. Shown in header and on checkout button.

### Continue shopping
Button closes the drawer without navigating away.

---

## Schema generated automatically

| Type | When |
|---|---|
| BreadcrumbList | Always |
| Product + Offer + AggregateRating | Always |
| FAQPage | Only when `faq` blocks are present |

`Offer.priceCurrency` is always `AED`.
Shipping details: 0-cost, 1-2 day transit.
Return policy: 14-day window.

---

## Deploy script rules

```bash
# Safe - section only, theme editor saves preserved
node deploy-{product}.cjs

# Destructive - resets all theme editor content to TEMPLATE_JSON defaults
node deploy-{product}.cjs --template
```

`max_blocks: 50` in the schema prevents Shopify's silent save rejection
when a section has many blocks. Do not reduce this value.

---

## Pre-publish checklist

- [ ] Deploy script duplicated, template path + preview URL updated
- [ ] `TEMPLATE_JSON` fully updated - no Drawing Robot content remains
- [ ] First deploy run with `--template` flag
- [ ] Template assigned in Admin > Products > Theme template
- [ ] Hero image uploaded first, all images have alt text
- [ ] Video URL pasted in Theme Editor OR MP4 uploaded to product media
- [ ] `gift_bag_handle` points to a published product with an image
- [ ] `upsell_1/2/3` handles set for recommendation fallback
- [ ] Buy More & Save automatic discount created in Admin > Discounts
- [ ] SEO title under 60 chars, meta description 140-160 chars
- [ ] 5 FAQ items covering age, connectivity, battery, accessories, delivery
- [ ] All section subheadings reviewed and updated for this product
- [ ] Previewed on mobile (bottom sheet drawer, sticky bar, spacing)
- [ ] Previewed on desktop (side panel drawer, gallery, grid layouts)
- [ ] Theme published or kept unpublished for staging

---

## Troubleshooting

**Subheading text not centered**
All `<p class="t-sub t-ctr">` elements are centered via the CSS rule
`.t-sub.t-ctr { margin-left:auto; margin-right:auto; text-align:center }`.
This applies to the "5 Reasons", "How It Works", and "Reviews" subheadings.
If centering breaks after a CSS change, verify this selector is still present.

**Theme Editor saves not persisting**
Run the deploy script without `--template`. The script only uploads
the `.liquid` section file by default. Template JSON is never touched
unless `--template` is explicitly passed.

**"This link is invalid" for video URL**
The `section_video` field is plain text - any YouTube or Vimeo URL works
including Shorts (`youtube.com/shorts/...`).
Do not switch it to the native `video_url` schema type - it rejects Shorts.

**Gift box image not showing**
The image is fetched via `all_products[gift_bag_handle].featured_image`.
The gift product must be published and have at least one media image.

**Block edits reverting in Theme Editor**
The schema has `"max_blocks": 50`. Do not remove or lower this.
Shopify silently rejects saves when too many blocks exist and this is unset.

**Top or bottom gap around the section**
Three layers of gap removal are in place: JS walk-up of all ancestors,
CSS `!important` on the section wrapper, and mobile body padding reset.
If a gap appears after a theme update, inspect for new wrapper elements
and add them to the footer selector in the `rmGap` function.

**Upsell recommendations off-topic**
The Shopify recommendations API needs purchase history to learn.
On new stores it may return generic results initially.
Set `upsell_1/2/3` theme settings as the fallback until data accumulates.

**Cart drawer not sliding up on mobile**
Check that no parent element has `overflow:hidden` set above the drawer.
The drawer uses `position:fixed` so it escapes all containers,
but some themes wrap the page in an overflow-clipping element.
