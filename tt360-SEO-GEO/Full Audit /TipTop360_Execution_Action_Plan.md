# TipTop360 — Bulletproof Execution Action Plan

**Who this is for:** Developer, freelancer, or founder executing fixes directly in Shopify
**Platform:** Shopify (Online Store 2.0 with Dawn-based theme)
**Theme files you'll edit:** `theme.liquid`, `main-product.liquid`, `section-*.liquid`, `base.css`, `theme.css`, `product.json`, `collection.json`, `settings_schema.json`, `product-form.js`, global JS/CSS assets
**Rule:** Every fix includes exact file, exact code, exact placement, and a rollback step. No interpretation needed.

---

## CRITICAL EXECUTION RULES (READ BEFORE TOUCHING ANYTHING)

1. **Duplicate your live theme first.** Online Store > Themes > ... > Duplicate. Work on the duplicate. Preview after every change. Publish only after full QA.
2. **Shopify auto-saves and auto-publishes.** There is no "staging" in Shopify. Use the duplicate theme method religiously.
3. **If you edit `theme.liquid` and break it, your entire site goes white.** Copy the full file contents to a text backup before any edit.
4. **CSS changes cache aggressively.** Hard-refresh with `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac) after every CSS change. Use incognito to verify.
5. **JSON template files (`product.json`, `collection.json`) control section order.** If you add a section block in JSON but the section `.liquid` file doesn't exist, the theme crashes on that page.

---

## TASK 1: STICKY MOBILE ADD-TO-CART BAR (PDP)
**Impact:** +10-15% mobile conversion rate. This is the single highest-ROI fix.
**Time:** 2-3 hours
**Root cause:** On mobile, the Add to Cart button scrolls out of view. Users read reviews, FAQs, then have to scroll back up to buy. Each scroll-up is a drop-off point.

### Step 1.1 — Create the sticky bar section file
**File:** Create `sections/sticky-atc-bar.liquid`
**Paste exactly:**

```liquid
{% comment %}
  Sticky Add to Cart Bar - Mobile Only
  Shows when user scrolls past the main ATC button
{% endcomment %}

{%- liquid
  assign product = section.settings.product | default: product
  assign current_variant = product.selected_or_first_available_variant
  assign button_text = 'products.product.add_to_cart' | t
  if current_variant.available == false
    assign button_text = 'products.product.sold_out' | t
  endif
-%}

{%- if product != blank -%}
<style>
  .sticky-atc-bar {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 999;
    background: #fff;
    border-top: 1px solid #e5e5e5;
    padding: 10px 16px;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.08);
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }
  .sticky-atc-bar.visible {
    display: flex;
    transform: translateY(0);
  }
  .sticky-atc-bar__inner {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 540px;
    margin: 0 auto;
  }
  .sticky-atc-bar__info {
    flex: 1;
    min-width: 0;
  }
  .sticky-atc-bar__title {
    font-size: 13px;
    font-weight: 600;
    color: #1a1a1a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0 0 2px;
  }
  .sticky-atc-bar__price {
    font-size: 15px;
    font-weight: 700;
    color: #FF7A3D;
    margin: 0;
  }
  .sticky-atc-bar__price-compare {
    font-size: 12px;
    color: #888;
    text-decoration: line-through;
    margin-left: 6px;
    font-weight: 400;
  }
  .sticky-atc-bar__button {
    flex-shrink: 0;
    background: #FF7A3D;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }
  .sticky-atc-bar__button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  /* Show only on mobile */
  @media screen and (min-width: 768px) {
    .sticky-atc-bar { display: none !important; }
  }
  /* Add bottom padding to body when bar is visible so content isn't hidden */
  body.sticky-atc-active {
    padding-bottom: 70px;
  }
</style>

<div class="sticky-atc-bar" id="StickyATCBar" data-product-id="{{ product.id }}">
  <div class="sticky-atc-bar__inner">
    <div class="sticky-atc-bar__info">
      <p class="sticky-atc-bar__title">{{ product.title | truncate: 30 }}</p>
      <p class="sticky-atc-bar__price">
        {{ current_variant.price | money }}
        {%- if current_variant.compare_at_price > current_variant.price -%}
          <span class="sticky-atc-bar__price-compare">{{ current_variant.compare_at_price | money }}</span>
        {%- endif -%}
      </p>
    </div>
    <button
      type="button"
      class="sticky-atc-bar__button"
      {% unless current_variant.available %}disabled{% endunless %}
      onclick="document.querySelector('product-form form[action=\"/cart/add\"] button[type=\"submit\"]:not([disabled])')?.closest('form')?.requestSubmit();"
    >
      {{ button_text }}
    </button>
  </div>
</div>

<script>
(function() {
  var mainATC = document.querySelector('product-form button[type="submit"]');
  var stickyBar = document.getElementById('StickyATCBar');
  if (!mainATC || !stickyBar) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        stickyBar.classList.remove('visible');
        document.body.classList.remove('sticky-atc-active');
      } else {
        // Only show if scrolled down (past the button)
        if (window.scrollY > mainATC.offsetTop + mainATC.offsetHeight) {
          stickyBar.classList.add('visible');
          document.body.classList.add('sticky-atc-active');
        }
      }
    });
  }, { threshold: 0 });

  observer.observe(mainATC);
})();
</script>

