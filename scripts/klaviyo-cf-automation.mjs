#!/usr/bin/env node
// klaviyo-cf-automation.mjs — full browser-agent automation for the Klaviyo <-> Cloudflare
// branded sending domain setup, built to eliminate copy-paste / misclick errors and to run
// either locally (headed) or in CI (headless, with saved sessions from secrets).
//
// Commands:
//   login <klaviyo|cloudflare>  Open a headed browser, sign in + 2FA once, save the session.
//   session-b64 <service>       Print base64 of a saved session (paste into a CI secret).
//   extract                     Scrape the EXACT DNS records Klaviyo generated into
//                               scripts/cf-dns.config.json (no transcription = no typos).
//   cf-apply-ui                 Create the records in the Cloudflare DASHBOARD via the browser,
//                               forcing email records to DNS-only (grey cloud).
//   verify                      Click Klaviyo's "Verify" and report status.
//   run                         extract -> apply -> (wait) -> verify, end to end.
//                                 --cf-mode api  (default) apply via Cloudflare API (cf-dns-apply.mjs)
//                                 --cf-mode ui              apply via the Cloudflare dashboard (browser)
//
// Sessions:
//   Local:  saved to .sessions/<service>.json by `login` (git-ignored).
//   CI:     loaded from env KLAVIYO_STORAGE_STATE_B64 / CLOUDFLARE_STORAGE_STATE_B64
//           (base64 of a storageState JSON). Dashboard sessions are short-lived + IP-bound,
//           so refresh them periodically.
//
// Flags: --headless  --no-apply  --keep-open  --cf-mode <api|ui>
//
// First-time local setup:
//   npm install && npx playwright install chromium
//   cp scripts/cf-dns.config.example.json scripts/cf-dns.config.json
//   # for --cf-mode api: set CF_ZONE and CF_API_TOKEN (Zone->DNS->Edit) in .env
//   npm run klaviyo:login   (and  npm run cf:login  for --cf-mode ui)
//
// See docs/CLOUDFLARE_KLAVIYO_STRATEGY.md.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SESSIONS_DIR = path.join(ROOT, '.sessions');
const SHOTS_DIR = path.join(ROOT, '.klaviyo-automation');
const DNS_CONFIG_PATH = path.join(ROOT, 'scripts', 'cf-dns.config.json');
const DNS_EXAMPLE_PATH = path.join(ROOT, 'scripts', 'cf-dns.config.example.json');
const AUTO_CONFIG_PATH = path.join(ROOT, 'scripts', 'klaviyo-automation.config.json');

const SERVICES = {
  klaviyo: { envVar: 'KLAVIYO_STORAGE_STATE_B64', loginUrlKey: 'loginUrl' },
  cloudflare: { envVar: 'CLOUDFLARE_STORAGE_STATE_B64', loginUrlKey: 'cloudflareLoginUrl' },
};

// --- defaults (override any in scripts/klaviyo-automation.config.json) ------
const DEFAULTS = {
  loginUrl: 'https://www.klaviyo.com/login',
  domainsUrl: 'https://www.klaviyo.com/settings/account/domains',
  cloudflareLoginUrl: 'https://dash.cloudflare.com/login',
  cloudflareDashUrl: 'https://dash.cloudflare.com',
  cloudflareDnsUrl: '', // optional direct URL to the zone's DNS page; else navigate from dash
  sendingDomain: 'send.tiptop360.com',
  zone: 'tiptop360.com',
  klaviyoTargetHints: ['klaviyomail.com', 'klaviyodelivery.com', 'klclick.com', 'klaviyo.com'],
  selectors: {
    verifyButton: 'button:has-text("Verify"), button:has-text("Re-verify")',
  },
  cfSelectors: {
    dnsNav: 'a:has-text("DNS"), a:has-text("Records")',
    addRecordButton: 'button:has-text("Add record"), button:has-text("Create record")',
    typeSelect: 'select[name="type"], [data-testid="dns-record-type"]',
    nameInput: 'input[name="name"], [data-testid="dns-record-name"]',
    contentInput: 'input[name="content"], [name="target"], [data-testid="dns-record-content"]',
    proxyToggle: '[data-testid="dns-record-proxy-toggle"], button[role="switch"]',
    saveButton: 'button:has-text("Save"), button[type="submit"]:has-text("Save")',
  },
};

