require('dotenv').config();
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;

// Generate IndexNow key (32-char alphanumeric)
const key = require('crypto').randomBytes(16).toString('hex');
console.log('🔑 Generated IndexNow key:', key);

(async () => {
  // 1. Get OAuth token
  const auth = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await auth.json()).access_token;
  
  // 2. Create the key page in Shopify (must be served at /<key>.txt)
  console.log('\n[1] Creating verification page in Shopify...');
  
  // Method: Create a Shopify page with handle = key, content = key
  const pageRes = await fetch(`https://${STORE}/admin/api/2024-10/pages.json`, {
    method: 'POST',
    headers: {'X-Shopify-Access-Token': t, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      page: {
        title: `IndexNow ${key}`,
        handle: key,
        body_html: key,
        published: true,
        template_suffix: 'plain'
      }
    })
  });
  
  if (pageRes.ok) {
    const j = await pageRes.json();
    console.log(`  ✅ Page created: /pages/${key}`);
    console.log(`  Page ID: ${j.page.id}`);
  } else {
    console.log(`  ❌ Failed: ${await pageRes.text()}`);
  }
  
  // 3. Save key locally
  fs.writeFileSync('.indexnow-key', key);
  console.log('\n[2] Key saved to .indexnow-key');
  
  // 4. Submit homepage to Bing IndexNow
  console.log('\n[3] Submitting all key URLs to Bing/Yandex via IndexNow...');
  
  const products = (await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=handle`, {headers:{'X-Shopify-Access-Token':t}})).json()).products || [];
  const collections = (await (await fetch(`https://${STORE}/admin/api/2024-10/custom_collections.json?limit=250&fields=handle`, {headers:{'X-Shopify-Access-Token':t}})).json()).custom_collections || [];
  
  const urlsToSubmit = [
    'https://tiptop360.com/',
    'https://tiptop360.com/pages/about-tiptop360',
    'https://tiptop360.com/pages/contact-tiptop360',
    'https://tiptop360.com/pages/refund-policy',
    ...products.map(p => `https://tiptop360.com/products/${p.handle}`),
    ...collections.map(c => `https://tiptop360.com/collections/${c.handle}`)
  ];
  
  console.log(`  Total URLs to submit: ${urlsToSubmit.length}`);
  
  // Wait 30s for Shopify to publish the page
  console.log('  Waiting 30s for Shopify page to propagate...');
  await new Promise(r => setTimeout(r, 30000));
  
  // Verify key page is reachable
  const verifyRes = await fetch(`https://tiptop360.com/pages/${key}`);
  const verifyText = await verifyRes.text();
  if (!verifyText.includes(key)) {
    console.log(`  ⚠️ Key page not yet reachable. Will submit anyway — IndexNow may retry.`);
  } else {
    console.log(`  ✅ Key page verified at /pages/${key}`);
  }
  
  // Submit to Bing IndexNow API
  const submitRes = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: {'Content-Type': 'application/json; charset=utf-8'},
    body: JSON.stringify({
      host: 'tiptop360.com',
      key: key,
      keyLocation: `https://tiptop360.com/pages/${key}`,
      urlList: urlsToSubmit
    })
  });
  
  console.log(`  IndexNow API response: ${submitRes.status} ${submitRes.statusText}`);
  if (submitRes.status === 200 || submitRes.status === 202) {
    console.log(`  ✅ Submitted ${urlsToSubmit.length} URLs to IndexNow`);
    console.log('  These will be indexed by Bing within minutes to hours.');
  } else if (submitRes.status === 422) {
    console.log('  ⚠️ Key location verification failed — page not yet propagated. Wait 5 min and re-run.');
  } else {
    const body = await submitRes.text();
    console.log(`  Response body: ${body.slice(0, 200)}`);
  }
})();
