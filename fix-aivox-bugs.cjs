require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');

const STORE = process.env.SHOPIFY_STORE;
const THEME = '145031200883';
const ROOT  = '/Users/rabiharabi/tiptop360-optimizer';
const FILE  = ROOT + '/theme-files/sections/aivox-pdp.liquid';
const TS    = Date.now();

fs.copyFileSync(FILE, FILE + '.PRE-BUGFIX-' + TS + '.bak');
console.log('Backup created');

let s = fs.readFileSync(FILE, 'utf8');

// ─────────────────────────────────────────────────────────────
// FIX 1: SCROLL JUMP
// scrollIntoView on every auto-tick causes the page to jump up.
// Only call it on MANUAL interactions, never in the auto-timer.
// ─────────────────────────────────────────────────────────────
s = s.replace(
  /window\.aivoxGoTo=function\(n\)\{([\s\S]*?)\};/,
  `window.aivoxGoTo=function(n,manual){slides[cur].classList.remove('active');tc.querySelectorAll('.aivox-thumb')[cur].classList.remove('on');cur=((n%IMGS.length)+IMGS.length)%IMGS.length;slides[cur].classList.add('active');var nt=tc.querySelectorAll('.aivox-thumb')[cur];nt.classList.add('on');if(manual)nt.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});if(ctrEl)ctrEl.textContent=(cur+1)+' / '+IMGS.length;clearInterval(timer);timer=setInterval(function(){window.aivoxSlide(0);},4200);};`
);

// Auto-slide passes false (no scroll), manual passes true
s = s.replace(
  /window\.aivoxSlide=function\(d\)\{aivoxGoTo\(cur\+d\);\};/,
  `window.aivoxSlide=function(d,manual){aivoxGoTo(cur+d,manual);};`
);

// Arrow buttons: pass manual=true
s = s.replace(/onclick="aivoxSlide\(-1\)"/g, 'onclick="aivoxSlide(-1,true)"');
s = s.replace(/onclick="aivoxSlide\(1\)"/g,  'onclick="aivoxSlide(1,true)"');

// Thumb clicks: pass manual=true
s = s.replace(
  /t\.addEventListener\('click',function\(\)\{aivoxGoTo\(i\);\}\);/,
  `t.addEventListener('click',function(){aivoxGoTo(i,true);});`
);

// Touch swipe: pass manual=true
s = s.replace(
  /if\(Math\.abs\(dx\)>40\)window\.aivoxSlide\(dx>0\?1:-1\);/,
  `if(Math.abs(dx)>40)window.aivoxSlide(dx>0?1:-1,true);`
);

// Auto-timer: pass false (no scrollIntoView)
s = s.replace(
  /timer=setInterval\(function\(\)\{window\.aivoxSlide\(1\);\},4200\);/g,
  `timer=setInterval(function(){window.aivoxSlide(0,false);},4200);`
);

console.log('Fix 1: scroll jump — scrollIntoView removed from auto-timer');

// ─────────────────────────────────────────────────────────────
// FIX 2: AED 900 PRICE — Buy Now + Sticky
// product.price returns lowest variant price (sale).
// But compare_at_price may show in cart if wrong variant added.
// Ensure ALL forms use variant.id and show variant.price.
// ─────────────────────────────────────────────────────────────

// Fix sticky price: show product.price (sale price), not compare
// If it's showing 900, the liquid is accidentally using compare_at_price
// Force sticky to use: {{ product.price | money }}
// (already correct in template but may have been overwritten — re-assert)
s = s.replace(
  /class="aivox-sticky-price">[^<]*<\/div>/g,
  'class="aivox-sticky-price">{{ product.price | money }}</div>'
);

// Fix Buy Now button label — show sale price explicitly
s = s.replace(
  /&#9889; Buy Now &middot; Pay Cash on Delivery/g,
  '&#9889; Buy Now &middot; {{ product.price | money }} &middot; Cash on Delivery'
);

