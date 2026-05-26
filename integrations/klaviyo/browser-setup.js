/**
 * Klaviyo Browser Automation (Playwright)
 *
 * Automates:
 *   1. Log in to Klaviyo
 *   2. Activate the 3 WhatsApp flows (Abandoned Cart, Welcome, Order Confirmation)
 *   3. Navigate to WhatsApp settings and capture connection status
 *   4. Save screenshots as verification proof
 *
 * Run: node integrations/klaviyo/browser-setup.js
 *
 * Requires:
 *   KLAVIYO_EMAIL and KLAVIYO_PASSWORD in .env
 *   (or set KLAVIYO_SESSION_COOKIE if you prefer cookie-based auth)
 */

import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = join(__dirname, '../../automation-screenshots');

function loadEnv() {
  const envPath = join(__dirname, '../../.env');
  if (!existsSync(envPath)) { console.error('\n❌  .env not found\n'); process.exit(1); }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, ...v] = t.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}
loadEnv();

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const KLAVIYO_URL     = 'https://www.klaviyo.com';
const EMAIL           = process.env.KLAVIYO_EMAIL;
const PASSWORD        = process.env.KLAVIYO_PASSWORD;
const SESSION_COOKIE  = process.env.KLAVIYO_SESSION_COOKIE;

const FLOW_NAMES = [
  'WhatsApp Welcome Series',
  'WhatsApp Abandoned Cart Recovery',
  'WhatsApp Order Confirmation',
];

async function screenshot(page, name) {
  const path = join(SCREENSHOTS_DIR, `klaviyo-${name}-${Date.now()}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`   📸 Screenshot: ${path}`);
  return path;
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function login(page) {
  console.log('\n🔑 Logging in to Klaviyo...');

  if (SESSION_COOKIE) {
    await page.context().addCookies([{
      name:   'sessionid',
      value:  SESSION_COOKIE,
      domain: '.klaviyo.com',
      path:   '/',
      secure: true,
    }]);
    await page.goto(`${KLAVIYO_URL}/dashboard/`);
    await page.waitForTimeout(2000);

    // Check if login was successful
    if (!page.url().includes('login')) {
      console.log('   ✅ Logged in via session cookie');
      return;
    }
    console.log('   ⚠️  Session cookie expired — falling back to email/password');
  }

  if (!EMAIL || !PASSWORD) {
    throw new Error('Set KLAVIYO_EMAIL and KLAVIYO_PASSWORD (or KLAVIYO_SESSION_COOKIE) in .env');
  }

  await page.goto(`${KLAVIYO_URL}/login/`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await screenshot(page, 'login');
  await page.click('button[type="submit"]');

  // Handle 2FA if it appears
  await page.waitForTimeout(3000);
  if (page.url().includes('two-factor') || page.url().includes('2fa') || await page.$('input[name="code"]')) {
    console.log('\n   ⚠️  Two-factor authentication required.');
    console.log('   Enter the 6-digit code from your authenticator app:');
    const code = await waitForUserInput();
    await page.fill('input[name="code"]', code);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  if (page.url().includes('login')) {
    await screenshot(page, 'login-error');
    throw new Error('Login failed — check KLAVIYO_EMAIL and KLAVIYO_PASSWORD');
  }

  console.log('   ✅ Logged in successfully');
  await screenshot(page, 'dashboard');
}

async function waitForUserInput() {
  const { createInterface } = await import('readline');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question('   > 2FA Code: ', answer => { rl.close(); resolve(answer.trim()); });
  });
}

// ─── Activate flows ───────────────────────────────────────────────────────────

async function activateFlows(page) {
  console.log('\n🔄 Activating WhatsApp flows...');

  await page.goto(`${KLAVIYO_URL}/flows/`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await screenshot(page, 'flows-list');

  for (const flowName of FLOW_NAMES) {
    console.log(`\n   Looking for "${flowName}"...`);

    // Search for the flow
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.clear();
      await searchInput.fill(flowName);
      await page.waitForTimeout(1500);
    }

    // Find the flow row
    const flowRow = page.locator(`text="${flowName}"`).first();
    if (!(await flowRow.isVisible())) {
      console.log(`   ⚠️  Flow "${flowName}" not found — run setup-flows.js first`);
      continue;
    }

    // Click to open the flow
    await flowRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log(`   📂 Opened: ${currentUrl}`);

    // Look for status toggle / activate button
    const activateBtn = page.locator(
      'button:has-text("Activate"), button:has-text("Turn On"), [data-test="flow-status-toggle"]'
    ).first();

    const statusDraft = page.locator(
      'text="Draft", [aria-label*="Draft"], .flow-status:has-text("Draft")'
    ).first();

    if (await activateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await screenshot(page, `flow-${flowName.replace(/\s+/g, '-').toLowerCase()}-before`);
      await activateBtn.click();
      await page.waitForTimeout(2000);

      // Confirm dialog if present
      const confirmBtn = page.locator('button:has-text("Activate"), button:has-text("Confirm"), button:has-text("Turn on")').last();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }

      await screenshot(page, `flow-${flowName.replace(/\s+/g, '-').toLowerCase()}-after`);
      console.log(`   ✅ Activated: ${flowName}`);
    } else if (await statusDraft.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`   ⚠️  "${flowName}" is Draft — WhatsApp channel must be connected before activating`);
      await screenshot(page, `flow-${flowName.replace(/\s+/g, '-').toLowerCase()}-draft`);
    } else {
      // Try status dropdown
      const statusEl = page.locator('[data-test*="status"], .flow-status-badge, [aria-label*="status"]').first();
      if (await statusEl.isVisible({ timeout: 2000 }).catch(() => false)) {
        const statusText = await statusEl.textContent();
        if (statusText?.toLowerCase().includes('live') || statusText?.toLowerCase().includes('active')) {
          console.log(`   ✅ "${flowName}" is already active`);
        } else {
          console.log(`   ℹ️  "${flowName}" status: ${statusText} — may need WhatsApp channel connected first`);
        }
      } else {
        console.log(`   ℹ️  "${flowName}" — could not determine status`);
      }
      await screenshot(page, `flow-${flowName.replace(/\s+/g, '-').toLowerCase()}-status`);
    }

    // Go back to flows list
    await page.goto(`${KLAVIYO_URL}/flows/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  }
}

