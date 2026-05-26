/**
 * deploy-drawing-robot.cjs
 * Deploys tt360-product-body section + product.drawing-robot.json template
 * Target: unpublished theme 145270210675
 */
require('dotenv').config();
const fs   = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { fetchServerTemplate, mergeTemplate, uploadFile } = require('./deploy-utils.cjs');

const STORE        = process.env.SHOPIFY_STORE;
const THEME_ID     = 'gid://shopify/OnlineStoreTheme/145270210675';
const THEME_ID_NUM = '145270210675';
const SECTION_SRC  = '/Users/rabiharabi/tt360-landing/shopify/sections/tt360-product-body.liquid';

async function getToken() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.SHOPIFY_CLIENT_ID, client_secret: process.env.SHOPIFY_CLIENT_SECRET, grant_type: 'client_credentials' })
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(`Auth failed: ${JSON.stringify(d)}`);
  return d.access_token;
}

async function gql(token, query, variables = {}) {
  const r = await fetch(`https://${STORE}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables })
  });
  const json = await r.json();
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

const TEMPLATE_JSON = {
  sections: {
    'tt360-product-body': {
      type: 'tt360-product-body',
      blocks: {
        badge_1: { type: 'badge', settings: { text: '✅ UAE Safety Certified', style: 'green' } },
        badge_2: { type: 'badge', settings: { text: '🎨 100+ Templates', style: 'orange' } },
        badge_3: { type: 'badge', settings: { text: '📵 Screen-Free', style: 'navy' } },
        trust_1: { type: 'trust', settings: { icon: '📦', label: 'Free Next Day Delivery' } },
        trust_2: { type: 'trust', settings: { icon: '💵', label: 'Cash on Delivery' } },
        trust_3: { type: 'trust', settings: { icon: '🔄', label: '14-Day Returns' } },
        trust_4: { type: 'trust', settings: { icon: '🔒', label: 'Secure Checkout' } },
        hl_1: { type: 'highlight', settings: { icon: '🗂️', title: '100+ Drawing Templates', desc: 'Progressive difficulty — animals, objects, shapes & more. Never boring.' } },
        hl_2: { type: 'highlight', settings: { icon: '📵', title: 'Zero Screen Time Required', desc: 'No Wi-Fi, no apps, no subscriptions — just hands-on creative play.' } },
        hl_3: { type: 'highlight', settings: { icon: '🔋', title: '6+ Hour Battery · USB Rechargeable', desc: 'Charge once, play all day — no AA batteries needed.' } },
        hl_4: { type: 'highlight', settings: { icon: '🛡️', title: 'Non-Toxic · BPA-Free · Safety Certified', desc: 'UAE safety certified — non-toxic, BPA-free, safe for children from age 4.' } },
        feat_1: { type: 'feature', settings: { icon: '🗂️', title: '100+ Drawing Templates', desc: 'Progressive difficulty — never boring.' } },
        feat_2: { type: 'feature', settings: { icon: '📵', title: 'Zero Screen Time', desc: 'No Wi-Fi, no apps, no subscriptions.' } },
        feat_3: { type: 'feature', settings: { icon: '🎯', title: 'Builds Real Skills', desc: 'Fine motor, focus & artistic confidence.' } },
        feat_4: { type: 'feature', settings: { icon: '🔋', title: '6hr Rechargeable', desc: 'USB charge — no AA batteries needed.' } },
        feat_5: { type: 'feature', settings: { icon: '🛡️', title: 'UAE Safety Certified', desc: 'Non-toxic, BPA-free, independently certified.' } },
        step_1: { type: 'step', settings: { title: 'Choose a Template', desc: 'Insert paper and pick one of 100+ pre-loaded drawing cards.' } },
        step_2: { type: 'step', settings: { title: 'Robot Guides the Way', desc: 'The robot draws step-by-step outlines for your child to follow.' } },
        step_3: { type: 'step', settings: { title: 'Kids Trace & Colour', desc: 'They trace the outlines and finish with confidence.' } },
        step_4: { type: 'step', settings: { title: 'Repeat & Level Up', desc: 'New designs every time — animals, objects, shapes & more.' } },
        rev_1: { type: 'review', settings: { stars: 5, text: "My 6-year-old uses it every afternoon — it replaced 2 hours of tablet time completely. She's getting so good at drawing.", name: 'Fatima A.', location: 'Dubai · Drawing Robot', avatar_color: '#667eea', verified: true } },
        rev_2: { type: 'review', settings: { stars: 5, text: 'As a homeschooling mom this has been a lifesaver. My son stays focused for 45 minutes without me asking. Delivery was next day!', name: 'Sara K.', location: 'Abu Dhabi · Drawing Robot', avatar_color: '#f093fb', verified: true } },
        rev_3: { type: 'review', settings: { stars: 5, text: 'Got it as an Eid gift for my nephew. He absolutely loves it. Very well made, feels premium and the COD option made it so easy.', name: 'Mohammad R.', location: 'Sharjah · Drawing Robot', avatar_color: '#4facfe', verified: true } },
        faq_1: { type: 'faq', settings: { question: 'Is this drawing robot easy for young kids to use?', answer: '<p>Yes, designed for ages 4+. Children simply insert a template and follow the guided lines — no reading required. Ages 3–4 can use it with adult supervision.</p>' } },
        faq_2: { type: 'faq', settings: { question: 'Does it require Wi-Fi or apps?', answer: '<p>No Wi-Fi, no apps, no subscriptions — ever. The rechargeable battery charges via the included USB cable.</p>' } },
        faq_3: { type: 'faq', settings: { question: 'How long does the battery last?', answer: '<p>Up to 4–5 hours of continuous use. Recharges quickly so creativity never has to pause!</p>' } },
        faq_4: { type: 'faq', settings: { question: 'Can my child use regular pens or markers?', answer: '<p>Yes — the included pen works best, but most standard markers or crayons are compatible.</p>' } },
        faq_5: { type: 'faq', settings: { question: 'Do you deliver to Abu Dhabi, Sharjah & other emirates?', answer: '<p>Yes! Free delivery to all UAE emirates. Cash on Delivery available everywhere.</p>' } }
      },
      block_order: ['badge_1','badge_2','badge_3','trust_1','trust_2','trust_3','trust_4','hl_1','hl_2','hl_3','hl_4','feat_1','feat_2','feat_3','feat_4','feat_5','step_1','step_2','step_3','step_4','rev_1','rev_2','rev_3','faq_1','faq_2','faq_3','faq_4','faq_5'],
      settings: {
        ann_enable: true,
        ann_text: '🚚 Free Next Day Delivery across UAE &nbsp;|&nbsp; 💵 Cash on Delivery &nbsp;|&nbsp; 🔄 14-Day Returns &nbsp;|&nbsp; Order before 8PM',
        hero_badge2: '🏆 #1 in UAE',
        collection_handle: 'kids-collection-uae',
        collection_name: 'Kids Collection',
        rating_value: '4.9',
        proof_lbl_rating: 'Average rating',
        review_count: '200',
        review_label: 'Verified UAE reviews',
        proof_num_delivery: 'Next Day',
        proof_lbl_shipping: 'Delivery across UAE',
        proof_lbl_free: 'Free next-day delivery',
        atc_text: 'Add to Cart',
        sticky_text: 'Add to Cart',
        bms_enable: true,
        bms_qty2: 2, bms_disc2: 5,
        bms_qty3: 3, bms_disc3: 10,
        feat_lbl: 'Why UAE Families Love It',
        feat_title: '5 Reasons Every Parent Says Yes',
        feat_sub: 'Screen-free, teacher-approved, and kids actually want to use it every day.',
        steps_lbl: 'Simple to Start',
        steps_title: 'How It Works',
        steps_sub: 'Ready in under 2 minutes — no manual needed.',
        video_enable: true,
        video_lbl: 'See It in Action',
        video_title: 'Watch the Drawing Robot in Action',
        video_sub: '100+ templates, step-by-step guidance, zero screen time.',
        video_placeholder: 'Product video coming soon — upload via Shopify Admin → Products → Media.',
        rev_lbl: 'Real UAE Parents',
        rev_title: 'What Parents Are Saying',
        rev_sub: '200+ verified reviews from UAE families.',
        faq_lbl: 'Got Questions?',
        faq_title: 'Frequently Asked Questions',
        cta_lbl: 'Limited Time Offer',
        cta_title: 'Give Your Child the Gift of Screen-Free Creativity',
        cta_sub: 'AED 299 — was AED 450. Free next-day delivery. Cash on delivery. 14-day returns.',
        cta_btn: 'Add to Cart',
        cta_trust_1: '📦 Free Next Day Delivery',
        cta_trust_2: '💵 Cash on Delivery',
        cta_trust_3: '🔄 14-Day Returns',
        cta_trust_4: '🔒 Secure Checkout',
        gift_bag_handle: 'gift-wrap-1',
        gift_bag_title: '🎁 Add Gift Box',
        gift_bag_sub: 'make it special',
        gift_bag_btn: '+ Add',
        gift_bag_price: '9'
      }
    }
  },
  order: ['tt360-product-body']
};


async function main() {
  const deployTemplate = process.argv.includes('--template');

  console.log('\n🚀 TipTop360 Drawing Robot PDP Deploy');
  console.log('━'.repeat(50));
  console.log(`Store : ${STORE}`);
  console.log(`Theme : ${THEME_ID_NUM} (unpublished)`);
  if (!deployTemplate) console.log('ℹ️  Section only — template JSON preserved (pass --template to reset)\n');
  else console.log('⚠️  Full deploy — template JSON will be reset to defaults\n');

  if (!fs.existsSync(SECTION_SRC)) throw new Error(`Section file not found: ${SECTION_SRC}`);
  const sectionContent = fs.readFileSync(SECTION_SRC, 'utf8');
  console.log(`📄 Section  : ${sectionContent.length.toLocaleString()} chars`);

  console.log('\n🔐 Authenticating…');
  const token = await getToken();
  console.log('✅ Token obtained\n📤 Uploading…\n');

  await uploadFile(fetch, STORE, token, THEME_ID, 'sections/tt360-product-body.liquid', sectionContent);

  if (deployTemplate) {
    console.log('\n🔄 Fetching live template to preserve theme-editor changes…');
    const serverTemplate = await fetchServerTemplate(fetch, STORE, token, THEME_ID, 'templates/product.drawing-robot.json');
    const merged = mergeTemplate(serverTemplate, TEMPLATE_JSON);
    const templateContent = JSON.stringify(merged, null, 2);
    console.log(serverTemplate
      ? '✅ Merged — video URL, custom copy, and editor blocks preserved'
      : '⚠️  No server template found — using defaults');
    console.log(`📄 Template : ${templateContent.length.toLocaleString()} chars`);
    await uploadFile(fetch, STORE, token, THEME_ID, 'templates/product.drawing-robot.json', templateContent);
  }

  console.log('\n' + '━'.repeat(50));
  console.log('✅ Deploy complete!\n');
  console.log('👉 Preview:');
  console.log(`   https://${STORE}/products/kids-drawing-robot?preview_theme_id=${THEME_ID_NUM}`);
  if (!deployTemplate) console.log('\n💡 To reset template defaults: node deploy-drawing-robot.cjs --template');
  console.log('');
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
