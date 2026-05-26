require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;

(async () => {
  console.log('🔍 POST-APP-REMOVAL STATE CHECK\n' + '='.repeat(60));
  
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  
  // 1. App pixels currently active
  console.log('\n[1] APP PIXELS ACTIVE');
  const pixels = await (await fetch(`https://${STORE}/admin/api/2024-10/script_tags.json`, {headers:{'X-Shopify-Access-Token':t}})).json();
  console.log(`  Script tags: ${pixels.script_tags?.length || 0}`);
  
  // 2. Live page analysis
  console.log('\n[2] LIVE PAGE LOAD');
  const start = Date.now();
  const html = await (await fetch('https://tiptop360.com/?x=' + Date.now())).text();
  const loadMs = Date.now() - start;
  console.log(`  Size: ${(html.length / 1024).toFixed(1)}KB | Server response: ${loadMs}ms`);
  
  // 3. Apps still loading via inline scripts
  console.log('\n[3] APP REFERENCES IN HTML');
  const apps = ['judge.me','klaviyo','pumper','selleasy','cartlytics','storerank','wetracked','snap','nabu','wrapin','feedon','gempages','pagefly','clarity','tiktok','facebook','meta'];
  const found = [];
  for (const a of apps) {
    const c = (html.match(new RegExp(a,'gi')) || []).length;
    if (c > 0) {
      found.push({app: a, refs: c});
      console.log(`  ${a}: ${c} refs`);
    }
  }
  console.log(`  Total apps referenced: ${found.length}`);
  
  // 4. Inline JS total (the TBT killer)
  console.log('\n[4] INLINE JS TOTAL');
  const inline = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
  const total = inline.reduce((s, m) => s + m[1].length, 0);
  console.log(`  Total: ${(total/1024).toFixed(1)}KB across ${inline.length} blocks`);
  
  // 5. Top 5 inline scripts by size
  console.log('\n[5] TOP 5 INLINE SCRIPTS NOW');
  const sorted = inline.map(m => m[1]).sort((a, b) => b.length - a.length).slice(0, 5);
  sorted.forEach((s, i) => {
    const preview = s.replace(/\s+/g, ' ').slice(0, 100);
    console.log(`  ${i+1}. ${(s.length/1024).toFixed(1)}KB | ${preview.slice(0, 80)}...`);
  });
  
  // 6. Schema state
  console.log('\n[6] SCHEMA STATE');
  const productHtml = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  const blocks = [...productHtml.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  let standaloneProducts = 0, faqs = 0, agg = 0;
  for (const b of blocks) {
    try {
      const j = JSON.parse(b[1].trim());
      if (j['@type'] === 'Product') standaloneProducts++;
      if (j['@type'] === 'FAQPage') faqs++;
      if (b[1].includes('"AggregateRating"')) agg++;
    } catch(e) {}
  }
  console.log(`  Product schemas: ${standaloneProducts} (target: 1)`);
  console.log(`  FAQPage schemas: ${faqs} (target: 1)`);
  console.log(`  AggregateRating: ${agg}`);
  
  // 7. Tracking duplicates
  console.log('\n[7] TRACKING TAGS');
  const tags = {
    'GT-NC6ZVVHK (zombie)': (html.match(/GT-NC6ZVVHK/g) || []).length,
    'G-HJ94RQ6GL5 (zombie)': (html.match(/G-HJ94RQ6GL5/g) || []).length,
    'GT-KV6885FQ (zombie)': (html.match(/GT-KV6885FQ/g) || []).length,
    'G-0H831EVB10 (G&YT keep)': (html.match(/G-0H831EVB10/g) || []).length,
    'AW-17211943737 (G&YT keep)': (html.match(/AW-17211943737/g) || []).length
  };
  Object.entries(tags).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
  
  // 8. App snippet leftovers
  console.log('\n[8] APP SNIPPET MARKERS');
  const markers = [...new Set([...productHtml.matchAll(/BEGIN app snippet:\s*([a-z-]+)/g)].map(m => m[1]))];
  console.log(`  ${markers.length}: ${markers.join(', ') || 'none'}`);
})();
