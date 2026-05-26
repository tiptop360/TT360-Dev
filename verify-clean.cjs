const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

(async () => {
  console.log('=== A. CHECK MYSHOPIFY DIRECT (bypasses Cloudflare) ===');
  const direct = await (await fetch('https://zrhgzw-xt.myshopify.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  console.log('  Size:', direct.length);
  console.log('  Product @type matches:', (direct.match(/"@type":\s*"Product"/g) || []).length);
  console.log('  AggregateRating:', (direct.match(/"@type":\s*"AggregateRating"/g) || []).length);
  console.log('  Has product-schema-extra render output:', direct.includes('storerank-product') || direct.includes('aggregateRating'));
  
  console.log('\n=== B. PARSE REAL JSON-LD BLOCKS ON DIRECT URL ===');
  const blocks = [...direct.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  console.log('  Total blocks:', blocks.length);
  let n = 0, productBlocks = 0;
  for (const b of blocks) {
    n++;
    try {
      const j = JSON.parse(b[1].trim());
      const rootType = j['@type'];
      const inGraph = j['@graph'] ? j['@graph'].map(x => x['@type']) : [];
      console.log(`  Block ${n}: root=${rootType}, graph=${JSON.stringify(inGraph)}, size=${b[1].length}`);
      if (rootType === 'Product') productBlocks++;
    } catch(e) {
      console.log(`  Block ${n}: PARSE ERROR`);
    }
  }
  console.log('  STANDALONE Product blocks:', productBlocks);
  
  console.log('\n=== C. CHECK PUBLIC tiptop360.com (Cloudflare cached) ===');
  const pub = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  const pubBlocks = [...pub.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  let pubProducts = 0;
  for (const b of pubBlocks) {
    try {
      const j = JSON.parse(b[1].trim());
      if (j['@type'] === 'Product') pubProducts++;
    } catch(e) {}
  }
  console.log('  Total blocks:', pubBlocks.length);
  console.log('  STANDALONE Product blocks:', pubProducts);
  
  console.log('\n=== D. CONCLUSION ===');
  if (productBlocks === pubProducts) {
    console.log('  → Same on both. State accurate.');
  } else {
    console.log('  → Different. Cloudflare cache lag. Direct URL is truth.');
    console.log('  → Direct URL has', productBlocks, 'real Product schemas');
    console.log('  → Public URL still serving cached version with', pubProducts);
  }
})();
