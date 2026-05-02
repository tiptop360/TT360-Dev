const fs = require('fs');

const TPL = 'theme-files/sections/product-template-1.liquid';
let tpl = fs.readFileSync(TPL, 'utf8');

console.log('🩹 HEAL + INJECT\n' + '='.repeat(50));

// === STEP 1: Heal markdown corruption ===
// Pattern: [identifier.like.this](http://identifier.like.this) → identifier.like.this
const before = tpl.length;
tpl = tpl.replace(/\[([a-z_][a-z0-9_.]*)\]\(http:\/\/[a-z_][a-z0-9_.]*\)/g, '$1');

// Count remaining
const remaining = (tpl.match(/\[[a-z_][a-z0-9_.]*\]\(http:\/\/[a-z_][a-z0-9_.]*\)/g) || []).length;
console.log(`[1] Healed corruption: ${before - tpl.length} chars removed, ${remaining} remaining`);
if (remaining > 0) { console.log('❌ Still corrupted'); process.exit(1); }

// === STEP 2: Validate Liquid balance ===
const opens = (tpl.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
const closes = (tpl.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
console.log(`[2] Liquid balance: ${opens} opens / ${closes} closes`);
if (opens !== closes) { console.log('❌ Unbalanced after heal'); process.exit(1); }

// === STEP 3: Inject trust band + risk reversal ===
// Find the ATC button's PARENT </button> closing tag
const atcIdx = tpl.indexOf('id="AddToCart-{{');
if (atcIdx === -1) { console.log('❌ ATC not found'); process.exit(1); }

// Look for first </button> after ATC button
const btnClose = tpl.indexOf('</button>', atcIdx);
if (btnClose === -1) { console.log('❌ </button> not found'); process.exit(1); }
console.log(`[3] Found </button> at position ${btnClose}`);

// Find next </form> OR end of product-form div, whichever comes first
const formClose = tpl.indexOf('</form>', btnClose);
const divPattern = tpl.indexOf('<!-- product-form end', btnClose);
const insertPoint = formClose > -1 ? formClose + '</form>'.length : btnClose + '</button>'.length;

console.log(`[4] Inserting CRO blocks after position ${insertPoint}`);

if (!tpl.includes("'product-trust-band'")) {
  const injection = `\n              {%- render 'product-trust-band' -%}\n              {%- render 'product-risk-reversal' -%}\n`;
  tpl = tpl.slice(0, insertPoint) + injection + tpl.slice(insertPoint);
  console.log('[5] ✅ Injected');
} else {
  console.log('[5] Already injected');
}

// === STEP 4: Final validation ===
const finalOpens = (tpl.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
const finalCloses = (tpl.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
const finalCorruption = (tpl.match(/\[[a-z_][a-z0-9_.]*\]\(http:\/\/[a-z_][a-z0-9_.]*\)/g) || []).length;
console.log(`\n[6] Final: ${finalOpens}/${finalCloses} liquid, ${finalCorruption} corruption`);
if (finalOpens !== finalCloses || finalCorruption !== 0) { console.log('❌ Final validation failed'); process.exit(1); }

fs.writeFileSync(TPL, tpl);
console.log('\n✅ File written. Length:', tpl.length);
console.log('Trust band count:', (tpl.match(/product-trust-band/g) || []).length);
console.log('Risk reversal count:', (tpl.match(/product-risk-reversal/g) || []).length);
