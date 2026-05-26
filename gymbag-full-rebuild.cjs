
require('dotenv').config();
const fs   = require('fs');
const { execSync } = require('child_process');

const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';
const ROOT  = '/Users/rabiharabi/tiptop360-optimizer';
const FILE  = ROOT + '/theme-files/sections/gymbag-pdp.liquid';
const TMPL  = ROOT + '/theme-files/templates/product.gymbag.json';
const TS    = Date.now();

// Backup
if (fs.existsSync(FILE)) fs.copyFileSync(FILE, FILE + '.PRE-REBUILD-' + TS + '.bak');
fs.mkdirSync(ROOT + '/theme-files/templates', { recursive: true });

// Write template JSON
fs.writeFileSync(TMPL, JSON.stringify({
  sections: { main: { type: 'gymbag-pdp', settings: {} } },
  order: ['main']
}, null, 2));

// Safe character references — never inline operators that zsh or markdown corrupt
const GT  = String.fromCharCode(62);   // >
const LT  = String.fromCharCode(60);   // 
const AMP = String.fromCharCode(38);   // &
const OB  = String.fromCharCode(123) + '%';   // {%
const CB  = '%' + String.fromCharCode(125);   // %}
const OBD = String.fromCharCode(123) + '%-';  // {%-
const CBD = '-%' + String.fromCharCode(125);  // -%}
const OV  = String.fromCharCode(123,123);     // {{
const CV  = String.fromCharCode(125,125);     // }}

const lv  = v  => OV + ' ' + v + ' ' + CV;
const lb  = v  => OB + ' ' + v + ' ' + CB;
const lbm = v  => OBD + ' ' + v + ' ' + CBD;
const ss  = id => OV + ' section.settings.' + id + ' ' + CV;
const bs  = id => OV + ' block.settings.' + id + ' ' + CV;

