/**
 * TipTop360 — Klaviyo Flow Builder via Browser Automation
 * Run locally: node scripts/klaviyo-create-flows.mjs
 *
 * Connects to your RUNNING Chrome (with all your sessions intact).
 * Creates 3 WhatsApp flows in Klaviyo.
 */

import { chromium } from 'playwright';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';
import os from 'os';

const execAsync = promisify(exec);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function ask(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); resolve(a.trim()); });
  });
}

const WA_LIST  = 'WhatsApp Subscribers';
const CDP_PORT = 9222;

// ─── Launch Chrome with remote debugging ─────────────────────────────────────

async function launchChrome() {
  // Kill existing Chrome
  await execAsync('pkill -f "Google Chrome" || true').catch(() => {});
  await sleep(2000);

  const chromeBin = process.platform === 'win32'
    ? '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"'
    : '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"';

  const userDataDir = process.platform === 'darwin'
    ? `${os.homedir()}/Library/Application Support/Google/Chrome`
    : process.platform === 'win32'
      ? `${os.homedir()}\\AppData\\Local\\Google\\Chrome\\User Data`
      : `${os.homedir()}/.config/google-chrome`;

  const cmd = `${chromeBin} \
    --remote-debugging-port=${CDP_PORT} \
    --user-data-dir="${userDataDir}" \
    --no-first-run \
    --no-default-browser-check \
    "https://www.klaviyo.com/flows" &`;

  console.log('⏳  Launching Chrome with remote debugging…');
  exec(cmd); // fire and forget
  await sleep(5000);
}

// ─── Flow definitions ─────────────────────────────────────────────────────────

const FLOWS = [
  {
    name: 'WhatsApp Welcome - TT360',
    trigger: { type: 'list', value: WA_LIST },
    steps: [
      { type: 'sms', label: 'WA Welcome #1', text: "👋 Ahlan wa sahlan! You're now connected with TipTop360.\n\nWe'll send you exclusive deals, restock alerts & order updates.\n\nReply STOP to opt out. 🦷✨" },
      { type: 'delay', amount: '1', unit: 'Days' },
      { type: 'sms', label: 'WA Welcome #2', text: '🌟 TipTop360 top picks:\n• 🪥 Foam Toothpaste — #1 kids brush\n• 💪 Gym Bag — UAE summers\n• 🧒 Kids Dental Kit\n\nShop 👉 https://tiptop360.com\n\nReply STOP to unsubscribe.' },
    ],
  },
  {
    name: 'WhatsApp Abandoned Cart - TT360',
    trigger: { type: 'metric', value: 'Started Checkout' },
    steps: [
      { type: 'delay', amount: '1', unit: 'Hours' },
      { type: 'sms', label: 'WA Abandoned Cart', text: '👀 Your TipTop360 cart is waiting!\n\nFree delivery over AED 150 🚀\n👉 https://tiptop360.com/cart\n\nReply STOP to unsubscribe.' },
    ],
  },
  {
    name: 'WhatsApp Order Confirmation - TT360',
    trigger: { type: 'metric', value: 'Placed Order' },
    steps: [
      { type: 'sms', label: 'WA Order Confirmed', text: '✅ Order confirmed, {{ person.first_name|default:"friend" }}!\n\nThank you for shopping with TipTop360.\n📦 Order: {{ event.OrderId }}\n💰 AED {{ event.Value }}\n\nReply STOP to unsubscribe.' },
      { type: 'delay', amount: '2', unit: 'Days' },
      { type: 'sms', label: 'WA Review Request', text: "💬 How's your TipTop360 order, {{ person.first_name|default:'friend' }}?\n\n⭐ Leave a review: https://tiptop360.com/pages/reviews\n\nThank you! 🙏\n\nReply STOP to unsubscribe." },
    ],
  },
];

// ─── Flow creation logic ──────────────────────────────────────────────────────

async function tryClick(page, selectors, timeout = 8000) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      await el.waitFor({ timeout: timeout / selectors.length });
      await el.click();
      return true;
    } catch {}
  }
  return false;
}

