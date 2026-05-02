const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

(async () => {
  const html = await (await fetch('https://tiptop360.com/?x=' + Date.now())).text();
  
  console.log('=== RENDER-BLOCKING RESOURCES (in <head>) ===\n');
  
  // Find <head>
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/);
  if (!headMatch) { console.log('No <head> found'); return; }
  const head = headMatch[1];
  
  // Render-blocking CSS (no media query, no preload)
  const cssLinks = [...head.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/g)].map(m => m[0]);
  console.log('CSS <link rel="stylesheet"> in head:');
  cssLinks.forEach(c => {
    const href = c.match(/href=["']([^"']+)["']/)?.[1] || '?';
    const media = c.match(/media=["']([^"']+)["']/)?.[1] || 'all (BLOCKING)';
    console.log(`  ${media === 'print' ? '✅' : '🔴'} ${href.slice(0, 80)} | media=${media}`);
  });
  
  // Render-blocking sync scripts in head
  const headScripts = [...head.matchAll(/<script\s+[^>]*src=["'][^"']+["'][^>]*>/g)].map(m => m[0]);
  console.log('\n<script> with src in head:');
  headScripts.forEach(s => {
    const src = s.match(/src=["']([^"']+)["']/)?.[1] || '?';
    const isAsync = s.includes('async');
    const isDefer = s.includes('defer');
    console.log(`  ${isAsync || isDefer ? '✅' : '🔴'} ${src.slice(0, 80)} | ${isAsync ? 'async' : isDefer ? 'defer' : 'BLOCKING'}`);
  });
  
  // Inline CSS in head
  const styleTags = [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
  console.log('\n<style> blocks in head:');
  styleTags.forEach((s, i) => console.log(`  ${i+1}. ${(s.length/1024).toFixed(1)}KB`));
  
  // Fonts
  console.log('\nFont links:');
  const fonts = [...head.matchAll(/<link[^>]+(?:fonts\.googleapis|fonts\.gstatic|font[^"']*\.(?:woff|ttf))[^>]*>/g)].map(m => m[0]);
  fonts.forEach(f => {
    const isPreload = f.includes('rel="preload"') || f.includes("rel='preload'");
    const fontDisplay = f.match(/font-display:\s*(\w+)/)?.[1];
    console.log(`  ${isPreload ? '✅' : '🟡'} ${f.slice(0, 100)}`);
  });
  
  console.log('\n=== TOP CULPRITS LIKELY ===');
  console.log(`  Total CSS files: ${cssLinks.length}`);
  console.log(`  Total head scripts: ${headScripts.length}`);
  console.log(`  Total inline <style>: ${styleTags.length} (${(styleTags.reduce((s,t) => s + t.length, 0) / 1024).toFixed(1)}KB)`);
})();
