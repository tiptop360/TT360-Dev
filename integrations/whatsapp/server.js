/**
 * TipTop360 — WhatsApp Cloud API Webhook Server
 *
 * Handles:
 *   GET  /webhook/whatsapp  → Meta webhook verification
 *   POST /webhook/whatsapp  → Incoming messages & status updates
 *   POST /send/whatsapp     → Outbound trigger (called by Klaviyo / Shopify flows)
 *   POST /optin/whatsapp    → WhatsApp opt-in from the store popup
 *   GET  /health            → Health check
 *
 * Deploy to any Node.js host (Railway, Render, Fly.io, VPS) and set
 * WEBHOOK_BASE_URL to your public URL. Register that URL in Meta Business
 * Manager → WhatsApp → Configuration → Webhook URL.
 */

import express from 'express';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  sendTextMessage,
  sendTemplate,
  sendInteractiveButtons,
  markMessageRead,
} from './client.js';

import {
  autoReplyText,
  orderTrackingText,
  productCatalogText,
  TEMPLATES,
  orderConfirmationComponents,
  abandonedCartComponents,
  shippingUpdateComponents,
  welcomeComponents,
} from './templates.js';

import {
  handleOptIn,
  handleIncomingMessage,
  handleOutboundMessage,
  handleButtonClick,
} from './klaviyo-bridge.js';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

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

const PHONE_ID    = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'tt360_webhook_verify';
const API_KEY     = process.env.WEBHOOK_API_KEY;

if (!PHONE_ID) {
  console.warn('⚠️  WHATSAPP_PHONE_NUMBER_ID not set — send endpoints disabled');
}

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// ─── Webhook verification (GET) ───────────────────────────────────────────────

app.get('/webhook/whatsapp', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified by Meta');
    return res.status(200).send(challenge);
  }
  console.warn('⚠️  Webhook verification failed — check META_VERIFY_TOKEN');
  res.sendStatus(403);
});

// ─── Incoming messages (POST) ─────────────────────────────────────────────────

app.post('/webhook/whatsapp', (req, res) => {
  // Respond 200 immediately so Meta doesn't retry
  res.sendStatus(200);

  if (req.body.object !== 'whatsapp_business_account') return;

  for (const entry of req.body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      const { messages = [], statuses = [], contacts = [] } = change.value;
      const contact = contacts[0];

      messages.forEach(msg => handleMessage(msg, contact).catch(console.error));
      statuses.forEach(s   => handleStatus(s).catch(console.error));
    }
  }
});

async function handleMessage(msg, contact) {
  const from = msg.from;
  const name = contact?.profile?.name || '';
  const type = msg.type;

  await markMessageRead(PHONE_ID, msg.id).catch(() => {});
  await handleIncomingMessage(from, name, type, msg.text?.body || '');

  if (type === 'text') {
    const text = (msg.text?.body || '').toLowerCase().trim();

    if (['hi', 'hello', 'hey', 'help', 'start'].includes(text)) {
      await sendInteractiveButtons(PHONE_ID, from,
        `Hi ${name || 'there'}! 👋 Welcome to TipTop360. How can we help?`,
        [
          { id: 'track_order',   title: 'Track My Order' },
          { id: 'view_products', title: 'Browse Products' },
          { id: 'speak_agent',   title: 'Speak to Agent' },
        ]
      );
    } else if (text === 'order' || text.includes('track')) {
      const storeUrl = process.env.STORE_URL || 'https://tiptop360.com';
      await sendTextMessage(PHONE_ID, from, orderTrackingText('', `${storeUrl}/account`));
    } else if (['catalog', 'products', 'shop'].includes(text)) {
      await sendTextMessage(PHONE_ID, from, productCatalogText());
    } else {
      await sendTextMessage(PHONE_ID, from, autoReplyText(name));
    }
  } else if (type === 'interactive') {
    const btnId    = msg.interactive?.button_reply?.id;
    const btnTitle = msg.interactive?.button_reply?.title;
    const storeUrl = process.env.STORE_URL || 'https://tiptop360.com';

    await handleButtonClick(from, btnId, btnTitle);

    if (btnId === 'track_order') {
      await sendTextMessage(PHONE_ID, from, `Track your order: ${storeUrl}/account`);
    } else if (btnId === 'view_products') {
      await sendTextMessage(PHONE_ID, from, productCatalogText());
    } else if (btnId === 'speak_agent') {
      await sendTextMessage(PHONE_ID, from,
        `Our team has been notified! ⏱️ We typically respond within 1-2 hours (9am–6pm GST, Sun–Thu).`
      );
    }
  }
}

async function handleStatus(status) {
  console.log(`📊 ${status.recipient_id} → ${status.status} (msg: ${status.id})`);
}

// ─── Outbound trigger (called by Shopify/Klaviyo flows) ───────────────────────