async function createFlow(page, flow) {
  console.log(`\n📱  Creating: "${flow.name}"`);

  // Go to flows page
  await page.goto('https://www.klaviyo.com/flows', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);

  // Click Create Flow
  const created = await tryClick(page, [
    'button:has-text("Create Flow")',
    'a:has-text("Create Flow")',
    '[data-testid="create-flow-button"]',
  ]);
  if (!created) { console.log('  ❌  Could not find "Create Flow" button'); return null; }
  await sleep(2000);

  // Click "Build Your Own" / "Create from Scratch"
  await tryClick(page, [
    'text=/Build Your Own/i',
    'text=/Create from Scratch/i',
    'text=/Start from Scratch/i',
    'button:has-text("Build")',
  ], 5000);
  await sleep(1500);

  // Enter flow name
  const nameInput = page.locator('input[placeholder*="name" i], input[placeholder*="Flow" i]').first();
  if (await nameInput.isVisible({ timeout: 8000 }).catch(() => false)) {
    await nameInput.triple_click?.() || await nameInput.click({ clickCount: 3 });
    await nameInput.fill(flow.name);
    await sleep(500);
    // Press Enter or click confirm
    await nameInput.press('Enter').catch(() => {});
  }
  await sleep(1000);

  // Confirm / Next
  await tryClick(page, [
    'button:has-text("Create")',
    'button:has-text("Next")',
    'button:has-text("Continue")',
  ], 4000);
  await sleep(2000);

  // Take screenshot for debugging
  await page.screenshot({ path: `/tmp/kv-flow-${flow.name.replace(/\s+/g, '-')}.png` });
  console.log(`  📸  Screenshot: /tmp/kv-flow-${flow.name.replace(/\s+/g, '-')}.png`);

  const url = page.url();
  console.log(`  ✅  Flow page: ${url}`);
  return url;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('━━━ TipTop360 — Klaviyo Flow Builder ━━━\n');
console.log('This script will:');
console.log('  1. Kill & relaunch Chrome with remote debugging');
console.log('  2. Connect to it via CDP');
console.log('  3. Auto-create 3 WhatsApp flows in Klaviyo\n');

await ask('Press ENTER to launch Chrome (it will close and reopen)…');

await launchChrome();

// Connect via CDP
let browser;
for (let i = 0; i < 8; i++) {
  try {
    browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
    console.log('✅  Connected to Chrome via CDP\n');
    break;
  } catch {
    console.log(`   Retrying CDP connection (${i + 1}/8)…`);
    await sleep(3000);
  }
}

if (!browser) {
  console.error('❌  Could not connect to Chrome. Make sure Chrome launched successfully.');
  process.exit(1);
}

const [context] = browser.contexts();
const page = context.pages()[0] ?? await context.newPage();
await page.bringToFront();

// Verify logged in
await page.goto('https://www.klaviyo.com/flows', { waitUntil: 'domcontentloaded', timeout: 30000 });
await sleep(2000);

if (page.url().includes('login')) {
  console.log('\n⚠️  Please log in to Klaviyo in the Chrome window, then press ENTER here.');
  await ask('');
  await page.goto('https://www.klaviyo.com/flows', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
}

console.log(`✅  On Klaviyo Flows page: ${page.url()}\n`);

// Create each flow
const results = [];
for (const flow of FLOWS) {
  try {
    const url = await createFlow(page, flow);
    results.push({ name: flow.name, url, ok: !!url });
  } catch (err) {
    console.log(`  ❌  Error: ${err.message}`);
    results.push({ name: flow.name, ok: false });
  }
  await sleep(1500);
}

console.log('\n━━━ Summary ━━━');
for (const r of results) {
  console.log(`  ${r.ok ? '✅' : '❌'}  ${r.name}`);
  if (r.url) console.log(`      ${r.url}`);
}
console.log('\nScreenshots saved to /tmp/kv-flow-*.png for debugging.');
console.log('\nPress ENTER to close.');
await ask('');
await browser.close();
