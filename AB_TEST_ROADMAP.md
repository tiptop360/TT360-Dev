# TipTop360 — A/B Test Roadmap

**Infrastructure:** Cookie-based split (50/50), persistent 30 days. GA4 tracks via `ab_assignment` event.
**Minimum sample:** 300 add-to-cart events per variant before reading results.
**Tool:** Google Analytics 4 → Explore → Segment comparison (Variant A vs B).

---

## Test 1 — CTA Copy: AI Voice Recorder (LIVE)

**File:** `sections/aivox-pdp.liquid`
**Snippet:** `{%- render 'ab-test', test_name: 'cta_v1' -%}`

| Variant | CTA Text | Hypothesis |
|---------|----------|------------|
| A (control) | `Add to Cart` | Baseline |
| B (variant) | `Order Now — Free UAE Delivery` | UAE buyers respond to delivery reassurance. +8–15% ATC rate. |

**Implementation (already wired in aivox-pdp.liquid):**
```liquid
{%- render 'ab-test', test_name: 'cta_v1' -%}
<button class="aivox-atc-btn ab-a-cta_v1">Add to Cart</button>
<button class="aivox-atc-btn ab-b-cta_v1">Order Now — Free UAE Delivery</button>
```

**Measurement:**
- Metric: Add-to-cart rate (ATC clicks / product page views)
- Baseline: ~3.2% (estimated)
- Target: ≥3.7% for variant B to win
- Timeline: 14 days minimum, 300 ATC events per variant
- Signal: GA4 → Events → `add_to_cart` filtered by `ab_assignment.variant`

---

## Test 2 — CTA Copy: Gym Bag (QUEUED — run after Test 1 concludes)

**File:** `sections/gymbag-pdp.liquid`
**Snippet:** `{%- render 'ab-test', test_name: 'cta_v2' -%}`

| Variant | CTA Text | Hypothesis |
|---------|----------|------------|
| A (control) | `Add to Cart` | Baseline |
| B (variant) | `Get Yours — COD Available` | COD is highest trust signal in UAE. +10% ATC. |

---

## Test 3 — CTA Color: Product Pages (QUEUED — after Test 1)

**Target:** All product pages
**Current color:** `#12395e` (navy)
**Variant color:** `#e84444` (red/urgency) or `#1a7a4a` (green/go)

| Variant | Color | Hex | Hypothesis |
|---------|-------|-----|------------|
| A | Navy (current) | `#12395e` | Baseline |
| B | Green | `#1a7a4a` | Green = "go" signal. Contrast ratio 7.2:1. |

**Implementation:**
```liquid
{%- render 'ab-test', test_name: 'btn_color_v1' -%}
<style>
  html[data-ab-btn_color_v1="B"] .product-form__cart-submit,
  html[data-ab-btn_color_v1="B"] .aivox-atc-btn,
  html[data-ab-btn_color_v1="B"] .gb-atc-btn {
    background: #1a7a4a !important;
  }
</style>
```

**Measurement:**
- Metric: Add-to-cart rate
- Timeline: 21 days (lower traffic product)

---

## Test 4 — Headline: Drawing Robot (QUEUED)

**File:** Custom PDP section when built
**Current H1:** "Kids STEM Drawing Robot"

| Variant | Headline | Hypothesis |
|---------|----------|------------|
| A | "Kids STEM Drawing Robot" | Feature-first |
| B | "Screen-Free STEM Gift Kids Actually Use" | Benefit-first + gift angle. Parents searching for birthday gifts convert higher. |

---

## Test 5 — Price Anchoring: Toothbrush (QUEUED)

| Variant | Price Display | Hypothesis |
|---------|--------------|------------|
| A | `AED 129` | Baseline |
| B | `AED 129 — less than AED 0.36/day for 365 days` | Per-unit framing reduces price sensitivity. |

---

## Running A/B Test Priority

1. ✅ **Test 1** (CTA copy — AiVox) — **LIVE NOW**
2. ⏳ **Test 2** (CTA copy — Gym Bag) — start after Test 1 reads (14 days)
3. ⏳ **Test 3** (CTA color) — start after Test 2
4. ⏳ **Test 4** (Headline — Drawing Robot) — requires custom PDP
5. ⏳ **Test 5** (Price anchoring) — low risk, queue for month 2

---

## GA4 Tracking Setup

Add this Looker Studio / GA4 Explore segment:

```
Segment A: Event = ab_assignment AND test_name = "cta_v1" AND variant = "A"
Segment B: Event = ab_assignment AND test_name = "cta_v1" AND variant = "B"
Compare: add_to_cart rate, purchase rate, revenue per session
```

---

## Rollback

Remove `{%- render 'ab-test', ... -%}` from the section and remove both `.ab-a-*` and `.ab-b-*` wrapper divs, keeping only the winning variant's button text. No code changes needed beyond that.
