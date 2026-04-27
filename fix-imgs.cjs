const fs = require('fs');
const files = [
  'theme-files/templates/index.json',
  'theme-files/templates/collection.kids-collection.json',
  'theme-files/templates/cart.json',
  'theme-files/templates/product.gymbag.json',
  'theme-files/templates/product.tab-accordion-products.json'
];

const oldWebp = '<img src=\\"https://cdn.shopify.com/s/files/1/0644/0822/3859/files/Tiptop360trusted_online_shop_UAE.webp\\" alt=\\"Tiptop360 Trusted Online Shop UAE\\" style=\\"width: 100%; height: auto; display: block; max-width: 100%; border-radius: 8px;\\">';
const oldJpg = '<img src=\\"https://tiptop360.com/cdn/shop/files/Tiptop360trusted_online_shop_UAE.jpg\\" alt=\\"Tiptop360 Trusted Online Shop UAE\\" style=\\"width: 100%; height: auto; display: block; max-width: 100%; border-radius: 8px;\\">';

const newWebp = '<img src=\\"https://cdn.shopify.com/s/files/1/0644/0822/3859/files/Tiptop360trusted_online_shop_UAE.webp?width=600\\" srcset=\\"https://cdn.shopify.com/s/files/1/0644/0822/3859/files/Tiptop360trusted_online_shop_UAE.webp?width=400 400w, https://cdn.shopify.com/s/files/1/0644/0822/3859/files/Tiptop360trusted_online_shop_UAE.webp?width=600 600w, https://cdn.shopify.com/s/files/1/0644/0822/3859/files/Tiptop360trusted_online_shop_UAE.webp?width=900 900w\\" sizes=\\"(max-width: 768px) 90vw, 600px\\" alt=\\"Tiptop360 Trusted Online Shop UAE\\" loading=\\"lazy\\" decoding=\\"async\\" width=\\"600\\" height=\\"600\\" style=\\"width: 100%; height: auto; display: block; max-width: 600px; margin: 0 auto; border-radius: 8px;\\">';

const newJpg = '<img src=\\"https://tiptop360.com/cdn/shop/files/Tiptop360trusted_online_shop_UAE.jpg?width=600\\" srcset=\\"https://tiptop360.com/cdn/shop/files/Tiptop360trusted_online_shop_UAE.jpg?width=400 400w, https://tiptop360.com/cdn/shop/files/Tiptop360trusted_online_shop_UAE.jpg?width=600 600w, https://tiptop360.com/cdn/shop/files/Tiptop360trusted_online_shop_UAE.jpg?width=900 900w\\" sizes=\\"(max-width: 768px) 90vw, 600px\\" alt=\\"Tiptop360 Trusted Online Shop UAE\\" loading=\\"lazy\\" decoding=\\"async\\" width=\\"600\\" height=\\"600\\" style=\\"width: 100%; height: auto; display: block; max-width: 600px; margin: 0 auto; border-radius: 8px;\\">';

let totalReplaced = 0;
files.forEach(f => {
  if (!fs.existsSync(f)) { console.log('MISSING:', f); return; }
  let c = fs.readFileSync(f, 'utf8');
  const before = c.length;
  const wcount = (c.match(new RegExp(oldWebp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  const jcount = (c.match(new RegExp(oldJpg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  c = c.split(oldWebp).join(newWebp);
  c = c.split(oldJpg).join(newJpg);
  fs.writeFileSync(f, c);
  totalReplaced += wcount + jcount;
  console.log(f, `webp:${wcount} jpg:${jcount} bytes:${before}->${c.length}`);
});
console.log('Total replacements:', totalReplaced);
