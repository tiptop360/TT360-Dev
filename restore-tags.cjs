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

// Curated tag mapping: handle keyword → essential tags
function suggestTags(handle, title, productType) {
  const h = (handle + ' ' + title).toLowerCase();
  const tags = new Set();
  
  // Product category tags
  if (productType) tags.add(productType);
  
  // Audience
  if (h.includes('kids') || h.includes('children') || h.includes('toddler')) tags.add('Kids');
  if (h.includes('gift')) tags.add('Gifts');
  
  // Function
  if (h.includes('toothbrush') || h.includes('toothpaste') || h.includes('floss') || h.includes('dental')) {
    tags.add('Dental Care'); tags.add('Hygiene');
  }
  if (h.includes('art') || h.includes('drawing') || h.includes('marker') || h.includes('pencil') || h.includes('crayon') || h.includes('color')) {
    tags.add('Art Supplies'); tags.add('Creative');
  }
  if (h.includes('robot') || h.includes('voice-recorder') || h.includes('ai') || h.includes('smart')) {
    tags.add('Smart Gadgets'); tags.add('Tech');
  }
  if (h.includes('gym') || h.includes('magnetic')) {
    tags.add('Fitness'); tags.add('Lifestyle');
  }
  if (h.includes('toy') || h.includes('bubble') || h.includes('smoke')) {
    tags.add('Toys'); tags.add('Fun');
  }
  
  // Always add UAE for local SEO
  tags.add('UAE');
  tags.add('Free Delivery');
  tags.add('COD');
  
  return [...tags];
}

(async () => {
  const t = await getToken();
  const H = {'X-Shopify-Access-Token': t, 'Content-Type':'application/json'};
  
  const r = await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,title,tags,product_type`, {headers:H})).json();
  const products = r.products;
  
  console.log('🏷️  TAG RESTORATION\n' + '='.repeat(50));
  
  let updated = 0;
  for (const p of products) {
    const currentTags = (p.tags||'').split(',').map(t=>t.trim()).filter(Boolean);
    const newTags = suggestTags(p.handle, p.title, p.product_type);
    const merged = [...new Set([...currentTags, ...newTags])];
    
    if (merged.length === currentTags.length) continue;  // no change
    
    const upd = await fetch(`https://${STORE}/admin/api/2024-10/products/${p.id}.json`, {
      method:'PUT', headers:H,
      body: JSON.stringify({product: {id: p.id, tags: merged.join(', ')}})
    });
    
    if (upd.ok) {
      console.log(`✅ ${p.handle}: ${currentTags.length}→${merged.length} tags`);
      updated++;
    } else {
      console.log(`❌ ${p.handle}: ${upd.status}`);
    }
    
    await new Promise(r=>setTimeout(r,1500));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`Updated: ${updated}/${products.length}`);
})();