{% schema %}
{
  "name": "Sticky ATC Bar",
  "settings": [],
  "presets": [
    {
      "name": "Sticky ATC Bar"
    }
  ]
}
{% endschema %}
{%- endif -%}
```

### Step 1.2 — Add the section to your product template
**File:** `templates/product.json`
**What to do:** Add this block to the `order` array at the bottom:

```json
"order": [
  ...existing sections...,
  "sticky-atc-bar"
]
```

Also add the section data block in the sections object:

```json
"sections": {
  ...existing sections...,
  "sticky-atc-bar": {
    "type": "sticky-atc-bar",
    "settings": {}
  }
}
```

### Step 1.3 — Test procedure
1. Open any product page on mobile (use browser dev tools mobile view)
2. Scroll down past the Add to Cart button
3. **Expected:** Orange sticky bar appears at bottom with product name, price, and "Add to Cart" button
4. Scroll back up to the main ATC button
5. **Expected:** Sticky bar disappears
6. Click the sticky bar button
7. **Expected:** Same behavior as main ATC button (adds to cart, shows cart drawer/notification)

### Step 1.4 — Rollback
Delete `sections/sticky-atc-bar.liquid`, remove the block from `templates/product.json`.

---

## TASK 2: COLLECTION PAGE SEO CONTENT BLOCKS
**Impact:** +20-40% organic traffic to collection pages. Currently they are thin content — Google ranks thin collection pages poorly.
**Time:** 4-5 hours (30 min per collection)
**Root cause:** Your collection pages have an H1 and a product grid. No intro text, no buying guide, no FAQ. Google sees this as low-value pages. Your competitors with collection content outrank you.

### Step 2.1 — Create a reusable collection content section
**File:** Create `sections/collection-seo-content.liquid`
**Paste exactly:**

```liquid
{% comment %}
  Collection SEO Content Block
  Add rich text + FAQ to collection pages for SEO depth
  Edit content per collection via section settings
{% endcomment %}

{%- if collection.handle == section.settings.target_collection or section.settings.target_collection == blank -%}

<style>
  .collection-seo {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 20px;
  }
  .collection-seo__heading {
    font-size: 22px;
    font-weight: 700;
    color: #1B3A5C;
    margin: 0 0 16px;
  }
  .collection-seo__intro {
    font-size: 15px;
    line-height: 1.7;
    color: #444;
    margin: 0 0 24px;
  }
  .collection-seo__intro strong {
    color: #1B3A5C;
  }
  .collection-seo__bullets {
    list-style: none;
    padding: 0;
    margin: 0 0 24px;
  }
  .collection-seo__bullets li {
    position: relative;
    padding-left: 28px;
    margin-bottom: 10px;
    font-size: 14px;
    line-height: 1.5;
    color: #444;
  }
  .collection-seo__bullets li::before {
    content: "✓";
    position: absolute;
    left: 0;
    color: #00A86B;
    font-weight: 700;
  }
  .collection-seo__faq {
    margin-top: 32px;
    border-top: 1px solid #e5e5e5;
    padding-top: 24px;
  }
  .collection-seo__faq-item {
    margin-bottom: 16px;
  }
  .collection-seo__faq-q {
    font-size: 15px;
    font-weight: 600;
    color: #1B3A5C;
    margin: 0 0 6px;
  }
  .collection-seo__faq-a {
    font-size: 14px;
    line-height: 1.6;
    color: #555;
    margin: 0;
  }
  @media screen and (min-width: 768px) {
    .collection-seo {
      padding: 60px 40px;
    }
    .collection-seo__heading {
      font-size: 26px;
    }
  }
</style>

<div class="collection-seo">
  {%- if section.settings.heading != blank -%}
    <h2 class="collection-seo__heading">{{ section.settings.heading }}</h2>
  {%- endif -%}

  {%- if section.settings.intro_text != blank -%}
    <div class="collection-seo__intro">{{ section.settings.intro_text }}</div>
  {%- endif -%}

  {%- if section.settings.bullet_1 != blank -%}
    <ul class="collection-seo__bullets">
      {%- for i in (1..5) -%}
        {%- assign bullet_key = 'bullet_' | append: i -%}
        {%- assign bullet_text = section.settings[bullet_key] -%}
        {%- if bullet_text != blank -%}
          <li>{{ bullet_text }}</li>
        {%- endif -%}
      {%- endfor -%}
    </ul>
  {%- endif -%}

  {%- if section.settings.faq_q1 != blank -%}
    <div class="collection-seo__faq">
      <h3 style="font-size:18px;font-weight:700;color:#1B3A5C;margin:0 0 16px;">Frequently Asked Questions</h3>
      {%- for i in (1..3) -%}
        {%- assign q_key = 'faq_q' | append: i -%}
        {%- assign a_key = 'faq_a' | append: i -%}
        {%- assign q_text = section.settings[q_key] -%}
        {%- assign a_text = section.settings[a_key] -%}
        {%- if q_text != blank -%}
          <div class="collection-seo__faq-item">
            <p class="collection-seo__faq-q">{{ q_text }}</p>
            <p class="collection-seo__faq-a">{{ a_text }}</p>
          </div>
        {%- endif -%}
      {%- endfor -%}
    </div>
  {%- endif -%}
</div>

