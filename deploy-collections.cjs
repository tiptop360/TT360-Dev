require('dotenv').config();
const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));

const STORE = process.env.SHOPIFY_STORE;

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

const COLLECTIONS = [
  {
    title: 'Birthday Gifts UAE — Next-Day Delivery',
    handle: 'birthday-gifts-uae-delivery',
    meta_title: 'Birthday Gifts UAE — Next-Day Delivery | TipTop360',
    meta_description: 'Best birthday gifts in UAE with next-day delivery. Curated, tested, Dubai-approved. Order before 3pm. Cash on Delivery. From AED 29. Free shipping.',
    body_html: `<h1>Birthday Gifts UAE — Delivered Tomorrow Across All Emirates</h1>
<p>TipTop360 delivers birthday gifts across UAE next day. Best picks: Drawing Robot (AED 110), Smoke Bubble Machine (AED 99), Kids U-Shaped Toothbrush Bundle (AED 158). Order before 5pm for tomorrow delivery.</p>

<h2>Best Birthday Gifts for Kids in UAE</h2>
<p>Whether you need a last-minute gift in Dubai or planning ahead for a birthday party in Abu Dhabi, TipTop360 has UAE-approved gifts ready to ship today. Every product is Dubai Municipality approved and arrives with free delivery across all Emirates.</p>

<h2>Best Birthday Gifts for Fitness Lovers in UAE</h2>
<p>The GymGear™ Magnetic Gym Bag (AED 150) is one of UAE's most unique gifts for active adults — hands-free magnetic attachment, weatherproof, and delivered next day to Dubai, Abu Dhabi, and Sharjah.</p>

<h2>Last-Minute Gifts: Order Before 5pm, Receive Tomorrow</h2>
<p>All TipTop360 orders placed before 5pm are dispatched same day and delivered the next business day. Cash on Delivery available across all UAE Emirates — no card required.</p>

<h2>Why UAE Families Trust TipTop360 for Birthday Gifts</h2>
<p>We are a UAE-based business, RAK Free Zone licensed. Every product is sourced, quality-checked, and dispatched from UAE. 50,000+ UAE families have ordered from TipTop360.</p>

<h2>Frequently Asked Questions</h2>
<p><strong>Can I get a birthday gift delivered in UAE tomorrow?</strong><br>Yes. Order on tiptop360.com before 5pm for next-day delivery to Dubai, Abu Dhabi, Sharjah, and all UAE Emirates. Cash on Delivery available.</p>
<p><strong>What are the best birthday gifts with UAE delivery?</strong><br>Top TipTop360 picks: Kids Drawing Robot (AED 110), Smoke Bubble Machine (AED 99), Gym Bag (AED 150). All free delivery, Dubai Municipality approved.</p>
<p><strong>Is there a minimum order for free delivery in UAE?</strong><br>Free delivery on all orders. No minimum order required.</p>
<p><strong>Are TipTop360 products Dubai approved?</strong><br>Yes. All TipTop360 products are Dubai Municipality and Health Department approved.</p>`,
    sort_order: 'BEST_SELLING'
  },
  {
    title: 'Best Kids Gifts Dubai 2026 | Delivered Tomorrow',
    handle: 'best-kids-gifts-dubai',
    meta_title: 'Best Kids Gifts Dubai 2026 | Delivered Tomorrow | TipTop360',
    meta_description: 'Best kids gifts in Dubai 2026. Curated, tested, Dubai-approved. From AED 29. Free next-day delivery. Cash on Delivery. Order before 5pm for tomorrow.',
    body_html: `<h1>Best Kids Gifts in Dubai 2026 — Curated, Trusted, Delivered Tomorrow</h1>
<p>The best kids gifts in Dubai in 2026 are: U-Shaped Electric Toothbrush (AED 129), Drawing Robot (AED 110), Smoke Bubble Machine (AED 99) — all Dubai Municipality approved, delivered next day to Dubai, Abu Dhabi, Sharjah, and all UAE Emirates.</p>

<h2>Best for Toddlers (Ages 2–5): U-Shaped Toothbrush Bundle</h2>
<p>The Kids U-Shaped Electric Toothbrush (AED 129) is the highest-rated kids gift on TipTop360 — 142 reviews, 4.9 stars. BPA-free silicone, 60-second auto-clean, Dubai Municipality approved. Bundle with Strawberry Foam Toothpaste (AED 29) for the complete dental care gift.</p>

<h2>Best for Creative Kids (Ages 3–10): Drawing Robot</h2>
<p>The Kids Drawing Robot (AED 110) is a screen-free STEM toy with 100+ drawing templates. Dubai Municipality approved. Develops fine motor skills and creativity without digital dependency. Ideal Eid, birthday, or back-to-school gift.</p>

<h2>Best for Party Fun (All Ages): Smoke Bubble Machine</h2>
<p>The Smoke Bubble Machine (AED 99) creates magical glowing smoke-filled bubbles using safe water vapor. No chemicals. Dubai Municipality compliant. UAE's most surprising birthday gift under AED 100.</p>

<h2>How to Order a Kids Gift in Dubai with Next-Day Delivery</h2>
<p>Order on tiptop360.com before 5pm. Select Cash on Delivery at checkout — no card required. Your order is dispatched same day and delivered the next business day to any address in Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, and Fujairah.</p>

<h2>Frequently Asked Questions</h2>
<p><strong>What are the best kids gifts in Dubai in 2026?</strong><br>TipTop360's top picks: U-Shaped Electric Toothbrush (AED 129), Kids Drawing Robot (AED 110), Smoke Bubble Machine (AED 99). All Dubai Municipality approved, delivered next day.</p>
<p><strong>Can I get a kids gift delivered same day in Dubai?</strong><br>Order before 5pm and most TipTop360 products arrive in Dubai the next business day. Cash on Delivery available.</p>
<p><strong>Which TipTop360 products make the best birthday gifts for kids in UAE?</strong><br>Drawing Robot (ages 3–10), Smoke Bubble Machine (all ages), and the Kids U-Shaped Toothbrush (ages 2–12) are the top 3 birthday gifts.</p>
<p><strong>Are TipTop360 products Dubai approved?</strong><br>Yes. All TipTop360 products are Dubai Municipality and Health Department approved.</p>`,
    sort_order: 'BEST_SELLING'
  }
];

