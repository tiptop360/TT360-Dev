require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;
const THEME_ID = 145031200883;

(async () => {
  console.log('🔥 FORCE CACHE FLUSH + DIRECT VS PUBLIC TEST\n' + '='.repeat(60));
  
  // Get token
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  
  // Theme touch
  await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}.json`, {
    method:'PUT', headers:{'X-Shopify-Access-Token':t,'Content-Type':'application/json'},
    body: JSON.stringify({theme:{id:THEME_ID, name:'TipTop360 | NEW Cloud optimized '}})
  });
  console.log('✅ Theme touched');
  
  // Compare DIRECT (Shopify) vs PUBLIC (Cloudflare)
  console.log('\n=== DIRECT MYSHOPIFY URL (truth) ===');
  const direct = await (await fetch('https://zrhgzw-xt.myshopify.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  
  const directProductSchemas = (direct.match(/"@type":\s*"Product"/g) || []).length;
  const directStorerank = (direct.match(/storerank/gi) || []).length;
  const directGTNC = (direct.match(/GT-NC6ZVVHK/g) || []).length;
  const directGHJ = (direct.match(/G-HJ94RQ6GL5/g) || []).length;
  const directGTKV = (direct.match(/GT-KV6885FQ/g) || []).length;
  
  console.log(`  Size: ${(direct.length/1024).toFixed(1)}KB`);
  console.log(`  Product schemas: ${directProductSchemas} (target: 1-2)`);
  console.log(`  StoreRank refs: ${directStorerank} (target: 0)`);
  console.log(`  GT-NC6ZVVHK: ${directGTNC}`);
  console.log(`  G-HJ94RQ6GL5: ${directGHJ}`);
  console.log(`  GT-KV6885FQ: ${directGTKV}`);
  
  console.log('\n=== PUBLIC tiptop360.com (Cloudflare cached) ===');
  const pub = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  
  const pubProductSchemas = (pub.match(/"@type":\s*"Product"/g) || []).length;
  const pubStorerank = (pub.match(/storerank/gi) || []).length;
  const pubGTNC = (pub.match(/GT-NC6ZVVHK/g) || []).length;
  const pubGHJ = (pub.match(/G-HJ94RQ6GL5/g) || []).length;
  const pubGTKV = (pub.match(/GT-KV6885FQ/g) || []).length;
  
  console.log(`  Size: ${(pub.length/1024).toFixed(1)}KB`);
  console.log(`  Product schemas: ${pubProductSchemas}`);
  console.log(`  StoreRank refs: ${pubStorerank}`);
  console.log(`  GT-NC6ZVVHK: ${pubGTNC}`);
  console.log(`  G-HJ94RQ6GL5: ${pubGHJ}`);
  console.log(`  GT-KV6885FQ: ${pubGTKV}`);
  
  console.log('\n=== DIAGNOSIS ===');
  if (directStorerank === 0 && pubStorerank > 0) {
    console.log('  → CONFIRMED: Cloudflare cache is the problem.');
    console.log('  → Direct URL: clean. Public URL: stale cached HTML.');
    console.log('  → Fix: Manual cache flush via Shopify Admin');
    console.log('     1. Shopify Admin → Online Store → Themes');
    console.log('     2. Active theme → Actions → Edit theme info');
    console.log('     3. Click Save (no changes needed)');
    console.log('     4. Wait 5-10 min, then re-run validator');
  } else if (directStorerank > 0) {
    console.log('  → StoreRank app still injecting. Either:');
    console.log('     a. App removal didnt complete');
    console.log('     b. App left theme files behind');
    console.log('     c. Wait 5 minutes for Shopify to fully process uninstall');
  } else {
    console.log('  → Both clean. State is good.');
  }
})();
