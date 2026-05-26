require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');

const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';
const SNIPPET = 'theme-files/snippets/product-faq-schema.liquid';
const TS = Date.now();

console.log('\n🚀 @builder-2 — FAQ Schema (5 products)\n' + '='.repeat(55));

if (fs.existsSync(SNIPPET)) fs.copyFileSync(SNIPPET, `${SNIPPET}.PRE-${TS}.bak`);

// Read existing toothbrush block
const existing = fs.existsSync(SNIPPET) ? fs.readFileSync(SNIPPET, 'utf8') : '';

const NEW_BLOCKS = `
{%- elsif product.handle == 'magnetic-gym-bag-uae-gymgear-tiptop360' -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {"@type":"Question","name":"What is the best magnetic gym bag in UAE?","acceptedAnswer":{"@type":"Answer","text":"The GymGear™ by TipTop360 is the only UAE-branded magnetic gym bag. It attaches hands-free to any metal surface, includes a wet/dry compartment, and costs AED 150 with free next-day delivery across UAE."}},
    {"@type":"Question","name":"How does a magnetic gym bag attach?","acceptedAnswer":{"@type":"Answer","text":"Built-in neodymium magnets allow the bag to attach to any stable metal surface — gym racks, lockers, or benches — keeping your gear off dirty floors. No hooks or straps needed."}},
    {"@type":"Question","name":"Where can I buy a magnetic gym bag in Dubai?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. Free next-day delivery to Dubai and all UAE Emirates. Cash on Delivery available. AED 150."}},
    {"@type":"Question","name":"Is the magnetic gym bag suitable for outdoor use in UAE?","acceptedAnswer":{"@type":"Answer","text":"Yes. Weatherproof materials make it ideal for outdoor workouts, hiking, and UAE summer conditions."}},
    {"@type":"Question","name":"Can I pay cash on delivery for the gym bag?","acceptedAnswer":{"@type":"Answer","text":"Yes. Cash on Delivery is available for the GymGear™ Magnetic Gym Bag across all UAE Emirates including Dubai, Abu Dhabi, and Sharjah."}}
  ]
}
</script>

{%- elsif product.handle == 'kids-strawberry-foam-toothpaste-uae-approved' -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {"@type":"Question","name":"Is kids foam toothpaste safe in UAE?","acceptedAnswer":{"@type":"Answer","text":"Yes. TipTop360's Strawberry Foam Toothpaste is Dubai Municipality approved, fluoride-safe for ages 2+, and made from food-grade ingredients. It is BPA-free and compliant with UAE health regulations."}},
    {"@type":"Question","name":"What is the best kids toothpaste for a U-shaped toothbrush?","acceptedAnswer":{"@type":"Answer","text":"Foam toothpaste designed for U-shaped brushes spreads instantly across all tooth surfaces. TipTop360's strawberry foam formula is specifically designed for this purpose and pairs perfectly with the Kids U-Shaped Electric Toothbrush."}},
    {"@type":"Question","name":"Where to buy kids foam toothpaste in UAE?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. AED 29. Free delivery to Dubai, Abu Dhabi, Sharjah, and all Emirates. Cash on Delivery available."}},
    {"@type":"Question","name":"What age is the strawberry foam toothpaste for?","acceptedAnswer":{"@type":"Answer","text":"The toothpaste is safe for children aged 2 and above. The fluoride level is calibrated specifically for young children and has been approved by Dubai Municipality."}}
  ]
}
</script>

{%- elsif product.handle == 'experience-the-magic-smoke-bubble-machine' -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {"@type":"Question","name":"What is a smoke bubble machine?","acceptedAnswer":{"@type":"Answer","text":"A smoke bubble machine creates bubbles filled with water vapor, producing a glowing misty effect. The smoke effect is completely safe for children — no chemicals, just water vapor. Ideal for parties, birthdays, and indoor play."}},
    {"@type":"Question","name":"Is the smoke bubble machine safe for kids in UAE?","acceptedAnswer":{"@type":"Answer","text":"Yes. The smoke effect is created using gentle water vapor — no chemicals or harmful substances. The TipTop360 Smoke Bubble Machine is Dubai Municipality compliant and safe for children of all ages."}},
    {"@type":"Question","name":"Where to buy smoke bubble machine in UAE?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. AED 99 with free next-day delivery to Dubai, Abu Dhabi, Sharjah, and all UAE Emirates. Cash on Delivery available."}},
    {"@type":"Question","name":"Is it a good birthday gift for kids in Dubai?","acceptedAnswer":{"@type":"Answer","text":"Yes. The Smoke Bubble Machine is one of TipTop360's best-selling birthday gifts in UAE. It delivers next day to Dubai and all Emirates with Cash on Delivery."}},
    {"@type":"Question","name":"How long does the bubble machine last per charge?","acceptedAnswer":{"@type":"Answer","text":"The machine runs continuously during play sessions and is designed for repeated use. It uses standard batteries for power. Contact TipTop360 on WhatsApp +971 58 515 6033 for specific battery life queries."}}
  ]
}
</script>

{%- elsif product.handle == 'kids-drawing-robot' -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {"@type":"Question","name":"Where can I buy a kids drawing robot in Dubai?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. Free next-day delivery to Dubai. Cash on Delivery. AED 110. The Kids Drawing Robot is Dubai Municipality approved and in stock for immediate dispatch."}},
    {"@type":"Question","name":"What age is the drawing robot for?","acceptedAnswer":{"@type":"Answer","text":"Ages 3 to 10. No apps or screens needed. The robot draws step-by-step and children follow along at their own pace. It is suitable for toddlers with adult guidance and independent use from age 5."}},
    {"@type":"Question","name":"Is the drawing robot a good STEM toy for UAE kids?","acceptedAnswer":{"@type":"Answer","text":"Yes. The Kids Drawing Robot develops fine motor skills, hand-eye coordination, and step-by-step instruction following — all core STEM skills aligned with the UAE school curriculum. It is 100% screen-free."}},
    {"@type":"Question","name":"How many drawing templates does the robot have?","acceptedAnswer":{"@type":"Answer","text":"The Kids Drawing Robot comes with 100+ drawing templates covering animals, vehicles, shapes, and more. New templates can be introduced to keep children engaged over time."}},
    {"@type":"Question","name":"Can I pay cash on delivery for the drawing robot in UAE?","acceptedAnswer":{"@type":"Answer","text":"Yes. Cash on Delivery is available for the Kids Drawing Robot across all UAE Emirates. AED 110. Free next-day delivery to Dubai, Abu Dhabi, Sharjah, and Ajman."}}
  ]
}
</script>

{%- elsif product.handle == 'ai-voice-recorder' -%}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {"@type":"Question","name":"What is the best AI voice recorder in UAE?","acceptedAnswer":{"@type":"Answer","text":"The TipTop360 AI Voice Recorder transcribes in 57 languages, has 20+ hour battery life, and is available in Dubai with next-day delivery and Cash on Delivery. AED 299. It uses GPT-4 powered summaries for meetings and lectures."}},
    {"@type":"Question","name":"Where to buy an AI voice recorder in Dubai?","acceptedAnswer":{"@type":"Answer","text":"At tiptop360.com. Free next-day delivery to Dubai, Abu Dhabi, Sharjah, and all UAE Emirates. Cash on Delivery available. AED 299. UAE-based stock."}},
    {"@type":"Question","name":"Does the AI voice recorder work without an app?","acceptedAnswer":{"@type":"Answer","text":"The recorder has standalone recording functionality and can capture audio without an app or internet connection. AI transcription and GPT-4 summaries use a companion app when connected."}},
    {"@type":"Question","name":"How many languages does the AI voice recorder support?","acceptedAnswer":{"@type":"Answer","text":"The AI Voice Recorder transcribes in 57 languages including Arabic, English, French, Hindi, and more — making it ideal for multilingual UAE business environments."}},
    {"@type":"Question","name":"How long is the battery life on the AI voice recorder?","acceptedAnswer":{"@type":"Answer","text":"The AI Voice Recorder has 20+ hours of continuous recording battery life — sufficient for a full week of daily meetings without recharging."}}
  ]
}
</script>`;

