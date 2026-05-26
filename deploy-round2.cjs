/**
 * deploy-round2.cjs
 * Phase 7 Round 2 + Phase 5 GEO + A/B Test — theme file deployment
 * Run: node deploy-round2.cjs
 */
require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');

const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';
const TS = Date.now();

if (!STORE) { console.error('SHOPIFY_STORE not set in .env'); process.exit(1); }

const FILES = [
  'snippets/critical-css.liquid',       // Phase 7: expanded critical CSS (CLS prevention, ATC, trust band)
  'snippets/ab-test.liquid',             // A/B test: cookie handler + CSS hiding
  'sections/aivox-pdp.liquid',           // Phase 7: srcset+fetchpriority; A/B test CTA wired in
  'sections/gymbag-pdp.liquid',          // Phase 7: srcset+fetchpriority on hero image
  'templates/page.llms-txt.liquid',      // Phase 5 GEO: llms.txt template (layout none)
];

console.log('\nRound 2 Deploy — Phase 7 + GEO + A/B\n' + '='.repeat(50));
console.log('Files to push:');
FILES.forEach(f => console.log('  ' + f));

// Backup
FILES.forEach(f => {
  const p = `theme-files/${f}`;
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, `${p}.PRE-R2-${TS}.bak`);
  }
});
console.log('\nBackups created.');

// Markdown corruption check
console.log('\nChecking for markdown corruption...');
let clean = true;
FILES.forEach(f => {
  const p = `theme-files/${f}`;
  if (!fs.existsSync(p)) { console.log(`  MISSING: ${f}`); clean = false; return; }
  const count = (fs.readFileSync(p, 'utf8').match(/\]\(http/g) || []).length;
  if (count > 0) { console.log(`  CORRUPT: ${f} (${count} markdown links found)`); clean = false; }
  else { console.log(`  OK: ${f}`); }
});
if (!clean) { console.error('\nAbort: markdown corruption detected.'); process.exit(1); }

// Push
console.log('\nPushing to live theme...');
const only = FILES.map(f => `--only ${f}`).join(' ');
try {
  execSync(
    `shopify theme push --store ${STORE} --theme ${THEME} --path ./theme-files ${only} --allow-live`,
    { stdio: 'inherit' }
  );
  console.log('\nDeploy complete.');
  console.log('\nExpected gains:');
  console.log('  LCP    : -0.3-0.6s (fetchpriority=high + srcset)');
  console.log('  CLS    : <0.05 (reserved image dimensions + min-height)');
  console.log('  FOIT   : eliminated (font-display:swap in critical CSS)');
  console.log('  llms   : /llms.txt now serves raw markdown via page template');
  console.log('  A/B    : Test 1 (CTA copy) live on AI Voice Recorder page');
} catch(e) {
  console.error('\nPush failed — rolling back.');
  FILES.forEach(f => {
    const p = `theme-files/${f}`;
    const bak = `${p}.PRE-R2-${TS}.bak`;
    if (fs.existsSync(bak)) fs.copyFileSync(bak, p);
  });
  process.exit(1);
}
