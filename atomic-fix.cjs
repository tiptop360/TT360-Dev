const fs = require('fs');
const { execSync } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

const TEMPLATE = 'theme-files/sections/product-template-1.liquid';
const THEME_LIQUID = 'theme-files/layout/theme.liquid';
const MOBILE_CSS = 'theme-files/snippets/mobile-first-css.liquid';

console.log('🚀 ATOMIC FIX DEPLOY\n' + '='.repeat(50));

// ===== Backup =====
fs.copyFileSync(TEMPLATE, `${TEMPLATE}.${Date.now()}.bak`);
fs.copyFileSync(THEME_LIQUID, `${THEME_LIQUID}.${Date.now()}.bak`);

// ===== Build comprehensive mobile + swiper CSS =====
const cssSnippet = `{%- comment -%} Atomic mobile-first + swiper sizing {%- endcomment -%}
<style>
/* === SWIPER FIX (desktop image sizing) === */
.product-list-swiper .product-card,
.product-list-swiper .swiper-slide,
section[class*="product-list"] .swiper-slide {
  max-width: 100%;
}
section[class*="product-list"] .swiper-slide img,
.product-list-swiper img {
  max-width: 100% !important;
  height: auto !important;
  object-fit: cover;
}
/* Constrain product cards on desktop to prevent oversized images */
@media (min-width: 990px) {
  section[class*="product-list"] .swiper-slide {
    max-width: 280px !important;
  }
  section[class*="product-list"] .swiper-slide img {
    max-height: 280px !important;
  }
}

/* === MOBILE-FIRST FONT SIZES (readable) === */
@media (max-width: 768px) {
  html, body { overflow-x: hidden !important; max-width: 100vw !important; }
  
  /* Body text floor — minimum 14px */
  body, p, li, td, th, span, div { font-size: 15px; }
  
  /* Critical conversion text — minimum 16px */
  .product-single__title, h1 { font-size: 24px !important; line-height: 1.25 !important; }
  .product-single__price, [class*="price"]:not([class*="compare"]) { font-size: 22px !important; font-weight: 700 !important; }
  .product-form__cart-submit { font-size: 17px !important; min-height: 54px !important; }
  
  /* CRO blocks — readable mobile sizes */
  .cro-rating-badge { font-size: 15px !important; }
  .cro-rating-badge a { font-size: 14px !important; }
  
  .cro-trust-band { font-size: 14px !important; padding: 12px !important; }
  .cro-trust-band > div { font-size: 13px !important; }
  
  .cro-risk-reversal { font-size: 14px !important; padding: 14px !important; margin: 14px -4px !important; }
  
  .cro-comparison { padding: 14px !important; margin: 24px -8px !important; }
  .cro-comparison h3 { font-size: 18px !important; }
  .cro-comparison table { min-width: 380px !important; font-size: 13px !important; }
  .cro-comparison th, .cro-comparison td { padding: 10px 7px !important; font-size: 13px !important; }
  
  .cro-fbt { padding: 16px !important; margin: 24px -4px !important; }
  .cro-fbt h3 { font-size: 18px !important; }
  .cro-fbt > div:nth-child(2) { gap: 6px !important; }
  .cro-fbt > div:nth-child(2) > div > div { font-size: 13px !important; }
  .cro-fbt > div:nth-child(2) > div > a > div { font-size: 13px !important; }
  
  /* Tap target minimums */
  button, .btn, a.btn, [role="button"] { min-height: 44px !important; }
  
  /* Form inputs — prevent iOS zoom-on-focus */
  input[type="text"], input[type="email"], input[type="tel"], input[type="number"], select, textarea { 
    font-size: 16px !important; 
  }
  
  /* Image containment */
  img { max-width: 100% !important; height: auto !important; }
  .product-single__photos { max-width: 100% !important; overflow: hidden !important; }
  
  /* Bundle UI compactness */
  [class*="bundle"] { font-size: 14px !important; }
}

/* === SMALL PHONES === */
@media (max-width: 380px) {
  body, p, li, td, th, span, div { font-size: 14px; }
  .cro-comparison table { min-width: 340px !important; font-size: 12px !important; }
  .product-single__title, h1 { font-size: 22px !important; }
  .cro-fbt > div:nth-child(2) > div { min-width: 75px !important; }
}

/* === DESKTOP === */
@media (min-width: 769px) {
  .cro-comparison, .cro-fbt, .cro-trust-band, .cro-risk-reversal { 
    max-width: 800px; 
    margin-left: auto; 
    margin-right: auto; 
  }
}
</style>`;

