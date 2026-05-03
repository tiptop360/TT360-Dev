const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
(async () => {
  const html = await (await fetch('https://tiptop360.com/?x=' + Date.now(), {
    headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'}
  })).text();

  console.log('=== TBT CULPRIT AUDIT ===\n');

  const allScripts = html.match(/<script[^>]*src="[^"]*"[^>]*>/g) || [];
  console.log('Total external scripts:', allScripts.length);

  const deferred = allScripts.filter(s => s.includes('defer') || s.includes('async') || s.includes('type="module"'));
  const blocking = allScripts.filter(s => !s.includes('defer') && !s.includes('async') && !s.includes('type="module"'));

  console.log('Deferred/async:', deferred.length);
  console.log('Blocking (no defer/async):', blocking.length);
  blocking.forEach(s => {
    const src = s.match(/src="([^"]+)"/)?.[1] || '';
    console.log('  BLOCKING:', src.slice(0, 100));
  });

  console.log('\nAll external scripts:');
  allScripts.forEach(s => {
    const src = s.match(/src="([^"]+)"/)?.[1] || '';
    const isDefer = s.includes('defer') ? '[defer]' : '';
    const isAsync = s.includes('async') ? '[async]' : '';
    const isModule = s.includes('type="module"') ? '[module]' : '';
    const flag = isDefer || isAsync || isModule || '[BLOCKING]';
    console.log(' ', flag, src.slice(0, 90));
  });

  const inlineScripts = (html.match(/<script(?![^>]*src)[^>]*>[\s\S]*?<\/script>/g) || []);
  const heavyInline = inlineScripts.filter(s => s.length > 2000);
  console.log('\nInline scripts >2KB:', heavyInline.length);
  console.log('Largest inline script:', Math.max(...inlineScripts.map(s => s.length)), 'chars');
})();
