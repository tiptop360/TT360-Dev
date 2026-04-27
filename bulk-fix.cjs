require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const STORE = process.env.SHOPIFY_STORE;

async function token() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  return (await r.json()).access_token;
}

async function gql(t, query, variables={}) {
  const r = await fetch(`https://${STORE}/admin/api/2024-10/graphql.json`, {
    method:'POST',
    headers:{'X-Shopify-Access-Token':t,'Content-Type':'application/json'},
    body: JSON.stringify({query, variables})
  });
  return r.json();
}

(async () => {
  const t = await token();
  
  // 1. List existing PRODUCT metafield definitions
  console.log('1️⃣ Listing existing definitions...');
  const list = await gql(t, `{
    metafieldDefinitions(first: 100, ownerType: PRODUCT) {
      edges { node { id namespace key name type { name } access { storefront } } }
    }
  }`);
  
  if (list.errors) { console.log('❌', JSON.stringify(list.errors)); return; }
  
  const defs = list.data.metafieldDefinitions.edges.map(e => e.node);
  console.log(`Found ${defs.length} definitions`);
  defs.filter(d => ['reviews','tiptop360'].includes(d.namespace)).forEach(d => {
    console.log(`  ${d.namespace}.${d.key} (${d.type.name}) — storefront: ${d.access.storefront}`);
  });
  
  // 2. Enable PUBLIC_READ storefront on reviews + tiptop360 namespaces
  console.log('\n2️⃣ Enabling storefront access...');
  for (const def of defs) {
    if (['reviews','tiptop360'].includes(def.namespace) && def.access.storefront !== 'PUBLIC_READ') {
      const upd = await gql(t, `
        mutation update($id: ID!) {
          metafieldDefinitionUpdate(definition: {id: $id, access: {storefront: PUBLIC_READ}}) {
            updatedDefinition { id access { storefront } }
            userErrors { field message }
          }
        }`, {id: def.id});
      const ok = upd.data?.metafieldDefinitionUpdate?.updatedDefinition;
      const err = upd.data?.metafieldDefinitionUpdate?.userErrors;
      console.log(`  ${def.namespace}.${def.key}:`, ok ? '✅ PUBLIC_READ' : `❌ ${JSON.stringify(err)}`);
    } else if (['reviews','tiptop360'].includes(def.namespace)) {
      console.log(`  ${def.namespace}.${def.key}: already PUBLIC_READ`);
    }
  }
  
  // 3. Create missing definitions if reviews.rating / reviews.rating_count don't exist
  const has = (ns,k) => defs.some(d => d.namespace===ns && d.key===k);
  const toCreate = [];
  if (!has('reviews','rating_count')) toCreate.push({namespace:'reviews', key:'rating_count', name:'Review Count', type:'number_integer'});
  if (!has('reviews','rating')) toCreate.push({namespace:'reviews', key:'rating', name:'Average Rating', type:'rating'});
  
  if (toCreate.length) {
    console.log('\n3️⃣ Creating missing definitions...');
    for (const d of toCreate) {
      const cr = await gql(t, `
        mutation create($def: MetafieldDefinitionInput!) {
          metafieldDefinitionCreate(definition: $def) {
            createdDefinition { id }
            userErrors { field message }
          }
        }`, {def: {...d, ownerType:'PRODUCT', access:{storefront:'PUBLIC_READ'}}});
      console.log(`  ${d.namespace}.${d.key}:`, cr.data?.metafieldDefinitionCreate?.createdDefinition ? '✅ created' : `❌ ${JSON.stringify(cr.data?.metafieldDefinitionCreate?.userErrors)}`);
    }
  }
  
  console.log('\n✅ Done. Wait 60s for storefront cache.');
})();