// ─── WhatsApp channel status ───────────────────────────────────────────────────

async function checkWhatsAppSettings(page) {
  console.log('\n📡 Checking Klaviyo WhatsApp channel status...');

  // Navigate to Settings → SMS & WhatsApp or Channels
  const settingsPaths = [
    `${KLAVIYO_URL}/settings/sms-whatsapp/`,
    `${KLAVIYO_URL}/settings/channels/whatsapp/`,
    `${KLAVIYO_URL}/settings/whatsapp/`,
  ];

  let found = false;
  for (const path of settingsPaths) {
    await page.goto(path);
    await page.waitForTimeout(2000);
    if (!page.url().includes('login') && !page.url().includes('404') && !page.url().includes('error')) {
      found = true;
      break;
    }
  }

  if (!found) {
    // Try via navigation
    await page.goto(`${KLAVIYO_URL}/settings/`);
    await page.waitForLoadState('networkidle');
    const whatsappLink = page.locator('a:has-text("WhatsApp"), a:has-text("SMS & WhatsApp")').first();
    if (await whatsappLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await whatsappLink.click();
      await page.waitForLoadState('networkidle');
      found = true;
    }
  }

  await screenshot(page, 'whatsapp-settings');

  const connectedEl = page.locator('text="Connected", text="Active", [data-test*="connected"]').first();
  const disconnectedEl = page.locator('text="Not connected", text="Connect WhatsApp", button:has-text("Connect")').first();

  if (await connectedEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('   ✅ WhatsApp channel is connected to Klaviyo!');
  } else if (await disconnectedEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('   ⚠️  WhatsApp not yet connected to Klaviyo');
    console.log('      To connect: click "Connect WhatsApp" and complete the Meta OAuth flow');
    console.log('      You need your Meta Business Account and WhatsApp Business Account');

    // Click Connect if available
    const connectBtn = page.locator('button:has-text("Connect WhatsApp"), button:has-text("Connect")').first();
    if (await connectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('\n   ℹ️  A browser window will open for Meta OAuth — please complete it manually');
      await screenshot(page, 'whatsapp-connect-button');
    }
  } else {
    console.log('   ℹ️  Could not determine WhatsApp connection status — check screenshot');
  }
}

// ─── List verification ─────────────────────────────────────────────────────────

async function verifyList(page) {
  console.log('\n📋 Verifying WhatsApp Subscribers list...');

  await page.goto(`${KLAVIYO_URL}/lists/`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const listEl = page.locator('text="WhatsApp Subscribers"').first();
  if (await listEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('   ✅ "WhatsApp Subscribers" list exists');
    await screenshot(page, 'whatsapp-list');
  } else {
    console.log('   ⚠️  "WhatsApp Subscribers" list not found — run: npm run setup:klaviyo');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runKlaviyoBrowserSetup({ headless = false } = {}) {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   TipTop360 — Klaviyo Browser Automation     ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`   Mode: ${headless ? 'headless' : 'visible browser'}`);
  console.log(`   Screenshots: ${SCREENSHOTS_DIR}\n`);

  const browser = await chromium.launch({ headless, slowMo: headless ? 0 : 100 });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await login(page);
    await verifyList(page);
    await activateFlows(page);
    await checkWhatsAppSettings(page);

    console.log('\n\n✅ Klaviyo browser automation complete!');
    console.log(`   Screenshots saved to: ${SCREENSHOTS_DIR}\n`);
  } finally {
    await browser.close();
  }
}

// Run directly
if (process.argv[1].endsWith('browser-setup.js')) {
  const headless = process.argv.includes('--headless');
  runKlaviyoBrowserSetup({ headless }).catch(err => {
    console.error('\n❌', err.message);
    process.exit(1);
  });
}
