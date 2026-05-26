# Week 1 — Codex AI Implementation Guide
# Tiptop360.com Shopify Theme

**For: Codex AI / Developer**
**Scope: Week 1 critical fixes only**
**Method: Plan → Execute → Test → Loop**

---

## Environment

- **Platform:** Shopify
- **Theme:** Custom/Shopify theme (verify: Admin → Online Store → Themes → Current theme → Actions → Edit code)
- **Files to edit:**
  - `layout/theme.liquid` (or `layout/password.liquid` if password-protected)
  - `templates/index.liquid` (or `sections/header.liquid` depending on theme structure)
  - `assets/theme.css` or `assets/base.css` (for H1 styling if needed)

---

## Phase 1: PLAN

### Before writing any code:

1. **Identify theme structure** — Is it a modern Online Store 2.0 theme (uses sections) or vintage (uses templates)?
2. **Check if H1 already exists** anywhere on homepage — search `<h1` in all `.liquid` files
3. **Check current title tag logic** — search `{{ page_title }}` in `theme.liquid`
4. **Check if any schema exists** — search `application/ld+json` in all files

### Decision tree:

```
IF theme.liquid contains {% section 'header' %} → Modern theme
ELSE → Vintage theme

IF <h1 found on homepage → Note location, plan to replace or hide
ELSE → Plan to add H1

IF schema found → Note type, plan to append FAQ schema
ELSE → Plan to add FAQ schema from scratch
```

---

## Phase 2: EXECUTE

### Fix 1: Add H1 Tag to Homepage

**Requirement:** Add exactly one visible H1 to the homepage.

**Text:** `Premium Kids Toys & Products — Fast UAE Delivery`

**Implementation:**

```liquid
{% comment %}
  Add this to the TOP of templates/index.liquid 
  (or inside sections/header.liquid if using sections)
{% endcomment %}

<h1 class="homepage-h1">Premium Kids Toys & Products — Fast UAE Delivery</h1>
```

**CSS (add to assets/theme.css or assets/base.css):**

```css
.homepage-h1 {
  font-size: 1.8rem;
  font-weight: 700;
  text-align: center;
  margin: 20px 0 10px;
  color: #1a1a1a;
  /* If theme already shows a big headline, make this subtle but visible */
}

/* Mobile */
@media (max-width: 768px) {
  .homepage-h1 {
    font-size: 1.4rem;
    padding: 0 15px;
  }
}
```

