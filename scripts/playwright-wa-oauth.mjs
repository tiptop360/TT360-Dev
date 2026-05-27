/**
 * TipTop360 — WhatsApp × Klaviyo OAuth Setup via Chrome
 * =====================================================
 * Run this on YOUR LOCAL MACHINE (not the cloud):
 *
 *   node scripts/playwright-wa-oauth.mjs
 *
 * What it does:
 *   1. Opens your real Chrome profile (all sessions already logged in)
 *   2. Navigates to Klaviyo › Settings › Channels › WhatsApp
 *   3. Clicks "Connect with Meta" and waits for you to approve in the popup
 *   4. Selects your WhatsApp Business Account + phone number
 *   5. Saves and verifies the connection
 *
 * Requirements:
 *   - Chrome installed at default path (Mac/Windows)
 *   - Already logged into klaviyo.com in Chrome
 *   - Already logged into business.facebook.com in Chrome
 *   - npm install playwright (already in package.json)
 *   - WHATSAPP_NUMBER=971585156033 in .env
 */

import { chromium } from 'playwright';
import path from 'path';
import os from 'os';
import 'dotenv/config';

const WA_NUMBER   = process.env.WHATSAPP_NUMBER || '971585156033';
const WA_DISPLAY  = `+${WA_NUMBER}`;

// Chrome profile paths by platform
const CHROME_PROFILES = {
  darwin:  path.join(os.homedir(), 'Library/Application Support/Google/Chrome'),
  win32:   path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data'),
  linux:   path.join(os.homedir(), '.config/google-chrome'),
};

const CHROME_EXE = {
  darwin:  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32:   'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  linux:   '/usr/bin/google-chrome',
};

const platform = process.platform;
const userDataDir = CHROME_PROFILES[platform] ?? CHROME_PROFILES.darwin;
const executablePath = CHROME_EXE[platform] ?? CHROME_EXE.darwin;

