require('dotenv').config();
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;

async function getToken() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  return (await r.json()).access_token;
}

(async () => {
  const t = await getToken();
  const HEAD = {'X-Shopify-Access-Token':t, 'Content-Type':'application/json'};
  
  console.log('🔧 SEO AUTO-FIX\n' + '='.repeat(60));
  
  // ============================================
  // PART 1: AUDIT TITLE TAGS (all products + collections)
  // ============================================
  console.log('\n[1] Auditing title tags...\n');
  
  const prods = (await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,title`, {headers:HEAD})).json()).products || [];
  const colls = (await (await fetch(`https://${STORE}/admin/api/2024-10/custom_collections.json?limit=250&fields=id,handle,title`, {headers:HEAD})).json()).custom_collections || [];
  
  // Get current SEO titles via metafields
  const longTitles = [];
  for (const p of prods) {
    const mf = await (await fetch(`https://${STORE}/admin/api/2024-10/products/${p.id}/metafields.json?namespace=global&key=title_tag`, {headers:HEAD})).json();
    const seoTitle = mf.metafields?.[0]?.value || p.title;
    if (seoTitle.length > 60) longTitles.push({type:'product', id: p.id, handle: p.handle, current: seoTitle, len: seoTitle.length, mfId: mf.metafields?.[0]?.id});
    await new Promise(r => setTimeout(r, 150));
  }
  
  for (const c of colls) {
    const mf = await (await fetch(`https://${STORE}/admin/api/2024-10/collections/${c.id}/metafields.json?namespace=global&key=title_tag`, {headers:HEAD})).json();
    const seoTitle = mf.metafields?.[0]?.value || c.title;
    if (seoTitle.length > 60) longTitles.push({type:'collection', id: c.id, handle: c.handle, current: seoTitle, len: seoTitle.length, mfId: mf.metafields?.[0]?.id});
    await new Promise(r => setTimeout(r, 150));
  }
  
  console.log(`Found ${longTitles.length} titles > 60 chars\n`);
  longTitles.slice(0, 20).forEach(t => console.log(`  [${t.len}ch] ${t.current}`));
  
  // ============================================
  // PART 2: GENERATE OPTIMIZED TITLES via Anthropic
  // ============================================
  if (longTitles.length > 0) {
    console.log('\n[2] Generating optimized titles via Claude Haiku...\n');
    
    const Anthropic = require('@anthropic-ai/sdk').default;
    const claude = new Anthropic();
    
    const systemPrompt = `You are an e-commerce SEO expert for TipTop360 (UAE kids/family store, tiptop360.com). You shorten title tags to be 30-60 chars while keeping primary keyword + "TipTop360". Return ONLY the new title. No quotes, no explanation. Optimize for click-through.`;
    
    for (const item of longTitles) {
      const r = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        temperature: 0,
        system: [{type:'text', text: systemPrompt, cache_control:{type:'ephemeral'}}],
        messages: [{role:'user', content: `Shorten this ${item.type} title to 30-60 chars. Keep primary keyword + brand. Current (${item.len} chars): "${item.current}"`}]
      });
      const newTitle = r.content[0].text.trim().replace(/^["']|["']$/g, '');
      
      if (newTitle.length > 60) {
        console.log(`  ⚠️ ${item.handle}: AI returned ${newTitle.length}ch, skipping`);
        continue;
      }
      if (newTitle.length < 30) {
        console.log(`  ⚠️ ${item.handle}: AI returned ${newTitle.length}ch (too short), skipping`);
        continue;
      }
      
      item.newTitle = newTitle;
      console.log(`  ✓ ${item.handle}`);
      console.log(`    OLD (${item.len}): ${item.current}`);
      console.log(`    NEW (${newTitle.length}): ${newTitle}`);
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // ============================================
    // PART 3: APPLY via Shopify API
    // ============================================
    console.log('\n[3] Applying titles to Shopify...\n');
    
    const toApply = longTitles.filter(t => t.newTitle);
    let applied = 0;
    
    for (const item of toApply) {
      const ownerType = item.type === 'product' ? 'products' : 'collections';
      const url = item.mfId
        ? `https://${STORE}/admin/api/2024-10/${ownerType}/${item.id}/metafields/${item.mfId}.json`
        : `https://${STORE}/admin/api/2024-10/${ownerType}/${item.id}/metafields.json`;
      const method = item.mfId ? 'PUT' : 'POST';
      const body = item.mfId
        ? {metafield: {id: item.mfId, value: item.newTitle, type: 'single_line_text_field'}}
        : {metafield: {namespace:'global', key:'title_tag', value: item.newTitle, type:'single_line_text_field'}};
      
      const r = await fetch(url, {method, headers:HEAD, body: JSON.stringify(body)});
      if (r.ok) { applied++; console.log(`  ✓ ${item.handle}`); }
      else console.log(`  ✗ ${item.handle}: ${r.status}`);
      await new Promise(r => setTimeout(r, 600));
    }
    console.log(`\nApplied: ${applied}/${toApply.length}`);
  }
  
  // ============================================
  // PART 4: REDIRECT CHAIN AUDIT
  // ============================================
  console.log('\n[4] Auditing 218 redirects for chains/loops...\n');
  
  const redirects = (await (await fetch(`https://${STORE}/admin/api/2024-10/redirects.json?limit=250`, {headers:HEAD})).json()).redirects || [];
  const map = {};
  redirects.forEach(r => { map[r.path] = r.target; });
  
  const chains = [];
  for (const r of redirects) {
    let target = r.target;
    let hops = 0;
    while (map[target] && hops < 5) {
      target = map[target];
      hops++;
    }
    if (hops > 0) chains.push({from: r.path, to: r.target, finalTo: target, hops});
  }
  
  console.log(`Redirect chains found: ${chains.length}`);
  chains.slice(0, 10).forEach(c => console.log(`  ${c.from} → ${c.to} → ... → ${c.finalTo} (${c.hops} hops)`));
  
  if (chains.length > 0) {
    console.log('\n  Auto-flattening chains...');
    let fixed = 0;
    for (const c of chains) {
      const r = redirects.find(x => x.path === c.from);
      const upd = await fetch(`https://${STORE}/admin/api/2024-10/redirects/${r.id}.json`, {
        method:'PUT', headers:HEAD,
        body: JSON.stringify({redirect: {id: r.id, path: c.from, target: c.finalTo}})
      });
      if (upd.ok) fixed++;
      await new Promise(r => setTimeout(r, 400));
    }
    console.log(`  ✓ Flattened ${fixed}/${chains.length} chains`);
  }
  
  // ============================================
  // PART 5: FULL BROKEN LINK SWEEP
  // ============================================
  console.log('\n[5] Full broken-link sweep (all products + collections + key pages)...\n');
  
  const allUrls = [
    'https://tiptop360.com/',
    'https://tiptop360.com/cart',
    'https://tiptop360.com/pages/about-tiptop360',
    'https://tiptop360.com/pages/contact-us',
    'https://tiptop360.com/pages/shipping-policy',
    'https://tiptop360.com/pages/refund-policy',
    'https://tiptop360.com/pages/privacy-policy',
    'https://tiptop360.com/pages/terms-of-service',
    'https://tiptop360.com/blogs/news',
    ...prods.map(p => `https://tiptop360.com/products/${p.handle}`),
    ...colls.map(c => `https://tiptop360.com/collections/${c.handle}`)
  ];
  
  const broken404 = [];
  let i = 0;
  for (const url of allUrls) {
    i++;
    process.stdout.write(`\r  Checking ${i}/${allUrls.length}...`);
    try {
      const r = await fetch(url, {redirect: 'follow'});
      if (r.status === 404 || r.status >= 500) broken404.push({url, status: r.status});
    } catch(e) { broken404.push({url, error: e.message}); }
    await new Promise(r => setTimeout(r, 250));
  }
  console.log(`\n  Broken (404/5xx): ${broken404.length}`);
  broken404.forEach(b => console.log(`    ${b.url} → ${b.status || b.error}`));
  
  // ============================================
  // SAVE REPORT
  // ============================================
  fs.writeFileSync('seo-fix-report.json', JSON.stringify({
    longTitlesFixed: longTitles.filter(t=>t.newTitle).length,
    redirectChainsFixed: chains.length,
    broken404Found: broken404.length,
    broken404,
    chains
  }, null, 2));
  
  console.log('\n✅ Done. Report: seo-fix-report.json');
})();
