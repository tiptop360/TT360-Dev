const fs = require('fs');
const { execSync } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

const SNIPPET = 'theme-files/snippets/product-schema-extra.liquid';
const TEMPLATE = 'theme-files/sections/product-template-1.liquid';

console.log('🗑️  REMOVE DUPLICATE PRODUCT SCHEMA\n' + '='.repeat(60));

// Backup
fs.copyFileSync(SNIPPET, `${SNIPPET}.PRE-REMOVE-${Date.now()}.bak`);
fs.copyFileSync(TEMPLATE, `${TEMPLATE}.PRE-REMOVE-${Date.now()}.bak`);

// Empty the snippet (don't delete file — Shopify CLI doesn't push deletions easily)
fs.writeFileSync(SNIPPET, `{%- comment -%} Removed — duplicate of theme native Product schema. Removed 2026-04-28. {%- endcomment -%}\n`);
console.log('[1] ✅ Snippet emptied');

// Strip render call from product-template-1.liquid
let tpl = fs.readFileSync(TEMPLATE, 'utf8');
const before = tpl.length;
tpl = tpl.replace(/\s*\{%-?\s*render\s+['"]product-schema-extra['"][^%]*-?%\}\s*/g, '\n');
const after = tpl.length;

if (before === after) {
  console.log('[2] ⚠️  No render call found in template');
} else {
  console.log(`[2] ✅ Removed ${before - after} chars from template`);
  
  // Validate Liquid balance
  const opens = (tpl.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
  const closes = (tpl.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
  if (opens !== closes) {
    console.log(`[3] ❌ Unbalanced (${opens}/${closes}) — restoring`);
    fs.copyFileSync(`${TEMPLATE}.PRE-REMOVE-${Date.now()}.bak`, TEMPLATE);
    process.exit(1);
  }
  console.log(`[3] ✅ Liquid balanced (${opens}/${closes})`);
  fs.writeFileSync(TEMPLATE, tpl);
}

// Push
console.log('\n[4] Pushing...\n');
execSync(`shopify theme push --store zrhgzw-xt.myshopify.com --theme 145031200883 --path ./theme-files --only ${SNIPPET} --only ${TEMPLATE} --allow-live`, {stdio:'inherit'});

// Wait + verify
console.log('\n[5] Waiting 60s + verifying live...');
setTimeout(async () => {
  const html = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  const productSchemas = (html.match(/"@type":\s*"Product"/g) || []).length;
  const aggregateRating = (html.match(/"@type":\s*"AggregateRating"/g) || []).length;
  console.log(`  Product schema count: ${productSchemas} (was 3, target: 2 — one app + one theme native)`);
  console.log(`  AggregateRating count: ${aggregateRating}`);
  console.log(`  Liquid errors: ${(html.match(/Liquid error/g) || []).length}`);
}, 60000);
