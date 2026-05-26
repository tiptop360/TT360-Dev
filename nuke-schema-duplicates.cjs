const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

const TS = Date.now();
const filesToPush = [];

console.log('🔧 NUKE SCHEMA DUPLICATES\n' + '='.repeat(60));

// === STEP 1: Remove avada-seo include from 4 gempages layouts ===
const gempagesFiles = [
  'theme-files/layout/theme.gempages.header.liquid',
  'theme-files/layout/theme.gempages.footer.liquid',
  'theme-files/layout/theme.gempages.blank.liquid',
  'theme-files/layout/theme.gem-layout-none.liquid'
];

for (const file of gempagesFiles) {
  if (!fs.existsSync(file)) continue;
  fs.copyFileSync(file, `${file}.PRE-NUKE-${TS}.bak`);
  let c = fs.readFileSync(file, 'utf8');
  const before = c.length;
  c = c.replace(/\s*\{%\s*include\s+['"]avada-seo['"]\s*%\}\s*/g, '\n');
  c = c.replace(/\s*\{%-?\s*render\s+['"]avada-seo['"][^%]*-?%\}\s*/g, '\n');
  
  if (before !== c.length) {
    // Validate Liquid balance
    const opens = (c.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
    const closes = (c.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
    if (opens !== closes) {
      console.log(`  ❌ ${file}: unbalanced — restoring`);
      fs.copyFileSync(`${file}.PRE-NUKE-${TS}.bak`, file);
      continue;
    }
    fs.writeFileSync(file, c);
    filesToPush.push(file);
    console.log(`  ✅ Stripped avada-seo from ${file.split('/').pop()} (${before - c.length} chars)`);
  } else {
    console.log(`  ⊘ ${file.split('/').pop()} — no avada-seo include found`);
  }
}

// === STEP 2: Empty avada-seo.liquid + dependency snippets ===
const avadaSnippets = [
  'theme-files/snippets/avada-seo.liquid',
  'theme-files/snippets/avada-seo-local-business.liquid',
  'theme-files/snippets/avada-seo-meta.liquid',
  'theme-files/snippets/avada-seo-other.liquid',
  'theme-files/snippets/avada-seo-social.liquid',
  'theme-files/snippets/avada-seo-status.liquid'
];

for (const file of avadaSnippets) {
  if (!fs.existsSync(file)) continue;
  fs.copyFileSync(file, `${file}.PRE-NUKE-${TS}.bak`);
  fs.writeFileSync(file, `{%- comment -%} AVADA SEO removed 2026-04-29 — replaced by theme native + Google&YT app schemas {%- endcomment -%}\n`);
  filesToPush.push(file);
  console.log(`  ✅ Emptied ${file.split('/').pop()}`);
}

// === STEP 3: Empty my custom product-schema-extra.liquid ===
const myCustom = 'theme-files/snippets/product-schema-extra.liquid';
fs.copyFileSync(myCustom, `${myCustom}.PRE-NUKE-${TS}.bak`);
fs.writeFileSync(myCustom, `{%- comment -%} Removed 2026-04-29 — duplicate of theme native Product schema {%- endcomment -%}\n`);
filesToPush.push(myCustom);
console.log(`  ✅ Emptied product-schema-extra.liquid`);

// === STEP 4: Strip render call from product-template-1.liquid ===
const tpl = 'theme-files/sections/product-template-1.liquid';
fs.copyFileSync(tpl, `${tpl}.PRE-NUKE-${TS}.bak`);
let t = fs.readFileSync(tpl, 'utf8');
const tBefore = t.length;
t = t.replace(/\s*\{%-?\s*render\s+['"]product-schema-extra['"][^%]*-?%\}\s*/g, '\n');
if (tBefore !== t.length) {
  // Validate
  const opens = (t.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
  const closes = (t.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
  if (opens !== closes) {
    console.log(`  ❌ product-template-1.liquid unbalanced — restoring`);
    fs.copyFileSync(`${tpl}.PRE-NUKE-${TS}.bak`, tpl);
  } else {
    fs.writeFileSync(tpl, t);
    filesToPush.push(tpl);
    console.log(`  ✅ Stripped render call from product-template-1.liquid (${tBefore - t.length} chars)`);
  }
}

// === STEP 5: Push everything ===
if (filesToPush.length === 0) {
  console.log('\n⚠️  Nothing to push.');
  process.exit(0);
}

console.log(`\n📤 Pushing ${filesToPush.length} files...\n`);
const onlyArgs = filesToPush.map(f => `--only ${f}`).join(' ');
execSync(`shopify theme push --store zrhgzw-xt.myshopify.com --theme 145031200883 --path ./theme-files ${onlyArgs} --allow-live`, {stdio:'inherit'});

// === STEP 6: Force cache flush ===
(async () => {
  console.log('\n🔥 Force-flushing edge cache...');
  const STORE = process.env.SHOPIFY_STORE;
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  await fetch(`https://${STORE}/admin/api/2024-10/themes/145031200883.json`, {
    method:'PUT', headers:{'X-Shopify-Access-Token':t,'Content-Type':'application/json'},
    body: JSON.stringify({theme:{id:145031200883, name:'TipTop360 | NEW Cloud optimized'}})
  });
  console.log('  ✅ Theme touched');

  console.log('\n⏳ Waiting 90s for full propagation...');
  await new Promise(r => setTimeout(r, 90000));

  // === STEP 7: Verify ===
  const html = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  const productCount = (html.match(/"@type":\s*"Product"/g) || []).length;
  const aggCount = (html.match(/"@type":\s*"AggregateRating"/g) || []).length;
  const faqCount = (html.match(/"@type":\s*"FAQPage"/g) || []).length;
  const liquidErrors = (html.match(/Liquid error/g) || []).length;
  const avadaRefs = (html.match(/avada/gi) || []).length;
  const appSnippets = (html.match(/BEGIN app snippet/g) || []).length;
  
  console.log('\n=== AFTER NUKE ===');
  console.log(`  Product schema:      ${productCount} (target: 1)`);
  console.log(`  AggregateRating:     ${aggCount} (expect 1 from theme/Judge.me)`);
  console.log(`  FAQPage:             ${faqCount} (target: 1)`);
  console.log(`  Liquid errors:       ${liquidErrors} (target: 0)`);
  console.log(`  AVADA refs in HTML:  ${avadaRefs} (target: 0)`);
  console.log(`  App snippet markers: ${appSnippets}`);
  if (appSnippets > 0) {
    const matches = [...html.matchAll(/BEGIN app snippet:\s*([a-z-]+)/g)].map(m => m[1]);
    console.log(`    Markers: ${[...new Set(matches)].join(', ')}`);
  }
})();
