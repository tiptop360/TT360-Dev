require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const fs = require('fs');
const STORE = process.env.SHOPIFY_STORE;
const THEME_ID = 145031200883;

(async () => {
  // Get token
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  const HEAD = {'X-Shopify-Access-Token':t, 'Content-Type':'application/json'};
  
  console.log('🔧 FORCE-WRITE VIA REST API\n' + '='.repeat(60));
  
  // === STEP 1: Empty product-schema-extra.liquid via REST ===
  console.log('\n[1] Emptying product-schema-extra.liquid via REST API...');
  const emptyContent = `{%- comment -%} Removed 2026-04-29 — duplicate of theme native Product schema {%- endcomment -%}\n`;
  
  const r1 = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
    method: 'PUT', headers: HEAD,
    body: JSON.stringify({asset: {key: 'snippets/product-schema-extra.liquid', value: emptyContent}})
  });
  if (r1.ok) {
    console.log('  ✅ Snippet emptied (response:', r1.status, ')');
  } else {
    console.log('  ❌ Failed:', r1.status, await r1.text());
  }
  
  // === STEP 2: Get current product-template-1.liquid via REST ===
  console.log('\n[2] Fetching current product-template-1.liquid...');
  const r2 = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=sections/product-template-1.liquid`, {headers: {'X-Shopify-Access-Token':t}});
  const tplData = (await r2.json()).asset;
  let tplContent = tplData.value;
  console.log('  Current size:', tplContent.length, 'chars');
  console.log('  Has product-schema-extra render:', tplContent.includes('product-schema-extra'));
  
  // === STEP 3: Strip the render call ===
  const before = tplContent.length;
  tplContent = tplContent.replace(/\s*\{%-?\s*render\s+['"]product-schema-extra['"][^%]*-?%\}\s*/g, '\n');
  const after = tplContent.length;
  console.log('  Removed:', before - after, 'chars');
  
  if (before === after) {
    console.log('  ⚠️ No change made');
  } else {
    // Validate Liquid
    const opens = (tplContent.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
    const closes = (tplContent.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
    console.log('  Liquid balance:', opens, '/', closes);
    
    if (opens !== closes) {
      console.log('  ❌ Unbalanced — aborting');
      process.exit(1);
    }
    
    // === STEP 4: Push template back via REST ===
    console.log('\n[3] Pushing modified template via REST API...');
    const r3 = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
      method: 'PUT', headers: HEAD,
      body: JSON.stringify({asset: {key: 'sections/product-template-1.liquid', value: tplContent}})
    });
    if (r3.ok) {
      console.log('  ✅ Template pushed (response:', r3.status, ')');
    } else {
      console.log('  ❌ Failed:', r3.status, (await r3.text()).slice(0,200));
    }
  }
  
  // === STEP 5: Force theme touch (cache flush) ===
  console.log('\n[4] Force-flushing edge cache...');
  const r4 = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}.json`, {
    method:'PUT', headers: HEAD,
    body: JSON.stringify({theme:{id:THEME_ID, name:'TipTop360 | NEW Cloud optimized'}})
  });
  console.log('  Theme touched:', r4.ok ? '✅' : '❌');
  
  // === STEP 6: Wait + verify ===
  console.log('\n[5] Waiting 90s for cache flush...');
  await new Promise(res => setTimeout(res, 90000));
  
  const html = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  const productCount = (html.match(/"@type":\s*"Product"/g) || []).length;
  const liquidErrors = (html.match(/Liquid error/g) || []).length;
  
  console.log('\n=== AFTER FORCE-WRITE ===');
  console.log(`  Product @type count: ${productCount} (was 7, target: 2)`);
  console.log(`  Liquid errors: ${liquidErrors}`);
})();
