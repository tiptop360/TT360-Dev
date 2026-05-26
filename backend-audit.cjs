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

async function gql(t,q,v={}) {
  const r = await fetch(`https://${STORE}/admin/api/2024-10/graphql.json`,{method:'POST',headers:{'X-Shopify-Access-Token':t,'Content-Type':'application/json'},body:JSON.stringify({query:q,variables:v})});
  return r.json();
}

(async () => {
  const t = await getToken();
  const H = {'X-Shopify-Access-Token': t};
  
  console.log('\n🔍 SHOPIFY BACKEND AUDIT\n' + '='.repeat(50));
  
  // 1. Products
  const prods = await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,status,published_at,tags,vendor,product_type,images,variants`, {headers:H})).json();
  const products = prods.products || [];
  console.log('\n📦 PRODUCTS');
  console.log('Total:', products.length);
  console.log('Active:', products.filter(p => p.status==='active').length);
  console.log('Draft:', products.filter(p => p.status==='draft').length);
  console.log('Archived:', products.filter(p => p.status==='archived').length);
  console.log('Without vendor:', products.filter(p => !p.vendor || p.vendor.trim()==='').length);
  console.log('Without product_type:', products.filter(p => !p.product_type).length);
  console.log('With 0 images:', products.filter(p => !p.images || p.images.length===0).length);
  console.log('With 1 variant only:', products.filter(p => p.variants?.length===1).length);
  console.log('With 10+ variants:', products.filter(p => p.variants?.length>=10).length);
  
  // 2. Tags analysis
  const tagCounts = {};
  products.forEach(p => (p.tags||'').split(',').map(t=>t.trim()).filter(Boolean).forEach(t => tagCounts[t]=(tagCounts[t]||0)+1));
  const orphanTags = Object.entries(tagCounts).filter(([t,c]) => c===1).map(([t])=>t);
  console.log('\n🏷️  TAGS');
  console.log('Total unique tags:', Object.keys(tagCounts).length);
  console.log('Orphan tags (used by only 1 product):', orphanTags.length);
  if (orphanTags.length) console.log('  First 10:', orphanTags.slice(0,10).join(', '));
  
  // 3. Collections
  const cols = await (await fetch(`https://${STORE}/admin/api/2024-10/custom_collections.json?limit=250`, {headers:H})).json();
  const smart = await (await fetch(`https://${STORE}/admin/api/2024-10/smart_collections.json?limit=250`, {headers:H})).json();
  const allCols = [...(cols.custom_collections||[]), ...(smart.smart_collections||[])];
  console.log('\n📁 COLLECTIONS');
  console.log('Total:', allCols.length);
  console.log('Custom:', cols.custom_collections?.length || 0);
  console.log('Smart:', smart.smart_collections?.length || 0);
  console.log('Without image:', allCols.filter(c => !c.image).length);
  console.log('Without description:', allCols.filter(c => !c.body_html || c.body_html.length<50).length);
  
  // 4. Pages
  const pgs = await (await fetch(`https://${STORE}/admin/api/2024-10/pages.json?limit=250`, {headers:H})).json();
  console.log('\n📄 PAGES');
  console.log('Total:', pgs.pages?.length || 0);
  console.log('Published:', pgs.pages?.filter(p => p.published_at).length || 0);
  console.log('Without SEO title:', '(check via metafields)');
  
  // 5. Blogs
  const blogs = await (await fetch(`https://${STORE}/admin/api/2024-10/blogs.json`, {headers:H})).json();
  let totalArticles = 0;
  for (const b of (blogs.blogs||[])) {
    const arts = await (await fetch(`https://${STORE}/admin/api/2024-10/blogs/${b.id}/articles.json?limit=250&fields=id,published_at`, {headers:H})).json();
    totalArticles += (arts.articles||[]).length;
  }
  console.log('\n✍️  BLOGS');
  console.log('Total blogs:', blogs.blogs?.length || 0);
  console.log('Total articles:', totalArticles);
  
  // 6. Redirects
  const redirs = await (await fetch(`https://${STORE}/admin/api/2024-10/redirects.json?limit=250`, {headers:H})).json();
  console.log('\n↪️  REDIRECTS');
  console.log('Total:', redirs.redirects?.length || 0);
  if (redirs.redirects?.length) {
    const targets = redirs.redirects.map(r => r.target);
    const sources = redirs.redirects.map(r => r.path);
    const chains = sources.filter(s => targets.includes(s));
    console.log('Potential chains (redirect→redirect):', chains.length);
  }
  
  // 7. Themes
  const themes = await (await fetch(`https://${STORE}/admin/api/2024-10/themes.json`, {headers:H})).json();
  console.log('\n🎨 THEMES');
  themes.themes?.forEach(t => console.log(`  ${t.role}: ${t.name} (#${t.id})`));
  console.log('Total stored:', themes.themes?.length || 0, '(Shopify allows max 20)');
  
  // 8. Metafield definitions
  const defs = await gql(t, `{ metafieldDefinitions(first:100, ownerType:PRODUCT){edges{node{namespace key access{storefront}}}} }`);
  const metaCount = defs.data?.metafieldDefinitions?.edges?.length || 0;
  const publicMeta = defs.data?.metafieldDefinitions?.edges?.filter(e => e.node.access.storefront==='PUBLIC_READ').length || 0;
  console.log('\n🔑 METAFIELD DEFINITIONS');
  console.log('Total product definitions:', metaCount);
  console.log('Storefront-accessible:', publicMeta);
  console.log('Private (not in storefront):', metaCount - publicMeta);
  
  // 9. Recommendations
  console.log('\n' + '='.repeat(50));
  console.log('💡 RECOMMENDATIONS\n');
  const recs = [];
  if (products.filter(p => p.status==='draft').length) recs.push(`Delete or publish ${products.filter(p => p.status==='draft').length} draft products`);
  if (products.filter(p => !p.vendor).length) recs.push(`Add vendor to ${products.filter(p => !p.vendor).length} products (improves filtering)`);
  if (products.filter(p => !p.product_type).length) recs.push(`Add product_type to ${products.filter(p => !p.product_type).length} products`);
  if (orphanTags.length > 5) recs.push(`Clean ${orphanTags.length} orphan tags`);
  if (allCols.filter(c => !c.image).length) recs.push(`Add images to ${allCols.filter(c => !c.image).length} collections`);
  if (allCols.filter(c => !c.body_html || c.body_html.length<50).length) recs.push(`Add descriptions to ${allCols.filter(c => !c.body_html || c.body_html.length<50).length} collections`);
  if (themes.themes?.length > 10) recs.push(`Delete old unpublished themes (${themes.themes.length}/20 used)`);
  if (totalArticles < 5) recs.push(`Add ${5-totalArticles}+ blog articles for SEO`);
  if (redirs.redirects?.length === 0) recs.push('No redirects set up — fine if no URL changes happened');
  
  if (!recs.length) console.log('  ✅ No major cleanup needed');
  recs.forEach((r,i) => console.log(`  ${i+1}. ${r}`));
  console.log();
})();
