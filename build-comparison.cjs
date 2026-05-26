require('fs');
const fs = require('fs');

// Per-product comparison data — each tailored to the specific product
const COMPARISONS = {

'kids-u-shaped-electric-toothbrush-tiptop360-best-kids-gift': {
  title: 'Why Parents Switch to TipTop360 U-Shaped',
  cols: ['Manual Brush', 'Standard Electric', 'TipTop360 U-Shaped'],
  rows: [
    ['Cleaning Time', '2-3 min struggle', '2 min', '60 seconds ✓'],
    ['Full-Mouth Coverage', '✗ Misses spots', 'Partial', '✓ All teeth at once'],
    ['Kid-Friendly Design', '✗ Boring', 'Sometimes scary', '✓ Loved by kids'],
    ['BPA-Free Soft Silicone', 'Often No', 'Sometimes', '✓ Food-grade'],
    ['Auto-Stop Timer', '✗ None', 'Some models', '✓ 60s automatic'],
    ['Daily Brushing Battle', 'Yes ✗', 'Sometimes', '✓ Solved']
  ]
},

'kids-strawberry-foam-toothpaste-uae-approved': {
  title: 'Why Kids Actually Use This Toothpaste',
  cols: ['Adult Toothpaste', 'Standard Kids Paste', 'TipTop360 Foam'],
  rows: [
    ['Mint Burning', '✗ Strong', 'Mild', '✓ Strawberry — no burn'],
    ['Application', 'Squeeze tube', 'Squeeze tube', '✓ Easy pump'],
    ['Mess on Counter', 'High', 'Medium', '✓ Foam = no mess'],
    ['UAE Approved', 'Varies', 'Varies', '✓ UAE-approved formula'],
    ['Fluoride Safety', 'Adult dose', 'Often too high', '✓ Kid-safe dose'],
    ['Kids Want to Use It', '✗ Resist', 'Sometimes', '✓ Ask for it']
  ]
},

'kids-electric-u-shaped-toothbrush-replacement-heads': {
  title: 'Why Replace with Genuine TipTop360 Heads',
  cols: ['Generic Replacement', 'Cheap Imports', 'TipTop360 Genuine'],
  rows: [
    ['Fits Your Brush Perfectly', 'Risky', '✗ Often loose', '✓ Engineered fit'],
    ['BPA-Free Silicone', 'Sometimes', '✗ Often No', '✓ Always'],
    ['Bristle Lifespan', '1-2 months', '< 1 month', '✓ 3 months'],
    ['Hygiene Standards', 'Unknown', 'Unknown', '✓ UAE-approved'],
    ['Color Match Options', 'Limited', 'Limited', '✓ All colors'],
    ['Replacement Notice', '✗ None', '✗ None', '✓ Wear indicators']
  ]
},

'dental-floss-for-kids': {
  title: 'Why Kids Need Their Own Flosser',
  cols: ['Adult Floss', 'Floss Picks', 'TipTop360 Kids Flosser'],
  rows: [
    ['Easy for Small Hands', '✗ Tough', 'Better', '✓ Designed for kids'],
    ['BPA-Free', 'Sometimes', 'Rarely', '✓ Always'],
    ['Pain-Free Flossing', '✗ Hurts gums', 'Better', '✓ Soft thread'],
    ['Pre-Threaded', '✗ Manual', '✓ Yes', '✓ Yes'],
    ['Travel-Friendly', '✗ Bulky', 'Yes', '✓ Compact pack'],
    ['Builds Habit Early', 'Difficult', 'Possible', '✓ Easy to start']
  ]
},

'kids-brushing-stickers-uae': {
  title: 'Why a Reward Chart Beats Nagging',
  cols: ['Pure Nagging', 'Random Rewards', 'TipTop360 Chart'],
  rows: [
    ['Builds Lasting Habit', '✗ Resentment', 'Inconsistent', '✓ Daily ritual'],
    ['Visual Progress', '✗ None', 'Some', '✓ Sticker chart'],
    ['Kids Stay Motivated', 'Days only', 'Weeks', '✓ Months'],
    ['Removable & Reusable', '—', 'No', '✓ Yes'],
    ['Promotes Independence', '✗ Top-down', 'Limited', '✓ Kid-led tracking'],
    ['Backed by Pediatrics', '✗', '✗', '✓ Behavioral method']
  ]
},

'kids-electric-toothbrush-traditional-replacement-heads': {
  title: 'Why TipTop360 Replacement Heads',
  cols: ['Generic 3rd Party', 'Brand-Name', 'TipTop360 Genuine'],
  rows: [
    ['Perfect Fit', 'Risky', '✓ Yes', '✓ Yes'],
    ['Soft Silicone', 'Mixed', '✓', '✓'],
    ['Price per Head', 'Cheap risk', 'High', '✓ Fair'],
    ['UAE Stock', 'Slow', 'Slow', '✓ In Dubai'],
    ['Compatible Models', 'Some', 'Limited', '✓ All TipTop360'],
    ['Warranty', '✗ None', 'Limited', '✓ Yes']
  ]
},

'kids-dental-care-monthly-bundle-offer-51': {
  title: 'Why the Bundle Saves More',
  cols: ['Buy Separately', 'Cheap Combos', 'TipTop360 Bundle'],
  rows: [
    ['Total Savings', '✗ Full price', '10-15%', '✓ Save 51%'],
    ['Curated for Kids', 'Random', 'Mixed', '✓ Pediatric-tested'],
    ['Includes Brush + Paste + Heads', 'Buy 3 times', 'Often No', '✓ All-in-one'],
    ['Free UAE Delivery', 'Per-item', 'Sometimes', '✓ Yes'],
    ['30-Day Care System', '✗', '✗', '✓ Designed as routine'],
    ['Monthly Refills Available', '✗', '✗', '✓ Subscribe later']
  ]
},

'color-pencils': {
  title: 'Why TipTop360 Color Pencils',
  cols: ['Cheap Pencils', 'School Brand', 'TipTop360'],
  rows: [
    ['Non-Toxic & Safe', '✗ Risky', '✓ Usually', '✓ Certified'],
    ['Vibrant Pigments', 'Faded', 'OK', '✓ Bright lasting'],
    ['Break Resistance', 'Snaps easily', 'OK', '✓ Reinforced core'],
    ['Easy Sharpening', '✗ Splinters', 'Yes', '✓ Smooth'],
    ['Color Range', '8-12', '12-24', '✓ 12 vivid'],
    ['Good for All Ages', '✗ Young only', 'Some', '✓ 3-12 yrs']
  ]
},

'kids-dual-tip-markers-uae': {
  title: 'Why Dual-Tip Markers Win',
  cols: ['Single-Tip Markers', 'Cheap Sets', 'TipTop360 Dual-Tip'],
  rows: [
    ['Fine + Broad in One', '✗ Single only', '✗ Single only', '✓ Both tips'],
    ['Washable from Skin', '✗ Stains', 'Sometimes', '✓ Easy wash'],
    ['Non-Toxic', 'Mixed', '✓ Usually', '✓ Certified'],
    ['Bleed-Through Paper', 'Yes ✗', 'Sometimes', '✓ Minimal'],
    ['Cap Tightness', 'Lose seal', 'OK', '✓ Stays moist'],
    ['Color Variety', '8-10', '12', '✓ Wide range']
  ]
},

'super-smooth-wax-crayons-12-vivid-colors': {
  title: 'Why These Wax Crayons',
  cols: ['Standard Crayons', 'Cheap Imports', 'TipTop360'],
  rows: [
    ['Non-Toxic Certified', 'Mixed', '✗ Often No', '✓ Verified'],
    ['Smooth Application', 'Scratchy', 'Waxy', '✓ Buttery smooth'],
    ['Break Resistance', '✗ Snaps', 'Snaps', '✓ Sturdy'],
    ['Vibrant Colors', 'Faded', 'OK', '✓ 12 vivid'],
    ['Easy to Hold', 'Standard', 'Standard', '✓ Kid-grip shape'],
    ['Washable from Walls', '✗ Permanent stain', 'Sometimes', '✓ Yes']
  ]
},

'kids-water-colour-pens-uae': {
  title: 'Why Watercolour Pens vs Sets',
  cols: ['Brush + Pan Set', 'Standard Markers', 'TipTop360 Pens'],
  rows: [
    ['Mess-Free', '✗ Spills', '✓ Clean', '✓ Clean'],
    ['No Water Needed', '✗ Required', '✓', '✓'],
    ['Travel-Friendly', '✗', '✓', '✓'],
    ['Blendable Colors', 'Yes', 'Limited', '✓ True watercolour effect'],
    ['Non-Toxic', 'Varies', 'Varies', '✓ Certified'],
    ['Number of Colors', 'Few', '8-12', '✓ 12 colors']
  ]
},

'kids-drawing-marker-set-perfect-match-for-any-drawing-robot': {
  title: 'Why Use Genuine Robot-Match Markers',
  cols: ['Generic Markers', 'Random Pens', 'TipTop360 Robot Markers'],
  rows: [
    ['Fits the Drawing Robot', 'Risky', '✗ Often No', '✓ Perfect fit'],
    ['Smooth Ink Flow', 'Skips', 'Inconsistent', '✓ Steady'],
    ['Non-Toxic', 'Varies', 'Varies', '✓ Certified safe'],
    ['Long-Lasting Tips', 'Days', 'Weeks', '✓ Months of use'],
    ['Compatible with All Robot Models', 'No', 'No', '✓ Yes'],
    ['Replaces Wear Parts', '✗', '✗', '✓ Easy refill']
  ]
},

'my-chores-kids-responsibility-sliding-task-checklist-for-daily-routines-positive-habits': {
  title: 'Why a Sliding Chore Chart',
  cols: ['Verbal Reminders', 'Sticker Charts', 'TipTop360 Sliding Chart'],
  rows: [
    ['Builds Independence', 'Limited', 'Some', '✓ Kid does it'],
    ['No Stickers to Lose', '—', '✗ Run out', '✓ Reusable forever'],
    ['Ages 3-10 Range', 'Varies', 'Limited', '✓ Built-in'],
    ['Visual Daily Tracking', '✗', '✓', '✓ Slide tile'],
    ['Reduces Parent Nagging', 'Increases', 'Slight', '✓ Major drop'],
    ['Travel-Friendly', '—', 'No', '✓ Compact']
  ]
},

'kids-drawing-robot': {
  title: 'Why STEM Drawing Robot vs Tablets',
  cols: ['Drawing Tablet', 'YouTube Tutorial', 'TipTop360 STEM Robot'],
  rows: [
    ['Screen-Free Learning', '✗ More screen', '✗ Pure screen', '✓ Hands-on'],
    ['Builds Fine Motor Skills', 'Limited', '✗ None', '✓ Yes'],
    ['Teaches Step-by-Step Drawing', 'No', 'Passive', '✓ Active learning'],
    ['Battery / Cord-Free', 'Cord', 'Device-bound', '✓ Portable'],
    ['Age 5-12', 'Mixed', 'Mixed', '✓ Designed for'],
    ['Encourages Creativity', 'Some', 'Imitation only', '✓ Real practice']
  ]
},

'magnetic-gym-bag-uae-gymgear-tiptop360': {
  title: 'Why a Magnetic Gym Bag',
  cols: ['Standard Gym Bag', 'Backpack', 'TipTop360 Magnetic'],
  rows: [
    ['Hands-Free Carry', '✗ Always carrying', 'Yes', '✓ Magnetic snap'],
    ['Phone Quick-Access', '✗ Dig for it', 'Slow', '✓ Magnetic mount'],
    ['Sweat-Resistant Material', 'Sometimes', 'Rarely', '✓ Yes'],
    ['Wet/Dry Compartment', 'Limited', '✗ No', '✓ Yes'],
    ['Shoe Pocket', 'Sometimes', '✗', '✓ Yes'],
    ['Designed in UAE', '✗', '✗', '✓ Yes']
  ]
},

'ai-voice-recorder': {
  title: 'Why AI Voice Recorder vs Phone Apps',
  cols: ['Phone Recording App', 'Standard Recorder', 'TipTop360 AiVox'],
  rows: [
    ['GPT-4 Transcription', '✗ Manual', '✗', '✓ Automatic'],
    ['Battery Life', '4-6 hrs', '8-10 hrs', '✓ 20+ hrs'],
    ['Privacy (No Cloud)', 'Cloud-bound', 'Local', '✓ Your control'],
    ['Multi-Language Support', 'Limited', '✗', '✓ 100+ languages'],
    ['Auto Note Summary', '✗', '✗', '✓ AI summary'],
    ['One-Click Recording', 'Multi-step', '2-step', '✓ One press']
  ]
},

'smoke-bubble-machine': {
  title: 'Why a Smoke Bubble Machine vs Regular',
  cols: ['Regular Bubble Wand', 'Standard Bubble Machine', 'TipTop360 Smoke Bubble'],
  rows: [
    ['Smoke-Filled Bubbles', '✗ Plain', '✗ Plain', '✓ Magic effect'],
    ['Continuous Bubbles', '✗ One at a time', '✓', '✓ High volume'],
    ['Birthday Party Wow Factor', 'Low', 'Medium', '✓ Center of attention'],
    ['Battery + USB Powered', '—', 'Battery only', '✓ Both'],
    ['Safe Smoke Liquid', '—', '—', '✓ Non-toxic'],
    ['Indoor & Outdoor Use', 'Outdoor', 'Both', '✓ Both']
  ]
}

};

