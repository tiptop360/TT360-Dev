require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');

const SNIPPET = 'theme-files/snippets/product-faq-schema.liquid';
const TEMPLATE = 'theme-files/sections/product-template-1.liquid';
const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';

console.log('🚀 FAQPage Schema Deploy\n' + '='.repeat(50));

// [1] Backup
const TS = Date.now();
if (fs.existsSync(SNIPPET)) fs.copyFileSync(SNIPPET, `${SNIPPET}.PRE-${TS}.bak`);
if (fs.existsSync(TEMPLATE)) fs.copyFileSync(TEMPLATE, `${TEMPLATE}.PRE-${TS}.bak`);

// [2] Write FAQPage snippet
const snippet = `{%- comment -%} FAQPage JSON-LD — per product handle {%- endcomment -%}
{%- if product.handle == 'kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift' -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is the Kids U-Shaped Electric Toothbrush safe for toddlers under 3?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, it is designed specifically for ages 2 and up. The soft BPA-free silicone and gentle vibration are safe for sensitive gums and emerging teeth. Toddlers under 3 should brush with adult supervision."
      }
    },
    {
      "@type": "Question",
      "name": "How does the U-shaped toothbrush compare to a regular manual toothbrush?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The U-shaped design covers all tooth surfaces simultaneously — front, back, and biting surfaces — in just 60 seconds. A manual toothbrush requires multiple angles and strokes and relies on the child's technique, which is often inconsistent."
      }
    },
    {
      "@type": "Question",
      "name": "Is this toothbrush suitable for a 10-year-old?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. The toothbrush works for children aged 2 to 12. The 7-12 age variant is sized for older children. The 60-second auto-cycle fits busy routines and keeps older kids consistent with brushing."
      }
    },
    {
      "@type": "Question",
      "name": "How often should I replace the U-shaped brush head?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Replace the brush head every 2 to 3 months, or sooner if the silicone looks cloudy, warped, or worn. TipTop360 stocks replacement heads for this model with free UAE delivery."
      }
    },
    {
      "@type": "Question",
      "name": "Does TipTop360 deliver to Abu Dhabi, Sharjah, and Ajman?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. TipTop360 offers free delivery across all Emirates including Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, and Fujairah. Orders placed before 5 PM are delivered the next day."
      }
    }
  ]
}
</script>
{%- endif -%}`;

// [3] Corruption check
const corruption = snippet.match(/\[[a-z_]+\.[a-z_]+(?:\.[a-z_]+)*\]\(http:\/\/[a-z_]+\.[a-z_]+/g) || [];
if (corruption.length) { console.log('❌ Corruption detected'); process.exit(1); }
console.log('✅ Corruption check passed');

// [4] Write snippet
fs.writeFileSync(SNIPPET, snippet);
console.log('✅ Snippet written:', SNIPPET);

// [5] Wire into product template if not already present
let template = fs.readFileSync(TEMPLATE, 'utf8');
if (!template.includes("'product-faq-schema'")) {
  template = template.replace(
    "{% unless product == empty %}",
    "{%- render 'product-faq-schema' -%}\n{% unless product == empty %}"
  );
  fs.writeFileSync(TEMPLATE, template);
  console.log('✅ Wired into product-template-1.liquid');
} else {
  console.log('✅ Already wired in template — skipping');
}

// [6] Push both files
console.log('\n📤 Pushing to theme...');
try {
  execSync(
    `shopify theme push --store ${STORE} --theme ${THEME} --path ./theme-files ` +
    `--only snippets/product-faq-schema.liquid ` +
    `--only sections/product-template-1.liquid ` +
    `--allow-live`,
    { stdio: 'inherit', cwd: '/Users/rabiharabi/tiptop360-optimizer' }
  );
} catch(e) {
  console.log('❌ Push failed — rolling back');
  if (fs.existsSync(`${SNIPPET}.PRE-${TS}.bak`)) fs.copyFileSync(`${SNIPPET}.PRE-${TS}.bak`, SNIPPET);
  if (fs.existsSync(`${TEMPLATE}.PRE-${TS}.bak`)) fs.copyFileSync(`${TEMPLATE}.PRE-${TS}.bak`, TEMPLATE);
  process.exit(1);
}

// [7] Verify
console.log('\n⏳ Waiting 30s for cache...');
setTimeout(async () => {
  const fetch = (...a) => import('node-fetch').then(({default:f}) => f(...a));
  const html = await (await fetch(
    'https://tiptop360.com/products/kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift?x=' + Date.now()
  )).text();
  const ok = html.includes('FAQPage');
  console.log(ok ? '✅ FAQPage schema verified live' : '⚠️  Not yet visible — Cloudflare cache, check in 5 min');
  if (ok) console.log('\n✅ Deploy complete — run regression to confirm');
}, 30000);
