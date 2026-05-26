const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

(async () => {
  const url = 'https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift';
  const html = await (await fetch(`${url}?x=${Date.now()}`, {headers:{'User-Agent':'Mozilla/5.0 iPhone'}})).text();
  
  console.log('🔤 FONT SIZE AUDIT\n' + '='.repeat(50));
  
  // Get all inline font-size values
  const fontSizes = [...html.matchAll(/font-size:\s*([0-9.]+)(px|rem|em|%)/gi)].map(m => `${m[1]}${m[2]}`);
  const counts = {};
  fontSizes.forEach(s => counts[s] = (counts[s]||0) + 1);
  
  console.log('Font sizes used (most common first):');
  Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([s,c]) => {
    let warning = '';
    const px = parseFloat(s);
    const unit = s.replace(/[0-9.]/g,'');
    if (unit === 'px' && px < 14) warning = ' ⚠️ too small for body text';
    if (unit === 'px' && px < 12) warning = ' 🔴 unreadable on mobile';
    if (unit === 'px' && px === 16) warning = ' ✅ ideal body size';
    console.log(`  ${s.padEnd(8)} → ${c}x${warning}`);
  });
  
  // Mobile-specific
  console.log('\n🚨 PROBLEMS:');
  const tinyCount = fontSizes.filter(s => /^(8|9|10|11|12|13)px$/.test(s)).length;
  console.log(`  Text < 14px: ${tinyCount} instances (causes squinting)`);
  
  // Find tiny text contexts
  const tinyMatches = [...html.matchAll(/font-size:\s*1[0-3]px[^"]*"[^>]*>([^<]{10,80})/gi)].slice(0,10);
  if (tinyMatches.length) {
    console.log('\n📍 First 10 tiny-text examples:');
    tinyMatches.forEach(m => console.log(`  "${m[1].trim().slice(0,60)}..."`));
  }
})();
