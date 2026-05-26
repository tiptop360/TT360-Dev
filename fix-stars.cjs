const fs = require('fs');
const { execSync } = require('child_process');

const CARD = 'theme-files/snippets/product-card.liquid';
let card = fs.readFileSync(CARD, 'utf8');

// Find current rating block
console.log('=== CURRENT RATING BLOCKS ===');
const matches = card.match(/<div class="product-card__rating"[\s\S]{0,300}/g) || [];
matches.slice(0,2).forEach((m,i) => console.log(`Block ${i+1}:\n${m}\n`));

// Replace with SVG-based stars (always render, no font dependency)
const newRating = `{%- assign rc = product.metafields.reviews.rating_count -%}
{%- if rc and rc != 0 -%}
{%- assign rv = product.metafields.reviews.rating.value.value | default: 4.9 -%}
<div class="product-card__rating" style="display:inline-flex;align-items:center;gap:5px;margin:6px 0;font-size:13px;line-height:1;">
<span style="display:inline-flex;gap:1px;">
<svg width="14" height="14" viewBox="0 0 24 24" fill="#FFB800" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
<svg width="14" height="14" viewBox="0 0 24 24" fill="#FFB800" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
<svg width="14" height="14" viewBox="0 0 24 24" fill="#FFB800" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
<svg width="14" height="14" viewBox="0 0 24 24" fill="#FFB800" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
<svg width="14" height="14" viewBox="0 0 24 24" fill="#FFB800" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
</span>
<span style="color:#444;font-weight:600;">{{ rv }}</span>
<span style="color:#888;">({{ rc }})</span>
</div>
`;

// Strip ALL existing rating blocks first (start of {%- assign rc through closing </div>)
const oldPattern = /\{%-\s*assign rc = product\.metafields\.reviews\.rating_count[\s\S]*?<\/div>\s*\{%-\s*endif\s*-%\}\s*/g;
let stripped = card.replace(oldPattern, '');
const stripCount = (card.match(oldPattern) || []).length;
console.log(`Stripped ${stripCount} old rating blocks`);

// Re-inject inside each card style div
let injectCount = 0;
stripped = stripped.replace(/(<div class="product-card js-product-card[^"]*"[^>]*>)/g, (m) => {
  injectCount++;
  return m + '\n' + newRating + '{%- endif -%}\n';
});
console.log(`Injected SVG rating in ${injectCount} card styles`);

// Validate
const opens = (stripped.match(/\{%-?\s*(if|for|unless|case)\b/g) || []).length;
const closes = (stripped.match(/\{%-?\s*(endif|endfor|endunless|endcase)\b/g) || []).length;
console.log(`Liquid balance: ${opens}/${closes}`);
if (opens !== closes) { console.log('❌ Unbalanced'); process.exit(1); }

const md = (stripped.match(/\[[a-z_][a-z0-9_.]*\]\(http:\/\/[a-z_][a-z0-9_.]*\)/g) || []).length;
console.log(`Markdown corruption: ${md}`);
if (md > 0) { console.log('❌ Corruption'); process.exit(1); }

fs.writeFileSync(CARD, stripped);
console.log('✅ Card written:', stripped.length, 'bytes');

// Push
execSync(`shopify theme push --store zrhgzw-xt.myshopify.com --theme 145031200883 --path ./theme-files --only ${CARD} --allow-live`, {stdio:'inherit'});
console.log('✅ Pushed');
