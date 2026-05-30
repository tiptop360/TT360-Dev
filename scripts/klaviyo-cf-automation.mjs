#!/usr/bin/env node
// klaviyo-cf-automation.mjs — browser-agent automation for the Klaviyo <-> Cloudflare
// branded sending domain setup, designed to eliminate copy-paste / misclick errors.
//
// HYBRID design (see docs/CLOUDFLARE_KLAVIYO_STRATEGY.md):
//   1. login    — open a real (headed) browser, you sign in to Klaviyo + 2FA once;
//                 the session is saved to .klaviyo-session.json (git-ignored).
//   2. extract  — reuse the session, open Settings -> Domains, and SCRAPE the exact
//                 DNS records Klaviyo generated for the sending domain straight into
//                 scripts/cf-dns.config.json. No human transcription = no typos.
//   3. (apply)  — hand off to scripts/cf-dns-apply.mjs, which writes the records to
//                 Cloudflare via the API (more reliable than UI clicking) and REFUSES
//                 to proxy any email record (grey-cloud guard).
//   4. verify   — reuse the session, click Klaviyo's "Verify" and report status.
//   run         — extract -> apply -> (wait) -> verify, end to end.
//
// Built for LOCAL, HEADED runs (Klaviyo/Cloudflare block headless/bot logins).
// Screenshots + page-HTML dumps are written to .klaviyo-automation/ for every step,
// so any selector drift in Klaviyo's UI is trivial to diagnose and fix in the config.
//
// Setup (first time, on your machine):
//   npm install
//   npx playwright install chromium
//   cp scripts/klaviyo-automation.config.example.json scripts/klaviyo-automation.config.json   # optional: override URLs/selectors
//   cp scripts/cf-dns.config.example.json scripts/cf-dns.config.json                           # holds SPF/DMARC defaults
//   # set CF_ZONE and CF_API_TOKEN (Zone->DNS->Edit) in .env
//
// Usage:
//   node scripts/klaviyo-cf-automation.mjs login
//   node scripts/klaviyo-cf-automation.mjs extract
//   node scripts/klaviyo-cf-automation.mjs verify
//   node scripts/klaviyo-cf-automation.mjs run [--no-apply] [--headless] [--keep-open]

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SESSION_PATH = path.join(ROOT, '.klaviyo-session.json');
const SHOTS_DIR = path.join(ROOT, '.klaviyo-automation');
const DNS_CONFIG_PATH = path.join(ROOT, 'scripts', 'cf-dns.config.json');
const DNS_EXAMPLE_PATH = path.join(ROOT, 'scripts', 'cf-dns.config.example.json');
const AUTO_CONFIG_PATH = path.join(ROOT, 'scripts', 'klaviyo-automation.config.json');

// --- defaults (override any of these in scripts/klaviyo-automation.config.json) ---
const DEFAULTS = {
  loginUrl: 'https://www.klaviyo.com/login',
  // Klaviyo has moved this page over time; override here if your account differs.
  domainsUrl: 'https://www.klaviyo.com/settings/account/domains',
  sendingDomain: 'send.tiptop360.com',
  zone: 'tiptop360.com',
  // Heuristic selectors — text-based so they survive minor markup changes.
  selectors: {
    loggedInMarker: 'nav, [data-testid="global-nav"], a[href*="/dashboard"]',
    recordRow: 'tr',
    verifyButton: 'button:has-text("Verify"), button:has-text("Re-verify")',
    statusBadge: ':text("Verified"), :text("Authenticated"), :text("Pending")',
  },
  // Hostnames whose CNAME target marks a row as a real Klaviyo DNS record.
  klaviyoTargetHints: ['klaviyomail.com', 'klaviyodelivery.com', 'klclick.com', 'klaviyo.com'],
};

// --- small utils -----------------------------------------------------------
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
    const override = JSON.parse(readFileSync(AUTO_CONFIG_PATH, 'utf8'));
    cfg = { ...cfg, ...override, selectors: { ...DEFAULTS.selectors, ...(override.selectors || {}) } };
  }
  const env = loadEnvFile(path.join(ROOT, '.env'));
  if (env.KLAVIYO_SENDING_DOMAIN) cfg.sendingDomain = env.KLAVIYO_SENDING_DOMAIN;
  return cfg;
}

function parseArgs(argv) {
  return {
    cmd: argv[0],
    headless: argv.includes('--headless'),
    noApply: argv.includes('--no-apply'),
    keepOpen: argv.includes('--keep-open'),
  };
}

