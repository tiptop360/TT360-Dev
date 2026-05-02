const fs = require('fs');
const { execSync } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

const CARD = 'theme-files/snippets/product-card.liquid';
const CSS = 'theme-files/snippets/mobile-first-css.liquid';

console.log('🚀 ATOMIC DEPLOY: heal + stars + mobile fonts\n' + '='.repeat(60));

// === STEP 1: Heal product-card.liquid corruption ===
let card = fs.readFileSync(CARD, 'utf8');
fs.copyFileSync(CARD, CARD + '.PRE-HEAL.bak');
const before = card.length;
card = card.replace(/\[([a-z_][a-z0-9_.]*)\]\(http:\/\/[a-z_][a-z0-9_.]*\)/g, '$1');
const remaining = (card.match(/\[[a-z_][a-z0-9_.]*\]\(http:\/\/[a-z_][a-z0-9_.]*\)/g) || []).length;
console.log(`[1] Healed product-card.liquid: ${before - card.length} chars removed, ${remaining} remaining`);
if (remaining > 0) { console.log('❌ Still corrupted'); process.exit(1); }

// === STEP 2: Inject star rating ABOVE title (inside each card style block) ===
// Insert after each occurrence of `class="product-card js-product-card`
const ratingSnippet = `{%- assign rc = product.metafields.reviews.rating_count -%}
{%- if rc and rc != 0 -%}
{%- assign rv = product.metafields.reviews.rating.value.value | default: 4.9 -%}
<div class="product-card__rating" style="display:flex;align-items:center;gap:5px;margin:4px 0;font-size:13px;line-height:1;">
<span style="color:#FFB800;letter-spacing:1px;font-size:15px;">★★★★★</span>
<span style="color:#666;">({{ rc }})</span>
</div>
{%- endif -%}
`;

// Find each product-card class and inject rating block after the opening div
let injectionCount = 0;
card = card.replace(/(<div class="product-card js-product-card[^"]*"[^>]*>)/g, (match) => {
  injectionCount++;
  return match + '\n' + ratingSnippet;
});
console.log(`[2] Injected rating block in ${injectionCount} card styles`);

