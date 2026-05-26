const fs = require('fs');
const { execSync } = require('child_process');

const CSS = 'theme-files/snippets/mobile-first-css.liquid';

const css = `{%- comment -%} Mobile-first — overflow + slightly larger fonts only {%- endcomment -%}
<style>
/* === SWIPER FIX (product list image sizing) === */
section[class*="product-list"] .swiper-slide img,
.product-list-swiper img {
  max-width: 100% !important;
  height: auto !important;
  object-fit: cover !important;
}
@media (min-width: 990px) {
  section[class*="product-list"] .swiper-slide {
    max-width: 260px !important;
  }
  section[class*="product-list"] .swiper-slide img {
    max-height: 260px !important;
  }
}
@media (max-width: 768px) {
  section[class*="product-list"] .swiper-slide {
    max-width: 65vw !important;
  }
}

/* === COMPARISON TABLE CENTER (desktop) === */
@media (min-width: 769px) {
  .cro-comparison,
  .cro-fbt,
  .cro-trust-band,
  .cro-risk-reversal {
    max-width: 800px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
}

/* === MOBILE — bigger fonts only, no color/family changes === */
@media (max-width: 768px) {
  html, body { overflow-x: hidden !important; max-width: 100vw !important; }
  
  /* Tap targets */
  button, .btn, a.btn { min-height: 44px !important; }
  
  /* Forms — prevent iOS zoom */
  input[type="text"], input[type="email"], input[type="tel"], input[type="number"], select, textarea { 
    font-size: 16px !important; 
  }
  
  /* Image containment */
  img { max-width: 100% !important; height: auto !important; }
  
  /* Bump tiny text to readable on mobile */
  [style*="font-size: 10px"], [style*="font-size:10px"] { font-size: 13px !important; }
  [style*="font-size: 11px"], [style*="font-size:11px"] { font-size: 13px !important; }
  [style*="font-size: 12px"], [style*="font-size:12px"] { font-size: 14px !important; }
  [style*="font-size: 13px"], [style*="font-size:13px"] { font-size: 14px !important; }
  
  /* CRO blocks — comfortable mobile sizes */
  .cro-rating-badge { font-size: 15px !important; }
  .cro-rating-badge a { font-size: 13px !important; }
  .cro-trust-band { font-size: 13px !important; padding: 12px !important; }
  .cro-risk-reversal { font-size: 14px !important; padding: 14px !important; margin: 14px -4px !important; }
  
  .cro-comparison { padding: 14px !important; margin: 24px -8px !important; }
  .cro-comparison h3 { font-size: 18px !important; text-align: center !important; }
  .cro-comparison table { min-width: 380px !important; font-size: 13px !important; }
  .cro-comparison th, .cro-comparison td { padding: 9px 6px !important; }
  
  .cro-fbt { padding: 16px !important; margin: 24px -4px !important; }
  .cro-fbt h3 { font-size: 18px !important; text-align: center !important; }
  
  /* Product title — readable */
  .product-single__title, h1 { font-size: 24px !important; line-height: 1.3 !important; }
  
  /* CTA — prominent */
  .product-form__cart-submit { font-size: 17px !important; min-height: 52px !important; }
}

/* === SMALL PHONES === */
@media (max-width: 380px) {
  .cro-comparison table { min-width: 340px !important; font-size: 12px !important; }
  .product-single__title, h1 { font-size: 22px !important; }
}
</style>`;

fs.writeFileSync(CSS, css);
console.log('✅ Clean CSS (no font/color changes):', css.length, 'bytes');

execSync(`shopify theme push --store zrhgzw-xt.myshopify.com --theme 145031200883 --path ./theme-files --only ${CSS} --allow-live`, {stdio:'inherit'});
console.log('✅ Pushed');
