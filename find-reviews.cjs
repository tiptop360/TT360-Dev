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
  // Find toothbrush product
  const list = await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?fields=id,handle&limit=250`, {headers:{'X-Shopify-Access-Token':token}})).json();
  const product = list.products.find(p => p.handle.includes('toothbrush'));
  if (!product) { console.log('No toothbrush found'); return; }
  
  const meta = await (await fetch(`https://${STORE}/admin/api/2024-10/products/${product.id}/metafields.json`, {headers:{'X-Shopify-Access-Token':token}})).json();
  console.log('Total metafields:', meta.metafields.length);
  meta.metafields.forEach(m => {
    console.log(`  ${m.namespace}.${m.key} = ${String(m.value).slice(0,60)}`);
  });
})();
