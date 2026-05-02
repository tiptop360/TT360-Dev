const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

(async () => {
  console.log('🎯 ACTUAL STATE — direct Shopify URL\n' + '='.repeat(60));
  
  const html = await (await fetch('https://zrhgzw-xt.myshopify.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  
  // Real Product schema count (parse JSON-LD blocks, not regex match)
  const blocks = [...html.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  let realProducts = 0, faqs = 0, agg = 0, org = 0;
  for (const b of blocks) {
    try {
      const j = JSON.parse(b[1].trim());
      if (j['@type'] === 'Product') realProducts++;
      if (j['@type'] === 'FAQPage') faqs++;
      if (b[1].includes('AggregateRating')) agg++;
      if (b[1].includes('"Organization"')) org++;
    } catch(e) {}
  }
  
  console.log(`HTML size: ${(html.length/1024).toFixed(1)}KB`);
  console.log(`Total JSON-LD blocks: ${blocks.length}`);
  console.log(`Real Product schemas (parsed): ${realProducts}`);
  console.log(`FAQPage: ${faqs}`);
  console.log(`AggregateRating mentions: ${agg}`);
  console.log(`Organization: ${org}`);
  
  console.log('\n=== Tracking refs ===');
  const tags = ['GT-NC6ZVVHK','G-HJ94RQ6GL5','GT-KV6885FQ','G-0H831EVB10','AW-17211943737'];
  for (const tag of tags) {
    console.log(`  ${tag}: ${(html.match(new RegExp(tag,'g')) || []).length}`);
  }
  
  console.log('\n=== App refs (real) ===');
  const apps = ['storerank','analyzely','avada','autoseo'];
  for (const a of apps) {
    console.log(`  ${a}: ${(html.match(new RegExp(a,'gi')) || []).length}`);
  }
  
  console.log('\n=== App snippet markers ===');
  const markers = [...new Set([...html.matchAll(/BEGIN app snippet:\s*([a-z-]+)/g)].map(m => m[1]))];
  console.log(`  ${markers.join(', ') || 'none'}`);
})();
