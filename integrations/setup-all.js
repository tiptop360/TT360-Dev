/**
 * TipTop360 — Full Integration Setup Orchestrator
 *
 * Runs every setup step in sequence:
 *   1.  Validate environment variables
 *   2.  Install Playwright browser (if needed)
 *   3.  Meta API: verify phone, register webhook, submit templates, set metafields
 *   4.  Klaviyo API: create WhatsApp Subscribers list + flow stubs
 *   5.  Optimizer: apply Meta Pixel to Shopify theme (fix-11)
 *   6.  Optimizer: apply WhatsApp opt-in popup (fix-12)
 *   7.  Klaviyo browser: activate flows + verify WhatsApp channel status
 *   8.  Print final checklist
 *
 * Usage:
 *   node integrations/setup-all.js                 → full setup (visible browser)
 *   node integrations/setup-all.js --headless      → full setup (headless)
 *   node integrations/setup-all.js --skip-browser  → API + theme only (no Playwright)
 *   node integrations/setup-all.js --skip-theme    → API + browser only (no optimizer)
 *   node integrations/setup-all.js --skip-meta     → skip Meta API step
 *   node integrations/setup-all.js --skip-klaviyo-api → skip Klaviyo API step
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '../.env');
  if (!existsSync(envPath)) {
    console.error('\n❌  .env not found — copy .env.example → .env and fill in values\n');
    process.exit(1);
  }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, ...v] = t.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}
loadEnv();

const args         = process.argv.slice(2);
const HEADLESS     = args.includes('--headless');
const SKIP_BROWSER = args.includes('--skip-browser');
const SKIP_THEME   = args.includes('--skip-theme');
const SKIP_META    = args.includes('--skip-meta');
const SKIP_KL_API  = args.includes('--skip-klaviyo-api');

const ROOT_DIR = join(__dirname, '..');

// ─── Env validation ────────────────────────────────────────────────────────────

const ENV_GROUPS = {
  'Shopify': ['SHOPIFY_STORE', 'SHOPIFY_ACCESS_TOKEN'],
  'WhatsApp / Meta': ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID', 'META_APP_ID'],
  'Klaviyo': ['KLAVIYO_PRIVATE_API_KEY'],
  'Klaviyo Browser': ['KLAVIYO_EMAIL', 'KLAVIYO_PASSWORD'],
};

function validateEnv() {
  console.log('\n🔍 Validating environment variables...\n');
  let warnings = 0;

  for (const [group, keys] of Object.entries(ENV_GROUPS)) {
    const missing = keys.filter(k => !process.env[k]);
    if (missing.length) {
      console.warn(`   ⚠️  ${group}: missing ${missing.join(', ')}`);
      warnings++;
    } else {
      console.log(`   ✅ ${group}`);
    }
  }

  // Warn about optional but useful vars
  const optional = ['META_PIXEL_ID', 'WEBHOOK_BASE_URL', 'WEBHOOK_API_KEY'];
  const missingOptional = optional.filter(k => !process.env[k]);
  if (missingOptional.length) {
    console.log(`\n   ℹ️  Optional (can add later): ${missingOptional.join(', ')}`);
  }

  if (warnings > 0) {
    console.log('\n   ⚠️  Some variables are missing — affected steps will be skipped');
    console.log('      See .env.example for instructions on where to get each value\n');
  } else {
    console.log('\n   ✅ All required env vars present\n');
  }
}

// ─── Playwright browser installation ──────────────────────────────────────────

async function ensurePlaywrightBrowsers() {
  if (SKIP_BROWSER) return;
  console.log('\n🌐 Ensuring Playwright Chromium is installed...');
  try {
    execSync('npx playwright install chromium --with-deps', {
      cwd: ROOT_DIR, stdio: 'pipe',
    });
    console.log('   ✅ Chromium ready');
  } catch {
    try {
      execSync('npx playwright install chromium', { cwd: ROOT_DIR, stdio: 'pipe' });
      console.log('   ✅ Chromium ready');
    } catch (e) {
      console.warn('   ⚠️  Could not install Chromium:', e.message.split('\n')[0]);
      console.warn('      Run manually: npx playwright install chromium');
    }
  }
}

// ─── Step runner ──────────────────────────────────────────────────────────────

const results = [];

async function step(name, fn, skip = false) {
  if (skip) {
    console.log(`\n⏭  Skipping: ${name}`);
    results.push({ name, status: 'skipped' });
    return;
  }

  console.log(`\n${'─'.repeat(54)}`);
  try {
    await fn();
    results.push({ name, status: 'ok' });
  } catch (err) {
    console.error(`\n   ❌ Step failed: ${err.message}`);
    results.push({ name, status: 'failed', error: err.message });
  }
}

// ─── Theme optimizer steps ─────────────────────────────────────────────────────

async function applyThemeFixes() {
  const hasShopify = process.env.SHOPIFY_STORE && process.env.SHOPIFY_ACCESS_TOKEN;
  if (!hasShopify) {
    console.log('   ⚠️  Shopify credentials not set — skipping theme fixes');
    return;
  }

  console.log('   Applying Fix 11 (Meta Pixel) via optimizer...');
  execSync('node optimizer.js apply meta-pixel', {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    input: 'y\n',
    env: { ...process.env },
  });

  console.log('\n   Applying Fix 12 (WhatsApp Opt-in Popup) via optimizer...');
  execSync('node optimizer.js apply whatsapp-optin', {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    input: 'y\n',
    env: { ...process.env },
  });
}

// ─── Final checklist ───────────────────────────────────────────────────────────

function printChecklist() {
  console.log('\n\n╔══════════════════════════════════════════════╗');
  console.log('║   Setup Complete — Results                   ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  for (const r of results) {
    const icon = r.status === 'ok' ? '✅' : r.status === 'skipped' ? '⏭ ' : '❌';
    console.log(`  ${icon} ${r.name}`);
    if (r.error) console.log(`     Error: ${r.error}`);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Remaining manual steps                                      ║
╚══════════════════════════════════════════════════════════════╝

  1. Deploy webhook server to a public host:
     • Railway:  railway.json already configured (run: railway up)
     • Render:   connect GitHub repo, set root to /
     • Fly.io:   fly launch --no-deploy, fly deploy
     Then update WEBHOOK_BASE_URL in .env and re-run:
     node integrations/meta/api-setup.js

  2. Register webhook URL in Meta Business Manager:
     Meta Business Manager → Apps → Webhooks → Add callback URL
     URL: https://YOUR_DOMAIN/webhook/whatsapp
     Token: your META_VERIFY_TOKEN value

  3. Connect WhatsApp to Klaviyo (requires Meta OAuth):
     Klaviyo → Settings → WhatsApp → Connect
     (screenshots saved to automation-screenshots/)

  4. Wait for Meta to approve templates (1-48 hours):
     Check: Meta Business Manager → WhatsApp Manager → Templates

  5. Activate Klaviyo flows after WhatsApp channel is connected:
     node integrations/klaviyo/browser-setup.js

  6. Test end-to-end:
     node integrations/index.js test-send +971XXXXXXXXX
`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   TipTop360 — Full WhatsApp + Klaviyo + Meta Setup           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  validateEnv();
  await ensurePlaywrightBrowsers();

  // Step 1: Meta API (webhook registration + templates + Shopify metafields)
  await step('Meta API Setup (webhook + templates + pixel)', async () => {
    if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_BUSINESS_ACCOUNT_ID) {
      console.log('   ⚠️  Meta credentials not configured — skipping');
      return;
    }
    const { runMetaSetup } = await import('./meta/api-setup.js');
    await runMetaSetup();
  }, SKIP_META);

  // Step 2: Klaviyo API (list + flow stubs)
  await step('Klaviyo API Setup (list + flow stubs)', async () => {
    if (!process.env.KLAVIYO_PRIVATE_API_KEY) {
      console.log('   ⚠️  KLAVIYO_PRIVATE_API_KEY not set — skipping');
      return;
    }
    const { runKlaviyoSetup } = await import('./klaviyo/setup-flows.js');
    await runKlaviyoSetup();
  }, SKIP_KL_API);

  // Step 3: Apply theme fixes
  await step('Apply theme fixes (Meta Pixel + WhatsApp opt-in popup)', applyThemeFixes, SKIP_THEME);

  // Step 4: Klaviyo browser automation
  await step('Klaviyo browser automation (activate flows + verify channel)', async () => {
    if (!process.env.KLAVIYO_EMAIL && !process.env.KLAVIYO_SESSION_COOKIE) {
      console.log('   ⚠️  KLAVIYO_EMAIL / KLAVIYO_SESSION_COOKIE not set — skipping browser step');
      return;
    }
    const { runKlaviyoBrowserSetup } = await import('./klaviyo/browser-setup.js');
    await runKlaviyoBrowserSetup({ headless: HEADLESS });
  }, SKIP_BROWSER);

  printChecklist();
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