// Validate before touching API
function validate(c) {
  const errors = [];
  if (c.meta_title.length > 60) errors.push(`meta_title ${c.meta_title.length} chars — max 60`);
  if (c.meta_description.length < 120 || c.meta_description.length > 160)
    errors.push(`meta_desc ${c.meta_description.length} chars — must be 120-160`);
  if (!c.body_html.includes('<h1>')) errors.push('missing H1');
  if (!c.body_html.includes('<h2>')) errors.push('missing H2s');
  if (!c.body_html.includes('UAE') && !c.body_html.includes('Dubai')) errors.push('missing geo signal');
  if (!c.body_html.includes('Cash on Delivery')) errors.push('missing COD signal');
  if (!c.body_html.includes('AED')) errors.push('missing price signal');
  return errors;
}

(async () => {
  console.log('\n🚀 @builder-3 — Collection Landing Pages\n' + '='.repeat(55));

  // 1. Validate
  console.log('\n[1] Validating...');
  let allValid = true;
  for (const c of COLLECTIONS) {
    const errs = validate(c);
    if (errs.length) {
      errs.forEach(e => console.log(`  ❌ [${c.handle}] ${e}`));
      allValid = false;
    } else {
      console.log(`  ✅ ${c.handle} (title: ${c.meta_title.length}c, desc: ${c.meta_description.length}c)`);
    }
  }
  if (!allValid) { process.exit(1); }

  // 2. Auth
  console.log('\n[2] Authenticating...');
  const token = await getToken();
  if (!token) { console.log('❌ Auth failed'); process.exit(1); }
  console.log('  ✅ Token obtained');

  // 3. Create each collection
  console.log('\n[3] Creating collections...');
  for (const c of COLLECTIONS) {
    await new Promise(r => setTimeout(r, 1500));

    // Check if already exists
    const checkRes = await fetch(
      `https://${STORE}/admin/api/2024-10/custom_collections.json?handle=${c.handle}`,
      {headers: {'X-Shopify-Access-Token': token}}
    );
    const checkData = await checkRes.json();
    if (checkData.custom_collections?.length > 0) {
      console.log(`  ⚠️  Already exists: ${c.handle} — skipping`);
      continue;
    }

    const res = await fetch(`https://${STORE}/admin/api/2024-10/custom_collections.json`, {
      method: 'POST',
      headers: {'X-Shopify-Access-Token': token, 'Content-Type': 'application/json'},
      body: JSON.stringify({
        custom_collection: {
          title: c.title,
          handle: c.handle,
          body_html: c.body_html,
          sort_order: c.sort_order,
          published: true,
          metafields: [
            {namespace:'global', key:'title_tag', value: c.meta_title, type:'single_line_text_field'},
            {namespace:'global', key:'description_tag', value: c.meta_description, type:'single_line_text_field'}
          ]
        }
      })
    });
    const data = await res.json();
    if (data.custom_collection) {
      console.log(`  ✅ Created: /${c.handle} (ID: ${data.custom_collection.id})`);
    } else {
      console.log(`  ❌ Failed: ${c.handle}`, JSON.stringify(data).slice(0,150));
    }
  }

  console.log('\n✅ @builder-3 COMPLETE');
  console.log('  → Verify at:');
  console.log('    https://tiptop360.com/collections/birthday-gifts-uae-delivery');
  console.log('    https://tiptop360.com/collections/best-kids-gifts-dubai');
})();
