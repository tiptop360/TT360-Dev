const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
(async () => {
  const html = await (await fetch('https://tiptop360.com/?x=' + Date.now(), {
    headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'}
  })).text();

  console.log('=== INLINE SCRIPT AUDIT ===\n');
  const inlineScripts = (html.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/g) || []);
  inlineScripts
    .filter(s => s.length > 2000)
    .sort((a,b) => b.length - a.length)
    .forEach((s, i) => {
      const preview = s.replace(/<\/?script[^>]*>/g,'').trim().slice(0,150);
      console.log(`[${i+1}] ${s.length} chars — ${preview}...`);
      console.log('');
    });

  console.log('\n=== DUPLICATE SCRIPTS ===');
  const srcs = (html.match(/src="([^"]+)"/g)||[]).map(s => s.replace(/src="|"/g,''));
  const seen = {};
  srcs.forEach(s => {
    const base = s.split('?')[0].split('/').pop();
    seen[base] = (seen[base]||0) + 1;
  });
  Object.entries(seen).filter(([,v]) => v > 1).forEach(([k,v]) => console.log(`  DUPLICATE x${v}:`, k));
})();