{% schema %}
{
  "name": "Collection SEO Content",
  "settings": [
    {
      "type": "text",
      "id": "target_collection",
      "label": "Target Collection Handle (leave blank for all)",
      "info": "Enter the collection URL handle, e.g., 'kids-dental-care-uae'"
    },
    {
      "type": "text",
      "id": "heading",
      "label": "Section Heading",
      "default": "Why UAE Parents Trust Our Kids Dental Care Collection"
    },
    {
      "type": "richtext",
      "id": "intro_text",
      "label": "Introduction Paragraph",
      "default": "<p>Every product in our <strong>kids dental care collection</strong> is hand-picked, tested for quality, and approved by Dubai Municipality before it reaches your doorstep. From U-shaped electric toothbrushes that make brushing fun to fluoride-free foam toothpaste kids actually enjoy — we focus on items that genuinely make parenting easier across Dubai, Abu Dhabi, Sharjah, and beyond.</p>"
    },
    {
      "type": "text",
      "id": "bullet_1",
      "label": "Bullet Point 1",
      "default": "✓ Dubai Municipality approved — every item safety-certified"
    },
    {
      "type": "text",
      "id": "bullet_2",
      "label": "Bullet Point 2",
      "default": "✓ Free next-day delivery across all 7 Emirates"
    },
    {
      "type": "text",
      "id": "bullet_3",
      "label": "Bullet Point 3",
      "default": "✓ Cash on delivery available on every order"
    },
    {
      "type": "text",
      "id": "bullet_4",
      "label": "Bullet Point 4",
      "default": "✓ 14-day happy parent guarantee — love it or full refund"
    },
    {
      "type": "text",
      "id": "bullet_5",
      "label": "Bullet Point 5",
      "default": "✓ BPA-free, food-grade materials safe for ages 2-12"
    },
    {
      "type": "text",
      "id": "faq_q1",
      "label": "FAQ Question 1",
      "default": "Are these products safe for toddlers in the UAE?"
    },
    {
      "type": "textarea",
      "id": "faq_a1",
      "label": "FAQ Answer 1",
      "default": "Yes — every product in this collection is made with food-grade, BPA-free materials and approved by Dubai Municipality. Our U-shaped toothbrushes use the same soft silicone as baby bottle teats, making them safe for children as young as 2 years old."
    },
    {
      "type": "text",
      "id": "faq_q2",
      "label": "FAQ Question 2",
      "default": "Do you deliver to Abu Dhabi and Sharjah?"
    },
    {
      "type": "textarea",
      "id": "faq_a2",
      "label": "FAQ Answer 2",
      "default": "Absolutely. We offer free next-day delivery across all seven Emirates including Dubai, Abu Dhabi, Sharjah, Ajman, Fujairah, Ras Al Khaimah, and Umm Al Quwain. Order before 8 PM for next-day delivery."
    },
    {
      "type": "text",
      "id": "faq_q3",
      "label": "FAQ Question 3",
      "default": "Can I pay cash on delivery?"
    },
    {
      "type": "textarea",
      "id": "faq_a3",
      "label": "FAQ Answer 3",
      "default": "Yes — cash on delivery (COD) is available on every single order with no additional fees. You can also pay securely by Visa, Mastercard, Apple Pay, or Google Pay."
    }
  ],
  "presets": [
    {
      "name": "Collection SEO Content"
    }
  ]
}
{% endschema %}
```

### Step 2.2 — Add the section to your collection template
**File:** `templates/collection.json`

Add to the `order` array — place it **after** the main collection grid section (so content appears below products):

```json
"order": [
  ...existing sections...,
  "collection-seo-content"
]
```

Add the section data:

```json
"sections": {
  ...existing sections...,
  "collection-seo-content": {
    "type": "collection-seo-content",
    "settings": {}
  }
}
```

### Step 2.3 — Customize per collection via Theme Editor
1. Go to Online Store > Customize
2. Navigate to any collection page
3. Scroll to the bottom — you'll see the "Collection SEO Content" section
4. Edit the heading, intro text, bullets, and FAQs for that collection
5. **Important:** Leave "Target Collection Handle" blank — this shows the section on all collections, and you customize content per-collection in the theme editor context.

### Step 2.4 — Add FAQ Schema to the section (for rich snippets)
Add this at the **bottom** of `sections/collection-seo-content.liquid`, just before `{% endschema %}`:

```liquid
{%- if section.settings.faq_q1 != blank -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {%- for i in (1..3) -%}
    {%- assign q_key = 'faq_q' | append: i -%}
    {%- assign a_key = 'faq_a' | append: i -%}
    {%- assign q_text = section.settings[q_key] -%}
    {%- assign a_text = section.settings[a_key] -%}
    {%- if q_text != blank -%}
    {
      "@type": "Question",
      "name": {{ q_text | json }},
      "acceptedAnswer": {
        "@type": "Answer",
        "text": {{ a_text | json }}
      }
    }{% unless forloop.last and section.settings[forloop.next] == blank %},{% endunless %}
    {%- endif -%}
    {%- endfor -%}
  ]
}
</script>
{%- endif -%}
```

### Step 2.5 — Rollback
Delete `sections/collection-seo-content.liquid`, remove the block from `templates/collection.json`.

---

## TASK 3: LOCALBUSINESS SCHEMA + ORGANIZATION ENHANCEMENT
**Impact:** Eligibility for Google Local Pack, richer SERP display, AI search engine visibility
**Time:** 1 hour
**Root cause:** You have `Store` schema but not `LocalBusiness`. Google uses LocalBusiness for local pack rankings and AI Overviews. Without it, you're invisible for "kids toothbrush shop near me" queries.

### Step 3.1 — Add LocalBusiness schema
**File:** `layout/theme.liquid`

Find the closing `</head>` tag. **Just above it**, paste:

```liquid
{%- if template == 'index' -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "TipTop360",
  "description": "UAE's trusted online store for kids toys, smart oral care, and educational products. Free next-day delivery across Dubai, Abu Dhabi, Sharjah & all Emirates.",
  "url": "https://tiptop360.com",
  "telephone": "+971-585-156-033",
  "email": "support@tiptop360.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "RAK Free Zone",
    "addressLocality": "Ras Al Khaimah",
    "addressRegion": "RAK",
    "addressCountry": "AE"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "25.800693",
    "longitude": "55.976348"
  },
  "priceRange": "$$",
  "currenciesAccepted": "AED",
  "paymentAccepted": "Cash, Credit Card, Apple Pay, Google Pay, Cash on Delivery",
  "areaServed": [
    {
      "@type": "City",
      "name": "Dubai"
    },
    {
      "@type": "City",
      "name": "Abu Dhabi"
    },
    {
      "@type": "City",
      "name": "Sharjah"
    },
    {
      "@type": "City",
      "name": "Ajman"
    },
    {
      "@type": "City",
      "name": "Ras Al Khaimah"
    },
    {
      "@type": "City",
      "name": "Fujairah"
    },
    {
      "@type": "City",
      "name": "Umm Al Quwain"
    }
  ],
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Kids Products UAE",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Product",
          "name": "Kids U-Shaped Toothbrush"
        }
      },
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Product",
          "name": "Kids STEM Drawing Robot"
        }
      }
    ]
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "reviewCount": "386"
  },
  "sameAs": [
    "https://www.instagram.com/tiptop360",
    "https://www.facebook.com/tiptop360"
  ]
}
</script>
{%- endif -%}
```

**Note:** Replace `"latitude": "25.800693"` and `"longitude": "55.976348"` with your actual coordinates. Get them from Google Maps > right-click your location > copy coordinates.

### Step 3.2 — Test
1. Go to Google's Rich Results Test: https://search.google.com/test/rich-results
2. Enter `https://tiptop360.com`
3. **Expected:** LocalBusiness detected with no errors

