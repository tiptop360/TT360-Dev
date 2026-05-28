/**
 * deploy-robots-live.cjs
 * One-shot: pushes templates/robots.txt.liquid to the live theme.
 * Requires SHOPIFY_ACCESS_TOKEN in .env
 * Live theme: 145761960051 (TT360 | Live)
 */

'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const STORE    = 'zrhgzw-xt.myshopify.com';
const THEME_ID = 'gid://shopify/OnlineStoreTheme/145761960051';
const FILE     = path.join(__dirname, 'theme-files/templates/robots.txt.liquid');

const MUTATION = `
  mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
    themeFilesUpsert(themeId: $themeId, files: $files) {
      upsertedThemeFiles { filename updatedAt }
      userErrors { filename field message }
    }
  }
`;

async function run() {
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) {
    console.error('ERROR: SHOPIFY_ACCESS_TOKEN is not set in .env');
    process.exit(1);
  }

  const content = fs.readFileSync(FILE, 'utf8');
  console.log(`Deploying ${FILE} to live theme ${THEME_ID} ...`);

  const res = await fetch(`https://${STORE}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({
      query: MUTATION,
      variables: {
        themeId: THEME_ID,
        files: [{ filename: 'templates/robots.txt.liquid', body: { type: 'TEXT', value: content } }],
      },
    }),
  });

  const json = await res.json();
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }

  const { upsertedThemeFiles, userErrors } = json.data.themeFilesUpsert;
  if (userErrors.length) {
    console.error('User errors:', JSON.stringify(userErrors, null, 2));
    process.exit(1);
  }

  const f = upsertedThemeFiles[0];
  console.log(`SUCCESS: ${f.filename} deployed at ${f.updatedAt}`);
}

run().catch(err => { console.error(err); process.exit(1); });
