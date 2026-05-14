require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');

const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';
const ROOT  = '/Users/rabiharabi/tiptop360-optimizer';
const FILE  = ROOT + '/theme-files/sections/gymbag-pdp.liquid';
const TS    = Date.now();

// Tag builders — assembled at runtime, never written as raw Liquid in this script
const OB = '{%', CB = '%}', OBD = '{%-', CBD = '-%}', OV = '{{', CV = '}}';
const lv  = v => OV + ' ' + v + ' ' + CV;
const lb  = v => OB + ' ' + v + ' ' + CB;
const lbm = v => OBD + ' ' + v + ' ' + CBD;

// Read current file
let s = fs.readFileSync(FILE, 'utf8');
fs.copyFileSync(FILE, FILE + '.PRE-REPAIR-' + TS + '.bak');

// ── Fix 1: heal the corrupted assign lines ────────────────
// The markdown renderer turned {%- assign sale = product.compare_at_price > product.price -%}
// into {{ product.compare_at_price > product.price }} — find and replace all forms

const correctAssigns =
  lbm('assign black_v = product.variants | where: "title", "Black" | first') + '\n' +
  lbm('assign gray_v  = product.variants | where: "title", "Gray"  | first') + '\n' +
  lbm('assign sale    = product.compare_at_price > product.price') + '\n' +
  lbm('assign pct     = product.compare_at_price | minus: product.price | times: 100 | divided_by: product.compare_at_price');

// Remove ALL variants of the corrupted assign block (regex catches both corrupted and partial forms)
s = s.replace(
  /\{%-?\s*assign black_v[\s\S]*?assign pct[^\n]*\n?/,
  correctAssigns + '\n'
);

// Also catch if they ended up as {{ }} variable outputs instead of {% %} tags
s = s.replace(
  /\{\{[^}]*compare_at_price\s*>\s*product\.price[^}]*\}\}/g,
  lbm('assign sale = product.compare_at_price > product.price')
);

// ── Fix 2: ensure sale/pct assigns appear near top, after comment block ──
if (!s.includes('assign sale')) {
  // Insert after the comment block
  s = s.replace(
    lbm('endcomment') + '\n',
    lbm('endcomment') + '\n' + correctAssigns + '\n'
  );
}

// ── Fix 3: fix the pct display line if it references undefined pct ──
// Make sure any inline pct assign in price block is present
const pctInline = lbm('assign pct = product.compare_at_price | minus: product.price | times: 100 | divided_by: product.compare_at_price');
if (!s.includes('assign pct')) {
  s = s.replace(
    lbm('if sale') + '\n',
    lbm('if sale') + '\n    ' + pctInline + '\n'
  );
}

// ── Validate ─────────────────────────────────────────────
const opens  = (s.match(/\{%-?\s*(if|for|unless|case|form)\b/g)||[]).length;
const closes = (s.match(/\{%-?\s*(endif|endfor|endunless|endcase|endform)\b/g)||[]).length;
console.log('Liquid balance: ' + opens + '/' + closes + ' ' + (opens===closes?'✅':'❌'));

// Check the comparison syntax is now clean
const corrupt = (s.match(/\{\{[^}]*compare_at_price\s*>/g)||[]).length;
console.log('Corruption cleared: ' + (corrupt===0?'✅':'❌ still present: '+corrupt));

if (opens !== closes || corrupt > 0) {
  fs.copyFileSync(FILE + '.PRE-REPAIR-' + TS + '.bak', FILE);
  console.log('❌ Rolled back'); process.exit(1);
}

fs.writeFileSync(FILE, s);
console.log('✅ File healed');

// ── Push ─────────────────────────────────────────────────
console.log('\n📤 Pushing repaired section...');
try {
  execSync(
    'shopify theme push --store ' + STORE + ' --theme ' + THEME +
    ' --path ./theme-files' +
    ' --only sections/gymbag-pdp.liquid' +
    ' --allow-live',
    { stdio: 'inherit', cwd: ROOT }
  );
  console.log('\n✅ GYMBAG PDP REPAIRED & LIVE');
  console.log('\nNow assign the template:');
  console.log('  Admin → Products → Magnetic Gym Bag UAE → Theme template → product.gymbag → Save');
  console.log('  Then: bash regression-geo.sh');
} catch(e) {
  fs.copyFileSync(FILE + '.PRE-REPAIR-' + TS + '.bak', FILE);
  console.log('❌ Push failed — rolled back'); process.exit(1);
}
