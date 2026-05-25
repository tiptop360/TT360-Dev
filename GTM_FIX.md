# Google tag (GA4 + Ads) missing from `<head>` — root cause & fix

## Symptom
The Google tag that loaded **`GT-NC6ZVVHK`** (Google Analytics 4) and
**`AW-17211943737`** (Google Ads) is no longer present in the storefront
`<head>`. With it gone, `gtag.js` never loads, so GA4 stops recording
sessions / pageviews and the Google Ads remarketing tag + conversion
tracking stop firing.

## Root cause
The tag was hardcoded directly in `layout/theme.liquid` inside `<head>`.
Hand-added edits to that file are not preserved when the theme is
re-uploaded, duplicated from a fresh copy, or replaced by a theme update —
any of which silently drops a `<head>` script. (Same fragility class as the
footer grey-wash issue: custom edits living in an overwritable theme file.)

## Immediate fix — restore the tag in `<head>`
Two equivalent options; either restores GA4 + the Google Ads global site tag
site-wide on the storefront.

**Option A — render the version-controlled snippet (recommended):**
1. Online Store → Themes → live theme → ⋯ → **Edit code**.
2. Snippets → **Add a new snippet** → name it `google-tag` → paste the
   contents of `theme-backup/snippets/google-tag.liquid` → **Save**.
3. Open `layout/theme.liquid`, and immediately after the opening `<head>`
   tag add:
   ```liquid
   {% render 'google-tag' %}
   ```
4. **Save.**

**Option B — paste the raw snippet straight into `<head>`** of
`layout/theme.liquid` (right after `<head>`):
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GT-NC6ZVVHK"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GT-NC6ZVVHK');
  gtag('config', 'AW-17211943737');
</script>
```

## Important — conversion tracking on checkout
Theme code (`theme.liquid`, snippets) does **not** run on Shopify's hosted
checkout or the thank-you / order-status page. So the head tag alone gives
you GA4 pageviews + Google Ads remarketing across the storefront, but it will
**not** record Google Ads *purchase conversions* by itself. For purchase /
conversion events use one of:
- **Google & YouTube sales channel app** (recommended) — wires up GA4 + Ads
  conversion tracking through Shopify Customer Events, survives theme
  updates, and tracks checkout / purchase correctly.
- **Settings → Customer events → Add custom pixel** — add a gtag/GTM pixel
  that fires `conversion` / `purchase`; it runs on every page incl. checkout.

## Durable fix (prevention) — stop it living in `theme.liquid`
Pick one so a future theme update can't wipe it again:
- **Theme app embed** — enable a Google tag / GTM app's embed under
  Customize → **App embeds**. Injected outside `theme.liquid`, survives
  theme updates.
- **Custom pixel** (Settings → Customer events) — paste the gtag config
  there; loads site-wide *and* on checkout, fully theme-independent. Best
  single home for GA4 + Ads incl. conversions.
- **Google & YouTube channel** — handles GA4 + Ads end to end.

If you keep it in `theme.liquid`, this repo holds the snippet at
**`theme-backup/snippets/google-tag.liquid`** — re-apply it after any theme
update or re-upload.

## Verify (no interruption)
1. Open the live store in a normal / incognito window.
2. DevTools → **Network** → filter `gtag/js` → confirm
   `gtag/js?id=GT-NC6ZVVHK` loads (status 200).
3. Console: `dataLayer` is defined and `typeof gtag === 'function'`.
4. Install **Google Tag Assistant** (tagassistant.google.com) → connect the
   store → confirm `GT-NC6ZVVHK` and `AW-17211943737` both fire.
5. GA4 → **Realtime** → confirm your visit appears.
6. Google Ads → Goals / Conversions → confirm the conversion action shows
   "Recording conversions" (after a test purchase via the pixel / channel).

Note: the snippet is wrapped in `{% unless request.design_mode %}` so it does
not pollute GA / Ads while editing in the theme customizer. It still loads on
normal published browsing and on shareable previews, so live analytics keep
running uninterrupted.