// --- utils -----------------------------------------------------------------
function loadEnvFile(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  for (const rawLine of readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function loadConfig() {
  let cfg = { ...DEFAULTS };
  if (existsSync(AUTO_CONFIG_PATH)) {
    const o = JSON.parse(readFileSync(AUTO_CONFIG_PATH, 'utf8'));
    cfg = {
      ...cfg,
      ...o,
      selectors: { ...DEFAULTS.selectors, ...(o.selectors || {}) },
      cfSelectors: { ...DEFAULTS.cfSelectors, ...(o.cfSelectors || {}) },
    };
  }
  const env = loadEnvFile(path.join(ROOT, '.env'));
  if (env.KLAVIYO_SENDING_DOMAIN) cfg.sendingDomain = env.KLAVIYO_SENDING_DOMAIN;
  return cfg;
}

function parseArgs(argv) {
  const a = { cmd: argv[0], arg1: argv[1], headless: false, noApply: false, keepOpen: false, cfMode: 'api' };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--headless') a.headless = true;
    else if (argv[i] === '--no-apply') a.noApply = true;
    else if (argv[i] === '--keep-open') a.keepOpen = true;
    else if (argv[i] === '--cf-mode') a.cfMode = argv[++i];
  }
  if (process.env.CI) a.headless = true;
  return a;
}

const ensureDir = (d) => { if (!existsSync(d)) mkdirSync(d, { recursive: true }); };
const ts = () => new Date().toISOString().replace(/[:.]/g, '-');

async function shot(page, name) {
  ensureDir(SHOTS_DIR);
  const f = path.join(SHOTS_DIR, `${ts()}-${name}.png`);
  await page.screenshot({ path: f, fullPage: true }).catch(() => {});
  return f;
}
async function dumpHtml(page, name) {
  ensureDir(SHOTS_DIR);
  const f = path.join(SHOTS_DIR, `${ts()}-${name}.html`);
  try { writeFileSync(f, await page.content()); } catch { /* ignore */ }
  return f;
}
function waitForEnter(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.resume();
    process.stdin.once('data', () => { process.stdin.pause(); resolve(); });
  });
}
function relName(host, zone) {
  const h = host.replace(/\.$/, '');
  if (h === zone) return '@';
  return h.endsWith(`.${zone}`) ? h.slice(0, -(`.${zone}`).length) : h;
}
const sessionPath = (service) => path.join(SESSIONS_DIR, `${service}.json`);

// Resolve a storageState path for a service: prefer the CI env var, else the local file.
function resolveStorageState(service) {
  const meta = SERVICES[service];
  if (!meta) throw new Error(`Unknown service: ${service}`);
  const b64 = process.env[meta.envVar];
  if (b64) {
    ensureDir(SESSIONS_DIR);
    const tmp = path.join(os.tmpdir(), `kcf-${service}-${process.pid}.json`);
    writeFileSync(tmp, Buffer.from(b64, 'base64').toString('utf8'));
    return tmp;
  }
  if (existsSync(sessionPath(service))) return sessionPath(service);
  throw new Error(
    `No session for "${service}". Run:  node scripts/klaviyo-cf-automation.mjs login ${service}\n` +
      `(or set ${meta.envVar} in CI).`,
  );
}

// --- browser ---------------------------------------------------------------
async function launch(headless) {
  const { chromium } = await import('playwright');
  return chromium.launch({ headless });
}
async function sessionContext(browser, service) {
  return browser.newContext({ storageState: resolveStorageState(service) });
}
async function assertLoggedIn(page, label) {
  if (/\/login|\/signin/i.test(page.url())) {
    await shot(page, `${label}-not-logged-in`);
    throw new Error(`Session expired (redirected to login). Re-run login for this service.`);
  }
}

