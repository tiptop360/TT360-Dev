const fs = require('fs');
const { execSync } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

console.log('🔧 FIX H1 + FAQ DUPLICATES\n' + '='.repeat(50));

// =================================================
// FIX 1: H1 → H2 in screenfree-banner section
// =================================================
const BANNER = 'theme-files/sections/screenfree-banner-uae-2026.liquid';
fs.copyFileSync(BANNER, `${BANNER}.${Date.now()}.bak`);
let banner = fs.readFileSync(BANNER, 'utf8');

if (banner.includes('<h1>{{ section.settings.heading }}</h1>')) {
  banner = banner.replace('<h1>{{ section.settings.heading }}</h1>', '<h2>{{ section.settings.heading }}</h2>');
  fs.writeFileSync(BANNER, banner);
  console.log('[1] ✅ Banner H1 → H2 (no longer collides with page title)');
} else {
  console.log('[1] ⚠️ Banner H1 pattern not found — already fixed?');
}

// =================================================
// FIX 2: Remove FAQPage from product-schema-extra.liquid
// =================================================
const EXTRA = 'theme-files/snippets/product-schema-extra.liquid';
fs.copyFileSync(EXTRA, `${EXTRA}.${Date.now()}.bak`);
let extra = fs.readFileSync(EXTRA, 'utf8');
const extraLen = extra.length;

// Strip the entire FAQPage <script> block
extra = extra.replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?"@type":\s*"FAQPage"[\s\S]*?<\/script>/gi, '');
extra = extra.replace(/{%-?\s*if[\s\S]*?FAQPage[\s\S]*?endif\s*-?%}/gi, '');

fs.writeFileSync(EXTRA, extra);
console.log(`[2] ✅ Stripped FAQPage from product-schema-extra.liquid: ${extraLen - extra.length} chars removed`);
console.log(`    Remaining FAQPage refs: ${(extra.match(/FAQPage/g) || []).length}`);

// =================================================
// FIX 3: Remove FAQPage from theme.liquid
// =================================================
const THEME = 'theme-files/layout/theme.liquid';
fs.copyFileSync(THEME, `${THEME}.${Date.now()}.bak`);
let theme = fs.readFileSync(THEME, 'utf8');
const themeLen = theme.length;

// Find the @graph entry containing FAQPage and remove just that object
// Most carefully: target the FAQPage entry in @graph array
theme = theme.replace(/,?\s*\{\s*"@type":\s*"FAQPage",\s*"mainEntity":\s*\[[\s\S]*?\]\s*\}/g, '');

fs.writeFileSync(THEME, theme);
console.log(`[3] ✅ Stripped FAQPage from theme.liquid: ${themeLen - theme.length} chars removed`);
console.log(`    Remaining FAQPage refs: ${(theme.match(/FAQPage/g) || []).length}`);

// =================================================
// VALIDATION
// =================================================
console.log('\n[4] Validating Liquid balance + JSON...');
for (const [file, content] of [[BANNER, banner], [EXTRA, extra], [THEME, theme]]) {
  const opens = (content.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
  const closes = (content.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
  console.log(`    ${file.split('/').pop()}: ${opens}/${closes} blocks`);
  if (opens !== closes) { console.log('  ❌ Unbalanced!'); process.exit(1); }
}
console.log('    ✅ All balanced');

// =================================================
// PUSH
// =================================================
console.log('\n[5] Pushing 3 files...\n');
execSync(`shopify theme push --store zrhgzw-xt.myshopify.com --theme 145031200883 --path ./theme-files --only ${BANNER} --only ${EXTRA} --only ${THEME} --allow-live`, {stdio:'inherit'});

// =================================================
// VERIFY
// =================================================
console.log('\n[6] Waiting 35s for cache, then verifying...');
setTimeout(async () => {
  const checks = [
    ['Toothbrush', 'https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift'],
    ['About', 'https://tiptop360.com/pages/about-tiptop360'],
    ['Vision', 'https://tiptop360.com/pages/vision-mission-values']
  ];
  
  console.log('\n=== VERIFICATION ===');
  for (const [name, url] of checks) {
    const html = await (await fetch(`${url}?x=${Date.now()}`)).text();
    const h1 = (html.match(/<h1[\s>]/gi) || []).length;
    const faq = (html.match(/"@type":\s*"FAQPage"/g) || []).length;
    const liquidErr = html.includes('Liquid error');
    console.log(`\n  ${name}:`);
    console.log(`    H1 count: ${h1} ${h1 === 1 ? '✅' : '❌ (should be 1)'}`);
    if (url.includes('/products/')) console.log(`    FAQPage count: ${faq} ${faq === 1 ? '✅' : '❌ (should be 1)'}`);
    console.log(`    Liquid errors: ${liquidErr ? '❌' : '✅'}`);
  }
}, 35000);
