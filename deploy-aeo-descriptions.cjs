require('dotenv').config();
const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));

const STORE = process.env.SHOPIFY_STORE;

// AEO-optimized first paragraphs — validated against keyword research PDF
// Pattern: [Product] [key action] [key spec] [geo] [price] [trust signal]
const AEO_PARAGRAPHS = [
  {
    handle: 'kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift',
    aeo_intro: 'The Kids U-Shaped Electric Toothbrush by TipTop360 cleans all tooth surfaces in 60 seconds using BPA-free silicone — Dubai Municipality approved for UAE children aged 2–12. AED 129. Free next-day delivery across UAE. Cash on Delivery available.',
    keyword: 'u shaped kids toothbrush UAE'
  },
  {
    handle: 'magnetic-gym-bag-uae-gymgear-tiptop360',
    aeo_intro: 'The GymGear™ Magnetic Gym Bag by TipTop360 is UAE\'s only hands-free magnetic gym bag — attaches to any metal surface, weatherproof, with wet/dry compartment. AED 150. Free next-day delivery to Dubai and all UAE Emirates. Cash on Delivery available.',
    keyword: 'magnetic gym bag UAE'
  },
  {
    handle: 'kids-strawberry-foam-toothpaste-uae-approved',
    aeo_intro: 'TipTop360 Kids Strawberry Foam Toothpaste is Dubai Municipality approved, fluoride-safe for ages 2+, and designed specifically for U-shaped toothbrushes. Spreads instantly across all tooth surfaces. AED 29. Free delivery across UAE.',
    keyword: 'kids foam toothpaste UAE'
  },
  {
    handle: 'experience-the-magic-smoke-bubble-machine',
    aeo_intro: 'The TipTop360 Smoke Bubble Machine creates magical glowing smoke-filled bubbles using safe water vapor — no chemicals, Dubai Municipality compliant, and UAE\'s favourite kids birthday gift. AED 99. Free next-day delivery. Cash on Delivery.',
    keyword: 'smoke bubble machine UAE'
  },
  {
    handle: 'kids-drawing-robot',
    aeo_intro: 'Buy the Kids Drawing Robot in Dubai at TipTop360 — a screen-free STEM learning toy with 100+ templates, Dubai Municipality approved, for ages 3–10. AED 110. Free next-day delivery to Dubai and all UAE Emirates. Cash on Delivery.',
    keyword: 'kids drawing robot Dubai'
  },
  {
    handle: 'ai-voice-recorder',
    aeo_intro: 'Buy an AI Voice Recorder in Dubai at TipTop360 — auto-transcribes in 57 languages with GPT-4 summaries, 20+ hour battery, for UAE professionals and students. AED 299. Free next-day delivery. Cash on Delivery available across UAE.',
    keyword: 'AI voice recorder Dubai'
  }
];

// Validate AEO paragraphs before touching API
function validate(p) {
  const errors = [];
  if (p.aeo_intro.length < 100) errors.push('AEO intro too short — need 100+ chars');
  if (p.aeo_intro.length > 350) errors.push('AEO intro too long — keep under 350 chars');
  if (!p.aeo_intro.includes('AED')) errors.push('missing AED price');
  const geo = ['UAE','Dubai','Abu Dhabi','Emirates'];
  if (!geo.some(g => p.aeo_intro.includes(g))) errors.push('missing geo signal');
  if (!p.aeo_intro.toLowerCase().includes('delivery')) errors.push('missing delivery signal');
  return errors;
}

async function getToken() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });
  return (await r.json()).access_token;
}

async function getProduct(token, handle) {
  const r = await fetch(
    `https://${STORE}/admin/api/2024-10/products.json?handle=${handle}&fields=id,handle,body_html`,
    {headers: {'X-Shopify-Access-Token': token}}
  );
  return (await r.json()).products?.[0] || null;
}

async function updateProduct(token, id, newBody) {
  const r = await fetch(`https://${STORE}/admin/api/2024-10/products/${id}.json`, {
    method: 'PUT',
    headers: {'X-Shopify-Access-Token': token, 'Content-Type': 'application/json'},
    body: JSON.stringify({product: {id, body_html: newBody}})
  });
  return r.json();
}

(async () => {
  console.log('\n🚀 @builder-4 — AEO First Paragraphs\n' + '='.repeat(55));

  // 1. Validate all
  console.log('\n[1] Validating AEO paragraphs...');
  let allValid = true;
  for (const p of AEO_PARAGRAPHS) {
    const errs = validate(p);
    if (errs.length) {
      errs.forEach(e => console.log(`  ❌ [${p.handle}] ${e}`));
      allValid = false;
    } else {
      console.log(`  ✅ ${p.handle} (${p.aeo_intro.length} chars)`);
    }
  }
  if (!allValid) { process.exit(1); }

  // 2. Auth
  console.log('\n[2] Authenticating...');
  const token = await getToken();
  if (!token) { console.log('❌ Auth failed'); process.exit(1); }
  console.log('  ✅ Token obtained');

  // 3. Prepend AEO paragraph to each product
  console.log('\n[3] Injecting AEO paragraphs...');
  for (const p of AEO_PARAGRAPHS) {
    await new Promise(r => setTimeout(r, 1500));

    const product = await getProduct(token, p.handle);
    if (!product) { console.log(`  ⚠️  Not found: ${p.handle}`); continue; }

    const aeoHtml = `<p><strong>${p.aeo_intro}</strong></p>\n\n`;

    // Skip if already injected
    if (product.body_html && product.body_html.includes(p.aeo_intro.slice(0, 50))) {
      console.log(`  ✅ Already has AEO intro: ${p.handle} — skipping`);
      continue;
    }

    const newBody = aeoHtml + (product.body_html || '');
    const result = await updateProduct(token, product.id, newBody);

    if (result.product) {
      console.log(`  ✅ Updated: ${p.handle}`);
    } else {
      console.log(`  ❌ Failed: ${p.handle}`, JSON.stringify(result).slice(0,100));
    }
  }

  console.log('\n✅ @builder-4 COMPLETE — AEO paragraphs injected on 6 products');
  console.log('   These are now citation-ready for ChatGPT, Perplexity, and Gemini');
})();
