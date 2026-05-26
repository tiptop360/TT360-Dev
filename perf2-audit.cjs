const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

(async () => {
  const html = await (await fetch(`https://tiptop360.com/?x=${Date.now()}`)).text();
  
  console.log('=== RENDER-BLOCKING SCRIPTS (in <head>, no defer/async) ===');
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const blockingScripts = [...head.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/gi)]
    .filter(m => !m[0].includes('defer') && !m[0].includes('async'))
    .map(m => m[1]);
  console.log('Count:', blockingScripts.length);
  blockingScripts.slice(0,15).forEach(s => console.log(' ', s.slice(0,100)));
  
  console.log('\n=== ALL EXTERNAL SCRIPTS ===');
  const ext = [...html.matchAll(/<script[^>]+src="([^"]+)"/gi)]
    .map(m => m[1])
    .filter(s => !s.includes('tiptop360.com') && !s.includes('cdn.shopify.com'));
  [...new Set(ext)].forEach(s => console.log(' ', s.slice(0,100)));
  
  console.log('\n=== INLINE STYLE BLOCKS COUNT ===');
  console.log((html.match(/<style[^>]*>/gi) || []).length);
  
  console.log('\n=== CSS FILE COUNT ===');
  console.log((html.match(/<link[^>]+rel="stylesheet"/gi) || []).length);
  
  console.log('\n=== HERO IMAGE PRELOAD ===');
  const preloads = [...head.matchAll(/<link[^>]+rel="preload"[^>]*>/gi)].map(m => m[0]);
  preloads.forEach(p => console.log(' ', p.slice(0,150)));
  
  console.log('\n=== FONT-DISPLAY STATUS ===');
  console.log('font-display references in HTML:', (html.match(/font-display/g) || []).length);
})();
