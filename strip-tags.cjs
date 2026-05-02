const fs = require('fs');
const { execSync } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

const FILES = [
  'theme-files/layout/theme.liquid',
  'theme-files/layout/theme.gempages.header.liquid',
  'theme-files/layout/theme.gempages.footer.liquid',
  'theme-files/layout/theme.gempages.blank.liquid',
  'theme-files/layout/theme.gem-layout-none.liquid',
  'theme-files/snippets/pagefly-main-js.liquid'
];

console.log('🔧 STRIP DUPLICATE GTAG/GTM/AW TAGS\n' + '='.repeat(60));

const TS = Date.now();
const filesToPush = [];

for (const file of FILES) {
  if (!fs.existsSync(file)) { console.log(`  ⊘ ${file} (not found)`); continue; }
  
  let content = fs.readFileSync(file, 'utf8');
  const before = content.length;
  
  // Backup
  fs.copyFileSync(file, `${file}.PRE-TAG-STRIP-${TS}.bak`);
  
  // Remove googletagmanager async script tag
  content = content.replace(/<script\s+async\s+src=["']https:\/\/www\.googletagmanager\.com\/gtag\/js[^"']*["']\s*><\/script>\s*/gi, '');
  
  // Remove gtag() init script blocks (window.dataLayer + gtag('js',...) + gtag('config',...))
  content = content.replace(/<script>\s*window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|\s*\[\];\s*function\s+gtag\(\)\{dataLayer\.push\(arguments\);\}[\s\S]*?<\/script>\s*/gi, '');
  
  // Remove inline gtag config blocks (broader)
  content = content.replace(/<script>[^<]{0,1000}gtag\(['"]config['"][^<]{0,500}<\/script>\s*/gi, '');
  
  // Remove standalone gtag event blocks
  content = content.replace(/<script>[^<]{0,1500}gtag\(['"]event['"][^<]{0,1500}<\/script>\s*/gi, '');
  
  // Remove GTM noscript iframes
  content = content.replace(/<noscript><iframe\s+src=["']https:\/\/www\.googletagmanager\.com\/ns\.html[^"']*["'][^>]*><\/iframe><\/noscript>\s*/gi, '');
  
  // Keep the dns-prefetch — it's harmless and used by other things
  
  const after = content.length;
  const removed = before - after;
  
  if (removed > 0) {
    // Validate Liquid balance
    const opens = (content.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
    const closes = (content.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
    
    if (opens !== closes) {
      console.log(`  ❌ ${file}: Liquid unbalanced after edit (${opens}/${closes}) — RESTORING`);
      fs.copyFileSync(`${file}.PRE-TAG-STRIP-${TS}.bak`, file);
      continue;
    }
    
    // Verify no more tracking tags remain
    const remaining = (content.match(/gtag\(|googletagmanager\.com\/gtag|UA-\d|AW-\d|GTM-[A-Z0-9]+|G-[A-Z0-9]{8,}|GT-[A-Z0-9]+/g) || []).length;
    
    fs.writeFileSync(file, content);
    filesToPush.push(file);
    console.log(`  ✅ ${file}`);
    console.log(`     Removed: ${removed} chars | Remaining tracking refs: ${remaining}`);
  } else {
    console.log(`  ⊘ ${file} — nothing to remove`);
  }
}

if (filesToPush.length === 0) {
  console.log('\n⚠️  No changes needed.');
  process.exit(0);
}

console.log(`\n📤 Pushing ${filesToPush.length} files...\n`);
const onlyArgs = filesToPush.map(f => `--only ${f}`).join(' ');
execSync(`shopify theme push --store zrhgzw-xt.myshopify.com --theme 145031200883 --path ./theme-files ${onlyArgs} --allow-live`, {stdio:'inherit'});

console.log('\n⏳ Waiting 35s for cache + verifying...');
setTimeout(async () => {
  const html = await (await fetch('https://tiptop360.com/?x=' + Date.now())).text();
  const counts = {
    'AW-17211943737': (html.match(/AW-17211943737/g) || []).length,
    'G-0H831EVB10': (html.match(/G-0H831EVB10/g) || []).length,
    'G-HJ94RQ6GL5': (html.match(/G-HJ94RQ6GL5/g) || []).length,
    'GT-NC6ZVVHK': (html.match(/GT-NC6ZVVHK/g) || []).length,
    'gtag(': (html.match(/gtag\(/g) || []).length
  };
  
  console.log('\n=== AFTER FIX ===');
  Object.entries(counts).forEach(([tag, n]) => {
    let verdict;
    if (tag === 'GT-NC6ZVVHK' || tag === 'G-HJ94RQ6GL5') verdict = n === 0 ? '✅ removed' : '❌ still present';
    else if (tag === 'AW-17211943737') verdict = n <= 4 ? '✅ normal' : `⚠️ ${n} (still high)`;
    else if (tag === 'G-0H831EVB10') verdict = n >= 1 && n <= 4 ? '✅ G&Y app firing' : `⚠️ ${n}`;
    else verdict = '';
    console.log(`  ${tag}: ${n}× ${verdict}`);
  });
}, 35000);
