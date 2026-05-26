/**
 * WhatsApp Cloud API Client
 * Sends messages via Meta's Graph API v21.0
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import fetch from 'node-fetch';

const GRAPH_API = 'https://graph.facebook.com/v21.0';

function headers() {
  return {
    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function post(phoneNumberId, body) {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`WhatsApp API [${res.status}]: ${JSON.stringify(data.error || data)}`);
  return data;
}

export async function sendTextMessage(phoneNumberId, to, text) {
  return post(phoneNumberId, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  });
}

export async function sendTemplate(phoneNumberId, to, templateName, languageCode = 'en', components = []) {
  return post(phoneNumberId, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: templateName, language: { code: languageCode }, components },
  });
}

export async function sendInteractiveButtons(phoneNumberId, to, bodyText, buttons) {
  return post(phoneNumberId, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((btn, i) => ({
          type: 'reply',
          reply: { id: btn.id || `btn_${i}`, title: btn.title.substring(0, 20) },
        })),
      },
    },
  });
}

export async function sendImageMessage(phoneNumberId, to, imageUrl, caption = '') {
  return post(phoneNumberId, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: { link: imageUrl, caption },
  });
}

export async function markMessageRead(phoneNumberId, messageId) {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  });
  return res.ok;
}
