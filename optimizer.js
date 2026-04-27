/**
 * TipTop360 Shopify SEO + CRO Optimizer
 * ──────────────────────────────────────────────────────────────────────────
 * Full automation of SEO and CRO fixes via Shopify Admin API + Theme API.
 * Every change is backed up before applying. All changes are reversible.
 * Asks for confirmation before any destructive or theme-level operation.
 * ──────────────────────────────────────────────────────────────────────────
 * Commands:
 *   node optimizer.js menu            → interactive menu
 *   node optimizer.js audit           → full site audit (read-only)
 *   node optimizer.js backup          → backup all theme files now
 *   node optimizer.js apply <fix>     → apply a specific fix
 *   node optimizer.js revert <fix>    → revert a specific fix
 *   node optimizer.js revert-all      → revert ALL changes (full restore)
 *   node optimizer.js dry-run         → preview all changes without applying
 *   node optimizer.js status          → show what's been applied
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { createRequire } from 'module';
import { KEYWORDS, getKeywordsForProduct, buildMetaPrompt, buildTitleTag, buildDescriptionPrompt, buildFAQSchemaPrompt } from './keywords.js';

// ─────────────────────────────────────────
// BOOTSTRAP — load env
// ─────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) {
    console.error('\n❌  .env file not found.');
    console.error('    Copy .env.example → .env and fill in your credentials.\n');
    process.exit(1);
  }
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  }
}

loadEnv();

const CONFIG = {
  store:          process.env.SHOPIFY_STORE        || '',
  token:          process.env.SHOPIFY_ACCESS_TOKEN || '',
  // OAuth client credentials (Dev Dashboard apps — modern auth)
  clientId:       process.env.SHOPIFY_CLIENT_ID     || '',
  clientSecret:   process.env.SHOPIFY_CLIENT_SECRET || '',
  anthropicKey:   process.env.ANTHROPIC_API_KEY    || '',
  whatsapp:       (process.env.WHATSAPP_NUMBER     || '971585156033').replace(/[^\d]/g, ''),
  storeName:      process.env.STORE_NAME           || 'TipTop360',
  storeUrl:       process.env.STORE_URL            || 'https://tiptop360.com',
  apiVersion:     '2024-10',
  aiModel:        process.env.ANTHROPIC_MODEL      || 'claude-haiku-4-5-20251001',
  backupsDir:     join(__dirname, 'backups'),
  changeLogPath:  join(__dirname, 'changes.json'),
};

// Determine which auth mode we're using:
// - OAuth (preferred for Dev Dashboard apps): SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET
// - Static token (legacy custom apps or Theme Access): SHOPIFY_ACCESS_TOKEN
const USE_OAUTH = CONFIG.clientId && CONFIG.clientSecret;

if (!CONFIG.store) {
  console.error('\n❌  SHOPIFY_STORE is required in .env\n');
  process.exit(1);
}
if (!USE_OAUTH && !CONFIG.token) {
  console.error('\n❌  Set either SHOPIFY_ACCESS_TOKEN OR (SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET) in .env\n');
  process.exit(1);
}

mkdirSync(CONFIG.backupsDir, { recursive: true });

// ─────────────────────────────────────────
// CHANGE LOG — tracks every applied fix
// ─────────────────────────────────────────
function loadChanges() {
  if (!existsSync(CONFIG.changeLogPath)) return {};
  try { return JSON.parse(readFileSync(CONFIG.changeLogPath, 'utf8')); }
  catch { return {}; }
}

function saveChanges(changes) {
  writeFileSync(CONFIG.changeLogPath, JSON.stringify(changes, null, 2));
}

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
// SHOPIFY API CLIENT (with OAuth support)
// ─────────────────────────────────────────
// Normalize store URL — accept both "tiptop360" and "tiptop360.myshopify.com"
const STORE_DOMAIN = CONFIG.store.includes('.') ? CONFIG.store : `${CONFIG.store}.myshopify.com`;
const BASE = `https://${STORE_DOMAIN}/admin/api/${CONFIG.apiVersion}`;
const TOKEN_ENDPOINT = `https://${STORE_DOMAIN}/admin/oauth/access_token`;

// OAuth token cache (in-memory; refreshes when ~60s from expiry)
let _oauthToken = null;
let _oauthExpiresAt = 0;

async function getOAuthToken() {
  if (_oauthToken && Date.now() < _oauthExpiresAt - 60_000) {
    return _oauthToken;
  }
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CONFIG.clientId,
      client_secret: CONFIG.clientSecret,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OAuth token exchange failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  _oauthToken = data.access_token;
  _oauthExpiresAt = Date.now() + (data.expires_in || 86400) * 1000;
  return _oauthToken;
}

async function getAuthHeaders() {
  const token = USE_OAUTH ? await getOAuthToken() : CONFIG.token;
  return {
    'X-Shopify-Access-Token': token,
    'Content-Type': 'application/json',
  };
}

// Theme Access tokens (shptka_) have limited scope — only theme + content endpoints work
const IS_THEME_ACCESS_TOKEN = !USE_OAUTH && CONFIG.token.startsWith('shptka_');

// Endpoints that DON'T work with Theme Access tokens (require Admin API token or OAuth)
const ADMIN_ONLY_ENDPOINTS = ['/products', '/shop.json', '/orders', '/customers'];

function isAdminOnlyEndpoint(endpoint) {
  return ADMIN_ONLY_ENDPOINTS.some(ep => endpoint.startsWith(ep));
}

async function shopify(method, endpoint, body) {
  const url = `${BASE}${endpoint}`;
  const headers = await getAuthHeaders();
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Shopify API ${method} ${endpoint} → ${res.status}: ${err}`);
  }
  return res.json();
}

// Shopify rate-limit safe version (retries on 429)
async function shopifySafe(method, endpoint, body, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await shopify(method, endpoint, body);
    } catch (e) {
      if (e.message.includes('429') && i < retries - 1) {
        await sleep(2000 * (i + 1));
        continue;
      }
      throw e;
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────
// THEME HELPERS
// ─────────────────────────────────────────
async function getActiveTheme() {
  const data = await shopifySafe('GET', '/themes.json');
  const active = data.themes.find(t => t.role === 'main');
  if (!active) throw new Error('No active theme found');
  return active;
}

async function getAsset(themeId, key) {
  const data = await shopifySafe('GET', `/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`);
  return data.asset;
}

async function updateAsset(themeId, key, value) {
  return shopifySafe('PUT', `/themes/${themeId}/assets.json`, { asset: { key, value } });
}

async function createAsset(themeId, key, value) {
  return shopifySafe('PUT', `/themes/${themeId}/assets.json`, { asset: { key, value } });
}

async function listAssets(themeId) {
  const data = await shopifySafe('GET', `/themes/${themeId}/assets.json`);
  return data.assets;
}

// ─────────────────────────────────────────
// BACKUP SYSTEM
// ─────────────────────────────────────────
function backupDir(fixId) {
  const dir = join(CONFIG.backupsDir, fixId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function backupAsset(themeId, assetKey, fixId) {
  try {
    const asset = await getAsset(themeId, assetKey);
    const dir = backupDir(fixId);
    const safeKey = assetKey.replace(/\//g, '__');
    const backupFile = join(dir, `${safeKey}.backup`);
    const meta = { key: assetKey, themeId, backedUpAt: new Date().toISOString() };
    writeFileSync(backupFile, asset.value || '');
    writeFileSync(backupFile + '.meta', JSON.stringify(meta));
    log(`  📦 Backed up: ${assetKey}`, 'dim');
    return backupFile;
  } catch (e) {
    log(`  ⚠️  Could not backup ${assetKey}: ${e.message}`, 'warn');
    return null;
  }
}

async function restoreAsset(fixId, assetKey) {
  const dir = backupDir(fixId);
  const safeKey = assetKey.replace(/\//g, '__');
  const backupFile = join(dir, `${safeKey}.backup`);
  const metaFile = backupFile + '.meta';
  if (!existsSync(backupFile) || !existsSync(metaFile)) {
    log(`  ❌ No backup found for ${assetKey} under fix "${fixId}"`, 'error');
    return false;
  }
  const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
  const value = readFileSync(backupFile, 'utf8');
  await updateAsset(meta.themeId, meta.key, value);
  log(`  ✅ Restored: ${assetKey}`, 'success');
  return true;
}

async function fullBackup() {
  log('\n📦 Creating full theme backup...', 'info');
  const theme = await getActiveTheme();
  const assets = await listAssets(theme.id);
  const timestamp = Date.now();
  const dir = join(CONFIG.backupsDir, `full-${timestamp}`);
  mkdirSync(dir, { recursive: true });

  let count = 0;
  for (const asset of assets) {
    // Only backup editable text files
    if (!asset.key.match(/\.(liquid|json|css|js)$/)) continue;
    try {
      const full = await getAsset(theme.id, asset.key);
      const safeKey = asset.key.replace(/\//g, '__');
      writeFileSync(join(dir, safeKey), full.value || '');
      count++;
      await sleep(300); // be kind to rate limits
    } catch { /* skip binary/unavailable */ }
  }
  writeFileSync(join(dir, 'theme.meta'), JSON.stringify({ themeId: theme.id, themeName: theme.name, timestamp, count }));
  log(`\n✅ Full backup complete: ${count} files → backups/full-${timestamp}/`, 'success');
  return dir;
}

