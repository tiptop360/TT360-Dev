require('dotenv').config();
const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
const fs = require('fs');
const { execSync } = require('child_process');

const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';

const CORRECT_HANDLES = {
  toothbrush:  'kids-u-shaped-toothbrush-uae',
  gymBag:      'magnetic-gym-bag-uae',
  toothpaste:  'kids-foam-toothpaste-uae',
  bubble:      'smoke-bubble-machine',
  robot:       'kids-drawing-robot',
  aiVox:       'ai-voice-recorder'
};

const META_UPDATES = [
  { handle: CORRECT_HANDLES.toothbrush,  meta_title: 'U-Shaped Kids Toothbrush UAE | 60-Second | TipTop360',         meta_description: "Shop UAE's trusted U-shaped kids electric toothbrush. Dubai Municipality approved. BPA-free silicone, 60-sec auto-clean. AED 129. Free UAE delivery." },
  { handle: CORRECT_HANDLES.gymBag,      meta_title: 'Magnetic Gym Bag UAE | GymGear™ | TipTop360',                   meta_description: "UAE's only branded magnetic gym bag. Hands-free metal attachment. Weatherproof. Unisex. AED 150. Free next-day delivery. Cash on Delivery across UAE." },
  { handle: CORRECT_HANDLES.toothpaste,  meta_title: 'Kids Strawberry Foam Toothpaste UAE | Safe | TipTop360',        meta_description: 'Strawberry foam toothpaste for kids UAE. Dubai-approved formula. Perfect for u-shaped toothbrushes. Fluoride-safe. AED 29. Free delivery across UAE.' },
  { handle: CORRECT_HANDLES.bubble,      meta_title: 'Smoke Bubble Machine UAE | Magic Bubbles | TipTop360',          meta_description: 'Magical smoke bubble machine for kids in UAE. Safe water-vapor effect. Birthday & party favourite. AED 99. Free next-day UAE delivery. Cash on Delivery.' },
  { handle: CORRECT_HANDLES.robot,       meta_title: 'Kids Drawing Robot Dubai | STEM Toy | TipTop360',               meta_description: 'Buy Kids Drawing Robot in Dubai. Educational STEM toy, 100+ templates, screen-free. AED 110. Free next-day delivery to Dubai. Cash on Delivery.' },
  { handle: CORRECT_HANDLES.aiVox,       meta_title: 'AI Voice Recorder Dubai | Transcribe Meetings | TipTop360',     meta_description: 'Buy AI voice recorder in Dubai. Transcribes in 57 languages. 20+ hour battery. AED 299. Free next-day delivery. Cash on Delivery. UAE-based stock.' }
];

const AEO_PARAGRAPHS = [
  { handle: CORRECT_HANDLES.toothbrush, intro: 'The Kids U-Shaped Electric Toothbrush by TipTop360 cleans all tooth surfaces in 60 seconds using BPA-free silicone — Dubai Municipality approved for UAE children aged 2–12. AED 129. Free next-day delivery across UAE. Cash on Delivery available.' },
  { handle: CORRECT_HANDLES.gymBag,     intro: "The GymGear Magnetic Gym Bag by TipTop360 is UAE's only hands-free magnetic gym bag — attaches to any metal surface, weatherproof, with wet/dry compartment. AED 150. Free next-day delivery to Dubai and all UAE Emirates. Cash on Delivery available." },
  { handle: CORRECT_HANDLES.toothpaste, intro: 'TipTop360 Kids Strawberry Foam Toothpaste is Dubai Municipality approved, fluoride-safe for ages 2+, and designed specifically for U-shaped toothbrushes. Spreads instantly across all tooth surfaces. AED 29. Free delivery across UAE.' },
  { handle: CORRECT_HANDLES.bubble,     intro: "The TipTop360 Smoke Bubble Machine creates magical glowing smoke-filled bubbles using safe water vapor — no chemicals, Dubai Municipality compliant, UAE's favourite kids birthday gift. AED 99. Free next-day delivery. Cash on Delivery." },
  { handle: CORRECT_HANDLES.robot,      intro: 'Buy the Kids Drawing Robot in Dubai at TipTop360 — a screen-free STEM learning toy with 100+ templates, Dubai Municipality approved, for ages 3–10. AED 110. Free next-day delivery to Dubai and all UAE Emirates. Cash on Delivery.' },
  { handle: CORRECT_HANDLES.aiVox,      intro: 'Buy an AI Voice Recorder in Dubai at TipTop360 — auto-transcribes in 57 languages with GPT-4 summaries, 20+ hour battery, for UAE professionals and students. AED 299. Free next-day delivery. Cash on Delivery available across UAE.' }
];

