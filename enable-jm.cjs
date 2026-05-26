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
async function gql(t,q,v={}) {
  const r = await fetch(`https://${STORE}/admin/api/2024-10/graphql.json`,{method:'POST',headers:{'X-Shopify-Access-Token':t,'Content-Type':'application/json'},body:JSON.stringify({query:q,variables:v})});
  return r.json();
}
(async () => {
  const t = await token();
  const list = await gql(t, `{ metafieldDefinitions(first:100, ownerType:PRODUCT){edges{node{id namespace key access{storefront}}}} }`);
  for (const e of list.data.metafieldDefinitions.edges) {
    const d = e.node;
    if (d.namespace==='judgeme' && d.access.storefront !== 'PUBLIC_READ') {
      const r = await gql(t, `mutation u($id:ID!){metafieldDefinitionUpdate(definition:{id:$id,access:{storefront:PUBLIC_READ}}){updatedDefinition{id} userErrors{message}}}`, {id:d.id});
      console.log(`${d.namespace}.${d.key}:`, r.data?.metafieldDefinitionUpdate?.updatedDefinition ? '✅' : JSON.stringify(r.data?.metafieldDefinitionUpdate?.userErrors));
    }
  }
})();
