/**
 * deploy-policy-redesign.cjs
 * ─────────────────────────────────────────────────────────────
 * Pushes the redesigned TipTop360 policy content to the live store.
 *
 *  • Custom Pages (/pages/*)      → pageUpdate            (needs write_content)
 *  • Shop Policies (/policies/*)  → shopPolicyUpdate      (needs write_legal_policies)
 *
 * The footer links Privacy / Refund / Terms to the Shop Policies, and
 * Shipping to the custom shipping-policy-page. Both layers are updated so
 * the customer-facing pages and the SEO landing pages all carry the new design.
 *
 * Source HTML lives in policy-redesign/. Privacy variants are read from
 * policy-redesign/applied/<handle>.html when present (per-jurisdiction copy),
 * otherwise the base privacy-policy.html is used.
 *
 * Usage:
 *   node deploy-policy-redesign.cjs            # dry run (prints plan only)
 *   node deploy-policy-redesign.cjs --execute  # apply to the live store
 *
 * Requires .env:  SHOPIFY_STORE=tiptop360.myshopify.com
 *                 SHOPIFY_ACCESS_TOKEN=shpat_...
 *   The token must include write_content AND write_legal_policies to update
 *   both layers. Pages-only tokens will update pages and skip shop policies.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const STORE = process.env.SHOPIFY_STORE;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const API = '2024-10';
const EXECUTE = process.argv.includes('--execute');
const DIR = path.join(__dirname, 'policy-redesign');
const BK = path.join(__dirname, 'backups', `policy-deploy-${Date.now()}`);

if (!STORE || !TOKEN) {
  console.error('Missing SHOPIFY_STORE or SHOPIFY_ACCESS_TOKEN in .env');
  process.exit(1);
}

const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

async function gql(query, variables) {
  const r = await fetch(`https://${STORE}/admin/api/${API}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data;
}

function read(rel) {
  return fs.readFileSync(path.join(DIR, rel), 'utf8');
}
function privacyBody(handle) {
  const applied = path.join(DIR, 'applied', `${handle}.html`);
  return fs.existsSync(applied) ? fs.readFileSync(applied, 'utf8') : read('privacy-policy.html');
}
function seo(title_tag, description_tag) {
  return [
    { namespace: 'global', key: 'title_tag', value: title_tag, type: 'single_line_text_field' },
    { namespace: 'global', key: 'description_tag', value: description_tag, type: 'single_line_text_field' },
  ];
}

// ── Custom pages ────────────────────────────────────────────────
const PAGES = [
  { gid: '108614844531', handle: 'tiptop360-terms-of-service', body: () => read('terms-of-service.html'),
    title: 'Terms of Service | TipTop360 UAE', published: true,
    seo: ['Terms of Service | TipTop360 UAE Online Store', 'TipTop360 Terms of Service for UAE shoppers: orders, AED pricing, Cash on Delivery, UAE-wide shipping, 3-day returns and your rights under UAE Federal Law No. 15 of 2020.'] },
  { gid: '121299042419', handle: 'refund-policy', body: () => read('refund-policy.html'),
    title: 'Refund & Return Policy | TipTop360 UAE', published: true,
    seo: ['Refund & Return Policy UAE | TipTop360', 'TipTop360 refund & return policy for the UAE: 3-day returns on unused sealed items, refunds in 5-7 days, COD bank-transfer refunds. UAE Federal Law No. 15 of 2020.'] },
  { gid: '119006494835', handle: 'shipping-policy-page', body: () => read('shipping-policy.html'),
    title: 'Shipping & Delivery Policy | TipTop360 UAE', published: true,
    seo: ['Shipping & Delivery Policy UAE | TipTop360', 'TipTop360 delivers to all 7 Emirates with 1-2 day delivery and Cash on Delivery. Processing times, fees, tracking and delivery details.'] },
  { gid: '108536496243', handle: 'gdpr-privacy-policy', body: () => privacyBody('gdpr-privacy-policy'),
    title: 'Privacy Policy | TipTop360 UAE', published: true,
    seo: ['Privacy Policy | TipTop360 UAE (GDPR-ready)', 'How TipTop360 collects, uses and protects your personal data. UAE PDPL aligned and GDPR-ready. We never sell your data - request access or deletion anytime.'] },
  { gid: '108536529011', handle: 'lgpd-privacy-policy', body: () => privacyBody('lgpd-privacy-policy'),
    title: 'Privacy Policy | TipTop360', published: true,
    seo: ['Privacy Policy | TipTop360', 'TipTop360 privacy policy: what data we collect, why, and your rights (UAE PDPL, GDPR, LGPD). We never sell your personal data.'] },
  { gid: '108536561779', handle: 'ccpa-privacy-policy', body: () => privacyBody('ccpa-privacy-policy'),
    title: 'Privacy Policy (California / CCPA) | TipTop360', published: false,
    seo: ['Privacy Policy - California CCPA | TipTop360', 'TipTop360 privacy policy with California CCPA/CPRA rights. We never sell your personal information.'] },
  { gid: '108536463475', handle: 'appi-privacy-policy', body: () => privacyBody('appi-privacy-policy'),
    title: 'Privacy Policy (Japan / APPI) | TipTop360', published: false,
    seo: ['Privacy Policy - Japan APPI | TipTop360', 'TipTop360 privacy policy with Japan APPI rights. We never sell your personal data.'] },
  { gid: '108536430707', handle: 'pipeda-privacy-policy', body: () => privacyBody('pipeda-privacy-policy'),
    title: 'Privacy Policy (Canada / PIPEDA) | TipTop360', published: false,
    seo: ['Privacy Policy - Canada PIPEDA | TipTop360', 'TipTop360 privacy policy with Canada PIPEDA rights. We never sell your personal data.'] },
];

// ── Shop policies (footer-linked /policies/*) ───────────────────
const SHOP_POLICIES = [
  { type: 'PRIVACY_POLICY', body: () => read('privacy-policy.html') },
  { type: 'REFUND_POLICY', body: () => read('refund-policy.html') },
  { type: 'SHIPPING_POLICY', body: () => read('shipping-policy.html') },
  { type: 'TERMS_OF_SERVICE', body: () => read('terms-of-service.html') },
];

const PAGE_UPDATE = `mutation($id:ID!,$page:PageUpdateInput!){pageUpdate(id:$id,page:$page){page{handle isPublished} userErrors{field message}}}`;
const POLICY_UPDATE = `mutation($p:ShopPolicyInput!){shopPolicyUpdate(shopPolicy:$p){shopPolicy{type url} userErrors{field message}}}`;
const GET_PAGE = `query($id:ID!){page(id:$id){handle body}}`;
const GET_POLICIES = `query{shop{shopPolicies{type body}}}`;

(async () => {
  console.log(`\n${EXECUTE ? '🚀 EXECUTE' : '🧪 DRY RUN'} — TipTop360 policy redesign → ${STORE}\n${'='.repeat(60)}`);
  if (EXECUTE) fs.mkdirSync(BK, { recursive: true });

  // Pages
  for (const p of PAGES) {
    const body = p.body();
    console.log(`\nPAGE  ${p.handle}  (${body.length} chars, published=${p.published})`);
    if (!EXECUTE) continue;
    try {
      const cur = await gql(GET_PAGE, { id: `gid://shopify/Page/${p.gid}` });
      fs.writeFileSync(path.join(BK, `page-${p.handle}.html`), cur.page?.body || '');
      const d = await gql(PAGE_UPDATE, {
        id: `gid://shopify/Page/${p.gid}`,
        page: { title: p.title, body, isPublished: p.published, metafields: seo(p.seo[0], p.seo[1]) },
      });
      const errs = d.pageUpdate.userErrors;
      console.log(errs.length ? `  ✗ ${JSON.stringify(errs)}` : `  ✓ updated`);
    } catch (e) { console.log(`  ✗ ${e.message}`); }
  }

  // Shop policies
  let curPol = {};
  if (EXECUTE) {
    try { (await gql(GET_POLICIES)).shop.shopPolicies.forEach(x => (curPol[x.type] = x.body)); } catch (e) {}
  }
  for (const sp of SHOP_POLICIES) {
    const body = sp.body();
    console.log(`\nPOLICY  ${sp.type}  (${body.length} chars)`);
    if (!EXECUTE) continue;
    try {
      fs.writeFileSync(path.join(BK, `policy-${sp.type}.html`), curPol[sp.type] || '');
      const d = await gql(POLICY_UPDATE, { p: { type: sp.type, body } });
      const errs = d.shopPolicyUpdate.userErrors;
      console.log(errs.length ? `  ✗ ${JSON.stringify(errs)}` : `  ✓ updated`);
    } catch (e) {
      console.log(`  ✗ ${e.message}`);
      if (/write_legal_policies/.test(e.message))
        console.log('    → Token lacks write_legal_policies. Add the scope, or paste this file manually in Settings → Policies.');
    }
  }

  console.log(`\n${'='.repeat(60)}\nDone.${EXECUTE ? ` Backups: ${BK}` : ' Re-run with --execute to apply.'}\n`);
})();
