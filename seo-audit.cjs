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
  console.log('🔍 SEO AUDIT\n' + '='.repeat(60));
  
  // 1. Get sitemap URLs
  const sm = await (await fetch('https://tiptop360.com/sitemap.xml')).text();
  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  console.log(`\n📑 Sitemap URLs: ${urls.length}`);
  
  // 2. Check redirects
  const redirects = await (await fetch(`https://${STORE}/admin/api/2024-10/redirects.json?limit=250`, {headers:{'X-Shopify-Access-Token':t}})).json();
  console.log(`🔀 Redirects: ${redirects.redirects?.length || 0}`);
  
  // 3. Sample 30 URLs and check status (broken/404)
  console.log('\n🌐 Checking 30 random URLs for 404/broken...');
  const sample = urls.sort(() => 0.5 - Math.random()).slice(0, 30);
  const broken = [];
  for (const url of sample) {
    try {
      const r = await fetch(url, {redirect: 'manual'});
      if (r.status >= 400) broken.push({url, status: r.status});
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location');
        if (loc) {
          const r2 = await fetch(loc.startsWith('http') ? loc : `https://tiptop360.com${loc}`);
          if (r2.status >= 400) broken.push({url, status: r.status, redirectsTo: loc, finalStatus: r2.status});
        }
      }
    } catch(e) { broken.push({url, error: e.message}); }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`  Broken: ${broken.length}`);
  broken.forEach(b => console.log(`    ${b.url} → ${b.status || b.error}`));
  
  // 4. Get all products + check for SEO issues
  const prods = await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,title,body_html,published_at,images`, {headers:{'X-Shopify-Access-Token':t}})).json();
  const products = prods.products || [];
  console.log(`\n📦 Products: ${products.length}`);
  
  let issues = {
    'Missing description': 0,
    'Description < 500 chars': 0,
    'Missing alt text': 0,
    'Title > 60 chars': 0,
    'No images': 0
  };
  
  for (const p of products) {
    if (!p.body_html) issues['Missing description']++;
    else if (p.body_html.length < 500) issues['Description < 500 chars']++;
    if (p.title.length > 60) issues['Title > 60 chars']++;
    if (!p.images?.length) issues['No images']++;
    p.images?.forEach(img => { if (!img.alt) issues['Missing alt text']++; });
  }
  
  console.log('\n📊 SEO ISSUES:');
  Object.entries(issues).forEach(([k,v]) => console.log(`  ${v > 0 ? '⚠️' : '✅'} ${k}: ${v}`));
  
  // 5. Check robots.txt
  const robots = await (await fetch('https://tiptop360.com/robots.txt')).text();
  console.log('\n🤖 robots.txt:');
  console.log(`  Sitemap directive: ${robots.includes('Sitemap:') ? '✅' : '❌'}`);
  console.log(`  Disallows /admin: ${robots.includes('Disallow: /admin') ? '✅' : '❌'}`);
  
  // 6. Check key meta tags on homepage + 3 products
  console.log('\n🏷️ META TAGS CHECK:');
  const testUrls = [
    'https://tiptop360.com/',
    'https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift',
    'https://tiptop360.com/products/ai-voice-recorder',
    'https://tiptop360.com/collections/kids-collection-uae'
  ];
  for (const url of testUrls) {
    const html = await (await fetch(url)).text();
    const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1] || '';
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] || '';
    const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1] || '';
    const og = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1] || '';
    console.log(`\n  ${url.split('tiptop360.com')[1] || '/'}`);
    console.log(`    Title: ${title.length}ch ${title.length >= 30 && title.length <= 60 ? '✅' : '⚠️'}`);
    console.log(`    Description: ${desc.length}ch ${desc.length >= 120 && desc.length <= 160 ? '✅' : '⚠️'}`);
    console.log(`    Canonical: ${canonical ? '✅' : '❌'}`);
    console.log(`    OG image: ${og ? '✅' : '❌'}`);
  }
  
  // Save full report
  fs.writeFileSync('audit-report.json', JSON.stringify({broken, issues, totalUrls: urls.length, totalProducts: products.length}, null, 2));
  console.log('\n📄 Full report saved: audit-report.json');
})();
