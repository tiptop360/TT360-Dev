# Live PDP Patches — tt360-product-body (verified against the published theme)

**Published (MAIN) theme:** `145467474035` ("TipTop360 | 2026-05-14")
**Live section:** `sections/tt360-product-body.liquid` — **177 KB / 3035 lines** (the repo copy is the older 64 KB version; treat LIVE as source of truth).
**How verified:** read live theme files via the store Admin API (read-only). Writes to the MAIN theme are API-blocked, so these must be applied from a Shopify-CLI environment (your Mac) and previewed on a duplicate before publishing.

---

## Diagnosis — "Foam toothpaste has no Buy More & Save"
**The published config is correct — BMS should be showing:**
- Product `Kids Strawberry Foam Toothpaste` (handle `kids-foam-toothpaste-uae`, ACTIVE, 1982 in stock) → `templateSuffix: kids-foam-toothpaste`.
- Live template `templates/product.kids-foam-toothpaste.json` → `bms_enable: true`, tiers AED **29 / 50 / 60**, `bms_orig_price: 50`.
- Live section renders BMS gated **only** by `{% if section.settings.bms_enable %}` (line 1063) — full card grid (1×/2×/3×, optional 4×), prices from `data-total`, savings computed live (`savePct`, line 1887). No variant requirement.

**Conclusion:** not a code or settings problem. Most likely **Cloudflare/browser cache**, or you were viewing a **preview/staging theme** (e.g. a "Copy of…" or `145722179699`) rather than the published one. 
**Action:** hard-refresh + purge Cloudflare, and confirm on `tiptop360.com` and the published preview `…?preview_theme_id=145467474035`. If still missing there, re-check the product's template assignment in Admin.

> Note: the live section already shows **real % savings** (computed from `data-total` vs `data-orig`) — the "Save 0%" issue only existed in the stale repo copy, so no fix is needed live.

---

## Patch A — Swatch selection: orange ring → colour-matched glow
**Live now:** `.t-swatch-dot{… border:3px solid transparent …}` (line 384) + `.t-swatch-dot.active{border-color:var(--orange)}` (line 385) = the orange ring.

**A1 — CSS (lines 384–385):**
```css
/* was: border:3px solid transparent;transition:border-color .15s */
#tt360-pdp .t-swatch-dot{width:34px;height:34px;border-radius:50%;border:3px solid transparent;transition:box-shadow .15s,transform .15s;position:relative}
/* was: .t-swatch-dot.active{border-color:var(--orange)} */
#tt360-pdp .t-swatch-dot.active{transform:scale(1.06);box-shadow:0 0 10px 3px var(--sw, var(--orange)), 0 0 3px 1px var(--sw, var(--orange))}
```

**A2 — Main swatch markup (lines 1032–1035):** compute the colour once and expose it as `--sw` on the dot:
```liquid
                {%- assign vc = vcolor | downcase -%}
                {%- assign swhex = '#94A3B8' -%}
                {%- case vc -%}{%- when 'blue' -%}{%- assign swhex = '#4A90D9' -%}{%- when 'pink' -%}{%- assign swhex = '#E8719A' -%}{%- when 'orange' -%}{%- assign swhex = '#F97316' -%}{%- when 'green' -%}{%- assign swhex = '#34D399' -%}{%- when 'red' -%}{%- assign swhex = '#EF4444' -%}{%- when 'yellow' -%}{%- assign swhex = '#FBBF24' -%}{%- when 'purple' -%}{%- assign swhex = '#8B5CF6' -%}{%- when 'black' -%}{%- assign swhex = '#1E293B' -%}{%- when 'white' -%}{%- assign swhex = '#F8FAFC' -%}{%- endcase -%}
                <div class="t-swatch-dot {% if current_variant.options[0] == vcolor %}active{% endif %}" style="--sw:{{ swhex }}">
                  <div class="inn" style="background:{{ swhex }}{% if vc == 'white' %};border:1px solid #CBD5E1{% endif %}"></div>
                </div>
```

**A3 — BMS per-item picker JS (lines 1935–1939 + 1961):** add a `colorHex` helper and set `--sw` on its dots:
```js
  function colorHex(color){
    var c=color.toLowerCase().replace(/\s+/g,'');
    var map={blue:'#4A90D9',pink:'#E8719A',orange:'#F97316',green:'#34D399',red:'#EF4444',yellow:'#FBBF24',purple:'#8B5CF6',black:'#1E293B',white:'#F8FAFC'};
    return map[c]||'#94A3B8';
  }
  function colorDotStyle(color){
    var c=color.toLowerCase().replace(/\s+/g,'');
    return 'background:'+colorHex(color)+(c==='white'?';border:1px solid #CBD5E1':'');
  }
```
Line 1961 → add the `--sw` style to the dot:
```js
          html+='<div class="t-swatch-dot'+(active?' active':'')+'" style="--sw:'+colorHex(c)+'"><div class="inn" style="'+colorDotStyle(c)+'"></div></div>';
```
Result: selected swatch glows in its own colour, no orange ring. Falls back to orange if a swatch has no mapped colour.

---

## Patch B — Drawing robot "5 STEM Skills" (use the existing usecase blocks)
The live section already renders `usecase` blocks (`.t-usecase-grid`, line 1391). Do **not** hard-code a STEM section in the shared file (it would show on every product). Instead add these to `templates/product.drawing-robot.json` (block settings: `icon`/`title`/`desc`), and add the keys to `block_order`:
```json
"usecase_1": { "type": "usecase", "settings": { "icon": "✋", "title": "Hand-Eye Coordination", "desc": "Tracing guided lines builds precision control and spatial awareness." } },
"usecase_2": { "type": "usecase", "settings": { "icon": "🔍", "title": "Pattern Recognition", "desc": "Identifying and reproducing shapes, animals, and objects from templates." } },
"usecase_3": { "type": "usecase", "settings": { "icon": "🧩", "title": "Sequential Thinking", "desc": "Following step-by-step drawing instructions from start to finish." } },
"usecase_4": { "type": "usecase", "settings": { "icon": "✏️", "title": "Fine Motor Control", "desc": "Gripping markers, colouring within lines, building pencil readiness." } },
"usecase_5": { "type": "usecase", "settings": { "icon": "🎨", "title": "Creative Expression", "desc": "Personalizing each drawing with their own colours and style." } }
```
And set the section headings:
```json
"usecase_lbl": "Real Learning",
"usecase_title": "5 STEM Skills Your Child Develops",
"usecase_sub": "Every drawing session builds real skills — not just screen time replacement."
```
(The live usecase grid is 3-up on desktop, so 5 cards render as 3 + 2 — clean and on-brand.)

---

## Deploy notes
- Target the **published** theme `145467474035` (NOT the stale IDs in `STRATEGY.md`/`deploy-drawing-robot.cjs`). Avoid staging theme `145722179699` — another session is using it for GTM/footer work.
- From your Mac: `shopify theme pull --theme 145467474035` → apply A & B → `theme check` → push to a **duplicate** → preview → publish. Purge Cloudflare after publish.
- The repo's `tt360-product-body.liquid` is the older 64 KB version; the branch's section edits should **not** be deployed as-is. Recommend resyncing the repo from the live theme so it's accurate before further work.
