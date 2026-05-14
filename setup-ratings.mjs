/**
 * TipTop360 — Rating Metafield Setup
 * Creates custom.rating + custom.review_count definitions
 * and sets default values on all products that don't have them yet.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = join(__dirname, '.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const STORE = env.SHOPIFY_STORE;
const CLIENT_ID = env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = env.SHOPIFY_CLIENT_SECRET;
const API_VERSION = '2024-10';
const GQL_URL = `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;

// ── Auth ──────────────────────────────────────────────────────────────
let _token = null;
async function getToken() {
  if (_token) return _token;
  const res = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  _token = (await res.json()).access_token;
  return _token;
}

async function gql(query, variables = {}) {
  const token = await getToken();
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

// ── Step 1: Get existing metafield definitions ─────────────────────────
async function getExistingDefinitions() {
  const data = await gql(`{
    metafieldDefinitions(ownerType: PRODUCT, first: 50) {
      edges { node { id namespace key type { name } } }
    }
  }`);
  return data.metafieldDefinitions.edges.map(e => e.node);
}

// ── Step 2: Create a metafield definition ─────────────────────────────
async function createDefinition(namespace, key, name, type, description) {
  const data = await gql(`
    mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition { id namespace key }
        userErrors { field message }
      }
    }
  `, {
    definition: {
      namespace,
      key,
      name,
      description,
      type,
      ownerType: 'PRODUCT',
    }
  });
  const result = data.metafieldDefinitionCreate;
  if (result.userErrors.length) throw new Error(result.userErrors.map(e => e.message).join(', '));
  return result.createdDefinition;
}

// ── Step 3: Get all products ──────────────────────────────────────────
async function getAllProducts() {
  const products = [];
  let cursor = null;
  let hasNext = true;
  while (hasNext) {
    const data = await gql(`
      query GetProducts($after: String) {
        products(first: 50, after: $after) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              metafields(namespace: "custom", first: 10) {
                edges { node { key value } }
              }
            }
          }
        }
      }
    `, { after: cursor });
    const page = data.products;
    for (const edge of page.edges) products.push(edge.node);
    hasNext = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }
  return products;
}

// ── Step 4: Set metafields on a product ──────────────────────────────
async function setProductMetafields(productId, rating, reviewCount) {
  const data = await gql(`
    mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { key value }
        userErrors { field message }
      }
    }
  `, {
    metafields: [
      { ownerId: productId, namespace: 'custom', key: 'rating', value: String(rating), type: 'number_decimal' },
      { ownerId: productId, namespace: 'custom', key: 'review_count', value: String(reviewCount), type: 'number_integer' },
    ]
  });
  const result = data.metafieldsSet;
  if (result.userErrors.length) throw new Error(result.userErrors.map(e => e.message).join(', '));
  return result.metafields;
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('TipTop360 Rating Metafield Setup\n' + '='.repeat(40));

  // Step 1: Check existing definitions
  console.log('\nChecking existing metafield definitions...');
  const existing = await getExistingDefinitions();
  const hasRating = existing.some(d => d.namespace === 'custom' && d.key === 'rating');
  const hasCount = existing.some(d => d.namespace === 'custom' && d.key === 'review_count');

  // Step 2: Create missing definitions
  if (!hasRating) {
    console.log('Creating custom.rating definition...');
    await createDefinition('custom', 'rating', 'Rating', 'number_decimal', 'Product rating (1-5 scale)');
    console.log('  custom.rating created');
  } else {
    console.log('  custom.rating already exists');
  }

  if (!hasCount) {
    console.log('Creating custom.review_count definition...');
    await createDefinition('custom', 'review_count', 'Review Count', 'number_integer', 'Number of reviews');
    console.log('  custom.review_count created');
  } else {
    console.log('  custom.review_count already exists');
  }

  // Step 3: Get all products
  console.log('\nFetching all products...');
  const products = await getAllProducts();
  console.log(`Found ${products.length} products`);

  // Step 4: Set defaults on products that don't have ratings yet
  let updated = 0;
  let skipped = 0;
  for (const product of products) {
    const mfs = product.metafields.edges.map(e => e.node);
    const hasExistingRating = mfs.some(m => m.key === 'rating');
    const hasExistingCount = mfs.some(m => m.key === 'review_count');

    if (hasExistingRating && hasExistingCount) {
      skipped++;
      continue;
    }

    // Default: 4.7 rating, 23 reviews
    await setProductMetafields(product.id, 4.7, 23);
    console.log(`  Set defaults on: ${product.title}`);
    updated++;
  }

  console.log('\n' + '='.repeat(40));
  console.log(`Done. Updated: ${updated} products, Skipped (already set): ${skipped}`);
  console.log('\nStar ratings will appear in Google search results within 7-14 days.');
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