// Schema object
const SCHEMA = {
  name: 'GymBag PDP', tag: 'div', class: 'gymbag-section',
  settings: [
    { type: 'header', content: 'Top Bar' },
    { type: 'text', id: 'urgent_text', label: 'Urgency bar text',
      default: 'LIMITED TIME - 50% OFF - AED 110 ONLY - FREE UAE DELIVERY' },
    { type: 'header', content: 'Product Identity' },
    { type: 'text', id: 'cat_label', label: 'Category label', default: 'GymGear - Magnetic Gym Bag Dubai' },
    { type: 'text', id: 'heading_italic', label: 'Headline italic line', default: 'Hands-Free.' },
    { type: 'text', id: 'heading_line2', label: 'Headline line 2', default: 'Never Drop' },
    { type: 'text', id: 'heading_line3', label: 'Headline line 3', default: 'Your Bag Again.' },
    { type: 'textarea', id: 'subtitle', label: 'Subtitle',
      default: 'The magnetic gym bag that snaps to any metal rack, locker, or bench. No more floor. Built for Dubai athletes.' },
    { type: 'header', content: 'Social Proof' },
    { type: 'text', id: 'review_score', label: 'Review score', default: '4.8' },
    { type: 'text', id: 'review_count', label: 'Review count', default: '67' },
    { type: 'text', id: 'sold_today', label: 'Sold today badge', default: '28 sold today' },
    { type: 'header', content: 'Price' },
    { type: 'text', id: 'price_note', label: 'Price note', default: 'Limited time offer - Free UAE delivery - Includes VAT' },
    { type: 'header', content: 'Magnetic Feature Box' },
    { type: 'text', id: 'mag_label', label: 'Box label', default: 'The GymGear Advantage' },
    { type: 'text', id: 'mag_heading', label: 'Heading', default: 'Snap. Hang.' },
    { type: 'text', id: 'mag_heading_em', label: 'Heading italic part', default: 'Train.' },
    { type: 'text', id: 'step1_icon', label: 'Step 1 icon', default: '\U0001f9f2' },
    { type: 'text', id: 'step1_word', label: 'Step 1 word', default: 'Snap' },
    { type: 'text', id: 'step1_desc', label: 'Step 1 desc', default: 'Attach to any metal surface' },
    { type: 'text', id: 'step2_icon', label: 'Step 2 icon', default: '\U0001f3cb' },
    { type: 'text', id: 'step2_word', label: 'Step 2 word', default: 'Hang' },
    { type: 'text', id: 'step2_desc', label: 'Step 2 desc', default: 'Rack, locker, bench' },
    { type: 'text', id: 'step3_icon', label: 'Step 3 icon', default: '\u26a1' },
    { type: 'text', id: 'step3_word', label: 'Step 3 word', default: 'Train' },
    { type: 'text', id: 'step3_desc', label: 'Step 3 desc', default: 'Focus on the workout' },
    { type: 'header', content: 'Stock' },
    { type: 'checkbox', id: 'show_stock', label: 'Show stock line', default: true },
    { type: 'header', content: 'Stats' },
    { type: 'text', id: 'stat1_num', label: 'Stat 1 number', default: '360' },
    { type: 'text', id: 'stat1_lbl', label: 'Stat 1 label', default: 'Degree magnetic grip' },
    { type: 'text', id: 'stat2_num', label: 'Stat 2 number', default: 'UAE' },
    { type: 'text', id: 'stat2_lbl', label: 'Stat 2 label', default: 'Heat-tested design' },
    { type: 'text', id: 'stat3_num', label: 'Stat 3 number', default: '67+' },
    { type: 'text', id: 'stat3_lbl', label: 'Stat 3 label', default: 'Verified UAE reviews' },
    { type: 'header', content: 'Section Headings' },
    { type: 'text', id: 'features_title', label: 'Features title', default: 'What You Get' },
    { type: 'text', id: 'compare_title', label: 'Comparison title', default: 'GymGear vs Regular Gym Bag' },
    { type: 'text', id: 'compare_col1', label: 'Compare col 1', default: 'Feature' },
    { type: 'text', id: 'compare_col2', label: 'Compare col 2 yours', default: 'GymGear' },
    { type: 'text', id: 'compare_col3', label: 'Compare col 3 theirs', default: 'Regular Bag' },
    { type: 'text', id: 'reviews_title', label: 'Reviews title', default: 'Customer Reviews' },
    { type: 'text', id: 'faq_title', label: 'FAQ title', default: 'Questions' },
    { type: 'header', content: 'Guarantee' },
    { type: 'text', id: 'guarantee_title', label: 'Guarantee title', default: '14-Day Guarantee' },
    { type: 'textarea', id: 'guarantee_text', label: 'Guarantee body',
      default: 'Try GymGear risk-free for 14 days. Not the upgrade you expected? Full refund, no questions asked.' },
    { type: 'header', content: 'Final CTA' },
    { type: 'text', id: 'final_line1', label: 'Final heading line 1', default: 'Stop Dropping' },
    { type: 'text', id: 'final_line2', label: 'Final heading line 2', default: 'Your Bag.' },
    { type: 'text', id: 'final_italic', label: 'Final heading italic', default: 'Train Smarter.' },
    { type: 'textarea', id: 'final_subtext', label: 'Final subtext',
      default: 'AED 110 - 50% OFF - Free UAE Delivery - Cash on Delivery - 14-Day Guarantee' },
    { type: 'header', content: 'Contact' },
    { type: 'text', id: 'whatsapp', label: 'WhatsApp number', default: '971585156033' },
    { type: 'text', id: 'secure_text', label: 'Secure checkout line',
      default: 'SSL encrypted - Apple Pay - Cards - Secure checkout' },
    { type: 'text', id: 'sticky_name', label: 'Sticky bar name', default: 'GymGear - Black and Gray' }
  ],
  blocks: [
    { type: 'trust_pill', name: 'Trust Pill',
      settings: [{ type: 'text', id: 'text', label: 'Pill text', default: 'Hands-Free Magnetic' }] },
    { type: 'feature', name: 'Feature', settings: [
      { type: 'text', id: 'icon', label: 'Icon emoji', default: '\U0001f9f2' },
      { type: 'text', id: 'title', label: 'Title', default: 'Feature title' },
      { type: 'textarea', id: 'body', label: 'Description', default: 'Feature description.' }
    ]},
    { type: 'compare_row', name: 'Comparison Row', settings: [
      { type: 'text', id: 'feature', label: 'Feature name', default: 'Attaches to metal' },
      { type: 'text', id: 'gymbag', label: 'GymGear value', default: 'Magnetic snap' },
      { type: 'text', id: 'regular', label: 'Regular bag value', default: 'Floor or shoulder' },
      { type: 'checkbox', id: 'positive', label: 'Highlight green', default: true }
    ]},
    { type: 'review', name: 'Review', settings: [
      { type: 'textarea', id: 'text', label: 'Review text', default: 'Amazing product.' },
      { type: 'text', id: 'name', label: 'Name', default: 'Ahmed S.' },
      { type: 'text', id: 'location', label: 'Location', default: 'Dubai' },
      { type: 'text', id: 'letter', label: 'Avatar letter', default: 'A' },
      { type: 'color', id: 'color', label: 'Avatar color', default: '#54e8cc' }
    ]},
    { type: 'faq', name: 'FAQ Item', settings: [
      { type: 'text', id: 'question', label: 'Question', default: 'Your question here?' },
      { type: 'textarea', id: 'answer', label: 'Answer', default: 'Your answer here.' }
    ]}
  ],
  presets: [{ name: 'GymBag PDP', blocks: [
    { type: 'trust_pill', settings: { text: 'Hands-Free Magnetic' } },
    { type: 'trust_pill', settings: { text: 'Next-Day Delivery' } },
    { type: 'trust_pill', settings: { text: 'Cash on Delivery' } },
    { type: 'trust_pill', settings: { text: 'Weatherproof' } },
    { type: 'trust_pill', settings: { text: '14-Day Returns' } },
    { type: 'trust_pill', settings: { text: 'Free Delivery' } },
    { type: 'trust_pill', settings: { text: 'UAE Stock' } },
    { type: 'feature', settings: { icon: '\U0001f9f2', title: 'Hands-Free Magnetic System',
      body: 'Industrial magnets snap to any metal rack, locker, or bench. Always accessible, always off the floor.' } },
    { type: 'feature', settings: { icon: '\U0001f327', title: 'Weatherproof UAE Heat-Ready',
      body: 'Sweat-resistant shell for Dubai outdoor gyms and pools. Handles UAE summer heat. Wipes clean in seconds.' } },
    { type: 'feature', settings: { icon: '\U0001f9ca', title: 'Built-In Bottle Holder',
      body: 'Dedicated compartment keeps your water bottle upright and accessible without fumbling.' } },
    { type: 'feature', settings: { icon: '\U0001f4f1', title: 'Quick-Access Pockets',
      body: 'Phone, keys, AirPods all reachable without digging. Designed for athletes between sets.' } },
    { type: 'feature', settings: { icon: '\u26a1', title: 'Compact Black and Gray',
      body: 'Takes no space in your locker or car. Both colors same magnetic strength. Order both in one click.' } },
    { type: 'compare_row', settings: { feature: 'Attaches to metal', gymbag: 'Magnetic snap', regular: 'Floor or shoulder', positive: true } },
    { type: 'compare_row', settings: { feature: 'Hands-free access', gymbag: 'Always', regular: 'Shoulder only', positive: true } },
    { type: 'compare_row', settings: { feature: 'UAE weatherproof', gymbag: 'Tested', regular: 'Varies', positive: true } },
    { type: 'compare_row', settings: { feature: 'Bottle holder', gymbag: 'Built-in', regular: 'Usually none', positive: true } },
    { type: 'compare_row', settings: { feature: 'Free next-day UAE', gymbag: 'COD available', regular: '-', positive: true } },
    { type: 'compare_row', settings: { feature: '50% limited offer', gymbag: 'AED 110 now', regular: '-', positive: false } },
    { type: 'review', settings: { text: 'Changed my entire gym routine. Now it just snaps to the rack. Zero thought. Pure focus.',
      name: 'Ahmed S.', location: 'Personal Trainer - Dubai', letter: 'A', color: '#54e8cc' } },
    { type: 'review', settings: { text: 'Works perfectly on the squat rack. Ordered Black and Gray together. Next-day COD. Perfect.',
      name: 'Mohammed R.', location: 'Gym Member - Sharjah', letter: 'M', color: '#ff4d00' } },
    { type: 'review', settings: { text: 'Train outdoors in UAE heat. This bag handles everything. 2 bags in one order, arrived next morning.',
      name: 'Sara H.', location: 'CrossFit - Abu Dhabi', letter: 'S', color: '#439b94' } },
    { type: 'faq', settings: { question: 'Does the magnetic system work on all gym equipment?',
      answer: 'Yes. GymGear attaches to any ferromagnetic metal surface including squat racks, cable machines, bench frames, and locker doors.' } },
    { type: 'faq', settings: { question: 'Can I order both Black and Gray in one order?',
      answer: 'Yes. Use the quantity selectors to choose how many of each color. Both are added to your cart in one order with free next-day UAE delivery.' } },
    { type: 'faq', settings: { question: 'Is it suitable for outdoor workouts in UAE heat?',
      answer: 'Absolutely. Sweat-resistant and weatherproof for UAE outdoor gyms and pool conditions.' } },
    { type: 'faq', settings: { question: 'Can I pay Cash on Delivery?',
      answer: 'Yes across all UAE Emirates. AED 110 per bag. Order before 5pm for next-day delivery.' } },
    { type: 'faq', settings: { question: 'How long does the 50% off offer last?',
      answer: 'This is a limited-time promotion. Regular price is AED 220. AED 110 is only guaranteed while this offer is active.' } },
    { type: 'faq', settings: { question: 'What is the 14-day guarantee?',
      answer: 'Return GymGear for any reason within 14 days for a full refund. No questions asked. Returns processed within 48 hours.' } }
  ]}]
};

