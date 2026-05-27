/**
 * TipTop360 — Credential Harvester (Browser Automation)
 *
 * Opens a visible browser and automatically extracts:
 *   Meta:    App ID, App Secret, Phone Number ID, WABA ID, Pixel ID
 *   Klaviyo: Private API Key, Public API Key
 *
 * You handle login + 2FA in the browser window.
 * The script extracts everything else and writes it to your .env.
 *
 * Run: node integrations/meta/browser-extract-credentials.js
 */

import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH  = join(__dirname, '../../.env');
const EXAMPLE_PATH = join(__dirname, '../../.env.example');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function pause(msg = 'Press ENTER when ready...') {
  return prompt(`\n  ⏳ ${msg} `);
}

function log(msg, type = 'normal') {
  const prefix = { bold: '\x1b[1m', dim: '\x1b[2m', success: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m', info: '\x1b[36m', normal: '' }[type] || '';
  console.log(`${prefix}${msg}\x1b[0m`);
}

function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    // Bootstrap from example
    if (existsSync(EXAMPLE_PATH)) {
      writeFileSync(ENV_PATH, readFileSync(EXAMPLE_PATH, 'utf8'));
      log('  📄 Created .env from .env.example', 'info');
    } else {
      writeFileSync(ENV_PATH, '');
    }
  }
  const env = {};
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, ...v] = t.split('=');
    if (k && v.length) { env[k.trim()] = v.join('=').trim(); process.env[k.trim()] = v.join('=').trim(); }
  }
  return env;
}

function updateEnv(updates) {
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';

  for (const [key, value] of Object.entries(updates)) {
    if (!value) continue;
    const regex = new RegExp(`^(${key}=).*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `$1${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    process.env[key] = value;
  }

  writeFileSync(ENV_PATH, content.trim() + '\n');
  log(`  ✅ Saved ${Object.keys(updates).filter(k => updates[k]).join(', ')} to .env`, 'success');
}

async function waitForNavigation(page, url, label) {
  log(`\n  🌐 Navigating to ${label}...`, 'dim');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
}

async function tryExtract(page, selectors, label) {
  for (const sel of (Array.isArray(selectors) ? selectors : [selectors])) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 })) {
        const text = (await el.textContent() || await el.inputValue()).trim();
        if (text && text.length > 3) {
          log(`  ✅ Found ${label}: ${text.substring(0, 8)}...`, 'success');
          return text;
        }
      }
    } catch {}
  }
  return null;
}

// ─── Step 1: Meta App ID + Secret ─────────────────────────────────────────────