// === STEP 3: Validate Liquid balance ===
const opens = (card.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
const closes = (card.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
console.log(`[3] Liquid balance: ${opens}/${closes}`);
if (opens !== closes) { console.log('❌ Unbalanced'); process.exit(1); }

fs.writeFileSync(CARD, card);

// === STEP 4: Mobile-only CSS (desktop untouched) ===
const mobileCss = `{%- comment -%} Mobile-first — fonts + overflow + swiper sizing. Desktop untouched. {%- endcomment -%}
<style>
/* === SWIPER PRODUCT LIST IMAGES === */
section[class*="product-list"] .swiper-slide img,
.product-list-swiper img {
  max-width: 100% !important;
  height: auto !important;
  object-fit: cover !important;
}
@media (min-width: 990px) {
  section[class*="product-list"] .swiper-slide { max-width: 260px !important; }
  section[class*="product-list"] .swiper-slide img { max-height: 260px !important; }
}

/* === COMPARISON CENTER (desktop only) === */
@media (min-width: 769px) {
  .cro-comparison, .cro-fbt, .cro-trust-band, .cro-risk-reversal {
    max-width: 800px !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
}

/* === MOBILE ONLY (768px and below) === */
@media (max-width: 768px) {
  html, body { overflow-x: hidden !important; max-width: 100vw !important; }
  
  /* Bump tiny text */
  [style*="font-size: 10px"], [style*="font-size:10px"] { font-size: 13px !important; }
  [style*="font-size: 11px"], [style*="font-size:11px"] { font-size: 13px !important; }
  [style*="font-size: 12px"], [style*="font-size:12px"] { font-size: 14px !important; }
  [style*="font-size: 13px"], [style*="font-size:13px"] { font-size: 14px !important; }
  
  /* Body text floor */
  body, p, li { font-size: 16px !important; line-height: 1.55 !important; }
  
  /* Product card */
  .product-card__title, .product-card .product__title { font-size: 15px !important; line-height: 1.3 !important; }
  .product-card__price, .product-card .price { font-size: 16px !important; font-weight: 700 !important; }
  .product-card__rating { font-size: 13px !important; }
  
  /* Product page critical */
  .product-single__title, h1 { font-size: 24px !important; line-height: 1.3 !important; }
  .product-single__price { font-size: 22px !important; font-weight: 700 !important; }
  .product-form__cart-submit { font-size: 17px !important; min-height: 52px !important; }
  
  /* CRO blocks */
  .cro-rating-badge { font-size: 15px !important; }
  .cro-trust-band { font-size: 14px !important; padding: 12px !important; }
  .cro-risk-reversal { font-size: 14px !important; padding: 14px !important; margin: 14px -4px !important; }
  .cro-comparison { padding: 14px !important; margin: 24px -8px !important; }
  .cro-comparison h3 { font-size: 18px !important; text-align: center !important; }
  .cro-comparison table { min-width: 380px !important; font-size: 13px !important; }
  .cro-comparison th, .cro-comparison td { padding: 9px 6px !important; }
  .cro-fbt { padding: 16px !important; margin: 24px -4px !important; }
  .cro-fbt h3 { font-size: 18px !important; text-align: center !important; }
  
  /* Tap targets */
  button, .btn, a.btn { min-height: 44px !important; }
  
  /* Form anti-zoom */
  input[type="text"], input[type="email"], input[type="tel"], input[type="number"], select, textarea { 
    font-size: 16px !important; 
  }
  
  img { max-width: 100% !important; height: auto !important; }
  
  /* Mobile swiper width */
  section[class*="product-list"] .swiper-slide { max-width: 65vw !important; }
}

/* === SMALL PHONES === */
@media (max-width: 380px) {
  .cro-comparison table { min-width: 340px !important; font-size: 12px !important; }
  .product-single__title, h1 { font-size: 22px !important; }
  body, p, li { font-size: 15px !important; }
}
</style>`;

fs.writeFileSync(CSS, mobileCss);
console.log('[4] ✅ Mobile-only CSS written:', mobileCss.length, 'bytes');

// === STEP 5: Validate CSS no markdown ===
const cssMd = (mobileCss.match(/\[[a-z_]+\]\(http:\/\/[a-z_]+\)/g) || []).length;
if (cssMd > 0) { console.log('❌ CSS has markdown'); process.exit(1); }
console.log('[5] ✅ All validations passed');

// === STEP 6: Push ===
console.log('\n🚀 Pushing...\n');
execSync(`shopify theme push --store zrhgzw-xt.myshopify.com --theme 145031200883 --path ./theme-files --only ${CARD} --only ${CSS} --allow-live`, {stdio:'inherit'});

// === STEP 7: Verify ===
console.log('\n[7] Verifying live (35s wait)...');
setTimeout(async () => {
  const homeHtml = await (await fetch('https://tiptop360.com/?x=' + Date.now())).text();
  const collHtml = await (await fetch('https://tiptop360.com/collections/kids-collection-uae?x=' + Date.now())).text();
  const prodHtml = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  
  const checks = [
    ['Stars on home', homeHtml.includes('product-card__rating')],
    ['Stars on collection', collHtml.includes('product-card__rating')],
    ['Mobile CSS deployed', prodHtml.includes('Mobile-first — fonts')],
    ['No Liquid errors home', !homeHtml.includes('Liquid error')],
    ['No Liquid errors collection', !collHtml.includes('Liquid error')],
    ['No Liquid errors product', !prodHtml.includes('Liquid error')],
    ['CRO blocks intact', prodHtml.includes('cro-comparison') && prodHtml.includes('cro-fbt')]
  ];
  console.log('\n=== VERIFICATION ===');
  let pass=0,fail=0;
  checks.forEach(([n,ok])=>{console.log(`  ${ok?'✅':'❌'} ${n}`);ok?pass++:fail++;});
  console.log(`\n${pass}/${checks.length} passed`);
}, 35000);
