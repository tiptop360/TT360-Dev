require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const fs = require('fs');
const STORE = process.env.SHOPIFY_STORE;
const THEME_ID = 145031200883;

(async () => {
  console.log('🎯 ATOMIC FIX — remove zombie GA4 + heal markdown corruption\n' + '='.repeat(60));
  
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  const HEAD = {'X-Shopify-Access-Token':t, 'Content-Type':'application/json'};
  
  // STEP 1: Get live theme.liquid via REST (bypass CLI sync issues)
  console.log('\n[1] Fetching live theme.liquid via REST...');
  const getRes = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=layout/theme.liquid`, {headers: {'X-Shopify-Access-Token':t}});
  const data = (await getRes.json()).asset;
  let content = data.value;
  console.log(`  Live size: ${content.length} bytes`);
  
  // Backup local
  fs.writeFileSync(`theme-files/layout/theme.liquid.PRE-FINAL-FIX-${Date.now()}.bak`, content);
  
  // STEP 2: Remove ONLY the G-HJ94RQ6GL5 line
  console.log('\n[2] Removing zombie G-HJ94RQ6GL5 config line...');
  const before = content.length;
  
  // Match the entire line including indent + newline
  content = content.replace(/^\s*gtag\(['"]config['"],\s*['"]G-HJ94RQ6GL5['"]\);\s*\n/gm, '');
  // Fallback (in case it's not at line start)
  content = content.replace(/\s*gtag\(['"]config['"],\s*['"]G-HJ94RQ6GL5['"]\);\s*/g, '');
  
  console.log(`  Removed ${before - content.length} chars`);
  console.log(`  G-HJ94RQ6GL5 references remaining: ${(content.match(/G-HJ94RQ6GL5/g) || []).length}`);
  
  // STEP 3: Heal markdown corruption [identifier](http://identifier) → identifier
  console.log('\n[3] Healing markdown corruption...');
  const before2 = content.length;
  content = content.replace(/\[([a-z_][a-z0-9_.]*)\]\(http:\/\/[a-z_][a-z0-9_.]*\)/g, '$1');
  console.log(`  Healed ${before2 - content.length} chars of corruption`);
  
  // Validate Liquid balance
  const opens = (content.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
  const closes = (content.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
  console.log(`  Liquid balance: ${opens}/${closes} ${opens === closes ? '✅' : '❌'}`);
  
  if (opens !== closes) {
    console.log('  ABORTING — would break Liquid');
    process.exit(1);
  }
  
  // Verify required tags still present
  const stillHasWrapper = content.includes("gtag('config', 'GT-NC6ZVVHK')");
  const stillHasAds = content.includes("gtag('config', 'AW-17211943737')");
  console.log(`  GT-NC6ZVVHK config kept: ${stillHasWrapper ? '✅' : '❌ BROKEN'}`);
  console.log(`  AW-17211943737 config kept: ${stillHasAds ? '✅' : '❌ BROKEN'}`);
  
  if (!stillHasWrapper || !stillHasAds) {
    console.log('  ABORTING — would break tracking');
    process.exit(1);
  }
  
  // STEP 4: Push via REST API
  console.log('\n[4] Pushing fixed theme.liquid via REST API...');
  const putRes = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
    method: 'PUT', headers: HEAD,
    body: JSON.stringify({asset: {key: 'layout/theme.liquid', value: content}})
  });
  console.log(`  Status: ${putRes.status} ${putRes.ok ? '✅' : '❌'}`);
  
  if (!putRes.ok) {
    console.log(`  Response: ${await putRes.text()}`);
    process.exit(1);
  }
  
  // Update local copy too
  fs.writeFileSync('theme-files/layout/theme.liquid', content);
  console.log('  Local copy synced');
  
  // STEP 5: Force cache flush
  console.log('\n[5] Force-flushing edge cache...');
  await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}.json`, {
    method:'PUT', headers: HEAD,
    body: JSON.stringify({theme:{id:THEME_ID, name:'TipTop360 | NEW Cloud optimized'}})
  });
  console.log('  ✅ Done');
  
  // STEP 6: Wait + verify
  console.log('\n[6] Waiting 60s for cache propagation...');
  await new Promise(res => setTimeout(res, 60000));
  
  const html = await (await fetch('https://zrhgzw-xt.myshopify.com/?x=' + Date.now())).text();
  const configCalls = [...html.matchAll(/gtag\(['"]config['"],\s*['"]([^'"]+)['"]/g)];
  const uniqueIds = [...new Set(configCalls.map(m => m[1]))];
  
  console.log('\n=== AFTER FIX ===');
  console.log('Active gtag(config) tags:');
  uniqueIds.forEach(id => {
    let verdict;
    if (id === 'G-HJ94RQ6GL5') verdict = '🔴 STILL PRESENT';
    else if (id === 'GT-NC6ZVVHK') verdict = '✅ wrapper (correct)';
    else if (id === 'AW-17211943737') verdict = '✅ Ads (correct)';
    else verdict = '❓ unexpected';
    console.log(`  ${id} ${verdict}`);
  });
  
  const liquidErrors = (html.match(/Liquid error/g) || []).length;
  const corruption = (html.match(/\[[a-z_]+\.[a-z_]+\]\(http:\/\/[a-z_]+/g) || []).length;
  console.log(`\nLiquid errors: ${liquidErrors}`);
  console.log(`Markdown corruption refs: ${corruption}`);
  console.log(`Site status: ${(await fetch('https://zrhgzw-xt.myshopify.com/?x=' + Date.now())).status}`);
})();