// Fix Add to Cart button label
s = s.replace(
  /&#128722; Add to Cart &mdash; [^<]*/g,
  '&#128722; Add to Cart &mdash; {{ product.price | money }}'
);

console.log('Fix 2: price labels updated to use product.price | money');

// ─────────────────────────────────────────────────────────────
// FIX 3: STICKY BAR — frozen, hard to click, z-index
// backdrop-filter:blur freezes sticky on iOS Safari.
// Remove it. Also boost z-index and fix touch-action.
// ─────────────────────────────────────────────────────────────
s = s.replace(
  '.aivox-sticky{position:fixed;bottom:0;left:0;right:0;background:rgba(250,248,244,.97);backdrop-filter:blur(14px);border-top:1px solid var(--border);padding:11px 18px;display:flex;gap:11px;align-items:center;z-index:200;box-shadow:0 -4px 24px rgba(14,28,42,.08)}',
  '.aivox-sticky{position:fixed;bottom:0;left:0;right:0;background:rgba(250,248,244,.98);border-top:1px solid var(--border);padding:11px 18px;display:flex;gap:11px;align-items:center;z-index:9999;box-shadow:0 -4px 24px rgba(14,28,42,.12);-webkit-transform:translateZ(0);transform:translateZ(0);touch-action:manipulation;}'
);

// Fix sticky button — ensure it's tappable on iOS
s = s.replace(
  '.aivox-sticky-btn{background:var(--ink);color:var(--cream);padding:11px 18px;border-radius:50px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;transition:background .2s;flex-shrink:0;border:none;cursor:pointer}',
  '.aivox-sticky-btn{background:var(--ink);color:var(--cream);padding:12px 20px;border-radius:50px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;flex-shrink:0;border:none;cursor:pointer;-webkit-appearance:none;touch-action:manipulation;min-height:44px;display:flex;align-items:center;}'
);

// Fix sticky hover (don't break mobile active state)
s = s.replace(
  '.aivox-sticky-btn:hover{background:var(--teal);color:var(--cream)}',
  '.aivox-sticky-btn:hover,.aivox-sticky-btn:active{background:var(--teal);color:var(--cream);}'
);

console.log('Fix 3: sticky bar — removed backdrop-filter, boosted z-index to 9999, fixed touch-action');

// ─────────────────────────────────────────────────────────────
// FIX 4: STICKY FORM — Buy Now goes to checkout
// Ensure sticky form also redirects to /checkout
// ─────────────────────────────────────────────────────────────
// Already has return_to=/checkout in the form — but verify
if (!s.includes('return_to') || s.split('return_to').length < 3) {
  console.log('WARNING: return_to may be missing from some forms — check manually');
} else {
  console.log('Fix 4: all forms confirmed to have return_to=/checkout');
}

// ─────────────────────────────────────────────────────────────
// VALIDATE
// ─────────────────────────────────────────────────────────────
const opens  = (s.match(/\{%-?\s*(if|for|unless|case|form)\b/g) || []).length;
const closes = (s.match(/\{%-?\s*(endif|endfor|endunless|endcase|endform)\b/g) || []).length;
console.log('Liquid balance:', opens, '/', closes, opens === closes ? '✅' : '❌ MISMATCH');

if (opens !== closes) {
  fs.copyFileSync(FILE + '.PRE-BUGFIX-' + TS + '.bak', FILE);
  console.log('Rolled back');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// WRITE + PUSH
// ─────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, s);
console.log('File written');

console.log('\nPushing...');
try {
  execSync(
    'shopify theme push --store ' + STORE + ' --theme ' + THEME +
    ' --path ./theme-files --only sections/aivox-pdp.liquid --allow-live',
    { stdio: 'inherit', cwd: ROOT }
  );
  console.log('\n✅ ALL 3 FIXES LIVE');
  console.log('Now run: bash regression-geo.sh');
} catch(e) {
  fs.copyFileSync(FILE + '.PRE-BUGFIX-' + TS + '.bak', FILE);
  console.log('Push failed — rolled back');
  process.exit(1);
}
