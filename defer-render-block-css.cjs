require('dotenv').config();
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;
const THEME_ID = 145031200883;

(async () => {
  console.log('🔧 DEFER RENDER-BLOCKING CSS\n' + '='.repeat(60));
  
  // Get token
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  const HEAD = {'X-Shopify-Access-Token':t, 'Content-Type':'application/json'};
  
  // Strategy: insert a small JS snippet right after <head> opens that:
  // 1. Finds all <link rel="stylesheet"> for non-critical CSS  
  // 2. Switches them to media="print" then back to "all" onload
  // 3. Keeps theme.aio.min.css intact (above-fold critical)
  
  console.log('\n[1] Creating CSS deferral snippet...');
  
  const cssDeferSnippet = `{%- comment -%}
  CSS Deferral — converts non-critical CSS links from blocking to non-blocking
  Pattern: media="print" then swap to media="all" onload
  Keeps theme.aio.min.css blocking (it's critical for above-fold)
  Defers: judgeme, accelerated-check, edd extension CSS
{%- endcomment -%}
<script>
(function() {
  // List of CSS URL patterns to defer (non-critical, below-fold)
  var deferPatterns = [
    /portable-wallets.*accelerated-check/i,
    /judgeme-/i,
    /\\/c-edd-/i,
    /\\/extensions\\/[a-f0-9-]+\\/c-/i  // catch other extension CSS
  ];
  
  function deferCSS() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(function(link) {
      var href = link.href || '';
      var shouldDefer = deferPatterns.some(function(p) { return p.test(href); });
      if (!shouldDefer) return;
      if (link.dataset.deferred === 'true') return;
      
      // Switch to print to make non-blocking
      link.media = 'print';
      link.dataset.deferred = 'true';
      
      // Restore on load
      link.onload = function() {
        this.media = 'all';
        this.onload = null;
      };
    });
  }
  
  // Run immediately for current head
  if (document.readyState === 'loading') {
    deferCSS();
  } else {
    deferCSS();
  }
  
  // Also run on DOMContentLoaded for any late-injected
  document.addEventListener('DOMContentLoaded', deferCSS);
  
  // Watch for dynamically added <link> tags (apps inject these later)
  if ('MutationObserver' in window) {
    var obs = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(n) {
          if (n.tagName === 'LINK' && n.rel === 'stylesheet') {
            deferCSS();
          }
        });
      });
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
</script>
`;
  
  await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
    method: 'PUT', headers: HEAD,
    body: JSON.stringify({asset: {key: 'snippets/css-defer.liquid', value: cssDeferSnippet}})
  });
  console.log('  ✅ css-defer.liquid created');
  
  // === STEP 2: Wire it as FIRST thing in <head> ===
  console.log('\n[2] Wiring css-defer FIRST in <head>...');
  const themeRes = await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=layout/theme.liquid`, {headers: {'X-Shopify-Access-Token':t}});
  let theme = (await themeRes.json()).asset.value;
  
  if (!theme.includes("'css-defer'")) {
    // Insert right after <head> opening tag (must be FIRST to catch links as they're parsed)
    theme = theme.replace(/<head[^>]*>/, function(match) {
      return match + `\n{%- render 'css-defer' -%}`;
    });
    
    await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
      method: 'PUT', headers: HEAD,
      body: JSON.stringify({asset: {key: 'layout/theme.liquid', value: theme}})
    });
    console.log('  ✅ Wired into theme.liquid head');
  } else {
    console.log('  ⊘ Already wired');
  }
  
  // === STEP 3: Force flush ===
  console.log('\n[3] Force-flushing edge cache...');
  await fetch(`https://${STORE}/admin/api/2024-10/themes/${THEME_ID}.json`, {
    method:'PUT', headers: HEAD,
    body: JSON.stringify({theme:{id:THEME_ID, name:'TipTop360 | NEW Cloud optimized'}})
  });
  console.log('  ✅ Done');
  
  console.log('\n⏳ Waiting 90s for cache flush...');
  await new Promise(res => setTimeout(res, 90000));
  
  console.log('\n[4] Verifying deferral worked...');
  const html = await (await fetch('https://tiptop360.com/?x=' + Date.now())).text();
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/);
  
  if (headMatch) {
    const cssLinks = [...headMatch[1].matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/g)].map(m => m[0]);
    console.log(`  Total CSS links in head: ${cssLinks.length}`);
    console.log(`  Note: deferral happens via JS at load — initial HTML still shows media="all"`);
    console.log(`  Real test: PageSpeed report`);
  }
  
  console.log('\n📊 Run PageSpeed Insights now:');
  console.log('  https://pagespeed.web.dev/analysis?url=https%3A%2F%2Ftiptop360.com');
  console.log('\nExpected:');
  console.log('  Render blocking: 320ms → 0-100ms');
  console.log('  FCP: 2.4s → 1.8-2.0s');
  console.log('  LCP: 3.8s → 3.0-3.3s');
  console.log('  Performance score: +3-5 points');
})();
