const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

(async () => {
  console.log('🔍 SITEMAP AUDIT\n' + '='.repeat(60));
  
  // 1. Sitemap reachability + structure
  console.log('\n[1] SITEMAP STRUCTURE');
  const r = await fetch('https://tiptop360.com/sitemap.xml');
  console.log(`  Status: ${r.status}`);
  console.log(`  Content-Type: ${r.headers.get('content-type')}`);
  console.log(`  Cache-Control: ${r.headers.get('cache-control')}`);
  console.log(`  X-Robots-Tag: ${r.headers.get('x-robots-tag') || '(none — good)'}`);
  
  const sm = await r.text();
  console.log(`  Size: ${sm.length} bytes`);
  console.log(`  Type: ${sm.includes('<sitemapindex') ? 'Sitemap Index' : sm.includes('<urlset') ? 'URL Set' : 'Unknown'}`);
  
  // 2. Child sitemaps
  const childSitemaps = [...sm.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/g)].map(m => m[1]);
  const urls = [...sm.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/url>/g)].map(m => m[1]);
  console.log(`  Child sitemaps: ${childSitemaps.length}`);
  console.log(`  Direct URLs: ${urls.length}`);
  
  if (childSitemaps.length) {
    console.log('\n[2] CHILD SITEMAPS');
    for (const cs of childSitemaps) {
      const cr = await fetch(cs);
      const text = await cr.text();
      const cnt = (text.match(/<url>/g) || []).length;
      console.log(`  ${cs.split('tiptop360.com')[1] || cs}`);
      console.log(`    Status: ${cr.status} | URLs: ${cnt} | Size: ${text.length}b`);
    }
  }
  
  // 3. robots.txt
  console.log('\n[3] ROBOTS.TXT');
  const robots = await (await fetch('https://tiptop360.com/robots.txt')).text();
  const sitemapDirective = robots.match(/^Sitemap:\s*(.+)$/im)?.[1];
  console.log(`  Sitemap directive: ${sitemapDirective || '❌ MISSING'}`);
  console.log(`  Disallow patterns: ${(robots.match(/^Disallow:/gm) || []).length}`);
  console.log(`  Crawl-delay: ${robots.match(/Crawl-delay:\s*(\d+)/i)?.[1] || 'none'}`);
  // Check for accidental wildcard disallow
  if (/^Disallow:\s*\/?\s*$/m.test(robots)) console.log('  ⚠️ FOUND BLANKET DISALLOW');
  
  // 4. Test 5 random URLs from sitemap for indexability signals
  console.log('\n[4] INDEXABILITY CHECK (5 random sitemap URLs)');
  // Get URLs from first child sitemap if hierarchical
  let testUrls = urls.length ? urls : [];
  if (!testUrls.length && childSitemaps.length) {
    const cr = await fetch(childSitemaps[0]);
    const text = await cr.text();
    testUrls = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  }
  
  const sample = testUrls.sort(() => 0.5 - Math.random()).slice(0, 5);
  for (const url of sample) {
    const pr = await fetch(url, {redirect: 'follow', headers: {'User-Agent': 'Googlebot/2.1'}});
    const html = await pr.text();
    const robotsMeta = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i)?.[1];
    const xRobots = pr.headers.get('x-robots-tag');
    const canonical = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
    const isCanonicalSelf = canonical === url;
    console.log(`\n  ${url.split('tiptop360.com')[1] || url}`);
    console.log(`    Status: ${pr.status}`);
    console.log(`    meta robots: ${robotsMeta || '(none — good)'}`);
    console.log(`    X-Robots-Tag: ${xRobots || '(none — good)'}`);
    console.log(`    canonical: ${canonical ? (isCanonicalSelf ? '✅ self' : '⚠️ ' + canonical) : '❌ missing'}`);
    if (robotsMeta?.includes('noindex')) console.log('    🔴 BLOCKED by noindex meta');
    if (xRobots?.includes('noindex')) console.log('    🔴 BLOCKED by X-Robots-Tag');
  }
  
  // 5. Common Shopify sitemap issues
  console.log('\n[5] COMMON ISSUES CHECK');
  const homeRes = await fetch('https://tiptop360.com/');
  const homeHtml = await homeRes.text();
  console.log(`  Home noindex meta: ${homeHtml.includes('noindex') ? '🔴 yes' : '✅ no'}`);
  console.log(`  Home canonical: ${homeHtml.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1] || '❌ none'}`);
  console.log(`  Password-protected: ${homeRes.url.includes('/password') ? '🔴 YES' : '✅ no'}`);
  
  // 6. Test as Googlebot specifically
  const gbot = await fetch('https://tiptop360.com/sitemap.xml', {headers:{'User-Agent':'Googlebot/2.1'}});
  console.log(`\n[6] GOOGLEBOT TEST`);
  console.log(`  Sitemap.xml as Googlebot: ${gbot.status} ${gbot.headers.get('content-type')}`);
})();