// Build the section line by line
const L = [];
const a = l => L.push(l);

a(lbm('comment') + ' GymBag PDP - Dynamic Schema Section - ' + new Date().toISOString().slice(0,10) + ' ' + lbm('endcomment'));
a(lbm('assign black_v = product.variants | where: "title", "Black" | first'));
a(lbm('assign gray_v  = product.variants | where: "title", "Gray"  | first'));
// GT used here — the key fix — no inline > in source
a(lbm('assign sale = product.compare_at_price ' + GT + ' product.price'));
a(lbm('assign pct  = product.compare_at_price | minus: product.price | times: 100 | divided_by: product.compare_at_price'));
a('');
a('<link rel="preconnect" href="https://fonts.googleapis.com">');
a('<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,700;1,900&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">');
a('');
a('<style>');
a('.gymbag-pdp *{box-sizing:border-box;margin:0;padding:0}');
a('.gymbag-pdp{--navy:#12395e;--dark:#0a1f36;--mint:#54e8cc;--teal:#439b94;--cream:#fff5e6;--white:#fff;--border:rgba(18,57,94,.09);--ink:rgba(18,57,94,1);--ink2:rgba(18,57,94,.55);--ink3:rgba(18,57,94,.3);--fire:#ff4d00;--gold:#e8b84b;font-family:Inter,-apple-system,sans-serif;background:#f2f2f0;color:var(--ink);max-width:480px;margin:0 auto;padding-bottom:80px;-webkit-font-smoothing:antialiased}');
a('@keyframes gb-fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes gb-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}@keyframes gb-dp{0%,100%{opacity:.5}50%{opacity:1}}@keyframes gb-ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes gb-shine{0%{left:-100%}100%{left:200%}}');
a('.gb-f1{animation:gb-fadeUp .5s ease .05s both}.gb-f2{animation:gb-fadeUp .5s ease .15s both}.gb-f3{animation:gb-fadeUp .5s ease .25s both}.gb-f4{animation:gb-fadeUp .5s ease .35s both}');
a('.gb-urgent{background:var(--fire);color:#fff;text-align:center;padding:9px 12px;font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;position:relative;overflow:hidden}');
a('.gb-urgent::after{content:"";position:absolute;top:0;left:-100%;width:40%;height:100%;background:rgba(255,255,255,.2);transform:skewX(-20deg);animation:gb-shine 2.5s linear infinite}');
a('.gb-crumb{padding:10px 20px;font-size:10.5px;color:var(--ink2);background:#f2f2f0;border-bottom:1px solid var(--border)}.gb-crumb a{color:var(--ink2);text-decoration:none}');
a('.gb-ticker-wrap{background:var(--navy);overflow:hidden;padding:7px 0;white-space:nowrap}.gb-ticker-inner{display:inline-flex;animation:gb-ticker 18s linear infinite}');
a('.gb-tick{display:inline-flex;align-items:center;padding:0 22px;font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:600;color:var(--mint);letter-spacing:1px;text-transform:uppercase}');
a('.gb-gallery{background:var(--navy)}.gb-stage{position:relative;height:360px;overflow:hidden;will-change:transform}');
a('.gb-slide{position:absolute;inset:0;opacity:0;transition:opacity .5s ease;pointer-events:none}.gb-slide.active{opacity:1;pointer-events:auto}.gb-slide img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}');
a('.gb-arr{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.15);border:none;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:20px;z-index:10;color:#fff;transition:all .2s;-webkit-tap-highlight-color:transparent}.gb-arr:hover,.gb-arr:active{background:var(--mint);color:var(--navy)}.gb-arr-l{left:12px}.gb-arr-r{right:12px}');
a('.gb-ctr{position:absolute;bottom:14px;right:14px;background:rgba(10,31,54,.7);color:#fff;font-size:11px;letter-spacing:1px;padding:4px 11px;border-radius:20px;z-index:10;font-family:Barlow Condensed,sans-serif;font-weight:600;pointer-events:none}');
a('.gb-sale-badge{position:absolute;top:14px;left:14px;background:var(--fire);color:#fff;font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:900;padding:6px 14px;border-radius:6px;z-index:10;letter-spacing:1px;line-height:1}');
a('.gb-thumbs{display:flex;gap:7px;padding:10px 16px;background:var(--dark);overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.gb-thumbs::-webkit-scrollbar{display:none}');
a('.gb-thumb{width:54px;height:54px;border-radius:6px;overflow:hidden;border:2px solid transparent;cursor:pointer;flex-shrink:0;transition:border-color .2s;-webkit-tap-highlight-color:transparent}.gb-thumb img{width:100%;height:100%;object-fit:cover;display:block}.gb-thumb.on{border-color:var(--mint)}');
a('.gb-info{background:#fff;padding:24px 20px 20px}.gb-cat{font-family:Barlow Condensed,sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--teal);margin-bottom:8px}');
a('.gb-title{font-family:Barlow Condensed,sans-serif;font-size:34px;font-weight:900;line-height:1.05;color:var(--navy);margin-bottom:6px;letter-spacing:-.5px;text-transform:uppercase;font-style:italic}');
a('.gb-sub{font-size:13px;color:var(--ink2);margin-bottom:14px;font-weight:300;line-height:1.55;border-left:3px solid var(--mint);padding:10px 12px;border-radius:0 8px 8px 0;background:rgba(84,232,204,.05)}');
a('.gb-rating{display:flex;align-items:center;gap:8px;margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid var(--border);flex-wrap:wrap}.gb-stars{color:var(--gold);font-size:14px;letter-spacing:1px}.gb-rtxt{font-size:12px;color:var(--ink2)}.gb-sold{background:rgba(255,77,0,.08);color:var(--fire);padding:3px 9px;border-radius:20px;font-size:10.5px;font-weight:700;margin-left:auto;white-space:nowrap;font-family:Barlow Condensed,sans-serif;letter-spacing:.5px}');
a('.gb-price-row{display:flex;align-items:baseline;gap:12px;margin-bottom:6px}.gb-price{font-family:Barlow Condensed,sans-serif;font-size:44px;font-weight:900;color:var(--navy);line-height:1}.gb-price-was{font-size:20px;color:var(--ink3);text-decoration:line-through;font-family:Barlow Condensed,sans-serif}.gb-save-pill{background:var(--fire);color:#fff;font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;padding:4px 11px;border-radius:6px;letter-spacing:.5px}');
a('.gb-price-note{font-size:11px;color:var(--teal);font-weight:600;letter-spacing:.5px;margin-bottom:18px;display:block}');
a('.gb-color-block{margin-bottom:18px}.gb-color-lbl{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink2);margin-bottom:10px}');
a('.gb-variant-row{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;border:2px solid var(--border);background:#fff;margin-bottom:8px;transition:border-color .2s,background .2s}.gb-variant-row.has-qty{border-color:var(--navy);background:rgba(18,57,94,.03)}');
a('.gb-variant-left{display:flex;align-items:center;gap:10px;flex:1;min-width:0}.gb-color-swatch{width:20px;height:20px;border-radius:50%;flex-shrink:0;border:2px solid rgba(0,0,0,.12)}.gb-variant-name{font-size:13px;font-weight:600;color:var(--ink)}.gb-variant-stock{font-size:10px;color:var(--ink3);margin-top:1px}');
a('.gb-qty-ctrl{display:flex;align-items:center;border:1.5px solid var(--border);border-radius:8px;overflow:hidden;flex-shrink:0}.gb-qty-btn{width:36px;height:36px;background:none;border:none;font-size:18px;cursor:pointer;color:var(--navy);display:flex;align-items:center;justify-content:center;transition:background .15s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;-webkit-appearance:none}.gb-qty-btn:hover{background:rgba(18,57,94,.07)}.gb-qty-btn:active{background:rgba(18,57,94,.14)}.gb-qty-num{width:36px;text-align:center;font-weight:700;font-size:15px;color:var(--navy);pointer-events:none}');
a('.gb-total-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0 2px;border-top:1px solid var(--border);margin-top:4px}.gb-total-lbl{font-size:12px;color:var(--ink2);font-weight:500}.gb-total-price{font-family:Barlow Condensed,sans-serif;font-size:22px;font-weight:900;color:var(--navy)}');
a('.gb-magnetic{background:var(--navy);border-radius:14px;padding:18px 16px;margin-bottom:18px}.gb-mag-lbl{font-family:Barlow Condensed,sans-serif;font-size:10px;font-weight:700;letter-spacing:2.5px;color:var(--mint);text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px}.gb-mag-lbl::before{content:"";width:4px;height:4px;background:var(--mint);border-radius:50%;animation:gb-dp 2s infinite}');
a('.gb-mag-h{font-family:Barlow Condensed,sans-serif;font-size:22px;font-weight:900;color:#fff;line-height:1.2;margin-bottom:10px;text-transform:uppercase;font-style:italic}.gb-mag-h em{color:var(--mint)}.gb-mag-steps{display:flex}.gb-mag-step{flex:1;text-align:center;padding:10px 6px;background:rgba(255,255,255,.04);border-right:1px solid rgba(255,255,255,.06)}.gb-mag-step:last-child{border-right:none}.gb-mag-icon{font-size:22px;margin-bottom:5px}.gb-mag-word{font-family:Barlow Condensed,sans-serif;font-size:13px;font-weight:700;color:var(--mint);text-transform:uppercase;letter-spacing:.5px}.gb-mag-desc{font-size:10px;color:rgba(255,255,255,.4);margin-top:2px;line-height:1.3}');
a('.gb-stock{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--teal);font-weight:500;margin-bottom:18px}.gb-sdot{width:7px;height:7px;background:var(--teal);border-radius:50%;animation:gb-dp 2s infinite;display:inline-block;flex-shrink:0}');
a('.gb-btn-buy{display:block;width:100%;background:var(--navy);color:var(--cream);padding:17px;border-radius:10px;border:none;font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;cursor:pointer;transition:background .2s;margin-bottom:10px;-webkit-appearance:none;touch-action:manipulation}.gb-btn-buy:hover,.gb-btn-buy:active{background:var(--teal)}');
a('.gb-btn-cod{display:block;width:100%;background:transparent;color:var(--fire);padding:15px;border-radius:10px;border:2px solid rgba(255,77,0,.3);font-family:Barlow Condensed,sans-serif;font-size:17px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:10px;-webkit-appearance:none;touch-action:manipulation}.gb-btn-cod:hover,.gb-btn-cod:active{background:rgba(255,77,0,.06);border-color:var(--fire)}');
a('.gb-btn-wa{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px;background:transparent;color:var(--ink2);font-size:13px;font-weight:500;text-decoration:none;border-radius:10px;border:1px solid var(--border);transition:all .2s}.gb-btn-wa:hover,.gb-btn-wa:active{border-color:#25D366;color:#25D366}.gb-secure{text-align:center;font-size:11px;color:var(--ink3);margin-top:10px}');
a('.gb-trust{display:flex;gap:8px;overflow-x:auto;padding:14px 20px 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch;background:#fff;border-top:1px solid var(--border)}.gb-trust::-webkit-scrollbar{display:none}.gb-pill{flex-shrink:0;display:flex;align-items:center;gap:6px;background:#f2f2f0;border:1px solid var(--border);border-radius:50px;padding:7px 13px;font-size:11.5px;font-weight:500;color:var(--ink);white-space:nowrap}');
a('.gb-sec{padding:26px 20px;border-top:1px solid var(--border)}.gb-sec-white{background:#fff}.gb-sec-dark{background:var(--navy)}.gb-sec-lbl{font-family:Barlow Condensed,sans-serif;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--ink3);margin-bottom:14px}.gb-sec-lbl-light{color:rgba(255,255,255,.35)}');
a('.gb-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.gb-stat{background:rgba(255,255,255,.05);border:1px solid rgba(84,232,204,.12);border-radius:10px;padding:14px 10px;text-align:center}.gb-stat-n{font-family:Barlow Condensed,sans-serif;font-size:28px;font-weight:900;color:var(--mint);line-height:1}.gb-stat-l{font-size:10px;color:rgba(255,255,255,.5);margin-top:3px;line-height:1.3}');
a('.gb-feats{display:flex;flex-direction:column}.gb-feat{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--border)}.gb-feat:last-child{border-bottom:none}.gb-ficon{width:40px;height:40px;border-radius:10px;flex-shrink:0;background:rgba(84,232,204,.1);border:1px solid rgba(84,232,204,.2);display:flex;align-items:center;justify-content:center;font-size:19px}.gb-fhead{font-family:Barlow Condensed,sans-serif;font-size:15px;font-weight:700;color:var(--ink);margin-bottom:2px;text-transform:uppercase;letter-spacing:.3px}.gb-fbody{font-size:12px;color:var(--ink2);line-height:1.6}');
a('.gb-compare{border-radius:12px;overflow:hidden;border:1px solid var(--border)}.gb-compare-head,.gb-compare-row{display:grid;grid-template-columns:1.3fr 1fr 1fr}.gb-compare-row{border-bottom:1px solid var(--border)}.gb-compare-row:last-child{border-bottom:none}.gb-compare-row:nth-child(even){background:rgba(250,248,244,.5)}');
a('.gb-ch{padding:10px 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}.gb-ch:first-child{background:#f2f2f0;color:var(--ink2)}.gb-ch:nth-child(2){background:var(--navy);color:var(--mint);text-align:center;border-left:1px solid rgba(84,232,204,.2)}.gb-ch:nth-child(3){background:#e8e8e6;color:#999;text-align:center;border-left:1px solid var(--border)}');
a('.gb-cd{padding:10px 12px;font-size:11px}.gb-cd:first-child{color:var(--ink2)}.gb-cd-pos{font-weight:600;color:var(--teal);text-align:center;background:rgba(84,232,204,.04);border-left:1px solid rgba(84,232,204,.1)}.gb-cd-neu{color:#aaa;text-align:center;border-left:1px solid rgba(84,232,204,.1)}.gb-cd-reg{color:#bbb;text-align:center;border-left:1px solid var(--border)}');
a('.gb-gbar{background:#fff;border:1.5px solid rgba(84,232,204,.3);border-radius:12px;padding:16px;display:flex;gap:12px;align-items:center}.gb-gh{font-family:Barlow Condensed,sans-serif;font-size:17px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px}.gb-gd{font-size:12px;color:var(--ink2);line-height:1.5}');
a('.gb-rv-top{display:flex;align-items:baseline;gap:12px;margin-bottom:16px}.gb-rv-big{font-family:Barlow Condensed,sans-serif;font-size:52px;font-weight:900;color:var(--navy);line-height:1}.gb-rv-stars{color:var(--gold);font-size:14px;letter-spacing:1px}.gb-rv-sub{font-size:11px;color:var(--ink3);margin-top:2px}');
a('.gb-rv-card{background:#f7f7f5;border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px}.gb-rv-card:last-child{margin-bottom:0}.gb-rvs{color:var(--gold);font-size:12px;margin-bottom:8px}.gb-rvt{font-size:13px;color:var(--ink2);line-height:1.7;font-style:italic;margin-bottom:11px}.gb-rva{display:flex;align-items:center;gap:9px}.gb-rvav{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:700}.gb-rvn{font-size:12.5px;font-weight:600;color:var(--navy)}.gb-rvl{font-size:11px;color:var(--ink3)}.gb-rvv{margin-left:auto;font-size:10px;color:#16a34a;font-weight:600;background:rgba(34,197,94,.08);padding:2px 8px;border-radius:10px;white-space:nowrap}');
a('.gb-faq-item{border-bottom:1px solid var(--border)}.gb-faq-q{display:flex;justify-content:space-between;align-items:center;padding:14px 0;cursor:pointer;gap:12px;font-size:13px;font-weight:500;color:var(--ink);-webkit-tap-highlight-color:transparent;user-select:none}.gb-faq-ic{width:24px;height:24px;border-radius:50%;background:rgba(18,57,94,.07);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;color:var(--ink);transition:transform .3s,background .2s}.gb-faq-item.open .gb-faq-ic{transform:rotate(45deg);background:var(--navy);color:#fff}.gb-faq-a{max-height:0;overflow:hidden;transition:max-height .4s ease,padding .4s ease;font-size:12.5px;color:var(--ink2);line-height:1.7}.gb-faq-item.open .gb-faq-a{max-height:260px;padding-bottom:14px}');
a('.gb-final{background:var(--navy);padding:32px 20px;text-align:center}.gb-final h2{font-family:Barlow Condensed,sans-serif;font-size:34px;font-weight:900;color:#fff;text-transform:uppercase;font-style:italic;letter-spacing:-.5px;line-height:1.1;margin-bottom:8px}.gb-final h2 em{color:var(--mint);font-style:italic}.gb-final p{font-size:12px;color:rgba(255,255,255,.5);margin-bottom:20px;line-height:1.6}.gb-cta-inner{max-width:360px;margin:0 auto}.gb-btn-final{display:block;width:100%;background:var(--mint);color:var(--navy);padding:17px;border-radius:10px;border:none;font-family:Barlow Condensed,sans-serif;font-size:18px;font-weight:900;letter-spacing:1px;text-transform:uppercase;text-align:center;cursor:pointer;margin-bottom:10px;animation:gb-pulse 3s ease-in-out infinite;-webkit-appearance:none;touch-action:manipulation}');
a('.gb-sticky{position:fixed;bottom:0;left:0;right:0;background:var(--navy);padding:11px 18px;display:flex;gap:11px;align-items:center;z-index:9999;box-shadow:0 -4px 20px rgba(10,31,54,.4);-webkit-transform:translateZ(0);transform:translateZ(0);touch-action:manipulation}.gb-sticky img{width:42px;height:42px;border-radius:6px;object-fit:cover;flex-shrink:0;border:1px solid rgba(255,255,255,.15)}.gb-sticky-info{flex:1;min-width:0}.gb-sticky-name{font-size:10px;color:rgba(255,255,255,.5);font-family:Barlow Condensed,sans-serif;letter-spacing:.5px;text-transform:uppercase}.gb-sticky-price{font-family:Barlow Condensed,sans-serif;font-size:20px;color:#fff;font-weight:900;line-height:1.1}.gb-sticky-btn{background:var(--mint);color:var(--navy);padding:12px 18px;border-radius:50px;font-family:Barlow Condensed,sans-serif;font-size:14px;font-weight:900;letter-spacing:1px;text-transform:uppercase;white-space:nowrap;flex-shrink:0;border:none;cursor:pointer;-webkit-appearance:none;touch-action:manipulation;min-height:44px;display:flex;align-items:center}.gb-sticky-btn:active{background:var(--teal)}');
a('</style>');
a('');
a('<div class="gymbag-pdp" ' + lv('section.shopify_attributes') + '>');
a('<div class="gb-urgent">' + ss('urgent_text') + '</div>');
a('<div class="gb-crumb"><a href="/">Home</a> &rsaquo; <a href="/collections/all"> Fitness</a> &rsaquo; ' + lv('product.title | truncate: 40') + '</div>');
a('<div class="gb-ticker-wrap"><div class="gb-ticker-inner">');
a(lb('for block in section.blocks') + lb('if block.type == "trust_pill"') + '<span class="gb-tick" ' + lv('block.shopify_attributes') + '>' + bs('text') + ' &middot;</span>' + lb('endif') + lb('endfor'));
a(lb('for block in section.blocks') + lb('if block.type == "trust_pill"') + '<span class="gb-tick">' + bs('text') + ' &middot;</span>' + lb('endif') + lb('endfor'));
a('</div></div>');
a('<div class="gb-gallery"><div class="gb-stage" id="gb-stage">');
a('<button class="gb-arr gb-arr-l" onclick="gbSlide(-1,true)" aria-label="Previous image">&#8249;</button>');
a('<button class="gb-arr gb-arr-r" onclick="gbSlide(1,true)" aria-label="Next image">&#8250;</button>');
a('<div class="gb-sale-badge">' + lv('pct') + '% OFF</div>');
a('<span class="gb-ctr" id="gb-ctr">1 / ' + lv('product.images.size') + '</span>');
a(lb('for image in product.images'));
a('<div class="gb-slide' + lb('if forloop.first') + ' active' + lb('endif') + '">');
a('<img src="' + lv('image | image_url: width: 700') + '" alt="' + lv('image.alt | default: product.title | escape') + '" ' + lb('if forloop.first') + 'loading="eager"' + lb('else') + 'loading="lazy"' + lb('endif') + ' width="700" height="700">');
a('</div>');
a(lb('endfor'));
a('</div><div class="gb-thumbs" id="gb-thumbs"></div></div>');
a('<div class="gb-info gb-f1">');
a('<div class="gb-cat">' + ss('cat_label') + '</div>');
a('<h1 class="gb-title"><em>' + ss('heading_italic') + '</em><br>' + ss('heading_line2') + '<br>' + ss('heading_line3') + '</h1>');
a('<div class="gb-sub">' + ss('subtitle') + '</div>');
a('<div class="gb-rating"><span class="gb-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span><span class="gb-rtxt">' + ss('review_score') + ' &middot; ' + ss('review_count') + ' UAE reviews</span><span class="gb-sold">' + ss('sold_today') + '</span></div>');
a('<div class="gb-price-row gb-f2"><span class="gb-price">' + lv('product.price | money') + '</span>');
a(lb('if sale'));
a('<span class="gb-price-was">' + lv('product.compare_at_price | money') + '</span>');
a('<span class="gb-save-pill">' + lv('pct') + '% OFF</span>');
a(lb('endif') + '</div>');
a('<span class="gb-price-note">' + ss('price_note') + '</span>');
a('<div class="gb-color-block gb-f2"><div class="gb-color-lbl">Select Colour &amp; Quantity</div>');
a('<div class="gb-variant-row has-qty" id="gb-row-black"><div class="gb-variant-left"><div class="gb-color-swatch" style="background:#1a1a1a;"></div><div><div class="gb-variant-name">Black</div><div class="gb-variant-stock">' + lv('black_v.inventory_quantity') + ' in stock</div></div></div><div class="gb-qty-ctrl"><button class="gb-qty-btn" onclick="gbChangeQty(\'black\',-1)" aria-label="Decrease Black">&#8722;</button><span class="gb-qty-num" id="gb-qty-black">1</span><button class="gb-qty-btn" onclick="gbChangeQty(\'black\',1)" aria-label="Increase Black">&#43;</button></div></div>');
a('<div class="gb-variant-row" id="gb-row-gray"><div class="gb-variant-left"><div class="gb-color-swatch" style="background:#8a8a8a;"></div><div><div class="gb-variant-name">Gray</div><div class="gb-variant-stock">' + lv('gray_v.inventory_quantity') + ' in stock</div></div></div><div class="gb-qty-ctrl"><button class="gb-qty-btn" onclick="gbChangeQty(\'gray\',-1)" aria-label="Decrease Gray">&#8722;</button><span class="gb-qty-num" id="gb-qty-gray">0</span><button class="gb-qty-btn" onclick="gbChangeQty(\'gray\',1)" aria-label="Increase Gray">&#43;</button></div></div>');
a('<div class="gb-total-row"><span class="gb-total-lbl">Total: <span id="gb-qty-total">1</span> item(s)</span><span class="gb-total-price" id="gb-price-total">' + lv('product.price | money') + '</span></div></div>');
a('<div class="gb-magnetic gb-f3"><div class="gb-mag-lbl">' + ss('mag_label') + '</div><div class="gb-mag-h">' + ss('mag_heading') + ' <em>' + ss('mag_heading_em') + '</em></div><div class="gb-mag-steps">');
a('<div class="gb-mag-step"><div class="gb-mag-icon">' + ss('step1_icon') + '</div><div class="gb-mag-word">' + ss('step1_word') + '</div><div class="gb-mag-desc">' + ss('step1_desc') + '</div></div>');
a('<div class="gb-mag-step"><div class="gb-mag-icon">' + ss('step2_icon') + '</div><div class="gb-mag-word">' + ss('step2_word') + '</div><div class="gb-mag-desc">' + ss('step2_desc') + '</div></div>');
a('<div class="gb-mag-step"><div class="gb-mag-icon">' + ss('step3_icon') + '</div><div class="gb-mag-word">' + ss('step3_word') + '</div><div class="gb-mag-desc">' + ss('step3_desc') + '</div></div>');
a('</div></div>');
a(lb('if section.settings.show_stock'));
a('<div class="gb-stock gb-f3"><span class="gb-sdot"></span>' + lv('black_v.inventory_quantity') + ' Black &middot; ' + lv('gray_v.inventory_quantity') + ' Gray &middot; Ships from UAE today</div>');
a(lb('endif'));
a('<div class="gb-f4">');
a('<button class="gb-btn-buy" onclick="gbAddToCart(false)">Add to Cart &mdash; <span id="gb-btn-price">' + lv('product.price | money') + '</span></button>');
a('<button class="gb-btn-cod" onclick="gbAddToCart(true)">Buy Now &middot; Cash on Delivery</button>');
a('<a href="https://wa.me/' + ss('whatsapp') + '" class="gb-btn-wa" target="_blank" rel="noopener">Questions? WhatsApp +' + ss('whatsapp') + '</a>');
a('<div class="gb-secure">' + ss('secure_text') + '</div>');
a('</div></div>');
a('<div class="gb-trust">');
a(lb('for block in section.blocks') + lb('if block.type == "trust_pill"') + '<div class="gb-pill" ' + lv('block.shopify_attributes') + '>' + bs('text') + '</div>' + lb('endif') + lb('endfor'));
a('</div>');
a('<div class="gb-sec gb-sec-dark"><div class="gb-sec-lbl gb-sec-lbl-light">By The Numbers</div><div class="gb-stats">');
a('<div class="gb-stat"><div class="gb-stat-n">' + ss('stat1_num') + '</div><div class="gb-stat-l">' + ss('stat1_lbl') + '</div></div>');
a('<div class="gb-stat"><div class="gb-stat-n">' + ss('stat2_num') + '</div><div class="gb-stat-l">' + ss('stat2_lbl') + '</div></div>');
a('<div class="gb-stat"><div class="gb-stat-n">' + ss('stat3_num') + '</div><div class="gb-stat-l">' + ss('stat3_lbl') + '</div></div>');
a('</div></div>');
a('<div class="gb-sec gb-sec-white"><div class="gb-sec-lbl">' + ss('features_title') + '</div><div class="gb-feats">');
a(lb('for block in section.blocks') + lb('if block.type == "feature"'));
a('<div class="gb-feat" ' + lv('block.shopify_attributes') + '><div class="gb-ficon">' + bs('icon') + '</div><div><div class="gb-fhead">' + bs('title') + '</div><div class="gb-fbody">' + bs('body') + '</div></div></div>');
a(lb('endif') + lb('endfor') + '</div></div>');
a('<div class="gb-sec"><div class="gb-sec-lbl">' + ss('compare_title') + '</div><div class="gb-compare">');
a('<div class="gb-compare-head"><div class="gb-ch">' + ss('compare_col1') + '</div><div class="gb-ch">' + ss('compare_col2') + '</div><div class="gb-ch">' + ss('compare_col3') + '</div></div>');
a(lb('for block in section.blocks') + lb('if block.type == "compare_row"'));
a('<div class="gb-compare-row" ' + lv('block.shopify_attributes') + '><div class="gb-cd">' + bs('feature') + '</div><div class="' + lb('if block.settings.positive') + 'gb-cd-pos' + lb('else') + 'gb-cd-neu' + lb('endif') + '">' + bs('gymbag') + '</div><div class="gb-cd-reg">' + bs('regular') + '</div></div>');
a(lb('endif') + lb('endfor') + '</div></div>');
a('<div class="gb-sec gb-sec-white"><div class="gb-gbar"><div style="font-size:28px;flex-shrink:0;">&#128737;</div><div><div class="gb-gh">' + ss('guarantee_title') + '</div><div class="gb-gd">' + ss('guarantee_text') + '</div></div></div></div>');
a('<div class="gb-sec" id="gb-reviews"><div class="gb-sec-lbl">' + ss('reviews_title') + '</div>');
a('<div class="gb-rv-top"><div class="gb-rv-big">' + ss('review_score') + '</div><div><div class="gb-rv-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div><div class="gb-rv-sub">' + ss('review_count') + ' verified UAE reviews</div></div></div>');
a(lb('for block in section.blocks') + lb('if block.type == "review"'));
a('<div class="gb-rv-card" ' + lv('block.shopify_attributes') + '><div class="gb-rvs">&#9733;&#9733;&#9733;&#9733;&#9733;</div><p class="gb-rvt">&ldquo;' + bs('text') + '&rdquo;</p><div class="gb-rva"><div class="gb-rvav" style="background:' + bs('color') + '22;color:' + bs('color') + ';">' + bs('letter') + '</div><div><div class="gb-rvn">' + bs('name') + '</div><div class="gb-rvl">' + bs('location') + '</div></div><span class="gb-rvv">&#10003; Verified</span></div></div>');
a(lb('endif') + lb('endfor') + '</div>');
a('<div class="gb-sec gb-sec-white"><div class="gb-sec-lbl">' + ss('faq_title') + '</div>');
a(lb('for block in section.blocks') + lb('if block.type == "faq"'));
a('<div class="gb-faq-item" ' + lv('block.shopify_attributes') + '><div class="gb-faq-q" role="button" tabindex="0" aria-expanded="false"><span>' + bs('question') + '</span><span class="gb-faq-ic">+</span></div><div class="gb-faq-a">' + bs('answer') + '</div></div>');
a(lb('endif') + lb('endfor') + '</div>');
a('<div class="gb-final"><h2>' + ss('final_line1') + '<br>' + ss('final_line2') + '<br><em>' + ss('final_italic') + '</em></h2><p>' + ss('final_subtext') + '</p><div class="gb-cta-inner"><button class="gb-btn-final" onclick="gbAddToCart(true)">Buy Now &mdash; ' + lv('product.price | money') + '</button><a href="https://wa.me/' + ss('whatsapp') + '" class="gb-btn-wa" style="border-color:rgba(255,255,255,.15);color:rgba(255,255,255,.5);" target="_blank" rel="noopener">WhatsApp +' + ss('whatsapp') + '</a></div></div>');
a('</div>');
a('<div class="gb-sticky">');
a(lb('if product.featured_image'));
a('<img src="' + lv('product.featured_image | image_url: width: 100') + '" alt="' + lv('product.title | escape') + '" width="42" height="42">');
a(lb('endif'));
a('<div class="gb-sticky-info"><div class="gb-sticky-name">' + ss('sticky_name') + '</div><div class="gb-sticky-price" id="gb-sticky-price">' + lv('product.price | money') + '</div></div>');
a('<button class="gb-sticky-btn" onclick="gbAddToCart(true)">BUY NOW &rsaquo;</button></div>');

