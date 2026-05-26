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
    const r = await fetch(url, {method:'GET', redirect:'manual', timeout:15000, headers:{'User-Agent':'Mozilla/5.0'}});
    return {url, status: r.status};
  } catch(e) {
    return {url, status: 0, error: e.message};
  }
}

(async () => {
  const t = await getToken();
  const H = {'X-Shopify-Access-Token': t};
  
  const urls = new Set();
  const prods = await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=handle`, {headers:H})).json();
  prods.products.forEach(p => urls.add(`https://tiptop360.com/products/${p.handle}`));
  const cols = await (await fetch(`https://${STORE}/admin/api/2024-10/custom_collections.json?limit=250&fields=handle`, {headers:H})).json();
  cols.custom_collections.forEach(c => urls.add(`https://tiptop360.com/collections/${c.handle}`));
  const pages = await (await fetch(`https://${STORE}/admin/api/2024-10/pages.json?limit=250&fields=handle,published_at`, {headers:H})).json();
  pages.pages.filter(p => p.published_at).forEach(p => urls.add(`https://tiptop360.com/pages/${p.handle}`));
  const blogs = await (await fetch(`https://${STORE}/admin/api/2024-10/blogs.json`, {headers:H})).json();
  for (const b of blogs.blogs) {
    const arts = await (await fetch(`https://${STORE}/admin/api/2024-10/blogs/${b.id}/articles.json?limit=250&fields=handle,published_at`, {headers:H})).json();
    arts.articles.filter(a => a.published_at).forEach(a => urls.add(`https://tiptop360.com/blogs/${b.handle}/${a.handle}`));
  }
  
  console.log(`Checking ${urls.size} URLs...`);
  
  const arr = [...urls];
  const results = [];
  for (let i=0; i<arr.length; i+=5) {  // 5 concurrent, slower
    const batch = arr.slice(i, i+5);
    const r = await Promise.all(batch.map(check));
    results.push(...r);
    process.stdout.write(`\r  ${Math.min(i+5, arr.length)}/${arr.length}`);
    await new Promise(r=>setTimeout(r,300));  // rate limit
  }
  console.log('\n');
  
  const byStatus = {};
  results.forEach(r => { byStatus[r.status] = (byStatus[r.status]||0)+1; });
  console.log('=== STATUS DISTRIBUTION ===');
  Object.entries(byStatus).sort().forEach(([s,c]) => console.log(`  ${s}: ${c} URLs`));
  
  console.log('\n=== NON-200 URLS ===');
  results.filter(r => r.status !== 200).slice(0,30).forEach(r => console.log(`  [${r.status}] ${r.url}`));
  
  require('fs').writeFileSync('./broken-links2-report.json', JSON.stringify(results, null, 2));
})();
