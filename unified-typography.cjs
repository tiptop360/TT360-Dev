const fs = require('fs');
const { execSync } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

const CSS = 'theme-files/snippets/mobile-first-css.liquid';

const css = `{%- comment -%} TipTop360 — Unified Typography System (Inter + clean scale) {%- endcomment -%}
<style>
/* === FONT IMPORT (Inter Variable) === */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

/* === ROOT TYPE SYSTEM === */
:root {
  --tt-font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --tt-text-xs: 13px;
  --tt-text-sm: 14px;
  --tt-text-base: 16px;
  --tt-text-lg: 18px;
  --tt-text-xl: 20px;
  --tt-text-2xl: 24px;
  --tt-text-3xl: 28px;
  --tt-text-4xl: 32px;
  --tt-text-5xl: 36px;
  --tt-leading-tight: 1.2;
  --tt-leading-normal: 1.5;
  --tt-leading-relaxed: 1.65;
}

/* === GLOBAL FONT FAMILY OVERRIDE === */
body, p, h1, h2, h3, h4, h5, h6, span, div, a, button, input, select, textarea, li, td, th, label {
  font-family: var(--tt-font) !important;
}

/* === BASE BODY === */
body {
  font-size: var(--tt-text-base) !important;
  line-height: var(--tt-leading-normal) !important;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* === HEADING SCALE === */
h1, .h1, .product-single__title { 
  font-size: var(--tt-text-3xl) !important; 
  line-height: var(--tt-leading-tight) !important; 
  font-weight: 700 !important; 
  letter-spacing: -0.02em;
}
h2, .h2 { 
  font-size: var(--tt-text-2xl) !important; 
  line-height: var(--tt-leading-tight) !important; 
  font-weight: 700 !important; 
  letter-spacing: -0.01em;
}
h3, .h3 { 
  font-size: var(--tt-text-xl) !important; 
  line-height: var(--tt-leading-tight) !important; 
  font-weight: 600 !important; 
}
h4, .h4 { 
  font-size: var(--tt-text-lg) !important; 
  line-height: var(--tt-leading-normal) !important; 
  font-weight: 600 !important; 
}
h5, .h5, h6, .h6 { 
  font-size: var(--tt-text-base) !important; 
  font-weight: 600 !important; 
}

/* === PARAGRAPHS & LISTS === */
p, li {
  font-size: var(--tt-text-base) !important;
  line-height: var(--tt-leading-relaxed) !important;
}

/* === PRICE — prominent === */
.product-single__price,
.price,
[class*="price"]:not([class*="compare"]):not([class*="discount-applied"]) {
  font-size: var(--tt-text-2xl) !important;
  font-weight: 700 !important;
  line-height: 1.2 !important;
}
[class*="compare"], .compare-price, s, del {
  font-size: var(--tt-text-base) !important;
  font-weight: 400 !important;
}

/* === BUTTONS === */
button, .btn, a.btn, [role="button"], input[type="submit"] {
  font-size: var(--tt-text-base) !important;
  font-weight: 600 !important;
  letter-spacing: 0.01em;
}
.product-form__cart-submit {
  font-size: var(--tt-text-lg) !important;
  font-weight: 700 !important;
  letter-spacing: 0.02em;
}

/* === FORM INPUTS — 16px prevents iOS zoom-on-focus === */
input, select, textarea {
  font-size: var(--tt-text-base) !important;
  line-height: var(--tt-leading-normal) !important;
}

/* === LABELS / SMALL LEGAL === */
label, small, .small, .text-sm {
  font-size: var(--tt-text-sm) !important;
  line-height: var(--tt-leading-normal) !important;
}

/* === CRO BLOCKS === */
.cro-rating-badge { 
  font-size: var(--tt-text-base) !important; 
  font-weight: 500 !important;
}
.cro-rating-badge a { 
  font-size: var(--tt-text-sm) !important; 
}

.cro-trust-band { 
  font-size: var(--tt-text-sm) !important; 
  padding: 14px !important;
}
.cro-trust-band > div { 
  font-size: var(--tt-text-sm) !important; 
}

.cro-risk-reversal { 
  font-size: var(--tt-text-sm) !important; 
  padding: 14px !important; 
}
.cro-risk-reversal strong { 
  font-size: var(--tt-text-base) !important; 
}

.cro-comparison h3 { 
  font-size: var(--tt-text-xl) !important; 
  font-weight: 700 !important; 
  text-align: center !important;
}
.cro-comparison th { 
  font-size: var(--tt-text-sm) !important; 
  font-weight: 600 !important; 
}
.cro-comparison td { 
  font-size: var(--tt-text-sm) !important; 
}

.cro-fbt h3 { 
  font-size: var(--tt-text-xl) !important; 
  font-weight: 700 !important; 
  text-align: center !important;
}
.cro-fbt > div:nth-child(2) > div > div,
.cro-fbt > div:nth-child(2) > div > a > div { 
  font-size: var(--tt-text-sm) !important; 
}

/* === ANTI-PATTERNS — kill 10/11/12px hardcoded == */
[style*="font-size: 10px"], [style*="font-size:10px"] { font-size: var(--tt-text-sm) !important; }
[style*="font-size: 11px"], [style*="font-size:11px"] { font-size: var(--tt-text-sm) !important; }
[style*="font-size: 12px"], [style*="font-size:12px"] { font-size: var(--tt-text-sm) !important; }

/* === DESKTOP BUMPS === */
@media (min-width: 769px) {
  h1, .h1, .product-single__title { font-size: var(--tt-text-5xl) !important; }
  h2, .h2 { font-size: var(--tt-text-4xl) !important; }
  h3, .h3 { font-size: var(--tt-text-2xl) !important; }
  .product-single__price, .price { font-size: var(--tt-text-3xl) !important; }
  .product-form__cart-submit { font-size: var(--tt-text-xl) !important; }
  
  .cro-comparison, .cro-fbt, .cro-trust-band, .cro-risk-reversal {
    max-width: 800px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  .cro-comparison h3, .cro-fbt h3 { font-size: var(--tt-text-2xl) !important; }
}

/* === SWIPER FIX (product list image sizing) === */
section[class*="product-list"] .swiper-slide img,
.product-list-swiper img,
[class*="product-list-swiper"] img {
  max-width: 100% !important;
  height: auto !important;
  object-fit: cover !important;
}
@media (min-width: 990px) {
  section[class*="product-list"] .swiper-slide,
  .product-list-swiper .swiper-slide {
    max-width: 260px !important;
  }
  section[class*="product-list"] .swiper-slide img {
    max-height: 260px !important;
  }
}
@media (max-width: 768px) {
  section[class*="product-list"] .swiper-slide,
  .product-list-swiper .swiper-slide {
    max-width: 65vw !important;
  }
}

/* === MOBILE-SPECIFIC TUNING === */
@media (max-width: 768px) {
  html, body { overflow-x: hidden !important; max-width: 100vw !important; }
  
  body { font-size: var(--tt-text-base) !important; }
  
  h1, .h1, .product-single__title { font-size: var(--tt-text-3xl) !important; }
  h2, .h2 { font-size: var(--tt-text-2xl) !important; }
  h3, .h3 { font-size: var(--tt-text-xl) !important; }
  
  .cro-comparison { padding: 14px !important; margin: 24px -8px !important; }
  .cro-comparison h3 { font-size: var(--tt-text-lg) !important; }
  .cro-comparison table { min-width: 380px !important; }
  
  .cro-fbt { padding: 16px !important; margin: 24px -4px !important; }
  .cro-fbt h3 { font-size: var(--tt-text-lg) !important; }
  
  button, .btn, a.btn { min-height: 44px !important; }
  img { max-width: 100% !important; height: auto !important; }
}

/* === TINY PHONES === */
@media (max-width: 380px) {
  h1, .h1, .product-single__title { font-size: var(--tt-text-2xl) !important; }
  .cro-comparison table { min-width: 340px !important; font-size: var(--tt-text-xs) !important; }
}
</style>`;

fs.writeFileSync(CSS, css);
console.log('✅ Unified typography CSS written:', css.length, 'bytes');

// Validate
const md = (css.match(/\[[a-z_]+\.[a-z_]+\]\(http:\/\/[a-z_]+/g) || []).length;
console.log('Markdown corruption:', md, '(must be 0)');
if (md > 0) process.exit(1);

console.log('\nPushing...\n');
execSync(`shopify theme push --store zrhgzw-xt.myshopify.com --theme 145031200883 --path ./theme-files --only ${CSS} --allow-live`, {stdio:'inherit'});

console.log('\nWaiting 35s for cache...');
setTimeout(async () => {
  const html = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  console.log('Inter import loaded:', html.includes('Inter:wght') ? '✅' : '❌');
  console.log('Type system vars:', html.includes('--tt-text-base') ? '✅' : '❌');
  console.log('Anti-pattern killers:', html.includes('font-size: 10px') && html.includes('var(--tt-text-sm)') ? '✅' : '❌');
}, 35000);
