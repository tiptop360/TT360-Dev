/**
 * deploy-kids-collection.cjs
 * Deploys tt360-kids-collection section + collection.kids-collection-uae.json template
 * Target: unpublished theme 145270210675
 *
 * Usage:
 *   node deploy-kids-collection.cjs            — section only (safe, preserves theme editor saves)
 *   node deploy-kids-collection.cjs --template — also reset template JSON to defaults
 */
require('dotenv').config();
const fs    = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { fetchServerTemplate, mergeTemplate, uploadFile } = require('./deploy-utils.cjs');

const STORE        = process.env.SHOPIFY_STORE;
const THEME_ID     = 'gid://shopify/OnlineStoreTheme/145270210675';
const THEME_ID_NUM = '145270210675';
const SECTION_SRC  = '/Users/rabiharabi/tt360-landing/shopify/sections/tt360-kids-collection.liquid';

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
    'tt360-kids-collection': {
      type: 'tt360-kids-collection',
      settings: {
        ann_enable: true,
        ann_text: '🚚 Free Next Day Delivery across UAE  |  💵 Cash on Delivery  |  🔄 14-Day Returns  |  Order before 8PM',
        seo_title: 'Kids Collection UAE — Safety Certified Toys & Dental Care | TipTop360',
        seo_description: 'Shop UAE\'s top-rated kids products — drawing robots, bubble machines, U-shaped toothbrushes & more. Dubai Municipality approved. Free next-day delivery. Cash on delivery.'
      }
    }
  },
  order: ['tt360-kids-collection']
};


async function main() {
  const deployTemplate = process.argv.includes('--template');

  console.log('\n🚀 TipTop360 Kids Collection Deploy');
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

  await uploadFile(fetch, STORE, token, THEME_ID, 'sections/tt360-kids-collection.liquid', sectionContent);

  if (deployTemplate) {
    console.log('\n🔄 Fetching live template to preserve theme-editor changes…');
    const serverTemplate = await fetchServerTemplate(fetch, STORE, token, THEME_ID, 'templates/collection.kids-collection-uae.json');
    const merged = mergeTemplate(serverTemplate, TEMPLATE_JSON);
    const templateContent = JSON.stringify(merged, null, 2);
    console.log(serverTemplate
      ? '✅ Merged — editor settings preserved'
      : '⚠️  No server template found — using defaults');
    console.log(`📄 Template : ${templateContent.length.toLocaleString()} chars`);
    await uploadFile(fetch, STORE, token, THEME_ID, 'templates/collection.kids-collection-uae.json', templateContent);
  }

  console.log('\n' + '━'.repeat(50));
  console.log('✅ Deploy complete!\n');
  console.log('👉 Next steps (first deploy only):');
  console.log('   Shopify Admin → Collections → Kids Collection UAE → Theme template → collection.kids-collection-uae\n');
  console.log('👉 Preview:');
  console.log(`   https://${STORE}/collections/kids-collection-uae?preview_theme_id=${THEME_ID_NUM}`);
  console.log('');
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
