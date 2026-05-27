/**
 * TipTop360 — Open Klaviyo WhatsApp Settings in your Chrome profile
 * Run: node scripts/playwright-wa-oauth.mjs
 */

import { chromium } from 'playwright';
import path from 'path';
import os from 'os';

const CHROME_PROFILES = {
  darwin: path.join(os.homedir(), 'Library/Application Support/Google/Chrome'),
  win32:  path.join(os.homedir(), 'AppData/Local/Google/Chrome/User Data'),
  linux:  path.join(os.homedir(), '.config/google-chrome'),
};

const CHROME_EXE = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  win32:  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  linux:  '/usr/bin/google-chrome',
};

const userDataDir   = CHROME_PROFILES[process.platform] ?? CHROME_PROFILES.darwin;
const executablePath = CHROME_EXE[process.platform]    ?? CHROME_EXE.darwin;

console.log('━━━ TipTop360 WhatsApp × Klaviyo ━━━');
console.log('Opening Chrome with your profile…\n');

const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath,
  headless: false,
  viewport: null,
  args: ['--no-first-run', '--no-default-browser-check'],
});

const page = await context.newPage();

console.log('Navigating to Klaviyo WhatsApp settings…');
await page.goto('https://www.klaviyo.com/settings/channels/whatsapp', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});

console.log(`\nURL: ${page.url()}`);
console.log('\n─────────────────────────────────────────');
console.log('The page is open. Now in the browser:');
console.log('  1. Click  "Connect with Meta"');
console.log('  2. Select your WhatsApp Business Account');
console.log('  3. Select phone number +971585156033');
console.log('  4. Click Connect / Finish');
console.log('─────────────────────────────────────────');
console.log('\nPress ENTER here when done to close Chrome.');

await new Promise(r => {
  process.stdin.setEncoding('utf8');
  process.stdin.once('data', r);
});

await context.close();
console.log('Done!');