async function getToken() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ client_id: process.env.SHOPIFY_CLIENT_ID, client_secret: process.env.SHOPIFY_CLIENT_SECRET, grant_type: 'client_credentials' })
  });
  return (await r.json()).access_token;
}

(async () => {
  console.log('\n🔧 Fix: Correct Handles — Meta + AEO + FAQ Schema\n' + '='.repeat(55));

  const token = await getToken();
  console.log('✅ Token obtained');

  // Get all products
  const res = await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,body_html`, {headers:{'X-Shopify-Access-Token':token}});
  const products = (await res.json()).products || [];
  const map = {};
  for (const p of products) map[p.handle] = p;
  console.log(`✅ ${products.length} products loaded`);

  // 1. Meta titles + descriptions
  console.log('\n[1] Applying meta updates...');
  for (const u of META_UPDATES) {
    await new Promise(r => setTimeout(r, 1200));
    const p = map[u.handle];
    if (!p) { console.log(`  ⚠️  Not found: ${u.handle}`); continue; }
    const r = await fetch(`https://${STORE}/admin/api/2024-10/products/${p.id}.json`, {
      method:'PUT', headers:{'X-Shopify-Access-Token':token,'Content-Type':'application/json'},
      body: JSON.stringify({product:{id:p.id, metafields_global_title_tag:u.meta_title, metafields_global_description_tag:u.meta_description}})
    });
    const d = await r.json();
    console.log(d.product ? `  ✅ Meta: ${u.handle}` : `  ❌ ${u.handle}: ${JSON.stringify(d).slice(0,80)}`);
  }

  // 2. AEO paragraphs
  console.log('\n[2] Injecting AEO paragraphs...');
  for (const a of AEO_PARAGRAPHS) {
    await new Promise(r => setTimeout(r, 1200));
    const p = map[a.handle];
    if (!p) { console.log(`  ⚠️  Not found: ${a.handle}`); continue; }
    if (p.body_html && p.body_html.includes(a.intro.slice(0,50))) { console.log(`  ✅ Already has AEO: ${a.handle}`); continue; }
    const newBody = `<p><strong>${a.intro}</strong></p>\n\n` + (p.body_html || '');
    const r = await fetch(`https://${STORE}/admin/api/2024-10/products/${p.id}.json`, {
      method:'PUT', headers:{'X-Shopify-Access-Token':token,'Content-Type':'application/json'},
      body: JSON.stringify({product:{id:p.id, body_html:newBody}})
    });
    const d = await r.json();
    console.log(d.product ? `  ✅ AEO: ${a.handle}` : `  ❌ ${a.handle}: ${JSON.stringify(d).slice(0,80)}`);
  }

  // 3. Rewrite FAQ schema snippet with correct handles
  console.log('\n[3] Rewriting FAQ schema with correct handles...');
  const SNIPPET = 'theme-files/snippets/product-faq-schema.liquid';
  const TS = Date.now();
  if (fs.existsSync(SNIPPET)) fs.copyFileSync(SNIPPET, `${SNIPPET}.PRE-${TS}.bak`);

  const snippet = `{%- comment -%} FAQPage JSON-LD per product — TipTop360 {%- endcomment -%}
{%- if product.handle == '${CORRECT_HANDLES.toothbrush}' -%}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Is the Kids U-Shaped Electric Toothbrush safe for toddlers under 3?","acceptedAnswer":{"@type":"Answer","text":"Yes. Designed for ages 2+. BPA-free food-grade silicone and gentle vibration are safe for sensitive gums. Supervise toddlers under 3 to guide proper use."}},{"@type":"Question","name":"How does the U-shaped toothbrush compare to a regular manual toothbrush?","acceptedAnswer":{"@type":"Answer","text":"The U-shaped design covers all tooth surfaces simultaneously in 60 seconds. A manual toothbrush requires multiple angles and relies on the child's technique."}},{"@type":"Question","name":"How often should I replace the U-shaped brush head?","acceptedAnswer":{"@type":"Answer","text":"Every 2 to 3 months, or sooner if the silicone looks cloudy or worn. TipTop360 stocks replacement heads with free UAE delivery."}},{"@type":"Question","name":"Does TipTop360 deliver to Abu Dhabi, Sharjah, and Ajman?","acceptedAnswer":{"@type":"Answer","text":"Yes. Free delivery across all Emirates. Orders before 5 PM deliver next day."}}]}</script>
{%- elsif product.handle == '${CORRECT_HANDLES.gymBag}' -%}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is the best magnetic gym bag in UAE?","acceptedAnswer":{"@type":"Answer","text":"The GymGear by TipTop360 is the only UAE-branded magnetic gym bag. Attaches hands-free to any metal surface. AED 150. Free next-day delivery across UAE."}},{"@type":"Question","name":"How does a magnetic gym bag attach?","acceptedAnswer":{"@type":"Answer","text":"Built-in neodymium magnets attach to any stable metal surface including gym racks, lockers, or benches."}},{"@type":"Question","name":"Where can I buy a magnetic gym bag in Dubai?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. Free next-day delivery to Dubai and all UAE Emirates. Cash on Delivery. AED 150."}}]}</script>
{%- elsif product.handle == '${CORRECT_HANDLES.toothpaste}' -%}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Is kids foam toothpaste safe in UAE?","acceptedAnswer":{"@type":"Answer","text":"Yes. Dubai Municipality approved, fluoride-safe for ages 2+, food-grade ingredients."}},{"@type":"Question","name":"What is the best kids toothpaste for a U-shaped toothbrush?","acceptedAnswer":{"@type":"Answer","text":"Foam toothpaste spreads instantly across all tooth surfaces. TipTop360 strawberry formula is designed specifically for U-shaped brushes."}},{"@type":"Question","name":"Where to buy kids foam toothpaste in UAE?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. AED 29. Free delivery to Dubai, Abu Dhabi, Sharjah, and all Emirates. Cash on Delivery."}}]}</script>
{%- elsif product.handle == '${CORRECT_HANDLES.bubble}' -%}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is a smoke bubble machine?","acceptedAnswer":{"@type":"Answer","text":"A smoke bubble machine creates bubbles filled with water vapor producing a glowing misty effect. Safe for children. Ideal for parties and indoor play."}},{"@type":"Question","name":"Is the smoke bubble machine safe for kids in UAE?","acceptedAnswer":{"@type":"Answer","text":"Yes. Water vapor only, no chemicals. Dubai Municipality compliant and safe for all ages."}},{"@type":"Question","name":"Where to buy smoke bubble machine in UAE?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. AED 99. Free next-day delivery to Dubai, Abu Dhabi, Sharjah, and all UAE Emirates. Cash on Delivery."}}]}</script>
{%- elsif product.handle == '${CORRECT_HANDLES.robot}' -%}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Where can I buy a kids drawing robot in Dubai?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. Free next-day delivery to Dubai. Cash on Delivery. AED 110. Dubai Municipality approved."}},{"@type":"Question","name":"What age is the drawing robot for?","acceptedAnswer":{"@type":"Answer","text":"Ages 3 to 10. Screen-free. The robot draws step-by-step and children follow along."}},{"@type":"Question","name":"How many drawing templates does the robot have?","acceptedAnswer":{"@type":"Answer","text":"100+ drawing templates covering animals, vehicles, shapes, and more."}}]}</script>
{%- elsif product.handle == '${CORRECT_HANDLES.aiVox}' -%}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is the best AI voice recorder in UAE?","acceptedAnswer":{"@type":"Answer","text":"The TipTop360 AI Voice Recorder transcribes in 57 languages, has 20+ hour battery, and is available in Dubai with next-day delivery and Cash on Delivery. AED 299."}},{"@type":"Question","name":"Where to buy an AI voice recorder in Dubai?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. Free next-day delivery to Dubai, Abu Dhabi, Sharjah. Cash on Delivery. AED 299."}},{"@type":"Question","name":"How many languages does the AI voice recorder support?","acceptedAnswer":{"@type":"Answer","text":"57 languages including Arabic, English, French, Hindi, and more."}}]}</script>
{%- endif -%}`;

  fs.writeFileSync(SNIPPET, snippet);
  console.log('✅ FAQ snippet rewritten with correct handles');

  try {
    execSync(
      `shopify theme push --store ${STORE} --theme ${THEME} --path ./theme-files --only snippets/product-faq-schema.liquid --allow-live`,
      {stdio:'inherit', cwd:'/Users/rabiharabi/tiptop360-optimizer'}
    );
    console.log('✅ FAQ schema pushed');
  } catch(e) {
    console.log('❌ Push failed'); process.exit(1);
  }

  // 4. Fix regression-geo.sh handle checks
  console.log('\n[4] Updating regression-geo.sh with correct handles...');
  let reg = fs.readFileSync('regression-geo.sh', 'utf8');
  reg = reg
    .replace(/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift/g, CORRECT_HANDLES.toothbrush)
    .replace(/magnetic-gym-bag-uae-gymgear-tiptop360/g, CORRECT_HANDLES.gymBag)
    .replace(/experience-the-magic-smoke-bubble-machine/g, CORRECT_HANDLES.bubble)
    .replace(/kids-strawberry-foam-toothpaste-uae-approved/g, CORRECT_HANDLES.toothpaste);
  fs.writeFileSync('regression-geo.sh', reg);
  console.log('✅ regression-geo.sh updated');

  console.log('\n' + '='.repeat(55));
  console.log('✅ ALL HANDLE FIXES COMPLETE');
  console.log('Run: bash regression-geo.sh');
})();
