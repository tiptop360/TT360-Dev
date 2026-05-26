/**
 * TipTop360 — WhatsApp + Klaviyo + Meta Integration Runner
 *
 * Usage:
 *   node integrations/index.js setup-klaviyo   → Create Klaviyo lists & flows
 *   node integrations/index.js start-webhook   → Start WhatsApp webhook server
 *   node integrations/index.js test-send <to>  → Send a test WhatsApp message
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '../.env');
  if (!existsSync(envPath)) {
    console.error('\n❌  .env file not found — copy .env.example → .env and fill in values\n');
    process.exit(1);
  }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, ...v] = t.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}
loadEnv();

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'setup-klaviyo': {
    const { default: setupFlows } = await import('./klaviyo/setup-flows.js');
    break;
  }

  case 'start-webhook': {
    await import('./whatsapp/server.js');
    break;
  }

  case 'test-send': {
    const to = args[0];
    if (!to) {
      console.error('Usage: node integrations/index.js test-send <phone_number>');
      process.exit(1);
    }
    const { sendTextMessage } = await import('./whatsapp/client.js');
    const storeUrl = process.env.STORE_URL || 'https://tiptop360.com';
    await sendTextMessage(
      process.env.WHATSAPP_PHONE_NUMBER_ID,
      to,
      `👋 Test message from TipTop360!\n\nYour WhatsApp integration is working correctly.\n\n🛍️ ${storeUrl}`
    );
    console.log(`✅ Test message sent to ${to}`);
    break;
  }

  default: {
    console.log(`
TipTop360 Integration Runner
─────────────────────────────
Commands:
  node integrations/index.js setup-klaviyo        Create Klaviyo lists & flow stubs
  node integrations/index.js start-webhook        Start WhatsApp Cloud API webhook server
  node integrations/index.js test-send <phone>    Send a test WhatsApp message

Quick start:
  1. Fill in .env (see new variables in .env.example)
  2. node integrations/index.js setup-klaviyo
  3. node integrations/index.js start-webhook
    `);
    break;
  }
}