app.post('/send/whatsapp', async (req, res) => {
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { to, type = 'text', text, template, language = 'en', components = [] } = req.body;
  if (!to) return res.status(400).json({ error: 'Missing "to"' });

  try {
    let result;
    if (type === 'template' && template) {
      result = await sendTemplate(PHONE_ID, to, template, language, components);
      await handleOutboundMessage(to, template, { type: 'template' });
    } else if (text) {
      result = await sendTextMessage(PHONE_ID, to, text);
      await handleOutboundMessage(to, 'text', { text: text.substring(0, 100) });
    } else {
      return res.status(400).json({ error: 'Provide text or template+components' });
    }
    res.json({ success: true, result });
  } catch (err) {
    console.error('Send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Opt-in endpoint (called from WhatsApp popup on the store) ────────────────

app.post('/optin/whatsapp', async (req, res) => {
  const { phone, name, source = 'website_popup' } = req.body;
  if (!phone) return res.status(400).json({ error: 'Missing phone' });

  try {
    const profileId = await handleOptIn(phone, name || '', source);

    // Send welcome template if configured
    if (PHONE_ID && process.env.WHATSAPP_SEND_WELCOME === 'true') {
      await sendTemplate(PHONE_ID, phone, TEMPLATES.WELCOME, 'en', welcomeComponents(name || 'there'))
        .catch(err => console.warn('Welcome template send failed:', err.message));
    }

    res.json({ success: true, profileId });
  } catch (err) {
    console.error('Opt-in error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Shopify order webhook → WhatsApp order confirmation ─────────────────────

app.post('/shopify/order-created', async (req, res) => {
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.sendStatus(200);

  const order = req.body;
  const phone = order.billing_address?.phone || order.shipping_address?.phone || order.phone;
  if (!phone) return;

  const customerName = `${order.billing_address?.first_name || order.customer?.first_name || ''}`.trim() || 'Customer';
  const total        = `${order.currency} ${order.total_price}`;
  const storeUrl     = process.env.STORE_URL || 'https://tiptop360.com';
  const orderUrl     = `${storeUrl}/account/orders/${order.id}`;

  await sendTemplate(
    PHONE_ID, phone,
    TEMPLATES.ORDER_CONFIRMATION, 'en',
    orderConfirmationComponents(customerName, order.order_number, total, orderUrl)
  ).catch(err => console.error('Order confirmation send failed:', err.message));

  await handleOutboundMessage(phone, TEMPLATES.ORDER_CONFIRMATION, {
    order_number: order.order_number,
    total,
  });
});

// ─── Shopify fulfillment webhook → WhatsApp shipping update ──────────────────

app.post('/shopify/fulfillment-created', async (req, res) => {
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.sendStatus(200);

  const fulfillment = req.body;
  const order       = fulfillment.order || {};
  const phone       = order.billing_address?.phone || order.shipping_address?.phone;
  if (!phone) return;

  const customerName   = `${order.billing_address?.first_name || ''}`.trim() || 'Customer';
  const carrier        = fulfillment.tracking_company || 'Courier';
  const trackingNumber = fulfillment.tracking_number || 'N/A';
  const trackingUrl    = fulfillment.tracking_url || `${process.env.STORE_URL}/account`;

  await sendTemplate(
    PHONE_ID, phone,
    TEMPLATES.SHIPPING_UPDATE, 'en',
    shippingUpdateComponents(customerName, order.order_number, carrier, trackingNumber, trackingUrl)
  ).catch(err => console.error('Shipping update send failed:', err.message));
});

// ─── Klaviyo flow trigger → abandoned cart WhatsApp ──────────────────────────

app.post('/klaviyo/abandoned-cart', async (req, res) => {
  if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { phone, customer_name, product_name, price, currency = 'AED', cart_url } = req.body;
  if (!phone) return res.status(400).json({ error: 'Missing phone' });

  try {
    const priceFormatted = `${currency} ${price}`;
    await sendTemplate(
      PHONE_ID, phone,
      TEMPLATES.ABANDONED_CART, 'en',
      abandonedCartComponents(customer_name || 'there', product_name || 'item', priceFormatted, cart_url)
    );
    await handleOutboundMessage(phone, TEMPLATES.ABANDONED_CART, { product_name, price: priceFormatted });
    res.json({ success: true });
  } catch (err) {
    console.error('Abandoned cart send failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    service:   'TipTop360 WhatsApp Webhook',
    timestamp: new Date().toISOString(),
    phone_id:  PHONE_ID ? '✅ configured' : '⚠️ missing',
    klaviyo:   process.env.KLAVIYO_PRIVATE_API_KEY ? '✅ configured' : '⚠️ missing',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.WEBHOOK_PORT || '3001', 10);
app.listen(PORT, () => {
  const base = process.env.WEBHOOK_BASE_URL || `http://localhost:${PORT}`;
  console.log(`\n🚀 TipTop360 WhatsApp Webhook Server`);
  console.log(`   Port:    ${PORT}`);
  console.log(`   Webhook: ${base}/webhook/whatsapp`);
  console.log(`   Health:  ${base}/health\n`);
});

export default app;
