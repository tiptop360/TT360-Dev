/**
 * deploy-utils.cjs
 * Shared helpers for all TipTop360 deploy scripts.
 *
 * Key export: mergeTemplate(server, defaults)
 *   - Server values WIN for every key that already exists.
 *   - Default values only fill in MISSING keys.
 *   - Blocks and block_order are never touched (editor changes survive).
 *   - Entirely new sections from defaults are appended if absent on server.
 *
 * This ensures theme-editor saves (including video URLs, custom copy,
 * block additions/removals) are never overwritten by script updates.
 */

'use strict';

const FETCH_QUERY = (themeId, filename) => `{
  theme(id: "${themeId}") {
    files(filenames: ["${filename}"], first: 1) {
      nodes {
        filename
        body { ... on OnlineStoreThemeFileBodyText { content } }
      }
    }
  }
}`;

const UPSERT_MUTATION = `
  mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
    themeFilesUpsert(themeId: $themeId, files: $files) {
      upsertedThemeFiles { filename updatedAt }
      userErrors { filename field message }
    }
  }
`;

/**
 * Execute any Admin GraphQL operation.
 */
async function gql(fetchFn, store, token, query, variables = {}) {
  const r = await fetchFn(`https://${store}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables })
  });
  const json = await r.json();
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

/**
 * Fetch a theme file's text content from the server.
 * Returns parsed JSON object for .json files, raw string otherwise.
 * Returns null if the file doesn't exist yet.
 */
async function fetchServerTemplate(fetchFn, store, token, themeId, filename) {
  const data = await gql(fetchFn, store, token, FETCH_QUERY(themeId, filename));
  const node = data?.theme?.files?.nodes?.[0];
  if (!node?.body?.content) return null;
  if (filename.endsWith('.json')) {
    try { return JSON.parse(node.body.content); } catch { return null; }
  }
  return node.body.content;
}

/**
 * Deep-merge a server template JSON with script defaults.
 *
 * Rules:
 *  - Server wins for every key that already exists (settings, blocks, order).
 *  - Missing settings keys are filled from defaults.
 *  - Missing sections are appended from defaults.
 *  - blocks / block_order are NEVER changed — editor state is sacred.
 */
function mergeTemplate(server, defaults) {
  if (!server) return JSON.parse(JSON.stringify(defaults));

  const result = JSON.parse(JSON.stringify(server));

  if (!defaults || !defaults.sections) return result;

  for (const [key, defSection] of Object.entries(defaults.sections)) {
    if (!result.sections[key]) {
      // Whole section is new — add it verbatim
      result.sections[key] = JSON.parse(JSON.stringify(defSection));
    } else {
      // Section exists — only backfill missing setting keys
      const serverSettings = result.sections[key].settings || {};
      for (const [k, v] of Object.entries(defSection.settings || {})) {
        if (!(k in serverSettings)) serverSettings[k] = v;
      }
      result.sections[key].settings = serverSettings;
      // blocks + block_order: server wins — no merge performed
    }
  }

  // Append any sections from the default order that are absent in server order
  if (defaults.order && Array.isArray(result.order)) {
    for (const key of defaults.order) {
      if (!result.order.includes(key)) result.order.push(key);
    }
  }

  return result;
}

/**
 * Upload a single file to the theme.
 */
async function uploadFile(fetchFn, store, token, themeId, filename, content) {
  const data = await gql(fetchFn, store, token, UPSERT_MUTATION, {
    themeId,
    files: [{ filename, body: { type: 'TEXT', value: content } }]
  });
  const errs = data?.themeFilesUpsert?.userErrors;
  if (errs && errs.length > 0) {
    throw new Error(`Upload failed [${filename}]: ${errs.map(e => e.message).join(', ')}`);
  }
  const f = data?.themeFilesUpsert?.upsertedThemeFiles?.[0];
  console.log(`  ✅ ${f?.filename} — ${f?.updatedAt}`);
}

module.exports = { gql, fetchServerTemplate, mergeTemplate, uploadFile };