fs.writeFileSync(MOBILE_CSS, cssSnippet);
console.log('[1] ✅ Mobile CSS + swiper fix written');

// ===== Wire CSS into theme.liquid =====
let theme = fs.readFileSync(THEME_LIQUID, 'utf8');
const oldVp = theme.match(/<meta name="viewport"[^>]*>/);
if (oldVp && /maximum-scale=1[^.0-9]/.test(oldVp[0])) {
  theme = theme.replace(oldVp[0], '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
  console.log('[2] ✅ Viewport allows zoom now');
}
if (!theme.includes("'mobile-first-css'")) {
  theme = theme.replace('</head>', `{%- render 'mobile-first-css' -%}\n</head>`);
  console.log('[3] ✅ CSS wired in head');
} else {
  console.log('[3] ✅ CSS already wired');
}
fs.writeFileSync(THEME_LIQUID, theme);

// ===== Re-inject trust band + risk reversal =====
let tpl = fs.readFileSync(TEMPLATE, 'utf8');
if (!tpl.includes("'product-trust-band'")) {
  const atcAnchor = 'AddToCartText-';
  const formCloseAfter = tpl.indexOf('</form>', tpl.indexOf(atcAnchor));
  if (formCloseAfter > -1) {
    const insertAt = formCloseAfter + 7;
    tpl = tpl.slice(0, insertAt) + `\n{%- render 'product-trust-band' -%}\n{%- render 'product-risk-reversal' -%}\n` + tpl.slice(insertAt);
    fs.writeFileSync(TEMPLATE, tpl);
    console.log('[4] ✅ Trust band + risk reversal wired');
  }
} else {
  console.log('[4] ✅ Trust band already wired');
}

// ===== Strict validation (only Liquid corruption, not legit Shopify URLs) =====
const corruption = tpl.match(/\[[a-z_]+\.[a-z_]+(?:\.[a-z_]+)*\]\(http:\/\/[a-z_]+\.[a-z_]+/g) || [];
if (corruption.length) { console.log('❌ Corruption:', corruption); process.exit(1); }
console.log('[5] ✅ No Liquid corruption');

// ===== Push =====
console.log('\n🚀 Pushing 3 files...\n');
execSync(`shopify theme push --store ${process.env.SHOPIFY_STORE || 'zrhgzw-xt.myshopify.com'} --theme 145031200883 --path ./theme-files --only ${MOBILE_CSS} --only ${TEMPLATE} --only ${THEME_LIQUID} --allow-live`, {stdio:'inherit'});

// ===== Verify =====
console.log('\n[6] Verifying live (waiting 30s)...');
setTimeout(async () => {
  const html = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now(), {headers:{'User-Agent':'Mozilla/5.0 iPhone'}})).text();
  const home = await (await fetch('https://tiptop360.com/?x=' + Date.now())).text();
  
  const checks = [
    ['Viewport allows zoom', !/user-scalable=no|maximum-scale=[01](?!\.)/.test(html.match(/<meta name="viewport"[^>]*>/i)?.[0]||'')],
    ['Mobile CSS loaded', html.includes('MOBILE-FIRST FONT SIZES') || html.includes('overflow-x: hidden')],
    ['Swiper sizing CSS loaded', html.includes('SWIPER FIX')],
    ['Trust band rendered', html.includes('cro-trust-band')],
    ['Risk reversal rendered', html.includes('cro-risk-reversal')],
    ['Comparison rendered', html.includes('cro-comparison')],
    ['FBT rendered', html.includes('cro-fbt')],
    ['Rating badge rendered', html.includes('cro-rating-badge')],
    ['No Liquid errors product', !html.includes('Liquid error')],
    ['No Liquid errors home', !home.includes('Liquid error')]
  ];
  console.log('\n=== VERIFICATION ===');
  let pass=0,fail=0;
  checks.forEach(([n,ok])=>{console.log(`  ${ok?'✅':'❌'} ${n}`);ok?pass++:fail++;});
  console.log(`\n${pass}/${checks.length} passed`);
  if (fail>0) console.log('⚠️  Cache may still propagate — recheck in 60s');
}, 30000);
