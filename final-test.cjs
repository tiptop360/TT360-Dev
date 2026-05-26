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

(async () => {
  console.log('\n🧪 TIPTOP360 FINAL VALIDATION\n');
  const tests = [];
  
  const home = await (await fetch(`https://tiptop360.com/?x=${Date.now()}`)).text();
  const product = await (await fetch(`https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=${Date.now()}`)).text();
  
  tests.push(['Homepage loads', home.includes('TipTop360')]);
  tests.push(['H1 count = 1 on homepage', (home.match(/<h1\b/gi) || []).length === 1]);
  tests.push(['Referrer-Policy header', home.includes('Referrer-Policy')]);
  tests.push(['Permissions-Policy header', home.includes('Permissions-Policy')]);
  tests.push(['No malware (githubfix)', !home.includes('githubfix')]);
  tests.push(['No malware (component-3)', !home.includes('component-3.0')]);
  tests.push(['No malware (fv-loading-icon)', !home.includes('fv-loading-icon')]);
  tests.push(['No broken comment "L /snippets"', !home.includes('L /snippets')]);
  tests.push(['Product schema live', product.includes('"@type": "Product"')]);
  tests.push(['Organization schema live', product.includes('"@type": "Organization"')]);
  tests.push(['FAQPage schema live', product.includes('"@type": "FAQPage"')]);
  tests.push(['Brand schema live', product.includes('"@type": "Brand"')]);
  tests.push(['Offer schema live', product.includes('"@type": "Offer"')]);
  tests.push(['Sitemap reachable', (await fetch('https://tiptop360.com/sitemap.xml')).ok]);
  tests.push(['Robots.txt has Sitemap', (await (await fetch('https://tiptop360.com/robots.txt')).text()).includes('Sitemap')]);
  tests.push(['No Liquid errors on home', !home.includes('Liquid error')]);
  tests.push(['No Liquid errors on product', !product.includes('Liquid error')]);
  
  // Alt text
  const t = await getToken();
  const r = await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,images`, {headers:{'X-Shopify-Access-Token':t}})).json();
  let total=0, missing=0;
  for (const p of r.products||[]) for (const img of p.images||[]) { total++; if (!img.alt||!img.alt.trim()) missing++; }
  tests.push([`Alt text 100% (${total} images)`, missing === 0]);
  
  let pass=0, fail=0;
  tests.forEach(([name,ok]) => { console.log(`  ${ok?'✅':'❌'} ${name}`); ok?pass++:fail++; });
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`RESULT: ${pass}/${tests.length} passed (${Math.round(pass/tests.length*100)}%)`);
  console.log('='.repeat(50));
})();