async function extractMetaAppCredentials(page, collected) {
  log('\n\n━━━ STEP 1/5: Meta App ID & Secret ━━━━━━━━━━━━━━━━━━━', 'bold');

  await waitForNavigation(page, 'https://developers.facebook.com/apps/', 'Meta for Developers');

  // Wait for user to log in if needed
  await page.waitForTimeout(3000);
  if (page.url().includes('login') || page.url().includes('checkpoint')) {
    log('\n  🔑 Please log in to your Facebook Developer account in the browser window', 'warn');
    log('     (use the same account as your Meta Business Manager)', 'dim');
    await pause('Press ENTER once you are logged in and see your apps list');
  }

  await page.waitForTimeout(2000);

  // Find the app — look for an app card
  const appCards = page.locator('[data-testid="app_card"], .app-card, ._8o0h, [href*="/apps/"]');
  const count = await appCards.count();

  let appId = null;

  if (count === 0) {
    log('\n  ℹ️  No apps found. You need to create a Meta App first.', 'warn');
    log('     1. Click "Create App"', 'dim');
    log('     2. Choose "Business" type', 'dim');
    log('     3. Fill in the app name (e.g. "TipTop360 WhatsApp")', 'dim');
    log('     4. Complete the setup and come back to the apps list', 'dim');
    await pause('Press ENTER once your app is created and visible in the list');
  }

  // Click the first/only business app
  const appLink = page.locator('a[href*="/apps/"]').first();
  if (await appLink.isVisible({ timeout: 4000 }).catch(() => false)) {
    const href = await appLink.getAttribute('href');
    const match = href?.match(/\/apps\/(\d+)/);
    if (match) {
      appId = match[1];
      log(`  ✅ App ID found from URL: ${appId}`, 'success');
      await appLink.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
    }
  }

  // Also try to get App ID from the page content
  if (!appId) {
    const urlMatch = page.url().match(/\/apps\/(\d+)/);
    if (urlMatch) appId = urlMatch[1];
  }

  // Get App ID from dashboard if still missing
  if (!appId) {
    const appIdEl = await tryExtract(page, [
      'text=/App ID/', '[data-testid="app-id"]', '._4-u2._9sia'
    ], 'App ID label');
    if (!appIdEl) {
      log('\n  ⚠️  Could not find App ID automatically', 'warn');
      appId = await prompt('  Paste your App ID manually: ');
    }
  }

  // Navigate to Settings → Basic for App Secret
  log('\n  📋 Navigating to Settings → Basic for App Secret...', 'dim');
  const currentUrl = page.url();
  const appIdForUrl = appId || currentUrl.match(/\/apps\/(\d+)/)?.[1];

  if (appIdForUrl) {
    await page.goto(`https://developers.facebook.com/apps/${appIdForUrl}/settings/basic/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }

  // Click "Show" next to App Secret
  const showBtn = page.locator('button:has-text("Show"), input[value="Show"], [aria-label="Show App Secret"]').first();
  if (await showBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await showBtn.click();
    await page.waitForTimeout(2000);

    // May need to re-enter password
    const passInput = page.locator('input[type="password"]').first();
    if (await passInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      log('\n  🔒 Facebook asking for your password to reveal App Secret', 'warn');
      const pass = await prompt('  Enter your Facebook password: ');
      await passInput.fill(pass);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }
  }

  // Extract App Secret
  let appSecret = await tryExtract(page, [
    'input[name="app_secret"]',
    '#app_secret',
    'input[placeholder*="secret"]',
  ], 'App Secret');

  if (!appSecret) {
    log('\n  ⚠️  Could not auto-extract App Secret', 'warn');
    log('     Look for it on the Settings → Basic page in the browser', 'dim');
    appSecret = await prompt('  Paste your App Secret manually: ');
  }

  collected.META_APP_ID     = appId;
  collected.META_APP_SECRET  = appSecret;

  log(`\n  ✅ Meta App ID:     ${appId}`, 'success');
  log(`  ✅ Meta App Secret: ${(appSecret || '').substring(0, 6)}...`, 'success');
}

// ─── Step 2: WhatsApp Access Token ────────────────────────────────────────────

async function extractAccessToken(page, collected) {
  log('\n\n━━━ STEP 2/5: WhatsApp System User Access Token ━━━━━━━', 'bold');
  log('  This token lets the webhook server send WhatsApp messages', 'dim');

  log('\n  📋 Navigating to Meta Business Settings → System Users...', 'dim');
  await page.goto('https://business.facebook.com/settings/system-users', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  if (page.url().includes('login')) {
    log('\n  🔑 Please log in to Meta Business Manager in the browser', 'warn');
    await pause('Press ENTER once logged in');
    await page.waitForTimeout(2000);
  }

  // Check if system users exist
  const systemUserEl = page.locator('[data-testid="system-user"], .system-user-row, [aria-label*="System user"]').first();
  const hasUsers = await systemUserEl.isVisible({ timeout: 5000 }).catch(() => false);

  if (!hasUsers) {
    log('\n  ℹ️  No system users found. Let\'s create one:', 'warn');
    const addBtn = page.locator('button:has-text("Add"), button:has-text("Create"), button[aria-label*="Add"]').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(2000);
      const nameInput = page.locator('input[placeholder*="name"], input[name*="name"]').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('TipTop360 System User');
        const roleSelect = page.locator('select, [role="combobox"]').first();
        if (await roleSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
          await roleSelect.selectOption({ label: 'Admin' });
        }
        const createBtn = page.locator('button:has-text("Create"), button:has-text("Save")').last();
        if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await createBtn.click();
          await page.waitForTimeout(3000);
        }
      }
    }
  }

  // Click "Generate Token"
  const genTokenBtn = page.locator('button:has-text("Generate new token"), button:has-text("Generate token"), button:has-text("Generate Token")').first();
  if (await genTokenBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await genTokenBtn.click();
    await page.waitForTimeout(2000);

    // Select the app
    const appSelect = page.locator('select, [role="combobox"]').first();
    if (await appSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const appId = collected.META_APP_ID;
      if (appId) {
        await appSelect.selectOption({ value: appId }).catch(() => {});
      }
      await page.waitForTimeout(1000);
    }

    // Tick required permissions
    for (const perm of ['whatsapp_business_messaging', 'whatsapp_business_management']) {
      const permEl = page.locator(`[value="${perm}"], label:has-text("${perm}")`).first();
      if (await permEl.isVisible({ timeout: 2000 }).catch(() => false)) {
        const checked = await permEl.isChecked().catch(() => false);
        if (!checked) await permEl.click();
      }
    }

    const generateBtn = page.locator('button:has-text("Generate token"), button:has-text("Generate")').last();
    if (await generateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await generateBtn.click();
      await page.waitForTimeout(3000);
    }
  } else {
    log('\n  ⚠️  Could not find "Generate Token" button automatically', 'warn');
    log('     In the browser: click your system user → Generate new token', 'dim');
    log('     Select your app, tick whatsapp_business_messaging + whatsapp_business_management', 'dim');
    await pause('Press ENTER once the token is shown on screen');
  }

  // Extract the token from dialog/modal
  let token = await tryExtract(page, [
    'input[value*="EAA"]',
    'textarea:has-text("EAA")',
    '[class*="token"] input',
    'code',
  ], 'Access Token');

  if (!token || token.length < 20) {
    log('\n  ⚠️  Could not auto-copy the token', 'warn');
    log('     Copy the token shown in the browser (starts with EAA...)', 'dim');
    token = await prompt('  Paste your Access Token: ');
  }

  collected.WHATSAPP_ACCESS_TOKEN = token;
  log(`\n  ✅ Access Token: ${(token || '').substring(0, 10)}...`, 'success');
}

// ─── Step 3: Phone Number ID + WABA ID ────────────────────────────────────────

async function extractWhatsAppIds(page, collected) {
  log('\n\n━━━ STEP 3/5: Phone Number ID & Business Account ID ━━━', 'bold');

  await page.goto('https://business.facebook.com/wa/manage/phone-numbers/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Extract WABA ID from URL
  const urlWabaMatch = page.url().match(/\/waba\/(\d+)/);
  if (urlWabaMatch) {
    collected.WHATSAPP_BUSINESS_ACCOUNT_ID = urlWabaMatch[1];
    log(`  ✅ WABA ID from URL: ${urlWabaMatch[1]}`, 'success');
  }

  // Look for the phone row matching our number
  const targetNumber = (process.env.WHATSAPP_NUMBER || '971585156033').replace(/\D/g, '');
  const rows = page.locator('tr, [role="row"], .phone-number-row');
  const count = await rows.count();

  for (let i = 0; i < Math.min(count, 10); i++) {
    const row = rows.nth(i);
    const text = await row.textContent().catch(() => '');
    if (text.includes(targetNumber.slice(-8)) || text.includes('+971')) {
      // Click this row to get details
      await row.click().catch(() => {});
      await page.waitForTimeout(2000);
      break;
    }
  }

  // Try to get Phone Number ID from URL or page
  const phoneIdFromUrl = page.url().match(/phone_number_id=(\d+)/)?.[1]
    || page.url().match(/\/phone-numbers\/(\d+)/)?.[1];

  if (phoneIdFromUrl) {
    collected.WHATSAPP_PHONE_NUMBER_ID = phoneIdFromUrl;
    log(`  ✅ Phone Number ID from URL: ${phoneIdFromUrl}`, 'success');
  }

  // Try extracting from page content
  if (!collected.WHATSAPP_PHONE_NUMBER_ID) {
    const phoneIdEl = await tryExtract(page, [
      '[data-testid="phone-number-id"]',
      'td:has-text("Phone number ID") + td',
      '.phone-id',
    ], 'Phone Number ID');
    if (phoneIdEl) collected.WHATSAPP_PHONE_NUMBER_ID = phoneIdEl;
  }

  // Try Graph API directly to get IDs (most reliable)
  if (collected.WHATSAPP_ACCESS_TOKEN) {
    log('\n  🔍 Using Graph API to confirm IDs...', 'dim');
    await page.goto(
      `https://graph.facebook.com/v21.0/me/businesses?access_token=${collected.WHATSAPP_ACCESS_TOKEN}&fields=id,name,whatsapp_business_accounts`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    try {
      const apiData = JSON.parse(bodyText);
      const businesses = apiData.data || [];
      for (const biz of businesses) {
        const wabas = biz.whatsapp_business_accounts?.data || [];
        if (wabas.length && !collected.WHATSAPP_BUSINESS_ACCOUNT_ID) {
          collected.WHATSAPP_BUSINESS_ACCOUNT_ID = wabas[0].id;
          log(`  ✅ WABA ID from API: ${wabas[0].id}`, 'success');
        }
      }
    } catch {}

    if (collected.WHATSAPP_BUSINESS_ACCOUNT_ID && !collected.WHATSAPP_PHONE_NUMBER_ID) {
      await page.goto(
        `https://graph.facebook.com/v21.0/${collected.WHATSAPP_BUSINESS_ACCOUNT_ID}/phone_numbers?access_token=${collected.WHATSAPP_ACCESS_TOKEN}&fields=id,display_phone_number,verified_name`,
        { waitUntil: 'domcontentloaded' }
      );
      await page.waitForTimeout(2000);
      const body2 = await page.locator('body').textContent();
      try {
        const phones = JSON.parse(body2).data || [];
        const match = phones.find(p => p.display_phone_number?.replace(/\D/g,'').includes(targetNumber.slice(-8))) || phones[0];
        if (match) {
          collected.WHATSAPP_PHONE_NUMBER_ID = match.id;
          log(`  ✅ Phone Number ID from API: ${match.id} (${match.display_phone_number})`, 'success');
        }
      } catch {}
    }
  }

  // Manual fallback
  if (!collected.WHATSAPP_PHONE_NUMBER_ID) {
    log('\n  ⚠️  Could not auto-extract Phone Number ID', 'warn');
    log('     In the browser: WhatsApp Manager → Phone Numbers → click your number', 'dim');
    log('     The ID is shown in the URL or info panel', 'dim');
    collected.WHATSAPP_PHONE_NUMBER_ID = await prompt('  Paste Phone Number ID: ');
  }
  if (!collected.WHATSAPP_BUSINESS_ACCOUNT_ID) {
    log('\n  ⚠️  Could not auto-extract WABA ID', 'warn');
    log('     In the browser: WhatsApp Manager → the ID shown at the top of the page', 'dim');
    collected.WHATSAPP_BUSINESS_ACCOUNT_ID = await prompt('  Paste WhatsApp Business Account ID: ');
  }
}

