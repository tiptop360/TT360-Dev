/**
 * Klaviyo WhatsApp Flows Setup
 *
 * Run: node integrations/klaviyo/setup-flows.js
 *
 * Creates:
 *  1. "WhatsApp Subscribers" list
 *  2. WhatsApp Abandoned Cart flow (triggered by Shopify "Checkout Started")
 *  3. WhatsApp Welcome flow (triggered by WhatsApp opt-in list membership)
 *  4. WhatsApp Order Confirmation flow (triggered by "Placed Order")
 *
 * IMPORTANT: WhatsApp channel in Klaviyo must be connected first:
 *   Klaviyo Dashboard → Settings → WhatsApp → Connect WABA
 */

import fetch from 'node-fetch';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '../../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, ...v] = t.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}
loadEnv();

const KLAVIYO_API = 'https://a.klaviyo.com/api';
const API_REV    = '2024-10-15';

function kHeaders() {
  return {
    Authorization:  `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_API_KEY}`,
    'Content-Type': 'application/json',
    revision:       API_REV,
  };
}

async function kPost(path, body) {
  const res = await fetch(`${KLAVIYO_API}${path}`, {
    method: 'POST',
    headers: kHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok && res.status !== 409) {
    throw new Error(`Klaviyo API [${res.status}] ${path}: ${JSON.stringify(data.errors?.[0] || data)}`);
  }
  return data;
}

async function kGet(path) {
  const res = await fetch(`${KLAVIYO_API}${path}`, { headers: kHeaders() });
  return res.json();
}

// ─── 1. Create WhatsApp Subscribers list ─────────────────────────────────────

async function createWhatsAppList() {
  console.log('\n📋 Creating "WhatsApp Subscribers" list...');
  const data = await kPost('/lists/', {
    data: {
      type: 'list',
      attributes: { name: 'WhatsApp Subscribers' },
    },
  });
  const listId = data.data?.id;
  if (listId) {
    console.log(`   ✅ List created: ${listId}`);
    console.log(`   👉 Add KLAVIYO_WHATSAPP_LIST_ID=${listId} to your .env`);
  } else if (data.errors?.[0]?.code === 'duplicate') {
    console.log('   ℹ️  List already exists — fetching ID...');
    const lists = await kGet('/lists/?filter=equals(name,"WhatsApp Subscribers")');
    const existing = lists.data?.[0]?.id;
    console.log(`   ✅ Existing list ID: ${existing}`);
    return existing;
  }
  return listId;
}

// ─── 2. Get metric IDs (needed for flow triggers) ────────────────────────────

async function getMetricId(name) {
  const data = await kGet(`/metrics/`);
  const metric = data.data?.find(m => m.attributes.name === name);
  return metric?.id || null;
}

// ─── 3. Create Abandoned Cart flow ───────────────────────────────────────────

async function createAbandonedCartFlow(webhookUrl) {
  console.log('\n🛒 Creating WhatsApp Abandoned Cart flow...');

  const checkoutMetricId = await getMetricId('Started Checkout');
  if (!checkoutMetricId) {
    console.warn('   ⚠️  "Started Checkout" metric not found — make sure Shopify is connected to Klaviyo');
  }

  const flowBody = {
    data: {
      type: 'flow',
      attributes: {
        name: 'WhatsApp Abandoned Cart Recovery',
        status: 'draft',
        trigger_type: 'metric',
      },
      relationships: checkoutMetricId ? {
        metric: { data: { type: 'metric', id: checkoutMetricId } },
      } : {},
    },
  };

  const data = await kPost('/flows/', flowBody);
  const flowId = data.data?.id;
  console.log(`   ✅ Flow created (ID: ${flowId}) — status: draft`);
  console.log(`   👉 Open Klaviyo → Flows → "WhatsApp Abandoned Cart Recovery"`);
  console.log(`      Add a 1-hour delay, then a Webhook action pointing to:`);
  console.log(`      POST ${webhookUrl || process.env.WEBHOOK_BASE_URL + '/klaviyo/abandoned-cart'}`);
  console.log(`      with payload: { phone, customer_name, product_name, price, cart_url }`);
  return flowId;
}

// ─── 4. Create Welcome flow ───────────────────────────────────────────────────

async function createWelcomeFlow(listId) {
  console.log('\n👋 Creating WhatsApp Welcome flow...');

  const flowBody = {
    data: {
      type: 'flow',
      attributes: {
        name: 'WhatsApp Welcome Series',
        status: 'draft',
        trigger_type: 'list',
      },
      relationships: listId ? {
        list: { data: { type: 'list', id: listId } },
      } : {},
    },
  };

  const data = await kPost('/flows/', flowBody);
  const flowId = data.data?.id;
  console.log(`   ✅ Flow created (ID: ${flowId}) — status: draft`);
  console.log(`   👉 Open Klaviyo → Flows → "WhatsApp Welcome Series"`);
  console.log(`      Add a WhatsApp action using the "tt360_welcome" template`);
  return flowId;
}

// ─── 5. Create Order Confirmation flow ───────────────────────────────────────

async function createOrderConfirmationFlow() {
  console.log('\n📦 Creating WhatsApp Order Confirmation flow...');

  const orderMetricId = await getMetricId('Placed Order');
  if (!orderMetricId) {
    console.warn('   ⚠️  "Placed Order" metric not found — make sure Shopify is connected');
  }

  const flowBody = {
    data: {
      type: 'flow',
      attributes: {
        name: 'WhatsApp Order Confirmation',
        status: 'draft',
        trigger_type: 'metric',
      },
      relationships: orderMetricId ? {
        metric: { data: { type: 'metric', id: orderMetricId } },
      } : {},
    },
  };

  const data = await kPost('/flows/', flowBody);
  const flowId = data.data?.id;
  console.log(`   ✅ Flow created (ID: ${flowId}) — status: draft`);
  console.log(`   👉 Open Klaviyo → Flows → "WhatsApp Order Confirmation"`);
  console.log(`      Add a WhatsApp action using the "tt360_order_confirmation" template`);
  return flowId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runKlaviyoSetup() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   TipTop360 — Klaviyo WhatsApp Setup         ║');
  console.log('╚══════════════════════════════════════════════╝');

  if (!process.env.KLAVIYO_PRIVATE_API_KEY) {
    console.error('\n❌  KLAVIYO_PRIVATE_API_KEY is not set in .env\n');
    process.exit(1);
  }

  const webhookBase = process.env.WEBHOOK_BASE_URL || 'https://YOUR_WEBHOOK_URL';

  const listId = await createWhatsAppList();
  await createAbandonedCartFlow(webhookBase + '/klaviyo/abandoned-cart');
  await createWelcomeFlow(listId);
  await createOrderConfirmationFlow();

  console.log('\n\n✅ Klaviyo setup complete!');
  console.log('\nNext steps:');
  console.log('  1. Connect WhatsApp Business Account in Klaviyo:');
  console.log('     Klaviyo → Settings → WhatsApp → Connect');
  console.log('  2. Set KLAVIYO_WHATSAPP_LIST_ID in .env (ID printed above)');
  console.log('  3. Submit Meta message templates for approval:');
  console.log('     tt360_order_confirmation, tt360_abandoned_cart,');
  console.log('     tt360_shipping_update, tt360_welcome');
  console.log('  4. Activate flows in Klaviyo after connecting WhatsApp channel');
  console.log('  5. Deploy the webhook server (integrations/whatsapp/server.js)\n');
}

// Run directly
if (process.argv[1].endsWith('setup-flows.js')) {
  runKlaviyoSetup().catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
}
