const fs = require('fs');

const TPL = 'theme-files/sections/product-template-1.liquid';
let tpl = fs.readFileSync(TPL, 'utf8');

console.log('Current trust-band count:', (tpl.match(/product-trust-band/g) || []).length);
console.log('Current risk-reversal count:', (tpl.match(/product-risk-reversal/g) || []).length);

// Find ATC button area — most reliable anchor: the AddToCart button id
const atcBtnIdx = tpl.indexOf('id="AddToCart-{{');
if (atcBtnIdx === -1) {
  console.log('❌ AddToCart button id not found');
  process.exit(1);
}

// Find next </form> after the AddToCart button
const formClose = tpl.indexOf('</form>', atcBtnIdx);
if (formClose === -1) {
  console.log('❌ </form> not found after AddToCart');
  process.exit(1);
}

// Verify there's no existing render after this form close
const lookahead = tpl.slice(formClose, formClose + 500);
if (lookahead.includes("'product-trust-band'")) {
  console.log('Already injected, skipping');
  process.exit(0);
}

// Inject right after </form>
const insertAt = formClose + '</form>'.length;
const injection = `\n              {%- render 'product-trust-band' -%}\n              {%- render 'product-risk-reversal' -%}\n`;

tpl = tpl.slice(0, insertAt) + injection + tpl.slice(insertAt);

// Validate balanced
const opens = (tpl.match(/\{%-?\s*(if|for|unless|case)/g) || []).length;
const closes = (tpl.match(/\{%-?\s*(endif|endfor|endunless|endcase)/g) || []).length;
console.log('Liquid blocks balance:', opens, '/', closes);
if (opens !== closes) { console.log('❌ Unbalanced'); process.exit(1); }

fs.writeFileSync(TPL, tpl);
console.log('✅ Injected after AddToCart </form>');
console.log('New trust-band count:', (tpl.match(/product-trust-band/g) || []).length);
console.log('New risk-reversal count:', (tpl.match(/product-risk-reversal/g) || []).length);

// Show context for verification
const newIdx = tpl.indexOf("product-trust-band");
console.log('\nContext around injection:');
console.log(tpl.slice(Math.max(0, newIdx - 100), newIdx + 200));
