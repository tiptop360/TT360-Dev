const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

(async () => {
  const html = await (await fetch('https://zrhgzw-xt.myshopify.com/?x=' + Date.now())).text();
  
  // Find ACTUAL <script async src=...gtag/js?id=...> tags (the only ones that load)
  const loadingScripts = [...html.matchAll(/<script\s+async\s+src=["']https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=([^"']+)["']/gi)];
  console.log('=== ACTUAL Google Tag scripts loading ===');
  console.log('Count:', loadingScripts.length);
  loadingScripts.forEach((m, i) => console.log(`  ${i+1}. id=${m[1]}`));
  
  // Find gtag('config','XXX') calls
  const configCalls = [...html.matchAll(/gtag\(['"]config['"],\s*['"]([^'"]+)['"]/g)];
  console.log('\n=== gtag(config) calls ===');
  console.log('Count:', configCalls.length);
  const uniqueIds = [...new Set(configCalls.map(m => m[1]))];
  uniqueIds.forEach(id => console.log(`  ${id}`));
  
  // GTM containers
  const gtmContainers = [...html.matchAll(/googletagmanager\.com\/gtm\.js\?id=(GTM-[A-Z0-9]+)/g)];
  console.log('\n=== GTM containers loaded ===');
  console.log('Count:', gtmContainers.length);
  gtmContainers.forEach((m, i) => console.log(`  ${i+1}. ${m[1]}`));
  
  // dataLayer pushes
  const dataLayerPushes = [...html.matchAll(/dataLayer\.push\(\{/g)];
  console.log('\ndataLayer.push count:', dataLayerPushes.length);
})();
