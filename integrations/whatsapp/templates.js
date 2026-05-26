/**
 * WhatsApp Message Template Builders
 *
 * IMPORTANT: Template messages (for 24h+ windows) must be pre-approved by Meta.
 * Submit templates in Meta Business Manager → WhatsApp Manager → Message Templates.
 * Template names below must match your approved template names exactly.
 *
 * Session messages (plain text/interactive) can only be sent within 24h of the
 * last customer-initiated message — no pre-approval needed.
 */

export const TEMPLATES = {
  ORDER_CONFIRMATION: 'tt360_order_confirmation',
  ABANDONED_CART:     'tt360_abandoned_cart',
  SHIPPING_UPDATE:    'tt360_shipping_update',
  WELCOME:            'tt360_welcome',
};

// ─── Template component builders ──────────────────────────────────────────────

export function orderConfirmationComponents(customerName, orderNumber, totalFormatted, trackingUrl) {
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName },
        { type: 'text', text: `#${orderNumber}` },
        { type: 'text', text: totalFormatted },
      ],
    },
    ...(trackingUrl ? [{
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: trackingUrl }],
    }] : []),
  ];
}

export function abandonedCartComponents(customerName, productName, priceFormatted, cartUrl) {
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName },
        { type: 'text', text: productName },
        { type: 'text', text: priceFormatted },
      ],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: cartUrl }],
    },
  ];
}

export function shippingUpdateComponents(customerName, orderNumber, carrier, trackingNumber, trackingUrl) {
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customerName },
        { type: 'text', text: `#${orderNumber}` },
        { type: 'text', text: carrier },
        { type: 'text', text: trackingNumber },
      ],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: trackingUrl }],
    },
  ];
}

export function welcomeComponents(customerName) {
  return [
    {
      type: 'body',
      parameters: [{ type: 'text', text: customerName }],
    },
  ];
}

// ─── Session message text (within 24h window) ─────────────────────────────────

export function autoReplyText(name) {
  const storeUrl = process.env.STORE_URL || 'https://tiptop360.com';
  return `Hi ${name || 'there'}! 👋 Thanks for reaching out to TipTop360.\n\nOur team will get back to you shortly. In the meantime:\n\n🛍️ Shop: ${storeUrl}\n📦 Track order: ${storeUrl}/account\n\nReply with:\n• *ORDER* — track your order\n• *PRODUCTS* — browse catalog\n• *HELP* — speak to our team`;
}

export function orderTrackingText(orderNumber, statusUrl) {
  return `Your order *#${orderNumber}* is on its way! 📦\n\nTrack it here: ${statusUrl}`;
}

export function productCatalogText() {
  const storeUrl = process.env.STORE_URL || 'https://tiptop360.com';
  return `Here are our top collections 🛒\n\n• Baby & Kids: ${storeUrl}/collections/baby\n• Health & Wellness: ${storeUrl}/collections/health\n• All Products: ${storeUrl}/collections/all\n\nHappy shopping! 😊`;
}