// --- commands --------------------------------------------------------------
async function cmdLogin(args, cfg) {
  const service = args.arg1;
  if (!SERVICES[service]) throw new Error(`Usage: login <klaviyo|cloudflare>`);
  const url = cfg[SERVICES[service].loginUrlKey];
  console.log(`\nOpening a browser to ${url}. Sign in (+2FA) for ${service}.`);
  const browser = await launch(false);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForEnter(`\n>> When fully logged in to ${service}, press ENTER to save the session... `);
  ensureDir(SESSIONS_DIR);
  await context.storageState({ path: sessionPath(service) });
  console.log(`Session saved to ${path.relative(ROOT, sessionPath(service))} (git-ignored).`);
  if (!args.keepOpen) await browser.close();
}

function cmdSessionB64(args) {
  const service = args.arg1;
  if (!SERVICES[service]) throw new Error(`Usage: session-b64 <klaviyo|cloudflare>`);
  if (!existsSync(sessionPath(service))) throw new Error(`No saved session for ${service}. Run login first.`);
  const b64 = Buffer.from(readFileSync(sessionPath(service))).toString('base64');
  process.stdout.write(`${b64}\n`);
}

async function scrapeRecords(page, cfg) {
  const rows = await page.evaluate(() => {
    const out = [];
    for (const tr of Array.from(document.querySelectorAll('tr'))) {
      const cells = Array.from(tr.querySelectorAll('td,th')).map((c) => (c.innerText || '').trim()).filter(Boolean);
      if (cells.length) out.push(cells);
    }
    return out;
  });
  const records = [];
  const seen = new Set();
  for (const cells of rows) {
    const joined = cells.join(' | ');
    const hasK = cfg.klaviyoTargetHints.some((h) => joined.toLowerCase().includes(h));
    const looksTxt = /v=spf1|v=dmarc1|v=dkim1/i.test(joined);
    if (!hasK && !looksTxt) continue;
    const hostCell = cells.find((c) => c.toLowerCase().includes(cfg.zone)) || cells[0];
    const valueCell =
      cells.find((c) => c !== hostCell && (cfg.klaviyoTargetHints.some((h) => c.toLowerCase().includes(h)) || /^v=/i.test(c))) ||
      cells[cells.length - 1];
    let type = 'CNAME';
    if (/^v=/i.test(valueCell)) type = 'TXT';
    else if (cells.some((c) => /^cname$/i.test(c))) type = 'CNAME';
    else if (cells.some((c) => /^txt$/i.test(c))) type = 'TXT';
    const name = relName(hostCell.split(/\s/)[0], cfg.zone);
    const key = `${type}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({ type, name, content: valueCell.replace(/^"|"$/g, ''), proxied: false, ttl: 1, purpose: 'scraped from Klaviyo' });
  }
  return records;
}

function mergeIntoDnsConfig(scraped, cfg) {
  let base;
  if (existsSync(DNS_CONFIG_PATH)) base = JSON.parse(readFileSync(DNS_CONFIG_PATH, 'utf8'));
  else if (existsSync(DNS_EXAMPLE_PATH)) base = JSON.parse(readFileSync(DNS_EXAMPLE_PATH, 'utf8'));
  else base = { zone: cfg.zone, records: [] };
  const byKey = new Map();
  for (const r of base.records || []) if (r.type === 'TXT') byKey.set(`${r.type}:${r.name}`, r); // keep SPF/DMARC
  for (const r of scraped) byKey.set(`${r.type}:${r.name}`, r);
  base.zone = cfg.zone;
  base.records = [...byKey.values()];
  for (const r of base.records) if (r.type !== 'TXT') r.proxied = false; // grey-cloud safety
  writeFileSync(DNS_CONFIG_PATH, `${JSON.stringify(base, null, 2)}\n`);
  return base;
}

async function cmdExtract(args, cfg) {
  const browser = await launch(args.headless);
  try {
    const context = await sessionContext(browser, 'klaviyo');
    const page = await context.newPage();
    console.log(`\nOpening ${cfg.domainsUrl}`);
    await page.goto(cfg.domainsUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await assertLoggedIn(page, 'extract');
    const shotFile = await shot(page, 'extract-domains');
    const scraped = await scrapeRecords(page, cfg);
    if (!scraped.length) {
      const html = await dumpHtml(page, 'extract-no-records');
      throw new Error(
        `No DNS records detected. Either "${cfg.sendingDomain}" isn't added in Klaviyo yet, or the page\n` +
          `selectors changed. Inspect:\n  ${path.relative(ROOT, shotFile)}\n  ${path.relative(ROOT, html)}\n` +
          `then adjust domainsUrl/selectors in scripts/klaviyo-automation.config.json.`,
      );
    }
    const cnames = scraped.filter((r) => r.type === 'CNAME');
    const merged = mergeIntoDnsConfig(scraped, cfg);
    console.log(`\nScraped ${scraped.length} record(s) (${cnames.length} CNAME):`);
    for (const r of scraped) console.log(`   ${r.type.padEnd(5)} ${r.name}  ->  ${r.content}`);
    console.log(`\nWrote ${path.relative(ROOT, DNS_CONFIG_PATH)} (${merged.records.length} records).`);
    if (!cnames.some((r) => /_domainkey/i.test(r.name))) console.warn('   WARNING: no DKIM (_domainkey) CNAME found — check the screenshot.');
    console.log(`   audit screenshot: ${path.relative(ROOT, shotFile)}`);
    return merged;
  } finally {
    if (!args.keepOpen) await browser.close();
  }
}

