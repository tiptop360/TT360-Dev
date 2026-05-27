/**
 * TipTop360 — WhatsApp × Klaviyo Local Setup
 * ============================================
 * Run once on YOUR machine:
 *   node scripts/setup-whatsapp-klaviyo.mjs
 *
 * What it does:
 *   1. Creates 3 Klaviyo flows via REST API (Welcome, Abandoned Cart, Order Confirm)
 *   2. Opens Chrome at Klaviyo → Settings so you can connect WhatsApp via Meta OAuth
 *
 * Requires .env with:
 *   KLAVIYO_API_KEY=pk_...
 *   WHATSAPP_NUMBER=971585156033
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
import readline from 'readline';

const execAsync = promisify(exec);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const KEY    = process.env.KLAVIYO_API_KEY;
const WA_NUM = process.env.WHATSAPP_NUMBER || '971585156033';
const WA_LIST = 'StG72P'; // "WhatsApp Subscribers"

if (!KEY) { console.error('❌  KLAVIYO_API_KEY missing from .env'); process.exit(1); }

function ask(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); resolve(a.trim()); });
  });
}

// ─── Klaviyo REST helper ──────────────────────────────────────────────────────

async function kv(method, path, body, revision = '2025-01-15') {
  await sleep(1000);
  const res = await fetch(`https://a.klaviyo.com/api/${path}`, {
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Klaviyo-API-Key ${KEY}`,
      revision,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    return { ok: false, status: res.status, errors: parsed?.errors ?? [{ detail: text }] };
  }
  return { ok: true, data: JSON.parse(text) };
}

// Try creating a flow, probing the definition structure Klaviyo actually wants
async function createFlow(name, triggerType, triggerId) {

  // Attempt 1 — 2025-01-15 with definition
  let r = await kv('POST', 'flows/', {
    data: {
      type: 'flow',
      attributes: {
        name,
        status: 'draft',
        definition: {
          trigger: {
            type: triggerType === 'list' ? 'Added to List' : 'Metric',
            ...(triggerType === 'list' ? { list_id: triggerId } : { metric_id: triggerId }),
          },
        },
      },
    },
  });
  if (r.ok) return r.data?.data?.id;

  // Log first error detail for debugging
  const detail = r.errors?.[0]?.detail ?? JSON.stringify(r.errors);
  console.log(`     [attempt 1] ${r.status}: ${detail}`);

  // Attempt 2 — try with empty definition
  r = await kv('POST', 'flows/', {
    data: {
      type: 'flow',
      attributes: { name, status: 'draft', definition: {} },
    },
  });
  if (r.ok) return r.data?.data?.id;
  console.log(`     [attempt 2] ${r.status}: ${r.errors?.[0]?.detail}`);

  // Attempt 3 — try without definition field at all (older revision)
  r = await kv('POST', 'flows/', {
    data: { type: 'flow', attributes: { name, status: 'draft' } },
  }, '2024-07-15');
  if (r.ok) return r.data?.data?.id;
  console.log(`     [attempt 3] ${r.status}: ${r.errors?.[0]?.detail}`);

  return null;
}

// ─── Flow: WhatsApp Welcome ───────────────────────────────────────────────────

async function flowWelcome() {
  console.log('\n📱  Creating WhatsApp Welcome Flow…');
  const fid = await createFlow('WhatsApp Welcome - TT360', 'list', WA_LIST);
  if (!fid) { console.log('  ⚠️  Skipped — create manually in Klaviyo UI'); return null; }
  console.log(`  ✅  ${fid}`);

  for (const [name, body, delay] of [
    ['WA Welcome #1',
     `👋 Ahlan wa sahlan! You're now connected with *TipTop360*.\n\nWe'll send you exclusive deals, restock alerts & order updates right here on WhatsApp.\n\nReply HELP anytime or STOP to opt out. 🦷✨`,
     null],
    [null, null, { type: 'STATIC', unit: 'days', value: 1 }],
    ['WA Welcome #2 — Best Sellers',
     `🌟 TipTop360 customers love:\n\n• 🪥 Foam Toothpaste — #1 kids brush\n• 💪 Gym Bag — built for UAE summers\n• 🧒 Kids Dental Kit — dentist-approved\n\nShop 👉 https://tiptop360.com\n\nReply DEALS for your subscriber discount 🎁`,
     null],
  ]) {
    if (delay) {
      await kv('POST', 'flow-actions/', { data: { type: 'flow-action', attributes: { actionType: 'DELAY', settings: { delay } }, relationships: { flow: { data: { type: 'flow', id: fid } } } } });
    } else {
      await kv('POST', 'flow-actions/', { data: { type: 'flow-action', attributes: { actionType: 'SEND_MESSAGE', settings: { channel: 'SMS', name, message: { body } } }, relationships: { flow: { data: { type: 'flow', id: fid } } } } });
    }
  }

  return fid;
}

// ─── Flow: Abandoned Cart ────────────────────────────────────────────────────

async function flowAbandonedCart() {
  console.log('\n🛒  Creating WhatsApp Abandoned Cart Flow…');
  const fid = await createFlow('WhatsApp Abandoned Cart - TT360', 'metric', 'Skqx6a');
  if (!fid) { console.log('  ⚠️  Skipped — create manually in Klaviyo UI'); return null; }
  console.log(`  ✅  ${fid}`);

  await kv('POST', 'flow-actions/', { data: { type: 'flow-action', attributes: { actionType: 'DELAY', settings: { delay: { type: 'STATIC', unit: 'hours', value: 1 } } }, relationships: { flow: { data: { type: 'flow', id: fid } } } } });
  await kv('POST', 'flow-actions/', { data: { type: 'flow-action', attributes: { actionType: 'SEND_MESSAGE', settings: { channel: 'SMS', name: 'WA Abandoned Cart #1', message: { body: `👀 You left something at *TipTop360*!\n\nYour cart is waiting — complete your order now and get FREE delivery over AED 150 🚀\n\n👉 https://tiptop360.com/cart\n\nReply STOP to unsubscribe.` } } }, relationships: { flow: { data: { type: 'flow', id: fid } } } } });

  return fid;
}

// ─── Flow: Order Confirmation ────────────────────────────────────────────────

async function flowOrderConfirm() {
  console.log('\n📦  Creating WhatsApp Order Confirmation Flow…');
  const fid = await createFlow('WhatsApp Order Confirmation - TT360', 'metric', 'V5vcSP');
  if (!fid) { console.log('  ⚠️  Skipped — create manually in Klaviyo UI'); return null; }
  console.log(`  ✅  ${fid}`);

  await kv('POST', 'flow-actions/', { data: { type: 'flow-action', attributes: { actionType: 'SEND_MESSAGE', settings: { channel: 'SMS', name: 'WA Order Confirmed', message: { body: `✅ Order confirmed, {{ person.first_name|default:"friend" }}!\n\nThank you for shopping with *TipTop360*. We're packing your order now.\n\n📦 Order: {{ event.OrderId }}\n💰 Total: AED {{ event.Value }}\n\nQuestions? Just reply here. 😊\n\nReply STOP to unsubscribe.` } } }, relationships: { flow: { data: { type: 'flow', id: fid } } } } });
  await kv('POST', 'flow-actions/', { data: { type: 'flow-action', attributes: { actionType: 'DELAY', settings: { delay: { type: 'STATIC', unit: 'days', value: 2 } } }, relationships: { flow: { data: { type: 'flow', id: fid } } } } });
  await kv('POST', 'flow-actions/', { data: { type: 'flow-action', attributes: { actionType: 'SEND_MESSAGE', settings: { channel: 'SMS', name: 'WA Post-Purchase Review', message: { body: `💬 How's everything, {{ person.first_name|default:"friend" }}?\n\nWe hope your *TipTop360* order arrived safely! Your review helps UAE families choose better.\n\n⭐ Leave a review: https://tiptop360.com/pages/reviews\n\nThank you! 🙏\n\nReply STOP to unsubscribe.` } } }, relationships: { flow: { data: { type: 'flow', id: fid } } } } });

  return fid;
}

// ─── WhatsApp OAuth ──────────────────────────────────────────────────────────

async function openKlaviyoSettings() {
  console.log('\n🌐  Opening Klaviyo in Chrome…');
  try {
    if (process.platform === 'darwin') {
      await execAsync('open -a "Google Chrome" "https://www.klaviyo.com/settings"');
    } else if (process.platform === 'win32') {
      await execAsync('start chrome "https://www.klaviyo.com/settings"');
    } else {
      await execAsync('xdg-open "https://www.klaviyo.com/settings"');
    }
    console.log('  Chrome opened at klaviyo.com/settings');
  } catch {
    console.log('  Could not open Chrome automatically.');
    console.log('  Please open: https://www.klaviyo.com/settings');
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('━━━ TipTop360 WhatsApp × Klaviyo Local Setup ━━━\n');

// Step 1: Create flows
console.log('STEP 1 — Creating Klaviyo flows\n');
const w  = await flowWelcome();
const ac = await flowAbandonedCart();
const oc = await flowOrderConfirm();

console.log('\n─────────────────────────────────');
if (w)  console.log(`  Welcome:        https://www.klaviyo.com/flow/${w}/edit`);
if (ac) console.log(`  Abandoned Cart: https://www.klaviyo.com/flow/${ac}/edit`);
if (oc) console.log(`  Order Confirm:  https://www.klaviyo.com/flow/${oc}/edit`);
console.log('─────────────────────────────────\n');

// Step 2: WhatsApp OAuth
console.log('STEP 2 — Connect WhatsApp to Klaviyo\n');
await openKlaviyoSettings();
console.log(`
In Klaviyo Settings, find "WhatsApp" (under Channels or Messaging) and:
  1. Click "Connect with Meta"
  2. Select your WhatsApp Business Account
  3. Select phone number +${WA_NUM}
  4. Click Connect / Finish
`);
await ask('Press ENTER when WhatsApp is connected…');

// Step 3: Remind to switch channels
console.log('\nSTEP 3 — Switch flow messages from SMS → WhatsApp');
console.log('In each flow above, open the SMS message actions and change channel to WhatsApp.');
console.log('\n✅  Setup complete!');
