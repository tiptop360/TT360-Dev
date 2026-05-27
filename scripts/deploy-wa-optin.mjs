/**
 * TipTop360 — Deploy WhatsApp Opt-In Popup + FAB to Shopify theme
 * Run: node scripts/deploy-wa-optin.mjs
 *
 * Deploys:
 *   - snippets/wa-optin-popup.liquid   (slide-in popup after 8s)
 *   - assets/wa-optin.css
 *   - assets/wa-optin.js
 *   Injects include into theme.liquid (before </body>)
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const WA_NUM = process.env.WHATSAPP_NUMBER || '971585156033';

if (!STORE || !TOKEN) {
  console.error('❌  SHOPIFY_STORE or SHOPIFY_ACCESS_TOKEN missing from .env');
  process.exit(1);
}

const BASE = `https://${STORE}/admin/api/2024-10`;

async function shopify(method, path, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function getLiveThemeId() {
  const { themes } = await shopify('GET', 'themes.json');
  return themes.find(t => t.role === 'main')?.id;
}

async function putAsset(themeId, key, value) {
  const res = await shopify('PUT', `themes/${themeId}/assets.json`, {
    asset: { key, value },
  });
  if (res.asset) console.log(`  ✅  ${key}`);
  else console.error(`  ❌  ${key}`, res);
  return res.asset;
}

async function getAsset(themeId, key) {
  const res = await shopify('GET', `themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`);
  return res.asset?.value || null;
}

// ── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
/* ── TipTop360 WhatsApp Opt-In ── */
.tt-wa-fab{position:fixed;bottom:24px;right:24px;z-index:9990;display:flex;align-items:center;gap:8px;cursor:pointer;background:#25D366;color:#fff;border-radius:50px;padding:10px 18px 10px 12px;box-shadow:0 4px 14px rgba(37,211,102,.45);font-family:inherit;font-size:14px;font-weight:600;border:none;transition:transform .2s,box-shadow .2s}
.tt-wa-fab:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(37,211,102,.55)}
.tt-wa-fab svg{width:22px;height:22px;flex-shrink:0}
.tt-wa-popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9991;display:flex;align-items:flex-end;justify-content:center;padding:0 0 90px;opacity:0;pointer-events:none;transition:opacity .25s}
.tt-wa-popup-overlay.open{opacity:1;pointer-events:all}
.tt-wa-popup{background:#fff;border-radius:16px;max-width:360px;width:calc(100% - 32px);padding:24px;text-align:center;transform:translateY(30px);transition:transform .3s;position:relative}
.tt-wa-popup-overlay.open .tt-wa-popup{transform:translateY(0)}
.tt-wa-popup__close{position:absolute;top:12px;right:14px;background:none;border:none;font-size:18px;cursor:pointer;color:#999;line-height:1}
.tt-wa-popup__icon{width:56px;height:56px;background:#25D366;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
.tt-wa-popup__icon svg{width:30px;height:30px;color:#fff}
.tt-wa-popup h3{font-size:17px;font-weight:700;margin:0 0 8px;color:#1a1a1a}
.tt-wa-popup p{font-size:13px;color:#555;margin:0 0 18px;line-height:1.5}
.tt-wa-popup__input{width:100%;border:1.5px solid #e0e0e0;border-radius:8px;padding:10px 14px;font-size:14px;box-sizing:border-box;margin-bottom:12px;outline:none;transition:border-color .2s}
.tt-wa-popup__input:focus{border-color:#25D366}
.tt-wa-popup__cta{width:100%;background:#25D366;color:#fff;border:none;border-radius:8px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .2s}
.tt-wa-popup__cta:hover{background:#1da851}
.tt-wa-popup__legal{font-size:11px;color:#aaa;margin-top:10px}
.tt-wa-popup__success{display:none}
.tt-wa-popup__success svg{width:44px;height:44px;color:#25D366;margin-bottom:10px}
.tt-wa-popup__success h3{font-size:17px;font-weight:700;color:#1a1a1a}
.tt-wa-popup__success p{font-size:13px;color:#555}
@media(max-width:480px){.tt-wa-popup{border-radius:16px 16px 0 0;width:100%;padding:20px}}
`;

// ── JS ───────────────────────────────────────────────────────────────────────

const JS = `
(function(){
  var POPUP_DELAY = 8000;
  var SEEN_KEY = 'tt_wa_seen';
  var LIST_ID = 'StG72P'; // WhatsApp Subscribers list
  var KV_KEY = window.Klaviyo ? window.Klaviyo : null;

  function show(el){ el.classList.add('open'); }
  function hide(el){ el.classList.remove('open'); }

  document.addEventListener('DOMContentLoaded', function(){
    var overlay = document.getElementById('tt-wa-overlay');
    var fab     = document.getElementById('tt-wa-fab');
    var closeBtn= document.getElementById('tt-wa-close');
    var form    = document.getElementById('tt-wa-form');
    var success = document.getElementById('tt-wa-success');

    if(!overlay) return;

    // Show FAB immediately, delay popup
    if(!sessionStorage.getItem(SEEN_KEY)){
      setTimeout(function(){
        show(overlay);
        sessionStorage.setItem(SEEN_KEY,'1');
      }, POPUP_DELAY);
    }

    fab.addEventListener('click', function(){ show(overlay); });
    closeBtn.addEventListener('click', function(){ hide(overlay); });
    overlay.addEventListener('click', function(e){ if(e.target===overlay) hide(overlay); });

    form.addEventListener('submit', function(e){
      e.preventDefault();
      var phone = document.getElementById('tt-wa-phone').value.replace(/\\D/g,'');
      var name  = document.getElementById('tt-wa-name').value.trim();
      if(!phone || phone.length < 8) return;

      // Subscribe via Klaviyo onsite JS + list
      if(window._learnq){
        _learnq.push(['identify', {
          '$phone_number': '+' + phone,
          '$first_name': name || undefined,
          'WhatsApp Subscriber': true,
        }]);
        _learnq.push(['listSubscribe', {
          listId: LIST_ID,
          profiles: [{ '$phone_number': '+' + phone, '$first_name': name || undefined }],
        }]);
      }

      // Show success
      form.style.display = 'none';
      success.style.display = 'block';
      setTimeout(function(){ hide(overlay); form.style.display=''; success.style.display='none'; }, 4000);
    });
  });
})();
`;

// ── Liquid snippet ────────────────────────────────────────────────────────────

const SNIPPET = `
{%- comment -%} TipTop360 WhatsApp Opt-In {%- endcomment -%}
{{ 'wa-optin.css' | asset_url | stylesheet_tag }}

{%- assign wa_number = '${WA_NUM}' -%}

<!-- WhatsApp FAB -->
<button class="tt-wa-fab" id="tt-wa-fab" aria-label="Chat on WhatsApp">
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
  WhatsApp
</button>

<!-- Opt-In Popup -->
<div class="tt-wa-popup-overlay" id="tt-wa-overlay" role="dialog" aria-modal="true" aria-label="WhatsApp opt-in">
  <div class="tt-wa-popup">
    <button class="tt-wa-popup__close" id="tt-wa-close" aria-label="Close">&times;</button>
    <div class="tt-wa-popup__icon">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
    </div>
    <div id="tt-wa-form-wrap">
      <h3>Get Exclusive Deals on WhatsApp 🎁</h3>
      <p>Subscribe for flash sales, restock alerts &amp; order updates — direct to your WhatsApp.</p>
      <form id="tt-wa-form">
        <input class="tt-wa-popup__input" id="tt-wa-name"  type="text"  placeholder="Your first name" autocomplete="given-name">
        <input class="tt-wa-popup__input" id="tt-wa-phone" type="tel"   placeholder="WhatsApp number (e.g. 971XXXXXXXX)" required autocomplete="tel">
        <button class="tt-wa-popup__cta" type="submit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Yes, send me deals!
        </button>
      </form>
      <p class="tt-wa-popup__legal">By subscribing you agree to receive WhatsApp messages from TipTop360. Reply STOP to unsubscribe. UAE residents only.</p>
    </div>
    <div class="tt-wa-popup__success" id="tt-wa-success">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-2 17l-5-5 1.414-1.414L10 14.172l7.586-7.586L19 8l-9 9z"/></svg>
      <h3>You're in! 🎉</h3>
      <p>Check WhatsApp for your welcome message from TipTop360.</p>
    </div>
  </div>
</div>

<script src="{{ 'wa-optin.js' | asset_url }}" defer></script>
`;

// ── Deploy ────────────────────────────────────────────────────────────────────

(async () => {
  console.log('━━━ TipTop360 WhatsApp Opt-In Deploy ━━━');
  const themeId = await getLiveThemeId();
  if (!themeId) { console.error('❌  Could not find live theme'); process.exit(1); }
  console.log(`Theme ID: ${themeId}\n`);

  await Promise.all([
    putAsset(themeId, 'assets/wa-optin.css', CSS),
    putAsset(themeId, 'assets/wa-optin.js', JS),
    putAsset(themeId, 'snippets/wa-optin-popup.liquid', SNIPPET),
  ]);

  // Inject into theme.liquid
  console.log('\nInjecting {% render \'wa-optin-popup\' %} into theme.liquid…');
  let themeLiquid = await getAsset(themeId, 'layout/theme.liquid');
  if (!themeLiquid) { console.error('❌  Could not fetch theme.liquid'); return; }

  if (themeLiquid.includes("render 'wa-optin-popup'")) {
    console.log('  ✅  Already injected — skipping');
  } else {
    themeLiquid = themeLiquid.replace(
      '</body>',
      `  {% render 'wa-optin-popup' %}\n</body>`
    );
    await putAsset(themeId, 'layout/theme.liquid', themeLiquid);
  }

  console.log('\n✅  WhatsApp opt-in popup deployed to live theme!');
  console.log('   Test at: https://tiptop360.com');
})();
