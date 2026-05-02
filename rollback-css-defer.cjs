require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;
const THEME_ID = 145031200883;

(async () => {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  const HEAD = {'X-Shopify-Access-Token':t, 'Content-Type':'application/json'};
  
  // Get theme.liquid
  const getRes = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=layout/theme.liquid`, {headers: {'X-Shopify-Access-Token':t}});
  let content = (await getRes.json()).asset.value;
  const before = content.length;
  
  // Remove all my snippet renders that may be hurting LCP
  const snippets = ['css-defer','tbt-optimization','lcp-preload','lazy-below-fold','font-optimization','mobile-perf','resource-hints'];
  for (const s of snippets) {
    content = content.replace(new RegExp(`\\s*\\{%-?\\s*render\\s+['"]${s}['"][^%]*-?%\\}\\s*`, 'g'), '\n');
  }
  
  console.log(`Removed ${before - content.length} chars of perf snippet renders`);
  
  // Validate
  const opens = (content.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
  const closes = (content.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
  if (opens !== closes) { console.log('❌ Liquid unbalanced'); process.exit(1); }
  
  // Push
  const putRes = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
    method: 'PUT', headers: HEAD,
    body: JSON.stringify({asset: {key: 'layout/theme.liquid', value: content}})
  });
  console.log('Push status:', putRes.status);
  
  // Touch theme
  await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}.json`, {
    method:'PUT', headers: HEAD,
    body: JSON.stringify({theme:{id:THEME_ID, name:'TipTop360 | NEW Cloud optimized'}})
  });
  console.log('✅ Cache flushed. Wait 5 min, then re-run PageSpeed mobile test.');
})();
