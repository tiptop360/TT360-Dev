const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

const URLS = [
  ['Homepage', 'https://tiptop360.com/'],
  ['Kids Collection', 'https://tiptop360.com/collections/kids-collection-uae'],
  ['Toothbrush', 'https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift'],
  ['AI Voice Recorder', 'https://tiptop360.com/products/ai-voice-recorder'],
  ['Gym Bag', 'https://tiptop360.com/products/magnetic-gym-bag-uae-gymgear-tiptop360'],
  ['Color Pencils', 'https://tiptop360.com/products/color-pencils'],
  ['About', 'https://tiptop360.com/pages/about-tiptop360'],
  ['Cart', 'https://tiptop360.com/cart'],
  ['Sitemap', 'https://tiptop360.com/sitemap.xml']
];

(async () => {
  console.log('\n🧪 FULL SITE VALIDATION\n' + '='.repeat(60));
  let totalPass = 0, totalFail = 0;
  
  for (const [name, url] of URLS) {
    const start = Date.now();
    const res = await fetch(`${url}?x=${Date.now()}`, {headers:{'User-Agent':'Mozilla/5.0'}});
    const html = await res.text();
    const ms = Date.now() - start;
    
    const checks = [
      ['Status 200', res.status === 200],
      ['Loads <2s', ms < 2000],
      ['No Liquid errors', !html.includes('Liquid error')],
      ['Has TipTop360 brand', html.includes('TipTop360') || url.includes('sitemap')],
      ['No malware', !html.includes('githubfix') && !html.includes('component-3.0') && !html.includes('fv-loading-icon')],
      ['No broken imgs', !html.match(/<img[^>]*src="\s*"/i)]
    ];
    
    if (url.includes('/products/')) {
      checks.push(['Product schema', html.includes('"@type": "Product"') || html.includes('"@type":"Product"')]);
      checks.push(['ATC button', html.toLowerCase().includes('add to cart')]);
      checks.push(['Trust band', html.includes('cro-trust-band')]);
      checks.push(['Comparison table', html.includes('cro-comparison')]);
    }
    
    if (url.includes('/collections/') || url === 'https://tiptop360.com/') {
      checks.push(['Product cards present', (html.match(/product-card js-product-card/g) || []).length > 0]);
    }
    
    const pass = checks.filter(c => c[1]).length;
    const fail = checks.length - pass;
    totalPass += pass;
    totalFail += fail;
    
    console.log(`\n📄 ${name} (${ms}ms)`);
    checks.forEach(([n,ok]) => console.log(`  ${ok?'✅':'❌'} ${n}`));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`OVERALL: ${totalPass}/${totalPass+totalFail} passed (${Math.round(totalPass/(totalPass+totalFail)*100)}%)`);
})();
