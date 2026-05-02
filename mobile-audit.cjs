const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

(async () => {
  const url = 'https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift';
  const html = await (await fetch(`${url}?x=${Date.now()}`, {headers:{'User-Agent':'Mozilla/5.0 iPhone'}})).text();
  
  console.log('🔍 MOBILE UX AUDIT\n' + '='.repeat(50));
  
  // Viewport
  const vp = html.match(/<meta name="viewport"[^>]*>/i)?.[0] || 'MISSING';
  console.log('\n📱 Viewport:', vp);
  console.log('  Has user-scalable=no:', /user-scalable=no|maximum-scale=1[^.0-9]/.test(vp) ? '⚠️ YES (bad for accessibility)' : '✅ NO');
  
  // Horizontal overflow risks
  console.log('\n🔄 HORIZONTAL OVERFLOW RISKS');
  const overflowKeywords = ['min-width:480px', 'min-width:500px', 'min-width:600px', 'min-width:720px', 'width:100vw', 'left:-', 'margin-left:-'];
  overflowKeywords.forEach(k => {
    const c = (html.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'g')) || []).length;
    if (c > 0) console.log(`  ⚠️ "${k}" found ${c}x — potential overflow`);
  });
  
  // Wide tables
  const tables = (html.match(/<table[^>]*>/gi) || []).length;
  const wideTables = (html.match(/min-width:\s*[4-9][0-9][0-9]px/gi) || []).length;
  console.log(`\n📊 Tables: ${tables} total, ${wideTables} with min-width 400+ (need horizontal scroll wrapper)`);
  
  // Tap targets
  const buttons = (html.match(/<button[^>]*>|<a [^>]*class="[^"]*btn/gi) || []).length;
  console.log(`\n👆 Buttons/CTAs: ${buttons}`);
  
  // Sticky elements
  const stickies = (html.match(/position:\s*(sticky|fixed)/gi) || []).length;
  console.log(`📌 Sticky/fixed elements: ${stickies}`);
  
  // Image lazy loading
  const allImgs = (html.match(/<img[^>]*>/gi) || []).length;
  const lazyImgs = (html.match(/<img[^>]*loading=["']lazy["'][^>]*>/gi) || []).length;
  console.log(`\n🖼️  Images: ${allImgs} total, ${lazyImgs} lazy (${Math.round(lazyImgs/allImgs*100)}%)`);
  
  // Width constraints
  const noMaxWidth = (html.match(/<div[^>]*style="[^"]*width:\s*1[0-9]{2,}px/gi) || []).length;
  console.log(`\n📐 Hardcoded widths > 100px without max-width: ${noMaxWidth} instances`);
  
  // Font sizes (anti-zoom)
  console.log('\n🔤 Body font-size:');
  const tinyText = (html.match(/font-size:\s*1[0-3]px/gi) || []).length;
  console.log(`  ⚠️ Tiny text (< 14px): ${tinyText} instances`);
  
  // CRO blocks rendered
  console.log('\n🎯 CRO BLOCKS PRESENT:');
  ['cro-rating-badge','cro-trust-band','cro-comparison','cro-fbt','cro-risk-reversal'].forEach(cls => {
    console.log(`  ${html.includes(cls)?'✅':'❌'} ${cls}`);
  });
  
  console.log();
})();