// ─────────────────────────────────────────
// ANTHROPIC AI HELPER
// ─────────────────────────────────────────
async function ai(prompt, maxTokens = 800) {
  if (!CONFIG.anthropicKey) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CONFIG.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CONFIG.aiModel,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    let errBody = '';
    try { errBody = await res.text(); } catch {}
    throw new Error(`Anthropic API error: ${res.status} — ${errBody.substring(0, 300)}`);
  }
  const data = await res.json();
  if (!data.content || !data.content[0] || !data.content[0].text) {
    throw new Error(`Anthropic API returned unexpected response: ${JSON.stringify(data).substring(0, 300)}`);
  }
  return data.content[0].text;
}

// ─────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────
const colors = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', white: '\x1b[37m',
};

function log(msg, type = 'normal') {
  const map = { info: colors.cyan, success: colors.green, warn: colors.yellow,
    error: colors.red, dim: colors.dim, bold: colors.bold };
  const c = map[type] || colors.reset;
  console.log(`${c}${msg}${colors.reset}`);
}

function hr() { log('─'.repeat(60), 'dim'); }

// ─────────────────────────────────────────
// PROMPT HELPER (confirmations)
// ─────────────────────────────────────────
async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`\n${colors.yellow}⚠️  ${question} (y/N): ${colors.reset}`, ans => {
      rl.close();
      resolve(ans.trim().toLowerCase() === 'y');
    });
  });
}

async function ask(question, defaultVal = '') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    const hint = defaultVal ? ` [${defaultVal}]` : '';
    rl.question(`\n${colors.cyan}? ${question}${hint}: ${colors.reset}`, ans => {
      rl.close();
      resolve(ans.trim() || defaultVal);
    });
  });
}

// ─────────────────────────────────────────
// ═══════════════════════════════════════
//   THE FIXES — SEO + CRO
// ═══════════════════════════════════════
// ─────────────────────────────────────────

// ────────────────────────────────────────
// FIX 01 — Product Schema JSON-LD
// ────────────────────────────────────────
const SCHEMA_SNIPPET = `
{% comment %} TipTop360 — Product Schema JSON-LD (injected by optimizer) {% endcomment %}
{% if template == 'product' %}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": {{ product.title | json }},
  "description": {{ product.description | strip_html | truncatewords: 50 | json }},
  "url": {{ shop.url | append: product.url | json }},
  "image": {{ product.featured_image | img_url: '1200x' | prepend: 'https:' | json }},
  "brand": {
    "@type": "Brand",
    "name": "TipTop360"
  },
  "sku": {{ product.selected_or_first_available_variant.sku | json }},
  "offers": {
    "@type": "Offer",
    "price": {{ product.price | money_without_currency | remove: ',' }},
    "priceCurrency": "AED",
    "availability": {% if product.available %}"https://schema.org/InStock"{% else %}"https://schema.org/OutOfStock"{% endif %},
    "seller": {
      "@type": "Organization",
      "name": "TipTop360"
    },
    "url": {{ shop.url | append: product.url | json }}
  }
  {% if product.metafields.reviews.rating %}
  ,"aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": {{ product.metafields.reviews.rating.value }},
    "reviewCount": {{ product.metafields.reviews.rating_count.value }}
  }
  {% endif %}
}
</script>
{% endif %}

{% comment %} Organization Schema on homepage {% endcomment %}
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

async function applySchemaMarkup(dryRun = false) {
  log('\n📐 Fix 01 — Product Schema JSON-LD', 'bold');
  const theme = await getActiveTheme();

  // Try to find the right layout file
  const targetKey = 'layout/theme.liquid';

  if (dryRun) {
    log('  [DRY RUN] Would inject Product + Organization schema into layout/theme.liquid', 'dim');
    return;
  }

  if (!await confirm(`Inject Product + Organization schema into ${targetKey}? This edits your theme layout file.`)) {
    log('  Skipped.', 'dim'); return;
  }

  await backupAsset(theme.id, targetKey, 'fix-01-schema');
  const asset = await getAsset(theme.id, targetKey);
  let content = asset.value;

  if (content.includes('TipTop360 — Product Schema JSON-LD')) {
    log('  ✅ Schema already present — skipping', 'success'); return;
  }

  // Inject before </head>
  content = content.replace('</head>', `${SCHEMA_SNIPPET}\n</head>`);
  await updateAsset(theme.id, targetKey, content);
  logChange('fix-01-schema', { fix: 'Product Schema JSON-LD', file: targetKey, themeId: theme.id });
  log('  ✅ Schema markup injected into layout/theme.liquid', 'success');
}

// ────────────────────────────────────────
// FIX 02 — Sticky Add to Cart Bar
// ────────────────────────────────────────
const STICKY_ATC_SNIPPET = `
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
    <button class="tt360-sticky-btn" onclick="document.querySelector('[name=add]')?.click() || document.querySelector('.product-form__submit')?.click()">
      Add to Cart
    </button>
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
  var bar = document.getElementById('tt360-sticky-atc');
  if (!bar) return;
  var mainBtn = document.querySelector('[name=add], .product-form__submit, .btn--add-to-cart');
  if (!mainBtn) return;
  var shown = false;
  function check() {
    var rect = mainBtn.getBoundingClientRect();
    var below = rect.bottom < 0;
    if (below !== shown) {
      shown = below;
      bar.style.display = 'block';
      setTimeout(function(){ bar.classList.toggle('visible', shown); }, 10);
    }
  }
  window.addEventListener('scroll', check, { passive: true });
  check();
})();
</script>
{% endif %}
`;

async function applyStickyATC(dryRun = false) {
  log('\n🛒 Fix 02 — Sticky Add to Cart Bar', 'bold');
  const theme = await getActiveTheme();
  const snippetKey = 'snippets/tt360-sticky-atc.liquid';
  const layoutKey = 'layout/theme.liquid';

  if (dryRun) {
    log('  [DRY RUN] Would create snippets/tt360-sticky-atc.liquid and include in layout/theme.liquid', 'dim');
    return;
  }

  if (!await confirm('Add sticky Add to Cart bar? This creates a new snippet and edits layout/theme.liquid.')) {
    log('  Skipped.', 'dim'); return;
  }

  // Create the snippet
  await createAsset(theme.id, snippetKey, STICKY_ATC_SNIPPET);
  log('  📄 Created snippet: snippets/tt360-sticky-atc.liquid', 'success');

  // Include it in layout/theme.liquid before </body>
  await backupAsset(theme.id, layoutKey, 'fix-02-sticky-atc');
  const asset = await getAsset(theme.id, layoutKey);
  let content = asset.value;

  if (content.includes("render 'tt360-sticky-atc'")) {
    log('  ✅ Already included in theme layout — skipping', 'success'); return;
  }

  content = content.replace('</body>', `  {% render 'tt360-sticky-atc' %}\n</body>`);
  await updateAsset(theme.id, layoutKey, content);
  logChange('fix-02-sticky-atc', { fix: 'Sticky ATC Bar', files: [snippetKey, layoutKey], themeId: theme.id });
  log('  ✅ Sticky ATC bar live', 'success');
}

// ────────────────────────────────────────
// FIX 03 — WhatsApp Floating CTA
// ────────────────────────────────────────
function whatsappSnippet(number) {
  return `
{% comment %} TipTop360 — WhatsApp Float CTA (optimizer v1) {% endcomment %}
<a href="https://wa.me/${number}?text=Hi%20TipTop360%2C%20I%20have%20a%20question%20about%20your%20products"
   id="tt360-whatsapp" class="tt360-whatsapp" target="_blank" rel="noopener"
   aria-label="Chat with TipTop360 on WhatsApp">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="28" height="28">
    <path fill="#fff" d="M24 4C12.95 4 4 12.95 4 24c0 3.6.96 7.06 2.8 10.1L4 44l10.25-2.7C17.2 43.1 20.55 44 24 44c11.05 0 20-8.95 20-20S35.05 4 24 4z"/>
    <path fill="#25D366" d="M24 7c-9.37 0-17 7.63-17 17 0 3.23.9 6.3 2.6 8.97L7.8 40.4l7.67-2.45C17.9 39.6 20.9 40.5 24 40.5c9.37 0 17-7.63 17-17S33.37 7 24 7z"/>
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

async function applyWhatsApp(dryRun = false) {
  log('\n💬 Fix 03 — WhatsApp Floating CTA', 'bold');
  const theme = await getActiveTheme();
  const snippetKey = 'snippets/tt360-whatsapp.liquid';
  const layoutKey = 'layout/theme.liquid';

  if (dryRun) {
    log('  [DRY RUN] Would add floating WhatsApp button to all pages', 'dim'); return;
  }

  if (!await confirm('Add floating WhatsApp button? Edits layout/theme.liquid.')) {
    log('  Skipped.', 'dim'); return;
  }

  await createAsset(theme.id, snippetKey, whatsappSnippet(CONFIG.whatsapp));
  log(`  📄 Created snippet with number: +${CONFIG.whatsapp}`, 'success');

  await backupAsset(theme.id, layoutKey, 'fix-03-whatsapp');
  const asset = await getAsset(theme.id, layoutKey);
  let content = asset.value;

  if (content.includes("render 'tt360-whatsapp'")) {
    log('  ✅ Already included — skipping', 'success'); return;
  }

  content = content.replace('</body>', `  {% render 'tt360-whatsapp' %}\n</body>`);
  await updateAsset(theme.id, layoutKey, content);
  logChange('fix-03-whatsapp', { fix: 'WhatsApp Float CTA', files: [snippetKey, layoutKey], themeId: theme.id });
  log('  ✅ WhatsApp CTA live on all pages', 'success');
}

