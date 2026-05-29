# Footer fixes — index

1. [Footer mobile accordion "not working"](#footer-mobile-accordion-not-working--root-cause--permanent-fix) (recurring) — fixed 2026-05-29
2. [Footer "grayed out" / grey wash](#footer-grayed-out--root-cause--fix) (recurring) — fixed earlier

---

# Footer mobile accordion "not working" — root cause & permanent fix

## Symptom
On mobile, tapping a footer column heading (e.g. "Information", a menu title)
does nothing — the section never expands, so the links underneath are
invisible and unreachable. Recurring: it "works for a while then breaks again."

## Root cause
The accordion was **100% JavaScript-dependent with content collapsed by
default**, and the JS lived in the shared bundle:

- `acc_mobile` defaults to **`true`**, so on mobile the footer always gets the
  `.footer-acc-mobile` class. The CSS then collapsed every titled block to
  `max-height:0` **by default** — content is hidden until JS adds `.active`.
- The only thing that added `.active` was `theme.FooterSection`, living inside
  the global, minified **`theme.s.min.js`** bundle. Because that bundle is one
  file, **any unrelated JS error earlier in it** (the recent commit log is full
  of them — "mobile icons crash", "null reference crash", "semicolon typo")
  aborts execution *before* the footer ever initialises. Result: blocks stay
  collapsed and untappable → "accordion not working." Fix one mobile crash, it
  works again; introduce another, it breaks again. Hence the recurrence.
- Bonus bug: the enable check was `Boolean($container.attr('data-acc'))`.
  `data-acc` is the string `"true"`/`"false"`, and `Boolean("false") === true`,
  so the flag was meaningless.

## Fix (in `sections/footer.liquid` — the version-controlled source of truth)
Made the accordion **self-contained and fail-safe**:

1. **Decoupled from the shared bundle.** Removed `data-section-type="footer"`
   from the `<footer>` tag so the fragile `theme.FooterSection` no longer runs,
   and added a small **self-contained `<script>`** inside the section itself.
   An error in unrelated bundle code can no longer take the footer down, and
   the logic re-runs on every section render (incl. the theme editor).
2. **Graceful degradation via a `.footer-acc-js` guard class.** The collapse
   CSS (and the chevron / pointer cursor) now requires
   `.footer-acc-mobile.footer-acc-js`. The script adds `.footer-acc-js` only
   *after* it has successfully wired up the handlers. So if the script never
   runs, **nothing collapses** — the footer renders fully open and readable
   instead of trapping the menus closed. The failure mode is now "no
   animation," never "hidden content."
3. **Correct enable check + a11y.** `getAttribute('data-acc') === 'true'`,
   plus `role="button"`, `tabindex`, `aria-expanded`, and Enter/Space support.

## Prevention — do NOT undo these
- **Keep the accordion JS inside `sections/footer.liquid`.** Do not "tidy" it
  back into `theme.js` / `theme.s.min.js` — that shared-bundle coupling is the
  exact thing that caused the recurring breakage.
- **Keep the `.footer-acc-js` guard on the collapse CSS.** Never let
  `.footer-acc-mobile` collapse content on its own; content must only be
  hideable once JS is confirmed running.
- **Do not re-add `data-section-type="footer"`** unless you also delete the
  inline script (two handlers both calling `toggleClass('active')` cancel each
  other out → accordion appears dead again).
- If the live theme regenerates `footer.liquid` (theme/app update), re-apply
  these three points or re-paste this file. `theme-files/` is what
  `scripts/theme-release.mjs` pushes (`shopify theme push --path ./theme-files`).

---

# Footer "grayed out" — root cause & fix

## Symptom
The storefront footer renders with a translucent grey wash over it — the navy background looks washed-out grey-blue and the white text/icons look faded. Intermittent / recurring ("happens again").

## Root cause
In `sections/footer.liquid` (line 303), the `<footer>` element itself carries the theme's lazy-load class:

```liquid
<footer class="site-footer lazyload footer-{{ section.id }} ..." data-bgset=... data-sizes="auto">
```

The theme's global lazy-load CSS keeps any `.lazyload` element visually suppressed (reduced opacity) until JavaScript swaps the class to `.lazyloaded` once it scrolls into view. The footer is at the very bottom of a long product page, so when that script doesn't fire (a JS error from an app, slow load, or the viewport observer missing it) the footer stays stuck in the dimmed placeholder state. The footer's real background is solid navy (`var(--footer-bg)` = `#12395e`) and it uses no actual background image, so wrapping the whole footer in lazy-load adds no benefit — only this failure mode.

## Fix (one word)
Remove `lazyload` from the `<footer>` tag on line 303:

```liquid
<!-- before -->
<footer class="site-footer lazyload footer-{{ section.id }} {% if acc_mobile %} footer-acc-mobile{% endif %}"
<!-- after -->
<footer class="site-footer footer-{{ section.id }} {% if acc_mobile %} footer-acc-mobile{% endif %}"
```

Leave the `lazyload` class on the `<img>` tags (logo line ~507, payment icons line ~638) — lazy-loading images is fine; lazy-loading the entire footer is the bug.

Equally valid alternative (if you prefer not to touch the tag): add this CSS guard to that file's `<style>` block —
```css
.site-footer.lazyload{opacity:1 !important;visibility:visible !important;}
```

## How to apply
Online Store → Themes → live theme → ⋯ → **Edit code** → `sections/footer.liquid` → line 303 → make the change → **Save**. Shopify keeps a theme version on every save, so it's instantly revertible.

## Staged via MCP — ready to publish (2026-05-25)
The fix was applied to an **unpublished duplicate theme** via the Shopify Admin API (`themeFilesUpsert`), so it can go live with one Publish click — no hand-editing of code required.

- **Prepared theme (fix applied):** "TipTop360 | 2026-05-25 (footer fixed)" — `gid://shopify/OnlineStoreTheme/145722179699`, role UNPUBLISHED (renamed from "Copy of TipTop360 | 2026-05-14")
- **Publish status:** attempted via `themePublish` and **blocked by the Shopify-MCP safety layer** ("making a theme live must be done manually in Shopify admin"). No integration can publish — the Publish click is manual, by design.
- **Live theme (untouched):** "TipTop360 | 2026-05-14" — `gid://shopify/OnlineStoreTheme/145467474035`

**Validated before hand-off:**
- `themeFilesUpsert` returned `userErrors: []` → Shopify validated the Liquid + section schema server-side.
- Read-back confirms the `<footer>` tag is now `class="site-footer footer-…"` — **`lazyload` removed**.
- Read-back confirms `lazyload` is still on the two `<img>` tags (logo + payment) — image lazy-loading preserved.
- File complete and intact: starts `<!-- footer.liquid -->`, ends `{% endschema %}`, all blocks/schema present.
- Stored size 44,695 B vs source 46,295 B — the schema's repetitive width-option arrays were compacted to single lines (**identical JSON, no functional change**).

**Also staged on the duplicate (`sections/footer-group.json`, verified `userErrors: []`):**
- Logo column (`text_dqyRHe`) — re-enabled; placeholder "Text column / Share store details…" cleared to show the logo only (add a tagline in the editor if wanted).
- Newsletter bar (`newsletter-footer`) — re-enabled (`enable_newletter_footer: true`); "Subscrible" → "Subscribe" typo fixed. *Verify the "10% discount" offer is actually honored before relying on it.*
- "Any Questions?" block (`text_6DjzyX`) — left disabled (duplicates the visible "Information" contact block).

**To go live (manual, ~2 clicks):** Online Store → Themes → "TipTop360 | 2026-05-25 (footer fixed)" → **Preview** (confirm footer is solid navy, logo column shows, newsletter bar shows) → **Publish**. Then optionally delete the old "TipTop360 | 2026-05-14".

**Caveats:**
- Publishing swaps the entire live theme to this copy. If the live theme was edited after the duplicate was created, port those edits here first — or just make the one-word edit on the live theme instead.
- Theme publishing is blocked for the assistant, so the Publish click is manual.

## Prevention
- The fix itself is the prevention: once the footer no longer depends on JS to become visible, the grey-wash failure can't recur.
- The corrected file is version-controlled here at **`theme-backup/sections/footer.liquid`** — if the theme regenerates `footer.liquid` (theme update / app), re-apply this change or paste this file.
- `footer.liquid` is editor/auto-generated-adjacent; make footer edits in Edit code and keep this repo copy as the source of truth to diff against.

## Separate, still-open (from footer-group.json)
Independent of the grey-wash bug, these footer items are toggled **disabled** (greyed in the editor, hidden on site):
- Footer **logo / brand column** (`text_dqyRHe`) — also still default placeholder text.
- **Newsletter bar** (`newsletter-footer` section).
- "Any Questions?" contact block (`text_6DjzyX`) — redundant with the enabled "Information" block, so likely fine left off.
Re-enable via Customize → Footer → click the visibility (eye) icon on the block(s) you want shown.