function ensureDir(d) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function shot(page, name) {
  ensureDir(SHOTS_DIR);
  const file = path.join(SHOTS_DIR, `${ts()}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  return file;
}

async function dumpHtml(page, name) {
  ensureDir(SHOTS_DIR);
  const file = path.join(SHOTS_DIR, `${ts()}-${name}.html`);
  try {
    writeFileSync(file, await page.content());
  } catch {
    /* ignore */
  }
  return file;
}

function waitForEnter(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
  });
}

function relName(host, zone) {
  const h = host.replace(/\.$/, '');
  if (h === zone) return '@';
  return h.endsWith(`.${zone}`) ? h.slice(0, -(`.${zone}`).length) : h;
}

// --- browser helpers -------------------------------------------------------
async function launch(headless) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless });
  return browser;
}

async function newSessionContext(browser) {
  if (!existsSync(SESSION_PATH)) {
    throw new Error(
      `No saved session at ${path.relative(ROOT, SESSION_PATH)}.\n` +
        `Run:  node scripts/klaviyo-cf-automation.mjs login`,
    );
  }
  return browser.newContext({ storageState: SESSION_PATH });
}

async function assertLoggedIn(page, cfg, label) {
  if (/\/login|\/signin/i.test(page.url())) {
    await shot(page, `${label}-not-logged-in`);
    throw new Error(
      `Session expired or invalid (redirected to login). Re-run:  node scripts/klaviyo-cf-automation.mjs login`,
    );
  }
}

// --- commands --------------------------------------------------------------
async function cmdLogin(args, cfg) {
  console.log('\nOpening a browser window. Log into Klaviyo and complete 2FA.');
  const browser = await launch(false); // login is always headed
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(cfg.loginUrl, { waitUntil: 'domcontentloaded' });

  await waitForEnter(
    '\n>> When you are fully logged in (you can see the Klaviyo dashboard), press ENTER here to save the session... ',
  );

  await context.storageState({ path: SESSION_PATH });
  await shot(page, 'login-saved');
  console.log(`\nSession saved to ${path.relative(ROOT, SESSION_PATH)} (git-ignored).`);
  if (!args.keepOpen) await browser.close();
}

async function scrapeRecords(page, cfg) {
  // Pull every table-ish row's cells, then classify rows that look like DNS records.
  const rows = await page.evaluate(() => {
    const out = [];
    for (const tr of Array.from(document.querySelectorAll('tr'))) {
      const cells = Array.from(tr.querySelectorAll('td,th'))
        .map((c) => (c.innerText || '').trim())
        .filter(Boolean);
      if (cells.length) out.push(cells);
    }
    return out;
  });

  const records = [];
  const seen = new Set();
  for (const cells of rows) {
    const joined = cells.join(' | ');
    const hasKlaviyoTarget = cfg.klaviyoTargetHints.some((h) => joined.toLowerCase().includes(h));
    const looksTxt = /v=spf1|v=dmarc1|v=dkim1/i.test(joined);
    if (!hasKlaviyoTarget && !looksTxt) continue;

    // Identify the host cell (mentions our domain) and the value cell.
    const hostCell = cells.find((c) => c.toLowerCase().includes(cfg.zone)) || cells[0];
    const valueCell =
      cells.find(
        (c) => c !== hostCell && (cfg.klaviyoTargetHints.some((h) => c.toLowerCase().includes(h)) || /^v=/i.test(c)),
      ) || cells[cells.length - 1];

    let type = 'CNAME';
    if (/^v=/i.test(valueCell)) type = 'TXT';
    else if (cells.some((c) => /^cname$/i.test(c))) type = 'CNAME';
    else if (cells.some((c) => /^txt$/i.test(c))) type = 'TXT';

    const host = hostCell.split(/\s/)[0];
    const name = relName(host, cfg.zone);
    const content = valueCell.replace(/^"|"$/g, '');

    const key = `${type}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({ type, name, content, proxied: false, ttl: 1, purpose: 'scraped from Klaviyo' });
  }
  return records;
}

function mergeIntoDnsConfig(scraped, cfg) {
  // Start from existing cf-dns.config.json, else the example (for SPF/DMARC defaults).
  let base;
  if (existsSync(DNS_CONFIG_PATH)) base = JSON.parse(readFileSync(DNS_CONFIG_PATH, 'utf8'));
  else if (existsSync(DNS_EXAMPLE_PATH)) base = JSON.parse(readFileSync(DNS_EXAMPLE_PATH, 'utf8'));
  else base = { zone: cfg.zone, records: [] };

  const byKey = new Map();
  // Keep existing TXT (SPF/DMARC) defaults; replace any existing CNAMEs with scraped truth.
  for (const r of base.records || []) {
    if (r.type === 'TXT') byKey.set(`${r.type}:${r.name}`, r);
  }
  for (const r of scraped) byKey.set(`${r.type}:${r.name}`, r);

  base.zone = cfg.zone;
  base.records = [...byKey.values()];
  // Safety: force grey-cloud on everything (apply script also enforces this).
  for (const r of base.records) if (r.type !== 'TXT') r.proxied = false;

  writeFileSync(DNS_CONFIG_PATH, `${JSON.stringify(base, null, 2)}\n`);
  return base;
}

