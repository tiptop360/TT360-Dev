const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
(async () => {
  const html = await (await fetch('https://tiptop360.com/?x=' + Date.now(), {
    headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'}
  })).text();

  const renderBlocking = (html.match(/<script[^>]*src=[^>]+>/g)||[])
    .filter(s => !s.includes('defer') && !s.includes('async') && !s.includes('type="module"'));
  const thirdParty = (html.match(/src="https?:\/\/[^"]+"/g)||[])
    .filter(s => !s.includes('tiptop360') && !s.includes('cdn.shopify'));
  const fontDisplay = (html.match(/font-display/g)||[]).length;
  const preloads = (html.match(/<link[^>]*rel="preload"[^>]*>/g)||[]);
  const preconnects = (html.match(/<link[^>]*rel="preconnect"[^>]*>/g)||[]);
  const webp = (html.match(/\.webp/g)||[]).length;
  const lazyLoad = (html.match(/loading="lazy"/g)||[]).length;
  const lcpImg = (html.match(/<img[^>]*>/g)||[]).find(i => !i.includes('loading="lazy"')) || 'none';

  console.log('=== PERFORMANCE AUDIT ===');
  console.log('Render-blocking scripts:', renderBlocking.length);
  renderBlocking.slice(0,5).forEach(s => console.log('  ', s.slice(0,120)));
  console.log('3rd party scripts:', thirdParty.length);
  thirdParty.slice(0,8).forEach(s => console.log('  ', s.slice(0,100)));
  console.log('font-display mentions:', fontDisplay);
  console.log('Preloads:', preloads.length);
  preloads.forEach(s => console.log('  ', s.slice(0,120)));
  console.log('Preconnects:', preconnects.length);
  preconnects.forEach(s => console.log('  ', s.slice(0,100)));
  console.log('WebP images:', webp);
  console.log('Lazy-load images:', lazyLoad);
  console.log('First non-lazy img (LCP candidate):', lcpImg.slice(0,200));
})();
