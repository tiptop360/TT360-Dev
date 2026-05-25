# Google tag (GA4 + Ads) missing from `<head>` — audit & fix

## What was verified on the live store (Admin API, 2026-05-25)
Store: **TipTop360** (tiptop360.com). Live theme: **"TipTop360 | 2026-05-14"**.

1. **Confirmed removed.** `layout/theme.liquid` no longer contains the hardcoded
   Google tag. `<head>` keeps only the leftover hint
   `<link rel="dns-prefetch" href="https://www.googletagmanager.com">` plus
   `{{ content_for_header }}` — but no `gtag.js` `<script>` for `GT-NC6ZVVHK`
   / `AW-17211943737`.
2. **Google & YouTube channel is installed.** Its theme app-embed exists in the
   live theme, but the only Google block present — `store_widget` — is
   **disabled**. (That widget is a storefront UI element, *not* the analytics
   tag; the channel injects GA4/Ads via a Customer-Events web pixel, which is
   separate and not controlled by this block.)
3. **Could NOT be determined from the API:** whether the Google & YouTube
   channel's web pixel is active and which GA4/Ads IDs it sends to (this API
   token is denied `read_script_tags` / app scopes, and storefront egress is
   blocked from the dev environment). **This must be checked in the dashboards
   — see Verify below.**

So tracking now depends entirely on whatever loads through
`{{ content_for_header }}` (apps / Customer-Events pixels). The hardcoded tag
is definitely gone.

## Decide first — avoid double-counting
Before re-adding anything, check whether the **Google & YouTube channel** is
already sending to these IDs:
- Shopify admin → **Google & YouTube** channel → confirm it's connected to your
  **GA4 property** (the one whose Google tag is `GT-NC6ZVVHK`) and your
  **Google Ads** account (`AW-17211943737`) with conversion tracking on.
- If **yes** → GA4 + Ads are still tracked via the channel's pixel; **do NOT
  also hardcode the tag**, or you'll double-count. Just verify (below).
- If **no / different IDs** → add `GT-NC6ZVVHK` + `AW-17211943737` yourself via
  a **Custom Pixel** (recommended) — see next.

## Recommended solid fix — Custom Pixel (Settings → Customer events)
Theme-independent, so it survives theme updates / re-uploads (the exact failure
that just happened), and it runs on **all pages including checkout / thank-you**
— the only theme-side option that can also record **Google Ads purchase
conversions**.

Shopify admin → **Settings → Customer events → Add custom pixel** → name it
"Google tag (GA4 + Ads)" → paste:

```js
// Load the Google tag once
const s = document.createElement('script');
s.async = true;
s.src = 'https://www.googletagmanager.com/gtag/js?id=GT-NC6ZVVHK';
document.head.appendChild(s);

window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'GT-NC6ZVVHK');
gtag('config', 'AW-17211943737');

// Optional: forward purchases as a Google Ads conversion
analytics.subscribe('checkout_completed', (event) => {
  const c = event.data.checkout;
  gtag('event', 'conversion', {
    send_to: 'AW-17211943737/REPLACE_WITH_CONVERSION_LABEL',
    value: c.totalPrice && c.totalPrice.amount,
    currency: c.currencyCode,
    transaction_id: (c.order && c.order.id) || c.token
  });
});
```
**Save**, then set the pixel to **Connected**. Only fill in
`REPLACE_WITH_CONVERSION_LABEL` (from Google Ads → the specific conversion
action) if you want Ads purchase conversions through this pixel rather than
through the channel.

> Customer Events runs pixels in a sandboxed iframe; `gtag` still sends hits
> correctly — this is Shopify's supported way to run GA/Ads. If you use
> Shopify's Customer Privacy / consent banner, gate this with the consent API
> as your market requires.

## Faster fallback — restore in theme `<head>`
Quick, but **fragile** (a future theme update wipes it again) and it does **not**
run on checkout, so Ads *purchase* conversions won't fire from here. Stopgap only.

- Snippet is version-controlled at **`theme-backup/snippets/google-tag.liquid`**.
  In the live theme: Edit code → add it as `snippets/google-tag.liquid`, then
  put `{% render 'google-tag' %}` right after `<head>` in `layout/theme.liquid`
  (the leftover `dns-prefetch` line is already there).
- Claude **cannot write to the live/MAIN theme via the Admin API** — that's
  blocked for safety. It *can* write the snippet into an **unpublished** theme
  copy if you say which copy you publish from.

## Durable prevention
Stop the tag living in `theme.liquid`. Pick one: **Custom Pixel** (above), let
the **Google & YouTube channel** own GA4+Ads, or a **theme app embed** from a
Google tag / GTM app (Customize → App embeds). All survive theme updates.

## Verify (only you can — storefront isn't reachable from the dev environment)
1. Live store in incognito → DevTools → Network → filter `gtag/js` (or
   `collect?`) → confirm a hit for `GT-NC6ZVVHK`.
2. **Google Tag Assistant** (tagassistant.google.com) → connect tiptop360.com →
   confirm `GT-NC6ZVVHK` and `AW-17211943737` both fire, and each appears
   **once** (not twice — twice = double-counting with the channel).
3. GA4 → **Realtime** → your visit appears.
4. Place a test order → Google Ads → Conversions → the action shows "Recording
   conversions".
