require('dotenv').config();
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;
const THEME_ID = 145031200883;

(async () => {
  console.log('🎯 MASTER DIAGNOSTIC — single source of truth\n' + '='.repeat(70));
  
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  const HEAD = {'X-Shopify-Access-Token': t};
  
  // ============================================
  // SECTION 1: APPS REGISTERED IN SHOPIFY
  // ============================================
  console.log('\n[1] INSTALLED APP DATA');
  const scriptTags = await (await fetch(`https://${STORE}/admin/api/2024-10/script_tags.json`, {headers: HEAD})).json();
  console.log(`  Script tags via REST: ${scriptTags.script_tags?.length || 0}`);
  
  // Check theme files for app installation markers
  const themeRes = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=config/settings_data.json`, {headers: HEAD});
  const settings = (await themeRes.json()).asset?.value || '{}';
  const appReferences = (settings.match(/storerank|analyzely|avada|gempages|pagefly|judge\.me|judgeme/gi) || []);
  console.log(`  App refs in settings_data.json: ${appReferences.length} (${[...new Set(appReferences.map(a => a.toLowerCase()))].join(', ')})`);
  
  // ============================================
  // SECTION 2: WEB PIXELS via STOREFRONT API (read-only via JSON-LD)
  // ============================================
  console.log('\n[2] WEB PIXELS REGISTERED (extracted from HTML)');
  const homeHtml = await (await fetch('https://zrhgzw-xt.myshopify.com/?x=' + Date.now())).text();
  const pixelsConfig = homeHtml.match(/webPixelsConfigList:\s*\[([\s\S]*?)\](?:,|\s*\})/);
  if (pixelsConfig) {
    // Extract pixel IDs
    const ids = [...pixelsConfig[1].matchAll(/"id":"(\d+)"/g)].map(m => m[1]);
    const uniqueIds = [...new Set(ids)];
    console.log(`  Unique pixel IDs registered: ${uniqueIds.length}`);
    uniqueIds.forEach(id => {
      // Extract config for this ID
      const match = pixelsConfig[1].match(new RegExp(`"id":"${id}"[^}]+`, 's'));
      if (match) {
        const tagIds = [...match[0].matchAll(/G[T-]-?[A-Z0-9]{8,}|GTM-[A-Z0-9]+|AW-[0-9]+|UA-[0-9-]+/g)].map(m => m[0]);
        console.log(`    ID ${id}: ${tagIds.length ? 'tags=[' + [...new Set(tagIds)].join(', ') + ']' : 'no Google tags'}`);
      }
    });
  } else {
    console.log('  No webPixelsConfigList found in HTML');
  }
  
  // ============================================
  // SECTION 3: HTML CHARACTERISTICS (homepage + product)
  // ============================================
  console.log('\n[3] HTML CHARACTERISTICS');
  const productHtml = await (await fetch('https://zrhgzw-xt.myshopify.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  
  // Parse all JSON-LD blocks accurately
  const blocks = [...productHtml.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  let parsed = [];
  for (const b of blocks) {
    try {
      const j = JSON.parse(b[1].trim());
      parsed.push({
        size: b[1].length,
        rootType: j['@type'],
        graph: j['@graph'] ? j['@graph'].map(x => x['@type']) : [],
        hasAggregate: b[1].includes('AggregateRating'),
        position: b.index,
        contextBefore: productHtml.slice(Math.max(0, b.index - 100), b.index).replace(/\s+/g, ' ').slice(-100)
      });
    } catch(e) {}
  }
  
  console.log(`  Total JSON-LD blocks: ${parsed.length}`);
  parsed.forEach((p, i) => {
    console.log(`  Block ${i+1}: type=${p.rootType}, graph=[${p.graph.join(',')}], size=${p.size}b, ctx="...${p.contextBefore.slice(-60)}"`);
  });
  
  // ============================================
  // SECTION 4: APP MARKERS IN HTML
  // ============================================
  console.log('\n[4] APP SNIPPET MARKERS');
  const markers = [...new Set([...productHtml.matchAll(/BEGIN app snippet:\s*([a-z-]+)/g)].map(m => m[1]))];
  console.log(`  Markers: ${markers.join(', ') || 'none'}`);
  for (const m of markers) {
    const startIdx = productHtml.indexOf(`BEGIN app snippet: ${m}`);
    const endIdx = productHtml.indexOf(`END app snippet: ${m}`, startIdx);
    const size = (endIdx > startIdx) ? endIdx - startIdx : 0;
    console.log(`    ${m}: ~${size} bytes`);
  }
  
  // ============================================
  // SECTION 5: TRACKING TAG OCCURRENCES (with context)
  // ============================================
  console.log('\n[5] TRACKING TAGS WITH SOURCE');
  const tags = ['GT-NC6ZVVHK','G-HJ94RQ6GL5','GT-KV6885FQ','G-0H831EVB10','AW-17211943737'];
  for (const tag of tags) {
    const occurrences = [...productHtml.matchAll(new RegExp(tag, 'g'))];
    if (occurrences.length === 0) { console.log(`  ${tag}: 0`); continue; }
    
    // Get unique contexts
    const contexts = new Set();
    for (const m of occurrences) {
      const before = productHtml.slice(Math.max(0, m.index - 80), m.index).replace(/\s+/g, ' ').slice(-60);
      contexts.add(before);
    }
    console.log(`  ${tag}: ${occurrences.length} occurrences, ${contexts.size} unique sources`);
    [...contexts].slice(0, 3).forEach(c => console.log(`    ctx: "...${c}"`));
  }
  
  // ============================================
  // SECTION 6: PERFORMANCE METRICS
  // ============================================
  console.log('\n[6] PERFORMANCE');
  const t1 = Date.now();
  await fetch('https://zrhgzw-xt.myshopify.com/?x=' + Date.now());
  const ttfb = Date.now() - t1;
  console.log(`  TTFB (direct): ${ttfb}ms`);
  
  const inline = [...homeHtml.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
  const inlineTotal = inline.reduce((s, m) => s + m[1].length, 0);
  console.log(`  Inline JS total: ${(inlineTotal/1024).toFixed(1)}KB across ${inline.length} blocks`);
  console.log(`  HTML size: ${(homeHtml.length/1024).toFixed(1)}KB`);
  
  // ============================================
  // SECTION 7: DECISION MATRIX
  // ============================================
  console.log('\n' + '='.repeat(70));
  console.log('🎯 DECISION MATRIX — what is actually fixable');
  console.log('='.repeat(70));
  
  const issues = [];
  
  if (parsed.filter(p => p.rootType === 'Product').length > 1) {
    const productBlocks = parsed.filter(p => p.rootType === 'Product');
    const inAppSnippet = productBlocks.find(p => p.contextBefore.includes('app snippet'));
    issues.push({
      severity: 'HIGH',
      issue: 'Duplicate Product schema',
      count: productBlocks.length,
      fixable: inAppSnippet ? 'NO — app-layer injection (need to identify + disable in Admin)' : 'YES — theme code',
      action: inAppSnippet ? 'Manual: disable schema in Shopify pixel app settings' : 'Code: empty product-schema-extra.liquid'
    });
  }
  
  const zombieCount = ['GT-NC6ZVVHK','G-HJ94RQ6GL5','GT-KV6885FQ'].filter(t => productHtml.includes(t)).length;
  if (zombieCount > 0) {
    issues.push({
      severity: 'MEDIUM',
      issue: 'Zombie tracking tags',
      count: zombieCount,
      fixable: 'NO from code — pixel manager injection',
      action: 'Manual: Settings → Customer events → delete pixel containing these tags'
    });
  }
  
  if (parsed.filter(p => p.hasAggregate).length === 0) {
    issues.push({
      severity: 'LOW',
      issue: 'AggregateRating missing',
      count: 0,
      fixable: 'YES — Judge.me native should inject. Check Judge.me settings → "Enable Schema" toggle',
      action: 'Manual: Judge.me app → Settings → Toggle "Inject Schema" ON'
    });
  }
  
  if (inlineTotal > 80*1024) {
    issues.push({
      severity: 'MEDIUM',
      issue: `Inline JS bloat (${(inlineTotal/1024).toFixed(1)}KB)`,
      count: inline.length,
      fixable: 'PARTIAL — heavy hitters are app-injected, not theme',
      action: 'Already deferred via tbt-optimization.liquid. Further gains require app removal.'
    });
  }
  
  if (issues.length === 0) {
    console.log('\n✅ No code-fixable issues remaining.');
  } else {
    console.log(`\n${issues.length} issues identified:\n`);
    issues.forEach((iss, i) => {
      console.log(`${i+1}. [${iss.severity}] ${iss.issue}`);
      console.log(`   Fixable: ${iss.fixable}`);
      console.log(`   Action: ${iss.action}\n`);
    });
  }
  
  // Save full report
  fs.writeFileSync('master-diag-report.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    htmlBlocks: parsed,
    appMarkers: markers,
    inlineJsTotal: inlineTotal,
    inlineJsBlocks: inline.length,
    htmlSize: homeHtml.length,
    issues
  }, null, 2));
  
  console.log('📄 Full report: master-diag-report.json');
})();