// ─── Step 4: Meta Pixel ID ────────────────────────────────────────────────────

async function extractPixelId(page, collected) {
  log('\n\n━━━ STEP 4/5: Meta Pixel ID ━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bold');

  await page.goto('https://business.facebook.com/events_manager/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Look for pixel row
  const pixelId = await tryExtract(page, [
    '[data-testid="pixel-id"]',
    '.pixel-id',
    'td:has-text("Web") + td',
  ], 'Pixel ID');

  if (pixelId && /^\d{10,}$/.test(pixelId)) {
    collected.META_PIXEL_ID = pixelId;
  } else {
    // Try from URL
    const urlMatch = page.url().match(/pixel\/(\d+)/);
    if (urlMatch) {
      collected.META_PIXEL_ID = urlMatch[1];
      log(`  ✅ Pixel ID from URL: ${urlMatch[1]}`, 'success');
    } else {
      // Try Graph API
      if (collected.WHATSAPP_ACCESS_TOKEN && collected.META_APP_ID) {
        await page.goto(
          `https://graph.facebook.com/v21.0/${collected.META_APP_ID}/adspixels?access_token=${collected.WHATSAPP_ACCESS_TOKEN}&fields=id,name`,
          { waitUntil: 'domcontentloaded' }
        );
        await page.waitForTimeout(2000);
        const body = await page.locator('body').textContent();
        try {
          const pixels = JSON.parse(body).data || [];
          if (pixels[0]) {
            collected.META_PIXEL_ID = pixels[0].id;
            log(`  ✅ Pixel ID from API: ${pixels[0].id} (${pixels[0].name})`, 'success');
          }
        } catch {}
      }

      if (!collected.META_PIXEL_ID) {
        log('\n  ℹ️  No pixel found — you may need to create one:', 'warn');
        log('     Events Manager → Connect Data Sources → Web → Facebook Pixel → Create', 'dim');
        log('     Or press ENTER to skip (you can add the Pixel ID to .env later)', 'dim');
        const inp = await prompt('  Pixel ID (or ENTER to skip): ');
        if (inp) collected.META_PIXEL_ID = inp;
      }
    }
  }
}

// ─── Step 5: Klaviyo API Keys ──────────────────────────────────────────────────

async function extractKlaviyoKeys(page, collected) {
  log('\n\n━━━ STEP 5/5: Klaviyo API Keys ━━━━━━━━━━━━━━━━━━━━━━━', 'bold');

  await page.goto('https://www.klaviyo.com/settings/api-keys', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  if (page.url().includes('login')) {
    log('\n  🔑 Please log in to your Klaviyo account in the browser', 'warn');
    log('     You can use the same browser window', 'dim');
    await pause('Press ENTER once logged in and the API Keys page is visible');
    await page.waitForTimeout(2000);
  }

  // Get Public Key (Site ID — shown in plain text)
  const pubKey = await tryExtract(page, [
    '[data-testid="public-api-key"]',
    'input[readonly]',
    'code',
    '.api-key-value',
  ], 'Public API Key');
  if (pubKey && pubKey.length > 4) collected.KLAVIYO_PUBLIC_API_KEY = pubKey;

  // Create a private key
  log('\n  ℹ️  Creating a new Private API Key in Klaviyo...', 'dim');
  const createBtn = page.locator('button:has-text("Create Private API Key"), button:has-text("Create API Key"), button:has-text("Add Key")').first();
  if (await createBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await createBtn.click();
    await page.waitForTimeout(2000);

    // Fill in key name
    const nameInput = page.locator('input[placeholder*="name"], input[type="text"]').first();
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('TipTop360 WhatsApp Integration');
    }

    // Select Full Access
    const fullAccessEl = page.locator('label:has-text("Full Access"), [value="full_access"], input[value="full"]').first();
    if (await fullAccessEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fullAccessEl.click();
    }

    const saveBtn = page.locator('button:has-text("Create"), button:has-text("Save"), button[type="submit"]').last();
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(3000);
    }

    // Extract the key from the dialog
    const privateKey = await tryExtract(page, [
      'input[value*="pk_"]',
      'code:has-text("pk_")',
      '[data-testid="api-key-value"]',
      'input[readonly]',
    ], 'Private API Key');

    if (privateKey && privateKey.startsWith('pk_')) {
      collected.KLAVIYO_PRIVATE_API_KEY = privateKey;
      log(`  ✅ Private API Key: ${privateKey.substring(0, 12)}...`, 'success');
    } else {
      log('\n  ⚠️  Copy the private key shown in the browser (starts with pk_...)', 'warn');
      const key = await prompt('  Paste Private API Key: ');
      if (key) collected.KLAVIYO_PRIVATE_API_KEY = key;
    }
  } else {
    log('\n  ℹ️  Please create a Private API Key manually in the browser:', 'dim');
    log('     Click "Create Private API Key" → name it "TipTop360" → Full Access → Create', 'dim');
    await pause('Press ENTER once the key is shown');
    const key = await prompt('  Paste Private API Key: ');
    if (key) collected.KLAVIYO_PRIVATE_API_KEY = key;
  }

  // Also get Public API Key if not already captured
  if (!collected.KLAVIYO_PUBLIC_API_KEY) {
    log('\n  ℹ️  Public API Key (also called Site ID) is shown on the same page', 'dim');
    const key = await prompt('  Paste Public API Key / Site ID: ');
    if (key) collected.KLAVIYO_PUBLIC_API_KEY = key;
  }

  // Save Klaviyo login email for browser automation
  if (!process.env.KLAVIYO_EMAIL) {
    const email = await prompt('\n  Your Klaviyo login email (for flow activation automation): ');
    if (email) collected.KLAVIYO_EMAIL = email;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.clear();
  log('\n╔══════════════════════════════════════════════════════╗', 'bold');
  log('║   TipTop360 — Credential Harvester                  ║', 'bold');
  log('║   Browser will open — you log in, bot does the rest ║', 'bold');
  log('╚══════════════════════════════════════════════════════╝', 'bold');
  log('\n  This script will open a browser and guide you through collecting:', 'dim');
  log('    • Meta App ID + Secret', 'dim');
  log('    • WhatsApp Access Token', 'dim');
  log('    • Phone Number ID + WABA ID', 'dim');
  log('    • Meta Pixel ID', 'dim');
  log('    • Klaviyo API Keys', 'dim');
  log('\n  All values will be saved automatically to your .env file.\n', 'dim');

  await pause('Press ENTER to open the browser and start');

  const existing = loadEnv();
  const collected = {};

  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await extractMetaAppCredentials(page, collected);
    await extractAccessToken(page, collected);
    await extractWhatsAppIds(page, collected);
    await extractPixelId(page, collected);
    await extractKlaviyoKeys(page, collected);

    log('\n\n━━━ SAVING TO .env ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'bold');
    updateEnv(collected);

    log('\n\n╔══════════════════════════════════════════════════════╗', 'bold');
    log('║   ✅ All credentials collected & saved!              ║', 'bold');
    log('╚══════════════════════════════════════════════════════╝', 'bold');

    log('\n  Collected values:', 'dim');
    for (const [k, v] of Object.entries(collected)) {
      if (v) log(`    ${k.padEnd(35)} ${String(v).substring(0, 10)}...`, 'success');
    }

    log('\n  Next step: deploy the webhook server, then run:', 'info');
    log('    npm run setup:all --skip-meta\n', 'bold');

  } catch (err) {
    log(`\n\n❌ Error: ${err.message}`, 'error');
    if (Object.keys(collected).length > 0) {
      log('  Saving partial results to .env...', 'warn');
      updateEnv(collected);
    }
    throw err;
  } finally {
    await pause('\nPress ENTER to close the browser');
    await browser.close();
  }
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
