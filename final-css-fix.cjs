const fs = require('fs');
const { execSync } = require('child_process');

const CSS = 'theme-files/snippets/mobile-first-css.liquid';

const css = `{%- comment -%} Mobile-first + comparison center + swiper sizing {%- endcomment -%}
<style>
/* === SWIPER FIX (product list image sizing) === */
section[class*="product-list"] .swiper-slide img,
.product-list-swiper img,
.product-list-swiper .product-card img,
[class*="product-list-swiper"] img {
  max-width: 100% !important;
  height: auto !important;
  object-fit: cover !important;
}

/* Desktop — constrain product card max-width */
@media (min-width: 990px) {
  section[class*="product-list"] .swiper-slide,
  .product-list-swiper .swiper-slide,
  [class*="product-list-swiper"] .swiper-slide {
    max-width: 260px !important;
  }
  section[class*="product-list"] .swiper-slide img,
  .product-list-swiper .swiper-slide img {
    max-height: 260px !important;
    width: 100% !important;
  }
}

/* Tablet — constrain to 300px */
@media (min-width: 750px) and (max-width: 989px) {
  section[class*="product-list"] .swiper-slide {
    max-width: 240px !important;
  }
}

/* === COMPARISON TABLE CENTER (desktop) === */
.cro-comparison {
  margin-left: auto !important;
  margin-right: auto !important;
}
@media (min-width: 769px) {
  .cro-comparison,
  .cro-fbt,
  .cro-trust-band,
  .cro-risk-reversal {
    max-width: 800px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  .cro-comparison h3,
  .cro-fbt h3 {
    text-align: center !important;
  }
  .cro-comparison table {
    margin-left: auto !important;
    margin-right: auto !important;
  }
}

/* === MOBILE-FIRST FONT SIZES === */
@media (max-width: 768px) {
  html, body { overflow-x: hidden !important; max-width: 100vw !important; }
  body, p, li, td, th, span, div { font-size: 15px; }
  .product-single__title, h1 { font-size: 24px !important; line-height: 1.25 !important; }
  .product-single__price { font-size: 22px !important; font-weight: 700 !important; }
  .product-form__cart-submit { font-size: 17px !important; min-height: 54px !important; }
  
  .cro-rating-badge { font-size: 15px !important; }
  .cro-trust-band { font-size: 14px !important; padding: 12px !important; }
  .cro-risk-reversal { font-size: 14px !important; padding: 14px !important; margin: 14px -4px !important; }
  
  .cro-comparison { padding: 14px !important; margin: 24px -8px !important; }
  .cro-comparison h3 { font-size: 18px !important; text-align: center !important; }
  .cro-comparison table { min-width: 380px !important; font-size: 13px !important; }
  .cro-comparison th, .cro-comparison td { padding: 10px 7px !important; font-size: 13px !important; }
  
  .cro-fbt { padding: 16px !important; margin: 24px -4px !important; }
  .cro-fbt h3 { font-size: 18px !important; text-align: center !important; }
  .cro-fbt > div:nth-child(2) { gap: 6px !important; }
  .cro-fbt > div:nth-child(2) > div > div { font-size: 13px !important; }
  
  button, .btn, a.btn { min-height: 44px !important; }
  input[type="text"], input[type="email"], input[type="tel"], input[type="number"], select, textarea { font-size: 16px !important; }
  img { max-width: 100% !important; height: auto !important; }
  
  /* Mobile swiper — 1.5 cards visible */
  section[class*="product-list"] .swiper-slide,
  .product-list-swiper .swiper-slide {
    max-width: 65vw !important;
  }
}

/* === SMALL PHONES === */
@media (max-width: 380px) {
  body, p, li, td, th, span, div { font-size: 14px; }
  .cro-comparison table { min-width: 340px !important; font-size: 12px !important; }
  .product-single__title, h1 { font-size: 22px !important; }
}
</style>`;

fs.writeFileSync(CSS, css);
console.log('✅ CSS written:', css.length, 'bytes');

// Validate no markdown
const md = (css.match(/\[[a-z_]+\]\(http:\/\/[a-z_]+\)/g) || []).length;
console.log('Markdown corruption:', md);
if (md > 0) process.exit(1);

// Push
console.log('\nPushing...\n');
execSync(`shopify theme push --store ${process.env.SHOPIFY_STORE || 'zrhgzw-xt.myshopify.com'} --theme 145031200883 --path ./theme-files --only ${CSS} --allow-live`, {stdio:'inherit'});

console.log('\nWaiting 30s for cache...');
setTimeout(async () => {
  const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
  const html = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  console.log('CSS loaded:', html.includes('SWIPER FIX') ? '✅' : '❌');
  console.log('Comparison center rule:', html.includes('COMPARISON TABLE CENTER') ? '✅' : '❌');
}, 30000);