**Alternative if theme already has visual headline:**
Add H1 with `.visually-hidden` class (screen readers + Google see it, users don't):

```css
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

```liquid
<h1 class="visually-hidden">Premium Kids Toys & Products — Fast UAE Delivery</h1>
```

**Rule:** Never have more than one `<h1>` per page. If theme already has one, replace its text. Do not add a second.

---

### Fix 2: Add FAQ Schema (JSON-LD)

**Requirement:** Add FAQPage schema to homepage `<head>`.

**Implementation:**

Add this to `layout/theme.liquid` inside `<head>`, wrapped in a homepage-only condition:

```liquid
{% if template == 'index' %}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is TipTop360?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "TipTop360 is an online store that curates smart, problem-solving products for kids and families in the UAE. We handpick and test every item to ensure quality, practicality, and value."
      }
    },
    {
      "@type": "Question",
      "name": "Why shop with TipTop360?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We do the digging so you don't have to. Every product is tested, trusted, and delivered fast across the UAE — with free next-day delivery on all orders."
      }
    },
    {
      "@type": "Question",
      "name": "Where do you ship?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We currently ship to all emirates in the UAE: Dubai, Abu Dhabi, Sharjah, Ajman, Fujairah, Ras Al Khaimah, and Umm Al Quwain. We're working on expanding to more regions soon."
      }
    },
    {
      "@type": "Question",
      "name": "How long does shipping take?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "We aim for next-day delivery, but it can take 1-3 business days depending on your location in the UAE. We always pack and dispatch orders as quickly as possible."
      }
    },
    {
      "@type": "Question",
      "name": "What if my item arrives damaged?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Contact us within 3 days of delivery with your order number and photos. We'll replace or refund any damaged or incorrect item — no hassle, no questions asked."
      }
    },
    {
      "@type": "Question",
      "name": "Can I speak to someone if I have a question?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Absolutely. You can reach our UAE-based customer support team via WhatsApp, email, or the contact form on our website. We typically respond within a few hours during business hours."
      }
    }
  ]
}
</script>
{% endif %}
```

**Placement:** Directly above `</head>` or below existing schema scripts.

**Rule:** Use exact text from the store's current FAQ section. Do not invent answers.

---

### Fix 3: Add Organization Schema (Bonus — feeds GEO)

**Requirement:** Add Organization schema for brand entity recognition.

**Implementation:**

Add to `layout/theme.liquid` inside `<head>`, site-wide (no template condition):

```liquid
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "TipTop360",
  "url": "https://tiptop360.com",
  "logo": "https://tiptop360.com/cdn/shop/files/tiptop360-logo.png",
  "description": "Premium kids toys and smart products in UAE with free next-day delivery.",
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "AE"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "areaServed": "AE",
    "availableLanguage": ["English", "Arabic"]
  },
  "sameAs": [
    "https://www.instagram.com/tiptop360",
    "https://www.facebook.com/tiptop360"
  ]
}
</script>
```

**Note:** Update `logo` URL with actual logo path from Shopify Files. Update `sameAs` with real social links.

---

### Fix 4: Optimize Image Loading (Lazy Loading + Preload Hero)

**Requirement:** Add lazy loading to below-fold images. Preload hero image.

**Implementation:**

In `layout/theme.liquid` inside `<head>`, add:

```liquid
{% if template == 'index' %}
  {% comment %} Preload hero image — update src with actual hero image URL {% endcomment %}
  <link rel="preload" as="image" href="https://cdn.shopify.com/s/files/1/XXXX/YYYY/ZZZZ/hero-image.jpg" type="image/webp">
{% endif %}
```

For all images below the fold, add `loading="lazy"` attribute. This is typically in `snippets/product-card.liquid` or section files:

```liquid
<img 
  src="{{ image | img_url: 'medium' }}" 
  srcset="{{ image | img_url: 'medium' }} 1x, {{ image | img_url: 'large' }} 2x"
  alt="{{ product.title | escape }} — {{ product.type | escape }} for kids in UAE"
  loading="lazy"
  width="400"
  height="400"
>
```

**Rule:** Every `<img>` must have `width` and `height` attributes to prevent layout shift (CLS).

---

## Phase 3: TEST

### Test 1: H1 Presence

```bash
# Method: View page source
curl -s https://tiptop360.com | grep -i "<h1"
```

**Pass condition:** Exactly one `<h1>` containing "Premium Kids Toys & Products — Fast UAE Delivery"

**Fail condition:** Zero H1s, or H1 contains different text, or multiple H1s exist.

**If fail:**
- Check if theme uses sections — search in `sections/` folder
- Check if H1 is inside a dynamically loaded section
- Adjust placement in `templates/index.liquid` or `sections/header.liquid`

---

### Test 2: Title Tag

```bash
curl -s https://tiptop360.com | grep -i "<title"
```

**Pass condition:** `<title>Kids Toys & Smart Products UAE | Free Next-Day Delivery | TipTop360</title>`

**Note:** Title is set by store owner in Shopify Admin. If wrong, instruct owner to update (see Manual Tasks file).

---

### Test 3: Schema Validity

**Tool:** [Google Rich Results Test](https://search.google.com/test/rich-results)

**Steps:**
1. Enter `https://tiptop360.com`
2. Click "Test URL"
3. Check "Detected structured data types" list

**Pass condition:**
- FAQPage detected
- Organization detected
- Zero errors, zero warnings