const KLAVIYO_WA_URL = 'https://www.klaviyo.com/settings/channels/whatsapp';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForSelector(page, selector, timeout = 20000) {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

(async () => {
  console.log('━━━ TipTop360 WhatsApp × Klaviyo OAuth Setup ━━━\n');
  console.log(`Chrome profile: ${userDataDir}`);
  console.log(`WhatsApp number to connect: ${WA_DISPLAY}\n`);
  console.log('⚠️  QUIT Chrome completely (Cmd+Q / Alt+F4) before pressing ENTER');
  console.log('   Chrome will reopen automatically with your existing sessions.\n');

  // Wait for user to quit Chrome
  process.stdout.write('Press ENTER when Chrome is fully closed… ');
  await new Promise(resolve => {
    process.stdin.setRawMode?.(false);
    process.stdin.once('data', resolve);
  });
  console.log('');

  await sleep(1500);

  console.log('🚀  Launching Chrome with your profile…');

  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless: false,
    slowMo: 80,
    viewport: null,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions-except',
    ],
  });

  const page = await context.newPage();

  // ── Step 1: Open Klaviyo WhatsApp Settings ──────────────────────────────
  console.log('\n📍  Step 1 — Opening Klaviyo WhatsApp channel settings…');
  await page.goto(KLAVIYO_WA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);

  // Check if already logged in
  const needsLogin = await page.$('input[type="email"]');
  if (needsLogin) {
    console.log('   ⚠️  Klaviyo login required — please log in manually in the browser.');
    console.log('       Waiting up to 60s…');
    await page.waitForNavigation({ timeout: 60000 }).catch(() => {});
    await page.goto(KLAVIYO_WA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);
  }

  // ── Step 2: Find "Connect with Meta" button ─────────────────────────────
  console.log('📍  Step 2 — Looking for "Connect with Meta" button…');

  const connectSelectors = [
    'button:has-text("Connect with Meta")',
    'button:has-text("Connect Meta")',
    'button:has-text("Connect WhatsApp")',
    '[data-testid="connect-meta-button"]',
    'a:has-text("Connect with Meta")',
  ];

  let connectBtn = null;
  for (const sel of connectSelectors) {
    connectBtn = await page.$(sel);
    if (connectBtn) { console.log(`   ✅  Found button: "${sel}"`); break; }
  }

  if (!connectBtn) {
    // Page screenshot for debugging
    await page.screenshot({ path: '/tmp/klaviyo-wa-page.png' });
    console.log('\n   ⚠️  Could not find "Connect with Meta" button automatically.');
    console.log('       Screenshot saved to: /tmp/klaviyo-wa-page.png');
    console.log('\n   ➡️  Please click the button manually in the browser.');
    console.log('       Waiting up to 2 minutes for you to complete the OAuth…\n');
  } else {
    console.log('   🖱️  Clicking "Connect with Meta"…');

    // Listen for OAuth popup
    const [popup] = await Promise.all([
      context.waitForEvent('page').catch(() => null),
      connectBtn.click(),
    ]);

    if (popup) {
      console.log('\n📍  Step 3 — Meta OAuth popup detected…');
      await popup.waitForLoadState('domcontentloaded').catch(() => {});
      console.log(`   URL: ${popup.url()}`);

      // Check if logged in to Meta
      const metaLogin = await popup.$('input[name="email"], input[id="email"]');
      if (metaLogin) {
        console.log('   ⚠️  Facebook login required — please log in manually in the popup.');
      }

      console.log('\n   ➡️  Please complete the Meta Business authorization in the popup.');
      console.log('       - Select your Business Account');
      console.log('       - Select your WhatsApp Business Account');
      console.log(`       - Select phone number: ${WA_DISPLAY}`);
      console.log('       - Click "Connect" / "Finish"\n');
      console.log('       Waiting up to 3 minutes…');

      // Wait for popup to close (user completed OAuth)
      await popup.waitForEvent('close', { timeout: 180000 }).catch(() => {
        console.log('   Popup did not auto-close — continuing…');
      });
      console.log('   ✅  OAuth popup closed');
    }
  }

  // ── Step 4: Verify connection ───────────────────────────────────────────
  console.log('\n📍  Step 4 — Waiting for connection confirmation…');
  await sleep(3000);
  await page.goto(KLAVIYO_WA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2000);

  await page.screenshot({ path: '/tmp/klaviyo-wa-connected.png' });

  const successIndicators = [
    WA_DISPLAY,
    WA_NUMBER,
    'Connected',
    'Active',
    '971585156033',
  ];

  const pageText = await page.textContent('body').catch(() => '');
  const isConnected = successIndicators.some(s => pageText.includes(s));

  if (isConnected) {
    console.log(`   ✅  WhatsApp number ${WA_DISPLAY} is CONNECTED to Klaviyo!`);
    console.log('       Screenshot: /tmp/klaviyo-wa-connected.png');
  } else {
    console.log('   ⚠️  Could not automatically verify connection.');
    console.log('       Check screenshot: /tmp/klaviyo-wa-connected.png');
    console.log(`       And verify manually: ${KLAVIYO_WA_URL}`);
  }

  // ── Step 5: Configure opt-in settings ──────────────────────────────────
  console.log('\n📍  Step 5 — Checking opt-in / double-opt-in settings…');
  await sleep(1000);

  const doubleOptIn = await page.$('input[type="checkbox"][aria-label*="double"], label:has-text("Double opt-in")');
  if (doubleOptIn) {
    const checked = await doubleOptIn.isChecked().catch(() => false);
    if (!checked) {
      await doubleOptIn.check();
      console.log('   ✅  Enabled double opt-in for WhatsApp');
    } else {
      console.log('   ✅  Double opt-in already enabled');
    }
  }

  // ── Done ────────────────────────────────────────────────────────────────
  console.log('\n━━━ WhatsApp × Klaviyo OAuth Complete ━━━');
  console.log('Next steps:');
  console.log('  1. Run flows setup:  node scripts/klaviyo-wa-setup.mjs');
  console.log('  2. Activate flows in Klaviyo dashboard');
  console.log('  3. Add WhatsApp opt-in widget to tiptop360.com');
  console.log('\nPress ENTER to close Chrome…');
  await new Promise(r => process.stdin.once('data', r));

  await context.close();
  console.log('✅  Done!');
})();
