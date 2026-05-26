require('dotenv').config();
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;
const KEY = fs.readFileSync('.indexnow-key', 'utf8').trim();

(async () => {
  console.log('🔑 Key:', KEY);
  
  // Get token
  const auth = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await auth.json()).access_token;
  
  // Upload key as theme asset (served as plain text via CDN)
  console.log('\n[1] Uploading key as theme asset...');
  
  const assetRes = await fetch(`https://${STORE}/admin/api/2024-10/themes/145031200883/assets.json`, {
    method: 'PUT',
    headers: {'X-Shopify-Access-Token': t, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      asset: {
        key: `assets/${KEY}.txt`,
        value: KEY
      }
    })
  });
  
  if (!assetRes.ok) {
    console.log(`❌ Failed: ${await assetRes.text()}`);
    process.exit(1);
  }
  const assetData = await assetRes.json();
  console.log(`✅ Asset uploaded: ${assetData.asset.public_url}`);
  
  const keyLocation = assetData.asset.public_url;
  
  // Verify it's plain text
  await new Promise(r => setTimeout(r, 5000));
  const verifyRes = await fetch(keyLocation);
  const body = await verifyRes.text();
  console.log(`Content-Type: ${verifyRes.headers.get('content-type')}`);
  console.log(`Body: "${body.trim()}" (length: ${body.trim().length})`);
  
  if (body.trim() !== KEY) {
    console.log('⚠️ Body doesnt match key exactly');
  }
  
  // Get all URLs to submit
  console.log('\n[2] Gathering URLs...');
  const products = (await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=handle`, {headers:{'X-Shopify-Access-Token':t}})).json()).products || [];
  const collections = (await (await fetch(`https://${STORE}/admin/api/2024-10/custom_collections.json?limit=250&fields=handle`, {headers:{'X-Shopify-Access-Token':t}})).json()).custom_collections || [];
  
  const urlsToSubmit = [
    'https://tiptop360.com/',
    'https://tiptop360.com/pages/about-tiptop360',
    'https://tiptop360.com/pages/contact-tiptop360',
    'https://tiptop360.com/pages/refund-policy',
    'https://tiptop360.com/pages/gdpr-privacy-policy',
    'https://tiptop360.com/pages/tiptop360-terms-of-service',
    ...products.map(p => `https://tiptop360.com/products/${p.handle}`),
    ...collections.map(c => `https://tiptop360.com/collections/${c.handle}`)
  ];
  console.log(`Total URLs: ${urlsToSubmit.length}`);
  
  // Submit to IndexNow
  console.log('\n[3] Submitting to Bing IndexNow...');
  const submitRes = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: {'Content-Type': 'application/json; charset=utf-8'},
    body: JSON.stringify({
      host: 'tiptop360.com',
      key: KEY,
      keyLocation: keyLocation,
      urlList: urlsToSubmit
    })
  });
  
  console.log(`Status: ${submitRes.status} ${submitRes.statusText}`);
  if (submitRes.status === 200 || submitRes.status === 202) {
    console.log(`\n✅ Submitted ${urlsToSubmit.length} URLs to Bing IndexNow`);
    console.log('Bing/Yandex will index within minutes to hours.');
    console.log(`\nKey location for future submissions: ${keyLocation}`);
  } else {
    const err = await submitRes.text();
    console.log(`Response: ${err.slice(0, 300)}`);
  }
})();
