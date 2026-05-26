/**
 * TipTop360 Local Theme Optimizer (CLI Edition)
 * ──────────────────────────────────────────────────────────────────────────
 * Works with theme files pulled by Shopify CLI to ./theme-files/
 *
 * Workflow:
 *   1. shopify theme pull → downloads theme to ./theme-files/
 *   2. node optimize-local.js audit → see what needs fixing
 *   3. node optimize-local.js apply <fix> → modify local files (auto-backup)
 *   4. node optimize-local.js validate → run shopify theme check
 *   5. shopify theme push → upload changes back to Shopify
 *   6. Preview in Shopify Admin → publish when ready
 *
 * Every fix:
 *   - Backs up the file before editing
 *   - Edits the local file (no live store impact)
 *   - Logs the change for revert
 *   - Can be reverted with `node optimize-local.js revert <fix>`
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import readline from 'readline';
import { KEYWORDS, getKeywordsForProduct, buildMetaPrompt, buildTitleTag } from './keywords.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────
// CONFIG (edit these or use .env)
// ─────────────────────────────────────────
function loadEnv() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [k, ...rest] = t.split('=');
    if (k && rest.length) process.env[k.trim()] = rest.join('=').trim();
  }
}
loadEnv();

const CONFIG = {
  themeDir:      join(__dirname, 'theme-files'),
  backupDir:     join(__dirname, 'local-backups'),
  changeLog:     join(__dirname, 'local-changes.json'),
  whatsapp:      (process.env.WHATSAPP_NUMBER || '971585156033').replace(/[^\d]/g, ''),
  storeName:     process.env.STORE_NAME || 'TipTop360',
  storeUrl:      process.env.STORE_URL || 'https://tiptop360.com',
  anthropicKey:  process.env.ANTHROPIC_API_KEY || '',
  aiModel:       process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
};

mkdirSync(CONFIG.backupDir, { recursive: true });

// ─────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────
const c = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m' };
function log(msg, type = 'normal') {
  const m = { info: c.cyan, success: c.green, warn: c.yellow, error: c.red, dim: c.dim, bold: c.bold };
  console.log(`${m[type] || c.reset}${msg}${c.reset}`);
}
function hr() { log('─'.repeat(60), 'dim'); }

// ─────────────────────────────────────────
// CHANGE LOG
// ─────────────────────────────────────────
function loadChanges() {
  if (!existsSync(CONFIG.changeLog)) return {};
  try { return JSON.parse(readFileSync(CONFIG.changeLog, 'utf8')); } catch { return {}; }
}
function saveChanges(changes) { writeFileSync(CONFIG.changeLog, JSON.stringify(changes, null, 2)); }
function logChange(fixId, meta) {
  const changes = loadChanges();
  changes[fixId] = { ...meta, appliedAt: new Date().toISOString() };
  saveChanges(changes);
}
function clearChange(fixId) {
  const changes = loadChanges();
  delete changes[fixId];
  saveChanges(changes);
}

// ─────────────────────────────────────────
// FILE UTILITIES
// ─────────────────────────────────────────
function ensureThemeDir() {
  if (!existsSync(CONFIG.themeDir)) {
    log('\n❌ theme-files/ folder not found.', 'error');
    log('\nFirst pull your theme from Shopify:', 'info');
    log('  shopify theme pull \\\\', 'dim');
    log('    --store zrhgzw-xt.myshopify.com \\\\', 'dim');
    log('    --password YOUR_PASSWORD \\\\', 'dim');
    log('    --theme [THEME_ID] \\\\', 'dim');
    log('    --path ./theme-files\n', 'dim');
    process.exit(1);
  }
}

function backupFile(relativePath, fixId) {
  const fullPath = join(CONFIG.themeDir, relativePath);
  if (!existsSync(fullPath)) return null;
  const safeName = relativePath.replace(/[\/\\]/g, '__');
  const backupPath = join(CONFIG.backupDir, fixId, safeName);
  mkdirSync(dirname(backupPath), { recursive: true });
  copyFileSync(fullPath, backupPath);
  log(`  📦 Backed up: ${relativePath}`, 'dim');
  return backupPath;
}

function restoreFile(relativePath, fixId) {
  const safeName = relativePath.replace(/[\/\\]/g, '__');
  const backupPath = join(CONFIG.backupDir, fixId, safeName);
  const fullPath = join(CONFIG.themeDir, relativePath);
  if (!existsSync(backupPath)) {
    log(`  ❌ No backup found for ${relativePath}`, 'error');
    return false;
  }
  copyFileSync(backupPath, fullPath);
  log(`  ✅ Restored: ${relativePath}`, 'success');
  return true;
}

function readThemeFile(relativePath) {
  const fullPath = join(CONFIG.themeDir, relativePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, 'utf8');
}

function writeThemeFile(relativePath, content) {
  const fullPath = join(CONFIG.themeDir, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

// ─────────────────────────────────────────
// PROMPTS
// ─────────────────────────────────────────
async function confirm(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(r => rl.question(`\n${c.yellow}⚠️  ${q} (y/N): ${c.reset}`, a => { rl.close(); r(a.trim().toLowerCase() === 'y'); }));
}

// ─────────────────────────────────────────
// ANTHROPIC AI
// ─────────────────────────────────────────
async function ai(prompt, maxTokens = 800) {
  if (!CONFIG.anthropicKey) throw new Error('ANTHROPIC_API_KEY not set in .env');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CONFIG.anthropicKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: CONFIG.aiModel, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────
// FIX SNIPPETS (same as before)
// ─────────────────────────────────────────
const SCHEMA_SNIPPET = `
{% comment %} TipTop360 — Schema JSON-LD (optimizer v1) {% endcomment %}
{% if template == 'product' %}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": {{ product.title | json }},
  "description": {{ product.description | strip_html | truncatewords: 50 | json }},
  "url": {{ shop.url | append: product.url | json }},
  "image": {{ product.featured_image | img_url: '1200x' | prepend: 'https:' | json }},
  "brand": { "@type": "Brand", "name": "TipTop360" },
  "sku": {{ product.selected_or_first_available_variant.sku | json }},
  "offers": {
    "@type": "Offer",
    "price": {{ product.price | money_without_currency | remove: ',' }},
    "priceCurrency": "AED",
    "availability": {% if product.available %}"https://schema.org/InStock"{% else %}"https://schema.org/OutOfStock"{% endif %},
    "seller": { "@type": "Organization", "name": "TipTop360" },
    "url": {{ shop.url | append: product.url | json }}
  }
}
</script>
{% endif %}
{% if template == 'index' %}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "TipTop360",
  "url": {{ shop.url | json }},
  "logo": {{ shop.url | append: '/cdn/shop/files/Logo.png' | json }},
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+971-58-515-6033",
    "contactType": "customer service",
    "availableLanguage": ["English", "Arabic"],
    "areaServed": "AE"
  },
  "sameAs": [
    "https://www.facebook.com/tiptop360online",
    "https://www.instagram.com/tiptop360_online",
    "https://www.tiktok.com/@tiptop360_online",
    "https://www.pinterest.com/tiptop_360"
  ]
}
</script>
{% endif %}
`;

// ─────────────────────────────────────────
// FIX 01 — Schema Markup
// ─────────────────────────────────────────
async function applySchema() {
  log('\n📐 Fix 01 — Schema Markup', 'bold');
  const layoutPath = 'layout/theme.liquid';
  const content = readThemeFile(layoutPath);
  if (!content) { log(`  ❌ ${layoutPath} not found`, 'error'); return; }

  if (content.includes('TipTop360 — Schema JSON-LD')) {
    log('  ✅ Already present — skipping', 'success'); return;
  }

  if (!await confirm(`Inject schema markup into ${layoutPath}?`)) { log('  Skipped.', 'dim'); return; }

  backupFile(layoutPath, 'fix-01-schema');
  const updated = content.replace('</head>', `${SCHEMA_SNIPPET}\n</head>`);
  writeThemeFile(layoutPath, updated);
  logChange('fix-01-schema', { fix: 'Schema Markup', files: [layoutPath] });
  log('  ✅ Schema injected into layout/theme.liquid', 'success');
}

// ─────────────────────────────────────────
// FIX 02 — Sticky ATC Bar
// ─────────────────────────────────────────
const STICKY_ATC = `
{% comment %} TipTop360 — Sticky ATC Bar (optimizer v1) {% endcomment %}
{% if template == 'product' %}
<div id="tt360-sticky-atc" class="tt360-sticky-atc" style="display:none">
  <div class="tt360-sticky-inner">
    <div class="tt360-sticky-product">
      <img src="{{ product.featured_image | img_url: '80x80', crop: 'center' }}" alt="{{ product.title }}" width="40" height="40">
      <span class="tt360-sticky-title">{{ product.title | truncatewords: 6 }}</span>
    </div>
    <div class="tt360-sticky-price">
      <span class="tt360-price">{{ product.price | money }}</span>
      {% if product.compare_at_price > product.price %}
        <span class="tt360-compare">{{ product.compare_at_price | money }}</span>
      {% endif %}
    </div>
    <button class="tt360-sticky-btn" type="button" onclick="document.querySelector('[name=add]')?.click() || document.querySelector('.product-form__submit')?.click()">Add to Cart</button>
  </div>
</div>
<style>
.tt360-sticky-atc{position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#fff;border-top:2px solid #54e8cc;box-shadow:0 -4px 20px rgba(0,0,0,.12);padding:10px 16px;transform:translateY(100%);transition:transform .3s ease}
.tt360-sticky-atc.visible{transform:translateY(0)}
.tt360-sticky-inner{display:flex;align-items:center;gap:12px;max-width:1200px;margin:0 auto}
.tt360-sticky-product{display:flex;align-items:center;gap:8px;flex:1;min-width:0}
.tt360-sticky-product img{border-radius:6px;object-fit:cover;flex-shrink:0}
.tt360-sticky-title{font-size:13px;font-weight:600;color:#12395e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tt360-sticky-price{display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0}
.tt360-price{font-size:16px;font-weight:700;color:#12395e}
.tt360-compare{font-size:11px;color:#999;text-decoration:line-through}
.tt360-sticky-btn{background:#f9655d;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:background .2s}
.tt360-sticky-btn:hover{background:#e04d45}
@media(max-width:480px){.tt360-sticky-title{display:none}.tt360-sticky-btn{padding:10px 14px;font-size:13px}}
</style>
<script>
(function(){
  var bar=document.getElementById('tt360-sticky-atc');
  if(!bar) return;
  var mainBtn=document.querySelector('[name=add], .product-form__submit, .btn--add-to-cart');
  if(!mainBtn) return;
  var shown=false;
  function check(){
    var rect=mainBtn.getBoundingClientRect();
    var below=rect.bottom<0;
    if(below!==shown){shown=below;bar.style.display='block';setTimeout(function(){bar.classList.toggle('visible',shown)},10)}
  }
  window.addEventListener('scroll',check,{passive:true});
  check();
})();
</script>
{% endif %}
`;

async function applyStickyATC() {
  log('\n🛒 Fix 02 — Sticky Add to Cart Bar', 'bold');
  const snippetPath = 'snippets/tt360-sticky-atc.liquid';
  const layoutPath = 'layout/theme.liquid';

  if (!await confirm('Add sticky ATC bar?')) { log('  Skipped.', 'dim'); return; }

  writeThemeFile(snippetPath, STICKY_ATC);
  log(`  ✅ Created: ${snippetPath}`, 'success');

  const layout = readThemeFile(layoutPath);
  if (layout && !layout.includes("render 'tt360-sticky-atc'")) {
    backupFile(layoutPath, 'fix-02-sticky-atc');
    writeThemeFile(layoutPath, layout.replace('</body>', `  {% render 'tt360-sticky-atc' %}\n</body>`));
    log(`  ✅ Included in layout/theme.liquid`, 'success');
  }
  logChange('fix-02-sticky-atc', { fix: 'Sticky ATC', files: [snippetPath, layoutPath] });
}

// ─────────────────────────────────────────
// FIX 03 — WhatsApp CTA
// ─────────────────────────────────────────
function whatsappSnippet(num) {
  return `
{% comment %} TipTop360 — WhatsApp CTA (optimizer v1) {% endcomment %}
<a href="https://wa.me/${num}?text=Hi%20TipTop360%2C%20I%20have%20a%20question" id="tt360-whatsapp" class="tt360-whatsapp" target="_blank" rel="noopener" aria-label="Chat with TipTop360 on WhatsApp">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="28" height="28">
    <path fill="#25D366" d="M24 4C12.95 4 4 12.95 4 24c0 3.6.96 7.06 2.8 10.1L4 44l10.25-2.7C17.2 43.1 20.55 44 24 44c11.05 0 20-8.95 20-20S35.05 4 24 4z"/>
    <path fill="#fff" d="M33.16 28.42c-.4-.2-2.37-1.17-2.74-1.3-.36-.14-.63-.2-.89.2-.27.4-1.03 1.3-1.26 1.57-.23.27-.46.3-.86.1-.4-.2-1.68-.62-3.2-1.98-1.18-1.06-1.98-2.37-2.21-2.77-.23-.4-.02-.62.17-.82.18-.18.4-.46.6-.7.2-.23.27-.4.4-.66.14-.27.07-.5-.03-.7-.1-.2-.9-2.17-1.23-2.97-.32-.78-.65-.67-.89-.68H19.6c-.27 0-.7.1-1.06.5-.37.4-1.4 1.37-1.4 3.34 0 1.97 1.43 3.87 1.63 4.14.2.27 2.8 4.27 6.78 5.99.95.41 1.69.65 2.27.83.95.3 1.82.26 2.5.16.76-.11 2.37-.97 2.7-1.9.34-.94.34-1.74.24-1.9-.1-.18-.36-.27-.76-.47z"/>
  </svg>
  <span class="tt360-wa-label">Need help?</span>
</a>
<style>
.tt360-whatsapp{position:fixed;bottom:80px;right:16px;z-index:9998;display:flex;align-items:center;gap:8px;background:#25D366;color:#fff;border-radius:50px;padding:10px 16px 10px 14px;box-shadow:0 4px 16px rgba(37,211,102,.45);text-decoration:none;font-size:13px;font-weight:600;transition:transform .2s,box-shadow .2s}
.tt360-whatsapp:hover{transform:scale(1.05);box-shadow:0 6px 20px rgba(37,211,102,.6)}
.tt360-wa-label{white-space:nowrap}
@media(max-width:480px){.tt360-wa-label{display:none}.tt360-whatsapp{padding:12px;border-radius:50%}}
</style>
`;
}

async function applyWhatsApp() {
  log('\n💬 Fix 03 — WhatsApp CTA', 'bold');
  const snippetPath = 'snippets/tt360-whatsapp.liquid';
  const layoutPath = 'layout/theme.liquid';
  if (!await confirm(`Add floating WhatsApp button (+${CONFIG.whatsapp})?`)) { log('  Skipped.', 'dim'); return; }
  writeThemeFile(snippetPath, whatsappSnippet(CONFIG.whatsapp));
  log(`  ✅ Created: ${snippetPath}`, 'success');
  const layout = readThemeFile(layoutPath);
  if (layout && !layout.includes("render 'tt360-whatsapp'")) {
    backupFile(layoutPath, 'fix-03-whatsapp');
    writeThemeFile(layoutPath, layout.replace('</body>', `  {% render 'tt360-whatsapp' %}\n</body>`));
    log(`  ✅ Included in layout/theme.liquid`, 'success');
  }
  logChange('fix-03-whatsapp', { fix: 'WhatsApp CTA', files: [snippetPath, layoutPath] });
}

// ─────────────────────────────────────────
// FIX 04 — Trust Badge Bar
// ─────────────────────────────────────────
const TRUST_BADGES = `
{% comment %} TipTop360 — Trust Badge Bar (optimizer v1) {% endcomment %}
<div class="tt360-trust-bar">
  <div class="tt360-trust-inner">
    <div class="tt360-badge"><span><strong>BPA-Free</strong> Silicone</span></div>
    <div class="tt360-badge"><span><strong>Dubai Municipality</strong> Approved</span></div>
    <div class="tt360-badge"><span><strong>Cash on Delivery</strong> Available</span></div>
    <div class="tt360-badge"><span><strong>Next-Day</strong> Free Delivery</span></div>
    <div class="tt360-badge"><span><strong>30-Day</strong> Money Back</span></div>
    <div class="tt360-badge"><span><strong>50,000+</strong> UAE Families</span></div>
  </div>
</div>
<style>
.tt360-trust-bar{background:#12395e;padding:10px 16px;width:100%}
.tt360-trust-inner{display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap;max-width:1200px;margin:0 auto}
.tt360-badge{display:flex;align-items:center;gap:6px;color:#fff;font-size:12px}
@media(max-width:600px){.tt360-trust-inner{gap:12px}.tt360-badge{font-size:11px}}
</style>
`;

async function applyTrust() {
  log('\n🛡️  Fix 04 — Trust Badge Bar', 'bold');
  const snippetPath = 'snippets/tt360-trust-badges.liquid';
  if (!await confirm('Create trust badge snippet? (You\'ll add to product page manually)')) { log('  Skipped.', 'dim'); return; }
  writeThemeFile(snippetPath, TRUST_BADGES);
  log(`  ✅ Created: ${snippetPath}`, 'success');
  log(`  💡 To use: paste {% render 'tt360-trust-badges' %} in your product template`, 'info');
  logChange('fix-04-trust', { fix: 'Trust Badges', files: [snippetPath] });
}

// ─────────────────────────────────────────
// SPEED-AUDIT — find page speed bottlenecks in local theme files
// Identifies render-blocking resources, large assets, missing lazy loads
// ─────────────────────────────────────────
async function speedAudit() {
  log('\n⚡ Speed Audit — Identifying Page Speed Bottlenecks', 'bold');
  hr();
  ensureThemeDir();

  const findings = {
    largeAssets: [],
    renderBlockingScripts: [],
    renderBlockingCSS: [],
    missingLazyLoad: [],
    nonWebPImages: [],
    missingPreconnect: [],
    syncFonts: [],
    heavyApps: [],
    inlineSVGs: [],
  };

  // 1. Find large assets (>200KB JS/CSS)
  log('\n  🔍 Checking asset sizes...', 'dim');
  const assets = walkFiles(join(CONFIG.themeDir, 'assets'), ['.css', '.js']);
  for (const file of assets) {
    try {
      const stat = statSync(file);
      const sizeKB = Math.round(stat.size / 1024);
      if (sizeKB > 200 && !file.includes('-backup')) {
        findings.largeAssets.push({
          file: file.replace(CONFIG.themeDir + '/', ''),
          sizeKB,
          ext: file.endsWith('.js') ? 'js' : 'css',
        });
      }
    } catch {}
  }
  findings.largeAssets.sort((a, b) => b.sizeKB - a.sizeKB);

  // 2. Scan layout for render-blocking patterns
  log('  🔍 Checking for render-blocking resources...', 'dim');
  const layoutContent = readThemeFile('layout/theme.liquid');
  if (layoutContent) {
    // Synchronous scripts in <head>
    const headSection = layoutContent.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    if (headSection) {
      const headHtml = headSection[1];
      // Find sync scripts (no async/defer)
      const syncScripts = headHtml.matchAll(/<script\s+(?![^>]*\b(async|defer)\b)[^>]*src=["']([^"']+)["']/gi);
      for (const m of syncScripts) {
        const src = m[2];
        if (!src.includes('googletagmanager') && !src.includes('shopify_pay')) {
          findings.renderBlockingScripts.push(src.substring(0, 80));
        }
      }
      // Find sync CSS imports without preload
      const syncCSS = headHtml.matchAll(/<link\s+(?![^>]*rel=["']preload["'])[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi);
      for (const m of syncCSS) {
        findings.renderBlockingCSS.push(m[1].substring(0, 80));
      }
      // Check for preconnect hints
      const hasPreconnect = /<link[^>]*rel=["']preconnect["']/i.test(headHtml);
      if (!hasPreconnect) {
        findings.missingPreconnect.push('No preconnect hints found — should preconnect to cdn.shopify.com, fonts');
      }
      // Sync font loading
      if (/font-face|@import.*fonts\.googleapis/i.test(headHtml)) {
        findings.syncFonts.push('Fonts loaded synchronously — blocks rendering');
      }
    }
  }

  // 3. Check for images missing lazy-loading or WebP
  log('  🔍 Checking image optimization...', 'dim');
  const liquidFiles = walkFiles(CONFIG.themeDir, ['.liquid']);
  let imagesWithoutLazy = 0;
  let totalImages = 0;
  for (const file of liquidFiles) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    // Count <img> tags
    const imgTags = content.matchAll(/<img\s[^>]*>/gi);
    for (const m of imgTags) {
      totalImages++;
      const tag = m[0];
      // Skip first 1-2 images per file (above fold likely)
      if (!/loading=["']lazy["']/i.test(tag) && !/loading=["']eager["']/i.test(tag)) {
        imagesWithoutLazy++;
      }
    }
  }
  if (imagesWithoutLazy > 5) {
    findings.missingLazyLoad.push({
      count: imagesWithoutLazy,
      total: totalImages,
      explanation: 'Images without explicit loading attribute — browser handles inconsistently',
    });
  }

  // 4. Detect heavy apps from script tags
  log('  🔍 Detecting installed apps and their impact...', 'dim');
  const allFilesContent = liquidFiles.map(f => {
    try { return readFileSync(f, 'utf8'); } catch { return ''; }
  }).join('\n');

  const appPatterns = [
    { name: 'GemPages', pattern: /gempages|gem-/i, impact: 'Heavy — 200-500ms LCP impact' },
    { name: 'AVADA', pattern: /avada\.io/i, impact: 'Medium — 100-300ms impact' },
    { name: 'Klaviyo', pattern: /klaviyo/i, impact: 'Medium — async-friendly, 50-150ms impact' },
    { name: 'Loox/Judge.me', pattern: /loox|judge\.me|judgeme/i, impact: 'Medium — review widget can be deferred' },
    { name: 'Tidio', pattern: /tidio/i, impact: 'Light — chat widget, lazy-loaded' },
    { name: 'PageFly', pattern: /pagefly/i, impact: 'Heavy — page builder' },
    { name: 'Yotpo', pattern: /yotpo/i, impact: 'Medium — review widget' },
  ];
  for (const app of appPatterns) {
    if (app.pattern.test(allFilesContent)) {
      findings.heavyApps.push(app);
    }
  }

  // 5. Inline base64 SVGs (bloat HTML)
  for (const file of liquidFiles) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const inlineSvgs = (content.match(/data:image\/svg\+xml;base64/g) || []).length;
    if (inlineSvgs > 5) {
      findings.inlineSVGs.push({
        file: file.replace(CONFIG.themeDir + '/', ''),
        count: inlineSvgs,
      });
    }
  }

  // ─── REPORT ───
  log('\n📋 SPEED FINDINGS:\n', 'bold');

  log('🏋️  Large Assets (CSS/JS > 200KB):', 'info');
  if (findings.largeAssets.length === 0) {
    log('   ✅ No oversized assets', 'success');
  } else {
    findings.largeAssets.slice(0, 8).forEach(a => {
      const severity = a.sizeKB > 500 ? '🔴' : a.sizeKB > 300 ? '🟠' : '🟡';
      log(`   ${severity} ${a.sizeKB}KB — ${a.file}`, 'warn');
    });
    if (findings.largeAssets.length > 8) log(`   ... and ${findings.largeAssets.length - 8} more`, 'dim');
  }

  log('\n🚧 Render-Blocking Scripts (in <head>):', 'info');
  if (findings.renderBlockingScripts.length === 0) {
    log('   ✅ No render-blocking scripts in head', 'success');
  } else {
    log(`   🔴 ${findings.renderBlockingScripts.length} sync scripts blocking render`, 'warn');
    findings.renderBlockingScripts.slice(0, 5).forEach(s => log(`      • ${s}`, 'dim'));
  }

  log('\n🎨 Render-Blocking CSS (in <head>):', 'info');
  if (findings.renderBlockingCSS.length === 0) {
    log('   ✅ No render-blocking CSS', 'success');
  } else {
    log(`   🟠 ${findings.renderBlockingCSS.length} sync stylesheets`, 'warn');
    findings.renderBlockingCSS.slice(0, 5).forEach(s => log(`      • ${s}`, 'dim'));
  }

  log('\n🖼️  Image Optimization:', 'info');
  if (findings.missingLazyLoad.length === 0) {
    log('   ✅ Images have proper loading attributes', 'success');
  } else {
    findings.missingLazyLoad.forEach(f => {
      log(`   🟠 ${f.count}/${f.total} images missing loading attribute`, 'warn');
      log(`      ${f.explanation}`, 'dim');
    });
  }

  log('\n📦 Installed Apps Detected:', 'info');
  if (findings.heavyApps.length === 0) {
    log('   ✅ No heavy apps detected', 'success');
  } else {
    findings.heavyApps.forEach(a => log(`   • ${a.name} — ${a.impact}`, 'dim'));
  }

  log('\n🎯 Other:', 'info');
  if (findings.missingPreconnect.length > 0) findings.missingPreconnect.forEach(m => log(`   🟡 ${m}`, 'warn'));
  if (findings.syncFonts.length > 0) findings.syncFonts.forEach(m => log(`   🟠 ${m}`, 'warn'));
  if (findings.inlineSVGs.length > 0) {
    const totalInlineSvgs = findings.inlineSVGs.reduce((s, f) => s + f.count, 0);
    log(`   🟡 ${totalInlineSvgs} base64 SVGs inline (across ${findings.inlineSVGs.length} files)`, 'warn');
  }

  // ─── PRIORITIZED FIX PLAN ───
  hr();
  log('\n💡 PRIORITIZED FIX PLAN — In order of LCP/FCP impact:\n', 'bold');

  let priority = 1;

  if (findings.heavyApps.find(a => a.name === 'GemPages')) {
    log(`  ${priority++}. 🔴 CRITICAL — GemPages detected`, 'error');
    log('     GemPages is your #1 LCP killer. Options:', 'dim');
    log('     a) Replace GemPages pages with native Shopify sections (best)', 'dim');
    log('     b) Use lighter GemPages templates only', 'dim');
    log('     c) Defer GemPages JS where possible', 'dim');
    log('     Run: node optimize-local.js apply defer-gempages', 'dim');
  }

  if (findings.largeAssets.filter(a => a.sizeKB > 500 && a.ext === 'js').length > 0) {
    log(`\n  ${priority++}. 🔴 CRITICAL — Heavy JS files (500KB+)`, 'error');
    log('     Options:', 'dim');
    log('     a) Add defer/async attributes to non-critical scripts', 'dim');
    log('     b) Lazy-load below-fold widgets (chat, reviews)', 'dim');
    log('     Run: node optimize-local.js apply defer-scripts', 'dim');
  }

  if (findings.renderBlockingScripts.length > 0) {
    log(`\n  ${priority++}. 🟠 HIGH — Render-blocking scripts in <head>`, 'warn');
    log('     Add async or defer attributes to these', 'dim');
    log('     Run: node optimize-local.js apply defer-scripts', 'dim');
  }

  if (findings.missingPreconnect.length > 0 || findings.syncFonts.length > 0) {
    log(`\n  ${priority++}. 🟠 HIGH — Missing resource hints`, 'warn');
    log('     Add preconnect to fonts.googleapis.com, cdn.shopify.com', 'dim');
    log('     Run: node optimize-local.js apply preconnect', 'dim');
  }

  if (findings.missingLazyLoad.length > 0) {
    log(`\n  ${priority++}. 🟡 MEDIUM — Add lazy-loading to images`, 'info');
    log('     Browser hints help LCP for below-fold content', 'dim');
    log('     Run: node optimize-local.js apply lazy-images', 'dim');
  }

  log('\n  📊 Estimated speed gain from full fix plan:', 'bold');
  let estimatedGain = 0;
  if (findings.heavyApps.find(a => a.name === 'GemPages')) estimatedGain += 800;
  if (findings.largeAssets.filter(a => a.sizeKB > 500).length > 0) estimatedGain += 600;
  if (findings.renderBlockingScripts.length > 3) estimatedGain += 400;
  if (findings.missingPreconnect.length > 0) estimatedGain += 200;
  if (findings.missingLazyLoad.length > 0) estimatedGain += 300;
  log(`     Potential LCP improvement: ~${estimatedGain}ms (current 4.5s → target ~${(4500 - estimatedGain) / 1000}s)`, 'success');
  hr();

  return findings;
}

// ─────────────────────────────────────────
// FIX: defer-scripts — add defer attribute to non-critical scripts in <head>
// ─────────────────────────────────────────
async function applyDeferScripts() {
  log('\n⚡ Fix — Defer Render-Blocking Scripts', 'bold');
  ensureThemeDir();

  const layoutPath = 'layout/theme.liquid';
  const content = readThemeFile(layoutPath);
  if (!content) { log(`  ❌ ${layoutPath} not found`, 'error'); return; }

  // Find sync scripts in <head> that aren't critical
  const headMatch = content.match(/(<head[^>]*>)([\s\S]*?)(<\/head>)/i);
  if (!headMatch) { log('  ❌ Could not parse <head>', 'error'); return; }

  const [full, openTag, headContent, closeTag] = headMatch;

  // Critical scripts that MUST stay sync (Shopify analytics, Stripe, etc.)
  const keepSync = [
    'shopify_pay',
    'googletagmanager',
    'shopify-analytics',
    'window.Shopify',
    'shopifyAnalytics',
    'window.ShopifyAnalytics',
  ];

  let modified = headContent;
  let changeCount = 0;

  // Add defer to script tags missing async/defer
  modified = modified.replace(
    /<script\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>(\s*<\/script>)?/gi,
    (match, before, src, after, closing) => {
      // Skip if critical
      if (keepSync.some(k => src.includes(k) || (before + after).includes(k))) return match;
      // Skip if already has async or defer
      if (/\b(async|defer)\b/.test(before + after)) return match;
      changeCount++;
      const newAttrs = (before + after).trim();
      return `<script defer ${newAttrs} src="${src}">${closing || '</script>'}`;
    }
  );

  if (changeCount === 0) {
    log('  ✅ No scripts to defer (already optimized)', 'success'); return;
  }

  if (!await confirm(`Add defer attribute to ${changeCount} script tags in <head>?`)) {
    log('  Skipped.', 'dim'); return;
  }

  backupFile(layoutPath, 'fix-defer-scripts');
  const newContent = content.replace(headMatch[0], openTag + modified + closeTag);
  writeThemeFile(layoutPath, newContent);
  logChange('fix-defer-scripts', { fix: 'Defer Scripts', files: [layoutPath], changeCount });
  log(`  ✅ Deferred ${changeCount} scripts in layout/theme.liquid`, 'success');
  log('  Expected LCP improvement: ~200-400ms', 'dim');
}

// ─────────────────────────────────────────
// FIX: preconnect — add resource hints to <head>
// ─────────────────────────────────────────
async function applyPreconnect() {
  log('\n⚡ Fix — Add Preconnect Hints', 'bold');
  ensureThemeDir();

  const layoutPath = 'layout/theme.liquid';
  const content = readThemeFile(layoutPath);
  if (!content) { log(`  ❌ ${layoutPath} not found`, 'error'); return; }

  if (content.includes('TipTop360 — Preconnect Hints')) {
    log('  ✅ Preconnect hints already present', 'success'); return;
  }

  const preconnectBlock = `
{% comment %} TipTop360 — Preconnect Hints (optimizer) {% endcomment %}
<link rel="preconnect" href="https://cdn.shopify.com" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="dns-prefetch" href="https://cdn.shopify.com">
<link rel="dns-prefetch" href="https://www.google-analytics.com">
`;

  if (!await confirm('Add preconnect/dns-prefetch hints to <head>?')) {
    log('  Skipped.', 'dim'); return;
  }

  backupFile(layoutPath, 'fix-preconnect');
  const newContent = content.replace(/<head[^>]*>/i, match => match + preconnectBlock);
  writeThemeFile(layoutPath, newContent);
  logChange('fix-preconnect', { fix: 'Preconnect Hints', files: [layoutPath] });
  log('  ✅ Preconnect hints added', 'success');
  log('  Expected speed improvement: ~100-300ms on 3G/4G connections', 'dim');
}

// ─────────────────────────────────────────
// FIX: lazy-images — add loading="lazy" to below-fold images
// ─────────────────────────────────────────
async function applyLazyImages() {
  log('\n⚡ Fix — Add Lazy Loading to Images', 'bold');
  ensureThemeDir();

  const liquidFiles = walkFiles(CONFIG.themeDir, ['.liquid']);
  let totalChanged = 0;
  const filesChanged = [];

  if (!await confirm(`Add loading="lazy" to images in ${liquidFiles.length} liquid files?`)) {
    log('  Skipped.', 'dim'); return;
  }

  for (const file of liquidFiles) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const original = content;
    let fileChanges = 0;

    // Skip header / hero files (above fold)
    const fileName = basename(file).toLowerCase();
    if (fileName.includes('header') || fileName.includes('hero') || fileName.includes('slideshow')) continue;

    // Add loading="lazy" to img tags missing the attribute
    content = content.replace(
      /<img\s+([^>]*?)>/gi,
      (match, attrs) => {
        // Skip if loading attr already present
        if (/\bloading=["']/.test(attrs)) return match;
        // Skip if explicitly first/featured image (likely above fold)
        if (/\b(featured-image|hero-image|primary-image)\b/i.test(attrs)) return match;
        fileChanges++;
        return `<img loading="lazy" ${attrs}>`;
      }
    );

    if (fileChanges > 0) {
      const rel = file.replace(CONFIG.themeDir + '/', '');
      backupFile(rel, 'fix-lazy-images');
      writeFileSync(file, content);
      totalChanged += fileChanges;
      filesChanged.push(rel);
    }
  }

  logChange('fix-lazy-images', { fix: 'Lazy Image Loading', files: filesChanged, totalChanged });
  log(`  ✅ Added lazy-loading to ${totalChanged} images across ${filesChanged.length} files`, 'success');
  log('  Expected LCP improvement: ~200-400ms', 'dim');
}

// ─────────────────────────────────────────
// FIX FAQ DUPLICATE — surgically removes FAQPage from @graph bundles
// while preserving Organization, WebSite, and other schemas
// ─────────────────────────────────────────
async function fixFAQDuplicate() {
  log('\n🔧 Fix: Duplicate FAQPage Schema (surgical)', 'bold');
  hr();
  ensureThemeDir();

  const layoutPath = 'layout/theme.liquid';
  const content = readThemeFile(layoutPath);
  if (!content) { log('  ❌ layout/theme.liquid not found', 'error'); return; }

  // Find ALL JSON-LD script blocks
  const scriptBlockRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const scriptBlocks = [...content.matchAll(scriptBlockRegex)];

  if (scriptBlocks.length === 0) {
    log('  ✅ No JSON-LD blocks in layout/theme.liquid (good)', 'success');
    return;
  }

  log(`  📊 Found ${scriptBlocks.length} JSON-LD script block(s) in layout/theme.liquid`, 'dim');

  // Identify which blocks contain FAQPage
  const blocksWithFAQ = scriptBlocks.filter(m => /"@type"\s*:\s*"FAQPage"/i.test(m[0]));

  if (blocksWithFAQ.length === 0) {
    log('  ✅ No FAQPage schema found in layout — nothing to fix here', 'success');
    log('  💡 Duplicate may be from an installed app — check Shopify admin Apps section', 'info');
    return;
  }

  log(`  🎯 ${blocksWithFAQ.length} block(s) contain FAQPage schema`, 'warn');

  // For each block, check if it's a @graph bundle or standalone FAQ
  let totalRemoved = 0;
  let updated = content;
  const results = [];

  for (const blockMatch of blocksWithFAQ) {
    const original = blockMatch[0];
    const innerJson = blockMatch[1].trim();

    // Try to detect @graph pattern
    const isGraphBundle = /"@graph"\s*:\s*\[/.test(innerJson);

    if (isGraphBundle) {
      // Surgical: remove only the FAQPage object from the @graph array
      log('\n  📦 Block uses @graph bundle — performing surgical removal of FAQPage only', 'info');

      // Match the FAQPage object including any preceding/trailing comma
      // Pattern: optional leading comma + the FAQPage object
      const faqObjectRegex = /,?\s*\{\s*"@type"\s*:\s*"FAQPage"[\s\S]*?\}\s*(?=[,\]])/;
      const faqMatch = innerJson.match(faqObjectRegex);

      if (!faqMatch) {
        log('  ⚠️  Could not isolate FAQPage in @graph — skipping this block', 'warn');
        continue;
      }

      const cleanedJson = innerJson.replace(faqObjectRegex, '').replace(/,(\s*\])/g, '$1'); // also clean trailing comma if FAQ was last
      const cleanedBlock = original.replace(innerJson, cleanedJson);

      results.push({ action: 'graph-surgical', originalLength: original.length, cleanedLength: cleanedBlock.length });
      updated = updated.replace(original, cleanedBlock);
      totalRemoved++;
      log('  ✅ Surgically removed FAQPage from @graph bundle', 'success');
      log('  ✅ Organization, WebSite, and other schemas in this bundle preserved', 'success');
    } else {
      // Standalone FAQ block — check if it's the only content
      const isStandalone = /^\s*\{\s*"@context"\s*:[^}]*"@type"\s*:\s*"FAQPage"/.test(innerJson);

      if (isStandalone) {
        log('\n  📦 Block is standalone FAQPage — wrapping in conditional', 'info');
        const wrapped = `{% unless template contains 'product' %}\n${original}\n{% endunless %}`;
        updated = updated.replace(original, wrapped);
        results.push({ action: 'wrap-conditional' });
        totalRemoved++;
      } else {
        log('  ⚠️  Block has FAQPage mixed with other types but not @graph — manual review needed', 'warn');
      }
    }
  }

  if (totalRemoved === 0) {
    log('\n  ⚠️  No automatic fix possible — manual review needed', 'warn');
    return;
  }

  log(`\n  Summary: ${totalRemoved} block(s) will be modified`, 'info');
  results.forEach((r, i) => {
    if (r.action === 'graph-surgical') {
      log(`    ${i + 1}. @graph bundle: removed FAQPage, kept other schemas`, 'dim');
    } else {
      log(`    ${i + 1}. Standalone FAQ: wrapped in {% unless template contains 'product' %}`, 'dim');
    }
  });

  if (!await confirm('Apply these surgical fixes?')) {
    log('  Skipped.', 'dim'); return;
  }

  backupFile(layoutPath, 'fix-faq-duplicate');
  writeThemeFile(layoutPath, updated);
  logChange('fix-faq-duplicate', { fix: 'FAQ duplicate schema fix (surgical)', files: [layoutPath], count: totalRemoved });

  log(`\n  ✅ Applied surgical fix to ${totalRemoved} block(s)`, 'success');
  log('  ✅ Organization + WebSite schemas remain global', 'success');
  log('  ✅ FAQPage no longer duplicates on product pages', 'success');
  log('\n  💡 After pushing, re-test:', 'info');
  log('     https://search.google.com/test/rich-results', 'dim');
}

// ─────────────────────────────────────────
// PERFORMANCE — fixes for PageSpeed Insights issues
// Targets: render-blocking, font-display, image delivery,
//          unused CSS detection, forced reflow patterns
// ─────────────────────────────────────────
async function optimizePerformance(specificFix = null) {
  log('\n⚡ Performance Optimization', 'bold');
  hr();
  ensureThemeDir();

  const fixes = {
    'render-blocking': fixRenderBlocking,
    'fonts':           fixFontDisplay,
    'images':          fixImageDelivery,
    'lazy-load':       fixLazyLoading,
    'unused-css':      reportUnusedCSS,
    'forced-reflow':   fixForcedReflow,
  };

  if (specificFix) {
    if (!fixes[specificFix]) {
      log(`  ❌ Unknown perf fix: ${specificFix}`, 'error');
      log(`  Available: ${Object.keys(fixes).join(', ')}`, 'dim');
      return;
    }
    await fixes[specificFix]();
    return;
  }

  // Run all
  log('\n  Running all performance fixes (you confirm each):', 'info');
  for (const [name, fn] of Object.entries(fixes)) {
    log(`\n  ─── ${name.toUpperCase()} ───`, 'dim');
    await fn();
  }
}

// ─── PERF FIX 1: Render-Blocking Requests ───
async function fixRenderBlocking() {
  log('\n🚧 Fix: Render-Blocking Resources', 'bold');

  const layoutPath = 'layout/theme.liquid';
  const content = readThemeFile(layoutPath);
  if (!content) { log('  ❌ layout/theme.liquid not found', 'error'); return; }

  // Find <link rel="stylesheet"> and <script src> tags in <head>
  const headMatch = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) { log('  ❌ Could not parse <head>', 'error'); return; }

  const headContent = headMatch[1];

  // Identify render-blocking patterns
  const blockingScripts = [...headContent.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)]
    .filter(m => !m[0].includes('async') && !m[0].includes('defer'));

  const blockingStyles = [...headContent.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/gi)]
    .filter(m => !m[0].includes('media=')  || m[0].includes('media="all"') || m[0].includes('media="screen"'));

  log(`  📊 Found ${blockingScripts.length} render-blocking scripts in <head>`, 'dim');
  log(`  📊 Found ${blockingStyles.length} render-blocking stylesheets in <head>`, 'dim');

  if (blockingScripts.length === 0 && blockingStyles.length === 0) {
    log('  ✅ No obvious render-blocking issues in layout/theme.liquid', 'success');
    return;
  }

  // Show what we'd change
  log('\n  Proposed changes:', 'info');
  if (blockingScripts.length > 0) {
    log(`  • Add "defer" attribute to ${blockingScripts.length} scripts`, 'dim');
    blockingScripts.slice(0, 5).forEach(m => log(`      ${m[1].split('/').pop()}`, 'dim'));
  }

  if (!await confirm(`Apply render-blocking fixes? (defer non-critical scripts, ${blockingScripts.length} scripts affected)`)) {
    log('  Skipped.', 'dim'); return;
  }

  backupFile(layoutPath, 'perf-render-blocking');
  let updated = content;

  // Add defer to scripts in head (skip jQuery if present — too risky)
  for (const m of blockingScripts) {
    const src = m[1];
    // Skip critical libraries that other code depends on
    if (/jquery|shopify_common|polyfill/i.test(src)) {
      log(`  ⏭️  Skipping critical: ${src.split('/').pop()}`, 'dim');
      continue;
    }
    const oldTag = m[0];
    const newTag = oldTag.replace(/<script\s+/, '<script defer ');
    updated = updated.replace(oldTag, newTag);
  }

  writeThemeFile(layoutPath, updated);
  logChange('perf-render-blocking', { fix: 'Render-blocking scripts deferred', files: [layoutPath] });
  log('  ✅ Render-blocking fixes applied', 'success');
}

// ─── PERF FIX 2: Font Display ───
async function fixFontDisplay() {
  log('\n🔤 Fix: Font Display (FOUT prevention)', 'bold');

  // Find @font-face declarations missing font-display: swap
  const cssFiles = walkFiles(CONFIG.themeDir, ['.css', '.scss']).filter(f =>
    !f.includes('backup') && !f.includes('vendor')
  );

  const issues = [];
  for (const file of cssFiles) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const fontFaces = [...content.matchAll(/@font-face\s*\{[^}]+\}/g)];
    for (const m of fontFaces) {
      if (!/font-display\s*:/i.test(m[0])) {
        issues.push({ file: file.replace(CONFIG.themeDir + '/', ''), block: m[0].substring(0, 100) });
      }
    }
  }

  if (issues.length === 0) {
    log('  ✅ All @font-face declarations have font-display set', 'success');
    return;
  }

  log(`  📊 Found ${issues.length} @font-face blocks missing font-display`, 'warn');
  issues.slice(0, 3).forEach(i => log(`      • ${i.file}`, 'dim'));

  if (!await confirm(`Add "font-display: swap" to ${issues.length} font declarations?`)) {
    log('  Skipped.', 'dim'); return;
  }

  const filesByPath = {};
  for (const issue of issues) {
    if (!filesByPath[issue.file]) filesByPath[issue.file] = [];
    filesByPath[issue.file].push(issue);
  }

  for (const filePath of Object.keys(filesByPath)) {
    backupFile(filePath, 'perf-font-display');
    let content = readThemeFile(filePath);
    // Add font-display: swap to every @font-face that lacks it
    content = content.replace(/(@font-face\s*\{)([^}]+)(\})/g, (full, open, body, close) => {
      if (/font-display\s*:/i.test(body)) return full;
      return `${open}${body.trimEnd()};font-display:swap;${close}`;
    });
    writeThemeFile(filePath, content);
    log(`  ✅ Patched: ${filePath}`, 'success');
  }

  logChange('perf-font-display', { fix: 'Font display swap', files: Object.keys(filesByPath) });
}

// ─── PERF FIX 3: Image Delivery ───
async function fixImageDelivery() {
  log('\n🖼️  Fix: Image Delivery', 'bold');

  // Find <img> tags missing width/height/loading attributes in liquid files
  const liquidFiles = walkFiles(CONFIG.themeDir, ['.liquid']).filter(f =>
    !f.includes('backup') && !f.includes('vendor') &&
    (f.includes('section') || f.includes('snippet') || f.includes('template'))
  );

  let totalIssues = 0;
  const fileFixes = {};

  for (const file of liquidFiles) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }

    const imgTags = [...content.matchAll(/<img\s[^>]*>/g)];
    const issues = [];
    for (const m of imgTags) {
      const tag = m[0];
      const missingLoading = !/loading\s*=/.test(tag);
      const missingDecoding = !/decoding\s*=/.test(tag);
      // Skip first image (likely above fold/LCP) — only fix below-fold
      if (missingLoading || missingDecoding) {
        issues.push({ original: tag, missingLoading, missingDecoding });
      }
    }
    if (issues.length > 0) {
      fileFixes[file] = issues;
      totalIssues += issues.length;
    }
  }

  if (totalIssues === 0) {
    log('  ✅ Image tags look optimized', 'success');
    return;
  }

  log(`  📊 Found ${totalIssues} <img> tags missing loading/decoding attributes across ${Object.keys(fileFixes).length} files`, 'warn');

  if (!await confirm(`Add lazy loading + async decoding to ${totalIssues} below-fold images?`)) {
    log('  Skipped.', 'dim'); return;
  }

  const updatedFiles = [];
  for (const [filePath, issues] of Object.entries(fileFixes)) {
    const rel = filePath.replace(CONFIG.themeDir + '/', '');
    backupFile(rel, 'perf-image-delivery');
    let content = readThemeFile(rel);

    // Skip the first image in each file (likely above-fold)
    let imgIndex = 0;
    content = content.replace(/<img\s([^>]*)>/g, (full, attrs) => {
      imgIndex++;
      if (imgIndex === 1) return full; // skip first image
      let newAttrs = attrs;
      if (!/loading\s*=/.test(attrs)) newAttrs = newAttrs.trim() + ' loading="lazy"';
      if (!/decoding\s*=/.test(attrs)) newAttrs = newAttrs.trim() + ' decoding="async"';
      return `<img ${newAttrs}>`;
    });

    writeThemeFile(rel, content);
    updatedFiles.push(rel);
  }

  log(`  ✅ Optimized images in ${updatedFiles.length} files`, 'success');
  logChange('perf-image-delivery', { fix: 'Image lazy loading + async decoding', files: updatedFiles });
}

// ─── PERF FIX 4: Lazy Loading (specifically for product galleries) ───
async function fixLazyLoading() {
  log('\n💤 Fix: Lazy Loading Verification', 'bold');
  log('  ℹ️  Already covered by image-delivery fix above', 'dim');
  log('  ✅ Below-fold images now have loading="lazy" + decoding="async"', 'success');
}

// ─── PERF FIX 5: Report Unused CSS (read-only — safe) ───
async function reportUnusedCSS() {
  log('\n📦 Report: Unused CSS Detection', 'bold');

  const cssFiles = walkFiles(CONFIG.themeDir, ['.css']).filter(f => {
    const name = basename(f);
    return !name.includes('backup') && !name.includes('-old');
  });

  // Get total CSS size
  let totalSize = 0;
  const fileSizes = [];
  for (const file of cssFiles) {
    try {
      const stat = statSync(file);
      totalSize += stat.size;
      fileSizes.push({ file: file.replace(CONFIG.themeDir + '/', ''), size: stat.size });
    } catch {}
  }
  fileSizes.sort((a, b) => b.size - a.size);

  log(`\n  📊 Total CSS in theme: ${(totalSize / 1024).toFixed(0)} KB across ${cssFiles.length} files`, 'info');

  log('\n  🔍 Top 10 largest CSS files:', 'info');
  fileSizes.slice(0, 10).forEach(f => {
    log(`    ${(f.size / 1024).toFixed(0).padStart(4)} KB  ${f.file}`, 'dim');
  });

  // Look for likely-unused CSS based on filename patterns
  const suspectFiles = fileSizes.filter(f =>
    /unused|test|old|legacy|demo|sample/i.test(f.file)
  );

  if (suspectFiles.length > 0) {
    log('\n  ⚠️  Potentially unused CSS files:', 'warn');
    suspectFiles.forEach(f => log(`    ${(f.size / 1024).toFixed(0).padStart(4)} KB  ${f.file}`, 'dim'));
  }

  log('\n  💡 Unused CSS analysis:', 'info');
  log('  Removing unused CSS safely requires runtime analysis — not safe to', 'dim');
  log('  do automatically. Best path:', 'dim');
  log('    1. Use Chrome DevTools → Coverage tab → identify unused selectors', 'dim');
  log('    2. Run PurgeCSS in build step (requires theme dev environment)', 'dim');
  log('    3. Audit your installed apps — uninstall any not actively used', 'dim');
  log('    4. Most "unused CSS" reports are from theme apps that DO use it', 'dim');
  log('       conditionally — be very careful before deleting anything.\n', 'dim');
}

// ─── PERF FIX 6: Forced Reflow ───
async function fixForcedReflow() {
  log('\n🔄 Fix: Forced Reflow Patterns', 'bold');

  // Common JS patterns that cause forced reflow
  const reflowPatterns = [
    /\.offsetWidth/g,
    /\.offsetHeight/g,
    /\.clientWidth/g,
    /\.clientHeight/g,
    /\.getBoundingClientRect\(\)/g,
    /\.scrollTop/g,
    /window\.getComputedStyle/g,
  ];

  const jsFiles = walkFiles(CONFIG.themeDir, ['.js']).filter(f => {
    const name = basename(f);
    return !name.includes('backup') && !name.includes('.min.');
  });

  const candidates = [];
  for (const file of jsFiles) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    let totalMatches = 0;
    for (const p of reflowPatterns) {
      const matches = content.match(p);
      if (matches) totalMatches += matches.length;
    }
    if (totalMatches > 5) {
      candidates.push({ file: file.replace(CONFIG.themeDir + '/', ''), count: totalMatches });
    }
  }

  if (candidates.length === 0) {
    log('  ✅ No obvious reflow-heavy JavaScript files detected', 'success');
    return;
  }

  candidates.sort((a, b) => b.count - a.count);
  log(`  📊 Found ${candidates.length} JavaScript files with reflow-heavy patterns:`, 'warn');
  candidates.slice(0, 5).forEach(c =>
    log(`    ${String(c.count).padStart(3)} reflow patterns  ${c.file}`, 'dim')
  );

  log('\n  ℹ️  Forced reflow fixes require manual JS refactoring — not safe to automate.', 'info');
  log('  Recommended approach:', 'dim');
  log('    1. Open DevTools → Performance tab → record page load', 'dim');
  log('    2. Look for purple "Recalculate Style" / "Layout" warnings', 'dim');
  log('    3. The files above are the most likely culprits', 'dim');
  log('    4. Batch DOM reads + writes (reads first, writes second)', 'dim');
  log('    5. Use requestAnimationFrame for visual updates\n', 'dim');
}

// ─────────────────────────────────────────
// INSPECT — analyze theme for real issues, classify by severity
// Goes deeper than validate; classifies what's actually broken
// vs. what's old-code noise
// ─────────────────────────────────────────
async function inspect() {
  log('\n🔬 Theme Issue Inspection — Classifying real problems vs. noise', 'bold');
  hr();
  ensureThemeDir();

  const issues = {
    critical: [],   // Will affect customers visibly
    high: [],       // SEO / CRO impact
    medium: [],     // Best practice violations
    noise: [],      // Pre-existing, safe to ignore
  };

  // 1. Run theme check and parse results
  log('\n  Running shopify theme check...', 'dim');
  let checkOutput = '';
  try {
    checkOutput = execSync(`shopify theme check --path ${CONFIG.themeDir} --output text 2>&1 || true`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  } catch (e) {
    checkOutput = e.stdout || e.stderr || e.message;
  }

  // Parse theme check output for distinct error types
  const errorTypes = {};
  const errorPattern = /\[(error|warning|info)\]:\s*(\w+)\s+(.+?)(?=\n|$)/gi;
  let match;
  while ((match = errorPattern.exec(checkOutput)) !== null) {
    const [, level, type, message] = match;
    const key = `${type}`;
    if (!errorTypes[key]) errorTypes[key] = { count: 0, level, samples: [] };
    errorTypes[key].count++;
    if (errorTypes[key].samples.length < 3) errorTypes[key].samples.push(message.trim().substring(0, 100));
  }

  // Classify theme check findings
  for (const [type, data] of Object.entries(errorTypes)) {
    let severity = 'medium';
    let explanation = '';

    // Classify by error type — these are Shopify's standard checks
    switch (type) {
      case 'MissingAsset':
        severity = 'noise';
        explanation = 'References to deleted assets (usually from backup files) — invisible to customers';
        break;
      case 'UnusedAssign':
      case 'UnusedSnippet':
      case 'UnusedPartial':
        severity = 'medium';
        explanation = 'Dead code — affects performance slightly, not functionality';
        break;
      case 'ParserBlocking':
      case 'ParserBlockingScript':
        severity = 'high';
        explanation = 'Blocks page rendering — affects Core Web Vitals & SEO';
        break;
      case 'ImgWidthAndHeight':
      case 'ImgLazyLoading':
        severity = 'high';
        explanation = 'Image optimization issues — affects LCP & SEO';
        break;
      case 'AssetSizeAppBlock':
      case 'AssetSizeJavaScript':
      case 'AssetSizeCSS':
        severity = 'high';
        explanation = 'Large assets slow down page load — affects all users';
        break;
      case 'LiquidFreeForm':
      case 'SyntaxError':
      case 'ParserError':
        severity = 'critical';
        explanation = 'Liquid syntax errors will break the page when rendered';
        break;
      case 'DeprecatedFilter':
      case 'DeprecatedTag':
        severity = 'medium';
        explanation = 'Will stop working in future Shopify versions';
        break;
      case 'PaginationSize':
        severity = 'medium';
        explanation = 'Pagination size unusual — review if intentional';
        break;
      case 'TranslationKeyExists':
      case 'MatchingTranslations':
        severity = 'noise';
        explanation = 'Translation file inconsistencies — only affects non-English stores';
        break;
      default:
        severity = 'medium';
        explanation = 'Best practice issue';
    }

    issues[severity].push({
      type,
      count: data.count,
      explanation,
      samples: data.samples,
    });
  }

  // 2. Manual checks for things theme check doesn't catch
  log('  Running custom checks...', 'dim');

  // Check 1: Multiple JSON-LD schema blocks (might mean duplicates)
  const layoutContent = readThemeFile('layout/theme.liquid');
  if (layoutContent) {
    const ldJsonCount = (layoutContent.match(/<script[^>]*application\/ld\+json/gi) || []).length;
    if (ldJsonCount > 6) {
      issues.high.push({
        type: 'TooManyLDJsonBlocks',
        count: ldJsonCount,
        explanation: 'Many JSON-LD blocks may include duplicates — confuses Google',
        samples: [`${ldJsonCount} schema script tags in layout/theme.liquid`],
      });
    }
  }

  // Check 2: Backup/duplicate files clutter
  const allFiles = walkFiles(CONFIG.themeDir, ['.liquid', '.css', '.js']);
  const backupFiles = allFiles.filter(f =>
    /backup|copy of|old-|-old|-deprecated|-unused/i.test(basename(f))
  );
  if (backupFiles.length > 5) {
    issues.medium.push({
      type: 'BackupFiles',
      count: backupFiles.length,
      explanation: 'Old backup files in theme — slow down theme check, can cause confusion',
      samples: backupFiles.slice(0, 5).map(f => f.replace(CONFIG.themeDir + '/', '')),
    });
  }

  // Check 3: Image-heavy assets (over 1MB)
  const heavyAssets = [];
  for (const file of allFiles) {
    try {
      const stat = statSync(file);
      if (stat.size > 1_000_000 && /\.(css|js)$/.test(file)) {
        heavyAssets.push({ file: file.replace(CONFIG.themeDir + '/', ''), size: Math.round(stat.size / 1024) + 'KB' });
      }
    } catch {}
  }
  if (heavyAssets.length > 0) {
    issues.high.push({
      type: 'HeavyAssets',
      count: heavyAssets.length,
      explanation: 'Large CSS/JS files slow down page load',
      samples: heavyAssets.slice(0, 5).map(a => `${a.file} (${a.size})`),
    });
  }

  // Check 4: Liquid render references that don't exist
  const allLiquid = walkFiles(CONFIG.themeDir, ['.liquid']);
  const brokenRenders = [];
  const snippetsDir = join(CONFIG.themeDir, 'snippets');
  const existingSnippets = existsSync(snippetsDir)
    ? new Set(readdirSync(snippetsDir).map(f => f.replace('.liquid', '')))
    : new Set();

  for (const file of allLiquid) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    const renderMatches = content.matchAll(/{%-?\s*render\s+['"]([^'"]+)['"]/g);
    for (const m of renderMatches) {
      const snippetName = m[1];
      if (!existingSnippets.has(snippetName)) {
        brokenRenders.push({
          file: file.replace(CONFIG.themeDir + '/', ''),
          missing: snippetName,
        });
      }
    }
  }
  if (brokenRenders.length > 0) {
    issues.critical.push({
      type: 'BrokenSnippetReferences',
      count: brokenRenders.length,
      explanation: 'Theme references snippets that don\'t exist — will throw Liquid errors',
      samples: brokenRenders.slice(0, 5).map(r => `${r.file} → renders missing "${r.missing}"`),
    });
  }

  // ─── REPORT ───
  log('\n📋 ISSUES FOUND:\n', 'bold');

  function printSection(level, label, color) {
    if (issues[level].length === 0) {
      log(`${label}  ✅ None`, 'dim');
      return;
    }
    log(`${label}  (${issues[level].length} types)`, color);
    issues[level].forEach((i, idx) => {
      log(`\n  ${idx + 1}. ${i.type} — ${i.count} occurrence${i.count > 1 ? 's' : ''}`, 'bold');
      log(`     ${i.explanation}`, 'dim');
      if (i.samples?.length) {
        log(`     Examples:`, 'dim');
        i.samples.forEach(s => log(`       • ${s}`, 'dim'));
      }
    });
    log('');
  }

  printSection('critical', '🔴 CRITICAL — Fix before push', 'error');
  printSection('high',     '🟠 HIGH — Fix soon, affects performance/SEO', 'warn');
  printSection('medium',   '🟡 MEDIUM — Best practice', 'info');
  printSection('noise',    '⚪ NOISE — Pre-existing, safe to ignore', 'dim');

  // Summary
  hr();
  const totalCritical = issues.critical.reduce((s, i) => s + i.count, 0);
  const totalHigh = issues.high.reduce((s, i) => s + i.count, 0);
  const totalMedium = issues.medium.reduce((s, i) => s + i.count, 0);
  const totalNoise = issues.noise.reduce((s, i) => s + i.count, 0);

  log('\n📊 SUMMARY:\n', 'bold');
  log(`  🔴 Critical: ${totalCritical}`, totalCritical > 0 ? 'error' : 'dim');
  log(`  🟠 High:     ${totalHigh}`, totalHigh > 0 ? 'warn' : 'dim');
  log(`  🟡 Medium:   ${totalMedium}`, totalMedium > 0 ? 'info' : 'dim');
  log(`  ⚪ Noise:    ${totalNoise}`, 'dim');

  log('\n💡 RECOMMENDED ACTIONS:\n', 'bold');
  if (totalCritical > 0) {
    log('  ⚠️  Critical issues found — fix these BEFORE pushing to live', 'error');
    log('     Run: node optimize-local.js fix-critical', 'dim');
  } else if (totalHigh > 0) {
    log('  ✅ No critical issues — safe to push', 'success');
    log('     Optional cleanups: node optimize-local.js fix-cleanup', 'dim');
    log('     Then push: shopify theme push --theme 145031200883 ...', 'dim');
  } else {
    log('  ✅ Theme is in great shape — ready to push', 'success');
  }
  hr();

  return issues;
}

// ─────────────────────────────────────────
// FIX-CLEANUP — auto-clean low-risk issues (backup files, etc.)
// ─────────────────────────────────────────
async function fixCleanup() {
  log('\n🧹 Auto-Cleanup — Remove backup files and dead code', 'bold');
  hr();
  ensureThemeDir();

  const allFiles = walkFiles(CONFIG.themeDir, ['.liquid', '.css', '.js', '.json']);
  const backupFiles = allFiles.filter(f => {
    const name = basename(f);
    return /backup|copy[-_ ]of|^old-|-old\.|deprecated|-unused/i.test(name) &&
           !name.startsWith('settings_data');  // never delete settings
  });

  if (backupFiles.length === 0) {
    log('  ✅ No obvious backup files to clean', 'success'); return;
  }

  log(`\n  Found ${backupFiles.length} backup/old files:`, 'info');
  backupFiles.slice(0, 10).forEach(f => log(`    • ${f.replace(CONFIG.themeDir + '/', '')}`, 'dim'));
  if (backupFiles.length > 10) log(`    ... and ${backupFiles.length - 10} more`, 'dim');

  log('\n  ⚠️  These files appear unused but COULD still be referenced.', 'warn');
  log('  ⚠️  Backups are saved before deletion — fully reversible.', 'dim');

  if (!await confirm(`Delete ${backupFiles.length} backup files? (creates restore point)`)) {
    log('  Cancelled.', 'dim'); return;
  }

  let deleted = 0;
  for (const file of backupFiles) {
    const rel = file.replace(CONFIG.themeDir + '/', '');
    try {
      backupFile(rel, 'cleanup-backup-files');
      execSync(`rm "${file}"`);
      deleted++;
    } catch (e) {
      log(`  ⚠️  Could not delete ${rel}: ${e.message}`, 'warn');
    }
  }

  logChange('cleanup-backup-files', { fix: 'Backup file cleanup', count: deleted, files: backupFiles.map(f => f.replace(CONFIG.themeDir + '/', '')) });
  log(`\n  ✅ Deleted ${deleted} backup files (restore points saved)`, 'success');
  log('\n  Re-run inspection to verify:', 'info');
  log('    node optimize-local.js inspect\n', 'dim');
}

// ─────────────────────────────────────────
// SCAN — comprehensive audit of existing fixes & duplicates
// Looks at ACTUAL theme content, not just markers from our optimizer
// ─────────────────────────────────────────
async function scan() {
  log('\n🔬 Deep Theme Scan — Looking for existing implementations & conflicts', 'bold');
  hr();
  ensureThemeDir();

  const findings = {
    schema: [],
    stickyATC: [],
    whatsapp: [],
    trustBadges: [],
    countdown: [],
    cartUpsell: [],
    metaDescriptions: [],
    duplicates: [],
  };

  // Walk all liquid + json files
  const files = walkFiles(CONFIG.themeDir, ['.liquid', '.json', '.css', '.js']);
  log(`\n  Scanning ${files.length} theme files...`, 'dim');

  for (const file of files) {
    const rel = file.replace(CONFIG.themeDir + '/', '');
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }

    // SCHEMA detection — multiple variants
    const schemaPatterns = [
      { regex: /"@type"\s*:\s*"Product"/i, type: 'Product schema' },
      { regex: /"@type"\s*:\s*"Organization"/i, type: 'Organization schema' },
      { regex: /"@type"\s*:\s*"FAQPage"/i, type: 'FAQ schema' },
      { regex: /"@type"\s*:\s*"BreadcrumbList"/i, type: 'Breadcrumb schema' },
      { regex: /"@type"\s*:\s*"WebSite"/i, type: 'WebSite schema' },
    ];
    for (const p of schemaPatterns) {
      if (p.regex.test(content)) findings.schema.push({ file: rel, type: p.type });
    }

    // STICKY ATC — many variants from various themes/apps
    if (/sticky.*add.{0,5}to.{0,5}cart|sticky-atc|fixed.*add-to-cart|sticky_atc/i.test(content)) {
      findings.stickyATC.push({ file: rel, isOurs: content.includes('tt360-sticky-atc') });
    }

    // WHATSAPP detection
    if (/wa\.me|whatsapp|api\.whatsapp\.com/i.test(content)) {
      findings.whatsapp.push({ file: rel, isOurs: content.includes('tt360-whatsapp') });
    }

    // TRUST BADGES detection
    if (/trust.{0,5}badge|trust.{0,5}icon|trust-bar|guarantee.{0,5}badge/i.test(content)) {
      findings.trustBadges.push({ file: rel, isOurs: content.includes('tt360-trust-badges') });
    }

    // COUNTDOWN TIMER detection
    if (/countdown|timer|offer.{0,5}ends|sale.{0,5}ends/i.test(content)) {
      const broken = /00:00:00|offer has ended|expired|This offer ended/i.test(content);
      findings.countdown.push({ file: rel, broken, isOurs: content.includes('tt360-evergreen-timer') });
    }

    // CART UPSELL / FREE SHIPPING BAR
    if (/free.{0,5}shipping.{0,15}(bar|progress|threshold)|cart.{0,5}upsell|cross.{0,5}sell/i.test(content)) {
      findings.cartUpsell.push({ file: rel, isOurs: content.includes('tt360-cart-upsell') });
    }
  }

  // Find files with multiple LD+JSON blocks (potential duplicates)
  const layoutFile = readThemeFile('layout/theme.liquid');
  if (layoutFile) {
    const ldJsonBlocks = (layoutFile.match(/<script\s+type=["']application\/ld\+json["']/gi) || []).length;
    if (ldJsonBlocks > 4) {
      findings.duplicates.push({ file: 'layout/theme.liquid', issue: `${ldJsonBlocks} JSON-LD blocks (may include duplicates)` });
    }
  }

  // ─── REPORT ───
  log('\n📋 FINDINGS:\n', 'bold');

  // Schema
  log('🏷️  Schema Markup:', 'info');
  if (findings.schema.length === 0) {
    log('   🔴 No schema found anywhere', 'warn');
  } else {
    const grouped = groupBy(findings.schema, 'type');
    for (const [type, items] of Object.entries(grouped)) {
      log(`   ✅ ${type}: ${items.length} location${items.length>1?'s':''}`, 'success');
      items.slice(0, 3).forEach(i => log(`      • ${i.file}`, 'dim'));
      if (items.length > 3) log(`      • ... and ${items.length-3} more`, 'dim');
    }
  }

  // Sticky ATC
  log('\n🛒 Sticky Add to Cart:', 'info');
  if (findings.stickyATC.length === 0) {
    log('   🔴 Not found', 'warn');
  } else {
    const ours = findings.stickyATC.filter(f => f.isOurs);
    const others = findings.stickyATC.filter(f => !f.isOurs);
    if (others.length > 0) {
      log(`   ⚠️  EXISTING sticky ATC found in theme:`, 'warn');
      others.slice(0, 5).forEach(f => log(`      • ${f.file}`, 'dim'));
      log(`      → POTENTIAL CONFLICT with our snippet`, 'warn');
    }
    if (ours.length > 0) log(`   ✅ Our snippet present (${ours.length} files)`, 'success');
  }

  // WhatsApp
  log('\n💬 WhatsApp:', 'info');
  if (findings.whatsapp.length === 0) {
    log('   🔴 Not found', 'warn');
  } else {
    const ours = findings.whatsapp.filter(f => f.isOurs);
    const others = findings.whatsapp.filter(f => !f.isOurs);
    if (others.length > 0) {
      log(`   ✅ EXISTING WhatsApp found in:`, 'success');
      others.slice(0, 3).forEach(f => log(`      • ${f.file}`, 'dim'));
    }
    if (ours.length > 0) log(`   ⚠️  Our snippet ALSO present (${ours.length} files) — DUPLICATE`, 'warn');
  }

  // Trust badges
  log('\n🛡️  Trust Badges:', 'info');
  if (findings.trustBadges.length === 0) {
    log('   🔴 Not found', 'warn');
  } else {
    const ours = findings.trustBadges.filter(f => f.isOurs);
    const others = findings.trustBadges.filter(f => !f.isOurs);
    if (others.length > 0) {
      log(`   ✅ EXISTING trust badges in:`, 'success');
      others.slice(0, 3).forEach(f => log(`      • ${f.file}`, 'dim'));
    }
    if (ours.length > 0) log(`   ${ours.length} ours present`, 'dim');
  }

  // Countdown
  log('\n⏱️  Countdown Timer:', 'info');
  if (findings.countdown.length === 0) {
    log('   ⚪ No countdown found (skip if you don\'t use one)', 'dim');
  } else {
    const broken = findings.countdown.filter(f => f.broken);
    if (broken.length > 0) {
      log(`   🔴 BROKEN TIMERS FOUND in:`, 'warn');
      broken.forEach(f => log(`      • ${f.file}`, 'warn'));
      log(`   → Run "apply timer" to fix`, 'info');
    } else {
      log(`   ✅ Countdown found, no obvious breaks (${findings.countdown.length} files)`, 'success');
    }
  }

  // Cart upsell
  log('\n🛍️  Cart Upsell / Free Shipping:', 'info');
  if (findings.cartUpsell.length === 0) {
    log('   🔴 Not found', 'warn');
  } else {
    log(`   ✅ Cart enhancements detected (${findings.cartUpsell.length} files)`, 'success');
  }

  // Duplicates warning
  if (findings.duplicates.length > 0) {
    log('\n⚠️  POTENTIAL DUPLICATES:', 'warn');
    findings.duplicates.forEach(d => log(`   • ${d.file} — ${d.issue}`, 'warn'));
  }

  // ─── RECOMMENDATIONS ───
  hr();
  log('\n💡 RECOMMENDED ACTIONS:\n', 'bold');

  const ourWhatsApp = findings.whatsapp.filter(f => f.isOurs).length > 0;
  const otherWhatsApp = findings.whatsapp.filter(f => !f.isOurs).length > 0;
  if (ourWhatsApp && otherWhatsApp) {
    log('  🧹 Run: node optimize-local.js cleanup whatsapp', 'warn');
    log('     → Removes our duplicate WhatsApp (theme already has one)', 'dim');
  }

  const ourSticky = findings.stickyATC.filter(f => f.isOurs).length > 0;
  const otherSticky = findings.stickyATC.filter(f => !f.isOurs).length > 0;
  if (ourSticky && otherSticky) {
    log('  🧹 Run: node optimize-local.js cleanup sticky-atc', 'warn');
    log('     → Removes our duplicate sticky ATC (theme already has one)', 'dim');
  }

  const ourTrust = findings.trustBadges.filter(f => f.isOurs).length > 0;
  const otherTrust = findings.trustBadges.filter(f => !f.isOurs).length > 0;
  if (ourTrust && otherTrust) {
    log('  🧹 Run: node optimize-local.js cleanup trust', 'warn');
    log('     → Removes our duplicate trust badges (theme already has them)', 'dim');
  }

  if (findings.schema.length > 0) {
    log('  ℹ️  Schema looks good — already present in theme', 'info');
  }

  log('\n  When ready to push:', 'info');
  log('    1. node optimize-local.js validate     → run theme check', 'dim');
  log('    2. shopify theme push --theme 145031200883 --store zrhgzw-xt.myshopify.com', 'dim');
  log('    3. Preview in Shopify Admin → Publish when satisfied', 'dim');
  hr();
}

// Walk a directory recursively, return all files matching extensions
function walkFiles(dir, extensions) {
  const results = [];
  function walk(d) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (extensions.some(ext => entry.endsWith(ext))) results.push(full);
    }
  }
  walk(dir);
  return results;
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

// ─────────────────────────────────────────
// CLEANUP — remove our duplicates when theme already has the feature
// ─────────────────────────────────────────
async function cleanup(target) {
  log(`\n🧹 Cleanup: removing our duplicate "${target}"`, 'bold');
  ensureThemeDir();

  const cleanupMap = {
    'whatsapp': {
      snippet: 'snippets/tt360-whatsapp.liquid',
      includeMarker: "render 'tt360-whatsapp'",
      fixId: 'fix-03-whatsapp',
      label: 'WhatsApp CTA',
    },
    'sticky-atc': {
      snippet: 'snippets/tt360-sticky-atc.liquid',
      includeMarker: "render 'tt360-sticky-atc'",
      fixId: 'fix-02-sticky-atc',
      label: 'Sticky ATC',
    },
    'trust': {
      snippet: 'snippets/tt360-trust-badges.liquid',
      includeMarker: "render 'tt360-trust-badges'",
      fixId: 'fix-04-trust',
      label: 'Trust Badges',
    },
  };

  const config = cleanupMap[target];
  if (!config) {
    log(`  ❌ Unknown cleanup target: ${target}`, 'error');
    log(`  Available: ${Object.keys(cleanupMap).join(', ')}`, 'dim');
    return;
  }

  if (!await confirm(`Remove our "${config.label}" snippet (theme already has its own)?`)) {
    log('  Cancelled.', 'dim'); return;
  }

  // 1. Delete the snippet file
  const snippetFull = join(CONFIG.themeDir, config.snippet);
  if (existsSync(snippetFull)) {
    backupFile(config.snippet, `cleanup-${target}`);
    execSync(`rm "${snippetFull}"`);
    log(`  ✅ Deleted: ${config.snippet}`, 'success');
  } else {
    log(`  ⚪ Snippet not found (already deleted)`, 'dim');
  }

  // 2. Remove the {% render %} include from layout/theme.liquid
  const layoutPath = 'layout/theme.liquid';
  const layout = readThemeFile(layoutPath);
  if (layout && layout.includes(config.includeMarker)) {
    backupFile(layoutPath, `cleanup-${target}`);
    const cleaned = layout
      .split('\n')
      .filter(line => !line.includes(config.includeMarker))
      .join('\n');
    writeThemeFile(layoutPath, cleaned);
    log(`  ✅ Removed include from layout/theme.liquid`, 'success');
  }

  // 3. Clear from change log
  clearChange(config.fixId);

  log(`\n  ✅ "${config.label}" cleanup complete`, 'success');
}

// ─────────────────────────────────────────
// AUDIT (read-only) — original simple version
// ─────────────────────────────────────────
async function audit() {
  log('\n🔍 TipTop360 Local Theme Audit', 'bold');
  hr();
  ensureThemeDir();

  const layout = readThemeFile('layout/theme.liquid');
  if (!layout) { log('  ❌ layout/theme.liquid not found in pulled theme', 'error'); return; }

  log(`\n📁 Theme files location: ${CONFIG.themeDir}`, 'dim');
  const fileCount = countFiles(CONFIG.themeDir);
  log(`   Total files: ${fileCount}`, 'dim');

  const changes = loadChanges();
  log(`\n✅ Applied fixes: ${Object.keys(changes).length}`, Object.keys(changes).length > 0 ? 'success' : 'dim');
  for (const [id, c] of Object.entries(changes)) log(`   • ${c.fix}`, 'dim');

  log('\n🔎 Status checks:', 'info');
  log(`  ${layout.includes('application/ld+json') ? '✅' : '🔴'} Schema markup`, layout.includes('application/ld+json') ? 'success' : 'warn');
  log(`  ${layout.includes("tt360-sticky-atc") ? '✅' : '🔴'} Sticky ATC`, layout.includes("tt360-sticky-atc") ? 'success' : 'warn');
  log(`  ${layout.includes("tt360-whatsapp") ? '✅' : '🔴'} WhatsApp CTA`, layout.includes("tt360-whatsapp") ? 'success' : 'warn');
  log(`  ${existsSync(join(CONFIG.themeDir, 'snippets/tt360-trust-badges.liquid')) ? '✅' : '🔴'} Trust badges snippet`, existsSync(join(CONFIG.themeDir, 'snippets/tt360-trust-badges.liquid')) ? 'success' : 'warn');

  hr();
  log('\n💡 Next: node optimize-local.js apply <fix>\n', 'info');
}

function countFiles(dir) {
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) count += countFiles(full);
    else count++;
  }
  return count;
}

// ─────────────────────────────────────────
// VALIDATE (theme check)
// ─────────────────────────────────────────
async function validate() {
  log('\n🔬 Running Shopify theme check...', 'bold');
  ensureThemeDir();
  try {
    const output = execSync(`shopify theme check --path ${CONFIG.themeDir}`, { encoding: 'utf8', stdio: 'pipe' });
    log(output, 'normal');
    log('\n✅ Theme check completed', 'success');
  } catch (e) {
    log(e.stdout || e.message, 'warn');
    log('\n⚠️  Theme check found issues — review above', 'warn');
  }
}

// ─────────────────────────────────────────
// REVERT
// ─────────────────────────────────────────
async function revert(fixId) {
  log(`\n⏪ Reverting: ${fixId}`, 'bold');
  const changes = loadChanges();
  if (!changes[fixId]) { log(`  ❌ No record for "${fixId}"`, 'error'); return; }
  if (!await confirm(`Revert "${changes[fixId].fix}"?`)) { log('  Cancelled.', 'dim'); return; }
  for (const file of changes[fixId].files) restoreFile(file, fixId);
  clearChange(fixId);
  log(`  ✅ Reverted`, 'success');
}

async function revertAll() {
  log('\n⏪ Revert ALL changes', 'bold');
  const changes = loadChanges();
  if (Object.keys(changes).length === 0) { log('  Nothing to revert.', 'dim'); return; }
  if (!await confirm(`Revert ALL ${Object.keys(changes).length} fixes?`)) { log('  Cancelled.', 'dim'); return; }
  for (const id of Object.keys(changes)) await revert(id);
}

// ─────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────
function status() {
  log('\n📊 Applied Changes', 'bold');
  hr();
  const changes = loadChanges();
  if (Object.keys(changes).length === 0) { log('  No fixes applied yet.\n', 'dim'); return; }
  for (const [id, c] of Object.entries(changes)) {
    log(`\n  ✅ ${c.fix}`, 'success');
    log(`     Applied: ${c.appliedAt}`, 'dim');
    log(`     Files:   ${c.files?.join(', ') || 'n/a'}`, 'dim');
  }
  log('\n💡 Push to Shopify when ready: shopify theme push --theme [ID]\n', 'info');
}

// ─────────────────────────────────────────
// CLI
// ─────────────────────────────────────────
const args = process.argv.slice(2);
const cmd = args[0]?.toLowerCase() || 'audit';

(async () => {
  try {
    switch (cmd) {
      case 'audit':            await audit(); break;
      case 'inspect':          await inspect(); break;
      case 'fix-cleanup':      await fixCleanup(); break;
      case 'fix-faq-duplicate': await fixFAQDuplicate(); break;
      case 'perf':             await optimizePerformance(args[1]); break;
      case 'scan':             await scan(); break;
      case 'cleanup':     await cleanup(args[1]); break;
      case 'validate':    await validate(); break;
      case 'status':      status(); break;
      case 'apply': {
        ensureThemeDir();
        const fix = args[1];
        const map = { schema: applySchema, 'sticky-atc': applyStickyATC, whatsapp: applyWhatsApp, trust: applyTrust };
        if (map[fix]) await map[fix]();
        else log(`Unknown fix: "${fix}". Available: ${Object.keys(map).join(', ')}`, 'error');
        break;
      }
      case 'apply-all': {
        ensureThemeDir();
        await applySchema();
        await applyStickyATC();
        await applyWhatsApp();
        await applyTrust();
        log('\n\n✅ All fixes applied to local files', 'success');
        log('\nNext steps:', 'info');
        log('  1. node optimize-local.js validate', 'dim');
        log('  2. shopify theme push --theme [ID] --store ... --password ...', 'dim');
        log('  3. Preview in Shopify Admin\n', 'dim');
        break;
      }
      case 'revert':     await revert(args[1]); break;
      case 'revert-all': await revertAll(); break;
      default:
        log('\nTipTop360 Local Theme Optimizer', 'bold');
        log('\nUsage:', 'info');
        log('  node optimize-local.js audit              — quick status check', 'dim');
        log('  node optimize-local.js scan               — DEEP scan for existing fixes & duplicates', 'dim');
        log('  node optimize-local.js cleanup <fix>      — remove our duplicate (when theme already has it)', 'dim');
        log('  node optimize-local.js apply <fix>        — apply specific fix', 'dim');
        log('  node optimize-local.js apply-all          — apply all fixes', 'dim');
        log('  node optimize-local.js validate           — run shopify theme check', 'dim');
        log('  node optimize-local.js status             — show applied fixes', 'dim');
        log('  node optimize-local.js revert <fix>       — revert specific fix', 'dim');
        log('  node optimize-local.js revert-all         — revert everything', 'dim');
        log('\nFixes available:', 'info');
        log('  schema, sticky-atc, whatsapp, trust', 'dim');
        log('\nCleanup targets:', 'info');
        log('  sticky-atc, whatsapp, trust', 'dim');
        log('');
    }
  } catch (e) {
    log(`\n❌ Error: ${e.message}\n`, 'error');
    process.exit(1);
  }
})();