// JavaScript — GT used for all > comparisons
a('<script>');
a('(function(){"use strict";');
a('var UNIT=' + lv('product.price | divided_by: 100.0') + ';');
a('var VARIANTS={');
a('  black:{id:' + lb('if black_v') + lv('black_v.id') + lb('else') + '43786158735475' + lb('endif') + ',max:' + lb('if black_v') + lv('black_v.inventory_quantity') + lb('else') + '62' + lb('endif') + '},');
a('  gray: {id:' + lb('if gray_v')  + lv('gray_v.id')  + lb('else') + '43786158768243' + lb('endif') + ',max:' + lb('if gray_v')  + lv('gray_v.inventory_quantity')  + lb('else') + '94' + lb('endif') + '}');
a('};');
a('var qtys={black:1,gray:0};');
a('function fmt(n){return "AED "+Math.round(n);}');
a('function upd(){');
a('  var t=qtys.black+qtys.gray,p=t*UNIT;');
a('  document.getElementById("gb-row-black").className="gb-variant-row"+(qtys.black' + GT + '0?" has-qty":"");');
a('  document.getElementById("gb-row-gray").className="gb-variant-row"+(qtys.gray' + GT + '0?" has-qty":"");');
a('  document.getElementById("gb-qty-black").textContent=qtys.black;');
a('  document.getElementById("gb-qty-gray").textContent=qtys.gray;');
a('  document.getElementById("gb-qty-total").textContent=t;');
a('  document.getElementById("gb-price-total").textContent=fmt(t' + GT + '0?p:UNIT);');
a('  var bp=document.getElementById("gb-btn-price");if(bp)bp.textContent=fmt(t' + GT + '0?p:UNIT);');
a('  var sp=document.getElementById("gb-sticky-price");if(sp)sp.textContent=fmt(t' + GT + '0?p:UNIT)+(t' + GT + '1?" x"+t:"");');
a('}');
a('window.gbChangeQty=function(c,d){');
a('  var v=VARIANTS[c],n=Math.min(Math.max(qtys[c]+d,0),v.max);qtys[c]=n;');
a('  if(d' + GT + '0&&n===1){var lbl=c==="black"?"Black":"Gray";var idx=Array.from(document.querySelectorAll(".gb-slide")).findIndex(function(s){return s.dataset&&s.dataset.color===lbl;});if(idx' + GT + '=0)gbGoTo(idx,true);}');
a('  upd();');
a('};');
a('window.gbAddToCart=function(go){');
a('  var it=[];');
a('  if(qtys.black' + GT + '0)it.push({id:VARIANTS.black.id,quantity:qtys.black});');
a('  if(qtys.gray' + GT + '0)it.push({id:VARIANTS.gray.id,quantity:qtys.gray});');
a('  if(it.length===0)it=[{id:VARIANTS.black.id,quantity:1}];');
a('  fetch("/cart/add.js",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:it})})');
a('    .then(function(){window.location.href=go?"/checkout":"/cart";})');
a('    .catch(function(){window.location.href=go?"/checkout":"/cart";});');
a('};');
a('var slides=document.querySelectorAll(".gb-slide"),tc=document.getElementById("gb-thumbs"),ctrEl=document.getElementById("gb-ctr"),cur=0,tmr;');
a('Array.from(slides).forEach(function(sl,i){');
a('  var img=sl.querySelector("img"),t=document.createElement("div");');
a('  t.className="gb-thumb"+(i===0?" on":"");');
a('  var ti=document.createElement("img");ti.src=img.src.replace("width=700","width=120");ti.alt=img.alt;ti.loading="lazy";ti.width=54;ti.height=54;');
a('  t.appendChild(ti);t.addEventListener("click",function(){gbGoTo(i,true);});tc.appendChild(t);');
a('});');
a('function gbGoTo(n,m){');
a('  slides[cur].classList.remove("active");tc.querySelectorAll(".gb-thumb")[cur].classList.remove("on");');
a('  cur=((n%slides.length)+slides.length)%slides.length;');
a('  slides[cur].classList.add("active");');
a('  var nt=tc.querySelectorAll(".gb-thumb")[cur];nt.classList.add("on");');
a('  if(m)nt.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});');
a('  if(ctrEl)ctrEl.textContent=(cur+1)+" / "+slides.length;');
a('  clearInterval(tmr);tmr=setInterval(function(){gbGoTo(cur+1,false);},4200);');
a('}');
a('window.gbSlide=function(d,m){gbGoTo(cur+d,m);};');
a('tmr=setInterval(function(){gbGoTo(cur+1,false);},4200);');
a('var tx=0,st=document.getElementById("gb-stage");');
a('st.addEventListener("touchstart",function(e){tx=e.touches[0].clientX;},{passive:true});');
a('st.addEventListener("touchend",function(e){var dx=tx-e.changedTouches[0].clientX;if(Math.abs(dx)' + GT + '40)window.gbSlide(dx' + GT + '0?1:-1,true);},{passive:true});');
a('document.querySelectorAll(".gb-faq-q").forEach(function(hd){');
a('  var item=hd.parentElement;');
a('  function tog(){var o=item.classList.contains("open");document.querySelectorAll(".gb-faq-item").forEach(function(el){el.classList.remove("open");el.querySelector(".gb-faq-q").setAttribute("aria-expanded","false");});if(o){return;}item.classList.add("open");hd.setAttribute("aria-expanded","true");}');
a('  hd.addEventListener("click",tog);');
a('  hd.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();tog();}});');
a('});');
a('})();');
a('<\/script>');

