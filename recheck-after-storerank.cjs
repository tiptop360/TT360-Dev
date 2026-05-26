require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;

(async () => {
  console.log('🔍 STATE AFTER STORERANK.AI REMOVAL\n' + '='.repeat(60));
  
  console.log('\n[1] LIVE PAGE');
  const start = Date.now();
  const html = await (await fetch('https://tiptop360.com/?x=' + Date.now())).text();
  console.log(`  Size: ${(html.length/1024).toFixed(1)}KB | Server: ${Date.now() - start}ms`);
  
  console.log('\n[2] APP REFS REMAINING');
  const apps = ['judge','klaviyo','pumper','selleasy','storerank','snap','nabu','wrapin','clarity','tiktok','facebook','meta'];
  for (const a of apps) {
    const c = (html.match(new RegExp(a,'gi')) || []).length;
    if (c > 0) console.log(`  ${a}: ${c}`);
  }
  
  console.log('\n[3] INLINE JS TOTAL');
  const inline = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
  const total = inline.reduce((s, m) => s + m[1].length, 0);
  console.log(`  Total: ${(total/1024).toFixed(1)}KB / ${inline.length} blocks (was 105.9KB / 37 blocks)`);
  
  console.log('\n[4] PRODUCT PAGE — schema state');
  const productHtml = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  const blocks = [...productHtml.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  let products = 0, faqs = 0, agg = 0, org = 0;
  for (const b of blocks) {
    try {
      const j = JSON.parse(b[1].trim());
      if (j['@type'] === 'Product') products++;
      if (j['@type'] === 'FAQPage') faqs++;
      if (j['@graph']) {
        for (const g of j['@graph']) {
          if (g['@type'] === 'Organization') org++;
        }
      }
      if (b[1].includes('AggregateRating')) agg++;
    } catch(e) {}
  }
  console.log(`  Total JSON-LD blocks: ${blocks.length}`);
  console.log(`  Product schemas: ${products} (target: 1)`);
  console.log(`  FAQPage: ${faqs} (target: 1)`);
  console.log(`  AggregateRating: ${agg}`);
  console.log(`  Organization: ${org}`);
  
  console.log('\n[5] APP SNIPPET MARKERS REMAINING');
  const markers = [...new Set([...productHtml.matchAll(/BEGIN app snippet:\s*([a-z-]+)/g)].map(m => m[1]))];
  console.log(`  ${markers.join(', ') || 'none'}`);
  
  console.log('\n[6] STORERANK REFS IN HTML');
  const sr = (productHtml.match(/storerank/gi) || []).length;
  console.log(`  ${sr} (target: 0 after cache flush)`);
  
  console.log('\n[7] TRACKING ZOMBIES');
  const zombies = ['GT-NC6ZVVHK','G-HJ94RQ6GL5','GT-KV6885FQ'];
  for (const z of zombies) {
    const c = (html.match(new RegExp(z,'g')) || []).length;
    console.log(`  ${z}: ${c}`);
  }
})();
