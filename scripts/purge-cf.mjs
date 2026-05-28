#!/usr/bin/env node
// scripts/purge-cf.mjs — Purge Cloudflare cache for tiptop360.com paths
//
// Usage:
//   node scripts/purge-cf.mjs /pages/about-us
//   node scripts/purge-cf.mjs /pages/about-us /pages/contact-tiptop360
//   node scripts/purge-cf.mjs https://tiptop360.com/products/kids-drawing-robot
//   node scripts/purge-cf.mjs --all          # purge entire zone (use sparingly)
//
// Requires CF_ZONE_ID and CF_API_TOKEN in .env (or shell env).
// Token needs Zone → Cache Purge → Purge permission on tiptop360.com.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const DEFAULT_HOST = 'https://tiptop360.com';

function loadEnvFile(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  for (const rawLine of readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

function resolveEnv(name) {
  return process.env[name] || loadEnvFile(ENV_PATH)[name] || '';
}

function normalizeUrl(input) {
  if (/^https?:\/\//i.test(input)) return input;
  if (input.startsWith('/')) return `${DEFAULT_HOST}${input}`;
  return `${DEFAULT_HOST}/${input}`;
}

async function purge({ zoneId, token, body, label }) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    const errs = (json.errors || []).map(e => `[${e.code}] ${e.message}`).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Cloudflare purge failed (${label}): ${errs}`);
  }
  return json;
}

async function main() {
  const args = process.argv.slice(2);
  const zoneId = resolveEnv('CF_ZONE_ID');
  const token = resolveEnv('CF_API_TOKEN');

  if (!zoneId || !token) {
    console.error('✗ Missing CF_ZONE_ID or CF_API_TOKEN.');
    console.error('  Add them to .env or export in your shell.');
    console.error('  Zone ID: Cloudflare dashboard → tiptop360.com → Overview → API → Zone ID');
    console.error('  Token:   My Profile → API Tokens → Custom Token → Zone · Cache Purge · Purge');
    process.exit(2);
  }

  if (args.length === 0) {
    console.error('Usage: node scripts/purge-cf.mjs <path-or-url> [more...]');
    console.error('       node scripts/purge-cf.mjs --all');
    process.exit(1);
  }

  if (args.includes('--all')) {
    console.log('⚠  Purging ENTIRE zone tiptop360.com…');
    await purge({ zoneId, token, body: { purge_everything: true }, label: 'full zone' });
    console.log('✓ Full zone purged. Edge will revalidate everything on next hit.');
    return;
  }

  const urls = args.map(normalizeUrl);
  console.log(`Purging ${urls.length} URL(s):`);
  urls.forEach(u => console.log(`  • ${u}`));

  // Cloudflare allows up to 30 files per request.
  for (let i = 0; i < urls.length; i += 30) {
    const chunk = urls.slice(i, i + 30);
    await purge({ zoneId, token, body: { files: chunk }, label: chunk.join(', ') });
  }

  console.log('✓ Purge succeeded. Edge will refresh on next request (~30s).');
}

main().catch(err => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
