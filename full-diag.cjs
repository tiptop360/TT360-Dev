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
  
  console.log('🔍 FULL DIAGNOSTIC\n' + '='.repeat(60));
  
  // Get all URLs to crawl
  const prods = (await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,title,body_html,images`, {headers:HEAD})).json()).products || [];
  const colls = (await (await fetch(`https://${STORE}/admin/api/2024-10/custom_collections.json?limit=250&fields=id,handle,title`, {headers:HEAD})).json()).custom_collections || [];
  const pages = (await (await fetch(`https://${STORE}/admin/api/2024-10/pages.json?limit=100&fields=id,handle,title,body_html,published_at`, {headers:HEAD})).json()).pages || [];
  
  const allUrls = [
    'https://tiptop360.com/',
    ...prods.map(p => `https://tiptop360.com/products/${p.handle}`),
    ...colls.map(c => `https://tiptop360.com/collections/${c.handle}`),
    ...pages.filter(p => p.published_at).map(p => `https://tiptop360.com/pages/${p.handle}`)
  ];
  
  console.log(`\nCrawling ${allUrls.length} URLs...\n`);
  
  const issues = {
    multipleH1: [],
    duplicateFAQPage: [],
    missingAlt: [],
    brokenImages: [],
    jsonLdErrors: [],
    inlineStyleErrors: [],
    notFound: [],
    serverError: [],
    duplicateMetaDesc: [],
    inlineScripts: [],
    multipleCanonical: []
  };
  
  let i = 0;
  for (const url of allUrls) {
    i++;
    process.stdout.write(`\r  ${i}/${allUrls.length}`);
    
    try {
      const r = await fetch(url, {redirect: 'follow'});
      if (r.status === 404) { issues.notFound.push(url); continue; }
      if (r.status >= 500) { issues.serverError.push({url, status: r.status}); continue; }
      
      const html = await r.text();
      
      // 1. Multiple H1
      const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
      if (h1Count > 1) issues.multipleH1.push({url, count: h1Count});
      
      // 2. Duplicate FAQPage schema
      const faqMatches = html.match(/"@type":\s*"FAQPage"/g) || [];
      if (faqMatches.length > 1) issues.duplicateFAQPage.push({url, count: faqMatches.length});
      
      // 3. Multiple canonical
      const canonicals = html.match(/<link rel="canonical"/g) || [];
      if (canonicals.length > 1) issues.multipleCanonical.push({url, count: canonicals.length});
      
      // 4. Missing alt on visible imgs
      const imgs = [...html.matchAll(/<img\s[^>]*>/gi)];
      let missingAltCount = 0;
      let brokenImgCount = 0;
      for (const m of imgs) {
        const tag = m[0];
        if (tag.includes('alt=""') || !tag.match(/\salt=/)) missingAltCount++;
        const srcMatch = tag.match(/src=["']([^"']+)["']/);
        if (srcMatch && !srcMatch[1].trim()) brokenImgCount++;
      }
      if (missingAltCount > 0) issues.missingAlt.push({url, count: missingAltCount, total: imgs.length});
      if (brokenImgCount > 0) issues.brokenImages.push({url, count: brokenImgCount});
      
      // 5. JSON-LD validity
      const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const block of jsonLdBlocks) {
        try { JSON.parse(block[1].trim()); }
        catch(e) { issues.jsonLdErrors.push({url, error: e.message.slice(0,80)}); }
      }
      
      // 6. Inline scripts (non-JSON-LD)
      const scripts = (html.match(/<script(?![^>]*type=["']application\/ld\+json)/gi) || []).length;
      if (scripts > 25) issues.inlineScripts.push({url, count: scripts});
      
      // 7. Duplicate meta description
      const descs = (html.match(/<meta name="description"/g) || []).length;
      if (descs > 1) issues.duplicateMetaDesc.push({url, count: descs});
      
    } catch(e) { issues.serverError.push({url, error: e.message}); }
    await new Promise(r => setTimeout(r, 200));
  }
  
  // === ALSO check Shopify products for missing alt text ===
  console.log('\n\n🖼️  Product image alt text check...');
  let productsWithMissingAlt = [];
  for (const p of prods) {
    const missing = (p.images || []).filter(img => !img.alt || !img.alt.trim());
    if (missing.length) productsWithMissingAlt.push({handle: p.handle, missing: missing.length, total: p.images.length});
  }
  
  // === REPORT ===
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 ISSUES FOUND');
  console.log('='.repeat(60));
  console.log(`\n🔴 Critical:`);
  console.log(`  Multiple H1 tags:        ${issues.multipleH1.length} pages`);
  console.log(`  Duplicate FAQPage:       ${issues.duplicateFAQPage.length} pages`);
  console.log(`  Multiple canonical:      ${issues.multipleCanonical.length} pages`);
  console.log(`  Duplicate meta desc:     ${issues.duplicateMetaDesc.length} pages`);
  console.log(`  JSON-LD errors:          ${issues.jsonLdErrors.length} blocks`);
  console.log(`  Server errors:           ${issues.serverError.length} URLs`);
  console.log(`  404 errors:              ${issues.notFound.length} URLs`);
  console.log(`\n🟡 Medium:`);
  console.log(`  Pages with missing alt:  ${issues.missingAlt.length}`);
  console.log(`  Products w/ missing alt: ${productsWithMissingAlt.length}`);
  console.log(`  Broken images:           ${issues.brokenImages.length} pages`);
  console.log(`  Heavy script pages:      ${issues.inlineScripts.length}`);
  
  if (issues.multipleH1.length) {
    console.log('\n📍 H1 issues (top 5):');
    issues.multipleH1.slice(0,5).forEach(x => console.log(`  ${x.count}x H1: ${x.url}`));
  }
  if (issues.duplicateFAQPage.length) {
    console.log('\n📍 Duplicate FAQPage (top 5):');
    issues.duplicateFAQPage.slice(0,5).forEach(x => console.log(`  ${x.count}x: ${x.url}`));
  }
  if (issues.jsonLdErrors.length) {
    console.log('\n📍 JSON-LD errors (top 3):');
    issues.jsonLdErrors.slice(0,3).forEach(x => console.log(`  ${x.url}\n    ${x.error}`));
  }
  
  fs.writeFileSync('full-diag-report.json', JSON.stringify({
    issues,
    productsWithMissingAlt,
    crawled: allUrls.length,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  console.log('\n\n📄 Full report: full-diag-report.json');
})();
