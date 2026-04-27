require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;

async function getToken() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  return (await r.json()).access_token;
}

(async () => {
  const token = await getToken();
  const products = (await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,title`, {headers:{'X-Shopify-Access-Token':token}})).json()).products;
  
  console.log('\n=== AUDIT REPORT ===\n');
  const issues = {missing_seo_title:[], missing_seo_desc:[], missing_meta:[], no_reviews:[], schema_check:[]};
  
  for (const p of products) {
    const meta = (await (await fetch(`https://${STORE}/admin/api/2024-10/products/${p.id}/metafields.json`, {headers:{'X-Shopify-Access-Token':token}})).json()).metafields || [];
    const has = (ns,k) => meta.find(m => m.namespace===ns && m.key===k);
    
    if (!has('global','title_tag')) issues.missing_seo_title.push(p.handle);
    if (!has('global','description_tag')) issues.missing_seo_desc.push(p.handle);
    if (!has('reviews','rating_count')) issues.no_reviews.push(p.handle);
    if (!has('tiptop360','faq_schema')) issues.missing_meta.push(p.handle);
  }
  
  console.log('Total products:', products.length);
  console.log('Missing SEO title:', issues.missing_seo_title.length, issues.missing_seo_title.slice(0,5));
  console.log('Missing SEO desc:', issues.missing_seo_desc.length, issues.missing_seo_desc.slice(0,5));
  console.log('No reviews metafield:', issues.no_reviews.length, issues.no_reviews.slice(0,5));
  console.log('No FAQ metafield:', issues.missing_meta.length, issues.missing_meta.slice(0,5));
  
  console.log('\n=== LIVE SCHEMA CHECK (top 3 products) ===');
  for (const p of products.slice(0,3)) {
    const html = await (await fetch(`https://tiptop360.com/products/${p.handle}?x=${Math.random()}`)).text();
    const types = [...new Set(html.match(/"@type":\s*"[^"]+"/g) || [])];
    console.log(`\n${p.handle}:`);
    console.log('  Schemas:', types.join(', ') || 'NONE');
    console.log('  Has H1:', (html.match(/<h1\b/gi) || []).length);
    console.log('  Has Referrer-Policy:', html.includes('Referrer-Policy'));
    console.log('  AggregateRating:', html.includes('AggregateRating'));
  }
  
  require('fs').writeFileSync('./audit-report.json', JSON.stringify(issues, null, 2));
})();
