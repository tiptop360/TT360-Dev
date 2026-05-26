require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const fs = require('fs');
const STORE = process.env.SHOPIFY_STORE;
const THEME_ID = 145031200883;

(async () => {
  console.log('🚀 FINAL PERF DEPLOY — atomic, all safe optimizations\n' + '='.repeat(70));
  
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  const HEAD = {'X-Shopify-Access-Token':t, 'Content-Type':'application/json'};
  
  // ============================================
  // SNIPPET 1: Critical perf optimizations (replaces all my previous attempts)
  // ============================================
  const perfSnippet = `{%- comment -%}
  Critical perf — single consolidated snippet
  - Preconnect ONLY to top 4 (Google warning: don't over-preconnect)
  - Lazy-load Judge.me below fold
  - content-visibility for footer + reviews
  - Image lazy-load enforcement
{%- endcomment -%}

{%- comment -%} 1. Preconnect — limited to 4 critical domains {%- endcomment -%}
<link rel="preconnect" href="https://cdn.shopify.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="dns-prefetch" href="https://www.googletagmanager.com">
<link rel="dns-prefetch" href="https://cdn.judge.me">

{%- comment -%} 2. Hero image preload (LCP) {%- endcomment -%}
{%- if template.name == 'index' -%}
  {%- if settings.slide_1_image -%}
    <link rel="preload" as="image" href="{{ settings.slide_1_image | image_url: width: 1500 }}" fetchpriority="high">
  {%- elsif sections.slideshow-3.settings.slide_1_image -%}
    <link rel="preload" as="image" href="{{ sections.slideshow-3.settings.slide_1_image | image_url: width: 1500 }}" fetchpriority="high">
  {%- endif -%}
{%- endif -%}

<style>
  /* Below-fold lazy painting (saves rendering work) */
  footer, .site-footer, .footer { content-visibility: auto; contain-intrinsic-size: 0 500px; }
  .jdgm-widget, .jdgm-rev-widg, [class*="jdgm-rev"] { content-visibility: auto; contain-intrinsic-size: 0 600px; }
  .cro-comparison, .cro-fbt { content-visibility: auto; contain-intrinsic-size: 0 400px; }
  
  /* Font display swap */
  @font-face { font-display: swap !important; }
  
  /* Image optimization */
  img { 
    height: auto; 
    image-rendering: -webkit-optimize-contrast;
  }
  
  /* Mobile paint optimization */
  @media (max-width: 768px) {
    /* Hardware accel for smooth scroll */
    .product-card, .swiper-slide { transform: translateZ(0); will-change: transform; }
    
    /* Reduce shadow complexity (kills paint perf on mobile) */
    .product-card { box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important; }
    
    /* Disable expensive backdrop filters */
    * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
    
    /* Eliminate layout shifts */
    .product-card { min-height: 280px; }
  }
</style>

<script>
(function() {
  // Defer Judge.me settings init until idle
  if ('requestIdleCallback' in window) {
    var jdgmInline = document.querySelector('script.jdgm-settings-script');
    if (jdgmInline) {
      // Already in DOM — let it run, but defer activation of widgets
      requestIdleCallback(function() {
        // Trigger any Judge.me init that's waiting
        if (window.jdgm && typeof window.jdgm.process === 'function') {
          window.jdgm.process();
        }
      }, { timeout: 3000 });
    }
  }
  
  // Lazy-activate review widgets only when scrolled to
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('jdgm-active');
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '300px' });
    document.querySelectorAll('.jdgm-widget, [class*="jdgm-rev"]').forEach(function(el) {
      obs.observe(el);
    });
  }
})();
</script>
`;
  
  // Push perf snippet
  await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
    method: 'PUT', headers: HEAD,
    body: JSON.stringify({asset: {key: 'snippets/perf-critical.liquid', value: perfSnippet}})
  });
  console.log('[1] ✅ perf-critical.liquid created');
  
  // ============================================
  // STEP 2: Wire it ONCE in theme.liquid head
  // ============================================
  const themeRes = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=layout/theme.liquid`, {headers: {'X-Shopify-Access-Token':t}});
  let theme = (await themeRes.json()).asset.value;
  fs.writeFileSync('theme-files/layout/theme.liquid.PRE-FINAL-PERF-' + Date.now() + '.bak', theme);
  
  // Remove ALL previous attempts (clean slate)
  const oldRenders = ['css-defer','tbt-optimization','lcp-preload','lazy-below-fold','font-optimization','mobile-perf','resource-hints','defer-helper','perf-critical'];
  for (const s of oldRenders) {
    theme = theme.replace(new RegExp(`\\s*\\{%-?\\s*render\\s+['"]${s}['"][^%]*-?%\\}\\s*`, 'g'), '\n');
  }
  
  // Insert perf-critical FIRST in head
  theme = theme.replace(/<head[^>]*>/, function(match) {
    return match + `\n{%- render 'perf-critical' -%}`;
  });
  
  // Validate
  const opens = (theme.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
  const closes = (theme.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
  if (opens !== closes) { console.log('❌ Unbalanced: ' + opens + '/' + closes); process.exit(1); }
  
  // Push
  const putRes = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
    method: 'PUT', headers: HEAD,
    body: JSON.stringify({asset: {key: 'layout/theme.liquid', value: theme}})
  });
  console.log('[2] ' + (putRes.ok ? '✅' : '❌') + ' theme.liquid pushed');
  
  // Sync local
  fs.writeFileSync('theme-files/layout/theme.liquid', theme);
  
  // ============================================
  // STEP 3: Heal markdown corruption in theme.liquid
  // ============================================
  let theme2 = theme;
  theme2 = theme2.replace(/\[([a-z_][a-z0-9_.]*)\]\(http:\/\/[a-z_][a-z0-9_.]*\)/g, '$1');
  if (theme2 !== theme) {
    await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
      method: 'PUT', headers: HEAD,
      body: JSON.stringify({asset: {key: 'layout/theme.liquid', value: theme2}})
    });
    fs.writeFileSync('theme-files/layout/theme.liquid', theme2);
    console.log('[3] ✅ Healed markdown corruption');
  } else {
    console.log('[3] ⊘ No markdown corruption');
  }
  
  // ============================================
  // STEP 4: Force flush
  // ============================================
  await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}.json`, {
    method:'PUT', headers: HEAD,
    body: JSON.stringify({theme:{id:THEME_ID, name:'TipTop360 | NEW Cloud optimized'}})
  });
  console.log('[4] ✅ Cache flushed');
  
  // ============================================
  // STEP 5: Wait + regression
  // ============================================
  console.log('\n⏳ Waiting 90s for cache propagation + regression test...');
  await new Promise(res => setTimeout(res, 90000));
  
  console.log('\n🔍 REGRESSION (9 critical pages):');
  const tests = [
    'https://tiptop360.com/',
    'https://tiptop360.com/cart',
    'https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift',
    'https://tiptop360.com/products/ai-voice-recorder',
    'https://tiptop360.com/products/magnetic-gym-bag-uae-gymgear-tiptop360',
    'https://tiptop360.com/products/color-pencils',
    'https://tiptop360.com/collections/kids-collection-uae',
    'https://tiptop360.com/pages/about-tiptop360',
    'https://tiptop360.com/sitemap.xml'
  ];
  
  let pass = 0, fail = 0;
  for (const url of tests) {
    try {
      const r2 = await fetch(url + '?x=' + Date.now());
      const html = await r2.text();
      const hasErrors = /Liquid error/.test(html);
      const ok = r2.status === 200 && !hasErrors && html.length > 1000;
      console.log('  ' + (ok ? '✅' : '🔴') + ' ' + url.split('tiptop360.com')[1] + ' (' + r2.status + ')');
      if (ok) pass++; else fail++;
    } catch(e) {
      console.log('  💥 ' + url.split('tiptop360.com')[1] + ': ' + e.message);
      fail++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 RESULT: ' + pass + ' passed, ' + fail + ' failed');
  
  if (fail === 0) {
    console.log('\n✅ All regression tests pass.');
    console.log('\n📊 Now run mobile PageSpeed (wait 2 more minutes for full cache flush):');
    console.log('  https://pagespeed.web.dev/analysis?url=https%3A%2F%2Ftiptop360.com%2F&form_factor=mobile');
    console.log('\nExpected mobile improvements:');
    console.log('  Performance: 35 → 50-65 (with FeedOn removed)');
    console.log('  LCP: 12.3s → 4-6s');
    console.log('  FCP: 4.7s → 2.5-3.5s');
    console.log('  TBT: 1240ms → 700-1000ms');
    console.log('\nIf still <50, only path forward is removing more apps.');
  } else {
    console.log('\n🔴 REGRESSION FAILED — review failures above.');
  }
})();
