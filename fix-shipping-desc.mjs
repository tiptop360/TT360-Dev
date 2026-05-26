/**
 * TipTop360 — Fix shipping page meta description (>155 chars → concise SEO desc)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(__dirname, '.env'), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const STORE = env.SHOPIFY_STORE;
const CLIENT_ID = env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = env.SHOPIFY_CLIENT_SECRET;
const GQL_URL = `https://${STORE}/admin/api/2024-10/graphql.json`;

let _token = null;
async function getToken() {
  if (_token) return _token;
  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' }),
  });
  const data = await res.json();
  _token = data.access_token;
  return _token;
}

async function gql(query, variables = {}) {
  const token = await getToken();
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

// Step 1: Find the page
const findPage = await gql(`{
  pages(first: 5, query: "handle:shipping-policy-page") {
    edges { node { id title handle seo { title description } } }
  }
}`);

const page = findPage.data?.pages?.edges?.[0]?.node;
if (!page) {
  console.error('Page not found'); process.exit(1);
}
console.log('Found:', page.id, page.title);
console.log('Current SEO desc:', page.seo?.description || '(none)');
console.log('Current SEO desc length:', (page.seo?.description || '').length);

// Step 2: Update with a concise 155-char description
const NEW_DESC = 'Fast, reliable shipping across all UAE emirates. Free delivery on eligible orders. Learn about TipTop360 delivery times, fees & tracking.';
console.log(`\nNew desc (${NEW_DESC.length} chars): ${NEW_DESC}`);

const update = await gql(`
  mutation pageUpdate($id: ID!, $page: PageInput!) {
    pageUpdate(id: $id, page: $page) {
      page { id seo { title description } }
      userErrors { field message }
    }
  }
`, {
  id: page.id,
  page: {
    seo: {
      title: page.seo?.title || 'Shipping Policy — TipTop360 UAE',
      description: NEW_DESC,
    }
  }
});

const errors = update.data?.pageUpdate?.userErrors;
if (errors?.length) {
  console.error('Errors:', errors);
} else {
  const updated = update.data?.pageUpdate?.page;
  console.log('\nUpdated successfully!');
  console.log('New desc:', updated?.seo?.description);
  console.log('Length:', updated?.seo?.description?.length);
}