// Schema
a(lb('schema'));
a(JSON.stringify(SCHEMA, null, 2));
a(lb('endschema'));

const content = L.join('\n');

// Validate
const opens  = (content.match(/\{%-?\s*(if|for|unless|case|form)\b/g)||[]).length;
const closes = (content.match(/\{%-?\s*(endif|endfor|endunless|endcase|endform)\b/g)||[]).length;
const corrupt = (content.match(/\{\{[^}]*\]\(http/g)||[]).length;

console.log('Lines:     ' + content.split('\n').length);
console.log('Balance:   ' + opens + '/' + closes + ' ' + (opens===closes ? 'OK' : 'MISMATCH'));
console.log('Corrupt:   ' + (corrupt===0 ? 'CLEAN' : 'FOUND ' + corrupt));

if (opens !== closes || corrupt > 0) {
  console.log('ABORT — not writing'); process.exit(1);
}

fs.writeFileSync(FILE, content);
console.log('Written:   ' + Math.round(content.length/1024) + 'kb');

try {
  execSync(
    'shopify theme push --store ' + STORE + ' --theme ' + THEME +
    ' --path ./theme-files --only sections/gymbag-pdp.liquid --allow-live',
    { stdio: 'inherit', cwd: ROOT }
  );
  console.log('\nDONE. Assign template in Admin then run: bash regression-geo.sh');
} catch(e) {
  fs.copyFileSync(FILE + '.PRE-REBUILD-' + TS + '.bak', FILE);
  console.log('Push failed - rolled back'); process.exit(1);
}
