require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

const STORE = process.env.SHOPIFY_STORE;
const CID = process.env.SHOPIFY_CLIENT_ID;
const CSECRET = process.env.SHOPIFY_CLIENT_SECRET;

async function getToken() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      client_id: CID,
      client_secret: CSECRET,
      grant_type: 'client_credentials'
    })
  });
  const d = await r.json();
  if (!d.access_token) { console.error('OAuth failed:', d); process.exit(1); }
  return d.access_token;
}

(async () => {
  const token = await getToken();
  console.log('✅ Token obtained');
  
  const res = await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,title,images`, {
    headers: {'X-Shopify-Access-Token': token}
  });
  const data = await res.json();
  
  let total = 0, missing = 0;
  const issues = [];
  for (const p of data.products || []) {
    for (const img of p.images || []) {
      total++;
      if (!img.alt || !img.alt.trim()) {
        missing++;
        issues.push({handle: p.handle, product_id: p.id, image_id: img.id, src: img.src.split('/').pop().slice(0,40), title: p.title});
      }
    }
  }
  console.log('Total:', total, 'Missing:', missing, 'Coverage:', total ? ((total-missing)/total*100).toFixed(1)+'%' : 'N/A');
  issues.slice(0,15).forEach(i => console.log(' ', i.handle, '→', i.src));
  
  require('fs').writeFileSync('./alt-issues.json', JSON.stringify(issues, null, 2));
  console.log('\nSaved', issues.length, 'issues to ./alt-issues.json');
})();
