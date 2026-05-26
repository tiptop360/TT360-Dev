/**
 * Meta Graph API Setup
 *
 * Automates via Meta API (no browser needed):
 *   1. Verify WhatsApp phone number is registered
 *   2. Subscribe webhook to WhatsApp Business Account
 *   3. Submit all 4 message templates for Meta approval
 *   4. Verify Meta Pixel is accessible
 *   5. Set Meta Pixel ID as Shopify shop metafield
 *
 * Run: node integrations/meta/api-setup.js
 */

import fetch from 'node-fetch';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '../../.env');
  if (!existsSync(envPath)) {
    console.error('\n❌  .env not found\n'); process.exit(1);
  }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, ...v] = t.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}
loadEnv();

const GRAPH = 'https://graph.facebook.com/v21.0';
const WABA_ID       = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const PHONE_ID      = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN  = process.env.WHATSAPP_ACCESS_TOKEN;
const APP_ID        = process.env.META_APP_ID;
const VERIFY_TOKEN  = process.env.META_VERIFY_TOKEN || 'tt360_webhook_verify';
const WEBHOOK_URL   = process.env.WEBHOOK_BASE_URL;
const PIXEL_ID      = process.env.META_PIXEL_ID;

function metaHeaders() {
  return { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' };
}

async function metaGet(path) {
  const res = await fetch(`${GRAPH}${path}`, { headers: metaHeaders() });
  return res.json();
}

async function metaPost(path, body) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: 'POST',
    headers: metaHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Meta API [${res.status}] ${path}: ${JSON.stringify(data.error || data)}`);
  return data;
}

// ─── Shopify API helper ────────────────────────────────────────────────────────

async function shopifyPost(endpoint, body) {
  const store = process.env.SHOPIFY_STORE;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  const ver   = '2024-10';
  const res = await fetch(`https://${store}/admin/api/${ver}${endpoint}`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── 1. Verify phone number ────────────────────────────────────────────────────

async function verifyPhoneNumber() {
  console.log('\n📱 Verifying WhatsApp phone number...');
  const data = await metaGet(`/${PHONE_ID}?fields=display_phone_number,verified_name,status`);
  if (data.error) throw new Error(data.error.message);

  console.log(`   Number:  ${data.display_phone_number}`);
  console.log(`   Name:    ${data.verified_name}`);
  console.log(`   Status:  ${data.status}`);

  if (data.status !== 'CONNECTED') {
    console.warn(`   ⚠️  Phone status is "${data.status}" — messages may not send until CONNECTED`);
  } else {
    console.log('   ✅ Phone number is CONNECTED');
  }
  return data;
}

// ─── 2. Register webhook subscription ─────────────────────────────────────────

async function registerWebhook() {
  console.log('\n🔗 Registering webhook with Meta...');

  if (!WEBHOOK_URL) {
    console.warn('   ⚠️  WEBHOOK_BASE_URL not set — skipping webhook registration');
    console.warn('      Set it in .env and re-run after deploying your webhook server');
    return;
  }

  const webhookEndpoint = `${WEBHOOK_URL}/webhook/whatsapp`;

  // Subscribe the WABA to webhook
  const data = await metaPost(`/${APP_ID}/subscriptions`, {
    object:       'whatsapp_business_account',
    callback_url: webhookEndpoint,
    verify_token: VERIFY_TOKEN,
    fields:       ['messages', 'message_deliveries', 'message_reads', 'messaging_optins'],
  });

  if (data.success) {
    console.log(`   ✅ Webhook registered: ${webhookEndpoint}`);
  } else {
    console.warn('   ⚠️  Webhook registration response:', JSON.stringify(data));
  }

  // Also subscribe WABA specifically
  try {
    const wabaData = await metaPost(`/${WABA_ID}/subscribed_apps`, {});
    console.log('   ✅ WABA app subscription confirmed');
  } catch (e) {
    console.warn('   ⚠️  WABA subscription:', e.message);
  }
}

// ─── 3. Submit message templates ──────────────────────────────────────────────

const TEMPLATES = [
  {
    name: 'tt360_order_confirmation',
    category: 'TRANSACTIONAL',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Order {{1}} Confirmed! 🎉',
        example: { header_text: ['#1234'] },
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, your TipTop360 order {{2}} has been confirmed!\n\nTotal: {{3}}\n\nWe\'ll send you tracking info once your order ships. Thank you for shopping with us! 🛍️',
        example: { body_text: [['Ahmed', '#1234', 'AED 149.00']] },
      },
      {
        type: 'FOOTER',
        text: 'TipTop360 — Quality for Every Home',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Track Order',
            url: `${process.env.STORE_URL || 'https://tiptop360.com'}/account/orders/{{1}}`,
            example: ['12345678'],
          },
        ],
      },
    ],
  },
  {
    name: 'tt360_abandoned_cart',
    category: 'MARKETING',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'You left something behind! 🛒',
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, you still have *{{2}}* in your cart ({{3}}).\n\nComplete your purchase before it sells out — we only have limited stock! ⏳',
        example: { body_text: [['Ahmed', 'GymBag Pro', 'AED 89.00']] },
      },
      {
        type: 'FOOTER',
        text: 'Reply STOP to unsubscribe',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Complete Purchase',
            url: `${process.env.STORE_URL || 'https://tiptop360.com'}/cart`,
          },
        ],
      },
    ],
  },
  {
    name: 'tt360_shipping_update',
    category: 'TRANSACTIONAL',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Your order is on the way! 🚚',
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, your order *{{2}}* has been shipped!\n\nCarrier: {{3}}\nTracking: {{4}}\n\nExpected delivery: 2-5 business days.',
        example: { body_text: [['Ahmed', '#1234', 'Aramex', 'AXB123456789']] },
      },
      {
        type: 'FOOTER',
        text: 'TipTop360 — Quality for Every Home',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Track Shipment',
            url: 'https://track.aftership.com/{{1}}',
            example: ['AXB123456789'],
          },
        ],
      },
    ],
  },
  {
    name: 'tt360_welcome',
    category: 'MARKETING',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Welcome to TipTop360! 👋',
      },
      {
        type: 'BODY',
        text: 'Hi {{1}},\n\nThank you for subscribing to TipTop360 WhatsApp updates! 🎉\n\nYou\'ll receive:\n• Order confirmations & tracking\n• Exclusive deals & flash sales\n• New product arrivals\n\nUse code *WELCOME10* for 10% off your first order!',
        example: { body_text: [['Ahmed']] },
      },
      {
        type: 'FOOTER',
        text: 'Reply STOP to unsubscribe anytime',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Shop Now',
            url: process.env.STORE_URL || 'https://tiptop360.com',
          },
        ],
      },
    ],
  },
];