async function cmdExtract(args, cfg) {
  const browser = await launch(args.headless);
  try {
    const context = await newSessionContext(browser);
    const page = await context.newPage();
    console.log(`\nOpening ${cfg.domainsUrl}`);
    await page.goto(cfg.domainsUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await assertLoggedIn(page, cfg, 'extract');

    const shotFile = await shot(page, 'extract-domains');
    const scraped = await scrapeRecords(page, cfg);

    if (!scraped.length) {
      const html = await dumpHtml(page, 'extract-no-records');
      throw new Error(
        `No DNS records detected on the Domains page.\n` +
          `This usually means (a) the sending domain "${cfg.sendingDomain}" isn't added yet — add it once in the\n` +
          `Klaviyo UI, or (b) the page selectors changed. Inspect the saved screenshot/HTML and, if needed, set a\n` +
          `correct "domainsUrl" or selectors in scripts/klaviyo-automation.config.json:\n` +
          `   screenshot: ${path.relative(ROOT, shotFile)}\n` +
          `   html:       ${path.relative(ROOT, html)}`,
      );
    }

    const cnames = scraped.filter((r) => r.type === 'CNAME');
    const merged = mergeIntoDnsConfig(scraped, cfg);

    console.log(`\nScraped ${scraped.length} record(s) (${cnames.length} CNAME) from Klaviyo:`);
    for (const r of scraped) console.log(`   ${r.type.padEnd(5)} ${r.name}  ->  ${r.content}`);
    console.log(`\nWrote ${path.relative(ROOT, DNS_CONFIG_PATH)} (${merged.records.length} total records).`);

    // Sanity warnings — help catch a partial scrape before applying.
    if (!cnames.some((r) => /_domainkey/i.test(r.name))) {
      console.warn('   WARNING: no DKIM (_domainkey) CNAME found — double-check the screenshot.');
    }
    console.log(`   audit screenshot: ${path.relative(ROOT, shotFile)}`);
    return merged;
  } finally {
    if (!args.keepOpen) await browser.close();
  }
}

function applyToCloudflare() {
  console.log('\nApplying records to Cloudflare via API (scripts/cf-dns-apply.mjs --apply)...\n');
  execFileSync('node', [path.join('scripts', 'cf-dns-apply.mjs'), '--apply'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

async function cmdVerify(args, cfg) {
  const browser = await launch(args.headless);
  try {
    const context = await newSessionContext(browser);
    const page = await context.newPage();
    await page.goto(cfg.domainsUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await assertLoggedIn(page, cfg, 'verify');

    const verifyBtn = page.locator(cfg.selectors.verifyButton).first();
    if (await verifyBtn.count()) {
      console.log('Clicking Verify in Klaviyo...');
      await verifyBtn.click().catch(() => {});
      await page.waitForTimeout(4000);
    } else {
      console.log('No Verify button found (domain may already be verified).');
    }

    const shotFile = await shot(page, 'verify-result');
    const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
    const verified = /verified|authenticated/i.test(bodyText) && !/not verified|unverified|pending/i.test(bodyText);
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
    console.log('\n--no-apply set: skipping Cloudflare write. Review scripts/cf-dns.config.json then run:');
    console.log('   npm run cf:dns:apply');
    return;
  }
  applyToCloudflare();

  // DNS propagation: poll verify a few times with backoff.
  const waits = [15000, 30000, 60000];
  for (let i = 0; i < waits.length; i++) {
    console.log(`\nWaiting ${waits[i] / 1000}s for DNS propagation before verifying (attempt ${i + 1}/${waits.length})...`);
    await new Promise((r) => setTimeout(r, waits[i]));
    const ok = await cmdVerify(args, cfg);
    if (ok) {
      console.log('\nDone — sending domain verified end to end.');
      return;
    }
  }
  console.log('\nNot verified yet. DNS can take longer to propagate. Re-run later:');
  console.log('   npm run klaviyo:verify');
}

// --- entry -----------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = loadConfig();

  if (!args.cmd || args.cmd === '--help' || args.cmd === '-h') {
    console.log(
      [
        'klaviyo-cf-automation — browser-agent setup for the Klaviyo branded sending domain',
        '',
        'Commands:',
        '  login     Open a headed browser; log in + 2FA once; save the session.',
        '  extract   Scrape Klaviyo DNS records into scripts/cf-dns.config.json.',
        '  verify    Click Klaviyo "Verify" and report status.',
        '  run       extract -> apply (Cloudflare API) -> wait -> verify.',
        '',
        'Flags: --headless  --no-apply  --keep-open',
        '',
        `Sending domain: ${cfg.sendingDomain}   Zone: ${cfg.zone}`,
        'See docs/CLOUDFLARE_KLAVIYO_STRATEGY.md.',
      ].join('\n'),
    );
    return;
  }

  switch (args.cmd) {
    case 'login':
      return cmdLogin(args, cfg);
    case 'extract':
      return cmdExtract(args, cfg);
    case 'verify':
      return cmdVerify(args, cfg);
    case 'run':
      return cmdRun(args, cfg);
    default:
      throw new Error(`Unknown command: ${args.cmd} (try --help)`);
  }
}

main().catch((err) => {
  console.error(`\nError: ${err.message}\n`);
  process.exit(1);
});
