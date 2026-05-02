require('dotenv').config();
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
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
  const r = await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,title,images,price`, {headers:{'X-Shopify-Access-Token':t}})).json();
  
  const find = h => r.products.find(p => p.handle === h);
  const toothpaste = find('kids-strawberry-foam-toothpaste-uae-approved');
  const heads = find('kids-electric-u-shaped-toothbrush-replacement-heads');
  
  console.log('Toothpaste:', toothpaste?.handle, '| Image:', toothpaste?.images?.[0]?.src?.split('/').pop());
  console.log('Replacement heads:', heads?.handle, '| Image:', heads?.images?.[0]?.src?.split('/').pop());
  console.log('Heads price:', heads?.variants?.[0]?.price || 'check on page');
  
  if (!toothpaste || !heads) { console.log('❌ Missing product'); process.exit(1); }
  
  const toothpasteImg = toothpaste.images[0].src.split('?')[0];
  const headsImg = heads.images[0].src.split('?')[0];
  
  const fbt = `{%- comment -%} Frequently Bought Together — accurate matching kids dental bundle {%- endcomment -%}
<div class="cro-fbt" style="margin:32px 0;padding:20px;border:2px solid #fff5e6;border-radius:12px;background:#fff;">
  <h3 style="margin:0 0 16px;color:#12395e;font-size:20px;text-align:center;">Frequently Bought Together</h3>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;">
    <div style="text-align:center;flex:1;min-width:90px;max-width:140px;">
      <img src="{{ product.featured_image | image_url: width: 240 }}" alt="{{ product.title }}" loading="lazy" width="120" height="120" style="border-radius:8px;width:100%;height:auto;border:2px solid #fff5e6;">
      <div style="font-size:12px;margin-top:6px;font-weight:600;line-height:1.3;">This Toothbrush</div>
      <div style="font-size:13px;color:#12395e;font-weight:700;">Dhs. 129</div>
    </div>
    <div style="font-size:24px;color:#12395e;font-weight:700;">+</div>
    <div style="text-align:center;flex:1;min-width:90px;max-width:140px;">
      <a href="/products/${toothpaste.handle}" style="text-decoration:none;color:inherit;">
        <img src="${toothpasteImg}?width=240" alt="Kids Strawberry Foam Toothpaste" loading="lazy" width="120" height="120" style="border-radius:8px;width:100%;height:auto;">
        <div style="font-size:12px;margin-top:6px;font-weight:600;line-height:1.3;">Strawberry Foam Toothpaste</div>
        <div style="font-size:13px;color:#12395e;font-weight:700;">Dhs. 29</div>
      </a>
    </div>
    <div style="font-size:24px;color:#12395e;font-weight:700;">+</div>
    <div style="text-align:center;flex:1;min-width:90px;max-width:140px;">
      <a href="/products/${heads.handle}" style="text-decoration:none;color:inherit;">
        <img src="${headsImg}?width=240" alt="Replacement Brush Heads" loading="lazy" width="120" height="120" style="border-radius:8px;width:100%;height:auto;">
        <div style="font-size:12px;margin-top:6px;font-weight:600;line-height:1.3;">Replacement Heads</div>
        <div style="font-size:13px;color:#12395e;font-weight:700;">Dhs. 49</div>
      </a>
    </div>
  </div>
  <div style="margin-top:18px;padding:14px;background:#fff5e6;border-radius:8px;text-align:center;">
    <div style="font-size:13px;color:#666;text-decoration:line-through;">Regular: Dhs. 207</div>
    <div style="font-size:22px;font-weight:700;color:#12395e;margin:4px 0;">Bundle: Dhs. 169 — Save 38 AED</div>
    <a href="/products/kids-dental-care-monthly-bundle-offer-51" style="display:inline-block;margin-top:10px;padding:14px 28px;background:#12395e;color:#fff5e6;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Add Bundle to Cart →</a>
  </div>
</div>`;
  
  fs.writeFileSync('theme-files/snippets/product-fbt.liquid', fbt);
  console.log('\n✅ Snippet written. Length:', fbt.length);
  console.log('Markdown corruption check:', (fbt.match(/\]\(http/g) || []).length, '(must be 0)');
})();