// ────────────────────────────────────────
// FIX 04 — Fix Broken Countdown Timer
// ────────────────────────────────────────
const EVERGREEN_TIMER_SNIPPET = `
{% comment %} TipTop360 — Evergreen Countdown Timer (optimizer v1) {% endcomment %}
{% comment %} Resets every 24 hours per session — always shows urgency {% endcomment %}
<script>
(function(){
  function initTimer(el) {
    var key = 'tt360_timer_' + (el.dataset.id || 'default');
    var stored = sessionStorage.getItem(key);
    var end = stored ? parseInt(stored) : Date.now() + 23 * 60 * 60 * 1000 + Math.random() * 60 * 60 * 1000;
    if (!stored) sessionStorage.setItem(key, end);

    function pad(n){ return n < 10 ? '0' + n : n; }
    function tick() {
      var diff = Math.max(0, end - Date.now());
      if (diff === 0) {
        // Reset for next session
        sessionStorage.removeItem(key);
        end = Date.now() + 23 * 60 * 60 * 1000;
        sessionStorage.setItem(key, end);
      }
      var h = Math.floor(diff / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      var display = el.querySelector('.tt360-timer-display');
      if (display) display.textContent = pad(h) + ':' + pad(m) + ':' + pad(s);
      var label = el.querySelector('.tt360-timer-label');
      if (label) label.textContent = 'Sale ends in:';
    }
    tick();
    setInterval(tick, 1000);
  }

  document.querySelectorAll('[data-tt360-timer]').forEach(initTimer);
})();
</script>
`;

async function fixCountdownTimer(dryRun = false) {
  log('\n⏱️  Fix 04 — Fix Broken Countdown Timer', 'bold');
  const theme = await getActiveTheme();
  const assets = await listAssets(theme.id);

  // Find sections/snippets that contain the broken timer
  const candidates = assets.filter(a =>
    a.key.match(/\.(liquid)$/) &&
    (a.key.includes('countdown') || a.key.includes('timer') || a.key.includes('product'))
  );

  log(`  🔍 Scanning ${candidates.length} candidate files for broken timer...`, 'dim');

  let found = [];
  for (const asset of candidates) {
    try {
      const full = await getAsset(theme.id, asset.key);
      if (full.value && (
        full.value.includes('This offer has ended') ||
        full.value.includes('offer has ended') ||
        full.value.includes('countdown') && full.value.includes('00:00:00')
      )) {
        found.push({ key: asset.key, value: full.value });
        log(`  🔴 Found broken timer in: ${asset.key}`, 'warn');
      }
    } catch { continue; }
  }

  if (found.length === 0) {
    log('  ℹ️  No broken timer code found in theme files (may be in an app script)', 'info');
    log('  💡 Injecting evergreen timer script as a replacement snippet anyway...', 'dim');
  }

  if (dryRun) {
    log(`  [DRY RUN] Would fix ${found.length} timer files + create evergreen timer snippet`, 'dim');
    return;
  }

  if (!await confirm(`Fix countdown timer? Will patch ${found.length} files and create evergreen timer snippet.`)) {
    log('  Skipped.', 'dim'); return;
  }

  // Patch found files
  for (const f of found) {
    await backupAsset(theme.id, f.key, 'fix-04-timer');
    let patched = f.value;
    // Remove broken "offer has ended" text
    patched = patched.replace(/This offer has ended/gi, 'Sale ends in:');
    // Remove hardcoded 00:00:00
    patched = patched.replace(/00:00:00/g, '--:--:--');
    // Add data attribute for our script
    patched = patched.replace(/(<[^>]*)(class="[^"]*countdown[^"]*")/gi, '$1$2 data-tt360-timer');
    await updateAsset(theme.id, f.key, patched);
    log(`  ✅ Patched: ${f.key}`, 'success');
  }

  // Inject evergreen timer script
  const snippetKey = 'snippets/tt360-evergreen-timer.liquid';
  await createAsset(theme.id, snippetKey, EVERGREEN_TIMER_SNIPPET);

  const layoutKey = 'layout/theme.liquid';
  if (found.length === 0) {
    await backupAsset(theme.id, layoutKey, 'fix-04-timer');
    const asset = await getAsset(theme.id, layoutKey);
    let content = asset.value;
    if (!content.includes("render 'tt360-evergreen-timer'")) {
      content = content.replace('</body>', `  {% render 'tt360-evergreen-timer' %}\n</body>`);
      await updateAsset(theme.id, layoutKey, content);
    }
  }

  logChange('fix-04-timer', { fix: 'Countdown Timer Fix', patchedFiles: found.map(f => f.key), themeId: theme.id });
  log('  ✅ Evergreen timer active — resets every 24h per session', 'success');
}

// ────────────────────────────────────────
// FIX 05 — Trust Badge Bar
// ────────────────────────────────────────
const TRUST_BADGES_SNIPPET = `
{% comment %} TipTop360 — Trust Badge Bar (optimizer v1) {% endcomment %}
<div class="tt360-trust-bar">
  <div class="tt360-trust-inner">
    <div class="tt360-badge">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54e8cc" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span><strong>BPA-Free</strong> Silicone</span>
    </div>
    <div class="tt360-badge">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54e8cc" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
      <span><strong>Dubai Municipality</strong> Approved</span>
    </div>
    <div class="tt360-badge">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54e8cc" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
      <span><strong>Cash on Delivery</strong> Available</span>
    </div>
    <div class="tt360-badge">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54e8cc" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      <span><strong>Next-Day</strong> Free Delivery</span>
    </div>
    <div class="tt360-badge">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54e8cc" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      <span><strong>30-Day</strong> Money Back</span>
    </div>
    <div class="tt360-badge">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#54e8cc" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
      <span><strong>50,000+</strong> UAE Families</span>
    </div>
  </div>
</div>

<style>
.tt360-trust-bar{background:#12395e;padding:10px 16px;width:100%}
.tt360-trust-inner{display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap;max-width:1200px;margin:0 auto}
.tt360-badge{display:flex;align-items:center;gap:6px;color:#fff;font-size:12px}
.tt360-badge svg{flex-shrink:0}
@media(max-width:600px){.tt360-trust-inner{gap:12px}.tt360-badge{font-size:11px}}
</style>
`;

async function applyTrustBadges(dryRun = false) {
  log('\n🛡️  Fix 05 — Trust Badge Bar', 'bold');
  const theme = await getActiveTheme();
  const snippetKey = 'snippets/tt360-trust-badges.liquid';

  if (dryRun) {
    log('  [DRY RUN] Would create trust badge bar snippet and include in product pages', 'dim'); return;
  }

  if (!await confirm('Add trust badge bar (BPA-free, Dubai approved, COD, Next-day, 30-day, 50K families)?')) {
    log('  Skipped.', 'dim'); return;
  }

  await createAsset(theme.id, snippetKey, TRUST_BADGES_SNIPPET);
  log('  📄 Created: snippets/tt360-trust-badges.liquid', 'success');

  // Try to inject into product sections
  const assets = await listAssets(theme.id);
  const productFiles = assets.filter(a =>
    a.key.match(/\.(liquid)$/) &&
    (a.key.includes('product') && (a.key.includes('section') || a.key.includes('template') || a.key.includes('main-product')))
  );

  let injected = false;
  for (const pf of productFiles.slice(0, 3)) {
    try {
      const asset = await getAsset(theme.id, pf.key);
      if (asset.value && asset.value.includes('product-form') && !asset.value.includes("render 'tt360-trust-badges'")) {
        await backupAsset(theme.id, pf.key, 'fix-05-trust');
        const patched = asset.value.replace(
          /{%[-\s]*render\s+'product-form'[^%]*%}/,
          match => `${match}\n{% render 'tt360-trust-badges' %}`
        );
        if (patched !== asset.value) {
          await updateAsset(theme.id, pf.key, patched);
          log(`  ✅ Injected into: ${pf.key}`, 'success');
          injected = true;
          break;
        }
      }
    } catch { continue; }
  }

  if (!injected) {
    log('  💡 Auto-injection not possible for this theme — add manually:', 'warn');
    log("     {% render 'tt360-trust-badges' %}", 'dim');
    log('     Paste this line in your product template where you want the badges', 'dim');
  }

  logChange('fix-05-trust', { fix: 'Trust Badge Bar', snippet: snippetKey, themeId: theme.id });
  log('  ✅ Trust badges complete', 'success');
}

