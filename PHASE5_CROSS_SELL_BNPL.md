# Phase 5 (Cross-sell + BNPL) & Phase 6 (FAQ) — implementation notes

Branch: `claude/cross-sell-bnpl-phase-5-731L1`. Scope: the two bespoke PDPs — **gym bag** (`theme-files/sections/gymbag-pdp.liquid`, template `product.gymbag.json`) and **AiVox** (`theme-files/sections/aivox-pdp.liquid`, template `product.aivox.json`). Changes are committed to the branch; **not deployed** (deploy via `node deploy-gymbag-pdp.cjs` / `node deploy-aivox-pdp.cjs` with store credentials in `.env`).

## Phase 5 — Cross-sell

Approach: **curated pick + auto carousel** (these two products have no natural accessory in the catalog).

1. **Curated add-on (inside each PDP):** a "Complete Your Order" / "Add a Finishing Touch" card offering the **Premium Gift Box Wrap** (`gift-wrap-1`, AED 9) with an inline add-to-cart. The only genuinely universal complementary item in the catalog; framed honestly as an optional gift add-on and guarded by `{% if gw != empty and gw.available %}` so it disappears cleanly if the product is unpublished/out of stock.
2. **Auto "You may also like":** the theme's native `product-recommendations` section is appended to both product templates. It uses Shopify's recommendation engine (real co-purchase signals) — chosen because AiVox is in **no** collection and the gym bag's only collection contains itself, so a collection-based loop would render nothing. Renders nothing gracefully if Shopify has no recommendation data yet.

## Phase 5 — BNPL / installments: **NOT added (deliberate)**

`COPYWRITING_AUDIT.md` confirms Tabby/Tamara are **not available** at checkout. Putting "Pay in 4 with Tabby/Tamara" on the live PDP would be a false payment claim (UAE Federal Consumer Protection Law No. 15 of 2020; ad-platform policy). Instead, the real decision-point reassurance was strengthened with an honest payment line on both PDPs:
> Cash on Delivery · Apple Pay and cards · VAT included, no hidden fees

### How to enable BNPL later (when a provider is actually live)
1. Install a UAE BNPL app from the Shopify App Store — **Tabby** or **Tamara** — and complete merchant onboarding/KYC.
2. Activate it as a payment method in **Settings → Payments** so it appears at checkout.
3. Add the provider's on-site **messaging/widget** snippet near the price/CTA. With the provider live you can compute the split honestly, e.g. 4 payments of `{{ product.price | divided_by: 4 | money }}`, or drop in the app's official widget block.
4. Only then add installment copy — once it is a real, selectable option at checkout.

## Phase 6 — FAQ expansion (+ pre-existing bug fixes)

- **Gym bag:** added 6 new accurate Q&As (weight limit, phone/card safety, what fits, water-resistance, attaching/positioning, non-magnetic surfaces) → **12 questions**. Fixed two pre-existing bugs that blocked a clean expansion: the FAQ was **duplicated** with **two competing accordion scripts** (double-bound click handlers cancelled each other → accordion would not open) — consolidated to one set + one script; and the **FAQPage JSON-LD was invalid** (raw `<div>` HTML inside `mainEntity`) — rewritten as valid `Question`/`Answer` objects.
- **AiVox:** added 6 new accurate Q&As (battery/charging, size, storage/privacy, compatibility, delivery+payment, auto-summaries) → **13 questions**. Added a **FAQPage JSON-LD** (none existed before — resolves the "FAQPage schema not found" warning in `SESSION_CONTEXT.md`).

## Validation

Source-level validation (the project's e2e GEO validators target the live site and need credentials, so they can't validate an un-deployed branch): JSON templates parse + recommendations wired; Liquid `if`/`for`/`comment`/`schema` tags balanced in both sections; both FAQPage JSON-LD blocks parse as valid JSON (gym bag 12, AiVox 13 questions) with no raw HTML; gym bag has exactly one accordion script; no Tabby/Tamara/installment string introduced anywhere.
