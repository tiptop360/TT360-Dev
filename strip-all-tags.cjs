const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

const FILES = [
  'theme-files/layout/theme.liquid',
  'theme-files/layout/theme.gempages.header.liquid',
  'theme-files/layout/theme.gempages.footer.liquid',
  'theme-files/layout/theme.gempages.blank.liquid',
  'theme-files/layout/theme.gem-layout-none.liquid',
  'theme-files/snippets/pagefly-main-js.liquid'
];

(async () => {
  console.log('🔧 STRIP ALL HARDCODED TRACKING TAGS\n' + '='.repeat(60));
  
  const TS = Date.now();
  const filesToPush = [];
  
  for (const file of FILES) {
    if (!fs.existsSync(file)) { console.log(`  ⊘ ${file} (not found)`); continue; }
    
    let content = fs.readFileSync(file, 'utf8');
    const before = content.length;
    fs.copyFileSync(file, `${file}.PRE-TAG-STRIP-${TS}.bak`);
    
    // Pattern A: gtag.js loader
    content = content.replace(/<script\s+async\s+src=["']https:\/\/www\.googletagmanager\.com\/gtag\/js[^"']*["'][^>]*>\s*<\/script>\s*/gi, '');
    
    // Pattern B: GTM script block
    content = content.replace(/<script>\s*\(function\([wdsl,]+\)\{[\s\S]*?googletagmanager\.com\/gtm\.js[\s\S]*?<\/script>\s*/gi, '');
    
    // Pattern C: gtag init script
    content = content.replace(/<script>\s*window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|\s*\[\];\s*function\s+gtag\(\)[\s\S]*?<\/script>\s*/gi, '');
    
    // Pattern D: gtag config blocks
    content = content.replace(/<script>[^<]{0,50}gtag\(['"]config['"][\s\S]{0,500}?<\/script>\s*/gi, '');
    
    // Pattern E: gtag event blocks
    content = content.replace(/<script>[^<]{0,50}gtag\(['"]event['"][\s\S]{0,1500}?<\/script>\s*/gi, '');
    
    // Pattern F: GTM noscript iframe
    content = content.replace(/<noscript>\s*<iframe\s+src=["']https:\/\/www\.googletagmanager\.com\/ns\.html[^"']*["'][^>]*><\/iframe>\s*<\/noscript>\s*/gi, '');
    
    // Pattern G: legacy UA
    content = content.replace(/<script>\s*\(function\([isogram,]+\)\{[\s\S]*?google-analytics\.com\/analytics\.js[\s\S]*?<\/script>\s*/gi, '');
    
    // Pattern H: any script block mentioning tracking IDs
    for (const id of ['GT-NC6ZVVHK', 'G-HJ94RQ6GL5', 'GT-KV6885FQ', 'GTM-KK5LGHSG']) {
      const re = new RegExp(`<script[^>]*>[^<]{0,2000}${id}[\\s\\S]{0,2000}?<\\/script>\\s*`, 'gi');
      content = content.replace(re, '');
    }
    
    const after = content.length;
    const removed = before - after;
    
    if (removed > 0) {
      const opens = (content.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
      const closes = (content.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
      
      if (opens !== closes) {
        console.log(`  ❌ ${file}: Liquid unbalanced (${opens}/${closes}) — RESTORING`);
        fs.copyFileSync(`${file}.PRE-TAG-STRIP-${TS}.bak`, file);
        continue;
      }
      
      const remaining = (content.match(/gtag\(|googletagmanager\.com\/(gtag|gtm)|UA-\d|GTM-[A-Z0-9]+|G-[A-Z0-9]{8,}|GT-[A-Z0-9]+/g) || []).length;
      
      fs.writeFileSync(file, content);
      filesToPush.push(file);
      console.log(`  ✅ ${file.split('/').pop()}`);
      console.log(`     Removed: ${removed} chars | Remaining tracking refs: ${remaining}`);
    } else {
      console.log(`  ⊘ ${file.split('/').pop()} — nothing to remove`);
    }
  }
  
  if (filesToPush.length === 0) {
    console.log('\n⚠️  Nothing to push.');
    process.exit(0);
  }
  
  console.log(`\n📤 Pushing ${filesToPush.length} files...\n`);
  const onlyArgs = filesToPush.map(f => `--only ${f}`).join(' ');
  execSync(`shopify theme push --store zrhgzw-xt.myshopify.com --theme 145031200883 --path ./theme-files ${onlyArgs} --allow-live`, {stdio:'inherit'});
  
  // Force cache flush
  console.log('\n🔥 Force-flushing edge cache...');
  const STORE = process.env.SHOPIFY_STORE;
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  const t = (await r.json()).access_token;
  
  await fetch(`https://${STORE}/admin/api/2024-10/themes/145031200883.json`, {
    method:'PUT', headers:{'X-Shopify-Access-Token':t, 'Content-Type':'application/json'},
    body: JSON.stringify({theme:{id:145031200883, name:'TipTop360 | NEW Cloud optimized '}})
  });
  console.log('  ✅ Theme touched');
  
  console.log('\n⏳ Waiting 60s for full cache flush...');
  await new Promise(r => setTimeout(r, 60000));
  
  const html = await (await fetch('https://tiptop360.com/?x=' + Date.now())).text();
  const counts = {
    'AW-17211943737 (Google&YT app Ads)': (html.match(/AW-17211943737/g) || []).length,
    'G-0H831EVB10 (Google&YT app GA4)': (html.match(/G-0H831EVB10/g) || []).length,
    'G-HJ94RQ6GL5 (DUPLICATE — should be 0)': (html.match(/G-HJ94RQ6GL5/g) || []).length,
    'GT-NC6ZVVHK (DUPLICATE — should be 0)': (html.match(/GT-NC6ZVVHK/g) || []).length,
    'GT-KV6885FQ (should be 0)': (html.match(/GT-KV6885FQ/g) || []).length,
    'GTM-KK5LGHSG (should be 0)': (html.match(/GTM-KK5LGHSG/g) || []).length,
    'gtag( calls': (html.match(/gtag\(/g) || []).length
  };
  
  console.log('\n=== AFTER FIX (LIVE PAGE) ===');
  Object.entries(counts).forEach(([tag, n]) => console.log(`  ${tag}: ${n}×`));
})();