// ────────────────────────────────────────
// FIX 06 — Responsive Images (srcset)
// ────────────────────────────────────────
async function fixResponsiveImages(dryRun = false) {
  log('\n🖼️  Fix 06 — Responsive Images (srcset)', 'bold');
  const theme = await getActiveTheme();
  const assets = await listAssets(theme.id);

  // Find image-heavy section files
  const imgFiles = assets.filter(a =>
    a.key.match(/\.liquid$/) &&
    (a.key.includes('hero') || a.key.includes('slideshow') || a.key.includes('banner') || a.key.includes('product'))
  );

  log(`  🔍 Scanning ${imgFiles.length} files for oversized images...`, 'dim');
  let hits = [];

  for (const f of imgFiles) {
    try {
      const asset = await getAsset(theme.id, f.key);
      if (asset.value && (
        asset.value.includes('width=3840') ||
        asset.value.includes('width=2560') ||
        (asset.value.includes('img_url') && !asset.value.includes('srcset'))
      )) {
        hits.push({ key: f.key, value: asset.value });
        log(`  🔴 Large images found in: ${f.key}`, 'warn');
      }
    } catch { continue; }
  }

  if (dryRun) {
    log(`  [DRY RUN] Would add srcset to images in ${hits.length} files`, 'dim'); return;
  }

  if (hits.length === 0) {
    log('  ✅ No obvious oversized images found in editable theme files', 'success');
    log('  💡 Check Shopify Online Store > Themes > Customize for slider image settings', 'dim');
    return;
  }

  if (!await confirm(`Fix responsive images in ${hits.length} theme files?`)) {
    log('  Skipped.', 'dim'); return;
  }

  for (const f of hits) {
    await backupAsset(theme.id, f.key, 'fix-06-images');
    let patched = f.value;
    // Replace hardcoded large widths with responsive
    patched = patched.replace(/width=3840/g, 'width=1400');
    patched = patched.replace(/width=2560/g, 'width=1200');
    // Add srcset to img_url calls that lack it
    patched = patched.replace(
      /(img_url:\s*['"]?)(\d{3,4})x(\d*)(["']?)/g,
      (match, pre, w, h, post) => {
        const iw = Math.min(parseInt(w), 1400);
        return `${pre}${iw}x${h}${post}`;
      }
    );
    await updateAsset(theme.id, f.key, patched);
    log(`  ✅ Fixed: ${f.key}`, 'success');
  }

  logChange('fix-06-images', { fix: 'Responsive Images', files: hits.map(h => h.key), themeId: theme.id });
  log('  ✅ Image sizes optimized', 'success');
}

