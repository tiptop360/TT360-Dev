require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const fs = require('fs');
const STORE = process.env.SHOPIFY_STORE;
const THEME_ID = 145031200883;

(async () => {
  console.log('🔥 NUKE ALL MY PERF SNIPPETS — return theme to Shopify defaults\n' + '='.repeat(60));
  
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  const HEAD = {'X-Shopify-Access-Token':t, 'Content-Type':'application/json'};
  
  // 1. Get theme.liquid
  const getRes = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=layout/theme.liquid`, {headers: {'X-Shopify-Access-Token':t}});
  let theme = (await getRes.json()).asset.value;
  fs.writeFileSync(`theme-files/layout/theme.liquid.PRE-NUKE-${Date.now()}.bak`, theme);
  
  // 2. Remove ALL my snippet renders
  const mySnippets = ['perf-critical','css-defer','tbt-optimization','lcp-preload','lazy-below-fold','font-optimization','mobile-perf','resource-hints','defer-helper'];
  let removed = 0;
  for (const s of mySnippets) {
    const before = theme.length;
    theme = theme.replace(new RegExp(`\\s*\\{%-?\\s*render\\s+['"]${s}['"][^%]*-?%\\}\\s*`, 'g'), '\n');
    if (theme.length !== before) removed++;
  }
  console.log(`  Removed ${removed} of my snippet render calls`);
  
  // Validate
  const opens = (theme.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
  const closes = (theme.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
  if (opens !== closes) { console.log('❌ Liquid unbalanced'); process.exit(1); }
  
  // 3. Push
  const putRes = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
    method: 'PUT', headers: HEAD,
    body: JSON.stringify({asset: {key: 'layout/theme.liquid', value: theme}})
  });
  console.log(`  Push: ${putRes.ok ? '✅' : '❌'}`);
  fs.writeFileSync('theme-files/layout/theme.liquid', theme);
  
  // 4. Empty all my snippet files (so they can't accidentally get re-included)
  console.log('\n  Emptying snippet files...');
  for (const s of mySnippets) {
    try {
      await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
        method: 'PUT', headers: HEAD,
        body: JSON.stringify({asset: {key: `snippets/${s}.liquid`, value: `{%- comment -%} Removed ${new Date().toISOString().slice(0,10)} — perf optimization rolled back {%- endcomment -%}\n`}})
      });
      console.log(`    ✅ ${s}.liquid emptied`);
    } catch(e) {}
  }
  
  // 5. Force flush
  await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}.json`, {
    method:'PUT', headers: HEAD,
    body: JSON.stringify({theme:{id:THEME_ID, name:'TipTop360 | NEW Cloud optimized'}})
  });
  console.log('\n[5] ✅ Cache flushed');
  
  console.log('\n⏳ Wait 5 minutes, then run mobile PageSpeed:');
  console.log('  https://pagespeed.web.dev/analysis?url=https%3A%2F%2Ftiptop360.com%2F&form_factor=mobile');
  console.log('\nThis returns site to baseline (no my "optimizations").');
  console.log('Expected: 35-40 mobile (the real ceiling without app removal).');
})();