**Fail condition:**
- Schema not detected → Check script placement in `<head>`, verify `{% if template == 'index' %}` condition
- Parse error → Validate JSON at [jsonlint.com](https://jsonlint.com)
- Missing required field → Add `@context`, `@type`, `name`, `acceptedAnswer`

---

### Test 4: Page Speed (Mobile)

**Tool:** [PageSpeed Insights](https://pagespeed.web.dev)

**Pass condition:**
- LCP (Largest Contentful Paint) < 2.5s
- CLS (Cumulative Layout Shift) < 0.1
- Mobile score > 60

**Fail condition:**
- LCP > 4s → Image too large, not preloaded, or render-blocking CSS/JS
- CLS > 0.25 → Images missing width/height, fonts causing FOIT/FOUT

**If fail:**
- Loop back to Fix 4 (image optimization)
- Check for render-blocking scripts in `<head>` — move non-critical JS to before `</body>`
- Add `font-display: swap` to @font-face declarations

---

### Test 5: Mobile Responsiveness

**Tool:** Chrome DevTools → Toggle Device Toolbar → iPhone 14 Pro Max

**Checklist:**
- [ ] H1 text readable without zoom
- [ ] Trust badges visible and aligned
- [ ] No horizontal scroll
- [ ] Tap targets (buttons, links) ≥ 48×48px
- [ ] Images not overflowing viewport

**Fail condition:** Any item unchecked.

**If fail:** Adjust CSS media queries. Add `max-width: 100%` to images. Increase button padding.

---

## Phase 4: LOOP (If Tests Fail)

### Loop Protocol:

```
FOR each test:
    IF test passes → Mark complete, proceed
    IF test fails →
        1. Identify root cause (check browser console, view source, compare with pass criteria)
        2. Adjust code (placement, syntax, or logic)
        3. Re-deploy
        4. Re-run test
        5. IF still fails after 3 attempts → Escalate to human developer with exact error message
```

**Escalation triggers:**
- Schema parse error persists after JSON validation
- H1 cannot be added without breaking theme layout
- Page speed score drops after changes (revert and try different approach)

---

## File Reference Map

| File | Purpose | What to Check |
|------|---------|---------------|
| `layout/theme.liquid` | Site-wide head/body wrapper | `<head>` closing tag, schema placement |
| `templates/index.liquid` | Homepage template | H1 placement |
| `sections/header.liquid` | Header section (OS 2.0) | Alternative H1 location |
| `assets/theme.css` / `base.css` | Styles | `.homepage-h1` or `.visually-hidden` classes |
| `snippets/product-card.liquid` | Product grid items | `loading="lazy"`, `width`, `height` on images |

---

## Safety Rules

1. **Always duplicate** the theme before editing (Admin → Themes → Actions → Duplicate)
2. **Never edit** `.liquid` files without a backup copy open in another tab
3. **Test on preview** before publishing (Theme Editor → Preview)
4. **If store breaks:** Immediately publish the duplicated backup theme
5. **No inline styles** — use CSS classes only
6. **No external scripts** — only Shopify-native and schema.org

---

## Delivery Checklist

After all tests pass, confirm:

- [ ] H1 present and correct in page source
- [ ] FAQ schema passes Rich Results Test with zero errors
- [ ] Organization schema detected
- [ ] PageSpeed mobile score improved (or did not decrease)
- [ ] No console errors on homepage
- [ ] Mobile layout intact
- [ ] Store owner notified to complete Manual Tasks (title, meta, images, badges)

---

## Communication to Store Owner

Send this summary after coding is complete:

```
Week 1 coding fixes deployed:
✓ H1 tag added to homepage
✓ FAQ schema added (tested with Google Rich Results)
✓ Organization schema added
✓ Image lazy loading + hero preloading implemented

Next: Please complete the Manual Tasks file:
1. Update title tag in Shopify Admin → Preferences
2. Write meta description in same location
3. Compress and re-upload hero images
4. Add trust badges section in Theme Editor
5. Request indexing in Google Search Console

All changes are live. Monitor results in 7–14 days.
```
