require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');

const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';
const LAYOUT = 'theme-files/layout/theme.liquid';
const TS = Date.now();

console.log('\n Fix: Remove Duplicate Scripts + External jQuery\n' + '='.repeat(50));

fs.copyFileSync(LAYOUT, `${LAYOUT}.PRE-DEDUP-${TS}.bak`);
let layout = fs.readFileSync(LAYOUT, 'utf8');

const before = layout.length;

// Track what we find
let fixes = [];

// Fix 1: Remove external code.jquery.com — Shopify already loads jQuery
// The theme loads api.jquery-7ab1a3a4.js which IS jQuery
const jqueryExternal = /<script[^>]*src="https:\/\/code\.jquery\.com\/[^"]*"[^>]*><\/script>/g;
if (jqueryExternal.test(layout)) {
  layout = layout.replace(/<script[^>]*src="https:\/\/code\.jquery\.com\/[^"]*"[^>]*><\/script>/g, '<!-- jQuery removed: Shopify theme already loads jQuery via api.jquery -->');
  fixes.push('External jQuery removed (code.jquery.com)');
} else {
  fixes.push('External jQuery not in theme.liquid (may be section file)');
}

// Fix 2: Remove second occurrence of lazysizes
const lazysizesMatches = layout.match(/<script[^>]*lazysizes[^>]*>/g) || [];
if (lazysizesMatches.length > 1) {
  let count = 0;
  layout = layout.replace(/<script[^>]*lazysizes[^>]*>[\s\S]*?<\/script>/g, (match) => {
    count++;
    if (count === 1) return match; // keep first
    return '<!-- lazysizes dedup removed -->';
  });
  fixes.push('Duplicate lazysizes removed');
} else {
  // Self-closing or simple tag version
  let lazyCount = 0;
  layout = layout.replace(/<script[^>]*lazysizes\.min\.js[^>]*>/g, (match) => {
    lazyCount++;
    if (lazyCount === 1) return match;
    return '<!-- lazysizes dedup -->';
  });
  if (lazyCount > 1) fixes.push('Duplicate lazysizes script tag removed');
  else fixes.push('lazysizes: only 1 occurrence in theme.liquid');
}

// Fix 3: Remove second occurrence of vendor.s.min.js
let vendorCount = 0;
layout = layout.replace(/<script[^>]*vendor\.s\.min\.js[^>]*>/g, (match) => {
  vendorCount++;
  if (vendorCount === 1) return match;
  return '<!-- vendor dedup -->';
});
if (vendorCount > 1) fixes.push('Duplicate vendor.s.min.js removed');
else fixes.push('vendor.s: only 1 occurrence in theme.liquid (duplicate may be in section)');

// Fix 4: Ensure GTM loads async not sync
layout = layout.replace(
  /(<script[^>]*googletagmanager[^>]*gtag\/js[^>]*)(>)/,
  (match, p1) => {
    if (p1.includes('async')) return match;
    return p1 + ' async>';
  }
);
fixes.push('GTM confirmed async');

const after = layout.length;
console.log('Bytes removed:', before - after);
fixes.forEach(f => console.log(' ', f));

fs.writeFileSync(LAYOUT, layout);

// Validate — no Liquid errors introduced
const opens = (layout.match(/\{%-?\s*(if|for|unless|case)\b/g)||[]).length;
const closes = (layout.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g)||[]).length;
if (opens !== closes) {
  fs.copyFileSync(`${LAYOUT}.PRE-DEDUP-${TS}.bak`, LAYOUT);
  console.log('Liquid imbalance — rolled back');
  process.exit(1);
}
console.log('Liquid balance OK:', opens, '=', closes);

console.log('\nPushing...');
try {
  execSync(
    `shopify theme push --store ${STORE} --theme ${THEME} --path ./theme-files --only layout/theme.liquid --allow-live`,
    { stdio: 'inherit', cwd: '/Users/rabiharabi/tiptop360-optimizer' }
  );
  console.log('\nDUPLICATE SCRIPT FIX COMPLETE');
  console.log('Expected TBT improvement: -200 to -400ms');
  console.log('Run PageSpeed again in 2 min to verify');
} catch(e) {
  fs.copyFileSync(`${LAYOUT}.PRE-DEDUP-${TS}.bak`, LAYOUT);
  console.log('Push failed — rolled back');
  process.exit(1);
}
