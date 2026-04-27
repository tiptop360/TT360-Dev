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

// Map handle keywords to product types
function inferType(handle, title) {
  const h = (handle + ' ' + title).toLowerCase();
  if (h.includes('toothbrush') || h.includes('toothpaste') || h.includes('floss') || h.includes('dental') || h.includes('brushing')) return 'Kids Dental Care';
  if (h.includes('pencil') || h.includes('marker') || h.includes('crayon') || h.includes('color')) return 'Kids Art Supplies';
  if (h.includes('robot') || h.includes('drawing')) return 'Kids Educational Toys';
  if (h.includes('voice-recorder') || h.includes('ai')) return 'Smart Gadgets';
  if (h.includes('gym') || h.includes('magnetic')) return 'Lifestyle Gadgets';
  if (h.includes('gift-card') || h.includes('gift-wrap')) return 'Gift Services';
  if (h.includes('bubble') || h.includes('smoke') || h.includes('toy')) return 'Kids Toys';
  if (h.includes('chore') || h.includes('checklist') || h.includes('sticker')) return 'Kids Behavioral Tools';
  return 'Smart Lifestyle Products';
}

(async () => {
  const t = await getToken();
  const H = {'X-Shopify-Access-Token': t, 'Content-Type':'application/json'};
  
  console.log('🧹 BACKEND CLEANUP\n' + '='.repeat(50));
  
  // 1. Fetch all products
  const r = await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,title,tags,product_type`, {headers:H})).json();
  const products = r.products;
  
  // 2. Calculate tag usage
  const tagCounts = {};
  products.forEach(p => (p.tags||'').split(',').map(t=>t.trim()).filter(Boolean).forEach(tag => tagCounts[tag]=(tagCounts[tag]||0)+1));
  const orphanSet = new Set(Object.entries(tagCounts).filter(([_,c]) => c===1).map(([t])=>t));
  
  console.log('Orphan tags identified:', orphanSet.size);
  console.log('Products to update:', products.length);
  console.log();
  
  // 3. Fix each product
  let typeUpdates = 0, tagUpdates = 0;
  for (const p of products) {
    const updates = {};
    
    // Fix missing product_type
    if (!p.product_type || p.product_type.trim()==='') {
      updates.product_type = inferType(p.handle, p.title);
      typeUpdates++;
    }
    
    // Remove orphan tags
    const oldTags = (p.tags||'').split(',').map(t=>t.trim()).filter(Boolean);
    const newTags = oldTags.filter(t => !orphanSet.has(t));
    if (newTags.length !== oldTags.length) {
      updates.tags = newTags.join(', ');
      tagUpdates++;
    }
    
    if (Object.keys(updates).length === 0) continue;
    
    const upd = await fetch(`https://${STORE}/admin/api/2024-10/products/${p.id}.json`, {
      method:'PUT', headers:H,
      body: JSON.stringify({product: {id: p.id, ...updates}})
    });
    
    if (upd.ok) {
      const changes = [];
      if (updates.product_type) changes.push(`type=${updates.product_type}`);
      if (updates.tags !== undefined) changes.push(`tags ${oldTags.length}→${newTags.length}`);
      console.log(`✅ ${p.handle}: ${changes.join(', ')}`);
    } else {
      console.log(`❌ ${p.handle}: ${upd.status} ${await upd.text()}`);
    }
    
    await new Promise(r=>setTimeout(r,1500));  // rate limit
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`Product types added: ${typeUpdates}`);
  console.log(`Tag cleanups: ${tagUpdates}`);
  console.log('Done.');
})();
