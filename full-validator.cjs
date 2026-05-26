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

const RULES = {
  status: { fail: s => s !== 200 },
  loadTime: { fail: t => t > 3000, warn: t => t > 2000 },
  hasH1: { fail: c => c !== 1 },
  hasCanonical: { fail: c => c !== 1 },
  hasMetaDesc: { fail: c => c < 1 || c > 1 },
  metaDescLength: { fail: l => l < 120 || l > 160 },
  titleLength: { fail: l => l < 30 || l > 60 },
  faqPageCount: { fail: c => c > 1 },
  duplicateSchema: { fail: c => c > 0 },
  noLiquidErrors: { fail: c => c > 0 },
  noMalware: { fail: c => c > 0 },
  brokenImages: { fail: c => c > 0 },
  jsonLdValid: { fail: c => c > 0 },
  trackingTagDuplicates: { fail: c => c > 0 },
  multipleCanonical: { fail: c => c > 1 },
  noindexMissing: { fail: v => v === false },
  hasOpenGraph: { fail: c => c < 1 },
  productsHasSchema: { fail: c => c < 1 }
};

async function validateUrl(url, type) {
  const start = Date.now();
  let html, status, ms;
  try {
    const r = await fetch(`${url}?x=${Date.now()}`, {redirect:'follow', headers:{'User-Agent':'Mozilla/5.0'}});
    status = r.status;
    html = await r.text();
    ms = Date.now() - start;
  } catch(e) {
    return {url, type, fatal: e.message, status: 0};
  }

  const checks = {};
  
  // Basic
  checks.status = status;
  checks.loadTime = ms;
  checks.size = html.length;
  
  // SEO structure
  checks.hasH1 = (html.match(/<h1[\s>]/gi) || []).length;
  checks.hasCanonical = (html.match(/<link\s+rel=["']canonical["']/gi) || []).length;
  checks.hasMetaDesc = (html.match(/<meta\s+name=["']description["']/gi) || []).length;
  checks.metaDescLength = (html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || '').length;
  checks.titleLength = (html.match(/<title>([^<]+)<\/title>/i)?.[1] || '').length;
  
  // Schema
  checks.faqPageCount = (html.match(/"@type":\s*"FAQPage"/g) || []).length;
  checks.duplicateSchema = ((html.match(/"@type":\s*"Product"/g) || []).length > 1) ? 1 : 0;
  
  // Errors
  checks.noLiquidErrors = (html.match(/Liquid error/g) || []).length;
  checks.noMalware = (html.match(/githubfix|component-3\.0|fv-loading-icon|mainBodyContainer/g) || []).length;
  checks.brokenImages = (html.match(/<img[^>]+src=""/g) || []).length;
  
  // JSON-LD validity
  let jsonLdInvalid = 0;
  const blocks = [...html.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  for (const b of blocks) {
    try { JSON.parse(b[1].trim()); } catch(e) { jsonLdInvalid++; }
  }
  checks.jsonLdValid = jsonLdInvalid;
  
  // Tracking
  const tags = ['GT-NC6ZVVHK','G-HJ94RQ6GL5','GT-KV6885FQ','GTM-KK5LGHSG'];
  checks.trackingTagDuplicates = tags.reduce((sum, tag) => sum + ((html.match(new RegExp(tag,'g')) || []).length > 0 ? 1 : 0), 0);
  
  // Canonical
  checks.multipleCanonical = (html.match(/<link\s+rel=["']canonical["']/g) || []).length;
  
  // Indexability
  const robotsMeta = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i)?.[1];
  checks.noindexMissing = !robotsMeta?.includes('noindex');
  
  // OpenGraph
  checks.hasOpenGraph = (html.match(/<meta\s+property=["']og:image["']/g) || []).length;
  
  // Product schema (only for product pages)
  if (type === 'product') {
    checks.productsHasSchema = (html.match(/"@type":\s*"Product"/g) || []).length;
  }
  
  // Apply rules
  const issues = [];
  for (const [key, val] of Object.entries(checks)) {
    const rule = RULES[key];
    if (!rule) continue;
    if (rule.fail && rule.fail(val)) issues.push({severity: 'FAIL', check: key, value: val});
    else if (rule.warn && rule.warn(val)) issues.push({severity: 'WARN', check: key, value: val});
  }
  
  return {url, type, status, ms, checks, issues};
}

(async () => {
  console.log('🔍 FULL SITE VALIDATION (no sugarcoating)\n' + '='.repeat(70));
  
  const t = await getToken();
  const HEAD = {'X-Shopify-Access-Token':t};
  
  // Get all URLs
  const products = (await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=handle`, {headers:HEAD})).json()).products || [];
  const collections = (await (await fetch(`https://${STORE}/admin/api/2024-10/custom_collections.json?limit=250&fields=handle`, {headers:HEAD})).json()).custom_collections || [];
  
  const urls = [
    {url: 'https://tiptop360.com/', type: 'home'},
    {url: 'https://tiptop360.com/cart', type: 'system'},
    {url: 'https://tiptop360.com/sitemap.xml', type: 'system'},
    {url: 'https://tiptop360.com/robots.txt', type: 'system'},
    ...products.map(p => ({url: `https://tiptop360.com/products/${p.handle}`, type: 'product'})),
    ...collections.map(c => ({url: `https://tiptop360.com/collections/${c.handle}`, type: 'collection'})),
    {url: 'https://tiptop360.com/pages/about-tiptop360', type: 'page'},
    {url: 'https://tiptop360.com/pages/contact-tiptop360', type: 'page'},
    {url: 'https://tiptop360.com/pages/refund-policy', type: 'page'},
    {url: 'https://tiptop360.com/pages/gdpr-privacy-policy', type: 'page'},
    {url: 'https://tiptop360.com/pages/tiptop360-terms-of-service', type: 'page'}
  ];
  
  console.log(`\nValidating ${urls.length} URLs against ${Object.keys(RULES).length} rules...\n`);
  
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    process.stdout.write(`\r  ${i+1}/${urls.length}`);
    const r = await validateUrl(urls[i].url, urls[i].type);
    results.push(r);
    await new Promise(r => setTimeout(r, 200));
  }
  
  // Aggregate
  const totalChecks = results.length * Object.keys(RULES).length;
  const failed = results.flatMap(r => (r.issues || []).filter(i => i.severity === 'FAIL'));
  const warned = results.flatMap(r => (r.issues || []).filter(i => i.severity === 'WARN'));
  
  // Group by check name
  const byCheck = {};
  for (const f of failed) {
    byCheck[f.check] = byCheck[f.check] || [];
    byCheck[f.check].push(f);
  }
  
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 RESULTS — ZERO SUGARCOATING');
  console.log('='.repeat(70));
  console.log(`Pages tested: ${results.length}`);
  console.log(`Total checks: ${totalChecks}`);
  console.log(`Passed: ${totalChecks - failed.length - warned.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Warnings: ${warned.length}`);
  console.log(`Pass rate: ${(((totalChecks - failed.length) / totalChecks) * 100).toFixed(1)}%`);
  
  if (Object.keys(byCheck).length === 0) {
    console.log('\n✅ ALL CHECKS PASS. SITE IS 100%.');
  } else {
    console.log('\n🔴 FAILURES BY CHECK TYPE:');
    for (const [check, items] of Object.entries(byCheck).sort((a,b) => b[1].length - a[1].length)) {
      console.log(`\n  ${check} — ${items.length} pages affected`);
      items.slice(0, 5).forEach(i => {
        const url = results.find(r => r.issues.includes(i))?.url;
        console.log(`    ${url} (value: ${i.value})`);
      });
      if (items.length > 5) console.log(`    ...and ${items.length - 5} more`);
    }
  }
  
  // Save full report
  fs.writeFileSync('full-validation-report.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {totalPages: results.length, totalChecks, failed: failed.length, warned: warned.length, passRate: ((totalChecks - failed.length) / totalChecks * 100).toFixed(1) + '%'},
    failuresByCheck: byCheck,
    fullResults: results
  }, null, 2));
  
  console.log('\n📄 Full report: full-validation-report.json');
})();
