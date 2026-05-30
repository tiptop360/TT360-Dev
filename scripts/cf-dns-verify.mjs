#!/usr/bin/env node
// cf-dns-verify.mjs — read-only verification of tiptop360.com email/DNS posture.
// Checks each record in scripts/cf-dns.config.json (falls back to the example)
// against live DNS, and reports PASS/FAIL. Also checks:
//   - email/Klaviyo CNAMEs resolve to Klaviyo (NOT Cloudflare proxy IPs)
//   - SPF stays under the 10-DNS-lookup limit
//   - DMARC record present and parseable
//
// No credentials needed — uses Cloudflare DNS-over-HTTPS (1.1.1.1). Network required.
// Usage: node scripts/cf-dns-verify.mjs [--config path]

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOH = 'https://cloudflare-dns.com/dns-query';

let pass = 0;
let fail = 0;
const ok = (m) => { pass++; console.log(`  PASS  ${m}`); };
const bad = (m) => { fail++; console.log(`  FAIL  ${m}`); };

function fqdn(name, zoneName) {
  if (!name || name === '@') return zoneName;
  return name.endsWith(zoneName) ? name : `${name}.${zoneName}`;
}

async function resolve(name, type) {
  const url = `${DOH}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
  const res = await fetch(url, { headers: { accept: 'application/dns-json' } });
  const json = await res.json();
  return (json.Answer || []).map((a) => ({ type: a.type, data: a.data }));
}

// Count SPF includes/lookups (a/mx/include/exists/ptr/redirect) recursively-ish (one level).
async function spfLookupCount(spf) {
  const mechs = (spf.match(/\b(include|a|mx|ptr|exists|redirect)[:=]?/gi) || []).length;
  return mechs;
}

async function main() {
  const cfgPath = process.argv.includes('--config')
    ? path.resolve(process.argv[process.argv.indexOf('--config') + 1])
    : (existsSync(path.join(ROOT, 'scripts', 'cf-dns.config.json'))
        ? path.join(ROOT, 'scripts', 'cf-dns.config.json')
        : path.join(ROOT, 'scripts', 'cf-dns.config.example.json'));

  const config = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const zoneName = config.zone || 'tiptop360.com';
  const usingExample = cfgPath.endsWith('example.json');

  console.log(`\nVerifying DNS for ${zoneName}`);
  console.log(`Config: ${path.relative(ROOT, cfgPath)}${usingExample ? '  (EXAMPLE — values are placeholders)' : ''}\n`);

  for (const r of (config.records || [])) {
    const name = fqdn(r.name, zoneName);
    let answers;
    try {
      answers = await resolve(name, r.type);
    } catch (e) {
      bad(`${r.type} ${name} — DNS query error: ${e.message}`);
      continue;
    }

    if (!answers.length) {
      bad(`${r.type} ${name} — no record found`);
      continue;
    }

    if (r.type === 'CNAME') {
      const target = answers[0].data.replace(/\.$/, '');
      // Email/Klaviyo CNAMEs must point at Klaviyo and NOT be proxied through Cloudflare.
      const isEmail = name.includes('_domainkey') || name.includes('send') || name.startsWith('tracking') || name.includes('bounce');
      if (isEmail) {
        if (/klaviyo/i.test(target)) ok(`${name} -> ${target} (Klaviyo, grey-cloud)`);
        else if (/cloudflare|cdn\.cloudflare/i.test(target)) bad(`${name} -> ${target} — appears PROXIED (orange). Must be DNS-only/grey.`);
        else bad(`${name} -> ${target} — not a Klaviyo target (still a placeholder?)`);
      } else {
        ok(`${name} -> ${target}`);
      }
    } else if (r.type === 'TXT') {
      const txt = answers.map((a) => a.data.replace(/^"|"$/g, '').replace(/" "/g, '')).join(' ');
      if (/^v=spf1|spf1/i.test(txt)) {
        const count = await spfLookupCount(txt);
        if (count <= 10) ok(`SPF ${name} present (${count} mechanisms, <=10)`);
        else bad(`SPF ${name} has ${count} lookups — exceeds 10-lookup limit`);
      } else if (/v=DMARC1/i.test(txt)) {
        const policy = (txt.match(/p=(\w+)/i) || [])[1] || '?';
        ok(`DMARC ${name} present (p=${policy})`);
      } else {
        ok(`TXT ${name} present`);
      }
    } else {
      ok(`${r.type} ${name} present`);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed.`);
  if (usingExample) {
    console.log('NOTE: ran against the EXAMPLE config — copy it to cf-dns.config.json and paste real Klaviyo targets for a meaningful check.');
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  if (/fetch failed|ENOTFOUND|EAI_AGAIN|network/i.test(err.message)) {
    console.error(
      `\nError: could not reach the DNS-over-HTTPS resolver (${err.message}).` +
        `\nThis script needs outbound HTTPS to cloudflare-dns.com. Run it from an ` +
        `environment with network access (e.g. your local machine).\n`,
    );
  } else {
    console.error(`\nError: ${err.message}\n`);
  }
  process.exit(1);
});
