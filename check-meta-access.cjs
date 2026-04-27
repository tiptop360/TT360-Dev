require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;

async function getToken() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({client_id: process.env.SHOPIFY_CLIENT_ID, client_secret: process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  return (await r.json()).access_token;
}

(async () => {
  const token = await getToken();
  const r = await fetch(`https://${STORE}/admin/api/2024-10/metafield_definitions.json?owner_type=PRODUCT`, {
    headers: {'X-Shopify-Access-Token': token}
  });
  const d = await r.json();
  console.log('Metafield definitions count:', (d.metafield_definitions || []).length);
  (d.metafield_definitions || []).forEach(m => {
    console.log(`  ${m.namespace}.${m.key} → storefront: ${m.access?.storefront || 'unknown'}`);
  });
})();
