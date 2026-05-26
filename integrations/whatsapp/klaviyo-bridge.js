/**
 * Klaviyo ↔ WhatsApp Bridge
 * Syncs WhatsApp interactions to Klaviyo profiles and event timeline.
 * Uses Klaviyo APIs revision 2024-10-15.
 */

import fetch from 'node-fetch';

const KLAVIYO_API = 'https://a.klaviyo.com/api';
const API_REV    = '2024-10-15';

function kHeaders() {
  return {
    Authorization:  `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_API_KEY}`,
    'Content-Type': 'application/json',
    revision:       API_REV,
  };
}

function normalizePhone(phone) {
  const digits = String(phone).replace(/[^\d]/g, '');
  return digits.startsWith('+') ? phone : `+${digits}`;
}

// ─── Profile management ────────────────────────────────────────────────────────

async function findProfileByPhone(phone) {
  const encoded = encodeURIComponent(normalizePhone(phone));
  const res = await fetch(
    `${KLAVIYO_API}/profiles/?filter=equals(phone_number,"${encoded}")`,
    { headers: kHeaders() }
  );
  const data = await res.json();
  return data.data?.[0]?.id || null;
}

async function createProfile(phone, extras = {}) {
  const res = await fetch(`${KLAVIYO_API}/profiles/`, {
    method: 'POST',
    headers: kHeaders(),
    body: JSON.stringify({
      data: {
        type: 'profile',
        attributes: {
          phone_number: normalizePhone(phone),
          ...extras,
          properties: {
            WhatsApp_Number:    normalizePhone(phone),
            WhatsApp_Opted_In:  true,
            ...(extras.properties || {}),
          },
        },
      },
    }),
  });

  if (res.status === 409) {
    const body = await res.json();
    return body.errors?.[0]?.meta?.duplicate_profile_id || null;
  }

  const data = await res.json();
  return data.data?.id || null;
}

export async function getOrCreateProfile(phone, extras = {}) {
  const existing = await findProfileByPhone(phone);
  if (existing) return existing;
  return createProfile(phone, extras);
}

// ─── List subscription ─────────────────────────────────────────────────────────

export async function subscribeToList(profileId, listId) {
  if (!listId) return;
  await fetch(`${KLAVIYO_API}/lists/${listId}/relationships/profiles/`, {
    method: 'POST',
    headers: kHeaders(),
    body: JSON.stringify({ data: [{ type: 'profile', id: profileId }] }),
  });
}

// ─── Event tracking ────────────────────────────────────────────────────────────

export async function trackEvent(profileId, phone, eventName, properties = {}) {
  const res = await fetch(`${KLAVIYO_API}/events/`, {
    method: 'POST',
    headers: kHeaders(),
    body: JSON.stringify({
      data: {
        type: 'event',
        attributes: {
          properties,
          time: new Date().toISOString(),
          metric: {
            data: { type: 'metric', attributes: { name: eventName } },
          },
          profile: {
            data: {
              type: 'profile',
              id: profileId,
              attributes: { phone_number: normalizePhone(phone) },
            },
          },
        },
      },
    }),
  });
  return res.ok;
}

// ─── High-level helpers ────────────────────────────────────────────────────────

export async function handleOptIn(phone, name = null, source = 'website') {
  const [firstName, ...rest] = (name || '').split(' ');
  const profileId = await getOrCreateProfile(phone, {
    ...(firstName && { first_name: firstName }),
    ...(rest.length && { last_name: rest.join(' ') }),
    properties: { WhatsApp_Source: source, WhatsApp_Opted_In: true },
  });

  if (process.env.KLAVIYO_WHATSAPP_LIST_ID) {
    await subscribeToList(profileId, process.env.KLAVIYO_WHATSAPP_LIST_ID);
  }

  await trackEvent(profileId, phone, 'WhatsApp Opted In', {
    source,
    phone: normalizePhone(phone),
  });

  return profileId;
}

export async function handleIncomingMessage(phone, name, messageType, text = '') {
  const profileId = await getOrCreateProfile(phone, {
    ...(name && { first_name: name.split(' ')[0], last_name: name.split(' ').slice(1).join(' ') }),
  });

  await trackEvent(profileId, phone, 'WhatsApp Message Received', {
    message_type: messageType,
    contact_name: name,
    text: text.substring(0, 500),
    timestamp: new Date().toISOString(),
  });

  return profileId;
}

export async function handleOutboundMessage(phone, templateName, context = {}) {
  const profileId = await findProfileByPhone(phone);
  if (!profileId) return;
  await trackEvent(profileId, phone, 'WhatsApp Message Sent', {
    template: templateName,
    ...context,
  });
}

export async function handleButtonClick(phone, buttonId, buttonTitle) {
  const profileId = await findProfileByPhone(phone);
  if (!profileId) return;
  await trackEvent(profileId, phone, 'WhatsApp Button Clicked', {
    button_id: buttonId,
    button_title: buttonTitle,
  });
}
