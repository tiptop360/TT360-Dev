require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;
const THEME_ID = 145031200883;

(async () => {
  // Get token + verify the live theme file via REST
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  
  console.log('=== A. SOURCE OF TRUTH: REST API view of live theme.liquid ===');
  const getRes = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=layout/theme.liquid`, {headers: {'X-Shopify-Access-Token':t}});
  const liveFile = (await getRes.json()).asset.value;
  const inFile = (liveFile.match(/G-HJ94RQ6GL5/g) || []).length;
  console.log(`  G-HJ94RQ6GL5 in theme.liquid via REST: ${inFile} ${inFile === 0 ? '✅ removed' : '🔴 still present'}`);
  
  if (inFile > 0) {
    const idx = liveFile.indexOf('G-HJ94RQ6GL5');
    console.log('  Context:');
    console.log(liveFile.slice(Math.max(0, idx - 100), idx + 100));
  }
  
  console.log('\n=== B. LIVE HTML vs DIRECT URL ===');
  const direct = await (await fetch('https://zrhgzw-xt.myshopify.com/?x=' + Date.now())).text();
  const directHas = (direct.match(/G-HJ94RQ6GL5/g) || []).length;
  console.log(`  Direct (zrhgzw-xt.myshopify.com): ${directHas} occurrences`);
  
  const pub = await (await fetch('https://tiptop360.com/?x=' + Date.now())).text();
  const pubHas = (pub.match(/G-HJ94RQ6GL5/g) || []).length;
  console.log(`  Public (tiptop360.com): ${pubHas} occurrences`);
  
  console.log('\n=== C. WHAT FIRES IT ===');
  const occurrences = [...direct.matchAll(/G-HJ94RQ6GL5/g)];
  occurrences.forEach((m, i) => {
    const ctx = direct.slice(Math.max(0, m.index - 80), m.index + 50).replace(/\s+/g, ' ');
    console.log(`  ${i+1}: ...${ctx}`);
  });
  
  console.log('\n=== D. TIME-OF-DAY (cache age) ===');
  const cacheRes = await fetch('https://zrhgzw-xt.myshopify.com/');
  const etag = cacheRes.headers.get('etag');
  console.log(`  ETag: ${etag}`);
  console.log(`  cf-cache-status: ${cacheRes.headers.get('cf-cache-status')}`);
  console.log(`  age: ${cacheRes.headers.get('age')}`);
})();