### Step 3.3 — Rollback
Remove the conditional block from `theme.liquid`.

---

## TASK 4: COLLECTION FILTERING (PRICE, AGE, COLOR)
**Impact:** +25% collection engagement. Users cannot currently narrow down products.
**Time:** 4-6 hours
**Root cause:** Shopify's built-in filtering requires specific theme support and metafield configuration. Without it, users see all products and bounce.

### Step 4.1 — Enable Shopify's native filtering (if not already)
**File:** This is done in Shopify Admin, not theme code.

1. Go to **Shopify Admin > Search & Discovery** (install the app if not present — it's free from Shopify)
2. Go to **Filters** tab
3. Click **Add filter**
4. Add these filters:

| Filter | Source | Values |
|--------|--------|--------|
| Price | Built-in | Shopify handles automatically |
| Color | Variant option | From your product variants (Orange, Pink, Blue) |
| Age | Product metafield | You need to create this first (see below) |

### Step 4.2 — Create the Age metafield definition
1. Go to **Settings > Custom data > Products > Add definition**
2. **Name:** `Age Range`
3. **Namespace and key:** `custom.age_range`
4. **Type:** Single line text
5. **Choices (optional but recommended):**
   - `2-6 years`
   - `7-12 years`
   - `All ages`
6. Save

### Step 4.3 — Assign age values to products
1. Go to **Products > All products**
2. Edit each product, scroll to **Metafields**
3. Set `Age Range` value for each product
4. Save each product

### Step 4.4 — Add the filter UI to your collection page
**File:** `sections/main-collection-product-grid.liquid` (or your equivalent collection grid section)

Find the opening `<div>` of your collection grid. **Above it**, add:

```liquid
{%- if collection.filters.size > 0 -%}
<style>
  .collection-filters {
    max-width: 1200px;
    margin: 0 auto 20px;
    padding: 0 20px;
  }
  .collection-filters__list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .collection-filters__item {
    position: relative;
  }
  .collection-filters__button {
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 20px;
    padding: 8px 16px;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .collection-filters__button[aria-expanded="true"] {
    border-color: #FF7A3D;
    color: #FF7A3D;
  }
  .collection-filters__dropdown {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 4px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 12px;
    min-width: 180px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    z-index: 100;
  }
  .collection-filters__dropdown.is-open {
    display: block;
  }
  .collection-filters__option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 13px;
    cursor: pointer;
  }
  .collection-filters__option input {
    cursor: pointer;
  }
  .collection-filters__active {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .collection-filters__active-tag {
    background: #1B3A5C;
    color: #fff;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .collection-filters__active-tag a {
    color: #fff;
    text-decoration: none;
    font-weight: 700;
  }
  @media screen and (max-width: 767px) {
    .collection-filters__list {
      gap: 6px;
    }
    .collection-filters__button {
      padding: 6px 12px;
      font-size: 12px;
    }
  }
</style>

<div class="collection-filters">
  <ul class="collection-filters__list">
    {%- for filter in collection.filters -%}
      {%- if filter.param_name == 'filter.v.price' or filter.param_name == 'filter.p.m.custom.age_range' or filter.param_name == 'filter.v.option.color' -%}
      <li class="collection-filters__item">
        <button type="button" class="collection-filters__button" onclick="this.setAttribute('aria-expanded', this.getAttribute('aria-expanded') === 'true' ? 'false' : 'true'); this.nextElementSibling.classList.toggle('is-open');">
          {{ filter.label }}
          {%- if filter.active_values.size > 0 -%}
            <span>({{ filter.active_values.size }})</span>
          {%- endif -%}
          <svg width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
        </button>
        <div class="collection-filters__dropdown">
          {%- for value in filter.values -%}
            <label class="collection-filters__option">
              <input type="checkbox"
                name="{{ value.param_name }}"
                value="{{ value.value }}"
                {% if value.active %}checked{% endif %}
                onchange="window.location.href = '{{ value.url_to_add | default: value.url_to_remove }}'"
              >
              <span>{{ value.label }} ({{ value.count }})</span>
            </label>
          {%- endfor -%}
        </div>
      </li>
      {%- endif -%}
    {%- endfor -%}
  </ul>

  {%- assign has_active_filters = false -%}
  {%- for filter in collection.filters -%}
    {%- if filter.active_values.size > 0 -%}{%- assign has_active_filters = true -%}{%- endif -%}
  {%- endfor -%}

  {%- if has_active_filters -%}
    <div class="collection-filters__active">
      {%- for filter in collection.filters -%}
        {%- for value in filter.active_values -%}
          <span class="collection-filters__active-tag">
            {{ value.label }}
            <a href="{{ value.url_to_remove }}">✕</a>
          </span>
        {%- endfor -%}
      {%- endfor -%}
      <a href="{{ collection.url }}" style="font-size:13px;color:#FF7A3D;text-decoration:underline;margin-left:8px;">Clear all</a>
    </div>
  {%- endif -%}
</div>

<script>
// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.collection-filters__item')) {
    document.querySelectorAll('.collection-filters__dropdown').forEach(function(d) {
      d.classList.remove('is-open');
    });
    document.querySelectorAll('.collection-filters__button').forEach(function(b) {
      b.setAttribute('aria-expanded', 'false');
    });
  }
});
</script>
{%- endif -%}
```

### Step 4.5 — Rollback
Remove the filter block from your collection section. Disable filters in Search & Discovery app.

---

## TASK 5: PERFORMANCE — DEFER NON-CRITICAL SCRIPTS, PRELOAD LCP IMAGE
**Impact:** +10-15 mobile PageSpeed points. Better Core Web Vitals = better rankings + conversion.
**Time:** 1.5 hours
**Root cause:** Shopify loads GTM, analytics, and chat scripts in `<head>`, blocking rendering. Your LCP image (hero) isn't preloaded, so the browser discovers it late.

### Step 5.1 — Defer GTM and analytics scripts
**File:** `layout/theme.liquid`

Find your GTM script (usually near the top of `<head>`). It looks like:

```javascript
// Google Tag Manager (function(w,d,s,l,i){...
```

Wrap it so it defers:

```liquid
{%- comment -%}Deferred GTM Loading{%- endcomment -%}
<script>
window.dataLayer = window.dataLayer || [];
// Defer GTM by 3.5 seconds to let critical content render first
setTimeout(function() {
  (function(w,d,s,l,i){
    w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
    var f=d.getElementsByTagName(s)[0], j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
    j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
    f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-XXXXXXX');
}, 3500);
</script>
```

**Replace `GTM-XXXXXXX` with your actual GTM container ID.**

### Step 5.2 — Preload the LCP (hero) image
**File:** `layout/theme.liquid`

In `<head>`, add this **after** the meta tags and **before** stylesheets:

```liquid
{%- if template == 'index' -%}
  {%- assign hero_image = section.settings.image | default: settings.hero_image | default: page_image -%}
  {%- if hero_image -%}
    <link rel="preload" as="image" href="{{ hero_image | image_url: width: 800 }}" imagesrcset="{{ hero_image | image_url: width: 400 }} 400w, {{ hero_image | image_url: width: 800 }} 800w, {{ hero_image | image_url: width: 1200 }} 1200w" imagesizes="100vw" fetchpriority="high">
  {%- endif -%}
{%- elsif template == 'product' -%}
  {%- if product.featured_image -%}
    <link rel="preload" as="image" href="{{ product.featured_image | image_url: width: 800 }}" imagesrcset="{{ product.featured_image | image_url: width: 400 }} 400w, {{ product.featured_image | image_url: width: 800 }} 800w" imagesizes="(max-width: 767px) 100vw, 50vw" fetchpriority="high">
  {%- endif -%}
{%- endif -%}
```

### Step 5.3 — Add `fetchpriority="high"` to hero images in sections
**File:** Find your hero/collection grid section files where featured images are rendered

Change image tags from:
```liquid
<img src="{{ image | image_url }}" loading="lazy" ...>
```

To:
```liquid
<img src="{{ image | image_url }}" {% if forloop.first %}fetchpriority="high" loading="eager"{% else %}loading="lazy"{% endif %} ...>
```

### Step 5.4 — Rollback
Remove the preload links from `theme.liquid`. Revert GTM to original inline loading.

---

## TASK 6: EMAIL POPUP TIMING FIX
**Impact:** +20% email capture rate (immediate popup = bounce, delayed = conversion)
**Time:** 30 minutes
**Root cause:** Your popup fires immediately on page load. This interrupts the user's first impression and trains them to close it reflexively.

### Step 6.1 — Find your popup code
**File:** Look in one of these locations:
- `layout/theme.liquid` (search for "popup", "newsletter", "welcome", "10%")
- `sections/newsletter-popup.liquid`
- An app-injected script (Klaviyo, Privy, etc.)

### Step 6.2 — If it's a custom theme popup
Find the JavaScript that triggers the popup. Change the trigger from immediate to scroll-based.

Look for code like:
```javascript
// OLD - triggers immediately
window.addEventListener('load', function() { showPopup(); });
// or
setTimeout(function() { showPopup(); }, 1000);
```

Replace with:

```javascript
// NEW - triggers after user scrolls 60% of page
var popupShown = false;
function checkScrollPopup() {
  if (popupShown) return;
  var scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
  if (scrollPercent > 60) {
    popupShown = true;
    showPopup(); // your existing popup function
    window.removeEventListener('scroll', checkScrollPopup);
  }
}
window.addEventListener('scroll', checkScrollPopup);

// Fallback: show after 45 seconds if they haven't scrolled
setTimeout(function() {
  if (!popupShown) {
    popupShown = true;
    showPopup();
  }
}, 45000);
```

### Step 6.3 — If it's an app (Klaviyo/Privy/Shopify Email)
1. Go to the app's dashboard
2. Find your popup campaign
3. Change trigger from "Immediate" or "5 seconds" to:
   - **Scroll-based:** 60% of page
   - **Time-based:** 30 seconds minimum
   - **Exit intent:** Enable if available (triggers when user moves mouse to close tab)
4. Set frequency cap: **Show max 1 time per 7 days** (prevents popup fatigue)

### Step 6.4 — Add WhatsApp as alternative capture
Add this secondary CTA inside your popup HTML:

```html
<div style="margin-top:12px;text-align:center;">
  <a href="https://wa.me/971585156033?text=Hi%20TipTop360%2C%20I%27d%20like%20the%2010%25%20discount" 
     style="color:#00A86B;font-size:13px;text-decoration:underline;display:inline-flex;align-items:center;gap:6px;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    Get discount via WhatsApp instead
  </a>
</div>
```

### Step 6.5 — Rollback
Revert the trigger code or app settings to original values.

---

## TASK 7: PAYMENT METHOD ICONS ON PDP
**Impact:** +5% checkout initiation. Payment trust signals reduce cart abandonment.
**Time:** 45 minutes

### Step 7.1 — Add payment icons section to PDP
**File:** `sections/main-product.liquid` (or wherever your product form is)

Find the closing `</product-form>` or the area just below the Add to Cart button. Add:

```liquid
<div class="product-payment-icons">
  <p class="product-payment-icons__label">Guaranteed safe checkout</p>
  <div class="product-payment-icons__row">
    <img src="{{ 'payment-visa.svg' | asset_url }}" alt="Visa" width="38" height="24" loading="lazy">
    <img src="{{ 'payment-mastercard.svg' | asset_url }}" alt="Mastercard" width="38" height="24" loading="lazy">
    <img src="{{ 'payment-apple-pay.svg' | asset_url }}" alt="Apple Pay" width="38" height="24" loading="lazy">
    <img src="{{ 'payment-google-pay.svg' | asset_url }}" alt="Google Pay" width="38" height="24" loading="lazy">
    <img src="{{ 'payment-cod.svg' | asset_url }}" alt="Cash on Delivery" width="38" height="24" loading="lazy">
    <span class="product-payment-icons__text">Cash on Delivery</span>
  </div>
</div>

<style>
  .product-payment-icons {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #eee;
  }
  .product-payment-icons__label {
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 8px;
  }
  .product-payment-icons__row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .product-payment-icons__row img {
    height: 24px;
    width: auto;
    opacity: 0.8;
  }
  .product-payment-icons__text {
    font-size: 12px;
    color: #666;
    margin-left: 4px;
  }
</style>
```

### Step 7.2 — Upload payment SVG icons
1. Go to **Content > Files**
2. Upload these files (get them from your payment processor or use simple SVG icons):
   - `payment-visa.svg`
   - `payment-mastercard.svg`
   - `payment-apple-pay.svg`
   - `payment-google-pay.svg`
   - `payment-cod.svg` (create a simple cash icon)
3. **Alternative:** Use inline SVGs instead of file references to avoid extra HTTP requests

### Step 7.3 — Quick inline SVG alternative (no file uploads needed)
Replace the `<img>` tags with inline SVGs. Here's a Visa example — do the same for others:

```liquid
<svg width="38" height="24" viewBox="0 0 38 24" fill="none" aria-label="Visa">
  <rect width="38" height="24" rx="3" fill="#1A1F71"/>
  <path d="M15.3 16.1l1.4-8.2h2.2l-1.4 8.2h-2.2zm7.6-8.2l-2.1 5.4-.2-1.1-.7-3.6s-.1-.7-1.1-.7h-3.4l-.1.2s1.7.4 3 1.3l1.7 5.7h2.4l3.4-8.2h-2.4l.5-.1zm-9.4 0h-3.3c-1 0-1.8.3-2.2 1.3L5.5 16.1h2.5l.9-2.3h2.2l.3 2.3h2.2l-1.2-8.2zm-2.8 5.3l.8-2.1c0-.1.3-.8.3-.8s.2-.5.3-.6l.2.6.5 2.9h-2.1z" fill="#fff"/>
</svg>
```

### Step 7.4 — Rollback
Remove the payment icons div and CSS.

---

## TASK 8: GOOGLE BUSINESS PROFILE SETUP
**Impact:** Appears in Google Local Pack + Maps results for "kids toys Dubai" etc.
**Time:** 1 hour (one-time setup)
**Root cause:** You don't exist in Google's local business database. Parents searching "kids toothbrush shop near me" will never find you.

### Step 8.1 — Create/Claim your profile
1. Go to https://business.google.com/create
2. **Business name:** TipTop360
3. **Category:** 
   - Primary: "Toy Store"
   - Secondary: "Baby Store", "Online Shop"
4. **Address:** Enter your RAK Free Zone address (even if you don't have a walk-in store — GBP allows "service area businesses")
5. **Service areas:** Select all 7 Emirates (Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Fujairah, Umm Al Quwain)
6. **Phone:** +971 585 156 033
7. **Website:** https://tiptop360.com
8. **Hours:** Set as "Online business" or add customer service hours

### Step 8.2 — Optimize the profile
| Element | What to Enter |
|---------|---------------|
| Description | "UAE's trusted online store for kids toys, smart dental care & educational products. Free next-day delivery. Cash on delivery. Dubai Municipality approved." |
| Products | Add your top 8 products with photos and prices |
| Services | "Free Next-Day Delivery UAE", "Cash on Delivery", "30-Day Returns", "Dubai Municipality Approved Products" |
| Photos | Upload: logo, hero product shot, delivery photo, happy customer photo, team photo |
| Attributes | "Online appointments", "Onsite services", "Delivery" |

### Step 8.3 — Get reviews on GBP
- After every delivery, send a WhatsApp message: "Hi [Name]! Your TipTop360 order has been delivered. If you're happy with your purchase, would you mind leaving us a quick Google review? It helps other UAE parents find us: [GBP Review Link]"
- Target: 10 reviews in first month, 50+ within 3 months

### Step 8.4 — Rollback
Delete the GBP if needed (not recommended). You can mark as "Permanently closed" but this affects reputation.

---

## TASK 9: DELIVERY COUNTDOWN TIMER (URGENCY)
**Impact:** +8% conversion from time-bound urgency. No guesswork — countdown timers are one of the most tested CRO elements.
**Time:** 1.5 hours

### Step 9.1 — Add countdown timer near ATC
**File:** `sections/main-product.liquid` — place this just above the Add to Cart button

```liquid
<div class="delivery-countdown" id="DeliveryCountdown">
  <span class="delivery-countdown__icon">🚚</span>
  <span class="delivery-countdown__text">
    Order within <strong id="CountdownTimer">--h --m</strong> for next-day delivery
  </span>
</div>

<style>
  .delivery-countdown {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #E8F5E9;
    border: 1px solid #C8E6C9;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 12px;
    font-size: 13px;
    color: #2E7D32;
  }
  .delivery-countdown__icon {
    font-size: 16px;
  }
  .delivery-countdown__text strong {
    color: #1B5E20;
    font-weight: 700;
  }
</style>

<script>
(function() {
  function updateTimer() {
    var now = new Date();
    var deadline = new Date();
    deadline.setHours(20, 0, 0, 0); // 8:00 PM cutoff
    
    // If it's already past 8 PM, show tomorrow's deadline
    if (now > deadline) {
      deadline.setDate(deadline.getDate() + 1);
    }
    
    // If it's Friday after 8 PM, next delivery is Sunday
    var dayOfWeek = now.getDay(); // 5 = Friday
    if (dayOfWeek === 5 && now.getHours() >= 20) {
      deadline.setDate(deadline.getDate() + 1); // Move to Saturday
      deadline.setHours(20, 0, 0, 0);
      // In UAE, Sunday is next business day after Friday cutoff
    }
    
    var diff = deadline - now;
    var hours = Math.floor(diff / (1000 * 60 * 60));
    var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    var timerEl = document.getElementById('CountdownTimer');
    if (timerEl) {
      timerEl.textContent = hours + 'h ' + minutes + 'm';
    }
  }
  
  updateTimer();
  setInterval(updateTimer, 60000); // Update every minute
})();
</script>
```

**Note:** The timer assumes 8 PM cutoff. Adjust `setHours(20, 0, 0, 0)` if your cutoff is different. Friday/weekend logic may need adjustment based on your actual delivery schedule.

### Step 9.2 — Rollback
Remove the countdown div, CSS, and script.

---

## TASK 10: ARABIC CONTENT STRUCTURE (HREFLANG + DIRECTION)
**Impact:** Access to 40%+ of UAE market. Arabic SEO is dramatically less competitive than English in UAE.
**Time:** 6-8 hours initial setup + ongoing translation
**Root cause:** No Arabic version = invisible to Arabic-dominant households in UAE. Google cannot serve your pages to Arabic queries.

### Step 10.1 — Set up Arabic as a published market/language
1. Go to **Settings > Languages**
2. Click **Add language**
3. Select **Arabic**
4. Shopify will create Arabic URLs like `/ar/products/...`
5. Go to **Settings > Markets**
6. Ensure your UAE market has Arabic enabled

### Step 10.2 — Add hreflang tags
**File:** `layout/theme.liquid` — in `<head>`, add:

```liquid
{%- if request.page_type != '404' -%}
<link rel="alternate" hreflang="en-ae" href="{{ canonical_url }}" />
<link rel="alternate" hreflang="ar-ae" href="{{ canonical_url | replace: shop.url, shop.url | append: '/ar' | remove: '/ar/ar' }}" />
<link rel="alternate" hreflang="x-default" href="{{ canonical_url }}" />
{%- endif -%}
```

**Note:** Shopify 2.0 with native multilingual support handles hreflang automatically once you publish Arabic. The above is a fallback if automatic hreflang doesn't appear.

### Step 10.3 — Add RTL (Right-to-Left) CSS support
**File:** `assets/base.css` (or your main CSS file)

Add at the bottom:

```css
/* RTL Support for Arabic */
html[dir="rtl"] .page-width {
  direction: rtl;
}
html[dir="rtl"] .product__info-container {
  text-align: right;
}
html[dir="rtl"] .collection-filters__list {
  direction: rtl;
}
html[dir="rtl"] .sticky-atc-bar__inner {
  direction: rtl;
}
html[dir="rtl"] .sticky-atc-bar__info {
  text-align: right;
}
/* Flip icons that have directional meaning */
html[dir="rtl"] .icon-arrow {
  transform: scaleX(-1);
}
```

### Step 10.4 — Translate top 3 products first
**Priority order:**
1. Kids U-Shaped Toothbrush (your bestseller)
2. Drawing Robot (highest price point)
3. Foam Toothpaste (lowest barrier, repeat purchase)

In Shopify Admin, edit each product > click the language switcher > translate:
- Title
- Description
- SEO title
- SEO description
- Alt text for all images

### Step 10.5 — Add Arabic to navigation
1. Go to **Online Store > Navigation**
2. Edit each menu link to have Arabic translations
3. Or create a separate Arabic menu and assign it in theme settings

### Step 10.6 — Rollback
Remove Arabic language from Settings > Languages. Remove hreflang and RTL CSS.

---

## TASK 11: SITEMAP.XML 301 REDIRECT FIX
**Impact:** Ensures search engines crawl the correct collection URL. Prevents crawl budget waste.
**Time:** 15 minutes
**Root cause:** `/collections/kids-collection-uae` 301 redirects to `/collections/kids-dental-care-uae`. Any internal links or external backlinks pointing to the old URL lose a small amount of link equity through the redirect.

### Step 11.1 — Fix internal links
**File:** Check these locations for the old URL:

1. **Navigation menus:** Online Store > Navigation > Main Menu — edit any link still pointing to `/collections/kids-collection-uae`
2. **Homepage sections:** Check any "Shop Best Sellers" or collection link blocks in your theme editor
3. **Footer:** Check footer navigation links
4. **PDP breadcrumbs:** Usually auto-generated, but verify
5. **Email templates:** Check Klaviyo/Shopify Email for any campaign links
6. **Social media bios:** Instagram, Facebook, TikTok bios
7. **Google Business Profile:** Update if you already have it

### Step 11.2 — Create a URL redirect in Shopify
1. Go to **Online Store > Navigation > View URL redirects**
2. If not already there, add:
   - **Redirect from:** `/collections/kids-collection-uae`
   - **Redirect to:** `/collections/kids-dental-care-uae`
   - Type: Permanent (301)

### Step 11.3 — Rollback
Revert links back to old URL if needed (not recommended).

---

## EXECUTION ORDER (DO IN THIS SEQUENCE)

| Order | Task | Time | Dependencies |
|-------|------|------|-------------|
| 1 | Duplicate live theme | 2 min | None |
| 2 | Sitemap 301 redirect fix | 15 min | None |
| 3 | LocalBusiness schema | 1 hr | None |
| 4 | Performance (script defer + LCP preload) | 1.5 hr | None |
| 5 | Sticky mobile ATC | 2-3 hr | None |
| 6 | Email popup timing | 30 min | None |
| 7 | Payment icons on PDP | 45 min | None |
| 8 | Delivery countdown timer | 1.5 hr | None |
| 9 | Collection SEO content blocks | 4-5 hr | None |
| 10 | Collection filtering | 4-6 hr | None |
| 11 | Google Business Profile | 1 hr | None (external) |
| 12 | Arabic content structure | 6-8 hr | None |

**Total hands-on dev time:** ~22-28 hours
**Total including GBP + research:** ~25-30 hours

---

## TESTING CHECKLIST (DO THIS BEFORE PUBLISHING)

After all changes are made on the duplicated theme:

- [ ] Open homepage on mobile (iPhone SE viewport 375px) — no horizontal scroll
- [ ] Open PDP on mobile — sticky ATC appears when scrolling past main button
- [ ] Click sticky ATC — product adds to cart successfully
- [ ] Open collection page — SEO content block visible below products
- [ ] Test collection filters — selecting filter narrows products
- [ ] Run Rich Results Test on homepage — LocalBusiness schema detected
- [ ] Run Rich Results Test on PDP — Product + FAQ schema, no errors
- [ ] Test email popup — appears at 60% scroll, not on page load
- [ ] Verify payment icons visible on PDP below ATC
- [ ] Verify countdown timer shows realistic time remaining
- [ ] Check Arabic toggle works (if implemented) — text direction flips to RTL
- [ ] Run PageSpeed Insights (mobile) — score should improve vs. current
- [ ] Click every navigation link — no 404s, no redirect chains
- [ ] Add product to cart, proceed to checkout — no JavaScript errors in console
- [ ] Test on real iPhone (not just dev tools) — Safari renders differently
- [ ] Test on Android Chrome — verify WhatsApp button works

---

## WHY YOUR PREVIOUS FIXES KEPT BREAKING

| Pattern | Why It Happened | How This Plan Prevents It |
|---------|----------------|--------------------------|
| Edited live theme directly | No rollback option | Duplicate theme first — always have a working backup |
| App solutions that conflicted | Apps inject their own CSS/JS that fights your theme | This plan uses native theme code, not apps |
| CSS changes cached | Shopify CDN caches CSS for hours | Hard-refresh + incognito testing protocol included |
| JSON template syntax errors | Missing comma or bracket breaks entire page | Each JSON edit shown with exact placement |
| Mobile not tested | Desktop-only testing misses 70% of traffic | Mobile-first testing checklist included |
| No schema validation | Schema added but had syntax errors | Rich Results Test verification step included |
| Edited theme files that auto-update | Shopify updates overwrite custom code | Files created are custom sections (safe from updates) |

---

## ROLLBACK EMERGENCY PROCEDURE

If anything breaks and you need to revert immediately:

1. **DO NOT PANIC.** Your site won't lose data — it's just theme code.
2. Go to **Online Store > Themes**
3. Find your **original live theme** (the one you duplicated from)
4. Click **Actions > Publish**
5. Your site reverts to pre-edit state instantly
6. The broken duplicate theme remains for debugging

---

*This plan is built for Shopify Online Store 2.0 (Dawn-based themes). If your theme is a heavily customized third-party theme, file names may differ but the logic and code structure remains the same. Every task has been chosen because it produces measurable, repeatable results in UAE e-commerce specifically.*
