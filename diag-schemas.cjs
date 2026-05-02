const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

(async () => {
  const html = await (await fetch('https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now())).text();
  const blocks = [...html.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  let n = 0;
  for (const b of blocks) {
    n++;
    try {
      const j = JSON.parse(b[1].trim());
      if (j['@type'] === 'Product') {
        console.log('--- PRODUCT BLOCK ' + n + ' (size: ' + b[1].length + ') ---');
        console.log('200 chars BEFORE:');
        console.log(html.slice(Math.max(0, b.index - 200), b.index).replace(/\s+/g, ' ').slice(-200));
        console.log('');
        console.log('Content (first 500 chars):');
        console.log(b[1].trim().slice(0, 500));
        console.log('');
      }
    } catch(e) {}
  }
})();
