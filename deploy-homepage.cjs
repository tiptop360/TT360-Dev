/**
 * deploy-homepage.cjs
 * Deploys tt360-homepage-body section + updated index.json
 * to the unpublished theme: "Copy of TipTop360 | NEW Cloud optimized"
 * Theme ID: 145270210675
 */

require('dotenv').config();
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { fetchServerTemplate, mergeTemplate, uploadFile } = require('./deploy-utils.cjs');

const STORE        = process.env.SHOPIFY_STORE;
const THEME_ID     = 'gid://shopify/OnlineStoreTheme/145270210675';
const THEME_ID_NUM = '145270210675';
const SECTION_SRC  = '/Users/rabiharabi/tt360-landing/shopify/sections/tt360-homepage-body.liquid';

// ── AUTH ────────────────────────────────────────────────────────────────────
async function getToken() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      grant_type:    'client_credentials'
    })
  });
  const data = await r.json();
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── GRAPHQL ──────────────────────────────────────────────────────────────────
async function gql(token, query, variables = {}) {
  const r = await fetch(`https://${STORE}/admin/api/2025-01/graphql.json`, {
    method:  'POST',
    headers: {
      'Content-Type':          'application/json',
      'X-Shopify-Access-Token': token
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await r.json();
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

// ── NEW INDEX.JSON ────────────────────────────────────────────────────────────
const NEW_INDEX = {
  sections: {
    'tt360-homepage-body': {
      type:     'tt360-homepage-body',
      settings: {}
    },
    faq_accordion_DTkWqD: {
      type: 'faq-accordion',
      blocks: {
        faq_qzMBzA: { type: 'faq', settings: { faq_title: 'What is TipTop360?', faq_des: '<p><strong>TipTop360</strong> is an online store that curates smart, problem-solving products that make life easier. We search, test, and handpick only the most practical, valuable, and feel-good finds — so you don\'t have to.</p>' } },
        faq_ceReL3: { type: 'faq', settings: { faq_title: 'Why Shop With Us?', faq_des: '<p><strong>We do the digging so you don\'t have to.</strong> At TipTop360, we handpick useful, high-quality products that simplify everyday life. From kids\' toys to smart home helpers — everything we carry is tested, trusted, and delivered fast.</p>' } },
        faq_QFWXXq: { type: 'faq', settings: { faq_title: 'Where do you ship?', faq_des: '<p>We currently ship within the UAE. Next day delivery on most orders.</p>' } },
        faq_DLGzUj: { type: 'faq', settings: { faq_title: 'How long does shipping take?', faq_des: '<p>We aim for <strong>next day delivery</strong> across the UAE — 1-3 business days depending on your location.</p>' } },
        faq_fPDTKj: { type: 'faq', settings: { faq_title: 'What if my item arrives damaged?', faq_des: '<p>Contact us within 3 days of delivery with photos. We\'ll replace or refund — no hassle.</p>' } },
        faq_mJUGk3: { type: 'faq', settings: { faq_title: 'Can I speak to someone?', faq_des: '<p>Email <a href="mailto:info@tiptop360.com">info@tiptop360.com</a> or WhatsApp <a href="tel:971585156033">+971 585 156 033</a> — we usually reply within 24 hours.</p>' } }
      },
      block_order: ['faq_qzMBzA', 'faq_ceReL3', 'faq_QFWXXq', 'faq_DLGzUj', 'faq_fPDTKj', 'faq_mJUGk3'],
      settings: {
        animation: '', setwidth: 'container-fluid', bgsection: '#fff5e6',
        title: 'Most Asked Questions', des: '', 'align-heading': 'center',
        title_size: 'h5', e_first_open: false, e_reverse: true, e_small: true,
        paddingsection: '36px 0px 36px 0px', paddingmobile: '24px 0px 80px 0px',
        marginsection: '0px 0px 0px 0px', marginmobile: '0px 0px 0px 0px'
      }
    },
    '1749888171f3efd426': {
      type: '_blocks',
      blocks: {
        ai_gen_block_bced3e8_xft9DB: {
          type: 'ai_gen_block_bced3e8',
          settings: {
            enabled: true, show_status: false, preload_fonts: true,
            preload_hero_images: true, inline_critical_css: true,
            defer_javascript: true, lazy_load_images: true, cleanup_bloat: true
          },
          blocks: {}
        }
      },
      block_order: ['ai_gen_block_bced3e8_xft9DB'],
      name: 'AI Performance Optimizer',
      settings: {}
    },
    '17719113617deb9878': { type: '_blocks', settings: {} }
  },
  order: [
    'tt360-homepage-body',
    'faq_accordion_DTkWqD',
    '1749888171f3efd426',
    '17719113617deb9878'
  ]
};

// ── VALIDATE LIQUID ───────────────────────────────────────────────────────────
function validateLiquid(content) {
  const errors = [];
  const opens  = (content.match(/\{%-?\s*(if|for|unless|case)\b/g)  || []).length;
  const closes = (content.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
  if (opens !== closes) errors.push(`Unbalanced Liquid tags: ${opens} open, ${closes} close`);
  // Only count Liquid output tags {{ ... }} — not CSS/JS braces
  const liquidOutputs = (content.match(/\{\{[^}]+\}\}/g) || []).length;
  if (liquidOutputs === 0 && content.includes('all_products')) {
    errors.push('No Liquid output tags found — file may be malformed');
  }
  return errors;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 TipTop360 Homepage Deploy');
  console.log('━'.repeat(50));
  console.log(`Store  : ${STORE}`);
  console.log(`Theme  : ${THEME_ID_NUM} (Copy of NEW Cloud optimized — UNPUBLISHED)`);
  console.log('');

  // 1. Read section file
  if (!fs.existsSync(SECTION_SRC)) {
    throw new Error(`Section file not found: ${SECTION_SRC}`);
  }
  const sectionContent = fs.readFileSync(SECTION_SRC, 'utf8');
  console.log(`📄 Section file   : ${sectionContent.length.toLocaleString()} chars`);

  // 2. Validate Liquid
  const liquidErrors = validateLiquid(sectionContent);
  if (liquidErrors.length > 0) {
    console.error('❌ Liquid validation failed:');
    liquidErrors.forEach(e => console.error('   ' + e));
    process.exit(1);
  }
  console.log('✅ Liquid syntax   : OK');

  // 3. Get auth token
  console.log('\n🔐 Authenticating…');
  const token = await getToken();
  console.log('✅ Token obtained');

  // 4. Fetch server index.json and merge with defaults (server values always win)
  console.log('\n🔄 Fetching live index.json to preserve theme-editor changes…');
  const serverIndex = await fetchServerTemplate(fetch, STORE, token, THEME_ID, 'templates/index.json');
  const mergedIndex = mergeTemplate(serverIndex, NEW_INDEX);
  const indexContent = JSON.stringify(mergedIndex, null, 2);
  console.log(serverIndex
    ? `✅ Merged with server (${Object.keys(serverIndex.sections || {}).length} existing sections preserved)`
    : '⚠️  No server template found — using defaults');
  console.log(`📄 index.json      : ${indexContent.length.toLocaleString()} chars`);

  // 5. Upload files
  console.log('\n📤 Uploading files to theme…');

  // Upload section file first (larger payload)
  console.log('  → sections/tt360-homepage-body.liquid');
  await uploadFile(fetch, STORE, token, THEME_ID, 'sections/tt360-homepage-body.liquid', sectionContent);

  // Upload merged index.json
  console.log('  → templates/index.json');
  await uploadFile(fetch, STORE, token, THEME_ID, 'templates/index.json', indexContent);

  // Done
  console.log('\n' + '━'.repeat(50));
  console.log('✅ Deploy complete!\n');
  console.log('👉 Preview your changes:');
  console.log(`   https://${STORE}/?preview_theme_id=${THEME_ID_NUM}`);
  console.log('\n👉 To publish when satisfied:');
  console.log('   Shopify Admin → Online Store → Themes → "Copy of TipTop360 | NEW Cloud optimized" → Publish');
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Deploy failed:', err.message);
  process.exit(1);
});
