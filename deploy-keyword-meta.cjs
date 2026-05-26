require('dotenv').config();
const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));

const STORE = process.env.SHOPIFY_STORE;

const UPDATES = [
  {
    handle: 'kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift',
    meta_title: 'U-Shaped Kids Toothbrush UAE | 60-Second | TipTop360',
    meta_description: "Shop UAE's trusted U-shaped kids electric toothbrush. Dubai Municipality approved. BPA-free silicone, 60-sec auto-clean. AED 129. Free UAE delivery.",
  },
  {
    handle: 'magnetic-gym-bag-uae-gymgear-tiptop360',
    meta_title: 'Magnetic Gym Bag UAE | GymGear™ | TipTop360',
    meta_description: "UAE's only branded magnetic gym bag. Hands-free metal attachment. Weatherproof. Unisex. AED 150. Free next-day delivery. Cash on Delivery across UAE.",
  },
  {
    handle: 'kids-strawberry-foam-toothpaste-uae-approved',
    meta_title: 'Kids Strawberry Foam Toothpaste UAE | Safe | TipTop360',
    meta_description: 'Strawberry foam toothpaste for kids UAE. Dubai-approved formula. Perfect for u-shaped toothbrushes. Fluoride-safe. AED 29. Free delivery across UAE.',
  },
  {
    handle: 'experience-the-magic-smoke-bubble-machine',
    meta_title: 'Smoke Bubble Machine UAE | Magic Bubbles | TipTop360',
    meta_description: 'Magical smoke bubble machine for kids in UAE. Safe water-vapor effect. Birthday & party favourite. AED 99. Free next-day UAE delivery. Cash on Delivery.',
  },
  {
    handle: 'kids-drawing-robot',
    meta_title: 'Kids Drawing Robot Dubai | STEM Toy | TipTop360',
    meta_description: 'Buy Kids Drawing Robot in Dubai. Educational STEM toy, 100+ templates, screen-free. AED 110. Free next-day delivery to Dubai. Cash on Delivery.',
  },
  {
    handle: 'ai-voice-recorder',
    meta_title: 'AI Voice Recorder Dubai | Transcribe Meetings | TipTop360',
    meta_description: 'Buy AI voice recorder in Dubai. Transcribes in 57 languages. 20+ hour battery. AED 299. Free next-day delivery. Cash on Delivery. UAE-based stock.',
  }
];

function validate(u) {
  const errors = [];
  if (u.meta_title.length < 30 || u.meta_title.length > 60)
    errors.push(`title ${u.meta_title.length} chars — must be 30-60`);
  if (!u.meta_title.includes('TipTop360'))
    errors.push('title missing brand');
  if (u.meta_description.length < 120 || u.meta_description.length > 160)
    errors.push(`meta desc ${u.meta_description.length} chars — must be 120-160`);
  const geo = ['UAE','Dubai','Abu Dhabi','Emirates'];
  if (!geo.some(g => u.meta_description.includes(g)))
    errors.push('meta desc missing geo signal');
  return errors;
}

async function getToken() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });
  return (await r.json()).access_token;
}

(async () => {
  console.log('\n🚀 @builder-1 — Keyword Meta Deploy (6 products)\n' + '='.repeat(55));

  // 1. Validate all
  console.log('\n[1] Validating...');
  let allValid = true;
  for (const u of UPDATES) {
    const errs = validate(u);
    if (errs.length) { errs.forEach(e => console.log(`  ❌ [${u.handle}] ${e}`)); allValid = false; }
    else console.log(`  ✅ ${u.handle} (title: ${u.meta_title.length}c, desc: ${u.meta_description.length}c)`);
  }
  if (!allValid) { process.exit(1); }

  // 2. Auth
  console.log('\n[2] Authenticating...');
  const token = await getToken();
  if (!token) { console.log('❌ Auth failed'); process.exit(1); }
  console.log('  ✅ Token obtained');

  // 3. Get all products at once (avoids per-handle lookup failures)
  console.log('\n[3] Fetching product list...');
  const handles = UPDATES.map(u => u.handle);
  const allProducts = [];
  let page = `https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle`;
  while (page) {
    const res = await fetch(page, {headers:{'X-Shopify-Access-Token':token}});
    const data = await res.json();
    allProducts.push(...(data.products || []));
    const linkHeader = res.headers.get('link') || '';
    const next = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    page = next ? next[1] : null;
  }
  console.log(`  ✅ Fetched ${allProducts.length} products`);

  const productMap = {};
  for (const p of allProducts) productMap[p.handle] = p.id;

  // 4. Apply updates
  console.log('\n[4] Applying meta updates...');
  for (const u of UPDATES) {
    await new Promise(r => setTimeout(r, 1500));
    const id = productMap[u.handle];
    if (!id) { console.log(`  ⚠️  Handle not found: ${u.handle}`); continue; }

    const res = await fetch(`https://${STORE}/admin/api/2024-10/products/${id}.json`, {
      method:'PUT',
      headers:{'X-Shopify-Access-Token':token,'Content-Type':'application/json'},
      body: JSON.stringify({product:{
        id,
        metafields_global_title_tag: u.meta_title,
        metafields_global_description_tag: u.meta_description
      }})
    });
    const d = await res.json();
    if (d.product) console.log(`  ✅ ${u.handle}`);
    else console.log(`  ❌ ${u.handle}:`, JSON.stringify(d).slice(0,100));
  }
  console.log('\n✅ @builder-1 COMPLETE');
})();
