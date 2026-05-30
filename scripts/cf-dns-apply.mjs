#!/usr/bin/env node
// cf-dns-apply.mjs — idempotently create/update Cloudflare DNS records for tiptop360.com
// from scripts/cf-dns.config.json. Dry-run by default; pass --apply to write.
//
// HARD SAFETY RULE: refuses to set proxied:true on any email/Klaviyo record
// (DKIM, return-path/send, click tracking). See docs/CLOUDFLARE_KLAVIYO_STRATEGY.md.
//
// Env (from .env): CF_ZONE (zone id), CF_API_TOKEN (needs Zone -> DNS -> Edit)
// Usage:
//   node scripts/cf-dns-apply.mjs            # dry-run plan
//   node scripts/cf-dns-apply.mjs --apply    # apply changes
//   node scripts/cf-dns-apply.mjs --config path/to.json

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const API = 'https://api.cloudflare.com/client/v4';

// --- helpers ---------------------------------------------------------------
function loadEnvFile(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  for (const rawLine of readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2];
  }
  return env;
}

function parseArgs(argv) {
  const args = { apply: false, config: path.join(ROOT, 'scripts', 'cf-dns.config.json') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--config') args.config = path.resolve(argv[++i]);
  }
  return args;
}

// Names that must NEVER be proxied (email/Klaviyo auth + tracking).
function isEmailRecord(name) {
  const n = name.toLowerCase();
  return (
    n.includes('_domainkey') ||
    n === 'send' || n.startsWith('send.') || n.includes('.send') ||
    n.startsWith('tracking') || n.includes('bounce') || n === '_dmarc' || n.startsWith('_dmarc.')
  );
}

function fqdn(name, zoneName) {
  if (!name || name === '@') return zoneName;
  return name.endsWith(zoneName) ? name : `${name}.${zoneName}`;
}

async function cf(token, method, urlPath, body) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!json.success) {
    const errs = (json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ');
    throw new Error(`Cloudflare API ${method} ${urlPath} failed: ${errs || res.status}`);
  }
  return json;
}

// --- main ------------------------------------------------------------------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = { ...loadEnvFile(ENV_PATH), ...process.env };
  const { CF_ZONE, CF_API_TOKEN } = env;

  if (!existsSync(args.config)) {
    throw new Error(
      `Config not found: ${args.config}\n` +
        `Copy scripts/cf-dns.config.example.json to scripts/cf-dns.config.json and fill in Klaviyo targets.`,
    );
  }
  const config = JSON.parse(readFileSync(args.config, 'utf8'));
  const zoneName = config.zone || 'tiptop360.com';
  const records = (config.records || []).filter((r) => !r._skip);

  // 1) Validate the grey-cloud rule BEFORE touching the API.
  const violations = records.filter((r) => r.proxied === true && isEmailRecord(r.name));
  if (violations.length) {
    console.error('\n  REFUSING TO PROCEED — email/Klaviyo records must be DNS-only (grey cloud):');
    for (const v of violations) console.error(`   - ${v.type} ${v.name} has proxied:true (must be false)`);
    console.error('\n  Set proxied:false on these records. See docs/CLOUDFLARE_KLAVIYO_STRATEGY.md section 0.\n');
    process.exit(2);
  }

  console.log(`\nCloudflare DNS ${args.apply ? 'APPLY' : 'PLAN (dry-run)'} — zone ${zoneName}`);
  console.log(`Config: ${path.relative(ROOT, args.config)}  ·  ${records.length} record(s)\n`);

  if (!args.apply) {
    for (const r of records) {
      const proxy = r.type === 'TXT' ? '—' : r.proxied ? 'PROXIED' : 'dns-only';
      console.log(`  WOULD UPSERT  ${r.type.padEnd(5)} ${fqdn(r.name, zoneName).padEnd(38)} -> ${r.content}   [${proxy}]`);
    }
    console.log(`\nDry-run only. Re-run with --apply to write these records.`);
    console.log(`(requires CF_ZONE and CF_API_TOKEN with Zone->DNS->Edit permission)\n`);
    return;
  }

  if (!CF_ZONE || !CF_API_TOKEN) {
    throw new Error('CF_ZONE and CF_API_TOKEN must be set in .env to --apply.');
  }

  // 2) Upsert each record (GET by name+type, then PUT or POST).
  for (const r of records) {
    const name = fqdn(r.name, zoneName);
    const list = await cf(
      CF_API_TOKEN,
      'GET',
      `/zones/${CF_ZONE}/dns_records?type=${encodeURIComponent(r.type)}&name=${encodeURIComponent(name)}`,
    );
    const payload = {
      type: r.type,
      name,
      content: r.content,
      ttl: r.ttl || 1,
      ...(r.type === 'TXT' ? {} : { proxied: Boolean(r.proxied) }),
    };
    const existing = list.result && list.result[0];
    if (existing) {
      await cf(CF_API_TOKEN, 'PUT', `/zones/${CF_ZONE}/dns_records/${existing.id}`, payload);
      console.log(`  UPDATED  ${r.type.padEnd(5)} ${name}`);
    } else {
      await cf(CF_API_TOKEN, 'POST', `/zones/${CF_ZONE}/dns_records`, payload);
      console.log(`  CREATED  ${r.type.padEnd(5)} ${name}`);
    }
  }

  console.log(`\nDone. Verify with: npm run cf:dns:verify`);
  console.log(`Then click "Verify" on the sending domain in Klaviyo -> Settings -> Domains.\n`);
}

main().catch((err) => {
  console.error(`\nError: ${err.message}\n`);
  process.exit(1);
});