function applyViaApi() {
  console.log('\nApplying via Cloudflare API (cf-dns-apply.mjs --apply)...\n');
  execFileSync('node', [path.join('scripts', 'cf-dns-apply.mjs'), '--apply'], { cwd: ROOT, stdio: 'inherit' });
}

// Full browser path: create each record in the Cloudflare dashboard.
async function cmdCfApplyUi(args, cfg) {
  const config = existsSync(DNS_CONFIG_PATH)
    ? JSON.parse(readFileSync(DNS_CONFIG_PATH, 'utf8'))
    : (() => { throw new Error('scripts/cf-dns.config.json not found — run extract first.'); })();

  // Grey-cloud guard (mirrors cf-dns-apply.mjs) before any UI action.
  const bad = (config.records || []).filter((r) => r.proxied === true && /(_domainkey|send|tracking|bounce)/i.test(r.name));
  if (bad.length) throw new Error('Refusing: email/Klaviyo records must be DNS-only (proxied:false).');

  const browser = await launch(args.headless);
  try {
    const context = await sessionContext(browser, 'cloudflare');
    const page = await context.newPage();
    const dnsUrl = cfg.cloudflareDnsUrl || cfg.cloudflareDashUrl;
    console.log(`\nOpening Cloudflare dashboard: ${dnsUrl}`);
    await page.goto(dnsUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await assertLoggedIn(page, 'cf-apply-ui');

    // If we landed on the account home, click into the zone then the DNS section.
    if (!cfg.cloudflareDnsUrl) {
      const zoneLink = page.locator(`a:has-text("${cfg.zone}")`).first();
      if (await zoneLink.count()) { await zoneLink.click().catch(() => {}); await page.waitForTimeout(2500); }
      const dnsNav = page.locator(cfg.cfSelectors.dnsNav).first();
      if (await dnsNav.count()) { await dnsNav.click().catch(() => {}); await page.waitForTimeout(2500); }
    }
    await shot(page, 'cf-dns-page');

    for (const r of config.records || []) {
      console.log(`  Adding ${r.type} ${r.name} -> ${r.content} [${r.proxied ? 'PROXIED' : 'dns-only'}]`);
      const addBtn = page.locator(cfg.cfSelectors.addRecordButton).first();
      await addBtn.click({ timeout: 15000 });
      await page.waitForTimeout(800);

      // Type
      const typeSel = page.locator(cfg.cfSelectors.typeSelect).first();
      if (await typeSel.count()) { await typeSel.selectOption({ label: r.type }).catch(async () => { await typeSel.click().catch(() => {}); await page.locator(`text="${r.type}"`).first().click().catch(() => {}); }); }
      // Name + content
      await page.locator(cfg.cfSelectors.nameInput).first().fill(r.name === '@' ? cfg.zone : r.name).catch(() => {});
      await page.locator(cfg.cfSelectors.contentInput).first().fill(r.content).catch(() => {});
      // Proxy: ensure OFF for non-TXT email records (and generally honor r.proxied)
      if (r.type !== 'TXT') {
        const toggle = page.locator(cfg.cfSelectors.proxyToggle).first();
        if (await toggle.count()) {
          const state = await toggle.getAttribute('aria-checked').catch(() => null);
          const isOn = state === 'true';
          if (isOn !== Boolean(r.proxied)) await toggle.click().catch(() => {});
        }
      }
      await shot(page, `cf-record-${r.type}-${r.name}`.replace(/[^a-z0-9-]/gi, '_'));
      await page.locator(cfg.cfSelectors.saveButton).first().click().catch(() => {});
      await page.waitForTimeout(2000);
    }
    await shot(page, 'cf-apply-done');
    console.log('\nCloudflare UI apply complete. Spot-check the dashboard + screenshots in .klaviyo-automation/.');
  } finally {
    if (!args.keepOpen) await browser.close();
  }
}

async function cmdVerify(args, cfg) {
  const browser = await launch(args.headless);
  try {
    const context = await sessionContext(browser, 'klaviyo');
    const page = await context.newPage();
    await page.goto(cfg.domainsUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await assertLoggedIn(page, 'verify');
    const btn = page.locator(cfg.selectors.verifyButton).first();
    if (await btn.count()) { console.log('Clicking Verify in Klaviyo...'); await btn.click().catch(() => {}); await page.waitForTimeout(4000); }
    else console.log('No Verify button found (may already be verified).');
    const shotFile = await shot(page, 'verify-result');
    const body = (await page.locator('body').innerText().catch(() => '')) || '';
    const verified = /verified|authenticated/i.test(body) && !/not verified|unverified|pending/i.test(body);
    console.log(`\nVerify ${verified ? 'PASSED' : 'not confirmed (may still be propagating)'}.`);
    console.log(`   screenshot: ${path.relative(ROOT, shotFile)}`);
    return verified;
  } finally {
    if (!args.keepOpen) await browser.close();
  }
}

async function cmdRun(args, cfg) {
  await cmdExtract(args, cfg);
  if (args.noApply) {
    console.log('\n--no-apply: review scripts/cf-dns.config.json, then apply with npm run cf:dns:apply (or cf:ui:apply).');
    return;
  }
  if (args.cfMode === 'ui') await cmdCfApplyUi(args, cfg);
  else applyViaApi();

  const waits = [15000, 30000, 60000];
  for (let i = 0; i < waits.length; i++) {
    console.log(`\nWaiting ${waits[i] / 1000}s for DNS propagation (attempt ${i + 1}/${waits.length})...`);
    await new Promise((r) => setTimeout(r, waits[i]));
    if (await cmdVerify(args, cfg)) { console.log('\nDone — sending domain verified end to end.'); return; }
  }
  console.log('\nNot verified yet. DNS can take longer; re-run:  npm run klaviyo:verify');
}

// --- entry -----------------------------------------------------------------
const HELP = [
  'klaviyo-cf-automation — full browser-agent setup for the Klaviyo branded sending domain',
  '',
  'Commands:',
  '  login <klaviyo|cloudflare>   Headed sign-in; save the session.',
  '  session-b64 <service>        Print base64 of a saved session (for CI secrets).',
  '  extract                      Scrape Klaviyo DNS records into scripts/cf-dns.config.json.',
  '  cf-apply-ui                  Create records in the Cloudflare dashboard (full browser).',
  '  verify                       Click Klaviyo "Verify" and report status.',
  '  run [--cf-mode api|ui]       extract -> apply -> wait -> verify.',
  '',
  'Flags: --headless  --no-apply  --keep-open  --cf-mode <api|ui>',
].join('\n');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = loadConfig();
  if (!args.cmd || args.cmd === '--help' || args.cmd === '-h') { console.log(HELP); return; }
  switch (args.cmd) {
    case 'login': return cmdLogin(args, cfg);
    case 'session-b64': return cmdSessionB64(args);
    case 'extract': return cmdExtract(args, cfg);
    case 'cf-apply-ui': return cmdCfApplyUi(args, cfg);
    case 'verify': return cmdVerify(args, cfg);
    case 'run': return cmdRun(args, cfg);
    default: throw new Error(`Unknown command: ${args.cmd} (try --help)`);
  }
}

main().catch((err) => { console.error(`\nError: ${err.message}\n`); process.exit(1); });
