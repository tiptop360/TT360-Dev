const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

(async () => {
  const html = await (await fetch('https://tiptop360.com/?x=' + Date.now())).text();
  
  console.log('=== JS LOAD STRATEGY ===');
  const allScripts = [...html.matchAll(/<script([^>]*)>/g)].map(m => m[1]);
  const synchronous = allScripts.filter(s => s.includes('src') && !s.includes('async') && !s.includes('defer') && !s.includes('type="application/ld+json"') && !s.includes('type=\'application/ld+json\''));
  const async_ = allScripts.filter(s => s.includes('async'));
  const defer = allScripts.filter(s => s.includes('defer'));
  const inlineCount = allScripts.filter(s => !s.includes('src')).length;
  
  console.log(`  Synchronous (BLOCKING): ${synchronous.length}`);
  console.log(`  Async: ${async_.length}`);
  console.log(`  Defer: ${defer.length}`);
  console.log(`  Inline scripts: ${inlineCount}`);
  
  console.log('\n=== TOP BLOCKING DOMAINS ===');
  const externalDomains = {};
  for (const s of allScripts) {
    const m = s.match(/src=["']([^"']+)["']/);
    if (m) {
      try {
        const u = new URL(m[1].startsWith('//') ? 'https:' + m[1] : m[1].startsWith('http') ? m[1] : 'https://tiptop360.com' + m[1]);
        externalDomains[u.hostname] = (externalDomains[u.hostname] || 0) + 1;
      } catch(e) {}
    }
  }
  Object.entries(externalDomains).sort((a,b) => b[1] - a[1]).slice(0, 15).forEach(([d,n]) => console.log(`  ${n}× ${d}`));
  
  console.log('\n=== APPS LIKELY LOADING JS ===');
  const apps = ['gempages', 'pagefly', 'judge.me', 'klaviyo', 'pumper', 'selleasy', 'cartlytics', 'storerank', 'wetracked', 'snap', 'nabu', 'wrapin', 'feedon'];
  for (const a of apps) {
    const c = (html.match(new RegExp(a, 'gi')) || []).length;
    if (c > 0) console.log(`  ${a}: ${c} refs`);
  }
  
  console.log('\n=== INLINE SCRIPT SIZE (top 5 largest) ===');
  const inline = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)];
  const sorted = inline.map(m => m[1].length).sort((a,b) => b - a).slice(0, 5);
  sorted.forEach((s, i) => console.log(`  ${i+1}. ${s} bytes`));
  console.log(`  Total inline JS: ${inline.reduce((sum, m) => sum + m[1].length, 0)} bytes`);
  
  console.log('\n=== HEAVIEST IMAGES (top 5) ===');
  const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/g)].map(m => m[1]);
  console.log(`  Total <img> tags: ${imgs.length}`);
  console.log(`  Lazy-loaded: ${(html.match(/loading=["']lazy["']/g) || []).length}`);
  console.log(`  Eager (above-fold): ${(html.match(/loading=["']eager["']/g) || []).length}`);
  
  console.log('\n=== SHOPIFY APP SCRIPT TAGS LOADED VIA SCRIPTTAG API ===');
  const appBundleScripts = [...html.matchAll(/cdn\.shopify\.com\/extensions\/[^"']+/g)].map(m => m[0]);
  console.log(`  ${[...new Set(appBundleScripts)].length} unique app extension bundles loading`);
})();