// Rebuild snippet — inject new blocks before the {%- endif -%}
let updatedSnippet = existing.replace(
  '{%- endif -%}',
  NEW_BLOCKS + '\n{%- endif -%}'
);

// If snippet doesn't exist yet (no toothbrush block), wrap fully
if (!existing.includes('FAQPage')) {
  updatedSnippet = `{%- comment -%} FAQPage JSON-LD — per product handle {%- endcomment -%}
{%- if product.handle == 'kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift' -%}
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Is the Kids U-Shaped Electric Toothbrush safe for toddlers under 3?","acceptedAnswer":{"@type":"Answer","text":"Yes, designed for ages 2+. BPA-free silicone and gentle vibration are safe. Supervise toddlers under 3."}}]}
</script>
${NEW_BLOCKS}
{%- endif -%}`;
}

// Corruption check
const corruption = updatedSnippet.match(/\[[a-z_]+\.[a-z_]+(?:\.[a-z_]+)*\]\(http:\/\/[a-z_]+\.[a-z_]+/g) || [];
if (corruption.length) {
  console.log('❌ Corruption detected — aborting');
  process.exit(1);
}

// Liquid balance check
const opens  = (updatedSnippet.match(/\{%-?\s*(if|elsif|unless|case|for)\b/g) || []).length;
const closes = (updatedSnippet.match(/\{%-?\s*(endif|endunless|endcase|endfor)\b/g) || []).length;
if (opens !== closes) {
  console.log(`❌ Liquid imbalance: ${opens} opens vs ${closes} closes`);
  process.exit(1);
}

console.log('✅ Corruption check passed');
console.log('✅ Liquid balance check passed');

fs.writeFileSync(SNIPPET, updatedSnippet);
console.log('✅ Snippet written with 6 product FAQ blocks');

// Push
console.log('\n📤 Pushing FAQ schema snippet...');
try {
  execSync(
    `shopify theme push --store ${STORE} --theme ${THEME} --path ./theme-files ` +
    `--only snippets/product-faq-schema.liquid --allow-live`,
    { stdio: 'inherit', cwd: '/Users/rabiharabi/tiptop360-optimizer' }
  );
  console.log('\n✅ @builder-2 COMPLETE — FAQ schema live on all 6 products');
} catch(e) {
  fs.copyFileSync(`${SNIPPET}.PRE-${TS}.bak`, SNIPPET);
  console.log('❌ Push failed — rolled back');
  process.exit(1);
}
