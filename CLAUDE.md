# CLAUDE.md — TipTop360 working agreement

## Deployment rule (standing instruction)
Always deploy changes to the live store once they are **tested and validated** — don't stop at "committed to the branch."

Workflow for the bespoke PDPs (`theme-files/sections/{gymbag,aivox}-pdp.liquid`, templates `product.{gymbag,aivox}.json`):
1. **Validate** the source: Liquid `if`/`for`/`comment`/`schema` tags balanced; every `<script type="application/ld+json">` parses as valid JSON (FAQPage `mainEntity` = `Question`/`Answer` objects, never raw HTML); `{% schema %}` parses as valid JSON.
2. **Test** on the preview theme, then **publish to live**:
   ```
   npm install
   node deploy-gymbag-pdp.cjs   # pushes theme-files to preview theme 145031200883
   node deploy-aivox-pdp.cjs    # prints a ?preview_theme_id=145031200883 URL to eyeball
   ```
   Confirm both PDPs in the preview URL (gift-wrap add-to-cart works, "You may also like" recommendations load), then publish that theme to live. Alternative: `npm run theme:push:staging` → `theme:preview` → `theme:publish:staging`.

Deployment needs credentials that are NOT committed: `SHOPIFY_STORE` (+ Shopify CLI auth/theme token) in `.env` (see `.env.example`), the Shopify CLI installed, and `node_modules` (`npm install`). In a fresh cloud session these are absent — surface that blocker rather than claiming a deploy happened.

## Content integrity (non-negotiable)
Never publish claims that aren't confirmed true — it breaches UAE consumer law and ad-platform policy, and triggers chargebacks. Confirmed facts:
- **No BNPL/installments** at checkout (no Tabby/Tamara) — do not add "Pay in 4" messaging.
- **Returns:** free return only if the item arrives **damaged or faulty** (not change-of-mind); **no warranty**. Never write "for any reason / no questions asked / risk-free".
- **Gym bag** is **water-resistant**, dry-only — never "weatherproof" / "waterproof".
- Don't invent reviews/testimonials.

## Branch
Develop on the assigned `claude/*` branch; commit with clear messages; push with `git push -u origin <branch>`. Do not open a PR unless asked.
