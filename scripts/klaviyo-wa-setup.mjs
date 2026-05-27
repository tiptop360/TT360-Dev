/**
 * TipTop360 — Klaviyo WhatsApp Flow + List Setup
 * Run: node scripts/klaviyo-wa-setup.mjs
 *
 * Creates:
 *  1. WhatsApp Welcome flow  (triggers on "Added to WhatsApp Subscribers" list)
 *  2. WhatsApp Abandoned Cart nudge flow
 *  3. WhatsApp Order Confirmation flow
 *
 * Requires:  KLAVIYO_API_KEY in .env  (Settings > Account > API Keys > Private key)
 */

import 'dotenv/config';
import fetch from 'node-fetch';

const KEY = process.env.KLAVIYO_API_KEY;
const WA_LIST_ID = 'StG72P';   // "WhatsApp Subscribers"
const STORE = 'TipTop360';
const WA_NUMBER = process.env.WHATSAPP_NUMBER || '971585156033';

if (!KEY) {
  console.error('❌  KLAVIYO_API_KEY missing from .env');
  process.exit(1);
}

const headers = {
  'accept': 'application/json',
  'content-type': 'application/json',
  'Authorization': `Klaviyo-API-Key ${KEY}`,
  'revision': '2025-01-15',
};

async function kv(method, path, body) {
  const res = await fetch(`https://a.klaviyo.com/api/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`  Klaviyo ${method} ${path} → ${res.status}`);
    try { console.error(JSON.parse(text)); } catch { console.error(text); }
    return null;
  }
  return JSON.parse(text);
}

// ─── Flow helpers ───────────────────────────────────────────────────────────

function waMessageAction(content, delay = null) {
  const action = {
    type: 'flow-action',
    attributes: {
      actionType: 'SEND_MESSAGE',
      settings: {
        channel: 'WHATSAPP',
        fromPhoneNumber: `+${WA_NUMBER}`,
        name: content.name,
      },
      renderOptions: {},
      tracking: { utm: {} },
    },
  };
  return delay ? { ...action, waitDelay: delay } : action;
}

function timeDelayAction(hours) {
  return {
    type: 'flow-action',
    attributes: {
      actionType: 'DELAY',
      settings: { delay: { type: 'STATIC', unit: 'hours', value: hours } },
    },
  };
}

// ─── 1. WhatsApp Welcome Flow ────────────────────────────────────────────────

async function createWelcomeFlow() {
  console.log('\n📱  Creating WhatsApp Welcome Flow…');

  const flow = await kv('POST', 'flows/', {
    data: {
      type: 'flow',
      attributes: {
        name: 'WhatsApp Welcome - TT360',
        status: 'draft',
        triggerType: 'Added to List',
      },
      relationships: {
        list: { data: { type: 'list', id: WA_LIST_ID } },
      },
    },
  });

  if (!flow?.data?.id) { console.log('  ⚠️  Could not create flow (WhatsApp channel not yet connected — run OAuth script first)'); return null; }
  const fid = flow.data.id;
  console.log(`  ✅  Flow created: ${fid}`);

  // Message 1 — immediate welcome
  await kv('POST', 'flow-actions/', {
    data: {
      type: 'flow-action',
      attributes: {
        actionType: 'SEND_MESSAGE',
        settings: {
          channel: 'WHATSAPP',
          name: 'WA Welcome #1 — Hello',
          fromPhoneNumber: `+${WA_NUMBER}`,
          message: {
            body: `👋 Ahlan wa sahlan! You're now connected with *${STORE}*.\n\nWe'll send you exclusive deals, restock alerts & order updates right here on WhatsApp.\n\nReply *HELP* anytime or *STOP* to opt out. 🦷✨`,
          },
        },
      },
      relationships: { flow: { data: { type: 'flow', id: fid } } },
    },
  });

  // 1-day delay
  await kv('POST', 'flow-actions/', {
    data: {
      type: 'flow-action',
      attributes: {
        actionType: 'DELAY',
        settings: { delay: { type: 'STATIC', unit: 'days', value: 1 } },
      },
      relationships: { flow: { data: { type: 'flow', id: fid } } },
    },
  });

  // Message 2 — brand intro + best sellers
  await kv('POST', 'flow-actions/', {
    data: {
      type: 'flow-action',
      attributes: {
        actionType: 'SEND_MESSAGE',
        settings: {
          channel: 'WHATSAPP',
          name: 'WA Welcome #2 — Best Sellers',
          fromPhoneNumber: `+${WA_NUMBER}`,
          message: {
            body: `🌟 Here's what TipTop360 customers love most:\n\n• 🪥 Nano-Bristle Foam Toothpaste — #1 kids' toothbrush\n• 💪 Gym & Sports Bag — built for UAE summers\n• 🧒 Kids Dental Starter Kit — dentist-approved\n\nShop now 👉 https://tiptop360.com\n\nReply *DEALS* for your exclusive subscriber discount 🎁`,
          },
        },
      },
      relationships: { flow: { data: { type: 'flow', id: fid } } },
    },
  });

  console.log(`  ✅  Welcome flow actions added — https://www.klaviyo.com/flow/${fid}/edit`);
  return fid;
}

// ─── 2. WhatsApp Abandoned Cart Flow ─────────────────────────────────────────