async function submitTemplates() {
  console.log('\n📝 Submitting WhatsApp message templates to Meta...');
  console.log('   (Templates require Meta review — usually 1-48 hours)\n');

  // Check existing templates first
  const existing = await metaGet(`/${WABA_ID}/message_templates?fields=name,status&limit=50`);
  const existingNames = new Set((existing.data || []).map(t => t.name));

  for (const template of TEMPLATES) {
    if (existingNames.has(template.name)) {
      const status = existing.data.find(t => t.name === template.name)?.status;
      console.log(`   ⏭  ${template.name} — already exists (${status})`);
      continue;
    }

    try {
      const data = await metaPost(`/${WABA_ID}/message_templates`, {
        name:       template.name,
        category:   template.category,
        language:   template.language,
        components: template.components,
      });
      console.log(`   ✅ ${template.name} — submitted (ID: ${data.id})`);
    } catch (err) {
      console.error(`   ❌ ${template.name} — ${err.message}`);
    }
  }
}

// ─── 4. Verify Meta Pixel ──────────────────────────────────────────────────────

async function verifyPixel() {
  if (!PIXEL_ID) {
    console.log('\n📊 Meta Pixel: META_PIXEL_ID not set — skipping');
    return;
  }

  console.log(`\n📊 Verifying Meta Pixel ${PIXEL_ID}...`);
  const data = await metaGet(`/${PIXEL_ID}?fields=name,code,owner_business`);
  if (data.error) {
    console.warn(`   ⚠️  Cannot access pixel: ${data.error.message}`);
    return;
  }

  console.log(`   Name:  ${data.name}`);
  console.log(`   Owner: ${data.owner_business?.name || 'N/A'}`);
  console.log('   ✅ Pixel is accessible');
}

// ─── 5. Set Pixel ID as Shopify metafield ─────────────────────────────────────

async function setShopifyMetafields() {
  console.log('\n🛍️  Setting Shopify shop metafields...');
  const store   = process.env.SHOPIFY_STORE;
  const sToken  = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!store || !sToken) {
    console.warn('   ⚠️  SHOPIFY_STORE or SHOPIFY_ACCESS_TOKEN not set — skipping');
    return;
  }

  const metafields = [];

  if (PIXEL_ID) {
    metafields.push({ namespace: 'tt360', key: 'meta_pixel_id',    value: PIXEL_ID,    type: 'single_line_text_field' });
  }
  if (process.env.WEBHOOK_BASE_URL) {
    metafields.push({ namespace: 'tt360', key: 'webhook_base_url', value: process.env.WEBHOOK_BASE_URL, type: 'single_line_text_field' });
  }

  for (const mf of metafields) {
    const result = await shopifyPost('/metafields.json', { metafield: mf });
    if (result.metafield) {
      console.log(`   ✅ Set metafield tt360.${mf.key} = ${mf.value}`);
    } else {
      console.warn(`   ⚠️  Metafield tt360.${mf.key}: ${JSON.stringify(result.errors || result)}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runMetaSetup() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   TipTop360 — Meta API Setup                 ║');
  console.log('╚══════════════════════════════════════════════╝');

  const required = { WHATSAPP_BUSINESS_ACCOUNT_ID: WABA_ID, WHATSAPP_PHONE_NUMBER_ID: PHONE_ID, WHATSAPP_ACCESS_TOKEN: ACCESS_TOKEN };
  const missing  = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`\n❌ Missing required env vars: ${missing.join(', ')}\n`);
    process.exit(1);
  }

  await verifyPhoneNumber();
  await registerWebhook();
  await submitTemplates();
  await verifyPixel();
  await setShopifyMetafields();

  console.log('\n\n✅ Meta API setup complete!');
  console.log('   Templates are under Meta review (1-48 hours).');
  console.log('   Check status: Meta Business Manager → WhatsApp Manager → Templates\n');
}

// Run directly
if (process.argv[1].endsWith('api-setup.js')) {
  runMetaSetup().catch(err => { console.error('\n❌', err.message); process.exit(1); });
}
