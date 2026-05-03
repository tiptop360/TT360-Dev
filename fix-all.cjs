require('dotenv').config();
const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
const fs = require('fs');
const { execSync } = require('child_process');

const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';

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

async function getAllProducts(token) {
  const all = [];
  let url = `https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,body_html`;
  while (url) {
    const res = await fetch(url, {headers:{'X-Shopify-Access-Token':token}});
    const data = await res.json();
    all.push(...(data.products||[]));
    const link = res.headers.get('link')||'';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return all;
}

// ─────────────────────────────────────────────────────────
// FIX 1: FAQ Schema — rewrite full snippet cleanly
// ─────────────────────────────────────────────────────────
async function fixFaqSchema() {
  console.log('\n━━━ FIX 1: FAQ Schema (clean rewrite) ━━━━━━━━━━━━━━━━━');
  const SNIPPET = 'theme-files/snippets/product-faq-schema.liquid';
  const TS = Date.now();
  if (fs.existsSync(SNIPPET)) fs.copyFileSync(SNIPPET, `${SNIPPET}.PRE-${TS}.bak`);

  // Write complete clean snippet — no inheritance from broken previous version
  const snippet = `{%- comment -%} FAQPage JSON-LD per product — TipTop360 {%- endcomment -%}
{%- if product.handle == 'kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift' -%}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Is the Kids U-Shaped Electric Toothbrush safe for toddlers under 3?","acceptedAnswer":{"@type":"Answer","text":"Yes. Designed for ages 2+. BPA-free food-grade silicone and gentle vibration are safe for sensitive gums. Supervise toddlers under 3 to guide proper use."}},{"@type":"Question","name":"How does the U-shaped toothbrush compare to a regular manual toothbrush?","acceptedAnswer":{"@type":"Answer","text":"The U-shaped design covers all tooth surfaces simultaneously in 60 seconds. A manual toothbrush requires multiple angles and relies on the child's technique, which is often inconsistent."}},{"@type":"Question","name":"Is this toothbrush suitable for a 10-year-old?","acceptedAnswer":{"@type":"Answer","text":"Yes. Works for children aged 2 to 12. The 7-12 age variant is sized for older children. The 60-second auto-cycle fits busy routines."}},{"@type":"Question","name":"How often should I replace the U-shaped brush head?","acceptedAnswer":{"@type":"Answer","text":"Every 2 to 3 months, or sooner if the silicone looks cloudy or worn. TipTop360 stocks replacement heads with free UAE delivery."}},{"@type":"Question","name":"Does TipTop360 deliver to Abu Dhabi, Sharjah, and Ajman?","acceptedAnswer":{"@type":"Answer","text":"Yes. Free delivery across all Emirates including Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, and Fujairah. Orders before 5 PM deliver next day."}}]}</script>
{%- elsif product.handle == 'magnetic-gym-bag-uae-gymgear-tiptop360' -%}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is the best magnetic gym bag in UAE?","acceptedAnswer":{"@type":"Answer","text":"The GymGear by TipTop360 is the only UAE-branded magnetic gym bag. It attaches hands-free to any metal surface, includes a wet/dry compartment, and costs AED 150 with free next-day delivery across UAE."}},{"@type":"Question","name":"How does a magnetic gym bag attach?","acceptedAnswer":{"@type":"Answer","text":"Built-in neodymium magnets allow the bag to attach to any stable metal surface including gym racks, lockers, or benches, keeping your gear off dirty floors."}},{"@type":"Question","name":"Where can I buy a magnetic gym bag in Dubai?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. Free next-day delivery to Dubai and all UAE Emirates. Cash on Delivery available. AED 150."}},{"@type":"Question","name":"Is the magnetic gym bag suitable for outdoor use in UAE?","acceptedAnswer":{"@type":"Answer","text":"Yes. Weatherproof materials make it ideal for outdoor workouts and UAE summer conditions."}},{"@type":"Question","name":"Can I pay cash on delivery for the gym bag?","acceptedAnswer":{"@type":"Answer","text":"Yes. Cash on Delivery is available across all UAE Emirates including Dubai, Abu Dhabi, and Sharjah."}}]}</script>
{%- elsif product.handle == 'kids-strawberry-foam-toothpaste-uae-approved' -%}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Is kids foam toothpaste safe in UAE?","acceptedAnswer":{"@type":"Answer","text":"Yes. TipTop360 Strawberry Foam Toothpaste is Dubai Municipality approved, fluoride-safe for ages 2+, and made from food-grade ingredients."}},{"@type":"Question","name":"What is the best kids toothpaste for a U-shaped toothbrush?","acceptedAnswer":{"@type":"Answer","text":"Foam toothpaste spreads instantly across all tooth surfaces in the U-shaped head. TipTop360 strawberry formula is specifically designed for this purpose."}},{"@type":"Question","name":"Where to buy kids foam toothpaste in UAE?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. AED 29. Free delivery to Dubai, Abu Dhabi, Sharjah, and all Emirates. Cash on Delivery available."}}]}</script>
{%- elsif product.handle == 'experience-the-magic-smoke-bubble-machine' -%}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is a smoke bubble machine?","acceptedAnswer":{"@type":"Answer","text":"A smoke bubble machine creates bubbles filled with water vapor, producing a glowing misty effect. Completely safe for children. Ideal for parties and indoor play."}},{"@type":"Question","name":"Is the smoke bubble machine safe for kids in UAE?","acceptedAnswer":{"@type":"Answer","text":"Yes. The smoke effect is water vapor only, no chemicals. Dubai Municipality compliant and safe for all ages."}},{"@type":"Question","name":"Where to buy smoke bubble machine in UAE?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. AED 99 with free next-day delivery to Dubai, Abu Dhabi, Sharjah, and all UAE Emirates. Cash on Delivery available."}}]}</script>
{%- elsif product.handle == 'kids-drawing-robot' -%}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Where can I buy a kids drawing robot in Dubai?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. Free next-day delivery to Dubai. Cash on Delivery. AED 110. Dubai Municipality approved."}},{"@type":"Question","name":"What age is the drawing robot for?","acceptedAnswer":{"@type":"Answer","text":"Ages 3 to 10. Screen-free. The robot draws step-by-step and children follow along. Suitable for toddlers with guidance and independent use from age 5."}},{"@type":"Question","name":"How many drawing templates does the robot have?","acceptedAnswer":{"@type":"Answer","text":"100+ drawing templates covering animals, vehicles, shapes, and more."}}]}</script>
{%- elsif product.handle == 'ai-voice-recorder' -%}
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is the best AI voice recorder in UAE?","acceptedAnswer":{"@type":"Answer","text":"The TipTop360 AI Voice Recorder transcribes in 57 languages, has 20+ hour battery life, and is available in Dubai with next-day delivery and Cash on Delivery. AED 299."}},{"@type":"Question","name":"Where to buy an AI voice recorder in Dubai?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. Free next-day delivery to Dubai, Abu Dhabi, Sharjah. Cash on Delivery available. AED 299."}},{"@type":"Question","name":"How many languages does the AI voice recorder support?","acceptedAnswer":{"@type":"Answer","text":"The AI Voice Recorder transcribes in 57 languages including Arabic, English, French, Hindi, and more."}}]}</script>
{%- endif -%}`;

  // Liquid balance check — FIXED: exclude elsif/else from opens count
  const opens  = (snippet.match(/\{%-?\s*(?:if|unless|case|for)\b/g) || []).length;
  const closes = (snippet.match(/\{%-?\s*(?:endif|endunless|endcase|endfor)\b/g) || []).length;
  if (opens !== closes) {
    console.log(`❌ Liquid imbalance: ${opens} opens vs ${closes} closes`); process.exit(1);
  }
  console.log(`✅ Liquid balance: ${opens} opens = ${closes} closes`);

  // Corruption check
  const corruption = snippet.match(/\[[a-z_]+\.[a-z_]+(?:\.[a-z_]+)*\]\(http:\/\/[a-z_]+\.[a-z_]+/g) || [];
  if (corruption.length) { console.log('❌ Corruption detected'); process.exit(1); }
  console.log('✅ Corruption check passed');

  fs.writeFileSync(SNIPPET, snippet);
  console.log('✅ Snippet written — 6 product FAQ blocks');

  try {
    execSync(
      `shopify theme push --store ${STORE} --theme ${THEME} --path ./theme-files --only snippets/product-faq-schema.liquid --allow-live`,
      {stdio:'inherit', cwd:'/Users/rabiharabi/tiptop360-optimizer'}
    );
    console.log('✅ FAQ schema pushed');
  } catch(e) {
    fs.copyFileSync(`${SNIPPET}.PRE-${TS}.bak`, SNIPPET);
    console.log('❌ Push failed — rolled back'); process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────
// FIX 2: Collections — correct sort_order values
// ─────────────────────────────────────────────────────────
async function fixCollections(token) {
  console.log('\n━━━ FIX 2: Collection Landing Pages ━━━━━━━━━━━━━━━━━━━');

  const COLLECTIONS = [
    {
      title: 'Birthday Gifts UAE — Next-Day Delivery',
      handle: 'birthday-gifts-uae-delivery',
      meta_title: 'Birthday Gifts UAE — Next-Day Delivery | TipTop360',
      meta_description: 'Best birthday gifts in UAE with next-day delivery. Curated, tested, Dubai-approved. Order before 5pm. Cash on Delivery. From AED 29. Free shipping.',
      sort_order: 'best-selling',
      body_html: '<h1>Birthday Gifts UAE — Delivered Tomorrow Across All Emirates</h1><p>TipTop360 delivers birthday gifts across UAE next day. Top picks: Drawing Robot (AED 110), Smoke Bubble Machine (AED 99), Kids Toothbrush Bundle (AED 158). Order before 5pm for tomorrow delivery. Cash on Delivery available across all Emirates. Dubai Municipality approved products.</p><h2>Best Birthday Gifts for Kids in UAE</h2><p>Every TipTop360 product is Dubai Municipality approved and dispatched from UAE stock. Free delivery to Dubai, Abu Dhabi, Sharjah, Ajman, and all Emirates.</p><h2>Last-Minute Gifts: Order Before 5pm, Receive Tomorrow</h2><p>All orders placed before 5pm are dispatched same day. Cash on Delivery available — no card required.</p><h2>Frequently Asked Questions</h2><p><strong>Can I get a birthday gift delivered in UAE tomorrow?</strong><br>Yes. Order before 5pm for next-day delivery to Dubai, Abu Dhabi, Sharjah, and all UAE Emirates. Cash on Delivery available.</p><p><strong>What are the best birthday gifts with UAE delivery?</strong><br>Top TipTop360 picks: Kids Drawing Robot (AED 110), Smoke Bubble Machine (AED 99), Gym Bag (AED 150). All free delivery, Dubai Municipality approved.</p><p><strong>Is there a minimum order for free delivery in UAE?</strong><br>Free delivery on all orders. No minimum order required.</p>'
    },
    {
      title: 'Best Kids Gifts Dubai 2026 | Delivered Tomorrow',
      handle: 'best-kids-gifts-dubai',
      meta_title: 'Best Kids Gifts Dubai 2026 | Delivered Tomorrow | TipTop360',
      meta_description: 'Best kids gifts in Dubai 2026. Curated, tested, Dubai-approved. From AED 29. Free next-day delivery. Cash on Delivery. Order before 5pm for tomorrow.',
      sort_order: 'best-selling',
      body_html: '<h1>Best Kids Gifts in Dubai 2026 — Curated, Trusted, Delivered Tomorrow</h1><p>The best kids gifts in Dubai in 2026 are: U-Shaped Electric Toothbrush (AED 129), Drawing Robot (AED 110), Smoke Bubble Machine (AED 99) — all Dubai Municipality approved, delivered next day to Dubai, Abu Dhabi, Sharjah, and all UAE Emirates.</p><h2>Best for Toddlers (Ages 2-5): U-Shaped Toothbrush Bundle</h2><p>The Kids U-Shaped Electric Toothbrush (AED 129) is the highest-rated kids gift on TipTop360 — 142 reviews, 4.9 stars. BPA-free silicone, 60-second auto-clean.</p><h2>Best for Creative Kids (Ages 3-10): Drawing Robot</h2><p>The Kids Drawing Robot (AED 110) is a screen-free STEM toy with 100+ drawing templates. Dubai Municipality approved. Perfect Eid, birthday, or back-to-school gift.</p><h2>Best for Party Fun (All Ages): Smoke Bubble Machine</h2><p>The Smoke Bubble Machine (AED 99) creates magical glowing smoke-filled bubbles using safe water vapor. No chemicals. Dubai Municipality compliant.</p><h2>Frequently Asked Questions</h2><p><strong>What are the best kids gifts in Dubai in 2026?</strong><br>TipTop360 top picks: U-Shaped Electric Toothbrush (AED 129), Kids Drawing Robot (AED 110), Smoke Bubble Machine (AED 99). All Dubai Municipality approved, delivered next day.</p><p><strong>Can I get a kids gift delivered same day in Dubai?</strong><br>Order before 5pm and TipTop360 products arrive in Dubai the next business day. Cash on Delivery available.</p><p><strong>Are TipTop360 products Dubai approved?</strong><br>Yes. All TipTop360 products are Dubai Municipality and Health Department approved.</p>'
    }
  ];

  for (const c of COLLECTIONS) {
    await new Promise(r => setTimeout(r, 1500));

    // Check exists
    const chk = await fetch(`https://${STORE}/admin/api/2024-10/custom_collections.json?handle=${c.handle}`, {headers:{'X-Shopify-Access-Token':token}});
    const chkData = await chk.json();
    if (chkData.custom_collections?.length > 0) {
      console.log(`  ✅ Already exists: ${c.handle}`); continue;
    }

    const res = await fetch(`https://${STORE}/admin/api/2024-10/custom_collections.json`, {
      method:'POST',
      headers:{'X-Shopify-Access-Token':token,'Content-Type':'application/json'},
      body: JSON.stringify({custom_collection:{
        title: c.title, handle: c.handle, body_html: c.body_html,
        sort_order: c.sort_order, published: true,
        metafields:[
          {namespace:'global',key:'title_tag',value:c.meta_title,type:'single_line_text_field'},
          {namespace:'global',key:'description_tag',value:c.meta_description,type:'single_line_text_field'}
        ]
      }})
    });
    const data = await res.json();
    if (data.custom_collection) console.log(`  ✅ Created: /${c.handle} (ID: ${data.custom_collection.id})`);
    else console.log(`  ❌ Failed: ${c.handle}`, JSON.stringify(data).slice(0,150));
  }
}

// ─────────────────────────────────────────────────────────
// FIX 3: AEO paragraphs — use full product list approach
// ─────────────────────────────────────────────────────────
async function fixAeoParagraphs(token) {
  console.log('\n━━━ FIX 3: AEO Paragraphs (all 6 products) ━━━━━━━━━━━━');

  const AEO = [
    { handle:'kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift', intro:'The Kids U-Shaped Electric Toothbrush by TipTop360 cleans all tooth surfaces in 60 seconds using BPA-free silicone — Dubai Municipality approved for UAE children aged 2–12. AED 129. Free next-day delivery across UAE. Cash on Delivery available.' },
    { handle:'magnetic-gym-bag-uae-gymgear-tiptop360', intro:"The GymGear Magnetic Gym Bag by TipTop360 is UAE's only hands-free magnetic gym bag — attaches to any metal surface, weatherproof, with wet/dry compartment. AED 150. Free next-day delivery to Dubai and all UAE Emirates. Cash on Delivery available." },
    { handle:'kids-strawberry-foam-toothpaste-uae-approved', intro:"TipTop360 Kids Strawberry Foam Toothpaste is Dubai Municipality approved, fluoride-safe for ages 2+, and designed specifically for U-shaped toothbrushes. Spreads instantly across all tooth surfaces. AED 29. Free delivery across UAE. Cash on Delivery." },
    { handle:'experience-the-magic-smoke-bubble-machine', intro:"The TipTop360 Smoke Bubble Machine creates magical glowing smoke-filled bubbles using safe water vapor — no chemicals, Dubai Municipality compliant, UAE's favourite kids birthday gift. AED 99. Free next-day delivery. Cash on Delivery." },
    { handle:'kids-drawing-robot', intro:'Buy the Kids Drawing Robot in Dubai at TipTop360 — a screen-free STEM learning toy with 100+ templates, Dubai Municipality approved, for ages 3–10. AED 110. Free next-day delivery to Dubai and all UAE Emirates. Cash on Delivery.' },
    { handle:'ai-voice-recorder', intro:'Buy an AI Voice Recorder in Dubai at TipTop360 — auto-transcribes in 57 languages with GPT-4 summaries, 20+ hour battery, for UAE professionals and students. AED 299. Free next-day delivery. Cash on Delivery available across UAE.' }
  ];

  const allProducts = await getAllProducts(token);
  console.log(`  Fetched ${allProducts.length} products`);
  const productMap = {};
  for (const p of allProducts) productMap[p.handle] = p;

  for (const a of AEO) {
    await new Promise(r => setTimeout(r, 1500));
    const product = productMap[a.handle];
    if (!product) { console.log(`  ⚠️  Not found: ${a.handle}`); continue; }

    if (product.body_html && product.body_html.includes(a.intro.slice(0,50))) {
      console.log(`  ✅ Already has AEO: ${a.handle}`); continue;
    }

    const newBody = `<p><strong>${a.intro}</strong></p>\n\n` + (product.body_html || '');
    const res = await fetch(`https://${STORE}/admin/api/2024-10/products/${product.id}.json`, {
      method:'PUT',
      headers:{'X-Shopify-Access-Token':token,'Content-Type':'application/json'},
      body: JSON.stringify({product:{id:product.id, body_html:newBody}})
    });
    const d = await res.json();
    if (d.product) console.log(`  ✅ AEO injected: ${a.handle}`);
    else console.log(`  ❌ Failed: ${a.handle}`, JSON.stringify(d).slice(0,100));
  }
}

// ─────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────
(async () => {
  console.log('\n🔧 TipTop360 — Fix Run (3 patches)\n' + '='.repeat(55));

  await fixFaqSchema();

  console.log('\n[Auth] Getting token...');
  const token = await getToken();
  if (!token) { console.log('❌ Auth failed'); process.exit(1); }
  console.log('✅ Token obtained');

  await fixCollections(token);
  await fixAeoParagraphs(token);

  console.log('\n' + '='.repeat(55));
  console.log('✅ ALL 3 FIXES COMPLETE');
  console.log('Next: node deploy-keyword-meta.cjs && bash regression-geo.sh');
})();
