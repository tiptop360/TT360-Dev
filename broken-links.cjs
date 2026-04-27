require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;

async function getToken() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  return (await r.json()).access_token;
}

async function check(url) {
  try {
    const r = await fetch(url, {method:'GET', redirect:'manual', timeout:10000});
    return {url, status: r.status, redirect: r.headers.get('location')};
  } catch(e) {
    return {url, status: 0, error: e.message};
  }
}

(async () => {
  const t = await getToken();
  const H = {'X-Shopify-Access-Token': t};
  
  console.log('🔗 BROKEN LINK AUDIT\n' + '='.repeat(50));
  
  // 1. Collect all URLs to check
  const urls = new Set();
  
  // All product URLs
  const prods = await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=handle`, {headers:H})).json();
  prods.products.forEach(p => urls.add(`https://tiptop360.com/products/${p.handle}`));
  
  // All collection URLs
  const cols = await (await fetch(`https://${STORE}/admin/api/2024-10/custom_collections.json?limit=250&fields=handle`, {headers:H})).json();
  cols.custom_collections.forEach(c => urls.add(`https://tiptop360.com/collections/${c.handle}`));
  
  // All page URLs
  const pages = await (await fetch(`https://${STORE}/admin/api/2024-10/pages.json?limit=250&fields=handle,published_at`, {headers:H})).json();
  pages.pages.filter(p => p.published_at).forEach(p => urls.add(`https://tiptop360.com/pages/${p.handle}`));
  
  // All blog article URLs
  const blogs = await (await fetch(`https://${STORE}/admin/api/2024-10/blogs.json`, {headers:H})).json();
  for (const b of blogs.blogs) {
    const arts = await (await fetch(`https://${STORE}/admin/api/2024-10/blogs/${b.id}/articles.json?limit=250&fields=handle,published_at`, {headers:H})).json();
    arts.articles.filter(a => a.published_at).forEach(a => urls.add(`https://tiptop360.com/blogs/${b.handle}/${a.handle}`));
  }
  
  console.log(`Total URLs to check: ${urls.size}`);
  console.log('Testing... (this takes 1-2 min)\n');
  
  // 2. Batch-check (10 concurrent)
  const arr = [...urls];
  const results = [];
  const batchSize = 10;
  for (let i=0; i<arr.length; i+=batchSize) {
    const batch = arr.slice(i, i+batchSize);
    const r = await Promise.all(batch.map(check));
    results.push(...r);
    process.stdout.write(`\r  Checked ${Math.min(i+batchSize, arr.length)}/${arr.length}`);
  }
  console.log('\n');
  
  // 3. Report
  const broken = results.filter(r => r.status === 404 || r.status === 0 || r.status >= 500);
  const redirects = results.filter(r => r.status >= 300 && r.status < 400);
  const ok = results.filter(r => r.status === 200);
  
  console.log(`✅ OK (200): ${ok.length}`);
  console.log(`↪️  Redirects (3xx): ${redirects.length}`);
  console.log(`❌ Broken (4xx/5xx/timeout): ${broken.length}`);
  
  if (broken.length) {
    console.log('\n=== BROKEN LINKS ===');
    broken.forEach(r => console.log(`  [${r.status}] ${r.url} ${r.error || ''}`));
  }
  if (redirects.length) {
    console.log('\n=== REDIRECTS (verify intentional) ===');
    redirects.slice(0,15).forEach(r => console.log(`  [${r.status}] ${r.url} → ${r.redirect}`));
  }
  
  require('fs').writeFileSync('./broken-links-report.json', JSON.stringify({broken, redirects, ok: ok.length}, null, 2));
  console.log('\n📁 Saved full report to ./broken-links-report.json');
})();
