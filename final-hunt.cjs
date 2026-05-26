require('dotenv').config();
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;

(async () => {
  console.log('FINAL HUNT for G-HJ94RQ6GL5\n' + '='.repeat(50));
  
  // 1. Theme files grep
  console.log('\n[1] Theme files containing G-HJ94RQ6GL5:');
  const { execSync } = require('child_process');
  try {
    const out = execSync('grep -rln "G-HJ94RQ6GL5" theme-files/ 2>/dev/null | grep -v ".bak"').toString().trim();
    console.log(out || '  (none found)');
  } catch (e) {
    console.log('  (none found)');
  }
  
  // 2. Live HTML context
  console.log('\n[2] Exact HTML location:');
  const html = await (await fetch('https://zrhgzw-xt.myshopify.com/?x=' + Date.now())).text();
  let pos = 0, n = 0;
  while ((pos = html.indexOf('G-HJ94RQ6GL5', pos)) !== -1 && n < 3) {
    n++;
    console.log('\nOccurrence ' + n + ' at byte ' + pos + ':');
    console.log(html.slice(Math.max(0, pos - 250), pos + 100));
    console.log('---');
    pos += 12;
  }
  if (n === 0) console.log('  Not in HTML — already gone!');
  
  // 3. Delete GroPulse metafield
  console.log('\n[3] GroPulse metafield cleanup:');
  const r = await fetch('https://' + STORE + '/admin/oauth/access_token', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  const m = await (await fetch('https://' + STORE + '/admin/api/2024-10/metafields.json?limit=250', {headers:{'X-Shopify-Access-Token':t}})).json();
  const targets = (m.metafields || []).filter(mf => mf.namespace.includes('gropulse') || mf.key.includes('gropulse'));
  console.log('  Found GroPulse metafields:', targets.length);
  for (const mf of targets) {
    const del = await fetch('https://' + STORE + '/admin/api/2024-10/metafields/' + mf.id + '.json', {
      method:'DELETE', headers:{'X-Shopify-Access-Token':t}
    });
    console.log('  ' + mf.namespace + '.' + mf.key + ' (id ' + mf.id + '): ' + (del.ok ? 'DELETED' : 'FAILED'));
  }
  
  // 4. Wait + retest runtime
  console.log('\n[4] Waiting 30s then retesting runtime tags...');
  await new Promise(res => setTimeout(res, 30000));
  
  const html2 = await (await fetch('https://zrhgzw-xt.myshopify.com/?x=' + Date.now())).text();
  const configCalls = [...html2.matchAll(/gtag\(['"]config['"],\s*['"]([^'"]+)['"]/g)];
  const uniqueIds = [...new Set(configCalls.map(m => m[1]))];
  console.log('Active gtag(config) tags after cleanup:');
  uniqueIds.forEach(id => console.log('  ' + id));
})();
