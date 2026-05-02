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
  const r = await (await fetch(`https://${STORE}/admin/api/2024-10/products.json?limit=250&fields=id,handle,title,images,variants`, {headers:{'X-Shopify-Access-Token':t}})).json();
  
  const find = h => r.products.find(p => p.handle === h);
  const toothpaste = find('kids-strawberry-foam-toothpaste-uae-approved');
  const heads = find('kids-electric-u-shaped-toothbrush-replacement-heads');
  
  const tpImg = toothpaste.images[0].src.split('?')[0];
  const hImg = heads.images[0].src.split('?')[0];
  
  console.log('Toothpaste:', toothpaste.title, '— price:', toothpaste.variants[0].price);
  console.log('Heads:', heads.title, '— price:', heads.variants[0].price);
  
  // Use Liquid to fetch live data (prices, variant IDs) — more accurate
  const snippet = `{%- comment -%} FBT — only renders for U-shaped toothbrush {%- endcomment -%}
{%- if product.handle == 'kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift' -%}
{%- assign tp = all_products['${toothpaste.handle}'] -%}
{%- assign hd = all_products['${heads.handle}'] -%}
{%- assign bundle_total = product.price | plus: tp.price | plus: hd.price -%}
<div class="cro-fbt" style="margin:32px 0;padding:20px;border:2px solid #fff5e6;border-radius:12px;background:#fff;">
  <h3 style="margin:0 0 16px;color:#12395e;font-size:20px;text-align:center;">Frequently Bought Together</h3>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;">
    <div style="text-align:center;flex:1;min-width:90px;max-width:140px;">
      <img src="{{ product.featured_image | image_url: width: 240 }}" alt="{{ product.title | escape }}" loading="lazy" width="120" height="120" style="border-radius:8px;width:100%;height:auto;border:2px solid #fff5e6;">
      <div style="font-size:12px;margin-top:6px;font-weight:600;line-height:1.3;">This Toothbrush</div>
      <div style="font-size:13px;color:#12395e;font-weight:700;">{{ product.price | money }}</div>
    </div>
    <div style="font-size:24px;color:#12395e;font-weight:700;">+</div>
    <div style="text-align:center;flex:1;min-width:90px;max-width:140px;">
      <a href="{{ tp.url }}" style="text-decoration:none;color:inherit;">
        <img src="{{ tp.featured_image | image_url: width: 240 }}" alt="{{ tp.title | escape }}" loading="lazy" width="120" height="120" style="border-radius:8px;width:100%;height:auto;">
        <div style="font-size:12px;margin-top:6px;font-weight:600;line-height:1.3;">Strawberry Foam Toothpaste</div>
        <div style="font-size:13px;color:#12395e;font-weight:700;">{{ tp.price | money }}</div>
      </a>
    </div>
    <div style="font-size:24px;color:#12395e;font-weight:700;">+</div>
    <div style="text-align:center;flex:1;min-width:90px;max-width:140px;">
      <a href="{{ hd.url }}" style="text-decoration:none;color:inherit;">
        <img src="{{ hd.featured_image | image_url: width: 240 }}" alt="{{ hd.title | escape }}" loading="lazy" width="120" height="120" style="border-radius:8px;width:100%;height:auto;">
        <div style="font-size:12px;margin-top:6px;font-weight:600;line-height:1.3;">Replacement Heads</div>
        <div style="font-size:13px;color:#12395e;font-weight:700;">{{ hd.price | money }}</div>
      </a>
    </div>
  </div>
  <div style="margin-top:18px;padding:14px;background:#fff5e6;border-radius:8px;text-align:center;">
    <form action="/cart/add" method="post" style="margin:0;">
      <input type="hidden" name="id" value="{{ product.selected_or_first_available_variant.id }}">
      <input type="hidden" name="items[][id]" value="{{ tp.selected_or_first_available_variant.id }}">
      <input type="hidden" name="items[][id]" value="{{ hd.selected_or_first_available_variant.id }}">
      <div style="font-size:22px;font-weight:700;color:#12395e;margin:4px 0;">Bundle Total: {{ bundle_total | money }}</div>
      <button type="submit" style="margin-top:10px;padding:14px 28px;background:#12395e;color:#fff5e6;border:none;border-radius:8px;font-weight:600;font-size:15px;cursor:pointer;">Add All to Cart →</button>
    </form>
  </div>
</div>
{%- endif -%}`;
  
  const md = (snippet.match(/\]\(http/g) || []).length;
  const opens = (snippet.match(/\{%-?\s*(if|for|unless|case)/g) || []).length;
  const closes = (snippet.match(/\{%-?\s*(endif|endfor|endunless|endcase)/g) || []).length;
  const oExpr = (snippet.match(/\{\{/g) || []).length;
  const cExpr = (snippet.match(/\}\}/g) || []).length;
  
  console.log('\nValidation:');
  console.log('  Markdown corruption:', md, '(must be 0)');
  console.log('  Liquid blocks:', opens, '/', closes);
  console.log('  Liquid expressions:', oExpr, '/', cExpr);
  
  if (md > 0 || opens !== closes || oExpr !== cExpr) { console.log('❌ FAILED'); process.exit(1); }
  
  fs.writeFileSync('theme-files/snippets/product-fbt.liquid', snippet);
  console.log(`\n✅ Snippet written: ${snippet.length} bytes`);
})();
