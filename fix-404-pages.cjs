require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
const Anthropic = require('@anthropic-ai/sdk').default;
const STORE = process.env.SHOPIFY_STORE;

async function getToken() {
  const r = await fetch(`https://${STORE}/admin/oauth/access_token`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID, client_secret:process.env.SHOPIFY_CLIENT_SECRET, grant_type:'client_credentials'})
  });
  return (await r.json()).access_token;
}

(async () => {
  const t = await getToken();
  const HEAD = {'X-Shopify-Access-Token':t, 'Content-Type':'application/json'};
  
  console.log('🔧 FIX 404 PAGES\n' + '='.repeat(50));
  
  // ============================================
  // PART 1: Create redirects for 3 existing pages
  // ============================================
  const redirects = [
    {path: '/pages/contact-us', target: '/pages/contact-tiptop360'},
    {path: '/pages/privacy-policy', target: '/pages/gdpr-privacy-policy'},
    {path: '/pages/terms-of-service', target: '/pages/tiptop360-terms-of-service'}
  ];
  
  console.log('\n[1] Creating 3 redirects...');
  for (const r of redirects) {
    const res = await fetch(`https://${STORE}/admin/api/2024-10/redirects.json`, {
      method:'POST', headers:HEAD,
      body: JSON.stringify({redirect: r})
    });
    if (res.ok) console.log(`  ✓ ${r.path} → ${r.target}`);
    else console.log(`  ✗ ${r.path}: ${res.status} (likely already exists)`);
    await new Promise(r => setTimeout(r, 500));
  }
  
  // ============================================
  // PART 2: Generate UAE-compliant Refund Policy
  // ============================================
  console.log('\n[2] Generating UAE-compliant refund policy via Claude...');
  
  const claude = new Anthropic();
  const r = await claude.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2500,
    temperature: 0,
    messages: [{role:'user', content: `Write a clean HTML refund/return policy page for TipTop360 (tiptop360.com), a UAE-based Shopify store selling kids' products, dental care, art supplies, and smart gadgets.

Requirements:
- UAE consumer law compliant (Federal Law No. 24 of 2006 on consumer protection)
- COD-specific terms (most orders are Cash on Delivery)
- 7-day return window for defective items only (no buyer's remorse — minimize exposure)
- Clear NON-returnable items: opened toothbrushes, used toothpaste, opened art supplies, gift cards, customized items
- Refund timeline: 7-14 business days back to original payment method
- Process: WhatsApp +971 58 515 6033 or info@tiptop360.com
- UAE-Based at RAK Free Zone

Format: Plain HTML with <h2>, <h3>, <p>, <ul>, <li>. NO inline styles. NO markdown. Start with <h2>Refund & Return Policy</h2>. End with last update date "Updated: 2026-04-28".

Output the HTML directly, no preamble, no code blocks.`}]
  });
  
  let policyHtml = r.content[0].text.trim();
  // Clean any code blocks if Claude added them
  policyHtml = policyHtml.replace(/^```html?\n?/, '').replace(/\n?```$/, '');
  
  console.log(`  Generated: ${policyHtml.length} chars`);
  
  // ============================================
  // PART 3: Create the page
  // ============================================
  console.log('\n[3] Creating refund-policy page...');
  
  const pageRes = await fetch(`https://${STORE}/admin/api/2024-10/pages.json`, {
    method:'POST', headers:HEAD,
    body: JSON.stringify({
      page: {
        title: 'Refund & Return Policy | TipTop360 UAE',
        handle: 'refund-policy',
        body_html: policyHtml,
        published: true,
        metafields: [{
          namespace: 'global',
          key: 'description_tag',
          value: 'TipTop360 UAE refund policy — 7-day return for defective items, COD support, WhatsApp help. UAE consumer law compliant.',
          type: 'single_line_text_field'
        }]
      }
    })
  });
  
  if (pageRes.ok) {
    const j = await pageRes.json();
    console.log(`  ✓ Created /pages/${j.page.handle}`);
  } else {
    const err = await pageRes.text();
    console.log(`  ✗ Failed: ${pageRes.status} ${err.slice(0,200)}`);
  }
  
  // ============================================
  // PART 4: Verify all 4 URLs now work
  // ============================================
  console.log('\n[4] Waiting 15s + verifying all 4 URLs...\n');
  await new Promise(r => setTimeout(r, 15000));
  
  const urls = [
    'https://tiptop360.com/pages/contact-us',
    'https://tiptop360.com/pages/refund-policy',
    'https://tiptop360.com/pages/privacy-policy',
    'https://tiptop360.com/pages/terms-of-service'
  ];
  
  for (const url of urls) {
    const res = await fetch(url, {redirect: 'follow'});
    console.log(`  ${res.status === 200 ? '✓' : '✗'} ${url} → ${res.status}`);
  }
})();
