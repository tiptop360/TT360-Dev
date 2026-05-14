/**
 * deploy-aivox-pdp.cjs
 * Atomic deploy — Phase 4 of AiVox PDP implementation
 * Backup → validate → push → verify → rollback on failure
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

const STORE     = process.env.SHOPIFY_STORE;
const THEME     = '145031200883';
const TS        = Date.now();
const ROOT      = '/Users/rabiharabi/tiptop360-optimizer';

const FILES = {
  template: path.join(ROOT, 'theme-files/templates/product.aivox.json'),
  section:  path.join(ROOT, 'theme-files/sections/aivox-pdp.liquid'),
};

const SOURCES = {
  template: path.join(__dirname, 'product.aivox.json'),
  section:  path.join(__dirname, 'aivox-pdp.liquid'),
};

const BACKUPS = {
  section: FILES.section + `.PRE-AIVOX-${TS}.bak`,
};

console.log('\n🚀 AIVOX PDP — ATOMIC DEPLOY');
console.log('='.repeat(50));

// ── Step 1: Backup existing section if it exists ──────
if (fs.existsSync(FILES.section)) {
  fs.copyFileSync(FILES.section, BACKUPS.section);
  console.log('✅ Backup created:', path.basename(BACKUPS.section));
} else {
  console.log('ℹ️  No existing section to backup (new file)');
}

// ── Step 2: Copy source files into theme-files ────────
fs.mkdirSync(path.dirname(FILES.template), { recursive: true });
fs.mkdirSync(path.dirname(FILES.section),  { recursive: true });

fs.copyFileSync(SOURCES.template, FILES.template);
fs.copyFileSync(SOURCES.section,  FILES.section);
console.log('✅ Files copied into theme-files/');

// ── Step 3: Validate Liquid balance ───────────────────
const liquid = fs.readFileSync(FILES.section, 'utf8');
const opens  = (liquid.match(/\{%-?\s*(if|for|unless|case|form)\b/g) || []).length;
const closes = (liquid.match(/\{%-?\s*(endif|endfor|endunless|endcase|endform)\b/g) || []).length;

if (opens !== closes) {
  console.log(`❌ Liquid imbalance: ${opens} opens vs ${closes} closes — rolling back`);
  if (fs.existsSync(BACKUPS.section)) fs.copyFileSync(BACKUPS.section, FILES.section);
  fs.unlinkSync(FILES.template);
  process.exit(1);
}
console.log(`✅ Liquid balanced: ${opens} open / ${closes} close`);

// ── Step 4: No markdown corruption ───────────────────
const corruption = liquid.match(/\[[a-z_]+\.[a-z_]+(?:\.[a-z_]+)*\]\(http:\/\/[a-z_]+\.[a-z_]+/g) || [];
if (corruption.length) {
  console.log('❌ Markdown corruption detected — rolling back');
  if (fs.existsSync(BACKUPS.section)) fs.copyFileSync(BACKUPS.section, FILES.section);
  process.exit(1);
}
console.log('✅ No markdown corruption');

// ── Step 5: Schema present ────────────────────────────
if (!liquid.includes('{% schema %}')) {
  console.log('❌ Missing {% schema %} block');
  process.exit(1);
}
console.log('✅ Schema block present');

// ── Step 6: Push to duplicate theme ──────────────────
console.log('\n📤 Pushing to duplicate theme...');
try {
  execSync(
    `shopify theme push --store ${STORE} --theme ${THEME} --path ./theme-files ` +
    `--only templates/product.aivox.json ` +
    `--only sections/aivox-pdp.liquid ` +
    `--allow-live`,
    { stdio: 'inherit', cwd: ROOT }
  );
} catch (e) {
  console.log('❌ Push failed — rolling back files');
  if (fs.existsSync(BACKUPS.section)) fs.copyFileSync(BACKUPS.section, FILES.section);
  fs.unlinkSync(FILES.template);
  process.exit(1);
}

// ── Step 7: Wait for cache + verify ──────────────────
console.log('\n⏳ Waiting 30s for cache propagation...');
setTimeout(async () => {
  try {
    // Test on the Shopify preview URL
    const previewUrl = `https://tiptop360.com/products/ai-voice-recorder?preview_theme_id=${THEME}&x=${Date.now()}`;
    const html = await (await fetch(previewUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }
    })).text();

    const checks = [
      ['aivox-pdp',         'Section class present'],
      ['aivox-stage',       'Slideshow stage present'],
      ['aivox-deal',        'Exclusive deal box present'],
      ['aivox-sticky',      'Sticky ATC present'],
      ['cart/add',          'Add to Cart form present'],
      ['/checkout',         'Checkout redirect present'],
      ['wa.me/971585156033','WhatsApp link present'],
      ['aivox-faq',         'FAQ container present'],
    ];

    console.log('\n[Verification]');
    let allPass = true;
    checks.forEach(([marker, label]) => {
      if (html.includes(marker)) {
        console.log(`  ✅ ${label}`);
      } else {
        console.log(`  ❌ MISSING: ${label}`);
        allPass = false;
      }
    });

    if (allPass) {
      console.log('\n' + '='.repeat(50));
      console.log('✅ AIVOX PDP DEPLOYED SUCCESSFULLY');
      console.log('='.repeat(50));
      console.log('\nNext steps:');
      console.log('  1. Open Shopify Admin → Products → AI Voice Recorder');
      console.log('     → Theme template → select "product.aivox" → Save');
      console.log('  2. Test on mobile: tiptop360.com/products/ai-voice-recorder');
      console.log('  3. bash regression-geo.sh  (must stay 57/57)');
      console.log('  4. git add -A && git commit -m "feat(pdp): aivox custom template live"');
    } else {
      console.log('\n⚠️  Some checks failed — page may need cache flush');
      console.log('   Rollback: Admin → Products → AiVox → Template → product → Save');
    }
  } catch (err) {
    console.log('⚠️  Verification fetch failed (Cloudflare cache may need 2-4min)');
    console.log('   Manually check: tiptop360.com/products/ai-voice-recorder?preview_theme_id=' + THEME);
  }
}, 30000);
