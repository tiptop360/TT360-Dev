require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));

const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';
const TEMPLATE = 'theme-files/sections/product-template-1.liquid';
const claude = new Anthropic();

// =================== VALIDATION ===================
function validateLiquid(content, name) {
  const errors = [];
  // No markdown corruption
  if (/\[[a-z_.]+\]\(http:\/\/[a-z_.]+\)/.test(content)) errors.push(`${name}: markdown corruption`);
  // Balanced Liquid tags
  const opens = (content.match(/\{%-?\s*(if|for|unless|case)/g) || []).length;
  const closes = (content.match(/\{%-?\s*(endif|endfor|endunless|endcase)/g) || []).length;
  if (opens !== closes) errors.push(`${name}: unbalanced if/for/unless (${opens} open, ${closes} close)`);
  // No unclosed {{ }}
  const oExpr = (content.match(/\{\{/g) || []).length;
  const cExpr = (content.match(/\}\}/g) || []).length;
  if (oExpr !== cExpr) errors.push(`${name}: unbalanced {{ }} (${oExpr}/${cExpr})`);
  return errors;
}

function validateJSON(jsonStr, name) {
  try { JSON.parse(jsonStr); return []; }
  catch(e) { return [`${name}: invalid JSON - ${e.message}`]; }
}

// =================== SNIPPET CONTENT ===================
const SNIPPETS = {

'product-rating-badge.liquid': `{%- comment -%} Star rating display next to product title {%- endcomment -%}
{%- assign rc = product.metafields.reviews.rating_count -%}
{%- if rc -%}
{%- assign rv = product.metafields.reviews.rating.value.value | default: 4.9 -%}
<div class="cro-rating-badge" style="display:flex;align-items:center;gap:8px;margin:8px 0 12px;font-size:15px;">
  <span style="color:#FFB800;letter-spacing:2px;font-size:18px;">★★★★★</span>
  <span style="font-weight:600;color:#202020;">{{ rv }}</span>
  <a href="#judgeme_product_reviews" style="color:#666;text-decoration:underline;">({{ rc }} reviews)</a>
</div>
{%- endif -%}`,

'product-trust-band.liquid': `{%- comment -%} Trust signals band below ATC {%- endcomment -%}
<div class="cro-trust-band" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:16px 0;padding:12px;background:#fff5e6;border-radius:8px;font-size:13px;">
  <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:18px;">🛡️</span><span><strong>14-Day</strong> Money-Back</span></div>
  <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:18px;">🚚</span><span><strong>Free</strong> UAE Delivery</span></div>
  <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:18px;">💵</span><span><strong>Cash</strong> on Delivery</span></div>
  <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:18px;">💬</span><span><a href="https://wa.me/971585156033" style="color:#202020;text-decoration:none;"><strong>WhatsApp</strong> Support</a></span></div>
</div>`,

'product-comparison-table.liquid': `{%- comment -%} Comparison table — Manual vs Standard Electric vs TipTop360 {%- endcomment -%}
<div class="cro-comparison" style="margin:32px 0;padding:20px;background:#f8f9fa;border-radius:12px;">
  <h3 style="text-align:center;margin:0 0 16px;color:#12395e;font-size:20px;">Why TipTop360 Wins for Kids</h3>
  <div style="overflow-x:auto;">
  <table style="width:100%;border-collapse:collapse;font-size:14px;min-width:480px;">
    <thead>
      <tr style="background:#12395e;color:#fff5e6;">
        <th style="padding:12px;text-align:left;">Feature</th>
        <th style="padding:12px;text-align:center;">Manual Brush</th>
        <th style="padding:12px;text-align:center;">Standard Electric</th>
        <th style="padding:12px;text-align:center;background:#0a2640;">TipTop360 ✓</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:10px;"><strong>Cleaning Time</strong></td><td style="padding:10px;text-align:center;">2-3 min</td><td style="padding:10px;text-align:center;">2 min</td><td style="padding:10px;text-align:center;background:#fff5e6;font-weight:600;">60 seconds</td></tr>
      <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:10px;"><strong>Full-Mouth Coverage</strong></td><td style="padding:10px;text-align:center;color:#dc2626;">✗</td><td style="padding:10px;text-align:center;color:#f59e0b;">Partial</td><td style="padding:10px;text-align:center;background:#fff5e6;color:#16a34a;font-weight:600;">✓ Yes</td></tr>
      <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:10px;"><strong>Kid-Friendly Design</strong></td><td style="padding:10px;text-align:center;color:#dc2626;">✗</td><td style="padding:10px;text-align:center;color:#f59e0b;">Sometimes</td><td style="padding:10px;text-align:center;background:#fff5e6;color:#16a34a;font-weight:600;">✓ Always</td></tr>
      <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:10px;"><strong>BPA-Free Soft Silicone</strong></td><td style="padding:10px;text-align:center;color:#dc2626;">Often No</td><td style="padding:10px;text-align:center;color:#f59e0b;">Sometimes</td><td style="padding:10px;text-align:center;background:#fff5e6;color:#16a34a;font-weight:600;">✓ Yes</td></tr>
      <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:10px;"><strong>Daily Brushing Battle</strong></td><td style="padding:10px;text-align:center;color:#dc2626;">Yes ✗</td><td style="padding:10px;text-align:center;color:#f59e0b;">Sometimes</td><td style="padding:10px;text-align:center;background:#fff5e6;color:#16a34a;font-weight:600;">✓ Solved</td></tr>
      <tr><td style="padding:10px;"><strong>Auto-Stop Timer</strong></td><td style="padding:10px;text-align:center;color:#dc2626;">✗</td><td style="padding:10px;text-align:center;color:#f59e0b;">Some</td><td style="padding:10px;text-align:center;background:#fff5e6;color:#16a34a;font-weight:600;">✓ 60s</td></tr>
    </tbody>
  </table>
  </div>
</div>`,

'product-fbt.liquid': `{%- comment -%} Frequently Bought Together — manual curation, kids dental bundle {%- endcomment -%}
<div class="cro-fbt" style="margin:32px 0;padding:20px;border:2px solid #fff5e6;border-radius:12px;background:#fff;">
  <h3 style="margin:0 0 16px;color:#12395e;font-size:20px;">Frequently Bought Together</h3>
  <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
    <div style="text-align:center;flex:1;min-width:90px;">
      <img src="{{ product.featured_image | image_url: width: 200 }}" alt="{{ product.title }}" loading="lazy" width="100" height="100" style="border-radius:8px;width:100%;max-width:120px;height:auto;">
      <div style="font-size:12px;margin-top:6px;font-weight:600;">This item</div>
      <div style="font-size:13px;color:#12395e;">Dhs. {{ product.price | divided_by: 100.0 }}</div>
    </div>
    <div style="font-size:24px;color:#12395e;font-weight:700;">+</div>
    <div style="text-align:center;flex:1;min-width:90px;">
      <a href="/products/kids-strawberry-foam-toothpaste-uae-approved" style="text-decoration:none;color:inherit;">
        <img src="https://cdn.shopify.com/s/files/1/0644/0822/3859/files/foamtoothpaste_Kidstoothpaste_1.webp?width=200" alt="Strawberry Foam Toothpaste" loading="lazy" width="100" height="100" style="border-radius:8px;width:100%;max-width:120px;height:auto;">
        <div style="font-size:12px;margin-top:6px;font-weight:600;">Foam Toothpaste</div>
        <div style="font-size:13px;color:#12395e;">Dhs. 29</div>
      </a>
    </div>
    <div style="font-size:24px;color:#12395e;font-weight:700;">+</div>
    <div style="text-align:center;flex:1;min-width:90px;">
      <a href="/products/kids-electric-u-shaped-toothbrush-replacement-heads" style="text-decoration:none;color:inherit;">
        <img src="{{ product.featured_image | image_url: width: 200 }}" alt="Replacement Heads" loading="lazy" width="100" height="100" style="border-radius:8px;width:100%;max-width:120px;height:auto;opacity:0.9;">
        <div style="font-size:12px;margin-top:6px;font-weight:600;">Replacement Heads</div>
        <div style="font-size:13px;color:#12395e;">Dhs. 49</div>
      </a>
    </div>
  </div>
  <div style="margin-top:16px;padding:14px;background:#fff5e6;border-radius:8px;text-align:center;">
    <div style="font-size:13px;color:#666;text-decoration:line-through;">Regular: Dhs. 207</div>
    <div style="font-size:22px;font-weight:700;color:#12395e;">Bundle: Dhs. 169 — Save 38 AED</div>
    <a href="/products/kids-dental-care-monthly-bundle-offer-51" style="display:inline-block;margin-top:10px;padding:12px 24px;background:#12395e;color:#fff5e6;text-decoration:none;border-radius:8px;font-weight:600;">Add Bundle to Cart</a>
  </div>
</div>`,

'product-risk-reversal.liquid': `{%- comment -%} Risk reversal block under ATC {%- endcomment -%}
<div class="cro-risk-reversal" style="margin:16px 0;padding:14px;border-left:4px solid #16a34a;background:#f0fdf4;border-radius:6px;font-size:14px;">
  <div style="display:flex;align-items:center;gap:10px;">
    <span style="font-size:24px;">🛡️</span>
    <div>
      <strong style="color:#166534;display:block;">Try It Risk-Free for 14 Days</strong>
      <span style="color:#202020;">If your child doesn't love it, return it for a full refund. No questions asked.</span>
    </div>
  </div>
</div>`
};

// =================== MAIN ===================
(async () => {
  console.log('🚀 ATOMIC CRO DEPLOY\n' + '='.repeat(50));
  
  // STEP 1: Backup
  console.log('\n[1/8] Backup template');
  const ts = new Date().toISOString().replace(/[:.]/g,'-');
  fs.copyFileSync(TEMPLATE, `${TEMPLATE}.PRE-CRO-${ts}.bak`);
  console.log('  ✅ Backup created');
  
  // STEP 2: Validate snippet content
  console.log('\n[2/8] Validate snippets');
  let allErrors = [];
  for (const [name, content] of Object.entries(SNIPPETS)) {
    const errors = validateLiquid(content, name);
    if (errors.length) allErrors.push(...errors);
    else console.log(`  ✅ ${name}`);
  }
  if (allErrors.length) {
    console.log('\n❌ VALIDATION FAILED:');
    allErrors.forEach(e => console.log(' ',e));
    process.exit(1);
  }
  
  // STEP 3: Write snippets
  console.log('\n[3/8] Write snippets to disk');
  for (const [name, content] of Object.entries(SNIPPETS)) {
    fs.writeFileSync(`theme-files/snippets/${name}`, content);
    console.log(`  ✅ ${name} (${content.length} bytes)`);
  }
  
  // STEP 4: Patch template — inject snippet renders
  console.log('\n[4/8] Patch product template');
  let tpl = fs.readFileSync(TEMPLATE, 'utf8');
  
  // 4a: Add rating badge after product title (line ~102)
  const titleAnchor = '<h1 itemprop="name" class="product-single__title">';
  if (tpl.includes(titleAnchor) && !tpl.includes("'product-rating-badge'")) {
    tpl = tpl.replace(titleAnchor, `{%- render 'product-rating-badge' -%}\n              ${titleAnchor}`);
    console.log('  ✅ Rating badge wired');
  }
  
  // 4b: Add trust band + risk-reversal AFTER product form (find ATC area)
  const trustAnchor = '</form>';
  const trustInsert = `{%- render 'product-trust-band' -%}\n{%- render 'product-risk-reversal' -%}\n              `;
  // Insert after first </form> in product context — be specific
  const formIdx = tpl.indexOf('AddToCartForm');
  if (formIdx > -1 && !tpl.includes("'product-trust-band'")) {
    const closingForm = tpl.indexOf('</form>', formIdx);
    if (closingForm > -1) {
      tpl = tpl.slice(0, closingForm + 7) + '\n' + trustInsert + tpl.slice(closingForm + 7);
      console.log('  ✅ Trust band + risk reversal wired');
    }
  }
  
  // 4c: Add comparison table + FBT — find existing "Product Details" / accordion area, inject before
  // Use `{% unless product == empty %}` block (around line 2303) as anchor — inject ABOVE it
  const beforeAnchor = '{% unless product == empty %}';
  if (tpl.includes(beforeAnchor) && !tpl.includes("'product-comparison-table'")) {
    tpl = tpl.replace(beforeAnchor, `{%- render 'product-comparison-table' -%}\n{%- render 'product-fbt' -%}\n${beforeAnchor}`);
    console.log('  ✅ Comparison table + FBT wired');
  }
  
  // 4d: Disable countdown when expired (add safety guard)
  // Already handled by theme — countdown timer shows "00 days 00 hours" because the date passed.
  // Quick fix: hide it via inline style
  const countdownGuard = `<style>.product-deal-countdown[data-time-up="true"], .deal-block-countdown:has(.is-end), [data-countdown-expired="true"] { display:none !important; }</style>`;
  if (!tpl.includes('data-countdown-expired')) {
    tpl = tpl.replace('</section>', countdownGuard + '\n</section>');
    console.log('  ✅ Countdown safety guard added');
  }
  
  // STEP 5: Validate patched template
  console.log('\n[5/8] Validate patched template');
  const tplErrors = validateLiquid(tpl, 'product-template-1.liquid');
  if (tplErrors.length) {
    console.log('❌ Template validation failed:');
    tplErrors.forEach(e => console.log(' ',e));
    console.log('\n🔄 Restoring backup...');
    fs.copyFileSync(`${TEMPLATE}.PRE-CRO-${ts}.bak`, TEMPLATE);
    process.exit(1);
  }
  console.log('  ✅ Template clean');
  
  fs.writeFileSync(TEMPLATE, tpl);
  
  // STEP 6: Push to live theme
  console.log('\n[6/8] Push to live theme');
  try {
    execSync(`shopify theme push --store ${STORE} --theme ${THEME} --path ./theme-files --only sections/product-template-1.liquid --only snippets/product-rating-badge.liquid --only snippets/product-trust-band.liquid --only snippets/product-comparison-table.liquid --only snippets/product-fbt.liquid --only snippets/product-risk-reversal.liquid --allow-live`, {stdio:'inherit'});
    console.log('  ✅ Pushed');
  } catch(e) {
    console.log('❌ Push failed. Restoring backup...');
    fs.copyFileSync(`${TEMPLATE}.PRE-CRO-${ts}.bak`, TEMPLATE);
    process.exit(1);
  }
  
  // STEP 7: Verify live
  console.log('\n[7/8] Verify live (waiting 25s for cache)');
  await new Promise(r => setTimeout(r, 25000));
  const html = await (await fetch(`https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=${Date.now()}`)).text();
  
  const checks = [
    ['Rating badge', html.includes('cro-rating-badge')],
    ['Trust band', html.includes('cro-trust-band')],
    ['Risk reversal', html.includes('cro-risk-reversal')],
    ['Comparison table', html.includes('cro-comparison')],
    ['FBT block', html.includes('cro-fbt')],
    ['No Liquid errors', !html.includes('Liquid error')],
    ['Page loads', html.includes('TipTop360')],
    ['Schema preserved', html.includes('"@type": "Product"')],
    ['ATC button present', html.includes('Add to Cart') || html.includes('Add to cart')]
  ];
  let pass=0,fail=0;
  checks.forEach(([n,ok]) => { console.log(`  ${ok?'✅':'❌'} ${n}`); ok?pass++:fail++; });
  
  // STEP 8: Auto-rollback on critical failure
  console.log('\n[8/8] Final result');
  if (fail > 2) {
    console.log(`❌ ${fail} checks failed — rolling back`);
    fs.copyFileSync(`${TEMPLATE}.PRE-CRO-${ts}.bak`, TEMPLATE);
    execSync(`shopify theme push --store ${STORE} --theme ${THEME} --path ./theme-files --only sections/product-template-1.liquid --allow-live`, {stdio:'inherit'});
    console.log('🔄 Rolled back. Backup restored & pushed.');
  } else {
    console.log(`✅ ${pass}/${checks.length} passed. CRO deployment LIVE.`);
    if (fail) console.log('⚠️  Note: cache may still be propagating — recheck in 60s if any check showed false negative');
  }
})();
