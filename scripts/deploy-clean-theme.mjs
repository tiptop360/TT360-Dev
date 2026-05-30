#!/usr/bin/env node
/**
 * Deploy theme-files/ as a NEW unpublished theme via Shopify's staged-upload + themeCreate.
 * This codifies the method used to ship the Phase 1 cleanup (build a clean ZIP and import it,
 * so no themeFilesDelete is needed). Creates a new theme each run; publishing stays manual.
 *
 *   SHOPIFY_FLAG_STORE=tiptop360.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxx \
 *   node scripts/deploy-clean-theme.mjs "TT360 | Clean (auto)"
 *
 * Requires (same gates as the CLI): network access to *.myshopify.com + storage.googleapis.com,
 * and an Admin API token with write_themes scope.
 *
 * NOTE: This cannot run in the restricted web sandbox (Shopify GraphQL is host_not_allowed there).
 * In the sandbox the same flow is performed via the Shopify MCP graphql_mutation tool — see
 * THEME_DEPLOY_STAGED_UPLOAD.md.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const STORE = process.env.SHOPIFY_FLAG_STORE;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const NAME = process.argv[2] || `TT360 | Clean ${new Date().toISOString().slice(0, 10)}`;
const API = '2025-01';

if (!STORE || !TOKEN) {
  console.error('ERROR: set SHOPIFY_FLAG_STORE and SHOPIFY_ADMIN_TOKEN'); process.exit(1);
}

async function gql(query, variables) {
  const r = await fetch(`https://${STORE}/admin/api/${API}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error('GraphQL: ' + JSON.stringify(j.errors));
  return j.data;
}

const ZIP = join(REPO, 'dist/theme-clean.zip');
console.log('1/4 Building cleaned ZIP…');
execFileSync('bash', [join(REPO, 'scripts/build-theme-zip.sh'), join(REPO, 'theme-files'), ZIP, '--exclude-dead'], { stdio: 'inherit' });
const bytes = statSync(ZIP).size;

console.log('2/4 Requesting staged upload target…');
const staged = await gql(
  `mutation($input:[StagedUploadInput!]!){stagedUploadsCreate(input:$input){stagedTargets{url resourceUrl parameters{name value}} userErrors{message}}}`,
  { input: [{ resource: 'FILE', filename: 'theme-clean.zip', mimeType: 'application/zip', httpMethod: 'POST', fileSize: String(bytes) }] }
);
const t = staged.stagedUploadsCreate.stagedTargets[0];
if (!t) throw new Error('No staged target: ' + JSON.stringify(staged.stagedUploadsCreate.userErrors));

console.log('3/4 Uploading ZIP to staged target…');
const form = new FormData();
for (const p of t.parameters) form.append(p.name, p.value);
form.append('file', new Blob([readFileSync(ZIP)], { type: 'application/zip' }), 'theme-clean.zip');
const up = await fetch(t.url, { method: 'POST', body: form });
if (![200, 201, 204].includes(up.status)) throw new Error(`Upload failed: HTTP ${up.status}`);

console.log('4/4 Creating theme from upload…');
const created = await gql(
  `mutation($source:URL!,$name:String!,$role:ThemeRole){themeCreate(source:$source,name:$name,role:$role){theme{id name role} userErrors{message}}}`,
  { source: t.resourceUrl, name: NAME, role: 'UNPUBLISHED' }
);
const err = created.themeCreate.userErrors;
if (err?.length) throw new Error('themeCreate: ' + JSON.stringify(err));
const theme = created.themeCreate.theme;
console.log(`\n✅ Created unpublished theme: ${theme.name}\n   ${theme.id}`);
console.log('   Preview it (check header search / PDP / collection filters), then publish manually.');