async function createAbandonedCartFlow() {
  console.log('\n🛒  Creating WhatsApp Abandoned Cart Flow…');

  const flow = await kv('POST', 'flows/', {
    data: {
      type: 'flow',
      attributes: {
        name: 'WhatsApp Abandoned Cart - TT360',
        status: 'draft',
        triggerType: 'Metric',
      },
      // trigger on Started Checkout (Shopify metric Skqx6a)
      relationships: {
        metric: { data: { type: 'metric', id: 'Skqx6a' } },
      },
    },
  });

  if (!flow?.data?.id) { console.log('  ⚠️  Could not create flow'); return null; }
  const fid = flow.data.id;
  console.log(`  ✅  Flow created: ${fid}`);

  // 1-hour delay, then message
  await kv('POST', 'flow-actions/', {
    data: {
      type: 'flow-action',
      attributes: {
        actionType: 'DELAY',
        settings: { delay: { type: 'STATIC', unit: 'hours', value: 1 } },
      },
      relationships: { flow: { data: { type: 'flow', id: fid } } },
    },
  });

  await kv('POST', 'flow-actions/', {
    data: {
      type: 'flow-action',
      attributes: {
        actionType: 'SEND_MESSAGE',
        settings: {
          channel: 'WHATSAPP',
          name: 'WA Abandoned Cart #1',
          fromPhoneNumber: `+${WA_NUMBER}`,
          message: {
            body: `👀 You left something behind!\n\nYour cart at *TipTop360* is waiting for you.\n\nComplete your order now and get FREE delivery on orders over AED 150 🚀\n\n👉 https://tiptop360.com/cart\n\nReply *STOP* to unsubscribe.`,
          },
        },
      },
      relationships: { flow: { data: { type: 'flow', id: fid } } },
    },
  });

  console.log(`  ✅  Abandoned Cart flow ready — https://www.klaviyo.com/flow/${fid}/edit`);
  return fid;
}

// ─── 3. WhatsApp Order Confirmation Flow ─────────────────────────────────────

async function createOrderConfirmationFlow() {
  console.log('\n📦  Creating WhatsApp Order Confirmation Flow…');

  const flow = await kv('POST', 'flows/', {
    data: {
      type: 'flow',
      attributes: {
        name: 'WhatsApp Order Confirmation - TT360',
        status: 'draft',
        triggerType: 'Metric',
      },
      // trigger on Placed Order (Shopify metric V5vcSP)
      relationships: {
        metric: { data: { type: 'metric', id: 'V5vcSP' } },
      },
    },
  });

  if (!flow?.data?.id) { console.log('  ⚠️  Could not create flow'); return null; }
  const fid = flow.data.id;
  console.log(`  ✅  Flow created: ${fid}`);

  await kv('POST', 'flow-actions/', {
    data: {
      type: 'flow-action',
      attributes: {
        actionType: 'SEND_MESSAGE',
        settings: {
          channel: 'WHATSAPP',
          name: 'WA Order Confirmed',
          fromPhoneNumber: `+${WA_NUMBER}`,
          message: {
            body: `✅ Order confirmed, {{ person.first_name|default:"friend" }}!\n\nThank you for shopping with *TipTop360*. We're packing your order now and will send tracking details once it ships.\n\n📦 Order: {{ event.OrderId }}\n💰 Total: AED {{ event.Value }}\n\nQuestions? Just reply here. 😊\n\nReply *STOP* to unsubscribe.`,
          },
        },
      },
      relationships: { flow: { data: { type: 'flow', id: fid } } },
    },
  });

  // Shipping follow-up 2 days later
  await kv('POST', 'flow-actions/', {
    data: {
      type: 'flow-action',
      attributes: {
        actionType: 'DELAY',
        settings: { delay: { type: 'STATIC', unit: 'days', value: 2 } },
      },
      relationships: { flow: { data: { type: 'flow', id: fid } } },
    },
  });

  await kv('POST', 'flow-actions/', {
    data: {
      type: 'flow-action',
      attributes: {
        actionType: 'SEND_MESSAGE',
        settings: {
          channel: 'WHATSAPP',
          name: 'WA Post-Purchase Review Ask',
          fromPhoneNumber: `+${WA_NUMBER}`,
          message: {
            body: `💬 How's everything going, {{ person.first_name|default:"friend" }}?\n\nWe hope your *TipTop360* order arrived safely! Your feedback helps other UAE families make the right choice.\n\n⭐ Drop us a quick review: https://tiptop360.com/pages/reviews\n\nThank you! 🙏\n\nReply *STOP* to unsubscribe.`,
          },
        },
      },
      relationships: { flow: { data: { type: 'flow', id: fid } } },
    },
  });

  console.log(`  ✅  Order Confirmation flow ready — https://www.klaviyo.com/flow/${fid}/edit`);
  return fid;
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  console.log('━━━ TipTop360 Klaviyo WhatsApp Setup ━━━');
  console.log(`Account: QP294m  |  WA number: +${WA_NUMBER}`);

  const [w, ac, oc] = await Promise.all([
    createWelcomeFlow(),
    createAbandonedCartFlow(),
    createOrderConfirmationFlow(),
  ]);

  console.log('\n━━━ Summary ━━━');
  if (w)  console.log(`  Welcome flow:           https://www.klaviyo.com/flow/${w}/edit`);
  if (ac) console.log(`  Abandoned Cart flow:    https://www.klaviyo.com/flow/${ac}/edit`);
  if (oc) console.log(`  Order Confirm flow:     https://www.klaviyo.com/flow/${oc}/edit`);
  console.log('\n⚠️  All flows are in DRAFT — connect WhatsApp via OAuth first, then activate.');
  console.log('   Run:  node scripts/playwright-wa-oauth.mjs   (on your local machine)');
})();