// Build a single Liquid snippet that switches based on product handle
let snippet = `{%- comment -%} Per-product comparison table — fact-based differentiators {%- endcomment -%}\n{%- case product.handle -%}\n`;

for (const [handle, data] of Object.entries(COMPARISONS)) {
  snippet += `  {%- when '${handle}' -%}\n`;
  snippet += `    <div class="cro-comparison" style="margin:32px 0;padding:20px;background:#f8f9fa;border-radius:12px;">\n`;
  snippet += `      <h3 style="text-align:center;margin:0 0 16px;color:#12395e;font-size:20px;">${data.title}</h3>\n`;
  snippet += `      <div style="overflow-x:auto;">\n`;
  snippet += `      <table style="width:100%;border-collapse:collapse;font-size:14px;min-width:480px;">\n`;
  snippet += `        <thead>\n`;
  snippet += `          <tr style="background:#12395e;color:#fff5e6;">\n`;
  snippet += `            <th style="padding:12px;text-align:left;">Feature</th>\n`;
  data.cols.forEach((col, i) => {
    const isUs = i === data.cols.length - 1;
    snippet += `            <th style="padding:12px;text-align:center;${isUs?'background:#0a2640;':''}">${col}${isUs?' ✓':''}</th>\n`;
  });
  snippet += `          </tr>\n`;
  snippet += `        </thead>\n`;
  snippet += `        <tbody>\n`;
  data.rows.forEach((row, idx) => {
    const isLast = idx === data.rows.length - 1;
    snippet += `          <tr${isLast?'':' style="border-bottom:1px solid #e5e7eb;"'}>\n`;
    snippet += `            <td style="padding:10px;"><strong>${row[0]}</strong></td>\n`;
    for (let i = 1; i < row.length; i++) {
      const cell = row[i];
      const isUs = i === row.length - 1;
      let color = '';
      if (cell.startsWith('✓')) color = 'color:#16a34a;font-weight:600;';
      else if (cell.startsWith('✗')) color = 'color:#dc2626;';
      else if (cell.match(/Sometimes|Mixed|Some|OK|Limited|Partial|Often/i)) color = 'color:#f59e0b;';
      const bg = isUs ? 'background:#fff5e6;font-weight:600;' : '';
      snippet += `            <td style="padding:10px;text-align:center;${bg}${color}">${cell}</td>\n`;
    }
    snippet += `          </tr>\n`;
  });
  snippet += `        </tbody>\n`;
  snippet += `      </table>\n`;
  snippet += `      </div>\n`;
  snippet += `    </div>\n`;
}

snippet += `{%- endcase -%}\n`;

// Validate
const md = (snippet.match(/\]\(http/g) || []).length;
const opens = (snippet.match(/\{%-?\s*(if|for|unless|case)/g) || []).length;
const closes = (snippet.match(/\{%-?\s*(endif|endfor|endunless|endcase)/g) || []).length;

console.log('\nValidation:');
console.log('  Markdown corruption:', md);
console.log('  Liquid blocks:', opens, '/', closes);
console.log('  Products covered:', Object.keys(COMPARISONS).length);

if (md > 0 || opens !== closes) { console.log('❌ FAILED'); process.exit(1); }

fs.writeFileSync('theme-files/snippets/product-comparison-table.liquid', snippet);
console.log(`\n✅ Written: ${snippet.length} bytes (${(snippet.length/1024).toFixed(1)}KB)`);
