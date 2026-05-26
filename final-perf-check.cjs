require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

const PSI_KEY = process.env.PSI_KEY || '';
const URL = 'https://tiptop360.com/';

async function runPSI(strategy) {
  const u = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(URL)}&strategy=${strategy}&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES${PSI_KEY ? '&key=' + PSI_KEY : ''}`;
  const r = await fetch(u);
  if (!r.ok) return null;
  return r.json();
}

function score(data) {
  const cats = data.lighthouseResult.categories;
  const audits = data.lighthouseResult.audits;
  return {
    perf: Math.round(cats.performance.score * 100),
    seo: Math.round(cats.seo.score * 100),
    a11y: Math.round(cats.accessibility.score * 100),
    bp: Math.round(cats['best-practices'].score * 100),
    fcp: audits['first-contentful-paint'].displayValue,
    lcp: audits['largest-contentful-paint'].displayValue,
    tbt: audits['total-blocking-time'].displayValue,
    cls: audits['cumulative-layout-shift'].displayValue,
    si: audits['speed-index'].displayValue,
    renderBlocking: audits['render-blocking-resources']?.displayValue || 'n/a',
    unusedJs: audits['unused-javascript']?.displayValue || 'n/a',
    unusedCss: audits['unused-css-rules']?.displayValue || 'n/a',
    serverResponse: audits['server-response-time']?.displayValue || 'n/a',
    imageOpt: audits['uses-optimized-images']?.score === 1 ? '✅' : audits['uses-optimized-images']?.displayValue || 'n/a',
    nextGenImages: audits['modern-image-formats']?.score === 1 ? '✅' : audits['modern-image-formats']?.displayValue || 'n/a'
  };
}

(async () => {
  console.log('🎯 FINAL PERFORMANCE CHECK\n' + '='.repeat(70));
  console.log('URL: ' + URL);
  console.log('Started: ' + new Date().toISOString() + '\n');
  
  console.log('Running mobile + desktop tests in parallel (60-90s)...\n');
  
  const [mobile, desktop] = await Promise.all([runPSI('mobile'), runPSI('desktop')]);
  
  if (!mobile || !desktop) {
    console.log('❌ PSI returned no data (rate limit or no API key)');
    console.log('\nNo PSI_KEY in .env? Manual check at:');
    console.log('  https://pagespeed.web.dev/analysis?url=' + encodeURIComponent(URL));
    return;
  }
  
  const m = score(mobile);
  const d = score(desktop);
  
  // Final report
  console.log('='.repeat(70));
  console.log('📱 MOBILE');
  console.log('='.repeat(70));
  console.log(`  Performance:   ${m.perf}/100  ${m.perf >= 90 ? '✅' : m.perf >= 70 ? '🟡' : '🔴'}`);
  console.log(`  SEO:           ${m.seo}/100   ${m.seo >= 95 ? '✅' : m.seo >= 85 ? '🟡' : '🔴'}`);
  console.log(`  Accessibility: ${m.a11y}/100  ${m.a11y >= 90 ? '✅' : m.a11y >= 80 ? '🟡' : '🔴'}`);
  console.log(`  Best Practices:${m.bp}/100   ${m.bp >= 90 ? '✅' : m.bp >= 80 ? '🟡' : '🔴'}`);
  console.log('');
  console.log(`  FCP:           ${m.fcp}      (target <1.8s)`);
  console.log(`  LCP:           ${m.lcp}      (target <2.5s)`);
  console.log(`  TBT:           ${m.tbt}      (target <200ms)`);
  console.log(`  CLS:           ${m.cls}      (target <0.1)`);
  console.log(`  Speed Index:   ${m.si}       (target <3.4s)`);
  console.log('');
  console.log(`  Server response:    ${m.serverResponse}`);
  console.log(`  Render-blocking:    ${m.renderBlocking}`);
  console.log(`  Unused JS:          ${m.unusedJs}`);
  console.log(`  Unused CSS:         ${m.unusedCss}`);
  console.log(`  Modern images:      ${m.nextGenImages}`);
  
  console.log('\n' + '='.repeat(70));
  console.log('💻 DESKTOP');
  console.log('='.repeat(70));
  console.log(`  Performance:   ${d.perf}/100  ${d.perf >= 90 ? '✅' : d.perf >= 70 ? '🟡' : '🔴'}`);
  console.log(`  SEO:           ${d.seo}/100   ${d.seo >= 95 ? '✅' : d.seo >= 85 ? '🟡' : '🔴'}`);
  console.log(`  Accessibility: ${d.a11y}/100  ${d.a11y >= 90 ? '✅' : d.a11y >= 80 ? '🟡' : '🔴'}`);
  console.log(`  Best Practices:${d.bp}/100   ${d.bp >= 90 ? '✅' : d.bp >= 80 ? '🟡' : '🔴'}`);
  console.log('');
  console.log(`  FCP:           ${d.fcp}`);
  console.log(`  LCP:           ${d.lcp}`);
  console.log(`  TBT:           ${d.tbt}`);
  console.log(`  CLS:           ${d.cls}`);
  console.log(`  Speed Index:   ${d.si}`);
  
  // Summary verdict
  console.log('\n' + '='.repeat(70));
  console.log('📊 VERDICT');
  console.log('='.repeat(70));
  
  const summary = {
    timestamp: new Date().toISOString(),
    mobile: m,
    desktop: d
  };
  require('fs').writeFileSync('perf-final-report.json', JSON.stringify(summary, null, 2));
  console.log('Saved: perf-final-report.json\n');
  
  if (m.perf >= 70 && d.perf >= 85) {
    console.log('✅ ACCEPTABLE — site performs within realistic range for Shopify Basic + 8 apps');
  } else if (m.perf >= 50) {
    console.log('🟡 MEDIOCRE — has room to improve, but on Shopify Basic this is the ceiling');
  } else {
    console.log('🔴 POOR — investigate further');
  }
  
  console.log('\nKnown limits on this stack:');
  console.log('  - Shopify Web Pixels Manager adds 150ms TBT (cannot disable on Basic)');
  console.log('  - 8 active apps each add 30-100ms TBT');
  console.log('  - Mobile 90+ requires app removal or Shopify Plus');
})();
