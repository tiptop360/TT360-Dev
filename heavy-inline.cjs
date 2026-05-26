const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

(async () => {
  const html = await (await fetch('https://tiptop360.com/?x=' + Date.now())).text();
  const inline = [...html.matchAll(/<script(?![^>]*src)([^>]*)>([\s\S]*?)<\/script>/g)];
  
  console.log('=== TOP 10 INLINE SCRIPTS (largest first) ===\n');
  const sorted = inline
    .map((m, idx) => ({attrs: m[1], content: m[2], size: m[2].length, idx}))
    .filter(s => s.size > 1000)
    .sort((a, b) => b.size - a.size);
  
  sorted.slice(0, 10).forEach((s, i) => {
    console.log(`#${i+1} | ${(s.size/1024).toFixed(1)}KB | attrs: ${s.attrs.trim() || '(none)'}`);
    // First 200 chars
    const preview = s.content.replace(/\s+/g, ' ').slice(0, 250);
    console.log(`  Preview: ${preview}`);
    
    // Try to identify source
    const sources = [];
    if (s.content.includes('Shopify.theme')) sources.push('Shopify theme settings');
    if (s.content.includes('klaviyo')) sources.push('Klaviyo');
    if (s.content.includes('gempages')) sources.push('GemPages');
    if (s.content.includes('pagefly')) sources.push('PageFly');
    if (s.content.includes('judge')) sources.push('Judge.me');
    if (s.content.includes('storerank')) sources.push('StoreRank.ai');
    if (s.content.includes('nabu')) sources.push('Nabu');
    if (s.content.includes('snap')) sources.push('Snap COD');
    if (s.content.includes('wrapin')) sources.push('Wrapin');
    if (s.content.includes('selleasy')) sources.push('Selleasy');
    if (s.content.includes('window.dataLayer')) sources.push('GA4 dataLayer');
    if (s.content.includes('@type')) sources.push('JSON-LD schema');
    if (s.content.includes('window._paq') || s.content.includes('clarity')) sources.push('Clarity/Matomo');
    if (s.content.includes('window.GoCart')) sources.push('Theme cart');
    if (s.content.includes('product-template')) sources.push('Theme product template');
    
    console.log(`  Likely source: ${sources.length ? sources.join(', ') : '? UNKNOWN'}\n`);
  });
  
  const totalInlineKB = (inline.reduce((s, m) => s + m[2].length, 0) / 1024).toFixed(1);
  console.log(`TOTAL INLINE JS: ${totalInlineKB}KB`);
})();