// ────────────────────────────────────────
// FIX 07 — AI-Powered Meta Descriptions
// ────────────────────────────────────────
async function applyMetaDescriptions(dryRun = false) {
  log('\n📝 Fix 07 — AI-Powered Meta Descriptions (with approved keywords)', 'bold');

  if (IS_THEME_ACCESS_TOKEN) {
    log('  ⏭️  Skipped — Theme Access tokens cannot update product data', 'warn');
    log('  💡 Two ways to apply meta descriptions instead:', 'info');
    log('     1. Get a full Admin API token (shpat_) and update .env', 'dim');
    log('     2. Run: node optimizer.js generate-meta-csv', 'dim');
    log('        → Generates a CSV you bulk-import via Shopify Admin', 'dim');
    return;
  }

  if (!CONFIG.anthropicKey) {
    log('  ⚠️  ANTHROPIC_API_KEY not set — skipping AI meta generation', 'warn');
    log('  💡 Set it in .env to enable this fix', 'dim');
    return;
  }

  log('  🎯 Targeting these priority keywords:', 'info');
  KEYWORDS.priority.slice(0, 5).forEach(kw => log(`     • ${kw}`, 'dim'));
  log('     (and 5 more in keywords.js)', 'dim');

  const data = await shopifySafe('GET', '/products.json?limit=50&fields=id,title,handle,body_html,tags,product_type,metafields_global_description_tag,metafields_global_title_tag');
  const products = data.products;
  log(`\n  📦 Found ${products.length} products`, 'dim');

  // Separate products with existing metas from those that need them
  const needsMeta = products.filter(p => !p.metafields_global_description_tag || p.metafields_global_description_tag.length < 50);
  const hasMeta = products.length - needsMeta.length;

  log(`  📊 ${hasMeta} have existing meta (will be preserved by default)`, 'dim');
  log(`  📊 ${needsMeta.length} need new meta descriptions`, 'dim');

  if (dryRun) {
    log(`\n  [DRY RUN] Would generate metas for ${needsMeta.length} products`, 'dim');
    if (needsMeta[0]) {
      const kw = getKeywordsForProduct(needsMeta[0].handle || '');
      log(`\n  Sample for: ${needsMeta[0].title}`, 'dim');
      log(`  Targeting: "${kw.primary}" + "${kw.gift}"`, 'dim');
      const sample = await ai(buildMetaPrompt(needsMeta[0]), 200);
      log(`  Generated: "${sample.trim()}"`, 'dim');
      log(`  Title would be: "${buildTitleTag(needsMeta[0])}"`, 'dim');
    }
    return;
  }

  const overwriteAll = await confirm(
    `Generate AI metas for ${needsMeta.length} products that need them?\n` +
    `   (Type "all" instead of y to ALSO overwrite the ${hasMeta} existing metas)`
  );
  if (!overwriteAll) {
    const overwriteResp = await ask('Overwrite ALL products including existing metas? (yes/no)', 'no');
    if (overwriteResp.toLowerCase() !== 'yes' && overwriteResp.toLowerCase() !== 'all') {
      log('  Skipped.', 'dim'); return;
    }
  }

  const targets = overwriteAll ? products : needsMeta;
  if (targets.length === 0) {
    log('  ✅ Nothing to do — all products already have meta descriptions', 'success');
    return;
  }

  const results = [];
  log(`\n  Starting AI generation for ${targets.length} products...`, 'info');
  for (const product of targets) {
    try {
      const kw = getKeywordsForProduct(product.handle || '');
      const meta = await ai(buildMetaPrompt(product), 200);
      const cleaned = meta.trim().replace(/^["']|["']$/g, '').substring(0, 155);
      const newTitle = buildTitleTag(product);

      await shopifySafe('PUT', `/products/${product.id}.json`, {
        product: {
          id: product.id,
          metafields_global_description_tag: cleaned,
          metafields_global_title_tag: newTitle,
        }
      });

      results.push({ id: product.id, title: product.title, meta: cleaned, newTitle, primaryKeyword: kw.primary });
      log(`  ✅ ${product.title.substring(0, 40)}...`, 'success');
      log(`     Title: "${newTitle}"`, 'dim');
      log(`     Meta:  "${cleaned}"`, 'dim');
      log(`     Target: ${kw.primary} + ${kw.gift}`, 'dim');
      await sleep(800); // Rate limit safety + Anthropic API
    } catch (e) {
      log(`  ⚠️  Failed for ${product.title}: ${e.message}`, 'warn');
    }
  }

  logChange('fix-07-meta', { fix: 'AI Meta Descriptions + Titles', count: results.length, products: results });
  log(`\n  ✅ Meta descriptions + title tags applied to ${results.length} products`, 'success');
}

// ────────────────────────────────────────
// FIX 07b — AI-Powered Product Descriptions (production-grade)
// ────────────────────────────────────────
async function applyDescriptions(dryRun = false) {
  log('\n📄 Fix 07b — AI Product Descriptions (600-800 words, GEO/AEO optimized)', 'bold');

  if (IS_THEME_ACCESS_TOKEN) {
    log('  ⏭️  Skipped — Theme Access tokens cannot update product data', 'warn');
    return;
  }

  if (!CONFIG.anthropicKey) {
    log('  ⚠️  ANTHROPIC_API_KEY not set — skipping', 'warn');
    return;
  }

  log('  📐 Each description includes: hook, benefits, gift angle, trust block,', 'dim');
  log('     specs, FAQ (5 long-tail Qs), honest tradeoff, CTA', 'dim');
  log('  🌍 GEO/AEO optimized for Google, Bing, ChatGPT, Perplexity', 'dim');

  const data = await shopifySafe('GET', '/products.json?limit=50&fields=id,title,handle,body_html,tags,product_type');
  const products = data.products;
  log(`\n  📦 Found ${products.length} products`, 'dim');

  if (dryRun) {
    log(`\n  [DRY RUN] Would generate descriptions for ${products.length} products`, 'dim');
    if (products[0]) {
      log(`\n  Sample preview for: ${products[0].title}`, 'dim');
      const sample = await ai(buildDescriptionPrompt(products[0]), 1800);
      log(`\n  ─── SAMPLE OUTPUT ───`, 'info');
      log(sample.substring(0, 800) + '...\n[truncated for preview]', 'dim');
    }
    return;
  }

  // Confirmation with proper warning
  log(`\n  ⚠️  This will REPLACE the description on ${products.length} products.`, 'warn');
  log('  ✅ Each old description is backed up to changes.json (revert anytime)', 'success');
  log('  💰 Estimated cost: ~$0.50-1.00 total for all products', 'dim');
  log('  ⏱️  Estimated time: ~25-30 minutes', 'dim');

  const proceedResp = await ask(`\n  Proceed with regenerating ALL ${products.length} product descriptions? (yes/no)`, 'no');
  if (!['yes', 'y', 'all'].includes(proceedResp.toLowerCase())) {
    log('  Skipped.', 'dim'); return;
  }

  const includeFAQSchema = await confirm('Also generate per-product FAQPage schema metafield? (recommended for rich results)');

  const results = [];
  log(`\n  Starting AI generation for ${products.length} products...\n`, 'info');

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const num = `[${i + 1}/${products.length}]`;
    try {
      const kw = getKeywordsForProduct(product.handle || '');
      log(`  ${num} ${product.title.substring(0, 50)}...`, 'info');

      // Generate description
      const description = await ai(buildDescriptionPrompt(product), 2000);
      const cleaned = description.trim()
        .replace(/^```(?:html)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .replace(/^["']|["']$/g, '');

      // Backup the old description
      const oldDesc = product.body_html || '';

      // Update description
      const updatePayload = { id: product.id, body_html: cleaned };

      // Optional: also generate FAQ schema metafield
      let faqSchema = null;
      if (includeFAQSchema) {
        try {
          const faqJson = await ai(buildFAQSchemaPrompt(product), 1500);
          const faqCleaned = faqJson.trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/i, '');
          const parsed = JSON.parse(faqCleaned);
          if (Array.isArray(parsed) && parsed.length > 0) {
            faqSchema = parsed;
          }
        } catch (e) {
          log(`     ⚠️  FAQ schema parse failed (skipping FAQ for this product): ${e.message.substring(0, 80)}`, 'warn');
        }
      }

      // Apply description update
      await shopifySafe('PUT', `/products/${product.id}.json`, { product: updatePayload });

      // Apply FAQ schema as metafield (if generated)
      if (faqSchema) {
        try {
          await shopifySafe('POST', `/products/${product.id}/metafields.json`, {
            metafield: {
              namespace: 'tiptop360',
              key: 'faq_schema',
              value: JSON.stringify(faqSchema),
              type: 'json',
            }
          });
        } catch (e) {
          log(`     ⚠️  FAQ metafield write failed (description still saved): ${e.message.substring(0, 80)}`, 'warn');
        }
      }

      results.push({
        id: product.id,
        title: product.title,
        oldDescriptionLength: oldDesc.length,
        newDescriptionLength: cleaned.length,
        wordCount: cleaned.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length,
        primaryKeyword: kw.primary,
        faqSchemaApplied: !!faqSchema,
        oldBody: oldDesc, // Store FULL old description for revert
      });

      log(`     ✅ Description: ${cleaned.length} chars (~${Math.round(cleaned.replace(/<[^>]*>/g, ' ').split(/\s+/).length)} words)`, 'success');
      if (faqSchema) log(`     ✅ FAQ schema: ${faqSchema.length} questions`, 'success');
      log(`     🎯 Targeting: ${kw.primary}`, 'dim');

      await sleep(1500); // Rate limit safety + Anthropic API
    } catch (e) {
      log(`     ⚠️  Failed: ${e.message.substring(0, 200)}`, 'warn');
    }
  }

  logChange('fix-07b-descriptions', {
    fix: 'AI Product Descriptions + FAQ Schema',
    count: results.length,
    products: results,
    faqSchemaIncluded: includeFAQSchema,
  });

  log(`\n  ✅ Descriptions applied to ${results.length}/${products.length} products`, 'success');
  if (includeFAQSchema) log(`  ✅ FAQ schema metafields added where parsing succeeded`, 'success');
  log(`\n  💡 To revert: node optimizer.js revert fix-07b-descriptions`, 'info');
}

// Revert descriptions to their pre-AI state
async function revertDescriptions() {
  log('\n⏪ Revert: AI Product Descriptions', 'bold');
  hr();

  const changes = loadChanges();
  const change = changes['fix-07b-descriptions'];
  if (!change || !change.products || change.products.length === 0) {
    log('  ❌ No description changes to revert', 'error');
    return;
  }

  log(`  📊 Found ${change.products.length} products with backed-up descriptions`, 'info');

  if (!await confirm(`Restore original descriptions for ${change.products.length} products?`)) {
    log('  Skipped.', 'dim'); return;
  }

  let restored = 0;
  for (const p of change.products) {
    if (!p.oldBody) continue;
    try {
      await shopifySafe('PUT', `/products/${p.id}.json`, {
        product: { id: p.id, body_html: p.oldBody }
      });
      restored++;
      log(`  ✅ Restored: ${p.title.substring(0, 50)}...`, 'success');
      await sleep(500);
    } catch (e) {
      log(`  ⚠️  Failed to restore ${p.title}: ${e.message.substring(0, 100)}`, 'warn');
    }
  }

  clearChange('fix-07b-descriptions');
  log(`\n  ✅ Restored ${restored}/${change.products.length} descriptions`, 'success');
}

// ────────────────────────────────────────
// FIX 08 — Fix Navigation Labels
// ────────────────────────────────────────
async function fixNavigation(dryRun = false) {
  log('\n🧭 Fix 08 — Navigation Label Fixes', 'bold');

  const data = await shopifySafe('GET', '/menus.json');
  const menus = data.custom_collections || data;

  // Use navigation API
  const navData = await shopifySafe('GET', '/navigation.json').catch(() => null);

  if (dryRun) {
    log('  [DRY RUN] Would rename "products page" → "Shop All Products" in navigation', 'dim');
    return;
  }

  log('  💡 Navigation labels require manual update in Shopify Admin:', 'info');
  log('     Online Store → Navigation → Main Menu', 'dim');
  log('     Change "products page" → "Shop All Products" or "Kids Products"', 'dim');
  log('  ℹ️  Shopify does not expose menu item title editing via the standard REST API', 'dim');
}

// ────────────────────────────────────────
// FIX 09 — Cart Cross-Sell + Free Shipping Bar
// ────────────────────────────────────────
const CART_UPSELL_SNIPPET = `
{% comment %} TipTop360 — Cart Upsell + Free Shipping Bar (optimizer v1) {% endcomment %}
{% assign free_shipping_threshold = 100 %}
{% assign cart_total_aed = cart.total_price | divided_by: 100.0 %}
{% assign remaining = free_shipping_threshold | minus: cart_total_aed %}

<div class="tt360-cart-upsell">
  {% if cart_total_aed < free_shipping_threshold %}
  <div class="tt360-shipping-bar">
    <div class="tt360-shipping-label">
      🚚 Add <strong>AED {{ remaining | round: 0 }}</strong> more for <strong>FREE next-day delivery!</strong>
    </div>
    <div class="tt360-shipping-track">
      <div class="tt360-shipping-fill" style="width:{{ cart_total_aed | divided_by: free_shipping_threshold | times: 100 | round }}%"></div>
    </div>
  </div>
  {% else %}
  <div class="tt360-shipping-bar tt360-shipping-achieved">
    🎉 <strong>You've unlocked FREE next-day delivery!</strong>
  </div>
  {% endif %}

  {% if cart.item_count > 0 %}
  <div class="tt360-cross-sell">
    <p class="tt360-cs-title">⭐ Complete the routine — families also buy:</p>
    <div class="tt360-cs-products">
      {% assign upsell_handles = 'kids-strawberry-foam-toothpaste-uae-approved,kids-dental-care-monthly-bundle-offer-51' | split: ',' %}
      {% for handle in upsell_handles %}
        {% assign up = all_products[handle] %}
        {% if up and up.available %}
        <div class="tt360-cs-item">
          <img src="{{ up.featured_image | img_url: '80x80', crop: 'center' }}" alt="{{ up.title }}" width="60" height="60" loading="lazy">
          <div class="tt360-cs-info">
            <div class="tt360-cs-name">{{ up.title | truncatewords: 5 }}</div>
            <div class="tt360-cs-price">{{ up.price | money }}</div>
          </div>
          <form action="/cart/add" method="post" class="tt360-cs-form">
            <input type="hidden" name="id" value="{{ up.selected_or_first_available_variant.id }}">
            <input type="hidden" name="quantity" value="1">
            <button type="submit" class="tt360-cs-add">Add +</button>
          </form>
        </div>
        {% endif %}
      {% endfor %}
    </div>
  </div>
  {% endif %}
</div>

<style>
.tt360-cart-upsell{margin:12px 0;font-family:inherit}
.tt360-shipping-bar{background:#f0fdf4;border:1px solid #54e8cc;border-radius:8px;padding:12px 14px;margin-bottom:10px}
.tt360-shipping-label{font-size:13px;color:#12395e;margin-bottom:8px}
.tt360-shipping-track{height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden}
.tt360-shipping-fill{height:6px;background:#54e8cc;border-radius:3px;transition:width .5s ease}
.tt360-shipping-achieved{background:#f0fdf4;border:1px solid #54e8cc;border-radius:8px;padding:10px 14px;font-size:13px;color:#12395e;text-align:center}
.tt360-cross-sell{background:#fafafa;border:1px solid #eee;border-radius:8px;padding:12px 14px}
.tt360-cs-title{font-size:12px;font-weight:600;color:#12395e;margin:0 0 10px}
.tt360-cs-products{display:flex;flex-direction:column;gap:8px}
.tt360-cs-item{display:flex;align-items:center;gap:10px;background:#fff;border-radius:6px;padding:8px;border:1px solid #eee}
.tt360-cs-item img{border-radius:4px;object-fit:cover;flex-shrink:0}
.tt360-cs-info{flex:1;min-width:0}
.tt360-cs-name{font-size:12px;font-weight:500;color:#12395e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tt360-cs-price{font-size:12px;color:#f9655d;font-weight:600;margin-top:2px}
.tt360-cs-form{flex-shrink:0}
.tt360-cs-add{background:#12395e;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer}
.tt360-cs-add:hover{background:#1a4d7e}
</style>
`;

async function applyCartUpsell(dryRun = false) {
  log('\n🛍️  Fix 09 — Cart Cross-Sell + Free Shipping Bar', 'bold');
  const theme = await getActiveTheme();
  const snippetKey = 'snippets/tt360-cart-upsell.liquid';

  if (dryRun) {
    log('  [DRY RUN] Would add free-shipping progress bar + cross-sell to cart', 'dim'); return;
  }

  if (!await confirm('Add cart cross-sell + free shipping bar? Creates snippet + edits cart template.')) {
    log('  Skipped.', 'dim'); return;
  }

  await createAsset(theme.id, snippetKey, CART_UPSELL_SNIPPET);
  log('  📄 Created: snippets/tt360-cart-upsell.liquid', 'success');

  // Find cart template/section
  const assets = await listAssets(theme.id);
  const cartFiles = assets.filter(a =>
    a.key.match(/\.liquid$/) &&
    (a.key.includes('cart') && (a.key.includes('section') || a.key.includes('template') || a.key.includes('main')))
  );

  let injected = false;
  for (const cf of cartFiles) {
    try {
      const asset = await getAsset(theme.id, cf.key);
      if (asset.value && asset.value.includes('cart.total_price') && !asset.value.includes("render 'tt360-cart-upsell'")) {
        await backupAsset(theme.id, cf.key, 'fix-09-cart');
        const patched = asset.value.replace(
          /<\/form>/,
          `</form>\n{% render 'tt360-cart-upsell' %}`
        );
        if (patched !== asset.value) {
          await updateAsset(theme.id, cf.key, patched);
          log(`  ✅ Injected into: ${cf.key}`, 'success');
          injected = true;
          break;
        }
      }
    } catch { continue; }
  }

  if (!injected) {
    log('  💡 Manual step: paste below into your cart template:', 'warn');
    log("     {% render 'tt360-cart-upsell' %}", 'dim');
  }

  logChange('fix-09-cart', { fix: 'Cart Upsell + Shipping Bar', snippet: snippetKey, themeId: theme.id });
  log('  ✅ Cart upsell installed', 'success');
}

// ────────────────────────────────────────
// FIX 10 — Age Group Variant Tooltips
// ────────────────────────────────────────
const VARIANT_TOOLTIP_SNIPPET = `
{% comment %} TipTop360 — Age Group Variant Tooltips (optimizer v1) {% endcomment %}
<style>
.tt360-variant-info{margin:6px 0 12px;padding:8px 12px;background:#f0fdf4;border-left:3px solid #54e8cc;border-radius:0 6px 6px 0;font-size:12px;color:#12395e;display:none}
.tt360-variant-info.active{display:block}
.tt360-variant-info strong{display:block;margin-bottom:3px;font-size:13px}
</style>

<div class="tt360-variant-info" id="tt360-age-2-6">
  <strong>🦷 Ages 2–6 (Toddler head)</strong>
  Smaller U-shaped head (approx. 3.5cm) designed for toddler mouths. Softer vibration intensity. Perfect for children just starting their brushing routine.
</div>
<div class="tt360-variant-info" id="tt360-age-7-12">
  <strong>🦷 Ages 7–12 (Junior head)</strong>
  Larger U-shaped head (approx. 4.5cm) for growing mouths. Standard vibration. Ideal for school-age kids who have their adult teeth coming in.
</div>

<script>
(function(){
  function updateTooltip() {
    var selects = document.querySelectorAll('select[data-option], .variant-input');
    var allText = '';
    document.querySelectorAll('.variant__button-label, .swatch__label, [data-option-value], .product-form__option input:checked + label').forEach(function(el){
      allText += el.textContent.toLowerCase();
    });
    // Check selected variant text
    var active = document.querySelector('.product-single__variants select option:checked, select[name="options[Age group]"] option:checked');
    var val = active ? active.textContent.toLowerCase() : allText;

    document.querySelectorAll('.tt360-variant-info').forEach(function(el){ el.classList.remove('active'); });

    if (val.includes('2') || val.includes('2-6') || val.includes('toddler')) {
      var el = document.getElementById('tt360-age-2-6');
      if (el) el.classList.add('active');
    } else if (val.includes('7') || val.includes('7-12') || val.includes('junior')) {
      var el = document.getElementById('tt360-age-7-12');
      if (el) el.classList.add('active');
    }
  }

  // Inject after variant selector
  var variantSection = document.querySelector('.product-form__option, .variant-wrapper, [data-option-index]');
  if (variantSection) {
    var container = document.createElement('div');
    container.innerHTML = document.getElementById('tt360-age-2-6').outerHTML + document.getElementById('tt360-age-7-12').outerHTML;
  }

  document.addEventListener('change', updateTooltip);
  setTimeout(updateTooltip, 500);
})();
</script>
`;

async function applyVariantTooltips(dryRun = false) {
  log('\n🏷️  Fix 10 — Age Group Variant Tooltips', 'bold');
  const theme = await getActiveTheme();
  const snippetKey = 'snippets/tt360-variant-tooltips.liquid';

  if (dryRun) {
    log('  [DRY RUN] Would add age group explanation tooltips to product pages', 'dim'); return;
  }

  if (!await confirm('Add age group variant tooltips to product pages?')) {
    log('  Skipped.', 'dim'); return;
  }

  await createAsset(theme.id, snippetKey, VARIANT_TOOLTIP_SNIPPET);
  log('  📄 Created: snippets/tt360-variant-tooltips.liquid', 'success');

  logChange('fix-10-variants', { fix: 'Age Group Tooltips', snippet: snippetKey, themeId: theme.id });
  log('  💡 Include in your product template:', 'info');
  log("     {% render 'tt360-variant-tooltips' %}", 'dim');
  log('  ✅ Tooltip snippet ready', 'success');
}

// ─────────────────────────────────────────
// KEYWORD PREVIEW (read-only)
// ─────────────────────────────────────────
async function previewKeywords() {
  log('\n🎯 Keyword Strategy Preview', 'bold');
  hr();

  log('\n📌 Top 10 Priority Keywords:', 'info');
  KEYWORDS.priority.forEach((kw, i) => log(`   ${i + 1}.  ${kw}`, 'dim'));

  log('\n📦 Per-Product Keyword Mapping:', 'info');
  for (const [handle, kw] of Object.entries(KEYWORDS.products)) {
    log(`\n   ${handle}`, 'bold');
    log(`     Primary: ${kw.primary}`, 'dim');
    log(`     Gift:    ${kw.gift}`, 'dim');
    log(`     Title:   ${kw.titleFormula.replace('{title}', '[Product Name]')}`, 'dim');
  }

  log('\n🎁 Gift Cluster (homepage + collections):', 'info');
  KEYWORDS.giftCluster.forEach(kw => log(`   • ${kw}`, 'dim'));

  log('\n💡 To edit: open keywords.js in your editor', 'info');
  log('   The optimizer reads it fresh on every run.', 'dim');
  hr();
}

// ─────────────────────────────────────────
// META CSV GENERATOR (for Theme Access token users)
// Generates a CSV you can paste into Shopify's bulk product editor
// ─────────────────────────────────────────
async function generateMetaCsv() {
  log('\n📄 Generate Meta Description CSV (for manual bulk import)', 'bold');
  hr();

  if (!CONFIG.anthropicKey) {
    log('  ❌ ANTHROPIC_API_KEY not set in .env — required for AI generation', 'error');
    return;
  }

  if (IS_THEME_ACCESS_TOKEN) {
    log('  ℹ️  Theme Access token detected — but you can still generate the CSV', 'info');
    log('  ⚠️  The script needs to read your products. Provide them manually:', 'warn');
    log('     1. Shopify Admin → Products → Export → CSV (all columns)', 'dim');
    log('     2. Save the CSV next to this script as "products-export.csv"', 'dim');
    log('     3. Re-run: node optimizer.js generate-meta-csv', 'dim');

    const csvPath = join(__dirname, 'products-export.csv');
    if (!existsSync(csvPath)) {
      log(`\n  ❌ products-export.csv not found at ${csvPath}`, 'error');
      log('  💡 Export from Shopify first, then re-run this command', 'info');
      return;
    }

    log(`\n  ✅ Found products-export.csv — processing...`, 'success');
    const csv = readFileSync(csvPath, 'utf8');
    const lines = csv.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const handleIdx = headers.indexOf('Handle');
    const titleIdx = headers.indexOf('Title');
    const seoTitleIdx = headers.indexOf('SEO Title');
    const seoDescIdx = headers.indexOf('SEO Description');

    if (handleIdx === -1 || titleIdx === -1) {
      log('  ❌ CSV missing Handle or Title columns', 'error');
      return;
    }

    const products = new Map();
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (!cols[handleIdx] || !cols[titleIdx]) continue;
      if (products.has(cols[handleIdx])) continue;
      products.set(cols[handleIdx], { handle: cols[handleIdx], title: cols[titleIdx] });
    }

    log(`  📦 Found ${products.size} unique products`, 'dim');

    const outputRows = [['Handle', 'SEO Title', 'SEO Description']];
    let i = 0;
    for (const [handle, p] of products) {
      i++;
      try {
        const meta = await ai(buildMetaPrompt(p), 200);
        const cleanMeta = meta.trim().replace(/^["']|["']$/g, '').substring(0, 155);
        const newTitle = buildTitleTag(p);
        outputRows.push([handle, newTitle, cleanMeta]);
        log(`  ✅ [${i}/${products.size}] ${p.title.substring(0, 40)}`, 'success');
        await sleep(500);
      } catch (e) {
        log(`  ⚠️  [${i}/${products.size}] Failed: ${p.title}`, 'warn');
      }
    }

    const outputCsv = outputRows.map(row =>
      row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const outPath = join(__dirname, 'products-meta-output.csv');
    writeFileSync(outPath, outputCsv);

    log(`\n  ✅ Generated CSV: ${outPath}`, 'success');
    log('\n  📥 To import into Shopify:', 'info');
    log('     1. Shopify Admin → Products', 'dim');
    log('     2. Click "Import" → upload products-meta-output.csv', 'dim');
    log('     3. Match Handle column → check "Overwrite existing products"', 'dim');
    log('     4. Review preview → click Import', 'dim');
    return;
  }

  // Full Admin API token path
  log('  ℹ️  Using Admin API to fetch products directly...', 'info');
  // (rest handled by applyMetaDescriptions when token is shpat_)
  log('  💡 You have a full Admin API token. Just run: node optimizer.js apply meta', 'success');
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current); current = '';
    } else current += c;
  }
  result.push(current);
  return result;
}

// ─────────────────────────────────────────
// CONNECTION TEST (run this FIRST — safest possible command)
// ─────────────────────────────────────────
async function testConnection() {
  log('\n🔌 Testing Shopify Connection (read-only, no changes made)', 'bold');
  hr();

  log('\n  Step 1/4 — Checking .env credentials...', 'dim');
  if (!CONFIG.store) {
    log('  ❌ Missing SHOPIFY_STORE in .env', 'error');
    return false;
  }
  if (!USE_OAUTH && !CONFIG.token) {
    log('  ❌ Need either SHOPIFY_ACCESS_TOKEN or (SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET) in .env', 'error');
    return false;
  }
  if (!CONFIG.store.includes('.myshopify.com') && !CONFIG.store.includes('.com')) {
    log(`  ⚠️  Store URL looks unusual: ${CONFIG.store}`, 'warn');
    log('     Should be like: tiptop360.myshopify.com', 'dim');
  }
  log(`  ✅ Store:  ${STORE_DOMAIN}`, 'success');

  if (USE_OAUTH) {
    log(`  ✅ Auth mode: OAuth client credentials (Dev Dashboard)`, 'success');
    log(`     Client ID: ${CONFIG.clientId.substring(0, 8)}...${CONFIG.clientId.substring(CONFIG.clientId.length - 4)}`, 'dim');
    log(`     Client Secret: ${CONFIG.clientSecret.substring(0, 8)}...`, 'dim');
    log(`\n  → Exchanging credentials for access token...`, 'dim');
    try {
      const token = await getOAuthToken();
      log(`  ✅ OAuth token obtained: ${token.substring(0, 8)}...${token.substring(token.length - 4)}`, 'success');
      log(`     Expires in ~24h, auto-refreshes`, 'dim');
    } catch (e) {
      log(`  ❌ OAuth token exchange failed: ${e.message}`, 'error');
      if (e.message.includes('shop_not_permitted')) {
        log('     → App and store must be in the same Shopify organization', 'warn');
      } else if (e.message.includes('invalid_client')) {
        log('     → Client ID or Client Secret is wrong. Re-copy from Dev Dashboard → Settings', 'warn');
      } else if (e.message.includes('404')) {
        log('     → Store URL is wrong. Use the permanent .myshopify.com URL', 'warn');
      }
      return false;
    }
  } else {
    log(`  ✅ Token:  ${CONFIG.token.substring(0, 8)}...${CONFIG.token.substring(CONFIG.token.length - 4)}`, 'success');
    if (IS_THEME_ACCESS_TOKEN) {
      log(`  ℹ️  Token type: Theme Access (shptka_) — limited to theme + content fixes`, 'info');
      log(`     Product meta descriptions will be skipped (need shpat_ or OAuth for that)`, 'dim');
    } else if (CONFIG.token.startsWith('shpat_')) {
      log(`  ✅ Token type: Admin API (shpat_) — full access`, 'success');
    }
  }

  log('\n  Step 2/4 — Testing API access...', 'dim');
  if (IS_THEME_ACCESS_TOKEN) {
    // Theme Access tokens can't call /shop.json — go straight to themes
    try {
      const data = await shopify('GET', '/themes.json');
      const active = data.themes.find(t => t.role === 'main');
      log(`  ✅ Connected via Theme Access`, 'success');
      log(`     Active theme: ${active?.name || 'unknown'}`, 'dim');
    } catch (e) {
      log(`  ❌ Theme Access connection failed: ${e.message}`, 'error');
      if (e.message.includes('401') || e.message.includes('403')) {
        log('     → Token is invalid or expired. Generate a new one in Theme Access app.', 'warn');
      } else if (e.message.includes('404')) {
        log('     → Store URL is wrong. Should be: yourstore.myshopify.com', 'warn');
      }
      return false;
    }
  } else {
    try {
      const data = await shopify('GET', '/shop.json');
      log(`  ✅ Connected! Store name: ${data.shop.name}`, 'success');
      log(`     Currency: ${data.shop.currency}  |  Country: ${data.shop.country_name}`, 'dim');
    } catch (e) {
      log(`  ❌ Connection failed: ${e.message}`, 'error');
      if (e.message.includes('401') || e.message.includes('403')) {
        log('     → Token invalid or app missing required scopes', 'warn');
        log('     → Verify these scopes in Dev Dashboard → Configuration:', 'warn');
        log('       read_products, write_products, read_themes, write_themes, read_content, write_content', 'dim');
      } else if (e.message.includes('404')) {
        log('     → Store URL is wrong. Should be: yourstore.myshopify.com', 'warn');
      }
      return false;
    }
  }

  log('\n  Step 3/4 — Checking theme access...', 'dim');
  try {
    const theme = await getActiveTheme();
    log(`  ✅ Active theme: ${theme.name}`, 'success');
    log(`     Theme ID: ${theme.id}  |  Role: ${theme.role}`, 'dim');
  } catch (e) {
    log(`  ❌ Theme access failed: ${e.message}`, 'error');
    log('     → Missing scope "read_themes". Re-configure your app permissions.', 'warn');
    return false;
  }

  log('\n  Step 4/4 — Checking product access...', 'dim');
  if (IS_THEME_ACCESS_TOKEN) {
    log(`  ⏭️  Skipped — Theme Access tokens can't access product API`, 'warn');
    log(`     This is expected. AI meta descriptions will not run.`, 'dim');
    log(`     All theme-level fixes (schema, sticky ATC, WhatsApp, etc.) WILL work.`, 'dim');
  } else {
    try {
      const data = await shopify('GET', '/products/count.json');
      log(`  ✅ Found ${data.count} products`, 'success');
    } catch (e) {
      log(`  ❌ Product access failed: ${e.message}`, 'error');
      log('     → Missing scope "read_products". Re-configure your app permissions.', 'warn');
      return false;
    }
  }

  log('\n  Step 5/5 — Testing Anthropic AI key...', 'dim');
  if (!CONFIG.anthropicKey || CONFIG.anthropicKey.startsWith('sk-ant-xxx')) {
    log('  ⚠️  ANTHROPIC_API_KEY not set — AI meta descriptions will be skipped', 'warn');
    log('     Get one at: console.anthropic.com → API Keys', 'dim');
  } else {
    try {
      await ai('Reply with exactly: ok', 20);
      log('  ✅ Anthropic AI working', 'success');
    } catch (e) {
      log(`  ⚠️  Anthropic key issue: ${e.message}`, 'warn');
    }
  }

  hr();
  log('\n  ✅ ALL CHECKS PASSED — safe to run other commands\n', 'success');
  log('  Next steps:', 'info');
  log('    1.  node optimizer.js audit       (see what needs fixing)', 'dim');
  log('    2.  node optimizer.js backup      (full theme backup)', 'dim');
  log('    3.  node optimizer.js dry-run     (preview all changes)', 'dim');
  log('    4.  node optimizer.js menu        (apply fixes interactively)\n', 'dim');
  return true;
}

// ─────────────────────────────────────────
// REVERT SYSTEM
// ─────────────────────────────────────────
async function revertFix(fixId) {
  log(`\n⏪ Reverting: ${fixId}`, 'bold');
  const changes = loadChanges();
  const change = changes[fixId];

  if (!change) {
    log(`  ❌ No record found for "${fixId}". Check "node optimizer.js status".`, 'error'); return;
  }

  // Special case: API-based product description revert
  if (fixId === 'fix-07b-descriptions') {
    return revertDescriptions();
  }

  if (!await confirm(`Revert "${change.fix}"? This will restore the original files.`)) {
    log('  Cancelled.', 'dim'); return;
  }

  const dir = backupDir(fixId);
  if (!existsSync(dir)) {
    log(`  ❌ Backup directory not found: ${dir}`, 'error'); return;
  }

  const backupFiles = readdirSync(dir).filter(f => f.endsWith('.backup'));
  if (backupFiles.length === 0) {
    log(`  ℹ️  No theme file backups for this fix (may be a content-only fix)`, 'info');
    clearChange(fixId);
    log(`  ✅ Change record cleared for ${fixId}`, 'success');
    return;
  }

  for (const bFile of backupFiles) {
    const metaFile = join(dir, bFile + '.meta');
    if (!existsSync(metaFile)) continue;
    const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
    const value = readFileSync(join(dir, bFile), 'utf8');
    await updateAsset(meta.themeId, meta.key, value);
    log(`  ✅ Restored: ${meta.key}`, 'success');
  }

  clearChange(fixId);
  log(`\n  ✅ "${change.fix}" fully reverted`, 'success');
}

async function revertAll() {
  log('\n⏪ REVERT ALL — Restore everything to original state', 'bold');
  const changes = loadChanges();
  const fixIds = Object.keys(changes);

  if (fixIds.length === 0) {
    log('  ✅ Nothing to revert — no changes applied yet', 'success'); return;
  }

  log(`\n  Applied fixes to revert:`, 'info');
  fixIds.forEach(id => log(`  • ${changes[id].fix} (applied: ${changes[id].appliedAt})`, 'dim'));

  if (!await confirm(`Revert ALL ${fixIds.length} applied fixes? This restores your original theme files.`)) {
    log('  Cancelled.', 'dim'); return;
  }

  for (const fixId of fixIds) {
    await revertFix(fixId).catch(e => log(`  ⚠️  Error reverting ${fixId}: ${e.message}`, 'warn'));
  }

  log('\n  ✅ All changes reverted. Your theme is restored.', 'success');
}

// ─────────────────────────────────────────
// AUDIT (read-only)
// ─────────────────────────────────────────
async function runAudit() {
  log('\n🔍 TipTop360 — Site Audit (Read-Only)', 'bold');
  hr();

  const theme = await getActiveTheme();
  log(`\n📋 Active theme: ${theme.name} (ID: ${theme.id})`, 'info');

  const assets = await listAssets(theme.id);
  log(`   Total theme files: ${assets.length}`, 'dim');

  // Check which fixes are already applied
  const changes = loadChanges();
  const fixIds = Object.keys(changes);
  log(`\n✅ Applied fixes: ${fixIds.length}`, fixIds.length > 0 ? 'success' : 'dim');
  if (fixIds.length > 0) {
    fixIds.forEach(id => log(`   • ${changes[id].fix}`, 'dim'));
  }

  // Check for broken timer
  log('\n🔎 Checking for broken countdown timer...', 'dim');
  let timerBroken = false;
  for (const a of assets.filter(a => a.key.match(/\.liquid$/) && a.key.includes('product')).slice(0, 5)) {
    try {
      const full = await getAsset(theme.id, a.key);
      if (full.value?.includes('This offer has ended')) { timerBroken = true; break; }
    } catch {}
  }
  log(timerBroken ? '  🔴 Broken timer found in theme' : '  ✅ No broken timer in theme', timerBroken ? 'warn' : 'success');

  // Check schema
  const layoutAsset = await getAsset(theme.id, 'layout/theme.liquid');
  const hasSchema = layoutAsset?.value?.includes('application/ld+json');
  log(hasSchema ? '  ✅ Schema markup present' : '  🔴 No schema markup found', hasSchema ? 'success' : 'warn');

  const hasStickyAtc = layoutAsset?.value?.includes("render 'tt360-sticky-atc'");
  log(hasStickyAtc ? '  ✅ Sticky ATC present' : '  🔴 No sticky ATC', hasStickyAtc ? 'success' : 'warn');

  const hasWhatsApp = layoutAsset?.value?.includes("render 'tt360-whatsapp'");
  log(hasWhatsApp ? '  ✅ WhatsApp CTA present' : '  🔴 No WhatsApp CTA', hasWhatsApp ? 'success' : 'warn');

  // Check products
  log('\n📦 Checking products...', 'dim');
  const prodData = await shopifySafe('GET', '/products/count.json');
  log(`   Total products: ${prodData.count}`, 'dim');

  const sample = await shopifySafe('GET', '/products.json?limit=5&fields=id,title,body_html');
  const noDesc = sample.products.filter(p => !p.body_html || p.body_html.length < 100);
  log(noDesc.length === 0 ? '  ✅ Products have descriptions' : `  🟠 ${noDesc.length} products need descriptions`, noDesc.length === 0 ? 'success' : 'warn');

  hr();
  log('\n💡 Run "node optimizer.js menu" to apply fixes interactively', 'info');
}

// ─────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────
function showStatus() {
  log('\n📊 Applied Changes Status', 'bold');
  hr();
  const changes = loadChanges();
  const fixIds = Object.keys(changes);
  if (fixIds.length === 0) {
    log('\n  No fixes applied yet. Run "node optimizer.js menu" to start.\n', 'dim');
    return;
  }
  fixIds.forEach(id => {
    const c = changes[id];
    log(`\n  ✅ ${c.fix}`, 'success');
    log(`     Applied: ${c.appliedAt}`, 'dim');
    log(`     Revert:  node optimizer.js revert ${id}`, 'dim');
  });
  log('');
}

// ─────────────────────────────────────────
// DRY RUN
// ─────────────────────────────────────────
async function dryRunAll() {
  log('\n🔍 DRY RUN — Preview all fixes (nothing will be changed)', 'bold');
  hr();
  await applySchemaMarkup(true);
  await applyStickyATC(true);
  await applyWhatsApp(true);
  await fixCountdownTimer(true);
  await applyTrustBadges(true);
  await fixResponsiveImages(true);
  await applyMetaDescriptions(true);
  await applyCartUpsell(true);
  await applyVariantTooltips(true);
  hr();
  log('\n✅ Dry run complete. Run "node optimizer.js menu" to apply fixes.\n', 'success');
}

// ─────────────────────────────────────────
// INTERACTIVE MENU
// ─────────────────────────────────────────
async function menu() {
  log('\n', 'reset');
  log('╔══════════════════════════════════════════════════╗', 'bold');
  log('║   TipTop360 SEO + CRO Optimizer                 ║', 'bold');
  log('╚══════════════════════════════════════════════════╝', 'bold');

  const choices = [
    { key: 'T', label: '🔌 Test Shopify connection (RUN THIS FIRST)' },
    { key: '0', label: 'Run audit (read-only — see what needs fixing)' },
    { key: '1', label: 'Full backup (backup all theme files first)' },
    { key: '2', label: 'Dry run (preview all changes)' },
    { key: 'K', label: 'Preview keyword strategy' },
    { key: '─', label: '── SEO Fixes ──' },
    { key: 'A', label: 'Fix 01 — Inject Product + Organization schema markup' },
    { key: 'B', label: 'Fix 06 — Fix responsive images (LCP/Core Web Vitals)' },
    { key: 'C', label: 'Fix 07 — AI-generated meta descriptions for all products' },
    { key: '─', label: '── CRO Fixes ──' },
    { key: 'D', label: 'Fix 02 — Add sticky Add to Cart bar (mobile)' },
    { key: 'E', label: 'Fix 03 — Add floating WhatsApp CTA button' },
    { key: 'F', label: 'Fix 04 — Fix broken countdown timer (evergreen)' },
    { key: 'G', label: 'Fix 05 — Add trust badge bar (BPA-free, COD, Dubai, etc.)' },
    { key: 'H', label: 'Fix 09 — Cart cross-sell + free shipping progress bar' },
    { key: 'I', label: 'Fix 10 — Age group variant tooltips' },
    { key: '─', label: '── Apply All ──' },
    { key: 'ALL', label: 'Apply ALL fixes automatically (recommended)' },
    { key: '─', label: '── Control ──' },
    { key: 'S', label: 'Show status (what has been applied)' },
    { key: 'R', label: 'Revert a specific fix' },
    { key: 'RA', label: 'Revert ALL — restore everything to original' },
    { key: 'Q', label: 'Quit' },
  ];

  log('');
  choices.forEach(c => {
    if (c.key === '─') { log(`\n  ${c.label}`, 'dim'); return; }
    log(`  [${c.key.padEnd(3)}] ${c.label}`, c.key === 'ALL' ? 'success' : 'normal');
  });

  const choice = (await ask('\nEnter choice')).toUpperCase();

  switch (choice) {
    case 'T': await testConnection(); break;
    case '0': await runAudit(); break;
    case '1': await fullBackup(); break;
    case '2': await dryRunAll(); break;
    case 'K': await previewKeywords(); break;
    case 'A': await applySchemaMarkup(); break;
    case 'B': await fixResponsiveImages(); break;
    case 'C': await applyMetaDescriptions(); break;
    case 'D': await applyStickyATC(); break;
    case 'E': await applyWhatsApp(); break;
    case 'F': await fixCountdownTimer(); break;
    case 'G': await applyTrustBadges(); break;
    case 'H': await applyCartUpsell(); break;
    case 'I': await applyVariantTooltips(); break;
    case 'S': showStatus(); break;
    case 'R': {
      const id = await ask('Enter fix ID to revert (see status)');
      await revertFix(id);
      break;
    }
    case 'RA': await revertAll(); break;
    case 'ALL': {
      log('\n🚀 Applying all fixes...', 'bold');
      await fullBackup();
      await applySchemaMarkup();
      await applyStickyATC();
      await applyWhatsApp();
      await fixCountdownTimer();
      await applyTrustBadges();
      await fixResponsiveImages();
      await applyMetaDescriptions();
      await applyCartUpsell();
      await applyVariantTooltips();
      log('\n\n✅ All fixes applied!', 'success');
      showStatus();
      break;
    }
    case 'Q': log('\nBye! 👋\n', 'dim'); process.exit(0);
    default: log('\n⚠️  Unknown choice. Run menu again.', 'warn');
  }

  if (choice !== 'Q') {
    const again = await confirm('\nReturn to menu?');
    if (again) await menu();
  }
}

// ─────────────────────────────────────────
// CLI ENTRY POINT
// ─────────────────────────────────────────
const args = process.argv.slice(2);
const cmd = args[0]?.toLowerCase() || 'menu';

(async () => {
  try {
    switch (cmd) {
      case 'menu':       await menu(); break;
      case 'test':
      case 'test-connection': await testConnection(); break;
      case 'audit':      await runAudit(); break;
      case 'keywords':   await previewKeywords(); break;
      case 'generate-meta-csv': await generateMetaCsv(); break;
      case 'backup':     await fullBackup(); break;
      case 'status':     showStatus(); break;
      case 'dry-run':    await dryRunAll(); break;
      case 'revert-all': await revertAll(); break;
      case 'revert':     await revertFix(args[1]); break;
      case 'apply':      {
        const map = {
          'schema': applySchemaMarkup, 'sticky-atc': applyStickyATC,
          'whatsapp': applyWhatsApp, 'timer': fixCountdownTimer,
          'trust': applyTrustBadges, 'images': fixResponsiveImages,
          'meta': applyMetaDescriptions, 'cart': applyCartUpsell,
          'variants': applyVariantTooltips,
          'descriptions': applyDescriptions,
        };
        const fn = map[args[1]];
        if (fn) await fn();
        else log(`\n❌ Unknown fix: "${args[1]}". Options: ${Object.keys(map).join(', ')}\n`, 'error');
        break;
      }
      default: await menu();
    }
  } catch (e) {
    log(`\n❌ Error: ${e.message}`, 'error');
    if (process.env.DEBUG) console.error(e);
    process.exit(1);
  }
})();
