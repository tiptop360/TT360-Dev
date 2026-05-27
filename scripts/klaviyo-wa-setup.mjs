/**
 * TipTop360 — Klaviyo WhatsApp Flow Setup
 * Run: node scripts/klaviyo-wa-setup.mjs
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const KEY = process.env.KLAVIYO_API_KEY;
const WA_LIST_ID = 'StG72P';   // "WhatsApp Subscribers"
const STORE = 'TipTop360';
const WA_NUMBER = process.env.WHATSAPP_NUMBER || '971585156033';

if (!KEY) { console.error('❌  KLAVIYO_API_KEY missing from .env'); process.exit(1); }

const headers = {
  'accept': 'application/json',
  'content-type': 'application/json',
  'Authorization': `Klaviyo-API-Key ${KEY}`,
  'revision': '2025-01-15',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function kv(method, path, body) {
  await sleep(600); // stay under rate limit
  const res = await fetch(`https://a.klaviyo.com/api/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`  ❌  ${method} ${path} → ${res.status}`, JSON.parse(text)?.errors?.[0]?.detail ?? text);
    return null;
  }
  return JSON.parse(text);
}

// Create a flow (no trigger set — Klaviyo API doesn't accept relationships at creation)
async function createFlow(name) {
  const res = await kv('POST', 'flows/', {
    data: { type: 'flow', attributes: { name, status: 'draft' } },
  });
  return res?.data?.id ?? null;
}

// ─── 1. WhatsApp Welcome Flow ────────────────────────────────────────────────
async function createWelcomeFlow() {
  console.log('\n📱  Creating WhatsApp Welcome Flow…');
  const fid = await createFlow('WhatsApp Welcome - TT360');
  if (!fid) return null;
  console.log(`  ✅  Flow created: ${fid}`);
  console.log(`      Trigger manually: Added to List → "WhatsApp Subscribers"`);

  await kv('POST', 'flow-actions/', { data: {
    type: 'flow-action',
    attributes: {
      actionType: 'SEND_MESSAGE',
      settings: {
        channel: 'SMS',  // SMS channel used as placeholder until WA is connected
        name: 'WA Welcome #1',
        message: { body: `👋 Ahlan wa sahlan! You're now connected with *${STORE}*.\n\nWe'll send you exclusive deals, restock alerts & order updates right here on WhatsApp.\n\nReply HELP anytime or STOP to opt out. 🦷✨` },
      },
    },
    relationships: { flow: { data: { type: 'flow', id: fid } } },
  }});

  await kv('POST', 'flow-actions/', { data: {
    type: 'flow-action',
    attributes: {
      actionType: 'DELAY',
      settings: { delay: { type: 'STATIC', unit: 'days', value: 1 } },
    },
    relationships: { flow: { data: { type: 'flow', id: fid } } },
  }});

  await kv('POST', 'flow-actions/', { data: {
    type: 'flow-action',
    attributes: {
      actionType: 'SEND_MESSAGE',
      settings: {
        channel: 'SMS',
        name: 'WA Welcome #2 — Best Sellers',
        message: { body: `🌟 TipTop360 customers love:\n\n• 🪥 Foam Toothpaste — #1 kids brush\n• 💪 Gym Bag — built for UAE summers\n• 🧒 Kids Dental Kit — dentist-approved\n\nShop 👉 https://tiptop360.com\n\nReply DEALS for your subscriber discount 🎁` },
      },
    },
    relationships: { flow: { data: { type: 'flow', id: fid } } },
  }});

  console.log(`  ✅  https://www.klaviyo.com/flow/${fid}/edit`);
  return fid;
}

// ─── 2. WhatsApp Abandoned Cart Flow ─────────────────────────────────────────
async function createAbandonedCartFlow() {
  console.log('\n🛒  Creating WhatsApp Abandoned Cart Flow…');
  const fid = await createFlow('WhatsApp Abandoned Cart - TT360');
  if (!fid) return null;
  console.log(`  ✅  Flow created: ${fid}`);
  console.log(`      Trigger manually: Metric → "Started Checkout"`);

  await kv('POST', 'flow-actions/', { data: {
    type: 'flow-action',
    attributes: {
      actionType: 'DELAY',
      settings: { delay: { type: 'STATIC', unit: 'hours', value: 1 } },
    },
    relationships: { flow: { data: { type: 'flow', id: fid } } },
  }});

  await kv('POST', 'flow-actions/', { data: {
    type: 'flow-action',
    attributes: {
      actionType: 'SEND_MESSAGE',
      settings: {
        channel: 'SMS',
        name: 'WA Abandoned Cart #1',
        message: { body: `👀 You left something at *TipTop360*!\n\nYour cart is waiting — complete your order now and get FREE delivery over AED 150 🚀\n\n👉 https://tiptop360.com/cart\n\nReply STOP to unsubscribe.` },
      },
    },
    relationships: { flow: { data: { type: 'flow', id: fid } } },
  }});

  console.log(`  ✅  https://www.klaviyo.com/flow/${fid}/edit`);
  return fid;
}

// ─── 3. WhatsApp Order Confirmation Flow ─────────────────────────────────────
async function createOrderConfirmationFlow() {
  console.log('\n📦  Creating WhatsApp Order Confirmation Flow…');
  const fid = await createFlow('WhatsApp Order Confirmation - TT360');
  if (!fid) return null;
  console.log(`  ✅  Flow created: ${fid}`);
  console.log(`      Trigger manually: Metric → "Placed Order"`);

  await kv('POST', 'flow-actions/', { data: {
    type: 'flow-action',
    attributes: {
      actionType: 'SEND_MESSAGE',
      settings: {
        channel: 'SMS',
        name: 'WA Order Confirmed',
        message: { body: `✅ Order confirmed, {{ person.first_name|default:"friend" }}!\n\nThank you for shopping with *TipTop360*. We're packing your order now.\n\n📦 Order: {{ event.OrderId }}\n💰 Total: AED {{ event.Value }}\n\nQuestions? Just reply here. 😊\n\nReply STOP to unsubscribe.` },
      },
    },
    relationships: { flow: { data: { type: 'flow', id: fid } } },
  }});

  await kv('POST', 'flow-actions/', { data: {
    type: 'flow-action',
    attributes: {
      actionType: 'DELAY',
      settings: { delay: { type: 'STATIC', unit: 'days', value: 2 } },
    },
    relationships: { flow: { data: { type: 'flow', id: fid } } },
  }});

  await kv('POST', 'flow-actions/', { data: {
    type: 'flow-action',
    attributes: {
      actionType: 'SEND_MESSAGE',
      settings: {
        channel: 'SMS',
        name: 'WA Post-Purchase Review',
        message: { body: `💬 How's everything, {{ person.first_name|default:"friend" }}?\n\nWe hope your *TipTop360* order arrived safely! Your review helps UAE families choose better.\n\n⭐ Leave a review: https://tiptop360.com/pages/reviews\n\nThank you! 🙏\n\nReply STOP to unsubscribe.` },
      },
    },
    relationships: { flow: { data: { type: 'flow', id: fid } } },
  }});

  console.log(`  ✅  https://www.klaviyo.com/flow/${fid}/edit`);
  return fid;
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  console.log('━━━ TipTop360 Klaviyo WhatsApp Setup ━━━');
  console.log(`Account: QP294m  |  WA: +${WA_NUMBER}\n`);

  const w  = await createWelcomeFlow();
  const ac = await createAbandonedCartFlow();
  const oc = await createOrderConfirmationFlow();

  console.log('\n━━━ Done ━━━');
  if (w)  console.log(`  Welcome flow:        https://www.klaviyo.com/flow/${w}/edit`);
  if (ac) console.log(`  Abandoned Cart flow: https://www.klaviyo.com/flow/${ac}/edit`);
  if (oc) console.log(`  Order Confirm flow:  https://www.klaviyo.com/flow/${oc}/edit`);
  console.log('\nNext: open each flow, set the trigger, then switch channel SMS→WhatsApp once connected.');
})();
