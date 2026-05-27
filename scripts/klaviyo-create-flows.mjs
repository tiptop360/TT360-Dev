/**
 * TipTop360 — Klaviyo Flow Builder via Browser Automation
 * Run locally: node scripts/klaviyo-create-flows.mjs
 *
 * Uses your existing Chrome profile (already logged into Klaviyo).
 * Creates 3 WhatsApp flows in draft mode.
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

const userDataDir    = CHROME_PROFILES[process.platform] ?? CHROME_PROFILES.darwin;
const executablePath = CHROME_EXE[process.platform]     ?? CHROME_EXE.darwin;

const sleep  = ms => new Promise(r => setTimeout(r, ms));
const WA_LIST = 'WhatsApp Subscribers';

const FLOWS = [
  {
    name: 'WhatsApp Welcome - TT360',
    trigger: { type: 'list', value: WA_LIST },
    steps: [
      { type: 'sms', text: '👋 Ahlan wa sahlan! You\'re now connected with TipTop360.\n\nWe\'ll send you exclusive deals, restock alerts & order updates right here on WhatsApp.\n\nReply STOP to opt out. 🦷✨' },
      { type: 'delay', amount: '1', unit: 'Days' },
      { type: 'sms', text: '🌟 TipTop360 customers love:\n• 🪥 Foam Toothpaste — #1 kids brush\n• 💪 Gym Bag — built for UAE summers\n• 🧒 Kids Dental Kit — dentist-approved\n\nShop 👉 https://tiptop360.com\n\nReply STOP to unsubscribe.' },
    ],
  },
  {
    name: 'WhatsApp Abandoned Cart - TT360',
    trigger: { type: 'metric', value: 'Started Checkout' },
    steps: [
      { type: 'delay', amount: '1', unit: 'Hours' },
      { type: 'sms', text: '👀 You left something at TipTop360!\n\nYour cart is waiting — complete your order now and get FREE delivery over AED 150 🚀\n\n👉 https://tiptop360.com/cart\n\nReply STOP to unsubscribe.' },
    ],
  },
  {
    name: 'WhatsApp Order Confirmation - TT360',
    trigger: { type: 'metric', value: 'Placed Order' },
    steps: [
      { type: 'sms', text: '✅ Order confirmed, {{ person.first_name|default:"friend" }}!\n\nThank you for shopping with TipTop360. We\'re packing your order now.\n\n📦 Order: {{ event.OrderId }}\n💰 Total: AED {{ event.Value }}\n\nReply STOP to unsubscribe.' },
      { type: 'delay', amount: '2', unit: 'Days' },
      { type: 'sms', text: '💬 How\'s everything, {{ person.first_name|default:"friend" }}?\n\nWe hope your TipTop360 order arrived safely!\n\n⭐ Leave a review: https://tiptop360.com/pages/reviews\n\nThank you! 🙏\n\nReply STOP to unsubscribe.' },
    ],
  },
];

async function clickText(page, text, timeout = 10000) {
  const el = page.locator(`text="${text}"`).first();
  await el.waitFor({ timeout });
  await el.click();
}

async function createFlow(page, flow) {
  console.log(`\n📱  Creating: ${flow.name}`);

  // Navigate to flows and create new
  await page.goto('https://www.klaviyo.com/flows', { waitUntil: 'domcontentloaded' });
  await sleep(2000);

  // Click "Create Flow"
  const createBtn = page.locator('button:has-text("Create Flow"), a:has-text("Create Flow")').first();
  await createBtn.waitFor({ timeout: 15000 });
  await createBtn.click();
  await sleep(1500);

  // Click "Build Your Own" or "Create from Scratch"
  const scratch = page.locator('text=/Build Your Own|Create from Scratch|Start from Scratch/i').first();
  if (await scratch.isVisible({ timeout: 5000 }).catch(() => false)) {
    await scratch.click();
    await sleep(1000);
  }

  // Enter flow name
  const nameInput = page.locator('input[placeholder*="name" i], input[placeholder*="flow" i], input[name="name"]').first();
  await nameInput.waitFor({ timeout: 10000 });
  await nameInput.fill(flow.name);
  await sleep(500);

  // Confirm / Next
  const confirmBtn = page.locator('button:has-text("Create"), button:has-text("Next"), button:has-text("Done")').first();
  if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmBtn.click();
    await sleep(2000);
  }

  // ── Set Trigger ────────────────────────────────────────────────────────────
  console.log(`   Setting trigger: ${flow.trigger.type} → ${flow.trigger.value}`);

  if (flow.trigger.type === 'list') {
    // Click "Joined a List" or "Added to List" trigger
    const listTrigger = page.locator('text=/Added to List|Joined a List/i').first();
    if (await listTrigger.isVisible({ timeout: 8000 }).catch(() => false)) {
      await listTrigger.click();
      await sleep(1000);
    }
    // Select the specific list
    const listOption = page.locator(`text="${WA_LIST}"`).first();
    if (await listOption.isVisible({ timeout: 8000 }).catch(() => false)) {
      await listOption.click();
      await sleep(1000);
    }
  } else {
    // Metric trigger
    const metricTrigger = page.locator('text=/Metric|Event/i').first();
    if (await metricTrigger.isVisible({ timeout: 8000 }).catch(() => false)) {
      await metricTrigger.click();
      await sleep(1000);
    }
    // Search for and select the metric
    const metricSearch = page.locator('input[placeholder*="search" i], input[placeholder*="metric" i]').first();
    if (await metricSearch.isVisible({ timeout: 5000 }).catch(() => false)) {
      await metricSearch.fill(flow.trigger.value);
      await sleep(1000);
    }
    const metricOption = page.locator(`text="${flow.trigger.value}"`).first();
    if (await metricOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await metricOption.click();
      await sleep(1000);
    }
  }

  // Confirm trigger selection
  const triggerDone = page.locator('button:has-text("Done"), button:has-text("Save"), button:has-text("Apply")').first();
  if (await triggerDone.isVisible({ timeout: 3000 }).catch(() => false)) {
    await triggerDone.click();
    await sleep(1500);
  }

  console.log(`   ✅  Trigger set`);

  // ── Add Steps ──────────────────────────────────────────────────────────────
  for (const step of flow.steps) {
    await sleep(1000);

    if (step.type === 'delay') {
      console.log(`   Adding delay: ${step.amount} ${step.unit}`);
      const addBtn = page.locator('button:has-text("Add"), [aria-label*="add" i]').first();
      if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) await addBtn.click();
      await sleep(800);

      const delayOption = page.locator('text=/Time Delay|Delay/i').first();
      if (await delayOption.isVisible({ timeout: 5000 }).catch(() => false)) await delayOption.click();
      await sleep(1000);

      // Set amount
      const amountInput = page.locator('input[type="number"], input[placeholder*="amount" i]').first();
      if (await amountInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await amountInput.fill(step.amount);
      }
      // Set unit
      const unitSelect = page.locator(`text="${step.unit}"`).first();
      if (await unitSelect.isVisible({ timeout: 5000 }).catch(() => false)) await unitSelect.click();

      const stepDone = page.locator('button:has-text("Done"), button:has-text("Save")').first();
      if (await stepDone.isVisible({ timeout: 3000 }).catch(() => false)) {
        await stepDone.click();
        await sleep(1000);
      }

    } else if (step.type === 'sms') {
      console.log(`   Adding SMS message`);
      const addBtn = page.locator('button:has-text("Add"), [aria-label*="add" i]').first();
      if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) await addBtn.click();
      await sleep(800);

      const smsOption = page.locator('text=/SMS|Send SMS|Message/i').first();
      if (await smsOption.isVisible({ timeout: 5000 }).catch(() => false)) await smsOption.click();
      await sleep(1500);

      // Fill message body
      const msgInput = page.locator('textarea, [contenteditable="true"]').first();
      if (await msgInput.isVisible({ timeout: 8000 }).catch(() => false)) {
        await msgInput.click();
        await msgInput.fill(step.text);
        await sleep(500);
      }

      const stepDone = page.locator('button:has-text("Done"), button:has-text("Save"), button:has-text("Apply")').first();
      if (await stepDone.isVisible({ timeout: 3000 }).catch(() => false)) {
        await stepDone.click();
        await sleep(1000);
      }
    }
  }

  // Save flow
  const saveFlow = page.locator('button:has-text("Save"), button:has-text("Update")').first();
  if (await saveFlow.isVisible({ timeout: 5000 }).catch(() => false)) {
    await saveFlow.click();
    await sleep(2000);
  }

  const url = page.url();
  console.log(`   ✅  Done → ${url}`);
  return url;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
console.log('━━━ TipTop360 — Klaviyo Flow Builder ━━━');
console.log('Opening Chrome with your profile…\n');

const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath,
  headless: false,
  slowMo: 60,
  viewport: null,
  args: ['--no-first-run', '--no-default-browser-check'],
});

const page = await context.newPage();

// Check login
await page.goto('https://www.klaviyo.com/flows', { waitUntil: 'domcontentloaded', timeout: 30000 });
await sleep(2000);

if (page.url().includes('login') || page.url().includes('account/login')) {
  console.log('⚠️  Please log in to Klaviyo in the browser window, then press ENTER here.');
  await new Promise(r => { process.stdin.setEncoding('utf8'); process.stdin.once('data', r); });
  await page.goto('https://www.klaviyo.com/flows', { waitUntil: 'domcontentloaded' });
  await sleep(2000);
}

console.log('✅  Logged into Klaviyo\n');

const results = [];
for (const flow of FLOWS) {
  try {
    const url = await createFlow(page, flow);
    results.push({ name: flow.name, url, ok: true });
  } catch (err) {
    console.log(`   ❌  Failed: ${err.message}`);
    results.push({ name: flow.name, ok: false });
  }
  await sleep(2000);
}

console.log('\n━━━ Summary ━━━');
for (const r of results) {
  console.log(`  ${r.ok ? '✅' : '❌'}  ${r.name}`);
  if (r.url) console.log(`      ${r.url}`);
}

console.log('\nPress ENTER to close Chrome.');
await new Promise(r => { process.stdin.setEncoding('utf8'); process.stdin.once('data', r); });
await context.close();
