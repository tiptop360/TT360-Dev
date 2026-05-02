const fs = require('fs');
const { execSync } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

const TEMPLATE = 'theme-files/sections/product-template-1.liquid';
const THEME_LIQUID = 'theme-files/layout/theme.liquid';

console.log('🔧 MOBILE-FIRST FIX DEPLOY\n' + '='.repeat(50));

// [1] Viewport
let theme = fs.readFileSync(THEME_LIQUID, 'utf8');
const oldVp = theme.match(/<meta name="viewport"[^>]*>/);
if (oldVp) {
  theme = theme.replace(oldVp[0], '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
  console.log('[1] ✅ Viewport updated');
}
fs.writeFileSync(THEME_LIQUID, theme);

// [2] Mobile CSS snippet
const mobileCss = `{%- comment -%} Mobile-first CSS {%- endcomment -%}
<style>
@media (max-width: 768px) {
  html, body { overflow-x: hidden !important; max-width: 100vw !important; }
  .cro-comparison { padding: 12px !important; margin: 20px -8px !important; border-radius: 8px !important; }
  .cro-comparison h3 { font-size: 17px !important; }
  .cro-comparison table { min-width: 380px !important; font-size: 12px !important; }
  .cro-comparison th, .cro-comparison td { padding: 8px 6px !important; }
  .cro-fbt { padding: 14px !important; margin: 20px -8px !important; }
  .cro-fbt h3 { font-size: 17px !important; }
  .cro-fbt > div:nth-child(2) { gap: 4px !important; }
  .cro-rating-badge { font-size: 14px !important; }
  .cro-trust-band { font-size: 12px !important; padding: 10px !important; }
  .cro-risk-reversal { font-size: 13px !important; padding: 12px !important; margin: 12px -4px !important; }
  button, .btn, a.btn, [role="button"] { min-height: 44px !important; }
  .product-form__cart-submit { min-height: 52px !important; font-size: 16px !important; }
  input[type="text"], input[type="email"], input[type="tel"], input[type="number"], select, textarea { font-size: 16px !important; }
  .product-single__photos { max-width: 100% !important; overflow: hidden !important; }
  img { max-width: 100% !important; height: auto !important; }
}
@media (max-width: 380px) {
  .cro-comparison table { min-width: 340px !important; font-size: 11px !important; }
  h1, .product-single__title { font-size: 22px !important; line-height: 1.2 !important; }
}
@media (min-width: 769px) {
  .cro-comparison, .cro-fbt, .cro-trust-band, .cro-risk-reversal { max-width: 800px; margin-left: auto; margin-right: auto; }
}
</style>`;
fs.writeFileSync('theme-files/snippets/mobile-first-css.liquid', mobileCss);
console.log('[2] ✅ Mobile CSS snippet created');

// [3] Wire CSS into head
if (!theme.includes("'mobile-first-css'")) {
  theme = theme.replace('</head>', `{%- render 'mobile-first-css' -%}\n</head>`);
  fs.writeFileSync(THEME_LIQUID, theme);
  console.log('[3] ✅ Wired in <head>');
} else {
  console.log('[3] ✅ Already wired');
}

// [4] Re-inject trust band + risk reversal
let tpl = fs.readFileSync(TEMPLATE, 'utf8');
const atcAnchor = 'AddToCartText-';
const formCloseAfter = tpl.indexOf('</form>', tpl.indexOf(atcAnchor));
if (formCloseAfter > -1 && !tpl.includes("'product-trust-band'")) {
  const insertAt = formCloseAfter + 7;
  tpl = tpl.slice(0, insertAt) + `\n{%- render 'product-trust-band' -%}\n{%- render 'product-risk-reversal' -%}\n` + tpl.slice(insertAt);
  console.log('[4] ✅ Trust band + risk reversal re-injected');
} else if (tpl.includes("'product-trust-band'")) {
  console.log('[4] ✅ Already present');
}

// [5] STRICT corruption check — only flags Liquid identifier corruption (lowercase.identifiers in URL)
// Excludes legit Shopify schema help links like [Learn more](https://help.shopify.com/...)
const corruption = tpl.match(/\[[a-z_]+\.[a-z_]+(?:\.[a-z_]+)*\]\(http:\/\/[a-z_]+\.[a-z_]+/g) || [];
console.log(`[5] Corruption check: ${corruption.length} (excluding legit help links)`);
if (corruption.length > 0) {
  console.log('  ❌ Real corruption found:');
  corruption.forEach(c => console.log('   ', c));
  process.exit(1);
}

fs.writeFileSync(TEMPLATE, tpl);
console.log('\n✅ All files ready. Pushing...\n');

execSync(`shopify theme push --store ${process.env.SHOPIFY_STORE || 'zrhgzw-xt.myshopify.com'} --theme 145031200883 --path ./theme-files --only snippets/mobile-first-css.liquid --only sections/product-template-1.liquid --only layout/theme.liquid --allow-live`, {stdio:'inherit'});

console.log('\n[7] Waiting 25s for cache...');
setTimeout(async () => {
  const html = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now(), {headers:{'User-Agent':'Mozilla/5.0 iPhone'}})).text();
  const checks = [
    ['Viewport allows zoom', !/user-scalable=no|maximum-scale=[01](?!\.)/.test(html.match(/<meta name="viewport"[^>]*>/i)?.[0]||'')],
    ['Mobile CSS loaded', html.includes('MOBILE-FIRST') || html.includes('overflow-x: hidden')],
    ['Trust band rendered', html.includes('cro-trust-band')],
    ['Risk reversal rendered', html.includes('cro-risk-reversal')],
    ['Comparison rendered', html.includes('cro-comparison')],
    ['FBT rendered', html.includes('cro-fbt')],
    ['Rating badge rendered', html.includes('cro-rating-badge')],
    ['No Liquid errors', !html.includes('Liquid error')]
  ];
  console.log('\n=== VERIFICATION ===');
  let pass=0,fail=0;
  checks.forEach(([n,ok])=>{console.log(`  ${ok?'✅':'❌'} ${n}`);ok?pass++:fail++;});
  console.log(`\n${pass}/${checks.length} passed`);
}, 25000);
